# ATOL Studio — Plano de continuação

Documento para retomar o desenvolvimento no Claude Code ou no Codex sem perder o contexto do projeto.

Última verificação: 15/09/2026  
Projeto local: `C:\Users\User\Documents\Projeto\Sorteio`  
Produção: `https://app-one-fawn-32.vercel.app`  
Supabase correto: `Sorteio` — ref `uakwbtmbhwifiekwmsbq`

## 1. Estado atual

### Validado

- Testes locais, lint e build passaram.
- 94 testes automatizados aprovados.
- Login por Google implementado.
- E-mail e cadastro por SMS desativados.
- Hook de bloqueio de novos usuários criado no banco.
- URL de produção configurada no Auth.
- Métricas básicas do Instagram e notas de contexto implementadas.
- Functions de importação de métricas e geração de conteúdo publicadas.
- Migrações 0013 até 0019 aparecem no histórico remoto.
- Migração local 0020 existe e a função correspondente existe no banco.

### Produto já disponível

- Agenda de conteúdo.
- Briefings de marketing.
- Estratégia de conteúdo.
- Aprovação humana de conteúdo.
- Controle de orçamento e ledger de IA.
- Métricas básicas de publicações do Instagram.
- Relatório semanal inicial.
- Campo de notas de contexto para registrar eventos relevantes da ATOL.
- Sorteios e importação de comentários já existentes no produto original.

## 2. Pendências que dependem do responsável da ATOL

Estas ações exigem login ou decisão da pessoa responsável. O desenvolvimento não deve simular ou inventar essas confirmações.

### P0 — reconectar o Instagram

1. Abrir a aplicação em produção.
2. Acessar a área de conexão do Instagram.
3. Clicar em **Revincular conta**.
4. Autorizar a conta correta `@atol.ia.oficial` no Meta.
5. Voltar para Marketing > Métricas.
6. Clicar em **Importar métricas agora**.

Critério de aceite: a importação termina sem erro `Edge Function returned a non-2xx status code` e aparecem publicações, métricas e data de coleta.

Se falhar, registrar o horário e consultar os logs da function antes de alterar o código.

### P0 — confirmar usuários permitidos

O código atual permite:

- `atoldasrocas.ai@gmail.com`
- `lipe.kosse@gmail.com`

Confirmar se a segunda conta deve permanecer. Se a regra correta for somente a conta institucional, alterar a lista no frontend e na função do hook em uma nova migração, nunca editando uma migração já aplicada.

### P0 — definir orçamento da IA

Na estratégia de um briefing, um administrador deve definir:

- limite mensal do workspace;
- limite por execução.

Critério de aceite: uma geração de conteúdo é autorizada quando está dentro dos limites e é recusada com mensagem clara quando ultrapassa o orçamento.

### P1 — escolher o modelo de texto

O ambiente está configurado com `openai/gpt-4o-mini`. Existe estudo recomendando avaliar `openai/gpt-5.6-luna`.

Não trocar o modelo automaticamente. Fazer uma decisão explícita considerando qualidade, custo, latência e disponibilidade no OpenRouter.

## 3. Pendências de desenvolvimento — ordem recomendada

### Sprint A — regularizar o estado do banco

Objetivo: deixar o histórico remoto seguro para as próximas entregas.

Tarefas:

1. Confirmar por consulta somente leitura a função `hook_permitir_somente_google_atol`.
2. Confirmar no painel/API se o hook está realmente ativo como **Before User Created**.
3. Investigar por que a 0020 não aparece na lista remota de migrações, embora sua função exista.
4. Escolher uma estratégia segura para reconciliar o histórico. Não executar `supabase db push` enquanto isso não estiver decidido.
5. Registrar a decisão em documentação.

Critério de aceite: histórico local e remoto compreensível, sem reaplicar as migrações 0013–0020 e sem duplicar funções.

Restrições:

- usar somente `uakwbtmbhwifiekwmsbq`;
- nunca usar `ltrhsljnzuxoqyoodbfu`;
- não editar migrations já aplicadas;
- não versionar `supabase/config.toml` sem decisão explícita;
- não expor `.env`, tokens ou secrets.

### Sprint B — finalizar a fundação de dados do Instagram

Objetivo: garantir uma coleta auditável e repetível antes de adicionar IA.

Tarefas:

1. Validar importação de publicações e métricas após a reconexão.
2. Tornar a importação idempotente.
3. Registrar início, fim, quantidade, cursor e erro de cada execução.
4. Permitir reprocessamento sem duplicar snapshots.
5. Mostrar na tela a última coleta bem-sucedida e a última falha.
6. Diferenciar claramente “sem dados”, “token expirado”, “permissão ausente” e “limite da Meta”.
7. Manter apenas leitura; não publicar, editar ou responder no Instagram.

Critério de aceite: duas importações consecutivas do mesmo período não duplicam dados e deixam um histórico consultável.

### Sprint C — comentários e sinais de audiência

Objetivo: criar o agente analista em modo observação.

Tarefas:

1. Importar comentários associados às publicações permitidas pela API.
2. Armazenar identificador externo, autor, texto, data e publicação relacionada.
3. Classificar localmente os comentários em categorias simples:
   - dúvida;
   - elogio;
   - reclamação;
   - intenção de compra;
   - pedido de suporte;
   - spam ou irrelevante;
   - não classificado.
4. Exibir volume por categoria e evolução no tempo.
5. Destacar dúvidas e objeções recorrentes.
6. Não responder comentários automaticamente.
7. Aplicar retenção e expurgo coerentes com LGPD.

Critério de aceite: o usuário consegue abrir uma publicação, consultar os comentários importados, filtrar por categoria e revisar a classificação.

### Sprint D — notas e correlação de contexto

Objetivo: conectar fatos da operação às mudanças observadas sem afirmar causalidade.

Tarefas:

1. Melhorar o formulário de nota com categoria e data do evento.
2. Permitir editar ou arquivar uma nota, mantendo trilha de auditoria.
3. Relacionar notas próximas às publicações e aos períodos de métricas.
4. Mostrar frases como “coincide com o período” ou “hipótese a investigar”, nunca “causou”.
5. Permitir fonte opcional, como link de matéria, campanha ou evento.

Critério de aceite: um relatório mostra métricas, notas próximas e uma hipótese explicitamente marcada como hipótese.

### Sprint E — agente de inteligência de produto

Objetivo: gerar análises revisáveis para apoiar decisões de marketing.

Tarefas:

1. Criar um pipeline de análise com entrada versionada.
2. Gerar resumo de desempenho por período e formato.
3. Identificar padrões de temas, formatos, horários e chamadas.
4. Apontar comentários recorrentes e possíveis oportunidades.
5. Correlacionar sinais com notas de contexto.
6. Gerar hipóteses com:
   - evidências usadas;
   - período analisado;
   - limitações;
   - confiança qualitativa;
   - próxima ação sugerida;
   - custo estimado.
7. Exigir revisão humana antes de salvar uma recomendação como decisão.

Critério de aceite: cada hipótese pode ser auditada até os dados e notas que a originaram.

### Sprint F — conteúdo e imagens

Objetivo: transformar análise aprovada em rascunhos de conteúdo.

Tarefas:

1. Gerar rascunhos de legenda, roteiro e chamada.
2. Versionar cada geração.
3. Mostrar modelo, custo estimado e dados de entrada.
4. Permitir aprovar, rejeitar ou pedir nova versão.
5. Implementar geração de imagem somente depois de definir fornecedor, custo, direitos de uso e armazenamento.
6. Manter publicação automática desativada.

Critério de aceite: nenhum texto ou imagem é publicado sem aprovação humana explícita.

## 4. Riscos prioritários

### Autorização do Instagram

Permissões habilitadas no Meta não significam que o token antigo recebeu as permissões. A reconexão é obrigatória antes de concluir o diagnóstico.

### Histórico de migrações

A 0020 existe localmente e sua função existe remotamente, mas ela não aparece na lista remota de migrations. Não usar `db push` até entender a divergência.

### Controle de acesso

O sistema deve manter a mesma política no frontend, no hook do Supabase e nas rotas protegidas. Nunca confiar apenas no bloqueio visual do frontend.

### Dados pessoais

Comentários e identificadores do Instagram são dados de terceiros. Minimizar coleta, limitar acesso, definir retenção e preservar o expurgo.

### IA sem rastreabilidade

Toda saída da IA deve guardar modelo, versão do prompt, data, custo, entrada resumida e aprovação humana. Não transformar correlação em causalidade.

### Functions com erro silencioso

Toda falha de importação deve gerar status, mensagem operacional e log suficiente para diagnóstico sem registrar tokens.

## 5. Alertas do Supabase para a próxima rodada

Não são bloqueadores imediatos, mas devem ser revisados:

- RLS habilitado sem política em `privado.ig_token` e `public._migracoes`;
- `pg_net` instalado no schema `public`;
- funções `SECURITY DEFINER` executáveis por `authenticated`;
- proteção contra senhas vazadas desativada;
- quatro chaves estrangeiras sem índice;
- otimizações de políticas RLS com `select auth...()`;
- índices novos ainda sem uso, possivelmente normais enquanto o produto está em MVP.

Cada correção deve ser feita em migration nova, com teste e revisão do impacto no app original de sorteios.

## 6. Checklist de validação antes de publicar

- [ ] conta correta do Supabase confirmada;
- [ ] nenhum uso do projeto antigo;
- [ ] migrations remotas conferidas;
- [ ] importação do Instagram executada com sucesso;
- [ ] token não aparece em logs ou frontend;
- [ ] orçamento de IA configurado;
- [ ] geração de conteúdo testada dentro e fora do limite;
- [ ] login Google testado com conta permitida;
- [ ] conta não permitida bloqueada pelo hook e pela aplicação;
- [ ] sorteio original continua funcionando;
- [ ] testes, lint e build aprovados;
- [ ] revisão manual da tela de produção;
- [ ] publicação aprovada pelo responsável.

## 7. Instrução para o próximo agente

Antes de editar qualquer arquivo:

1. Ler este documento e `docs/HANDOFF-CLAUDE-CODE-ATOL.md`.
2. Executar `git status --short`.
3. Confirmar o projeto Supabase pelo ref `uakwbtmbhwifiekwmsbq`.
4. Fazer somente consultas de leitura para entender o estado remoto.
5. Não executar `supabase db push`.
6. Não alterar migrations já aplicadas.
7. Não publicar ou trocar secrets sem autorização explícita.
8. Trabalhar em uma sprint por vez e atualizar este documento ao concluir cada critério de aceite.

Primeiro trabalho recomendado: concluir a reconexão do Instagram e validar a importação. Em paralelo, resolver a divergência da migração 0020 antes de criar novas alterações no banco.
