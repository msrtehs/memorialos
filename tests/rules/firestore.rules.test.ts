import { describe, it, beforeAll, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc, deleteDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

const CITIZEN = { uid: 'citizen1' }; // sem claims
const MANAGER_A = { uid: 'managerA', token: { role: 'manager', tenantId: 'tenantA' } };
const MANAGER_B = { uid: 'managerB', token: { role: 'manager', tenantId: 'tenantB' } };

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'memorialos-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
  // Seed com regras desligadas
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'cemeteries/cemA'), { tenantId: 'tenantA', name: 'Cem A' });
    await setDoc(doc(db, 'deceaseds/d1'), { tenantId: 'tenantA', name: 'Fulano' });
    await setDoc(doc(db, 'sci_financial_records/f1'), { tenantId: 'tenantA', value: 10, category: 'income', cemeteryId: 'cemA' });
    await setDoc(doc(db, 'death_notifications/n1'), {
      tenantId: 'tenantA', createdBy: 'citizen1', status: 'submitted',
      cemeteryId: 'cemA', deceased: { name: 'X' },
    });
    await setDoc(doc(db, 'profiles/managerA'), { tenantId: 'tenantA', email: 'a@a.com', role: 'manager' });
  });
});

afterAll(async () => { await env.cleanup(); });

describe('death_notifications', () => {
  it('R1: cidadão cria submitted própria', async () => {
    const db = env.authenticatedContext(CITIZEN.uid).firestore();
    await assertSucceeds(setDoc(doc(db, 'death_notifications/nova1'), {
      tenantId: 'tenantA', createdBy: CITIZEN.uid, status: 'submitted',
      cemeteryId: 'cemA', deceased: { name: 'Y' }, documents: [], photoUrl: null,
    }));
  });

  it('R2: cidadão não cria allocated nem com allocation', async () => {
    const db = env.authenticatedContext(CITIZEN.uid).firestore();
    await assertFails(setDoc(doc(db, 'death_notifications/nova2'), {
      tenantId: 'tenantA', createdBy: CITIZEN.uid, status: 'allocated', cemeteryId: 'cemA',
    }));
  });

  it('R2b (W2-6): tenantId forjado é negado', async () => {
    const db = env.authenticatedContext(CITIZEN.uid).firestore();
    await assertFails(setDoc(doc(db, 'death_notifications/nova3'), {
      tenantId: 'tenantB', createdBy: CITIZEN.uid, status: 'submitted', cemeteryId: 'cemA',
    }));
  });

  it('R3: cidadão edita dados mas não campos de controle', async () => {
    const db = env.authenticatedContext(CITIZEN.uid).firestore();
    await assertSucceeds(updateDoc(doc(db, 'death_notifications/n1'), { 'deceased.name': 'Z' }));
    await assertFails(updateDoc(doc(db, 'death_notifications/n1'), { status: 'allocated' }));
  });

  it('R8: delete próprio só se rejected', async () => {
    const db = env.authenticatedContext(CITIZEN.uid).firestore();
    await assertFails(deleteDoc(doc(db, 'death_notifications/n1'))); // submitted
  });
});

describe('isolamento de tenant', () => {
  it('R4: manager A não lê financeiro do tenant B', async () => {
    const db = env.authenticatedContext(MANAGER_B.uid, MANAGER_B.token).firestore();
    await assertFails(getDoc(doc(db, 'sci_financial_records/f1')));
  });

  it('R5: manager A lê deceaseds do A; B não', async () => {
    const dbA = env.authenticatedContext(MANAGER_A.uid, MANAGER_A.token).firestore();
    const dbB = env.authenticatedContext(MANAGER_B.uid, MANAGER_B.token).firestore();
    await assertSucceeds(getDoc(doc(dbA, 'deceaseds/d1')));
    await assertFails(getDoc(doc(dbB, 'deceaseds/d1')));
  });

  it('R10 (W2-3): manager lista profiles do próprio tenant; de outro não', async () => {
    const dbA = env.authenticatedContext(MANAGER_A.uid, MANAGER_A.token).firestore();
    await assertSucceeds(getDocs(query(collection(dbA, 'profiles'), where('tenantId', '==', 'tenantA'))));
    await assertFails(getDocs(query(collection(dbA, 'profiles'), where('tenantId', '==', 'tenantB'))));
  });
});

describe('schema (W1-7/W2-5)', () => {
  it('financeiro com value string / negativo / cemeteryId all → nega', async () => {
    const db = env.authenticatedContext(MANAGER_A.uid, MANAGER_A.token).firestore();
    await assertFails(setDoc(doc(db, 'sci_financial_records/f2'),
      { tenantId: 'tenantA', value: '100', category: 'income', cemeteryId: 'cemA' }));
    await assertFails(setDoc(doc(db, 'sci_financial_records/f3'),
      { tenantId: 'tenantA', value: -5, category: 'income', cemeteryId: 'cemA' }));
    await assertFails(setDoc(doc(db, 'sci_financial_records/f4'),
      { tenantId: 'tenantA', value: 10, category: 'income', cemeteryId: 'all' }));
  });
});

describe('público', () => {
  it('R6: anônimo lê public_deceaseds, não escreve', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'public_deceaseds/p1'), { tenantId: 'tenantA', name: 'Fulano' }));
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'public_deceaseds/p1')));
    await assertFails(setDoc(doc(db, 'public_deceaseds/p2'), { name: 'X' }));
  });

  it('R7: audit_logs imutáveis e com actorUid == self', async () => {
    const db = env.authenticatedContext(MANAGER_A.uid, MANAGER_A.token).firestore();
    await assertFails(setDoc(doc(db, 'audit_logs/a1'),
      { tenantId: 'tenantA', actorUid: 'outro', action: 'X' }));
  });
});
