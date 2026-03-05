import { collection, addDoc, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

// Types
export interface AuditLog {
  action: string;
  actorUid: string;
  targetCollection: string;
  targetId: string;
  oldValue?: any;
  newValue?: any;
  timestamp: any;
  tenantId: string;
}

/**
 * Logs an administrative action to Firestore for audit purposes.
 * Should be called whenever a write operation happens in the admin panel.
 */
export async function logAction(
  tenantId: string,
  action: string,
  targetCollection: string,
  targetId: string,
  oldValue: any = null,
  newValue: any = null
) {
  if (!auth.currentUser) return;

  try {
    await addDoc(collection(db, 'audit_logs'), {
      action,
      actorUid: auth.currentUser.uid,
      targetCollection,
      targetId,
      oldValue,
      newValue,
      timestamp: serverTimestamp(),
      tenantId
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
    // In a strict environment, we might want to throw here to rollback the transaction
    // if we were using batch/transactions.
  }
}

/**
 * Example function to create a deceased record with audit logging
 */
export async function createDeceasedRecord(tenantId: string, data: any) {
  const deceasedRef = await addDoc(collection(db, 'deceaseds'), {
    ...data,
    tenantId,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid
  });

  await logAction(tenantId, 'CREATE_DECEASED', 'deceaseds', deceasedRef.id, null, data);
  return deceasedRef.id;
}
