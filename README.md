# MemorialOS

Sistema de gestão cemiterial e memorial digital focado em dignidade e respeito.

## Visão Geral

Este projeto é um esqueleto funcional usando **React + Vite + Tailwind CSS + Firebase**.
Ele implementa a estrutura básica solicitada para o MemorialOS, incluindo:

*   **Layouts Distintos:** Área Pública (focada em memória/serenidade) e Área Admin (focada em gestão).
*   **Autenticação:** Contexto de Auth com suporte a Roles (RBAC) e Tenant ID.
*   **Rotas Protegidas:** Middleware para impedir acesso não autorizado.
*   **Estrutura de Pastas:** Organizada por features e camadas (services, components, pages).
*   **Segurança:** Arquivos `firestore.rules` e `storage.rules` incluídos na raiz.

## Configuração do Firebase

Para rodar este projeto, você precisa criar um projeto no Firebase Console e configurar as variáveis de ambiente.

1.  Crie um arquivo `.env.local` na raiz (baseado no `.env.example`, mas adicione as chaves do Firebase):

```env
VITE_FIREBASE_API_KEY=seu_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu_projeto
VITE_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
```

2.  Habilite **Authentication** (Email/Password).
3.  Habilite **Firestore Database**.
4.  Habilite **Storage**.
5.  Copie o conteúdo de `firestore.rules` e `storage.rules` para o console do Firebase (ou use `firebase deploy --only firestore:rules,storage`).

> A `VITE_FIREBASE_API_KEY` é a chave web pública do Firebase — pode ficar no bundle e é protegida pelas regras de segurança.

## IA (OpenRouter) via Cloud Functions

**A chave de IA NÃO fica no frontend.** Não existe `VITE_GEMINI_API_KEY` (nem qualquer segredo `VITE_*`) — tudo que entra no `.env` do Vite vai para o bundle público. A geração de conteúdo por IA (obituário, chat, agentes) passa pelas Cloud Functions (`generateObituary`, etc.), que usam o modelo OpenRouter e mantêm a chave fora do bundle como um secret gerenciado:

```bash
cd functions && npm install
firebase functions:secrets:set OPENROUTER_API_KEY   # cole a chave quando solicitado
firebase deploy --only functions
```

O trigger manual de monitoramento (`manualMonitorTrigger`) é fail-closed: sem o secret `MONITOR_TRIGGER_TOKEN` configurado, responde `503` e não executa.

```bash
firebase functions:secrets:set MONITOR_TRIGGER_TOKEN   # ex.: openssl rand -hex 32
```

## Superadmin e perfis

Não há backdoor demo. O painel admin exige o custom claim `role: 'superadmin'`. Para promover uma conta, use `scripts/set-superadmin.cjs` (com uma `serviceAccountKey.json` na pasta `scripts/`), passando o e-mail no argumento; depois apague a chave:

```bash
node scripts/set-superadmin.cjs seu-email@dominio.gov.br
```

O script recusa os e-mails do antigo backdoor demo (`admin@memorial.com`, `gestor@memorial.com`). Demais perfis (`manager`, `operator`, `citizen`) são atribuídos pela Cloud Function `setUserRole`.

## Deploy no GitHub Pages

Este repositório possui workflow em `.github/workflows/deploy-pages.yml`.

Antes do primeiro deploy, configure no GitHub:

> Nota: **nenhum segredo** entra no `.env` de build — o workflow tem um passo de guard que falha se encontrar padrões de chave (`GEMINI`, `sk-or-v1`) no bundle. A config Web do Firebase é pública por design (protegida por rules + App Check) e vem das **Variables** abaixo. A chave de IA fica apenas no secret `OPENROUTER_API_KEY` das Cloud Functions.

1.  **Variables** (`Settings > Secrets and variables > Actions > Variables`) — nomes **sem** o prefixo `VITE_`; o workflow os mapeia para `VITE_*` no `.env` de build:
    *   `FIREBASE_API_KEY`
    *   `FIREBASE_AUTH_DOMAIN`
    *   `FIREBASE_PROJECT_ID`
    *   `FIREBASE_STORAGE_BUCKET`
    *   `FIREBASE_MESSAGING_SENDER_ID`
    *   `FIREBASE_APP_ID`
    *   `FIREBASE_MEASUREMENT_ID`
3.  Em `Settings > Pages`, selecione **Build and deployment: GitHub Actions**.

## Comandos

*   `npm install`: Instala dependências.
*   `npm run dev`: Inicia servidor de desenvolvimento.
*   `npm run build`: Gera build de produção.

## Estrutura de Dados (Resumo)

*   `tenants`: Prefeituras/Clientes.
*   `cemeteries`: Estrutura física.
*   `deceaseds`: Registros legais.
*   `memorials`: Páginas públicas de homenagem.
*   `audit_logs`: Auditoria de ações administrativas.

Consulte `docs/VISION.md` para detalhes completos do produto.
