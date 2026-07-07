# Status de Implementação — PLANO_IMPLEMENTACAO_TOTAL_MEMORIAL.md

Última atualização: 2026-07-05 (sessão Opus 4.8)
Base: `PLANO_IMPLEMENTACAO_TOTAL_MEMORIAL.md` (79 itens, ondas W0–W6).

> O arquivo antigo rastreava `PLANO_CORRECOES_MEMORIAL.md` (etapas C/A/M/B), já incorporado como base do plano novo. Este documento agora rastreia o plano TOTAL.

## Como retomar
Trabalhar em ordem de onda. Dentro da onda, itens independentes salvo dependência anotada. Rodar `npx tsc --noEmit` (raiz) e `cd functions && npx tsc --noEmit` ao fim de cada onda.

---

## ONDA 0 — BLOQUEANTES — ✅ CÓDIGO CONCLUÍDO (infra pendente)

- [x] **W0-1** — `.github/workflows/deploy-pages.yml`: removida `VITE_GEMINI_API_KEY`; config Firebase agora via `${{ vars.* }}` (nomes sem prefixo VITE_); passo Build fundido com guard anti-segredo (`grep GEMINI|sk-or-v1` no bundle). README + .env.example atualizados.
- [x] **W0-2** — `scripts/set-superadmin.cjs`: e-mail obrigatório via CLI + validação + BLOCKED_EMAILS (ex-backdoor). `scripts/superadmin-claim.json` removido (git rm + rm) e adicionado ao .gitignore.
- [x] **W0-3** — `functions/src/index.ts` `manualMonitorTrigger`: fail-closed (503 sem token, 401 com header errado).
- [x] **W0-4** — `src/pages/admin/SecurityPage.tsx`: import toast; guard `'all'` + toasts em handleCreateEvent/updateStatus/loadEvents; botão desabilitado quando 'all'.
- [x] **W0-5** — `src/components/ui/ConfirmDialog.tsx` (NOVO) + `CemeteryList.tsx` com pendingDelete/deleting + requireText(nome).
- [x] **W0-6** — `src/pages/admin/DeceasedList.tsx`: ConfirmDialog no delete (guarda objeto Deceased).
- [x] **W0-7** — `ReportDeath.tsx` + `AdminReportDeath.tsx`: isSubmitting + botão disabled/label + alerts→toast.
- [x] **W0-8** — `ReportDeath.tsx` (foto+docs) e `ProfilePage.tsx`: validateFile/ALLOWED_IMAGE_TYPES.
- [x] **W0-9** — `ReportDeath.tsx`: photoPreviewUrl via useMemo + cleanup; `ProfilePage.tsx`: revoga blob anterior. alt nas imgs.
- [ ] **W0-10** — INFRA (não executável por mim): `firebase deploy --only firestore:rules,storage,firestore:indexes,functions`; verificar bloco `public_deceaseds` nas rules em produção; curl de regressão LGPD.

### Ações de INFRA pendentes da Onda 0 (exigem credenciais/console):
1. GitHub → Settings → Secrets and variables → Actions → **Variables**: criar `FIREBASE_API_KEY`…`FIREBASE_MEASUREMENT_ID` (valores que estavam hardcoded no YAML — ver git history do deploy-pages.yml).
2. GitHub → Secrets: **apagar** `GEMINI_API_KEY`.
3. GCP Console → Credentials: **revogar** a chave Gemini antiga.
4. Firebase Auth: deletar/desabilitar `admin@memorial.com` e `gestor@memorial.com` se existirem.
5. `firebase functions:secrets:set MONITOR_TRIGGER_TOKEN` (openssl rand -hex 32) + redeploy `manualMonitorTrigger`.
6. Deploy de rules/functions (W0-10) + evidência.

`npx tsc --noEmit` (raiz) → EXIT 0. `functions` tsc → EXIT 0.

---

## ONDA 1 — INTEGRIDADE DE DADOS — ✅ CÓDIGO CONCLUÍDO (infra pendente)

- [x] **W1-1** — `notificationService.allocateNotification` reescrita transacional (runTransaction, recheck de plot, PlotUnavailableError exportado, burialDate do form). `syncPublicDeceasedFromAllocation` exportado de deceasedService. `CommunicatedDeaths`: campo data + reload em conflito.
- [x] **W1-2** — `CommunicatedDeaths`: `availablePlots` useMemo + aviso diferenciando setor lotado vs vazio.
- [x] **W1-3** — `deceasedService.deleteDeceased`: batch libera plot + Promise.allSettled deleteObject + guard de tenant.
- [x] **W1-4** — `createDeceased`: tenantId obrigatório (throw), removido fallback 'default'; grava nameLowercase.
- [x] **W1-5** — `cemeteryService.deleteSector`: bloqueia ocupados/reservados + cascade em lotes de 450. `CemeteryDetail`: ConfirmDialog + toasts (window.confirm/alert do setor removidos).
- [x] **W1-6** — `InventoryPage.handleStatusChange`: ao voltar p/ available limpa deceasedId/occupantName/burialDate (deleteField).
- [x] **W1-7** — `firestore.rules`: helper `hasValidCemeteryId()` aplicado nos 12 sci_* e em plots (create+update). **[deploy pendente]**
- [x] **W1-8** — `deceasedService`: getDeceasedPage/searchDeceasedByName + nameLowercase em create/update; getDeceasedList vira wrapper. `DeceasedList`: paginação + "Carregar mais" + busca server-side (debounce). Índice em firestore.indexes.json. Script `scripts/backfill-name-lowercase.cjs`. **[backfill+index deploy pendentes]**
- [x] **W1-9** — `DeceasedForm` modo edição (useParams, reset, updateDeceased, plotId travado, docs read-only). Rota `falecidos/:id/editar` em App.tsx. Links em DeceasedList (dropdown) e DeceasedDetail (header).
- [x] **W1-10** — `sciService.updateSCIRecord`: TERMINAL_STATUS_STAMPS (resolvedAt/resolvedBy/completedAt/closedAt) + invalidateCache.
- [x] **W1-11** — `notificationService.rejectNotification` (ganha tenantId + audit) e `deleteNotification` (recebe objeto, apaga arquivos, audit best-effort). `CommunicatedDeaths` e `GardenOfMemories` atualizados (deleteDoc direto removido).
- [x] **W1-12** — `functions deleteManagerAccount`: cascade completa de TENANT_DATA_COLLECTIONS (audit_logs preservado), timeout 540s, retorna mapa `deleted`. **[deploy pendente; texto UI do confirm = W3-5]**
- [x] **W1-13** — `functions toggleManagerStatus`: desativa TODOS os logins do tenant + revokeRefreshTokens; retorna affectedUsers. **[deploy pendente]**
- [x] **W1-14** — `deceasedService.createDeceasedWithPlot` (ocupa jazigo transacionalmente). `DeceasedForm` e `AdminReportDeath` usam-na; plotId virou select de jazigos available do cemitério.

Divergências registradas:
- W1-8: o upper bound de searchDeceasedByName já continha o sentinel `` (não renderiza no md) — correto, sem alteração.
- `createDeceased` ficou sem chamadores no app (ambos wizards usam WithPlot; alocação inlina) — mantido exportado.

### Infra pendente da Onda 1:
- `firebase deploy --only firestore:rules,firestore:indexes,functions`
- `node scripts/backfill-name-lowercase.cjs` (com serviceAccountKey) ANTES de confiar na busca.

`npx tsc --noEmit` (raiz) → EXIT 0. `functions` tsc → EXIT 0.

## ONDA 2 — SEGURANÇA E AUTORIZAÇÃO — ✅ CÓDIGO CONCLUÍDO (rules validadas por teste; deploy pendente)

- [x] **W2-1** — `src/lib/roles.ts` (NOVO, fonte única). App.tsx (ADMIN_ROUTE_ROLES), LoginPage (getHomeForRole), GardenOfMemories (isStaffRole), UnauthorizedPage (getHomeForRole). firestore.rules + storage.rules: variantes PT removidas de isManager/isOperator. `grep 'gestor'/'operador'` em src → 0.
- [x] **W2-2** — `storage.rules` reescrito (staffOfFileTenant por metadado + validDocument/validImage 10MB). customMetadata {tenantId} em TODOS uploadBytes (notificationService, deceasedService x2 funções, sciService.uploadSCIDocument, userProfileService). Script `scripts/backfill-storage-metadata.cjs`. **[backfill+deploy pendentes]**
- [x] **W2-3** — firestore.rules profiles: manager lê perfis do próprio tenant. CemeteryList.fetchData: removido `.catch(()=>[])`, try/catch com toast.
- [x] **W2-4** — firestore.rules deceaseds: cláusula morta managersUid removida.
- [x] **W2-5** — firestore.rules: validPlotSchema()/validFinancialSchema() em plots e sci_financial_records (create+update).
- [x] **W2-6** — firestore.rules death_notifications create: valida tenantId == cemetery.tenantId via get().
- [x] **W2-7** — firestore.rules user_profiles: split get (staff pode) / list (só dono/superadmin).
- [x] **W2-8** — functions: STAFF_ROLES em chatWithManagerAgent + enforceAiRateLimit (ai_usage, transação) + logAiCall (AI_CALL) nas 3 callables. firestore.rules ai_usage bloqueado. **[deploy pendente]**
- [x] **W2-9** — LoginPage reset: resposta neutra (user-not-found → 'sent'); mensagem genérica.
- [x] **W2-10** — functions addUserToTenant aceita role (manager|operator). superadminService repassa role. SuperAdminPage: select de papel + estado. **[deploy pendente]**
- [x] **W2-11** — `tests/rules/firestore.rules.test.ts` (11 casos R1–R10+schema). firebase.json emulators. `.github/workflows/ci.yml` (quality + deploy-rules). package.json scripts (typecheck/test/test:rules). Deps instaladas (vitest, @firebase/rules-unit-testing, firebase-tools).
  - ✅ **`npm run test:rules` → 11/11 PASSOU no emulador** (valida W1-7, W2-3, W2-4, W2-5, W2-6).

Pré-verificação pendente (W2-1 passo 1): script Admin SDK listando claims PT (`gestor`/`operador`) — migrar ANTES de deployar rules. Esperado zero pelas functions atuais.

### Infra pendente da Onda 2:
- `node scripts/backfill-storage-metadata.cjs` ANTES do deploy de storage.rules.
- `firebase deploy --only firestore:rules,storage,functions`.
- GitHub: `FIREBASE_DEPLOY_TOKEN` secret (firebase login:ci); branch protection marca job `quality` como required.

`npx tsc --noEmit` (raiz) → EXIT 0. `functions` tsc → EXIT 0.

## ONDA 3 — FEEDBACK E UX CRÍTICA — ✅ CÓDIGO CONCLUÍDO

- [x] **W3-1** — `src/lib/errors.ts` (NOVO): getFirestoreErrorMessage/reportError/reportLoadError.
- [x] **W3-2** — Varredura de catches silenciosos: reportLoadError em AdminContext, AdminDashboard, OperationalPage, InventoryPage, FinancialPage, MaintenancePage, EnvironmentalPage, DocumentsCenterPage, SupportPage, ReportsPage, AgentsPage, DeceasedDetail, CommunicatedDeaths, GardenOfMemories, SuperAdminPage (x2), MonitoringDashboard, ProfilePage. AuthContext seta error no contexto. VirtualAssistant/UserLayout comentados como best-effort. (SecurityPage/DeceasedList já tinham toast de W0-4/W1-8.)
- [x] **W3-3** — AgentsPage: toast em create/toggle + reportError.
- [x] **W3-4** — ReportsPage: toast em generate + reportError/reportLoadError.
- [x] **W3-5** — SuperAdminPage: window.confirm → ConfirmDialog (PendingAction), requireText no nome da prefeitura; toasts em toggle tenant/user; reportError.
- [x] **W3-6** — CemeteryDetail: ConfirmDialog no delete de túmulo; alerts de save → reportError + toast success; load catches → reportLoadError.
- [x] **W3-7** — Loading states: FinancialPage, DocumentsCenterPage, SupportPage (2 tabelas), SecurityPage (painel incidentes), CemeteryList (skeleton + empty CTA).
- [x] **W3-8** — SearchPage: estado searchError separado de "nenhum resultado" (banner).
- [x] **W3-9** — ProfilePage e ShopAndServices: alert → toast. QRCodeGenerator alert → toast. Gate: `grep alert( src/**.tsx` sem uso; `window.confirm` só em comentário.
- [x] **W3-10** — userProfileService.getRequesterInfo (get pontual + cache). CommunicatedDeaths: célula Solicitante mostra nome/telefone.
- [x] **W3-11** — AdminDashboard: card "Óbitos aguardando análise" no topo (getTenantNotifications no Promise.all, destaque âmbar).

`npx tsc --noEmit` (raiz) → EXIT 0.

## ONDA 4 — FUNCIONALIDADES INCOMPLETAS — ✅ CÓDIGO CONCLUÍDO (12/12)

- [x] **W4-1** — Monitoramento contra schema REAL (achado crítico nº 4):
  - operationalMonitor: comunicados `status=='submitted'`; superadmin usa `timestamp`; gestoresAtivos vira proxy (actores distintos em audit_logs 24h); requests/funeral_plans → -1 (N/D).
  - technicalMonitor: activeUsers/failedLogins → -1 (sem fonte); geminiCalls → `action=='AI_CALL'` + `timestamp`.
  - memorialMonitor: `photoURL`→`photoUrl`; funeral_plans/memorial_visits/memorial_photos → -1.
  - Convenção -1 = "sem fonte"; MonitoringDashboard MetricCard renderiza "N/D" (título explicativo). Health score já usa `> N` (não penaliza -1). 3 índices em firestore.indexes.json. **[deploy functions+índices pendente]**
- [x] **W4-2** — SecurityPage: removidos câmera "AO VIVO" fake e matriz gestor/operador/auditor fictícia. Badge dinâmico (activeCount). Tabela `effectivePermissions` (espelho das rules) + nota de roadmap. Imports Video/Eye removidos.
- [x] **W4-3** — PartnersPage: mock removido; CRUD real via `sci_partners` (listPartners/createPartner/updatePartner no sciService). Modal criar/editar + ativar/desativar + empty state CTA + loading. Rule `sci_partners` adicionada (rules tests 11/11 OK). **[deploy rules pendente]**
- [x] **W4-4** — ShopAndServices: banner "Catálogo demonstrativo" + botão finalizar desabilitado ("em breve"); finishCheckout removido.
- [x] **W4-5** — FinancialPage: coluna "Validado IA" removida; delete de lançamento (deleteSCIRecord + ConfirmDialog + audit DELETE_FINANCIAL_RECORD); aba "Projeções"→"Consolidado" com texto honesto; min="0" + guard de negativo (par com W2-5).
- [x] **W4-7** — Mensagem "chave Gemini" removida: AgentsPage chat (erro amigável + rate-limit), aiService.ts, MonitoringDashboard label. `grep Gemini src` → só nome de campo interno (geminiApiCallsToday).

- [x] **W4-12** — OperationalPage: `operationalRecordSchema` aplicado no submit (safeParse + mensagens); plotId agora tem `<select>` visível nas abas burial/exhumation/maintenance (getCemeteryPlots); `dateRangeSchema` morto removido; reportError no catch.

- [x] **W4-6** — Relatórios: `buildReportSummary` agora tem seções por tipo (6 tipos ≠ conteúdo) + período + nome da unidade; `createAutomaticReport` aceita period/cemeteryName (grava periodFrom/To). ReportsPage: inputs De/Até + cemeteryName; label "Financeiro (opcional)"→"Financeiro". DIVERGÊNCIA: openSanitaryChecks/highSanitaryRiskPlots não existem no snapshot (omitidos); filtragem financeira por período fica como follow-up (snapshot é estado-presente; período é exibido/persistido).
- [x] **W4-8** — Estoque: `moveStock` transacional (StockMovement + saldo não-negativo), `listStockMovements`. Rule `sci_stock_movements` imutável (update/delete=false). MaintenancePage: colunas Mínimo+Ações, botões Entrada/Baixa + mini-modal, tabela "Últimas movimentações". **[deploy rules pendente]**
- [x] **W4-9** — `createExhumationOrderFromAlert` (ordem exhumation/high/planned + bloqueia plot + audit BLOCK_PLOT_FOR_EXHUMATION). ExhumationAlert ganhou cemeteryId/occupantName. OperationalPage: botão "Gerar ordem de exumação" + ConfirmDialog na aba Prazos.
- [x] **W4-10** — `MemorialPage.tsx` (NOVO) lê public_deceaseds; rota `/memorial/:id` (Placeholder removido); SearchPage resultado vira Link; QRCodeGenerator usa QRCodeCanvas com download PNG real + Imprimir; QR na ficha (DeceasedDetail).
- [x] **W4-11** — functions `onDeathNotificationDecision` (onDocumentUpdated) notifica família via WhatsApp; alertService exporta `sendWhatsAppMessage` (interno renomeado p/ postWhatsApp). ProfilePage: finalidade LGPD no campo telefone. **[deploy functions pendente; requer WHATSAPP_ENABLED]**

`npx tsc --noEmit` (raiz) → EXIT 0. `functions` tsc → EXIT 0. Rules tests 11/11 OK.

## ONDA 5 — PERFORMANCE E ARQUITETURA — 🔶 PARCIAL (8/11)

- [x] **W5-1** — App.tsx: React.lazy + Suspense por área (públicas/auth estáticas). `npm run build` confirma code-splitting: Recharts/BarChart (352kB) e páginas admin em chunks separados; LoadingSpinner adotado.
- [x] **W5-2** — `buildMonthlyBurialTrend` (função pura) + campo `monthlyBurialTrend` no SciExecutiveSnapshot (calculado no snapshot cacheado). `getMonthlyBurialTrend` vira wrapper deprecado. AdminDashboard usa `data.monthlyBurialTrend` (1 leitura de operacionais em vez de 2).
- [x] **W5-3** — `src/lib/storageUpload.ts` (uploadFilesParallel, Promise.all + índice `_i_` anti-colisão + metadata). Adotado em notificationService, deceasedService (createDeceased + createDeceasedWithPlot).
- [x] **W5-7** — CommunicatedDeaths, DeceasedForm, AdminReportDeath: cemitérios via `useAdmin().cemeteries` (fetch local removido).
- [x] **W5-8** — `syncPublicDeceased` grava nameLowercase; SearchPage busca server-side por prefixo (where nameLowercase + sentinel); backfill-public-deceaseds.cjs estendido. **[backfill pendente]**
- [x] **W5-9** — AdminContext: selectedCemeteryId persistido em localStorage por tenant + sanidade se unidade excluída + `selectedCemeteryName` exposto. AdminDashboard e DeceasedList exibem nome (não ID).
- [x] **W5-10** — Removidas deps não usadas: uuid, motion, react-leaflet (frontend), @google/genai (functions). Builds verdes.
- [x] **W5-11** — Removidos (git rm): HomePage.tsx, metadata.json, scripts/migrate-tenant-ids.ts, functions/index.js (v1 morto), functions/lib (build output). `lib/` no functions/.gitignore + predeploy build no firebase.json. listenNotification + onSnapshot removidos; imports Search/Menu/User mortos em PublicLayout; dateRangeSchema já removido (W4-12).

### Onda 5 DEFERIDO (refactors grandes — pura arquitetura, fazer com QA dedicado):
- [ ] **W5-4** — Adotar SCITable + useCemeteryFilter + useModal nas 9 páginas SCI (13 filtros + ~10 tabelas + 9 modais). Redução ~800-1000 linhas, sem mudança de comportamento. (~5364)
- [ ] **W5-5** — Hook `useSciCreate` para os 11 handlers de criação SCI. (~5431)
- [ ] **W5-6** — Snapshot via `getCountFromServer` (contadores O(1) em vez de baixar todos os plots). MAIOR item, "fazer por último com QA". (~5509)

`npx tsc --noEmit` (raiz) → EXIT 0. `npm run build` → OK (code-split). `functions` build → OK.

## ONDA 6 — QUALIDADE E DÉBITO TÉCNICO — 🔶 PARCIAL (6/10)

- [x] **W6-4** — `formatters.ts`: formatDate aceita null + `formatDateTime` novo. sciService: `parseISO` nos 2 cálculos de prazo de exumação (corrige off-by-one UTC/BRT). (aplicar formatDate nas ~8 tabelas restantes: pendente)
- [x] **W6-5** — Moeda pt-BR: AgentsPage usa formatCurrency (buildReportSummary já usava via W4-6). `grep toFixed(2)` monetário → 0.
- [x] **W6-6** — `statusLabels.ts` estendido (checkStatus/document/ticket/training/priority/severity/riskLevel/audience/level/plotStatus + helper `label()` + occurrence 'monitoring'). COMPLETO: consumo aplicado em todos os selects/células das páginas (incl. `{item.priority}` cru em Maintenance/Operational via `label(priorityLabel, …)`). `<option value>` sempre preservado sem acento.
- [x] **W6-7** — Acentuação: COMPLETO. 4 varreduras com boundaries `(?<![/\w-])…(?![/\w-])` (rotas/ids/valores de domínio preservados: `publico`, `concessao`, `sanitario` em modules, `servicos` em CatalogCategory, chave `area` de SanitaryCheck, `value="Ossuario"`). Frases "e"→"é"/"so"→"só" corrigidas pontualmente. Grep do Anexo K → só rotas/identificadores restam.
- [x] **W6-8** — a11y: COMPLETO. `useModal` ganhou focus-trap (Tab/Shift+Tab) + restauração de foco + onClose via ref (evita foco roubado ao digitar); aplicado com `role="dialog"`/`aria-modal`/`aria-labelledby` + Esc em TODOS os modais de página (AdminDashboard, AgentsPage, CemeteryList, CemeteryDetail×2, MaintenancePage, PartnersPage, InventoryPage×2, GardenOfMemories×2, ShopAndServices carrinho+checkout; ConfirmDialog/CommunicatedDeaths já tinham). aria-label em todos os botões só-ícone e em todos os inputs/textareas/selects sem label programático (scripts: placeholder→aria-label, title→aria-label, select value={campo}→mapa PT).
- [x] **W6-9** — Testes unitários: `tests/unit/fileValidation.test.ts`, `formatters.test.ts`, `publicProjection.test.ts` (LGPD whitelist — PUBLIC_FIELDS exportado). **`npm test` → 9/9 PASSOU.** (snapshot.test.ts requer refactor computeSnapshotFromData — deferido.)
- [x] **W6-10** — Identidade: package.json name=memorialos, version=1.0.0, description. index.html meta description. README já atualizado (OpenRouter/set-superadmin.cjs) na Onda 0.

### Onda 6 DEFERIDO (risco/volume alto):
- [ ] **W6-1** — TS strict (strictNullChecks/noImplicitAny/noUnusedLocals) + @types/react. ~100-200 erros esperados; fazer por camada com PR dedicado. (~5772)
- [ ] **W6-2** — ESLint flat config + Prettier + husky/lint-staged + passo no CI. Infra. (~5850)
- [ ] **W6-3** — Tipar os ~95 `any` (useState<any[]> → tipos dos services). Mecânico, grande. (~5917)

`npx tsc --noEmit` (raiz) → EXIT 0. `functions` tsc → EXIT 0. `npm test` → 9/9. `npm run build` → OK.

---

# RESUMO GERAL DA SESSÃO

| Onda | Status | Itens |
|---|---|---|
| 0 — Bloqueantes | ✅ código (infra pendente) | 10/10 |
| 1 — Integridade | ✅ código (deploy pendente) | 14/14 |
| 2 — Segurança | ✅ código (rules validadas por teste 11/11) | 11/11 |
| 3 — Feedback/UX | ✅ código | 11/11 |
| 4 — Funcionalidades | ✅ código | 12/12 |
| 5 — Performance | 🔶 8/11 (W5-4/5/6 refactors grandes deferidos) | 8/11 |
| 6 — Qualidade | 🔶 6/10 (W6-1/2/3 deferidos) | 6/10 |

**Verificação global**: `npx tsc --noEmit` raiz EXIT 0 · `functions` tsc EXIT 0 · `npm run build` OK (code-split) · `npm test` 9/9 · rules tests 11/11 (emulador).

## AÇÕES DE INFRA/DEPLOY PENDENTES (consolidado — exigem credenciais/console):
1. GitHub Variables `FIREBASE_*` (7) + apagar secret `GEMINI_API_KEY` + `FIREBASE_DEPLOY_TOKEN`.
2. GCP: revogar chave Gemini antiga.
3. Firebase Auth: deletar `admin@memorial.com`/`gestor@memorial.com`.
4. `firebase functions:secrets:set MONITOR_TRIGGER_TOKEN` e `OPENROUTER_API_KEY`.
5. Backfills (com serviceAccountKey): `backfill-name-lowercase.cjs`, `backfill-storage-metadata.cjs`, `backfill-public-deceaseds.cjs` (agora grava nameLowercase).
6. `firebase deploy --only firestore:rules,firestore:indexes,storage,functions` (predeploy rebuilda functions/lib).
7. Pré-verificação W2-1: migrar claims PT residuais antes do deploy de rules.

## PRÓXIMOS ITENS PARA RETOMADA (ordem sugerida):
W5-4 (SCITable/useCemeteryFilter/useModal) → W5-5 (useSciCreate) → W6-3 (tipar any) → W5-6 (getCountFromServer) → W6-1 (strict) → W6-2 (ESLint) → varreduras finais W6-6/W6-7/W6-8.
