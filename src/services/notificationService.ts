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

export interface DeathNotification {
  id?: string;
  tenantId: string;
  createdBy: string;
  createdAt: any;
  status: 'submitted' | 'reviewing' | 'allocated' | 'rejected';
  
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
    // @ts-ignore - cemeteryId is new
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
    },
    photoUrl,
    documents: uploadedDocs,
  };

  const docRef = await addDoc(collection(db, COLLECTION), notification);
  return docRef.id;
}

// --- Migration Tool (Dev Only) ---
import { getCemetery } from './cemeteryService';

export async function fixWrongTenantIdsForNotifications() {
  if (!auth.currentUser) return;
  
  console.log("Starting migration: fixWrongTenantIdsForNotifications...");
  
  // Find potentially wrong docs: where tenantId == createdBy
  // Note: This query might need an index or be slow, but it's a dev tool.
  // We'll just fetch all notifications for now to be safe and check client-side
  // or query by createdBy if we assume the user is running it.
  // Let's query all notifications where tenantId looks like a UID (length 28 is typical for Firebase Auth UIDs)
  
  const q = query(collection(db, COLLECTION)); 
  const snapshot = await getDocs(q);
  
  let fixedCount = 0;
  let skippedCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as DeathNotification & { cemeteryId?: string };
    
    // Check if tenantId looks suspicious (same as createdBy is a strong signal)
    if (data.tenantId === data.createdBy) {
      if (data.cemeteryId) {
        const cemetery = await getCemetery(data.cemeteryId);
        if (cemetery && cemetery.tenantId) {
          await updateDoc(doc(db, COLLECTION, docSnap.id), {
            tenantId: cemetery.tenantId
          });
          console.log(`Fixed doc ${docSnap.id}: ${data.tenantId} -> ${cemetery.tenantId}`);
          fixedCount++;
        } else {
          console.warn(`Doc ${docSnap.id} has cemeteryId ${data.cemeteryId} but cemetery not found or has no tenantId.`);
        }
      } else {
        // No cemeteryId, mark as reviewing/rejected
        await updateDoc(doc(db, COLLECTION, docSnap.id), {
          status: 'reviewing', // or 'rejected'
          rejectionReason: 'Sistema: Tenant ID inválido e sem cemitério vinculado. Por favor, contate o suporte.'
        });
        console.log(`Marked doc ${docSnap.id} as reviewing (missing cemeteryId).`);
        fixedCount++;
      }
    } else {
      skippedCount++;
    }
  }
  
  console.log(`Migration complete. Fixed: ${fixedCount}, Skipped: ${skippedCount}`);
}

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
  allocationData: { cemeteryId: string; sectorId: string; plotId: string; plotCode?: string }
) {
  if (!auth.currentUser) return;

  const updateData = {
    status: 'allocated',
    allocation: {
      ...allocationData,
      assignedBy: auth.currentUser.uid,
      assignedAt: serverTimestamp()
    }
  };

  await updateDoc(doc(db, COLLECTION, notificationId), updateData);
  
  // Also update the plot status
  await updateDoc(doc(db, 'plots', allocationData.plotId), {
    status: 'occupied', // or reserved
    deceasedId: notificationId // Linking to notification for now, ideally to a deceased record
  });
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
    console.error("deleteNotification: User not authenticated");
    throw new Error("Usuário não autenticado.");
  }
  
  console.log(`Attempting to delete notification ${notificationId} for user ${auth.currentUser.uid}`);
  
  try {
    await deleteDoc(doc(db, COLLECTION, notificationId));
    console.log(`Notification ${notificationId} deleted successfully.`);
  } catch (error) {
    console.error("Error deleting notification document:", error);
    throw error;
  }
}
