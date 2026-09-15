# Spec Kit: ATOL Studio — Continuação da Fundação de Marketing e Inteligência de Instagram

**Criado em:** 2026-09-15
**Status:** approved
**Escopo:** `app/src/features/marketing`, `app/src/features/auth`, `supabase/migrations`, `supabase/functions` — dentro do repositório Sorteio (módulo Marketing/ATOL Studio, coexistindo com o módulo de Sorteios)

---

## Context

O ATOL Studio já entrega, em produção, agenda editorial, briefing, estratégia assistida por IA com orçamento protegido, aprovação humana de conteúdo, ledger de custos, login Google-only e uma primeira leitura somente-leitura de métricas do Instagram. Esse trabalho está descrito em `docs/atol-studio-estrategia-e-backlog.md` (Sprints 0–4 daquele documento) e confirmado em `docs/HANDOFF-CLAUDE-CODE-ATOL.md`.

O que falta é o que o `docs/PLANO-CONTINUACAO-ATOL.md` chama de Sprints A–F: fechar uma divergência de histórico de migrações antes de tocar no banco de novo, tornar a coleta de dados do Instagram auditável e paginada de verdade, ligar um agente analista de comentários (observação, nunca resposta automática), enriquecer as notas de contexto com trilha de auditoria, construir um agente de inteligência de produto que gera hipóteses revisáveis (nunca causalidade), e finalmente versionar rascunhos de conteúdo com geração de imagem — sempre sob os dois invariantes do produto: **nenhuma publicação automática** e **rastreabilidade total de toda saída de IA** (modelo, custo, entrada, aprovação humana).

Este spec-kit cobre as seis sprints como um único documento, com uma onda de implementação por sprint (Seção 12), porque são cortes verticais de valor que dependem parcialmente uns dos outros (banco → dados do Instagram → comentários/notas → inteligência → conteúdo/imagem) — exatamente o caso em que o template recomenda várias ondas em vez de uma só.

---

## 1. Visão e Motivação

- **Problema:** o produto já funciona ponta a ponta para agenda/briefing/conteúdo, mas a camada de dados do Instagram é frágil (importa só 50 posts, sem paginação; não sabe explicar por que uma importação falhou; não tem histórico de execuções), não existe leitura de comentários (a maior fonte de sinal de audiência), as notas de contexto não têm edição/trilha, não existe agente de inteligência gerando hipóteses revisáveis, e a geração de imagem nunca foi implementada. Além disso, uma migração (0020) está em estado ambíguo no histórico remoto e bloqueia qualquer novo `db push` até ser entendida.
- **Situação atual:** ver `docs/PLANO-CONTINUACAO-ATOL.md`, seção "Estado atual" — validado localmente, parcialmente em produção, com pendências explícitas que dependem do responsável da ATOL (reconexão do Instagram) e pendências de desenvolvimento (este spec-kit).
- **Resultado ideal:** as seis sprints entregues, cada uma com o seu critério de aceite validado por `npm run check` e, quando aplicável, por teste manual na tela de produção — sem nunca simular uma confirmação que só o responsável da ATOL pode dar.

## 2. Usuários e Stakeholders

| Persona | Descrição | Necessidades Principais |
|---|---|---|
| Administrador do workspace Marketing | Funcionário ATOL com papel `ADMINISTRADOR` | Configurar orçamento de IA, aprovar/reprovar conteúdo e hipóteses, decidir sobre acesso |
| Revisor de conteúdo | Papel `REVISOR` | Criar briefings, revisar comentários classificados, sugerir versões |
| Responsável pela conta `@atol.ia.oficial` | Quem controla a conta Instagram/Meta | Precisa reconectar a conta manualmente no Meta — ação humana que este spec-kit nunca simula |
| Comentarista/participante do Instagram | Titular de dados de terceiro (LGPD) | Dados minimizados, retenção limitada (90 dias), nunca resposta automática |
| Módulo Sorteios (produto vizinho) | Coexiste no mesmo código e banco | Zero regressão; nenhuma tabela ou permissão cruzada com `marketing_*` |

## 3. Capacidades Desejadas

| ID | Capacidade |
|---|---|
| CAP-01 | Reconciliar e documentar o histórico de migrações 0013–0020 no Supabase remoto sem reaplicar nenhuma |
| CAP-02 | Restringir a criação de contas Google exclusivamente a `atoldasrocas.ai@gmail.com`, via migração nova |
| CAP-03 | Importar publicações e métricas do Instagram com paginação completa (sem o limite de 50 atual) |
| CAP-04 | Registrar cada execução de importação (início, fim, quantidade, cursor, erro) em log auditável |
| CAP-05 | Permitir reprocessar uma importação sem duplicar snapshots de métricas |
| CAP-06 | Diferenciar visivelmente "sem dados", "token expirado", "permissão ausente" e "limite da Meta" |
| CAP-07 | Mostrar a última coleta bem-sucedida e a última falha na tela de Métricas |
| CAP-08 | Importar comentários das publicações, somente leitura |
| CAP-09 | Classificar cada comentário em 1 de 7 categorias via IA local ao produto (nunca resposta automática) |
| CAP-10 | Exibir volume de comentários por categoria e evolução no tempo, por publicação |
| CAP-11 | Expurgar dados pessoais de comentários após 90 dias, preservando agregados por categoria |
| CAP-12 | Editar ou arquivar uma nota de contexto, mantendo trilha de auditoria |
| CAP-13 | Relacionar notas de contexto a publicações e períodos de métricas próximos no tempo |
| CAP-14 | Apresentar correlações sempre como hipótese ("coincide com o período"), nunca como causalidade |
| CAP-15 | Gerar hipóteses semanais de inteligência de produto com evidências, período, limitações, confiança, próxima ação e custo |
| CAP-16 | Exigir revisão humana explícita antes de qualquer hipótese valer como decisão |
| CAP-17 | Permitir pedir nova versão de um rascunho de conteúdo já gerado, sem perder as versões anteriores |
| CAP-18 | Gerar imagem a partir de um `PROMPT_IMAGEM` já aprovado por humano |
| CAP-19 | Manter publicação automática desativada em toda a extensão do produto (texto e imagem) |
| CAP-20 | Manter rastreabilidade total de toda saída de IA: modelo, execução, data, custo, entrada resumida, aprovação humana |

## 4. Fora do Escopo

- Publicação automática em qualquer rede social, de texto ou imagem
- Resposta automática a comentários
- Scraping do Instagram ou qualquer via que não seja a Graph API oficial
- Reconexão automática da conta Instagram — exige login humano no Meta, fora do alcance de qualquer agente
- Múltiplas contas Instagram por workspace (o esquema atual é 1:1 workspace↔conexão)
- Verificar "segue o perfil" ou "curtiu a publicação" — a Graph API não expõe essas relações
- Importar Stories, Reels ou Direct nesta fase — só posts de feed, mesma limitação já validada no módulo Sorteios
- Migrar dados do projeto Supabase antigo (`ltrhsljnzuxoqyoodbfu`)
- Alterar política de acesso fora de uma migração nova, ou editar 0001–0020
- Interface pública de hipóteses/insights — uso interno da equipe ATOL apenas
- Reescrever o redesign visual descrito em `spec-kits/redesign-atol.handoff.md` — é uma frente separada, só de apresentação

## 5. Cenários e Edge Cases

| # | Cenário | Comportamento Esperado | Prioridade |
|---|---|---|---|
| E-01 | Reprocessar importação de métricas do mesmo período | Não duplica snapshot; log mostra 2 execuções, mesma contagem final | Alta |
| E-02 | Conta com mais de 50 publicações (limite atual) | Paginação completa traz todas, não só as 50 mais recentes | Alta |
| E-03 | Token expirado durante a importação | Log marca `TOKEN_EXPIRADO`; tela pede reconexão | Alta |
| E-04 | Permissão `instagram_business_manage_insights` ausente | Log marca `PERMISSAO_AUSENTE`, mensagem específica | Alta |
| E-05 | Limite de chamadas da Meta atingido | Log marca `LIMITE_META`; backoff exponencial e retomada pelo cursor | Média |
| E-06 | Conta sem nenhuma publicação ainda | Log marca `SUCESSO`/`SEM_DADOS`; tela mostra estado vazio claro | Média |
| E-07 | Comentário sem texto (só emoji/sticker) | Classificado como `NAO_CLASSIFICADO`, nunca gera erro | Média |
| E-08 | Comentário do próprio perfil `@atol.ia.oficial` | Importado, mas identificável como autor da marca; não conta como sinal de audiência | Média |
| E-09 | Comentário editado depois de importado | Prevalece o texto do snapshot mais recente antes da reclassificação | Baixa |
| E-10 | Comentário deletado no Instagram após importação | Permanece no snapshot já coletado até o expurgo de 90 dias | Baixa |
| E-11 | Reclassificação manual de um comentário já rotulado pela IA | Humano sobrescreve a categoria; fica registrado quem e quando | Média |
| E-12 | Nota de contexto arquivada | Sai das sugestões futuras de correlação, mas continua no histórico auditável | Média |
| E-13 | Duas notas de contexto no mesmo dia | Ambas relacionadas ao período, sem prioridade implícita entre elas | Baixa |
| E-14 | Hipótese sem evidência suficiente no período analisado | Agente marca confiança baixa ou recusa gerar — nunca força uma conclusão | Alta |
| E-15 | Geração de imagem pedida sem `PROMPT_IMAGEM` aprovado | Bloqueada com mensagem clara | Alta |
| E-16 | Geração de conteúdo/imagem fora do orçamento do workspace | Recusada com mensagem clara (reaproveita o gate de `marketing_ai_budget` já implementado) | Alta |
| E-17 | Pedido de nova versão de um conteúdo já aprovado | Cria versão N+1; a aprovação anterior permanece preservada no histórico | Média |
| E-18 | Modelo de IA indisponível ou erro do OpenRouter | Falha com mensagem clara; nenhum custo debitado no ledger | Alta |
| E-19 | Estratégia de reconciliação da 0020 muda no meio da Onda A | Nenhum dado perdido; decisão documentada antes de qualquer novo `db push` | Alta |

## 6. Critérios de Aceite

- [x] **AC-01** — `supabase migration list` contra o projeto Sorteio mostra a divergência da 0020 documentada, com causa raiz e decisão registrada, sem reaplicar 0013–0020.
- [x] **AC-02** — Uma tentativa de login Google com `lipe.kosse@gmail.com` é bloqueada (403) depois da migração da Onda A. _Confirmado chamando a função remota diretamente: retorna `http_code: 403`. Falta só o teste de ponta a ponta pelo navegador (fora do alcance deste agente)._
- [x] **AC-03** — Uma tentativa de login Google com `atoldasrocas.ai@gmail.com` continua funcionando normalmente. _Confirmado chamando a função remota diretamente: retorna `{}` (sem bloqueio)._
- [ ] **AC-04** — Rodar a importação de métricas duas vezes seguidas para o mesmo período não duplica o total de snapshots.
- [ ] **AC-05** — Uma conta com mais de 50 publicações tem todas importadas, não só as 50 mais recentes.
- [ ] **AC-06** — Cada execução de importação (sucesso ou falha) aparece no log com início, fim, quantidade processada e, se houver falha, o tipo de erro.
- [ ] **AC-07** — A tela de Métricas mostra a última coleta bem-sucedida e a última falha, quando existir.
- [ ] **AC-08** — Um token expirado gera erro `TOKEN_EXPIRADO`, visualmente distinto de `PERMISSAO_AUSENTE` e `LIMITE_META`.
- [ ] **AC-09** — Comentários de uma publicação são importados e listados com autor, texto e data.
- [ ] **AC-10** — Cada comentário importado recebe uma categoria dentre as 7 definidas, com modelo de IA e data de classificação registrados.
- [ ] **AC-11** — A tela de comentários permite filtrar por categoria e ver o volume por categoria ao longo do tempo.
- [ ] **AC-12** — Comentários com 90+ dias desde a coleta são expurgados, preservando a contagem agregada por categoria.
- [x] **AC-13** — Uma nota de contexto pode ser editada ou arquivada sem apagar o registro original. _Provado por teste automatizado (PGlite): edição, arquivamento e trilha de auditoria (INSERT+UPDATE+UPDATE) confirmados._
- [ ] **AC-14** — Um relatório mostra métricas, notas de contexto próximas no tempo e uma frase de hipótese explicitamente marcada como hipótese. _Lógica implementada em `RelatorioSemanal.tsx`; falta verificar com dados reais em produção._
- [ ] **AC-15** — Uma hipótese semanal traz evidências usadas, período analisado, limitações, confiança qualitativa, próxima ação sugerida e custo estimado. _Depende de chamada real ao OpenRouter (secret ainda não configurado para este agente)._
- [x] **AC-16** — Uma hipótese só vale como decisão depois de aprovação humana explícita, registrada com quem aprovou e quando. _Provado por teste automatizado: aprovação, bloqueio de segunda decisão e bloqueio para não-administrador._
- [x] **AC-17** — É possível pedir uma nova versão de um rascunho de conteúdo já gerado sem perder as versões anteriores. _Já funcionava antes desta rodada — `marketing_finalizar_execucao_ia` já incrementa `numero` por operação; nenhuma mudança foi necessária além de exibir `prompt_imagem` nas versões._
- [ ] **AC-18** — Uma imagem só é gerada a partir de um `PROMPT_IMAGEM` com aprovação humana registrada. _Gate de aprovação implementado; a chamada real de geração de imagem ao OpenRouter nunca foi exercitada — ver aviso no topo de `marketing-gerar-imagem/index.ts`._
- [x] **AC-19** — Uma geração de conteúdo ou imagem fora do orçamento mensal ou por execução do workspace é recusada com mensagem clara. _Provado por teste automatizado para o fluxo genérico (`marketing_iniciar_execucao_ia_livre`), reaproveitando o gate já provado do fluxo original._
- [x] **AC-20** — Nenhuma publicação (texto ou imagem) sai automaticamente para o Instagram em nenhum ponto do fluxo. _Verificado por inspeção: nenhuma função nova chama endpoint de publicação da Graph API; a única escrita externa é upload no Storage privado._
- [x] **AC-21** — Toda saída de IA (conteúdo, classificação, hipótese, imagem) tem modelo, custo e entrada resumida auditáveis no ledger existente. _Todas as quatro operações passam por `marketing_iniciar/finalizar_execucao_ia(_livre)`, que grava no mesmo `marketing_cost_ledger`._
- [x] **AC-22** — `npm run check` passa integralmente ao final de cada onda, antes de qualquer aplicação remota.

## 7. Requisitos Não-Funcionais

- **Idempotência (RNF-01):** toda importação (métricas, comentários) pode ser re-executada sem duplicar dados, seguindo o padrão já provado no motor de sorteio (upsert por chave natural + cursor).
- **Segurança de token (RNF-02):** nenhum token do Instagram ou chave OpenRouter chega ao cliente; permanecem em Edge Functions e acessados só via `service_role`.
- **LGPD (RNF-03):** comentários seguem a mesma retenção de 90 dias já usada em Sorteios, com expurgo automatizado que preserva agregados por categoria.
- **Rastreabilidade de IA (RNF-04):** toda chamada de modelo grava no ledger existente (`marketing_cost_ledger`) e na tabela de versão/hipótese correspondente: modelo, custo, tokens, entrada resumida.
- **Orçamento (RNF-05):** nenhuma chamada de IA roda sem `marketing_ai_budget` configurado; falta de orçamento fecha com mensagem clara, não com erro genérico.
- **Resiliência de importação (RNF-06):** backoff exponencial e retomada por cursor, mesmo padrão já testado em `supabase/functions/ig-import-comments/index.ts` (módulo Sorteios).
- **Migrações (RNF-07):** toda mudança de esquema é migração nova, nunca edição de 0001–0020; aplicação remota só via `supabase db query --linked --file` (nunca `db push` cru).
- **Isolamento de domínio (RNF-08):** novas tabelas usam prefixo `marketing_` e não criam FK para tabelas `sorteio*`/`ig_account` fora do ponto de integração já existente (`marketing_instagram_connection`).

## 8. Análise Técnica

### 8.1 Mapa de Impacto

| Módulo | Caminho | Tipo de Mudança |
|---|---|---|
| Acesso institucional | `app/src/features/auth/acesso.ts` | Editar |
| Migração — restringir acesso | `supabase/migrations/0021_restringir_acesso_institucional.sql` | Criar |
| Migração — log de importação | `supabase/migrations/0022_marketing_instagram_import_run.sql` | Criar |
| Importador de métricas | `supabase/functions/marketing-importar-metricas-instagram/index.ts` | Editar |
| Tela de Métricas | `app/src/features/marketing/MetricasInstagram.tsx` | Editar |
| Migração — comentários | `supabase/migrations/0023_marketing_instagram_comment.sql` | Criar |
| Importador de comentários | `supabase/functions/marketing-importar-comentarios-instagram/index.ts` | Criar |
| Classificador de comentários | `supabase/functions/marketing-classificar-comentarios/index.ts` | Criar |
| Expurgo de comentários | `supabase/functions/lgpd-expurgo-marketing/index.ts` | Criar |
| Tela de Comentários | `app/src/features/marketing/Comentarios.tsx` | Criar |
| Migração — edição de notas | `supabase/migrations/0024_marketing_context_note_edicao.sql` | Criar |
| Relatório semanal | `app/src/features/marketing/RelatorioSemanal.tsx` | Editar |
| Migração — insight | `supabase/migrations/0025_marketing_insight.sql` | Criar |
| Gerador de hipóteses | `supabase/functions/marketing-gerar-insight/index.ts` | Criar |
| Tela de Insights | `app/src/features/marketing/Insights.tsx` | Criar |
| Migração — imagem | `supabase/migrations/0026_marketing_image_generation.sql` | Criar |
| Gerador de imagem | `supabase/functions/marketing-gerar-imagem/index.ts` | Criar |
| Tela de geração de imagem | `app/src/features/marketing/GeracaoImagem.tsx` | Criar |
| Assistente de conteúdo (nova versão) | `app/src/features/marketing/EstrategiaConteudo.tsx` | Editar |
| Camada de dados de IA | `app/src/features/marketing/aiRemote.ts` | Editar |

> Os números de migração 0021–0026 são provisórios — reconfirmar contra `supabase migration list` no início de cada onda (ver Seção 9).

### 8.2 Padrões Reutilizáveis

- **Gateway de IA server-side com `idempotency_key` + bloqueio por orçamento:** `supabase/functions/marketing-gerar-conteudo/index.ts` + `aiRemote.ts` (`gerarConteudoIa`, `configurarOrcamentoIa`, já implementado) — mesmo padrão para os agentes de comentários, hipóteses e imagem.
- **Instantâneo somente-leitura + RLS por workspace:** `supabase/migrations/0018_marketing_instagram_readonly.sql` (`marketing_instagram_connection`, `marketing_instagram_metric_snapshot`) — mesmo padrão para comentários e log de importação.
- **Insert idempotente com `idempotency_key uuid` + `on conflict do nothing`:** `marketing_criar_nota_contexto` (0019) — mesmo padrão para comentários e hipóteses.
- **Importação paginada com cursor, backoff exponencial e watchdog:** `supabase/functions/ig-import-comments/index.ts` (módulo Sorteios) — referência direta para as Ondas B e C.
- **Erro tipado por `codigo` em JSON:** `respostaJson({codigo: ...}, status)` em `supabase/functions/_shared/ig.ts` e `marketing-importar-metricas-instagram/index.ts` — mesmo padrão para os novos códigos (`TOKEN_EXPIRADO`, `PERMISSAO_AUSENTE`, `LIMITE_META`, `SEM_DADOS`).
- **Expurgo por idade:** `supabase/functions/lgpd-expurgo/index.ts` (Sorteios, 90 dias) — mesma lógica para comentários de Marketing.
- **Versão imutável + aprovação humana separada:** `marketing_content_version` + `marketing_content_approval` (0017) — mesmo padrão para `marketing_insight` (Onda E).

### 8.3 Riscos e Complexidades

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | Importador atual busca só `limit=50` sem paginar (`marketing-importar-metricas-instagram/index.ts:30`) — descoberto nesta reflexão técnica | Alta | Alto | Onda B implementa paginação real via `paging.next` do Graph API antes de qualquer outra melhoria |
| 2 | `marketing_instagram_metric_snapshot` cresce sem controle porque a chave única inclui `coletado_em` — todo re-import insere linha nova | Média | Médio | Onda B define upsert por execução; decidir na implementação se snapshot repetido é histórico intencional ou deve ser deduplicado por valor |
| 3 | Lista de e-mails autorizados vive em dois lugares (`acesso.ts` e `hook_permitir_somente_google_atol`) | Média | Alto | Onda A atualiza os dois na mesma leva de mudanças; unificar a fonte é uma melhoria futura, fora deste spec-kit |
| 4 | Reconexão do Instagram depende de login humano no Meta | Alta | Alto | Sinalizar via "Revincular conta" no app; nunca simular a confirmação |
| 5 | Uma nova Edge Function de IA pular o ledger existente | Baixa | Alto | Toda nova função de IA reaproveita literalmente o padrão de `marketing-gerar-conteudo` — nunca uma chamada direta ao provedor fora desse caminho |
| 6 | Correlação de notas com métricas sendo lida como causalidade | Média | Alto | Frases de UI e prompt do agente de hipóteses restritos a "coincide com o período"/"hipótese a investigar" — regra de produto, não sugestão de texto |
| 7 | Custo real de geração de imagem desconhecido (estudo só tem preço por token, não por imagem) | Média | Médio | Onda F gera imagens de teste e mede custo real antes de fixar `limite_por_execucao_usd` |
| 8 | Migração aplicada com `db push` cru reaplicaria 0001–0020 inteiras | Baixa | Alto | Reforçar em toda onda: aplicar só via `supabase db query --linked --file`, após confirmação explícita |

### 8.4 Alternativas Consideradas

| # | Alternativa | Prós | Contras | Recomendação |
|---|---|---|---|---|
| 1 | Classificar comentários por IA vs. heurística local por palavra-chave | IA entende contexto e português coloquial | Heurística é grátis e mais previsível, mas frágil a gírias/sarcasmo | ✅ IA (`gemini-2.5-flash-lite`), decisão desta rodada; heurística como fallback se o orçamento não estiver configurado |
| 2 | Hipóteses em tabela dedicada `marketing_insight` vs. reaproveitar `marketing_content_version` | Dedicada respeita o ciclo de vida diferente (análise a revisar, não conteúdo a publicar) | Reaproveitar geraria menos schema novo | ✅ Tabela dedicada |
| 3 | Imagem gerada: Supabase Storage vs. serviço externo | Storage já é a infraestrutura do projeto, RLS por workspace nativa | Externo desacopla, mas duplica superfície de segurança/custo | ✅ Supabase Storage, bucket privado por workspace |
| 4 | Log de importação: tabela compartilhada com Sorteios vs. tabela própria `marketing_*` | Compartilhada é menos schema novo | Própria preserva a regra do projeto de não cruzar tabelas `sorteio*`/`marketing_*` | ✅ Tabela própria `marketing_instagram_import_run` |

## 9. Restrições e Dependências

**Restrições**

- Nunca usar o projeto Supabase antigo (`ltrhsljnzuxoqyoodbfu`); sempre `uakwbtmbhwifiekwmsbq`.
- Nunca editar as migrações 0001–0020 já aplicadas; toda mudança é migração nova.
- Toda aplicação remota passa por `npm run check` completo antes, usa `supabase db query --linked --file` (nunca `db push` cru), e só com confirmação explícita do responsável.
- Os números 0021–0026 usados neste documento são provisórios — reconfirmar contra `supabase migration list` no início de cada onda, especialmente porque a própria Onda A investiga uma divergência nesse histórico.
- Nenhuma chave de IA em `VITE_*`, frontend ou Git.
- Nunca ler ou exibir `.env`, `.supabase-token`, `.cron-secret`, `CREDENCIAIS-LOCAL.txt`.

**Dependências**

- Reconexão manual do Instagram por quem controla `@atol.ia.oficial` — as Ondas B e C podem ser implementadas e testadas com dados antigos/mocks, mas a validação final em produção espera essa ação humana.
- Orçamento de IA no app (`marketing_ai_budget`): mecanismo já implementado (`configurarOrcamentoIa`); falta um administrador definir os valores em `/marketing/briefings/:id/estrategia`. **Informado pelo usuário nesta sessão:** o teto do lado do provedor (chave OpenRouter) já está configurado em US$10/mês — isso é uma trava de segurança da conta do provedor, não substitui o limite mensal do workspace dentro do app, que continua zerado até essa ação manual.
- Revalidar preço/disponibilidade dos modelos recomendados (`openai/gpt-5.6-luna`, `google/gemini-2.5-flash-lite`, `anthropic/claude-haiku-4.5`, modelo de imagem) em openrouter.ai/models antes de fixar qualquer um como secret — o estudo em `docs/estudo-llms-agentes-atol.md` tem data de validade (15/09/2026).
- Client Secret do Google OAuth e demais segredos: nunca lidos nem digitados por este agente; qualquer secret vai por comando entregue ao responsável rodar no próprio terminal.

## 10. Premissas Assumidas

| ID | Premissa |
|---|---|
| P-01 | Modelos aceitos por decisão desta rodada: `gpt-5.6-luna` (conteúdo), `gemini-2.5-flash-lite` (comentários), `claude-haiku-4.5` (hipóteses semanais) — reconfirmar preço/slug no OpenRouter antes de fixar secret |
| P-02 | Retenção de comentários: 90 dias, igual ao módulo de Sorteios — decisão desta rodada |
| P-03 | Acesso restrito a `atoldasrocas.ai@gmail.com` apenas — decisão desta rodada; remove `lipe.kosse@gmail.com` |
| P-04 | Geração de imagem entra nesta fase com Nano Banana 2 Lite / Gemini 3.1 Flash Lite Image — decisão desta rodada; slug exato e custo por imagem a confirmar na Onda F |
| P-05 | `limite_mensal_usd` sugerido para `marketing_ai_budget`: US$10, alinhado ao teto já configurado na conta OpenRouter — valor a confirmar pelo administrador no app [PREMISSA] |
| P-06 | `limite_por_execucao_usd` sugerido: um valor pequeno (ex.: US$0,10) até a Onda F medir o custo real de geração de imagem [PREMISSA] |
| P-07 | Nomes de tabelas/colunas novas (`marketing_instagram_import_run`, `marketing_instagram_comment_snapshot`, `marketing_insight`, taxonomia de erro/categoria) são propostas de arquitetura deste spec-kit, não nomes já decididos em outro documento [PREMISSA] |
| P-08 | Classificação de comentários usa IA como padrão; heurística local só como fallback sem orçamento configurado [PREMISSA] |
| P-09 | O critério de pronto da Onda A é a decisão documentada sobre a divergência da 0020, mesmo que a decisão seja "conviver com o histórico por timestamp por enquanto" — não é obrigatório "corrigir" o histórico [PREMISSA] |

## 11. Perguntas Resolvidas

| # | Pergunta | Resposta | Rodada |
|---|---|---|---|
| 1 | Quais sprints do plano de continuação entram neste spec-kit? | Todas (A–F), num único documento com uma onda por sprint | 1 |
| 2 | Os dois e-mails autorizados continuam? | Não — restringir só a `atoldasrocas.ai@gmail.com` (Onda A) | 2 |
| 3 | Quais modelos usar nos agentes ainda não implementados? | Aceitar as recomendações do estudo: `gpt-5.6-luna`, `gemini-2.5-flash-lite`, `claude-haiku-4.5` | 2 |
| 4 | Retenção dos comentários importados? | 90 dias, igual a Sorteios | 2 |
| 5 | Geração de imagem entra neste spec-kit? | Sim, com Nano Banana 2 Lite / Gemini 3.1 Flash Lite Image | 2 |
| 6 | O orçamento de IA já tem algum limite configurado? | Sim — a chave OpenRouter já está com teto de US$10/mês no provedor; o limite dentro do app (`marketing_ai_budget`) continua pendente de um administrador configurar | 3 (informado espontaneamente pelo usuário) |

## 12. Plano de Implementação

### 12.1 Ondas

#### Onda 1 — Regularizar o banco (Sprint A)
**Objetivo:** histórico de migrações compreendido e documentado, e acesso restrito só ao e-mail institucional, sem reaplicar nenhuma migração já aplicada.

**Arquivos:**
- `supabase/migrations/0021_restringir_acesso_institucional.sql` — criar — `create or replace function public.hook_permitir_somente_google_atol` mantendo só `atoldasrocas.ai@gmail.com`
- `app/src/features/auth/acesso.ts` — editar — `EMAILS_PERMITIDOS` com um único e-mail
- `docs/HANDOFF-CLAUDE-CODE-ATOL.md` — editar — registrar a decisão sobre a divergência da 0020

**Passos:**
1. `supabase migration list --project-ref uakwbtmbhwifiekwmsbq` (leitura) — comparar timestamps remotos das 0013–0020 contra os arquivos locais.
2. Confirmar por consulta somente leitura que `hook_permitir_somente_google_atol` está ativo como *Before User Created Hook* (já reportado como feito no handoff — revalidar, não assumir).
3. Investigar por que a 0020 não aparece com o nome local na lista remota; decidir e documentar a estratégia (ex.: conviver com o histórico por timestamp, ou `supabase migration repair` só depois de entender exatamente o que isso reescreve) — **não executar nada que reaplique 0001–0020**.
4. Criar `0021_restringir_acesso_institucional.sql` com `create or replace function` sobre `hook_permitir_somente_google_atol` (nunca editar o arquivo 0020).
5. Atualizar `EMAILS_PERMITIDOS` em `acesso.ts` para conter só o e-mail institucional.
6. Rodar `npm run check` completo; corrigir qualquer falha.
7. Aplicar `0021` via `supabase db query --linked --project-ref uakwbtmbhwifiekwmsbq --file supabase/migrations/0021_restringir_acesso_institucional.sql` — só após confirmação explícita do responsável.
8. Testar login com as duas contas (institucional deve funcionar, `lipe.kosse@gmail.com` deve ser bloqueado).
9. Atualizar `docs/HANDOFF-CLAUDE-CODE-ATOL.md` com a decisão da divergência e o novo estado do acesso.

**Critérios de pronto da onda:** AC-01, AC-02, AC-03, AC-22.

#### Onda 2 — Fundação de dados do Instagram (Sprint B)
**Objetivo:** importação de métricas paginada, idempotente e auditável, com status de execução visível na tela.

**Arquivos:**
- `supabase/migrations/0022_marketing_instagram_import_run.sql` — criar — tabela `marketing_instagram_import_run` (id, workspace_id, connection_id, status, tipo_erro, iniciado_em, finalizado_em, cursor_pagina, quantidade_processada, mensagem) + RLS por workspace, mesmo padrão de 0018/0019
- `supabase/functions/marketing-importar-metricas-instagram/index.ts` — editar — paginação real via `paging.next`, grava run log no início/fim, diferencia os 4 tipos de erro a partir do `error.code`/`error.error_subcode` do Graph API
- `app/src/features/marketing/MetricasInstagram.tsx` — editar — mostrar última coleta bem-sucedida/última falha e badge por tipo de erro

**Passos:**
1. Criar e aplicar `0022` (mesma sequência de validação/aplicação da Onda 1).
2. Extrair a chamada à Graph API para um laço de paginação usando `paging.next` (ou `after` do cursor), mantendo o limite de 50 por página mas seguindo até o fim.
3. No início da execução, inserir uma linha em `marketing_instagram_import_run` com status `RODANDO`; no fim, atualizar para `SUCESSO` ou `ERRO` com `tipo_erro` e `mensagem`.
4. Mapear os erros já conhecidos do Graph API (token expirado, permissão ausente, limite de chamadas) para os 4 códigos de `tipo_erro`; erro desconhecido cai em `ERRO_DESCONHECIDO`.
5. Trocar o `insert` cru em `marketing_instagram_metric_snapshot` por upsert por execução, evitando duplicar quando a mesma página é reprocessada dentro do mesmo run.
6. Atualizar `MetricasInstagram.tsx` para mostrar a última coleta e a última falha, lendo `marketing_instagram_import_run`.
7. `npm run check`; testar com a conta real só depois da reconexão do Instagram (dependência humana, Seção 9).

**Critérios de pronto da onda:** AC-04, AC-05, AC-06, AC-07, AC-08, AC-22.

#### Onda 3 — Agente analista de comentários (Sprint C)
**Objetivo:** comentários importados, classificados localmente e navegáveis por categoria, sem nenhuma resposta automática.

**Arquivos:**
- `supabase/migrations/0023_marketing_instagram_comment.sql` — criar — tabela `marketing_instagram_comment_snapshot` (id, workspace_id, connection_id, ig_media_id, ig_comment_id, autor_username, texto, publicado_em, coletado_em, categoria, classificado_em, modelo_ia), `unique(workspace_id, ig_comment_id)`, RLS por workspace
- `supabase/functions/marketing-importar-comentarios-instagram/index.ts` — criar — mesmo padrão de paginação/run-log da Onda 2; atualiza texto se o comentário foi editado
- `supabase/functions/marketing-classificar-comentarios/index.ts` — criar — chama `gemini-2.5-flash-lite` via OpenRouter, mesma gateway de `marketing-gerar-conteudo`; grava categoria + modelo, respeita orçamento e ledger
- `supabase/functions/lgpd-expurgo-marketing/index.ts` — criar — expurga comentários com 90+ dias, preservando agregados por categoria
- `app/src/features/marketing/Comentarios.tsx` — criar — tela por publicação, filtro por categoria, volume e evolução no tempo

**Passos:**
1. Criar e aplicar `0023`.
2. Implementar `marketing-importar-comentarios-instagram` reaproveitando a paginação/run-log da Onda 2; upsert por `(workspace_id, ig_comment_id)`.
3. Implementar `marketing-classificar-comentarios`: para comentários sem `categoria`, chama o modelo com prompt fechado nas 7 categorias, grava `categoria`/`classificado_em`/`modelo_ia`, respeita `marketing_ai_budget` e grava no ledger.
4. Implementar `lgpd-expurgo-marketing` seguindo o padrão de `lgpd-expurgo` (Sorteios), 90 dias, preservando contagem agregada.
5. Construir `Comentarios.tsx`: lista por publicação, filtro por categoria, permitir reclassificação manual (E-11).
6. `npm run check`; testar com dados reais só depois da reconexão do Instagram.

**Critérios de pronto da onda:** AC-09, AC-10, AC-11, AC-12, AC-22.

#### Onda 4 — Notas e correlação de contexto (Sprint D)
**Objetivo:** notas de contexto editáveis/arquiváveis com trilha de auditoria, relacionadas a publicações e períodos, sempre como hipótese.

**Arquivos:**
- `supabase/migrations/0024_marketing_context_note_edicao.sql` — criar — adiciona `arquivado_em`, função `marketing_arquivar_nota_contexto`, função `marketing_editar_nota_contexto` (nova versão em vez de update destrutivo), trigger de auditoria em update
- `app/src/features/marketing/RelatorioSemanal.tsx` — editar — mostrar notas próximas de métricas com frases de hipótese, nunca causalidade

**Passos:**
1. Criar e aplicar `0024`, preservando `marketing_criar_nota_contexto` existente.
2. Implementar edição como nova linha/versão (não `update` in-place) para manter a nota original auditável — decidir e documentar se é versionamento completo ou só `arquivado_em` + nota de substituição.
3. Atualizar `RelatorioSemanal.tsx` para listar notas com `ocorrido_em` próximo do período do relatório, com o texto fixo "coincide com o período" — nunca "causou".
4. `npm run check`.

**Critérios de pronto da onda:** AC-13, AC-14, AC-22.

#### Onda 5 — Agente de inteligência de produto (Sprint E)
**Objetivo:** hipóteses semanais revisáveis, com evidências, período, limitações, confiança e custo, nunca salvas como decisão sem aprovação humana.

**Arquivos:**
- `supabase/migrations/0025_marketing_insight.sql` — criar — tabela `marketing_insight` (id, workspace_id, periodo_inicio, periodo_fim, entrada_resumida, hipotese, evidencias, limitacoes, confianca, proxima_acao, custo_usd, modelo_ia, gerado_em, decisao, decidido_por, decidido_em), RLS por workspace
- `supabase/functions/marketing-gerar-insight/index.ts` — criar — chama `claude-haiku-4.5`; entrada = métricas + notas de contexto + comentários classificados; roda no máximo semanalmente; bloqueado sem orçamento
- `app/src/features/marketing/Insights.tsx` — criar — lista hipóteses, aprovação humana, link para os dados/notas de origem

**Passos:**
1. Criar e aplicar `0025`.
2. Implementar `marketing-gerar-insight`: monta entrada resumida (período, métricas agregadas, notas próximas, distribuição de categorias de comentário), chama o modelo pedindo evidências/limitações/confiança/próxima ação em JSON estruturado, grava com `decisao = PENDENTE`.
3. Implementar `Insights.tsx`: administrador aprova ou descarta; decisão e quem decidiu ficam registrados (mesmo padrão de `marketing_content_approval`).
4. `npm run check`.

**Critérios de pronto da onda:** AC-15, AC-16, AC-22.

#### Onda 6 — Conteúdo e imagem (Sprint F)
**Objetivo:** permitir nova versão de rascunho de conteúdo e gerar imagem a partir de prompt já aprovado, com orçamento e custo real medidos.

**Arquivos:**
- `supabase/migrations/0026_marketing_image_generation.sql` — criar — tabela `marketing_image_asset` (id, workspace_id, content_version_id, prompt_aprovado, modelo_ia, custo_usd, storage_path, gerado_em, aprovado) + bucket privado no Supabase Storage
- `supabase/functions/marketing-gerar-imagem/index.ts` — criar — chama o modelo de imagem via OpenRouter só a partir de um `PROMPT_IMAGEM` com `marketing_content_approval.decisao = APROVADO`; grava no Storage; respeita orçamento
- `app/src/features/marketing/GeracaoImagem.tsx` — criar — botão gerar imagem a partir do prompt aprovado, mostra custo estimado, permite aprovar/rejeitar
- `app/src/features/marketing/EstrategiaConteudo.tsx` — editar — ligar "pedir nova versão" ao fluxo de versões existente (`listarVersoesIa`/`gerarConteudoIa`)

**Passos:**
1. Revalidar no catálogo do OpenRouter (openrouter.ai/models) o slug e o preço atual do modelo de imagem recomendado (Nano Banana 2 Lite / Gemini 3.1 Flash Lite Image) antes de qualquer código — o estudo tem data de validade.
2. Criar e aplicar `0026`, incluindo a policy do bucket de Storage (privado, por workspace).
3. Implementar `marketing-gerar-imagem` reaproveitando o gateway de IA (idempotency_key, ledger, bloqueio por orçamento) — nunca gera sem `PROMPT_IMAGEM` aprovado.
4. Gerar algumas imagens de teste com prompts reais do produto e medir o custo efetivo por imagem, antes de fixar `MARKETING_AI_IMAGE_MODEL` e `limite_por_execucao_usd` definitivos (mitiga o risco #7 da Seção 8.3).
5. Implementar `GeracaoImagem.tsx` e a ligação de "pedir nova versão" em `EstrategiaConteudo.tsx`.
6. `npm run check`.

**Critérios de pronto da onda:** AC-17, AC-18, AC-19, AC-20, AC-21, AC-22.

### 12.2 Ordem de Execução

Onda 1 é bloqueante para todas as demais — nenhuma nova migração deve ser criada enquanto a divergência da 0020 não estiver documentada. Onda 2 é pré-requisito de dados para as Ondas 3 e 4 (que podem rodar em paralelo entre si). Onda 5 depende dos dados/notas das Ondas 2, 3 e 4 (correlaciona tudo). Onda 6 depende só da fundação de conteúdo já existente (Sprints 2–3 do backlog anterior) para a parte de texto, e da Onda 1 para o restante do banco estar estável — pode ser feita em paralelo às Ondas 3–5 se a equipe quiser, mas o teste end-to-end completo (Seção 13) espera todas prontas.

## 13. Verificação End-to-End

1. **Banco:** `supabase migration list --project-ref uakwbtmbhwifiekwmsbq` mostra 0021–0026 aplicadas; nenhuma das 0001–0020 foi reaplicada.
2. **Acesso:** login com `atoldasrocas.ai@gmail.com` funciona; login com `lipe.kosse@gmail.com` é bloqueado com a mensagem do hook.
3. **Importação de métricas:** rodar duas vezes seguidas para a mesma conta → `select count(*) from marketing_instagram_metric_snapshot` não duplica de forma inesperada; conta com 50+ posts tem todos importados; `marketing_instagram_import_run` mostra as duas execuções.
4. **Erros diferenciados:** simular (ou aguardar) token expirado/permissão ausente → tela de Métricas mostra o tipo de erro certo.
5. **Comentários:** importar comentários de um post real → `select count(*) from marketing_instagram_comment_snapshot` bate com o `comments_count` do post; reimportar não duplica.
6. **Classificação:** rodar `marketing-classificar-comentarios` → toda linha sem categoria recebe uma das 7; ledger registra custo e modelo.
7. **Notas:** editar e arquivar uma nota → histórico auditável preserva as duas versões; relatório semanal mostra a nota próxima do período com frase de hipótese.
8. **Insight:** gerar uma hipótese semanal → JSON com evidências/limitações/confiança/próxima ação/custo; aprovar → `decisao = APROVADO` com `decidido_por`/`decidido_em`.
9. **Conteúdo:** pedir nova versão de um item já aprovado → versão N+1 criada, aprovação anterior preservada.
10. **Imagem:** gerar imagem a partir de um `PROMPT_IMAGEM` aprovado → asset salvo no Storage privado, custo registrado; tentar gerar sem prompt aprovado → bloqueado.
11. **Orçamento:** tentar qualquer geração de IA com `marketing_ai_budget` zerado → recusada com mensagem clara; configurar limites → geração autorizada dentro do teto, recusada acima dele.
12. **Regressão:** `npm run check` completo (segurança, banco, testes, lint, build) verde; fluxo de Sorteios (`/sorteios/novo` até o comprovante) continua funcionando sem alteração.
13. **Segredos:** `grep -ri "OPENROUTER_API_KEY\|service_role" app/dist/` retorna vazio.
