import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { logAction } from './audit';

export interface Cemetery {
  id?: string;
  tenantId: string;
  name: string;
  address: string;
  capacity?: number;
  latitude?: number;
  longitude?: number;
  createdBy?: string;
  createdAt?: any;
}

export interface Sector {
  id?: string;
  tenantId: string;
  cemeteryId: string;
  name: string; // e.g., "Quadra A"
  type: 'ground' | 'vertical' | 'ossuary';
  capacity: number;
  occupiedCount?: number;
  centerLat?: number;
  centerLng?: number;
  gridRows?: number;
  gridCols?: number;
  createdAt?: any;
  createdBy?: string;
}

export interface Plot {
  id?: string;
  tenantId: string;
  sectorId: string;
  cemeteryId: string;
  code: string; // e.g., "Q1-L001"
  sectorName?: string;
  type: 'Jazigo' | 'Mausoleu' | 'Ossuario';
  status: 'available' | 'occupied' | 'reserved' | 'blocked';
  deceasedId?: string; // Link to current occupant
  occupantName?: string;
  row?: number;
  column?: number;
  latitude?: number;
  longitude?: number;
  sanitaryRisk?: 'low' | 'medium' | 'high';
  environmentalRisk?: 'low' | 'medium' | 'high';
  structuralStatus?: 'ok' | 'attention' | 'critical';
  documentStatus?: 'regular' | 'pending';
  lastInspectionAt?: any;
  createdAt?: any;
  updatedAt?: any;
}

const CEMETERIES_COL = 'cemeteries';
const SECTORS_COL = 'sectors';
const PLOTS_COL = 'plots';

// --- Cemeteries ---

export async function getCemetery(id: string) {
  const docRef = doc(db, CEMETERIES_COL, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Cemetery;
}

export async function getAllCemeteries() {
  const q = query(collection(db, CEMETERIES_COL));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cemetery));
}

export async function getCemeteries(tenantId: string) {
  const q = query(collection(db, CEMETERIES_COL), where('tenantId', '==', tenantId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cemetery));
}

export async function createCemetery(tenantId: string, data: Omit<Cemetery, 'id' | 'tenantId' | 'createdAt'>) {
  const recordData = {
    ...data,
    tenantId,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid
  };
  // Ensure we are writing to the correct collection
  const docRef = await addDoc(collection(db, CEMETERIES_COL), recordData);
  await logAction(tenantId, 'CREATE_CEMETERY', CEMETERIES_COL, docRef.id, null, recordData);
  return docRef.id;
}

export async function deleteCemetery(tenantId: string, cemeteryId: string) {
  await deleteDoc(doc(db, CEMETERIES_COL, cemeteryId));
  await logAction(tenantId, 'DELETE_CEMETERY', CEMETERIES_COL, cemeteryId, null, null);
}

export async function updateCemetery(tenantId: string, cemeteryId: string, data: Partial<Cemetery>) {
  const docRef = doc(db, CEMETERIES_COL, cemeteryId);
  const oldDoc = await getDoc(docRef);
  const oldData = oldDoc.data();

  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid
  });
  await logAction(tenantId, 'UPDATE_CEMETERY', CEMETERIES_COL, cemeteryId, oldData, data);
}

// --- Sectors ---

export async function getSectors(cemeteryId: string) {
  // Assuming sectors are a root collection for easier querying, or subcollection. 
  // Let's use root collection with cemeteryId reference for simplicity in this demo.
  const q = query(collection(db, SECTORS_COL), where('cemeteryId', '==', cemeteryId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector));
}

function getSectorPrefix(name: string) {
  return name
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4) || 'SEC';
}

interface CreateSectorPayload extends Omit<Sector, 'id' | 'tenantId' | 'cemeteryId'> {
  generatePlots?: boolean;
  plotType?: Plot['type'];
}

export async function createSector(tenantId: string, cemeteryId: string, data: CreateSectorPayload) {
  const recordData = {
    ...data,
    tenantId,
    cemeteryId,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid
  };
  const docRef = await addDoc(collection(db, SECTORS_COL), recordData);
  await logAction(tenantId, 'CREATE_SECTOR', SECTORS_COL, docRef.id, null, recordData);

  if (data.generatePlots && data.capacity > 0) {
    const capacity = Math.min(data.capacity, 3000);
    const gridCols = data.gridCols || Math.ceil(Math.sqrt(capacity));
    const gridRows = data.gridRows || Math.ceil(capacity / gridCols);
    const baseLat = data.centerLat || 0;
    const baseLng = data.centerLng || 0;
    const latStep = 0.00003;
    const lngStep = 0.00003;
    const prefix = getSectorPrefix(data.name);
    const now = Timestamp.now();

    let batch = writeBatch(db);
    let operations = 0;

    for (let i = 0; i < capacity; i++) {
      const row = Math.floor(i / gridCols) + 1;
      const column = (i % gridCols) + 1;
      const plotRef = doc(collection(db, PLOTS_COL));
      const payload: Plot = {
        tenantId,
        cemeteryId,
        sectorId: docRef.id,
        sectorName: data.name,
        code: `${prefix}-${String(i + 1).padStart(4, '0')}`,
        type: data.plotType || 'Jazigo',
        status: 'available',
        row,
        column,
        latitude: baseLat ? baseLat + (row - Math.ceil(gridRows / 2)) * latStep : undefined,
        longitude: baseLng ? baseLng + (column - Math.ceil(gridCols / 2)) * lngStep : undefined,
        sanitaryRisk: 'low',
        environmentalRisk: 'low',
        structuralStatus: 'ok',
        documentStatus: 'regular',
        createdAt: now,
        updatedAt: now
      };
      batch.set(plotRef, payload);
      operations++;

      if (operations >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        operations = 0;
      }
    }

    if (operations > 0) {
      await batch.commit();
    }
  }

  return docRef.id;
}

// --- Plots ---

export async function getPlots(sectorId: string) {
  const q = query(collection(db, PLOTS_COL), where('sectorId', '==', sectorId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plot));
}

export async function getCemeteryPlots(cemeteryId: string) {
  const q = query(collection(db, PLOTS_COL), where('cemeteryId', '==', cemeteryId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plot));
}

export async function getTenantPlots(tenantId: string) {
  const q = query(collection(db, PLOTS_COL), where('tenantId', '==', tenantId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plot));
}

interface CreatePlotPayload extends Omit<Plot, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'> {}

export async function createPlot(tenantId: string, data: CreatePlotPayload) {
  const payload: Plot = {
    ...data,
    tenantId,
    sanitaryRisk: data.sanitaryRisk || 'low',
    environmentalRisk: data.environmentalRisk || 'low',
    structuralStatus: data.structuralStatus || 'ok',
    documentStatus: data.documentStatus || 'regular',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const docRef = await addDoc(collection(db, PLOTS_COL), payload);
  await logAction(tenantId, 'CREATE_PLOT', PLOTS_COL, docRef.id, null, payload);
  return docRef.id;
}

export async function updatePlot(plotId: string, tenantId: string, data: Partial<Plot>) {
  const plotRef = doc(db, PLOTS_COL, plotId);
  const oldSnap = await getDoc(plotRef);
  const oldData = oldSnap.data();

  await updateDoc(plotRef, {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid
  });
  await logAction(tenantId, 'UPDATE_PLOT', PLOTS_COL, plotId, oldData, data);
}
