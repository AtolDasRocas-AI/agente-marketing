# ATOL Studio — estratégia e backlog de evolução

**Status:** Sprint 1.1 concluído localmente em 14/09/2026. Nenhuma migração foi aplicada, credencial rotacionada, integração Meta alterada ou deploy realizado por esta entrega.

## Visão do produto

ATOL Studio é uma única plataforma de operação para a ATOL, com dois módulos independentes dentro do mesmo código-base:

| Módulo | Finalidade | Estado atual |
| --- | --- | --- |
| Sorteios | Sorteios de Instagram auditáveis, com regras, comprovante e expurgo LGPD | Produto existente, deve continuar operacional sem regressões |
| Marketing e Conteúdo | Planejar, criar, revisar, aprovar, medir e aprender com conteúdo | Novo domínio, iniciado no Sprint 1 |

O banco da aplicação principal da ATOL continua fora deste escopo. ATOL Studio não deve compartilhar suas tabelas, dados ou permissões com ele.

## Fronteiras de domínio

O código, a identidade visual, a sessão autenticada e a infraestrutura da aplicação podem ser compartilhados. Dados e permissões de negócio não.

| Área | Compartilhada | Isolada por domínio |
| --- | --- | --- |
| Interface | Shell, navegação, tokens visuais e componentes básicos | Telas e fluxos de cada módulo |
| Identidade | Sessão Supabase | Papéis e autorização de cada módulo |
| Dados | Projeto ATOL Studio | Tabelas `sorteio*` e `marketing_*` sem relações cruzadas |
| Storage | Conta de storage do ATOL Studio | Buckets e políticas separados para comprovantes e ativos de conteúdo |
| Integrações | Padrões server-side | Tokens, permissões, auditoria e limites por integração |

O domínio Marketing terá tabelas, políticas RLS, auditoria e custos próprios, mesmo coexistindo com Sorteios no mesmo sistema.

## Baseline observado

- Frontend React, TypeScript, Vite, React Router e Supabase.
- 12 migrações locais do módulo Sorteios e 9 Edge Functions de negócio.
- Testes unitários existentes para os motores de sorteio, regras, avatar e permalink.
- Não há repositório Git local nesta pasta; alterações desta evolução precisam ser revisadas por arquivo.
- Há arquivos locais sensíveis ignorados pelo `.gitignore`. Esta entrega não os lê, move, altera nem rotaciona.

## Roadmap priorizado

| Sprint | Entrega de valor | Critério de pronto |
| --- | --- | --- |
| 0 | Fundação segura: baseline, fronteiras, papéis, plano de dados e rollback | Estratégia registrada; nenhuma mudança remota; migração local revisável |
| 1 | Agenda editorial e briefing persistido no domínio Marketing | Usuário cria, encontra, retoma e reclassifica o mesmo briefing; Sorteios continua navegável |
| 2 | Assistente de conteúdo | Gateway server-side preparado para estratégia, ângulo, legenda, CTA e prompt, com registro de operação e custo |
| 3 | Versões e aprovação | Versões comparáveis, aprovação humana explícita, auditoria e exportação manual |
| 4 | Instagram em leitura | Conta conectada em domínio próprio, mídia e métricas importadas; nenhuma publicação |
| 5 | Imagem via OpenRouter | Geração somente após aprovação de prompt, com limite de custo e variantes controladas |
| 6 | Relatório semanal e sinais de produto | Relatório acionável, tendências/sinais de produto e, somente depois, publicação aprovada |

## Sprint 0 — decisões e proteção

### Estado da fundação em 14/09/2026

- O projeto passou a ter histórico Git local; o commit-base `9068b92` preserva o estado funcional do Sprint 1.1.
- O endurecimento da migração `0013` está isolado na branch `feature/marketing-foundation-hardening`.
- A migração agora inclui isolamento por workspace, RPCs transacionais, controle otimista, auditoria e ledger append-only, idempotência e privilégios mínimos.
- `npm test` valida estaticamente essas garantias e executa a suíte do frontend.
- A aplicação remota continua bloqueada até a execução do roteiro `docs/marketing-foundation-validation.md` em PostgreSQL/Supabase local descartável e autorização explícita.

### Papéis iniciais

| Papel | Permissões no Marketing |
| --- | --- |
| Administrador | Gerencia workspace, membros, limites e todo o ciclo de conteúdo |
| Revisor | Cria e edita briefings, revisa e aprova conteúdo dentro do workspace |

O detalhamento de permissões de publicação será decidido antes do Sprint 4. Sorteios mantém suas regras atuais até uma revisão específica.

### Plano de migrações

1. Criar as tabelas `marketing_*` por migração incremental, sem alterar tabelas de Sorteios.
2. Habilitar RLS em toda tabela Marketing e autorizar somente membros do workspace.
3. Começar por `marketing_workspace`, `marketing_member`, `marketing_content_item`, `marketing_audit_event`, `marketing_ai_run` e `marketing_cost_ledger`.
4. Criar o primeiro workspace por função atômica, vinculando o usuário autenticado como administrador.
5. Aplicar local/remotamente apenas com autorização específica e depois validar RLS, criação de workspace e acesso cruzado.
6. Criar storage e integrações em entregas posteriores, em buckets/segredos separados.

### Segurança fora desta entrega

- Rotação de credenciais, alteração de segredos, App Meta, migrações remotas e deploy exigem autorização específica.
- Nenhuma chave de IA deve entrar em `VITE_*`, no navegador ou no repositório.
- Toda chamada futura de IA deve registrar usuário, operação, modelo, limite e custo estimado/real.

## Sprint 1 — agenda e briefing

### Primeiro corte vertical

Uma pessoa pode abrir Marketing e Conteúdo, criar um briefing com objetivo, público, pilar, formato, data e hipótese, salvá-lo como rascunho, retomá-lo pela agenda e atualizar o mesmo item. Enquanto a migração não for aplicada, os rascunhos ficam explicitamente no navegador, sem simular sincronização remota.

### Critérios de aceite

- Navegação entre Sorteios e Marketing sem mudar rotas existentes de Sorteios.
- Para preparar estratégia, campos obrigatórios: título, objetivo, público, pilar, formato, data e hipótese. Um rascunho inicial exige apenas título.
- Estados visíveis: `IDEIA`, `EM_BRIEFING` e `PRONTO_PARA_ESTRATEGIA`.
- O estado é derivado dos dados e da ação: somente título é ideia; preenchimento parcial é briefing; preparação exige todos os campos.
- A edição preserva identificador e data de criação, atualiza o mesmo item e não gera duplicata.
- Rascunhos reaparecem após recarregar o navegador.
- Falhas de leitura e gravação são apresentadas sem apagar a agenda nem limpar o formulário.
- A migração local contém modelo equivalente para persistência remota posterior.
- Não há chamada a Meta, OpenRouter ou serviço externo.

### Validação do Sprint 1.1

- 87 testes automatizados passaram em 9 arquivos.
- TypeScript e build de produção passaram.
- Lint passou sem erros; permanecem três avisos preexistentes fora do domínio Marketing.
- Smoke test em navegador confirmou a jornada `IDEIA` → `EM_BRIEFING` → `PRONTO_PARA_ESTRATEGIA`, sem duplicação.
- Navegação móvel validada em 320 px, com rótulos acessíveis e sem estado ativo duplicado em Sorteios.

## Critério de pronto para cada entrega

- Escopo e critérios de aceite documentados.
- Tipos de domínio e erros previsíveis cobertos por teste quando houver lógica pura.
- Build, lint e testes aplicáveis executados localmente.
- Nenhuma regressão intencional no módulo Sorteios.
- Sem segredos novos, chamadas remotas, deploy ou migração aplicada sem autorização.

## Riscos, decisões pendentes e rollback

| Tema | Risco/decisão | Mitigação ou rollback |
| --- | --- | --- |
| Credenciais atuais | Podem precisar de rotação | Não alterar nesta entrega; tratar em operação autorizada |
| Migração Marketing | RLS ou bootstrap de workspace pode bloquear acesso | Migração ainda não aplicada; rollback é não aplicá-la ou criar migração corretiva, nunca editar produção manualmente |
| Dados locais de briefing | Navegador pode ser limpo | Interface identifica rascunhos locais; sincronização só é ativada após migração e teste |
| Integração Meta | Permissões de leitura/publicação podem divergir | Validar em Sprint 4; nenhuma publicação antes de aprovação explícita |
| IA e custos | Uso inesperado ou chave exposta | Gateway server-side, ledger, teto e bloqueio antes de qualquer geração |
| Coexistência com Sorteios | Mudança visual ou de rotas pode causar regressão | Novas rotas sob `/marketing`; validação do build e testes existentes |
