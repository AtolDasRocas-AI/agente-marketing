# ATOL Studio — estratégia e backlog de evolução

**Status em 14/09/2026:** a fundação e a persistência remota do Sprint 1 foram implementadas na branch feature/marketing-foundation-hardening. As migrações 0013 e 0014 estão aplicadas somente no projeto Supabase **Sorteio** (uakwbtmbhwifiekwmsbq). O frontend ainda não foi publicado, a integração Meta não foi alterada e nenhuma credencial foi rotacionada.

## Visão do produto

ATOL Studio é a ferramenta externa de marketing e inteligência de produto da ATOL. Por decisão do projeto, ela coexiste com o módulo de Sorteios no mesmo código-base e no mesmo projeto Supabase **Sorteio**, mas mantém domínio, tabelas e permissões próprios.

| Módulo | Finalidade | Estado atual |
| --- | --- | --- |
| Sorteios | Sorteios de Instagram auditáveis, com regras, comprovante e expurgo LGPD | Produto existente e protegido contra regressões |
| Marketing e Conteúdo | Planejar, criar, revisar, aprovar, medir e aprender com conteúdo | Agenda e briefing remoto implementados; ainda sem deploy |

O banco da aplicação principal da ATOL continua fora deste escopo. ATOL Studio não compartilha tabelas nem permissões com essa aplicação.

## Fronteiras de domínio

| Área | Compartilhada | Isolada por domínio |
| --- | --- | --- |
| Interface | Shell, navegação, identidade visual e componentes básicos | Telas e fluxos sob /marketing |
| Identidade | Sessão Supabase | Papéis e autorização de Marketing por workspace |
| Dados | Projeto Supabase Sorteio | Tabelas sorteio* e marketing_* sem relações cruzadas |
| Storage | Infraestrutura do projeto | Buckets e políticas separados quando os ativos forem implementados |
| Integrações | Padrões server-side | Tokens, permissões, auditoria e limites por integração |

## Baseline observado

- Frontend React, TypeScript, Vite, React Router e Supabase.
- 14 migrações locais e 9 Edge Functions.
- Testes unitários para os motores de sorteio, regras, avatar, permalink e domínio Marketing.
- Histórico Git local com baseline preservado no commit 9068b92.
- Arquivos locais sensíveis permanecem ignorados e não foram lidos nem alterados.

## Roadmap priorizado

| Sprint | Entrega de valor | Critério de pronto |
| --- | --- | --- |
| 0 | Fundação segura | Domínio isolado, RLS, auditoria, privilégios mínimos e migrations oficiais |
| 1 | Agenda editorial e briefing | Usuário autenticado cria, encontra, retoma e reclassifica o mesmo briefing remotamente |
| 2 | Assistente de conteúdo | Gateway server-side para estratégia, ângulo, legenda, CTA e prompt, com custo auditável |
| 3 | Versões e aprovação | Versões comparáveis, aprovação humana e exportação manual |
| 4 | Instagram em leitura | Conta e métricas importadas em domínio próprio, sem publicação |
| 5 | Imagem via OpenRouter | Geração após aprovação de prompt, com teto de custo e variantes controladas |
| 6 | Relatório semanal e sinais de produto | Tendências e sinais acionáveis; publicação somente após aprovação explícita |

## Sprint 0 — fundação concluída

- 0013_marketing_foundation aplicada remotamente como versão 20260914212813.
- 0014_security_and_idempotency aplicada remotamente como versão 20260914230357.
- Seis tabelas marketing_* com RLS, isolamento por workspace, auditoria e ledger append-only.
- RPCs transacionais para workspace e briefing, controle otimista e idempotência.
- Resultado de sorteio protegido contra duplicidade e exclusão direta pelo cliente.
- Scripts de banco passaram a exigir URL via ambiente e TLS verificado.
- O runner paralelo de migrações _migracoes foi removido; o histórico oficial do Supabase é a única fonte para novas migrações.

### Papéis iniciais

| Papel | Permissões no Marketing |
| --- | --- |
| Administrador | Gerencia workspace, membros, limites e todo o ciclo de conteúdo |
| Revisor | Cria e edita briefings, revisa e aprova conteúdo dentro do workspace |

O detalhamento de publicação será decidido antes do Sprint 4. Sorteios mantém suas regras atuais até uma revisão específica.

## Sprint 1 — agenda e briefing remoto

Uma pessoa autenticada pode abrir Marketing e Conteúdo, criar o workspace inicial de forma idempotente, salvar um briefing, retomá-lo pela agenda e atualizar o mesmo item. A interface usa somente o projeto Supabase **Sorteio** configurado no app.

Comportamentos implementados:

- rotas /marketing/* protegidas por autenticação e retorno ao destino após login;
- criação idempotente para impedir duplicação por clique ou repetição de requisição;
- edição otimista por versão, com mensagem clara em caso de conflito;
- busca e filtros sobre os itens visíveis pela RLS;
- campos preservados quando ocorre falha de rede ou gravação;
- aviso sobre rascunhos antigos do navegador, sem migração silenciosa;
- criação automática do workspace inicial quando não existe nenhum;
- recusa de escolha silenciosa quando o usuário participa de mais de um workspace.

Estados visíveis: IDEIA, EM_BRIEFING e PRONTO_PARA_ESTRATEGIA. Preparar estratégia exige título, objetivo, público, pilar, formato, data e hipótese.

### Validação atual

- npm run check passa integralmente.
- 94 testes do frontend passam em 10 arquivos.
- 0013 e 0014 passam juntas em PostgreSQL descartável (PGlite), incluindo privilégios, RLS, idempotência, rollback e proteção contra resultado duplicado.
- Varredura de 81 arquivos rastreados não encontra senha de banco, URL PostgreSQL com credenciais nem TLS desabilitado.
- Lint passa sem erros ou avisos; TypeScript e build de produção passam.
- O histórico remoto confirmou as duas migrações no projeto correto.
- O teste ponta a ponta com uma sessão real do app continua pendente antes do deploy.

## Critério de pronto para cada entrega

- Escopo e critérios de aceite documentados.
- Erros previsíveis e regras de domínio cobertos por teste.
- Testes, lint e build executados localmente.
- Nenhuma regressão intencional em Sorteios.
- Nenhuma chave de IA em VITE_*, no navegador ou no repositório.
- Operações de IA futuras registram usuário, modelo, limites e custo.

## Riscos e próximos controles

| Tema | Risco/decisão | Mitigação ou próximo passo |
| --- | --- | --- |
| Credencial no histórico Git | Uma senha de banco existiu em arquivos versionados e pode continuar recuperável no histórico | Rotacionar a senha no Supabase com janela controlada; depois avaliar limpeza do histórico separadamente |
| Deploy | O frontend publicado ainda não contém esta entrega | Fazer smoke test autenticado e publicar somente após revisão do ambiente |
| Migrações aplicadas | Arquivos aplicados são imutáveis | Toda correção futura deve ser uma nova migração transacional |
| Rascunhos locais antigos | Podem existir dados no navegador do operador | Mostrar a quantidade e planejar importação explícita, sem sobrescrever dados remotos |
| Edge Function de execução | A unicidade bloqueia resultado duplicado, mas o fluxo server-side ainda não é uma única transação | Criar uma RPC atômica antes de ampliar concorrência operacional |
| Avisos do Supabase | Há políticas com custo por linha, índices novos ainda sem uso e proteções de Auth pendentes | Medir após uso real; habilitar proteção de senhas vazadas no painel antes do go-live |
| IA e custos | Uso inesperado ou chave exposta | Gateway server-side, ledger, teto e bloqueio antes de qualquer geração |
| Integração Meta | Permissões podem divergir entre leitura e publicação | Validar no Sprint 4; nenhuma publicação automática antes de aprovação humana |
