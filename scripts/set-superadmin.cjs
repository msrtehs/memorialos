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

const email = process.argv[2];
const BLOCKED_EMAILS = ['admin@memorial.com', 'gestor@memorial.com']; // ex-backdoor: nunca promover

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Uso: node scripts/set-superadmin.cjs <email>');
  process.exit(1);
}
if (BLOCKED_EMAILS.includes(email.toLowerCase())) {
  console.error(`Recusado: ${email} é a conta do antigo backdoor demo. Crie uma conta nova.`);
  process.exit(1);
}

async function setSuperAdmin(targetEmail) {
  const auth = getAuth();
  const user = await auth.getUserByEmail(targetEmail);
  await auth.setCustomUserClaims(user.uid, { role: 'superadmin', tenantId: null });
  console.log(`Done: ${targetEmail} (uid ${user.uid}) => superadmin`);
  console.log('Lembrete: o usuário precisa fazer logout/login para o novo claim valer.');
}

setSuperAdmin(email)
  .then(() => process.exit(0))
  .catch((err) => { console.error('Falha:', err.message); process.exit(1); });
