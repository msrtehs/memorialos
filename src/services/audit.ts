import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

// Types
export interface AuditLog {
  action: string;
  actorUid: string;
  targetCollection: string;
  targetId: string;
  changedFields?: string[];
  timestamp: any;
  tenantId: string;
}

// Campos sensíveis que nunca devem ser logados do cliente
const SENSITIVE_FIELDS = ['causeOfDeath', 'holderDocument', 'password', 'documents'];

function sanitizeForLog(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const sanitized: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    sanitized[key] = SENSITIVE_FIELDS.includes(key) ? '[REDACTED]' : data[key];
  }
  return sanitized;
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
      // Gravar apenas diff resumido, sem campos sensíveis
      changedFields: newValue ? Object.keys(sanitizeForLog(newValue)) : [],
      timestamp: serverTimestamp(),
      tenantId
    });
  } catch (error) {
    // Log local em desenvolvimento, silencioso em produção
    if (import.meta.env.DEV) console.error('Failed to write audit log:', error);
  }
}
