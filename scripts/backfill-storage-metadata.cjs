// scripts/backfill-storage-metadata.cjs (executar uma vez — W2-2)
// Grava o metadado customizado { tenantId } nos arquivos já existentes no Storage,
// a partir dos registros em `deceaseds` e `death_notifications`. Necessário ANTES do
// deploy das storage.rules novas (senão o staff perde acesso aos anexos legados).
//
// Uso:
//   1. Tenha scripts/serviceAccountKey.json.
//   2. node scripts/backfill-storage-metadata.cjs
//
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const serviceAccount = require('./serviceAccountKey.json');

// Bucket do projeto (o mesmo do VITE_FIREBASE_STORAGE_BUCKET). Pode sobrescrever via env.
const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'memorialos.firebasestorage.app';

initializeApp({ credential: cert(serviceAccount), storageBucket: STORAGE_BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

/** Extrai o caminho do objeto no bucket de uma downloadURL tokenizada. */
function storagePathFromUrl(url) {
  if (typeof url !== 'string') return null;
  const match = url.match(/\/o\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function setTenantMetadata(path, tenantId) {
  if (!path || !tenantId) return false;
  try {
    const file = bucket.file(path);
    const [exists] = await file.exists();
    if (!exists) return false;
    await file.setMetadata({ metadata: { tenantId } });
    return true;
  } catch (err) {
    console.error(`  falha em ${path}:`, err.message);
    return false;
  }
}

async function processCollection(col, getUrls) {
  const snap = await db.collection(col).get();
  console.log(`[${col}] ${snap.size} registros.`);
  let updated = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const tenantId = data.tenantId;
    if (!tenantId) continue;
    for (const url of getUrls(data)) {
      const path = storagePathFromUrl(url);
      if (await setTenantMetadata(path, tenantId)) updated++;
    }
  }
  console.log(`[${col}] metadados gravados: ${updated}.`);
}

async function backfill() {
  await processCollection('deceaseds', (d) => [
    ...(Array.isArray(d.documents) ? d.documents.map((x) => x.url) : []),
    ...(d.photoUrl ? [d.photoUrl] : []),
  ]);
  await processCollection('death_notifications', (d) => [
    ...(Array.isArray(d.documents) ? d.documents.map((x) => x.url) : []),
    ...(d.photoUrl ? [d.photoUrl] : []),
  ]);
  console.log('Backfill de metadados concluído.');
}

backfill().then(() => process.exit(0)).catch((err) => {
  console.error('Erro no backfill:', err);
  process.exit(1);
});
