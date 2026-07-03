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
  orderBy, 
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '@/lib/firebase';
import { logAction } from './audit';
import { createDeceased } from '@/services/deceasedService';
import { updatePlot } from '@/services/cemeteryService';
import { invalidateCache } from '@/lib/queryCache';

export interface DeathNotification {
  id?: string;
  tenantId: string;
  createdBy: string;
  createdAt: any;
  status: 'submitted' | 'reviewing' | 'allocated' | 'rejected';
  cemeteryId?: string;
  
  deceased: {
    name: string;
    dateOfBirth: string;
    dateOfDeath: string;
    city?: string;
    state?: string;
    profession?: string;
    hobbies?: string;
    familyMembers?: string;
    achievements?: string;
    obituary?: string;
    epitaph?: string;
    relationshipType?: string;
    relationshipLabel?: string;
  };

  photoUrl: string | null;
  documents: { name: string; url: string }[];

  allocation?: {
    cemeteryId: string;
    sectorId: string;
    plotId: string;
    plotCode?: string;
    assignedBy: string;
    assignedAt: any;
  };
  
  rejectionReason?: string;
}

const COLLECTION = 'death_notifications';

export async function createDeathNotification(tenantId: string, data: any, files: File[], photoFile?: File) {
  // Validation
  if (!auth.currentUser) throw new Error("Usuário não autenticado.");
  if (!tenantId) throw new Error("Tenant ID inválido.");
  if (tenantId === auth.currentUser.uid) {
    throw new Error("Erro de configuração: Tenant ID não pode ser igual ao UID do usuário.");
  }
  if (!data.cemeteryId) throw new Error("Cemitério é obrigatório.");

  // 1. Upload documents
  const uploadedDocs = [];
  for (const file of files) {
    const storageRef = ref(storage, `documents/${auth.currentUser?.uid}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    uploadedDocs.push({ name: file.name, url });
  }

  // 2. Upload photo if exists
  let photoUrl = null;
  if (photoFile) {
    const photoRef = ref(storage, `photos/${auth.currentUser?.uid}/${Date.now()}_${photoFile.name}`);
    await uploadBytes(photoRef, photoFile);
    photoUrl = await getDownloadURL(photoRef);
  }

  // 3. Create Firestore record
  const notification: Omit<DeathNotification, 'id'> = {
    tenantId,
    createdBy: auth.currentUser?.uid || '',
    createdAt: serverTimestamp(),
    status: 'submitted',
    cemeteryId: data.cemeteryId,
    deceased: {
      name: data.name,
      dateOfBirth: data.dateOfBirth,
      dateOfDeath: data.dateOfDeath,
      city: data.city,
      state: data.state,
      profession: data.profession,
      hobbies: data.hobbies,
      familyMembers: data.familyMembers,
      achievements: data.achievements,
      obituary: data.obituary,
      epitaph: data.epitaph,
      relationshipType: data.relationshipType,
      relationshipLabel: data.relationshipLabel,
    },
    photoUrl,
    documents: uploadedDocs,
  };

  const docRef = await addDoc(collection(db, COLLECTION), notification);
  return docRef.id;
}

// NOTA (A5): a função de migração `fixWrongTenantIdsForNotifications` foi removida daqui
// e movida para o script standalone `scripts/migrate-tenant-ids.ts`, executado uma única
// vez com credenciais admin — nunca pela UI de produção.

export async function getMyNotifications() {
  if (!auth.currentUser) return [];
  
  const q = query(
    collection(db, COLLECTION),
    where('createdBy', '==', auth.currentUser.uid),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeathNotification));
}

export async function getTenantNotifications(tenantId: string) {
  const q = query(
    collection(db, COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeathNotification));
}

export function listenNotification(id: string, callback: (data: DeathNotification) => void) {
  return onSnapshot(doc(db, COLLECTION, id), (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as DeathNotification);
    }
  });
}

export async function allocateNotification(
  notificationId: string,
  tenantId: string,
  allocationData: { cemeteryId: string; sectorId: string; plotId: string; plotCode?: string }
): Promise<{ notificationId: string; deceasedId: string }> {
  if (!auth.currentUser) throw new Error('Usuário não autenticado.');

  // 1. Buscar dados completos da notificação
  const notifSnap = await getDoc(doc(db, COLLECTION, notificationId));
  if (!notifSnap.exists()) throw new Error('Notificação não encontrada.');
  const notif = { id: notifSnap.id, ...notifSnap.data() } as DeathNotification;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // 2. Criar registro oficial em `deceaseds`
  // DIVERGÊNCIA: DeathNotification.deceased não possui os campos wakeDate/wakeTime/wakeLocation
  // presentes no exemplo do plano; foram omitidos aqui pois não existem na origem dos dados.
  const deceasedId = await createDeceased(tenantId, {
    name: notif.deceased.name,
    dateOfBirth: notif.deceased.dateOfBirth,
    dateOfDeath: notif.deceased.dateOfDeath,
    cemeteryId: allocationData.cemeteryId,
    plotId: allocationData.plotId,
    profession: notif.deceased.profession,
    hobbies: notif.deceased.hobbies,
    familyMembers: notif.deceased.familyMembers,
    achievements: notif.deceased.achievements,
    obituary: notif.deceased.obituary,
    epitaph: notif.deceased.epitaph,
    photoUrl: notif.photoUrl || undefined,
    city: notif.deceased.city,
    state: notif.deceased.state,
    documents: notif.documents,
  }, [], undefined);

  // 3. Atualizar o plot com todos os campos necessários para prazos
  await updatePlot(allocationData.plotId, tenantId, {
    status: 'occupied',
    deceasedId,
    occupantName: notif.deceased.name,
    burialDate: today, // Obrigatório para cálculo de exumação
    exhumationDeadlineYears: 3, // Lei federal — pode ser configurável por cemitério
    documentStatus: 'pending', // Aguarda regularização documental
  });

  // 4. Atualizar a notificação com referência ao deceasedId real
  await updateDoc(doc(db, COLLECTION, notificationId), {
    status: 'allocated',
    deceasedId, // Link para o registro oficial
    allocation: {
      ...allocationData,
      assignedBy: auth.currentUser.uid,
      assignedAt: serverTimestamp()
    }
  });

  await logAction(tenantId, 'ALLOCATE_DEATH_NOTIFICATION', COLLECTION, notificationId, null, {
    deceasedId,
    plotId: allocationData.plotId,
    plotCode: allocationData.plotCode
  });

  // Invalida o snapshot em cache para refletir o novo sepultamento (A3.3)
  invalidateCache(`sci_snapshot:${tenantId}`);

  return { notificationId, deceasedId };
}

export async function rejectNotification(notificationId: string, reason: string) {
  if (!auth.currentUser) return;

  await updateDoc(doc(db, COLLECTION, notificationId), {
    status: 'rejected',
    rejectionReason: reason,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
}

export async function deleteNotification(notificationId: string) {
  if (!auth.currentUser) {
    throw new Error("Usuário não autenticado.");
  }

  try {
    await deleteDoc(doc(db, COLLECTION, notificationId));
  } catch (error) {
    console.error("Error deleting notification document:", error);
    throw error;
  }
}
