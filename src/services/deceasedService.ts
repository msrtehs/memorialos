import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  limit,
  startAfter,
  writeBatch,
  deleteField,
  runTransaction,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '@/lib/firebase';
import { logAction } from './audit';
import { PlotUnavailableError } from './notificationService';
import { uploadFilesParallel } from '@/lib/storageUpload';

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
// Projeção pública (LGPD-safe) usada pela busca pública. NUNCA incluir campos
// sensíveis (causeOfDeath, familyMembers, documents) aqui.
const PUBLIC_COLLECTION = 'public_deceaseds';
export const PUBLIC_FIELDS = ['name', 'dateOfBirth', 'dateOfDeath', 'city', 'state', 'photoUrl', 'cemeteryId'] as const;

// Grava/atualiza a projeção pública (best-effort: falha aqui não quebra o fluxo principal).
async function syncPublicDeceased(id: string, tenantId: string, source: Record<string, any>) {
  try {
    const projection: Record<string, any> = { tenantId, updatedAt: serverTimestamp() };
    for (const field of PUBLIC_FIELDS) {
      if (field in source) projection[field] = source[field] ?? null;
    }
    // Campo derivado para busca pública por prefixo (W5-8)
    if (typeof source.name === 'string') {
      projection.nameLowercase = source.name.toLowerCase();
    }
    await setDoc(doc(db, PUBLIC_COLLECTION, id), projection, { merge: true });
  } catch (error) {
    if (import.meta.env.DEV) console.error('Falha ao sincronizar public_deceaseds:', error);
  }
}

async function removePublicDeceased(id: string) {
  try {
    await deleteDoc(doc(db, PUBLIC_COLLECTION, id));
  } catch (error) {
    if (import.meta.env.DEV) console.error('Falha ao remover public_deceaseds:', error);
  }
}

export const DECEASED_PAGE_SIZE = 50;

export interface DeceasedPage {
  items: Deceased[];
  /** Cursor para a próxima página; null quando não há mais registros. */
  cursor: QueryDocumentSnapshot<DocumentData> | null;
}

export async function getDeceasedPage(
  tenantId: string,
  after?: QueryDocumentSnapshot<DocumentData> | null
): Promise<DeceasedPage> {
  const constraints = [
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc'),
    ...(after ? [startAfter(after)] : []),
    limit(DECEASED_PAGE_SIZE),
  ];
  const snapshot = await getDocs(query(collection(db, COLLECTION), ...constraints));
  const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Deceased));
  return {
    items,
    cursor: snapshot.docs.length === DECEASED_PAGE_SIZE ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

/** Busca server-side por prefixo do nome (case-insensitive via nameLowercase). */
export async function searchDeceasedByName(tenantId: string, term: string): Promise<Deceased[]> {
  const prefix = term.trim().toLowerCase();
  if (prefix.length < 3) return [];
  const q = query(
    collection(db, COLLECTION),
    where('tenantId', '==', tenantId),
    where('nameLowercase', '>=', prefix),
    where('nameLowercase', '<=', prefix + ''),
    limit(50)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Deceased));
}

/** @deprecated Use getDeceasedPage. Mantido como wrapper enquanto restarem consumidores. */
export async function getDeceasedList(tenantId: string) {
  return (await getDeceasedPage(tenantId)).items;
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

export async function createDeceased(tenantId: string, data: Omit<Deceased, 'id' | 'tenantId' | 'createdAt'>, files: File[], photoFile?: File) {
  if (!tenantId) {
    throw new Error('Tenant não identificado. Faça login novamente ou contate o suporte.');
  }

  // 1. Upload documents — paralelo (W5-3), tenantId no metadado (W2-2)
  const uploadedDocs = await uploadFilesParallel(files, 'documents', tenantId);

  // 2. Upload photo if exists
  let photoUrl = '';
  if (photoFile) {
    const photoRef = ref(storage, `photos/${auth.currentUser?.uid}/${Date.now()}_${photoFile.name}`);
    await uploadBytes(photoRef, photoFile, { customMetadata: { tenantId } });
    photoUrl = await getDownloadURL(photoRef);
  }

  // 3. Create Firestore record
  const recordData = {
    ...data,
    tenantId,
    nameLowercase: (data.name || '').toLowerCase(),
    documents: uploadedDocs,
    photoUrl: photoUrl || data.photoUrl || null, // Ensure not undefined
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid
  };

  const docRef = await addDoc(collection(db, COLLECTION), recordData);

  // 4. Log action + projeção pública
  await logAction(tenantId, 'CREATE_DECEASED', COLLECTION, docRef.id, null, recordData);
  await syncPublicDeceased(docRef.id, tenantId, recordData);

  return docRef.id;
}

/** Extrai o caminho do Storage de uma downloadURL tokenizada (best-effort). */
function storagePathFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/o\/([^?]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export async function deleteDeceased(id: string, tenantId: string) {
  const docRef = doc(db, COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Registro não encontrado.');
  const data = snap.data() as Deceased;
  if (data.tenantId && data.tenantId !== tenantId) {
    throw new Error('Registro não pertence a este tenant.');
  }

  // 1. Exclusão do registro + liberação do jazigo na MESMA batch (atômico)
  const batch = writeBatch(db);
  batch.delete(docRef);
  if (data.plotId) {
    batch.update(doc(db, 'plots', data.plotId), {
      status: 'available',
      deceasedId: deleteField(),
      occupantName: deleteField(),
      burialDate: deleteField(),
      exhumationDeadlineYears: deleteField(),
      documentStatus: 'regular',
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();

  // 2. Pós-commit best-effort: projeção pública, arquivos do Storage e auditoria
  await removePublicDeceased(id);

  const urls: string[] = [
    ...(data.documents || []).map((d) => d.url),
    ...(data.photoUrl ? [data.photoUrl] : []),
  ];
  await Promise.allSettled(
    urls
      .map(storagePathFromUrl)
      .filter((p): p is string => !!p)
      .map((path) => deleteObject(ref(storage, path)))
  );

  await logAction(tenantId, 'DELETE_DECEASED', COLLECTION, id, null, {
    id,
    plotReleased: data.plotId ?? null,
    filesDeleted: urls.length,
  });
}

export async function updateDeceased(id: string, tenantId: string, data: Partial<Deceased>) {
  const docRef = doc(db, COLLECTION, id);
  const oldSnap = await getDoc(docRef);
  const oldData = oldSnap.data();

  const payload: Record<string, any> = {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid
  };
  // Mantém o índice de busca por nome coerente (W1-8) quando o nome muda.
  if (typeof data.name === 'string') {
    payload.nameLowercase = data.name.toLowerCase();
  }

  await updateDoc(docRef, payload);

  await logAction(tenantId, 'UPDATE_DECEASED', COLLECTION, id, oldData, data);
  // Atualiza a projeção pública se algum campo público mudou
  await syncPublicDeceased(id, tenantId, data as Record<string, any>);
}

/**
 * Wrapper estável da projeção pública para uso pós-transação (W1-1).
 * A função privada syncPublicDeceased não pode rodar dentro de runTransaction.
 */
export async function syncPublicDeceasedFromAllocation(
  id: string,
  tenantId: string,
  source: Record<string, any>
) {
  return syncPublicDeceased(id, tenantId, source);
}

/**
 * Cria o registro oficial e, se plotId for informado, ocupa o jazigo na mesma transação (W1-14).
 * Uploads acontecem ANTES da transação (não são transacionáveis).
 */
export async function createDeceasedWithPlot(
  tenantId: string,
  data: Omit<Deceased, 'id' | 'tenantId' | 'createdAt'>,
  files: File[],
  photoFile?: File
): Promise<string> {
  if (!tenantId) throw new Error('Tenant não identificado.');

  // 1. Uploads em paralelo (W5-3) — tenantId no metadado (W2-2)
  const uploadedDocs = await uploadFilesParallel(files, 'documents', tenantId);
  let photoUrl = '';
  if (photoFile) {
    const pRef = ref(storage, `photos/${auth.currentUser?.uid}/${Date.now()}_${photoFile.name}`);
    await uploadBytes(pRef, photoFile, { customMetadata: { tenantId } });
    photoUrl = await getDownloadURL(pRef);
  }

  const deceasedRef = doc(collection(db, COLLECTION));
  const recordData = {
    ...data,
    tenantId,
    nameLowercase: (data.name || '').toLowerCase(),
    documents: uploadedDocs,
    photoUrl: photoUrl || data.photoUrl || null,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid,
  };

  if (data.plotId) {
    const plotRef = doc(db, 'plots', data.plotId);
    await runTransaction(db, async (tx) => {
      const plotSnap = await tx.get(plotRef);
      if (!plotSnap.exists()) throw new Error('Jazigo informado não existe.');
      const plot = plotSnap.data() as { status: string; tenantId: string; code?: string };
      if (plot.tenantId !== tenantId) throw new Error('Jazigo não pertence a este tenant.');
      if (plot.status !== 'available') throw new PlotUnavailableError(plot.code);

      tx.set(deceasedRef, recordData);
      tx.update(plotRef, {
        status: 'occupied',
        deceasedId: deceasedRef.id,
        occupantName: data.name,
        burialDate: data.dateOfDeath, // caminho direto: sepultamento na data do óbito, editável depois
        exhumationDeadlineYears: 3,
        documentStatus: uploadedDocs.length > 0 ? 'pending' : 'regular',
        updatedAt: serverTimestamp(),
      });
    });
  } else {
    await setDoc(deceasedRef, recordData);
  }

  await logAction(tenantId, 'CREATE_DECEASED', COLLECTION, deceasedRef.id, null, recordData);
  await syncPublicDeceased(deceasedRef.id, tenantId, recordData);
  return deceasedRef.id;
}
