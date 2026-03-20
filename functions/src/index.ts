import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();

function generateTenantId(name: string): string {
  return `tenant_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
}

// ─── createManagerAccount ─────────────────────────────────────────────────────
// Creates a Firebase Auth user for the manager, sets custom claims,
// writes tenant and profile documents in Firestore.
export const createManagerAccount = onCall(async (request) => {
  if (!request.auth || request.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  const { prefectureName, managerEmail, temporaryPassword } = request.data as {
    prefectureName: string;
    managerEmail: string;
    temporaryPassword: string;
  };

  if (!prefectureName || !managerEmail || !temporaryPassword) {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }

  const auth = getAuth();
  const db = getFirestore();

  const tenantId = generateTenantId(prefectureName);

  const user = await auth.createUser({
    email: managerEmail,
    password: temporaryPassword,
  });

  await auth.setCustomUserClaims(user.uid, {
    role: 'manager',
    tenantId,
  });

  await db.collection('tenants').doc(tenantId).set({
    name: prefectureName,
    active: true,
    managerEmail,
    managerUid: user.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  await db.collection('profiles').doc(user.uid).set({
    email: managerEmail,
    role: 'manager',
    tenantId,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// ─── toggleManagerStatus ──────────────────────────────────────────────────────
// Disables or re-enables a manager's Firebase Auth account and
// updates the tenant's active flag accordingly.
export const toggleManagerStatus = onCall(async (request) => {
  if (!request.auth || request.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  const { managerUid, disabled } = request.data as {
    managerUid: string;
    disabled: boolean;
  };

  if (!managerUid || typeof disabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }

  const auth = getAuth();
  const db = getFirestore();

  await auth.updateUser(managerUid, { disabled });

  const profileSnap = await db.collection('profiles').doc(managerUid).get();
  if (profileSnap.exists) {
    const tenantId = profileSnap.data()?.tenantId as string | undefined;
    if (tenantId) {
      await db.collection('tenants').doc(tenantId).update({ active: !disabled });
    }
  }

  return { success: true };
});

// ─── deleteManagerAccount ─────────────────────────────────────────────────────
// Removes the manager from Firebase Auth and deletes the associated
// profile and tenant documents from Firestore.
export const deleteManagerAccount = onCall(async (request) => {
  if (!request.auth || request.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  const { managerUid, tenantId } = request.data as {
    managerUid: string;
    tenantId: string;
  };

  if (!managerUid || !tenantId) {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }

  const auth = getAuth();
  const db = getFirestore();

  await auth.deleteUser(managerUid);
  await db.collection('profiles').doc(managerUid).delete();
  await db.collection('tenants').doc(tenantId).delete();

  return { success: true };
});
