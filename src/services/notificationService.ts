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
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '@/lib/firebase';
import { logAction } from './audit';
import { syncPublicDeceasedFromAllocation } from '@/services/deceasedService';
import { uploadFilesParallel } from '@/lib/storageUpload';
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

  // 1. Upload documents — paralelo (W5-3), tenantId do cemitério no metadado (W2-2)
  const uploadedDocs = await uploadFilesParallel(files, 'documents', tenantId);

  // 2. Upload photo if exists
  let photoUrl = null;
  if (photoFile) {
    const photoRef = ref(storage, `photos/${auth.currentUser?.uid}/${Date.now()}_${photoFile.name}`);
    await uploadBytes(photoRef, photoFile, { customMetadata: { tenantId } });
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

export class PlotUnavailableError extends Error {
  constructor(plotCode?: string) {
    super(
      plotCode
        ? `O jazigo ${plotCode} acabou de ser ocupado por outra operação. Escolha outro jazigo.`
        : 'Este jazigo acabou de ser ocupado por outra operação. Escolha outro jazigo.'
    );
    this.name = 'PlotUnavailableError';
  }
}

export async function allocateNotification(
  notificationId: string,
  tenantId: string,
  allocationData: {
    cemeteryId: string;
    sectorId: string;
    plotId: string;
    plotCode?: string;
    burialDate?: string; // YYYY-MM-DD — vem do modal; default hoje
  }
): Promise<{ notificationId: string; deceasedId: string }> {
  if (!auth.currentUser) throw new Error('Usuário não autenticado.');
  const actorUid = auth.currentUser.uid;
  const burialDate = allocationData.burialDate || new Date().toISOString().split('T')[0];

  const notifRef = doc(db, COLLECTION, notificationId);
  const plotRef = doc(db, 'plots', allocationData.plotId);
  const deceasedRef = doc(collection(db, 'deceaseds')); // id pré-gerado para uso na transação

  let deceasedPayload: Record<string, any> = {};

  await runTransaction(db, async (tx) => {
    // TODAS as leituras antes de qualquer escrita (exigência do Firestore)
    const [notifSnap, plotSnap] = await Promise.all([tx.get(notifRef), tx.get(plotRef)]);

    if (!notifSnap.exists()) throw new Error('Notificação não encontrada.');
    const notif = notifSnap.data() as DeathNotification;
    if (notif.status === 'allocated') {
      throw new Error('Esta solicitação já foi alocada por outro gestor.');
    }
    if (notif.tenantId !== tenantId) {
      throw new Error('Notificação não pertence a este tenant.');
    }

    if (!plotSnap.exists()) throw new Error('Jazigo não encontrado.');
    const plot = plotSnap.data() as { status: string; tenantId: string };
    if (plot.status !== 'available') {
      throw new PlotUnavailableError(allocationData.plotCode);
    }
    if (plot.tenantId !== tenantId) {
      throw new Error('Jazigo não pertence a este tenant.');
    }

    // 1. Registro oficial do falecido (mesmos campos do fluxo anterior)
    deceasedPayload = {
      tenantId,
      name: notif.deceased.name,
      nameLowercase: (notif.deceased.name || '').toLowerCase(),
      dateOfBirth: notif.deceased.dateOfBirth,
      dateOfDeath: notif.deceased.dateOfDeath,
      cemeteryId: allocationData.cemeteryId,
      plotId: allocationData.plotId,
      profession: notif.deceased.profession ?? null,
      hobbies: notif.deceased.hobbies ?? null,
      familyMembers: notif.deceased.familyMembers ?? null,
      achievements: notif.deceased.achievements ?? null,
      obituary: notif.deceased.obituary ?? null,
      epitaph: notif.deceased.epitaph ?? null,
      photoUrl: notif.photoUrl ?? null,
      city: notif.deceased.city ?? null,
      state: notif.deceased.state ?? null,
      documents: notif.documents ?? [],
      createdAt: serverTimestamp(),
      createdBy: actorUid,
    };
    tx.set(deceasedRef, deceasedPayload);

    // 2. Ocupação do jazigo
    tx.update(plotRef, {
      status: 'occupied',
      deceasedId: deceasedRef.id,
      occupantName: notif.deceased.name,
      burialDate,
      exhumationDeadlineYears: 3, // TODO produto: configurável por cemitério
      documentStatus: 'pending',
      updatedAt: serverTimestamp(),
    });

    // 3. Fechamento da notificação
    tx.update(notifRef, {
      status: 'allocated',
      deceasedId: deceasedRef.id,
      allocation: {
        cemeteryId: allocationData.cemeteryId,
        sectorId: allocationData.sectorId,
        plotId: allocationData.plotId,
        plotCode: allocationData.plotCode ?? null,
        assignedBy: actorUid,
        assignedAt: Timestamp.now(), // serverTimestamp() não é permitido em objeto aninhado
      },
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
    });
  });

  // Pós-commit (best-effort, fora da transação): projeção pública + auditoria + cache
  await syncPublicDeceasedFromAllocation(deceasedRef.id, tenantId, deceasedPayload);
  await logAction(tenantId, 'ALLOCATE_DEATH_NOTIFICATION', COLLECTION, notificationId, null, {
    deceasedId: deceasedRef.id,
    plotId: allocationData.plotId,
    plotCode: allocationData.plotCode,
    burialDate,
  });
  invalidateCache(`sci_snapshot:${tenantId}`);

  return { notificationId, deceasedId: deceasedRef.id };
}

export async function rejectNotification(notificationId: string, tenantId: string, reason: string) {
  if (!auth.currentUser) throw new Error('Usuário não autenticado.');

  await updateDoc(doc(db, COLLECTION, notificationId), {
    status: 'rejected',
    rejectionReason: reason,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });

  await logAction(tenantId, 'REJECT_DEATH_NOTIFICATION', COLLECTION, notificationId, null, {
    rejectionReason: reason,
  });
}

export async function deleteNotification(notification: DeathNotification) {
  if (!auth.currentUser) throw new Error('Usuário não autenticado.');
  if (!notification.id) throw new Error('Notificação sem id.');

  await deleteDoc(doc(db, COLLECTION, notification.id));

  // Best-effort: remove os arquivos enviados junto com a notificação
  const urls = [
    ...(notification.documents || []).map((d) => d.url),
    ...(notification.photoUrl ? [notification.photoUrl] : []),
  ];
  await Promise.allSettled(
    urls
      .map((u) => u.match(/\/o\/([^?]+)/)?.[1])
      .filter((p): p is string => !!p)
      .map((p) => deleteObject(ref(storage, decodeURIComponent(p))))
  );

  // Auditoria só quando quem exclui é staff (cidadão não tem permissão de escrever audit_logs)
  try {
    await logAction(notification.tenantId, 'DELETE_DEATH_NOTIFICATION', COLLECTION, notification.id, null, {
      status: notification.status,
    });
  } catch { /* cidadão: regra nega — best-effort deliberado */ }
}
