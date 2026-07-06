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

// Lookup em lote (get pontual, nunca list) do solicitante de uma comunicação de óbito (W3-10).
export interface RequesterInfo {
  displayName: string | null;
  phone: string | null;
}

const requesterCache = new Map<string, RequesterInfo>();

export async function getRequesterInfo(uid: string): Promise<RequesterInfo> {
  const cached = requesterCache.get(uid);
  if (cached) return cached;
  try {
    const snap = await getDoc(doc(db, COLLECTION, uid));
    const data = snap.exists() ? snap.data() : null;
    const info: RequesterInfo = {
      displayName: (data?.displayName as string) || null,
      phone: (data?.phone as string) || null,
    };
    requesterCache.set(uid, info);
    return info;
  } catch {
    // Perfil inexistente ou regra negando: degrada para anônimo
    const info: RequesterInfo = { displayName: null, phone: null };
    requesterCache.set(uid, info);
    return info;
  }
}

export async function uploadUserProfilePhoto(file: File, tenantId?: string | null) {
  if (!auth.currentUser) throw new Error('Usuario nao autenticado.');
  const storageRef = ref(storage, `photos/${auth.currentUser.uid}/profile_${Date.now()}_${file.name}`);
  // Perfil do cidadão: grava tenantId no metadado se houver; senão o dono continua acessando (W2-2)
  await uploadBytes(storageRef, file, tenantId ? { customMetadata: { tenantId } } : undefined);
  return getDownloadURL(storageRef);
}

export async function saveUserProfile(
  uid: string,
  payload: Partial<UserProfile>,
  options?: { photoFile?: File; tenantId?: string | null }
) {
  let photoUrl = payload.photoUrl;

  if (options?.photoFile) {
    photoUrl = await uploadUserProfilePhoto(options.photoFile, options?.tenantId ?? null);
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
