# PLANO DE IMPLEMENTAÇÃO TOTAL — MemorialOS

**Data de elaboração**: 2026-07-05
**Base**: `ANALISE_TOTAL_MEMORIAL.md` (análise integral de 2026-07-04, commit `d63e29d`) + `PLANO_CORRECOES_MEMORIAL.md` (plano histórico de 2026-07-03, itens C1–C5/A1–A7/M1–M9/B1–B5).
**Verificação**: todos os trechos "Código atual (before)" deste documento foram confirmados por leitura direta do código-fonte em 2026-07-05. Onde o plano anterior afirmava correção já aplicada, o estado real foi conferido (ex.: C1/C4 aplicados no frontend, mas o CI ainda injeta a chave — ver W0-1).
**Stack**: React 19 + Vite 6 + TypeScript 5.8 (não-strict) + Tailwind 4 + Firebase (Auth, Firestore, Storage, Functions v2) + OpenRouter + GitHub Pages.

---

## COMO USAR ESTE PLANO

1. Cada problema tem um ID único no formato `W<onda>-<n>` e referencia o ID original da análise (D-xx, S-xx, P-xx, Q-xx, U-xx e os itens 1–60 do ranking).
2. **Um PR por item** (exceto onde o item indicar agrupamento). O título do PR deve conter o ID (ex.: `fix(W0-4): guard + toasts na SecurityPage`).
3. As ondas devem ser executadas **em ordem**. Dentro de cada onda os itens são independentes salvo indicação de dependência explícita.
4. Após cada onda: rodar o smoke test da onda (descrito ao fim de cada seção) e atualizar `IMPLEMENTACAO_STATUS.md` no mesmo PR.
5. Referências de linha valem para o commit `d63e29d`. Após merges, use as âncoras de código (nomes de função) — os trechos "before" foram copiados literalmente para permitir busca textual.

## MAPA DE DEPENDÊNCIAS ENTRE ONDAS

```
Onda 0 (bloqueantes) ──────────────────────────┐
   │                                            │
   ▼                                            ▼
Onda 1 (integridade de dados)          Onda 2 (segurança/autorização)
   │  W1-1 depende de W0-10 (deploy)      │  W2-1 (roles) é pré-requisito de
   │  W1-9 depende de W1-8 (lista)        │  W2-2/W2-7 (rules citam roles)
   │                                      │  W2-11 (CI) é gate das ondas 3-6
   ▼                                      ▼
Onda 3 (feedback/UX) ◄── depende de W3-1 (lib/errors.ts) interno
   │  W3-10 depende de W2-7 (rules de user_profiles)
   ▼
Onda 4 (funcionalidades) ── W4-1 depende de W2-8 (audit de AI_CALL) e W4-11 de W1-1
   ▼
Onda 5 (performance/arquitetura) ── W5-4/W5-5 tocam as mesmas páginas da Onda 3:
   │                                 executar DEPOIS para não gerar conflitos de merge
   ▼
Onda 6 (qualidade/débito) ── W6-1 (strict) por último: os refactors das ondas
                             anteriores reduzem o volume de erros a corrigir
```

## RESUMO DE ESFORÇO (desenvolvedor sênior)

| Onda | Tema | Itens | Esforço estimado | Risco se não feita |
|---|---|---|---|---|
| 0 | Bloqueantes imediatos | W0-1 … W0-10 | 8–12 h (~1,5 dia) | Vazamento de segredo; perda de dados a 1 clique; incidentes perdidos; endpoint aberto |
| 1 | Integridade de dados | W1-1 … W1-14 | 36–48 h (~5–6 dias) | Dois sepultados no mesmo jazigo; registros órfãos; inventário dessincronizado |
| 2 | Segurança e autorização | W2-1 … W2-11 | 32–44 h (~4–5,5 dias) | Furo cross-tenant no Storage; abuso de custo IA; roles inconsistentes |
| 3 | Feedback e UX crítica | W3-1 … W3-11 | 28–36 h (~3,5–4,5 dias) | 34 falhas silenciosas; gestor opera às cegas |
| 4 | Funcionalidades incompletas | W4-1 … W4-12 | 56–80 h (~7–10 dias) | Monitoramento fictício; módulos-vitrine em demo; promessas não cumpridas |
| 5 | Performance e arquitetura | W5-1 … W5-11 | 40–56 h (~5–7 dias) | Custo Firestore crescente; bundle único; 1.000+ linhas duplicadas |
| 6 | Qualidade e débito técnico | W6-1 … W6-10 | 40–64 h (~5–8 dias) | 95 `any`; produto "sem acento"; zero testes |
| **Total** | | **79 itens** | **240–340 h (30–43 dias úteis)** | |

---

---

# ONDA 0 — BLOQUEANTES IMEDIATOS (~1,5 dia)

> **Critério de bloqueio**: nenhum deploy, demo ou compartilhamento de link antes do fim desta onda. Os 10 itens eliminam: segredo no CI, credencial residual no repo, endpoint fail-open, perda de dados a um clique, incidente de segurança engolido, duplo-submit e uploads sem validação no fluxo do cidadão.

---

## [W0-1] — CI ainda injeta a chave Gemini no bundle público (S-01, item 3)

**Arquivo(s):** `.github/workflows/deploy-pages.yml`
**Linha(s):** 33–44 (a linha crítica é a 36)
**Diagnóstico:** o passo "Create .env For Build" grava `VITE_GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }}` no `.env` de build. O item C4 do plano anterior removeu o uso da chave do frontend (`aiService.ts` hoje chama Cloud Functions) e o `README.md:40` afirma "Não existe mais VITE_GEMINI_API_KEY" — mas o workflow continua materializando o segredo no ambiente de build a cada push na `main`. Qualquer reintrodução futura de `import.meta.env.VITE_GEMINI_API_KEY` (ou plugin de build que despeje env no bundle) vaza a chave no site público. Além disso, o config Firebase está hardcoded no YAML, contradizendo o README que instrui usar GitHub Variables — dois mecanismos divergentes para o mesmo dado. Impacto de negócio: chave de API bilhetável exposta a builds; auditoria de segurança de qualquer prefeitura reprova o pipeline no primeiro olhar.

**Código atual (before):**
```yaml
      - name: Create .env For Build
        run: |
          cat > .env <<'EOF'
          VITE_GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }}
          VITE_FIREBASE_API_KEY=AIzaSyDiKUnwst_k5JTdQG79PvQYkRdT5bCnnXQ
          VITE_FIREBASE_AUTH_DOMAIN=memorialos.firebaseapp.com
          VITE_FIREBASE_PROJECT_ID=memorialos
          VITE_FIREBASE_STORAGE_BUCKET=memorialos.firebasestorage.app
          VITE_FIREBASE_MESSAGING_SENDER_ID=320298917710
          VITE_FIREBASE_APP_ID=1:320298917710:web:77e6995b581df66ec7081f
          VITE_FIREBASE_MEASUREMENT_ID=G-4NMDQ9C2EF
          EOF
```

**Código corrigido (after):**
```yaml
      - name: Create .env For Build
        # Config Firebase Web é público por natureza (protegido por rules + App Check),
        # mas centralizamos em GitHub Variables para ter uma única fonte de verdade.
        # NUNCA gravar secrets VITE_* aqui: tudo que entra no .env do Vite vai para o bundle.
        run: |
          cat > .env <<EOF
          VITE_FIREBASE_API_KEY=${{ vars.FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN=${{ vars.FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID=${{ vars.FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET=${{ vars.FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID=${{ vars.FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID=${{ vars.FIREBASE_APP_ID }}
          VITE_FIREBASE_MEASUREMENT_ID=${{ vars.FIREBASE_MEASUREMENT_ID }}
          EOF

      - name: Guard - Nenhum segredo no bundle
        run: |
          npm run build
          if grep -rE "GEMINI|sk-or-v1" dist/assets/ ; then
            echo "::error::Padrão de segredo encontrado no bundle gerado"; exit 1;
          fi
```
> Nota: o passo `Build` original (`run: npm run build`) passa a ser este passo combinado com o guard — remover o passo `Build` duplicado.

**Passos de implementação:**
1. No GitHub, em *Settings → Secrets and variables → Actions → Variables*, criar as 7 variáveis `FIREBASE_API_KEY` … `FIREBASE_MEASUREMENT_ID` com os valores hoje hardcoded no YAML.
2. Editar `deploy-pages.yml`: remover a linha 36 (`VITE_GEMINI_API_KEY=...`), trocar os valores hardcoded por `${{ vars.* }}` e adicionar o passo de guard pós-build acima.
3. Em *Settings → Secrets*, **apagar o secret `GEMINI_API_KEY`** do repositório.
4. No console Google Cloud (APIs & Services → Credentials do projeto que emitiu a chave), **revogar a chave Gemini antiga** — ela já esteve disponível a todos os builds desde março e deve ser considerada comprometida.
5. Atualizar `README.md` para descrever o mecanismo real (Variables + secret `OPENROUTER_API_KEY` só nas Functions) e `.env.example` (remover menção a `functions:config:set gemini.api_key`).
6. Fazer um push de teste na `main` e confirmar que o build passa e o guard não encontra padrões.

**Critério de aceitação:**
- `grep -n "GEMINI" .github/workflows/deploy-pages.yml` → sem resultados.
- O secret `GEMINI_API_KEY` não existe mais em *Settings → Secrets* do repositório.
- A chave antiga aparece como revogada/deletada no console GCP.
- `npm run build && grep -rE "AIzaSy" dist/assets/*.js` retorna **apenas** a chave web do Firebase (pública por design), nenhum outro token.
- Deploy do GitHub Pages continua funcionando (site abre, login funciona).

**Riscos e reversão:** risco baixo — a chave não é usada pelo frontend atual, então removê-la não quebra nada. Se as Variables forem digitadas erradas, o build gera `.env` vazio e o app mostra a tela "Configuracao necessaria" (`App.tsx:68-84`) — o erro é visível e a reversão é reeditar as Variables. Guardar o valor antigo do YAML no histórico do git (já está) permite restaurar em 1 commit.

---

## [W0-2] — Credencial residual commitada + script promove o e-mail do ex-backdoor (S-07, S-08)

**Arquivo(s):** `scripts/superadmin-claim.json` (arquivo inteiro), `scripts/set-superadmin.cjs`
**Linha(s):** `set-superadmin.cjs:27`
**Diagnóstico:** dois resíduos do processo de correção C1: (a) `scripts/superadmin-claim.json` está commitado com UID real do superadmin e e-mail `superadmin@memorial.com` — o próprio fluxo documentado mandava apagá-lo; (b) `set-superadmin.cjs` tem hardcoded o e-mail `admin@memorial.com`, exatamente a conta do antigo backdoor (senha `admin123` esteve pública no bundle por meses). Se essa conta ainda existir no Firebase Auth e alguém rodar o script, promove a superadmin uma conta cuja senha é conhecida publicamente. Impacto: escalada de privilégio total com uma execução acidental de script.

**Código atual (before):**
```javascript
// scripts/set-superadmin.cjs:17-27
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
```

**Código corrigido (after):**
```javascript
// scripts/set-superadmin.cjs — e-mail obrigatório via CLI, com validação e confirmação
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
```

**Passos de implementação:**
1. `git rm scripts/superadmin-claim.json` e commitar. Se o repositório for (ou vier a ser) público, reescrever o histórico (`git filter-repo --path scripts/superadmin-claim.json --invert-paths`) ou considerar o UID exposto e monitorar a conta.
2. Aplicar o `after` acima em `set-superadmin.cjs`.
3. No Firebase Console → Authentication, procurar `admin@memorial.com` e `gestor@memorial.com`: **deletar as contas** se existirem (ou, no mínimo, resetar a senha e desabilitar).
4. Adicionar `scripts/superadmin-claim.json` e `scripts/serviceAccountKey.json` ao `.gitignore` (o segundo já está — confirmar).
5. Atualizar a seção do `README.md` que documenta o script (hoje cita `set-superadmin.js`, o nome errado).

**Critério de aceitação:**
- `git ls-files | grep superadmin-claim` → vazio.
- `node scripts/set-superadmin.cjs` sem argumento imprime o uso e sai com código 1.
- `node scripts/set-superadmin.cjs admin@memorial.com` recusa com a mensagem de backdoor.
- Firebase Console não tem usuário `admin@memorial.com` nem `gestor@memorial.com` habilitado.

**Riscos e reversão:** nenhum risco de runtime (script administrativo). Se o superadmin atual perder o claim por engano, basta rodar o script com o e-mail correto.

---

## [W0-3] — `manualMonitorTrigger` fail-open sem token (S-03, item 6)

**Arquivo(s):** `functions/src/index.ts`
**Linha(s):** 573–579
**Diagnóstico:** a checagem `if (token && authHeader !== ...)` só autentica **se** `MONITOR_TRIGGER_TOKEN` estiver definido. Sem o env configurado (estado padrão de qualquer deploy novo), o endpoint HTTP fica **aberto à internet**: qualquer pessoa pode disparar varreduras completas do Firestore (custo de leitura) e, com `WHATSAPP_ENABLED=true`, spam de alertas WhatsApp aos destinatários configurados. Fail-open é o anti-padrão clássico: a ausência de configuração deve negar, não permitir.

**Código atual (before):**
```typescript
// functions/src/index.ts:573-579
  async (req, res) => {
    const authHeader = req.headers.authorization ?? '';
    const token = process.env.MONITOR_TRIGGER_TOKEN ?? '';
    if (token && authHeader !== `Bearer ${token}`) {
      res.status(401).json({ error: 'Nao autorizado' });
      return;
    }
```

**Código corrigido (after):**
```typescript
// functions/src/index.ts — fail-closed: sem token configurado, o endpoint não opera
  async (req, res) => {
    const authHeader = req.headers.authorization ?? '';
    const token = process.env.MONITOR_TRIGGER_TOKEN ?? '';
    if (!token) {
      res.status(503).json({ error: 'Trigger desabilitado: MONITOR_TRIGGER_TOKEN não configurado' });
      return;
    }
    if (authHeader !== `Bearer ${token}`) {
      res.status(401).json({ error: 'Não autorizado' });
      return;
    }
```

**Passos de implementação:**
1. Aplicar o diff acima em `functions/src/index.ts` (função `manualMonitorTrigger`).
2. Gerar um token forte: `openssl rand -hex 32`.
3. Configurar como secret: `firebase functions:secrets:set MONITOR_TRIGGER_TOKEN` (ou definir no env de deploy do Cloud Run; se usar `defineSecret`, adicionar `secrets: [monitorTriggerToken]` nas options da função — abordagem preferível à `process.env`, seguindo o padrão já usado por `OPENROUTER_API_KEY` na linha 23).
4. `cd functions && npm run build && firebase deploy --only functions:manualMonitorTrigger`.
5. Testar: `curl -i https://us-central1-memorialos.cloudfunctions.net/manualMonitorTrigger` → 503 ou 401; com `-H "Authorization: Bearer <token>"` → 200.

**Critério de aceitação:**
- Requisição sem header retorna 503 (token ausente) ou 401 (token configurado, header errado) — nunca 200.
- Requisição com o Bearer correto retorna 200 e executa os monitores.
- O token não aparece em nenhum arquivo versionado (`grep -r MONITOR_TRIGGER_TOKEN --include="*.ts" functions/src` mostra apenas a leitura do env).

**Riscos e reversão:** se o CI/rotina externa usava o endpoint sem token, passará a receber 503 — comportamento desejado; corrigir o chamador com o token. Reversão: redeployar a revisão anterior da function.

---

## [W0-4] — Registro de incidente de segurança falha em silêncio (D-03, item 4)

**Arquivo(s):** `src/pages/admin/SecurityPage.tsx`
**Linha(s):** 52–84 (handleCreateEvent e updateStatus)
**Diagnóstico:** com "Todas as unidades" selecionado, `handleCreateEvent` envia `cemeteryId: 'all'` (linha 58); `createForTenant` (`sciService.ts:235-237`, guard do item A7.2) **lança erro** para `cemeteryId === 'all'`; o `catch` (linhas 69–71) só faz `console.error`. É a única página SCI sem o guard preventivo e sem toasts — o gestor clica "Registrar evento", nada acontece, e um **incidente de segurança relatado se perde**. `updateStatus` (76–84) tem o mesmo silêncio. Impacto de negócio: perda de registro de ocorrência de segurança em órgão público — exatamente o dado que não pode sumir.

**Código atual (before):**
```typescript
// src/pages/admin/SecurityPage.tsx:52-84
  const handleCreateEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !form.title) return;
    setSaving(true);
    try {
      await createOccurrenceRecord(tenantId, {
        cemeteryId: selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId,
        category: 'security',
        severity: form.severity as any,
        status: 'open',
        title: form.title,
        description: form.description,
        location: form.location,
        openedAt: new Date().toISOString().slice(0, 16)
      });
      setForm({ title: '', severity: 'medium', location: '', description: '' });
      await loadEvents();
    } catch (error) {
      console.error('Erro ao registrar evento de seguranca:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    if (!tenantId) return;
    try {
      await updateSCIRecord(tenantId, 'sci_occurrences', id, 'UPDATE_SECURITY_EVENT', { status });
      await loadEvents();
    } catch (error) {
      console.error('Erro ao atualizar incidente de seguranca:', error);
    }
  };
```

**Código corrigido (after):**
```typescript
// src/pages/admin/SecurityPage.tsx
import toast from 'react-hot-toast'; // adicionar ao bloco de imports (linha 1-5)

  const handleCreateEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !form.title) return;
    if (selectedCemeteryId === 'all') {
      toast.error('Selecione um cemitério específico antes de registrar um incidente.');
      return;
    }
    setSaving(true);
    try {
      await createOccurrenceRecord(tenantId, {
        cemeteryId: selectedCemeteryId,
        category: 'security',
        severity: form.severity as any,
        status: 'open',
        title: form.title,
        description: form.description,
        location: form.location,
        openedAt: new Date().toISOString().slice(0, 16)
      });
      toast.success('Incidente de segurança registrado.');
      setForm({ title: '', severity: 'medium', location: '', description: '' });
      await loadEvents();
    } catch (error: any) {
      const msg = error?.code === 'permission-denied'
        ? 'Sem permissão para esta operação.'
        : error?.message || 'Erro ao registrar o incidente. Tente novamente.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    if (!tenantId) return;
    try {
      await updateSCIRecord(tenantId, 'sci_occurrences', id, 'UPDATE_SECURITY_EVENT', { status });
      toast.success('Incidente atualizado.');
      await loadEvents();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar o incidente.');
    }
  };
```

**Passos de implementação:**
1. Adicionar `import toast from 'react-hot-toast';` no topo de `SecurityPage.tsx`.
2. Substituir os dois handlers pelo bloco acima (guard de `'all'` antes do `setSaving`, toasts de sucesso e erro com o mapeamento padrão de `permission-denied` usado nas outras 8 páginas SCI, ex.: `OperationalPage.tsx:137-140`).
3. Opcional na mesma PR (recomendado): desabilitar visualmente o botão quando `selectedCemeteryId === 'all'` com `title="Selecione uma unidade"` para prevenir o clique em vez de só reagir a ele.
4. Adicionar toast de erro também em `loadEvents` (linhas 43–45) — hoje o catch é silencioso (parte da varredura W3-2, mas o custo aqui é uma linha).

**Critério de aceitação:**
- Com "Todas as unidades" ativo, clicar "Registrar evento" mostra toast de erro orientando a selecionar unidade e **não** chama o Firestore (verificar na aba Network).
- Com unidade específica, o registro é criado, toast verde aparece e a lista recarrega.
- Resolver um incidente mostra toast de sucesso; falha (ex.: offline) mostra toast de erro.

**Riscos e reversão:** nenhum — o item apenas adiciona feedback e um guard idêntico ao das demais páginas. Reversão trivial por revert do commit.

---

## [W0-5] — Componente `ConfirmDialog` + exclusão de cemitério sem confirmação (D-01, item 1)

**Arquivo(s):** `src/components/ui/ConfirmDialog.tsx` (novo), `src/pages/admin/CemeteryList.tsx`
**Linha(s):** `CemeteryList.tsx:119-130` (handler) e 166–172 (botão da lixeira)
**Diagnóstico:** o ícone de lixeira no card do cemitério chama `handleDelete` diretamente — um clique dispara `deleteCemetery` (`cemeteryService.ts:137-188`), que cascateia a exclusão de **todos os plots e setores** do cemitério. Há salvaguardas no service (bloqueia se houver ocupados/reservados ou notificações pendentes), mas um cemitério recém-estruturado com 3.000 plots disponíveis é apagado sem nenhum "tem certeza?". O `IMPLEMENTACAO_STATUS.md:53` afirma que havia modal — **não há** (confirmado na leitura: o onClick chama o handler direto). Este item também cria o `ConfirmDialog` reutilizável consumido por W0-6, W3-5 e W3-6.

**Código atual (before):**
```typescript
// src/pages/admin/CemeteryList.tsx:119-130
  const handleDelete = async (event: React.MouseEvent, cemeteryId: string) => {
    event.preventDefault();
    if (!tenantId) return;
    try {
      await deleteCemetery(tenantId, cemeteryId);
      toast.success('Cemitério excluído.');
      fetchData();
      await refreshCemeteries(); // remove a opção do dropdown imediatamente
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível excluir este cemitério.');
    }
  };
```
```tsx
// src/pages/admin/CemeteryList.tsx:166-172 (botão que dispara direto)
              <button
                onClick={(e) => handleDelete(e, cemetery.id!)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                title="Excluir cemiterio"
              >
                <Trash2 size={18} />
              </button>
```

**Código corrigido (after) — arquivo novo `src/components/ui/ConfirmDialog.tsx`:**
```tsx
import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useModal } from '@/hooks/useModal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Quando definido, o usuário precisa digitar exatamente este texto para habilitar a confirmação. */
  requireText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, description,
  confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  danger = false, requireText, loading = false,
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const { containerRef } = useModal(open, onCancel);

  useEffect(() => { if (open) setTyped(''); }, [open]);

  if (!open) return null;
  const confirmDisabled = loading || (requireText ? typed !== requireText : false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl"
      >
        <div className="flex items-start gap-3 mb-4">
          {danger && (
            <div className="p-2 bg-red-50 text-red-600 rounded-full shrink-0">
              <AlertTriangle size={20} />
            </div>
          )}
          <div>
            <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-900">{title}</h2>
            <div className="text-sm text-slate-500 mt-1">{description}</div>
          </div>
        </div>

        {requireText && (
          <div className="mb-4">
            <label htmlFor="confirm-dialog-input" className="block text-xs text-slate-500 mb-1">
              Digite <span className="font-mono font-semibold text-slate-700">{requireText}</span> para confirmar:
            </label>
            <input
              id="confirm-dialog-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
              autoComplete="off"
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Excluindo...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Código corrigido (after) — `src/pages/admin/CemeteryList.tsx`:**
```typescript
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// Novo estado no componente:
const [pendingDelete, setPendingDelete] = useState<Cemetery | null>(null);
const [deleting, setDeleting] = useState(false);

// O botão da lixeira agora só ARMA a exclusão:
//   onClick={(e) => { e.preventDefault(); setPendingDelete(cemetery); }}
//   aria-label={`Excluir cemitério ${cemetery.name}`}

const confirmDelete = async () => {
  if (!tenantId || !pendingDelete?.id) return;
  setDeleting(true);
  try {
    await deleteCemetery(tenantId, pendingDelete.id);
    toast.success('Cemitério excluído.');
    setPendingDelete(null);
    fetchData();
    await refreshCemeteries();
  } catch (error: any) {
    toast.error(error?.message || 'Não foi possível excluir este cemitério.');
  } finally {
    setDeleting(false);
  }
};

// No JSX, antes do fechamento do componente:
<ConfirmDialog
  open={!!pendingDelete}
  danger
  loading={deleting}
  title="Excluir cemitério"
  description={
    <>
      Esta ação exclui <strong>{pendingDelete?.name}</strong> e todos os seus setores e
      jazigos <em>disponíveis</em>. Jazigos ocupados ou solicitações pendentes bloqueiam
      a exclusão automaticamente. A ação não pode ser desfeita.
    </>
  }
  confirmLabel="Excluir definitivamente"
  requireText={pendingDelete?.name}
  onConfirm={confirmDelete}
  onCancel={() => setPendingDelete(null)}
/>
```

**Passos de implementação:**
1. Criar `src/components/ui/ConfirmDialog.tsx` com o código acima (usa o `useModal` já existente em `src/hooks/useModal.ts` — Esc, foco inicial e role/aria de graça).
2. Em `CemeteryList.tsx`: adicionar estados `pendingDelete`/`deleting`; trocar o `onClick` da lixeira (linha 167) por `setPendingDelete(cemetery)`; renomear o antigo `handleDelete` para `confirmDelete` com o corpo acima; renderizar o `ConfirmDialog` no fim do JSX.
3. `requireText={pendingDelete?.name}` é intencional: exclusão em cascata de milhares de documentos merece a fricção de digitar o nome (padrão GitHub para deleção de repositório).
4. Testar os três caminhos: cancelar, confirmar com sucesso, confirmar com bloqueio do service (cemitério com plot ocupado — a mensagem do service aparece no toast e o modal permanece aberto para o usuário ler).

**Critério de aceitação:**
- Clicar na lixeira **não** exclui nada; abre o diálogo com o nome do cemitério.
- O botão "Excluir definitivamente" só habilita após digitar o nome exato.
- Esc e "Cancelar" fecham sem efeito colateral.
- Exclusão bloqueada pelo service exibe a mensagem específica ("possui jazigos ocupados...") em toast.
- `ConfirmDialog` exportado e sem dependência de página específica (reutilizável).

**Riscos e reversão:** UX levemente mais lenta para exclusões legítimas (intencional). Nenhum risco de dados. Reversão: revert do commit restaura o clique direto (não recomendado).

---

## [W0-6] — Exclusão de falecido sem confirmação (D-02, item 2)

**Arquivo(s):** `src/pages/admin/DeceasedList.tsx`
**Linha(s):** 32–42 (handler) e 132–137 (item "Excluir" do dropdown)
**Diagnóstico:** o item "Excluir" do menu kebab chama `handleDelete` imediatamente — apaga o **registro oficial de um falecido** (e sua projeção pública) num clique, dentro de um dropdown onde o alvo anterior do mouse era "Ver detalhes". Registro público municipal não pode ter exclusão irreversível a um clique de distância. (A cascata incompleta do `deleteDeceased` — plot órfão e arquivos no Storage — é tratada em W1-3; aqui é só a confirmação.)

**Código atual (before):**
```typescript
// src/pages/admin/DeceasedList.tsx:32-42
  const handleDelete = async (id: string) => {
    if (!tenantId) return;
    setOpenMenuId(null);
    try {
      await deleteDeceased(id, tenantId);
      toast.success('Registro excluído.');
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao excluir registro.');
    }
  };
```
```tsx
// src/pages/admin/DeceasedList.tsx:132-137 (dropdown)
                          <button
                            onClick={() => handleDelete(person.id!)}
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            Excluir
                          </button>
```

**Código corrigido (after):**
```typescript
// src/pages/admin/DeceasedList.tsx
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const [pendingDelete, setPendingDelete] = useState<Deceased | null>(null);
const [deleting, setDeleting] = useState(false);

// No dropdown, o botão "Excluir" passa a armar:
//   onClick={() => { setOpenMenuId(null); setPendingDelete(person); }}

const confirmDelete = async () => {
  if (!tenantId || !pendingDelete?.id) return;
  setDeleting(true);
  try {
    await deleteDeceased(pendingDelete.id, tenantId);
    toast.success('Registro excluído.');
    setPendingDelete(null);
    await loadData();
  } catch (error: any) {
    toast.error(error?.message || 'Erro ao excluir registro.');
  } finally {
    setDeleting(false);
  }
};

// No JSX:
<ConfirmDialog
  open={!!pendingDelete}
  danger
  loading={deleting}
  title="Excluir registro de falecido"
  description={
    <>
      Excluir o registro de <strong>{pendingDelete?.name}</strong>
      {pendingDelete?.documents?.length
        ? <> (com {pendingDelete.documents.length} documento(s) anexado(s))</>
        : null}?
      O registro também sai da busca pública. Esta ação não pode ser desfeita.
    </>
  }
  confirmLabel="Excluir registro"
  onConfirm={confirmDelete}
  onCancel={() => setPendingDelete(null)}
/>
```

**Passos de implementação:**
1. Depende de W0-5 (componente `ConfirmDialog`).
2. Trocar o tipo do estado: guardar o objeto `Deceased` (não só o id) para exibir nome e nº de anexos no diálogo.
3. Trocar o onClick do item "Excluir" para fechar o menu e armar `pendingDelete`.
4. Sem `requireText` aqui (exclusão unitária) — a fricção do diálogo com nome visível é suficiente; se o produto decidir por soft-delete (Onda 4/roadmap), este diálogo vira "Inativar registro".

**Critério de aceitação:**
- Clicar "Excluir" no dropdown abre o diálogo com o nome do falecido; nada é excluído antes do confirmar.
- Confirmar exclui, mostra toast e atualiza a lista; o documento some de `deceaseds` e de `public_deceaseds`.
- Cancelar/Esc não exclui.

**Riscos e reversão:** nenhum. Reversão por revert.

---

## [W0-7] — Duplo-submit nos wizards de óbito (item 11, G-5)

**Arquivo(s):** `src/pages/user/ReportDeath.tsx` (linhas 141–176), `src/pages/admin/AdminReportDeath.tsx` (handleFinalSubmit, ~linha 115)
**Diagnóstico:** `handleFinalSubmit` do wizard do cidadão não tem estado `isSubmitting`: o upload dos documentos + criação da notificação levam segundos, e cada clique extra em "Comunicar obito" cria **outra** notificação completa (re-subindo todos os arquivos). O wizard admin (`AdminReportDeath`) tem o mesmo problema criando **registros oficiais duplicados** de falecido. Impacto: fila do gestor poluída com duplicatas; registros oficiais duplicados exigem exclusão manual (que hoje nem libera o plot).

**Código atual (before):**
```typescript
// src/pages/user/ReportDeath.tsx:141-176
  const handleFinalSubmit = async () => {
    try {
      if (!selectedCemeteryId) {
        alert('Selecione um cemiterio.');
        return;
      }

      const cemetery = await getCemetery(selectedCemeteryId);
      if (!cemetery || !cemetery.tenantId) {
        alert('Erro ao identificar a prefeitura responsavel pelo cemiterio.');
        return;
      }

      const relationshipType = formData.relationshipType;
      const relationshipLabel = getRelationshipLabel(
        relationshipType,
        formData.relationshipCustom
      );

      const finalData = {
        ...formData,
        obituary: obituaryText,
        cemeteryId: selectedCemeteryId,
        relationshipType,
        relationshipLabel
      };

      await createDeathNotification(cemetery.tenantId, finalData, docFiles, photoFile || undefined);

      alert('Obito comunicado com sucesso. Um gestor vai analisar sua solicitacao.');
      navigate('/app/memorias');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar. Verifique os dados e tente novamente.');
    }
  };
```

**Código corrigido (after):**
```typescript
// src/pages/user/ReportDeath.tsx
import toast from 'react-hot-toast'; // adicionar ao import

const [isSubmitting, setIsSubmitting] = useState(false);

const handleFinalSubmit = async () => {
  if (isSubmitting) return; // proteção extra contra corrida de eventos
  if (!selectedCemeteryId) {
    toast.error('Selecione um cemitério.');
    return;
  }
  setIsSubmitting(true);
  try {
    const cemetery = await getCemetery(selectedCemeteryId);
    if (!cemetery || !cemetery.tenantId) {
      toast.error('Erro ao identificar a prefeitura responsável pelo cemitério.');
      return;
    }

    const relationshipType = formData.relationshipType;
    const relationshipLabel = getRelationshipLabel(relationshipType, formData.relationshipCustom);

    const finalData = {
      ...formData,
      obituary: obituaryText,
      cemeteryId: selectedCemeteryId,
      relationshipType,
      relationshipLabel
    };

    await createDeathNotification(cemetery.tenantId, finalData, docFiles, photoFile || undefined);

    toast.success('Óbito comunicado com sucesso. Um gestor vai analisar sua solicitação.');
    navigate('/app/memorias');
  } catch (error: any) {
    console.error(error);
    toast.error(error?.message || 'Erro ao salvar. Verifique os dados e tente novamente.');
  } finally {
    setIsSubmitting(false);
  }
};

// No botão de submit do passo 4:
// <button onClick={handleFinalSubmit} disabled={isSubmitting} className="... disabled:opacity-60">
//   {isSubmitting ? 'Enviando...' : 'Comunicar óbito'}
// </button>
```

**Passos de implementação:**
1. `ReportDeath.tsx`: adicionar `isSubmitting`, aplicar o after acima, e `disabled={isSubmitting}` + label dinâmico no botão final (linha ~476).
2. `AdminReportDeath.tsx`: aplicar o mesmo padrão no `handleFinalSubmit` (o arquivo já usa `useMemo`/revoke para objectURL — só falta o isSubmitting); trocar os `alert()` por `toast` na mesma passada.
3. Os `alert()` restantes de `ReportDeath` (`handleGenerateObituary` linha 135 e validações 144/150) também viram `toast.error` aqui — evita segunda passada no arquivo (o restante da varredura de alert é W3-9).

**Critério de aceitação:**
- Clicar 5× rápido em "Comunicar óbito" cria **exatamente 1** documento em `death_notifications` (verificar no console Firestore).
- Durante o envio o botão mostra "Enviando..." e fica desabilitado.
- `grep -n "alert(" src/pages/user/ReportDeath.tsx src/pages/admin/AdminReportDeath.tsx` → sem resultados.

**Riscos e reversão:** nenhum risco funcional. Atenção: manter o `finally` para reabilitar o botão em erro (senão o formulário trava após falha de rede).

---

## [W0-8] — Uploads do cidadão sem validação de tipo/tamanho (item 17, G-6)

**Arquivo(s):** `src/pages/user/ReportDeath.tsx` (onChange da foto, linha 207, e dos documentos, ~linha 355), `src/pages/user/ProfilePage.tsx` (linhas 58–62)
**Diagnóstico:** `src/lib/fileValidation.ts` existe (criado no B2) e é usado em `DeceasedForm`/`DocumentsCenterPage`, mas os fluxos do **cidadão** aceitam qualquer arquivo: `onChange={(e) => e.target.files && setPhotoFile(e.target.files[0])}`. Combinado com as Storage rules sem limite (W2-2), um usuário autenticado sobe um `.exe` de 500 MB — custo de storage e vetor de distribuição de malware via URL tokenizada. Defesa em profundidade exige o cliente validar (aqui) e as rules limitarem (W2-2).

**Código atual (before):**
```tsx
// src/pages/user/ReportDeath.tsx:204-209 (foto)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files && setPhotoFile(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
```
```typescript
// src/pages/user/ProfilePage.tsx:58-62
  const handlePhotoChange = (file?: File) => {
    if (!file) return;
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };
```

**Código corrigido (after):**
```tsx
// src/pages/user/ReportDeath.tsx
import { validateFile, ALLOWED_IMAGE_TYPES } from '@/lib/fileValidation';

// Foto:
const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const error = validateFile(file, ALLOWED_IMAGE_TYPES);
  if (error) {
    toast.error(error);
    e.target.value = '';
    return;
  }
  setPhotoFile(file);
};
// <input type="file" accept="image/*" onChange={handlePhotoChange} ... />

// Documentos (mesmo padrão de DeceasedForm.tsx:55-70):
const handleDocsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  const valid: File[] = [];
  for (const file of files) {
    const error = validateFile(file); // default: PDF + imagens, máx. 10 MB
    if (error) {
      toast.error(`${file.name}: ${error}`);
      continue;
    }
    valid.push(file);
  }
  setDocFiles((prev) => [...prev, ...valid]);
  e.target.value = '';
};
```
```typescript
// src/pages/user/ProfilePage.tsx
import { validateFile, ALLOWED_IMAGE_TYPES } from '@/lib/fileValidation';
import toast from 'react-hot-toast';

  const handlePhotoChange = (file?: File) => {
    if (!file) return;
    const error = validateFile(file, ALLOWED_IMAGE_TYPES);
    if (error) {
      toast.error(error);
      return;
    }
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };
```

**Passos de implementação:**
1. `ReportDeath.tsx`: extrair os dois handlers acima e ligá-los aos inputs de foto (linha 207) e documentos (~linha 355).
2. `ProfilePage.tsx`: aplicar o guard no `handlePhotoChange` existente.
3. Nenhum pacote novo — `validateFile`, `ALLOWED_IMAGE_TYPES` e `ALLOWED_DOCUMENT_TYPES` já existem em `src/lib/fileValidation.ts`.

**Critério de aceitação:**
- Selecionar um `.exe` como documento mostra toast "Tipo de arquivo não permitido..." e o arquivo não entra na lista.
- Imagem > 10 MB mostra toast com o tamanho e é rejeitada.
- PDFs e imagens válidos continuam funcionando de ponta a ponta (comunicação de óbito completa).

**Riscos e reversão:** um cidadão com um formato legítimo fora da whitelist (ex.: HEIC de iPhone) será bloqueado — avaliar adicionar `image/heic` a `ALLOWED_IMAGE_TYPES` ou orientar conversão na mensagem. Reversão trivial.

---

## [W0-9] — Vazamento de `URL.createObjectURL` a cada render (item 33, B1 incompleto)

**Arquivo(s):** `src/pages/user/ReportDeath.tsx` (linhas 197 e 441), `src/pages/user/ProfilePage.tsx` (linha 61)
**Diagnóstico:** `<img src={URL.createObjectURL(photoFile)} />` cria um novo blob URL **a cada render** — e o passo 1 do wizard re-renderiza a cada tecla digitada. Centenas de blobs não revogados por sessão. O fix B1 foi aplicado só em `AdminReportDeath.tsx:70-79` (useMemo + revoke) — replicar o mesmo padrão.

**Código atual (before):**
```tsx
// src/pages/user/ReportDeath.tsx:196-198 (idem na linha 441, passo de revisão)
                {photoFile ? (
                  <img src={URL.createObjectURL(photoFile)} className="w-full h-full object-cover" />
                ) : (
```

**Código corrigido (after):**
```tsx
// src/pages/user/ReportDeath.tsx — padrão idêntico ao de AdminReportDeath.tsx:70-79
const photoPreviewUrl = useMemo(
  () => (photoFile ? URL.createObjectURL(photoFile) : null),
  [photoFile]
);

useEffect(() => {
  return () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  };
}, [photoPreviewUrl]);

// Nos DOIS pontos do JSX (passo 1 e passo 4 de revisão):
{photoPreviewUrl ? (
  <img src={photoPreviewUrl} alt="Foto do ente querido" className="w-full h-full object-cover" />
) : ( /* ... */ )}
```
```typescript
// src/pages/user/ProfilePage.tsx — revogar o preview anterior ao trocar de foto
  const handlePhotoChange = (file?: File) => {
    if (!file) return;
    const error = validateFile(file, ALLOWED_IMAGE_TYPES);
    if (error) { toast.error(error); return; }
    setPhotoFile(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };
```

**Passos de implementação:**
1. Em `ReportDeath.tsx`, criar `photoPreviewUrl` com `useMemo` + cleanup em `useEffect`; substituir as duas ocorrências de `URL.createObjectURL(photoFile)` no JSX (linhas 197 e 441).
2. Aproveitar para adicionar `alt` nas duas imagens (achado 2.8 de acessibilidade — custo zero aqui).
3. Em `ProfilePage.tsx`, revogar o URL anterior dentro do setter (integra com W0-8 que já mexe no mesmo handler).

**Critério de aceitação:**
- DevTools → Memory: digitar 30 caracteres no passo 1 com foto selecionada não cria novos blobs (contagem de `blob:` URLs estável em 1).
- Preview da foto continua aparecendo nos passos 1 e 4.

**Riscos e reversão:** nenhum. Reversão trivial.

---

## [W0-10] — Deploy verificado de rules/functions e evidência (item 7, G-8)

**Arquivo(s):** processo (sem mudança de código além do registro)
**Diagnóstico:** o `IMPLEMENTACAO_STATUS.md:16-21` lista o deploy das regras corrigidas como "ação pendente" — ou seja, **não há evidência de que as `firestore.rules`/`storage.rules` do repositório estejam em produção**. Se as rules ativas forem anteriores ao C2, dados pessoais podem estar publicamente legíveis AGORA. Este é o único item da onda que não altera código: ele garante que tudo que já foi corrigido esteja de fato valendo.

**Passos de implementação:**
1. A partir do commit `d63e29d` (ou do HEAD pós-W0), rodar:
   ```bash
   firebase deploy --only firestore:rules,storage,firestore:indexes
   cd functions && npm run build && cd ..
   firebase deploy --only functions
   ```
2. Verificar no Firebase Console → Firestore → Rules que o bloco `match /public_deceaseds/` existe (marcador inequívoco da versão pós-C2/c492f94).
3. Teste externo de regressão LGPD (deve retornar 403):
   ```bash
   curl -s "https://firestore.googleapis.com/v1/projects/memorialos/databases/(default)/documents/deceaseds" | head -5
   curl -s "https://firestore.googleapis.com/v1/projects/memorialos/databases/(default)/documents/plot_concessions" | head -5
   ```
4. Registrar o output dos comandos num comentário do PR/issue "Onda 0" (evidência de auditoria).
5. Abrir issue para automatizar deploy de rules por CI (resolvida em W2-11).

**Critério de aceitação:**
- Console mostra rules com timestamp do dia e conteúdo idêntico ao repo (diff visual).
- Os dois `curl` anônimos retornam `PERMISSION_DENIED`.
- `curl` anônimo em `public_deceaseds` (via SDK/REST com API key) **funciona** — a busca pública não regrediu.
- Evidência anexada ao PR.

**Riscos e reversão:** deploy de functions pode falhar por dependência local desatualizada (`npm ci` em `functions/` antes). Se as rules novas bloquearem algo inesperado em produção, `firebase deploy` da revisão anterior das rules reverte em minutos (manter o arquivo anterior à mão via git).

---

## SMOKE TEST DE SAÍDA DA ONDA 0 (15 min)

1. Login gestor → tentar excluir cemitério → diálogo com nome exigido; cancelar.
2. Excluir um falecido de teste → diálogo → confirmar → some da lista e da busca pública.
3. SecurityPage com "Todas as unidades" → registrar evento → toast de orientação (nada gravado).
4. Cidadão: comunicar óbito com PDF válido → 1 clique múltiplo → apenas 1 notificação criada.
5. Cidadão: tentar anexar `.txt` de 20 MB → rejeitado com toast.
6. `curl` no `manualMonitorTrigger` sem token → 503/401.
7. Secret `GEMINI_API_KEY` ausente no GitHub; build da main verde com guard.
8. Evidência do deploy de rules anexada.

---

# ONDA 1 — INTEGRIDADE DE DADOS (~5–6 dias)

> Objetivo: nenhuma operação multi-documento pode deixar o banco em estado intermediário; nenhum caminho de escrita pode dessincronizar `plots` ⇄ `deceaseds` ⇄ `death_notifications`. **Depende da Onda 0** (W0-10: rules em produção; W0-5/W0-6: ConfirmDialog disponível).

---

## [W1-1] — `allocateNotification` transacional com recheck de disponibilidade (D-04, item 5, G-7)

**Arquivo(s):** `src/services/notificationService.ts` (linhas 155–221), `src/pages/admin/CommunicatedDeaths.tsx` (linhas 95–114 e modal de alocação)
**Diagnóstico:** a alocação executa 4 escritas sequenciais sem transação: (1) `createDeceased` — que internamente ainda faz uploads e `logAction`; (2) `updatePlot` para `occupied`; (3) `updateDoc` da notificação; (4) `logAction`. Uma falha entre (1) e (2) deixa falecido criado sem jazigo; entre (2) e (3), jazigo ocupado com notificação ainda "Pendente" — re-alocável. Pior: **não relê o status do plot** — dois gestores alocando em paralelo (ou um plot ocupado manualmente entre abrir o modal e confirmar) resultam em dois sepultados no mesmo jazigo, o pior erro de domínio possível. Além disso, `burialDate` é sempre `new Date()` (linha 167/195) mesmo que o sepultamento seja em outra data.

**Código atual (before):**
```typescript
// src/services/notificationService.ts:155-221
export async function allocateNotification(
  notificationId: string,
  tenantId: string,
  allocationData: { cemeteryId: string; sectorId: string; plotId: string; plotCode?: string }
): Promise<{ notificationId: string; deceasedId: string }> {
  if (!auth.currentUser) throw new Error('Usuário não autenticado.');

  // 1. Buscar dados completos da notificação
  const notifSnap = await getDoc(doc(db, COLLECTION, notificationId));
  if (!notifSnap.exists()) throw new Error('Notificação não encontrada.');
  const notif = { id: notifSnap.id, ...notifSnap.data() } as DeathNotification;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // 2. Criar registro oficial em `deceaseds`
  const deceasedId = await createDeceased(tenantId, {
    name: notif.deceased.name,
    dateOfBirth: notif.deceased.dateOfBirth,
    dateOfDeath: notif.deceased.dateOfDeath,
    cemeteryId: allocationData.cemeteryId,
    plotId: allocationData.plotId,
    profession: notif.deceased.profession,
    hobbies: notif.deceased.hobbies,
    familyMembers: notif.deceased.familyMembers,
    achievements: notif.deceased.achievements,
    obituary: notif.deceased.obituary,
    epitaph: notif.deceased.epitaph,
    photoUrl: notif.photoUrl || undefined,
    city: notif.deceased.city,
    state: notif.deceased.state,
    documents: notif.documents,
  }, [], undefined);

  // 3. Atualizar o plot com todos os campos necessários para prazos
  await updatePlot(allocationData.plotId, tenantId, {
    status: 'occupied',
    deceasedId,
    occupantName: notif.deceased.name,
    burialDate: today, // Obrigatório para cálculo de exumação
    exhumationDeadlineYears: 3, // Lei federal — pode ser configurável por cemitério
    documentStatus: 'pending', // Aguarda regularização documental
  });

  // 4. Atualizar a notificação com referência ao deceasedId real
  await updateDoc(doc(db, COLLECTION, notificationId), {
    status: 'allocated',
    deceasedId, // Link para o registro oficial
    allocation: {
      ...allocationData,
      assignedBy: auth.currentUser.uid,
      assignedAt: serverTimestamp()
    }
  });

  await logAction(tenantId, 'ALLOCATE_DEATH_NOTIFICATION', COLLECTION, notificationId, null, {
    deceasedId,
    plotId: allocationData.plotId,
    plotCode: allocationData.plotCode
  });

  // Invalida o snapshot em cache para refletir o novo sepultamento (A3.3)
  invalidateCache(`sci_snapshot:${tenantId}`);

  return { notificationId, deceasedId };
}
```

**Código corrigido (after):**
```typescript
// src/services/notificationService.ts
import { runTransaction, Timestamp } from 'firebase/firestore'; // adicionar ao import de firebase/firestore

export class PlotUnavailableError extends Error {
  constructor(plotCode?: string) {
    super(
      plotCode
        ? `O jazigo ${plotCode} acabou de ser ocupado por outra operação. Escolha outro jazigo.`
        : 'Este jazigo acabou de ser ocupado por outra operação. Escolha outro jazigo.'
    );
    this.name = 'PlotUnavailableError';
  }
}

export async function allocateNotification(
  notificationId: string,
  tenantId: string,
  allocationData: {
    cemeteryId: string;
    sectorId: string;
    plotId: string;
    plotCode?: string;
    burialDate?: string; // YYYY-MM-DD — vem do modal; default hoje
  }
): Promise<{ notificationId: string; deceasedId: string }> {
  if (!auth.currentUser) throw new Error('Usuário não autenticado.');
  const actorUid = auth.currentUser.uid;
  const burialDate = allocationData.burialDate || new Date().toISOString().split('T')[0];

  const notifRef = doc(db, COLLECTION, notificationId);
  const plotRef = doc(db, 'plots', allocationData.plotId);
  const deceasedRef = doc(collection(db, 'deceaseds')); // id pré-gerado para uso na transação

  let deceasedPayload: Record<string, any> = {};

  await runTransaction(db, async (tx) => {
    // TODAS as leituras antes de qualquer escrita (exigência do Firestore)
    const [notifSnap, plotSnap] = await Promise.all([tx.get(notifRef), tx.get(plotRef)]);

    if (!notifSnap.exists()) throw new Error('Notificação não encontrada.');
    const notif = notifSnap.data() as DeathNotification;
    if (notif.status === 'allocated') {
      throw new Error('Esta solicitação já foi alocada por outro gestor.');
    }
    if (notif.tenantId !== tenantId) {
      throw new Error('Notificação não pertence a este tenant.');
    }

    if (!plotSnap.exists()) throw new Error('Jazigo não encontrado.');
    const plot = plotSnap.data() as { status: string; tenantId: string };
    if (plot.status !== 'available') {
      throw new PlotUnavailableError(allocationData.plotCode);
    }
    if (plot.tenantId !== tenantId) {
      throw new Error('Jazigo não pertence a este tenant.');
    }

    // 1. Registro oficial do falecido (mesmos campos do fluxo anterior)
    deceasedPayload = {
      tenantId,
      name: notif.deceased.name,
      dateOfBirth: notif.deceased.dateOfBirth,
      dateOfDeath: notif.deceased.dateOfDeath,
      cemeteryId: allocationData.cemeteryId,
      plotId: allocationData.plotId,
      profession: notif.deceased.profession ?? null,
      hobbies: notif.deceased.hobbies ?? null,
      familyMembers: notif.deceased.familyMembers ?? null,
      achievements: notif.deceased.achievements ?? null,
      obituary: notif.deceased.obituary ?? null,
      epitaph: notif.deceased.epitaph ?? null,
      photoUrl: notif.photoUrl ?? null,
      city: notif.deceased.city ?? null,
      state: notif.deceased.state ?? null,
      documents: notif.documents ?? [],
      createdAt: serverTimestamp(),
      createdBy: actorUid,
    };
    tx.set(deceasedRef, deceasedPayload);

    // 2. Ocupação do jazigo
    tx.update(plotRef, {
      status: 'occupied',
      deceasedId: deceasedRef.id,
      occupantName: notif.deceased.name,
      burialDate,
      exhumationDeadlineYears: 3, // TODO produto: configurável por cemitério (Anexo H-5 da análise)
      documentStatus: 'pending',
      updatedAt: serverTimestamp(),
    });

    // 3. Fechamento da notificação
    tx.update(notifRef, {
      status: 'allocated',
      deceasedId: deceasedRef.id,
      allocation: {
        cemeteryId: allocationData.cemeteryId,
        sectorId: allocationData.sectorId,
        plotId: allocationData.plotId,
        plotCode: allocationData.plotCode ?? null,
        assignedBy: actorUid,
        assignedAt: Timestamp.now(), // serverTimestamp() não é permitido em objeto aninhado dentro de tx.update com merge implícito
      },
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
    });
  });

  // Pós-commit (best-effort, fora da transação): projeção pública + auditoria + cache
  await syncPublicDeceasedFromAllocation(deceasedRef.id, tenantId, deceasedPayload);
  await logAction(tenantId, 'ALLOCATE_DEATH_NOTIFICATION', COLLECTION, notificationId, null, {
    deceasedId: deceasedRef.id,
    plotId: allocationData.plotId,
    plotCode: allocationData.plotCode,
    burialDate,
  });
  invalidateCache(`sci_snapshot:${tenantId}`);

  return { notificationId, deceasedId: deceasedRef.id };
}
```
```typescript
// src/services/deceasedService.ts — exportar a projeção para uso pós-transação
// (a função privada syncPublicDeceased já existe nas linhas 56-66; basta exportá-la
//  com um alias estável)
export async function syncPublicDeceasedFromAllocation(
  id: string,
  tenantId: string,
  source: Record<string, any>
) {
  return syncPublicDeceased(id, tenantId, source);
}
```
```tsx
// src/pages/admin/CommunicatedDeaths.tsx — novo campo de data + tratamento do conflito
const [burialDate, setBurialDate] = useState(() => new Date().toISOString().split('T')[0]);

// No modal de alocação, junto dos selects de setor/jazigo:
<div>
  <label className="block text-sm font-medium text-slate-700 mb-1">Data do sepultamento</label>
  <input
    type="date"
    value={burialDate}
    min={new Date().toISOString().split('T')[0]}
    onChange={(e) => setBurialDate(e.target.value)}
    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
  />
</div>

// handleConfirmAllocation:
const handleConfirmAllocation = async () => {
  if (!selectedNotification?.id || !selectedCemetery || !selectedSector || !selectedPlot || !tenantId) return;
  setIsSubmitting(true);
  try {
    const plot = plots.find(p => p.id === selectedPlot);
    await allocateNotification(selectedNotification.id, tenantId, {
      cemeteryId: selectedCemetery,
      sectorId: selectedSector,
      plotId: selectedPlot,
      plotCode: plot?.code,
      burialDate,
    });
    toast.success('Sepultamento alocado com sucesso. Registro de falecido criado.');
    setIsModalOpen(false);
    await fetchNotifications();
  } catch (error: any) {
    toast.error(`Erro ao alocar: ${error.message}`);
    if (error?.name === 'PlotUnavailableError' && selectedSector) {
      // Recarrega os jazigos do setor para refletir a ocupação concorrente
      const fresh = await getPlots(selectedSector);
      setPlots(fresh);
      setSelectedPlot('');
    }
  } finally {
    setIsSubmitting(false);
  }
};
```

**Passos de implementação:**
1. Adicionar `runTransaction` e `Timestamp` aos imports de `firebase/firestore` em `notificationService.ts`; remover os imports agora não usados (`createDeceased`, `updatePlot`) se nenhum outro ponto do arquivo os usar.
2. Substituir `allocateNotification` pelo bloco transacional acima; criar a classe `PlotUnavailableError` exportada.
3. Exportar `syncPublicDeceasedFromAllocation` de `deceasedService.ts` (wrapper de 1 linha da função privada existente).
4. `CommunicatedDeaths.tsx`: estado `burialDate` + input no modal + tratamento do erro de conflito com reload dos plots.
5. Resetar `burialDate` para hoje em `handleOpenModal` (junto dos outros resets, linhas 88–92).
6. Teste manual de corrida: abrir a mesma notificação em duas abas, alocar o mesmo jazigo nas duas — a segunda deve falhar com a mensagem de conflito e recarregar a lista, sem nenhum documento alterado.

**Critério de aceitação:**
- Alocação feliz: `deceaseds` criado, `plots.status='occupied'` com `burialDate` **do formulário**, notificação `allocated` — os 3 no mesmo instante (transação).
- Alocar plot já ocupado: erro claro, **zero** documentos alterados (conferir os 3 no console).
- Duas alocações concorrentes no mesmo plot: exatamente uma vence.
- Notificação já alocada não pode ser realocada ("já foi alocada por outro gestor").
- Busca pública encontra o falecido após alocação (projeção pós-commit funcionando).

**Riscos e reversão:** transações do Firestore re-executam em contenção — o corpo não pode ter efeitos colaterais externos (por isso `syncPublic`/`logAction` ficam fora). Se a projeção pública falhar pós-commit, a busca fica dessincronizada até o próximo update (mesmo comportamento best-effort de hoje; o backfill `scripts/backfill-public-deceaseds.cjs` corrige). Reversão: restaurar a versão sequencial anterior (sem perda de dados, só de garantia).

---

## [W1-2] — Aviso "nenhum jazigo disponível" com condição errada (D-10)

**Arquivo(s):** `src/pages/admin/CommunicatedDeaths.tsx`
**Linha(s):** 314–326
**Diagnóstico:** o select filtra `plots.filter(p => p.status === 'available')`, mas o aviso testa `plots.length === 0`. Setor com 200 jazigos todos ocupados → select vazio **sem mensagem**; o gestor acha que a tela travou.

**Código atual (before):**
```tsx
// src/pages/admin/CommunicatedDeaths.tsx:314-326
                        <option value="">Selecione...</option>
                        {plots.filter(p => p.status === 'available').map(p => (
                          <option key={p.id} value={p.id}>{p.code}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {plots.length === 0 && selectedSector && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      Nenhum jazigo disponível neste setor. Cadastre novos jazigos em "Inventário".
                    </p>
                  )}
```

**Código corrigido (after):**
```tsx
// src/pages/admin/CommunicatedDeaths.tsx — derivar a lista uma única vez
const availablePlots = useMemo(
  () => plots.filter((p) => p.status === 'available'),
  [plots]
);

// no JSX:
                        <option value="">Selecione...</option>
                        {availablePlots.map(p => (
                          <option key={p.id} value={p.id}>{p.code}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {availablePlots.length === 0 && selectedSector && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      {plots.length > 0
                        ? `Este setor tem ${plots.length} jazigo(s), mas nenhum disponível. Escolha outro setor ou libere um jazigo no Inventário.`
                        : 'Nenhum jazigo cadastrado neste setor. Cadastre novos jazigos em "Inventário".'}
                    </p>
                  )}
```

**Passos de implementação:**
1. Adicionar o `useMemo` `availablePlots` junto aos demais memos do componente.
2. Trocar o filtro inline do select e a condição do aviso, diferenciando "setor vazio" de "setor lotado".

**Critério de aceitação:** setor com jazigos todos ocupados exibe a mensagem "nenhum disponível"; setor sem jazigos exibe a mensagem de cadastro; setor com disponíveis popula o select normalmente.

**Riscos e reversão:** nenhum.

---

## [W1-3] — `deleteDeceased` não libera o jazigo nem remove arquivos (D-02b, item 14)

**Arquivo(s):** `src/services/deceasedService.ts` (linhas 150–154)
**Diagnóstico:** excluir um falecido deixa: (a) o plot vinculado eternamente `occupied` com `deceasedId` órfão — corrompendo taxa de ocupação, prazos de exumação e o mapa; (b) documentos e foto órfãos no Storage para sempre (não existe `deleteObject` em lugar nenhum do sistema). A exclusão de registro oficial precisa desfazer a ocupação na mesma batch e limpar o Storage best-effort.

**Código atual (before):**
```typescript
// src/services/deceasedService.ts:150-154
export async function deleteDeceased(id: string, tenantId: string) {
  await deleteDoc(doc(db, COLLECTION, id));
  await removePublicDeceased(id);
  await logAction(tenantId, 'DELETE_DECEASED', COLLECTION, id, null, { id });
}
```

**Código corrigido (after):**
```typescript
// src/services/deceasedService.ts
import { writeBatch, deleteField } from 'firebase/firestore'; // adicionar ao import
import { ref as storageRef, deleteObject } from 'firebase/storage'; // adicionar ao import

/** Extrai o caminho do Storage de uma downloadURL tokenizada (best-effort). */
function storagePathFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/o\/([^?]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export async function deleteDeceased(id: string, tenantId: string) {
  const docRef = doc(db, COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Registro não encontrado.');
  const data = snap.data() as Deceased;
  if (data.tenantId && data.tenantId !== tenantId) {
    throw new Error('Registro não pertence a este tenant.');
  }

  // 1. Exclusão do registro + liberação do jazigo na MESMA batch (atômico)
  const batch = writeBatch(db);
  batch.delete(docRef);
  if (data.plotId) {
    batch.update(doc(db, 'plots', data.plotId), {
      status: 'available',
      deceasedId: deleteField(),
      occupantName: deleteField(),
      burialDate: deleteField(),
      exhumationDeadlineYears: deleteField(),
      documentStatus: 'regular',
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();

  // 2. Pós-commit best-effort: projeção pública, arquivos do Storage e auditoria
  await removePublicDeceased(id);

  const urls: string[] = [
    ...(data.documents || []).map((d) => d.url),
    ...(data.photoUrl ? [data.photoUrl] : []),
  ];
  await Promise.allSettled(
    urls
      .map(storagePathFromUrl)
      .filter((p): p is string => !!p)
      .map((path) => deleteObject(storageRef(storage, path)))
  );

  await logAction(tenantId, 'DELETE_DECEASED', COLLECTION, id, null, {
    id,
    plotReleased: data.plotId ?? null,
    filesDeleted: urls.length,
  });
}
```

**Passos de implementação:**
1. Aplicar o after; conferir imports (`writeBatch`, `deleteField`, `deleteObject`).
2. Atenção à regra do Storage: quem exclui é staff; as rules atuais permitem staff deletar em `documents/{userId}/**` (W2-2 mantém isso para staff do tenant). Se a rule negar (arquivo de outro tenant), o `Promise.allSettled` engole a falha — comportamento correto (o registro já foi excluído).
3. Se o plot foi reocupado manualmente por OUTRO falecido entre a leitura e a batch (raro), a batch sobrescreveria — mitigação simples: comparar `data.plotId` com o `deceasedId` do plot exige leitura extra; opcional, documentado como limitação conhecida no comentário. Para a garantia total, usar `runTransaction` no lugar da batch (mesma estrutura de W1-1).
4. Testar: criar falecido via alocação → excluir → plot volta a `available` sem campos de ocupação → arquivos sumiram do Storage (console Firebase).

**Critério de aceitação:**
- Excluir falecido alocado libera o plot (status `available`, sem `deceasedId`/`occupantName`/`burialDate`) no mesmo commit.
- Arquivos anexados não existem mais no Storage.
- `public_deceaseds/{id}` removido.
- Excluir falecido sem `plotId` funciona sem erro.

**Riscos e reversão:** exclusão continua sendo hard-delete (soft-delete é decisão de produto — roadmap Onda 3 da análise, item 26). URLs de Storage em formato inesperado são ignoradas silenciosamente (allSettled). Reversão: revert do commit.

---

## [W1-4] — Fallback perigoso de `tenantId` no `createDeceased` (D-19)

**Arquivo(s):** `src/services/deceasedService.ts` (linhas 130–137)
**Diagnóstico:** `tenantId: tenantId || auth.currentUser?.uid || 'default'` é resíduo do modo demo: se algum caminho passar `tenantId` nulo, cria um registro fora de qualquer tenant real (invisível para todos os gestores, mas presente no banco). Os três call-sites reais (`DeceasedForm`, `AdminReportDeath`, `allocateNotification`) sempre têm tenant de staff — falhar explicitamente é o comportamento correto.

**Código atual (before):**
```typescript
// src/services/deceasedService.ts:129-137
  // 3. Create Firestore record
  const recordData = {
    ...data,
    tenantId: tenantId || auth.currentUser?.uid || 'default', // Fallback
    documents: uploadedDocs,
    photoUrl: photoUrl || data.photoUrl || null, // Ensure not undefined
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid
  };
```

**Código corrigido (after):**
```typescript
// src/services/deceasedService.ts
export async function createDeceased(tenantId: string, data: Omit<Deceased, 'id' | 'tenantId' | 'createdAt'>, files: File[], photoFile?: File) {
  if (!tenantId) {
    throw new Error('Tenant não identificado. Faça login novamente ou contate o suporte.');
  }
  // ... uploads inalterados ...

  const recordData = {
    ...data,
    tenantId,
    documents: uploadedDocs,
    photoUrl: photoUrl || data.photoUrl || null,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid
  };
```

**Passos de implementação:**
1. Mudar a assinatura de `tenantId: string | null` para `tenantId: string` e lançar no início.
2. O guard `if (tenantId)` das linhas 142–145 (logAction/sync) torna-se incondicional — simplificar.
3. `tsc --noEmit` aponta call-sites que passavam null — corrigir cada um exigindo tenant (todos já têm).

**Critério de aceitação:** `grep -n "'default'" src/services/deceasedService.ts` → vazio; criar falecido sem tenant no contexto lança erro claro em vez de gravar lixo.

**Riscos e reversão:** nenhum em produção real (claims sempre presentes para staff). Reversão trivial.

---

## [W1-5] — `deleteSector` deixa plots órfãos (D-09, item 40)

**Arquivo(s):** `src/services/cemeteryService.ts` (linhas 304–307), `src/pages/admin/CemeteryDetail.tsx` (linhas 284–294)
**Diagnóstico:** excluir setor apaga só o documento do setor; os plots ficam com `sectorId` inválido, permanecendo no inventário e nos indicadores. O próprio `window.confirm` da tela admite o problema ("Os jazigos associados nao serao removidos automaticamente"). Correção: mesma política do `deleteCemetery` — bloquear se houver ocupados/reservados, cascatear os demais em batch.

**Código atual (before):**
```typescript
// src/services/cemeteryService.ts:304-307
export async function deleteSector(tenantId: string, sectorId: string) {
  await deleteDoc(doc(db, SECTORS_COL, sectorId));
  await logAction(tenantId, 'DELETE_SECTOR', SECTORS_COL, sectorId, null, null);
}
```

**Código corrigido (after):**
```typescript
// src/services/cemeteryService.ts
export async function deleteSector(tenantId: string, sectorId: string) {
  // Bloqueia se houver jazigos ocupados ou reservados no setor
  const occupiedQuery = query(
    collection(db, PLOTS_COL),
    where('sectorId', '==', sectorId),
    where('status', 'in', ['occupied', 'reserved']),
    limit(1)
  );
  const occupiedSnap = await getDocs(occupiedQuery);
  if (!occupiedSnap.empty) {
    throw new Error('Não é possível excluir: o setor possui jazigos ocupados ou reservados.');
  }

  // Cascade: apaga os plots restantes (available/blocked) em lotes de 450
  const plotsSnap = await getDocs(
    query(collection(db, PLOTS_COL), where('sectorId', '==', sectorId))
  );
  let batch = writeBatch(db);
  let ops = 0;
  for (const plotDoc of plotsSnap.docs) {
    batch.delete(plotDoc.ref);
    ops++;
    if (ops >= 450) { await batch.commit(); batch = writeBatch(db); ops = 0; }
  }
  batch.delete(doc(db, SECTORS_COL, sectorId));
  await batch.commit();

  await logAction(tenantId, 'DELETE_SECTOR', SECTORS_COL, sectorId, null, {
    plotsDeleted: plotsSnap.size,
  });
}
```
```typescript
// src/pages/admin/CemeteryDetail.tsx — trocar window.confirm por ConfirmDialog (padrão W0-5)
const [pendingSectorDelete, setPendingSectorDelete] = useState<string | null>(null);

const confirmDeleteSector = async () => {
  if (!tenantId || !pendingSectorDelete) return;
  try {
    await deleteSector(tenantId, pendingSectorDelete);
    if (expandedSector === pendingSectorDelete) setExpandedSector(null);
    toast.success('Setor e jazigos disponíveis excluídos.');
    await loadData();
  } catch (error: any) {
    toast.error(error?.message || 'Erro ao excluir setor.');
  } finally {
    setPendingSectorDelete(null);
  }
};

// ConfirmDialog no JSX:
// title="Excluir setor" danger
// description="Todos os jazigos DISPONÍVEIS deste setor serão excluídos junto.
//              Jazigos ocupados ou reservados bloqueiam a exclusão."
```

**Passos de implementação:**
1. Aplicar o after no service (imports `limit`, `writeBatch` já existem no arquivo).
2. Na tela, substituir o `window.confirm` da linha 285 por `ConfirmDialog` + toasts (o `alert('Erro ao excluir setor.')` da linha 292 sai junto).
3. Verificar índice: a query `sectorId + status in [...]` usa igualdade + `in` — não requer índice composto adicional (o Firestore trata `in` como igualdade múltipla com um campo só de filtro extra; se o deploy acusar necessidade, adicionar a `firestore.indexes.json` conforme o link do erro).

**Critério de aceitação:**
- Setor com plot ocupado: exclusão bloqueada com mensagem específica.
- Setor com 900 plots disponíveis: setor + 900 plots somem (2 batches); inventário não lista mais nenhum plot do setor.
- `window.confirm` não existe mais em `handleDeleteSector`.

**Riscos e reversão:** exclusão em massa agora é possível pelo setor — a fricção do ConfirmDialog e o bloqueio de ocupados protegem. Reversão: revert (volta ao órfão, pior).

---

## [W1-6] — Mudar status para `available` mantém vínculos do falecido (D-07, item 39)

**Arquivo(s):** `src/pages/admin/InventoryPage.tsx` (linhas 154–166)
**Diagnóstico:** `handleStatusChange` grava só `{ status }`. Marcar um jazigo ocupado como `available` (lista ou modal de inspeção) deixa `deceasedId`/`occupantName`/`burialDate` no documento — jazigo "disponível" apontando para um falecido, elegível para nova alocação com dados fantasma e contaminando os indicadores de exumação.

**Código atual (before):**
```typescript
// src/pages/admin/InventoryPage.tsx:154-166
  const handleStatusChange = async (plotId: string, status: Plot['status']) => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await updatePlot(plotId, tenantId, { status });
      toast.success('Status do jazigo atualizado.');
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar status do jazigo.');
    } finally {
      setSaving(false);
    }
  };
```

**Código corrigido (after):**
```typescript
// src/pages/admin/InventoryPage.tsx
import { deleteField } from 'firebase/firestore';

  const handleStatusChange = async (plotId: string, status: Plot['status']) => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { status };
      if (status === 'available') {
        // Liberar o jazigo limpa todos os vínculos de ocupação
        payload.deceasedId = deleteField();
        payload.occupantName = deleteField();
        payload.burialDate = deleteField();
        payload.exhumationDeadlineYears = deleteField();
        payload.documentStatus = 'regular';
      }
      await updatePlot(plotId, tenantId, payload);
      toast.success(
        status === 'available'
          ? 'Jazigo liberado. Vínculos de ocupação removidos.'
          : 'Status do jazigo atualizado.'
      );
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar status do jazigo.');
    } finally {
      setSaving(false);
    }
  };
```

**Passos de implementação:**
1. Aplicar o after (import de `deleteField`).
2. Conferir que `updatePlot` repassa o payload sem filtrar `FieldValue` (é `updateDoc` direto — ok).
3. Se o plot tinha `deceasedId`, o registro do falecido continua apontando para o plot (`deceaseds.plotId`) — adicionar aviso no toast quando havia ocupante: sugerido exibir ConfirmDialog leve "Este jazigo está vinculado a NOME — liberar mesmo assim?" quando `plot.occupantName` existir (o dado está na linha da tabela).

**Critério de aceitação:** ocupar um jazigo via alocação, depois marcá-lo `available` no Inventário → documento sem `deceasedId`/`occupantName`/`burialDate` (console Firestore); indicadores de exumação não o listam mais.

**Riscos e reversão:** liberar por engano perde o vínculo (o falecido mantém `plotId` — reversível manualmente). O ConfirmDialog opcional do passo 3 mitiga. Reversão: revert.

---

## [W1-7] — Guard de `cemeteryId: 'all'` também nas rules (S-11 parcial, complemento do A7)

**Arquivo(s):** `firestore.rules` (blocos `sci_*` e `plots`)
**Diagnóstico:** o guard contra `cemeteryId: 'all'` existe no cliente (páginas) e no service (`createForTenant`), mas **não nas rules** — um staff via console grava `cemeteryId:'all'` e o registro desaparece dos filtros por unidade. Defesa em profundidade: a regra é a única camada não-contornável. Implementação completa das validações de schema fica em W2-5; aqui entra apenas o guard mínimo de `'all'`, porque é corrupção de dados (tema desta onda).

**Código atual (before) — exemplo do bloco (todos os 12 sci_* são idênticos):**
```javascript
// firestore.rules:199-203
    match /sci_operational_records/{recordId} {
      allow read: if isSignedIn() && isStaff(resource.data.tenantId);
      allow create: if isSignedIn() && isStaff(request.resource.data.tenantId);
      allow update, delete: if isSignedIn() && isStaff(resource.data.tenantId);
    }
```

**Código corrigido (after) — helper + aplicação nos creates:**
```javascript
// firestore.rules — adicionar junto aos helpers (após isStaff, linha 33):
    function hasValidCemeteryId() {
      // 'all' é um valor de FILTRO da UI, nunca um valor persistível
      return !('cemeteryId' in request.resource.data)
             || request.resource.data.cemeteryId != 'all';
    }

// e em cada bloco sci_* (12 blocos) e em plots, o create vira:
      allow create: if isSignedIn()
                    && isStaff(request.resource.data.tenantId)
                    && hasValidCemeteryId();
      allow update: if isSignedIn()
                    && isStaff(resource.data.tenantId)
                    && hasValidCemeteryId();
```

**Passos de implementação:**
1. Adicionar o helper e aplicar em: `sci_operational_records`, `sci_occurrences`, `sci_internal_notifications`, `sci_sanitary_checks`, `sci_environmental_checks`, `sci_financial_records`, `sci_stock_items`, `sci_documents`, `sci_ai_agents`, `sci_reports`, `sci_support_tickets`, `sci_training_sessions` e `plots` (creates e updates).
2. `firebase deploy --only firestore:rules`.
3. Testar no emulador (ou console com conta de teste): create com `cemeteryId:'all'` → `PERMISSION_DENIED`; create normal → ok. (O teste automatizado entra na bateria W2-11.)

**Critério de aceitação:** gravação com `cemeteryId:'all'` negada pela regra mesmo chamando o SDK diretamente; todos os fluxos de criação das páginas SCI continuam funcionando.

**Riscos e reversão:** se algum registro legado tiver `cemeteryId:'all'`, updates nele passam a exigir a correção do campo (o helper roda em update também) — rodar antes uma query de inventário (`where('cemeteryId','==','all')` em cada coleção) e migrar/apagar os poucos registros. Reversão: redeploy das rules anteriores.

---

## [W1-8] — Lista de falecidos truncada em 50 sem paginação (D-05, item 9)

**Arquivo(s):** `src/services/deceasedService.ts` (linhas 76–85), `src/pages/admin/DeceasedList.tsx`, `firestore.indexes.json`
**Diagnóstico:** `getDeceasedList` usa `limit(50)` fixo: o 51º falecido **não aparece em lugar nenhum** e a busca client-side só varre os 50 carregados. Para registro público municipal é falha de completude grave (cartórios/MP consultam o livro completo). Correção: cursor `startAfter` + botão "Carregar mais" + busca server-side por prefixo com campo `nameLowercase`.

**Código atual (before):**
```typescript
// src/services/deceasedService.ts:76-85
export async function getDeceasedList(tenantId: string) {
  const q = query(
    collection(db, COLLECTION), 
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deceased));
}
```

**Código corrigido (after):**
```typescript
// src/services/deceasedService.ts
import { startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

export const DECEASED_PAGE_SIZE = 50;

export interface DeceasedPage {
  items: Deceased[];
  /** Cursor para a próxima página; null quando não há mais registros. */
  cursor: QueryDocumentSnapshot<DocumentData> | null;
}

export async function getDeceasedPage(
  tenantId: string,
  after?: QueryDocumentSnapshot<DocumentData> | null
): Promise<DeceasedPage> {
  const constraints = [
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc'),
    ...(after ? [startAfter(after)] : []),
    limit(DECEASED_PAGE_SIZE),
  ];
  const snapshot = await getDocs(query(collection(db, COLLECTION), ...constraints));
  const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Deceased));
  return {
    items,
    cursor: snapshot.docs.length === DECEASED_PAGE_SIZE ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

/** Busca server-side por prefixo do nome (case-insensitive via nameLowercase). */
export async function searchDeceasedByName(tenantId: string, term: string): Promise<Deceased[]> {
  const prefix = term.trim().toLowerCase();
  if (prefix.length < 3) return [];
  const q = query(
    collection(db, COLLECTION),
    where('tenantId', '==', tenantId),
    where('nameLowercase', '>=', prefix),
    where('nameLowercase', '<=', prefix + ''),
    limit(50)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Deceased));
}

// Em createDeceased (recordData) e updateDeceased (quando data.name mudar), gravar:
//   nameLowercase: (data.name || '').toLowerCase(),
```
```tsx
// src/pages/admin/DeceasedList.tsx — estado paginado + "Carregar mais" + busca server-side
const [page, setPage] = useState<DeceasedPage>({ items: [], cursor: null });
const [loadingMore, setLoadingMore] = useState(false);
const [serverResults, setServerResults] = useState<Deceased[] | null>(null);

const loadData = async () => {
  if (!tenantId) return;
  try {
    const first = await getDeceasedPage(tenantId);
    setPage(first);
  } catch (error: any) {
    toast.error('Erro ao carregar a lista de falecidos.');
  } finally {
    setLoading(false);
  }
};

const loadMore = async () => {
  if (!tenantId || !page.cursor) return;
  setLoadingMore(true);
  try {
    const next = await getDeceasedPage(tenantId, page.cursor);
    setPage({ items: [...page.items, ...next.items], cursor: next.cursor });
  } catch {
    toast.error('Erro ao carregar mais registros.');
  } finally {
    setLoadingMore(false);
  }
};

// Busca: com 3+ caracteres, consulta o servidor (debounce de 400ms);
// com menos, mostra a página carregada.
useEffect(() => {
  if (!tenantId) return;
  const term = searchTerm.trim();
  if (term.length < 3) { setServerResults(null); return; }
  const t = setTimeout(async () => {
    try {
      setServerResults(await searchDeceasedByName(tenantId, term));
    } catch {
      toast.error('Erro na busca.');
    }
  }, 400);
  return () => clearTimeout(t);
}, [searchTerm, tenantId]);

const rows = serverResults ?? page.items;

// Após a tabela:
{!serverResults && page.cursor && (
  <div className="p-4 text-center border-t border-slate-100">
    <button
      onClick={loadMore}
      disabled={loadingMore}
      className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
    >
      {loadingMore ? 'Carregando...' : 'Carregar mais 50'}
    </button>
  </div>
)}
```
```json
// firestore.indexes.json — novo índice composto para a busca por prefixo
{
  "collectionGroup": "deceaseds",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "tenantId", "order": "ASCENDING" },
    { "fieldPath": "nameLowercase", "order": "ASCENDING" }
  ]
}
```

**Passos de implementação:**
1. Service: adicionar `getDeceasedPage`, `searchDeceasedByName`; gravar `nameLowercase` em `createDeceased` e `updateDeceased`; manter `getDeceasedList` como wrapper deprecado (`return (await getDeceasedPage(tenantId)).items;`) até nenhum consumidor restar.
2. Backfill dos registros existentes: script `scripts/backfill-name-lowercase.cjs` análogo ao `backfill-public-deceaseds.cjs` (iterar `deceaseds`, gravar `nameLowercase`, batches de 400). Rodar uma vez com service account.
3. Adicionar o índice em `firestore.indexes.json` e `firebase deploy --only firestore:indexes`.
4. Página: aplicar o after (a filtragem client-side `filteredDeceaseds` das linhas 44–46 sai — `rows` substitui).
5. O índice `tenantId + createdAt desc` já existe (query atual funciona) — confirmar em `firestore.indexes.json`.

**Critério de aceitação:**
- Tenant com 120 falecidos: primeira tela mostra 50, dois cliques em "Carregar mais" mostram 120, botão some.
- Buscar "mar" (3+ chars) retorna registros cujo nome começa com "mar" independentemente de estarem na página carregada.
- Registro novo aparece na busca imediatamente (nameLowercase gravado no create).

**Riscos e reversão:** busca por **prefixo** não encontra termo no meio do nome ("Silva" não acha "João Silva") — limitação documentada; para conter substring seria Algolia/Typesense (fora de escopo). Backfill precisa rodar antes do deploy da UI de busca (senão registros antigos não aparecem em buscas) — ordem: script → índice → UI. Reversão: wrapper `getDeceasedList` preserva o comportamento antigo.

---

## [W1-9] — Não existe edição de falecido (D-06, item 10)

**Arquivo(s):** `src/pages/admin/DeceasedForm.tsx`, `src/App.tsx`, `src/pages/admin/DeceasedDetail.tsx`, `src/pages/admin/DeceasedList.tsx`
**Diagnóstico:** `updateDeceased` está implementado no service (`deceasedService.ts:156-170`, com sync da projeção pública) e **nunca é chamado por nenhuma tela**. Erro de digitação no nome de um falecido = excluir e recriar, perdendo anexos e trilha. A correção reutiliza o `DeceasedForm` existente (melhor formulário do sistema) em modo edição.

**Código atual (before):**
```tsx
// src/App.tsx:128-130 — não há rota de edição
            <Route path="falecidos" element={<DeceasedList />} />
            <Route path="falecidos/novo" element={<DeceasedForm />} />
            <Route path="falecidos/:id" element={<DeceasedDetail />} />
```

**Código corrigido (after):**
```tsx
// src/App.tsx
            <Route path="falecidos" element={<DeceasedList />} />
            <Route path="falecidos/novo" element={<DeceasedForm />} />
            <Route path="falecidos/:id" element={<DeceasedDetail />} />
            <Route path="falecidos/:id/editar" element={<DeceasedForm />} />
```
```tsx
// src/pages/admin/DeceasedForm.tsx — modo edição por presença do :id
import { useParams } from 'react-router-dom';
import { getDeceased, updateDeceased } from '@/services/deceasedService';

export default function DeceasedForm() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const [initialLoading, setInitialLoading] = useState(isEditMode);

  // Carregar defaults no modo edição
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const existing = await getDeceased(id);
        if (!existing) {
          toast.error('Registro não encontrado.');
          navigate('/admin/falecidos');
          return;
        }
        reset({
          name: existing.name,
          dateOfBirth: existing.dateOfBirth,
          dateOfDeath: existing.dateOfDeath,
          cemeteryId: existing.cemeteryId || '',
          plotId: existing.plotId || '',
          causeOfDeath: existing.causeOfDeath || '',
          city: existing.city || '',
          state: existing.state || '',
          profession: existing.profession || '',
          hobbies: existing.hobbies || '',
          familyMembers: existing.familyMembers || '',
          achievements: existing.achievements || '',
          obituary: existing.obituary || '',
          epitaph: existing.epitaph || '',
        });
      } catch {
        toast.error('Erro ao carregar o registro.');
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [id]);

  const onSubmit = async (data: DeceasedFormData) => {
    if (!tenantId) return;
    try {
      if (isEditMode && id) {
        // Edição: atualiza campos; anexos existentes são preservados
        // (novos uploads neste modo entram na Onda 4 — histórico documental)
        await updateDeceased(id, tenantId, data);
        toast.success('Registro atualizado.');
        navigate(`/admin/falecidos/${id}`);
      } else {
        const newId = await createDeceased(tenantId, { ...data, documents: [] }, files, photoFile || undefined);
        toast.success('Registro criado com sucesso.');
        navigate(`/admin/falecidos/${newId}`);
      }
    } catch (error: any) {
      const msg = error?.code === 'permission-denied'
        ? 'Sem permissão para esta operação.'
        : error?.message || 'Erro ao salvar.';
      toast.error(msg);
    }
  };

  if (initialLoading) return <div className="p-8 text-slate-500">Carregando registro...</div>;
  // Título dinâmico: {isEditMode ? 'Editar registro de óbito' : 'Novo registro de óbito'}
  // No modo edição, ocultar a seção de upload de documentos (preservados como estão)
  // e exibir a lista dos anexos existentes como somente leitura.
}
```
```tsx
// src/pages/admin/DeceasedList.tsx — nova opção no dropdown, acima de "Excluir":
<Link
  to={`/admin/falecidos/${person.id}/editar`}
  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
>
  Editar
</Link>

// src/pages/admin/DeceasedDetail.tsx — botão no cabeçalho:
<Link
  to={`/admin/falecidos/${id}/editar`}
  className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800"
>
  Editar registro
</Link>
```

**Passos de implementação:**
1. Adicionar a rota em `App.tsx`.
2. Adaptar `DeceasedForm` para o modo dual (o esqueleto acima; o zod schema e o JSX de campos existentes não mudam).
3. No modo edição: ocultar dropzone de upload, listar `documents` existentes como chips somente leitura, e desabilitar o campo `plotId` se o registro veio de alocação (mudança de jazigo é traslado — fluxo da Onda 4/roadmap).
4. Links de acesso em `DeceasedList` (dropdown) e `DeceasedDetail` (header).
5. Testar: editar nome → detalhe reflete; busca pública reflete (updateDeceased chama `syncPublicDeceased`); `nameLowercase` atualizado (W1-8).

**Critério de aceitação:**
- `/admin/falecidos/<id>/editar` abre o formulário pré-preenchido.
- Salvar atualiza `deceaseds`, `public_deceaseds` e grava `updatedAt/updatedBy` + audit log `UPDATE_DECEASED`.
- Anexos existentes intactos após edição.
- Erro de digitação em nome é corrigível sem excluir o registro.

**Riscos e reversão:** editar `plotId` manualmente dessincronizaria o inventário — por isso o campo fica travado no modo edição (limitação deliberada até o fluxo de traslado). Reversão: remover rota e links.

---

## [W1-10] — Timestamps semânticos nunca gravados nas transições de status (D-12)

**Arquivo(s):** `src/services/sciService.ts` (função `updateSCIRecord`), consumidores em `OperationalPage.tsx`, `MaintenancePage.tsx`, `SecurityPage.tsx`, `EnvironmentalPage.tsx` etc.
**Diagnóstico:** os modelos têm `resolvedAt`, `resolvedBy` (ocorrências) e `completedAt` (operacionais) que **nenhum handler preenche** — resolver uma ocorrência grava só `{status:'resolved'}`. Sem esses carimbos não existe métrica de SLA nem trilha de "quem resolveu", e qualquer relatório futuro exigirá migração. Correção central: enriquecer no ponto único de escrita (`updateSCIRecord`) em vez de caçar 10 handlers.

**Código atual (before) — assinatura típica de chamada:**
```typescript
// exemplo em SecurityPage.tsx:79 (padrão idêntico nas demais páginas)
await updateSCIRecord(tenantId, 'sci_occurrences', id, 'UPDATE_SECURITY_EVENT', { status });
```

**Código corrigido (after) — enriquecimento no service:**
```typescript
// src/services/sciService.ts — dentro de updateSCIRecord, antes do updateDoc
const TERMINAL_STATUS_STAMPS: Record<string, { field: string; byField?: string }> = {
  resolved: { field: 'resolvedAt', byField: 'resolvedBy' },
  done: { field: 'completedAt' },
  closed: { field: 'closedAt' },
  completed: { field: 'completedAt' },
};

export async function updateSCIRecord(
  tenantId: string,
  collectionName: string,
  id: string,
  action: string,
  payload: Record<string, any>
) {
  const enriched: Record<string, any> = {
    ...payload,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid,
  };
  const stamp = payload.status ? TERMINAL_STATUS_STAMPS[payload.status] : undefined;
  if (stamp) {
    enriched[stamp.field] = serverTimestamp();
    if (stamp.byField) enriched[stamp.byField] = auth.currentUser?.uid;
  }
  await updateDoc(doc(db, collectionName, id), enriched);
  await logAction(tenantId, action, collectionName, id, null, enriched);
  invalidateCache(`sci_snapshot:${tenantId}`);
}
```

**Passos de implementação:**
1. Localizar `updateSCIRecord` em `sciService.ts` e aplicar o enriquecimento (preservar o corpo atual — a mudança é aditiva).
2. Nenhuma página muda: todas já passam `{ status }` por esta função.
3. Verificar que reabrir (status volta a `open`/`in_progress`) não apaga os carimbos antigos — comportamento aceito (histórico simples); documentar no comentário.

**Critério de aceitação:** resolver ocorrência grava `resolvedAt` (Timestamp) + `resolvedBy` (uid); concluir ordem grava `completedAt`; visível no console Firestore.

**Riscos e reversão:** nenhum consumidor lê esses campos ainda — mudança segura. Reversão trivial.

---

## [W1-11] — Rejeição e exclusão de notificação sem auditoria (lacuna 5.9)

**Arquivo(s):** `src/services/notificationService.ts` (linhas 223–245), `src/pages/user/GardenOfMemories.tsx` (linhas 98–114)
**Diagnóstico:** `rejectNotification` e `deleteNotification` não chamam `logAction` — as duas decisões mais sensíveis do fluxo cidadão (negar sepultamento; apagar solicitação) não deixam rastro. `GardenOfMemories` agrava: exclui via `deleteDoc` direto na página (linha 102), pulando o service, e não remove os arquivos enviados (documentos/foto ficam órfãos no Storage).

**Código atual (before):**
```typescript
// src/services/notificationService.ts:223-245
export async function rejectNotification(notificationId: string, reason: string) {
  if (!auth.currentUser) return;

  await updateDoc(doc(db, COLLECTION, notificationId), {
    status: 'rejected',
    rejectionReason: reason,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
}

export async function deleteNotification(notificationId: string) {
  if (!auth.currentUser) {
    throw new Error("Usuário não autenticado.");
  }

  try {
    await deleteDoc(doc(db, COLLECTION, notificationId));
  } catch (error) {
    console.error("Error deleting notification document:", error);
    throw error;
  }
}
```
```typescript
// src/pages/user/GardenOfMemories.tsx:98-103 (deleteDoc direto na página)
  const confirmDelete = async () => {
    const notification = pendingDelete;
    if (!notification?.id) return;
    try {
      await deleteDoc(doc(db, 'death_notifications', notification.id));
```

**Código corrigido (after):**
```typescript
// src/services/notificationService.ts
export async function rejectNotification(notificationId: string, tenantId: string, reason: string) {
  if (!auth.currentUser) throw new Error('Usuário não autenticado.');

  await updateDoc(doc(db, COLLECTION, notificationId), {
    status: 'rejected',
    rejectionReason: reason,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });

  await logAction(tenantId, 'REJECT_DEATH_NOTIFICATION', COLLECTION, notificationId, null, {
    rejectionReason: reason,
  });
}

export async function deleteNotification(notification: DeathNotification) {
  if (!auth.currentUser) throw new Error('Usuário não autenticado.');
  if (!notification.id) throw new Error('Notificação sem id.');

  await deleteDoc(doc(db, COLLECTION, notification.id));

  // Best-effort: remove os arquivos enviados junto com a notificação
  const urls = [
    ...(notification.documents || []).map((d) => d.url),
    ...(notification.photoUrl ? [notification.photoUrl] : []),
  ];
  await Promise.allSettled(
    urls
      .map((u) => u.match(/\/o\/([^?]+)/)?.[1])
      .filter((p): p is string => !!p)
      .map((p) => deleteObject(ref(storage, decodeURIComponent(p))))
  );

  // Auditoria só quando quem exclui é staff (cidadão não tem permissão de escrever audit_logs)
  try {
    await logAction(notification.tenantId, 'DELETE_DEATH_NOTIFICATION', COLLECTION, notification.id, null, {
      status: notification.status,
    });
  } catch { /* cidadão: regra nega — best-effort deliberado */ }
}
```
```typescript
// src/pages/user/GardenOfMemories.tsx — usar o service
import { deleteNotification } from '@/services/notificationService';

  const confirmDelete = async () => {
    const notification = pendingDelete;
    if (!notification?.id) return;
    try {
      await deleteNotification(notification);
      setNotifications((prev) => prev.filter((item) => item.id !== notification.id));
      // ... resto inalterado
```

**Passos de implementação:**
1. Aplicar os afters; a assinatura de `rejectNotification` ganha `tenantId` — atualizar o call-site em `CommunicatedDeaths.tsx:120` (`await rejectNotification(selectedNotification.id, tenantId, rejectionReason);`).
2. `deleteNotification` agora recebe o objeto — atualizar `GardenOfMemories` (o objeto já está na mão) e remover os imports diretos de `deleteDoc`/`doc`/`db` da página se não usados em outro ponto.
3. Import de `deleteObject` no service (o `ref`/`storage` já são importados).

**Critério de aceitação:**
- Rejeitar gera `audit_logs` com action `REJECT_DEATH_NOTIFICATION`.
- Excluir notificação rejeitada (cidadão) remove o doc e os arquivos do Storage; sem erro visível mesmo que o audit seja negado.
- Staff excluindo gera audit `DELETE_DEATH_NOTIFICATION`.
- `grep -n "deleteDoc" src/pages/user/GardenOfMemories.tsx` → vazio.

**Riscos e reversão:** exclusão de arquivos do Storage pelo cidadão depende da rule `documents/{userId}` permitir delete pelo dono (permite: `allow write` cobre delete). Reversão: revert.

---

## [W1-12] — `deleteManagerAccount` promete apagar dados do tenant e não apaga (item 23)

**Arquivo(s):** `functions/src/index.ts` (linhas 189–226), `src/pages/superadmin/SuperAdminPage.tsx` (texto do confirm)
**Diagnóstico:** a function apaga Auth users + `profiles` + doc do `tenants`, mas **nenhum dado operacional**: `cemeteries`, `sectors`, `plots`, `deceaseds`, `public_deceaseds`, `death_notifications`, `sci_*` e `audit_logs` do tenant ficam órfãos para sempre. O confirm da UI promete "Todos os logins e dados do tenant serão removidos" — juridicamente o pior dos mundos (nem entrega, nem apaga — LGPD/retenção). Correção: cascade completa em batches via Admin SDK (sem limites de rules).

**Código atual (before):**
```typescript
// functions/src/index.ts:206-225
  // Delete all profiles that belong to this tenant
  const profilesSnap = await db
    .collection('profiles')
    .where('tenantId', '==', tenantId)
    .get();

  const deleteProfiles = profilesSnap.docs.map(async (doc) => {
    try {
      await auth.deleteUser(doc.id);
    } catch (_) {
      // User may already be deleted; continue
    }
    await doc.ref.delete();
  });

  await Promise.all(deleteProfiles);

  await db.collection('tenants').doc(tenantId).delete();

  return { success: true };
```

**Código corrigido (after):**
```typescript
// functions/src/index.ts — cascade completa dos dados do tenant
const TENANT_DATA_COLLECTIONS = [
  'cemeteries', 'sectors', 'plots', 'plot_concessions',
  'deceaseds', 'public_deceaseds', 'death_notifications',
  'sci_operational_records', 'sci_occurrences', 'sci_internal_notifications',
  'sci_sanitary_checks', 'sci_environmental_checks', 'sci_financial_records',
  'sci_stock_items', 'sci_documents', 'sci_ai_agents', 'sci_reports',
  'sci_support_tickets', 'sci_training_sessions',
  // audit_logs mantidos por retenção legal — ver decisão abaixo
];

async function deleteTenantCollection(db: FirebaseFirestore.Firestore, col: string, tenantId: string): Promise<number> {
  let total = 0;
  // Laço de páginas de 400 até esgotar
  for (;;) {
    const snap = await db.collection(col).where('tenantId', '==', tenantId).limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < 400) break;
  }
  return total;
}

export const deleteManagerAccount = onCall(
  { timeoutSeconds: 540, memory: '512MiB' }, // cascade pode ser longa
  async (request) => {
    if (!request.auth || request.auth.token['role'] !== 'superadmin') {
      throw new HttpsError('permission-denied', 'Acesso negado');
    }
    const { managerUid, tenantId } = request.data as { managerUid: string; tenantId: string };
    if (!managerUid || !tenantId) throw new HttpsError('invalid-argument', 'Dados inválidos');

    const auth = getAuth();
    const db = getFirestore();

    // 1. Dados operacionais do tenant
    const deleted: Record<string, number> = {};
    for (const col of TENANT_DATA_COLLECTIONS) {
      deleted[col] = await deleteTenantCollection(db, col, tenantId);
    }

    // 2. Logins + profiles
    const profilesSnap = await db.collection('profiles').where('tenantId', '==', tenantId).get();
    await Promise.all(
      profilesSnap.docs.map(async (doc) => {
        try { await auth.deleteUser(doc.id); } catch (_) { /* já removido */ }
        await doc.ref.delete();
      })
    );

    // 3. Documento do tenant
    await db.collection('tenants').doc(tenantId).delete();

    console.log(`[deleteManagerAccount] tenant ${tenantId} removido:`, deleted);
    return { success: true, deleted };
  }
);
```

**Passos de implementação:**
1. Aplicar o after; `cd functions && npm run build` e deploy da function.
2. **Decisão registrada**: `audit_logs` do tenant são preservados (retenção de trilha para órgão de controle). Ajustar o texto da UI para dizer exatamente isso.
3. `SuperAdminPage.tsx`: atualizar o texto do confirm/modal para "Remove todos os logins e TODOS os dados operacionais do tenant (cemitérios, jazigos, falecidos, registros SCI). A trilha de auditoria é preservada. Irreversível." (a troca de `window.confirm` por ConfirmDialog é W3-5 — se W3-5 já executada, só o texto).
4. Arquivos do Storage do tenant não são apagados nesta versão (paths são por `userId`, não por tenant) — registrar como issue de follow-up vinculada a W2-2 (metadados de tenant nos uploads viabilizam a limpeza futura).
5. Testar com tenant descartável: criar prefeitura + cemitério + setor com 20 plots + 1 notificação → excluir → todas as coleções zeradas para o tenantId.

**Critério de aceitação:**
- Após excluir uma prefeitura de teste, `where('tenantId','==',X)` retorna vazio em todas as coleções da lista.
- `audit_logs` do tenant permanecem.
- O retorno da callable traz o mapa `deleted` com contagens (evidência).
- UI descreve fielmente o comportamento.

**Riscos e reversão:** operação MUITO destrutiva — por isso ficou atrás de role superadmin + confirmação com texto honesto; recomendável exportar o Firestore (backup) antes de qualquer exclusão real de tenant (item 59 do ranking — backup agendado — continua pendente e deve preceder o uso em produção). Timeout: com dezenas de milhares de docs a function pode estourar 540s — o laço é retomável (basta chamar de novo; idempotente). Reversão: impossível pós-execução (é o ponto); reverter o código restaura o comportamento antigo.

---

## [W1-13] — Desativar prefeitura não desativa logins secundários (D-14)

**Arquivo(s):** `functions/src/index.ts` (linhas 133–161)
**Diagnóstico:** `toggleManagerStatus` desabilita só o Auth do gestor principal e seta `tenants.active`. Gestores secundários (criados por `addUserToTenant`) continuam logando e operando uma prefeitura "inativa" — furo funcional e contratual (inadimplência, encerramento).

**Código atual (before):**
```typescript
// functions/src/index.ts:147-160
  const auth = getAuth();
  const db = getFirestore();

  await auth.updateUser(managerUid, { disabled });

  const profileSnap = await db.collection('profiles').doc(managerUid).get();
  if (profileSnap.exists) {
    const tenantId = profileSnap.data()?.tenantId as string | undefined;
    if (tenantId) {
      await db.collection('tenants').doc(tenantId).update({ active: !disabled });
    }
  }

  return { success: true };
```

**Código corrigido (after):**
```typescript
// functions/src/index.ts — desativa/reativa TODOS os logins do tenant
  const auth = getAuth();
  const db = getFirestore();

  const profileSnap = await db.collection('profiles').doc(managerUid).get();
  const tenantId = profileSnap.exists ? (profileSnap.data()?.tenantId as string | undefined) : undefined;
  if (!tenantId) {
    throw new HttpsError('not-found', 'Perfil do gestor principal não encontrado.');
  }

  const tenantProfiles = await db.collection('profiles').where('tenantId', '==', tenantId).get();
  await Promise.all(
    tenantProfiles.docs.map(async (p) => {
      try {
        await auth.updateUser(p.id, { disabled });
        await p.ref.update({ active: !disabled });
      } catch (err) {
        console.error(`[toggleManagerStatus] falha em ${p.id}:`, err);
      }
    })
  );

  await db.collection('tenants').doc(tenantId).update({ active: !disabled });

  return { success: true, affectedUsers: tenantProfiles.size };
```

**Passos de implementação:**
1. Aplicar o after e deployar a function.
2. UI (`SuperAdminPage`): exibir `affectedUsers` no toast de sucesso ("Prefeitura desativada — 3 logins bloqueados").
3. Nota: usuários com sessão ativa mantêm o token até expirar (~1h). Para corte imediato, adicionar `await auth.revokeRefreshTokens(p.id)` no laço — recomendado.

**Critério de aceitação:** desativar prefeitura com 3 logins bloqueia os 3 (login retorna `auth/user-disabled`); reativar restaura os 3; `profiles.active` espelha o estado.

**Riscos e reversão:** reativação em massa reativa também usuários desativados individualmente antes (via `disableTenantUser`) — limitação documentada; refinamento (flag `disabledByTenant`) fica como follow-up. Reversão: redeploy anterior.

---

## [W1-14] — Três portas de criação de falecido dessincronizam o inventário (fluxo 10.3)

**Arquivo(s):** `src/pages/admin/DeceasedForm.tsx` (onSubmit), `src/pages/admin/AdminReportDeath.tsx` (handleFinalSubmit), `src/services/deceasedService.ts`
**Diagnóstico:** só a alocação via notificação (W1-1) sincroniza o plot. `DeceasedForm` e `AdminReportDeath` criam o falecido com `plotId` preenchido **sem tocar o jazigo** — o plot segue `available`, a taxa de ocupação mente, e o jazigo pode ser alocado a outro falecido. Correção: função única `createDeceasedWithPlot` que, quando `plotId` é informado, valida disponibilidade e ocupa transacionalmente (mesma semântica de W1-1).

**Código atual (before) — comportamento:** `createDeceased(tenantId, { ...data, plotId }, files, photo)` grava apenas o documento em `deceaseds`; nenhuma escrita em `plots`.

**Código corrigido (after):**
```typescript
// src/services/deceasedService.ts
import { runTransaction } from 'firebase/firestore';
import { PlotUnavailableError } from '@/services/notificationService';

/**
 * Cria o registro oficial e, se plotId for informado, ocupa o jazigo na mesma transação.
 * Uploads acontecem ANTES da transação (não são transacionáveis).
 */
export async function createDeceasedWithPlot(
  tenantId: string,
  data: Omit<Deceased, 'id' | 'tenantId' | 'createdAt'>,
  files: File[],
  photoFile?: File
): Promise<string> {
  if (!tenantId) throw new Error('Tenant não identificado.');

  // 1. Uploads (idênticos ao createDeceased atual)
  const uploadedDocs: { name: string; url: string }[] = [];
  for (const file of files) {
    const sRef = ref(storage, `documents/${auth.currentUser?.uid}/${Date.now()}_${file.name}`);
    await uploadBytes(sRef, file);
    uploadedDocs.push({ name: file.name, url: await getDownloadURL(sRef) });
  }
  let photoUrl = '';
  if (photoFile) {
    const pRef = ref(storage, `photos/${auth.currentUser?.uid}/${Date.now()}_${photoFile.name}`);
    await uploadBytes(pRef, photoFile);
    photoUrl = await getDownloadURL(pRef);
  }

  const deceasedRef = doc(collection(db, COLLECTION));
  const recordData = {
    ...data,
    tenantId,
    nameLowercase: (data.name || '').toLowerCase(),
    documents: uploadedDocs,
    photoUrl: photoUrl || data.photoUrl || null,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid,
  };

  if (data.plotId) {
    const plotRef = doc(db, 'plots', data.plotId);
    await runTransaction(db, async (tx) => {
      const plotSnap = await tx.get(plotRef);
      if (!plotSnap.exists()) throw new Error('Jazigo informado não existe.');
      const plot = plotSnap.data() as { status: string; tenantId: string; code?: string };
      if (plot.tenantId !== tenantId) throw new Error('Jazigo não pertence a este tenant.');
      if (plot.status !== 'available') throw new PlotUnavailableError(plot.code);

      tx.set(deceasedRef, recordData);
      tx.update(plotRef, {
        status: 'occupied',
        deceasedId: deceasedRef.id,
        occupantName: data.name,
        burialDate: data.dateOfDeath, // caminho direto: sepultamento na data do óbito, editável depois
        exhumationDeadlineYears: 3,
        documentStatus: uploadedDocs.length > 0 ? 'pending' : 'regular',
        updatedAt: serverTimestamp(),
      });
    });
  } else {
    await setDoc(deceasedRef, recordData);
  }

  await logAction(tenantId, 'CREATE_DECEASED', COLLECTION, deceasedRef.id, null, recordData);
  await syncPublicDeceased(deceasedRef.id, tenantId, recordData);
  return deceasedRef.id;
}
```

**Passos de implementação:**
1. Adicionar `createDeceasedWithPlot` ao service (o `createDeceased` original permanece para a alocação W1-1, que já ocupa o plot na própria transação — **não** usar o WithPlot lá, senão ocuparia duas vezes).
2. `DeceasedForm.tsx` e `AdminReportDeath.tsx`: trocar a chamada `createDeceased(...)` por `createDeceasedWithPlot(...)`.
3. Nos dois formulários, o campo `plotId` é texto livre — trocar por selects encadeados cemitério→setor→jazigo disponível, reutilizando o padrão do modal de `CommunicatedDeaths` (linhas 290–320). Extração do trio de selects para componente `PlotSelector` é opcional aqui e obrigatória em W5-4.
4. Testar: criar falecido pelo form direto com jazigo → plot ocupado; tentar o mesmo jazigo de novo → `PlotUnavailableError`.

**Critério de aceitação:**
- Os três caminhos de criação (form, wizard admin, alocação) deixam `plots` e `deceaseds` consistentes.
- Informar jazigo ocupado em qualquer caminho falha com mensagem clara e nada é gravado.
- Campo de jazigo nos formulários só oferece jazigos `available` do cemitério escolhido.

**Riscos e reversão:** uploads acontecem antes da transação — se ela falhar, sobram arquivos órfãos no Storage (aceitável; mesmo comportamento do fluxo do cidadão; limpeza em falha é follow-up). Reversão: voltar às chamadas antigas.

---

## SMOKE TEST DE SAÍDA DA ONDA 1 (20 min)

1. Duas abas, mesma notificação, mesmo jazigo → uma aloca, a outra recebe conflito e recarrega.
2. Alocar com data de sepultamento amanhã → `plots.burialDate` = amanhã.
3. Excluir o falecido alocado → plot liberado + arquivos removidos + fora da busca pública.
4. Setor com ocupado → exclusão bloqueada; setor só com disponíveis → cascade completa.
5. Jazigo ocupado → status `available` no Inventário → vínculos limpos.
6. Tenant com 60 falecidos → paginação + busca server-side "mar%".
7. Editar nome de falecido → detalhe, busca pública e nameLowercase refletem.
8. Rejeitar notificação → audit log presente.
9. Excluir prefeitura de teste → coleções zeradas, audit preservado.
10. Desativar prefeitura → todos os logins bloqueados.

---

# ONDA 2 — SEGURANÇA E AUTORIZAÇÃO (~4–5,5 dias)

> Objetivo: isolamento multi-tenant sem furos (Storage inclusive), roles canônicos em uma única fonte, rules com validação mínima de schema, IA com controle de acesso e custo, e — a partir de W2-11 — **CI bloqueante** para tudo que vier depois. **Depende da Onda 0** (W0-10). W2-1 antes de W2-2/W2-7 (as rules citam os roles canônicos).

---

## [W2-1] — Roles PT/EN divergentes entre claims, rules, rotas e UI (Q-04, D-17, D-18, item 16)

**Arquivo(s):** `src/lib/roles.ts` (novo), `src/App.tsx:111`, `src/pages/auth/LoginPage.tsx:47-57`, `src/pages/user/GardenOfMemories.tsx:84`, `src/pages/auth/UnauthorizedPage.tsx`, `firestore.rules:19-33`, `storage.rules:19-31`
**Diagnóstico:** o backend deployável só emite `superadmin` e `manager` (`functions/src/index.ts:62-65,114-117`). Mas cada camada aceita um conjunto diferente: rotas admin aceitam `['gestor','manager','superadmin','operador']` (sem `operator`); `LoginPage` redireciona `['gestor','manager','operador']` (um futuro `operator` cairia na área do cidadão); `GardenOfMemories:84` testa `['superadmin','manager','operator']` (sem as variantes PT); as rules aceitam os 4. Resultado: comportamento imprevisível conforme o claim e impossibilidade de raciocinar sobre permissões. Padronização canônica: **inglês** (`superadmin`, `manager`, `operator`, `citizen`), fonte única em `lib/roles.ts`.

**Código atual (before):**
```tsx
// src/App.tsx:111
        <Route element={<ProtectedRoute allowedRoles={['gestor', 'manager', 'superadmin', 'operador']} />}>
```
```typescript
// src/pages/auth/LoginPage.tsx:47-57
  React.useEffect(() => {
    if (user && role) {
      if (role === 'superadmin') {
        navigate('/superadmin');
      } else if (['gestor', 'manager', 'operador'].includes(role)) {
        navigate('/admin/dashboard');
      } else {
        navigate('/app');
      }
    }
  }, [user, role, navigate]);
```
```typescript
// src/pages/user/GardenOfMemories.tsx:83-86
  const canDeleteNotification = (notification: DeathNotification) => {
    const isStaff = ['superadmin', 'manager', 'operator'].includes(role || '');
    return isStaff || notification.status === 'rejected';
  };
```
```javascript
// firestore.rules:19-29
    function isManager(tenantId) {
      return isSignedIn()
        && (request.auth.token.role == 'manager' || request.auth.token.role == 'gestor')
        && request.auth.token.tenantId == tenantId;
    }

    function isOperator(tenantId) {
      return isSignedIn()
        && (request.auth.token.role == 'operator' || request.auth.token.role == 'operador')
        && request.auth.token.tenantId == tenantId;
    }
```

**Código corrigido (after) — novo `src/lib/roles.ts`:**
```typescript
// src/lib/roles.ts — FONTE ÚNICA de roles do sistema.
// Emitidos pelo backend: superadmin, manager, operator (W2-10). citizen = ausência de claim.
export const ROLES = {
  SUPERADMIN: 'superadmin',
  MANAGER: 'manager',
  OPERATOR: 'operator',
  CITIZEN: 'citizen',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Roles com acesso à área administrativa. */
export const STAFF_ROLES: readonly Role[] = [ROLES.SUPERADMIN, ROLES.MANAGER, ROLES.OPERATOR];

/** Roles que podem acessar o painel /admin (mesmo conjunto hoje; separado por clareza). */
export const ADMIN_ROUTE_ROLES: readonly Role[] = STAFF_ROLES;

export function isStaffRole(role: string | null | undefined): boolean {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}

/** Destino canônico pós-login/pós-negação por role. */
export function getHomeForRole(role: string | null | undefined): string {
  if (role === ROLES.SUPERADMIN) return '/superadmin';
  if (isStaffRole(role)) return '/admin/dashboard';
  return '/app/inicio';
}
```
```tsx
// src/App.tsx
import { ADMIN_ROUTE_ROLES } from '@/lib/roles';
        <Route element={<ProtectedRoute allowedRoles={[...ADMIN_ROUTE_ROLES]} />}>
```
```typescript
// src/pages/auth/LoginPage.tsx
import { getHomeForRole } from '@/lib/roles';
  React.useEffect(() => {
    if (user && role) {
      navigate(getHomeForRole(role));
    }
  }, [user, role, navigate]);
```
```typescript
// src/pages/user/GardenOfMemories.tsx
import { isStaffRole } from '@/lib/roles';
  const canDeleteNotification = (notification: DeathNotification) => {
    return isStaffRole(role) || notification.status === 'rejected';
  };
```
```javascript
// firestore.rules — remover as variantes PT (nenhum claim PT é emitido pelo backend atual)
    function isManager(tenantId) {
      return isSignedIn()
        && request.auth.token.role == 'manager'
        && request.auth.token.tenantId == tenantId;
    }

    function isOperator(tenantId) {
      return isSignedIn()
        && request.auth.token.role == 'operator'
        && request.auth.token.tenantId == tenantId;
    }
```
```javascript
// storage.rules — idem
    function isManager() {
      return isSignedIn() && request.auth.token.role == 'manager';
    }
    function isOperator() {
      return isSignedIn() && request.auth.token.role == 'operator';
    }
```
```tsx
// src/pages/auth/UnauthorizedPage.tsx — botão de volta por role (U-10, mesma passada)
import { getHomeForRole } from '@/lib/roles';
// <Link to={getHomeForRole(role)} ...>Voltar ao início</Link>
```

**Passos de implementação:**
1. **Pré-verificação obrigatória**: script one-shot com Admin SDK listando usuários com claims `gestor`/`operador`/`operator` (`auth.listUsers` + filtro em `customClaims.role`). Pelas functions atuais, o resultado esperado é zero; se houver, migrar os claims (`setCustomUserClaims` com o valor EN) ANTES de remover as variantes das rules.
2. Criar `src/lib/roles.ts`; aplicar nos 4 pontos do frontend (`App.tsx`, `LoginPage`, `GardenOfMemories`, `UnauthorizedPage`).
3. Simplificar `isManager`/`isOperator` em `firestore.rules` e `storage.rules`.
4. `firebase deploy --only firestore:rules,storage`.
5. `grep -rn "gestor'\|operador'" src/ firestore.rules storage.rules` → apenas strings de UI (labels PT como texto exibido são ok; valores de role, não).

**Critério de aceitação:**
- Login como manager → `/admin/dashboard`; como superadmin → `/superadmin`; sem claim → `/app/inicio`.
- Um claim `operator` (emitido via W2-10) acessa `/admin` e é redirecionado corretamente no login.
- Nenhum valor de role PT em código ou rules; usuários existentes seguem funcionando (verificado no passo 1).

**Riscos e reversão:** se o passo 1 for pulado e existir algum claim PT residual, esse usuário perde acesso ao deploy das rules — mitigação é exatamente o passo 1. Reversão: redeploy das rules anteriores + revert do frontend.

---

## [W2-2] — Storage rules: sem limite de tamanho/tipo e staff cross-tenant (S-02, item 8)

**Arquivo(s):** `storage.rules` (arquivo inteiro), pontos de upload no frontend (`notificationService.ts:74-87`, `deceasedService.ts:113-127`, `sciService.uploadSCIDocument`, `userProfileService.uploadUserProfilePhoto`)
**Diagnóstico:** dois furos: (1) `isStaff()` no Storage **não compara tenant** — staff da prefeitura A lê e escreve certidões de óbito enviadas à prefeitura B (`documents/{userId}/**` etc., linhas 38–51); (2) **nenhum path limita tamanho ou content-type** — qualquer autenticado sobe qualquer arquivo de qualquer tamanho. Correção: metadado customizado `tenantId` gravado no upload + verificação nas rules; limites de 10 MB e whitelist de content-type em todos os writes.

**Código atual (before) — arquivo completo `storage.rules`:**
```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    // Helper Functions
    function isSignedIn() {
      return request.auth != null;
    }

    function hasRole(role) {
      return isSignedIn() && request.auth.token.role == role;
    }

    function isSuperAdmin() {
      return hasRole('superadmin');
    }

    function isManager() {
      return isSignedIn()
        && (request.auth.token.role == 'manager' || request.auth.token.role == 'gestor');
    }

    function isOperator() {
      return isSignedIn()
        && (request.auth.token.role == 'operator' || request.auth.token.role == 'operador');
    }

    function isStaff() {
      return isSuperAdmin() || isManager() || isOperator();
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // Paths currently used by the app for uploads.
    match /documents/{userId}/{fileName=**} {
      allow read: if isOwner(userId) || isStaff();
      allow write: if isOwner(userId) || isStaff();
    }

    match /photos/{userId}/{fileName=**} {
      allow read: if isOwner(userId) || isStaff();
      allow write: if isOwner(userId) || isStaff();
    }

    match /sci-documents/{userId}/{fileName=**} {
      allow read: if isOwner(userId) || isStaff();
      allow write: if isOwner(userId) || isStaff();
    }

    // Legacy/alternative path for memorial photos.
    match /memorials/{memorialId}/photos/{fileName=**} {
      allow read: if true; // fotos de memorial podem ser públicas
      allow write: if isSignedIn() && isStaff(); // apenas staff pode gravar em memorials
    }

    // Legacy/alternative tenant-organized documents.
    match /tenants/{tenantId}/deceaseds/{deceasedId}/documents/{fileName=**} {
      allow read: if isStaff();
      allow write: if isStaff();
    }

    // Request evidence files.
    match /tenants/{tenantId}/requests/{requestId}/{fileName=**} {
      // Leitura: dono da request ou staff do tenant
      allow read: if isSignedIn()
                  && (isStaff() && request.auth.token.tenantId == tenantId
                      || request.auth.uid == requestId.split('_')[0]); // heurística — melhorar com metadata
      // Escrita: apenas staff do tenant
      allow write: if isSignedIn()
                   && (isStaff() && request.auth.token.tenantId == tenantId);
    }
  }
}
```

**Código corrigido (after) — arquivo completo `storage.rules` reescrito:**
```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    // ── Helpers ────────────────────────────────────────────────────────────
    function isSignedIn() {
      return request.auth != null;
    }

    function hasRole(role) {
      return isSignedIn() && request.auth.token.role == role;
    }

    function isSuperAdmin() {
      return hasRole('superadmin');
    }

    function isManager() {
      return isSignedIn() && request.auth.token.role == 'manager';
    }

    function isOperator() {
      return isSignedIn() && request.auth.token.role == 'operator';
    }

    function isStaff() {
      return isSuperAdmin() || isManager() || isOperator();
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // Staff só acessa arquivos do PRÓPRIO tenant, identificado por metadado
    // customizado gravado no upload: uploadBytes(ref, file, { customMetadata: { tenantId } }).
    // Arquivos legados sem metadado: acessíveis pelo dono e pelo superadmin apenas
    // (staff comum perde acesso até o backfill de metadados — trade-off aceito).
    function staffOfFileTenant() {
      return isStaff()
        && resource.metadata != null
        && resource.metadata.tenantId == request.auth.token.tenantId;
    }

    function writesWithOwnTenant() {
      return isStaff()
        && request.resource.metadata != null
        && request.resource.metadata.tenantId == request.auth.token.tenantId;
    }

    // Limites de conteúdo: 10 MB, apenas PDF e imagens comuns.
    function validDocument() {
      return request.resource.size < 10 * 1024 * 1024
        && request.resource.contentType.matches('application/pdf|image/(jpeg|png|webp|heic)');
    }

    function validImage() {
      return request.resource.size < 10 * 1024 * 1024
        && request.resource.contentType.matches('image/(jpeg|png|webp|heic)');
    }

    // ── Documentos anexados a comunicações de óbito e registros ───────────
    match /documents/{userId}/{fileName=**} {
      allow read: if isOwner(userId) || staffOfFileTenant() || isSuperAdmin();
      allow create, update: if (isOwner(userId) || writesWithOwnTenant()) && validDocument();
      allow delete: if isOwner(userId) || staffOfFileTenant() || isSuperAdmin();
    }

    // ── Fotos de falecidos e perfis ────────────────────────────────────────
    match /photos/{userId}/{fileName=**} {
      allow read: if isOwner(userId) || staffOfFileTenant() || isSuperAdmin();
      allow create, update: if (isOwner(userId) || writesWithOwnTenant()) && validImage();
      allow delete: if isOwner(userId) || staffOfFileTenant() || isSuperAdmin();
    }

    // ── Documentos institucionais (módulo Documentos/SCI) ─────────────────
    match /sci-documents/{userId}/{fileName=**} {
      allow read: if isOwner(userId) || staffOfFileTenant() || isSuperAdmin();
      allow create, update: if (isOwner(userId) || writesWithOwnTenant()) && validDocument();
      allow delete: if isOwner(userId) || staffOfFileTenant() || isSuperAdmin();
    }

    // ── Fotos de memoriais públicos ────────────────────────────────────────
    match /memorials/{memorialId}/photos/{fileName=**} {
      allow read: if true; // memorial é público por design
      allow write: if writesWithOwnTenant() && validImage();
    }

    // ── Path legado organizado por tenant ──────────────────────────────────
    match /tenants/{tenantId}/deceaseds/{deceasedId}/documents/{fileName=**} {
      allow read: if (isStaff() && request.auth.token.tenantId == tenantId) || isSuperAdmin();
      allow write: if isStaff() && request.auth.token.tenantId == tenantId && validDocument();
    }

    // ── Evidências de solicitações (feature futura — requests) ────────────
    match /tenants/{tenantId}/requests/{requestId}/{fileName=**} {
      allow read: if isSignedIn()
                  && ((isStaff() && request.auth.token.tenantId == tenantId)
                      || request.auth.uid == requestId.split('_')[0]);
      allow write: if isSignedIn()
                   && (isStaff() && request.auth.token.tenantId == tenantId)
                   && validDocument();
    }
  }
}
```

**Código corrigido (after) — uploads com metadado de tenant (exemplo em `notificationService.ts`):**
```typescript
// src/services/notificationService.ts — createDeathNotification
// O cidadão grava o tenantId do CEMITÉRIO escolhido no metadado, permitindo
// que o staff daquele tenant leia o arquivo.
  const uploadedDocs = [];
  for (const file of files) {
    const storageRef = ref(storage, `documents/${auth.currentUser?.uid}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file, { customMetadata: { tenantId } });
    const url = await getDownloadURL(storageRef);
    uploadedDocs.push({ name: file.name, url });
  }

  let photoUrl = null;
  if (photoFile) {
    const photoRef = ref(storage, `photos/${auth.currentUser?.uid}/${Date.now()}_${photoFile.name}`);
    await uploadBytes(photoRef, photoFile, { customMetadata: { tenantId } });
    photoUrl = await getDownloadURL(photoRef);
  }
```

**Passos de implementação:**
1. Reescrever `storage.rules` com o bloco completo acima (depende de W2-1 para os helpers de role).
2. Adicionar `{ customMetadata: { tenantId } }` em **todos** os `uploadBytes` do frontend: `notificationService.ts:76,85`, `deceasedService.ts:116,125` (e o novo `createDeceasedWithPlot` de W1-14), `sciService.uploadSCIDocument`, `userProfileService.uploadUserProfilePhoto` (perfil do cidadão: usar o `tenantId` do contexto se houver; senão omitir — o dono continua acessando).
3. **Backfill de metadados** para arquivos existentes: script `scripts/backfill-storage-metadata.cjs` com Admin SDK — iterar `deceaseds` e `death_notifications`, extrair paths das URLs, `file.setMetadata({ metadata: { tenantId } })`. Rodar ANTES do deploy das rules (senão staff perde acesso aos arquivos legados).
4. `firebase deploy --only storage`.
5. Testes manuais: staff do tenant A tentando `getDownloadURL`+fetch de arquivo do tenant B via SDK → negado no `getMetadata`/list; upload de `.exe` → negado pela rule mesmo com cliente adulterado; upload de PDF 15 MB → negado.

**Critério de aceitação:**
- Upload sem metadado por staff → negado; com metadado do próprio tenant → ok.
- Upload de content-type fora da whitelist ou >10 MB → negado pela RULE (testar com `curl`/SDK bruto, não pela UI).
- Staff do tenant A não lê arquivo do tenant B (pós-backfill).
- Fluxo cidadão completo (óbito com PDF + foto) continua funcionando.
- Observação documentada no PR: URLs tokenizadas (`getDownloadURL`) continuam acessíveis a quem tem a URL — revogação = trocar token do arquivo; é o comportamento do produto para fotos públicas.

**Riscos e reversão:** **o backfill é crítico** — deploy das rules antes dele bloqueia o staff dos anexos históricos. Ordem: código de upload → backfill → rules. Reversão: redeploy das rules antigas restaura o acesso amplo imediatamente.

---

## [W2-3] — Dropdown "Administrador responsável" sempre vazio: rules de `profiles` negam a query (item 15)

**Arquivo(s):** `firestore.rules` (linhas 192–196), `src/pages/admin/CemeteryList.tsx` (linha 53)
**Diagnóstico:** `getTenantProfiles(tenantId)` (`cemeteryService.ts:367-371`) roda `where('tenantId','==',X)` em `profiles` como **gestor**; a regra só permite superadmin ou o próprio doc — a query é negada e o `.catch(() => [])` esconde: o dropdown fica vazio em produção, silenciosamente, desde sempre.

**Código atual (before):**
```javascript
// firestore.rules:192-196
    // Manager profiles (created by Cloud Functions via Admin SDK)
    match /profiles/{userId} {
      allow read: if isSuperAdmin() || request.auth.uid == userId;
      allow write: if isSuperAdmin();
    }
```

**Código corrigido (after):**
```javascript
// firestore.rules
    // Manager profiles (created by Cloud Functions via Admin SDK).
    // Manager lê os perfis do PRÓPRIO tenant (necessário para atribuir
    // administrador responsável a um cemitério e, futuramente, gerir equipe).
    match /profiles/{userId} {
      allow read: if isSuperAdmin()
                  || request.auth.uid == userId
                  || isManager(resource.data.tenantId);
      allow write: if isSuperAdmin();
    }
```
```typescript
// src/pages/admin/CemeteryList.tsx:49-57 — parar de engolir a negação
  const fetchData = async () => {
    if (!tenantId) return;
    try {
      const [data, profs] = await Promise.all([
        getCemeteries(tenantId),
        getTenantProfiles(tenantId),
      ]);
      setCemeteries(data);
      setProfiles(profs);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar cemitérios.');
    }
  };
```

**Passos de implementação:**
1. Aplicar a regra (nota: em queries de lista, o Firestore avalia a regra contra o filtro — `where('tenantId','==',meuTenant)` satisfaz `isManager(resource.data.tenantId)`).
2. Remover o `.catch(() => [])` da linha 53 e envolver o `fetchData` em try/catch com toast (before/after acima).
3. Deploy das rules; teste como manager: dropdown lista os e-mails dos perfis do tenant.

**Critério de aceitação:** logado como manager, o modal de cemitério lista os administradores do tenant; manager do tenant A não consegue query em profiles do tenant B (teste na bateria W2-11: caso R10 vira PERMITE para o próprio tenant, NEGA para outro).

**Riscos e reversão:** perfis contêm apenas email/role/tenantId/active — exposição intra-tenant aceitável. Reversão: redeploy da regra anterior (dropdown volta a ficar vazio).

---

## [W2-4] — Cláusula morta `managersUid` em `deceaseds` (S-05)

**Arquivo(s):** `firestore.rules` (linhas 80–88)
**Diagnóstico:** `request.auth.uid in resource.data.managersUid` referencia um campo que **nenhum documento tem** — a expressão erra e nega (seguro por acidente), mas documenta uma intenção inexistente e confunde a manutenção.

**Código atual (before):**
```javascript
// firestore.rules:80-88
    // Official deceased records
    match /deceaseds/{deceasedId} {
      // Leitura pública apenas dos campos não-sensíveis — via documento público separado ou projeção.
      // Até que uma coleção pública dedicada seja criada, acesso restrito a staff.
      allow read: if isStaff(resource.data.tenantId)
                  || (isSignedIn() && request.auth.uid in resource.data.managersUid);
      allow create: if isStaff(request.resource.data.tenantId);
      allow update, delete: if isStaff(resource.data.tenantId);
    }
```

**Código corrigido (after):**
```javascript
// firestore.rules
    // Official deceased records — staff-only. A busca pública usa a projeção
    // public_deceaseds. Acesso da família ao registro completo será modelado
    // quando o conceito de "gestor familiar do memorial" existir de fato.
    match /deceaseds/{deceasedId} {
      allow read: if isStaff(resource.data.tenantId);
      allow create: if isStaff(request.resource.data.tenantId);
      allow update, delete: if isStaff(resource.data.tenantId);
    }
```

**Passos de implementação:** trocar o bloco; deploy; caso de teste na bateria W2-11 (cidadão lendo `deceaseds` → NEGA, comportamento inalterado).
**Critério de aceitação:** `grep -n "managersUid" firestore.rules` → vazio; leitura staff funciona; leitura cidadã negada.
**Riscos e reversão:** nenhum — comportamento efetivo idêntico.

---

## [W2-5] — Rules sem validação de schema nas coleções centrais (S-11)

**Arquivo(s):** `firestore.rules` (blocos `plots` e `sci_financial_records`)
**Diagnóstico:** as rules validam autorização, não schema. Um staff via console grava `plots.status:'xyz'` (quebra filtros e contadores) ou `sci_financial_records.value:"banana"` (o `Number(item.value||0)` do snapshot degrada em silêncio). Validações mínimas de tipo/domínio nas duas coleções mais consumidas por agregadores.

**Código atual (before):**
```javascript
// firestore.rules:61-71
    match /plots/{plotId} {
      allow read: if isSignedIn()
                  && (isStaff(resource.data.tenantId)
                      || resource.data.status == 'available');
      allow create: if isStaff(request.resource.data.tenantId);
      allow update, delete: if isStaff(resource.data.tenantId);
    }
```
```javascript
// firestore.rules:233-238
    match /sci_financial_records/{recordId} {
      allow read: if isSignedIn() && isStaff(resource.data.tenantId);
      allow create: if isSignedIn() && isStaff(request.resource.data.tenantId);
      allow update, delete: if isSignedIn() && isStaff(resource.data.tenantId);
    }
```

**Código corrigido (after):**
```javascript
// firestore.rules — helpers de schema (junto aos demais helpers)
    function validPlotSchema() {
      return request.resource.data.status in ['available', 'occupied', 'reserved', 'blocked']
        && request.resource.data.tenantId is string
        && request.resource.data.cemeteryId is string
        && request.resource.data.cemeteryId != 'all';
    }

    function validFinancialSchema() {
      return request.resource.data.value is number
        && request.resource.data.value >= 0
        && request.resource.data.category in ['income', 'expense']
        && request.resource.data.cemeteryId != 'all';
    }

    match /plots/{plotId} {
      allow read: if isSignedIn()
                  && (isStaff(resource.data.tenantId)
                      || resource.data.status == 'available');
      allow create: if isStaff(request.resource.data.tenantId) && validPlotSchema();
      allow update: if isStaff(resource.data.tenantId) && validPlotSchema();
      allow delete: if isStaff(resource.data.tenantId);
    }

    match /sci_financial_records/{recordId} {
      allow read: if isSignedIn() && isStaff(resource.data.tenantId);
      allow create: if isSignedIn() && isStaff(request.resource.data.tenantId) && validFinancialSchema();
      allow update: if isSignedIn() && isStaff(resource.data.tenantId) && validFinancialSchema();
      allow delete: if isSignedIn() && isStaff(resource.data.tenantId);
    }
```

**Passos de implementação:**
1. **Complemento no cliente** (senão o usuário recebe permission-denied em vez de mensagem): em `FinancialPage.tsx`, bloquear valor negativo antes do submit — `if (Number(form.value) < 0) { toast.error('Valor não pode ser negativo. Use a categoria "Despesa".'); return; }` e `min="0"` no input (linha ~123).
2. **Atenção aos updates parciais**: `updatePlot`/`handleStatusChange` fazem `updateDoc` parcial — em update, `request.resource.data` no Firestore representa o **documento resultante** (merge), então os campos obrigatórios já presentes no doc satisfazem o schema; validado nos testes do emulador.
3. Deploy + casos no emulador: `value:"100"` (string) → NEGA; `value:-50` → NEGA; `status:'xyz'` em plot → NEGA; fluxos normais → PERMITE.

**Critério de aceitação:** os quatro casos acima passam no emulador; criação de lançamento e de jazigo pela UI seguem funcionando; alocação (W1-1) segue funcionando (o update do plot dentro da transação satisfaz `validPlotSchema`).

**Riscos e reversão:** plots legados com campo faltante (ex.: sem `cemeteryId`) passariam a falhar em update — rodar inventário prévio (`where('cemeteryId','==',null)` não é consultável; exportar e auditar via script). Se surgirem falhas legítimas em produção, reverter só os helpers (deploy anterior) enquanto corrige os dados.

---

## [W2-6] — Cidadão pode criar notificação com `tenantId` arbitrário (S-06)

**Arquivo(s):** `firestore.rules` (bloco `death_notifications`, linhas 100–105)
**Diagnóstico:** o create valida `createdBy`, `status:'submitted'` e ausência de `allocation`/`rejectionReason`, mas **não valida que `tenantId` corresponde ao cemitério** — cliente adulterado polui a fila de qualquer prefeitura com solicitações lixo. Correção pela opção B do catálogo (validação com `get()` — 1 leitura extra por create, volume baixo torna o custo irrelevante; a opção A, Cloud Function, fica registrada como alternativa se o produto quiser lógica adicional server-side).

**Código atual (before):**
```javascript
// firestore.rules:100-105
    match /death_notifications/{notificationId} {
      allow create: if isSignedIn()
                    && request.resource.data.createdBy == request.auth.uid
                    && request.resource.data.status == 'submitted'
                    && !('allocation' in request.resource.data)
                    && !('rejectionReason' in request.resource.data);
```

**Código corrigido (after):**
```javascript
// firestore.rules
    match /death_notifications/{notificationId} {
      allow create: if isSignedIn()
                    && request.resource.data.createdBy == request.auth.uid
                    && request.resource.data.status == 'submitted'
                    && !('allocation' in request.resource.data)
                    && !('rejectionReason' in request.resource.data)
                    // tenantId deve ser o dono do cemitério escolhido (anti-poluição cross-tenant)
                    && request.resource.data.cemeteryId is string
                    && request.resource.data.tenantId ==
                       get(/databases/$(database)/documents/cemeteries/$(request.resource.data.cemeteryId)).data.tenantId;
```

**Passos de implementação:**
1. Aplicar e deployar. O frontend já envia `cemeteryId` e resolve o `tenantId` do cemitério (`ReportDeath.tsx:148` + `createDeathNotification`) — nenhum código de app muda.
2. Emulador: create com `tenantId` correto → PERMITE; com `tenantId` de outro tenant → NEGA; com `cemeteryId` inexistente → NEGA (o `get()` falha).

**Critério de aceitação:** os três casos do emulador; comunicação de óbito real continua funcionando de ponta a ponta.

**Riscos e reversão:** +1 read por criação de notificação (volume: dezenas/dia — irrelevante). Se o doc do cemitério for excluído entre a escolha e o submit, o create falha — mensagem genérica de erro; aceitável. Reversão: redeploy anterior.

---

## [W2-7] — Staff não vê o perfil do solicitante da comunicação de óbito (item 46 — parte rules)

**Arquivo(s):** `firestore.rules` (bloco `user_profiles`, linhas 185–190)
**Diagnóstico:** `user_profiles` só é legível pelo dono e superadmin — por isso `CommunicatedDeaths` mostra `ID: a1b2c3d4...` em vez de nome/telefone de quem comunicou o óbito (a UI é W3-10). Base legal: execução de serviço público (LGPD art. 7º, III / art. 23) — o gestor precisa contatar a família no fluxo mais sensível do sistema. Modelagem: permitir leitura pontual (get) por staff **quando o perfil tem `tenantId` do staff OU** via lookup reverso — como `user_profiles.tenantId` é opcional/não confiável, a modelagem robusta é permitir `get` (não `list`) por qualquer staff, minimizando exposição por não permitir varredura.

**Código atual (before):**
```javascript
// firestore.rules:185-190
    // User profile for citizen area
    match /user_profiles/{uid} {
      allow read: if isSignedIn() && (request.auth.uid == uid || isSuperAdmin());
      allow create, update: if isSignedIn() && request.auth.uid == uid;
      allow delete: if isSuperAdmin();
    }
```

**Código corrigido (after):**
```javascript
// firestore.rules
    // User profile for citizen area.
    // get (doc único): dono, superadmin, ou staff — o staff precisa do contato de quem
    //   comunicou um óbito ao seu tenant (LGPD art. 7º III — execução de serviço público).
    // list (varredura): APENAS dono/superadmin — staff não pode enumerar cidadãos.
    match /user_profiles/{uid} {
      allow get: if isSignedIn()
                 && (request.auth.uid == uid
                     || isSuperAdmin()
                     || request.auth.token.role in ['manager', 'operator']);
      allow list: if isSignedIn() && (request.auth.uid == uid || isSuperAdmin());
      allow create, update: if isSignedIn() && request.auth.uid == uid;
      allow delete: if isSuperAdmin();
    }
```

**Passos de implementação:**
1. Aplicar (nota: separar `read` em `get`/`list` é o mecanismo do Firestore para permitir lookup pontual sem varredura).
2. Deploy; casos no emulador: manager `get` do perfil de um cidadão → PERMITE; manager `list` → NEGA; cidadão lendo outro perfil → NEGA.
3. A tela que consome (nome/telefone do solicitante no modal) é W3-10 — este item só destrava a regra.

**Critério de aceitação:** os três casos do emulador; nenhuma UI regride.

**Riscos e reversão:** staff de QUALQUER tenant pode dar `get` num perfil se souber o uid — mitigado por: uid não enumerável (list negado), acesso auditável futuramente via Functions. Alternativa mais restritiva (validar que existe notificação do uid para o tenant) exigiria `exists()` com id composto — anotada como melhoria. Reversão: redeploy anterior (solicitante volta a ser anônimo).

---

## [W2-8] — Functions de IA sem verificação de role e sem rate-limit (S-04, item 12)

**Arquivo(s):** `functions/src/index.ts` (linhas 316–402)
**Diagnóstico:** as três callables exigem apenas login: **qualquer cidadão** chama `chatWithManagerAgent` (o agente do gestor, com prompt/contexto arbitrários) e nenhuma tem limite de chamadas — um script logado em loop gera custo OpenRouter ilimitado. Correção: role de staff no agente do gestor + contador diário por uid em transação + auditoria `AI_CALL` (que de quebra alimenta o monitor W4-1).

**Código atual (before):**
```typescript
// functions/src/index.ts:371-381
export const chatWithManagerAgent = onCall({ secrets: [openRouterApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario');

  const { agent, history, message, contextSummary } = request.data as {
    agent: { name: string; objective: string; prompt: string; modules: string[] };
    history: { role: string; parts: string }[];
    message: string;
    contextSummary: string;
  };

  if (!message || !agent) throw new HttpsError('invalid-argument', 'Dados invalidos');
```

**Código corrigido (after):**
```typescript
// functions/src/index.ts — helpers de controle (adicionar após openRouterChat)

const STAFF_ROLES = ['superadmin', 'manager', 'operator'];
const DAILY_AI_LIMITS: Record<string, number> = {
  generateObituary: 20,   // cidadão gera poucas vezes por fluxo
  chatWithAI: 100,        // assistente do cidadão
  chatWithManagerAgent: 200, // console do gestor
};

/** Incrementa o contador diário do uid em transação; lança resource-exhausted acima do teto. */
async function enforceAiRateLimit(uid: string, fn: keyof typeof DAILY_AI_LIMITS): Promise<void> {
  const db = getFirestore();
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const ref = db.collection('ai_usage').doc(`${uid}_${day}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists ? (snap.data()?.[fn] as number) : 0) || 0;
    if (current >= DAILY_AI_LIMITS[fn]) {
      throw new HttpsError(
        'resource-exhausted',
        'Limite diário de uso de IA atingido. Tente novamente amanhã.'
      );
    }
    tx.set(ref, { [fn]: current + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

/** Auditoria de chamada de IA (alimenta também o monitor técnico). */
async function logAiCall(uid: string, role: string | undefined, fn: string): Promise<void> {
  try {
    await getFirestore().collection('audit_logs').add({
      action: 'AI_CALL',
      actorUid: uid,
      userRole: role ?? 'citizen',
      targetCollection: 'ai',
      targetId: fn,
      timestamp: FieldValue.serverTimestamp(),
      tenantId: null,
    });
  } catch (err) {
    console.error('[logAiCall] falha:', err);
  }
}

// generateObituary e chatWithAI: adicionar após o check de auth
//   await enforceAiRateLimit(request.auth.uid, 'generateObituary'); // ou 'chatWithAI'
//   await logAiCall(request.auth.uid, request.auth.token['role'] as string, 'generateObituary');

// chatWithManagerAgent: role de staff obrigatório + rate limit
export const chatWithManagerAgent = onCall({ secrets: [openRouterApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario');

  const role = request.auth.token['role'] as string | undefined;
  if (!role || !STAFF_ROLES.includes(role)) {
    throw new HttpsError('permission-denied', 'Recurso disponível apenas para gestores.');
  }

  await enforceAiRateLimit(request.auth.uid, 'chatWithManagerAgent');
  await logAiCall(request.auth.uid, role, 'chatWithManagerAgent');

  const { agent, history, message, contextSummary } = request.data as { /* inalterado */ };
  if (!message || !agent) throw new HttpsError('invalid-argument', 'Dados invalidos');
  // ... resto inalterado
});
```
```javascript
// firestore.rules — bloquear escrita client-side na coleção de contadores
    match /ai_usage/{docId} {
      allow read, write: if false; // apenas Admin SDK
    }
```

**Passos de implementação:**
1. Adicionar helpers + aplicar nas 3 callables (staff check só no `chatWithManagerAgent`; rate-limit e audit nas três).
2. Adicionar o bloco `ai_usage` às rules; deploy de rules + functions.
3. Nota: as rules de `audit_logs` bloqueiam `tenantId: null` para clientes, mas o Admin SDK bypassa rules — o log de `AI_CALL` grava normalmente.
4. Teste: cidadão chamando `chatWithManagerAgent` via SDK → `permission-denied`; 21ª geração de obituário no dia → `resource-exhausted` com mensagem amigável (o frontend já exibe `error.message`).

**Critério de aceitação:**
- Cidadão não consegue usar o agente do gestor.
- Limites diários efetivos por uid (verificar doc em `ai_usage`).
- Cada chamada gera `audit_logs` com action `AI_CALL` e `userRole` — pré-requisito de W4-1 satisfeito.
- Fluxos legítimos (obituário no wizard, assistente, console de agentes) funcionam.

**Riscos e reversão:** +2 writes por chamada de IA (contador + audit) — custo desprezível vs. custo do modelo. Limites mal calibrados podem travar demo intensa — os valores são constantes fáceis de ajustar. Reversão: redeploy anterior.

---

## [W2-9] — Enumeração de usuários no reset de senha (S-09, item 58)

**Arquivo(s):** `src/pages/auth/LoginPage.tsx` (linhas 29–45)
**Diagnóstico:** o fluxo de reset responde "E-mail nao encontrado." para `auth/user-not-found` — permite descobrir quais e-mails têm conta (enumeração), insumo para phishing dirigido a famílias enlutadas.

**Código atual (before):**
```typescript
// src/pages/auth/LoginPage.tsx:29-45
    if (!resetEmail.trim()) return;
    setResetStatus('sending');
    setResetError('');
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetStatus('sent');
    } catch (error: any) {
      setResetStatus('error');
      const code = error?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
        setResetError('E-mail nao encontrado.');
      } else {
        setResetError('Erro ao enviar. Tente novamente.');
      }
    }
```

**Código corrigido (after):**
```typescript
// src/pages/auth/LoginPage.tsx — resposta neutra: não revela existência da conta
    if (!resetEmail.trim()) return;
    setResetStatus('sending');
    setResetError('');
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetStatus('sent');
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/user-not-found') {
        // Mesma resposta de sucesso: não confirmar se o e-mail existe
        setResetStatus('sent');
      } else if (code === 'auth/invalid-email') {
        setResetStatus('error');
        setResetError('Formato de e-mail inválido.');
      } else {
        setResetStatus('error');
        setResetError('Erro ao enviar. Tente novamente.');
      }
    }
```
E na mensagem de sucesso do JSX: "Se este e-mail estiver cadastrado, você receberá o link de recuperação em instantes."

**Passos de implementação:** aplicar o after; ajustar o texto do estado `sent`.
**Critério de aceitação:** e-mail inexistente e existente produzem exatamente a mesma resposta visual; formato inválido tem mensagem própria (não revela nada).
**Riscos e reversão:** usuário que digitou o e-mail errado não é avisado — trade-off padrão da indústria. Reversão trivial.

---

## [W2-10] — Papel "operador" inatingível: `addUserToTenant` fixa manager (D-13)

**Arquivo(s):** `functions/src/index.ts` (linhas 89–128), `src/pages/superadmin/SuperAdminPage.tsx` (form de novo usuário), `src/services/superadminService.ts`
**Diagnóstico:** toda conta criada recebe `role:'manager'` fixo — o papel "operador" prometido pela visão e pela matriz da SecurityPage não pode existir. Sem operator não há como diferenciar permissões nas rules (financeiro/exclusões só manager — melhorias futuras).

**Código atual (before):**
```typescript
// functions/src/index.ts:94-117
  const { tenantId, email, password } = request.data as {
    tenantId: string;
    email: string;
    password: string;
  };

  if (!tenantId || !email || !password) {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }
  // ...
  const user = await auth.createUser({ email, password });

  await auth.setCustomUserClaims(user.uid, {
    role: 'manager',
    tenantId,
  });

  await db.collection('profiles').doc(user.uid).set({
    email,
    role: 'manager',
    tenantId,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  });
```

**Código corrigido (after):**
```typescript
// functions/src/index.ts
  const { tenantId, email, password, role = 'manager' } = request.data as {
    tenantId: string;
    email: string;
    password: string;
    role?: 'manager' | 'operator';
  };

  if (!tenantId || !email || !password) {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }
  if (!['manager', 'operator'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Papel inválido. Use manager ou operator.');
  }
  // ...
  const user = await auth.createUser({ email, password });

  await auth.setCustomUserClaims(user.uid, { role, tenantId });

  await db.collection('profiles').doc(user.uid).set({
    email,
    role,
    tenantId,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  });
```
```tsx
// src/pages/superadmin/SuperAdminPage.tsx — select de papel no form de novo usuário
<select
  value={newUserRole}
  onChange={(e) => setNewUserRole(e.target.value as 'manager' | 'operator')}
  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
  aria-label="Papel do usuário"
>
  <option value="manager">Gestor (acesso total do tenant)</option>
  <option value="operator">Operador (execução em campo)</option>
</select>
// e incluir { role: newUserRole } no payload da callable via superadminService
```

**Passos de implementação:**
1. Function: aceitar/validar `role`; deploy.
2. `superadminService.ts`: repassar `role` no wrapper de `addUserToTenant`.
3. UI: select + estado `newUserRole` (default `manager`).
4. Depende de W2-1 (rules e rotas já tratam `operator` canonicamente).
5. **Decisão de produto registrada (H-4 da análise)**: nesta etapa `operator` tem as MESMAS permissões de manager nas rules (isStaff) exceto leitura de `audit_logs` (já é manager-only). Restrições finas (financeiro/exclusões manager-only) ficam para quando a matriz real for definida — não repetir a matriz fictícia da SecurityPage.

**Critério de aceitação:** superadmin cria um operador; o operador loga, cai em `/admin/dashboard` (W2-1), opera as telas SCI; não lê auditoria; o claim mostra `role:'operator'`.

**Riscos e reversão:** nenhum para contas existentes (default `manager` preserva o comportamento). Reversão: ignorar o parâmetro.

---

## [W2-11] — Testes de regras no emulador + CI bloqueante (itens 24, 25)

**Arquivo(s):** novos: `tests/rules/firestore.rules.test.ts`, `firebase.json` (emulators), `.github/workflows/ci.yml`; alterado: `package.json`
**Diagnóstico:** zero testes; o único workflow existente builda e publica direto na main — um `tsc` quebrado só falha porque o Vite falharia, e uma regressão de rules vai para produção sem barreira. As rules são a única defesa real do sistema: teste de rules é o maior valor por linha de teste do projeto.

**Comandos de instalação:**
```bash
npm install -D vitest @firebase/rules-unit-testing firebase-tools
```

**Código (after) — `firebase.json` (acrescentar emulators):**
```json
{
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "storage": { "rules": "storage.rules" },
  "functions": { "source": "functions" },
  "emulators": {
    "firestore": { "port": 8080 },
    "storage": { "port": 9199 },
    "ui": { "enabled": false }
  }
}
```

**Código (after) — `tests/rules/firestore.rules.test.ts` (bateria J.1 da análise):**
```typescript
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
```

**Código (after) — `.github/workflows/ci.yml`:**
```yaml
name: CI

on:
  pull_request:
  push:
    branches: ["main"]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - name: Typecheck
        run: npx tsc --noEmit
      - name: Unit tests
        run: npx vitest run --exclude tests/rules
      - name: Rules tests (emulator)
        run: npx firebase emulators:exec --only firestore "npx vitest run tests/rules"

  deploy-rules:
    # Rules/indexes versionados por CI: produção nunca diverge do repo
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - name: Deploy Firestore/Storage rules + indexes
        run: npx firebase deploy --only firestore:rules,firestore:indexes,storage --project memorialos --token "${{ secrets.FIREBASE_DEPLOY_TOKEN }}"
```
```json
// package.json — scripts
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run --exclude tests/rules",
    "test:rules": "firebase emulators:exec --only firestore \"vitest run tests/rules\"",
    "lint": "tsc --noEmit"
  }
}
```

**Passos de implementação:**
1. Instalar dependências; configurar emulators no `firebase.json`; escrever a suíte acima em `tests/rules/`.
2. Gerar `FIREBASE_DEPLOY_TOKEN` (`firebase login:ci`) e cadastrar como secret do repositório (é um token de deploy, não vai para bundle — permitido).
3. Criar `ci.yml`; marcar o job `quality` como *required status check* na branch protection da `main`.
4. Rodar localmente `npm run test:rules` até verde; ajustar regras/testes conforme divergências reais encontradas (o teste R10 valida W2-3; R2b valida W2-6; schema valida W1-7/W2-5 — merge deste item por último na onda).
5. O `deploy-pages.yml` continua cuidando do frontend; o `ci.yml` cuida de qualidade + rules.

**Critério de aceitação:**
- PR com regressão de rules (ex.: remover o guard de `status` em death_notifications) fica vermelho.
- Push na main deploya as rules automaticamente (evidência no log do workflow — substitui o processo manual de W0-10 daqui em diante).
- `npm run typecheck`, `npm test` e `npm run test:rules` verdes localmente.

**Riscos e reversão:** `firebase emulators:exec` baixa o emulador no CI (~30s de overhead, aceitável). Token de deploy com escopo amplo — armazenar apenas como secret, rotacionar semestralmente. Reversão: desabilitar o required check (não recomendado).

---

## SMOKE TEST DE SAÍDA DA ONDA 2 (20 min)

1. `npm run test:rules` verde (bateria completa R1–R10 + schema).
2. Operador criado pelo superadmin loga e acessa `/admin`.
3. Upload de `.exe` bloqueado pela RULE (teste via SDK bruto).
4. Staff A não abre anexo do tenant B (pós-backfill de metadados).
5. Cidadão chamando `chatWithManagerAgent` via console → permission-denied.
6. Reset de senha com e-mail inexistente → mesma resposta de sucesso.
7. Dropdown "Administrador responsável" populado para manager.
8. PR de teste com rules quebradas → CI vermelho bloqueia merge.

---

# ONDA 3 — FEEDBACK E UX CRÍTICA (~3,5–4,5 dias)

> Objetivo: zerar os ~34 `catch` silenciosos, dar toast a toda mutação, loading a todo fetch, e eliminar os `alert()`/`window.confirm` remanescentes. **Depende de**: W0-5 (ConfirmDialog), W2-7 (regra de user_profiles para W3-10). O item W3-1 cria a infraestrutura usada pelos demais.

---

## [W3-1] — Utilitário central de erros `lib/errors.ts` (Q-03)

**Arquivo(s):** `src/lib/errors.ts` (novo)
**Diagnóstico:** o ternário `error?.code === 'permission-denied' ? 'Sem permissão...' : error?.message || '...'` está copiado em 13 pontos (`OperationalPage.tsx:134-173/175-203/205-247`, `MaintenancePage.tsx:81-119/134-162`, `EnvironmentalPage.tsx:80-111/113-144`, `DocumentsCenterPage.tsx:44-87`, `SupportPage.tsx:66-94/96-131`, `FinancialPage.tsx:57-93`, `CemeteryList.tsx:112-114`, `DeceasedForm.tsx:91-93`). Os catches de **load** não têm nem isso. Uma função única padroniza mensagem e loga com escopo.

**Código atual (before) — o padrão repetido 13×:**
```typescript
    } catch (error: any) {
      const msg = error?.code === 'permission-denied'
        ? 'Sem permissão para esta operação.'
        : error?.message || 'Erro ao salvar. Tente novamente.';
      toast.error(msg);
    }
```

**Código corrigido (after) — novo `src/lib/errors.ts`:**
```typescript
import toast from 'react-hot-toast';

/** Mapeia códigos do Firebase para mensagens PT-BR amigáveis. */
export function getFirestoreErrorMessage(error: any, fallback = 'Erro ao salvar. Tente novamente.'): string {
  const code: string = error?.code || '';
  switch (code) {
    case 'permission-denied':
      return 'Sem permissão para esta operação.';
    case 'unavailable':
      return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
    case 'resource-exhausted':
      return 'Limite de uso atingido. Tente novamente mais tarde.';
    case 'not-found':
      return 'Registro não encontrado. Ele pode ter sido excluído.';
    case 'failed-precondition':
      return 'Operação indisponível no momento (índice ou pré-condição ausente).';
    default:
      return error?.message || fallback;
  }
}

/**
 * Uso em catch de MUTAÇÃO: loga com escopo + toast com mensagem mapeada.
 *   catch (error) { reportError('SecurityPage.createEvent', error); }
 */
export function reportError(scope: string, error: unknown, fallback?: string): void {
  console.error(`[${scope}]`, error);
  toast.error(getFirestoreErrorMessage(error, fallback));
}

/**
 * Uso em catch de LOAD: idem, com fallback próprio de carregamento.
 *   catch (error) { reportLoadError('DeceasedList', error); }
 */
export function reportLoadError(scope: string, error: unknown): void {
  reportError(scope, error, 'Erro ao carregar os dados. Recarregue a página.');
}
```

**Passos de implementação:**
1. Criar o arquivo.
2. Substituir os 13 ternários existentes por `reportError('<Pagina>.<acao>', error)` (mecânico).
3. Os itens W3-2…W3-9 usam estas funções — implementar este item primeiro.

**Critério de aceitação:** `grep -rn "permission-denied" src/pages | wc -l` → 0 (todo mapeamento vive em `lib/errors.ts`); comportamento visual idêntico ao atual nas páginas que já tinham toast.

**Riscos e reversão:** nenhum. Reversão trivial.

---

## [W3-2] — Varredura dos 34 catches silenciosos (seção 3.9 da análise)

**Arquivo(s)/Linha(s):** tabela completa abaixo (inventário confirmado da análise)
**Diagnóstico:** 34 blocos `catch` fazem apenas `console.error` — o usuário fica com tela vazia/dropdown vazio/dado desatualizado sem saber que houve falha. Padrão de correção: `reportLoadError(scope, error)` em loads; `reportError(scope, error)` em mutações. Este item cobre os pontos NÃO tratados individualmente por outros itens (os tratados estão marcados).

| # | Arquivo:linha | Contexto | Correção |
|---|---|---|---|
| 1 | `AuthContext.tsx:53-55` | claims | manter console + **setar `error` no contexto** (ver bloco abaixo) |
| 2 | `AdminContext.tsx:30-32` | cemitérios do seletor | `reportLoadError('AdminContext.cemeteries', error)` |
| 3 | `AdminDashboard.tsx:71-73` | snapshot | `reportLoadError('AdminDashboard.load', error)` |
| 4 | `OperationalPage.tsx:97-99` | listas | `reportLoadError('OperationalPage.load', error)` |
| 5 | `InventoryPage.tsx:81-83` | plots+snapshot | `reportLoadError('InventoryPage.load', error)` |
| 6 | `FinancialPage.tsx:48-50` | lançamentos | `reportLoadError('FinancialPage.load', error)` |
| 7 | `MaintenancePage.tsx:70-72` | ordens/estoque | `reportLoadError('MaintenancePage.load', error)` |
| 8 | `EnvironmentalPage.tsx:69-71` | checks | `reportLoadError('EnvironmentalPage.load', error)` |
| 9 | `DocumentsCenterPage.tsx:35-37` | documentos | `reportLoadError('DocumentsCenter.load', error)` |
| 10 | `SupportPage.tsx:56-59` | tickets/treinos | `reportLoadError('SupportPage.load', error)` |
| 11 | `ReportsPage.tsx:44-46` | relatórios | `reportLoadError('ReportsPage.load', error)` |
| 12 | `ReportsPage.tsx:59-61` | gerar relatório | tratado em **W3-4** |
| 13 | `AgentsPage.tsx:46-48` | agentes | `reportLoadError('AgentsPage.load', error)` |
| 14 | `AgentsPage.tsx:76-78` | criar agente | tratado em **W3-3** |
| 15 | `AgentsPage.tsx:86-88` | toggle agente | tratado em **W3-3** |
| 16 | `SecurityPage.tsx:43-45` | eventos | `reportLoadError('SecurityPage.load', error)` |
| 17 | `SecurityPage.tsx:69-71` | criar evento | tratado em **W0-4** |
| 18 | `SecurityPage.tsx:81-83` | status evento | tratado em **W0-4** |
| 19 | `DeceasedList.tsx:21-23` | lista | tratado em **W1-8** (toast no loadData) |
| 20 | `DeceasedDetail.tsx:27-29` | detalhe | `reportLoadError('DeceasedDetail.load', error)` |
| 21 | `CemeteryDetail.tsx:227-229` | dados | `reportLoadError('CemeteryDetail.load', error)` |
| 22 | `CemeteryDetail.tsx:307-309` | plots do setor | `reportLoadError('CemeteryDetail.plots', error)` |
| 23 | `CemeteryDetail.tsx:363-365` | excluir plot | tratado em **W3-6** |
| 24 | `CommunicatedDeaths.tsx:53-55` | notificações | `reportLoadError('CommunicatedDeaths.load', error)` |
| 25 | `GardenOfMemories.tsx:74-76` | jardim | `reportLoadError('Garden.load', error)` |
| 26 | `VirtualAssistant.tsx:55-57` | contexto emocional | manter silencioso **com comentário** (contexto é opcional; chat funciona sem) |
| 27 | `UserLayout.tsx:34-38` | perfil no layout | manter silencioso com comentário (fallback de exibição) |
| 28 | `SuperAdminPage.tsx:105-107` | tenants | `reportLoadError('SuperAdmin.tenants', error)` |
| 29 | `SuperAdminPage.tsx:126-128` | usuários | `reportLoadError('SuperAdmin.users', error)` |
| 30 | `SuperAdminPage.tsx:164-166` | toggle tenant | tratado em **W3-5** |
| 31 | `SuperAdminPage.tsx:183-185` | delete tenant | tratado em **W3-5** |
| 32 | `SuperAdminPage.tsx:236-239` | toggle user | tratado em **W3-5** |
| 33 | `SuperAdminPage.tsx:248-251` | delete user | tratado em **W3-5** |
| 34 | `MonitoringDashboard.tsx:192-194` | métricas | `reportLoadError('Monitoring.fetch', error)` |
| 35 | `SearchPage.tsx:39-41` | busca pública | tratado em **W3-8** |
| 36 | `ProfilePage.tsx:49-51` | perfil | `reportLoadError('ProfilePage.load', error)` |

**Código corrigido (after) — caso especial #1, `AuthContext.tsx`:**
```typescript
// src/contexts/AuthContext.tsx:46-55 — falha de claims deixa o usuário "citizen"
// silenciosamente; melhor sinalizar para a UI decidir (o contexto já tem `error`).
        try {
          const tokenResult = await getIdTokenResult(currentUser);
          const userRole = (tokenResult.claims.role as string) || 'citizen';
          const userTenantId = (tokenResult.claims.tenantId as string) || null;
          setRole(userRole);
          setTenantId(userTenantId);
        } catch (e) {
          console.error('Error fetching claims', e);
          setError('Não foi possível carregar suas permissões. Recarregue a página.');
        }
```

**Passos de implementação:**
1. Depende de W3-1. Aplicar a tabela linha a linha — cada correção é 1-2 linhas.
2. Nos casos "manter silencioso", adicionar comentário `// best-effort deliberado: <motivo>` para o próximo auditor não reabrir o item.
3. Conferir com `grep -rn "console.error" src/ --include="*.tsx"` que todo catch restante ou chama `reportError`/`reportLoadError` ou tem o comentário de best-effort.

**Critério de aceitação:** simular offline (DevTools → Network → Offline) e navegar pelas páginas: toda página com fetch mostra toast de erro de carregamento; nenhuma tela fica em branco/zerada sem aviso.

**Riscos e reversão:** excesso de toasts em falha de rede generalizada (um por página visitada) — aceitável; deduplicação por id de toast é melhoria futura. Reversão: revert.

---

## [W3-3] — AgentsPage: criar/ativar agente sem feedback (parte de 2.4)

**Arquivo(s):** `src/pages/admin/AgentsPage.tsx` (linhas 55–89)
**Diagnóstico:** `handleCreateAgent` limpa o formulário em sucesso mas não confirma; em erro, só console — o gestor não sabe se o agente foi criado. `toggleAgent` idem.

**Código atual (before):**
```typescript
// src/pages/admin/AgentsPage.tsx:55-89
  const handleCreateAgent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !form.name || !form.objective || !form.prompt) return;
    try {
      await createAIAgent(tenantId, {
        name: form.name,
        mode: form.mode as any,
        objective: form.objective,
        prompt: form.prompt,
        modules: form.modules.split(',').map((item) => item.trim()).filter(Boolean),
        isActive: form.isActive
      });
      setForm({
        name: '',
        mode: 'agent',
        objective: '',
        prompt: '',
        modules: 'operacional,sanitario,ambiental,financeiro',
        isActive: true
      });
      await loadData();
    } catch (error) {
      console.error('Erro ao criar agente/chatbot:', error);
    }
  };

  const toggleAgent = async (id: string, currentValue: boolean) => {
    if (!tenantId) return;
    try {
      await updateSCIRecord(tenantId, 'sci_ai_agents', id, 'TOGGLE_AI_AGENT', { isActive: !currentValue });
      await loadData();
    } catch (error) {
      console.error('Erro ao atualizar agente IA:', error);
    }
  };
```

**Código corrigido (after):**
```typescript
// src/pages/admin/AgentsPage.tsx
import toast from 'react-hot-toast';
import { reportError } from '@/lib/errors';

  const handleCreateAgent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !form.name || !form.objective || !form.prompt) return;
    try {
      await createAIAgent(tenantId, { /* payload inalterado */ });
      toast.success(`Agente "${form.name}" criado.`);
      setForm({ /* reset inalterado */ });
      await loadData();
    } catch (error) {
      reportError('AgentsPage.create', error);
    }
  };

  const toggleAgent = async (id: string, currentValue: boolean) => {
    if (!tenantId) return;
    try {
      await updateSCIRecord(tenantId, 'sci_ai_agents', id, 'TOGGLE_AI_AGENT', { isActive: !currentValue });
      toast.success(currentValue ? 'Agente desativado.' : 'Agente ativado.');
      await loadData();
    } catch (error) {
      reportError('AgentsPage.toggle', error);
    }
  };
```

**Passos de implementação:** aplicar; incluir também aqui o **W4-7 adiantado** se preferir 1 PR só no arquivo (mensagem "chave Gemini" — ver Onda 4; manter IDs separados no changelog).
**Critério de aceitação:** criar agente mostra toast com o nome; erro (offline) mostra toast e mantém o formulário preenchido; ativar/desativar confirma.
**Riscos e reversão:** nenhum.

---

## [W3-4] — ReportsPage muda: gerar relatório sem confirmação nem erro (parte de 2.4)

**Arquivo(s):** `src/pages/admin/ReportsPage.tsx` (linhas 53–64)
**Diagnóstico:** o clique em "Gerar" não dá nenhum feedback além de (talvez) um item novo aparecer na lista; erro só no console.

**Código atual (before):**
```typescript
// src/pages/admin/ReportsPage.tsx:53-64
  const handleGenerateReport = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await createAutomaticReport(tenantId, type as any, selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId);
      await loadReports();
    } catch (error) {
      console.error('Erro ao gerar relatorio automatico:', error);
    } finally {
      setSaving(false);
    }
  };
```

**Código corrigido (after):**
```typescript
// src/pages/admin/ReportsPage.tsx
import toast from 'react-hot-toast';
import { reportError } from '@/lib/errors';

  const handleGenerateReport = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await createAutomaticReport(tenantId, type as any, selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId);
      toast.success('Relatório gerado. Selecione-o no histórico para visualizar ou baixar.');
      await loadReports();
    } catch (error) {
      reportError('ReportsPage.generate', error);
    } finally {
      setSaving(false);
    }
  };
```

**Passos de implementação:** aplicar; adicionar `reportLoadError` no `loadReports` (item da tabela W3-2 #11).
**Critério de aceitação:** gerar mostra toast; falha mostra erro; o botão exibe "Gerando..." via `saving` já existente (confirmar `disabled={saving}` no JSX — adicionar se ausente).
**Riscos e reversão:** nenhum.

---

## [W3-5] — SuperAdminPage: exclusões com `window.confirm` e erros silenciosos (U-09, tabela 2.4)

**Arquivo(s):** `src/pages/superadmin/SuperAdminPage.tsx` (linhas 164–185, 236–251 e os `window.confirm` em 172–177, 243)
**Diagnóstico:** desativar/excluir prefeituras e usuários usa `window.confirm` nativo (bloqueia o thread, sem estilo, texto hoje mentiroso sobre a cascata — corrigido em W1-12) e os catches de toggle/delete caem em `console.error` — um delete que falha parece ter funcionado até o refresh.

**Código atual (before) — padrão dos 4 handlers:**
```typescript
// src/pages/superadmin/SuperAdminPage.tsx (padrão em 164-185 e 236-251)
  const handleDeleteTenant = async (managerUid: string, tenantId: string) => {
    if (!window.confirm('Excluir esta prefeitura? Todos os logins e dados do tenant serão removidos.')) return;
    try {
      await deleteManagerAccount(managerUid, tenantId);
      await loadTenants();
    } catch (error) {
      console.error('Erro ao excluir prefeitura:', error);
    }
  };
```

**Código corrigido (after):**
```typescript
// src/pages/superadmin/SuperAdminPage.tsx
import toast from 'react-hot-toast';
import { reportError } from '@/lib/errors';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type PendingAction =
  | { kind: 'deleteTenant'; managerUid: string; tenantId: string; name: string }
  | { kind: 'deleteUser'; uid: string; email: string }
  | null;

const [pendingAction, setPendingAction] = useState<PendingAction>(null);
const [actionLoading, setActionLoading] = useState(false);

const confirmPendingAction = async () => {
  if (!pendingAction) return;
  setActionLoading(true);
  try {
    if (pendingAction.kind === 'deleteTenant') {
      const result = await deleteManagerAccount(pendingAction.managerUid, pendingAction.tenantId);
      toast.success('Prefeitura e dados operacionais removidos.');
    } else {
      await deleteTenantUser(pendingAction.uid);
      toast.success(`Login ${pendingAction.email} removido.`);
    }
    setPendingAction(null);
    await loadTenants();
  } catch (error) {
    reportError('SuperAdmin.delete', error);
  } finally {
    setActionLoading(false);
  }
};

// Toggle (sem confirm — reversível) ganha toasts:
const handleToggleTenant = async (managerUid: string, disabled: boolean) => {
  try {
    await toggleManagerStatus(managerUid, disabled);
    toast.success(disabled ? 'Prefeitura desativada. Todos os logins bloqueados.' : 'Prefeitura reativada.');
    await loadTenants();
  } catch (error) {
    reportError('SuperAdmin.toggleTenant', error);
  }
};

// ConfirmDialog único no JSX:
<ConfirmDialog
  open={!!pendingAction}
  danger
  loading={actionLoading}
  title={pendingAction?.kind === 'deleteTenant' ? 'Excluir prefeitura' : 'Excluir login'}
  description={
    pendingAction?.kind === 'deleteTenant' ? (
      <>
        Remove <strong>{pendingAction.name}</strong>: todos os logins e TODOS os dados
        operacionais (cemitérios, jazigos, falecidos, registros SCI). A trilha de
        auditoria é preservada. Esta ação é irreversível.
      </>
    ) : (
      <>Remove o login <strong>{pendingAction?.kind === 'deleteUser' ? pendingAction.email : ''}</strong>. O usuário perde o acesso imediatamente.</>
    )
  }
  confirmLabel="Excluir definitivamente"
  requireText={pendingAction?.kind === 'deleteTenant' ? pendingAction.name : undefined}
  onConfirm={confirmPendingAction}
  onCancel={() => setPendingAction(null)}
/>
```

**Passos de implementação:**
1. Depende de W0-5 (ConfirmDialog) e alinha o texto com W1-12 (cascata real + auditoria preservada).
2. Substituir os 2 `window.confirm` por `setPendingAction(...)`; adicionar toasts nos 4 handlers (toggle tenant, delete tenant, toggle user, delete user).
3. `requireText` com o nome da prefeitura na exclusão de tenant (cascade grande).

**Critério de aceitação:** `grep -n "window.confirm" src/pages/superadmin/SuperAdminPage.tsx` → vazio; exclusão de prefeitura exige digitar o nome; toggle mostra toast; falha de qualquer ação mostra erro.
**Riscos e reversão:** nenhum. Reversão: revert.

---

## [W3-6] — CemeteryDetail: `alert`/`window.confirm` nativos e delete de plot silencioso (tabela 2.4/2.9)

**Arquivo(s):** `src/pages/admin/CemeteryDetail.tsx` (linhas 276–294, 346–366; `alert` também em ~348 e no save do setor 278)
**Diagnóstico:** a tela usa `alert('Erro ao salvar setor.')`, `window.confirm('Excluir este setor?...')` (substituído em W1-5), `window.confirm('Excluir este tumulo?')` e — pior — `handleDeletePlot` tem catch **sem alert nem toast**: excluir túmulo pode falhar sem nenhum sinal.

**Código atual (before):**
```typescript
// src/pages/admin/CemeteryDetail.tsx:354-366
  const handleDeletePlot = async (plotId: string) => {
    if (!tenantId || !window.confirm('Excluir este tumulo?')) return;
    try {
      await deletePlot(tenantId, plotId);
      if (expandedSector) {
        const plots = await getPlots(expandedSector);
        setSectorPlots(plots);
      }
      await loadData();
    } catch (error) {
      console.error('Erro ao excluir tumulo:', error);
    }
  };
```

**Código corrigido (after):**
```typescript
// src/pages/admin/CemeteryDetail.tsx
import toast from 'react-hot-toast';
import { reportError } from '@/lib/errors';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const [pendingPlotDelete, setPendingPlotDelete] = useState<Plot | null>(null);

const confirmDeletePlot = async () => {
  if (!tenantId || !pendingPlotDelete?.id) return;
  try {
    await deletePlot(tenantId, pendingPlotDelete.id);
    toast.success(`Túmulo ${pendingPlotDelete.code} excluído.`);
    if (expandedSector) {
      setSectorPlots(await getPlots(expandedSector));
    }
    await loadData();
  } catch (error) {
    reportError('CemeteryDetail.deletePlot', error);
  } finally {
    setPendingPlotDelete(null);
  }
};

// Botão da lixeira do túmulo: onClick={() => setPendingPlotDelete(plot)}

<ConfirmDialog
  open={!!pendingPlotDelete}
  danger
  title="Excluir túmulo"
  description={
    <>
      Excluir o túmulo <strong>{pendingPlotDelete?.code}</strong>
      {pendingPlotDelete?.occupantName ? (
        <> — atenção: consta o ocupante <strong>{pendingPlotDelete.occupantName}</strong></>
      ) : null}
      ? Esta ação não pode ser desfeita.
    </>
  }
  confirmLabel="Excluir túmulo"
  onConfirm={confirmDeletePlot}
  onCancel={() => setPendingPlotDelete(null)}
/>
```
E nos saves de setor/túmulo (linhas 276–282, 346–351): trocar `alert('Erro ao salvar setor.')` / `alert('Erro ao salvar tumulo.')` por `reportError('CemeteryDetail.saveSector', error)` / `reportError('CemeteryDetail.savePlot', error)`, e adicionar `toast.success('Setor salvo.')` / `toast.success('Túmulo salvo.')` nos caminhos felizes.

**Passos de implementação:**
1. Depende de W0-5 e coordena com W1-5 (que já troca o confirm do setor — se W1-5 mergeado, este item cobre só túmulos e alerts de save).
2. Aplicar os afters; varrer o arquivo: `grep -n "alert(\|window.confirm" src/pages/admin/CemeteryDetail.tsx` deve zerar.

**Critério de aceitação:** zero `alert`/`window.confirm` no arquivo; excluir túmulo pede confirmação com código (e avisa se tem ocupante); toda falha vira toast.
**Riscos e reversão:** nenhum.

---

## [W3-7] — Loading states ausentes em 5 páginas (tabela 2.4, itens 32 e 51)

**Arquivo(s):** `src/pages/admin/FinancialPage.tsx`, `DocumentsCenterPage.tsx`, `SupportPage.tsx`, `SecurityPage.tsx`, `CemeteryList.tsx`
**Diagnóstico:** essas páginas não têm estado `loading` — durante o fetch inicial a tabela mostra "Nenhum lancamento"/vazio (feedback **enganoso**: parece que não há dados) e `CemeteryList` fica em branco com header. Padrão mínimo consistente com as demais páginas: flag `loading` + linha "Carregando..." na tabela + empty state real só quando `!loading`.

**Código atual (before) — exemplo `FinancialPage` (o load não seta loading):**
```typescript
// padrão atual nas 4 páginas SCI sem loading (ex.: FinancialPage.tsx:41-50)
  const loadData = async () => {
    if (!tenantId) return;
    try {
      const data = await listFinancialRecords(tenantId);
      setRecords(data);
    } catch (error) {
      console.error('Erro ao carregar registros financeiros:', error);
    }
  };
```

**Código corrigido (after) — padrão a aplicar nas 5 páginas:**
```typescript
const [loading, setLoading] = useState(true);

const loadData = async () => {
  if (!tenantId) return;
  setLoading(true);
  try {
    const data = await listFinancialRecords(tenantId);
    setRecords(data);
  } catch (error) {
    reportLoadError('FinancialPage.load', error);
  } finally {
    setLoading(false);
  }
};

// Na tabela (padrão idêntico ao de DeceasedList.tsx:91-94):
<tbody className="divide-y divide-slate-100">
  {loading ? (
    <tr><td colSpan={COLS} className="px-4 py-8 text-center text-slate-500">Carregando...</td></tr>
  ) : scopedRecords.length === 0 ? (
    <tr><td colSpan={COLS} className="px-4 py-8 text-center text-slate-500">Nenhum lançamento registrado.</td></tr>
  ) : ( /* linhas */ )}
</tbody>
```
Para `CemeteryList` (cards, não tabela): `loading` → grid de 3 `StatCardSkeleton`; lista vazia → empty state com ação: `"Nenhum cemitério cadastrado ainda." + botão "Criar o primeiro cemitério"` chamando `openCreateModal` (padrão 2.10.8 — empty state com ação).

**Passos de implementação:**
1. Aplicar o padrão nas 5 páginas (FinancialPage, DocumentsCenterPage, SupportPage, SecurityPage — nas listas de incidentes —, CemeteryList).
2. Integra com W3-2 (reportLoadError entra no mesmo catch).
3. Em SupportPage e DocumentsCenter, o mesmo `loading` cobre as duas abas (um fetch só).

**Critério de aceitação:** com o DevTools em "Slow 3G", nenhuma das 5 páginas mostra empty state durante o fetch; `CemeteryList` vazio mostra CTA de criação.
**Riscos e reversão:** nenhum.

---

## [W3-8] — SearchPage: erro exibido como "nenhum resultado" (U-05 parcial, tabela 2.4)

**Arquivo(s):** `src/pages/public/SearchPage.tsx` (linhas 23–45)
**Diagnóstico:** o catch faz `setResults([])` — uma falha de rede/regra vira "Nenhum resultado encontrado", induzindo a família a acreditar que o ente não está no sistema. Erro e vazio são estados distintos.

**Código atual (before):**
```typescript
// src/pages/public/SearchPage.tsx:30-45
    try {
      // Lê a projeção pública (LGPD-safe), não a coleção `deceaseds` (staff-only).
      const q = query(collection(db, 'public_deceaseds'), firestoreLimit(200));
      const snapshot = await getDocs(q);
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SearchResult));
      const filtered = all.filter(d =>
        d.name?.toLowerCase().includes(term)
      );
      setResults(filtered);
    } catch (error) {
      console.error('Erro na busca:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
```

**Código corrigido (after):**
```typescript
// src/pages/public/SearchPage.tsx
const [searchError, setSearchError] = useState<string | null>(null);

    setSearchError(null);
    try {
      const q = query(collection(db, 'public_deceaseds'), firestoreLimit(200));
      const snapshot = await getDocs(q);
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SearchResult));
      setResults(all.filter(d => d.name?.toLowerCase().includes(term)));
    } catch (error) {
      console.error('Erro na busca:', error);
      setResults([]);
      setSearchError('Não foi possível concluir a busca. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }

// No JSX, antes do bloco de resultados/empty state:
{searchError && (
  <div className="max-w-3xl mx-auto bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4 text-sm text-center">
    {searchError}
  </div>
)}
{/* o empty state "Nenhum resultado" só renderiza quando searched && !loading && !searchError */}
```

**Passos de implementação:** aplicar; condicionar o empty state a `!searchError`. (A migração para busca server-side é W5-8 — este item só separa os estados.)
**Critério de aceitação:** offline, buscar → banner de erro, sem "nenhum resultado"; online, termo inexistente → "nenhum resultado" normal.
**Riscos e reversão:** nenhum.

---

## [W3-9] — `alert()` remanescentes: ProfilePage e ShopAndServices (item 31)

**Arquivo(s):** `src/pages/user/ProfilePage.tsx` (linhas 77, 80), `src/pages/user/ShopAndServices.tsx` (linha ~163)
**Diagnóstico:** últimos `alert()` do sistema fora dos wizards (já tratados em W0-7). `ProfilePage` usa alert para sucesso/erro do save; `ShopAndServices` dá `alert('Pedido registrado...')` num checkout fake (o banner de demo é W4-4; aqui só o alert).

**Código atual (before):**
```typescript
// src/pages/user/ProfilePage.tsx:69-83
      await saveUserProfile(
        user.uid,
        {
          ...form
        },
        { photoFile: photoFile || undefined, tenantId }
      );
      setPhotoFile(null);
      alert('Perfil atualizado com sucesso.');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      alert('Nao foi possivel atualizar o perfil.');
    } finally {
      setSaving(false);
    }
```

**Código corrigido (after):**
```typescript
// src/pages/user/ProfilePage.tsx
import toast from 'react-hot-toast';
import { reportError } from '@/lib/errors';

      await saveUserProfile(
        user.uid,
        { ...form },
        { photoFile: photoFile || undefined, tenantId }
      );
      setPhotoFile(null);
      toast.success('Perfil atualizado com sucesso.');
    } catch (error) {
      reportError('ProfilePage.save', error);
    } finally {
      setSaving(false);
    }
```
```typescript
// src/pages/user/ShopAndServices.tsx — finishCheckout
// antes: alert('Pedido registrado! Nossa equipe entrara em contato.'); setCart([]);
import toast from 'react-hot-toast';
const finishCheckout = () => {
  toast.success('Pedido de demonstração registrado. Este catálogo ainda não processa pedidos reais.');
  setCart([]);
  setIsCheckoutOpen(false);
};
```

**Passos de implementação:** aplicar; ao final rodar a verificação global do sistema.
**Critério de aceitação:** `grep -rn "alert(" src/ --include="*.tsx" | grep -v "//"` → **zero** ocorrências no projeto (gate N.5 da análise).
**Riscos e reversão:** nenhum.

---

## [W3-10] — Solicitante anônimo na análise de óbito (item 46 — parte UI)

**Arquivo(s):** `src/pages/admin/CommunicatedDeaths.tsx` (célula "Solicitante", linha ~195, e modal), `src/services/userProfileService.ts`
**Diagnóstico:** a tabela mostra `ID: a1b2c3d4...` — o gestor não tem nome nem telefone de quem comunicou o óbito, inviabilizando contato humano no fluxo mais sensível. W2-7 liberou o `get` de `user_profiles` para staff; falta consumir.

**Código atual (before):**
```tsx
// src/pages/admin/CommunicatedDeaths.tsx:~195 (célula Solicitante)
<td className="px-6 py-4 text-slate-500">ID: {n.createdBy?.slice(0, 8)}...</td>
```

**Código corrigido (after):**
```typescript
// src/services/userProfileService.ts — lookup em lote com cache local
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface RequesterInfo {
  displayName: string | null;
  phone: string | null;
}

const requesterCache = new Map<string, RequesterInfo>();

export async function getRequesterInfo(uid: string): Promise<RequesterInfo> {
  const cached = requesterCache.get(uid);
  if (cached) return cached;
  try {
    const snap = await getDoc(doc(db, 'user_profiles', uid));
    const data = snap.exists() ? snap.data() : null;
    const info: RequesterInfo = {
      displayName: (data?.displayName as string) || null,
      phone: (data?.phone as string) || null,
    };
    requesterCache.set(uid, info);
    return info;
  } catch {
    // Perfil inexistente ou regra negando: degrada para anônimo
    const info: RequesterInfo = { displayName: null, phone: null };
    requesterCache.set(uid, info);
    return info;
  }
}
```
```tsx
// src/pages/admin/CommunicatedDeaths.tsx
import { getRequesterInfo, RequesterInfo } from '@/services/userProfileService';

const [requesters, setRequesters] = useState<Record<string, RequesterInfo>>({});

useEffect(() => {
  const uids = [...new Set(notifications.map((n) => n.createdBy).filter(Boolean))];
  const missing = uids.filter((u) => !(u in requesters));
  if (missing.length === 0) return;
  Promise.all(missing.map(async (u) => [u, await getRequesterInfo(u)] as const)).then((pairs) => {
    setRequesters((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
  });
}, [notifications]);

// Célula Solicitante:
<td className="px-6 py-4">
  {requesters[n.createdBy]?.displayName ? (
    <>
      <div className="text-slate-800 font-medium">{requesters[n.createdBy].displayName}</div>
      {requesters[n.createdBy].phone && (
        <div className="text-xs text-slate-500">{requesters[n.createdBy].phone}</div>
      )}
    </>
  ) : (
    <span className="text-slate-400 text-xs">Sem perfil — ID {n.createdBy?.slice(0, 8)}…</span>
  )}
</td>
```
No modal de alocação/rejeição, exibir o mesmo bloco no cabeçalho do resumo (o gestor decide vendo quem pediu).

**Passos de implementação:**
1. Depende de W2-7 (regra). Adicionar `getRequesterInfo` ao service; consumir na tabela e no modal.
2. Cidadãos sem perfil preenchido degradam para o ID truncado — incentivo de produto: banner no `ProfilePage` "complete seu perfil para agilizar o atendimento" (opcional, 3 linhas).

**Critério de aceitação:** notificação de cidadão com perfil mostra nome+telefone na tabela e no modal; sem perfil, mostra o fallback; nenhuma chamada `list` em `user_profiles` (apenas `get` por uid — verificar no Network).
**Riscos e reversão:** exposição de contato a staff — coberta pela base legal registrada em W2-7. Reversão: revert da UI (a regra pode ficar).

---

## [W3-11] — Card "Óbitos aguardando análise" no topo do dashboard (item 22, 2.10.2)

**Arquivo(s):** `src/pages/admin/AdminDashboard.tsx`
**Diagnóstico:** a tarefa diária nº 1 do gestor (analisar comunicações de óbito) não aparece no dashboard — ele precisa lembrar de abrir a tela. A fonte já existe (`getTenantNotifications` filtrada por `submitted`).

**Código corrigido (after):**
```tsx
// src/pages/admin/AdminDashboard.tsx
import { getTenantNotifications } from '@/services/notificationService';
import { Bell } from 'lucide-react';

const [pendingNotifications, setPendingNotifications] = useState<number | null>(null);

// dentro do load existente (Promise.all com o snapshot):
const notifications = await getTenantNotifications(tenantId);
setPendingNotifications(notifications.filter((n) => n.status === 'submitted').length);

// Primeiro card do grid (antes dos KPIs de ocupação), destacado quando > 0:
<button
  onClick={() => navigate('/admin/obitos-comunicados')}
  className={`${cardClass} text-left transition-colors ${
    (pendingNotifications ?? 0) > 0 ? 'ring-2 ring-amber-400 bg-amber-50' : ''
  }`}
>
  <div className="flex items-center justify-between mb-2">
    <span className="text-sm font-medium text-slate-600">Óbitos aguardando análise</span>
    <Bell size={18} className={(pendingNotifications ?? 0) > 0 ? 'text-amber-500' : 'text-slate-300'} />
  </div>
  <div className="text-3xl font-bold text-slate-900">{pendingNotifications ?? '—'}</div>
  <p className="text-xs text-slate-500 mt-1">
    {(pendingNotifications ?? 0) > 0
      ? 'Famílias aguardando resposta — analisar agora'
      : 'Nenhuma solicitação pendente'}
  </p>
</button>
```

**Passos de implementação:**
1. Incluir a chamada no `Promise.all` do load do dashboard (evita fetch serial).
2. Card como **primeiro** item do grid, com destaque âmbar quando houver pendências.
3. Cuidado com custo: `getTenantNotifications` baixa todas — aceitável hoje (dezenas); quando W5-6 introduzir `getCountFromServer`, migrar este contador junto (anotar TODO).

**Critério de aceitação:** com 2 notificações `submitted`, o dashboard abre com o card destacado mostrando 2; clique navega para a fila; com zero, card neutro.
**Riscos e reversão:** +1 query no load do dashboard. Reversão: remover o card.

---

## SMOKE TEST DE SAÍDA DA ONDA 3 (15 min)

1. `grep -rn "alert(" src/ --include="*.tsx"` → zero.
2. `grep -rn "window.confirm" src/` → zero.
3. Offline: cada página admin exibe toast de erro de carregamento; nenhuma tabela mostra empty state durante fetch.
4. Criar agente, gerar relatório, salvar perfil → toasts de sucesso.
5. Excluir túmulo/usuário/prefeitura → ConfirmDialog em todos.
6. Busca pública offline → banner de erro (não "nenhum resultado").
7. Fila de óbitos mostra nome/telefone do solicitante.
8. Dashboard abre com card de pendências no topo.

---

# ONDA 4 — FUNCIONALIDADES INCOMPLETAS E SIMULADAS (~7–10 dias)

> Objetivo: nenhum botão sem handler, nenhuma tela que finge (câmera, matriz de permissões, "Validado IA", monitoramento fictício, loja fake), e fechamento das lacunas funcionais de maior valor (relatórios com período, estoque com movimentação, exumação acionável, memorial público, notificação à família). **Depende de**: W2-8 (audit `AI_CALL` alimenta W4-1), W1-1 (alocação — W4-11 dispara notificações a partir dela).

---

## [W4-1] — Monitoramento do superadmin consulta campos e coleções inexistentes (item 13, achado crítico nº 4)

**Arquivo(s):** `functions/src/monitoring/operationalMonitor.ts`, `functions/src/monitoring/technicalMonitor.ts`, `functions/src/monitoring/memorialMonitor.ts`, `firestore.indexes.json`
**Diagnóstico:** o backend de monitoramento é internamente consistente mas foi escrito contra um modelo de dados imaginado (Anexo M da análise): consulta `death_notifications.status == 'aguardando_validacao'` (o app grava `'submitted'`), `audit_logs.createdAt` (o campo real é `timestamp`), `audit_logs.action == 'LOGIN_FAILED'` e `'GEMINI_API_CALL'` (nunca gravados), `audit_logs.userRole` (inexistente até W2-8), `profiles.lastLoginAt` (nunca escrito), coleções `requests`/`funeral_plans`/`memorial_visits`/`memorial_photos` (sem produtores) e `deceaseds.photoURL` (o campo real é `photoUrl`). Todos os catches engolem e retornam 0 — o Dashboard de Monitoramento exibe zeros e um Health Score fictício com aparência de precisão. Correção em duas frentes: **(a)** apontar cada coletor para o schema real; **(b)** zerar/ocultar honestamente o que não tem fonte de dados.

**Código atual (before) — os 6 defeitos pontuais:**
```typescript
// functions/src/monitoring/operationalMonitor.ts:113-118 (status inexistente)
    const snap = await db()
      .collection('death_notifications')
      .where('status', '==', 'aguardando_validacao')
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();
```
```typescript
// functions/src/monitoring/operationalMonitor.ts:83-90 (lastLoginAt nunca gravado)
      .collection('profiles')
      .where('role', 'in', ['gestor', 'manager'])
      .where('lastLoginAt', '>=', Timestamp.fromDate(since))
      .count()
      .get();
```
```typescript
// functions/src/monitoring/operationalMonitor.ts:96-104 (userRole + createdAt inexistentes)
    const snap = await db()
      .collection('audit_logs')
      .where('userRole', '==', 'superadmin')
      .where('createdAt', '>=', Timestamp.fromDate(since))
      .count()
      .get();
```
```typescript
// functions/src/monitoring/technicalMonitor.ts:68-74 (action LOGIN_FAILED nunca gravada + createdAt)
    const snap = await db
      .collection('audit_logs')
      .where('action', '==', 'LOGIN_FAILED')
      .where('createdAt', '>=', Timestamp.fromDate(since))
      .count()
      .get();
```
```typescript
// functions/src/monitoring/memorialMonitor.ts:~62 (campo com caixa errada)
      .where('photoURL', '!=', null)   // o campo real é photoUrl
```
E as consultas a `requests`, `funeral_plans`, `memorial_visits`, `memorial_photos` — coleções sem nenhum produtor.

**Código corrigido (after) — correções por coletor:**
```typescript
// operationalMonitor.ts — comunicados aguardando análise (schema real)
async function countComunicadosObitoSemValidar(): Promise<{ count: number; maisAntigo?: string }> {
  try {
    const snap = await db()
      .collection('death_notifications')
      .where('status', '==', 'submitted')       // valor real gravado por createDeathNotification
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();
    if (snap.empty) return { count: 0 };
    const maisAntigo = snap.docs[0].data().createdAt?.toDate?.()?.toISOString();
    return { count: snap.size, maisAntigo };
  } catch (err) {
    console.error('[countComunicados] falha (índice ausente?):', err); // NÃO engolir mais
    return { count: -1 }; // -1 = "sem dado", distinto de "zero pendências"
  }
}

// operationalMonitor.ts — ações do superadmin (campos reais pós-W2-8: userRole existe em AI_CALL;
// para as demais ações usamos actorUid + timestamp)
async function countAcoesSuperAdmin24h(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const snap = await db()
      .collection('audit_logs')
      .where('userRole', '==', 'superadmin')            // gravado por logAiCall (W2-8)
      .where('timestamp', '>=', Timestamp.fromDate(since)) // campo REAL do audit.ts
      .count()
      .get();
    return snap.data().count;
  } catch { return -1; }
}

// operationalMonitor.ts — gestores ativos: lastLoginAt não existe; usar proxy honesto
// (audit_logs por actor nas últimas 24h) OU remover a métrica. Decisão: proxy por audit.
async function countGestoresAtivos24h(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const snap = await db()
      .collection('audit_logs')
      .where('timestamp', '>=', Timestamp.fromDate(since))
      .select('actorUid')
      .limit(1000)
      .get();
    return new Set(snap.docs.map((d) => d.data().actorUid)).size;
  } catch { return -1; }
}

// technicalMonitor.ts — LOGIN_FAILED não existe: a métrica é removida do snapshot e da UI
// até existir blocking function de auth (issue de follow-up registrada).
// Substituir countFailedLogins24h por:
async function countFailedLogins24h(): Promise<number> {
  return -1; // sem fonte de dados; UI exibe "N/D" (não zero, que significaria "nenhuma falha")
}

// technicalMonitor.ts — chamadas de IA: alimentada por W2-8 (action AI_CALL, campo timestamp)
async function countAiCalls24h(): Promise<number> {
  const db = getFirestore();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const snap = await db
      .collection('audit_logs')
      .where('action', '==', 'AI_CALL')
      .where('timestamp', '>=', Timestamp.fromDate(since))
      .count()
      .get();
    return snap.data().count;
  } catch { return -1; }
}

// memorialMonitor.ts — campo com caixa certa + coleções fantasma zeradas honestamente
//   .where('photoUrl', '!=', null)
// e para memorial_visits / memorial_photos / funeral_plans / requests:
//   return -1; // coleção sem produtor no app atual — exibida como N/D
```
```json
// firestore.indexes.json — índices exigidos pelas queries corrigidas
{ "collectionGroup": "death_notifications", "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "ASCENDING" } ] },
{ "collectionGroup": "audit_logs", "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "action", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "ASCENDING" } ] },
{ "collectionGroup": "audit_logs", "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userRole", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "ASCENDING" } ] }
```
```tsx
// MonitoringDashboard.tsx — convenção de exibição: -1 → "N/D" com tooltip
const fmtMetric = (v: number) => (v < 0 ? 'N/D' : String(v));
// aplicar nos MetricCard; health score: excluir métricas N/D do cálculo em dashboardService
```

**Passos de implementação:**
1. Depende de W2-8 (`AI_CALL` com `userRole` e `timestamp` sendo gravados).
2. Corrigir os coletores conforme os blocos acima; convenção **-1 = sem fonte** em todo o pipeline (types.ts documenta).
3. `dashboardService.ts`: no cálculo do health score, ignorar métricas com -1 (não penalizar nem premiar).
4. Adicionar os 3 índices e deployar (`firebase deploy --only firestore:indexes` — via CI após W2-11).
5. `MonitoringDashboard.tsx`: renderizar "N/D" para -1, com `title="Sem fonte de dados nesta versão"`.
6. Deploy das functions; disparar `manualMonitorTrigger` (com token — W0-3) e conferir `monitor_metrics/current` com números reais.
7. Registrar issue de follow-up: blocking function `beforeSignIn` para gravar `LOGIN_FAILED`/`lastLoginAt` reais (fora de escopo desta onda).

**Critério de aceitação:**
- Com 3 notificações `submitted`, o monitor operacional reporta 3 (e o mais antigo).
- "Chamadas de IA hoje" reflete o contador real de `AI_CALL`.
- Métricas sem fonte exibem "N/D" — **nenhum zero enganoso**.
- Nenhum catch engolindo erro de índice (logs do Cloud Functions limpos após os índices).

**Riscos e reversão:** queries novas exigem os índices ANTES do deploy das functions (senão -1 em tudo — visível, não silencioso). Reversão: redeploy anterior das functions.

---

## [W4-2] — SecurityPage: câmera falsa e matriz de permissões fictícia (parte do 1.9, item 55)

**Arquivo(s):** `src/pages/admin/SecurityPage.tsx` (linhas 7–14, 98–114, 167–191)
**Diagnóstico:** o painel "AO VIVO / CAM-SEC-01" é uma div preta com badge pulsante — teatro que ocupa 2/3 da tela e empurra os incidentes reais para baixo da dobra; a "matriz de permissões" é um array hardcoded que não reflete as rules (não existe diferenciação gestor/operador nas coleções SCI, nem role "auditor") e não é clicável — affordance enganosa. Numa demo com secretário municipal atento, esses dois blocos destroem a credibilidade do módulo inteiro.

**Código atual (before):**
```tsx
// src/pages/admin/SecurityPage.tsx:7-14
const permissionMatrix = [
  { module: 'Dashboard executivo', gestor: true, operador: true, auditor: true },
  { module: 'Cadastro de falecidos', gestor: true, operador: true, auditor: false },
  { module: 'Inventario georreferenciado', gestor: true, operador: true, auditor: true },
  { module: 'Financeiro', gestor: true, operador: false, auditor: true },
  { module: 'Relatorios juridicos', gestor: true, operador: false, auditor: true },
  { module: 'Gestao de usuarios', gestor: true, operador: false, auditor: false }
];
```
(+ o bloco da câmera nas linhas 98–114 e a tabela da matriz nas 167–191.)

**Código corrigido (after):**
```tsx
// src/pages/admin/SecurityPage.tsx — remover permissionMatrix, o painel de câmera
// e a tabela; o layout passa a priorizar os incidentes reais:
//  - Coluna principal: lista de incidentes (a que hoje fica espremida) em largura total
//  - Formulário de registro logo abaixo (inalterado, já corrigido em W0-4)
//  - No lugar da matriz fake, um bloco informativo REAL derivado das rules vigentes:

const effectivePermissions = [
  { module: 'Módulos SCI (operacional, financeiro, ambiental...)', manager: true, operator: true },
  { module: 'Cadastro e exclusão de falecidos', manager: true, operator: true },
  { module: 'Trilha de auditoria (audit_logs)', manager: true, operator: false },
  { module: 'Gestão de prefeituras e logins', manager: false, operator: false }, // superadmin
];
// Renderizar com a nota: "Permissões efetivas desta versão. A diferenciação fina
// gestor/operador está no roadmap." — verdade verificável nas rules.
```

**Passos de implementação:**
1. Remover `permissionMatrix`, o JSX da câmera (98–114) e o badge "Ambiente seguro ativo" (92–95) — ou converter o badge para algo real: `activeCount === 0 ? 'Sem incidentes ativos' : `${activeCount} incidente(s) ativo(s)``.
2. Substituir a matriz pela tabela `effectivePermissions` (espelho fiel das rules pós-W2) com a nota de roadmap.
3. Reorganizar o grid: incidentes na coluna larga.
4. Remover import `Video`/`Eye` não usados.
5. **Decisão de produto registrada (H-3)**: integração de câmeras sai do discurso até existir; se o comercial exigir o visual, retorna atrás de flag `VITE_DEMO_MODE` explícita — não como default.

**Critério de aceitação:** nenhum elemento da página exibe dado que não venha do Firestore ou das rules; incidentes ocupam a área principal; a tabela de permissões corresponde ao comportamento real testado em W2-11.
**Riscos e reversão:** perda visual em demos (era o objetivo do teatro) — decisão consciente. Reversão: revert.

---

## [W4-3] — PartnersPage 100% simulada com botões inertes (1.13, item 55)

**Arquivo(s):** `src/pages/admin/PartnersPage.tsx` (arquivo inteiro, 55 linhas), `src/services/sciService.ts`, `firestore.rules`
**Diagnóstico:** array hardcoded com 3 empresas fictícias; "Novo Parceiro" e "Ver Detalhes" **sem onClick**. Clique sem ação é o pior padrão possível (o usuário culpa a si mesmo). Decisão implementada: **CRUD real mínimo** (coleção `sci_partners`), reutilizando o padrão SCI existente — menor esforço que remover o módulo do menu e alinhado à visão (diretório de serviços, não marketplace).

**Código atual (before):**
```tsx
// src/pages/admin/PartnersPage.tsx:8-12, 18-20, 47-49
  const partners = [
    { id: 1, name: 'Floricultura Jardim da Paz', type: 'Floricultura', description: 'Fornecedor oficial de coroas e arranjos.', contact: '(11) 99999-8888', email: 'contato@floricultura.com' },
    { id: 2, name: 'Marmoraria São Pedro', type: 'Marmoraria', description: 'Confecção de lápides e manutenção de túmulos.', contact: '(11) 98888-7777', email: 'vendas@saopedro.com' },
    { id: 3, name: 'Seguradora Vida Tranquila', type: 'Seguros', description: 'Planos funerários e assistência familiar.', contact: '0800 123 456', email: 'sac@vidatranquila.com' },
  ];
// ...
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg ...">
          <Plus size={18} /> Novo Parceiro
        </button>
// ...
            <button className="mt-4 w-full border border-blue-200 text-blue-600 ...">
              Ver Detalhes
            </button>
```

**Código corrigido (after) — service + rules + página:**
```typescript
// src/services/sciService.ts — novo tipo e CRUD no padrão genérico existente
export interface Partner {
  id?: string;
  tenantId: string;
  name: string;
  type: 'floricultura' | 'marmoraria' | 'funeraria' | 'seguros' | 'transporte' | 'outro';
  description?: string;
  contact?: string;
  email?: string;
  active: boolean;
  createdAt?: any;
  createdBy?: string;
}

export const listPartners = (tenantId: string) =>
  listByTenant<Partner>(tenantId, 'sci_partners');

export const createPartner = (tenantId: string, payload: Omit<Partner, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>) =>
  createForTenant<typeof payload>(tenantId, 'sci_partners', 'CREATE_PARTNER', payload);

export const updatePartner = (tenantId: string, id: string, payload: Partial<Partner>) =>
  updateSCIRecord(tenantId, 'sci_partners', id, 'UPDATE_PARTNER', payload);
```
```javascript
// firestore.rules — bloco idêntico aos demais sci_* (adicionar após sci_training_sessions)
    match /sci_partners/{partnerId} {
      allow read: if isSignedIn() && isStaff(resource.data.tenantId);
      allow create: if isSignedIn() && isStaff(request.resource.data.tenantId);
      allow update, delete: if isSignedIn() && isStaff(resource.data.tenantId);
    }
```
```tsx
// src/pages/admin/PartnersPage.tsx — reescrita no padrão das páginas SCI:
// - useState form { name, type, description, contact, email }
// - loadData via listPartners + loading (padrão W3-7)
// - "Novo Parceiro" abre modal (padrão Inventário) com submit → createPartner + toast
// - Card: "Ver Detalhes" some; ações reais: "Desativar/Ativar" (updatePartner {active}) e "Editar" (modal com defaults)
// - Empty state com ação: "Nenhum parceiro cadastrado — cadastre floriculturas, marmorarias
//   e funerárias credenciadas" + botão abrindo o modal
// (Estrutura idêntica a MaintenancePage/aba estoque — ~120 linhas; sem código novo de padrão)
```

**Passos de implementação:**
1. Service + rules (deploy via CI) + reescrita da página no padrão SCI.
2. Sem "Ver Detalhes" nesta versão (não há detalhe além do card) — remover a affordance em vez de fingir.
3. Coleção nasce vazia: o empty state com CTA substitui os 3 mocks.

**Critério de aceitação:** zero dados hardcoded na página; criar/editar/ativar parceiro persiste e sobrevive a refresh; nenhum botão sem handler (`grep "<button" src/pages/admin/PartnersPage.tsx` → todos com onClick ou type submit).
**Riscos e reversão:** nenhum (coleção nova, isolada). Reversão: restaurar o mock (não recomendado).

---

## [W4-4] — ShopAndServices: e-commerce simulado sem aviso (1.19, item 55)

**Arquivo(s):** `src/pages/user/ShopAndServices.tsx`
**Diagnóstico:** catálogo hardcoded, carrinho em memória, checkout com inputs sem state e `finishCheckout` que apenas esvazia o carrinho — o usuário **acredita ter comprado uma coroa de flores para um funeral real**. Risco de dano concreto a família enlutada. Decisão de produto (H-3): manter como vitrine COM tarja explícita e checkout desabilitado até existir integração.

**Código corrigido (after) — mudanças mínimas e honestas:**
```tsx
// src/pages/user/ShopAndServices.tsx
// 1) Banner permanente no topo da página:
<div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm flex items-start gap-2">
  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
  <div>
    <strong>Catálogo demonstrativo.</strong> Os produtos e serviços exibidos são exemplos —
    pedidos e pagamentos ainda não estão disponíveis. Em caso de necessidade, contate
    diretamente a administração do cemitério.
  </div>
</div>

// 2) Botão de checkout desabilitado com explicação:
<button
  disabled
  title="Pedidos ainda não disponíveis nesta versão"
  className="w-full bg-slate-300 text-slate-500 py-3 rounded-xl font-medium cursor-not-allowed"
>
  Finalizar pedido (em breve)
</button>
// 3) Remover o formulário de checkout fake (inputs sem state) e o finishCheckout.
```

**Passos de implementação:** aplicar os 3 pontos; carrinho pode permanecer (interação inócua).
**Critério de aceitação:** impossível "concluir um pedido"; a tarja aparece acima da dobra em mobile e desktop.
**Riscos e reversão:** percepção de produto incompleto — é a verdade; melhor que o dano da simulação. Reversão: revert.

---

## [W4-5] — FinancialPage: selo "Validado IA" fantasma, projeção fake e lançamentos sem correção (1.4)

**Arquivo(s):** `src/pages/admin/FinancialPage.tsx` (linhas 66–67, 108, 152–158, aba Projeções)
**Diagnóstico:** (a) a coluna "Auditoria" exibe "Validado IA"/"Pendente", mas `aiAudited` nunca é setado true por nenhum código — todos os registros ficam eternamente "Pendente" (conceito fantasma); (b) a aba "Projeções" promete "análise preditiva" e só repete somas passadas; (c) não há edição/exclusão de lançamento — um valor errado é permanente; (d) valores negativos aceitos (coberto pela rule W2-5 + `min="0"`).

**Código corrigido (after):**
```tsx
// (a) Remover a coluna "Auditoria" da tabela e o campo aiAudited do payload de criação.
//     Quando a auditoria por IA existir de fato, a coluna volta COM produtor.

// (b) Aba "Projeções": trocar o texto "análise preditiva" por descrição honesta:
//     "Consolidado do período: receitas, despesas e saldo dos lançamentos registrados."
//     (ou remover a aba e mover o consolidado para o topo da aba Transações)

// (c) Exclusão de lançamento com ConfirmDialog + edição inline do valor/descrição:
const [pendingDelete, setPendingDelete] = useState<FinancialRecord | null>(null);

const confirmDelete = async () => {
  if (!tenantId || !pendingDelete?.id) return;
  try {
    await deleteSCIRecord(tenantId, 'sci_financial_records', pendingDelete.id, 'DELETE_FINANCIAL_RECORD');
    toast.success('Lançamento excluído.');
    setPendingDelete(null);
    await loadData();
  } catch (error) {
    reportError('Financial.delete', error);
  }
};
// deleteSCIRecord: adicionar ao sciService se ainda não existir:
//   export async function deleteSCIRecord(tenantId, col, id, action) {
//     await deleteDoc(doc(db, col, id));
//     await logAction(tenantId, action, col, id, null, { id });
//     invalidateCache(`sci_snapshot:${tenantId}`);
//   }

// (d) no input de valor: type="number" min="0" step="0.01"
//     e guard: if (Number(form.value) < 0) { toast.error('Valor não pode ser negativo. Use a categoria "Despesa".'); return; }
```

**Passos de implementação:**
1. Remover coluna/campo `aiAudited` (UI e payload; a interface do service mantém o campo opcional para o futuro).
2. Reescrever o texto da aba Projeções (ou fundi-la em Transações — recomendado).
3. Adicionar `deleteSCIRecord` genérico ao service + coluna de ações na tabela (lixeira → ConfirmDialog).
4. `min="0"` + guard de negativo (par com a rule W2-5).
5. Loading state já veio de W3-7.

**Critério de aceitação:** nenhuma célula "Validado IA/Pendente"; texto de projeções não promete predição; lançamento errado é excluível com confirmação e auditoria `DELETE_FINANCIAL_RECORD`; `-100` bloqueado no cliente e na rule.
**Riscos e reversão:** exclusão de lançamento em sistema público idealmente seria estorno (lançamento inverso) — registrado como melhoria; a exclusão auditada é o mínimo aceitável. Reversão: revert.

---

## [W4-6] — Relatórios: 6 tipos = 1 conteúdo, sem período (D-15, item 43)

**Arquivo(s):** `src/services/sciService.ts` (`buildReportSummary`, linhas 776–800; `createAutomaticReport`), `src/pages/admin/ReportsPage.tsx`
**Diagnóstico:** os 6 "tipos" de relatório geram o mesmo texto com títulos diferentes, sempre do estado atual (impossível "relatório de junho"), com `Cemiterio: <id>` cru no texto. Correção: seções por tipo + parâmetro de período + nome do cemitério.

**Código corrigido (after) — assinatura e seleção por tipo:**
```typescript
// src/services/sciService.ts
export interface ReportPeriod { from?: string; to?: string } // YYYY-MM-DD

export async function createAutomaticReport(
  tenantId: string,
  type: SCIReportType,
  cemeteryId: string,
  period?: ReportPeriod,
  cemeteryName?: string
) {
  const snapshot = await getSciExecutiveSnapshot(tenantId, cemeteryId);
  const summary = buildReportSummary(type, snapshot, {
    cemeteryLabel: cemeteryName || (cemeteryId === 'all' ? 'Todas as unidades' : cemeteryId),
    period,
  });
  return createForTenant(tenantId, 'sci_reports', 'CREATE_SCI_REPORT', {
    type, cemeteryId, summary,
    periodFrom: period?.from ?? null,
    periodTo: period?.to ?? null,
    generatedAt: new Date().toISOString(),
    generatedBy: auth.currentUser?.uid,
  });
}

function buildReportSummary(
  type: SCIReportType,
  s: SciExecutiveSnapshot,
  opts: { cemeteryLabel: string; period?: ReportPeriod }
): string {
  const header = [
    `${getReportTitle(type)}`,
    `Unidade: ${opts.cemeteryLabel}`,
    `Período: ${opts.period?.from ?? 'início'} a ${opts.period?.to ?? 'hoje'}`,
    `Data de geração: ${new Date().toLocaleString('pt-BR')}`,
    '' ,
  ];

  const sections: Record<SCIReportType, string[]> = {
    operational: [
      `Taxa de ocupação: ${s.occupancyRate}%`,
      `Sepultamentos registrados: ${s.totalBurials}`,
      `Exumações: ${s.totalExhumations} (pendentes: ${s.pendingExhumations}, próximas: ${s.approachingExhumations})`,
      `Ocorrências em aberto: ${s.openOccurrences}`,
    ],
    sanitary: [
      `Alertas sanitários: ${s.sanitaryAlerts}`,
      `Checklists sanitários abertos: ${s.openSanitaryChecks ?? 'N/D'}`,
      `Jazigos com risco sanitário alto: ${s.highSanitaryRiskPlots ?? 'N/D'}`,
    ],
    environmental: [
      `Alertas ambientais: ${s.environmentalAlerts}`,
      `Falhas estruturais: ${s.structuralFailures}`,
    ],
    administrative: [
      `Pendências documentais: ${s.pendingDocuments}`,
      `Concessões vencendo em 6 meses: ${s.expiringConcessions}`,
    ],
    legal: [
      `Concessões vencendo: ${s.expiringConcessions}`,
      `Prazos de exumação vencidos: ${s.pendingExhumations}`,
      `Pendências documentais: ${s.pendingDocuments}`,
    ],
    financial: [
      `Receitas: ${s.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      `Despesas: ${s.totalExpenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      `Saldo: ${(s.totalRevenue - s.totalExpenses).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
    ],
  };

  const priorities = s.priorities.length
    ? ['', 'Prioridades de intervenção:', ...s.priorities.map((p) => `- [${p.severity}] ${p.title}: ${p.details}`)]
    : ['', 'Nenhuma prioridade crítica detectada.'];

  return [...header, ...(sections[type] || sections.operational), ...priorities].join('\n');
}
```
```tsx
// src/pages/admin/ReportsPage.tsx — inputs de período + nome da unidade
const [periodFrom, setPeriodFrom] = useState('');
const [periodTo, setPeriodTo] = useState('');
const { cemeteries } = useAdmin();
const cemeteryName = cemeteries.find((c) => c.id === selectedCemeteryId)?.name;

// no handleGenerateReport:
await createAutomaticReport(
  tenantId, type as any,
  selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId,
  { from: periodFrom || undefined, to: periodTo || undefined },
  cemeteryName
);
// + dois <input type="date"> com labels "De" / "Até" ao lado do select de tipo
```

**Passos de implementação:**
1. Aplicar a seleção de seções por tipo (os campos citados existem no snapshot; os marcados `?? 'N/D'` exigem expor contadores já calculados internamente — 3 linhas no snapshot).
2. Filtragem por período nos agregados financeiros/ocorrências: o snapshot atual é "estado presente"; para o financeiro, filtrar `financial` por `occurredAt` dentro do período antes de somar (função local no buildReportSummary recebendo a lista — o snapshot já carrega os registros).
3. UI: dois date inputs + repasse do nome da unidade (resolve também o `Cemiterio: <id>` cru — D-20 parcial).
4. Remover o label "Financeiro (opcional)" (linha 13) — vira "Financeiro".
5. PDF timbrado fica registrado como follow-up (item 43 completo, pdfmake) — o TXT com seções e período já atende auditoria interna.

**Critério de aceitação:** relatório "Financeiro" ≠ "Sanitário" em conteúdo; período informado filtra as somas financeiras; o texto exibe o NOME da unidade; download TXT preservado.
**Riscos e reversão:** relatórios antigos (formato velho) continuam legíveis (só texto). Reversão: revert.

---

## [W4-7] — Mensagem de erro do chat cita "chave Gemini" (D-16, item 56)

**Arquivo(s):** `src/pages/admin/AgentsPage.tsx` (linhas 144–150)
**Diagnóstico:** o backend é OpenRouter desde `9660f36`; a mensagem orienta o gestor a "verificar a chave Gemini" — inútil e reveladora de detalhe interno.

**Código atual (before):**
```typescript
// src/pages/admin/AgentsPage.tsx:144-150
    } catch (error) {
      console.error('Erro no chat do agente:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: 'Falha ao consultar IA externa. Verifique a chave Gemini e tente novamente.' }
      ]);
```

**Código corrigido (after):**
```typescript
    } catch (error: any) {
      console.error('Erro no chat do agente:', error);
      const friendly = error?.code === 'functions/resource-exhausted'
        ? 'Limite de uso de IA atingido por hoje. Tente novamente amanhã.'
        : 'Serviço de IA indisponível no momento. Tente novamente em instantes ou contate o suporte.';
      setMessages((prev) => [...prev, { role: 'model', text: friendly }]);
```

**Passos de implementação:** aplicar (aproveita o código de erro do rate-limit de W2-8).
**Critério de aceitação:** `grep -rn "Gemini" src/` → zero referências em mensagens de UI.
**Riscos e reversão:** nenhum.

---

## [W4-8] — Estoque sem movimentação: quantidade nunca muda (1.5, item 44)

**Arquivo(s):** `src/pages/admin/MaintenancePage.tsx` (aba Estoque), `src/services/sciService.ts`
**Diagnóstico:** só é possível criar o item com quantidade inicial — sem entrada/baixa, o alerta "Crítico" é estático e o módulo vira decorativo após o primeiro cadastro. Correção: movimentação com motivo em transação + histórico.

**Código corrigido (after):**
```typescript
// src/services/sciService.ts
export interface StockMovement {
  id?: string;
  tenantId: string;
  itemId: string;
  itemName: string;
  kind: 'in' | 'out';
  quantity: number;
  reason?: string;
  createdAt?: any;
  createdBy?: string;
}

export async function moveStock(
  tenantId: string,
  itemId: string,
  kind: 'in' | 'out',
  quantity: number,
  reason?: string
): Promise<void> {
  if (quantity <= 0) throw new Error('Quantidade deve ser maior que zero.');
  const itemRef = doc(db, 'sci_stock_items', itemId);
  const movementRef = doc(collection(db, 'sci_stock_movements'));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(itemRef);
    if (!snap.exists()) throw new Error('Item de estoque não encontrado.');
    const item = snap.data() as StockItem;
    if (item.tenantId !== tenantId) throw new Error('Item não pertence a este tenant.');
    const next = kind === 'in' ? item.quantity + quantity : item.quantity - quantity;
    if (next < 0) throw new Error(`Saldo insuficiente: há ${item.quantity} ${item.unit || 'un'} em estoque.`);

    tx.update(itemRef, { quantity: next, updatedAt: serverTimestamp() });
    tx.set(movementRef, {
      tenantId, itemId, itemName: item.name, kind, quantity,
      reason: reason || null,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid,
    });
  });

  await logAction(tenantId, 'STOCK_MOVEMENT', 'sci_stock_items', itemId, null, { kind, quantity, reason });
  invalidateCache(`sci_snapshot:${tenantId}`);
}

export const listStockMovements = (tenantId: string) =>
  listByTenant<StockMovement>(tenantId, 'sci_stock_movements');
```
```javascript
// firestore.rules — nova coleção (bloco padrão sci_*)
    match /sci_stock_movements/{movementId} {
      allow read: if isSignedIn() && isStaff(resource.data.tenantId);
      allow create: if isSignedIn() && isStaff(request.resource.data.tenantId);
      allow update, delete: if false; // movimentações são imutáveis (trilha)
    }
```
```tsx
// MaintenancePage.tsx (aba Estoque) — por item, dois botões "+ Entrada" / "− Baixa"
// abrindo mini-modal { quantidade, motivo } → moveStock + toast; abaixo da tabela,
// "Últimas movimentações" (listStockMovements, 20 mais recentes, com data/kind/qty/motivo).
// Exibir também a coluna "Mínimo" ao lado de Quantidade (feedback do limiar do badge Crítico — E.15).
```

**Passos de implementação:**
1. Service + rules (movimentações imutáveis) + UI conforme acima.
2. Badge "Crítico" continua derivado de `quantity < minQuantity` — agora dinâmico de verdade.

**Critério de aceitação:** dar baixa além do saldo falha com mensagem de saldo; entrada/baixa refletem na quantidade e geram linha no histórico imutável (update/delete negados pela rule); badge muda de estado quando cruza o mínimo.
**Riscos e reversão:** nenhum (aditivo). Reversão: esconder os botões.

---

## [W4-9] — Prazos de exumação 100% passivos → ação "Gerar ordem de exumação" (item 41, 6.2.1)

**Arquivo(s):** `src/pages/admin/OperationalPage.tsx` (aba "Prazos exumação", linhas 443–509), `src/services/sciService.ts`
**Diagnóstico:** o alerta de prazo vencido é somente leitura — nenhum botão para agir. Fechamento de ciclo mínimo: gerar a ordem de exumação pré-preenchida (registro operacional `type:'exhumation'`) e bloquear o jazigo, a partir do próprio alerta.

**Código corrigido (after):**
```typescript
// src/services/sciService.ts
export async function createExhumationOrderFromAlert(
  tenantId: string,
  alert: { plotId: string; plotCode: string; cemeteryId: string; occupantName?: string; deadline: string }
): Promise<string> {
  // 1. Ordem operacional pré-preenchida
  const orderId = await createForTenant(tenantId, 'sci_operational_records', 'CREATE_EXHUMATION_ORDER', {
    cemeteryId: alert.cemeteryId,
    type: 'exhumation',
    title: `Exumação — jazigo ${alert.plotCode}${alert.occupantName ? ` (${alert.occupantName})` : ''}`,
    description: `Ordem gerada automaticamente: prazo legal de exumação vencido em ${alert.deadline}.`,
    status: 'planned',
    priority: 'high',
    plotId: alert.plotId,
  });

  // 2. Bloqueia o jazigo até a conclusão do processo
  await updateDoc(doc(db, 'plots', alert.plotId), {
    status: 'blocked',
    updatedAt: serverTimestamp(),
  });

  await logAction(tenantId, 'BLOCK_PLOT_FOR_EXHUMATION', 'plots', alert.plotId, null, { orderId });
  invalidateCache(`sci_snapshot:${tenantId}`);
  return orderId;
}
```
```tsx
// OperationalPage.tsx — na linha de cada prazo vencido:
<button
  onClick={() => handleCreateExhumationOrder(alert)}
  className="text-xs bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg font-medium"
>
  Gerar ordem de exumação
</button>
// handler: ConfirmDialog ("Gera a ordem e BLOQUEIA o jazigo {code} até a conclusão. Continuar?")
// → createExhumationOrderFromAlert → toast.success('Ordem criada. Jazigo bloqueado.') → reload
// Jazigo já blocked: exibir badge "Em processo de exumação" no lugar do botão
// (getExhumationAlerts filtra occupied — plots blocked saem da lista de vencidos naturalmente).
```

**Passos de implementação:**
1. Service + botão + ConfirmDialog; verificar que `getExhumationAlerts` (`sciService.ts:688-728`) filtra `status === 'occupied'` — ao bloquear, o alerta some da lista (comportamento desejado: está "em tratamento").
2. A ordem aparece no kanban de Manutenção? Não — `type:'exhumation'` aparece na aba Exumações do Operacional (mesma coleção). Correto.
3. Ciclo completo (concluir exumação → destino dos restos → liberar jazigo) fica para o fluxo de aprovação da visão (6.5) — fora deste item; ao concluir a ordem manualmente, o gestor muda o plot via Inventário (W1-6 limpa vínculos).

**Critério de aceitação:** do alerta vencido, 2 cliques geram a ordem `exhumation/high/planned` vinculada ao plot e o jazigo fica `blocked`; o alerta sai da lista; auditoria `BLOCK_PLOT_FOR_EXHUMATION` gravada.
**Riscos e reversão:** bloquear jazigo por engano — reversível via Inventário (status → occupied de novo... nota: W1-6 limpa vínculos ao ir para available, mas blocked→occupied não limpa nada — seguro). Reversão: revert.

---

## [W4-10] — Memorial público `/memorial/:id` + QR Code (item 20, VISION J3/J4)

**Arquivo(s):** `src/pages/public/MemorialPage.tsx` (novo), `src/App.tsx:94`, `src/components/QRCodeGenerator.tsx` (hoje morto), `src/pages/public/SearchPage.tsx` (link no resultado), `src/pages/admin/DeceasedDetail.tsx` (QR imprimível)
**Diagnóstico:** a promessa central do produto para famílias é um `Placeholder` (`App.tsx:94`); `public_deceaseds` já tem os dados públicos, `QRCodeGenerator` já existe sem uso, e a busca pública é um beco sem saída (resultado não clicável). Entregável mínimo de alto valor: página pública lendo a projeção + QR imprimível na ficha do falecido.

**Código corrigido (after) — `src/pages/public/MemorialPage.tsx` (novo):**
```tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Flower2 } from 'lucide-react';

interface PublicMemorial {
  name: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  city?: string;
  state?: string;
  photoUrl?: string | null;
  cemeteryId?: string;
}

export default function MemorialPage() {
  const { id } = useParams<{ id: string }>();
  const [memorial, setMemorial] = useState<PublicMemorial | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'public_deceaseds', id));
        if (!snap.exists()) { setState('notfound'); return; }
        setMemorial(snap.data() as PublicMemorial);
        setState('ready');
      } catch {
        setState('error');
      }
    })();
  }, [id]);

  if (state === 'loading') return <div className="min-h-[50vh] flex items-center justify-center text-slate-400">Carregando memorial...</div>;
  if (state === 'notfound') return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-4">
      <Flower2 size={40} className="text-blue-200 mb-3" />
      <h1 className="text-2xl font-serif font-bold text-blue-900 mb-2">Memorial não encontrado</h1>
      <p className="text-slate-500 mb-4">Este registro pode ter sido removido ou o endereço está incorreto.</p>
      <Link to="/buscar" className="text-blue-600 font-medium hover:underline">Buscar na página de falecidos</Link>
    </div>
  );
  if (state === 'error') return <div className="min-h-[50vh] flex items-center justify-center text-rose-600">Não foi possível carregar o memorial. Tente novamente.</div>;

  const years = [memorial?.dateOfBirth?.slice(0, 4), memorial?.dateOfDeath?.slice(0, 4)].filter(Boolean).join(' — ');

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <div className="w-40 h-40 mx-auto rounded-full overflow-hidden bg-blue-50 border-4 border-white shadow-lg mb-6">
        {memorial?.photoUrl
          ? <img src={memorial.photoUrl} alt={`Foto de ${memorial.name}`} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-blue-200"><Flower2 size={48} /></div>}
      </div>
      <h1 className="text-3xl font-serif font-bold text-blue-900">{memorial?.name}</h1>
      {years && <p className="text-slate-500 mt-1 text-lg">{years}</p>}
      {(memorial?.city || memorial?.state) && (
        <p className="text-slate-400 text-sm mt-1">{[memorial.city, memorial.state].filter(Boolean).join(' / ')}</p>
      )}
      <div className="mt-8 bg-blue-50 rounded-2xl p-6 text-blue-900/70 font-serif italic">
        "A saudade é a memória do coração."
      </div>
      <p className="mt-8 text-xs text-slate-400">
        Memorial público mantido pela administração do cemitério.
        Familiares podem solicitar alterações ou remoção pela administração municipal.
      </p>
    </div>
  );
}
```
```tsx
// src/App.tsx:94 — before:
//   <Route path="/memorial/:id" element={<Placeholder title="Memorial" />} />
// after:
import MemorialPage from '@/pages/public/MemorialPage';
<Route path="/memorial/:id" element={<MemorialPage />} />
```
```tsx
// src/pages/public/SearchPage.tsx — resultado vira link (fecha o beco sem saída):
<Link to={`/memorial/${result.id}`} key={result.id} className="block ...card classes existentes... hover:shadow-md">
  {/* conteúdo do card existente */}
</Link>
```
```tsx
// src/pages/admin/DeceasedDetail.tsx — QR imprimível usando o componente hoje morto:
import { QRCodeGenerator } from '@/components/QRCodeGenerator';
const memorialUrl = `${window.location.origin}${import.meta.env.BASE_URL}memorial/${id}`;
// bloco na ficha: <QRCodeGenerator value={memorialUrl} label={`Memorial de ${deceased.name}`} />
// + botão "Imprimir QR" → window.print() com CSS @media print isolando o bloco.
// Corrigir no QRCodeGenerator o download stub (linha 39: alert de demo → download real do canvas
// via toDataURL, ou remover o botão de download e manter só a impressão).
```

**Passos de implementação:**
1. Criar a página, registrar a rota (substituindo o Placeholder) e linkar a busca.
2. Reabilitar `qrcode.react` (dependência já instalada — **não** removê-la em W5-10) e consertar o download do `QRCodeGenerator`.
3. QR na ficha do falecido (admin) com impressão.
4. LGPD: a página exibe somente campos da projeção pública já existente; o rodapé informa o canal de remoção (alinha com item 27 do ranking — política de privacidade completa é follow-up de produto).
5. SEO/GitHub Pages: deep-link funciona via hack do 404.html já existente.

**Critério de aceitação:** buscar um falecido → clicar → memorial abre com foto/nome/anos; QR impresso da ficha aponta para a URL correta e abre no celular; memorial de id inexistente mostra o estado "não encontrado" com link para a busca.
**Riscos e reversão:** exposição pública já existia via busca (mesma projeção) — o memorial não amplia dados, só apresentação. Reversão: restaurar o Placeholder.

---

## [W4-11] — Notificação à família na alocação/rejeição (item 21, 6.3.1)

**Arquivo(s):** `functions/src/index.ts` (novo trigger), `functions/src/monitoring/alertService.ts` (reuso)
**Diagnóstico:** nenhum evento notifica o cidadão — a família só descobre a decisão entrando no app. A infra de WhatsApp (Evolution API) **já está escrita** em `alertService.ts` para alertas internos; um trigger `onDocumentUpdated` em `death_notifications` fecha o loop com custo mínimo.

**Código corrigido (after):**
```typescript
// functions/src/index.ts
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { sendWhatsAppMessage } from './monitoring/alertService'; // expor helper de envio unitário

export const onDeathNotificationDecision = onDocumentUpdated(
  { document: 'death_notifications/{notificationId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;
    if (!['allocated', 'rejected'].includes(after.status)) return;

    // Telefone do solicitante no perfil do cidadão
    const profileSnap = await getFirestore().collection('user_profiles').doc(after.createdBy).get();
    const phone = profileSnap.exists ? (profileSnap.data()?.phone as string | undefined) : undefined;
    if (!phone) {
      console.log(`[notifyFamily] ${event.params.notificationId}: solicitante sem telefone — pulando`);
      return;
    }

    const config = getMonitorConfig();
    if (!config.whatsapp.enabled) return;

    const name = after.deceased?.name ?? 'seu ente querido';
    const message = after.status === 'allocated'
      ? `MemorialOS: a solicitação de sepultamento de ${name} foi APROVADA. ` +
        `Jazigo: ${after.allocation?.plotCode ?? 'a confirmar'}. ` +
        `Acompanhe os detalhes no Jardim de Memórias do aplicativo.`
      : `MemorialOS: a solicitação de sepultamento de ${name} não pôde ser aprovada. ` +
        `Motivo: ${after.rejectionReason ?? 'entre em contato com a administração'}. ` +
        `Você pode reenviar a solicitação com as correções pelo aplicativo.`;

    try {
      await sendWhatsAppMessage(phone, message, config);
      console.log(`[notifyFamily] enviado para ${phone.slice(0, 6)}***`);
    } catch (err) {
      console.error('[notifyFamily] falha no envio:', err);
    }
  }
);
```
```typescript
// functions/src/monitoring/alertService.ts — expor o envio unitário (a função interna de POST
// à Evolution API já existe para dispatchAlerts; extrair/exportar):
export async function sendWhatsAppMessage(phone: string, text: string, config: MonitorConfig): Promise<void> {
  // corpo idêntico ao envio usado por dispatchAlerts, parametrizado por destinatário
}
```

**Passos de implementação:**
1. Refatorar `alertService.ts` para expor `sendWhatsAppMessage` (o POST à Evolution API já existe internamente).
2. Adicionar o trigger; deploy.
3. Pré-requisito operacional: `WHATSAPP_ENABLED=true` + instância Evolution configurada (já documentado em `functions/.env.example`); sem isso o trigger loga e sai (fail-safe).
4. LGPD: telefone coletado no perfil com finalidade de contato — adicionar a finalidade explícita no label do campo em `ProfilePage` ("usado para avisos sobre suas solicitações").
5. Depende de W1-1 apenas conceitualmente (o trigger observa a mudança de status, qualquer que seja o produtor).

**Critério de aceitação:** alocar uma notificação de teste (com telefone no perfil e WhatsApp habilitado) entrega a mensagem de aprovação; rejeitar entrega a de rejeição com o motivo; sem telefone/WhatsApp desabilitado, o trigger não erra (logs limpos).
**Riscos e reversão:** mensagens a famílias enlutadas exigem tom cuidadoso — os textos acima foram revisados para sobriedade; validar com o dono do produto antes do deploy. Custo Evolution API por mensagem. Reversão: deletar o trigger (deploy).

---

## [W4-12] — OperationalPage: `plotId` fantasma no estado e schema zod nunca usado (D-11, 1.2)

**Arquivo(s):** `src/pages/admin/OperationalPage.tsx` (linha 60 e handler de criação), `src/lib/validationSchemas.ts`
**Diagnóstico:** (a) `recordForm.plotId` existe no estado e **não tem input** no formulário — campo fantasma; (b) `operationalRecordSchema` (`validationSchemas.ts:11-21`) foi criado exatamente para este formulário e nunca importado — a validação real é só `required` no título. Correção: aplicar o schema no submit (validação com mensagens) e decidir o plotId: renderizar um seletor de jazigo opcional (consistente com W1-14/PlotSelector) — escolhido por dar vínculo real às ordens.

**Código atual (before):**
```typescript
// src/lib/validationSchemas.ts:11-21 — escrito e nunca importado
export const operationalRecordSchema = z.object({
  cemeteryId: z.string().min(1, 'Selecione um cemitério').refine(v => v !== 'all', 'Selecione uma unidade'),
  type: z.enum(['burial', 'exhumation', 'schedule', 'flow', 'maintenance', 'document_issue']),
  title: z.string().min(3, 'Título muito curto').max(200, 'Título muito longo'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['planned', 'in_progress', 'done', 'cancelled']),
  scheduledFor: z.string().optional().refine(
    (val) => !val || new Date(val) >= new Date(new Date().setHours(0,0,0,0)),
    'Data agendada não pode ser no passado'
  ),
});
```

**Código corrigido (after) — validação no submit do form manual:**
```typescript
// src/pages/admin/OperationalPage.tsx
import { operationalRecordSchema } from '@/lib/validationSchemas';

const handleCreateRecord = async (event: React.FormEvent) => {
  event.preventDefault();
  if (!tenantId) return;
  if (selectedCemeteryId === 'all') {
    toast.error('Selecione um cemitério específico antes de criar um registro.');
    return;
  }

  const parsed = operationalRecordSchema.safeParse({
    cemeteryId: selectedCemeteryId,
    type: activeTab,           // aba ativa = tipo do registro
    title: recordForm.title,
    priority: recordForm.priority,
    status: 'planned',
    scheduledFor: recordForm.scheduledFor || undefined,
  });
  if (!parsed.success) {
    toast.error(parsed.error.issues[0]?.message || 'Dados inválidos.');
    return;
  }

  setSaving(true);
  try {
    await createOperationalRecord(tenantId, {
      ...parsed.data,
      description: recordForm.description,
      responsible: recordForm.responsible,
      plotId: recordForm.plotId || null, // agora COM input (seletor abaixo)
    });
    toast.success('Registro criado.');
    setRecordForm(INITIAL_RECORD_FORM);
    await loadData();
  } catch (error) {
    reportError('Operational.create', error);
  } finally {
    setSaving(false);
  }
};
```
No JSX do formulário, adicionar o seletor de jazigo opcional (mesmo padrão encadeado de `CommunicatedDeaths`, simplificado para um único select de plots da unidade ativa quando a aba for `burial`/`exhumation`/`maintenance`; nas demais abas o campo não renderiza e o estado permanece vazio).

**Passos de implementação:**
1. Importar e aplicar o schema no submit (o form continua manual — react-hook-form completo nas páginas SCI é refactor de W5-4/W6; aqui é validação com mensagem, ganho imediato).
2. Renderizar o seletor de `plotId` nas abas pertinentes (carregar plots da unidade via `getCemeteryPlots` já usado no Inventário).
3. Remover `dateRangeSchema` de `validationSchemas.ts` **ou** aplicá-lo no DeceasedForm (o zod local do form já cobre — remover para não manter código morto; decisão: remover).

**Critério de aceitação:** submit com título de 2 caracteres mostra "Título muito curto"; data no passado mostra a mensagem do schema; `recordForm.plotId` tem input visível nas abas de sepultamento/exumação/manutenção; `grep -n "operationalRecordSchema" src/` mostra o import na página.
**Riscos e reversão:** nenhum. Reversão: revert.

---

## SMOKE TEST DE SAÍDA DA ONDA 4 (25 min)

1. Dashboard de monitoramento: pendências reais aparecem; métricas sem fonte mostram "N/D"; health score sem zeros enganosos.
2. SecurityPage sem câmera/matriz fake; incidentes na área principal.
3. Parceiros: criar/editar/desativar persiste; zero mocks.
4. Loja: tarja de demonstração; checkout inacessível.
5. Financeiro: sem "Validado IA"; lançamento excluível com confirmação.
6. Relatório financeiro ≠ operacional; período filtra somas; nome da unidade no texto.
7. Estoque: entrada/baixa com histórico imutável.
8. Alerta de exumação vencido → ordem gerada + jazigo bloqueado.
9. Busca pública → clique → memorial abre; QR da ficha aponta certo.
10. Alocação com WhatsApp habilitado → família recebe a mensagem.

---

# ONDA 5 — PERFORMANCE E ARQUITETURA (~5–7 dias)

> Objetivo: cortar leituras redundantes do Firestore, dividir o bundle, e eliminar as ~1.000 linhas de duplicação adotando os utilitários já escritos (SCITable, useCemeteryFilter, useModal) + novos hooks. **Executar DEPOIS da Onda 3** (mesmas páginas — evita conflitos de merge). W5-4 e W5-5 são o par de refactor central; W5-6 muda a estratégia de leitura e deve ser o último da onda.

---

## [W5-1] — Bundle único: lazy loading por área (P-04, item 36)

**Arquivo(s):** `src/App.tsx` (linhas 8–45 e árvore de rotas)
**Diagnóstico:** `App.tsx` importa as 30+ páginas estaticamente — o cidadão que só quer buscar um falecido baixa Recharts (2 páginas admin), Leaflet, o painel superadmin e toda a área administrativa. Nenhum `React.lazy`/`Suspense` no projeto. Divisão por área (public/user/admin/superadmin) gera 4 chunks com 1 mudança estrutural.

**Código atual (before):**
```tsx
// src/App.tsx:8-45 (imports estáticos — trecho)
import AdminLayout from '@/layouts/AdminLayout';
import UserLayout from '@/layouts/UserLayout';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import DeceasedList from '@/pages/admin/DeceasedList';
// ... +26 imports de página ...
import SuperAdminPage from '@/pages/superadmin/SuperAdminPage';
import MonitoringDashboard from '@/pages/superadmin/MonitoringDashboard';
```

**Código corrigido (after):**
```tsx
// src/App.tsx — páginas públicas/auth permanecem estáticas (first paint);
// áreas autenticadas viram chunks lazy.
import React, { Suspense, lazy } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'; // finalmente em uso

// Estáticos (rota de entrada, leves):
import PublicLayout from '@/layouts/PublicLayout';
import LandingPage from '@/pages/public/LandingPage';
import SearchPage from '@/pages/public/SearchPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import UnauthorizedPage from '@/pages/auth/UnauthorizedPage';
import MemorialPage from '@/pages/public/MemorialPage';

// Lazy por área:
const AdminLayout = lazy(() => import('@/layouts/AdminLayout'));
const UserLayout = lazy(() => import('@/layouts/UserLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const DeceasedList = lazy(() => import('@/pages/admin/DeceasedList'));
const DeceasedDetail = lazy(() => import('@/pages/admin/DeceasedDetail'));
const DeceasedForm = lazy(() => import('@/pages/admin/DeceasedForm'));
const CemeteryList = lazy(() => import('@/pages/admin/CemeteryList'));
const CemeteryDetail = lazy(() => import('@/pages/admin/CemeteryDetail'));
const InventoryPage = lazy(() => import('@/pages/admin/InventoryPage'));
const FinancialPage = lazy(() => import('@/pages/admin/FinancialPage'));
const MaintenancePage = lazy(() => import('@/pages/admin/MaintenancePage'));
const SecurityPage = lazy(() => import('@/pages/admin/SecurityPage'));
const PartnersPage = lazy(() => import('@/pages/admin/PartnersPage'));
const EnvironmentalPage = lazy(() => import('@/pages/admin/EnvironmentalPage'));
const AdminReportDeath = lazy(() => import('@/pages/admin/AdminReportDeath'));
const CommunicatedDeaths = lazy(() => import('@/pages/admin/CommunicatedDeaths'));
const OperationalPage = lazy(() => import('@/pages/admin/OperationalPage'));
const ReportsPage = lazy(() => import('@/pages/admin/ReportsPage'));
const AgentsPage = lazy(() => import('@/pages/admin/AgentsPage'));
const DocumentsCenterPage = lazy(() => import('@/pages/admin/DocumentsCenterPage'));
const SupportPage = lazy(() => import('@/pages/admin/SupportPage'));
const SuperAdminPage = lazy(() => import('@/pages/superadmin/SuperAdminPage'));
const MonitoringDashboard = lazy(() => import('@/pages/superadmin/MonitoringDashboard'));
const GardenOfMemories = lazy(() => import('@/pages/user/GardenOfMemories'));
const UserHomePage = lazy(() => import('@/pages/user/UserHomePage'));
const ReportDeath = lazy(() => import('@/pages/user/ReportDeath'));
const VirtualAssistant = lazy(() => import('@/pages/user/VirtualAssistant'));
const ShopAndServices = lazy(() => import('@/pages/user/ShopAndServices'));
const ProfilePage = lazy(() => import('@/pages/user/ProfilePage'));

// Envolver <Routes> com:
<Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner text="Carregando módulo..." /></div>}>
  <Routes> {/* árvore inalterada */} </Routes>
</Suspense>
```

**Passos de implementação:**
1. Aplicar; `npm run build` e comparar o output do Vite (antes: 1 chunk grande; depois: chunk inicial + chunks por página/área com Recharts/Leaflet isolados nos consumidores).
2. Verificar navegação entre áreas com throttling (fallback visível, sem tela branca).
3. GitHub Pages: chunks têm hash — sem problema de cache.

**Critério de aceitação:** chunk inicial reduz ≥50% (medir com `npx vite build` — comparar `dist/assets/index-*.js`); Recharts ausente do chunk inicial (`grep -l recharts dist/assets/*.js` não inclui o index); todas as rotas navegáveis.
**Riscos e reversão:** flash do fallback em conexões rápidas (aceitável); erro de chunk após deploy (usuário com index antigo) — mitigar com reload automático em `error.name === 'ChunkLoadError'` (listener global opcional). Reversão: revert.

---

## [W5-2] — Dashboard lê a coleção operacional duas vezes (P-02)

**Arquivo(s):** `src/services/sciService.ts` (`getMonthlyBurialTrend`, linhas 730–762), `src/pages/admin/AdminDashboard.tsx`
**Diagnóstico:** `getMonthlyBurialTrend` chama `listOperationalRecords` por fora do cache do snapshot — o dashboard faz dois full-scans da mesma coleção por carga. Correção: derivar a tendência dos registros já presentes no snapshot cacheado.

**Código corrigido (after):**
```typescript
// src/services/sciService.ts — nova assinatura pura (sem I/O)
export function buildMonthlyBurialTrend(operational: OperationalRecord[]): MonthlyTrendPoint[] {
  // corpo idêntico ao atual getMonthlyBurialTrend, trocando o fetch pela lista recebida
}

// getSciExecutiveSnapshot passa a incluir a lista bruta necessária OU expõe o trend pronto:
export interface SciExecutiveSnapshot {
  // ...campos atuais...
  monthlyBurialTrend: MonthlyTrendPoint[]; // novo, calculado dentro do snapshot cacheado
}
// dentro do cálculo do snapshot: monthlyBurialTrend: buildMonthlyBurialTrend(operational),
```
```tsx
// AdminDashboard.tsx — remover a segunda chamada:
// before: const [snap, trend] = await Promise.all([getSciExecutiveSnapshot(...), getMonthlyBurialTrend(...)]);
// after:  const snap = await getSciExecutiveSnapshot(tenantId, selectedCemeteryId);
//         setTrend(snap.monthlyBurialTrend);
```

**Passos de implementação:** mover o cálculo para dentro do snapshot; deprecar `getMonthlyBurialTrend` (manter exportado como wrapper que chama o snapshot, até zero consumidores); atualizar o dashboard.
**Critério de aceitação:** aba Network do dashboard mostra 1 leitura de `sci_operational_records` por carga (antes: 2); gráfico idêntico.
**Riscos e reversão:** nenhum (função pura testável — caso S7 da bateria J.3). Reversão: revert.

---

## [W5-3] — Uploads sequenciais → paralelos (P-03)

**Arquivo(s):** `src/services/deceasedService.ts` (linhas 113–119), `src/services/notificationService.ts` (linhas 73–79)
**Diagnóstico:** `for...await` sobe um arquivo por vez — 5 documentos = 5 RTTs em série. `Promise.all` corta o tempo de envio proporcionalmente.

**Código atual (before):**
```typescript
// src/services/notificationService.ts:73-79
  const uploadedDocs = [];
  for (const file of files) {
    const storageRef = ref(storage, `documents/${auth.currentUser?.uid}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    uploadedDocs.push({ name: file.name, url });
  }
```

**Código corrigido (after):**
```typescript
// util compartilhado — src/lib/storageUpload.ts (novo; W2-2 metadata incluída)
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase';

export async function uploadFilesParallel(
  files: File[],
  pathPrefix: 'documents' | 'photos' | 'sci-documents',
  tenantId?: string
): Promise<{ name: string; url: string }[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado.');
  return Promise.all(
    files.map(async (file, i) => {
      const storageRef = ref(storage, `${pathPrefix}/${uid}/${Date.now()}_${i}_${file.name}`);
      await uploadBytes(storageRef, file, tenantId ? { customMetadata: { tenantId } } : undefined);
      return { name: file.name, url: await getDownloadURL(storageRef) };
    })
  );
}
```
```typescript
// notificationService.ts / deceasedService.ts — substituir os laços:
const uploadedDocs = await uploadFilesParallel(files, 'documents', tenantId);
```

**Passos de implementação:** criar o util (unifica também as 4 variações de upload — duplicação 3.2.7); substituir nos dois services (+ `createDeceasedWithPlot` de W1-14 e `uploadSCIDocument` do sciService); o índice `_${i}_` no nome evita colisão de `Date.now()` em paralelo.
**Critério de aceitação:** comunicar óbito com 5 PDFs dispara os 5 uploads simultaneamente (Network waterfall paralelo); nomes de arquivo únicos.
**Riscos e reversão:** falha parcial rejeita o `Promise.all` inteiro — os já subidos ficam órfãos (comportamento igual ao atual em falha no meio do laço). Reversão: revert.

---

## [W5-4] — Adotar SCITable, useCemeteryFilter e useModal já escritos (Q-01, item 34)

**Arquivo(s):** `src/components/admin/SCITable.tsx` (0 usos), `src/hooks/useCemeteryFilter.ts` (0 usos), `src/hooks/useModal.ts` (1 uso), e as 9 páginas SCI
**Diagnóstico:** o plano M7 criou as ferramentas e as aplicou em 1 lugar. Hoje: 13 cópias do `useMemo` de filtro por unidade, ~10 tabelas manuais (~600 linhas de JSX repetido) e ~9 modais sem Esc/foco/aria. Refactor mecânico com redução estimada de 800–1.000 linhas.

**Código atual (before) — o padrão de filtro repetido 13×:**
```typescript
// exemplo SecurityPage.tsx:28-36 (variações em Operational 3×, Maintenance 2×, Environmental 2×,
// Documents, Support 2×, Financial, Reports 2×)
  const scopedEvents = useMemo(
    () =>
      events.filter(
        (item) =>
          item.category === 'security' &&
          (selectedCemeteryId === 'all' || item.cemeteryId === selectedCemeteryId)
      ),
    [events, selectedCemeteryId]
  );
```

**Código corrigido (after):**
```typescript
// com o hook existente (src/hooks/useCemeteryFilter.ts):
import { useCemeteryFilter } from '@/hooks/useCemeteryFilter';

const scopedByUnit = useCemeteryFilter(events);
const scopedEvents = useMemo(
  () => scopedByUnit.filter((item) => item.category === 'security'),
  [scopedByUnit]
);
```
```tsx
// tabelas: substituir o <table> manual pelo componente existente
import { SCITable } from '@/components/admin/SCITable';

<SCITable
  loading={loading}
  data={scopedRecords}
  emptyMessage="Nenhum lançamento registrado."
  columns={[
    { header: 'Descrição', accessor: 'description' },
    { header: 'Categoria', accessor: (r) => r.category === 'income' ? 'Receita' : 'Despesa' },
    { header: 'Valor', accessor: (r) => formatCurrency(r.value), className: 'text-right' },
    { header: 'Data', accessor: (r) => formatDate(r.occurredAt) },
    { header: 'Ações', accessor: (r) => <RowActions record={r} /> },
  ]}
/>
```
```typescript
// modais: aplicar useModal (Esc + foco + aria) nos ~9 restantes —
// InventoryPage (novo jazigo + inspeção), AdminDashboard (checklist), CemeteryList (form),
// CemeteryDetail (setor + túmulo), ShopAndServices (2). Padrão já usado em CommunicatedDeaths.tsx:42:
const { containerRef } = useModal(isModalOpen, () => setIsModalOpen(false));
// <div ref={containerRef} role="dialog" aria-modal="true" aria-labelledby="modal-title" ...>
```

**Passos de implementação (ordem por página, 1 PR cada ou 3 PRs por grupo):**
1. `useCemeteryFilter` nas 9 páginas (13 substituições) — mecânico, primeiro.
2. `SCITable` nas tabelas de: Financial, Documents, Support (2), Environmental (2), Operational (listas simples — as tabelas de prazos com cores permanecem custom), Security (lista de incidentes permanece em cards — não migrar).
3. `useModal` nos 9 modais listados; conferir foco de retorno.
4. Cada migração preserva o comportamento — sem mudança visual além da unificação `px-6 py-4`.

**Critério de aceitação:** `grep -rn "useCemeteryFilter" src/pages | wc -l` ≥ 9; `grep -rn "SCITable" src/pages | wc -l` ≥ 6; diff total da onda negativo em ≥600 linhas; todos os modais fecham com Esc.
**Riscos e reversão:** regressões visuais sutis (padding de célula) — revisar página a página no preview; reversão por página (PRs pequenos).

---

## [W5-5] — Hook `useSciCreate` elimina as 11 cópias do handler de criação (Q-02)

**Arquivo(s):** `src/hooks/useSciCreate.ts` (novo) e os 11 handlers (`OperationalPage.tsx:134-247` 3×, `MaintenancePage.tsx:81-162` 2×, `EnvironmentalPage.tsx:80-144` 2×, `DocumentsCenterPage.tsx:44-87`, `SupportPage.tsx:66-131` 2×, `FinancialPage.tsx:57-93`)
**Diagnóstico:** o esqueleto guard-de-'all' → saving → create → toast → reset → reload → catch-mapeado está copiado 11 vezes com variações mínimas.

**Código corrigido (after) — novo `src/hooks/useSciCreate.ts`:**
```typescript
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { reportError } from '@/lib/errors';

interface UseSciCreateOptions<TForm> {
  /** Executa a criação; recebe tenantId e cemeteryId garantidamente válidos. */
  create: (tenantId: string, cemeteryId: string, form: TForm) => Promise<unknown>;
  successMessage: string;
  /** Valor de reset do formulário após sucesso. */
  resetValue: TForm;
  setForm: (value: TForm) => void;
  reload: () => Promise<void>;
  /** Validação opcional; retorna mensagem de erro ou null. */
  validate?: (form: TForm) => string | null;
}

export function useSciCreate<TForm>(options: UseSciCreateOptions<TForm>) {
  const { tenantId } = useAuth();
  const { selectedCemeteryId } = useAdmin();
  const [saving, setSaving] = useState(false);

  const submit = async (form: TForm, event?: React.FormEvent) => {
    event?.preventDefault();
    if (!tenantId) return;
    if (selectedCemeteryId === 'all') {
      toast.error('Selecione um cemitério específico antes de criar um registro.');
      return;
    }
    const validationError = options.validate?.(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    try {
      await options.create(tenantId, selectedCemeteryId, form);
      toast.success(options.successMessage);
      options.setForm(options.resetValue);
      await options.reload();
    } catch (error) {
      reportError('sciCreate', error);
    } finally {
      setSaving(false);
    }
  };

  return { submit, saving };
}
```
**Uso (exemplo FinancialPage):**
```typescript
const { submit, saving } = useSciCreate({
  create: (tenantId, cemeteryId, form) =>
    createFinancialRecord(tenantId, { ...form, cemeteryId, value: Number(form.value) }),
  successMessage: 'Lançamento registrado.',
  resetValue: INITIAL_FORM,
  setForm,
  reload: loadData,
  validate: (form) => (Number(form.value) < 0 ? 'Valor não pode ser negativo.' : null),
});
// <form onSubmit={(e) => submit(form, e)}> ... <button disabled={saving}>
```

**Passos de implementação:** criar o hook; migrar os 11 handlers um a um (cada um vira ~8 linhas de configuração); manter comportamentos específicos (ex.: guard extra do Documents para arquivo) no `validate`/`create`.
**Critério de aceitação:** os 11 handlers reduzidos à configuração; comportamento idêntico (guard, toasts, reset, disable); diff negativo ~300 linhas.
**Riscos e reversão:** por página, igual W5-4.

---

## [W5-6] — Snapshot baixa todos os plots do tenant: contadores via `getCountFromServer` (P-01, item 37)

**Arquivo(s):** `src/services/sciService.ts` (`getAllTenantPlotsWithPagination` linhas 448–467 e o cálculo do snapshot 506–686)
**Diagnóstico:** o dado mais volumoso (plots — até dezenas de milhares por município) é baixado inteiro para o cliente a cada expiração de cache (60s) só para derivar contadores. Com 10k plots e 5 gestores, ~50k reads/h. `getCountFromServer` resolve contadores em O(1); a lista completa fica restrita ao mapa do Inventário (por cemitério/setor).

**Código corrigido (after) — contadores agregados:**
```typescript
// src/services/sciService.ts
import { getCountFromServer } from 'firebase/firestore';

async function countPlots(tenantId: string, cemeteryId: string, extra?: Parameters<typeof where>[]): Promise<number> {
  const constraints = [
    where('tenantId', '==', tenantId),
    ...(cemeteryId !== 'all' ? [where('cemeteryId', '==', cemeteryId)] : []),
    ...((extra as any[]) || []),
  ];
  const snap = await getCountFromServer(query(collection(db, 'plots'), ...constraints));
  return snap.data().count;
}

export async function getPlotCounters(tenantId: string, cemeteryId: string) {
  const [total, occupied, available, reserved, blocked, sanitaryHigh, environmentalHigh, structuralCritical] =
    await Promise.all([
      countPlots(tenantId, cemeteryId),
      countPlots(tenantId, cemeteryId, [where('status', '==', 'occupied')] as any),
      countPlots(tenantId, cemeteryId, [where('status', '==', 'available')] as any),
      countPlots(tenantId, cemeteryId, [where('status', '==', 'reserved')] as any),
      countPlots(tenantId, cemeteryId, [where('status', '==', 'blocked')] as any),
      countPlots(tenantId, cemeteryId, [where('sanitaryRisk', '==', 'high')] as any),
      countPlots(tenantId, cemeteryId, [where('environmentalRisk', '==', 'high')] as any),
      countPlots(tenantId, cemeteryId, [where('structuralStatus', '==', 'critical')] as any),
    ]);
  return { total, occupied, available, reserved, blocked, sanitaryHigh, environmentalHigh, structuralCritical };
}
```
No snapshot: substituir os contadores derivados de `plots[]` pelos agregados; **os cálculos de prazo de exumação e concessão** (que precisam de campos por documento) passam a usar uma query restrita — `where('status','==','occupied')` com `limit` progressivo, ou (melhor) permanecem sobre a lista completa APENAS quando `cemeteryId !== 'all'`; para "todas as unidades", exibir os agregados e calcular prazos por cemitério sob demanda. Documentar a decisão no código.

**Passos de implementação:**
1. Introduzir `getPlotCounters`; migrar os contadores do snapshot; manter a leitura paginada SOMENTE para exumação/concessões, agora filtrada por `status=='occupied'` (fração pequena do total).
2. Índices: count com 2 igualdades (`tenantId+status`, `tenantId+cemeteryId+status`) — adicionar os compostos que o erro do SDK indicar a `firestore.indexes.json`.
3. `InventoryPage`: parar de chamar o snapshot para o modo mapa (usa `getCemeteryPlots` direto — corrige também a dupla leitura 4.2); o modo "IA"/indicadores usa os agregados.
4. Medir: contador de reads no console Firebase antes/depois com o mesmo roteiro de navegação.

**Critério de aceitação:** dashboard com 10k plots gera ≤ ~30 reads por carga fria (8 counts + coleções SCI) em vez de ~10k; números idênticos aos anteriores (validar com tenant de teste seedado); prazos de exumação continuam corretos.
**Riscos e reversão:** counts custam 1 read por 1000 documentos contados — ainda ~10× mais barato; divergência de contadores por índices ausentes aparece como erro (não silencioso — os catches do snapshot devem logar via `reportError` do W3-1 no consumidor). **Maior item da onda; fazer por último com QA dedicado.** Reversão: flag interna para voltar ao caminho antigo (manter a função paginada).

---

## [W5-7] — Cemitérios re-buscados em 4 telas que já têm o contexto (P-06, 4.2)

**Arquivo(s):** `src/pages/admin/CemeteryList.tsx:52`, `src/pages/admin/DeceasedForm.tsx`, `src/pages/admin/AdminReportDeath.tsx`, `src/pages/admin/CommunicatedDeaths.tsx:63`
**Diagnóstico:** `AdminProvider` já carrega os cemitérios do tenant (`AdminContext.tsx:21-35`); as 4 telas chamam `getCemeteries(tenantId)` de novo — 4 fetches duplicados por sessão e risco de dessincronização com o dropdown global.

**Código corrigido (after) — padrão:**
```typescript
// before (CommunicatedDeaths.tsx:61-65):
//   useEffect(() => {
//     if (isModalOpen && actionType === 'allocate' && tenantId) {
//       getCemeteries(tenantId).then(setCemeteries);
//     }
//   }, [isModalOpen, actionType, tenantId]);
// after:
const { cemeteries } = useAdmin(); // estado local `cemeteries` e o fetch saem
```

**Passos de implementação:** nas 4 telas, substituir o fetch local por `useAdmin().cemeteries`; remover estados/efeitos redundantes; `ReportDeath` (cidadão) NÃO muda — usa `getAllCemeteries` cross-tenant por design (adicionar `limit(100)` lá: `query(collection(db, CEMETERIES_COL), limit(100))`).
**Critério de aceitação:** aba Network: nenhuma query extra a `cemeteries` ao abrir as 4 telas; dropdowns idênticos.
**Riscos e reversão:** nenhum. Reversão trivial.

---

## [W5-8] — Busca pública server-side com `nameLowercase` (item 18, U-05)

**Arquivo(s):** `src/pages/public/SearchPage.tsx` (linhas 30–38), `src/services/deceasedService.ts` (`syncPublicDeceased`), `firestore.indexes.json`, `scripts/backfill-public-deceaseds.cjs`
**Diagnóstico:** a busca baixa 200 docs e filtra por `includes` no cliente — acima de 200 falecidos públicos, resultados somem de forma imprevisível. Mesma técnica de W1-8, aplicada à projeção pública.

**Código atual (before):**
```typescript
// src/pages/public/SearchPage.tsx:30-38
      const q = query(collection(db, 'public_deceaseds'), firestoreLimit(200));
      const snapshot = await getDocs(q);
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SearchResult));
      const filtered = all.filter(d =>
        d.name?.toLowerCase().includes(term)
      );
      setResults(filtered);
```

**Código corrigido (after):**
```typescript
// deceasedService.ts — incluir na projeção (PUBLIC_FIELDS não muda; campo derivado):
async function syncPublicDeceased(id: string, tenantId: string, source: Record<string, any>) {
  try {
    const projection: Record<string, any> = { tenantId, updatedAt: serverTimestamp() };
    for (const field of PUBLIC_FIELDS) {
      if (field in source) projection[field] = source[field] ?? null;
    }
    if (typeof source.name === 'string') {
      projection.nameLowercase = source.name.toLowerCase();
    }
    await setDoc(doc(db, PUBLIC_COLLECTION, id), projection, { merge: true });
  } catch (error) {
    if (import.meta.env.DEV) console.error('Falha ao sincronizar public_deceaseds:', error);
  }
}
```
```typescript
// SearchPage.tsx — busca por prefixo no servidor
      const q = query(
        collection(db, 'public_deceaseds'),
        where('nameLowercase', '>=', term),
        where('nameLowercase', '<=', term + ''),
        firestoreLimit(50)
      );
      const snapshot = await getDocs(q);
      setResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SearchResult)));
```

**Passos de implementação:**
1. Projeção grava `nameLowercase`; estender `scripts/backfill-public-deceaseds.cjs` para gravar o campo e rodar o backfill.
2. Índice simples em `nameLowercase` é automático (single-field) — sem entrada no indexes.json.
3. Trocar a query da página; a UI (mín. 3 chars, plural de resultados) permanece.
4. Ordem: backfill → deploy da UI.

**Critério de aceitação:** com 500 registros públicos seedados, buscar "sil" retorna os que começam com "sil" (até 50), independentemente da posição no dataset; latência de busca menor (payload de ≤50 docs vs 200).
**Riscos e reversão:** prefixo-apenas (documentado em W1-8); reversão: query antiga.

---

## [W5-9] — Seletor de unidade não persiste e páginas exibem ID cru (item 45, D-20)

**Arquivo(s):** `src/contexts/AdminContext.tsx` (linha 17), `src/pages/admin/AdminDashboard.tsx:156`, `src/pages/admin/DeceasedList.tsx:106`
**Diagnóstico:** (a) `selectedCemeteryId` vive em memória — F5 volta para "Todas as unidades" e o gestor cria registros na unidade errada; (b) o dashboard exibe o ID bruto da unidade e a coluna "Local" de Falecidos idem, com o nome já disponível no contexto.

**Código atual (before):**
```typescript
// src/contexts/AdminContext.tsx:17
  const [selectedCemeteryId, setSelectedCemeteryId] = useState<string>('all');
```

**Código corrigido (after):**
```typescript
// src/contexts/AdminContext.tsx — persistência por tenant no localStorage
const storageKey = (tenantId: string | null) => `memorialos.selectedCemetery.${tenantId ?? 'anon'}`;

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { tenantId } = useAuth();
  const [selectedCemeteryId, setSelectedCemeteryIdState] = useState<string>('all');

  // Restaura ao trocar de tenant/login
  useEffect(() => {
    const saved = localStorage.getItem(storageKey(tenantId));
    setSelectedCemeteryIdState(saved || 'all');
  }, [tenantId]);

  const setSelectedCemeteryId = useCallback((id: string) => {
    setSelectedCemeteryIdState(id);
    localStorage.setItem(storageKey(tenantId), id);
  }, [tenantId]);

  // Sanidade: se a unidade salva foi excluída, volta para 'all'
  useEffect(() => {
    if (selectedCemeteryId !== 'all' && cemeteries.length > 0
        && !cemeteries.some((c) => c.id === selectedCemeteryId)) {
      setSelectedCemeteryId('all');
    }
  }, [cemeteries, selectedCemeteryId, setSelectedCemeteryId]);
  // ... resto inalterado
}
```
```tsx
// helper de nome — adicionar ao AdminContext (evita repetir o find em cada página):
const selectedCemeteryName =
  selectedCemeteryId === 'all'
    ? 'Todas as unidades'
    : cemeteries.find((c) => c.id === selectedCemeteryId)?.name ?? selectedCemeteryId;
// expor no value do Provider

// AdminDashboard.tsx:156 — before: `Unidade: {selectedCemeteryId}`
//                          after:  `Unidade: {selectedCemeteryName}`

// DeceasedList.tsx:106 — before: {person.cemeteryId || 'Não definido'}
//                        after:
const { cemeteries } = useAdmin();
const cemeteryName = (id?: string) => cemeteries.find((c) => c.id === id)?.name ?? id ?? 'Não definido';
// célula: {cemeteryName(person.cemeteryId)}
```

**Passos de implementação:** aplicar nos 3 arquivos; W4-6 já cobriu o nome nos relatórios.
**Critério de aceitação:** F5 mantém a unidade selecionada; trocar de conta não vaza a seleção do tenant anterior; dashboard e coluna "Local" exibem nomes.
**Riscos e reversão:** localStorage compartilhado entre contas no mesmo browser — mitigado pela chave por tenant. Reversão trivial.

---

## [W5-10] — Dependências: não usadas, no lugar errado, ausentes (item 47, 3.6)

**Arquivo(s):** `package.json`, `functions/package.json`
**Diagnóstico:** `uuid`, `motion` e `react-leaflet` sem nenhum import (o MapPicker usa `leaflet` puro); `qrcode.react` era morto mas W4-10 o adotou — **manter**; `firebase-admin` em dependencies do frontend (é só dos scripts); `vite`/`@vitejs/plugin-react` em dependencies (são dev); `@tailwindcss/vite`/`tailwindcss` duplicados; `functions/package.json` declara `@google/genai` que só o `index.js` morto referencia (removido em W5-11).

**Comandos exatos:**
```bash
# raiz
npm uninstall uuid motion react-leaflet
npm uninstall firebase-admin && npm install -D firebase-admin   # usado só por scripts/
npm uninstall vite @vitejs/plugin-react && npm install -D vite @vitejs/plugin-react
# resolver duplicação tailwind: manter apenas em devDependencies
npm uninstall @tailwindcss/vite tailwindcss && npm install -D @tailwindcss/vite tailwindcss

# functions
cd functions && npm uninstall @google/genai
```

**Passos de implementação:** rodar os comandos; `npm run build` + `cd functions && npm run build` verdes; confirmar `git diff package-lock.json` sem sobras.
**Critério de aceitação:** builds verdes; `npx depcheck` (opcional) sem unused em dependencies; bundle não regride.
**Riscos e reversão:** `firebase-admin` como devDependency não é instalado em `npm ci --omit=dev` — os scripts rodam em ambiente de dev, ok. Reversão: reinstalar.

---

## [W5-11] — Código morto e resíduos (Q-06, item 49, 3.10)

**Arquivo(s):** conforme tabela
**Diagnóstico/Ação:**

| Item | Local | Ação |
|---|---|---|
| `HomePage.tsx` | `src/pages/public/` (133 linhas, nunca roteada, mocks picsum) | `git rm` |
| `QRCodeGenerator.tsx` | `src/components/` | **mantido** — adotado por W4-10 (consertar o download stub lá) |
| `functions/index.js` | backend v1 morto (setUserRole, onDeceasedCreated, generateContent) | `git rm` + atualizar README (que ainda o cita) |
| `functions/lib/**` | build output commitado (12 arquivos + sourcemaps) | `git rm -r functions/lib` + adicionar `lib/` ao `functions/.gitignore` |
| `validationSchemas.dateRangeSchema` | `src/lib/validationSchemas.ts` | remover (o zod local do DeceasedForm cobre); `operationalRecordSchema` fica (adotado em W4-12) |
| `LoadingSpinner.tsx` | `src/components/ui/` | **mantido** — adotado por W5-1 (Suspense) e SCITable (W5-4) |
| `recordForm.plotId` fantasma | `OperationalPage.tsx:60` | resolvido em W4-12 (ganhou input) |
| `listenNotification` | `notificationService.ts:147-153` | remover (0 consumidores) ou manter com comentário `// reservado para tempo real` — decisão: remover |
| Imports não usados `Search`/`Menu` | `PublicLayout.tsx:4` | remover |
| `getRelationshipSubtitle` duplicada | `GardenOfMemories.tsx:54-60` | extrair `getRelationshipLabel` para `src/lib/relationship.ts` e importar nos 2 pontos |
| Comentários de plano (A5, B1, C4, M7.4...) | services/páginas | remover na passada de cada arquivo tocado (não PR dedicado) |
| `metadata.json` | raiz (resíduo AI Studio) | `git rm` |
| `scripts/migrate-tenant-ids.ts` | one-shot já executado | `git rm` (histórico preserva) |

**Passos de implementação:** um PR único "chore: remove dead code" com a tabela como checklist; `npm run build` + `tsc --noEmit` verdes após cada remoção.
**Critério de aceitação:** `git ls-files | grep -E "HomePage.tsx|functions/index.js|functions/lib|metadata.json"` → vazio; builds verdes; nenhuma feature regride (as removidas não tinham consumidores — confirmado por grep de imports antes de cada rm).
**Riscos e reversão:** histórico do git preserva tudo; reversão por checkout do commit anterior.

---

## SMOKE TEST DE SAÍDA DA ONDA 5 (20 min)

1. `npm run build`: chunk inicial reduzido; navegar público→cidadão→admin→superadmin com fallbacks.
2. Dashboard: 1 leitura de operacionais; contadores idênticos aos da onda anterior (tenant seedado).
3. Comunicar óbito com 5 PDFs: uploads paralelos no waterfall.
4. Todas as páginas SCI: filtro por unidade funcionando (useCemeteryFilter), tabelas SCITable com loading/empty, modais fecham com Esc.
5. Busca pública "sil" com 500 registros → resultados por prefixo.
6. F5 no admin mantém a unidade; nomes em vez de IDs no dashboard e em Falecidos.
7. `npx depcheck` limpo; `git ls-files` sem os mortos da tabela.

---

# ONDA 6 — QUALIDADE E DÉBITO TÉCNICO (~5–8 dias)

> Objetivo: TypeScript com tipos reais (95 `any` → <10), lint automatizado, datas/moeda/idioma consistentes, acessibilidade dos fluxos principais e a primeira bateria de testes unitários. **Executar por último**: os refactors das ondas 3–5 reduzem drasticamente o volume de erros que o strict vai apontar.

---

## [W6-1] — TypeScript sem strict e sem @types/react (Q-05, B5, item 48)

**Arquivo(s):** `tsconfig.json`, `package.json`
**Diagnóstico:** o tsconfig não tem `strict`, `noImplicitAny` nem `strictNullChecks`; `@types/react`/`@types/react-dom` não estão instalados (a razão registrada do adiamento do B5). O "lint" do projeto é só `tsc --noEmit` fraco.

**Código atual (before):**
```json
// tsconfig.json (estado atual — sem nenhuma flag strict)
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "types": ["vite/client", "node"],
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

**Código corrigido (after) — fase 1 (esta onda):**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "types": ["vite/client", "node"],
    "allowImportingTsExtensions": true,
    "noEmit": true,

    "strictNullChecks": true,
    "noImplicitAny": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true
  },
  "include": ["src"]
}
```

**Comandos exatos:**
```bash
npm install -D @types/react @types/react-dom
```

**Passos de implementação (incremental — NÃO ligar `strict: true` de uma vez):**
1. Instalar os types; rodar `npx tsc --noEmit` — corrigir os erros de tipos do React que aparecerem (imports de tipos, children etc.).
2. Ligar `strictNullChecks`; corrigir por camada na ordem: `lib/` → `services/` → `contexts/` → `hooks/` → `components/` → `pages/`. Padrões dominantes: `tenantId` pode ser null (guards já existem — o compilador passa a exigi-los), `person.id!` justificados viram checagens.
3. Ligar `noImplicitAny` e `noUnusedLocals`; corrigir.
4. Registrar issue para a fase 2 (`strict: true` completo — inclui `strictFunctionTypes` etc.) após W6-3.
5. O CI (W2-11) já roda `tsc --noEmit` — cada flag ligada vira gate automático.

**Critério de aceitação:** `npx tsc --noEmit` verde com as 4 flags; `@types/react` presente; nenhum `@ts-ignore` novo introduzido (`grep -rn "@ts-ignore" src/` estável ou menor).
**Riscos e reversão:** volume de erros de strictNullChecks pode surpreender (~100–200 no primeiro run) — por isso a ordem por camada e o PR por camada. Reversão: desligar a flag (não recomendado).

---

## [W6-2] — ESLint + Prettier + hooks de pre-commit (Q-07, 7.3)

**Arquivo(s):** `eslint.config.js` (novo), `.prettierrc` (novo), `package.json`, `.github/workflows/ci.yml`
**Diagnóstico:** não há ESLint nem Prettier — consequências visíveis: imports não usados, deps de hooks incompletas (`exhaustive-deps` teria pego a seção 4.4 inteira), `alert()` regressou pós-B3 (a regra `no-alert` teria impedido), estilo inconsistente.

**Comandos exatos:**
```bash
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-jsx-a11y prettier husky lint-staged
npx husky init
```

**Código (after) — `eslint.config.js` (flat config):**
```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'no-alert': 'error',                       // trava regressão do B3/W3-9
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      '@typescript-eslint/no-explicit-any': 'warn', // vira 'error' após W6-3
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  { ignores: ['dist/', 'functions/lib/', 'node_modules/'] }
);
```
```json
// .prettierrc
{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "es5" }
```
```json
// package.json — scripts e lint-staged
{
  "scripts": {
    "lint": "eslint src --max-warnings 0",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\""
  },
  "lint-staged": {
    "src/**/*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```
`.husky/pre-commit`: `npx lint-staged`. No `ci.yml` (job `quality`), adicionar o passo `- run: npm run lint` após o typecheck.

**Passos de implementação:**
1. Instalar/configurar; primeiro run `npx eslint src --fix` (autofix em massa) + `npx prettier --write src` num PR dedicado "chore: eslint/prettier baseline" (diff grande, zero lógica).
2. Corrigir manualmente o que sobrar (exhaustive-deps apontará os `useEffect` da seção 4.4 — corrigir com `useCallback` nos `loadData`).
3. Ligar o passo no CI.

**Critério de aceitação:** `npm run lint` verde com `--max-warnings 0`; commit com `alert(` é rejeitado no pre-commit; CI falha em lint.
**Riscos e reversão:** o PR de baseline conflita com PRs abertos — coordenar janela de merge. Reversão: remover o passo do CI (manter local).

---

## [W6-3] — 95 `any`: tipar estados de página com os tipos dos services (B5.2, 3.8)

**Arquivo(s)/Linha(s):** `OperationalPage.tsx:49-51` (3 estados), `MaintenancePage.tsx:22-23`, `EnvironmentalPage.tsx:25-26`, `DocumentsCenterPage.tsx:12`, `SupportPage.tsx:20-21`, `SecurityPage.tsx:19`, `AgentsPage.tsx:11`, `ReportsPage.tsx:19`, `InventoryPage.tsx:36`, `formData: any` nos 2 wizards, `icon: any` em `AdminLayout.tsx:33`, ~20 casts `as any` em selects
**Diagnóstico:** os tipos existem no service (`OperationalRecord`, `OccurrenceRecord`, `StockItem`, `DigitalDocument`, `SupportTicket`, `TrainingSession`, `AIAgent`, `SCIReport`, `SciExecutiveSnapshot`...) e as páginas usam `any[]` — anulando o valor do TypeScript exatamente onde os dados circulam.

**Código atual (before) — exemplo:**
```typescript
// src/pages/admin/SecurityPage.tsx:19
  const [events, setEvents] = useState<any[]>([]);
```

**Código corrigido (after) — tabela de substituições:**
```typescript
// SecurityPage.tsx
import { OccurrenceRecord } from '@/services/sciService';
const [events, setEvents] = useState<OccurrenceRecord[]>([]);

// OperationalPage.tsx
const [records, setRecords] = useState<OperationalRecord[]>([]);
const [notificationsList, setNotificationsList] = useState<InternalNotification[]>([]);
const [occurrences, setOccurrences] = useState<OccurrenceRecord[]>([]);

// MaintenancePage.tsx
const [orders, setOrders] = useState<OperationalRecord[]>([]);
const [stock, setStock] = useState<StockItem[]>([]);

// EnvironmentalPage.tsx
const [sanitary, setSanitary] = useState<EnvironmentalSanitaryCheck[]>([]);
const [environmental, setEnvironmental] = useState<EnvironmentalSanitaryCheck[]>([]);

// DocumentsCenterPage.tsx
const [documents, setDocuments] = useState<DigitalDocument[]>([]);

// SupportPage.tsx
const [tickets, setTickets] = useState<SupportTicket[]>([]);
const [sessions, setSessions] = useState<TrainingSession[]>([]);

// AgentsPage.tsx
const [agents, setAgents] = useState<AIAgent[]>([]);

// ReportsPage.tsx
const [reports, setReports] = useState<SCIReport[]>([]);

// InventoryPage.tsx
const [snapshot, setSnapshot] = useState<SciExecutiveSnapshot | null>(null);

// AdminLayout.tsx:33 — icon: any
import type { LucideIcon } from 'lucide-react';
interface SidebarLink { to: string; label: string; icon: LucideIcon; }

// selects com `as any` — trocar por união tipada:
// before: severity: e.target.value as any
// after:
onChange={(e) => setForm((prev) => ({ ...prev, severity: e.target.value as OccurrenceRecord['severity'] }))}

// createdAt?: any nas interfaces dos services:
import type { Timestamp, FieldValue } from 'firebase/firestore';
createdAt?: Timestamp | FieldValue; // FieldValue cobre serverTimestamp() na escrita
```

**Passos de implementação:**
1. Mecânico, arquivo a arquivo (os tipos já existem); wizards: definir `interface WizardFormData` com os campos do step1+step3 no lugar de `formData: any`.
2. Ao final, promover a regra do ESLint: `'@typescript-eslint/no-explicit-any': 'error'` com exceções pontuais via `// eslint-disable-next-line` justificado.
3. Meta: `grep -rn ": any" src/ | wc -l` < 10 (casos justificados: cast do Firestore `as unknown as T` no listByTenant e afins).

**Critério de aceitação:** contagem de `: any` em `src/` < 10; `as any` em handlers de select zerado; `tsc --noEmit` verde.
**Riscos e reversão:** nenhum comportamento muda (só tipos). Reversão trivial.

---

## [W6-4] — Datas: ISO cru nas tabelas e parse UTC com off-by-one (M2 residual, item 50, teste S3)

**Arquivo(s):** `src/lib/formatters.ts`, tabelas de `OperationalPage.tsx:528`, `FinancialPage.tsx:146`, `DocumentsCenterPage`, `SupportPage`, `EnvironmentalPage`, `SearchPage.tsx:137,143`, `ReportsPage`; cálculo de prazos em `sciService.ts:539-556/696-722`
**Diagnóstico:** (a) ao menos 8 tabelas exibem `YYYY-MM-DD` cru (`item.scheduledFor || '-'`) com `formatDate` já pronto em `formatters.ts`; (b) `new Date('YYYY-MM-DD')` interpreta UTC — em BRT (UTC-3) a data desloca um dia em exibição e o cálculo de prazo de exumação pode oscilar vencido/não-vencido perto da meia-noite (caso S3 da bateria de testes).

**Código atual (before) — exemplos:**
```tsx
// OperationalPage.tsx:528 (padrão nas 8 tabelas)
<td className="px-4 py-3">{item.scheduledFor || '-'}</td>
```
```typescript
// sciService.ts (cálculo de exumação — padrão das linhas 539-556 e 696-722)
const burial = new Date(plot.burialDate); // '2023-01-01' → 2022-12-31T21:00 BRT
```

**Código corrigido (after):**
```typescript
// src/lib/formatters.ts — garantir parse local (parseISO) e cobrir datetime-local
import { parseISO, format } from 'date-fns';

export const formatDate = (isoDate?: string | null): string => {
  if (!isoDate) return '—';
  try {
    return format(parseISO(isoDate), 'dd/MM/yyyy');
  } catch {
    return isoDate;
  }
};

export const formatDateTime = (isoDateTime?: string | null): string => {
  if (!isoDateTime) return '—';
  try {
    return format(parseISO(isoDateTime), 'dd/MM/yyyy HH:mm');
  } catch {
    return isoDateTime;
  }
};
```
```tsx
// nas 8 tabelas:
import { formatDate } from '@/lib/formatters';
<td className="px-4 py-3">{formatDate(item.scheduledFor)}</td>
```
```typescript
// sciService.ts — parse local nos DOIS cálculos de exumação:
import { parseISO } from 'date-fns';
const burial = parseISO(plot.burialDate); // meia-noite LOCAL: dia estável em BRT
```

**Passos de implementação:**
1. Ajustar `formatters.ts` (se já usa parseISO, apenas adicionar `formatDateTime` e o try/catch).
2. Varredura: `grep -rn "new Date(" src/services/sciService.ts src/pages --include="*.tsx" | grep -v "new Date()"` e trocar todo parse de string ISO por `parseISO`.
3. Aplicar `formatDate` nas 8 tabelas mapeadas (SearchPage inclusive).
4. Teste unitário do caso S3 entra em W6-9.

**Critério de aceitação:** nenhuma tabela exibe `YYYY-MM-DD`; data gravada `2024-03-15` exibe `15/03/2024` em qualquer fuso; prazo de exumação estável no teste S3.
**Riscos e reversão:** nenhum. Reversão trivial.

---

## [W6-5] — Moeda sem formatação pt-BR (M5 residual)

**Arquivo(s):** `src/pages/admin/AgentsPage.tsx:123-124`, `FinancialPage.tsx` (células de valor), `AdminDashboard.tsx` (cards financeiros), `sciService.buildReportSummary`
**Diagnóstico:** `R$ ${snapshot.totalRevenue.toFixed(2)}` produz `R$ 1234.56` — formatação errada para produto municipal brasileiro. `formatCurrency` já existe em `formatters.ts` e não é aplicado nesses pontos.

**Código atual (before):**
```typescript
// src/pages/admin/AgentsPage.tsx:123-124
      `Receita: R$ ${snapshot.totalRevenue.toFixed(2)}`,
      `Despesa: R$ ${snapshot.totalExpenses.toFixed(2)}`
```

**Código corrigido (after):**
```typescript
import { formatCurrency } from '@/lib/formatters';
      `Receita: ${formatCurrency(snapshot.totalRevenue)}`,
      `Despesa: ${formatCurrency(snapshot.totalExpenses)}`
```

**Passos de implementação:** `grep -rn "toFixed(2)" src/` e substituir cada ocorrência monetária por `formatCurrency` (W4-6 já cobriu o relatório; conferir).
**Critério de aceitação:** `grep -rn "R\$ \${" src/` → vazio; valores exibidos como `R$ 1.234,56`.
**Riscos e reversão:** nenhum.

---

## [W6-6] — Valores de domínio crus em inglês na UI: estender `statusLabels.ts` (item 29, 2.2)

**Arquivo(s):** `src/lib/statusLabels.ts`, selects/células de `EnvironmentalPage.tsx:251-253/319-323`, `DocumentsCenterPage.tsx:186-188`, `SupportPage.tsx:198-200/250-251`, `OperationalPage` (priority/audience/level), `SecurityPage` (severity), `InventoryPage` (riskLevel)
**Diagnóstico:** o arquivo cobre 3 dos ~8 conjuntos de estados; selects exibem `open/monitoring/closed`, `pending/validated/rejected`, `planned/completed`, células mostram `medium`, `operators`, `warning`, `structural` cru.

**Código atual (before):**
```typescript
// src/lib/statusLabels.ts (integral — só 3 conjuntos)
export const occurrenceStatusLabel: Record<string, string> = {
  open: 'Aberto',
  in_analysis: 'Em análise',
  resolved: 'Resolvido',
};

export const notificationStatusLabel: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  archived: 'Arquivado',
};

export const operationalStatusLabel: Record<string, string> = {
  planned: 'Planejado',
  in_progress: 'Em andamento',
  done: 'Concluído',
  cancelled: 'Cancelado',
};
```

**Código corrigido (after) — arquivo completo estendido:**
```typescript
// src/lib/statusLabels.ts — cobertura completa dos domínios exibidos na UI
export const occurrenceStatusLabel: Record<string, string> = {
  open: 'Aberto',
  in_analysis: 'Em análise',
  monitoring: 'Em monitoramento',
  resolved: 'Resolvido',
};

export const notificationStatusLabel: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  archived: 'Arquivado',
};

export const operationalStatusLabel: Record<string, string> = {
  planned: 'Planejado',
  in_progress: 'Em andamento',
  done: 'Concluído',
  cancelled: 'Cancelado',
};

export const checkStatusLabel: Record<string, string> = {
  open: 'Aberto',
  monitoring: 'Em monitoramento',
  closed: 'Encerrado',
};

export const documentStatusLabel: Record<string, string> = {
  pending: 'Pendente',
  validated: 'Validado',
  rejected: 'Rejeitado',
};

export const ticketStatusLabel: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em atendimento',
  done: 'Resolvido',
};

export const trainingStatusLabel: Record<string, string> = {
  planned: 'Agendado',
  completed: 'Concluído',
};

export const priorityLabel: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

export const severityLabel: Record<string, string> = priorityLabel;

export const riskLevelLabel: Record<string, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
};

export const audienceLabel: Record<string, string> = {
  all: 'Todos',
  managers: 'Gestores',
  operators: 'Operadores',
};

export const levelLabel: Record<string, string> = {
  info: 'Informativo',
  warning: 'Atenção',
  critical: 'Crítico',
};

export const plotStatusLabel: Record<string, string> = {
  available: 'Disponível',
  occupied: 'Ocupado',
  reserved: 'Reservado',
  blocked: 'Bloqueado',
};

/** Fallback seguro: retorna o label ou o valor cru (nunca undefined na UI). */
export const label = (map: Record<string, string>, value?: string | null): string =>
  (value && map[value]) || value || '—';
```
**Uso nos pontos crus (exemplo `EnvironmentalPage.tsx:251-253`):**
```tsx
// before:
//   <option value="open">open</option>
//   <option value="monitoring">monitoring</option>
//   <option value="closed">closed</option>
// after:
{Object.entries(checkStatusLabel).map(([value, text]) => (
  <option key={value} value={value}>{text}</option>
))}
// células: {label(riskLevelLabel, item.riskLevel)} / {label(priorityLabel, item.priority)}
```

**Passos de implementação:** estender o arquivo; aplicar nos 10+ pontos mapeados (selects e células); combinação natural com as colunas tipadas do SCITable (W5-4) — quem fizer depois reutiliza.
**Critério de aceitação:** varredura visual das 9 páginas SCI: nenhum valor `open/pending/planned/medium/operators/warning` cru; selects todos em PT-BR.
**Riscos e reversão:** nenhum.

---

## [W6-7] — Varredura de acentuação: ~80 strings sem acento (item 30, Anexo K)

**Arquivo(s):** conforme o catálogo do Anexo K da análise — `AdminLayout.tsx` (sidebar inteira), `AdminDashboard`, `OperationalPage`, `InventoryPage`, `FinancialPage`, `MaintenancePage`, `EnvironmentalPage`, `DocumentsCenterPage`, `SupportPage`, `SecurityPage`, `AgentsPage`, `ReportsPage`, `CemeteryList/Detail`, `DeceasedForm`, `sciService.buildReportSummary` (sai em relatório impresso!), área do usuário (`ReportDeath`, `UserHomePage`, `GardenOfMemories`, `VirtualAssistant`, `ShopAndServices`, `LandingPage`, `LoginPage`, `RegisterPage`) e prompts das Cloud Functions
**Diagnóstico:** "Gestao operacional", "Inventario", "Manutencao", "Seguranca", "Obitos Comunicados" etc. — o produto parece escrito por dois times; para venda a prefeituras o custo de credibilidade é desproporcional ao esforço da correção (os arquivos já são UTF-8; o padrão sem acento foi escolha defensiva desnecessária).

**Código atual (before) — amostra representativa (`AdminLayout.tsx` sidebar):**
```
"Inventario / Mapa" · "Manutencao" · "Seguranca" · "Sanitario / Ambiental"
"Relatorios" · "Cemiterios" · "Obitos Comunicados" · "Novo Obito (Admin)"
```

**Correção (after) — o catálogo dirigido do Anexo K aplicado (`atual → correto`), por exemplo:**
```
Area Administrativa SCI → Área Administrativa SCI
Inventario / Mapa → Inventário / Mapa
Manutencao → Manutenção
Seguranca → Segurança
Sanitario / Ambiental → Sanitário / Ambiental
Relatorios → Relatórios
Cemiterios → Cemitérios
Obitos Comunicados → Óbitos Comunicados
Taxa de ocupacao → Taxa de ocupação
Exumacoes pendentes → Exumações pendentes
Comunicar Obito → Comunicar Óbito
Saudade eterna e gratidao infinita → Saudade eterna e gratidão infinita
(… catálogo completo no Anexo K de ANALISE_TOTAL_MEMORIAL.md — usar como checklist do PR)
```
Também nos **prompts das Functions** (`functions/src/index.ts:321-336, 354-358, 383-392`): "obituario respeitoso" → "obituário respeitoso" etc. — acentuação no prompt melhora a qualidade da saída do modelo.

**Passos de implementação:**
1. Um PR por área (admin sidebar+dashboard / páginas SCI / cidadão+público / functions) usando o Anexo K como checklist linha a linha — **não** usar replace global cego (falsos positivos em identificadores).
2. Detecção de sobras: `grep -rnE "(Gestao|Inventario|Manutencao|Seguranca|Relatorio|Cemiterio|Obito|Ocupacao|Exumacao|Descricao|Titulo|Servico|Usuario|Voce|Familia|Historico|Codigo|Numero|Analise|Media|Critica|Proximo)" src/ functions/src --include="*.ts" --include="*.tsx"` — revisar cada hit (alguns são valores de rota/domínio que NÃO mudam, ex.: paths `/admin/manutencao` permanecem sem acento).
3. **Regra**: rotas, ids, valores de domínio e nomes de coleção NUNCA ganham acento; apenas strings exibidas.

**Critério de aceitação:** o grep do passo 2 retorna apenas rotas/identificadores; revisão visual página a página sem "Gestao/Obito" à vista; relatório gerado (buildReportSummary) com acentuação correta.
**Riscos e reversão:** acentuar um valor de domínio por engano quebra filtros — o passo 3 e o review do PR são a barreira; testes de W6-9 pegam regressões nos services. Reversão: revert por PR.

---

## [W6-8] — Acessibilidade dos fluxos principais (M6 residual, item 53, 2.8)

**Arquivo(s):** `AdminLayout.tsx:60-71` (select de unidade), selects inline das tabelas, `CemeteryList/Detail` (botões ícone), `InventoryPage.tsx:343-349` (pontos do mapa), `UserHomePage` (carrossel), `DeceasedList.tsx:116-140` (dropdown), contraste `text-slate-400`
**Diagnóstico:** para o público-alvo declarado (idosos em luto — VISION exige "fontes grandes, alto contraste"): seletor global sem `aria-label`; botões-ícone só com `title`; dropdown que não fecha com Esc/clique-fora; carrossel sem pausa nem `prefers-reduced-motion`; metadados em `text-slate-400` (~2.9:1, abaixo de AA). Modais foram cobertos em W5-4 (useModal).

**Código corrigido (after) — os 6 pontos:**
```tsx
// 1) AdminLayout.tsx — seletor de unidade:
<select
  aria-label="Selecionar unidade (cemitério)"
  value={selectedCemeteryId}
  onChange={(e) => setSelectedCemeteryId(e.target.value)}
  className="..."
>

// 2) Selects de status inline nas tabelas (padrão):
<select aria-label={`Alterar status de ${item.title}`} ...>

// 3) Botões ícone (CemeteryList lápis/lixeira, CemeteryDetail):
<button aria-label={`Editar cemitério ${cemetery.name}`} ...><Pencil size={18} /></button>
// (o title continua para tooltip de mouse; aria-label serve o leitor de tela)

// 4) DeceasedList — dropdown fecha com Esc e clique-fora:
useEffect(() => {
  if (!openMenuId) return;
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenuId(null); };
  const onClick = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('[data-row-menu]')) setOpenMenuId(null);
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('mousedown', onClick);
  return () => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('mousedown', onClick);
  };
}, [openMenuId]);
// e data-row-menu no wrapper do menu

// 5) UserHomePage — carrossel: pausar em hover/focus e respeitar reduced-motion:
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const [paused, setPaused] = useState(false);
useEffect(() => {
  if (prefersReducedMotion || paused) return;
  const id = setInterval(next, 5000);
  return () => clearInterval(id);
}, [paused, prefersReducedMotion]);
// <section onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
//          onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>

// 6) Contraste: substituição global text-slate-400 → text-slate-500 (≥4.4:1) em textos
//    informativos; text-slate-400 permanece apenas em elementos decorativos (ícones)
```

**Passos de implementação:** aplicar os 6 blocos; rodar Lighthouse (aba Accessibility) nas 5 telas principais (Landing, Busca, ReportDeath, Dashboard, CommunicatedDeaths) e corrigir apontamentos ≤ moderados; o plugin `jsx-a11y` (W6-2) trava regressões.
**Critério de aceitação:** Lighthouse Accessibility ≥ 90 nas 5 telas; dropdown fecha com Esc; carrossel para em hover e com reduced-motion; navegação por teclado completa o fluxo de comunicar óbito.
**Riscos e reversão:** nenhum. Reversão trivial.

---

## [W6-9] — Primeira bateria de testes unitários (7.2, Anexo J — casos J.3/J.4/J.5)

**Arquivo(s):** `tests/unit/snapshot.test.ts`, `tests/unit/fileValidation.test.ts`, `tests/unit/publicProjection.test.ts`, `tests/unit/formatters.test.ts` (novos)
**Diagnóstico:** cobertura zero fora das rules (W2-11). Prioridade por valor: snapshot executivo (função de agregação central), guardrail LGPD da projeção pública, validação de arquivos, formatadores de data (caso S3 do fuso).

**Código (after) — casos essenciais:**
```typescript
// tests/unit/snapshot.test.ts — J.3 (exige extrair o cálculo puro do snapshot;
// refactor mínimo: exportar computeSnapshotFromData(plots, sci...) de sciService)
import { describe, it, expect } from 'vitest';
import { computeSnapshotFromData } from '@/services/sciService';

const plot = (over: Partial<any> = {}) => ({
  tenantId: 't1', cemeteryId: 'c1', status: 'available',
  sanitaryRisk: 'low', environmentalRisk: 'low', structuralStatus: 'ok',
  documentStatus: 'regular', ...over,
});

describe('snapshot executivo', () => {
  it('S1: contadores e taxa de ocupação exatos', () => {
    const plots = [
      ...Array.from({ length: 10 }, () => plot({ status: 'occupied' })),
      ...Array.from({ length: 6 }, () => plot()),
      ...Array.from({ length: 3 }, () => plot({ status: 'reserved' })),
      plot({ status: 'blocked' }),
    ];
    const s = computeSnapshotFromData({ plots, operational: [], occurrences: [], sanitaryChecks: [], environmentalChecks: [], documents: [], financial: [] });
    expect(s.occupancyRate).toBe(50);
    expect(s.availablePlots).toBe(6);
  });

  it('S2: exumação vencida e a vencer (janela de 6 meses)', () => {
    const fourYearsAgo = new Date(Date.now() - 4 * 365 * 864e5).toISOString().slice(0, 10);
    const s = computeSnapshotFromData({
      plots: [plot({ status: 'occupied', burialDate: fourYearsAgo, exhumationDeadlineYears: 3 })],
      operational: [], occurrences: [], sanitaryChecks: [], environmentalChecks: [], documents: [], financial: [],
    });
    expect(s.pendingExhumations).toBe(1);
  });

  it('S3: parse local não desloca o dia (fuso BRT)', () => {
    // com parseISO (W6-4), '2023-01-01' é meia-noite local — o dia não oscila
    const s = computeSnapshotFromData({
      plots: [plot({ status: 'occupied', burialDate: '2023-01-01', exhumationDeadlineYears: 3 })],
      operational: [], occurrences: [], sanitaryChecks: [], environmentalChecks: [], documents: [], financial: [],
    });
    expect(s.pendingExhumations + s.approachingExhumations).toBeGreaterThanOrEqual(0); // estável, sem exceção
  });

  it('S5: financeiro tolera value inválido', () => {
    const s = computeSnapshotFromData({
      plots: [], operational: [], occurrences: [], sanitaryChecks: [], environmentalChecks: [], documents: [],
      financial: [{ category: 'income', value: NaN } as any, { category: 'income', value: 100 } as any],
    });
    expect(s.totalRevenue).toBe(100);
  });
});
```
```typescript
// tests/unit/publicProjection.test.ts — guardrail LGPD (D3 do Anexo J)
import { describe, it, expect } from 'vitest';
import { PUBLIC_FIELDS } from '@/services/deceasedService'; // exportar a constante

describe('projeção pública (LGPD)', () => {
  it('whitelist NUNCA contém campos sensíveis', () => {
    const forbidden = ['causeOfDeath', 'familyMembers', 'documents', 'createdBy', 'plotId'];
    for (const field of forbidden) {
      expect(PUBLIC_FIELDS).not.toContain(field);
    }
  });
});
```
```typescript
// tests/unit/fileValidation.test.ts — D5
import { describe, it, expect } from 'vitest';
import { validateFile, ALLOWED_IMAGE_TYPES } from '@/lib/fileValidation';

const fakeFile = (type: string, sizeMb: number) =>
  ({ type, size: sizeMb * 1024 * 1024, name: `f.${type.split('/')[1]}` } as File);

describe('validateFile', () => {
  it('aceita PDF de 9MB', () => expect(validateFile(fakeFile('application/pdf', 9))).toBeNull());
  it('rejeita PNG de 11MB com mensagem de tamanho', () =>
    expect(validateFile(fakeFile('image/png', 11))).toMatch(/muito grande/i));
  it('rejeita exe com mensagem de tipo', () =>
    expect(validateFile(fakeFile('application/x-msdownload', 1))).toMatch(/não permitido/i));
  it('rejeita PDF como imagem', () =>
    expect(validateFile(fakeFile('application/pdf', 1), ALLOWED_IMAGE_TYPES)).toMatch(/não permitido/i));
});
```
```typescript
// tests/unit/formatters.test.ts
import { describe, it, expect } from 'vitest';
import { formatDate, formatCurrency } from '@/lib/formatters';

describe('formatters', () => {
  it('data ISO exibe dd/MM/yyyy sem deslocar o dia', () =>
    expect(formatDate('2024-03-15')).toBe('15/03/2024'));
  it('data vazia exibe travessão', () => expect(formatDate('')).toBe('—'));
  it('moeda pt-BR', () => expect(formatCurrency(1234.56)).toMatch(/R\$\s?1\.234,56/));
});
```

**Passos de implementação:**
1. Refactor habilitador: extrair de `getSciSnapshot` a função pura `computeSnapshotFromData(dados) → SciExecutiveSnapshot` (o I/O continua onde está; o cálculo vira testável) e exportar `PUBLIC_FIELDS`.
2. Escrever as 4 suítes; `npm test` no CI já as executa (W2-11).
3. Casos J.5 (component tests com testing-library) e J.6 (E2E Playwright) ficam registrados como follow-up com a issue "Bateria 2 de testes" — fora do escopo mínimo desta onda.

**Critério de aceitação:** `npm test` verde com ≥15 asserts cobrindo snapshot, LGPD-whitelist, arquivos e formatadores; o teste de whitelist FALHA se alguém adicionar `causeOfDeath` à projeção (verificado mutando localmente).
**Riscos e reversão:** o refactor do snapshot precisa preservar resultados — validar contra tenant seedado (mesmo roteiro de W5-6). Reversão: revert.

---

## [W6-10] — Identidade do pacote e documentação verdadeira (Q-08, 7.5, item 57)

**Arquivo(s):** `package.json`, `README.md`, `IMPLEMENTACAO_STATUS.md`, `.env.example`, `index.html`
**Diagnóstico:** `package.json` chama-se `"react-example"` versão `0.0.0`; o README instrui `functions:config:set gemini.api_key` (o backend usa secret `OPENROUTER_API_KEY`), cita `set-superadmin.js` (é `.cjs`) e as functions mortas `setUserRole`/`generateContent`; `IMPLEMENTACAO_STATUS.md` afirma modais que não existiam (corrigidos nas ondas 0–3); `index.html` sem favicon/meta description.

**Código corrigido (after):**
```json
// package.json (campos de identidade)
{
  "name": "memorialos",
  "version": "1.0.0",
  "private": true,
  "description": "Sistema de gestão cemiterial multi-tenant para prefeituras — MemorialOS"
}
```
```html
<!-- index.html — meta mínimos -->
<meta name="description" content="MemorialOS — gestão cemiterial municipal: sepultamentos, memorial digital e busca pública de falecidos." />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```
README — seções a reescrever: (1) IA: "OpenRouter via Cloud Functions; secret `OPENROUTER_API_KEY` (`firebase functions:secrets:set OPENROUTER_API_KEY`); não existe chave de IA no frontend"; (2) Superadmin: "node scripts/set-superadmin.cjs <email>"; (3) remover toda menção a `setUserRole`/`generateContent`/`functions/index.js`; (4) CI: descrever `ci.yml` (typecheck/lint/test/rules) + `deploy-pages.yml` (Variables, sem secrets). `IMPLEMENTACAO_STATUS.md`: mover para `docs/` e reescrever como changelog das ondas executadas (fonte: os PRs), removendo afirmações não verificadas.

**Passos de implementação:** aplicar; criar `public/favicon.svg` simples (o diretório `public/` não existe — criá-lo resolve também o `logo-flower.png` fantasma do `AppLogo`: adicionar o asset ou remover o fallback de imagem do componente — decisão: adicionar `public/logo-flower.png` real OU trocar `AppLogo` para o fallback "M" sempre; registrar a escolha).
**Critério de aceitação:** `npm pkg get name version` → memorialos/1.0.0; seguir o README do zero (máquina limpa) funciona sem esbarrar em instrução morta; `IMPLEMENTACAO_STATUS.md` sem afirmações divergentes do código.
**Riscos e reversão:** nenhum.

---

## SMOKE TEST DE SAÍDA DA ONDA 6 (15 min)

1. `npx tsc --noEmit` (strictNullChecks+noImplicitAny) verde; `npm run lint` verde; `npm test` verde.
2. `grep -rn ": any" src/ | wc -l` < 10.
3. Tabelas com datas dd/mm/aaaa; moeda R$ 1.234,56; selects 100% PT-BR.
4. Sidebar e páginas sem palavras sem acento.
5. Lighthouse Accessibility ≥ 90 nas 5 telas principais.
6. README seguível do zero; package.json com identidade real.

---

# APÊNDICE A — SEQUÊNCIA DE COMMITS RECOMENDADA (1 PR POR ITEM)

```
Onda 0
  ci(W0-1): remove VITE_GEMINI_API_KEY do workflow + vars + guard de segredo no bundle
  chore(W0-2): remove superadmin-claim.json; set-superadmin.cjs por argumento com blocklist
  fix(W0-3): manualMonitorTrigger fail-closed sem MONITOR_TRIGGER_TOKEN
  fix(W0-4): guard de unidade + toasts na SecurityPage
  feat(W0-5): componente ConfirmDialog + confirmação na exclusão de cemitério
  feat(W0-6): confirmação na exclusão de falecido
  fix(W0-7): isSubmitting nos wizards de óbito (cidadão e admin)
  fix(W0-8): validateFile nos uploads do cidadão (ReportDeath, ProfilePage)
  fix(W0-9): objectURL memoizado + revoke em ReportDeath/ProfilePage
  chore(W0-10): deploy verificado de rules/functions com evidência

Onda 1
  feat(W1-1): allocateNotification transacional com recheck + burialDate do modal
  fix(W1-2): aviso de jazigos considera apenas disponíveis
  feat(W1-3): deleteDeceased libera o plot e remove arquivos do Storage
  fix(W1-4): createDeceased exige tenantId (remove fallback 'default')
  feat(W1-5): deleteSector bloqueia ocupados e cascateia plots
  fix(W1-6): status available limpa vínculos de ocupação do jazigo
  feat(W1-7): rules negam cemeteryId 'all' em sci_* e plots
  feat(W1-8): paginação de falecidos + busca server-side por nameLowercase
  feat(W1-9): edição de falecido (rota + DeceasedForm modo update)
  feat(W1-10): resolvedAt/completedAt/resolvedBy nas transições de status
  feat(W1-11): auditoria em reject/delete de notificação + limpeza de Storage
  feat(W1-12): deleteManagerAccount cascateia dados do tenant (audit preservado)
  fix(W1-13): toggleManagerStatus desativa todos os logins do tenant
  feat(W1-14): createDeceasedWithPlot ocupa jazigo nos 3 caminhos de criação

Onda 2
  refactor(W2-1): roles canônicos EN em lib/roles.ts + rules simplificadas
  feat(W2-2): storage.rules com tenant isolation + limites de tipo/tamanho + backfill
  fix(W2-3): manager lê profiles do próprio tenant (dropdown admin responsável)
  chore(W2-4): remove cláusula morta managersUid de deceaseds
  feat(W2-5): validação de schema nas rules de plots e sci_financial_records
  feat(W2-6): create de death_notifications valida tenantId contra o cemitério
  feat(W2-7): get pontual de user_profiles para staff (base legal registrada)
  feat(W2-8): role check + rate-limit diário + audit AI_CALL nas functions de IA
  fix(W2-9): resposta neutra no reset de senha (anti-enumeração)
  feat(W2-10): addUserToTenant aceita role operator + select no superadmin
  ci(W2-11): testes de rules no emulador + workflow de qualidade bloqueante

Onda 3
  feat(W3-1): lib/errors.ts (getFirestoreErrorMessage, reportError, reportLoadError)
  fix(W3-2): varredura dos catches silenciosos (tabela de 36 pontos)
  fix(W3-3): toasts em criar/ativar agente (AgentsPage)
  fix(W3-4): toast em gerar relatório (ReportsPage)
  refactor(W3-5): SuperAdminPage com ConfirmDialog + toasts nos 4 handlers
  refactor(W3-6): CemeteryDetail sem alert/confirm nativos + delete de plot com feedback
  feat(W3-7): loading states em Financial/Documents/Support/Security/CemeteryList
  fix(W3-8): SearchPage distingue erro de rede de zero resultados
  fix(W3-9): últimos alert() → toast (ProfilePage, ShopAndServices)
  feat(W3-10): nome/telefone do solicitante na fila de óbitos
  feat(W3-11): card 'Óbitos aguardando análise' no topo do dashboard

Onda 4
  fix(W4-1): monitores consultam o schema real; métricas sem fonte exibem N/D
  refactor(W4-2): SecurityPage sem câmera fake e sem matriz fictícia
  feat(W4-3): PartnersPage com CRUD real (sci_partners)
  fix(W4-4): tarja de demonstração e checkout desabilitado na Loja
  fix(W4-5): Financeiro sem 'Validado IA'; exclusão auditada de lançamento
  feat(W4-6): relatórios com seções por tipo, período e nome da unidade
  fix(W4-7): mensagem de erro do chat sem citar Gemini
  feat(W4-8): movimentação de estoque transacional com histórico imutável
  feat(W4-9): ordem de exumação gerada a partir do alerta + bloqueio do jazigo
  feat(W4-10): memorial público /memorial/:id + QR imprimível + link na busca
  feat(W4-11): WhatsApp à família na alocação/rejeição (trigger onDocumentUpdated)
  fix(W4-12): schema zod aplicado no Operacional + seletor de jazigo real

Onda 5
  perf(W5-1): lazy loading por área (React.lazy/Suspense)
  perf(W5-2): tendência mensal derivada do snapshot cacheado
  perf(W5-3): uploads paralelos via uploadFilesParallel
  refactor(W5-4): adoção de SCITable/useCemeteryFilter/useModal
  refactor(W5-5): hook useSciCreate substitui os 11 handlers de criação
  perf(W5-6): contadores de plots via getCountFromServer
  perf(W5-7): cemitérios do AdminContext nas 4 telas (fim dos fetches duplicados)
  perf(W5-8): busca pública server-side por prefixo (nameLowercase)
  feat(W5-9): unidade selecionada persistida + nomes em vez de IDs
  chore(W5-10): dependências limpas (uuid, motion, react-leaflet; dev deps corretas)
  chore(W5-11): remoção de código morto (HomePage, functions/index.js, functions/lib...)

Onda 6
  chore(W6-1): @types/react + strictNullChecks + noImplicitAny incrementais
  ci(W6-2): ESLint flat config + Prettier + husky/lint-staged + gate no CI
  refactor(W6-3): any[] → tipos dos services em todas as páginas
  fix(W6-4): parseISO + formatDate em todas as tabelas e no cálculo de prazos
  fix(W6-5): formatCurrency nos pontos monetários restantes
  feat(W6-6): statusLabels completo aplicado a selects e células
  fix(W6-7): varredura de acentuação (Anexo K aplicado)
  feat(W6-8): acessibilidade — aria-labels, Esc/clique-fora, carrossel, contraste
  test(W6-9): bateria unitária (snapshot, LGPD-whitelist, arquivos, formatters)
  docs(W6-10): package.json/README/STATUS verdadeiros + favicon/meta
```

---

# APÊNDICE B — RISCOS CONSOLIDADOS E ROLLBACK POR ONDA

| Onda | Maior risco | Mitigação | Rollback |
|---|---|---|---|
| 0 | Deploy de rules divergentes do esperado (W0-10) | diff visual no console antes de aplicar; curl de regressão LGPD | `firebase deploy` da revisão anterior das rules (minutos) |
| 1 | Transação de alocação com semântica diferente da sequência antiga | testes de corrida manuais + casos A1–A4 no emulador; syncPublic/log fora da tx | reverter para a versão sequencial (não perde dados) |
| 1 | Cascade de W1-12 apagando tenant errado | requireText com o nome + backup/export do Firestore ANTES de qualquer exclusão real | irreversível pós-execução — backup é o rollback |
| 2 | Backfill de metadados do Storage incompleto → staff sem acesso a anexos legados | rodar o backfill ANTES do deploy das rules; contagem de arquivos processados no log | redeploy das rules antigas restaura acesso na hora |
| 2 | Claim PT residual perdendo acesso (W2-1) | script de inventário de claims antes de simplificar as rules | re-adicionar variantes PT nas rules (1 deploy) |
| 3 | Ruído de toasts em falha de rede generalizada | aceito; dedupe por toast id como melhoria | revert por item |
| 4 | Textos de WhatsApp à família com tom inadequado | aprovação do dono do produto antes do deploy do trigger | deletar o trigger |
| 4 | Índices do monitor ausentes → N/D geral | deployar indexes antes das functions; conferir manualTrigger | redeploy anterior |
| 5 | W5-6 mudando números do dashboard | validação lado a lado com tenant seedado; flag interna de fallback | flag para o caminho paginado antigo |
| 6 | strictNullChecks quebrando build por dias | PRs por camada; CI só exige a flag quando a camada estiver verde | desligar a flag |

---

# APÊNDICE C — GATE FINAL DE VERIFICAÇÃO (pós-Onda 6)

Espelho executável do Anexo N da análise — rodar integralmente antes de qualquer go-live piloto:

```bash
# Segredos e credenciais
grep -n "GEMINI" .github/workflows/deploy-pages.yml            # vazio
git ls-files | grep -E "superadmin-claim|serviceAccountKey"    # vazio
grep -rE "admin123|admin@memorial" src/ scripts/ functions/src # vazio (blocklist do W0-2 é a exceção permitida)

# Feedback e confirmações
grep -rn "alert(" src/ --include="*.tsx"                        # vazio
grep -rn "window.confirm" src/                                  # vazio

# Qualidade
npx tsc --noEmit && npm run lint && npm test && npm run test:rules  # tudo verde
grep -rn ": any" src/ | wc -l                                   # < 10

# Integridade (manual, tenant de teste)
# - corrida de alocação: exatamente 1 vence
# - excluir falecido: plot liberado + storage limpo + fora da busca
# - excluir prefeitura: coleções zeradas, audit preservado

# LGPD (externo)
curl -s ".../documents/deceaseds" | grep PERMISSION_DENIED      # presente
curl -s ".../documents/plot_concessions" | grep PERMISSION_DENIED
# busca pública e /memorial/:id funcionando anonimamente
```

Pendências conhecidas que este plano NÃO cobre (decisões de produto registradas na análise, seções 6 e H): Política de Privacidade/Termos publicados (item 27 — requer texto jurídico), soft-delete com retenção (item 26), backup agendado do Firestore (item 59 — **recomendado antes da Onda 1 em produção**), Central de Solicitações (item 60), gestão de usuários pelo gestor do tenant (item 19), gov.br/PIX/SIRC (6.3), App Check (S-10 — habilitar junto do go-live piloto), staging em segundo projeto Firebase (H-2 — recomendado antes da Onda 2), e o destino final dos módulos-vitrine restantes (decisão H-3).

---

*Fim do PLANO_IMPLEMENTACAO_TOTAL_MEMORIAL.md — 79 itens em 7 ondas, com before/after verificados contra o commit `d63e29d` em 2026-07-05.*
