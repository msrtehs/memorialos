# PLANO DE CORREÇÕES — MemorialOS

**Data de elaboração**: 2026-07-03  
**Analista**: Engenheiro Sênior (análise estática completa do código-fonte)  
**Stack**: React 19 + Vite 6 + TypeScript + Tailwind 4 + Firebase (Auth, Firestore, Storage) — deploy em GitHub Pages com HashRouter

---

## SUMÁRIO EXECUTIVO

Este documento cataloga **27 problemas** encontrados na análise do código-fonte do MemorialOS, organizados em 5 etapas de implementação por criticidade e dependências. Os problemas críticos (C1–C5) expõem o sistema a acesso irrestrito por qualquer pessoa na internet e violação da LGPD — **devem ser corrigidos antes de qualquer release ou exposição pública do domínio**.

### Ordem obrigatória de implementação

```
Etapa 1 (Segurança Crítica)  →  Etapa 2 (Fluxos Quebrados)  →  Etapa 3 (Integridade Operacional)
     C1, C2, C3, C4, C5              A1, A2, A3                      A4, A5, A6, A7
         ↓
Etapa 4 (Qualidade)  →  Etapa 5 (Débito Técnico)
  M1–M9                   B1–B5
```

**A Etapa 1 é bloqueante**: C1 cria o superadmin demo que A1 depende de remover; C2 expõe as mesmas coleções que M8 tenta restringir; o sistema de roles limpo (A1) é pré-requisito para o fluxo de alocação correto (A2).

---

## ETAPA 1 — SEGURANÇA CRÍTICA

> **Critério de bloqueio**: nenhum commit deve ir para a branch `main` (ou qualquer branch com deploy automático) sem que todos os itens desta etapa estejam resolvidos.

---

### C1 — Backdoor público com senha hardcoded

**Arquivos afetados**:
- `src/pages/auth/LoginPage.tsx` linhas 44–56
- `src/contexts/AuthContext.tsx` linhas 51–53
- `firestore.rules` linhas 11–22
- `storage.rules` linhas 11–22

#### Diagnóstico

O botão "Acesso para Gestores" chama `signInWithEmailAndPassword(auth, 'admin@memorial.com', 'admin123')` diretamente no código-fonte. Como o Vite compila o bundle para GitHub Pages sem ofuscação de strings, qualquer visitante pode abrir o DevTools, procurar `admin@memorial.com` no bundle JS e obter as credenciais completas.

Após o login com esse e-mail, `AuthContext.tsx:51–53` eleva o role para `superadmin` **no cliente**:

```typescript
// ATUAL — AuthContext.tsx:51-53
if (currentUser.email === 'admin@memorial.com' || currentUser.email === 'gestor@memorial.com') {
  userRole = 'superadmin';
}
```

As regras do Firestore e Storage **replicam esse bypass no servidor** via `isDemoSuperAdmin()`, concedendo escrita irrestrita em todos os tenants a qualquer um que entre com esse e-mail:

```javascript
// ATUAL — firestore.rules:16-22
function isDemoSuperAdmin() {
  return isSignedIn()
    && (
      request.auth.token.email == 'admin@memorial.com'
      || request.auth.token.email == 'gestor@memorial.com'
    );
}
```

#### Por que é um problema

Qualquer pessoa na internet pode obter controle administrativo total: criar/excluir cemitérios, alterar registros de qualquer tenant, ler dados pessoais de falecidos, e gravar em Storage sem restrição.

#### Implementação passo a passo

**Passo 1.1 — Remover o botão de acesso demo de `LoginPage.tsx`**

```typescript
// ANTES — src/pages/auth/LoginPage.tsx (linhas 44-56 e 107-117)
const handleManagerAccess = async () => {
  try {
    await signInWithEmailAndPassword(auth, 'admin@memorial.com', 'admin123');
  } catch (error) {
    console.error("Erro no acesso de gestor:", error);
  }
};

// ... no JSX:
<div className="mt-8 pt-6 border-t border-slate-100">
  <button 
    onClick={handleManagerAccess}
    className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 py-2 rounded-lg transition-colors text-sm font-medium"
  >
    <ShieldCheck size={16} />
    Acesso para Gestores
  </button>
</div>
```

```typescript
// DEPOIS — remover completamente a função handleManagerAccess e o bloco JSX do botão.
// Remover também o import de ShieldCheck se não for usado em outro lugar.
// O import de signInWithEmailAndPassword permanece pois é usado no onSubmit.
```

**Passo 1.2 — Remover o override de role em `AuthContext.tsx`**

```typescript
// ANTES — src/contexts/AuthContext.tsx (linhas 47-57)
const tokenResult = await getIdTokenResult(currentUser);
let userRole = (tokenResult.claims.role as string) || 'citizen';

// DEMO OVERRIDE: Allow specific email to be superadmin
if (currentUser.email === 'admin@memorial.com' || currentUser.email === 'gestor@memorial.com') {
  userRole = 'superadmin';
}

setRole(userRole);
setTenantId((tokenResult.claims.tenantId as string) || currentUser.uid);
```

```typescript
// DEPOIS — src/contexts/AuthContext.tsx
const tokenResult = await getIdTokenResult(currentUser);
const userRole = (tokenResult.claims.role as string) || 'citizen';
const userTenantId = (tokenResult.claims.tenantId as string) || null;

setRole(userRole);
setTenantId(userTenantId);
```

> **Atenção**: com `tenantId` podendo ser `null` para usuários sem claim, todos os locais que usam `tenantId` do contexto precisam verificar nulidade. O AdminContext e as páginas admin já fazem `if (!tenantId) return;` — confirme após a mudança.

**Passo 1.3 — Remover `isDemoSuperAdmin` das regras do Firestore**

```javascript
// ANTES — firestore.rules (linhas 11-22)
function isDemoSuperAdmin() {
  return isSignedIn()
    && (
      request.auth.token.email == 'admin@memorial.com'
      || request.auth.token.email == 'gestor@memorial.com'
    );
}

function isSuperAdmin() {
  return hasRole('superadmin') || isDemoSuperAdmin();
}
```

```javascript
// DEPOIS — firestore.rules
function isSuperAdmin() {
  return hasRole('superadmin');
}
// Apagar completamente a função isDemoSuperAdmin.
```

**Passo 1.4 — Remover `isDemoSuperAdmin` das regras do Storage**

```javascript
// ANTES — storage.rules (linhas 11-22)
function isDemoSuperAdmin() {
  return isSignedIn()
    && (
      request.auth.token.email == 'admin@memorial.com'
      || request.auth.token.email == 'gestor@memorial.com'
    );
}

function isSuperAdmin() {
  return hasRole('superadmin') || isDemoSuperAdmin();
}
```

```javascript
// DEPOIS — storage.rules
function isSuperAdmin() {
  return hasRole('superadmin');
}
// Apagar completamente isDemoSuperAdmin.
```

**Passo 1.5 — Criar o superadmin real via Cloud Function**

A conta `admin@memorial.com` existente no Firebase Auth precisa ter o custom claim `role: 'superadmin'` atribuído via SDK admin para que o painel continue funcionando. Execute uma vez no console Node.js ou crie um script temporário:

```javascript
// scripts/set-superadmin.js (executar uma vez, depois apagar)
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function setSuperAdmin(email) {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, {
    role: 'superadmin',
    tenantId: null  // superadmin não pertence a um tenant específico
  });
  console.log(`Done: ${email} => superadmin`);
}

setSuperAdmin('admin@memorial.com').then(() => process.exit(0));
```

**Passo 1.6 — Implantar as regras atualizadas**

```bash
firebase deploy --only firestore:rules,storage
```

#### Critério de aceitação

- [ ] Bundle JS gerado (`npm run build`) não contém a string `admin@memorial.com` ou `admin123`
- [ ] Login com `admin@memorial.com` / `admin123` funciona (credencial válida no Firebase), mas o role vem do custom claim — sem override no cliente
- [ ] Regras do Firestore rejeitam tentativa de escrita em `tenants/` com um token cujo email seja `admin@memorial.com` mas sem o custom claim `role: 'superadmin'`
- [ ] `isDemoSuperAdmin` não aparece em `firestore.rules` nem em `storage.rules`

---

### C2 — Dados pessoais públicos sem login (LGPD)

**Arquivos afetados**: `firestore.rules` linhas 55–89

#### Diagnóstico

As regras atuais permitem leitura anônima das coleções mais sensíveis do sistema:

```javascript
// ATUAL — firestore.rules
match /plots/{plotId} {
  allow read: if true;   // concessionHolder (nome), concessionStartDate público
  ...
}

match /plot_concessions/{concessionId} {
  allow read: if true;   // holderDocument (CPF) público
  ...
}

match /deceaseds/{deceasedId} {
  allow read: if true;   // causeOfDeath, familyMembers, certidões de óbito público
  ...
}
```

A interface `PlotConcession` em `cemeteryService.ts` contém `holderDocument?: string // CPF` — um dado pessoal sensível nos termos do Art. 5º, inciso II da LGPD. `Deceased` contém `causeOfDeath` — dado de saúde, categoria especial (Art. 11 da LGPD). Qualquer script anônimo pode executar `getDocs(collection(db, 'deceaseds'))` e baixar toda a base.

#### Por que é um problema

Violação direta da LGPD, artigos 7º (base legal), 11º (dados sensíveis) e 46º (medidas de segurança). Além da multa (até 2% do faturamento, limitado a R$ 50 milhões), expõe a prefeitura/cemitério a processos civis das famílias.

#### Implementação passo a passo

**Passo 2.1 — Restringir leitura de `deceaseds` a staff autenticado**

Dados como `causeOfDeath`, `familyMembers` e URLs de certidão de óbito não devem ser públicos. A busca pública de falecidos (quando existir) deve usar uma coleção separada com apenas nome, datas e ID do memorial.

```javascript
// ANTES — firestore.rules
match /deceaseds/{deceasedId} {
  allow read: if true;
  allow create: if isStaff(request.resource.data.tenantId);
  allow update, delete: if isStaff(resource.data.tenantId);
}
```

```javascript
// DEPOIS — firestore.rules
match /deceaseds/{deceasedId} {
  // Leitura pública apenas dos campos não-sensíveis — via documento público separado ou projeção.
  // Até que uma coleção pública dedicada seja criada, acesso restrito a staff.
  allow read: if isStaff(resource.data.tenantId)
              || (isSignedIn() && request.auth.uid in resource.data.managersUid);
  allow create: if isStaff(request.resource.data.tenantId);
  allow update, delete: if isStaff(resource.data.tenantId);
}
```

**Passo 2.2 — Restringir leitura de `plots` com dados de concessão**

```javascript
// ANTES
match /plots/{plotId} {
  allow read: if true;
  ...
}
```

```javascript
// DEPOIS
match /plots/{plotId} {
  // Dados básicos (código, status, setor) podem ser públicos para o mapa.
  // Dados de concessão (concessionHolder, holderDocument) apenas para staff.
  // Como o Firestore não suporta projeção por campo nas regras,
  // a solução correta é separar em duas coleções ou restringir tudo.
  allow read: if isSignedIn()
              && (isStaff(resource.data.tenantId)
                  || resource.data.status == 'available'); // mapa público só mostra disponíveis
  allow create: if isStaff(request.resource.data.tenantId);
  allow update, delete: if isStaff(resource.data.tenantId);
}
```

**Passo 2.3 — Restringir `plot_concessions` (CPF)**

```javascript
// ANTES
match /plot_concessions/{concessionId} {
  allow read: if true;
  ...
}
```

```javascript
// DEPOIS
match /plot_concessions/{concessionId} {
  allow read: if isStaff(resource.data.tenantId);
  allow create: if isStaff(request.resource.data.tenantId);
  allow update, delete: if isStaff(resource.data.tenantId);
}
```

**Passo 2.4 — Restringir `tenants` (dados cadastrais das prefeituras)**

```javascript
// ANTES
match /tenants/{tenantId} {
  allow read: if true;
  allow write: if isSuperAdmin();
}
```

```javascript
// DEPOIS
match /tenants/{tenantId} {
  // Nome e endereço do cemitério podem ser públicos, mas dados internos não.
  // Restringir write ao superadmin e read a usuários autenticados do tenant.
  allow read: if isSignedIn()
              && (isSuperAdmin()
                  || request.auth.token.tenantId == tenantId
                  || request.auth.token.role == 'citizen'); // cidadão pode ler info básica
  allow write: if isSuperAdmin();
}
```

**Passo 2.5 — Implantar e testar**

```bash
firebase deploy --only firestore:rules

# Testar com curl (deve retornar PERMISSION_DENIED):
# Substitua PROJECT_ID e COLLECTION pelo real
curl "https://firestore.googleapis.com/v1/projects/PROJECT_ID/databases/(default)/documents/deceaseds?key=API_KEY"
# Esperado: { "error": { "code": 403, "status": "PERMISSION_DENIED" } }
```

#### Critério de aceitação

- [ ] `curl` anônimo para `deceaseds`, `plot_concessions`, `plots` retorna 403
- [ ] Usuário autenticado sem role de staff não consegue listar `deceaseds` de outro tenant
- [ ] Gestor logado com `tenantId` correto consegue ler normalmente
- [ ] `firebase emulators:start` + suite de testes de regras passa

---

### C3 — Cidadão pode forjar alocação de jazigo

**Arquivo afetado**: `firestore.rules` linhas 102–106

#### Diagnóstico

A regra atual para `death_notifications` permite que o criador da notificação a atualize sem restrição de campos:

```javascript
// ATUAL — firestore.rules:97-110
allow update: if isSignedIn()
              && (
                resource.data.createdBy == request.auth.uid
                || isStaff(resource.data.tenantId)
              );
```

Com o Firebase SDK diretamente no frontend, qualquer cidadão autenticado que criou uma notificação pode executar:

```javascript
// Qualquer usuário pode fazer isso hoje:
await updateDoc(doc(db, 'death_notifications', notificationId), {
  status: 'allocated',
  allocation: {
    cemeteryId: 'qualquer-id',
    sectorId: 'qualquer-id',
    plotId: 'jazigo-premium',
    assignedBy: auth.currentUser.uid,
    assignedAt: serverTimestamp()
  }
});
```

#### Por que é um problema

O fluxo de negócio exige que somente um gestor/operador possa aprovar uma solicitação. O bypass permite que cidadãos "auto-aprovem" sepultamentos, escolham jazigos premium ou alterem o status de solicitações rejeitadas.

#### Implementação passo a passo

**Passo 3.1 — Restringir campos que o criador pode alterar**

```javascript
// ANTES — firestore.rules
match /death_notifications/{notificationId} {
  allow create: if isSignedIn()
                && request.resource.data.createdBy == request.auth.uid;

  allow read: if isSignedIn()
              && (
                resource.data.createdBy == request.auth.uid
                || isStaff(resource.data.tenantId)
              );

  allow update: if isSignedIn()
                && (
                  resource.data.createdBy == request.auth.uid
                  || isStaff(resource.data.tenantId)
                );

  allow delete: if isSignedIn()
                && (
                  (
                    resource.data.createdBy == request.auth.uid
                    && resource.data.status == 'rejected'
                  )
                  || isStaff(resource.data.tenantId)
                );
}
```

```javascript
// DEPOIS — firestore.rules
match /death_notifications/{notificationId} {
  allow create: if isSignedIn()
                && request.resource.data.createdBy == request.auth.uid
                && request.resource.data.status == 'submitted'
                && !('allocation' in request.resource.data)
                && !('rejectionReason' in request.resource.data);

  allow read: if isSignedIn()
              && (
                resource.data.createdBy == request.auth.uid
                || isStaff(resource.data.tenantId)
              );

  // Cidadão só pode atualizar campos de dados do falecido enquanto status == 'submitted'
  // Staff pode atualizar qualquer campo (alocação, rejeição, status)
  allow update: if isStaff(resource.data.tenantId)
                || (
                  isSignedIn()
                  && resource.data.createdBy == request.auth.uid
                  && resource.data.status == 'submitted'
                  // Impede cidadão de alterar campos sensíveis de controle
                  && !request.resource.data.diff(resource.data).affectedKeys()
                      .hasAny(['status', 'allocation', 'rejectionReason', 'tenantId', 'createdBy'])
                );

  allow delete: if isSignedIn()
                && (
                  (
                    resource.data.createdBy == request.auth.uid
                    && resource.data.status == 'rejected'
                  )
                  || isStaff(resource.data.tenantId)
                );
}
```

#### Critério de aceitação

- [ ] Tentativa de `updateDoc` com `status: 'allocated'` por um usuário cidadão retorna `PERMISSION_DENIED`
- [ ] Gestor consegue alocar normalmente via `allocateNotification()`
- [ ] Cidadão consegue atualizar campos de dados pessoais (`deceased.name`, etc.) enquanto status é `submitted`
- [ ] Cidadão **não** consegue alterar `tenantId`, `createdBy`, `status`, `allocation` ou `rejectionReason`

---

### C4 — Chave Gemini exposta no bundle público

**Arquivo afetado**: `src/services/aiService.ts` linha 4

#### Diagnóstico

```typescript
// ATUAL — src/services/aiService.ts:4
function getAIClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}
```

Qualquer variável `VITE_*` é embutida literalmente no bundle JavaScript gerado pelo Vite. O arquivo `dist/assets/index-CmKPQgRm.js` já existe no repositório e provavelmente contém a chave. A key pode ser extraída em segundos com `grep 'AIza' dist/assets/*.js`.

#### Por que é um problema

A chave da API Gemini é associada a um projeto GCP. Qualquer pessoa pode usá-la para gerar conteúdo, consumindo a cota gratuita ou gerando fatura ilimitada. O Google pode revogar a chave sem aviso quando detectar abuso, quebrando o sistema em produção.

#### Implementação passo a passo

**Solução correta: proxy via Cloud Function**

**Passo 4.1 — Criar Cloud Function proxy para IA**

```javascript
// functions/index.js — adicionar após as funções existentes

const { GoogleGenAI } = require('@google/generative-ai'); // npm install @google/generative-ai

exports.generateContent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  // Rate limiting básico por UID (pode ser sofisticado com Firestore counter)
  const { prompt, model = 'gemini-2.5-flash', type } = data;
  const allowedTypes = ['obituary', 'chat', 'manager_agent'];
  if (!allowedTypes.includes(type)) {
    throw new functions.https.HttpsError('invalid-argument', 'Tipo de geração inválido.');
  }

  const apiKey = functions.config().gemini?.api_key 
                 || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new functions.https.HttpsError('internal', 'Serviço de IA não configurado.');
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });
    return { text: response.text || '' };
  } catch (error) {
    console.error('Gemini error:', error);
    throw new functions.https.HttpsError('internal', 'Erro ao gerar conteúdo.');
  }
});
```

```bash
# Configurar a chave no ambiente das Functions (não no .env do frontend)
firebase functions:config:set gemini.api_key="sua-chave-aqui"
firebase deploy --only functions
```

**Passo 4.2 — Atualizar `aiService.ts` para chamar a Function**

```typescript
// ANTES — src/services/aiService.ts
import { GoogleGenAI } from '@google/genai';

function getAIClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

export const generateObituary = async (data: any) => {
  const ai = getAIClient();
  if (!ai) return 'Serviço de IA indisponível...';
  const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
  return response.text || '';
};
```

```typescript
// DEPOIS — src/services/aiService.ts
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase'; // exportar `app` do firebase.ts

const functions = getFunctions(app);
const generateContentFn = httpsCallable<
  { prompt: string; type: string; model?: string },
  { text: string }
>(functions, 'generateContent');

export const generateObituary = async (data: any): Promise<string> => {
  const prompt = `
    Escreva um obituário respeitoso, acolhedor e emocionante para:
    Nome: ${data.name}
    Data de Nascimento: ${data.dateOfBirth}
    Data de Falecimento: ${data.dateOfDeath}
    ...
    O tom deve ser sereno, humano e confortante para a família.
    Escreva em português do Brasil. Máximo de 3 parágrafos.
  `;
  try {
    const result = await generateContentFn({ prompt, type: 'obituary' });
    return result.data.text;
  } catch (error: any) {
    console.error('Error generating obituary:', error);
    if (error.code === 'functions/unauthenticated') return 'Faça login para usar o gerador de obituário.';
    return 'Erro ao gerar obituário. Tente novamente.';
  }
};

export const chatWithMemorialAI = async (
  history: { role: 'user' | 'model'; parts: string }[],
  message: string,
  userContext?: string
): Promise<string> => {
  // Para chat com histórico, envie o histórico serializado no prompt
  const fullPrompt = [
    `Contexto: ${userContext || 'Não informado.'}`,
    ...history.map(h => `${h.role === 'user' ? 'Usuário' : 'Assistente'}: ${h.parts}`),
    `Usuário: ${message}`
  ].join('\n');
  
  const result = await generateContentFn({ prompt: fullPrompt, type: 'chat' });
  return result.data.text;
};

export const chatWithManagerAgent = async (
  agent: { name: string; objective: string; prompt: string; modules: string[] },
  history: { role: 'user' | 'model'; parts: string }[],
  message: string,
  contextSummary: string
): Promise<string> => {
  const fullPrompt = [
    `Você é ${agent.name}. Objetivo: ${agent.objective}`,
    `Contexto: ${contextSummary}`,
    ...history.map(h => `${h.role === 'user' ? 'Usuário' : 'Assistente'}: ${h.parts}`),
    `Usuário: ${message}`
  ].join('\n');
  
  const result = await generateContentFn({ prompt: fullPrompt, type: 'manager_agent' });
  return result.data.text;
};
```

**Passo 4.3 — Remover `VITE_GEMINI_API_KEY` do `.env` e `.env.example`**

```bash
# .env — remover a linha:
# VITE_GEMINI_API_KEY=...

# .env.example — substituir por:
# GEMINI_API_KEY configurada via: firebase functions:config:set gemini.api_key="..."
```

**Passo 4.4 — Revogar a chave anterior**

Acesse https://console.cloud.google.com/apis/credentials e revogue a chave `VITE_GEMINI_API_KEY` que estava no `.env`. Crie uma nova para usar nas Functions.

#### Critério de aceitação

- [ ] `grep 'AIza' dist/assets/*.js` não retorna nenhuma linha após o build
- [ ] `VITE_GEMINI_API_KEY` não existe em nenhum `.env*` (verificar com `grep -r VITE_GEMINI .`)
- [ ] Geração de obituário funciona para usuário autenticado
- [ ] Chamada sem autenticação retorna erro `unauthenticated`
- [ ] `npm run build && grep -r "AIzaSy" dist/` — sem resultados

---

### C5 — Trilha de auditoria gravável por qualquer usuário autenticado

**Arquivo afetado**: `firestore.rules` linhas 145–149, `src/services/audit.ts`

#### Diagnóstico

```javascript
// ATUAL — firestore.rules
match /audit_logs/{logId} {
  allow read: if isSuperAdmin();
  allow create: if isSignedIn();  // qualquer usuário autenticado grava!
  allow update, delete: if false;
}
```

E em `audit.ts`, os logs gravam `oldValue` e `newValue` completos — que podem conter CPF, causa da morte, e outros dados sensíveis:

```typescript
// ATUAL — src/services/audit.ts
await addDoc(collection(db, 'audit_logs'), {
  action,
  actorUid: auth.currentUser.uid,
  targetCollection,
  targetId,
  oldValue,   // dados completos, incluindo CPF e dados de saúde
  newValue,   // idem
  timestamp: serverTimestamp(),
  tenantId
});
```

Além disso, `audit.ts` contém a função `createDeceasedRecord` (linhas 51–61) que duplica a criação de falecidos com `deceasedService.ts` — resíduo de desenvolvimento que nunca foi removido.

#### Por que é um problema

1. Qualquer cidadão logado pode injetar entradas falsas nos logs de auditoria, manipulando evidências
2. Logs com payload completo duplicam dados pessoais sensíveis (LGPD) sem TTL ou política de retenção
3. `createDeceasedRecord` em `audit.ts` cria falecidos sem passar pelo fluxo de validação do `deceasedService`

#### Implementação passo a passo

**Passo 5.1 — Restringir criação de logs a staff**

```javascript
// DEPOIS — firestore.rules
match /audit_logs/{logId} {
  allow read: if isSuperAdmin() || isManager(resource.data.tenantId);
  allow create: if isSignedIn()
                && isStaff(request.resource.data.tenantId)
                && request.resource.data.actorUid == request.auth.uid
                && !('oldValue' in request.resource.data
                     ? request.resource.data.oldValue.keys().hasAny(['causeOfDeath', 'holderDocument'])
                     : false); // não permitir logs com campos sensíveis — use Cloud Function para logs completos
  allow update, delete: if false;
}
```

**Passo 5.2 — Remover payload completo dos logs do cliente**

```typescript
// ANTES — src/services/audit.ts
export async function logAction(
  tenantId: string, action: string, targetCollection: string,
  targetId: string, oldValue: any = null, newValue: any = null
) {
  await addDoc(collection(db, 'audit_logs'), {
    action, actorUid: auth.currentUser.uid,
    targetCollection, targetId,
    oldValue,  // dados completos
    newValue,  // dados completos
    timestamp: serverTimestamp(), tenantId
  });
}
```

```typescript
// DEPOIS — src/services/audit.ts
// Campos sensíveis que nunca devem ser logados do cliente
const SENSITIVE_FIELDS = ['causeOfDeath', 'holderDocument', 'password', 'documents'];

function sanitizeForLog(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const sanitized: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    sanitized[key] = SENSITIVE_FIELDS.includes(key) ? '[REDACTED]' : data[key];
  }
  return sanitized;
}

export async function logAction(
  tenantId: string, action: string, targetCollection: string,
  targetId: string, oldValue: any = null, newValue: any = null
) {
  if (!auth.currentUser) return;
  try {
    await addDoc(collection(db, 'audit_logs'), {
      action,
      actorUid: auth.currentUser.uid,
      targetCollection,
      targetId,
      // Gravar apenas diff resumido, sem campos sensíveis
      changedFields: newValue ? Object.keys(sanitizeForLog(newValue)) : [],
      timestamp: serverTimestamp(),
      tenantId
    });
  } catch (error) {
    // Log local em desenvolvimento, silencioso em produção
    if (import.meta.env.DEV) console.error('Failed to write audit log:', error);
  }
}
```

**Passo 5.3 — Remover `createDeceasedRecord` do audit.ts**

```typescript
// REMOVER completamente de src/services/audit.ts:
/**
 * Example function to create a deceased record with audit logging
 */
export async function createDeceasedRecord(tenantId: string, data: any) {
  // ... toda essa função
}
```

Verificar se `createDeceasedRecord` é importada em algum lugar (provavelmente não):
```bash
grep -r "createDeceasedRecord" src/
```

#### Critério de aceitação

- [ ] Usuário com role `citizen` não consegue criar um documento em `audit_logs`
- [ ] Nenhum log contém os campos `oldValue` ou `newValue` com dados brutos
- [ ] `createDeceasedRecord` não existe mais em `audit.ts`
- [ ] `grep -n "createDeceasedRecord" src/` — sem resultados

---

## ETAPA 2 — FLUXOS QUEBRADOS

> **Pré-requisito**: Etapa 1 completa. O sistema de roles limpo (sem override demo) deve estar funcionando antes de corrigir A1.

---

### A1 — Roles incompatíveis entre Cloud Function, regras e router

**Arquivos afetados**: `functions/index.js:28`, `src/App.tsx:95`, `src/components/ProtectedRoute.tsx:21`

#### Diagnóstico

A Cloud Function `setUserRole` em `functions/index.js:28` atribui apenas três roles:

```javascript
// functions/index.js:28
if (!['manager', 'operator', 'citizen'].includes(role)) {
  throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');
}
```

Mas o `ProtectedRoute` do frontend só aceita roles em português:

```typescript
// src/App.tsx:95
<Route element={<ProtectedRoute allowedRoles={['gestor', 'superadmin', 'operador']} />}>
```

Um usuário promovido pelo Cloud Function com `role: 'manager'` nunca passa pelo `ProtectedRoute` e é redirecionado para `/unauthorized` — que **não existe** como rota no `App.tsx`, causando um loop de redirect para `/` (o catch-all).

#### Por que é um problema

O fluxo de onboarding de gestores está completamente quebrado. Nenhum usuário promovido via Cloud Function consegue acessar o painel admin, forçando todos a usar o backdoor demo removido na Etapa 1.

#### Implementação passo a passo

**Decisão de design**: padronizar em inglês (`manager`, `operator`, `citizen`, `superadmin`) — as roles já estão em inglês no Firestore e na Cloud Function. O frontend é que está fora do padrão.

**Passo A1.1 — Atualizar `allowedRoles` no `App.tsx`**

```typescript
// ANTES — src/App.tsx
<Route element={<ProtectedRoute allowedRoles={['gestor', 'superadmin', 'operador']} />}>
```

```typescript
// DEPOIS — src/App.tsx
<Route element={<ProtectedRoute allowedRoles={['manager', 'superadmin', 'operator']} />}>
```

**Passo A1.2 — Atualizar redirect do `ProtectedRoute` e criar rota `/unauthorized`**

```typescript
// ANTES — src/components/ProtectedRoute.tsx
if (allowedRoles && role && !allowedRoles.includes(role)) {
  return <Navigate to="/unauthorized" replace />;  // rota inexistente
}
```

```typescript
// DEPOIS — src/components/ProtectedRoute.tsx
if (allowedRoles && role && !allowedRoles.includes(role)) {
  return <Navigate to="/acesso-negado" replace />;
}
```

**Passo A1.3 — Criar a página `UnauthorizedPage` e registrá-la**

```typescript
// CRIAR: src/pages/auth/UnauthorizedPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function UnauthorizedPage() {
  const { role } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-red-100">
        <ShieldOff className="mx-auto mb-4 text-red-400" size={48} />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Acesso negado</h1>
        <p className="text-slate-500 mb-2">
          Você não tem permissão para acessar esta área.
        </p>
        {role && (
          <p className="text-xs text-slate-400 mb-6">
            Seu perfil atual: <span className="font-mono bg-slate-100 px-1 rounded">{role}</span>
          </p>
        )}
        <Link
          to="/app/inicio"
          className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
```

```typescript
// src/App.tsx — adicionar import e rota
import UnauthorizedPage from '@/pages/auth/UnauthorizedPage';

// Dentro de <Routes>, antes do catch-all:
<Route path="/acesso-negado" element={<UnauthorizedPage />} />
<Route path="*" element={<Navigate to="/" replace />} />
```

**Passo A1.4 — Atualizar as regras do Firestore para aceitar roles em inglês (já fazem)**

Verificar `firestore.rules` — as funções `isManager` e `isOperator` já aceitam ambos os idiomas:

```javascript
// firestore.rules — já correto:
function isManager(tenantId) {
  return isSignedIn()
    && (request.auth.token.role == 'manager' || request.auth.token.role == 'gestor')
    && request.auth.token.tenantId == tenantId;
}
```

Após C1 ser corrigido e os roles legados em português forem extintos, simplificar para:

```javascript
function isManager(tenantId) {
  return isSignedIn()
    && request.auth.token.role == 'manager'
    && request.auth.token.tenantId == tenantId;
}
```

**Passo A1.5 — Atualizar redirect de login em `LoginPage.tsx`**

```typescript
// ANTES — src/pages/auth/LoginPage.tsx
if (['gestor', 'superadmin', 'operador'].includes(role)) {
  navigate('/admin/dashboard');
}
```

```typescript
// DEPOIS
if (['manager', 'superadmin', 'operator'].includes(role)) {
  navigate('/admin/dashboard');
}
```

#### Critério de aceitação

- [ ] Usuário com custom claim `role: 'manager'` e `tenantId` correto acessa `/admin/dashboard`
- [ ] Usuário com role `citizen` tentando acessar `/admin` é redirecionado para `/acesso-negado`
- [ ] A página `/acesso-negado` exibe corretamente o role atual do usuário
- [ ] Não existe mais nenhuma referência a `'gestor'` ou `'operador'` no código TypeScript

---

### A2 — Alocação de óbito não alimenta o sistema

**Arquivo afetado**: `src/services/notificationService.ts` linhas 216–234

#### Diagnóstico

```typescript
// ATUAL — src/services/notificationService.ts:216-234
export async function allocateNotification(
  notificationId: string, 
  allocationData: { cemeteryId: string; sectorId: string; plotId: string; plotCode?: string }
) {
  if (!auth.currentUser) return;

  const updateData = {
    status: 'allocated',
    allocation: {
      ...allocationData,
      assignedBy: auth.currentUser.uid,
      assignedAt: serverTimestamp()
    }
  };

  await updateDoc(doc(db, COLLECTION, notificationId), updateData);
  
  // Marca o plot como ocupado, mas NÃO:
  // 1. Cria registro em `deceaseds`
  // 2. Grava burialDate no plot
  // 3. Grava occupantName no plot
  await updateDoc(doc(db, 'plots', allocationData.plotId), {
    status: 'occupied',
    deceasedId: notificationId // ID da notificação, não de um registro em `deceaseds`!
  });
}
```

O resultado: `plots.burialDate` nunca é gravado, então `getSciExecutiveSnapshot` em `sciService.ts` calcula `pendingExhumations: 0` e `approachingExhumations: 0` mesmo quando há sepultamentos. O dashboard mostra dados errados.

#### Implementação passo a passo

**Passo A2.1 — Reescrever `allocateNotification` com fluxo completo**

```typescript
// DEPOIS — src/services/notificationService.ts
import { createDeceased } from '@/services/deceasedService';
import { updatePlot } from '@/services/cemeteryService';

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
    wakeDate: notif.deceased.wakeDate ?? undefined,
    wakeTime: notif.deceased.wakeTime ?? undefined,
    wakeLocation: notif.deceased.wakeLocation ?? undefined,
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

  return { notificationId, deceasedId };
}
```

**Passo A2.2 — Atualizar chamada em `CommunicatedDeaths.tsx`**

```typescript
// ANTES — src/pages/admin/CommunicatedDeaths.tsx
const handleConfirmAllocation = async () => {
  if (!selectedNotification?.id || !selectedCemetery || !selectedSector || !selectedPlot) return;
  try {
    const plot = plots.find(p => p.id === selectedPlot);
    await allocateNotification(selectedNotification.id, {
      cemeteryId: selectedCemetery,
      sectorId: selectedSector,
      plotId: selectedPlot,
      plotCode: plot?.code
    });
    // ...
  }
}
```

```typescript
// DEPOIS
const handleConfirmAllocation = async () => {
  if (!selectedNotification?.id || !selectedCemetery || !selectedSector || !selectedPlot || !tenantId) return;
  setIsSubmitting(true);
  try {
    const plot = plots.find(p => p.id === selectedPlot);
    await allocateNotification(selectedNotification.id, tenantId, {
      cemeteryId: selectedCemetery,
      sectorId: selectedSector,
      plotId: selectedPlot,
      plotCode: plot?.code
    });
    toast.success('Sepultamento alocado com sucesso. Registro de falecido criado.');
    setIsModalOpen(false);
    await fetchNotifications();
  } catch (error: any) {
    toast.error(`Erro ao alocar: ${error.message}`);
  } finally {
    setIsSubmitting(false);
  }
}
```

#### Critério de aceitação

- [ ] Após alocar uma notificação, aparece um novo documento em `deceaseds` com `cemeteryId`, `plotId` e `burialDate` preenchidos
- [ ] O `plot` correspondente tem `status: 'occupied'`, `burialDate` e `occupantName`
- [ ] `getSciExecutiveSnapshot` calcula `pendingExhumations` corretamente para sepultamentos de mais de 3 anos
- [ ] A notificação tem o campo `deceasedId` linkando ao registro criado

---

### A3 — Snapshot executivo sem cache nem paginação

**Arquivo afetado**: `src/services/sciService.ts`, função `getSciSnapshot` (~linha 380)

#### Diagnóstico

```typescript
// ATUAL — sciService.ts
async function getSciSnapshot(tenantId: string, cemeteryId: string): Promise<SciSnapshot> {
  const [plots, operational, occurrences, sanitaryChecks, environmentalChecks, documents, financial] =
    await Promise.all([
      getTenantPlots(tenantId),     // pode retornar 3.000+ documentos
      listOperationalRecords(tenantId),
      listOccurrenceRecords(tenantId),
      listSanitaryChecks(tenantId),
      listEnvironmentalChecks(tenantId),
      listDigitalDocuments(tenantId),
      listFinancialRecords(tenantId)
    ]);
  // ...
}
```

Essa função é chamada por `getSciExecutiveSnapshot`, que é chamado em **6 páginas diferentes** do painel admin. Sem cache, cada navegação de página dispara 7 queries ao Firestore, cada uma baixando a coleção inteira. Para um cemitério com 3.000 jazigos, isso são ~3.000 documentos por chamada.

#### Implementação passo a passo

**Passo A3.1 — Criar módulo de cache em memória com TTL**

```typescript
// CRIAR: src/lib/queryCache.ts
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 60_000; // 1 minuto

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
```

**Passo A3.2 — Adicionar paginação a `getTenantPlots` e cache ao snapshot**

```typescript
// sciService.ts — substituir getSciSnapshot
import { getCached, setCached } from '@/lib/queryCache';
import { limit, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';

// Paginação para plots: buscar em lotes de 500
async function getAllTenantPlotsWithPagination(tenantId: string): Promise<Plot[]> {
  const BATCH_SIZE = 500;
  const all: Plot[] = [];
  let lastDoc: QueryDocumentSnapshot | null = null;
  
  while (true) {
    const constraints = [
      where('tenantId', '==', tenantId),
      limit(BATCH_SIZE),
      ...(lastDoc ? [startAfter(lastDoc)] : [])
    ];
    const q = query(collection(db, 'plots'), ...constraints);
    const snap = await getDocs(q);
    if (snap.empty) break;
    all.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Plot)));
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }
  return all;
}

async function getSciSnapshot(tenantId: string, cemeteryId: string): Promise<SciSnapshot> {
  const cacheKey = `sci_snapshot:${tenantId}:${cemeteryId}`;
  const cached = getCached<SciSnapshot>(cacheKey);
  if (cached) return cached;

  const [plots, operational, occurrences, sanitaryChecks, environmentalChecks, documents, financial] =
    await Promise.all([
      getAllTenantPlotsWithPagination(tenantId),
      listOperationalRecords(tenantId),
      listOccurrenceRecords(tenantId),
      listSanitaryChecks(tenantId),
      listEnvironmentalChecks(tenantId),
      listDigitalDocuments(tenantId),
      listFinancialRecords(tenantId)
    ]);

  const snapshot: SciSnapshot = {
    plots: filterByCemetery(plots, cemeteryId),
    operational: filterByCemetery(operational, cemeteryId),
    occurrences: filterByCemetery(occurrences, cemeteryId),
    sanitaryChecks: filterByCemetery(sanitaryChecks, cemeteryId),
    environmentalChecks: filterByCemetery(environmentalChecks, cemeteryId),
    documents: filterByCemetery(documents, cemeteryId),
    financial: filterByCemetery(financial, cemeteryId)
  };

  setCached(cacheKey, snapshot, 60_000); // cache por 1 minuto
  return snapshot;
}
```

**Passo A3.3 — Invalidar cache após writes**

Em `sciService.ts`, nas funções de criação/atualização, chamar `invalidateCache`:

```typescript
import { invalidateCache } from '@/lib/queryCache';

export async function createOperationalRecord(tenantId: string, payload: ...) {
  const id = await createForTenant(tenantId, COLS.operational, 'CREATE_OPERATIONAL_RECORD', payload);
  invalidateCache(`sci_snapshot:${tenantId}`);
  return id;
}
// Replicar para: createOccurrenceRecord, createSanitaryCheck, createEnvironmentalCheck,
// createFinancialRecord, createStockItem, createDigitalDocument, e allocateNotification
```

#### Critério de aceitação

- [ ] Navegar entre 6 páginas do painel não dispara 6 × 7 = 42 queries ao Firestore
- [ ] Segunda visita à mesma página (dentro de 1 minuto) não acessa o Firestore
- [ ] Após criar um registro, a próxima visita ao dashboard reflete o novo dado (cache invalidado)
- [ ] Cemitério com 3.000 plots carrega sem timeout ou erro `quota-exceeded`

---

## ETAPA 3 — INTEGRIDADE OPERACIONAL

---

### A4 — Erros de gravação silenciosos em ~15 formulários

**Arquivos afetados**: todos os formulários admin (`OperationalPage.tsx`, `MaintenancePage.tsx`, `EnvironmentalPage.tsx`, `DocumentsCenterPage.tsx`, `SupportPage.tsx`, `SecurityPage.tsx`, `FinancialPage.tsx`, `InventoryPage.tsx`, `CommunicatedDeaths.tsx`, `DeceasedForm.tsx`)

#### Diagnóstico

O padrão dominante em todos os formulários admin é:

```typescript
// Padrão atual em ~15 formulários
const handleSubmit = async () => {
  try {
    await createOperationalRecord(tenantId, payload);
    setIsFormOpen(false); // sucesso silencioso
  } catch (error) {
    console.error('Error:', error); // erro invisível para o usuário
  }
};
```

Quando o Firestore rejeita a gravação (regra de segurança, quota, offline), o formulário fecha sem feedback. O usuário acredita ter gravado, mas nada foi persistido.

#### Implementação passo a passo

**Passo A4.1 — Criar sistema de toast**

```bash
npm install react-hot-toast
```

**Passo A4.2 — Adicionar `<Toaster>` ao layout raiz**

```typescript
// src/main.tsx ou src/App.tsx
import { Toaster } from 'react-hot-toast';

// Dentro do return do componente raiz:
<>
  <AuthProvider>
    <AppContent />
  </AuthProvider>
  <Toaster 
    position="top-right"
    toastOptions={{
      duration: 4000,
      success: { style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' } },
      error: { style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }, duration: 6000 },
    }}
  />
</>
```

**Passo A4.3 — Substituir o padrão em todos os formulários**

Template para aplicar em cada formulário:

```typescript
// ANTES (padrão atual)
import toast from 'react-hot-toast'; // adicionar

const handleSubmit = async () => {
  try {
    await createOperationalRecord(tenantId!, payload);
    setIsFormOpen(false);
  } catch (error) {
    console.error('Error creating record:', error);
  }
};
```

```typescript
// DEPOIS
import toast from 'react-hot-toast';

const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async () => {
  if (!tenantId) return;
  setIsSubmitting(true);
  try {
    await createOperationalRecord(tenantId, payload);
    toast.success('Registro criado com sucesso.');
    setIsFormOpen(false);
    await loadData(); // recarregar lista
  } catch (error: any) {
    const msg = error?.code === 'permission-denied'
      ? 'Sem permissão para esta operação.'
      : error?.message || 'Erro ao salvar. Tente novamente.';
    toast.error(msg);
    // NÃO fecha o formulário em caso de erro
  } finally {
    setIsSubmitting(false);
  }
};

// No botão de submit:
<button onClick={handleSubmit} disabled={isSubmitting}>
  {isSubmitting ? 'Salvando...' : 'Salvar'}
</button>
```

**Lista de formulários a atualizar** (aplicar o template acima em cada um):

| Arquivo | Funções a corrigir |
|---|---|
| `OperationalPage.tsx` | `handleCreateRecord`, `handleUpdateStatus` |
| `MaintenancePage.tsx` | `handleCreateOccurrence`, `handleUpdateOccurrence` |
| `EnvironmentalPage.tsx` | `handleCreateSanitary`, `handleCreateEnvironmental` |
| `DocumentsCenterPage.tsx` | `handleCreateDocument` |
| `SupportPage.tsx` | `handleCreateTicket`, `handleCreateTraining` |
| `FinancialPage.tsx` | `handleCreateRecord` |
| `InventoryPage.tsx` | `handleCreateStock` |
| `CommunicatedDeaths.tsx` | `handleConfirmAllocation`, `handleConfirmRejection` |
| `DeceasedForm.tsx` | `onSubmit` |
| `CemeteryList.tsx` | `handleDeleteCemetery`, `handleCreateCemetery` |

#### Critério de aceitação

- [ ] Submeter formulário com Firestore offline mostra toast de erro em vermelho
- [ ] Formulário **não** fecha após erro de gravação
- [ ] Submissão bem-sucedida mostra toast verde e fecha/reseta o formulário
- [ ] Botão de submit fica desabilitado durante o envio

---

### A5 — Botão de migração destrutiva exposto em produção

**Arquivo afetado**: `src/pages/admin/CommunicatedDeaths.tsx` linhas 151–157

#### Diagnóstico

```typescript
// ATUAL — CommunicatedDeaths.tsx:151-157
<button 
  onClick={() => fixWrongTenantIdsForNotifications().then(() => fetchNotifications())}
  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded border border-slate-300"
  title="Corrigir IDs (Dev Only)"
>
  Fix IDs
</button>
```

A função `fixWrongTenantIdsForNotifications` faz `getDocs(query(collection(db, 'death_notifications')))` — sem filtro de tenant — e reescreve `tenantId` em todos os documentos onde `tenantId == createdBy`. Em produção multitenant, isso pode reescrever dados de outros tenants se a lógica de detecção gerar falso-positivo.

#### Implementação passo a passo

**Passo A5.1 — Remover o botão da UI**

```typescript
// REMOVER de CommunicatedDeaths.tsx — o bloco completo:
<button 
  onClick={() => fixWrongTenantIdsForNotifications().then(() => fetchNotifications())}
  ...
>
  Fix IDs
</button>
```

**Passo A5.2 — Mover a função para um script de migração standalone**

```typescript
// CRIAR: scripts/migrate-tenant-ids.ts (executar via ts-node, não pelo app)
// Este script é executado uma única vez pelo desenvolvedor com credenciais admin
// e depois apagado do repositório.

// O código de fixWrongTenantIdsForNotifications vai aqui, com confirmação CLI.
```

**Passo A5.3 — Remover o import da função em `CommunicatedDeaths.tsx`**

```typescript
// ANTES
import { 
  ..., 
  fixWrongTenantIdsForNotifications,
  ...
} from '@/services/notificationService';
```

```typescript
// DEPOIS — remover fixWrongTenantIdsForNotifications do import
import { 
  getTenantNotifications, 
  allocateNotification, 
  rejectNotification, 
  DeathNotification 
} from '@/services/notificationService';
```

**Passo A5.4 — Remover a função de `notificationService.ts` após a migração concluída**

Após executar o script de migração e confirmar que todos os `tenantId`s estão corretos, remover o bloco `fixWrongTenantIdsForNotifications` de `notificationService.ts` e também o import de `getCemetery` que só é usado por ela.

#### Critério de aceitação

- [ ] Botão "Fix IDs" não aparece na UI em nenhum ambiente
- [ ] `grep -n "fixWrongTenantIds" src/` — sem resultados
- [ ] `notificationService.ts` não exporta mais `fixWrongTenantIdsForNotifications`

---

### A6 — Botões e telas fake (sem handler)

**Arquivos afetados**: `DeceasedList.tsx:103`, `PartnersPage.tsx`, `SecurityPage.tsx`, `FinancialPage.tsx`, `InventoryPage.tsx`, `ExpertAIPage.tsx`

#### Diagnóstico

Vários elementos da UI são decorativos sem funcionalidade, criando expectativas falsas para gestores:

```typescript
// DeceasedList.tsx:103 — botão sem onClick
<button className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200">
  <MoreHorizontal size={18} />
</button>

// FinancialPage.tsx:67 — aiAudited hardcoded
{ aiAudited: true }

// ExpertAIPage.tsx — duplicata de AgentsPage
export default function ExpertAIPage() {
  return <AgentsPage />;
}
```

#### Implementação passo a passo

**Passo A6.1 — Botão de ações em `DeceasedList.tsx`**

```typescript
// ANTES
<button className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200">
  <MoreHorizontal size={18} />
</button>
```

```typescript
// DEPOIS — dropdown simples
import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';

// Dentro do map de deceaseds, substituir o botão por:
<div className="relative" key={person.id}>
  <button 
    onClick={() => setOpenMenuId(openMenuId === person.id ? null : person.id!)}
    className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200"
    aria-label="Ações do registro"
  >
    <MoreHorizontal size={18} />
  </button>
  {openMenuId === person.id && (
    <div className="absolute right-0 top-8 z-10 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px]">
      <Link 
        to={`/admin/falecidos/${person.id}`} 
        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        Ver detalhes
      </Link>
      <button 
        onClick={() => handleDelete(person.id!)}
        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
      >
        Excluir
      </button>
    </div>
  )}
</div>
```

Também criar a rota `/admin/falecidos/:id` em `App.tsx` apontando para uma nova `DeceasedDetail.tsx`.

**Passo A6.2 — Remover `aiAudited: true` hardcoded em `FinancialPage.tsx`**

```typescript
// ANTES — FinancialPage.tsx:67 (dentro do formulário de criação de registro)
aiAudited: true

// DEPOIS — remover o campo do payload do formulário.
// aiAudited deve ser false por padrão e só pode ser true quando a Cloud Function
// de auditoria IA processar o registro (futura implementação).
```

```typescript
// Na interface FinancialRecord em sciService.ts, o campo já existe como opcional:
aiAudited?: boolean;

// No createFinancialRecord, não incluir aiAudited no payload por padrão.
// O selo "Validado IA" na UI só deve aparecer quando aiAudited === true no banco.
```

**Passo A6.3 — Remover `ExpertAIPage.tsx` ou diferenciá-la**

```typescript
// Opção A — Remover a rota /admin/ia e deixar só /admin/agentes
// Em App.tsx, remover:
<Route path="ia" element={<ExpertAIPage />} />

// E no menu de navegação (AdminLayout.tsx), remover o link para /admin/ia

// Opção B — Dar conteúdo próprio ao ExpertAIPage
// Criar uma página de análise estratégica usando o snapshot do SCI
// Esta opção tem mais valor de produto mas mais esforço
```

Recomendação: **Opção A** — simplificação imediata. Documentar a Opção B no backlog.

**Passo A6.4 — Adicionar placeholder honesto para rotas em desenvolvimento**

```typescript
// ANTES — App.tsx
<Route path="solicitacoes" element={<Placeholder title="Central de Solicitacoes" />} />
<Route path="configuracoes" element={<Placeholder title="Configuracoes" />} />
```

```typescript
// DEPOIS — Placeholder melhorado com data prevista
const ComingSoon = ({ title, eta }: { title: string; eta?: string }) => (
  <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
    <Construction className="text-slate-300 mb-4" size={48} />
    <h1 className="text-2xl font-bold text-slate-800 mb-2">{title}</h1>
    <p className="text-slate-500">
      {eta ? `Disponível em ${eta}` : 'Em desenvolvimento — disponível em breve.'}
    </p>
  </div>
);

<Route path="solicitacoes" element={<ComingSoon title="Central de Solicitações" />} />
<Route path="configuracoes" element={<ComingSoon title="Configurações do Sistema" />} />
```

#### Critério de aceitação

- [ ] Botão `⋯` em `DeceasedList` abre dropdown com "Ver detalhes" e "Excluir"
- [ ] Nenhum registro em `sci_financial_records` tem `aiAudited: true` por padrão
- [ ] Não há duas rotas (`/admin/ia` e `/admin/agentes`) renderizando o mesmo componente
- [ ] Páginas em desenvolvimento mostram estado vazio claro e honesto

---

### A7 — `cemeteryId: 'all'` em registros gravados

**Arquivos afetados**: todos os formulários que usam o seletor de cemitério do `AdminContext`

#### Diagnóstico

O contexto admin permite selecionar "Todas as unidades" (`cemeteryId: 'all'`). Quando o gestor está nessa seleção e abre um formulário de criação, o `selectedCemeteryId` do contexto é `'all'`, que é gravado no Firestore:

```typescript
// Padrão em múltiplos formulários:
const { selectedCemeteryId, tenantId } = useAdmin();

const handleCreate = async () => {
  await createOperationalRecord(tenantId, {
    cemeteryId: selectedCemeteryId, // grava 'all' se nenhuma unidade selecionada
    ...payload
  });
};
```

Registros com `cemeteryId: 'all'` nunca aparecem quando o gestor filtra por uma unidade específica, e o `filterByCemetery` em `sciService.ts` não os inclui nos relatórios.

#### Implementação passo a passo

**Passo A7.1 — Bloquear abertura de formulários quando `cemeteryId === 'all'`**

```typescript
// Padrão a aplicar em todos os formulários que criam registros com cemeteryId
const { selectedCemeteryId } = useAdmin();

const handleOpenForm = () => {
  if (selectedCemeteryId === 'all') {
    toast.error('Selecione um cemitério específico antes de criar um registro.');
    return;
  }
  setIsFormOpen(true);
};

// No botão de abertura do formulário:
<button onClick={handleOpenForm}>
  <Plus size={18} /> Novo Registro
</button>
```

**Passo A7.2 — Garantir que o `cemeteryId` no payload nunca seja `'all'`**

```typescript
// Adicionar guard em createForTenant no sciService.ts
async function createForTenant<T extends object>(
  tenantId: string,
  collectionName: string,
  action: string,
  payload: T
) {
  // Guard contra cemeteryId inválido
  if ('cemeteryId' in payload && (payload as any).cemeteryId === 'all') {
    throw new Error('cemeteryId inválido: não é possível gravar com "all". Selecione uma unidade.');
  }

  const data = {
    ...payload,
    tenantId,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid
  };
  // ...
}
```

#### Critério de aceitação

- [ ] Tentativa de criar registro com "Todas as unidades" selecionado mostra toast de erro
- [ ] `grep -r "cemeteryId.*all" src/` — nenhuma gravação com o valor literal `'all'`
- [ ] Registros antigos com `cemeteryId: 'all'` podem ser migrados com script (documentar no README)

---

## ETAPA 4 — QUALIDADE E CONFORMIDADE

---

### M1 — Validação inconsistente entre formulários

#### Diagnóstico e implementação

Os formulários SCI usam `useState` com guard-return manual sem feedback de validação para o usuário. A solução é padronizar em `react-hook-form` + `zod` (já usados em `LoginPage.tsx`).

**Passo M1.1 — Schema de datas consistente**

```typescript
// CRIAR: src/lib/validationSchemas.ts
import { z } from 'zod';

export const dateRangeSchema = z.object({
  dateOfBirth: z.string().min(1, 'Data de nascimento obrigatória'),
  dateOfDeath: z.string().min(1, 'Data de falecimento obrigatória'),
}).refine(
  (data) => new Date(data.dateOfDeath) >= new Date(data.dateOfBirth),
  { message: 'Data de falecimento deve ser posterior ao nascimento', path: ['dateOfDeath'] }
);

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

Aplicar schemas similares para cada tipo de formulário SCI.

#### Critério de aceitação

- [ ] Formulário de falecido rejeita `dateOfDeath < dateOfBirth` com mensagem clara
- [ ] Formulário de registro operacional com data no passado mostra erro inline
- [ ] Campos obrigatórios marcados visualmente antes do submit

---

### M2 — Off-by-one em datas (fuso horário)

**Arquivos afetados**: `DeceasedList.tsx:90`, `CommunicatedDeaths.tsx:197`

#### Diagnóstico

```typescript
// ATUAL — DeceasedList.tsx:90
format(new Date(person.dateOfDeath), 'dd/MM/yyyy')
// new Date('2024-03-15') → 2024-03-14T21:00:00.000Z (UTC-3)
// Exibe: 14/03/2024 em vez de 15/03/2024
```

#### Implementação

```typescript
// ANTES
import { format } from 'date-fns';
format(new Date(person.dateOfDeath), 'dd/MM/yyyy')
```

```typescript
// DEPOIS
import { parseISO, format } from 'date-fns';
format(parseISO(person.dateOfDeath), 'dd/MM/yyyy')
// parseISO('2024-03-15') → Date(2024, 2, 15) sem conversão de fuso
```

Aplicar em todos os locais que fazem `new Date(stringISO)` para exibição:
```bash
grep -rn "new Date(.*dateOf\|new Date(.*Date\b" src/ --include="*.tsx"
```

#### Critério de aceitação

- [ ] Data gravada como `2024-03-15` exibe `15/03/2024` em qualquer fuso horário do Brasil
- [ ] Não existe mais `format(new Date(someISODateString)` no código

---

### M3 — Loading states ausentes

**Arquivos afetados**: `AdminDashboard.tsx:351`, `FinancialPage.tsx`, `AgentsPage.tsx`, `ReportsPage.tsx`, `DocumentsCenterPage.tsx`, `SupportPage.tsx`, `CemeteryList.tsx`

#### Implementação

**Passo M3.1 — Criar componente `LoadingSpinner` e `PageSkeleton`**

```typescript
// CRIAR: src/components/ui/LoadingSpinner.tsx
export function LoadingSpinner({ text = 'Carregando...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] text-slate-400">
      <svg className="animate-spin h-8 w-8 mb-3 text-blue-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      <span className="text-sm">{text}</span>
    </div>
  );
}

// CRIAR: src/components/ui/StatCardSkeleton.tsx
export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-6 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-1/2 mb-3" />
      <div className="h-8 bg-slate-200 rounded w-1/3" />
    </div>
  );
}
```

**Passo M3.2 — Corrigir `AdminDashboard.tsx`**

```typescript
// ANTES — mostra cards zerados e depois sobrepõe loading
if (snapshotLoading) {
  return <div>Carregando...</div>; // aparece DEPOIS dos cards zerados
}
```

```typescript
// DEPOIS — skeleton enquanto carrega
if (snapshotLoading) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
  );
}
```

#### Critério de aceitação

- [ ] Nenhuma página exibe `0`, `0%` ou `R$ 0,00` antes dos dados serem carregados
- [ ] Skeleton visível por pelo menos 100ms em conexão rápida
- [ ] Erro de carregamento exibe mensagem clara, não tela em branco

---

### M4 — Estado stale no seletor de unidades

**Arquivo afetado**: `src/contexts/AdminContext.tsx`

#### Diagnóstico

```typescript
// ATUAL — AdminContext.tsx
useEffect(() => {
  async function load() {
    if (tenantId) {
      const data = await getCemeteries(tenantId);
      setCemeteries(data); // carregado uma vez, nunca atualizado
    }
  }
  load();
}, [tenantId]); // não inclui dependência de mudanças
```

Criar ou excluir um cemitério não atualiza o dropdown até o usuário recarregar a página.

#### Implementação

```typescript
// DEPOIS — AdminContext.tsx
// Exportar função de refresh para uso pelas páginas que mutam cemitérios
export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { tenantId } = useAuth();
  const [selectedCemeteryId, setSelectedCemeteryId] = useState<string>('all');
  const [cemeteries, setCemeteries] = useState<Cemetery[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCemeteries = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await getCemeteries(tenantId);
      setCemeteries(data);
    } catch (error) {
      console.error('Failed to load cemeteries', error);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    refreshCemeteries();
  }, [refreshCemeteries]);

  return (
    <AdminContext.Provider value={{ selectedCemeteryId, setSelectedCemeteryId, cemeteries, loading, refreshCemeteries }}>
      {children}
    </AdminContext.Provider>
  );
}

// Adicionar ao AdminContextType:
interface AdminContextType {
  selectedCemeteryId: string;
  setSelectedCemeteryId: (id: string) => void;
  cemeteries: Cemetery[];
  loading: boolean;
  refreshCemeteries: () => Promise<void>; // NOVO
}
```

Em `CemeteryList.tsx`, após criar/excluir cemitério:

```typescript
const { refreshCemeteries } = useAdmin();

const handleDeleteCemetery = async (id: string) => {
  await deleteCemetery(tenantId!, id);
  await refreshCemeteries(); // atualiza dropdown imediatamente
  toast.success('Cemitério excluído.');
};
```

#### Critério de aceitação

- [ ] Criar cemitério atualiza o dropdown imediatamente sem recarregar a página
- [ ] Excluir cemitério remove a opção do dropdown imediatamente

---

### M5 — Idioma, formatação e metadados

**Arquivos afetados**: `index.html`, múltiplas páginas

#### Implementação

**Passo M5.1 — Corrigir `index.html`**

```html
<!-- ANTES -->
<html lang="en">
  <title>My Google AI Studio App</title>

<!-- DEPOIS -->
<html lang="pt-BR">
  <title>MemorialOS — Sistema de Gestão Cemiterial</title>
```

**Passo M5.2 — Padronizar formatação de moeda**

```typescript
// CRIAR: src/lib/formatters.ts
export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const formatDate = (isoDate: string): string => {
  if (!isoDate) return '—';
  return format(parseISO(isoDate), 'dd/MM/yyyy');
};
```

```typescript
// ANTES — FinancialPage.tsx, AdminDashboard.tsx
R$ {item.value.toFixed(2)}
R$ {(snapshot?.totalRevenue || 0).toFixed(2)}
```

```typescript
// DEPOIS
import { formatCurrency } from '@/lib/formatters';
{formatCurrency(item.value)}
{formatCurrency(snapshot?.totalRevenue || 0)}
```

**Passo M5.3 — Traduzir status nos selects do gestor**

```typescript
// CRIAR: src/lib/statusLabels.ts
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

**Passo M5.4 — Corrigir textos sem acento**

```bash
# Localizar ocorrências:
grep -rn "Inventario\|Gestao\|Manutencao\|Comunicacao\|Configuracao " src/ --include="*.tsx"
```

Substituir por `Inventário`, `Gestão`, `Manutenção`, `Comunicação`, `Configuração`.

#### Critério de aceitação

- [ ] `<title>` exibe "MemorialOS" em vez de "My Google AI Studio App"
- [ ] `<html lang="pt-BR">` em `index.html`
- [ ] Valores monetários exibidos como `R$ 1.234,56` em vez de `1234.56`
- [ ] Status nos selects em português

---

### M6 — Acessibilidade básica

#### Implementação

**Passo M6.1 — Labels em inputs**

```typescript
// ANTES (padrão em múltiplos formulários)
<input type="text" placeholder="Título" />
```

```typescript
// DEPOIS
<label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">
  Título <span className="text-red-500">*</span>
</label>
<input id="title" type="text" aria-required="true" placeholder="Título da ocorrência" />
```

**Passo M6.2 — Botões de ícone com `aria-label`**

```typescript
// ANTES
<button><X size={18} /></button>
```

```typescript
// DEPOIS
<button aria-label="Fechar modal"><X size={18} /></button>
```

**Passo M6.3 — Modais com focus-trap e fechar com Esc**

```typescript
// CRIAR: src/hooks/useModal.ts
import { useEffect, useRef } from 'react';

export function useModal(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    // Focus no primeiro elemento focável
    containerRef.current?.querySelector<HTMLElement>('button, input, select, textarea')?.focus();
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return { containerRef };
}
```

```typescript
// Nos modais existentes:
const { containerRef } = useModal(isModalOpen, () => setIsModalOpen(false));

<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  ref={containerRef}
  className="..."
>
  <h2 id="modal-title">...</h2>
</div>
```

#### Critério de aceitação

- [ ] Todos os inputs têm `<label>` associado ou `aria-label`
- [ ] Todos os modais fecham com `Esc`
- [ ] Botões de ícone têm `aria-label` descritivo
- [ ] Lighthouse accessibility score > 80

---

### M7 — Duplicação estrutural

#### Diagnóstico

O trio formulário+tabela+filtro está copiado em ~10 arquivos. A duplicação não precisa ser eliminada toda de uma vez, mas deve parar de crescer.

#### Implementação — componentes reutilizáveis

**Passo M7.1 — Criar `<SCITable>` genérico**

```typescript
// CRIAR: src/components/admin/SCITable.tsx
import React from 'react';

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

interface SCITableProps<T extends { id?: string }> {
  columns: Column<T>[];
  data: T[];
  loading: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function SCITable<T extends { id?: string }>({
  columns, data, loading, emptyMessage = 'Nenhum registro encontrado.', onRowClick
}: SCITableProps<T>) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className={`px-6 py-4 font-medium text-slate-600 ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr><td colSpan={columns.length} className="px-6 py-8 text-center text-slate-400">
              <LoadingSpinner />
            </td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-6 py-8 text-center text-slate-400">
              {emptyMessage}
            </td></tr>
          ) : (
            data.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={`hover:bg-slate-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((col, i) => (
                  <td key={i} className={`px-6 py-4 text-slate-700 ${col.className || ''}`}>
                    {typeof col.accessor === 'function'
                      ? col.accessor(row)
                      : String(row[col.accessor] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
```

**Passo M7.2 — Criar filtro `cemeteryId` reutilizável**

```typescript
// CRIAR: src/hooks/useCemeteryFilter.ts
export function useCemeteryFilter<T extends { cemeteryId: string }>(items: T[]) {
  const { selectedCemeteryId } = useAdmin();
  return useMemo(
    () => selectedCemeteryId === 'all'
      ? items
      : items.filter(item => item.cemeteryId === selectedCemeteryId),
    [items, selectedCemeteryId]
  );
}
```

**Passo M7.3 — Remover `ExpertAIPage.tsx`** (já coberto em A6)

**Passo M7.4 — Unificar `SanitaryCheck` e `EnvironmentalCheck`**

As interfaces são idênticas — criar uma única:

```typescript
// sciService.ts — substituir as duas interfaces por:
export interface EnvironmentalSanitaryCheck {
  id?: string;
  tenantId: string;
  cemeteryId: string;
  checkType: 'sanitary' | 'environmental'; // diferenciador
  area: string;
  indicator: string;
  riskLevel: RiskLevel;
  findings: string;
  recommendation: string;
  status: 'open' | 'monitoring' | 'closed';
  inspectedAt: string;
  inspector: string;
  createdAt?: any;
  createdBy?: string;
}

// Manter as coleções separadas (sci_sanitary_checks e sci_environmental_checks)
// mas usar a mesma interface TypeScript
export type SanitaryCheck = EnvironmentalSanitaryCheck & { checkType: 'sanitary' };
export type EnvironmentalCheck = EnvironmentalSanitaryCheck & { checkType: 'environmental' };
```

#### Critério de aceitação

- [ ] Criar novo módulo SCI usa `<SCITable>` em vez de replicar o HTML de tabela
- [ ] `useCemeteryFilter` é o único lugar onde a lógica `=== 'all' || item.cemeteryId === id` existe
- [ ] `SanitaryCheck` e `EnvironmentalCheck` são aliases do mesmo tipo base

---

### M8 — Storage sem restrições adequadas

**Arquivo afetado**: `storage.rules`

#### Implementação

```javascript
// ANTES — storage.rules
match /memorials/{memorialId}/photos/{fileName=**} {
  allow read: if true;
  allow write: if isSignedIn(); // qualquer usuário logado grava em memorial de qualquer tenant
}

match /tenants/{tenantId}/requests/{requestId}/{fileName=**} {
  allow read: if isSignedIn();  // qualquer autenticado lê requests de qualquer tenant
  allow write: if isSignedIn(); // idem para escrita
}
```

```javascript
// DEPOIS — storage.rules
match /memorials/{memorialId}/photos/{fileName=**} {
  allow read: if true; // fotos de memorial podem ser públicas
  allow write: if isSignedIn() && isStaff(); // apenas staff pode gravar em memorials
}

match /tenants/{tenantId}/requests/{requestId}/{fileName=**} {
  // Leitura: dono da request ou staff do tenant
  allow read: if isSignedIn()
              && (isStaff() && request.auth.token.tenantId == tenantId
                  || request.auth.uid == requestId.split('_')[0]); // heurística — melhorar com metadata
  // Escrita: apenas o dono ou staff
  allow write: if isSignedIn()
               && (isStaff() && request.auth.token.tenantId == tenantId);
}
```

#### Critério de aceitação

- [ ] Upload anônimo para `memorials/*/photos` retorna 403
- [ ] Upload de usuário sem role de staff para `tenants/*/requests` retorna 403

---

### M9 — Exclusão de cemitério sem cascade

**Arquivo afetado**: `src/services/cemeteryService.ts:133–136`

#### Implementação

```typescript
// ANTES — cemeteryService.ts
export async function deleteCemetery(tenantId: string, cemeteryId: string) {
  await deleteDoc(doc(db, CEMETERIES_COL, cemeteryId));
  await logAction(tenantId, 'DELETE_CEMETERY', CEMETERIES_COL, cemeteryId, null, null);
}
```

```typescript
// DEPOIS — soft delete com checagem de dependências
export async function deleteCemetery(tenantId: string, cemeteryId: string): Promise<void> {
  // Verificar se há jazigos ocupados no cemitério
  const occupiedPlotsQuery = query(
    collection(db, PLOTS_COL),
    where('cemeteryId', '==', cemeteryId),
    where('status', 'in', ['occupied', 'reserved']),
    limit(1)
  );
  const occupiedSnap = await getDocs(occupiedPlotsQuery);
  if (!occupiedSnap.empty) {
    throw new Error('Não é possível excluir: o cemitério possui jazigos ocupados ou reservados.');
  }

  // Verificar notificações pendentes
  const pendingQuery = query(
    collection(db, 'death_notifications'),
    where('cemeteryId', '==', cemeteryId),
    where('status', 'in', ['submitted', 'reviewing', 'allocated']),
    limit(1)
  );
  const pendingSnap = await getDocs(pendingQuery);
  if (!pendingSnap.empty) {
    throw new Error('Não é possível excluir: existem solicitações de sepultamento em andamento.');
  }

  // Excluir plots disponíveis e bloqueados em lote
  const allPlotsQuery = query(collection(db, PLOTS_COL), where('cemeteryId', '==', cemeteryId));
  const allPlotsSnap = await getDocs(allPlotsQuery);
  
  let batch = writeBatch(db);
  let ops = 0;
  for (const plotDoc of allPlotsSnap.docs) {
    batch.delete(plotDoc.ref);
    ops++;
    if (ops >= 450) { await batch.commit(); batch = writeBatch(db); ops = 0; }
  }

  // Excluir setores
  const sectorsQuery = query(collection(db, SECTORS_COL), where('cemeteryId', '==', cemeteryId));
  const sectorsSnap = await getDocs(sectorsQuery);
  for (const sectorDoc of sectorsSnap.docs) {
    batch.delete(sectorDoc.ref);
    ops++;
    if (ops >= 450) { await batch.commit(); batch = writeBatch(db); ops = 0; }
  }

  // Excluir o cemitério
  batch.delete(doc(db, CEMETERIES_COL, cemeteryId));
  if (ops > 0) await batch.commit();

  await logAction(tenantId, 'DELETE_CEMETERY', CEMETERIES_COL, cemeteryId, null, { cemeteryId });
}
```

#### Critério de aceitação

- [ ] Tentativa de excluir cemitério com jazigos ocupados mostra erro claro
- [ ] Exclusão bem-sucedida remove setores e plots disponíveis junto
- [ ] `deceaseds` com `cemeteryId` do cemitério excluído permanecem intactos (registro histórico)

---

## ETAPA 5 — DÉBITO TÉCNICO

---

### B1 — `URL.createObjectURL` sem `revokeObjectURL`

**Arquivo afetado**: `src/pages/admin/AdminReportDeath.tsx` linhas 138, 340

#### Implementação

```typescript
// ANTES — renderiza um novo Blob URL a cada render
{photoFile && <img src={URL.createObjectURL(photoFile)} className="..." />}
```

```typescript
// DEPOIS — criar o URL uma vez com useMemo e revogar ao desmontar
import { useMemo, useEffect } from 'react';

const photoPreviewUrl = useMemo(() => {
  if (!photoFile) return null;
  return URL.createObjectURL(photoFile);
}, [photoFile]);

useEffect(() => {
  return () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  };
}, [photoPreviewUrl]);

// No JSX:
{photoPreviewUrl && <img src={photoPreviewUrl} className="..." />}
```

Aplicar o mesmo padrão na linha 340.

#### Critério de aceitação

- [ ] Troca de foto 10 vezes seguidas não cria 10 Blob URLs pendentes (verificar em DevTools > Memory)
- [ ] `revokeObjectURL` chamado ao desmontar o componente ou trocar de foto

---

### B2 — Upload sem validação de tipo/tamanho

**Arquivos afetados**: `DeceasedForm.tsx`, `DocumentsCenterPage.tsx`

#### Implementação

```typescript
// CRIAR: src/lib/fileValidation.ts
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function validateFile(
  file: File,
  allowedTypes = ALLOWED_DOCUMENT_TYPES
): string | null {
  if (!allowedTypes.includes(file.type)) {
    return `Tipo de arquivo não permitido. Use: ${allowedTypes.map(t => t.split('/')[1]).join(', ')}`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE_MB} MB (este arquivo: ${(file.size / 1024 / 1024).toFixed(1)} MB)`;
  }
  return null;
}
```

```typescript
// Nos handlers de upload:
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const error = validateFile(file);
  if (error) {
    toast.error(error);
    e.target.value = ''; // resetar o input
    return;
  }
  setSelectedFile(file);
};
```

#### Critério de aceitação

- [ ] Tentar fazer upload de arquivo `.exe` mostra toast de erro
- [ ] Tentar fazer upload de arquivo > 10 MB mostra toast com o tamanho atual do arquivo
- [ ] Input é resetado após arquivo inválido

---

### B3 — Chat IA sem persistência entre agentes

**Arquivo afetado**: `src/pages/admin/AgentsPage.tsx`

#### Implementação

```typescript
// Ao trocar de agente, perguntar ao usuário se deseja limpar o histórico
const handleSelectAgent = (agent: AIAgent) => {
  if (currentAgent && chatHistory.length > 0) {
    // Usar modal de confirmação, não window.confirm
    setConfirmClearModal({
      open: true,
      onConfirm: () => {
        setChatHistory([]);
        setCurrentAgent(agent);
        setConfirmClearModal({ open: false });
      }
    });
  } else {
    setCurrentAgent(agent);
  }
};

// Adicionar listener para Enter no campo de chat
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // evitar nova linha acidental
    handleSendMessage();
  }
};
```

#### Critério de aceitação

- [ ] Pressionar Enter no campo de chat envia a mensagem
- [ ] Trocar de agente com histórico ativo pergunta ao usuário antes de limpar
- [ ] `window.confirm` não aparece em nenhum lugar do código

---

### B4 — Resíduos de desenvolvimento

#### Implementação

```bash
# Localizar todos os console.log a remover:
grep -rn "console.log" src/ --include="*.tsx" --include="*.ts"
```

Remover os seguintes:

```typescript
// CommunicatedDeaths.tsx:47 — remover:
console.log("Manager Tenant ID:", tenantId);

// CommunicatedDeaths.tsx:50 — remover:
console.log("Notifications found:", data.length);

// notificationService.ts — remover os console.log de debug da migração
// (junto com a remoção de fixWrongTenantIdsForNotifications em A5)
```

```typescript
// audit.ts — remover createDeceasedRecord (já coberto em C5)
```

```bash
# README.md — documentar VITE_GEMINI_API_KEY como removida, adicionar instruções da Cloud Function
```

#### Critério de aceitação

- [ ] `grep -rn "console.log" src/` retorna zero ocorrências (exceto comentários)
- [ ] `README.md` documenta o setup completo incluindo as Cloud Functions e a chave Gemini

---

### B5 — TypeScript frouxo

**Contexto**: 95 ocorrências de `any` em 24 arquivos

#### Estratégia de implementação

Não substituir todos os `any` de uma vez — isso gera erros em cascata. Abordagem incremental:

**Passo B5.1 — Habilitar regras no `tsconfig.json` gradualmente**

```json
// tsconfig.json — adicionar:
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**Passo B5.2 — Priorizar `useState<any[]>` nas páginas admin**

```typescript
// ANTES (padrão em ~8 páginas admin)
const [records, setRecords] = useState<any[]>([]);
```

```typescript
// DEPOIS (usando o tipo correto já definido nos services)
import { OperationalRecord } from '@/services/sciService';
const [records, setRecords] = useState<OperationalRecord[]>([]);
```

**Passo B5.3 — Tipar parâmetros `any` nos services**

```typescript
// ANTES — sciService.ts
async function createForTenant<T extends object>(tenantId: string, collectionName: string, action: string, payload: T) {}

// O 'any' nos services geralmente vem de:
oldValue: any = null,
newValue: any = null
// → Substituir por:
oldValue: Record<string, unknown> | null = null,
newValue: Record<string, unknown> | null = null
```

#### Critério de aceitação

- [ ] `npx tsc --noEmit` com `noImplicitAny: true` sem erros
- [ ] `grep -c ": any" src/` reduzido para < 10 ocorrências (apenas casos justificados)
- [ ] Todas as páginas admin com estado de lista tipadas com os tipos dos services

---

## APÊNDICE A — CHECKLIST DE DEPLOY

Antes de qualquer deploy para produção após as correções:

### Segurança
- [ ] Bundle não contém senhas, emails de demo ou chaves de API (`grep -E "admin123|admin@memorial|AIzaSy" dist/`)
- [ ] Regras do Firestore deployadas (`firebase deploy --only firestore:rules`)
- [ ] Regras do Storage deployadas (`firebase deploy --only storage`)
- [ ] Cloud Functions deployadas com chave Gemini configurada

### Funcionalidade
- [ ] Login com usuário real (não demo) acessa o painel
- [ ] Criar cemitério → aparece no dropdown imediatamente
- [ ] Alocar notificação → cria registro em `deceaseds` e atualiza `burialDate` no plot
- [ ] Dashboard exibe dados corretos (não zerados) após carregamento
- [ ] Geração de obituário funciona (via Cloud Function)

### Conformidade
- [ ] Dados de falecidos não acessíveis sem autenticação
- [ ] CPF em `plot_concessions` não acessível por visitantes anônimos
- [ ] `<html lang="pt-BR">` no HTML gerado

---

## APÊNDICE B — SEQUÊNCIA DE COMMITS RECOMENDADA

```
feat(security): remove hardcoded demo backdoor (C1)
feat(rules): restrict public read of personal data (C2)
feat(rules): prevent citizen from forging allocation (C3)
feat(ai): move Gemini key to Cloud Functions proxy (C4)
feat(audit): restrict audit log writes to staff only (C5)

fix(roles): unify role names to English across router and functions (A1)
feat(allocation): create deceased record on notification allocation (A2)
perf(sci): add in-memory cache and pagination to executive snapshot (A3)

feat(ui): add react-hot-toast and replace silent error handlers (A4)
chore: remove destructive migration button from production UI (A5)
fix(ui): wire actions menu in DeceasedList (A6)
fix(forms): block submit when cemeteryId is 'all' (A7)

fix(validation): add zod schemas and date coherence checks (M1)
fix(dates): use parseISO instead of new Date for display (M2)
feat(ui): add skeleton loading states to dashboard and pages (M3)
feat(admin): add refreshCemeteries to AdminContext (M4)
fix(i18n): pt-BR html lang, currency formatting, status labels (M5)
feat(a11y): add labels, aria-label, focus-trap to modals (M6)
refactor: extract SCITable and useCemeteryFilter components (M7)
feat(storage): tighten storage rules for memorials and tenant requests (M8)
fix(cemetery): add dependency check and cascade delete (M9)

fix(memory): revoke blob URLs on unmount in AdminReportDeath (B1)
feat(upload): add file type and size validation (B2)
fix(chat): Enter key sends message, confirm before clearing history (B3)
chore: remove debug console.log and development residues (B4)
refactor(types): replace any[] state with proper types (B5)
```

---

## APÊNDICE C — ESTIMATIVA DE ESFORÇO

| Etapa | Itens | Esforço estimado | Risco se não feito |
|-------|-------|------------------|-------------------|
| 1 — Segurança Crítica | C1–C5 | 2–3 dias | Acesso irrestrito ao sistema completo; violação LGPD |
| 2 — Fluxos Quebrados | A1–A3 | 3–4 dias | Gestores não conseguem acessar o painel; dados de exumação incorretos |
| 3 — Integridade Operacional | A4–A7 | 3–4 dias | Erros silenciosos; dados corrompidos por cemeteryId 'all' |
| 4 — Qualidade | M1–M9 | 5–8 dias | Datas erradas; layout inacessível; duplicação crescente |
| 5 — Débito Técnico | B1–B5 | 2–3 dias | Memory leaks; TypeScript sem valor; uploads sem limite |

**Total estimado**: 15–22 dias de desenvolvimento com um engenheiro sênior.

**Recomendação**: A Etapa 1 deve ser concluída **antes de qualquer demonstração ou compartilhamento do link** com municípios ou parceiros. As credenciais `admin@memorial.com/admin123` no bundle público representam risco imediato e imediato de comprometimento do sistema em produção.

