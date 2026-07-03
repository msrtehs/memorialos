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

## IA (Gemini) via Cloud Functions

**A chave do Gemini NÃO fica mais no frontend** (correção C4). Não existe mais `VITE_GEMINI_API_KEY`. A geração de conteúdo por IA (obituário, chat, agentes) passa pela Cloud Function `generateContent`, que mantém a chave fora do bundle e exige autenticação:

```bash
cd functions && npm install   # inclui @google/generative-ai
firebase functions:config:set gemini.api_key="SUA_CHAVE_GEMINI"
firebase deploy --only functions
```

## Superadmin e perfis

Não há mais backdoor demo (correção C1). O painel admin exige o custom claim `role: 'superadmin'`. Para promover a conta administrativa uma única vez, use `scripts/set-superadmin.js` (com uma `serviceAccountKey.json`), depois apague o script e a chave. Demais perfis (`manager`, `operator`, `citizen`) são atribuídos pela Cloud Function `setUserRole`.

## Deploy no GitHub Pages

Este repositório possui workflow em `.github/workflows/deploy-pages.yml`.

Antes do primeiro deploy, configure no GitHub:

> Nota: o `GEMINI_API_KEY` **não é mais** usado no build do frontend (foi movido para as Cloud Functions — ver seção acima). Configure-o apenas via `firebase functions:config:set`.

1.  **Variables** (`Settings > Secrets and variables > Actions > Variables`)
    *   `VITE_FIREBASE_API_KEY`
    *   `VITE_FIREBASE_AUTH_DOMAIN`
    *   `VITE_FIREBASE_PROJECT_ID`
    *   `VITE_FIREBASE_STORAGE_BUCKET`
    *   `VITE_FIREBASE_MESSAGING_SENDER_ID`
    *   `VITE_FIREBASE_APP_ID`
    *   `VITE_FIREBASE_MEASUREMENT_ID`
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
