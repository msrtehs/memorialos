// scripts/backfill-name-lowercase.cjs (executar uma vez — W1-8)
// Preenche o campo `nameLowercase` em `deceaseds` a partir de `name`, para
// habilitar a busca server-side por prefixo (searchDeceasedByName).
// Rodar ANTES do deploy da UI de busca, senão registros antigos não aparecem.
//
// Uso:
//   1. Tenha scripts/serviceAccountKey.json (chave de conta de serviço do Firebase).
//   2. node scripts/backfill-name-lowercase.cjs
//
// firebase-admin v13+ usa API modular.
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function backfill() {
  const snapshot = await db.collection('deceaseds').get();
  console.log(`Encontrados ${snapshot.size} registros em 'deceaseds'.`);

  let written = 0;
  let skipped = 0;
  let batch = db.batch();
  let ops = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const name = data.name;
    if (typeof name !== 'string' || !name) {
      skipped++;
      continue;
    }
    const nameLowercase = name.toLowerCase();
    if (data.nameLowercase === nameLowercase) {
      skipped++;
      continue; // já coerente
    }

    batch.update(docSnap.ref, { nameLowercase });
    written++;
    ops++;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
  console.log(`Backfill concluído. Atualizados: ${written}, ignorados: ${skipped}.`);
}

backfill().then(() => process.exit(0)).catch((err) => {
  console.error('Erro no backfill:', err);
  process.exit(1);
});
