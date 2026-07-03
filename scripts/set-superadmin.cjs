// scripts/set-superadmin.cjs (executar uma vez, depois apagar)
// Atribui o custom claim role: 'superadmin' à conta indicada, para que o painel
// admin continue funcionando após a remoção do backdoor demo (C1).
//
// Uso:
//   1. Coloque o serviceAccountKey.json (chave de conta de serviço do Firebase) nesta pasta.
//   2. node scripts/set-superadmin.cjs
//   3. Apague este arquivo e a serviceAccountKey.json após a execução.
//
// firebase-admin v13+ usa API modular: app e auth vêm de submódulos.
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });

async function setSuperAdmin(email) {
  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, {
    role: 'superadmin',
    tenantId: null, // superadmin não pertence a um tenant específico
  });
  console.log(`Done: ${email} => superadmin`);
}

setSuperAdmin('admin@memorial.com').then(() => process.exit(0));
