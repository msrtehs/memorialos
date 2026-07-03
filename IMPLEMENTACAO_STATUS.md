# Status de Implementação — PLANO_CORRECOES_MEMORIAL.md

Última atualização: 2026-07-03

## RESUMO: todas as 5 etapas concluídas (código). `npx tsc --noEmit` → 0 erros. `npm run build` → OK.
Verificação do bundle: sem `admin@memorial.com`/`admin123`; única `AIzaSy` é a chave web pública do Firebase (chave Gemini removida); `lang="pt-BR"` e título corretos.

## Etapa 1 — Segurança Crítica — ✅ CONCLUÍDA (código)
- [x] C1 — Backdoor removido (LoginPage.tsx, AuthContext.tsx, firestore.rules, storage.rules). Script `scripts/set-superadmin.js` criado.
- [x] C2 — Leitura pública restringida (firestore.rules: plots, plot_concessions, deceaseds, tenants).
- [x] C3 — death_notifications: cidadão não pode forjar alocação (firestore.rules).
- [x] C4 — Chave Gemini movida p/ Cloud Function proxy (aiService.ts, functions/index.js, .env, .env.example).
- [x] C5 — audit_logs restrito a staff + payload sanitizado; createDeceasedRecord removido (audit.ts, firestore.rules).
- `npx tsc --noEmit` → EXIT 0.

### Ações operacionais pendentes (fora do escopo de código — exigem credenciais Firebase):
- Executar `scripts/set-superadmin.js` uma vez e depois apagá-lo.
- `firebase deploy --only firestore:rules,storage,functions`.
- `firebase functions:config:set gemini.api_key="..."`.
- Revogar a chave Gemini antiga no GCP.
- Nota: VITE_FIREBASE_API_KEY (AIza...) permanece no bundle — é a chave web pública do Firebase, esperada e segura.

## Etapa 2 — Fluxos Quebrados — ✅ CONCLUÍDA (código)
- [x] A1 — Roles unificados em inglês (App.tsx, ProtectedRoute.tsx, LoginPage.tsx, firestore.rules, storage.rules, GardenOfMemories.tsx). UnauthorizedPage.tsx criada + rota /acesso-negado.
- [x] A2 — allocateNotification reescrita (cria deceased, grava burialDate/occupantName no plot, linka deceasedId). CommunicatedDeaths.tsx atualizado (tenantId, toast, isSubmitting). react-hot-toast instalado.
- [x] A3 — src/lib/queryCache.ts criado; getSciSnapshot com cache + paginação (getAllTenantPlotsWithPagination); invalidateCache em createForTenant e allocateNotification.
- `npx tsc --noEmit` → EXIT 0.

## Etapa 3 — Integridade Operacional — ✅ CONCLUÍDA (código)
- [x] A4 — <Toaster> no App.tsx; toast + guards em OperationalPage, MaintenancePage, EnvironmentalPage, DocumentsCenterPage, SupportPage, FinancialPage, InventoryPage, CommunicatedDeaths, DeceasedForm, CemeteryList.
- [x] A5 — Botão "Fix IDs" removido; função movida p/ scripts/migrate-tenant-ids.ts; fixWrongTenantIdsForNotifications removida do service.
- [x] A6 — Dropdown de ações em DeceasedList + DeceasedDetail.tsx + rota /admin/falecidos/:id; aiAudited:true removido (FinancialPage); ExpertAIPage removido (rota /admin/ia + arquivo); ComingSoon para solicitacoes/configuracoes.
- [x] A7 — Guards `selectedCemeteryId==='all'` nos forms + guard em createForTenant (sciService).
- `npx tsc --noEmit` → EXIT 0.
- Nota: window.confirm de exclusão de cemitério já removido aqui (adianta parte de B3).

## Etapa 4 — Qualidade — ✅ CONCLUÍDA (código; ver notas)
- [x] M1 — validationSchemas.ts criado; coerência de datas em DeceasedForm; min={today} no scheduledFor (OperationalPage).
- [x] M2 — parseISO em DeceasedList, CommunicatedDeaths, GardenOfMemories, DeceasedDetail.
- [x] M3 — LoadingSpinner + StatCardSkeleton criados; AdminDashboard usa skeleton no loading.
- [x] M4 — refreshCemeteries no AdminContext; CemeteryList chama após criar/excluir.
- [x] M5 — index.html lang=pt-BR + título; formatters.ts (formatCurrency/formatDate) aplicado em AdminDashboard e FinancialPage; statusLabels.ts aplicado em OperationalPage.
- [~] M5.4 — varredura de acentos: PARCIAL (labels de status traduzidos; títulos sem acento remanescentes não são bloqueantes).
- [x] M6 — useModal.ts criado (Esc + focus); aplicado em CommunicatedDeaths (role/aria-modal/aria-label). [~] Sweep completo de <label> em todos os forms SCI: PARCIAL.
- [x] M7 — SCITable.tsx e useCemeteryFilter.ts criados; ExpertAIPage removido; SanitaryCheck/EnvironmentalCheck unificados (EnvironmentalSanitaryCheck + aliases; checkType injetado nos creates).
- [x] M8 — storage.rules: memorials write só staff; tenant requests read/write por dono/staff.
- [x] M9 — deleteCemetery com checagem de dependências + cascade (plots/setores em batch).
- `npx tsc --noEmit` → EXIT 0.

## Etapa 5 — Débito Técnico — ✅ CONCLUÍDA (código; ver notas B5)
- [x] B1 — AdminReportDeath: Blob URL memoizado (useMemo) + revokeObjectURL no unmount; ambos os <img> usam photoPreviewUrl.
- [x] B2 — src/lib/fileValidation.ts criado; validação de tipo/tamanho em DeceasedForm e DocumentsCenterPage (reseta input em erro).
- [x] B3 — AgentsPage: Enter envia (já existia) + modal de confirmação antes de limpar histórico ao trocar de agente (sem window.confirm). window.confirm/alert também removidos de GardenOfMemories e CemeteryList (substituídos por modal + toast).
- [x] B4 — console.log removidos (notificationService, CommunicatedDeaths); createDeceasedRecord já removido (C5); README.md atualizado (Cloud Functions + Gemini + superadmin).
- [~] B5 — TypeScript: strict/noImplicitAny NÃO habilitados. Motivo: o projeto não tem @types/react instalado e depende de `any` implícito para o próprio React — habilitar geraria ~4332 erros em cascata (exatamente o que o plano manda evitar). Feito B5.2 seguro: FinancialPage (records: FinancialRecord[], snapshot tipado), snapshots tipados em EnvironmentalPage e AgentsPage. Demais listas mantidas como any[] para não cascatear no uso de `item.id` (justificado).

## Infra das Cloud Functions — ✅ PREPARADA LOCALMENTE (deployável)
- [x] `functions/package.json` criado (firebase-admin, firebase-functions@4 [API v1], @google/genai).
- [x] `functions/index.js` corrigido: usa `@google/genai` (a chamada `ai.models.generateContent` é dessa lib, não de `@google/generative-ai`). `node --check` OK; exports validados.
- [x] `firebase.json` (firestore.rules + storage.rules + functions) e `.firebaserc` (projeto `memorialos`) criados.
- [x] `cd functions && npm install` executado (258 pacotes).
- [x] `.gitignore` das functions e da raiz atualizados (node_modules, serviceAccountKey.json, .runtimeconfig.json).

## Ações que EXIGEM credenciais/segredos e acesso externo (não executáveis por mim):
Requerem `firebase login` interativo, o segredo real da chave Gemini e/ou uma serviceAccountKey.json,
e publicam em produção. Rodar manualmente na ordem:
1. `firebase functions:config:set gemini.api_key="SUA_CHAVE"`
2. `firebase deploy --only firestore:rules,storage,functions`
3. `node scripts/set-superadmin.js` (com scripts/serviceAccountKey.json) → depois apagar script + chave
4. Revogar a chave Gemini antiga no GCP (console.cloud.google.com/apis/credentials)
5. (Opcional) `npx tsx scripts/migrate-tenant-ids.ts --confirm` se houver tenantId legado
