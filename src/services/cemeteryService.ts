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
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { logAction } from './audit';

export interface Cemetery {
  id?: string;
  tenantId: string;
  name: string;
  address: string;
  capacity?: number;
  createdAt?: any;
}

export interface Sector {
  id?: string;
  cemeteryId: string;
  name: string; // e.g., "Quadra A"
  type: 'ground' | 'vertical' | 'ossuary';
  capacity: number;
}

export interface Plot {
  id?: string;
  sectorId: string;
  cemeteryId: string;
  code: string; // e.g., "Q1-L001"
  status: 'available' | 'occupied' | 'reserved';
  deceasedId?: string; // Link to current occupant
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

// --- Sectors ---

export async function getSectors(cemeteryId: string) {
  // Assuming sectors are a root collection for easier querying, or subcollection. 
  // Let's use root collection with cemeteryId reference for simplicity in this demo.
  const q = query(collection(db, SECTORS_COL), where('cemeteryId', '==', cemeteryId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector));
}

export async function createSector(tenantId: string, cemeteryId: string, data: Omit<Sector, 'id' | 'cemeteryId'>) {
  const recordData = {
    ...data,
    cemeteryId,
    tenantId
  };
  const docRef = await addDoc(collection(db, SECTORS_COL), recordData);
  await logAction(tenantId, 'CREATE_SECTOR', SECTORS_COL, docRef.id, null, recordData);
  
  // Optional: Batch create plots based on capacity
  // This would typically be a Cloud Function to avoid timeout on client
  return docRef.id;
}

// --- Plots ---

export async function getPlots(sectorId: string) {
  const q = query(collection(db, PLOTS_COL), where('sectorId', '==', sectorId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plot));
}
