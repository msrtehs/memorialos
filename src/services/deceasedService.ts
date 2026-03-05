import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '@/lib/firebase';
import { logAction } from './audit';

export interface Deceased {
  id?: string;
  tenantId?: string; // Optional for user created
  name: string;
  dateOfBirth: string;
  dateOfDeath: string;
  cemeteryId?: string;
  plotId?: string;
  causeOfDeath?: string;
  
  // New fields
  photoUrl?: string;
  hobbies?: string;
  city?: string;
  state?: string;
  familyMembers?: string;
  profession?: string;
  achievements?: string;
  obituary?: string;
  epitaph?: string;
  wakeDate?: string;
  wakeTime?: string;
  wakeLocation?: string; // Could be derived from cemetery sector
  
  documents: { name: string; url: string }[];
  createdAt?: any;
  createdBy?: string;
}

const COLLECTION = 'deceaseds';

export async function getDeceasedList(tenantId: string) {
  const q = query(
    collection(db, COLLECTION), 
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deceased));
}

export async function getUserDeceasedList(userId: string) {
  const q = query(
    collection(db, COLLECTION), 
    where('createdBy', '==', userId)
    // orderBy('createdAt', 'desc') // Removed to avoid index requirement
  );
  const snapshot = await getDocs(q);
  // Sort in memory
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Deceased))
    .sort((a: any, b: any) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
}

export async function getDeceased(id: string) {
  const docRef = doc(db, COLLECTION, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Deceased;
}

export async function createDeceased(tenantId: string | null, data: Omit<Deceased, 'id' | 'tenantId' | 'createdAt'>, files: File[], photoFile?: File) {
  // 1. Upload documents
  const uploadedDocs = [];
  for (const file of files) {
    const storageRef = ref(storage, `documents/${auth.currentUser?.uid}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    uploadedDocs.push({ name: file.name, url });
  }

  // 2. Upload photo if exists
  let photoUrl = '';
  if (photoFile) {
    const photoRef = ref(storage, `photos/${auth.currentUser?.uid}/${Date.now()}_${photoFile.name}`);
    await uploadBytes(photoRef, photoFile);
    photoUrl = await getDownloadURL(photoRef);
  }

  // 3. Create Firestore record
  const recordData = {
    ...data,
    tenantId: tenantId || auth.currentUser?.uid || 'default', // Fallback
    documents: uploadedDocs,
    photoUrl: photoUrl || data.photoUrl || null, // Ensure not undefined
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid
  };

  const docRef = await addDoc(collection(db, COLLECTION), recordData);

  // 4. Log action (if tenant exists)
  if (tenantId) {
    await logAction(tenantId, 'CREATE_DECEASED', COLLECTION, docRef.id, null, recordData);
  }

  return docRef.id;
}

export async function updateDeceased(id: string, tenantId: string, data: Partial<Deceased>) {
  const docRef = doc(db, COLLECTION, id);
  const oldSnap = await getDoc(docRef);
  const oldData = oldSnap.data();

  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid
  });

  await logAction(tenantId, 'UPDATE_DECEASED', COLLECTION, id, oldData, data);
}
