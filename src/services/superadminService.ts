import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

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
