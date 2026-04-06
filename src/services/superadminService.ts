import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

// ─── Tenant (Prefecture) management ──────────────────────────────────────────

export async function createManagerAccount(data: {
  prefectureName: string;
  managerEmail: string;
  temporaryPassword: string;
}) {
  const fn = httpsCallable(functions, 'createManagerAccount');
  const res = await fn(data);
  return res.data;
}

export async function toggleManagerStatus(data: {
  managerUid: string;
  disabled: boolean;
}) {
  const fn = httpsCallable(functions, 'toggleManagerStatus');
  const res = await fn(data);
  return res.data;
}

export async function deleteManagerAccount(data: {
  managerUid: string;
  tenantId: string;
}) {
  const fn = httpsCallable(functions, 'deleteManagerAccount');
  const res = await fn(data);
  return res.data;
}

// ─── Per-tenant user management ───────────────────────────────────────────────

/** Add an additional manager login to an existing prefecture/tenant. */
export async function addUserToTenant(data: {
  tenantId: string;
  email: string;
  password: string;
}) {
  const fn = httpsCallable(functions, 'addUserToTenant');
  const res = await fn(data);
  return res.data;
}

/** Disable or re-enable a single user (without touching the tenant document). */
export async function disableTenantUser(data: {
  uid: string;
  disabled: boolean;
}) {
  const fn = httpsCallable(functions, 'disableTenantUser');
  const res = await fn(data);
  return res.data;
}

/** Delete a single user from a tenant (without deleting the tenant). */
export async function deleteTenantUser(data: { uid: string }) {
  const fn = httpsCallable(functions, 'deleteTenantUser');
  const res = await fn(data);
  return res.data;
}
