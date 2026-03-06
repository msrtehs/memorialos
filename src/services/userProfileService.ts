import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { auth, db, storage } from '@/lib/firebase';

export interface UserProfile {
  uid: string;
  tenantId?: string | null;
  displayName?: string;
  phone?: string;
  city?: string;
  state?: string;
  address?: string;
  emergencyContact?: string;
  preferredContact?: string;
  relationshipPreference?: string;
  notes?: string;
  photoUrl?: string;
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION = 'user_profiles';

export async function getUserProfile(uid: string) {
  const snapshot = await getDoc(doc(db, COLLECTION, uid));
  if (!snapshot.exists()) return null;
  return snapshot.data() as UserProfile;
}

export async function uploadUserProfilePhoto(file: File) {
  if (!auth.currentUser) throw new Error('Usuario nao autenticado.');
  const storageRef = ref(storage, `photos/${auth.currentUser.uid}/profile_${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function saveUserProfile(
  uid: string,
  payload: Partial<UserProfile>,
  options?: { photoFile?: File; tenantId?: string | null }
) {
  let photoUrl = payload.photoUrl;

  if (options?.photoFile) {
    photoUrl = await uploadUserProfilePhoto(options.photoFile);
  }

  const data: Partial<UserProfile> = {
    ...payload,
    photoUrl,
    uid,
    tenantId: options?.tenantId ?? payload.tenantId ?? null,
    updatedAt: serverTimestamp()
  };

  const profileRef = doc(db, COLLECTION, uid);
  const existing = await getDoc(profileRef);

  if (!existing.exists()) {
    await setDoc(profileRef, {
      ...data,
      createdAt: serverTimestamp()
    });
  } else {
    await setDoc(profileRef, data, { merge: true });
  }

  if (auth.currentUser && (payload.displayName || photoUrl)) {
    await updateProfile(auth.currentUser, {
      displayName: payload.displayName || auth.currentUser.displayName || undefined,
      photoURL: photoUrl || auth.currentUser.photoURL || undefined
    });
  }
}
