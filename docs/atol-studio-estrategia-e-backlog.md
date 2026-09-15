# ATOL Studio — estratégia e backlog de evolução

**Status em 14/09/2026:** os Sprints 0, 1 e a fundação técnica do Sprint 2 foram implementados na branch feature/marketing-foundation-hardening. As migrações 0013, 0014 e 0015 estão aplicadas somente no projeto Supabase **Sorteio** (uakwbtmbhwifiekwmsbq); a 0016 adiciona apenas os índices de apoio identificados pela auditoria. O frontend ainda não foi publicado, a integração Meta não foi alterada e nenhuma credencial foi rotacionada.

## Visão do produto

ATOL Studio é a ferramenta externa de marketing e inteligência de produto da ATOL. Por decisão do projeto, ela coexiste com o módulo de Sorteios no mesmo código-base e no mesmo projeto Supabase **Sorteio**, mas mantém domínio, tabelas e permissões próprios.

| Módulo | Finalidade | Estado atual |
| --- | --- | --- |
| Sorteios | Sorteios de Instagram auditáveis, com regras, comprovante e expurgo LGPD | Produto existente e protegido contra regressões |
| Marketing e Conteúdo | Planejar, criar, revisar, aprovar, medir e aprender com conteúdo | Agenda, briefing e estratégia assistida com orçamento protegido; ainda sem deploy |

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
| 3 | Versões e aprovação | Versões comparáveis e aprovação humana implementadas; exportação manual pendente |
| 4 | Instagram em leitura | Estrutura, tela e importador somente-leitura implementados; ativação depende da nova autorização Meta |
| 5 | Imagem via OpenRouter | Geração após aprovação de prompt, com teto de custo e variantes controladas |
| 6 | Relatório semanal e sinais de produto | Relatório semanal e hipótese priorizada a partir de métricas; publicação continua manual |

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

## Sprint 2 — estratégia assistida e custo protegido

O app pode preparar uma estratégia, ângulo, legenda, CTA ou prompt de imagem a partir de um briefing pronto. Cada solicitação recebe uma chave de idempotência, é bloqueada sem orçamento configurado e, quando concluída, cria uma versão imutável de conteúdo com custos e tokens registrados no ledger.

- a chave do provedor só é aceita como segredo server-side; nunca é enviada ao navegador;
- os limites mensal e por execução começam em zero e só um administrador do workspace pode alterá-los;
- a Edge Function não chama nenhum provedor enquanto faltarem chave, modelo ou custo estimado;
- a geração continua deliberadamente indisponível até a configuração explícita desses três itens;
- 0015 cria orçamento, versões e RPCs transacionais; 0016 adiciona índices das novas relações.

## Sprint 3 — revisão e aprovação humana

Uma versão pode ser enviada para aprovação por um membro do workspace. Apenas um administrador decide aprovar ou devolver; a decisão, o solicitante e a mudança de estado ficam registrados no banco. A aprovação não publica conteúdo e não aciona nenhuma integração externa.

## Sprint 4 — Instagram em leitura

O módulo de Métricas permite associar a conta Instagram já conectada ao workspace de Marketing e importar instantâneos de publicações, curtidas e comentários. A tabela de Marketing não guarda o token, o cliente não recebe credenciais e nenhuma rota de publicação é criada. A função de importação só poderá ser disponibilizada após a reconexão da conta com a permissão de insights.

### Validação atual

- npm run check passa integralmente.
- 94 testes do frontend passam em 10 arquivos.
- 0013–0016 passam juntas em PostgreSQL descartável (PGlite), incluindo privilégios, RLS, idempotência, rollback, custo bloqueado sem teto e proteção contra resultado duplicado.
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
| Edge Function de execução | Uma chave de provedor, um modelo e um custo estimado ainda precisam ser definidos pelo responsável | Manter a função bloqueada e configurar os segredos somente na fase de ativação controlada |
| Avisos do Supabase | Há funções SECURITY DEFINER intencionais com checagem interna, tabelas legadas sem policy e proteções de Auth pendentes | Manter as funções auditadas, não expor tabelas legadas e habilitar proteção de senhas vazadas no painel antes do go-live |
| IA e custos | Uso inesperado ou chave exposta | Gateway server-side, ledger, teto e bloqueio antes de qualquer geração |
| Integração Meta | Permissões podem divergir entre leitura e publicação | Validar no Sprint 4; nenhuma publicação automática antes de aprovação humana |
