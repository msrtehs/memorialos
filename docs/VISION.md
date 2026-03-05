# MemorialOS - Visão do Produto

## 1. Visão e Propósito
**MemorialOS** é uma plataforma que humaniza a gestão da morte. Para as prefeituras, é uma ferramenta de eficiência, controle e transparência. Para as famílias, é um espaço de acolhimento e preservação da memória.

O sistema elimina a burocracia fria dos processos cemiteriais antigos, substituindo-a por fluxos digitais seguros, auditáveis e, acima de tudo, respeitosos.

### Princípios de Design e Tom
*   **Serenidade:** A interface deve ser limpa, com muito espaço em branco (breathable), cores sóbrias (tons de pedra, céu, natureza) e tipografia elegante. Nada deve "piscar" ou gritar por atenção.
*   **Respeito:** A linguagem nunca é técnica demais quando fala com o cidadão. Em vez de "Defunto", usa-se "Ente Querido" ou "Falecido". Em vez de "Cova", usa-se "Jazigo" ou "Sepultura".
*   **Privacidade:** O luto é íntimo. O sistema garante que apenas o que a família deseja compartilhar seja público.
*   **Acessibilidade:** O luto atinge todas as idades. O sistema deve ser extremamente fácil de usar por idosos (fontes grandes, alto contraste, navegação clara).

## 2. Mapa do Site (Sitemap)

### Portal Público (Cidadão/Visitante)
*   `/` (Home): Busca de falecidos, obituário do dia, acesso rápido a serviços.
*   `/memorial/:id`: Página do memorial (Bio, Fotos, Linha do tempo, Localização).
*   `/buscar`: Busca avançada (Nome, Data, Cemitério).
*   `/servicos`: Solicitação de manutenção, exumação, 2ª via de taxas.
*   `/login`: Acesso para familiares gerenciarem memoriais.
*   `/minha-conta`: Meus memoriais, status de solicitações.

### Portal Administrativo (Gestor/Prefeitura)
*   `/admin/dashboard`: Visão geral (Ocupação, Sepultamentos hoje, Pendências).
*   `/admin/cemiterios`: Gestão de Quadras, Setores, Jazigos (Mapa).
*   `/admin/falecidos`: Cadastro, Busca, Histórico.
*   `/admin/operacional`: Agenda de sepultamentos, Ordens de serviço.
*   `/admin/financeiro`: Taxas, Inadimplência, Relatórios.
*   `/admin/configuracoes`: Usuários, Permissões, Tabelas de Preço.

## 3. Jornadas do Usuário (User Journeys)

### J1: Gestor Cadastra Estrutura
1.  Gestor acessa `/admin/cemiterios`.
2.  Clica em "Novo Cemitério" -> Preenche dados (Nome, Endereço).
3.  Entra no Cemitério -> "Adicionar Quadra" -> Define capacidade.
4.  Sistema gera os Jazigos automaticamente (ex: Q1-L001 a Q1-L100) com status "Livre".

### J2: Gestor Registra Sepultamento
1.  Recebe notificação de óbito.
2.  Acessa `/admin/operacional/novo-sepultamento`.
3.  Busca/Cadastra Responsável.
4.  Preenche dados do Falecido (Upload Certidão de Óbito).
5.  Seleciona Jazigo (Filtra por "Livre" ou "Uso da Família").
6.  Confirma agendamento. Sistema atualiza status do Jazigo para "Ocupado".

### J3: Cidadão Cria Memorial
1.  Recebe e-mail/link após o sepultamento (convite do sistema).
2.  Cria senha/Login social.
3.  Acessa "Meus Memoriais" -> "Editar Memorial de [Nome]".
4.  Escreve Biografia (com ajuda da IA opcional).
5.  Sobe fotos para a Galeria.
6.  Define privacidade: "Público" ou "Apenas com Link".
7.  Salva. O sistema gera o QR Code para a lápide.

### J4: Visitante Encontra Localização
1.  Acessa Home -> Busca por "Maria Silva".
2.  Clica no resultado correto.
3.  Na página do Memorial, clica em "Localização".
4.  Vê: "Cemitério Central, Quadra B, Rua 3, Jazigo 120".
5.  Clica em "Como chegar" -> Abre mapa com rota desenhada (se disponível) ou Google Maps para a entrada mais próxima.

### J5: Solicitação de Manutenção
1.  Cidadão acessa página do Memorial ou escaneia QR Code na lápide.
2.  Clica em "Solicitar Manutenção" (ex: grama alta, placa solta).
3.  Descreve o problema e anexa foto.
4.  Sistema cria ticket com SLA de 48h.
5.  Gestor recebe alerta em `/admin/solicitacoes`.

## 4. Modelo de Dados (Firestore)

**Padrão:** Todas as coleções raiz têm `tenantId` (cidade/prefeitura) para isolamento.

*   `tenants/{tenantId}`: Configurações da prefeitura.
*   `cemeteries/{cemeteryId}`: Dados do cemitério.
    *   `sectors/{sectorId}`: Quadras/Setores.
    *   `plots/{plotId}`: Jazigos (Status: Livre, Ocupado, Reservado).
*   `deceaseds/{deceasedId}`: Registro oficial do falecido.
    *   `tenantId`, `cemeteryId`, `plotId`, `name`, `dates`, `documents[]`.
*   `memorials/{memorialId}`: Camada social (separada do registro legal).
    *   `deceasedId` (link), `bio`, `privacyLevel`, `managers[]` (uids).
    *   `tributes/{tributeId}`: Homenagens (subcoleção).
*   `requests/{requestId}`: Solicitações de serviço.
*   `audit_logs/{logId}`: Auditoria imutável.
    *   `action`, `actorUid`, `targetCollection`, `targetId`, `oldValue`, `newValue`, `timestamp`.

## 5. Regras de Permissão (RBAC)

Usaremos **Custom Claims** no Firebase Auth:
*   `role`: 'superadmin' | 'manager' | 'operator' | 'citizen'
*   `tenantId`: ID da prefeitura vinculada.

### Gerenciamento
*   Apenas `superadmin` pode criar `manager`.
*   Apenas `manager` pode criar `operator`.
*   Função Cloud Function `setUserRole` para garantir segurança na atribuição.

## 6. Backlog Priorizado

### MVP (Mês 1-2)
*   Auth (Login/Recuperar Senha).
*   Admin: CRUD Cemitérios, Setores, Jazigos.
*   Admin: Cadastro de Falecidos e Sepultamentos básicos.
*   Público: Busca simples e Página de Memorial (apenas leitura de dados básicos).
*   Segurança: Rules básicas.

### V1 (Mês 3-4)
*   Público: Edição de Memorial (Bio/Fotos) pela família.
*   Admin: Mapa visual simples.
*   Admin: Emissão de PDF (Termos).
*   Admin: Auditoria completa.
*   Geração de QR Code.

### V2 (Futuro)
*   Financeiro (integração boleto/PIX).
*   IA para escrita de bio.
*   App Mobile para equipe de campo (offline first).
