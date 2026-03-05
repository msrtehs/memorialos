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
5.  Copie o conteúdo de `firestore.rules` e `storage.rules` para o console do Firebase.

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
