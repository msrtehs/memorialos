// scripts/backfill-public-deceaseds.cjs (executar uma vez)
// Preenche a coleção pública `public_deceaseds` (LGPD-safe) a partir dos
// registros existentes em `deceaseds`, copiando SOMENTE campos não-sensíveis.
// A busca pública lê `public_deceaseds`; `deceaseds` permanece restrito a staff.
//
// Uso:
//   1. Tenha scripts/serviceAccountKey.json (chave de conta de serviço do Firebase).
//   2. node scripts/backfill-public-deceaseds.cjs
//
// firebase-admin v13+ usa API modular.
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const PUBLIC_FIELDS = ['name', 'dateOfBirth', 'dateOfDeath', 'city', 'state', 'photoUrl', 'cemeteryId'];

async function backfill() {
  const snapshot = await db.collection('deceaseds').get();
  console.log(`Encontrados ${snapshot.size} registros em 'deceaseds'.`);

  let written = 0;
  let skipped = 0;
  let batch = db.batch();
  let ops = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (!data.tenantId) {
      skipped++;
      continue; // sem tenant real, não vai para a busca pública
    }

    const projection = { tenantId: data.tenantId, updatedAt: FieldValue.serverTimestamp() };
    for (const field of PUBLIC_FIELDS) {
      projection[field] = data[field] ?? null;
    }

    batch.set(db.collection('public_deceaseds').doc(docSnap.id), projection, { merge: true });
    written++;
    ops++;
    if (ops >= 450) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
  console.log(`Backfill concluído. Gravados: ${written}, ignorados (sem tenantId): ${skipped}.`);
}

backfill().then(() => process.exit(0)).catch((err) => {
  console.error('Erro no backfill:', err);
  process.exit(1);
});
