/**
 * scripts/migrate-tenant-ids.ts
 *
 * Migração ÚNICA (A5) — corrige `tenantId` incorreto em `death_notifications` onde
 * `tenantId === createdBy` (resíduo do modo demo). Executar via ts-node com credenciais
 * admin, UMA vez, e depois apagar do repositório.
 *
 * ATENÇÃO: opera sobre TODA a coleção sem filtro de tenant. Rode apenas com backup e
 * confirmação explícita. NÃO deve existir na UI de produção.
 *
 * Uso (exemplo):
 *   1. Configure firebase-admin com serviceAccountKey.json.
 *   2. npx ts-node scripts/migrate-tenant-ids.ts --confirm
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const serviceAccount = require('./serviceAccountKey.json');

if (!process.argv.includes('--confirm')) {
  console.error('Recuse-se a rodar sem --confirm. Faça backup antes. Abortando.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function migrateTenantIds() {
  console.log('Iniciando migração: corrigir tenantId em death_notifications...');
  const snapshot = await db.collection('death_notifications').get();

  let fixedCount = 0;
  let skippedCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as { tenantId?: string; createdBy?: string; cemeteryId?: string };

    if (data.tenantId === data.createdBy) {
      if (data.cemeteryId) {
        const cemeterySnap = await db.collection('cemeteries').doc(data.cemeteryId).get();
        const cemetery = cemeterySnap.data() as { tenantId?: string } | undefined;
        if (cemetery && cemetery.tenantId) {
          await docSnap.ref.update({ tenantId: cemetery.tenantId });
          console.log(`Fixed ${docSnap.id}: ${data.tenantId} -> ${cemetery.tenantId}`);
          fixedCount++;
        } else {
          console.warn(`Doc ${docSnap.id}: cemeteryId ${data.cemeteryId} sem cemitério/tenantId.`);
        }
      } else {
        await docSnap.ref.update({
          status: 'reviewing',
          rejectionReason: 'Sistema: Tenant ID inválido e sem cemitério vinculado. Contate o suporte.',
        });
        console.log(`Marked ${docSnap.id} as reviewing (sem cemeteryId).`);
        fixedCount++;
      }
    } else {
      skippedCount++;
    }
  }

  console.log(`Migração concluída. Corrigidos: ${fixedCount}, Ignorados: ${skippedCount}`);
}

migrateTenantIds().then(() => process.exit(0));
