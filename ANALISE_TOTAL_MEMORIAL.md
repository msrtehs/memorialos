# ANÁLISE TOTAL — MemorialOS

**Data da análise**: 2026-07-04
**Escopo**: 100% dos arquivos versionados do repositório (116 arquivos), incluindo `src/`, `functions/`, `firestore.rules`, `storage.rules`, `scripts/`, workflows de CI e documentação.
**Método**: leitura integral do código-fonte, cruzamento entre camadas (UI ↔ services ↔ regras ↔ Cloud Functions), verificação de código morto por busca de referências.
**Stack observada**: React 19 + Vite 6 + TypeScript 5.8 (não-strict) + Tailwind 4 + Firebase (Auth, Firestore, Storage, Functions v2) + OpenRouter (IA) + GitHub Pages (deploy).

---

# SUMÁRIO EXECUTIVO

## Os 5 achados mais críticos

1. **Exclusões destrutivas sem confirmação** — `CemeteryList.tsx:119-130` exclui um cemitério inteiro (com cascade de plots e setores via `deleteCemetery`, `cemeteryService.ts:137-188`) num único clique no ícone de lixeira, **sem nenhum modal de confirmação**. O mesmo ocorre em `DeceasedList.tsx:132-137`: o item "Excluir" do dropdown apaga o registro oficial de um falecido imediatamente. O `IMPLEMENTACAO_STATUS.md` (linha 53) afirma que o `window.confirm` foi "substituído por modal + toast", mas o modal de confirmação **não existe** nesses dois fluxos — apenas em `GardenOfMemories` e `AgentsPage`. Em um sistema de registro público municipal, isso é perda de dados irreversível a um clique de distância.

2. **O CI ainda injeta a chave Gemini no bundle público** — `.github/workflows/deploy-pages.yml:36` escreve `VITE_GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }}` no `.env` de build. O plano de correções (item C4) declarou a chave "removida do frontend", e o `README.md:40` afirma "Não existe mais VITE_GEMINI_API_KEY" — mas o workflow que gera o site público continua gravando o segredo no ambiente de build. Se o secret ainda estiver configurado no GitHub, qualquer `import.meta.env.VITE_GEMINI_API_KEY` futuro (ou ferramenta de build que injete env no bundle) vaza a chave. Além disso, todo o config Firebase está **hardcoded no YAML** (linhas 37-43), contradizendo o próprio README que manda usar Variables.

3. **Falha silenciosa no registro de eventos de segurança** — `SecurityPage.tsx:52-74` envia `cemeteryId: 'all'` quando "Todas as unidades" está selecionado; `createForTenant` (`sciService.ts:235-237`) **lança erro** para `cemeteryId === 'all'`, e o `catch` da página só faz `console.error` — sem toast, sem guard prévio, ao contrário de todas as outras 8 páginas SCI. O gestor clica "Registrar evento", nada acontece, nenhum feedback. Um incidente de segurança relatado simplesmente se perde.

4. **Todo o agente de monitoramento consulta campos e coleções que não existem** — o backend de monitoramento (`functions/src/monitoring/*`) é internamente consistente, mas está desconectado do modelo de dados real: `operationalMonitor.ts:115` busca `death_notifications` com `status == 'aguardando_validacao'` (o app grava `'submitted'`); `technicalMonitor.ts:70-71` busca `audit_logs` por `action == 'LOGIN_FAILED'` e campo `createdAt` (o app grava campo `timestamp` e nunca loga falha de login); `operationalMonitor.ts:99` filtra `audit_logs.userRole` (campo inexistente); `profiles.lastLoginAt` nunca é escrito por ninguém; as coleções `requests`, `funeral_plans`, `memorial_visits` e `memorial_photos` não são alimentadas por nenhuma tela; `memorialMonitor.ts:62` consulta `photoURL` (o campo real é `photoUrl`). Resultado: o Dashboard de Monitoramento do superadmin exibe zeros e um "Health Score" fictício — parece observabilidade, mas não observa nada.

5. **Alocação de jazigo não é transacional nem verifica disponibilidade** — `allocateNotification` (`notificationService.ts:155-221`) executa 4 escritas sequenciais (cria deceased → atualiza plot → atualiza notificação → audit log) sem transação: uma falha no meio deixa falecido criado sem plot, ou plot ocupado sem notificação alocada. Pior: não relê o status do plot antes de ocupar — dois gestores alocando em paralelo (ou um plot ocupado manualmente entre a abertura do modal e o confirmar) resulta em **dois sepultados no mesmo jazigo**, o pior erro de domínio possível num cemitério.

## Os 5 achados mais valiosos de produto

1. **O núcleo do fluxo cidadão→prefeitura funciona de verdade e é o diferencial** — Comunicar Óbito (`ReportDeath.tsx`) → análise pelo gestor (`CommunicatedDeaths.tsx`) → alocação que cria o registro oficial, ocupa o plot e grava prazo de exumação (`allocateNotification`) → acompanhamento pela família (`GardenOfMemories.tsx`). Esse circuito completo, com regras Firestore que impedem o cidadão de forjar alocação (`firestore.rules:100-133`), é raro em sistemas municipais e deve ser o carro-chefe. Completá-lo (notificação por e-mail/WhatsApp ao mudar status, guia de sepultamento em PDF) multiplicaria o valor com pouco esforço.

2. **O controle de prazos de exumação e concessões é o recurso "matador" para prefeituras** — `sciService.ts:539-567` e `688-728` calculam vencidos/próximos com base em `burialDate + exhumationDeadlineYears` e `concessionEndDate`. Nenhuma planilha municipal faz isso. Falta apenas fechar o ciclo: botão "iniciar processo de exumação" a partir do alerta, notificação à família titular, e trilha de aprovação — hoje o alerta é só leitura (`OperationalPage.tsx:443-509`).

3. **Memorial digital público está 90% ausente apesar de ser a promessa central** — a rota `/memorial/:id` é um `Placeholder` (`App.tsx:94`), `HomePage.tsx` (que exibiria obituários) está órfã (não roteada), `QRCodeGenerator.tsx` existe mas nunca é usado, e a coleção `memorials` tem regras prontas (`firestore.rules:136-159`) e até trigger de criação automática num arquivo de functions morto (`functions/index.js:43-58`). Ligar essas pontas (página pública do memorial lendo `public_deceaseds` + QR code imprimível para a lápide) entregaria a visão do `docs/VISION.md` J3/J4 com componentes que já existem.

4. **A projeção pública `public_deceaseds` é uma base sólida de LGPD para expandir** — a separação staff-only (`deceaseds`) vs projeção pública com whitelist de campos (`deceasedService.ts:50-66`, `firestore.rules:93-97`, script de backfill) é a arquitetura correta. Falta o complemento de produto: consentimento/opt-out da família, página de privacidade, e busca server-side real (hoje a busca baixa 200 docs e filtra no cliente — `SearchPage.tsx:32-38`).

5. **Os módulos SCI já cobrem o dia-a-dia operacional, mas precisam de "fechamento de ciclo"** — Operacional, Manutenção, Ambiental, Documentos, Suporte e Financeiro têm CRUD de criação + mudança de status funcionando contra o Firestore. O que falta em todos é o mesmo: edição/exclusão de registros, vínculo real com entidades (plotId é texto livre), datas formatadas, e relatórios exportáveis (só existe TXT). Um sprint de "acabamento" transversal tornaria o conjunto vendável.

---

# 1. FUNCIONALIDADES — MÓDULO A MÓDULO

Convenção desta seção: para cada módulo → **Propósito** (o que deveria fazer), **Realidade** (o que o código faz), **Quebrado/Incompleto/Simulado**, **Funciona**, **Fluxos ausentes**.

## 1.1 Dashboard Executivo (`src/pages/admin/AdminDashboard.tsx`, 496 linhas)

**Propósito**: visão consolidada do(s) cemitério(s): ocupação, saturação, sepultamentos, exumações, pendências, financeiro e prioridades.

**Realidade**: consome `getSciExecutiveSnapshot` (`sciService.ts:506-686`), que agrega 7 coleções (`plots` paginado + 6 coleções SCI) com cache de 60s, e `getMonthlyBurialTrend` (`sciService.ts:730-762`). Renderiza 8 cards clicáveis (navegam para os módulos), gráfico de barras (tendência mensal), pizza de ocupação (Recharts), painel "Prioridades IA" e um modal de checklist sanitário que grava em `sci_sanitary_checks`.

**Quebrado / Incompleto / Simulado**:
- O rótulo "Prioridades IA" é **enganoso**: `sciService.ts:590-660` é um conjunto de `if`s com thresholds fixos (ex.: ocupação ≥ 90 → prioridade). Não há IA envolvida. O banner da linha 485-493 ("IA aplicada a gestao sanitaria... ativa") é puramente cosmético.
- `AdminDashboard.tsx:156` exibe o **ID bruto** do cemitério selecionado ("Unidade: aBc123xyz") em vez do nome — o nome está disponível em `useAdmin().cemeteries`.
- O bloco `{loading && ...}` das linhas 370-374 é **inalcançável**: quando `loading` é true a função retorna antes, no early-return da linha 139-148.
- Erro de carga (`AdminDashboard.tsx:71-72`) só vai para `console.error` — o gestor vê um dashboard zerado sem saber que houve falha.
- A projeção de saturação (`sciService.ts:520-537`) usa `sci_operational_records` do tipo `burial` como proxy de ritmo de sepultamento — mas sepultamentos reais acontecem via `allocateNotification`, que **não cria** um registro operacional `burial`. As duas fontes divergem: o card "Sepultamentos" conta tarefas manuais, não sepultamentos efetivos.
- Checklist sanitário do dashboard duplica integralmente o formulário de `EnvironmentalPage.tsx:200-221` (campos, validação manual, submit) — dois códigos para o mesmo caso de uso.
- Validação do checklist (`AdminDashboard.tsx:101-103`) falha silenciosamente: se um campo obrigatório está vazio, o `return` sem mensagem deixa o usuário sem saber por que o botão "não funciona" (os inputs não têm `required`).

**Funciona**: cards e navegação; skeleton de loading (`StatCardSkeleton`); guard de `selectedCemeteryId === 'all'` com toast no checklist; gráfico de tendência com 12 meses inicializados em zero; refresh manual.

**Fluxos ausentes**: filtro por período; comparação entre unidades; drill-down dos números (clicar em "Exumações pendentes" deveria abrir a lista filtrada, não a página genérica); exportação do dashboard; nenhum indicador de "dados em cache/atualizados às HH:MM".

## 1.2 Operacional (`src/pages/admin/OperationalPage.tsx`, 549 linhas)

**Propósito**: gestão de sepultamentos, exumações, agendamentos, fluxo, manutenção, emissão de documentos, notificações internas, ocorrências e prazos de exumação.

**Realidade**: 9 abas. As 6 primeiras compartilham um único formulário inline que grava `sci_operational_records` com `type = aba` ativa; "Notificações" grava `sci_internal_notifications`; "Ocorrências" grava `sci_occurrences`; "Prazos exumação" é somente leitura de `getExhumationAlerts`. Toda linha de tabela tem um `<select>` de status que chama `updateSCIRecord`.

**Quebrado / Incompleto / Simulado**:
- Os "sepultamentos" e "exumações" desta tela são **tarefas de texto livre**, não operações reais: `plotId` é um `<input>` de texto sem validação contra a coleção `plots` (o campo nem aparece no formulário — está no estado `recordForm` da linha 60 mas nunca é renderizado num input!). Criar um registro `burial` aqui não ocupa jazigo, não cria falecido, não interage com o inventário.
- `validationSchemas.operationalRecordSchema` (`src/lib/validationSchemas.ts:11-21`) foi criado exatamente para este formulário e **nunca é importado** — a validação real é só `required` no título e `min={today}` no date input (`OperationalPage.tsx:293`).
- Não há edição nem exclusão de registros — apenas mudança de status. Um título digitado errado fica errado para sempre.
- A aba "Prazos exumação" é 100% passiva: nenhum botão para agir sobre um prazo vencido (criar ordem de exumação, notificar família, bloquear jazigo).
- Datas exibidas cruas (`item.scheduledFor || '-'`, linha 528) em formato ISO `YYYY-MM-DD`, não `dd/mm/aaaa` — `formatDate` de `formatters.ts` existe e não é usado aqui.
- `handleStatusUpdate` usa o mesmo action de auditoria `'UPDATE_OPERATIONAL_STATUS'` (linha 252) para as três coleções diferentes — trilha de auditoria imprecisa.
- Prioridade e status exibidos em inglês cru na tabela (`item.priority` → "medium") enquanto os selects têm labels PT.

**Funciona**: criação nas 8 abas com toast de sucesso/erro e mapeamento de `permission-denied`; guard de unidade "all"; filtragem client-side por cemitério; destaque de SLA vencido nas ocorrências (`OperationalPage.tsx:411-412`); as duas tabelas de prazos de exumação com dias em atraso/restantes.

**Fluxos ausentes**: agendamento em calendário (a aba "Agendamentos" é a mesma lista de texto); vínculo sepultamento ↔ falecido ↔ jazigo; ordem de exumação com aprovação e documento; impressão de guia de sepultamento; histórico por jazigo.

## 1.3 Inventário / Mapa (`src/pages/admin/InventoryPage.tsx`, 698 linhas)

**Propósito**: mapa georreferenciado dos jazigos, lista filtrada, cadastro de jazigo, diagnóstico do inventário.

**Realidade**: três modos. "Mapa" renderiza um plano cartesiano caseiro (divs absolutas posicionadas por normalização min/max de lat/lng — `getMapPosition`, linhas 145-152) com labels de setor e pontos coloridos clicáveis que abrem modal de inspeção; "Lista" é uma tabela com mudança de status inline; "IA" mostra o snapshot executivo + 3 recomendações **hardcoded**. Modal "Novo jazigo" com ~18 campos grava via `createPlot`.

**Quebrado / Incompleto / Simulado**:
- O "Mapa digital interativo (GIS)" **não é um mapa**: não usa Leaflet (que está instalado e é usado no `MapPicker` do cadastro de cemitérios), não tem tiles, escala, zoom nem pan. Coordenadas viram posições percentuais numa div — dois setores distantes 2km aparecem lado a lado. Para navegação real de campo é inutilizável.
- Modo "IA" (`InventoryPage.tsx:448-455`): as "Ações recomendadas" são três `<li>` fixos no JSX — simulação pura.
- Filtro de risco com semântica errada (`InventoryPage.tsx:98-102`): com `riskFilter='low'`, um plot com `sanitaryRisk='high'` mas `structuralStatus='ok'` ainda passa no filtro, porque a condição é um OR entre dimensões. Filtrar por "Alto" também retorna plots com estrutural crítico e sanitário baixo misturados.
- Mudar status para `available` na lista/modal não limpa `deceasedId`/`occupantName`/`burialDate` (`handleStatusChange`, linhas 154-166) — um jazigo "disponível" pode continuar apontando para um falecido, corrompendo os indicadores de exumação (que filtram `status === 'occupied'`, mas o vínculo órfão permanece no documento).
- Sem edição de jazigo (o modal só cria) — para corrigir lat/lng é preciso usar a outra tela (CemeteryDetail) que edita outros campos; nenhuma exclui-e-recria coordenadas.
- Latitude/longitude são inputs de texto sem validação de faixa (-90..90 / -180..180).
- `loadData` chama `getTenantPlots`/`getCemeteryPlots` **e** `getSciExecutiveSnapshot` (que internamente refaz a leitura paginada de todos os plots do tenant) — o mesmo dataset é lido duas vezes a cada montagem/troca de unidade.

**Funciona**: filtros de busca/setor/status; legenda; contadores; criação de jazigo com todos os campos de risco/concessão/exumação; modal de inspeção com alteração de status; erro com toast e modal mantido aberto em falha (comentário linha 221).

**Fluxos ausentes**: mapa real (Leaflet já está no projeto); importação em massa (CSV) de jazigos; histórico de ocupação do jazigo; ver falecido a partir do jazigo (o modal mostra `occupantName` mas não linka para `/admin/falecidos/:id`); impressão de croqui.

## 1.4 Financeiro (`src/pages/admin/FinancialPage.tsx`, 219 linhas)

**Propósito**: lançamentos de receita/despesa, tabela de preços, projeções.

**Realidade**: aba "Transações" com form inline gravando `sci_financial_records` e tabela; aba "Tabela de preços" com 4 cards **hardcoded** (`pricingTable`, linhas 11-16); aba "Projeções" com um banner estático que apenas repete receita/despesa/saldo do snapshot.

**Quebrado / Incompleto / Simulado**:
- Tabela de preços é fixa no código — o texto "Referencial" admite; não há CRUD de preços, embora `docs/VISION.md:30` liste "Tabelas de Preço" como parte de Configurações.
- "Projeções" não projeta nada: o texto fala em "análise preditiva" mas o card só soma lançamentos passados. Simulação de recurso.
- Coluna "Auditoria" com badge "Validado IA"/"Pendente" (`FinancialPage.tsx:152-158`): `aiAudited` nunca é definido como true por nenhum código do sistema (o comentário nas linhas 66-67 confirma que a Cloud Function "é implementação futura") — todos os registros ficarão eternamente "Pendente". Conceito fantasma na UI.
- Sem edição/exclusão de lançamento; um valor digitado errado é permanente (e sem confirmação não haveria como corrigir).
- `occurredAt` exibido cru em ISO (linha 146); valores negativos não são bloqueados (`type="number"` aceita `-100`, virando receita negativa).
- Não há `loading` state — a tabela mostra "Nenhum lancamento" durante o fetch inicial (o `loading` nem existe nesta página, diferente das demais).
- Nenhum filtro por período/mês, nenhum total por categoria, nenhuma exportação.

**Funciona**: criação de lançamento com guard de unidade e toast; separação receita/despesa com cor e sinal; consolidado no dashboard.

**Fluxos ausentes**: guias/boletos (DAM municipal), inadimplência de concessões (o dado de vencimento existe em `plots`!), conciliação, relatório mensal para contabilidade pública, integração PIX — `docs/VISION.md:117` já previa.

## 1.5 Manutenção (`src/pages/admin/MaintenancePage.tsx`, 299 linhas)

**Propósito**: ordens de serviço (kanban) e controle de estoque.

**Realidade**: aba "Ordens" cria `sci_operational_records` com `type:'maintenance'` e renderiza kanban de 3 colunas (planned/in_progress/done) com botões "Iniciar"/"Concluir"; aba "Estoque" cria/lista `sci_stock_items` com badge "Crítico" quando `quantity < minQuantity`.

**Quebrado / Incompleto / Simulado**:
- O kanban não tem drag-and-drop nem coluna "cancelado" (o status `cancelled` existe no modelo `sciService.ts:31` mas não há como aplicá-lo aqui — ordens canceladas só via Operacional).
- Estoque não tem movimentação: não é possível dar baixa/entrada — apenas criar o item com quantidade inicial. Sem editar, a quantidade nunca muda, tornando o alerta "Crítico" estático e o módulo decorativo após o primeiro cadastro.
- `plotId` de novo é texto livre (linha 186) sem validação.
- Ordens compartilham a coleção com o Operacional (correto), mas as criadas na aba "Manutencao" do Operacional e as daqui têm formulários com campos diferentes (Operacional não expõe plotId; aqui não expõe status inicial) — inconsistência entre entradas do mesmo dado.

**Funciona**: kanban com destaque visual de ordem atrasada (`MaintenancePage.tsx:209-219`); transições de status com toast; criação de item de estoque com defaults sensatos.

**Fluxos ausentes**: baixa/entrada de estoque com histórico; custo da ordem (ligação com Financeiro); anexo de foto na ordem; atribuição a usuário real (responsável é texto livre); recorrência (roçagem mensal).

## 1.6 Sanitário/Ambiental (`src/pages/admin/EnvironmentalPage.tsx`, 381 linhas)

**Propósito**: checklists sanitários e ambientais, indicadores de risco.

**Realidade**: duas abas gêmeas de formulário+tabela (gravam `sci_sanitary_checks` / `sci_environmental_checks`) e uma aba "Indicadores" com 4 cards do snapshot + lista de prioridades.

**Quebrado / Incompleto / Simulado**:
- As opções do select de status da tabela exibem valores crus em inglês: `open`/`monitoring`/`closed` (`EnvironmentalPage.tsx:251-253` e `319-323`) — `statusLabels.ts` não cobre esses estados e não foi aplicado.
- As duas abas são duplicação literal (estado, handler, JSX ~70 linhas cada) diferindo apenas na função de create — candidato óbvio a componente único parametrizado, ainda mais que o serviço já unificou os tipos (`EnvironmentalSanitaryCheck`, `sciService.ts:76-98`).
- `riskLevel` exibido cru em inglês no badge da tabela (linhas 245, 315).
- Sem edição, sem exclusão, sem anexo de foto/laudo (o modelo `OccurrenceRecord` tem `photoUrls` mas checks não têm nada).
- A aba "Indicadores" repete o painel de prioridades do Dashboard (terceiro lugar onde o mesmo bloco aparece).

**Funciona**: criação com campos obrigatórios (`required` nos inputs), guard de unidade, toasts; mudança de status persiste; cards de risco derivados do snapshot.

**Fluxos ausentes**: plano de ação vinculado ao check (hoje a "recomendação" é texto morto); recorrência de inspeção; laudo PDF para vigilância sanitária; monitoramento de necrochorume/lençol freático com série histórica (o domínio pede).

## 1.7 Documentos (`src/pages/admin/DocumentsCenterPage.tsx`, 201 linhas)

**Propósito**: digitalização documental com upload e validação.

**Realidade**: form que grava `sci_documents` com upload opcional ao Storage (`sci-documents/{uid}/...` via `uploadSCIDocument`), tabela com link "Abrir" e select de status.

**Quebrado / Incompleto / Simulado**:
- Status no select cru em inglês: `pending`/`validated`/`rejected` (linhas 186-188).
- `relatedEntityId` é texto livre — nenhuma ligação verificável com falecido/jazigo/ocorrência; a "rastreabilidade" prometida no subtítulo não existe.
- Documento não pode ser excluído nem substituído; arquivo errado fica órfão no Storage para sempre (não há delete de Storage em nenhum lugar do sistema).
- Sem alerta de vencimento: `expiresAt` é gravado mas nada consome (nenhuma query por documentos vencendo).
- Sem visualização inline (abre em nova aba via URL tokenizada do Storage).

**Funciona**: validação de tipo/tamanho do arquivo antes do upload (`validateFile`, com reset do input em erro — `DocumentsCenterPage.tsx:135-149`); criação com toast; datas de emissão/validade persistidas.

**Fluxos ausentes**: vencimento com alerta no dashboard; versionamento; assinatura/certificação digital (ICP-Brasil) para valor legal; OCR/busca no conteúdo.

## 1.8 Suporte / Treinamento (`src/pages/admin/SupportPage.tsx`, 266 linhas)

**Propósito**: chamados de suporte e agenda de capacitação.

**Realidade**: duas abas com form+tabela gravando `sci_support_tickets` e `sci_training_sessions`, com select de status.

**Quebrado / Incompleto / Simulado**:
- Novamente selects com valores crus: `open`/`in_progress`/`done` e `planned`/`completed` (linhas 198-200, 250-251).
- O "chamado de suporte" não vai para lugar nenhum: não há destinatário, fila do fornecedor, e-mail — é um registro que só o próprio tenant vê. Como canal de suporte ao fornecedor do sistema, é simulado.
- Treinamento sem lista de participantes, presença ou material.
- Sem edição/exclusão; sem detalhe do chamado (o campo `details` não aparece na tabela nem há tela de detalhe).

**Funciona**: criação com validações mínimas e toasts; filtragem por unidade.

**Fluxos ausentes**: comentários/thread no chamado; SLA com escalonamento; notificação ao abrir/resolver; certificado de treinamento.

## 1.9 Segurança (`src/pages/admin/SecurityPage.tsx`, 201 linhas)

**Propósito**: monitoramento de segurança física, incidentes e permissões.

**Realidade**: um painel de "câmera ao vivo" **falso** (div preta com ícone, badge "AO VIVO" pulsante e "CAM-SEC-01" — linhas 99-114), lista de incidentes (ocorrências de categoria `security`), form de registro e uma "matriz de permissões" **hardcoded** (linhas 7-14) que não reflete nem controla nada.

**Quebrado / Incompleto / Simulado**:
- **Bug crítico de fluxo** (já no sumário): `handleCreateEvent` envia `cemeteryId: 'all'` quando "Todas as unidades" está ativo (linha 58); `createForTenant` lança; o catch (linhas 69-71) só loga no console. Sem guard, sem toast — é a única página SCI sem ambos. O incidente é perdido silenciosamente.
- Feed de câmera é teatro: não há integração, configuração ou stream. O badge "Ambiente seguro ativo" (linhas 92-95) é decorativo.
- Matriz de permissões estática não corresponde às regras reais (as `firestore.rules` não diferenciam gestor/operador em nenhuma coleção SCI — ambos são `isStaff`; e "auditor" não existe como role no sistema).
- `updateStatus` (linhas 76-84) também sem toast de sucesso/erro.
- Incidente sem edição, sem anexos, sem gravidade visual além do texto.

**Funciona**: listagem/resolução de incidentes quando uma unidade específica está selecionada; contagem de ativos.

**Fluxos ausentes**: gestão real de usuários e permissões do tenant (hoje só o superadmin cria logins — o gestor não gerencia sua própria equipe!); log de acessos; integração com câmeras/alarmes se for manter a proposta.

## 1.10 Agentes IA (`src/pages/admin/AgentsPage.tsx`, 275 linhas)

**Propósito**: criar agentes/chatbots especializados e testá-los com contexto operacional.

**Realidade**: CRUD parcial de `sci_ai_agents` (criar, ativar/desativar — sem editar/excluir), console de chat que monta o contexto executivo (`buildContext`, linhas 112-126) e chama a Cloud Function `chatWithManagerAgent` (OpenRouter, `functions/src/index.ts:371-402`).

**Quebrado / Incompleto / Simulado**:
- `handleCreateAgent` e `toggleAgent` não dão feedback (só `console.error` — linhas 76-78, 86-88); o formulário limpa em sucesso, mas em erro o usuário não sabe o que houve.
- Mensagem de erro do chat menciona "Verifique a chave Gemini" (linha 148) — o backend agora é OpenRouter; mensagem desatualizada e inútil para o gestor.
- O histórico do chat não persiste (state local); trocar de página perde tudo.
- "Modo agente vs chatbot" não muda comportamento algum — é só um campo salvo.
- O campo `modules` (texto separado por vírgula) não restringe nada de fato; vai para o prompt como texto.
- O placeholder inicial diz "Selecione um agente ou crie um novo chatbot para iniciar", mas a seleção automática do primeiro agente (linhas 43-45) conflita com o texto.

**Funciona**: chat de ponta a ponta com contexto real (quando a function está deployada e a chave configurada); modal de confirmação ao trocar de agente com histórico ativo (`AgentsPage.tsx:249-272`); Enter envia.

**Fluxos ausentes**: editar/excluir agente; persistir conversas; agentes que **agem** (criar ocorrência/ordem a partir do chat — hoje é só texto); limites de custo por tenant.

## 1.11 Relatórios (`src/pages/admin/ReportsPage.tsx`, 148 linhas)

**Propósito**: relatórios operacionais, sanitários, ambientais, administrativos, jurídicos e financeiros.

**Realidade**: gera um `sci_report` cujo `summary` é um texto plano com ~15 linhas de indicadores do snapshot (`buildReportSummary`, `sciService.ts:776-800`) — **o mesmo texto para os 6 tipos**, mudando apenas o título. Download como `.txt`.

**Quebrado / Incompleto / Simulado**:
- Os 6 "tipos" de relatório são o mesmo relatório com títulos diferentes (`getReportTitle`). Um "Relatório Jurídico" que lista taxa de ocupação e alertas sanitários não atende à promessa.
- `handleGenerateReport` sem toast de sucesso/erro (só console — linhas 59-60); usuário clica e precisa perceber sozinho que apareceu item na lista.
- Sem período: o relatório é sempre "estado atual"; impossível gerar "relatório de junho".
- Download em TXT sem cabeçalho institucional; prefeituras precisam de PDF timbrado.
- O label "Financeiro (opcional)" (linha 13) é resquício sem sentido para o usuário.
- Relatório exibe `Cemiterio: <id>` cru no texto (o `buildReportSummary` grava o ID, não o nome).

**Funciona**: geração, histórico persistido com data, visualização e download.

**Fluxos ausentes**: PDF; período; agendamento (relatório mensal automático); templates por órgão de controle (TCE/TCM); assinatura do gestor responsável.

## 1.12 Treinamentos

Não existe como módulo separado — é a segunda aba de Suporte (ver 1.8). A sidebar rotula "Suporte / Treino" (`AdminLayout.tsx:110`).

## 1.13 Parceiros (`src/pages/admin/PartnersPage.tsx`, 55 linhas)

**Propósito**: cadastro de parceiros (floriculturas, marmorarias, seguradoras).

**Realidade**: **100% simulado**. Array `partners` hardcoded (linhas 8-12) com 3 empresas fictícias; botões "Novo Parceiro" e "Ver Detalhes" **sem onClick** — não fazem nada. Nenhuma leitura/escrita no Firestore. `selectedCemeteryId` é lido do contexto e ignorado.

**Fluxos ausentes**: tudo — CRUD, vínculo com a Loja do cidadão (que também é mockada — ver 1.20), contratos/vigência.

## 1.14 Falecidos (`DeceasedList.tsx` 150 linhas, `DeceasedDetail.tsx` 119, `DeceasedForm.tsx` 225)

**Propósito**: registro oficial de óbitos e sepultamentos.

**Realidade**: lista com busca por nome (client-side), dropdown de ações (ver detalhes / excluir), tela de detalhe somente leitura, formulário de criação com react-hook-form + zod e upload de documentos validados.

**Quebrado / Incompleto / Simulado**:
- **Excluir sem confirmação** (`DeceasedList.tsx:132-137`) — item do sumário executivo. Além disso `deleteDeceased` (`deceasedService.ts:150-154`) não libera o jazigo vinculado (plot fica `occupied` com `deceasedId` órfão) nem remove documentos do Storage.
- **Não existe edição de falecido**: `updateDeceased` está implementado no service (`deceasedService.ts:156-170`) e **nunca é chamado por nenhuma tela** (confirmado por busca). Erro de digitação no nome de um falecido = excluir e recriar (perdendo documentos).
- Lista limitada a 50 registros (`getDeceasedList`, `deceasedService.ts:76-85`) **sem paginação e sem aviso**: o 51º falecido cadastrado simplesmente não aparece, e a busca só varre os 50 carregados. Para registro público municipal é falha grave de completude.
- Coluna "Local" mostra `cemeteryId` e `plotId` crus (`DeceasedList.tsx:106-107`), não os nomes.
- `DeceasedDetail` não mostra: epitáfio, hobbies, familiares, causa da morte, velório — campos que o modelo tem; nem link para o jazigo/memorial.
- Dropdown de ações não fecha ao clicar fora (`openMenuId` só alterna no botão).
- `DeceasedForm` cria o registro **sem sincronizar o plot**: informar `plotId` não muda status do jazigo — desincroniza inventário (só o fluxo de alocação faz isso corretamente).
- `causeOfDeath` (dado sensível de saúde) é coletado sem aviso de finalidade — ver seção LGPD.

**Funciona**: criação com validação zod (datas coerentes — refine em `DeceasedForm.tsx:24-27`), upload validado por tipo/tamanho, toasts, projeção pública sincronizada (`syncPublicDeceased` chamada em create/update/delete).

**Fluxos ausentes**: edição (crítico); paginação/busca server-side; certidão de sepultamento em PDF; histórico (translado, exumação); vínculo com memorial público; merge de duplicatas.

## 1.15 Óbitos Comunicados (`src/pages/admin/CommunicatedDeaths.tsx`, 371 linhas)

**Propósito**: fila de solicitações de sepultamento vindas dos cidadãos, com alocação ou rejeição.

**Realidade**: tabela de `death_notifications` do tenant; modal (com `useModal`: Esc + foco + aria) para alocar (selects encadeados cemitério→setor→jazigo disponível) ou rejeitar com motivo. Alocação chama `allocateNotification`, que cria o deceased oficial, ocupa o plot com `burialDate` e `exhumationDeadlineYears`, e atualiza a notificação.

**Quebrado / Incompleto / Simulado**:
- **Não-transacional + sem checagem de disponibilidade** — item 5 do sumário. `allocateNotification` (`notificationService.ts:155-221`) não usa `runTransaction`; não relê `plot.status` antes de ocupar.
- Aviso "Nenhum jazigo disponível neste setor" só aparece se `plots.length === 0` (linha 322) — se o setor tem 200 jazigos todos ocupados, o select fica vazio **sem mensagem** (a condição correta seria sobre o array filtrado por `available`).
- Solicitante exibido como `ID: a1b2c3d4...` (linha 195) — o gestor não vê nome/contato de quem comunicou o óbito, o que inviabiliza contato humano no fluxo mais sensível do sistema.
- Não há estado `reviewing` acionável: o badge existe (linha 136) mas nenhum botão muda para "Em Análise" — o status nasce `submitted` e vai direto para `allocated`/`rejected`.
- A rejeição não notifica o cidadão (ele só descobre entrando no Jardim de Memórias).
- `rejectNotification` e `deleteNotification` não geram `logAction` — lacunas na auditoria de um fluxo crítico.
- Documentos anexados abrem por URL, sem preview nem checklist de conferência (certidão de óbito conferida? declaração médica?).

**Funciona**: fluxo completo de alocação (o melhor código do sistema); selects encadeados com disable; validação de botão por seleção completa; toasts; modal acessível; status badges.

**Fluxos ausentes**: notificar a família (e-mail/WhatsApp) na alocação/rejeição; agendar data/hora do sepultamento (a alocação usa `new Date()` como `burialDate` — linha 167 — mesmo que o sepultamento seja amanhã); solicitar correção de documentos (hoje só rejeita).

## 1.16 Cemitérios (`CemeteryList.tsx` 291 linhas, `CemeteryDetail.tsx` 525 linhas)

**Propósito**: CRUD de cemitérios, setores e túmulos, com georreferenciamento.

**Realidade**: lista em cards com criar/editar (modal com react-hook-form + zod + MapPicker Leaflet) e excluir; detalhe com CRUD de setores (com geração automática de até 3000 plots em grade — `createSector`, `cemeteryService.ts:225-289`) e CRUD de túmulos por setor.

**Quebrado / Incompleto / Simulado**:
- **Exclusão de cemitério sem confirmação** (`CemeteryList.tsx:119-130`) — um clique na lixeira dispara `deleteCemetery` com cascade de plots/setores. Há salvaguardas no service (bloqueia se houver ocupados/reservados ou solicitações pendentes — `cemeteryService.ts:139-160`), mas um cemitério com 3000 plots disponíveis é apagado sem "tem certeza?".
- `CemeteryDetail` usa `window.confirm` e `alert` (linhas 285, 278, 292, 348, 355) — exatamente o padrão que o plano B3 mandava eliminar e que outras telas substituíram por modal; inconsistência de UX e bloqueio do thread.
- `handleDeletePlot` (linhas 354-366): erro cai em `console.error` sem alert/toast — falha silenciosa.
- `deleteSector` não remove os plots do setor (o próprio confirm avisa: "Os jazigos associados nao serao removidos automaticamente") — plots órfãos com `sectorId` inválido permanecem no inventário e nos indicadores.
- Editar setor não regenera/realoca plots (mudar gridRows/capacity não afeta os já criados) — sem aviso disso na UI.
- A tela de detalhe não mostra o **nome** do cemitério (título fixo "Estrutura do cemiterio") — `getCemetery` existe e não é chamado aqui.
- Badge "Ativo" nos cards é hardcoded (`CemeteryList.tsx:185`) — não existe campo de status de cemitério.
- `occupancyBySector` compara ocupação com plots **gerados**, e o texto mostra "Cap: X | Gerados: Y" sem alertar divergência.
- PlotModal permite marcar `occupied` com `occupantName` texto livre sem criar registro de falecido — terceiro caminho de dado inconsistente.

**Funciona**: criação/edição de cemitério com mapa clicável (Leaflet real!), tipos, admin responsável (lookup em `profiles`); geração em lote de plots com prefixo, grade e coordenadas derivadas; barra de ocupação por setor; refresh do dropdown global após criar/excluir (`refreshCemeteries`).

**Fluxos ausentes**: confirmação de exclusão; visualização dos plots gerados no mapa nesta tela; importar planta baixa/shapefile; numeração customizada.

## 1.17 Configurações e Solicitações

Ambas são `ComingSoon` (`App.tsx:133-134`) e **não aparecem na sidebar** (`AdminLayout.tsx:100-118` não tem links para elas) — só acessíveis por URL direta. "Central de Solicitações" é prevista na visão (J5, `docs/VISION.md:64-69`) e é dependência do fluxo de manutenção pelo cidadão; "Configurações" deveria abrigar preços, usuários do tenant e parâmetros (prazo de exumação por cemitério — hoje fixo em 3 anos, `notificationService.ts:196`).

## 1.18 Área pública (Landing, Busca, Memorial, Serviços)

- **LandingPage** (`LandingPage.tsx`, 141 linhas): estática, funcional, sem dados. OK como marketing.
- **SearchPage** (`SearchPage.tsx`, 157 linhas): busca em `public_deceaseds` — **baixa 200 documentos e filtra por `includes` no cliente** (linhas 32-38). Sem índice por nome, sem paginação, sem filtro por cemitério/data (a visão pedia "busca avançada"). Com mais de 200 falecidos públicos, resultados passam a faltar de forma imprevisível. Resultado não linka para nada (sem página de memorial).
- **Memorial `/memorial/:id`**: `Placeholder` "Em desenvolvimento..." (`App.tsx:94, 47-52`) — a promessa central do produto para famílias não existe.
- **Serviços `/servicos`**: `Placeholder` (linha 95).
- **HomePage.tsx** (133 linhas): página rica com hero, features e "Sepultamentos Recentes" — mas os obituários são mock com fotos do picsum (linhas 104-127) e **o componente não está roteado** (não é importado em `App.tsx`): código morto integral.
- **Footer** (`PublicLayout.tsx:53-71`) linka `/planos`, `/ajuda`, `/contato`, `/privacidade`, `/termos` — nenhuma dessas rotas existe; o wildcard (`App.tsx:145`) redireciona tudo para a home. **Ausência de Política de Privacidade e Termos num sistema que se declara LGPD-compliant é lacuna legal**, não só de UX.

## 1.19 Área do cidadão (Início, Comunicar Óbito, Jardim, Assistente, Loja, Perfil)

- **UserHomePage** (156 linhas): carrossel de 3 slides (imagens Unsplash hotlinked), atalhos e "Como funciona". Funcional, estático. O carrossel troca a cada 5s sem pausa em hover e sem `prefers-reduced-motion`.
- **ReportDeath** (485 linhas): wizard de 4 passos que funciona de ponta a ponta (dados → obituário com IA → epitáfio → revisão → `createDeathNotification`). Problemas: usa `alert()` 4 vezes (linhas 135, 144, 150, 170, 174) em vez de toast; **sem estado isSubmitting** — duplo clique em "Comunicar obito" cria duas notificações; `URL.createObjectURL(photoFile)` é chamado a cada render (linhas 197 e 441) sem revoke — vazamento de memória (o fix B1 foi aplicado só em `AdminReportDeath`); **documentos e foto não passam por `validateFile`** — o cidadão pode subir um .exe de 500MB (o Storage aceita, pois as rules não limitam tipo/tamanho); `getAllCemeteries()` (linha 104) baixa todos os cemitérios de todos os tenants sem limite.
- **GardenOfMemories** (396 linhas): lista as notificações do usuário com status, modal de detalhe bonito, exclusão com modal de confirmação (padrão correto!). Problemas: `canDeleteNotification` (linha 84) checa roles `['superadmin','manager','operator']` — **não inclui `gestor`/`operador`** (as variantes PT aceitas em rules e rotas); exclui via `deleteDoc` direto (linha 102) em vez do service, sem remover arquivos do Storage; os 3 cards de CTA idênticos (linhas 130-148) são redundantes.
- **VirtualAssistant** (161 linhas): chat com `chatWithAI` + contexto emocional da última notificação. Funciona. Detalhes: as bolinhas de "digitando" usam `delay-75/delay-150` que são utilitários de *transition-delay*, não animation-delay — as três pulam em sincronia; histórico não persiste.
- **ShopAndServices** (344 linhas): **e-commerce inteiramente simulado** — catálogo hardcoded (linhas 21-88), carrinho funcional em memória, "checkout" com inputs soltos (sem state, sem validação) e `finishCheckout` que dá `alert('Pedido registrado...')` e esvazia o carrinho (linhas 160-165). Nenhum pedido é persistido; nenhum pagamento existe. Risco de expectativa: o usuário acredita ter comprado uma coroa de flores para um funeral.
- **ProfilePage** (217 linhas): carrega/salva `user_profiles` + foto. Usa `alert()` (linhas 77, 80); `URL.createObjectURL` sem revoke (linha 61); sem `validateFile` na foto; salva sem validação de telefone/UF.

## 1.20 SuperAdmin (`SuperAdminPage.tsx` 660 linhas, `MonitoringDashboard.tsx` 549 linhas)

- **SuperAdminPage**: CRUD real de prefeituras (tenants) e logins via Cloud Functions (`createManagerAccount`, `addUserToTenant`, `toggleManagerStatus`, `disableTenantUser`, `deleteManagerAccount`, `deleteTenantUser` — todas com verificação `role === 'superadmin'` no backend, `functions/src/index.ts`). Usa `window.confirm` para as exclusões (linhas 172-177, 243) — pelo menos há confirmação aqui, mas destoa do padrão de modal. **`deleteManagerAccount` apaga Auth users + profiles + tenant, mas NÃO apaga os dados do tenant** (cemeteries, plots, deceaseds, sci_*, notificações ficam órfãos no banco para sempre — e o texto do confirm promete "Todos os logins e dados do tenant serão removidos"). Erros de toggle/delete caem em `console.error` sem feedback (linhas 164-166, 183-185, 236-239, 248-251).
- **MonitoringDashboard**: UI completa e bem construída (tabs, gráficos, health score) sobre `getMonitoringData` — mas alimentada pelo backend de monitoramento que consulta campos/coleções inexistentes (item 4 do sumário). Exibe métricas fictícias com aparência de precisão ("Chamadas Gemini hoje", "Visitas hoje") — nenhuma delas tem fonte de dados real. Erro de fetch cai em console sem UI de erro além do estado vazio inicial.

## 1.21 Autenticação (Login, Cadastro, Acesso negado)

- **LoginPage** (195 linhas): login com mapeamento de erros por código, reset de senha inline, redirecionamento por role. Funciona. Notas: o fluxo de reset revela se um e-mail existe ("E-mail nao encontrado", linha 40) — enumeração de usuários; o redirect por role (linhas 47-57) trata `gestor/manager/operador` mas se o claim for `operator` (inglês, como `functions/index.js` antigo criaria) cai na área do cidadão.
- **RegisterPage** (143 linhas): cria conta + displayName. Sem: verificação de e-mail, aceite de termos/LGPD, força de senha além de 6 chars.
- **UnauthorizedPage**: correta, mostra o role atual; o botão "Voltar ao início" leva para `/app/inicio` mesmo se o usuário for staff.

## 1.22 Cloud Functions e infraestrutura

- **`functions/src/index.ts`** (deployável, `main: lib/index.js` compilado deste): gestão de tenants (ok), IA via OpenRouter com retry/backoff (ok, bem feito), 4 schedulers de monitoramento + trigger manual + callable do dashboard.
- **`functions/index.js`** (raiz de functions, 113 linhas): **arquivo morto** — não é o `main` do package. Contém `setUserRole`, `onDeceasedCreated` (criaria memorial automático!), `generateContent` (Gemini) e `moderateTribute`. O `README.md:50` ainda instrui usar `setUserRole` e o `generateContent` — documentação apontando para código que nunca é deployado. Consequência de produto: **memorials nunca são criados** e **não há como promover operadores** (toda criação de usuário via `addUserToTenant` força `role: 'manager'` — `functions/src/index.ts:114-117` — o papel "operador" é inatingível na prática).
- **`manualMonitorTrigger`** (`functions/src/index.ts:567-616`): se `MONITOR_TRIGGER_TOKEN` não estiver definido, `if (token && ...)` **pula a autenticação** — endpoint HTTP aberto que executa varreduras e pode disparar WhatsApp. Fail-open.
- **Índices**: `firestore.indexes.json` cobre as 3 queries compostas do frontend; as queries do monitor (`status+createdAt` em requests/death_notifications, `action+createdAt` em audit_logs, `role+lastLoginAt` em profiles) **não têm índices** — falhariam mesmo se os campos existissem (os `catch` engolem e retornam 0).
- **Scripts**: `set-superadmin.cjs` hardcoda `admin@memorial.com` (o e-mail do antigo backdoor!), enquanto `superadmin-claim.json` (commitado com UID real — resíduo que o próprio script manda apagar) usa `superadmin@memorial.com` — inconsistência entre os dois.

---

# 2. UI/UX — ANÁLISE COMPLETA

## 2.1 Consistência visual global

**O que é consistente (pontos positivos)**:
- Paleta base coerente: admin em `slate` escuro (sidebar `slate-900`) + `blue-600` de ação; área do cidadão em `blue`/serif (alinhada ao princípio "serenidade" do `docs/VISION.md:9`); estados semânticos com emerald/amber/rose.
- Cartões `bg-white rounded-xl border border-slate-200 shadow-sm` aparecem de forma razoavelmente uniforme (há até a constante `cardClass` em `AdminDashboard.tsx:12` — mas só nessa página).
- Toaster global com estilos de sucesso/erro (`App.tsx:157-164`).

**Inconsistências concretas**:
1. **Raio de borda**: `rounded-lg`, `rounded-xl`, `rounded-2xl` e `rounded-3xl` convivem sem critério — modais admin usam `rounded-xl` (`InventoryPage.tsx:461`), `rounded-2xl` (`AdminDashboard.tsx:378`, `CommunicatedDeaths.tsx:237`) e a área do usuário `rounded-3xl` (`ReportDeath.tsx:189`, `VirtualAssistant.tsx:96`).
2. **Botão primário**: ora `bg-blue-600` (maioria SCI), ora `bg-slate-900` (`CemeteryList.tsx:146`, `DeceasedList.tsx:56`, `DeceasedForm.tsx:218`, `AdminDashboard.tsx:363`, botão "Jazigo" em `InventoryPage.tsx:294`), ora `bg-indigo-600` (`CemeteryDetail.tsx:443`, chat de `AgentsPage.tsx:242`), ora `bg-green-600` para submits finais (`AdminReportDeath.tsx:379`, `ReportDeath.tsx:476`). Quatro cores de primário no mesmo painel.
3. **Tabelas**: três implementações distintas — o padrão SCI manual (`px-4 py-3`, `min-w-[700px]`), o padrão Falecidos (`px-6 py-4`), e o componente `SCITable.tsx` criado para unificar e **usado em zero páginas**.
4. **Inputs**: paddings `p-2`, `p-2.5`, `px-3 py-2`, `px-4 py-2`, `px-4 py-3` conforme a página; borda `border` sem cor em `CemeteryList.tsx:229` e nos inputs de `CemeteryDetail` (borda cinza default do browser) vs `border-slate-300` no resto.
5. **Fontes**: `font-serif` marca a área pública/cidadão, mas não há fonte custom carregada; serif = fallback do sistema, varia por OS. Nenhuma identidade tipográfica formal.
6. **Ícones de logo**: `PublicLayout.tsx:15` desenha um círculo "M" manual, `UserLayout` usa `AppLogo` (imagem `/logo-flower.png` que **não existe no repositório** — não há pasta `public/` versionada, então o `onError` sempre cai no fallback "M"), `AdminLayout` usa só texto. Três marcas diferentes.

## 2.2 Idioma, acentuação e capitalização

Este é o problema de polimento mais visível do sistema:
- **Textos sem acento em massa**: "Gestao operacional completa" (`OperationalPage.tsx:267`), "Inventario georreferenciado" (`InventoryPage.tsx:231`), "Manutencao", "Seguranca e acesso", "Relatorios automaticos", "Digitalizacao documental", toda a sidebar admin (`AdminLayout.tsx:100-117`: "Inventario / Mapa", "Manutencao", "Seguranca", "Sanitario / Ambiental", "Cemiterios", "Obitos Comunicados"), LandingPage inteira, UserHomePage, ReportDeath. Em contraste, `CommunicatedDeaths` ("Comunicações de Óbito"), `SuperAdminPage`, `GardenOfMemories` (parcial) e os toasts usam acentuação correta. O resultado é um produto que parece escrito por dois times.
- **Valores de domínio crus em inglês na UI**: selects de status `open/monitoring/closed` (`EnvironmentalPage.tsx:251-253, 319-323`), `pending/validated/rejected` (`DocumentsCenterPage.tsx:186-188`), `open/in_progress/done` (`SupportPage.tsx:198-200`), `planned/completed` (`SupportPage.tsx:250-251`); colunas exibindo `item.priority` ("medium"), `item.audience` ("operators"), `item.level` ("warning"), `item.category` ("structural") sem tradução — enquanto `statusLabels.ts` existe e cobre só 3 dos ~8 conjuntos de estados.
- **Mistura EN/PT em código de domínio**: roles duplicados (`gestor|manager`, `operador|operator`) atravessam rules, rotas e UI — ver seção 5.7.

## 2.3 Hierarquia de informação

- **Dashboard**: a primeira dobra prioriza ocupação/disponibilidade/saturação/ocorrências — correto para o gestor. Porém o dado mais acionável do dia (óbitos comunicados aguardando análise) **não aparece no dashboard**: o gestor precisa lembrar de abrir "Obitos Comunicados". Deveria ser o primeiro card, com contagem de pendentes.
- **Sidebar admin com 16 itens planos** (`AdminLayout.tsx:100-118`): a separação visual (border-t antes de Falecidos) sugere agrupamento, mas mistura eixos — "Operacional" e "Manutencao" duplicam entradas do mesmo dado; "Novo Obito (Admin)" é uma *ação* no meio de *módulos*; "Solicitações" e "Configurações" existem como rota e não estão no menu. Sugerido: grupos "Visão Geral", "Operação" (Operacional, Óbitos Comunicados, Falecidos), "Estrutura" (Cemitérios, Inventário), "Conformidade" (Ambiental, Documentos, Segurança), "Gestão" (Financeiro, Relatórios, Parceiros, Suporte), "Sistema" (Agentes, Configurações).
- **Formulários acima das tabelas**: em todas as páginas SCI o form de criação ocupa a primeira dobra e a lista fica abaixo — para telas de consulta frequente e criação eventual, o padrão inverso (botão "+ Novo" abrindo modal, como Inventário faz) daria mais espaço ao dado. Hoje há os dois padrões misturados sem critério: Operacional/Financeiro/Manutenção com form inline; Inventário/Cemitérios com modal.

## 2.4 Feedback ao usuário (loading / sucesso / erro / vazio)

Mapa por página (L=loading visível, S=toast sucesso, E=toast erro, V=empty state):

| Página | L | S | E | V | Observações |
|---|---|---|---|---|---|
| AdminDashboard | sim (skeleton) | sim (checklist) | parcial | n/a | erro de load vai só para o console (linha 72) |
| OperationalPage | fraco | sim | sim | sim | sem indicador visual durante fetch; tabelas ficam vazias |
| InventoryPage | fraco | sim | sim | sim | "Processando dados..." minúsculo no rodapé (linhas 691-695) |
| FinancialPage | NÃO | sim | sim | sim | **não existe state de loading**; empty state aparece durante o fetch |
| MaintenancePage | sim | sim | sim | sim | ok |
| EnvironmentalPage | fraco | sim | sim | sim | idem Operational |
| DocumentsCenterPage | NÃO | sim | sim | sim | sem loading; erro de load só console (linha 36) |
| SupportPage | NÃO | sim | sim | sim | idem |
| SecurityPage | NÃO | NÃO | NÃO | sim | **zero toasts**; falha silenciosa (ver 1.9) |
| AgentsPage | só chat | NÃO (create/toggle) | parcial | sim | criação de agente sem feedback |
| ReportsPage | NÃO | NÃO | NÃO | sim | gerar relatório sem confirmação visual além do item novo na lista |
| DeceasedList | sim (texto) | sim (delete) | sim | sim | erro de load vai para console (linha 22) |
| DeceasedForm | sim (submit) | sim | sim | n/a | ok |
| CommunicatedDeaths | sim | sim | sim | sim | referência de qualidade |
| CemeteryList | NÃO | sim | sim | NÃO | sem loading nem empty state (lista vazia = página em branco com header) |
| CemeteryDetail | parcial (plots) | NÃO (alert) | alert/console | sim | usa alert(); delete de plot silencioso |
| SuperAdminPage | sim | parcial | parcial | sim | toggle/delete sem feedback de erro |
| MonitoringDashboard | sim | n/a | parcial | sim | erro vira estado "nenhuma métrica" |
| ReportDeath (user) | NÃO (submit) | NÃO (alert) | NÃO (alert) | n/a | duplo-submit possível |
| GardenOfMemories | sim (skeleton) | sim | sim | sim | bom |
| VirtualAssistant | sim (typing) | n/a | msg no chat | n/a | ok |
| ShopAndServices | n/a | NÃO (alert) | n/a | sim (carrinho) | checkout fake |
| ProfilePage | sim | NÃO (alert) | NÃO (alert) | n/a | alerts |
| SearchPage | sim | n/a | enganoso | sim | erro de busca vira "nenhum resultado" (`SearchPage.tsx:39-41`) |
| LoginPage | sim | inline | inline | n/a | referência |

Conclusões: (a) `alert()`/`window.confirm` sobrevivem em 6 arquivos (`ReportDeath`, `ProfilePage`, `ShopAndServices`, `AdminReportDeath`, `CemeteryDetail`, `SuperAdminPage`) apesar do plano B3; (b) três páginas SCI não têm loading; (c) SecurityPage e ReportsPage são mudas; (d) SearchPage converte erro em "nenhum resultado", o que é feedback enganoso.

## 2.5 Formulários — campos, validação e submit

- **Dois regimes de validação**: react-hook-form+zod nos fluxos de Falecidos/Auth/Cemitérios (com mensagens por campo) vs estado manual + `required` HTML nas 9 páginas SCI (sem mensagens — o browser mostra tooltip nativo no idioma do SO). O regime manual ainda tem guards que retornam silenciosamente quando campos obrigatórios sem `required` estão vazios (ex.: `AdminDashboard.tsx:101-103`; `OperationalPage.tsx:136` só valida `title`).
- **Validações ausentes**: valores financeiros negativos (`FinancialPage.tsx:123` aceita -100, virando "receita negativa"); lat/lng fora de faixa (`InventoryPage.tsx:524-528`); UF com 2 letras (todos os campos `state`); telefone (`ProfilePage.tsx:143`); quantidades negativas no estoque; datas de concessão (fim < início não é bloqueado, `InventoryPage.tsx:557-564`); `dateOfDeath` no futuro é aceito em todos os formulários de óbito (o zod só compara com nascimento).
- **Submit**: `isSubmitting`/`saving` com disable está presente na maioria, mas falta em `ReportDeath.handleFinalSubmit` (duplo comunicado possível) e `AdminReportDeath.handleFinalSubmit` (duplo registro oficial de falecido!).
- **Grids de formulário SCI desalinhados**: os forms `md:grid-cols-6/7` colocam o botão de submit no meio do grid (ex.: `DocumentsCenterPage.tsx:123` — o botão fica entre selects e os date inputs quebram para a linha seguinte); em `OperationalPage.tsx:310-328` o textarea obrigatório da mensagem vem *depois* do botão "Publicar" na ordem visual — sequência de tabulação e leitura confusas.
- **Labels**: as páginas SCI usam `placeholder` como label (some ao digitar); apenas alguns campos têm `<label>` real. O plano M6 ("sweep de label") está registrado como PARCIAL no próprio `IMPLEMENTACAO_STATUS.md:44` — confirmado na leitura.

## 2.6 Navegação e rotas

- Rotas duplicadas de conceito: `/admin/comunicar-obito` (wizard admin) vs `/admin/falecidos/novo` (form direto) criam falecidos por caminhos com campos e validações diferentes (um exige cidade/estado/velório, o outro não) — o gestor não tem como saber qual usar.
- `/minha-conta` redireciona para `/app/inicio` (`App.tsx:96`) — ok, herança da visão.
- Wildcard `*` redireciona para `/` e engole 404s reais e os links quebrados do footer, sem página de erro.
- Breadcrumbs inexistentes; só Falecidos/Cemitérios têm "Voltar".
- O seletor global de unidade (header admin) não persiste (state em memória — `AdminContext.tsx:17`); F5 volta para "Todas as unidades". Deveria ir para localStorage/URL.
- Deep-link em GitHub Pages depende do hack `404.html` (cópia do index — `deploy-pages.yml:49-50`); funciona, mas cada deep link responde HTTP 404 real antes do app carregar (SEO/preview ruins).

## 2.7 Mobile / responsividade

- Layouts têm menu mobile com overlay (Admin e User) — bom. Porém:
  - Menu mobile sem trap de foco e sem fechar por Esc (só overlay-click); overlay do `UserLayout` é `div` sem role/tabindex (não focável por teclado), `AdminLayout` usa `<button>` (melhor).
  - Tabelas usam `overflow-x-auto` + `min-w-[700-860px]` — utilizável mas penoso; nenhuma visão em card para mobile.
  - Os forms `md:grid-cols-6` empilham razoavelmente, mas o form de ~18 campos do Inventário em modal `max-w-3xl` num telefone exige scroll longo sem seções recolhíveis.
  - `OperationalPage` com 9 abas roláveis horizontalmente sem indicador de overflow (usuário pode não perceber que há mais abas).
  - `VirtualAssistant` usa `h-[calc(100svh-8rem)]` — cuidado com viewport mobile, positivo.
  - Gráficos Recharts com `ResponsiveContainer` — ok.
  - `SecurityPage`: o painel de câmera fake `aspect-video` empurra os incidentes reais para baixo da dobra no mobile.

## 2.8 Acessibilidade

- **Modais**: apenas `CommunicatedDeaths` (via `useModal`: Esc, foco inicial, `role="dialog"`, `aria-modal`, `aria-labelledby`) e os modais de confirmação de `AgentsPage`/`GardenOfMemories` (`role="dialog"` sem foco/Esc) têm semântica. Os modais de `InventoryPage` (2), `AdminDashboard`, `CemeteryList`, `CemeteryDetail` (2) e `ShopAndServices` (2) não têm role, não fecham com Esc, não devolvem o foco. `useModal.ts` existe e foi aplicado a 1 de ~10 modais.
- **Selects sem label acessível**: o seletor de unidade no header (`AdminLayout.tsx:60-71`) não tem `aria-label`; todos os selects de status inline nas tabelas idem.
- **Botões ícone**: `DeceasedList` tem `aria-label` no kebab (linha 121), mas os lápis/lixeiras de `CemeteryList`/`CemeteryDetail` só têm `title`; os pontos do mapa do Inventário (linhas 343-349) só têm `title`.
- **Contraste**: `text-slate-400` sobre branco (~2.9:1) usado extensivamente para metadados — abaixo de AA para texto pequeno; `text-slate-500` (~4.4:1) no limite; placeholder como única label agrava.
- **Teclado**: dropdown de ações de `DeceasedList` não fecha com Esc nem clique-fora; carrossel de `UserHomePage` troca automática sem pausa e sem `prefers-reduced-motion`.
- **Imagens**: `<img>` sem `alt` em `CommunicatedDeaths.tsx:180, 252` e `ReportDeath.tsx:197, 441`; `alt="Foto"` genérico em `HomePage`.
- **Idioma**: `index.html` com `lang="pt-BR"` — ok.
- Para o público-alvo declarado (idosos em luto — `docs/VISION.md:12` exige "fontes grandes, alto contraste"), a área do cidadão usa `text-sm`/`text-xs` em abundância e contraste slate-400/500 — **diretamente contrário ao princípio declarado do produto**.

## 2.9 Comparação de padrões entre telas similares

- **Modal vs inline**: Inventário/Cemitérios criam via modal; Financeiro/Operacional/Manutenção/Ambiental/Documentos/Suporte via form inline. Nenhuma razão funcional — unificar (recomendado: modal/drawer para criação, mantendo a tabela em foco).
- **Confirmação de exclusão**: modal próprio (GardenOfMemories, AgentsPage) vs `window.confirm` (CemeteryDetail, SuperAdminPage) vs **nada** (CemeteryList, DeceasedList). Três padrões, sendo um deles fatal.
- **Mudança de status**: select inline nas tabelas SCI vs botões contextuais no kanban de Manutenção e nos incidentes de Segurança. O select inline dispara escrita a cada mudança sem confirmação — fácil de errar com scroll acidental sobre o select aberto.
- **Wizard**: `ReportDeath` (4 passos, azul) e `AdminReportDeath` (5 passos, slate) são o mesmo fluxo com componentes `StepIndicator` duplicados quase byte a byte (`ReportDeath.tsx:65-82` vs `AdminReportDeath.tsx:39-56`), diferindo só nas cores.
- **Skeleton vs spinner vs texto**: `StatCardSkeleton` (dashboard), `LoadingSpinner` (nunca visível — só dentro do `SCITable` não usado), "Carregando..." texto (Falecidos, perfil, detalhes). Padronizar.

## 2.10 Sugestões concretas de UX (com justificativa)

1. **Componente `<ConfirmDialog>` universal** aplicado a toda exclusão — elimina a perda irreversível a um clique (achado crítico nº 1) e os `window.confirm` restantes. Esforço pequeno, impacto crítico.
2. **Card "Óbitos aguardando análise" no topo do dashboard**, com contagem e link — é a tarefa diária nº 1 do gestor e hoje está a dois cliques sem nenhum indicador. A fonte já existe (`getTenantNotifications` filtrada por `submitted`).
3. **Traduzir todos os valores de domínio** estendendo `statusLabels.ts` (priority, audience, level, category, riskLevel, documentType, status de docs/suporte/treinos/checks) e aplicando em selects e células.
4. **Varredura de acentuação**: são ~80 strings; custo trivial, ganho de credibilidade desproporcional para venda a prefeituras.
5. **Nome do cemitério em vez de ID** no header do dashboard, colunas "Local" de Falecidos, texto dos relatórios e título do `CemeteryDetail`. Os dados já estão no `AdminContext`.
6. **Substituir o pseudo-mapa do Inventário por Leaflet** (já é dependência e há exemplo funcional em `MapPicker.tsx`) com `CircleMarker` por jazigo — vira mapa real com zoom/pan e tiles OSM, sem nova lib.
7. **Persistir `selectedCemeteryId` em localStorage** e mostrar o nome da unidade ativa em todas as páginas — evita criar registro na unidade errada.
8. **Empty states com ação**: "Nenhum jazigo — criar setor com geração automática" linkando para a tela certa; hoje os vazios são becos sem saída textuais.
9. **Formatar todas as datas com `formatDate`** (`formatters.ts` já existe) — hoje há ISO cru em ao menos 8 tabelas.
10. **Tela de detalhe da notificação de óbito para o gestor** com dados do solicitante (nome/telefone vindos de `user_profiles`), checklist de documentos e ações — o modal atual esconde o contexto humano do fluxo mais delicado do sistema.

---

# 3. ARQUITETURA E CÓDIGO

## 3.1 Padrões usados vs padrões que deveriam ser usados

**Usados**:
- Camada de services (`src/services/*`) isolando Firestore/Storage das páginas — boa decisão, seguida com disciplina razoável (exceções: `GardenOfMemories.tsx:102` chama `deleteDoc` direto; `SearchPage.tsx:32` e `SuperAdminPage.tsx:96-131` fazem query direto na página).
- Contextos para auth (`AuthContext`) e escopo admin (`AdminContext` com seletor de unidade) — adequados ao tamanho do app.
- Custom claims (role/tenantId) como fonte de verdade de autorização, espelhados nas rules — arquitetura multi-tenant correta em princípio.
- Genéricos no service SCI (`listByTenant<T>`, `createForTenant<T>` — `sciService.ts:221-253`) reduzindo boilerplate de 12 coleções.
- Cache TTL simples (`queryCache.ts`) com invalidação por prefixo — proporcional à necessidade.

**Que deveriam ser usados e não são**:
- **Camada de data-fetching com estado** (TanStack Query ou ao menos um hook `useTenantCollection`): cada página reimplementa `loading/saving/records + loadData + useEffect` (~15 vezes). Com React Query, cache, refetch e invalidação sairiam de graça e o `queryCache.ts` manual morreria.
- **Transações Firestore** para operações multi-documento (`allocateNotification`, `deleteCemetery`) — hoje são sequências não-atômicas.
- **Máquina de estados explícita para death_notifications** (submitted → reviewing → allocated/rejected): as transições estão espalhadas e `reviewing` é inalcançável.
- **Roteamento de formulários por schema**: o par react-hook-form+zod já está no projeto e deveria ser o único regime (ver 2.5).
- **Design tokens/UI kit mínimo**: `Button`, `Input`, `Select`, `Modal`, `StatusBadge` — a ausência explica as inconsistências da seção 2.1.

## 3.2 Duplicação de código (blocos exatos)

1. **Handler de criação SCI** — o bloco `if (!tenantId || !X) return; if (selectedCemeteryId === 'all') { toast.error('Selecione um cemitério específico...'); return; } setSaving(true); try { await createY(...); toast.success(...); setForm(inicial); await loadData(); } catch (error) { const msg = error?.code === 'permission-denied' ? 'Sem permissão para esta operação.' : error?.message || 'Erro ao salvar. Tente novamente.'; toast.error(msg); } finally { setSaving(false); }` aparece, com variações mínimas, em: `OperationalPage.tsx:134-173, 175-203, 205-247`; `MaintenancePage.tsx:81-119, 134-162`; `EnvironmentalPage.tsx:80-111, 113-144`; `DocumentsCenterPage.tsx:44-87`; `SupportPage.tsx:66-94, 96-131`; `FinancialPage.tsx:57-93`. **11 cópias** do mesmo esqueleto.
2. **Mapeamento de `permission-denied`** — o ternário de mensagem se repete nesses 11 pontos + `CemeteryList.tsx:112-114` + `DeceasedForm.tsx:91-93`. Deveria ser `getFirestoreErrorMessage(error)` num util.
3. **`scopedX = useMemo(filter por selectedCemeteryId)`** — repetido em `OperationalPage.tsx:108-132` (3×), `MaintenancePage.tsx:42-58` (2×), `EnvironmentalPage.tsx:47-55` (2×), `DocumentsCenterPage.tsx:25-28`, `SupportPage.tsx:39-46` (2×), `SecurityPage.tsx:28-35`, `FinancialPage.tsx:34-37`, `ReportsPage.tsx:24-32` — **13 cópias**, enquanto `src/hooks/useCemeteryFilter.ts` implementa exatamente isso e **não é importado por ninguém**.
4. **`StepIndicator`** duplicado em `ReportDeath.tsx:65-82` e `AdminReportDeath.tsx:39-56`.
5. **Formulário de checklist sanitário** duplicado entre `AdminDashboard.tsx:376-467` (modal) e `EnvironmentalPage.tsx:200-221` (inline) — mesmos 6 campos, mesmos defaults, dois handlers.
6. **Formulários sanitário vs ambiental** dentro de `EnvironmentalPage` — duas cópias de ~70 linhas que diferem em 1 função e 2 strings.
7. **Upload de arquivos para Storage** — o laço `for (file of files) { ref(storage, 'documents/...'); uploadBytes; getDownloadURL; push }` existe em `deceasedService.ts:113-127` e `notificationService.ts:72-87` (idênticos), + variações em `sciService.uploadSCIDocument` e `userProfileService.uploadUserProfilePhoto`.
8. **Cálculo de prazo de exumação** — duplicado entre `getSciExecutiveSnapshot` (`sciService.ts:539-556`) e `getExhumationAlerts` (`sciService.ts:696-722`), com a mesma constante `SIX_MONTHS_MS` declarada duas vezes (linhas 541 e 697).
9. **Tabela de status badge risco (rose/amber/emerald)** — o ternário de classes por `riskLevel` repetido 4× (`EnvironmentalPage` 2×, `InventoryPage.tsx:653-661` 3 variantes).
10. **`toMillis`/ordenar por createdAt** — `sciService.ts:210-219` e reimplementado inline em `cemeteryService.listPlotConcessions:379-383` e `deceasedService.getUserDeceasedList:97-101`.

## 3.3 Componentes que deveriam ser extraídos

- `<ConfirmDialog>` (ver 2.10.1).
- `<CrudSection>` ou ao menos `<SciForm>` + uso efetivo do `SCITable` já escrito: colunas tipadas, loading e empty embutidos — eliminaria ~600 linhas de JSX de tabela repetido.
- `<StatusSelect collection= id= value= options= />` encapsulando o padrão select-inline + `updateSCIRecord` + toast.
- `<StatusBadge domain="occurrence|plot|notification" value= />` unificando os ternários de cor.
- `<PageHeader title= subtitle= actions= />` — todos os cabeçalhos de página são o mesmo bloco.
- `<FileUploadField>` com `validateFile` embutido — hoje a validação existe em 2 de 5 pontos de upload.
- `StepIndicator` compartilhado para os dois wizards.

## 3.4 Hooks que deveriam existir

- `useTenantCollection(collection, options)` — encapsula tenantId + loading + erro + refetch; substitui os 15 `loadData`.
- `useSciSnapshot()` — 6 páginas chamam `getSciExecutiveSnapshot` por conta própria; um hook único com o cache atual evitaria pedidos concorrentes na navegação.
- `useConfirm()` — promessa que abre o ConfirmDialog.
- **Usar** os que já existem: `useCemeteryFilter` (0 usos) e `useModal` (1 uso em ~10 modais).

## 3.5 Abstrações excessivas ou desnecessárias

Poucas — o problema do projeto é falta, não excesso. Casos pontuais:
- `SanitaryCheck`/`EnvironmentalCheck` como aliases de `EnvironmentalSanitaryCheck` com `checkType` (`sciService.ts:76-98`) mas persistidos em **duas coleções separadas** com regras idênticas — a unificação parou no meio; ou uma coleção com campo `checkType`, ou dois tipos simples.
- `AppLogo` com lógica de fallback para uma imagem que não existe no repo — a abstração esconde um asset faltante.
- `functions/index.js` inteiro: abstração de um backend v1 que nunca é deployado.

## 3.6 Dependências

- **Não usadas** (confirmado por busca de imports em `src/`): `uuid`, `motion`, `react-leaflet` (o MapPicker usa `leaflet` puro), `qrcode.react` (só no componente morto `QRCodeGenerator`). Remover.
- **No lugar errado**: `firebase-admin` está em `dependencies` do **frontend** (`package.json:20`) — é usada apenas por `scripts/`; deve ir para devDependencies ou para um package próprio de scripts. `vite` e `@vitejs/plugin-react` estão em `dependencies` (deveriam ser dev). `@tailwindcss/vite`/`tailwindcss` duplicados entre deps e devDeps.
- **Ausentes**: `@types/react`/`@types/react-dom` — a raiz do "não dá pra ligar strict" registrado em `IMPLEMENTACAO_STATUS.md:55`; `eslint`+`prettier`; qualquer lib de teste.
- `package.json` ainda se chama `"react-example"` versão `0.0.0` — resíduo de template.
- `functions/package.json` declara `@google/genai` que **não é mais usado** pelo entrypoint TS (OpenRouter via fetch) — só o `index.js` morto o referencia.

## 3.7 Estrutura de pastas

**Bem organizado**: `pages/` por área (admin/user/public/auth/superadmin), `services/`, `contexts/`, `lib/`, `hooks/`, `components/ui` vs `components/admin`. `functions/src/monitoring` coeso.

**Misturado/problemático**:
- `functions/` tem **dois backends**: `index.js` (v1, morto) na raiz e `src/index.ts` (v2, real) — além de `lib/` (build output) **commitado no git** com sourcemaps (`functions/lib/*.js.map`), que deveria estar no .gitignore.
- `components/` guarda componentes órfãos (`QRCodeGenerator`) e o `SCITable` não adotado — sinal de PRs de refactor que pararam no meio.
- `PLANO_CORRECOES_MEMORIAL.md` (2.640 linhas) e `IMPLEMENTACAO_STATUS.md` na raiz — úteis, mas o status contém afirmações já divergentes do código (confirmação de modais que não existem); mover para `docs/` e revisar.
- `scripts/superadmin-claim.json` com UID/e-mail reais commitados — deveria ter sido apagado conforme instrução do próprio script.
- Não há pasta `public/` — o `logo-flower.png` referenciado por `AppLogo` não existe.

## 3.8 TypeScript — qualidade dos tipos

- `tsconfig.json` **sem `strict`**, sem `noImplicitAny`, sem `strictNullChecks` — com `skipLibCheck`. O "lint" do projeto é só `tsc --noEmit` (`package.json:11`).
- **`any` disseminado**: estados de lista tipados como `any[]` em `OperationalPage.tsx:49-51`, `MaintenancePage.tsx:22-23`, `EnvironmentalPage.tsx:25-26`, `DocumentsCenterPage.tsx:12`, `SupportPage.tsx:20-21`, `SecurityPage.tsx:19`, `AgentsPage.tsx:11`, `ReportsPage.tsx:19`, `InventoryPage.tsx:36` (`snapshot: any`) — mesmo com as interfaces prontas no service (`OperationalRecord`, `StockItem`, `DigitalDocument`...). `formData: any` nos dois wizards; `icon: any` em `SidebarLink` (`AdminLayout.tsx:33`); `createdAt?: any` em todas as interfaces (deveria ser `Timestamp`).
- **Casts `as any`** para driblar selects: `riskLevel: e.target.value as any` etc. em ~20 pontos — resolvível com union types nos handlers.
- Interfaces vs types: consistente no uso de `interface` para modelos; ok.
- Generics bem usados em `sciService`/`SCITable`; `listByTenant` usa `as unknown as T` (cast forçado, aceitável para Firestore).
- `export default app!` com non-null assertion em `firebase.ts:40` — se o env faltar, `app` é undefined e o `!` mente para o compilador (o app já trata via `isFirebaseConfigured`, mas qualquer import direto do default quebraria em runtime).

## 3.9 Erros silenciosos (catch sem feedback visual)

Inventário completo de `catch` que não informam o usuário:
- `AuthContext.tsx:53-55` (claims) — console apenas; usuário fica com role nulo sem aviso.
- `AdminContext.tsx:30-32` (cemitérios) — dropdown fica vazio sem explicação.
- `AdminDashboard.tsx:71-73`; `OperationalPage.tsx:97-99`; `InventoryPage.tsx:81-83`; `FinancialPage.tsx:48-50`; `MaintenancePage.tsx:70-72`; `EnvironmentalPage.tsx:69-71`; `DocumentsCenterPage.tsx:35-37`; `SupportPage.tsx:56-59`; `ReportsPage.tsx:44-46, 59-61`; `AgentsPage.tsx:46-48, 76-78, 86-88`; `SecurityPage.tsx:43-45, 69-71, 81-83`; `DeceasedList.tsx:21-23`; `DeceasedDetail.tsx:27-29`; `CemeteryDetail.tsx:227-229, 307-309, 363-365`; `CommunicatedDeaths.tsx:53-55`; `GardenOfMemories.tsx:74-76`; `VirtualAssistant.tsx:55-57`; `UserLayout.tsx:34-38`; `SuperAdminPage.tsx:105-107, 126-128, 164-166, 183-185, 236-239, 248-251`; `MonitoringDashboard.tsx:192-194`.
- Em services: `syncPublicDeceased`/`removePublicDeceased` (best-effort deliberado, ok), `logAction` (deliberado, ok) — mas ambos silenciam **também em produção** qualquer negação de regra, o que pode mascarar projeção pública dessincronizada para sempre.
- `SearchPage.tsx:39-41` — erro exibido como "nenhum resultado".

Padrão recomendado: função única `reportError(scope, error)` que loga + toast genérico; usar em todo load.

## 3.10 Código morto e resíduos de desenvolvimento

| Item | Local | Situação |
|---|---|---|
| `HomePage.tsx` | `src/pages/public/` (133 linhas) | nunca roteado/importado |
| `QRCodeGenerator.tsx` | `src/components/` | nunca usado; download quebrado com alert de demo (linha 39) |
| `SCITable.tsx` | `src/components/admin/` | criado no plano M7, nunca adotado |
| `useCemeteryFilter.ts` | `src/hooks/` | criado no plano M7, 0 imports |
| `LoadingSpinner.tsx` | `src/components/ui/` | só referenciado pelo SCITable morto |
| `validationSchemas.ts` | `src/lib/` | `dateRangeSchema` e `operationalRecordSchema` sem nenhum import |
| `updateDeceased` | `deceasedService.ts:156` | implementado, nunca chamado (não há tela de edição) |
| `getPlots`/`getTenantProfiles` extras | usados ok | — |
| `functions/index.js` | raiz de functions | backend v1 inteiro morto (setUserRole, onDeceasedCreated, generateContent, moderateTribute) |
| `functions/lib/**` | commitado | build output no git |
| `scripts/superadmin-claim.json` | commitado | credencial residual que o processo mandava apagar |
| `recordForm.plotId` | `OperationalPage.tsx:60` | campo de estado sem input correspondente |
| `Search`/`Menu`/`User` imports | `PublicLayout.tsx:4` | `Search` e `Menu` importados e não usados |
| `getRelationshipSubtitle` duplicada | `GardenOfMemories.tsx:54-60` | lógica repetida de `getRelationshipLabel` do ReportDeath |
| Mock "Sepultamentos Recentes" | `HomePage.tsx:104-127` | picsum + nomes falsos (dentro de arquivo já morto) |
| `pricingTable`, `permissionMatrix`, `partners`, `catalog` | Financial/Security/Partners/Shop | dados hardcoded apresentados como funcionalidades |
| Comentários de plano (A5, A7.2, B1, B3, C4, M7.4...) | vários services/páginas | úteis agora, mas são conversa com o revisor — remover após estabilizar |

---

# 4. PERFORMANCE

## 4.1 Queries Firestore sem limite / sem paginação / sem cache

Inventário completo (cada linha = leitura potencialmente ilimitada da coleção do tenant):

| Função | Arquivo:linha | Limite? | Cache? | Consumidores |
|---|---|---|---|---|
| `listOperationalRecords` | `sciService.ts:273` | não | só via snapshot | Operational, Maintenance, Dashboard (2×: snapshot + trend) |
| `listOccurrenceRecords` | `sciService.ts:281` | não | só via snapshot | Operational, Security |
| `listInternalNotifications` | `sciService.ts:289` | não | não | Operational |
| `listSanitaryChecks` / `listEnvironmentalChecks` | `sciService.ts:297/305` | não | só via snapshot | Environmental |
| `listFinancialRecords` | `sciService.ts:313` | não | só via snapshot | Financial |
| `listStockItems` | `sciService.ts:321` | não | não | Maintenance |
| `listDigitalDocuments` | `sciService.ts:355` | não | só via snapshot | Documents |
| `listAIAgents` / `listSCIReports` / `listSupportTickets` / `listTrainingSessions` | `sciService.ts:359-384` | não | não | Agents/Reports/Support |
| `getTenantPlots` | `cemeteryService.ts:323` | **não** | não | Inventory (all), getExhumationAlerts |
| `getCemeteryPlots` | `cemeteryService.ts:317` | não | não | Inventory, CemeteryDetail, deleteCemetery |
| `getAllCemeteries` | `cemeteryService.ts:112` | **não, cross-tenant** | não | ReportDeath (cidadão) |
| `getTenantNotifications` / `getMyNotifications` | `notificationService.ts:123-145` | não | não | CommunicatedDeaths, Garden, VirtualAssistant |
| `getDeceasedList` | `deceasedService.ts:76` | **50 fixo, sem paginação** | não | DeceasedList (dados faltantes a partir do 51º!) |
| busca pública | `SearchPage.tsx:32` | 200 fixo + filtro client-side | não | público |
| `loadTenants` / `loadUsersForTenant` | `SuperAdminPage.tsx:96-131` | não | não | superadmin |
| `listPlotConcessions` | `cemeteryService.ts:375` | não | não | (sem consumidor de UI atualmente) |

Pontos positivos: `getAllTenantPlotsWithPagination` (`sciService.ts:448-467`) pagina em lotes de 500 para o snapshot; o snapshot em si tem cache de 60s (`getSciSnapshot`, linha 502) com invalidação por prefixo em toda escrita SCI (`createForTenant:251`) e na alocação (`notificationService.ts:218`).

Problema estrutural: o dado mais volumoso (plots — potencialmente dezenas de milhares por município) é **baixado inteiro para o cliente** para derivar contadores. Contadores deveriam vir de `getCountFromServer`/agregações ou de documentos de contagem mantidos por Cloud Function; o mapa deveria consultar por viewport/setor.

## 4.2 Leituras redundantes na montagem

- **Dashboard**: `getSciExecutiveSnapshot` + `getMonthlyBurialTrend` — a segunda chama `listOperationalRecords` de novo, fora do cache do snapshot (`sciService.ts:734`): dois full-scans da mesma coleção por render.
- **InventoryPage**: `getTenantPlots/getCemeteryPlots` (lista/mapa) **e** `getSciExecutiveSnapshot` (que refaz a leitura paginada de todos os plots do tenant) — plots lidos 2× por montagem; trocando de unidade, de novo.
- **CommunicatedDeaths**: cascata de 3 `useEffect` (cemitérios → setores → plots, linhas 61-82) — aceitável por ser dependente de seleção, mas os dois primeiros poderiam ser paralelos com os dados de `AdminContext` (cemitérios já carregados lá!).
- **AdminContext + páginas**: `AdminProvider` carrega cemitérios; `CemeteryList`, `DeceasedForm`, `AdminReportDeath` e `CommunicatedDeaths` chamam `getCemeteries` de novo em vez de usar `useAdmin().cemeteries` — 4 fetches duplicados do mesmo dado por sessão.

## 4.3 Re-renders e estado

- `AdminContext` guarda `selectedCemeteryId` — todo consumidor re-renderiza ao trocar unidade: correto e desejado. Sem problemas graves de contexto.
- `SidebarContent` é definido **dentro** de `AdminLayoutContent` (`AdminLayout.tsx:87`) e de `UserLayout` (`UserLayout.tsx:54`) — recriado a cada render do layout; ao abrir/fechar menu mobile, a árvore inteira da sidebar é desmontada/remontada (perde scroll da nav, custa reconciliação). Extrair para componente top-level com props.
- `ReportDeath.tsx:110-113`: `useMemo` com deps `form1.watch(...)` chamados **dentro do array de deps** — `watch()` retorna valor novo a cada render e força re-subscrição; funciona por acaso, mas o idioma correto é `useWatch`.
- `AgentsPage` `useEffect` (linha 51) depende de `[tenantId, selectedCemeteryId]` mas `loadData` lê `selectedAgentId` — closure stale benigna, porém frágil.
- Listas grandes (plots no mapa: potencialmente milhares de `<button>` absolutos) sem virtualização — com 3.000 plots gerados por setor, o modo mapa cria 3.000 nós DOM com hover scale; vai travar. Virtualizar ou agregar por setor acima de N pontos.

## 4.4 useEffect com dependências erradas/ausentes

- Padrão geral `useEffect(() => { loadData(); }, [tenantId, selectedCemeteryId])` com `loadData` fora do array — funciona, mas sem `useCallback` viola exhaustive-deps e esconde bugs futuros (não há ESLint para apontar).
- `InventoryPage.loadData` lê `newPlot.sectorId` (linha 78) — não listado; se o usuário selecionar setor e os dados recarregarem, o default pode sobrescrever silenciosamente.
- `UserHomePage` interval ok com cleanup; `MonitoringDashboard` interval ok com cleanup e `useCallback` — bons exemplos.
- `LoginPage` redirect effect com deps corretas.

## 4.5 Operações sequenciais que deveriam ser paralelas/atômicas

- Upload de N documentos em série (`for ... await` em `deceasedService.ts:114-119` e `notificationService.ts:74-79`) — `Promise.all` reduziria o tempo de envio proporcionalmente ao número de arquivos.
- `createPlotConcession` faz create + `updatePlot` sequenciais sem batch (`cemeteryService.ts:386-408`).
- `allocateNotification`: além de não-transacional, as 4 escritas são sequenciais (~4 RTTs).
- `deleteManagerAccount` (`functions/src/index.ts:207-221`): deleta perfis com `Promise.all` — ok; mas não remove nenhum dado do tenant (não é performance, é completude — ver 1.20).

## 4.6 Memory leaks

- `ReportDeath.tsx:197 e 441`: `URL.createObjectURL(photoFile)` **em cada render**, sem revoke — cada tecla digitada num input do passo 1 re-renderiza e cria um novo blob URL. Vazamento real e crescente.
- `ProfilePage.tsx:61`: objectURL sem revoke (um por troca de foto — menor, mas existe).
- `AdminReportDeath` foi corrigido (useMemo + revoke — linhas 70-79) — o padrão certo existe no repo, faltou replicar.
- `listenNotification` (`notificationService.ts:147-153`) retorna unsubscribe e **não tem nenhum consumidor** — se vier a ser usado, atenção; hoje é código morto de subscription.
- Intervals (UserHomePage, MonitoringDashboard) com cleanup ✅. Leaflet `map.remove()` no cleanup ✅ (`MapPicker.tsx:50-54`).

## 4.7 Lazy loading / code splitting

- `App.tsx` importa **todas as 30+ páginas estaticamente** — o bundle único inclui Recharts (pesado, usado em 2 páginas), Leaflet (1 componente), o painel superadmin e toda a área admin mesmo para o cidadão que só quer buscar um falecido. Nenhum `React.lazy`/`Suspense` no projeto.
- Recomendação mínima: lazy por área (`/admin/*`, `/superadmin/*`, `/app/*`) — três chunks; ganho imediato no First Load da landing/busca pública (a página com mais tráfego anônimo).
- Imagens externas (Unsplash/picsum) sem `loading="lazy"` nem dimensões fixas — layout shift na área do usuário.

## 4.8 Índices e custo Firestore

- As queries do frontend cabem nos 3 índices compostos declarados; as ordenações são feitas em memória para evitar índices (documentado em `docs/FIREBASE_INDEXES.md:30`) — troca consciente, aceitável no curto prazo, mas significa **transferir a coleção inteira** para ordenar no cliente.
- Custo: com cache de 60s, cada gestor ativo gera a cada minuto ~7 full-scans (snapshot) + extras por página. Com 10k plots e 5 gestores, ~50k reads/h só de navegação. Contadores agregados serverless derrubariam isso em ~90%.

---

# 5. SEGURANÇA

## 5.1 Regras Firestore — análise coleção a coleção (`firestore.rules`)

| Coleção | Read | Write | Avaliação |
|---|---|---|---|
| `tenants` (36-44) | superadmin, membros do tenant, ou `role=='citizen'` | superadmin | O claim `citizen` **nunca é atribuído** (cadastro não seta claims; `AuthContext` só assume 'citizen' no cliente) — cidadãos reais não conseguem ler tenants. Hoje nada quebra (nenhuma tela cidadã lê tenants), mas a regra documenta uma intenção que o backend não cumpre. |
| `cemeteries` (47-51) | **público (`if true`)** | staff do tenant | Read público é necessário para o cidadão escolher cemitério; expõe `adminUid` e coordenadas de todos os tenants — aceitável, mas considerar projeção sem `adminUid`/`createdBy`. |
| `sectors` (54-58) | **público** | staff | Idem; baixo risco. |
| `plots` (61-71) | autenticado que seja staff do tenant OU `status=='available'` | staff | **Furo cross-tenant**: qualquer autenticado lê plots disponíveis de qualquer tenant (por design para "mapa público", mas não há mapa público autenticado). Pior: plots `occupied` contêm `occupantName`, `concessionHolder`, `burialDate` — corretamente bloqueados para não-staff, porém staff de QUALQUER role PT/EN do MESMO tenant ok. Regra em si coerente; risco menor. |
| `plot_concessions` (74-78) | staff do tenant | staff | OK (contém CPF `holderDocument`). |
| `deceaseds` (81-88) | staff OU `request.auth.uid in resource.data.managersUid` | staff | **`managersUid` não existe em nenhum documento criado pelo app** — para não-staff a expressão erra e nega (comportamento seguro por acidente). Limpar a cláusula ou implementar o conceito. |
| `public_deceaseds` (93-97) | **público** | staff do tenant | Correto por design (projeção LGPD). Ver 5.4 sobre o conteúdo. |
| `death_notifications` (100-133) | dono ou staff | create: dono com status 'submitted' sem allocation/rejection; update: staff, ou dono enquanto 'submitted' sem tocar campos de controle (`diff().affectedKeys().hasAny([...])`); delete: dono se 'rejected', ou staff | **A melhor regra do arquivo** — modela o fluxo corretamente. Nota: o dono pode criar notificação com `tenantId` arbitrário (não é validado contra o cemitério) — um usuário malicioso pode poluir a fila de outro tenant com lixo; validar `tenantId` via lookup do cemitério exigiria `get()`, ou mover a criação para Cloud Function. |
| `memorials` + `tributes` (136-159) | por privacyLevel / público | signed-in cria; managers editam; delete superadmin | Regras prontas para uma feature que não existe no app (memorials nunca são criados — trigger morto). `tributes` update permite autor OU managers via `get()` — ok. `create: if isSignedIn()` permite **qualquer autenticado criar memorial com qualquer conteúdo** — quando a feature nascer, endurecer. |
| `audit_logs` (162-171) | superadmin ou manager do tenant | create: staff, actorUid == uid, sem campos sensíveis; update/delete: false | Imutabilidade ok. **Operador não lê auditoria** (razoável). Cidadão não pode logar ações — por isso o fluxo de notificação não é auditado (lacuna de desenho, não de regra). |
| `requests` (174-183) | requester ou staff | create: qualquer autenticado; update: staff ou requester com status 'open' | Coleção sem nenhuma UI — regra dormindo. `create` não valida `tenantId`/`requesterUid` no payload (`requesterUid` forjável). Corrigir antes de ativar a feature. |
| `user_profiles` (186-190) | dono ou superadmin | dono | **Gestor não lê o perfil do cidadão** — por isso `CommunicatedDeaths` não consegue mostrar nome/contato do solicitante. Decisão a revisar: staff do tenant da notificação deveria poder ler o perfil de quem comunicou (com base legal de execução de serviço público). |
| `profiles` (193-196) | superadmin ou o próprio | superadmin | `getTenantProfiles(tenantId)` (`cemeteryService.ts:367-371`), usada por `CemeteryList` para o dropdown de admin responsável, roda como **gestor** — a query `where tenantId==` **é negada pelas rules** (gestor não é superadmin; regra só permite ler o próprio doc). O `catch(() => [])` em `CemeteryList.tsx:53` esconde a negação: o dropdown "Administrador responsavel" **sempre fica vazio em produção** para gestores. Funcionalidade quebrada por regra, silenciosamente. |
| `sci_*` (12 blocos, 199-280) | staff do tenant | staff do tenant | Consistentes. Não diferenciam manager/operator (operador pode tudo que gestor pode, inclusive financeiro — contradiz a "matriz de permissões" exibida na SecurityPage). Sem validação de schema (qualquer staff pode gravar campos arbitrários). |
| `monitor_*` (285-308) | superadmin | false (só Admin SDK) | Correto. |

## 5.2 Regras Storage (`storage.rules`)

- `documents/{userId}/**`, `photos/{userId}/**`, `sci-documents/{userId}/**`: read/write para o dono **ou qualquer staff de qualquer tenant** (`isStaff()` não compara tenant — linhas 38-51). Staff da prefeitura A pode ler certidões de óbito enviadas a a prefeitura B. **Furo de isolamento multi-tenant.**
- **Nenhum limite de tamanho ou content-type em nenhum path** — combinado com a ausência de `validateFile` no `ReportDeath`/`ProfilePage`, um usuário autenticado pode subir arquivos arbitrários de qualquer tamanho (custo + vetor de distribuição de malware via URLs tokenizadas). Adicionar `request.resource.size < 10 * 1024 * 1024 && request.resource.contentType.matches('application/pdf|image/.*')`.
- `memorials/{id}/photos` público para leitura, escrita staff — ok.
- `tenants/{tenantId}/requests/...` (66-74): a heurística `requestId.split('_')[0]` para achar o dono é frágil e está comentada como tal; feature sem UI ainda.
- Observação importante: `getDownloadURL` gera URLs com token de acesso público — **as regras de read do Storage não protegem quem tem a URL**. Fotos de falecidos gravadas em `public_deceaseds.photoUrl` são efetivamente públicas via token, o que é coerente com a busca pública, mas vale documentar: revogar acesso = trocar o token do arquivo.

## 5.3 Dados expostos publicamente (LGPD)

- `public_deceaseds`: nome, datas de nascimento/morte, cidade/UF, foto — publicados **automaticamente** quando o staff cria o registro, sem consentimento ou opt-out da família. Falecidos têm proteção reduzida na LGPD, mas foto+nome+datas afetam familiares vivos (direito de imagem/memória) e o Marco Civil; recomenda-se: flag `publicListing` com default configurável, consentimento no fluxo de comunicação de óbito, e canal de remoção (pedido do titular).
- `cemeteries`/`sectors` públicos: baixo risco.
- `causeOfDeath` (dado sensível de saúde do falecido, relacionável à família): coletado em `DeceasedForm.tsx:154-159`, corretamente **fora** da projeção pública e redigido nos audit logs (`audit.ts:16`) — bom desenho; falta base legal documentada e minimização (o campo é opcional e sem finalidade descrita na UI).
- **Ausência de Política de Privacidade/Termos** (links quebrados no footer) — para um sistema público que coleta dados de saúde e documentos, é a lacuna legal mais direta.
- Sem processo de exclusão/anonimização (direitos do titular), sem relatório de impacto (RIPD) — esperado para venda a órgãos públicos.

## 5.4 Isolamento entre tenants — resumo dos furos

1. Storage sem comparação de tenant no `isStaff()` (5.2) — **furo real**.
2. Plots `available` legíveis cross-tenant por qualquer autenticado (5.1) — vazamento menor de estrutura.
3. `death_notifications.create` aceita `tenantId` arbitrário — poluição de fila cross-tenant (5.1).
4. `getAllCemeteries()` no fluxo do cidadão é cross-tenant **por design** (o cidadão escolhe qualquer cemitério do sistema) — correto para o produto, mas significa que um tenant enxerga a existência/endereço dos demais.
5. Firestore SCI/dados principais: isolamento por `tenantId` **correto** — nenhuma query de página esquece o filtro (verificado função a função).

## 5.5 Operações destrutivas sem confirmação adequada

Já detalhadas (1.14, 1.16, 2.9): exclusão de cemitério e de falecido a um clique; exclusão de plot com confirm nativo; exclusão de tenant (SuperAdmin) com confirm nativo mas **cascata incompleta** (dados órfãos permanecem) e mensagem que promete o contrário. Nenhuma operação destrutiva exige re-digitação do nome ou segundo fator.

## 5.6 Validação client-side e bypass

- Toda validação de formulário é client-side; as rules validam **autorização**, não **schema** (exceto death_notifications). Um staff autenticado pode, via console, gravar `sci_financial_records` com `value: "banana"` ou `plots` com `status: 'xyz'` — os agregadores (`Number(item.value || 0)`, filtros por status) degradam silenciosamente. Mitigação: validação de tipos nas rules das coleções centrais (plots, deceaseds, financial) ou escrita via Functions.
- O guard `cemeteryId !== 'all'` existe no cliente e em `createForTenant` (defesa em profundidade ok), mas **não nas rules** — um staff pode gravar `cemeteryId:'all'` direto.
- `validateFile` roda só no cliente e só em 2 fluxos; Storage aceita tudo (5.2).

## 5.7 Roles e permissões — consistência auth ⇄ regras ⇄ router

- **Fonte dos claims**: somente `createManagerAccount`/`addUserToTenant` (ambos gravam `role:'manager'`). Logo, na prática existem apenas `superadmin`, `manager` e usuários sem claim (cidadãos). Os roles `gestor`, `operador`, `operator` e `citizen` são aceitos em rules/rotas mas **nunca emitidos** pelo backend atual (o `setUserRole` que os emitiria está no functions/index.js morto).
- Aceitação divergente por camada: rotas `/admin` aceitam `['gestor','manager','superadmin','operador']` (`App.tsx:111`) — **não** `operator`; `LoginPage` redireciona `['gestor','manager','operador']` — um `operator` (se algum dia emitido) cairia na área do cidadão; rules aceitam os 4 (`firestore.rules:19-29`); `GardenOfMemories.tsx:84` verifica `['superadmin','manager','operator']` — **não** gestor/operador. Unificar em inglês (como o plano A1 pedia) e remover as variantes PT de todas as camadas.
- Papel "auditor" exibido na matriz da SecurityPage não existe em lugar nenhum.
- Cidadão sem claim: `AuthContext.tsx:48` assume `'citizen'` no cliente — ok para UI, mas qualquer regra que dependa de `token.role=='citizen'` falha (5.1/tenants).

## 5.8 Credenciais e chaves

- `.env` local ignorado ✅; `serviceAccountKey.json` ignorado ✅.
- `deploy-pages.yml:36`: `VITE_GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }}` — **remover a linha e o secret**; contradiz C4 (ver sumário nº 2).
- Config Firebase hardcoded no YAML (chave web pública — aceitável tecnicamente, mas o README instrui outro método; unificar).
- `scripts/superadmin-claim.json` commitado com UID real do superadmin — apagar do repo (e do histórico, se o repo for público).
- `set-superadmin.cjs:27` promove `admin@memorial.com` — o e-mail do antigo backdoor; se essa conta ainda existir com senha fraca conhecida (`admin123` estava no código histórico), rodar o script a promoveria a superadmin. Trocar o e-mail alvo e garantir que a conta antiga foi deletada/senha trocada.
- `manualMonitorTrigger` fail-open sem token (ver 1.22) — definir `MONITOR_TRIGGER_TOKEN` obrigatório (falhar se ausente).
- Cloud Functions de IA: exigem apenas autenticação — **qualquer cidadão** pode chamar `chatWithManagerAgent` (o "agente do gestor") passando `agent` arbitrário, e todas sem rate-limit — abuso de custo OpenRouter trivial (script logado chamando em loop). Adicionar verificação de role no `chatWithManagerAgent`, rate-limit por uid (contador Firestore ou extensão), e teto de tokens.
- Sem App Check em nenhuma superfície (Firestore/Storage/Functions) — recomendado para app público.

## 5.9 Auditoria e irreversibilidade

- `logAction` grava apenas `changedFields` (nomes de campos) — sem valores antes/depois, a auditoria não permite reconstruir o que mudou (o parâmetro `oldValue` é aceito e ignorado — `audit.ts:31-50`). Para órgão público, trilha precisa de old/new sanitizados (via Cloud Function, como a própria regra comenta em `firestore.rules:169`).
- Ações **sem** auditoria: rejeição e exclusão de notificações (`notificationService.ts:223-245`), exclusão via `GardenOfMemories` (deleteDoc direto), todas as operações de superadmin (as Functions não escrevem audit_logs — e o monitor procura exatamente por `userRole=='superadmin'` que nunca existirá), login/logout, leituras.
- Exclusões físicas em vez de soft-delete para deceaseds/cemeteries/plots — órgãos de controle esperam inativação com histórico, não desaparecimento do registro.

---

# 6. SUGESTÕES DE PRODUTO — O QUE DEVERIA EXISTIR

## 6.1 Funcionalidades críticas completamente ausentes

1. **Edição de falecido** — sem ela, todo erro de digitação em registro oficial força excluir+recriar (perdendo anexos e trilha). O service já existe (`updateDeceased`); falta a tela (rota `/admin/falecidos/:id/editar` reusando o `DeceasedForm` com defaultValues).
2. **Gestão de usuários pelo gestor do tenant** — hoje só o superadmin cria logins, todos `manager`. O gestor de uma prefeitura não consegue criar operadores nem desligar um servidor exonerado. Requer: function `createTenantUser` invocável por manager (com role restrito a `operator`), tela em Configurações, e diferenciação manager/operator nas rules (financeiro/exclusões só manager).
3. **Memorial público + QR Code** — a razão de ser do produto para famílias (VISION J3/J4). Componentes já existem: rota placeholder, `public_deceaseds`, `QRCodeGenerator`, regras de `memorials`, trigger morto `onDeceasedCreated`. Entregável mínimo: página `/memorial/:id` lendo `public_deceaseds` + obituário público opcional + QR code para imprimir.
4. **Central de Solicitações (requests)** — J5 da visão: cidadão pede manutenção/2ª via/exumação; gestor triageia com SLA. As rules já existem (`firestore.rules:174-183`), o monitor já tenta contar `requests` — só falta o produto inteiro (form público + fila admin).
5. **Notificações à família** — nenhum evento (alocação, rejeição, prazo de exumação do ente) gera e-mail/WhatsApp. A infra de WhatsApp (Evolution API) **já está escrita** no `alertService.ts` para alertas internos — reaproveitar para notificação ao cidadão é o maior ganho de percepção de serviço público digital.
6. **Livro de sepultamentos / registro oficial imprimível** — prefeituras respondem a cartórios e ao Ministério Público; precisa de listagem completa (sem teto de 50), filtros por período e export CSV/PDF.
7. **Traslado, reserva e reabertura de jazigo** — o ciclo de vida real do jazigo (ocupado → exumado → ossuário → disponível) não tem fluxo; hoje é troca manual de status sem histórico.

## 6.2 Presentes mas inacabadas (maior ROI de conclusão)

1. **Prazos de exumação** (1.2/sumário): adicionar ação "Gerar ordem de exumação" no alerta → cria `sci_operational_record` type `exhumation` pré-preenchido + notifica família + bloqueia jazigo ao concluir. Fecha o ciclo com peças existentes.
2. **Concessões**: o dado de vencimento existe e o snapshot conta `expiringConcessions` — falta tela de concessões (lista, renovar, transferir — `listPlotConcessions`/`createPlotConcession` já existem sem UI!) e cobrança vinculada ao Financeiro.
3. **Estoque com movimentação**: acrescentar entrada/baixa com motivo transforma o cadastro estático em controle real; hoje o item nasce e morre com a mesma quantidade.
4. **Relatórios em PDF com período e timbre** — a estrutura de geração existe; trocar TXT por PDF (ex.: pdfmake) e aceitar `de/até` atenderia TCE e secretarias.
5. **Busca pública server-side**: campo `nameLowercase` indexado + query `>= term / <= term+` resolve sem Algolia até dezenas de milhares de registros; adiciona filtro por cemitério (o campo já está na projeção).
6. **Agentes IA que agem**: dar ao `chatWithManagerAgent` tools (criar ocorrência, listar prazos vencidos) transformaria o console de teste em assistente operacional de verdade — hoje o backend só conversa.
7. **Monitoramento**: corrigir os campos/coleções consultados (5 correções pontuais listadas em 1.22) faria o dashboard do superadmin sair de fictício para real com esforço pequeno.

## 6.3 Integrações que fariam sentido (prioridade decrescente)

1. **WhatsApp/E-mail transacional ao cidadão** (Evolution API já integrada no backend; e-mail via extensão Trigger Email) — status da comunicação de óbito, lembrete de exumação/concessão.
2. **Certidão/guia em PDF assinável** (guia de sepultamento, termo de concessão) — pdfmake + numeração sequencial por tenant; passo seguinte: assinatura ICP-Brasil via gov.br.
3. **gov.br OAuth** para o cidadão — login único do setor público, elimina cadastro/senha e dá identidade verificada ao comunicante do óbito.
4. **PIX/boleto (gateway ou API do banco do município)** para taxas de sepultamento/concessão — hoje o Financeiro é manual.
5. **SIRC/CRC (registro civil)** — conferência da certidão de óbito comunicada; médio prazo, alto valor de integridade.
6. **eSocial**: não é aderente ao domínio deste sistema (eSocial trata vínculos trabalhistas) — se a intenção era óbitos, o alvo correto é o **SIRC**; para repasse a INSS o próprio SIRC cumpre o papel. Registrar para não gastar esforço na direção errada.
7. **Google Maps/OSM routing** para "como chegar ao jazigo" (J4) — o dado de lat/lng por plot já existe.

## 6.4 Relatórios que um gestor municipal precisa e não existem

- Sepultamentos por período/cemitério/causa (com export CSV) — obrigação de transparência.
- Arrecadação por tipo de taxa × inadimplência de concessões.
- Ocupação e projeção de saturação **por setor** (o dado existe agregado, não por quadra).
- Exumações realizadas × pendentes com justificativas — auditoria sanitária.
- Relatório LGPD: acessos a dados sensíveis (exige auditoria de leitura via Functions).
- Produtividade: ordens de manutenção abertas/fechadas por responsável, tempo médio, SLA estourado.

## 6.5 Fluxos de aprovação que deveriam existir

- **Exumação**: solicitação (família ou administração) → conferência documental → aprovação do gestor (segundo ator distinto do solicitante) → execução com registro fotográfico → destino dos restos (ossuário). Hoje: inexistente.
- **Exclusão de registros oficiais**: excluir falecido/cemitério deveria exigir manager (não operator) + motivo registrado em auditoria + soft-delete com retenção.
- **Alteração de concessão/transferência de titularidade**: requer documento + aprovação; `transferredFrom` já existe no modelo (`cemeteryService.ts:92`) sem fluxo.
- **Publicação no memorial público**: aprovação da família (opt-in) antes de listar em `public_deceaseds`.

## 6.6 Auditoria e compliance para órgãos de controle

Checklist do que falta para o sistema ser auditável:
1. Trilha com valores old/new sanitizados via Cloud Function (hoje só nomes de campos — 5.9).
2. Auditoria de ações de superadmin e do fluxo cidadão (hoje zero).
3. Soft-delete + retenção configurável para registros oficiais.
4. Log de autenticação (sucesso/falha) — o monitor já espera `LOGIN_FAILED`; implementar via Cloud Function blocking functions ou log client-side assinado.
5. Exportação completa dos dados do tenant (portabilidade/fim de contrato) — hoje um município que saia do sistema não tem como levar seus dados.
6. Política de Privacidade, Termos de Uso, registro de consentimento e canal do encarregado (DPO).
7. Backup/restore documentado (agendamento de export do Firestore para GCS) — inexistente no repo.

---

# 7. TESTES E QUALIDADE

## 7.1 Cobertura de testes

**Zero.** Não há nenhum arquivo de teste no repositório, nenhum framework instalado (sem vitest/jest/testing-library/cypress/playwright), nenhum script `test` no `package.json` (raiz ou functions), e nenhum teste de regras com `@firebase/rules-unit-testing`.

## 7.2 Fluxos críticos sem nenhum teste (priorização do que testar primeiro)

1. **Regras Firestore** (rules-unit-testing + emulador): isolamento de tenant nas coleções SCI; cidadão não forja `allocation`/`status` em death_notifications; cidadão não lê `deceaseds`; staff cross-tenant negado. É o teste de maior valor por linha no projeto — as regras são a única defesa real.
2. **`allocateNotification`** (emulador): cria deceased + ocupa plot + atualiza notificação; caso de corrida (plot já ocupado) — hoje falharia, e o teste documentaria o bug até a transação ser implementada.
3. **`getSciExecutiveSnapshot`** (unit puro com dados sintéticos): contadores, projeção de saturação, prazos de exumação (incluindo fuso — `new Date('YYYY-MM-DD')` é UTC e desloca o dia em BRT), concessões vencendo.
4. **`deleteCemetery`**: bloqueio com ocupados/pendências; cascade completa; contagem de batches >450.
5. **Wizards de óbito** (component test): validação por passo, acúmulo de formData, duplo-submit.
6. **`validateFile` / `syncPublicDeceased`** (unit): whitelist de campos públicos — teste que falha se alguém adicionar campo sensível à projeção (guardrail de LGPD).
7. **E2E feliz** (Playwright + emuladores): cidadão comunica óbito → gestor aloca → registro aparece em Falecidos e na busca pública.

## 7.3 Linting e formatação

- Não há ESLint nem Prettier (nenhum config, nenhuma dependência). O script `lint` é `tsc --noEmit` (`package.json:11`) — só checagem de tipos, e fraca (sem strict).
- Consequências visíveis no código: imports não usados (`PublicLayout.tsx:4`), deps de hooks incompletas, `console.log`/`console.error` livres, aspas/estilo inconsistentes.
- Recomendação: ESLint flat config com `typescript-eslint` + `react-hooks` (exhaustive-deps teria pego os itens da seção 4.4) + `jsx-a11y` (teria pego a maior parte da seção 2.8); Prettier com config única; `lint-staged` + husky.
- TypeScript: plano B5 adiou `strict` por falta de `@types/react`. Caminho incremental: instalar `@types/react`/`@types/react-dom` → ligar `strictNullChecks` → `noImplicitAny` por pasta (services primeiro) → strict total.

## 7.4 CI/CD

**Existe**: um único workflow (`deploy-pages.yml`) que builda e publica no GitHub Pages a cada push na `main`. Sem typecheck, sem testes, sem lint como gate — um `tsc` quebrado só falha porque o build do Vite falharia; um bug de lógica vai direto para produção pública.

**Problemas do workflow atual**: secret Gemini injetado (5.8); config Firebase hardcoded; `sleep 120` como sincronização de deploy (linhas 67-68) — gambiarra frágil; deploy direto de `main` sem ambiente de staging.

**O que deveria existir para um sistema de gestão pública**:
1. Pipeline de PR: install → `tsc --noEmit` → eslint → vitest (unit) → testes de rules em emulador. Bloqueando merge.
2. Deploy de **rules e functions versionado por CI** (hoje `firebase deploy` é manual e fora de controle — as rules em produção podem divergir do repo sem ninguém saber; o `IMPLEMENTACAO_STATUS.md:16-21` lista o deploy como "ação pendente", ou seja, **não há evidência de que as regras corrigidas estejam em produção**).
3. Ambiente de staging (segundo projeto Firebase) com deploy automático de branch; produção por tag/aprovação.
4. Smoke test pós-deploy (o `manualMonitorTrigger` poderia ser chamado pelo CI com token).
5. Dependabot/renovate + `npm audit` no pipeline.
6. Backup agendado do Firestore (gcloud scheduled export) — inexistente e essencial para dados de registro público.

## 7.5 Qualidade documental

- `README.md` desatualizado em 3 pontos: instrui `functions:config:set gemini.api_key` (o backend real usa secret `OPENROUTER_API_KEY` — `functions/src/index.ts:23`), cita `scripts/set-superadmin.js` (é `.cjs`) e a Cloud Function `setUserRole`/`generateContent` (mortas).
- `IMPLEMENTACAO_STATUS.md` afirma itens não verdadeiros no código atual (modais de confirmação em CemeteryList — inexistentes; "window.confirm/alert removidos" — 6 arquivos ainda os usam).
- `docs/VISION.md` é bom e continua sendo o melhor guia de produto — mas ~40% dele (memorial, requests, financeiro integrado) não tem correspondência no código; manter como norte e marcar o que está entregue.

---

# 8. RANKING DE PRIORIDADE

Legenda — Impacto: CRÍTICO / ALTO / MÉDIO / BAIXO. Esforço: P (pequeno, ≤½ dia), M (médio, 1-3 dias), G (grande, >3 dias). Ordenado por impacto e, dentro do impacto, por melhor relação valor/esforço.

| # | Problema / Sugestão | Referência | Impacto | Esforço |
|---|---|---|---|---|
| 1 | Exclusão de cemitério sem confirmação (cascade) | `CemeteryList.tsx:119-130` | CRÍTICO | P |
| 2 | Exclusão de falecido sem confirmação | `DeceasedList.tsx:132-137` | CRÍTICO | P |
| 3 | Remover `VITE_GEMINI_API_KEY` do CI + revogar secret | `deploy-pages.yml:36` | CRÍTICO | P |
| 4 | Falha silenciosa ao registrar incidente de segurança (guard+toast) | `SecurityPage.tsx:52-74` | CRÍTICO | P |
| 5 | `allocateNotification` em transação + checagem de plot disponível | `notificationService.ts:155-221` | CRÍTICO | M |
| 6 | `manualMonitorTrigger` fail-open sem token | `functions/src/index.ts:574-579` | CRÍTICO | P |
| 7 | Deploy de rules/functions verificável (garantir que as regras do repo estão em produção) | `IMPLEMENTACAO_STATUS.md:16-21` | CRÍTICO | P |
| 8 | Storage: limitar tamanho/content-type + isolar tenant no `isStaff()` | `storage.rules:29-51` | ALTO | M |
| 9 | Lista de falecidos limitada a 50 sem paginação (registro incompleto) | `deceasedService.ts:76-85` | ALTO | M |
| 10 | Edição de falecido (tela usando `updateDeceased` existente) | `deceasedService.ts:156` | ALTO | M |
| 11 | Duplo-submit nos wizards de óbito (isSubmitting) | `ReportDeath.tsx:141`, `AdminReportDeath.tsx:115` | ALTO | P |
| 12 | Rate-limit + verificação de role nas functions de IA | `functions/src/index.ts:316-402` | ALTO | M |
| 13 | Monitoramento consulta campos/coleções inexistentes (5 correções) | `operationalMonitor.ts:115` etc. | ALTO | M |
| 14 | `deleteDeceased` não libera plot nem apaga arquivos | `deceasedService.ts:150-154` | ALTO | M |
| 15 | Dropdown "Administrador responsável" sempre vazio (rules de `profiles` negam a query) | `firestore.rules:193-196` + `cemeteryService.ts:367` | ALTO | P |
| 16 | Unificar roles (EN) em rules/rotas/UI; corrigir `GardenOfMemories.tsx:84` e redirect de `operator` | várias | ALTO | M |
| 17 | Validação de arquivos no ReportDeath/ProfilePage (`validateFile`) | `ReportDeath.tsx:355`, `ProfilePage.tsx:120` | ALTO | P |
| 18 | Busca pública server-side (nameLowercase indexado) | `SearchPage.tsx:32-38` | ALTO | M |
| 19 | Gestão de usuários do tenant pelo gestor (function + tela) | inexistente | ALTO | G |
| 20 | Memorial público `/memorial/:id` + QR code | `App.tsx:94` | ALTO | G |
| 21 | Notificação ao cidadão (alocação/rejeição) via e-mail/WhatsApp | `alertService.ts` reuso | ALTO | M |
| 22 | Card "óbitos pendentes" no dashboard | `AdminDashboard.tsx` | ALTO | P |
| 23 | `deleteManagerAccount` não apaga dados do tenant (mensagem promete) | `functions/src/index.ts:189-226` | ALTO | M |
| 24 | Testes de regras Firestore no emulador | inexistente | ALTO | M |
| 25 | CI com typecheck/lint/test bloqueando merge | `deploy-pages.yml` | ALTO | M |
| 26 | Soft-delete + auditoria com old/new para registros oficiais | `audit.ts:31-50` | ALTO | G |
| 27 | Política de Privacidade/Termos + consentimento e opt-out da listagem pública | footer/`public_deceaseds` | ALTO | M |
| 28 | Toasts/feedback nas páginas mudas (Reports, Agents, SuperAdmin, CemeteryDetail) | seção 2.4 | MÉDIO | P |
| 29 | Traduzir valores de domínio (estender statusLabels) | seção 2.2 | MÉDIO | P |
| 30 | Varredura de acentuação (~80 strings) | seção 2.2 | MÉDIO | P |
| 31 | Trocar alert()/window.confirm remanescentes por toast/ConfirmDialog | 6 arquivos | MÉDIO | P |
| 32 | Loading state em Financial/Documents/Support/Security | seção 2.4 | MÉDIO | P |
| 33 | Vazamento de objectURL no ReportDeath/ProfilePage | `ReportDeath.tsx:197,441` | MÉDIO | P |
| 34 | Extrair handler genérico de criação SCI + adotar SCITable/useCemeteryFilter | seção 3.2 | MÉDIO | M |
| 35 | Mapa real (Leaflet) no Inventário | `InventoryPage.tsx:308-362` | MÉDIO | M |
| 36 | Lazy loading por área (React.lazy) | `App.tsx` | MÉDIO | P |
| 37 | Contadores agregados (getCountFromServer) em vez de baixar plots | `sciService.ts:448-504` | MÉDIO | G |
| 38 | Filtro de risco do Inventário com semântica correta | `InventoryPage.tsx:98-102` | MÉDIO | P |
| 39 | Status→available não limpa deceasedId/occupantName | `InventoryPage.tsx:154-166` | MÉDIO | P |
| 40 | `deleteSector` órfãos de plots (cascade ou bloqueio) | `cemeteryService.ts:304-307` | MÉDIO | P |
| 41 | Fluxo de exumação acionável a partir dos alertas | `OperationalPage.tsx:443-509` | MÉDIO | M |
| 42 | Tela de concessões (services já prontos) | `cemeteryService.ts:375-408` | MÉDIO | M |
| 43 | Relatórios em PDF com período | `ReportsPage.tsx` | MÉDIO | M |
| 44 | Movimentação de estoque (entrada/baixa) | `MaintenancePage.tsx` | MÉDIO | M |
| 45 | Persistir selectedCemeteryId + exibir nome (não ID) | `AdminContext.tsx:17` | MÉDIO | P |
| 46 | Mostrar solicitante (nome/contato) na análise de óbito + rules de user_profiles p/ staff | `CommunicatedDeaths.tsx:195` | MÉDIO | M |
| 47 | Remover deps não usadas (uuid, motion, react-leaflet, qrcode.react\*) e mover firebase-admin/vite | `package.json` | MÉDIO | P |
| 48 | Instalar @types/react e ligar strict incremental + ESLint/Prettier | `tsconfig.json` | MÉDIO | M |
| 49 | Apagar código morto (HomePage, functions/index.js, functions/lib, superadmin-claim.json, validationSchemas ou usá-los) | seção 3.10 | MÉDIO | P |
| 50 | Datas formatadas (formatDate) em todas as tabelas | seção 2.10.9 | BAIXO | P |
| 51 | Empty state + loading em CemeteryList | `CemeteryList.tsx` | BAIXO | P |
| 52 | Dropdown de DeceasedList fechar com clique-fora/Esc | `DeceasedList.tsx:116-140` | BAIXO | P |
| 53 | Acessibilidade de modais (useModal em todos) + aria-labels + contraste | seção 2.8 | BAIXO* | M |
| 54 | Unificar botão primário/raio de borda (mini design system) | seção 2.1 | BAIXO | M |
| 55 | Remover/rotular claramente os módulos simulados (Parceiros, câmera, Loja, tabela de preços, "Validado IA", "Prioridades IA") até serem reais | seções 1.4/1.9/1.13/1.19 | MÉDIO | P |
| 56 | Mensagem de erro do chat cita "chave Gemini" (backend é OpenRouter) | `AgentsPage.tsx:148` | BAIXO | P |
| 57 | README/STATUS desatualizados (OpenRouter, .cjs, modais) | docs | BAIXO | P |
| 58 | Enumeração de usuários no reset de senha | `LoginPage.tsx:38-44` | BAIXO | P |
| 59 | Backup agendado do Firestore | infra | ALTO | P |
| 60 | Central de Solicitações (J5) completa | rota ComingSoon | ALTO | G |

\* Acessibilidade marcada BAIXO apenas em urgência relativa; para licitação pública (exigência de acessibilidade em serviços digitais), sobe para ALTO.

---

# 9. ROADMAP SUGERIDO

## Onda 0 — "Estancar o sangramento" (1 semana)
Objetivo: nenhuma perda de dado acidental, nenhum segredo exposto, nenhum silêncio em erro crítico.
- Itens 1, 2, 3, 4, 6, 11, 17, 31, 33 (todos P).
- Item 7: rodar `firebase deploy --only firestore:rules,storage,functions` e registrar evidência; conferir que a conta `admin@memorial.com` não existe/foi neutralizada; apagar `scripts/superadmin-claim.json`.
- Item 5 (transação de alocação) inicia aqui e conclui na Onda 1.
Critério de saída: nenhuma exclusão sem ConfirmDialog; secret Gemini removido do GitHub; SecurityPage com guard+toast; wizard sem duplo-submit.

## Onda 1 — "Confiabilidade do núcleo" (2-3 semanas)
Objetivo: o circuito cidadão→gestor→registro é sólido e auditável.
- Itens 5 (conclusão), 9, 10, 14, 15, 16, 21, 22, 46.
- Itens 24, 25: emulador + testes de rules + CI de PR (typecheck/lint/test) — a partir daqui tudo passa por gate.
- Item 8 (storage rules) e 12 (rate-limit IA).
Critério de saída: alocar 2× o mesmo plot é impossível; falecidos com paginação e edição; família notificada; CI verde obrigatório.

## Onda 2 — "Acabamento e coerência" (2-3 semanas)
Objetivo: o produto parece e se comporta como um produto único.
- Itens 28, 29, 30, 32, 38, 39, 40, 45, 47, 48, 49, 50, 51, 52, 55, 56, 57.
- Item 34 (refactor: handler genérico + SCITable + useCemeteryFilter) — reduz ~1.000 linhas e trava o padrão para as ondas seguintes.
- Item 36 (lazy por área).
Critério de saída: zero `any[]` nas páginas SCI; zero strings sem acento; zero valores de domínio em inglês na UI; bundle público sem código admin.

## Onda 3 — "Valor municipal" (3-4 semanas)
Objetivo: os recursos que vendem o sistema à prefeitura.
- Itens 41 (exumação acionável), 42 (concessões), 43 (PDF), 44 (estoque), 13 (monitor real), 23, 26 (soft-delete+auditoria old/new), 27 (LGPD: política, consentimento, opt-out), 59 (backup).
- Item 35 (mapa Leaflet no inventário) e 37 (contadores agregados) — juntos, pois mudam a estratégia de leitura de plots.
Critério de saída: relatório mensal em PDF timbrado; trilha de auditoria reconstruível; dashboard de monitoramento com dados reais; backup diário.

## Onda 4 — "Expansão de produto" (contínuo)
- Itens 19 (usuários do tenant), 20 (memorial público + QR), 60 (Central de Solicitações), busca avançada (18 se ainda não feito), integrações (gov.br, PIX, SIRC), agentes IA com ações, app de campo offline (visão V2).
- Decidir o destino dos módulos simulados: Parceiros e Loja viram produto real (marketplace municipal exige licitação — provavelmente descartar ou reduzir a "diretório de serviços") e a câmera da SecurityPage sai até existir integração.

## Princípios transversais para todas as ondas
1. Toda escrita multi-documento nova nasce em transação ou Cloud Function.
2. Toda string nova em PT-BR com acentuação correta e todo estado de domínio com label traduzida.
3. Nenhuma feature nova sem empty/loading/error states e sem confirmação quando destrutiva.
4. Nenhum merge sem CI verde (a partir da Onda 1).
5. Atualizar `README`/`IMPLEMENTACAO_STATUS` no mesmo PR que muda o comportamento descrito.

---

## Nota final

O MemorialOS tem um núcleo genuinamente bom — multi-tenant com claims, regras de death_notifications bem modeladas, o fluxo de alocação com controle de exumação, e uma separação LGPD (`public_deceaseds`) acima da média. O passivo se concentra em três frentes: **acabamento inconsistente** (feedback, idioma, validação — herança de desenvolvimento acelerado), **simulações apresentadas como funcionalidades** (Parceiros, Loja, câmera, "IA", monitoramento) que precisam virar reais ou sair, e **ausência total de rede de segurança** (testes, CI de qualidade, confirmações destrutivas, transações). As Ondas 0-1 eliminam os riscos que impedem uso real por uma prefeitura; as Ondas 2-3 transformam o esqueleto em produto vendável. Nada aqui exige reescrita — a arquitetura atual suporta todas as correções propostas.

*Relatório gerado por análise estática integral do repositório em 2026-07-04. Referências de linha correspondem ao estado do commit `d63e29d`.*

---

# 10. FLUXOS PONTA-A-PONTA (RASTREAMENTO DETALHADO)

Esta seção documenta, passo a passo com referências de arquivo/linha, os seis fluxos centrais do sistema — servindo tanto de documentação viva quanto de evidência dos problemas apontados nas seções anteriores.

## 10.1 Fluxo: cidadão comunica um óbito

1. Cidadão autenticado acessa `/app/comunicar-obito` (`App.tsx:104` → `ReportDeath.tsx`).
2. `useEffect` inicial chama `getAllCemeteries()` (`ReportDeath.tsx:104`) — **lê todos os cemitérios de todos os tenants**, sem limite (`cemeteryService.ts:112-116`). Permitido pela regra `cemeteries: allow read: if true`.
3. Passo 1 do wizard valida com `step1Schema` (zod, `ReportDeath.tsx:11-23`): nome, datas, cidade/UF, proximidade. Foto e documentos são anexados **sem passar por `validateFile`** — qualquer tipo/tamanho segue adiante.
4. Passo 2: `handleGenerateObituary` (`ReportDeath.tsx:122-139`) chama a callable `generateObituary` → `functions/src/index.ts:316-340` monta prompt e chama OpenRouter (`openRouterChat`, linhas 265-313, com 3 tentativas e backoff). Falha vira `alert()`.
5. Passo 4: `handleFinalSubmit` (`ReportDeath.tsx:141-176`):
   a. `getCemetery(selectedCemeteryId)` para descobrir o `tenantId` da prefeitura dona do cemitério (linha 148) — este é o mecanismo de roteamento multi-tenant do fluxo, e é bom.
   b. `createDeathNotification(tenantId, finalData, docFiles, photoFile)` (`notificationService.ts:63-117`): valida usuário/tenant/cemitério, faz upload **sequencial** dos documentos para `documents/{uid}/...` e da foto para `photos/{uid}/...`, e grava o doc com `status:'submitted'`.
   c. A regra de create (`firestore.rules:101-105`) garante: `createdBy == uid`, status inicial `submitted`, sem `allocation`/`rejectionReason`. **Não valida** que o `tenantId` enviado corresponde ao cemitério — cliente adulterado pode endereçar qualquer tenant.
   d. Sem `isSubmitting`: cliques repetidos no botão criam notificações duplicadas (cada uma re-subindo os arquivos).
6. Sucesso = `alert()` + navegação para `/app/memorias`. Nenhum e-mail/notificação é disparado para o gestor — ele só verá se abrir a tela.

## 10.2 Fluxo: gestor analisa e aloca o sepultamento

1. Gestor abre `/admin/obitos-comunicados` (`CommunicatedDeaths.tsx`). `getTenantNotifications(tenantId)` (`notificationService.ts:136-145`) lista tudo do tenant ordenado por data (índice composto existente).
2. A tabela mostra o solicitante apenas como `ID: xxxxxxxx...` (`CommunicatedDeaths.tsx:195`) — a regra de `user_profiles` (`firestore.rules:186-190`) impediria buscar o nome mesmo se a tela tentasse.
3. "Alocar Jazigo" abre o modal (acessível, via `useModal`). Cascata: `getCemeteries(tenantId)` → `getSectors(cemeteryId)` → `getPlots(sectorId)`; o select final filtra `status === 'available'` **no cliente** (`CommunicatedDeaths.tsx:315`).
4. `handleConfirmAllocation` → `allocateNotification` (`notificationService.ts:155-221`):
   a. Relê a notificação (getDoc).
   b. `createDeceased(...)` — cria o registro oficial copiando os campos, e dispara `syncPublicDeceased` (projeção pública) + `logAction`.
   c. `updatePlot(plotId, { status:'occupied', deceasedId, occupantName, burialDate: hoje, exhumationDeadlineYears: 3, documentStatus:'pending' })`.
   d. `updateDoc` da notificação: `status:'allocated'`, `deceasedId`, `allocation{...}`.
   e. `logAction('ALLOCATE_DEATH_NOTIFICATION')` + `invalidateCache('sci_snapshot:tenant')`.
   **Riscos**: nenhuma dessas 4+ escritas é transacional; entre (a) e (c) o plot pode ter sido ocupado por outra alocação/edição manual — não há recheck. `burialDate` é sempre "hoje", mesmo que o sepultamento ocorra em outra data.
5. O cidadão vê o novo status no Jardim de Memórias na próxima visita — não é notificado ativamente.
6. "Rejeitar" grava `status:'rejected'` + motivo (`rejectNotification`, sem audit log). A família só descobre entrando no app.

## 10.3 Fluxo: cadastro direto de falecido pelo gestor

Há **três** portas de entrada com semânticas diferentes:
- `/admin/falecidos/novo` (`DeceasedForm`): zod completo, upload validado, exige cemitério; **não toca no plot** mesmo quando `plotId` é preenchido.
- `/admin/comunicar-obito` (`AdminReportDeath`): wizard de 5 passos com IA; `plotId` texto livre; grava wakeDate/wakeTime; **não toca no plot**; sem validação de arquivos; `alert()` para erros; sem isSubmitting.
- Alocação via notificação (10.2): a única que sincroniza plot + prazos.
Consequência: o estado do inventário (`plots`) e o registro civil (`deceaseds`) só ficam consistentes quando o gestor usa o terceiro caminho — os dois primeiros criam falecidos "flutuantes" e jazigos desatualizados, corrompendo taxa de ocupação, prazos de exumação e a busca do mapa.

## 10.4 Fluxo: geração de estrutura física

1. `/admin/cemiterios` → "Novo cemiterio" → modal com MapPicker (Leaflet real) → `createCemetery` grava com tenantId + audit.
2. "Gerenciar estrutura" → `/admin/cemiterios/:id` → "Novo setor" → `createSector` (`cemeteryService.ts:225-289`): se `generatePlots`, gera até 3.000 plots em batches de 450, com código `PREFIX-0001`, grade `row/column` e lat/lng derivadas do centro com passo fixo de `0.00003` graus (~3,3m) — aproximação razoável para visualização, não para localização real.
3. Os plots gerados nascem `available` com riscos `low` — alimentam o Inventário e o snapshot imediatamente (cache 60s).
4. Furos: editar o setor depois não move/regenera plots; excluir o setor (confirm nativo) deixa os plots órfãos; excluir o cemitério tem salvaguardas no service mas nenhuma confirmação na UI.

## 10.5 Fluxo: provisionamento de uma prefeitura (superadmin)

1. Superadmin (claim setado manualmente via `scripts/set-superadmin.cjs`) acessa `/superadmin`.
2. "Nova Prefeitura" → `createManagerAccount` (`functions/src/index.ts:37-84`): gera `tenantId = tenant_<nome>_<timestamp>`, cria usuário Auth com senha temporária, seta claims `{role:'manager', tenantId}`, grava `tenants/{id}` e `profiles/{uid}`.
3. Logins adicionais via `addUserToTenant` — **sempre** `role:'manager'` (linha 115); não há como criar operador.
4. Desativar prefeitura = desabilitar o Auth do gestor principal + `tenants.active=false` (`toggleManagerStatus`) — **não desabilita os logins adicionais** do tenant (só o principal), furo funcional: uma prefeitura "inativa" continua operável pelos gestores secundários.
5. Excluir prefeitura = deletar todos os Auth users + profiles + doc do tenant (`deleteManagerAccount`) — dados de cemeteries/plots/deceaseds/sci_* **permanecem no banco** indefinidamente.
6. A senha temporária é definida pelo superadmin e **não há troca obrigatória no primeiro login** nem convite por e-mail — a senha trafega por canal externo (WhatsApp/telefone) sem controle.

## 10.6 Fluxo: monitoramento e alertas (superadmin)

1. Schedulers (`monitorTechnical` 5min, `monitorOperational` 30min, `monitorMemorials` diário, `dailyReport` 07:30 BRT) gravam `monitor_metrics/current` e `monitor_history`, e despacham alertas via Evolution API quando `WHATSAPP_ENABLED=true`.
2. `MonitoringDashboard` consome via callable `getMonitoringData` (restrita a superadmin ✅).
3. Como documentado em 1.22, a maioria dos coletores consulta esquemas inexistentes; os únicos números reais hoje seriam: uptime/latência HTTP do GitHub Pages, latência Firestore, `newSignups24h` (profiles.createdAt existe para gestores), `memoriaisCreados24h`/`totalMemoriais` (deceaseds.createdAt) e `monitor_function_errors`. Todos os demais: sempre 0 ou -1.
4. O `dailyReport` só salva ponto histórico quando roda — ou seja, o gráfico "últimos 7 dias" tem no máximo 1 ponto/dia (o front sugere granularidade maior — `saveHistoricalPoint` só é chamado no daily).

---

# ANEXO A — DICIONÁRIO DE DADOS (COLEÇÕES FIRESTORE)

Para cada coleção: campos observados no código, quem escreve, quem lê, regra vigente e observações de integridade. Fonte: interfaces TypeScript dos services + pontos de escrita.

## A.1 `tenants/{tenantId}`
- **Campos**: `name`, `active`, `managerEmail`, `managerUid`, `createdAt`.
- **Escrita**: apenas Cloud Functions (`createManagerAccount`, `toggleManagerStatus`, `deleteManagerAccount`).
- **Leitura**: `SuperAdminPage.loadTenants` (query com orderBy createdAt).
- **Regra**: read superadmin/membros/citizen-claim; write superadmin (`firestore.rules:36-44`).
- **Observações**: `active=false` não bloqueia nada além do login do gestor principal; nenhum código do app consulta `tenants.active` para negar operação.

## A.2 `profiles/{uid}` (staff)
- **Campos**: `email`, `role` ('manager'), `tenantId`, `active`, `createdAt`.
- **Escrita**: Cloud Functions apenas.
- **Leitura**: SuperAdminPage (por tenant); `getTenantProfiles` no CemeteryList (**negada pelas rules em produção** — ver 5.1).
- **Observações**: monitor espera `lastLoginAt` que nunca é gravado; não há espelho de claims → se um claim for alterado manualmente, profile e claim divergem sem detecção.

## A.3 `user_profiles/{uid}` (cidadão)
- **Campos**: `uid`, `tenantId?`, `displayName`, `phone`, `city`, `state`, `address`, `emergencyContact`, `preferredContact`, `relationshipPreference?`, `notes`, `photoUrl`, `createdAt`, `updatedAt`.
- **Escrita/Leitura**: o próprio usuário (ProfilePage, UserLayout); superadmin pode ler.
- **Observações**: staff não pode ler — impede exibir contato do comunicante de óbito (decisão a revisar com base legal adequada).

## A.4 `cemeteries/{id}`
- **Campos**: `tenantId`, `name`, `address`, `capacity?`, `type?` (publico|particular|concessao), `adminUid?`, `latitude/longitude?`, `coordinates{lat,lng}?` (duplicação de representação!), `createdBy`, `createdAt`, `updatedAt/updatedBy` (em updates).
- **Escrita**: CemeteryList (create/update), deleteCemetery.
- **Leitura**: pública. Consumida por AdminContext, DeceasedForm, AdminReportDeath, ReportDeath (todas), CommunicatedDeaths.
- **Observações**: dois formatos de coordenada (`latitude/longitude` e `coordinates`) gravados simultaneamente (`CemeteryList.tsx:95-97`) — consumidores precisam checar ambos (e o card da lista de fato checa os dois, linhas 191-199). Padronizar.

## A.5 `sectors/{id}`
- **Campos**: `tenantId`, `cemeteryId`, `name`, `type` (ground|vertical|ossuary), `capacity`, `centerLat/centerLng?`, `gridRows/gridCols?`, `createdAt/createdBy`.
- **Escrita**: CemeteryDetail. **Leitura**: pública (regra), usada por CemeteryDetail/CommunicatedDeaths/Inventory.
- **Observações**: `occupiedCount` declarado na interface (`cemeteryService.ts:41`) e nunca calculado/gravado — contagem é derivada client-side.

## A.6 `plots/{id}` — a coleção mais rica do sistema
- **Campos**: `tenantId`, `sectorId`, `cemeteryId`, `code`, `sectorName?`, `type` (Jazigo|Mausoleu|Ossuario — valores em PT com inicial maiúscula, destoando dos demais enums em EN), `status` (available|occupied|reserved|blocked), `deceasedId?`, `occupantName?`, `row/column?`, `latitude/longitude?`, `sanitaryRisk`, `environmentalRisk`, `structuralStatus`, `documentStatus`, `lastInspectionAt?` (nunca gravado por ninguém), `burialDate?`, `exhumationDeadlineYears?`, `concessionHolder?`, `concessionStartDate/EndDate?`, `concessionType?`, `notes?` (gravado pelo PlotModal sem estar na interface), `createdAt/updatedAt`.
- **Escrita**: createSector (geração em massa), InventoryPage, CemeteryDetail, allocateNotification, createPlotConcession (sync).
- **Leitura**: Inventory, CemeteryDetail, snapshot (paginado), exhumation alerts, CommunicatedDeaths (por setor).
- **Integridade**: `deceasedId` pode apontar para doc apagado (delete de falecido não limpa); `occupantName` duplicado do deceased (desnormalização sem sincronização em update); mudanças manuais de status não limpam vínculos; `lastInspectionAt` morto.

## A.7 `plot_concessions/{id}`
- **Campos**: `tenantId`, `plotId`, `cemeteryId`, `holderName`, `holderDocument?` (CPF — sensível), `concessionType`, `startDate`, `endDate?`, `transferredFrom?`, `notes?`, `createdAt/createdBy`.
- **Escrita**: `createPlotConcession` — **sem nenhuma UI que a chame**. **Leitura**: `listPlotConcessions` — idem.
- **Observações**: feature de histórico de concessão pronta no service e invisível no produto.

## A.8 `deceaseds/{id}`
- **Campos**: `tenantId`, `name`, `dateOfBirth`, `dateOfDeath`, `cemeteryId?`, `plotId?`, `causeOfDeath?` (sensível), `photoUrl?`, `hobbies?`, `city/state?`, `familyMembers?` (sensível), `profession?`, `achievements?`, `obituary?`, `epitaph?`, `wakeDate/wakeTime/wakeLocation?`, `documents[{name,url}]`, `createdAt/createdBy`, `updatedAt/updatedBy`.
- **Escrita**: DeceasedForm, AdminReportDeath, allocateNotification; delete via DeceasedList.
- **Leitura**: staff do tenant (lista limitada a 50; detalhe por id).
- **Observações**: fallback perigoso `tenantId: tenantId || auth.currentUser?.uid || 'default'` (`deceasedService.ts:132`) — resíduo do modo demo; se algum caminho passar tenantId nulo, cria registro fora de qualquer tenant real (a regra de create barraria para não-staff, mas um staff com claims quebrados criaria lixo). Remover o fallback e falhar explicitamente.

## A.9 `public_deceaseds/{id}` (projeção LGPD)
- **Campos**: `tenantId`, `name`, `dateOfBirth`, `dateOfDeath`, `city`, `state`, `photoUrl`, `cemeteryId`, `updatedAt` — whitelist em `deceasedService.ts:53`.
- **Escrita**: `syncPublicDeceased` (create/update de deceased com tenant), `removePublicDeceased` (delete), script de backfill.
- **Leitura**: pública (SearchPage).
- **Observações**: sync é best-effort com erro silenciado até em produção — uma regra negando (ex.: staff sem claim correto) deixa a busca pública dessincronizada sem alerta. `dateOfBirth` completo público é questionável (basta ano, como o Jardim exibe); reduzir a projeção.

## A.10 `death_notifications/{id}`
- **Campos**: `tenantId`, `createdBy`, `createdAt`, `status` (submitted|reviewing|allocated|rejected), `cemeteryId?`, `deceased{name, dateOfBirth, dateOfDeath, city?, state?, profession?, hobbies?, familyMembers?, achievements?, obituary?, epitaph?, relationshipType?, relationshipLabel?}`, `photoUrl`, `documents[]`, `allocation{cemeteryId, sectorId, plotId, plotCode?, assignedBy, assignedAt}?`, `deceasedId?` (pós-alocação), `rejectionReason?`, `updatedAt/updatedBy` (na rejeição).
- **Escrita**: ReportDeath (create), CommunicatedDeaths (allocate/reject), GardenOfMemories (delete direto).
- **Leitura**: dono (Garden, VirtualAssistant) e staff (CommunicatedDeaths); índices compostos ok.
- **Observações**: estado `reviewing` inalcançável pela UI; delete do dono permitido só em `rejected` (regra) — a UI do Garden espelha isso corretamente, exceto pela lista errada de roles staff.

## A.11 Coleções `sci_*` (12 coleções)
- `sci_operational_records`: `type` (burial|exhumation|schedule|flow|maintenance|document_issue), `title`, `description?`, `status`, `priority`, `scheduledFor?`, `completedAt?` (nunca gravado), `responsible?`, `plotId?` — texto livre.
- `sci_occurrences`: `category` (8 valores), `severity`, `status`, `title`, `description?`, `location?`, `plotId?/sectorId?`, `photoUrls?` (nunca gravado — não há upload de foto de ocorrência), `slaDeadline?`, `resolvedBy?` (nunca gravado), `openedAt?`, `resolvedAt?` (nunca gravado — resolver não grava timestamp!).
- `sci_internal_notifications`: `title`, `message`, `audience`, `level`, `status` — "enviar" não envia nada a ninguém (não há inbox de operador; a notificação interna é só um registro).
- `sci_sanitary_checks` / `sci_environmental_checks`: estrutura idêntica (`checkType` diferencia) em coleções separadas.
- `sci_financial_records`: `description`, `category` (income|expense), `referenceType`, `value` (number — sem validação de sinal), `occurredAt`, `aiAudited?` (sempre falso).
- `sci_stock_items`: `name`, `category`, `quantity`, `minQuantity`, `unit` — sem movimentações.
- `sci_documents`: `title`, `documentType`, `relatedEntityId?` (livre), `fileName/fileUrl?`, `status`, `notes?`, `issuedAt/expiresAt?`.
- `sci_ai_agents`: `name`, `mode`, `objective`, `prompt`, `modules[]`, `isActive`.
- `sci_reports`: `type`, `generatedAt/generatedBy`, `summary` (texto), `payload` (snapshot inteiro — cresce com o tenant; considerar não persistir o payload bruto).
- `sci_support_tickets` / `sci_training_sessions`: conforme seção 1.8.
- **Regras**: todas idênticas staff-do-tenant; **nenhuma validação de schema**; sem índices (ordenação em memória).
- **Timestamps semânticos ausentes**: `resolvedAt`, `completedAt`, `resolvedBy` existem nos modelos e nunca são preenchidos pelos handlers de status — impossibilitando métricas de SLA reais no futuro sem migração.

## A.12 `audit_logs/{id}`
- **Campos gravados**: `action`, `actorUid`, `targetCollection`, `targetId`, `changedFields[]` (nomes), `timestamp`, `tenantId`.
- **Campos que o monitor espera e não existem**: `createdAt`, `userRole`, action `LOGIN_FAILED`, action `GEMINI_API_CALL`.
- **Cobertura**: writes de cemetery/sector/plot/deceased/concession/SCI ✅; notificações (reject/delete), superadmin, auth ❌.

## A.13 Coleções fantasma (referenciadas, nunca alimentadas)
`requests`, `funeral_plans`, `memorial_visits`, `memorial_photos`, `memorials`, `tributes` — possuem regras e/ou consultas de monitor, zero produtores. Decidir: implementar (requests e memorials têm valor claro — seção 6) ou remover consultas/regras para reduzir superfície.

## A.14 Coleções de monitoramento
`monitor_metrics` (doc `current`), `monitor_history`, `monitor_alerts`, `monitor_function_errors`, `_monitor` — escritas só por Admin SDK, leitura superadmin. Sem TTL/limpeza exceto `cleanOldHistory` (>30d, em lotes de 100 por execução diária — se acumular mais de 100/dia, nunca alcança; hoje irrelevante pois só 1 ponto/dia é gravado).

---

# ANEXO B — CATÁLOGO DETALHADO DE DEFEITOS E CORREÇÕES

Cada entrada: **Local** → Sintoma → Causa → Correção sugerida. Numeração D-xx (defeitos funcionais), S-xx (segurança), P-xx (performance), Q-xx (qualidade/DX), U-xx (UX). Complementa (não substitui) o ranking da seção 8; aqui está o "como corrigir".

## B.1 Defeitos funcionais

**D-01 · `CemeteryList.tsx:119-130`** — Exclusão de cemitério em um clique. Causa: `handleDelete` chamado direto no onClick da lixeira. Correção: estado `pendingDelete: Cemetery|null` + modal de confirmação exigindo digitar o nome do cemitério (padrão para cascades grandes); manter as pré-checagens do service.

**D-02 · `DeceasedList.tsx:132-137`** — Exclusão de falecido em um clique dentro do dropdown. Correção: mesmo modal de confirmação; adicionalmente `deleteDeceased` deve (a) buscar o deceased, (b) se `plotId`, limpar `status/deceasedId/occupantName/burialDate` do plot na MESMA batch, (c) deletar os arquivos do Storage listados em `documents[]` e `photoUrl` (via `deleteObject` com a ref extraída da URL ou, melhor, passando a armazenar o `fullPath`).

**D-03 · `SecurityPage.tsx:52-74`** — Registro de incidente falha em silêncio com "Todas as unidades". Correção: replicar o guard+toast padrão; adicionar toasts em `updateStatus`; considerar `disabled` no submit quando `selectedCemeteryId==='all'` com tooltip.

**D-04 · `notificationService.ts:155-221`** — Alocação não-atômica sem recheck. Correção: `runTransaction`: ler plot → validar `status==='available'` (senão abortar com erro claro "Jazigo acabou de ser ocupado") → set deceased (doc pré-gerado com `doc(collection(db,'deceaseds'))`) → update plot → update notification. Audit e syncPublic fora da transação (best-effort). Aceitar `burialDate` como parâmetro do modal (novo campo de data no formulário de alocação).

**D-05 · `deceasedService.ts:76-85`** — `limit(50)` sem paginação. Correção: cursor com `startAfter` + botão "Carregar mais" (ou paginação numerada); expor `search` server-side via campo `nameLowercase` gravado no create/update (backfill via script análogo ao de `public_deceaseds`).

**D-06 · Ausência de edição de falecido** — Correção: rota `/admin/falecidos/:id/editar`; reutilizar `DeceasedForm` com `defaultValues` e modo update chamando `updateDeceased` (já sincroniza projeção pública).

**D-07 · `InventoryPage.tsx:154-166`** — `handleStatusChange` para `available` mantém vínculos. Correção: quando novo status for `available`, incluir `{deceasedId: deleteField(), occupantName: deleteField(), burialDate: deleteField()}` (importar `deleteField` de firestore); quando `occupied` manualmente, exigir vincular um deceased ou pelo menos `occupantName`+`burialDate`.

**D-08 · `InventoryPage.tsx:98-102`** — Filtro de risco com OR entre dimensões. Correção: separar em dois selects (dimensão + nível) ou definir "risco geral = max(sanitary, environmental, structural-mapeado)" e filtrar por esse valor calculado.

**D-09 · `cemeteryService.ts:304-307`** — `deleteSector` deixa plots órfãos. Correção: contar plots do setor; se >0, ou bloquear ("exclua/mova os jazigos antes") ou cascade em batch com a mesma proteção de ocupados usada em `deleteCemetery`.

**D-10 · `CommunicatedDeaths.tsx:322`** — Aviso de "nenhum jazigo disponível" só quando `plots.length===0`. Correção: `const available = plots.filter(p=>p.status==='available')` e basear select+aviso em `available`.

**D-11 · `OperationalPage.tsx:60`** — `recordForm.plotId` sem input no form. Correção: ou renderizar um seletor de jazigo (combobox buscando plots da unidade) ou remover do estado.

**D-12 · Estados semânticos nunca gravados** (`resolvedAt/resolvedBy` em ocorrências, `completedAt` em operacionais). Correção: nos handlers de status, quando novo status for `resolved`/`done`, gravar também `resolvedAt/completedAt: serverTimestamp()` e `resolvedBy: uid`.

**D-13 · `functions/src/index.ts:114-117`** — `addUserToTenant` fixa role manager. Correção: aceitar `role: 'manager'|'operator'` validado; UI do superadmin com select; complementar com function `setTenantUserRole`.

**D-14 · `toggleManagerStatus`** — desativar tenant não desativa logins secundários. Correção: iterar `profiles` do tenant e desabilitar todos (como o delete já faz), ou checar `tenants.active` nas rules (`get(/tenants/$(tenantId)).data.active == true` nas funções isManager/isOperator — custo de 1 read por request, avaliar).

**D-15 · `ReportsPage`/`sciService.buildReportSummary`** — 6 tipos = 1 conteúdo. Correção: por tipo, selecionar seções do snapshot (financeiro → receitas/despesas/por referenceType; sanitário → checks abertos + plots de risco com lista; jurídico → concessões vencendo + pendências documentais), aceitar `from/to` filtrando por `occurredAt/createdAt`.

**D-16 · `AgentsPage.tsx:148`** — Mensagem cita "chave Gemini". Correção: mensagem neutra ("Serviço de IA indisponível — tente novamente ou contate o suporte") — o gestor não configura chave nenhuma.

**D-17 · `LoginPage.tsx:51`** — redirect não inclui `operator`. Correção: usar um util único `getHomeForRole(role)` compartilhado entre LoginPage e ProtectedRoute, com o conjunto canônico de roles.

**D-18 · `GardenOfMemories.tsx:84`** — lista de roles staff divergente. Correção: importar constante única `STAFF_ROLES` de `lib/roles.ts` (criar) usada por App, Garden, Login.

**D-19 · `deceasedService.ts:132`** — fallback `tenantId || uid || 'default'`. Correção: `if (!tenantId) throw new Error('Tenant não identificado')` — os três call-sites sempre têm tenant de staff.

**D-20 · `AdminDashboard.tsx:156`** — ID cru da unidade. Correção: `cemeteries.find(c=>c.id===selectedCemeteryId)?.name ?? 'Todas as unidades'` — o array já está no contexto. Aplicar também em `ReportsPage` (linha 117) e `buildReportSummary`.

## B.2 Segurança

**S-01 · `deploy-pages.yml:36`** — Remover linha do secret Gemini; revogar a chave no console GCP; migrar config Firebase para `vars.*` como o README instrui (ou aceitar hardcode e corrigir o README — mas não os dois divergentes).

**S-02 · `storage.rules`** — Adicionar em todos os matches de escrita: `request.resource.size < 10 * 1024 * 1024` e `request.resource.contentType.matches('application/pdf|image/(jpeg|png|webp)')`. Adicionar comparação de tenant: exigir metadado custom `tenantId` no upload (o cliente passa via `uploadBytes(ref, file, {customMetadata:{tenantId}})`) e conferir `request.auth.token.tenantId == request.resource.metadata.tenantId` para escrita staff; para leitura staff, `resource.metadata.tenantId == request.auth.token.tenantId`.

**S-03 · `functions/src/index.ts:574-579`** — `manualMonitorTrigger` fail-open. Correção: `if (!token) { res.status(503).json({error:'Trigger desabilitado'}); return; }`.

**S-04 · Functions de IA sem controle** — Correção mínima: em `chatWithManagerAgent`, exigir `['manager','gestor','superadmin'].includes(request.auth.token.role)`; rate-limit: doc `ai_usage/{uid}` com contador diário incrementado em transação, rejeitar acima de N; registrar cada chamada em `audit_logs` com action `AI_CALL` (de quebra, conserta a métrica do monitor).

**S-05 · `firestore.rules:84-85`** — cláusula `managersUid` morta. Correção: remover (deixar staff-only explícito) até existir o conceito de família gestora do registro.

**S-06 · `firestore.rules:100-105`** — `tenantId` de notificação não validado. Correção (opção A, sem get): mover a criação para Cloud Function `submitDeathNotification` que resolve o tenant do cemitério server-side; (opção B): `request.resource.data.tenantId == get(/databases/$(database)/documents/cemeteries/$(request.resource.data.cemeteryId)).data.tenantId`.

**S-07 · `scripts/superadmin-claim.json`** — apagar; se o repositório for público, reescrever histórico ou rotacionar a conta.

**S-08 · `set-superadmin.cjs:27`** — trocar `admin@memorial.com` por parâmetro CLI (`process.argv[2]`) com validação, evitando promover a conta do antigo backdoor por engano.

**S-09 · Enumeração de e-mail no reset (`LoginPage.tsx:38-44`)** — responder sempre "Se o e-mail existir, você receberá o link".

**S-10 · Sem App Check** — habilitar reCAPTCHA v3/Enterprise para Firestore/Storage/Functions em produção.

**S-11 · Rules sem validação de schema nas coleções centrais** — adicionar às regras de `plots` e `sci_financial_records` validações de tipo: `request.resource.data.value is number && request.resource.data.value >= 0`, `request.resource.data.status in ['available','occupied','reserved','blocked']`, `request.resource.data.cemeteryId != 'all'`.

## B.3 Performance

**P-01 · Snapshot baixa todos os plots** — migrar contadores para `getCountFromServer` com queries por status (4 counts) e por flags de risco (3 counts) — de O(N docs) para O(1) por contador; manter a lista completa só para o mapa (e ali, por cemitério/setor).

**P-02 · `getMonthlyBurialTrend` fora do cache** — incluir `operational` do snapshot cacheado como parâmetro, eliminando o segundo full-scan do dashboard.

**P-03 · Uploads sequenciais** — `await Promise.all(files.map(upload))` em `deceasedService.createDeceased` e `notificationService.createDeathNotification`.

**P-04 · `App.tsx` sem code splitting** — `const AdminLayout = React.lazy(...)` etc. por área + `<Suspense fallback={<LoadingSpinner/>}>` (finalmente dando uso ao spinner).

**P-05 · Mapa com milhares de nós** — acima de ~500 plots visíveis, agregar por setor (círculo com contagem) e detalhar ao "zoom" (filtro por setor).

**P-06 · Cemitérios re-buscados em 4 telas** — consumir `useAdmin().cemeteries`; `ReportDeath` (público de tenant nenhum) mantém `getAllCemeteries` mas com `limit(100)` e projeção.

**P-07 · Objeto `payload` completo do snapshot persistido em cada `sci_report`** — armazenar apenas os KPIs usados no summary (o payload atual cresce linearmente com o número de plots... na verdade o snapshot agregado é pequeno, mas `priorities` + números ok; revisar se `payload` inclui listas — hoje inclui apenas agregados: risco baixo; manter em observação).

## B.4 Qualidade / DX

**Q-01 · Adotar o trio já escrito**: substituir as ~10 tabelas SCI por `SCITable`, os 13 `useMemo` de filtro por `useCemeteryFilter`, aplicar `useModal` nos ~9 modais restantes. É refactor mecânico com redução estimada de 800-1000 linhas.

**Q-02 · `createSciHandler` genérico**: `function useSciCreate<T>(createFn, resetValue, successMsg)` encapsulando guard+saving+toast+reset+reload — elimina as 11 cópias.

**Q-03 · `lib/errors.ts`**: `getFirestoreErrorMessage(e)` centralizando o ternário de permission-denied (13 cópias).

**Q-04 · `lib/roles.ts`**: `export const STAFF_ROLES = ['superadmin','manager','operator'] as const` + tipo `Role`; remover as variantes PT de rules/rotas após migrar os claims existentes (script one-shot listando usuários com claims `gestor/operador` — hoje provavelmente zero, pois só as functions atuais emitem claims).

**Q-05 · Tipos**: instalar `@types/react @types/react-dom`; trocar `any[]` pelos tipos do service (mecânico — os tipos existem); `createdAt?: Timestamp` via `import type { Timestamp } from 'firebase/firestore'`.

**Q-06 · Limpeza**: deletar `HomePage.tsx`, `QRCodeGenerator.tsx` (ou usá-lo no memorial da Onda 4), `functions/index.js`, `functions/lib` do git (adicionar a `functions/.gitignore` — que aliás já deveria cobrir), `superadmin-claim.json`, `validationSchemas.ts` (ou aplicar os schemas), deps não usadas.

**Q-07 · ESLint/Prettier/husky** conforme 7.3; regra `no-alert` ligada resolve as regressões de alert().

**Q-08 · Renomear `package.json`** para `memorialos`, versão real, e adicionar scripts `test`, `lint` (eslint) e `typecheck` separados.

## B.5 UX fino (complementos ao ranking)

**U-01 · `OperationalPage` tabs**: mostrar contagem por aba (ex.: "Ocorrencias (3)") — o dado já está em memória.

**U-02 · Kanban**: permitir voltar status (done → in_progress) — hoje só avança; erros de clique são irreversíveis sem ir ao Operacional.

**U-03 · `DocumentsCenterPage`**: mostrar badge de vencido quando `expiresAt < hoje` (uma linha de classe condicional, alto valor).

**U-04 · `FinancialPage`**: linha de totais no rodapé da tabela (receitas, despesas, saldo do filtro atual).

**U-05 · `SearchPage`**: debounce + busca ao digitar (min 3 chars já existe), destaque do termo, e mensagem distinta para erro de rede vs zero resultados.

**U-06 · `VirtualAssistant`**: persistir histórico em sessionStorage; corrigir animação dos três pontos com `[animation-delay:150ms]` arbitrary values do Tailwind.

**U-07 · `UserHomePage`**: pausar carrossel em hover/focus e respeitar `prefers-reduced-motion`.

**U-08 · `GardenOfMemories`**: reduzir os 3 CTAs idênticos a 1; adicionar filtro por status.

**U-09 · `SuperAdminPage`**: trocar `window.confirm` por modal com aviso honesto do que é/não é excluído (enquanto D-23/cascade não é feito).

**U-10 · `UnauthorizedPage`**: derivar destino do botão pelo role (staff → /admin, cidadão → /app).

---

# ANEXO C — INVENTÁRIO DE ARQUIVOS (116 ARQUIVOS VERSIONADOS)

Classificação: ✔ saudável · ⚠ com problemas apontados neste relatório · ✖ morto/resíduo · ◌ config/infra.

## C.1 Raiz e configuração
| Arquivo | Linhas | Estado | Nota |
|---|---|---|---|
| `package.json` | 46 | ⚠ | nome "react-example"; deps no lugar errado; sem test/lint reais (3.6, Q-08) |
| `package-lock.json` | — | ◌ | |
| `tsconfig.json` | 29 | ⚠ | sem strict; sem @types/react instalados (3.8) |
| `vite.config.ts` | 23 | ✔ | base dinâmica p/ GitHub Pages ok |
| `index.html` | 13 | ⚠ | sem favicon/meta description/OG |
| `metadata.json` | 5 | ◌ | resíduo AI Studio |
| `.env.example` | 17 | ⚠ | menciona config Gemini via functions:config (obsoleto — backend usa OPENROUTER_API_KEY secret); não documenta VITE_APP_LOGO_URL |
| `.gitignore` | 16 | ✔ | cobre segredos; falta functions/lib |
| `.firebaserc` | 5 | ◌ | projeto memorialos |
| `firebase.json` | 22 | ✔ | rules+indexes+functions |
| `firestore.rules` | 310 | ⚠ | análise completa em 5.1 |
| `firestore.indexes.json` | 29 | ✔ | cobre o frontend; não cobre o monitor (1.22) |
| `storage.rules` | 76 | ⚠ | sem size/type; isStaff sem tenant (5.2) |
| `README.md` | 84 | ⚠ | 3 instruções obsoletas (7.5) |
| `IMPLEMENTACAO_STATUS.md` | 71 | ⚠ | afirmações divergentes do código (7.5) |
| `PLANO_CORRECOES_MEMORIAL.md` | 2640 | ◌ | plano histórico; mover p/ docs/ |
| `docs/VISION.md` | 118 | ✔ | norte de produto válido |
| `docs/FIREBASE_INDEXES.md` | 31 | ✔ | |
| `.claude/launch.json` | 17 | ◌ | |
| `.github/workflows/deploy-pages.yml` | 72 | ⚠ | secret Gemini; config hardcoded; sleep 120 (S-01, 7.4) |

## C.2 `src/` — núcleo
| Arquivo | Linhas | Estado | Nota |
|---|---|---|---|
| `main.tsx` | 10 | ✔ | |
| `App.tsx` | 167 | ⚠ | sem lazy; roles PT/EN; placeholders (1.17/1.18, P-04) |
| `index.css` | 17 | ✔ | |
| `contexts/AuthContext.tsx` | 71 | ⚠ | catch silencioso de claims; role default client-side (3.9, 5.7) |
| `contexts/AdminContext.tsx` | 54 | ⚠ | seleção não persiste; catch silencioso (2.6, 3.9) |
| `components/ProtectedRoute.tsx` | 25 | ✔ | |
| `components/AppLogo.tsx` | 38 | ⚠ | asset /logo-flower.png inexistente (2.1) |
| `components/MapPicker.tsx` | 71 | ✔ | melhor referência de Leaflet do projeto |
| `components/QRCodeGenerator.tsx` | 46 | ✖ | não usado; download stub com alert (3.10) |
| `components/admin/SCITable.tsx` | 63 | ✖ | escrito e nunca adotado (Q-01) |
| `components/ui/LoadingSpinner.tsx` | 11 | ✖ | só citado pelo SCITable morto |
| `components/ui/StatCardSkeleton.tsx` | 8 | ✔ | usado no dashboard |
| `hooks/useModal.ts` | 18 | ⚠ | usado em 1 de ~10 modais |
| `hooks/useCemeteryFilter.ts` | 12 | ✖ | 0 imports (3.2) |
| `layouts/AdminLayout.tsx` | 178 | ⚠ | sidebar 16 itens; sem acentos; select sem aria (2.2/2.3/2.8) |
| `layouts/UserLayout.tsx` | 148 | ⚠ | SidebarContent inline; overlay não focável (4.3/2.8) |
| `layouts/PublicLayout.tsx` | 79 | ⚠ | 5 links de footer quebrados; imports não usados (1.18, 3.10) |
| `lib/firebase.ts` | 40 | ⚠ | `export default app!` (3.8) |
| `lib/utils.ts` | 6 | ✔ | cn() |
| `lib/formatters.ts` | 13 | ⚠ | subutilizado (2.10.9) |
| `lib/statusLabels.ts` | 18 | ⚠ | cobre 3 de ~8 conjuntos (2.2) |
| `lib/queryCache.ts` | 27 | ✔ | TTL+prefixo corretos |
| `lib/fileValidation.ts` | 17 | ⚠ | aplicado em 2 de 5 uploads (5.6) |
| `lib/validationSchemas.ts` | 21 | ✖ | ambos schemas sem uso (3.10) |

## C.3 `src/services/`
| Arquivo | Linhas | Estado | Nota |
|---|---|---|---|
| `cemeteryService.ts` | 408 | ⚠ | deleteSector órfãos; profiles negado por rules; coordenadas duplicadas (D-09, 5.1, A.4) |
| `deceasedService.ts` | 170 | ⚠ | limit 50; fallback tenant; delete sem cascade (D-02/05/19) |
| `notificationService.ts` | 245 | ⚠ | alocação não transacional; reject/delete sem audit (D-04, 5.9) |
| `sciService.ts` | 820 | ⚠ | melhor arquivo do projeto; duplicação exumação; listas sem limite (3.2.8, 4.1) |
| `aiService.ts` | 60 | ✔ | wrapper fino correto |
| `audit.ts` | 55 | ⚠ | ignora oldValue/newValue (5.9) |
| `userProfileService.ts` | 75 | ✔ | |
| `superadminService.ts` | 62 | ✔ | wrappers de callables |

## C.4 `src/pages/` (estado consolidado — detalhes nas seções 1 e 2)
| Página | Linhas | Estado | Problemas-chave |
|---|---|---|---|
| `admin/AdminDashboard.tsx` | 496 | ⚠ | ID cru; "IA" rotulada; bloco inalcançável; checklist duplicado |
| `admin/OperationalPage.tsx` | 549 | ⚠ | schema zod não usado; plotId fantasma; datas ISO |
| `admin/InventoryPage.tsx` | 698 | ⚠ | pseudo-mapa; filtro de risco; status→available; IA fake |
| `admin/FinancialPage.tsx` | 219 | ⚠ | preços hardcoded; projeção fake; aiAudited fantasma; sem loading |
| `admin/MaintenancePage.tsx` | 299 | ⚠ | estoque sem movimentação |
| `admin/EnvironmentalPage.tsx` | 381 | ⚠ | abas duplicadas; status EN cru |
| `admin/DocumentsCenterPage.tsx` | 201 | ⚠ | status EN; relatedEntityId livre; sem vencimento |
| `admin/SupportPage.tsx` | 266 | ⚠ | status EN; chamado sem destino |
| `admin/SecurityPage.tsx` | 201 | ⚠⚠ | falha silenciosa; câmera e matriz fake |
| `admin/AgentsPage.tsx` | 275 | ⚠ | sem feedback create/toggle; msg Gemini |
| `admin/ReportsPage.tsx` | 148 | ⚠ | 6 tipos = 1 conteúdo; sem toasts |
| `admin/PartnersPage.tsx` | 55 | ✖ | 100% mock, botões inertes |
| `admin/DeceasedList.tsx` | 150 | ⚠⚠ | delete sem confirm; 50 fixos; IDs crus |
| `admin/DeceasedDetail.tsx` | 119 | ⚠ | campos faltantes; sem editar |
| `admin/DeceasedForm.tsx` | 225 | ✔ | melhor formulário do sistema |
| `admin/CommunicatedDeaths.tsx` | 371 | ✔⚠ | melhor tela; solicitante anônimo; aviso de plots errado |
| `admin/CemeteryList.tsx` | 291 | ⚠⚠ | delete sem confirm; loading/empty ausentes |
| `admin/CemeteryDetail.tsx` | 525 | ⚠ | alert/confirm nativos; delete plot silencioso |
| `admin/AdminReportDeath.tsx` | 389 | ⚠ | alert; sem isSubmitting; plot não sincronizado |
| `superadmin/SuperAdminPage.tsx` | 660 | ⚠ | cascade incompleta; erros silenciosos |
| `superadmin/MonitoringDashboard.tsx` | 549 | ⚠ | UI boa sobre dados fictícios |
| `auth/LoginPage.tsx` | 195 | ✔⚠ | referência de feedback; enumeração no reset |
| `auth/RegisterPage.tsx` | 143 | ⚠ | sem termos/verificação de e-mail |
| `auth/UnauthorizedPage.tsx` | 30 | ✔ | |
| `public/LandingPage.tsx` | 141 | ✔ | sem acentos |
| `public/SearchPage.tsx` | 157 | ⚠ | 200 docs client-side; erro vira "sem resultado" |
| `public/HomePage.tsx` | 133 | ✖ | não roteada; mocks picsum |
| `user/UserHomePage.tsx` | 156 | ✔⚠ | carrossel sem pausa |
| `user/ReportDeath.tsx` | 485 | ⚠⚠ | alert; duplo-submit; objectURL leak; sem validateFile |
| `user/GardenOfMemories.tsx` | 396 | ✔⚠ | roles divergentes; deleteDoc direto |
| `user/VirtualAssistant.tsx` | 161 | ✔ | |
| `user/ShopAndServices.tsx` | 344 | ✖⚠ | e-commerce inteiro simulado |
| `user/ProfilePage.tsx` | 217 | ⚠ | alert; objectURL; sem validação |

## C.5 `functions/`
| Arquivo | Linhas | Estado | Nota |
|---|---|---|---|
| `functions/src/index.ts` | 640 | ⚠ | trigger fail-open; IA sem rate-limit/role; addUser fixa manager |
| `functions/src/monitoring/technicalMonitor.ts` | 259 | ⚠ | campos inexistentes (audit_logs.createdAt, LOGIN_FAILED, GEMINI_API_CALL, lastLoginAt) |
| `functions/src/monitoring/operationalMonitor.ts` | 238 | ⚠ | status 'aguardando_validacao'; coleções requests/funeral_plans; userRole |
| `functions/src/monitoring/memorialMonitor.ts` | 314 | ⚠ | photoURL vs photoUrl; coleções memorial_visits/photos/funeral_plans |
| `functions/src/monitoring/alertService.ts` | 183 | ✔ | Evolution API bem encapsulada — reutilizável p/ cidadão |
| `functions/src/monitoring/dashboardService.ts` | 168 | ✔⚠ | cleanOldHistory limitado a 100/dia |
| `functions/src/monitoring/types.ts` | 90 | ✔ | |
| `functions/index.js` | 113 | ✖ | backend v1 inteiro morto; README ainda o referencia |
| `functions/lib/**` (12 arquivos) | — | ✖ | build output commitado |
| `functions/package.json` | 23 | ⚠ | @google/genai órfão |
| `functions/tsconfig.json` | 15 | ✔ | strict ligado (ironicamente, só no backend) |
| `functions/.env.example` | 17 | ✔ | |

## C.6 `scripts/`
| Arquivo | Estado | Nota |
|---|---|---|
| `backfill-public-deceaseds.cjs` | ✔ | correto, com batches |
| `migrate-tenant-ids.ts` | ✔ | one-shot com --confirm; apagar após uso |
| `set-superadmin.cjs` | ⚠ | e-mail hardcoded do ex-backdoor (S-08) |
| `superadmin-claim.json` | ✖ | credencial residual commitada (S-07) |

---

# ANEXO D — MÉTRICAS DA BASE DE CÓDIGO

- **Linhas de código fonte** (sem lockfiles, sem `functions/lib`, sem o plano de 2.640 linhas): ~15.900.
- **Páginas React**: 30 (26 roteadas + 1 morta + 2 ComingSoon + 1 Placeholder de memorial).
- **Coleções Firestore com produtores reais**: 22. **Coleções fantasma** (regras/consultas sem produtor): 6.
- **Cloud Functions deployáveis**: 12 (6 admin de tenants, 3 IA, 3 monitor/schedulers + trigger + callable).
- **Componentes reutilizáveis efetivamente reutilizados**: 4 (AppLogo, MapPicker, StatCardSkeleton, ProtectedRoute) de 8 escritos.
- **Handlers de criação duplicados**: 11. **Filtros scoped duplicados**: 13. **catch silenciosos mapeados**: 34.
- **Cobertura de testes**: 0%. **Regras testadas**: 0. **Pipelines de qualidade**: 0.
- **Uso de `alert()/window.confirm`**: 6 arquivos. **Exclusões sem confirmação**: 2 (as mais destrutivas).
- **Índice de aderência à VISION.md** (estimativa por jornada): J1 estrutura ✅ 90% · J2 sepultamento ⚠ 60% (via notificação) · J3 memorial ❌ 5% · J4 localização ❌ 15% (dados existem, UX não) · J5 solicitações ❌ 0%.

*Fim do relatório.*

---

# ANEXO E — UI/UX TELA A TELA (DETALHAMENTO COMPLEMENTAR DA SEÇÃO 2)

A seção 2 analisou os eixos transversais; este anexo percorre cada tela individualmente com observações específicas de layout, microcopy, interação e acessibilidade que não couberam na visão agregada.

## E.1 LandingPage (`/`)
- Estrutura hero → features → CTA de busca → como funciona: correta e escaneável; hierarquia tipográfica boa (h1 serif 4xl/5xl).
- Microcopy sem acentuação em 100% dos textos ("memorias", "voce", "gestao") — primeira impressão do produto comprometida.
- Os dois CTAs do hero têm pesos visuais certos (primário preenchido, secundário outline).
- `FeatureCard`/`StepCard` locais e limpos; poderiam ser os primeiros habitantes de um `components/marketing/`.
- Falta: seção de prova social/para prefeituras (o produto vende para dois públicos e a landing só fala com famílias); rodapé com links quebrados logo abaixo (PublicLayout).

## E.2 SearchPage (`/buscar`)
- Formulário central com ícone, estados de botão disabled corretos, contagem de resultados no plural bem tratada (linha 110).
- Cards de resultado com foto/fallback e metadados — bom padrão visual.
- Problemas específicos: resultado não é clicável (dead-end — deveria abrir o memorial); "minimo 3 caracteres" no placeholder é a única indicação da regra (se o usuário digitar 2 e clicar, nada explica o disable); datas exibidas cruas ISO (linhas 137, 143); nenhum filtro (cemitério/período) apesar do dado `cemeteryId` existir na projeção.
- Acessibilidade: input sem `<label>` (placeholder-only); resultados sem landmark de região/anúncio de quantidade para leitores de tela.

## E.3 LoginPage (`/login`)
- Melhor formulário de feedback do sistema: erros por campo, erro root em caixa destacada, mapeamento de códigos Firebase para mensagens PT, loading no botão.
- Reset de senha inline com três estados (idle/sending/sent) — padrão a replicar.
- "Acesso institucional" como disclosure discreto: boa solução para não poluir o fluxo do cidadão.
- Detalhes: autofocus ausente no campo e-mail; sem "mostrar senha"; link "Esqueci minha senha" com hitbox pequena (text-xs).

## E.4 RegisterPage (`/cadastro`)
- Espelha o Login visualmente — consistência correta.
- Falta indicador de força de senha, aceite de termos (bloqueio legal — ver 5.3) e onboarding pós-cadastro (cai direto em /app sem orientação).

## E.5 UserHomePage (`/app/inicio`)
- Carrossel hero com dots clicáveis e CTA fixo — visual forte; porém texto sobre imagem com gradiente pode falhar contraste nas imagens mais claras (o gradiente cobre só a esquerda).
- Quick actions em cards com ícone: claros, títulos curtos, descrições úteis.
- "Como funciona" com passos numerados reforça o modelo mental do fluxo de óbito — bom para o público leigo.
- Ver U-07 (pausa/reduced-motion).

## E.6 ReportDeath (`/app/comunicar-obito`)
- O StepIndicator dá senso de progresso; rótulos dos passos ausentes (só números) — para 4 passos, nomeá-los ("Dados", "Homenagem", "Frase", "Revisão") reduziria ansiedade num fluxo emocionalmente pesado.
- Passo 1 é longo (11 campos + 2 uploads) — dividir em "essenciais" e "para a homenagem (opcional)" com disclosure; hobbies/realizações são opcionais mas visualmente têm o mesmo peso dos obrigatórios.
- O campo "Se for outro, descreva" fica sempre visível mesmo quando a proximidade não é "outro" — deveria aparecer condicionalmente.
- O preview do subtítulo ("Subtitulo sugerido no Jardim...") é um toque de cuidado excelente — manter.
- Passo 2: botão "Gerar com IA" roxo destoa da paleta (único uso de purple na área do usuário junto com AdminReportDeath); sem aviso de que a IA pode errar/precisar revisão.
- Passo 4 (revisão): não exibe documentos anexados nem cemitério escolhido com destaque suficiente; o aviso de que "o local será definido pelo gestor" é bom.
- Erros por `alert()` quebram totalmente o tom acolhedor da jornada.

## E.7 GardenOfMemories (`/app/memorias`)
- Os cards de memória (foto full-bleed, gradiente, nome serif, anos) são o melhor design do produto — emocionalmente adequados.
- Badge de status traduzido e com ícone: correto.
- Modal de detalhe em split (foto | conteúdo) responsivo com tratamento mobile dedicado — acima da média.
- Problemas: lixeira sobre a foto do ente é posicionamento emocionalmente infeliz (ação destrutiva sobre o rosto do falecido) — mover para o rodapé do card ou menu; 3 CTAs de criação idênticos ocupam a primeira dobra inteira antes das memórias reais; epitáfio fallback "Saudade eterna." entre aspas aparece como se a família o tivesse escrito.

## E.8 VirtualAssistant (`/app/assistente`)
- Layout de chat correto (avatares, bolhas assimétricas, auto-scroll, typing indicator).
- A mensagem automática de contexto ("Sinto muito por X. Vou responder considerando que era Y.") é bem-intencionada mas arriscada: aparece toda visita, reabrindo o luto mecanicamente; considerar exibir uma única vez ou tom mais neutro.
- Input redondo com botão circular: agradável; falta atalho de sugestões ("Como funciona o sepultamento?", "Onde fica o jazigo?").

## E.9 ShopAndServices (`/app/loja`)
- Visualmente o mais completo da área do usuário (filtros, cards com imagem, carrinho lateral, badge de contagem) — o que agrava o problema: nada é real. Se permanecer no ar, adicionar banner "Catálogo demonstrativo — pedidos indisponíveis" até a integração existir; hoje induz o usuário ao erro em momento delicado (comprar coroa para velório que não chegará).
- Checkout: inputs sem state/validação/máscara; select de pagamento decorativo.

## E.10 ProfilePage (`/app/perfil`)
- Formulário claro em grid 2 colunas com labels reais (melhor que as telas SCI!).
- Upload de foto com badge de câmera sobreposto: padrão familiar, bom.
- Falta: máscara/validação de telefone; feedback via toast (usa alert); indicação de campos que a prefeitura verá (transparência sobre uso dos dados de contato de emergência).

## E.11 AdminDashboard (`/admin/dashboard`)
- Grid 4×2 de KPIs clicáveis com microcopy de apoio sob cada número: excelente padrão executivo.
- Barra de progresso de ocupação com cor por faixa: leitura instantânea.
- Painel escuro "Prioridades IA" destaca-se bem do fundo claro — mas o rótulo IA é impróprio (1.1) e o card superlota com 4 mini-KPIs + lista + botões.
- Pizza de ocupação duplica a informação do primeiro card (taxa + barra) — substituir por algo não redundante (ex.: ocupação por cemitério em barras).
- CTA "Novo checklist" no dashboard é deslocado (tarefa de nicho na tela mais nobre) — mover para Ambiental e usar o espaço para "Óbitos aguardando análise".

## E.12 OperationalPage (`/admin/operacional`)
- 9 abas é acima do confortável; as 6 primeiras são o mesmo form/tabela com filtro — poderiam ser 1 aba "Atividades" com um select de tipo, liberando espaço para as 3 abas realmente distintas.
- Form em grid-7 numa linha: denso; em 1366px os campos ficam estreitos demais para ler os placeholders.
- Tabelas de prazos de exumação com cores de urgência (rose/amber) — comunicação certa; falta ação (D-11/seção 6.2.1) e falta ordenar visivelmente por urgência (já vem ordenado do service, mas sem indicação).

## E.13 InventoryPage (`/admin/inventario`)
- O toggle Mapa/Lista/IA no header é claro; barra de filtros bem composta (busca com ícone, 3 selects, botão).
- Mapa: legenda por cor presente; tooltips via `title` (inacessíveis em touch); pontos de 14-20px são alvos de toque pequenos; sem zoom, setores densos viram nuvem de pontos sobrepostos.
- Modal de novo jazigo: 6 seções lógicas mas sem agrupamento visual rotulado (fieldsets dariam estrutura); campos condicionais de sepultamento aparecem apenas quando status=occupied — boa progressão contextual.
- Painel de inspeção do plot: resumo em grid + badges de risco + alterar status inline: útil; falta link para o registro do falecido e histórico.

## E.14 FinancialPage (`/admin/financeiro`)
- Tabs no header à direita: consistente com Inventário/Manutenção.
- Tabela de transações com sinal/cor por categoria: leitura rápida; coluna "Auditoria" fantasma (1.4) engana.
- Cards de preço com badge "Referencial": ao menos sinaliza que não é dado real — mas o usuário não tem como saber que também não é editável.
- Aba Projeções: gradiente indigo bonito, conteúdo vazio de função — o texto promete "análise preditiva" que não existe; retirar ou reduzir a promessa.

## E.15 MaintenancePage (`/admin/manutencao`)
- Kanban de 3 colunas com dot colorido no header: legível; cartões com prioridade/data/responsável bem hierarquizados; badge "Atrasada" com ícone: ótimo detalhe.
- Botões "Iniciar/Concluir" por cartão: ação direta correta (melhor que o select das outras telas) — padronizar as demais nesse modelo.
- Estoque: badge Crítico/OK imediato; falta coluna de mínimo visível (o usuário vê "Critico" sem referência do limiar).

## E.16 EnvironmentalPage (`/admin/ambiental`)
- Forms com labels via placeholder e textareas lado a lado: aceitável; os `required` nativos dão feedback em idioma do SO.
- Tabelas com badge de risco colorido: bom; status cru em inglês ao lado (2.2) quebra.
- Aba Indicadores: cards tonais (amber/emerald/rose/slate) com número grande: bom resumo; terceira repetição do painel de prioridades no produto.

## E.17 DocumentsCenterPage (`/admin/documentos`)
- Form grid-6 com o botão "Salvar" no meio e dois date inputs órfãos na linha de baixo sem labels visíveis ("Emissão"? "Validade"? — só se descobre pelo value default): confuso; adicionar labels pequenos como o campo SLA do Operacional fez (`OperationalPage.tsx:391`).
- Tabela com link "Abrir" com ícone: claro; sem indicação de tamanho/tipo do arquivo.

## E.18 SupportPage (`/admin/suporte`)
- Estrutura espelhada nas duas abas: fácil de aprender.
- O textarea de detalhes obrigatório fica após o botão no fluxo visual do grid — mesmo defeito do Operacional.
- Tabela de chamados não mostra data de abertura nem os detalhes — as duas informações mais relevantes de um chamado.

## E.19 SecurityPage (`/admin/seguranca`)
- O painel de câmera domina 2/3 da largura em desktop para conteúdo nulo; os incidentes reais ficam num painel estreito com scroll interno de 360px.
- Badge "Ambiente seguro ativo" verde permanente: gera falsa confiança; se mantido, deveria refletir algo real (ex.: zero incidentes críticos abertos).
- Matriz de permissões como tabela estática com "OK/-": parece configurável mas não é clicável — affordance enganosa.

## E.20 AgentsPage (`/admin/agentes`)
- Layout 3 colunas (criar | lista | console): denso mas funcional em xl; em telas médias empilha razoavelmente.
- Cartões de agente com estado ativo/inativo e seleção destacada: bom; o botão "Desativar" como link de texto minúsculo destoa.
- Console de chat reaproveita o padrão do VirtualAssistant com ícones — consistência positiva entre áreas.

## E.21 ReportsPage (`/admin/relatorios`)
- Padrão master-detail (lista | conteúdo) correto para histórico de documentos.
- `<pre>` para o summary: honesto com o formato atual, mas comunica "arquivo de log", não "relatório institucional".
- Falta metadado de quem gerou (generatedBy é gravado e não exibido).

## E.22 PartnersPage (`/admin/parceiros`)
- Cards com ícone/contatos bem diagramados — infelizmente sobre dados falsos com botões inertes; affordance de clique sem ação é o pior padrão possível (usuário clica, nada acontece, culpa a si mesmo).

## E.23 DeceasedList / DeceasedDetail / DeceasedForm
- Lista: densidade adequada, ID truncado sob o nome (útil), contagem de anexos com ícone.
- Kebab menu: posicionado com z-index correto; falta fechar-fora/Esc (2.8).
- Detail: layout de ficha com dl/dt/dd semântico (raro no projeto — positivo); foto com fallback cinza.
- Form: seções com headings sublinhados, dropzone com estados hover, chips de arquivos com remoção — o melhor formulário; usar como template dos demais.

## E.24 CommunicatedDeaths
- Tabela com avatar+nome+cidade compostos na primeira célula: escaneável.
- Modal com resumo do falecido no topo (foto, datas, docs) antes das ações: dá contexto à decisão — ótimo.
- Botões Rejeitar (ghost vermelho) vs Alocar (sólido azul): pesos corretos.
- Estados desabilitados dos selects encadeados com bg diferenciado: comunica a ordem de preenchimento.

## E.25 CemeteryList / CemeteryDetail
- Cards de cemitério com ações flutuantes no hover (grupo absolute): funciona em desktop, **inacessível em touch** (hover não existe) — ações somem no tablet do gestor de campo.
- Detail: accordion de setores com barra de ocupação por cor: boa visualização; tabela de túmulos aninhada clara.
- Modais com inputs `border` sem cor (cinza browser) — únicos do sistema, parecem "sem estilo".

## E.26 SuperAdminPage / MonitoringDashboard
- SuperAdmin: hierarquia tenant→usuários com expansão inline: padrão correto para poucos tenants; faltará busca/paginação com dezenas.
- Formulários inline com validação nativa (minLength) e erro em caixa: consistente com Login.
- Monitoring: melhor uso de dataviz do projeto (área com gradiente, thresholds por cor no MetricCard via prop `color` condicional); health score circular com faixa textual: comunicação executiva boa — sobre dados fictícios (1.22).
- Tabs com contagem de alertas no label: bom padrão a copiar para o admin (U-01).

---

# ANEXO F — MATRIZ DE PERMISSÕES EFETIVA (COMO O SISTEMA REALMENTE SE COMPORTA HOJE)

Derivada do cruzamento claims emitidos (Cloud Functions) × `firestore.rules` × `storage.rules` × rotas. Diferente da matriz decorativa da SecurityPage, esta reflete o comportamento real. Legenda: ✅ permitido · ❌ negado · ⚠ permitido com ressalva · — não se aplica/sem UI.

| Recurso / Operação | Anônimo | Cidadão (sem claim) | Manager (claim real) | Superadmin |
|---|---|---|---|---|
| Ler `cemeteries`/`sectors` | ✅ | ✅ | ✅ | ✅ |
| Ler `plots` disponíveis | ❌ (exige login) | ✅ ⚠ inclusive de outros tenants | ✅ | ✅ |
| Ler `plots` ocupados (dados de ocupante) | ❌ | ❌ | ✅ só do seu tenant | ✅ |
| Ler `public_deceaseds` (busca) | ✅ | ✅ | ✅ | ✅ |
| Ler `deceaseds` completo | ❌ | ❌ (cláusula managersUid falha fechada) | ✅ tenant | ✅ |
| Criar `deceaseds` | ❌ | ❌ | ✅ | ✅ |
| Criar `death_notifications` | ❌ | ✅ ⚠ tenantId não validado | ✅ | ✅ |
| Alocar/rejeitar notificação | ❌ | ❌ (campos de controle bloqueados por diff) | ✅ | ✅ |
| Excluir notificação | ❌ | ⚠ só se rejected e própria | ✅ qualquer do tenant | ✅ |
| Ler/escrever `sci_*` | ❌ | ❌ | ✅ tenant (sem distinção manager/operator) | ✅ |
| Ler `audit_logs` | ❌ | ❌ | ✅ manager do tenant | ✅ |
| Escrever `audit_logs` | ❌ | ❌ (fluxo cidadão não auditado) | ✅ via logAction | ✅ |
| Ler `profiles` (lista do tenant) | ❌ | ❌ | ❌ ⚠ **UI tenta e falha silenciosamente** (CemeteryList) | ✅ |
| Ler `user_profiles` de terceiros | ❌ | ❌ | ❌ ⚠ impede ver contato do solicitante | ✅ |
| Ler `tenants` | ❌ | ❌ ⚠ regra citizen depende de claim inexistente | ✅ o seu | ✅ |
| Storage `documents|photos|sci-documents/{uid}` | ❌ | ✅ os seus | ✅ ⚠ **de qualquer usuário de qualquer tenant** | ✅ |
| Upload sem limite de tipo/tamanho | — | ⚠ sim | ⚠ sim | ⚠ sim |
| Callables de IA (`generateObituary`, `chatWithAI`, `chatWithManagerAgent`) | ❌ | ✅ ⚠ inclusive o agente "de gestor", sem rate-limit | ✅ | ✅ |
| Callables de tenant admin | ❌ | ❌ | ❌ | ✅ |
| `getMonitoringData` | ❌ | ❌ | ❌ | ✅ |
| `manualMonitorTrigger` (HTTP) | ⚠ **aberto se token não configurado** | idem | idem | idem |
| Rotas `/admin/*` | redirect login | redirect /acesso-negado | ✅ | ✅ |
| Rotas `/superadmin/*` | redirect | redirect | redirect | ✅ |
| Rota `/app/*` | redirect login | ✅ | ✅ ⚠ staff também acessa área do cidadão | ✅ |

Papéis nominais sem existência prática (nunca emitidos pelo backend deployável): `operator`, `operador`, `gestor`, `citizen`, `auditor`. Toda conta staff criada hoje é `manager`.

---

# ANEXO G — GUIA DE EXECUÇÃO DA ONDA 0 (PASSO A PASSO ACIONÁVEL)

Detalhamento operacional dos 9 itens da Onda 0 do roadmap, na ordem recomendada de execução (1 PR por item, exceto onde indicado).

**G-1. ConfirmDialog + aplicação nas exclusões (itens 1, 2, 31)**
- Criar `src/components/ui/ConfirmDialog.tsx`: props `{open, title, description, confirmLabel, danger?, requireText?, onConfirm, onCancel}`, usando `useModal` para Esc/foco e `role="dialog"`.
- `CemeteryList`: substituir `handleDelete` direto por `setPendingDelete(cemetery)`; no diálogo, `requireText={cemetery.name}` (cascade grande merece fricção).
- `DeceasedList`: idem com `pendingDelete` (sem requireText; descrição citando nome e nº de anexos).
- Varrer os `window.confirm`/`alert` de `CemeteryDetail` e `SuperAdminPage` trocando pelo diálogo; trocar `alert` de `ReportDeath`/`AdminReportDeath`/`ProfilePage`/`ShopAndServices` por `toast`.
- Teste manual: tentar excluir e cancelar; excluir cemitério com plots ocupados continua bloqueado pelo service.

**G-2. Segredos e CI (item 3 + S-07/S-08)**
- Editar `deploy-pages.yml`: remover a linha `VITE_GEMINI_API_KEY=...`; apagar o secret `GEMINI_API_KEY` do repositório; revogar a chave no console Google Cloud (mesmo que "não usada", já esteve exposta a builds).
- `git rm scripts/superadmin-claim.json` (+ avaliar histórico se repo público).
- `set-superadmin.cjs`: e-mail via `process.argv[2]`; documentar uso no README.
- Verificar no Firebase Console que não existe usuário `admin@memorial.com`/`gestor@memorial.com`; se existir, deletar.

**G-3. SecurityPage (item 4)**
- Copiar o guard de `OperationalPage.tsx:137-140` para `handleCreateEvent`; adicionar `toast.success('Evento registrado.')` e o mapeamento padrão de erro; adicionar toasts em `updateStatus`.
- Aproveitar o PR para envolver o painel de câmera em flag `SHOW_CAMERA_MOCK = false` (remoção limpa depois).

**G-4. Trigger de monitor fail-open (item 6)**
- `functions/src/index.ts:574`: `const token = process.env.MONITOR_TRIGGER_TOKEN; if (!token) { res.status(503).json({ error: 'Trigger desabilitado: MONITOR_TRIGGER_TOKEN ausente' }); return; }`.
- Definir o token via `firebase functions:secrets:set` ou env de deploy.

**G-5. Duplo-submit dos wizards (item 11)**
- `ReportDeath`: `const [submitting, setSubmitting] = useState(false)`; envolver `handleFinalSubmit` em try/finally; `disabled={submitting}` no botão "Comunicar obito"; idem `AdminReportDeath`.
- Aproveitar: memoizar o objectURL como em `AdminReportDeath.tsx:70-79` (fecha o item 33 para esta tela; repetir em ProfilePage).

**G-6. validateFile nos uploads do cidadão (item 17)**
- `ReportDeath`: no onChange de documentos, filtrar com `validateFile(file)` (padrão de `DeceasedForm.tsx:55-70`); no de foto, `validateFile(file, ALLOWED_IMAGE_TYPES)`.
- `ProfilePage.handlePhotoChange`: idem imagem.

**G-7. Transação de alocação (item 5 — pode virar PR da Onda 1)**
- Reescrever o miolo de `allocateNotification` com `runTransaction(db, async (tx) => { ... })`: `tx.get(plotRef)` → validar `available` → `tx.set(newDeceasedRef, …)` → `tx.update(plotRef, …)` → `tx.update(notifRef, …)`.
- Mover `syncPublicDeceased` e `logAction` para depois do commit.
- Adicionar campo "Data do sepultamento" no modal de alocação (`CommunicatedDeaths`) e usá-lo como `burialDate` em vez de `new Date()`.
- Mensagem de conflito: "Este jazigo foi ocupado por outra operação. Escolha outro." + reload da lista de plots.

**G-8. Deploy verificado (item 7)**
- Rodar `firebase deploy --only firestore:rules,storage:rules,firestore:indexes,functions` a partir do commit auditado; capturar o output no PR/issue.
- Conferir no console que as rules ativas contêm o bloco `public_deceaseds` (marcador fácil de versão).
- Abrir issue para automatizar isso no CI (Onda 1, item 25).

**G-9. Smoke test manual pós-onda**
Roteiro mínimo (15 min): login gestor → criar cemitério → criar setor com 20 plots → cidadão comunica óbito (com PDF real) → gestor aloca → verificar plot ocupado + falecido listado + busca pública encontra → tentar excluir cemitério (deve bloquear) → excluir um plot disponível (deve pedir confirmação) → registrar incidente de segurança com "Todas as unidades" (deve orientar via toast).

---

# ANEXO H — RISCOS DE ADOÇÃO E DÍVIDAS DE DECISÃO (PARA O DONO DO PRODUTO)

Decisões que não são bugs, mas precisam de dono e prazo:

1. **GitHub Pages como hospedagem de produção** — sem SLA, sem domínio próprio configurado no repo, deep-links com 404 técnico, e o monitor mede a latência do CDN do GitHub como se fosse "o app". Para vender a prefeituras: Firebase Hosting (mesmo projeto, deploy junto das rules) resolve custo ~zero e habilita App Check/domínio .gov.br.
2. **Um único projeto Firebase** para tudo — sem staging, todo teste é em produção. Criar `memorialos-staging` antes da Onda 1 (os workflows de CI dependem disso).
3. **Módulos-vitrine** (Loja, Parceiros, câmera, "IA" nos rótulos, projeções financeiras) — cada um precisa de decisão explícita: virar produto, ganhar tarja de "demonstração", ou sair. Mantê-los como estão transfere o risco de credibilidade para a primeira demo com um secretário municipal atento.
4. **Estratégia de roles** — o produto promete gestor/operador/auditor (SecurityPage) e entrega só manager. Definir a matriz real antes de implementar D-13, senão a implementação repetirá a confusão PT/EN.
5. **Prazo de exumação fixo em 3 anos** (`notificationService.ts:196`) — a legislação varia por município/idade do sepultado (menores: 2 anos em muitas normas); precisa ser configurável por cemitério (campo já existe por plot: `exhumationDeadlineYears`) com default por tenant.
6. **Retenção e titularidade dos dados** — contrato com a prefeitura deve espelhar o que o sistema faz (hoje: exclusão de tenant mantém dados órfãos para sempre — juridicamente o pior dos dois mundos: nem entrega, nem apaga).
7. **Custo de IA aberto** — sem rate-limit, o custo OpenRouter é dirigido pelo usuário mais curioso. Definir orçamento/tenant e teto técnico (S-04) antes de divulgar o assistente.

---

*Documento completo. Todas as referências arquivo:linha foram verificadas por leitura direta do código na data da análise (2026-07-04, commit `d63e29d`). Este relatório não modificou nenhum arquivo de código do projeto.*

---

# ANEXO I — RASTREABILIDADE CONTRA A VISÃO DE PRODUTO (`docs/VISION.md`)

Cada requisito declarado na visão, com status e evidência no código. Status: ✅ entregue · 🟡 parcial · ❌ ausente · 🔴 divergente.

## I.1 Sitemap público
| Requisito (VISION) | Status | Evidência |
|---|---|---|
| `/` Home com busca, obituário do dia, serviços | 🟡 | LandingPage existe sem busca embutida nem obituários; a HomePage que os teria está morta (`HomePage.tsx`) |
| `/memorial/:id` (bio, fotos, timeline, localização) | ❌ | Placeholder (`App.tsx:94`) |
| `/buscar` busca avançada (nome, data, cemitério) | 🟡 | Só nome, client-side, 200 docs (`SearchPage.tsx:32-38`) |
| `/servicos` manutenção, exumação, 2ª via | ❌ | Placeholder (`App.tsx:95`) |
| `/login` familiares | ✅ | `LoginPage.tsx` |
| `/minha-conta` meus memoriais + solicitações | 🟡 | Redireciona p/ `/app/inicio`; "meus memoriais" = Jardim (notificações, não memoriais); solicitações ❌ |

## I.2 Sitemap admin
| Requisito | Status | Evidência |
|---|---|---|
| Dashboard (ocupação, sepultamentos hoje, pendências) | 🟡 | Ocupação ✅; "sepultamentos hoje" não existe (só total/tendência mensal); pendências documentais ✅, pendências de óbitos comunicados ❌ no dashboard |
| Cemitérios: quadras/setores/jazigos com mapa | 🟡 | CRUD ✅ com geração em massa; mapa real só no cadastro do cemitério (MapPicker); mapa de jazigos é pseudo (1.3) |
| Falecidos: cadastro, busca, histórico | 🟡 | Cadastro ✅; busca só nos 50 carregados; histórico ❌; edição ❌ |
| Operacional: agenda de sepultamentos, OS | 🟡 | Listas de tarefas ✅; agenda/calendário ❌; vínculo real com jazigo ❌ |
| Financeiro: taxas, inadimplência, relatórios | 🟡 | Lançamentos manuais ✅; taxas hardcoded; inadimplência ❌; relatório = TXT genérico |
| Configurações: usuários, permissões, preços | ❌ | ComingSoon (`App.tsx:134`) |

## I.3 Jornadas
| Jornada | Status | Lacunas |
|---|---|---|
| J1 Gestor cadastra estrutura | ✅ | Completa, incluindo geração automática Q1-L001..N (`createSector`) |
| J2 Gestor registra sepultamento | 🟡 | Só via alocação de notificação o fluxo fecha; caminho direto do VISION (buscar responsável → certidão → jazigo livre → status ocupado) não existe como tela única |
| J3 Cidadão cria memorial | ❌ | Convite pós-sepultamento ❌; edição de memorial ❌; galeria ❌; privacidade ❌; QR ❌ (componente existe, sem uso) |
| J4 Visitante encontra localização | ❌ | Busca acha o nome; "Quadra B, Rua 3, Jazigo 120" e "como chegar" ❌ (dados de plot/lat-lng existem e não são expostos) |
| J5 Solicitação de manutenção | ❌ | Nada implementado; rules de `requests` dormindo |

## I.4 Modelo de dados e RBAC prometidos
| Item | Status | Nota |
|---|---|---|
| `tenantId` em todas as coleções raiz | ✅ | Disciplinado em todos os services |
| `sectors`/`plots` como subcoleções de cemeteries | 🔴 | Implementados como coleções raiz (decisão documentada em `cemeteryService.ts:206-207`); ok tecnicamente, mas divergente da visão — atualizar o doc |
| `memorials` separado do registro legal | ❌ | Regras existem, produtores não |
| `audit_logs` com oldValue/newValue | 🔴 | Interface prevista no VISION §4; implementação grava só nomes de campos |
| Roles superadmin/manager/operator/citizen via claims | 🔴 | Só superadmin/manager emitidos; operator/citizen inexistentes na prática; variantes PT residuais |
| "Apenas manager cria operator" | ❌ | Nenhum caminho cria operator |
| MVP: Auth+CRUD+busca+rules | ✅ | Entregue |
| V1: edição de memorial, mapa visual, PDF, auditoria completa, QR | ❌/🟡 | Mapa 🟡; restante ❌ |
| V2: financeiro PIX, IA bio, app offline | 🟡 | IA de bio ✅ (obituário); resto ❌ |

Conclusão da rastreabilidade: das 5 jornadas, 1 completa, 1 parcial, 3 ausentes. O produto entregou mais do que o MVP em módulos administrativos (SCI inteiro não estava na visão) e menos que o MVP na experiência pública (memorial/busca/serviços). Recomenda-se decidir conscientemente se o SCI é o novo core (e atualizar a visão) ou se as jornadas públicas voltam ao topo do backlog (Onda 4 proposta).

---

# ANEXO J — ESPECIFICAÇÃO DOS TESTES PRIORITÁRIOS (PRIMEIRA BATERIA)

Casos escritos em formato dado/quando/então, prontos para virar arquivos de teste. Estimativa total da bateria: 3-4 dias com emuladores configurados.

## J.1 Regras Firestore (`@firebase/rules-unit-testing`)
```
R1  dado cidadão autenticado sem claims
    quando cria death_notification {createdBy: self, status:'submitted'}
    então PERMITE
R2  dado o mesmo cidadão
    quando cria com status:'allocated' OU inclui campo allocation
    então NEGA
R3  dado cidadão dono de notificação 'submitted'
    quando atualiza deceased.name
    então PERMITE
    quando atualiza status/tenantId/allocation/rejectionReason
    então NEGA (diff.affectedKeys)
R4  dado manager do tenant A
    quando lê sci_financial_records do tenant B
    então NEGA
R5  dado manager do tenant A
    quando lê deceaseds do tenant A / do tenant B
    então PERMITE / NEGA
R6  dado anônimo
    quando lê public_deceaseds
    então PERMITE
    quando escreve
    então NEGA
R7  dado manager
    quando cria audit_log com actorUid != self
    então NEGA
    quando atualiza/deleta audit_log
    então NEGA
R8  dado cidadão dono com notificação 'rejected' / 'submitted'
    quando deleta
    então PERMITE / NEGA
R9  (documenta furo atual) dado autenticado qualquer
    quando lê plot {status:'available'} de outro tenant
    então PERMITE  ← marcar como known-issue; inverter expectativa quando fechar
R10 dado manager do tenant A
    quando lista profiles where tenantId==A
    então NEGA  ← prova o defeito do dropdown (5.1); vira PERMITE após corrigir a regra
```

## J.2 `allocateNotification` (emulador Firestore + unit)
```
A1  dado notificação submitted e plot available
    quando aloca
    então deceased criado com campos copiados; plot {status:'occupied', deceasedId, burialDate, exhumationDeadlineYears:3, documentStatus:'pending'}; notificação {status:'allocated', deceasedId, allocation.assignedBy}
A2  dado plot já 'occupied'
    quando aloca
    então lança erro e NENHUM dos 3 documentos é alterado (só passa após a transação D-04)
A3  dado duas alocações concorrentes no mesmo plot
    então exatamente uma vence (idem)
A4  dado falha injetada no update do plot
    então nenhum deceased órfão persiste (idem)
```

## J.3 Snapshot executivo (unit puro, dados sintéticos)
```
S1  20 plots (10 occupied, 6 available, 3 reserved, 1 blocked) → occupancyRate 50, contadores exatos
S2  plot occupied com burialDate 4 anos atrás e deadline default → pendingExhumations inclui; 2,7 anos atrás → approaching (janela 6 meses antes de 3 anos = a partir de 2,5)
S3  fuso: burialDate '2023-01-01' avaliado às 21h BRT do dia-limite → não oscilar entre vencido/não-vencido (documenta o bug UTC; fixar com parse local ou date-fns)
S4  concessão temporary com endDate em 3 meses → expiringConcessions=1; perpetual → 0
S5  financeiro com value string "100" → totalRevenue trata Number() (comportamento atual: soma 100); value NaN → 0
S6  priorities ordenadas por score desc; occupancyRate 97 → SATURATION critical
S7  averageAnnualBurials: 12 burials com earliest há 2 anos → 6/ano; saturationProjectionYears = available/6
```

## J.4 Serviços de integridade
```
D1  deleteCemetery com 1 plot reserved → lança e nada é apagado
D2  deleteCemetery com 950 plots available → todos apagados (2 batches) + setores + doc
D3  syncPublicDeceased com objeto contendo causeOfDeath → projeção NÃO contém o campo (guardrail LGPD)
D4  removePublicDeceased após deleteDeceased → doc público ausente
D5  validateFile: pdf 9MB ✅; png 11MB ❌ mensagem de tamanho; exe ❌ mensagem de tipo
```

## J.5 Componentes (testing-library)
```
C1  ReportDeath passo 1: submit sem nome → mensagem zod visível; com dados válidos → avança e formData acumula
C2  ReportDeath revisão: duplo clique em "Comunicar obito" → createDeathNotification chamado 1 vez (pós G-5)
C3  ConfirmDialog: Esc fecha; confirm chama callback; requireText bloqueia até digitar corretamente
C4  CommunicatedDeaths modal: selecionar cemitério habilita setor; setor habilita jazigo; botão só habilita com os 3
C5  SCITable: loading mostra spinner; vazio mostra emptyMessage; onRowClick dispara
```

## J.6 E2E (Playwright + emuladores, roteiro único)
```
E1  seed: superadmin cria tenant via callable; login gestor; cria cemitério+setor(20 plots)
    cidadão registra conta → comunica óbito com anexo pdf
    gestor vê na fila → aloca no plot P
    asserts: plot P occupied; falecido na lista; busca pública anônima encontra o nome;
    Jardim do cidadão mostra "Aprovado" com código do jazigo
```

---

# ANEXO K — CATÁLOGO DE STRINGS PARA CORREÇÃO DE ACENTUAÇÃO (AMOSTRA DIRIGIDA)

Levantamento por arquivo das strings de UI sem acentuação (lista dirigida para o PR da Onda 2; padrão: `atual → correto`). Total estimado no projeto: ~80-90 strings.

- `AdminLayout.tsx`: "Area Administrativa SCI" → "Área Administrativa SCI"; "Inventario / Mapa" → "Inventário / Mapa"; "Manutencao" → "Manutenção"; "Seguranca" → "Segurança"; "Sanitario / Ambiental" → "Sanitário / Ambiental"; "Relatorios" → "Relatórios"; "Cemiterios" → "Cemitérios"; "Obitos Comunicados" → "Óbitos Comunicados"; "Novo Obito (Admin)" → "Novo Óbito (Admin)".
- `AdminDashboard.tsx`: "Taxa de ocupacao", "Jazigos disponiveis", "Projecao de saturacao", "Ocorrencias abertas", "Exumacoes pendentes", "Pendencias documentais", "Mapa de ocupacao", "Ir para georreferenciamento" (ok), "Tendencia mensal", "Checklist sanitario", "Novo Checklist Sanitario", "Nivel de risco", "Inspetor responsavel", "Recomendacao", "Acao recomendada e prazo", "Alertas sanitarios/ambientais", "Nenhuma prioridade critica detectada".
- `OperationalPage.tsx`: "Gestao operacional completa", "exumacoes, agendamentos... notificacoes internas e ocorrencias", tabs "Exumacoes/Notificacoes/Ocorrencias/Prazos exumacao", "Titulo da atividade", "Descricao", "Responsavel", "Publico", "Nivel", "Sem notificacoes internas", "Sem ocorrencias registradas", "Proximos 6 meses".
- `InventoryPage.tsx`: "Inventario georreferenciado", "codigo, setor ou ocupante", "Disponivel", "Ossuario", "Titular da concessao", "Tipo concessao", "Perpetua/Temporaria", "Inicio concessao", "Vencimento concessao", "Risco sanitario", "Estrutural: Atencao/Critico", "Diagnostico IA do inventario", "Acoes recomendadas", "Saturacao atual".
- `FinancialPage.tsx`: "Transacoes", "Tabela de precos", "Projecoes", "Sepultamento padrao", "Exumacao", "Concessao jazigo", "Manutencao anual", "Descricao do lancamento", "Servico", "Analise preditiva", "ocupacao... passivos documentais... saturacao... exumacoes regulamentares".
- `MaintenancePage.tsx`: "Manutencao", "Nova ordem de servico", "Descricao", "Responsavel", "Concluido", "Sem descricao", "Resp.: Nao definido", "Qtd minima".
- `EnvironmentalPage.tsx`: "Controle sanitario e ambiental", "prioridades de intervencao", "Sanitario", "Novo registro sanitario", "Area / quadra", "Achados da vistoria", "Recomendacao e acao imediata", "Responsavel tecnico", "Nenhum checklist sanitario/ambiental cadastrado", "Prioridades de intervencao identificadas pela IA".
- `DocumentsCenterPage.tsx`: "Digitalizacao documental", "validacao de documentos", "Titulo do documento", "Juridico", "Sanitario", "Observacoes", "Emissao".
- `SupportPage.tsx`: "capacitacao", "Titulo do chamado", "Suporte tecnico", "Publico-alvo", "Conteudo programatico / observacoes", "Nenhuma sessao de treinamento".
- `SecurityPage.tsx`: "Seguranca e acesso", "Portao principal", "Local nao informado", "Sem incidentes de seguranca no periodo", "Modulo", "Relatorios juridicos", "Gestao de usuarios", "Descricao detalhada", "criptografia em transito".
- `AgentsPage.tsx`: "Modulos autorizados" (backend), "Objetivo principal", "Instrucoes personalizadas", "Modulos separados por virgula", "Ativar agente apos criar".
- `ReportsPage.tsx`: "Relatorios automaticos", "Operacional/Sanitario/Ambiental/Juridico" labels, "Historico de relatorios", "Nenhum relatorio gerado ainda", "Cemiterio: ...".
- `CemeteryList/Detail`: "Cemiterios", "Gestao da estrutura fisica", "Novo cemiterio", "Publico/Concessao", "Endereco", "Localizacao no mapa", "Estrutura do cemiterio", "Terreo/Ossuario", "Numero do tumulo", "Data do enterro", "Exumacao (anos)", "Observacoes", "Nenhum tumulo cadastrado", "Acoes".
- `DeceasedForm.tsx`: "Novo registro de obito", "anexacao documental", "Ex: Joao da Silva", "Profissao", "insuficiencia respiratoria", "Familiares/Responsaveis, parentes", "Cemiterio", "Codigo do jazigo".
- `sciService.ts` (buildReportSummary — sai em relatório impresso!): "Relatorio Operacional/Sanitario/Juridico...", "Cemiterio", "Data de geracao", "Taxa de ocupacao", "Exumacoes", "Ocorrencias em aberto", "Pendencias documentais", "Falhas estruturais", "Prioridades de intervencao", "Nenhuma prioridade critica detectada" + todos os `details` das prioridades (linhas 592-659).
- Área do usuário: `ReportDeath` ("Comunicar Obito", "Dados do ente querido", "Cemiterio de preferencia", "Nivel de proximidade", "Subtitulo sugerido", "Profissao", "Hobbies e paixoes", "Familia", "Realizacoes importantes", "Obituario", "Frase da lapide", "Revisao final", "Saudade eterna e gratidao infinita"); `relationshipOptions/labelMap` inteiros ("irmao/avoa/Grande mae..."); `UserHomePage` (slides e passos); `GardenOfMemories` ("Jardim de Memorias", "solicitacoes", "memoria", "Local em definicao"); `VirtualAssistant` ("Ola", "orientacoes, duvidas e acolhimento"); `ShopAndServices` (catálogo inteiro); `LandingPage` (integral); `LoginPage` ("E-mail invalido", "minimo", "recuperacao", "Nao tem uma conta?"); `RegisterPage` ("no minimo", "nao conferem", "ja esta em uso").
- Cloud Functions (mensagens ao usuário): "Login necessario", "Servico de IA sobrecarregado", "Falha de conexao com o servico de IA", prompts de sistema ("Voce e o Memorial AI... empatico... duvidas... obito") — os prompts também merecem acentuação por qualidade de saída do modelo.

Observação: a padronização deve vir acompanhada de uma decisão de encoding no pipeline (os arquivos já são UTF-8; o padrão sem acento foi escolha defensiva desnecessária) e de um teste visual nas duas ou três fontes usadas.

---

## ENCERRAMENTO

Este relatório cobriu: 30 páginas React, 8 services, 2 contextos, 8 componentes, 2 hooks, 7 libs, 3 layouts, 12 Cloud Functions + 6 módulos de monitoramento, 2 arquivos de regras (310 + 76 linhas analisadas bloco a bloco), 4 scripts administrativos, CI, configs e 4 documentos — com 60 itens ranqueados, 5 ondas de roadmap, 6 fluxos rastreados ponta-a-ponta, dicionário de 22+ coleções, ~70 defeitos catalogados com correção proposta, matriz de permissões efetiva, guia de execução da primeira onda, rastreabilidade completa contra a visão de produto, primeira bateria de testes especificada e catálogo de strings para a normalização linguística.

Prioridade absoluta se apenas uma coisa puder ser feita esta semana: **Onda 0, itens G-1 a G-4** — confirmações de exclusão, segredo do CI, SecurityPage e trigger fail-open. São ~1 dia de trabalho e eliminam os quatro riscos que podem causar dano irreversível (perda de dados, vazamento de chave, perda silenciosa de incidentes e endpoint aberto).

---

# ANEXO L — GLOSSÁRIO DE DOMÍNIO E DE SISTEMA

Para alinhar time técnico, gestores municipais e novos desenvolvedores (os termos aparecem misturados em PT/EN pelo código — este glossário fixa o vocabulário canônico proposto).

| Termo no código | Termo de domínio (PT-BR) | Definição operacional | Onde vive |
|---|---|---|---|
| `tenant` | Prefeitura / Município cliente | Unidade de isolamento de dados; cada prefeitura enxerga apenas seus registros | claim `tenantId` + campo em todas as coleções |
| `cemetery` | Cemitério / Unidade | Sítio físico administrado pelo tenant; um tenant pode ter vários | `cemeteries` |
| `sector` | Setor / Quadra | Subdivisão física do cemitério (Quadra A, Ala Vertical...) com capacidade e grade | `sectors` |
| `plot` | Jazigo / Sepultura / Lote | Menor unidade ocupável; tem código, status, riscos, concessão e prazos | `plots` |
| `deceased` | Falecido (registro oficial) | Assento administrativo do óbito/sepultamento — o "cartório" do sistema | `deceaseds` |
| `public_deceased` | Registro público do falecido | Projeção com apenas campos não sensíveis para a busca aberta | `public_deceaseds` |
| `death_notification` | Comunicação de óbito | Solicitação da família que inicia o fluxo de sepultamento | `death_notifications` |
| `allocation` | Alocação de jazigo | Ato do gestor que designa o plot, cria o registro oficial e ocupa o jazigo | subcampo da notificação |
| `memorial` | Memorial digital | Página de homenagem gerida pela família (bio, fotos, tributos) — **não implementado** | `memorials` (fantasma) |
| `concession` | Concessão | Direito de uso do jazigo (perpétuo ou temporário) por um titular | campos no plot + `plot_concessions` |
| `exhumationDeadline` | Prazo de exumação | Prazo legal mínimo de permanência dos restos antes de exumação (default 3 anos) | `plots.burialDate + exhumationDeadlineYears` |
| `occurrence` | Ocorrência | Evento adverso registrado (estrutural, sanitário, segurança...) com severidade e SLA | `sci_occurrences` |
| `sanitary/environmental check` | Checklist sanitário/ambiental | Vistoria com indicador, risco, achados e recomendação | `sci_sanitary_checks` / `sci_environmental_checks` |
| `operational record` | Registro operacional | Tarefa/atividade tipificada (sepultamento, exumação, agendamento, manutenção...) | `sci_operational_records` |
| `stock item` | Item de estoque | Insumo com quantidade e mínimo (sem movimentação hoje) | `sci_stock_items` |
| `digital document` | Documento digital | Arquivo institucional com tipo, validade e status de validação | `sci_documents` |
| `SCI` | Sistema Cemiterial Inteligente | Marca do conjunto de módulos administrativos | prefixo `sci_` |
| `snapshot executivo` | Painel consolidado | Agregado calculado de plots+SCI que alimenta dashboard/relatórios | `getSciExecutiveSnapshot` |
| `necrochorume` | Necrochorume | Efluente da decomposição — indicador ambiental crítico do domínio (citado só em placeholder hoje) | `AdminDashboard.tsx:403` |
| `manager/gestor` | Gestor | Administrador da prefeitura no sistema (único papel staff emitido hoje) | claim `role` |
| `operator/operador` | Operador | Papel de campo previsto e não emitido | — |
| `superadmin` | Superadministrador | Operador da plataforma (fornecedor); gere tenants e monitoramento | claim `role` |
| `citizen` | Cidadão / Família | Usuário sem claim; comunica óbitos e gere memórias | default client-side |

---

# ANEXO M — LEITURA DO HISTÓRICO GIT (CONTEXTO DA BASE)

O repositório tem ~4 meses de vida (primeiro commit 2026-03-05, último 2026-07-04) e o histórico conta com clareza a trajetória — útil para calibrar expectativas:

1. **Fase 1 (março)** — bootstrap de template ("react-example" sobrevive no package.json), deploy no GitHub Pages com os hacks de env/rota (`885024e`, `699d667`, `2887a0a`) e construção acelerada dos módulos SCI (`78bef62` "6 melhorias estratégicas"). É desta fase que vêm os módulos-vitrine e o padrão sem acentos.
2. **Fase 2** — superadmin multi-tenant (`5a76161`, `56e9a...`) e agente de monitoramento (`467557a`) — este último criado **contra um modelo de dados imaginado** (requests, funeral_plans, lastLoginAt), nunca reconciliado com o app real; a divergência documentada em 1.22 nasce aqui, não de regressão.
3. **Fase 3 (2026-07-03)** — auditoria interna gerou o `PLANO_CORRECOES_MEMORIAL.md` e um mega-commit de correções (`4fc9133`, Etapas 1-5) + merge (`dd84476`): remoção do backdoor, regras reescritas, toasts, utilitários (SCITable/useCemeteryFilter/useModal/validationSchemas). **Padrão importante**: várias correções desta fase criaram a ferramenta e aplicaram-na em 1 lugar (o "PARCIAL" honesto do STATUS) — as seções 3.2/3.10 deste relatório são, em grande parte, o custo de completar essa fase.
4. **Fase 4 (2026-07-03/04)** — busca pública LGPD (`c492f94`) e a migração de IA Gemini→OpenRouter em 4 commits iterativos (`9660f36` → `d63e29d`), incluindo a aprendizagem free-tier→pago. A migração **não atualizou** README, .env.example, mensagens de erro do front nem o secret do CI — origem direta dos achados S-01, D-16 e 7.5.

Implicações práticas: (a) o time corrige com seriedade quando o problema está mapeado — o formato deste relatório (arquivo:linha + correção) foi escolhido para encaixar nesse fluxo; (b) mega-commits de correção dificultam bisect/rollback — recomendável 1 PR por item do ranking daqui em diante; (c) toda migração de infraestrutura (IA, hosting) precisa de checklist de pontas soltas (docs, CI, mensagens, exemplos de env), pois foi exatamente aí que as três últimas fases deixaram resíduos.

---

# ÍNDICE GERAL DO RELATÓRIO

- **Sumário executivo** — 5 achados críticos · 5 achados de produto
- **1. Funcionalidades** — 1.1 Dashboard · 1.2 Operacional · 1.3 Inventário · 1.4 Financeiro · 1.5 Manutenção · 1.6 Sanitário/Ambiental · 1.7 Documentos · 1.8 Suporte/Treinamento · 1.9 Segurança · 1.10 Agentes IA · 1.11 Relatórios · 1.12 Treinamentos · 1.13 Parceiros · 1.14 Falecidos · 1.15 Óbitos Comunicados · 1.16 Cemitérios · 1.17 Configurações/Solicitações · 1.18 Área pública · 1.19 Área do cidadão · 1.20 SuperAdmin · 1.21 Autenticação · 1.22 Cloud Functions/Infra
- **2. UI/UX** — 2.1 Consistência visual · 2.2 Idioma/acentuação · 2.3 Hierarquia · 2.4 Feedback (tabela por página) · 2.5 Formulários · 2.6 Navegação · 2.7 Mobile · 2.8 Acessibilidade · 2.9 Padrões entre telas · 2.10 Sugestões
- **3. Arquitetura e código** — 3.1 Padrões · 3.2 Duplicação (10 blocos) · 3.3 Componentes a extrair · 3.4 Hooks · 3.5 Abstrações · 3.6 Dependências · 3.7 Pastas · 3.8 TypeScript · 3.9 Erros silenciosos (34 catch) · 3.10 Código morto
- **4. Performance** — 4.1 Queries sem limite (tabela) · 4.2 Leituras redundantes · 4.3 Re-renders · 4.4 useEffect · 4.5 Sequencial vs paralelo · 4.6 Memory leaks · 4.7 Code splitting · 4.8 Índices e custo
- **5. Segurança** — 5.1 Firestore rules por coleção · 5.2 Storage rules · 5.3 LGPD · 5.4 Isolamento de tenants · 5.5 Operações destrutivas · 5.6 Validação/bypass · 5.7 Roles · 5.8 Credenciais · 5.9 Auditoria
- **6. Produto** — 6.1 Ausências críticas · 6.2 Inacabadas de maior ROI · 6.3 Integrações · 6.4 Relatórios municipais · 6.5 Fluxos de aprovação · 6.6 Compliance
- **7. Testes e qualidade** — 7.1 Cobertura (zero) · 7.2 Fluxos sem teste · 7.3 Lint/format · 7.4 CI/CD · 7.5 Documentação
- **8. Ranking de prioridade** — 60 itens com impacto × esforço
- **9. Roadmap** — Ondas 0 a 4 + princípios transversais
- **10. Fluxos ponta-a-ponta** — 6 fluxos rastreados com arquivo:linha
- **Anexos** — A. Dicionário de dados (22+ coleções) · B. Catálogo de defeitos com correções (D/S/P/Q/U) · C. Inventário dos 116 arquivos · D. Métricas da base · E. UI/UX tela a tela (26 telas) · F. Matriz de permissões efetiva · G. Guia de execução da Onda 0 · H. Riscos de adoção · I. Rastreabilidade vs VISION.md · J. Especificação de testes · K. Catálogo de acentuação · L. Glossário · M. Leitura do histórico git · N. Checklist de prontidão para produção

---

# ANEXO N — CHECKLIST DE PRONTIDÃO PARA PRODUÇÃO (GATE DE RELEASE)

Checklist derivado dos achados deste relatório, para ser executado antes de qualquer implantação em prefeitura real. Cada item referencia a evidência/correção correspondente. Estado atual marcado conforme a análise de 2026-07-04.

## N.1 Segurança e segredos
- [ ] Linha `VITE_GEMINI_API_KEY` removida de `deploy-pages.yml` e secret apagado do GitHub (S-01)
- [ ] Chave Gemini antiga revogada no Google Cloud (S-01)
- [ ] `scripts/superadmin-claim.json` removido do repositório (S-07)
- [ ] Conta `admin@memorial.com` inexistente/neutralizada no Firebase Auth (S-08)
- [ ] `MONITOR_TRIGGER_TOKEN` configurado e trigger falhando fechado sem ele (S-03)
- [ ] `firebase deploy --only firestore:rules,storage,functions` executado a partir do commit auditado, com evidência (G-8)
- [ ] Regras de Storage com limite de tamanho e content-type (S-02)
- [ ] Regras de Storage com isolamento de tenant para staff (S-02)
- [ ] Rate-limit e verificação de role nas callables de IA (S-04)
- [ ] App Check habilitado (S-10) — pode ser pós-go-live com prazo definido
- [ ] Rules com validação de schema em `plots` e `sci_financial_records` (S-11)

## N.2 Integridade de dados
- [ ] Nenhuma exclusão sem ConfirmDialog (D-01, D-02)
- [ ] `allocateNotification` transacional com recheck de disponibilidade (D-04)
- [ ] `deleteDeceased` libera o plot e remove arquivos (D-02)
- [ ] `deleteSector` bloqueia ou cascateia plots (D-09)
- [ ] Status→available limpa vínculos do jazigo (D-07)
- [ ] Fallback `tenantId || uid || 'default'` removido (D-19)
- [ ] `resolvedAt/completedAt/resolvedBy` gravados nas transições (D-12)
- [ ] Wizards sem duplo-submit (G-5)
- [ ] Backup diário do Firestore agendado e testado um restore (item 59)

## N.3 Funcional mínimo para operação municipal
- [ ] Lista de falecidos com paginação completa (D-05)
- [ ] Edição de falecido disponível (D-06)
- [ ] Busca pública server-side com índice de nome (item 18)
- [ ] Notificação à família em alocação/rejeição (item 21)
- [ ] Dashboard com card de óbitos pendentes (item 22)
- [ ] Gestor consegue ver contato do solicitante da comunicação de óbito (item 46)
- [ ] Fluxo de exumação acionável a partir dos alertas (item 41)
- [ ] Relatório com período e formato apresentável (D-15/item 43)
- [ ] Desativação de prefeitura desativa todos os logins do tenant (D-14)
- [ ] Papel operador criável e com restrições reais, ou removido do discurso (D-13/decisão H-4)

## N.4 Conformidade (LGPD e auditoria)
- [ ] Política de Privacidade e Termos publicados e linkados (item 27)
- [ ] Aceite de termos no cadastro do cidadão (E.4)
- [ ] Consentimento/opt-out para listagem pública do falecido (5.3)
- [ ] Projeção pública revisada (avaliar remover `dateOfBirth` completo — A.9)
- [ ] Auditoria com valores old/new sanitizados (5.9/item 26)
- [ ] Ações de superadmin e do fluxo cidadão auditadas (5.9)
- [ ] Soft-delete para registros oficiais (item 26)
- [ ] Exportação de dados do tenant documentada (6.6.5)
- [ ] Canal do encarregado (DPO) divulgado (6.6.6)

## N.5 Qualidade de experiência
- [ ] Zero `alert()`/`window.confirm` no código (`grep -r "alert(" src` limpo, exceto libs)
- [ ] Zero valores de domínio em inglês na UI (2.2)
- [ ] Zero strings de UI sem acentuação (Anexo K; verificação: revisão visual por página)
- [ ] Loading em toda página com fetch (2.4: Financial, Documents, Support, Security, CemeteryList)
- [ ] Toast de sucesso/erro em toda mutação (2.4: Security, Reports, Agents, SuperAdmin, CemeteryDetail)
- [ ] Datas em dd/mm/aaaa em todas as tabelas (2.10.9)
- [ ] IDs substituídos por nomes onde exibidos (D-20)
- [ ] Módulos simulados com tarja de demonstração ou removidos (item 55/H-3)
- [ ] Modais com Esc/foco/aria via useModal (2.8)
- [ ] Ações dos cards de cemitério acessíveis em touch (E.25)

## N.6 Engenharia
- [ ] CI de PR com typecheck+lint+test bloqueante (7.4/item 25)
- [ ] ESLint+Prettier configurados (7.3)
- [ ] `@types/react` instalado; `strictNullChecks` ligado (Q-05)
- [ ] Bateria J.1 (rules) e J.2 (alocação) verde no emulador (Anexo J)
- [ ] E2E do fluxo principal (J.6) verde
- [ ] Código morto removido (Q-06; `HomePage`, `functions/index.js`, `functions/lib`, deps órfãs)
- [ ] Duplicações principais extraídas (Q-01/Q-02/Q-03: handler SCI, SCITable, filtros, erros)
- [ ] Lazy loading por área (P-04)
- [ ] `package.json` com nome/versão reais e scripts corretos (Q-08)
- [ ] README/STATUS atualizados e verdadeiros (7.5)
- [ ] Ambiente de staging separado (H-2)
- [ ] Monitoramento consultando o schema real (item 13) — ou desligado até lá, para não exibir dados fictícios ao superadmin

## N.7 Critério de aprovação sugerido
- **Go-live piloto (1 prefeitura, dados reais)**: N.1 completo + N.2 completo + N.3 itens 1-6 + N.4 itens 1-3 + N.6 itens 1-5.
- **Go-live comercial (múltiplas prefeituras)**: checklist integral, com exceções documentadas e datadas pelo dono do produto.

O estado atual do repositório atende aproximadamente **12 dos 62 itens** deste gate — coerente com o diagnóstico geral: fundação correta, acabamento e rede de segurança pendentes. Com as Ondas 0-1 executadas (3-4 semanas), o gate de piloto torna-se alcançável.

---

## COMO MANTER ESTE RELATÓRIO VIVO

1. **Referências de linha** valem para o commit `d63e29d` (2026-07-04). Após refactors, atualize as âncoras dos itens ainda abertos ou converta cada item do ranking em issue no GitHub (título = linha da tabela da seção 8; corpo = entrada correspondente do Anexo B) — o formato foi desenhado para essa conversão ser copy-paste.
2. **Ao fechar um item**: marque no Anexo N, remova a linha do ranking e, se a correção divergir da proposta, anote o porquê no PR (o histórico do projeto mostra que decisões não registradas viram redescoberta — Anexo M).
3. **Re-auditoria recomendada** ao fim da Onda 2 (escopo reduzido: seções 2, 3.2, 3.9 e Anexo N) e antes do go-live piloto (escopo: seção 5 completa + Anexo F contra as rules então vigentes).
4. **Novos módulos** devem nascer já conformes aos princípios transversais da seção 9 — usar o Anexo N como definition of done de cada feature.

*— Fim do documento (ANALISE_TOTAL_MEMORIAL.md).*

*Assinatura da análise: leitura integral de 116 arquivos, 60 itens ranqueados, ~70 defeitos catalogados, 62 itens de gate — nenhum arquivo de código foi modificado.*
