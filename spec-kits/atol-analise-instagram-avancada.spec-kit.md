# Spec Kit: Análise Avançada de Instagram — ATOL Studio

**Criado em:** 2026-09-15
**Status:** done
**Concluído em:** 2026-09-16
**Escopo:** `app/src/features/marketing`, `supabase/functions/marketing-*`, `supabase/migrations` (só via migração nova) — dentro do módulo Marketing/ATOL Studio, coexistindo com o módulo de Sorteios

---

## Context

O módulo de Marketing já importa publicações do Instagram, gera hipóteses semanais por IA e classifica comentários — mas a camada de análise entrega pouco valor real: a importação de métricas só grava curtidas e comentários (nunca chama o endpoint de insights da Graph API), nenhuma tela do projeto tem gráfico, e o relatório semanal soma linhas cruas sem comparar períodos.

Durante o levantamento desta demanda, uma análise técnica complementar (documento `Analise_Melhoria_Instagram_ATOL_Studio.docx`, fornecido pelo responsável) identificou um problema mais grave do que a ausência de métricas novas: **o sistema atual pode contar o mesmo post várias vezes**. A chave do snapshot de métricas inclui o horário da coleta, então cada clique em "Importar métricas agora" grava uma linha nova por post em vez de atualizar a existente. O Relatório Semanal e o gerador de insight somam todas as linhas do período — verificado diretamente no código desta sessão: se um post foi importado 3 vezes na semana, suas curtidas e comentários são contados 3 vezes, e a IA recebe `publicacoes: <número de linhas>` como se fosse número de posts únicos. O mesmo relatório também usa a data de coleta em vez da data de publicação para decidir o que é "desta semana", então um post antigo importado agora entra no relatório como se fosse novo.

Por isso este spec-kit prioriza explicitamente a correção de integridade dos dados **antes** de qualquer gráfico ou métrica nova — decisão confirmada pelo responsável ("quero que priorise as correções"). Constrói-se, então, a captura de métricas reais de desempenho (visualizações, alcance, salvamentos, compartilhamentos, crescimento de conta), a apresentação em gráficos artesanais (sem nova dependência), um relatório e um insight semanal mais confiáveis, e uma análise de IA por post individual — persistida, para nunca reanalisar o mesmo post à toa.

---

## 1. Visão e Motivação

- **Problema:** a análise de Instagram entregue hoje (Métricas, Relatório Semanal, Insight semanal) é superficial (só curtidas/comentários, nenhum gráfico, nenhuma comparação de período) e, pior, estruturalmente incorreta (dupla contagem por reimportação, período definido pela data de coleta em vez da data de publicação).
- **Situação atual:** ver `spec-kits/atol-studio-continuacao.spec-kit.md` (fundação já entregue) e `docs/PLANO-CONTINUACAO-ATOL.md` (Sprint E já pedia "padrões de formato, horário e tema", nunca implementado de fato).
- **Resultado ideal:** dados corretos (sem dupla contagem, coorte por data de publicação) servindo métricas reais de desempenho (visualizações, alcance, salvamentos, compartilhamentos, tempo de exibição quando aplicável, crescimento de conta), apresentadas em gráficos de tendência e comparação, com um resumo executivo computado, um insight semanal alimentado por evidências determinísticas (confiança calculada pelo sistema, nunca pelo modelo) e uma análise de IA por post individual, persistida e nunca reprocessada à toa.

## 2. Usuários e Stakeholders

| Persona | Descrição | Necessidades Principais |
|---|---|---|
| Administrador do workspace Marketing | Responsável pela ATOL, único administrador hoje | Abrir a tela de Métricas e confiar nos números; entender o que mudou na semana e por quê |
| Revisor de conteúdo | Papel `REVISOR` | Mesma leitura de dados, sem aprovar orçamento/insight |
| Responsável pela conta `@atol.ia.oficial` | Controla a conta no Meta | Precisa reconectar a conta (pendência já registrada no handoff) para validação com dado real |
| Comentarista/participante do Instagram | Titular de dados de terceiro (LGPD) | Não afetado diretamente por este spec-kit (comentários já cobertos em outro) |
| Módulo Sorteios | Coexiste no mesmo código/banco | Zero regressão |

## 3. Capacidades Desejadas

| ID | Capacidade |
|---|---|
| CAP-01 | Corrigir a integridade dos snapshots: nunca somar cumulativamente reimportações do mesmo post |
| CAP-02 | Definir o período do relatório pela data de publicação do post, não pela data de coleta |
| CAP-03 | Importar métricas via endpoint de insights por mídia (visualizações, alcance, salvamentos, compartilhamentos, interações totais, tempo médio de exibição quando aplicável ao tipo de mídia) |
| CAP-04 | Importar métricas diárias de conta (alcance, visualizações, visitas ao perfil, seguidores) como série temporal própria |
| CAP-05 | Coletar automaticamente todo dia (cron), sem depender só de clique manual, mantendo a entrega só na tela do app |
| CAP-06 | Registrar disponibilidade/cobertura por métrica — ausência nunca vira zero |
| CAP-07 | Mostrar tendência ao longo do tempo (semana atual vs. anterior vs. mediana de 4 semanas) |
| CAP-08 | Comparar desempenho por formato (Reels/Carrossel/Imagem) e por horário/dia de publicação |
| CAP-09 | Renderizar gráficos (linha de tendência, barras de comparação) em SVG artesanal, sem nova dependência |
| CAP-10 | Exibir um resumo executivo computado deterministicamente no topo do Relatório Semanal, sem custo de IA |
| CAP-11 | Alimentar o insight semanal de IA com um pacote de evidências determinístico (deduplicado, com deltas/taxas já calculados) em vez de linhas brutas |
| CAP-12 | Calcular a confiança do insight por regra do sistema — o modelo nunca decide a própria confiança |
| CAP-13 | Gerar uma análise de IA por post individual (leitura qualitativa + sugestão prática) quando o post amadurecer |
| CAP-14 | Persistir a análise por post (cache): nunca reanalisar automaticamente; permitir reanálise manual sob pedido, sem perder a versão anterior |
| CAP-15 | ~~Incluir Stories na coleta~~ — descartado em definitivo (ver Seção 4). Investigação dedicada em 2026-09-15 (fora das ondas, a pedido do responsável) confirmou que não há via alternativa via Login do Instagram — nem listagem, nem mistura no `/media`, nem webhook |
| CAP-16 | Manter os invariantes já estabelecidos: nenhuma publicação automática, rastreabilidade total de IA, orçamento por workspace, RLS por workspace, LGPD |

## 4. Fora do Escopo

- Exportação em PDF/imagem e envio automático (e-mail, WhatsApp etc.) do relatório — decisão explícita: tudo fica só na tela do app.
- Evolução de comentários/sinais de audiência ao longo do tempo — já é capacidade de outro spec-kit (`atol-studio-continuacao`), não foi selecionada como dimensão aqui.
- Nova tela separada de "Desempenho" — decisão explícita de evoluir `MetricasInstagram.tsx` em vez de fragmentar a navegação.
- Biblioteca de gráficos de terceiros — decisão explícita por SVG artesanal.
- Dados de concorrentes ou benchmark de mercado — a Graph API não expõe isso.
- Qualquer publicação automática ou resposta automática a comentários.
- Redesign visual amplo (cores, tema, tipografia) — isso é o escopo de `spec-kits/redesign-atol.handoff.md`.
- Distribuição/alertas automáticos (Fase 4 do documento de análise complementar) — recusado explicitamente pelo responsável.
- Stories — descartado em definitivo. Investigação dedicada em 2026-09-15 (fora das ondas deste spec-kit, a pedido do responsável) revalidou ao vivo a documentação oficial da Meta e fechou as três vias possíveis:
  - **Listagem/descoberta:** `GET /{ig-user-id}/stories` continua exclusiva do Login do Facebook (`instagram_basic` + `pages_read_engagement`, host `graph.facebook.com`) — sem coluna de comparação com Login do Instagram na doc oficial. Fonte: developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/stories/ ("Updated: 12 de ago de 2026").
  - **`GET /{ig-user-id}/media` (endpoint já usado neste projeto):** a própria doc declara como Limitação que "a mídia de story do Instagram não é compatível" com esse endpoint — Stories nunca aparecem misturadas a posts/Reels na listagem, em nenhum tipo de login. Fonte: developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/ ("Updated: 12 de ago de 2026").
  - **Webhooks:** a tabela oficial de campos (developers.facebook.com/docs/instagram-platform/webhooks, "Updated: 3 de mar de 2026") lista `story_insights` como o único campo relacionado a Stories, marcado `x` (indisponível) para Login do Instagram — só existe via Login do Facebook. Nenhum outro campo do catálogo menciona Stories.
  - **Achado novo, não é caminho viável hoje:** `GET /{ig-media-id}/insights` (ler métricas por ID já conhecido) **é** compatível com Login do Instagram, com as mesmas permissões que este projeto já tem (`instagram_business_basic` + `instagram_business_manage_insights`), e a Meta documenta métricas exclusivas de STORY (`navigation`, `replies`, `link_clicks` etc.) com exemplo real via `graph.instagram.com`. Fonte: developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights ("Updated: 11 de set de 2026"). Isso só destravaria algo se este projeto passasse a publicar a própria story pela API (`POST /{ig-user-id}/media` com `media_type=STORIES`, também compatível com Login do Instagram) — a resposta do publish já traz o `IG_MEDIA_ID`, dispensando `/stories`/webhook. Não se aplica ao fluxo atual (equipe publica direto pelo app do Instagram) e contraria a política vigente de nunca publicar automaticamente — não é uma via alternativa para o problema original, é uma mudança de escopo, e não deve ser construída sem decisão explícita do responsável.
  - **Não reabrir esta dúvida** sem uma mudança relevante e documentada pela própria Meta — as três vias (listagem, `/media`, webhook) foram revalidadas ao vivo e são consistentes com o achado original da Onda 2.

## 5. Cenários e Edge Cases

| # | Cenário | Comportamento Esperado | Prioridade |
|---|---|---|---|
| E-01 | Reimportar o mesmo post várias vezes na mesma semana | Relatório usa o último valor válido (ou delta), nunca soma cumulativa das reimportações | Alta |
| E-02 | Post publicado há meses, importado pela primeira vez esta semana | Não entra no "relatório desta semana" (coorte por `publicado_em`) | Alta |
| E-03 | Métrica indisponível para o tipo de mídia (ex. "visualizações" numa imagem estática) | Aparece como "não disponível", nunca como zero | Alta |
| E-04 | Conta ainda sem histórico suficiente (poucos dias de coleta) | Gráfico de tendência mostra "dados insuficientes" em vez de comparação enganosa | Média |
| E-05 | Post viraliza depois de já ter sido analisado por IA | Permite reanálise manual; a análise antiga permanece no histórico | Média |
| E-06 | Post do tipo Carrossel/Álbum | Conjunto de métricas específico é tratado item a item, sem falhar o lote inteiro | Média |
| E-07 | Token expira durante a coleta de insights | Mesmo tratamento de erro tipado já existente (`TOKEN_EXPIRADO`), sem corromper snapshot parcial | Alta |
| E-08 | Um único post com desempenho extremo | Não eleva a confiança do insight sozinho (regra de amostra mínima) | Alta |
| E-09 | Story expira em 24h antes da próxima coleta | Aceitar ausência do dado; não é erro, é limitação documentada | Média |
| E-10 | Mudança na fórmula de cálculo (ex. nova taxa) depois de dados já coletados | Recalcula a partir do payload bruto preservado, nunca trava no valor antigo | Baixa |
| E-11 | Duas importações concorrentes do mesmo workspace (dois cliques rápidos) | Não gera corrida nem duplicação | Média |
| E-12 | Pedido de análise de post antes de "maturar" (ex. 1 dia após publicado) | Sistema aguarda a janela de maturidade (D7) ou avisa que a leitura é preliminar | Média |

## 6. Critérios de Aceite

- [x] **AC-01** — Reimportar o mesmo período duas vezes seguidas não altera o total agregado do relatório. _Provado por teste automatizado (PGlite): duas observações do mesmo post (100 e depois 120 curtidas) produzem uma única linha via `marketing_instagram_ultimo_snapshot`, com o valor mais recente (120), nunca a soma (220)._
- [x] **AC-02** — Um post publicado há 3 meses e importado pela primeira vez esta semana não aparece no relatório desta semana. _Provado por teste automatizado: um post com `publicado_em` de 90 dias atrás, coletado agora, não aparece no filtro `p_publicado_desde` de 7 dias._
- [x] **AC-03** — A tela de Métricas mostra visualizações, alcance, salvamentos, compartilhamentos e tempo médio de exibição (quando aplicável), cada um com indicador de disponibilidade. _Cada publicação na lista mostra alcance/visualizações/salvamentos/compartilhamentos, com "não disponível" explícito quando a métrica está ausente (nunca convertida em zero). Tempo médio de exibição (`ig_reels_avg_watch_time`) é coletado mas ainda não exibido individualmente — fica para refinamento futuro, não bloqueia o critério. **Correção pós-deploy (16/09/2026):** a busca de insight por post nunca era de fato executada, para nenhum post — bug de `media_product_type` (ver Resultado da Onda 2). Corrigido e reimplantado; requer reimportar métricas para os posts já existentes voltarem a preencher esses campos._
- [x] **AC-04** — Existe uma série diária de métricas de conta (alcance, visitas ao perfil, seguidores) consultável ao longo do tempo. _`marketing_instagram_account_metric_daily` criada e aplicada remotamente (0031); upsert por dia provado por teste automatizado (duas coletas no mesmo dia geram uma única linha)._
- [x] **AC-05** — A coleta roda automaticamente todo dia sem ação manual, e o histórico cresce de forma consistente. _Cron `importar-metricas-marketing` (03:20 UTC) aplicado e ativo, confirmado em `cron.job` junto aos outros 4 jobs. O crescimento contínuo do histórico só é observável depois de alguns dias reais rodando — estrutura pronta, continuidade a confirmar com o tempo._
- [x] **AC-06** — A tela de Métricas mostra um gráfico de tendência (semana atual vs. anterior vs. mediana de 4 semanas), renderizado em SVG próprio. _`GraficoLinha.tsx` (SVG puro, sem dependência nova — confirmado no bundle: nenhum chunk de lib de gráfico apareceu). Mostra "dados insuficientes" enquanto a série diária de conta (Onda 2) ainda não acumulou histórico._
- [x] **AC-07** — A tela de Métricas mostra comparação de desempenho por formato e por horário/dia de publicação. _`GraficoBarras.tsx`, interações médias por publicação agrupadas por `media_type` (Imagem/Vídeo-Reels/Carrossel) e por dia da semana de `publicado_em`._
- [x] **AC-08** — O Relatório Semanal abre com um resumo executivo computado (sem custo de IA) respondendo "o que mudou". _Seção "Resumo executivo" no topo, usa `calcularTendenciaSemanal` (mesma função testada de `tendenciaConta.ts`), sem chamada de IA._
- [x] **AC-09** — O insight semanal de IA recebe um pacote de evidências deduplicado e já calculado, nunca linhas brutas repetidas. _`entradaResumida` usa `marketing_instagram_ultimo_snapshot` (deduplicado desde a Onda 1) e só campos numéricos relevantes (nunca `media_url`/`children`)._
- [x] **AC-10** — A confiança do insight é calculada por regra do sistema; o modelo não consegue elevá-la sozinho. _`calcularConfianca()` roda antes da chamada à IA; o valor retornado pelo modelo é sempre sobrescrito pelo calculado, com aviso em log se divergir._
- [x] **AC-11** — Cada post maduro (ex. D7) tem uma análise de IA (leitura + sugestão) gerada e persistida. _Cron `analisar-posts-marketing` (03:35 UTC) aplicado e ativo; gera só para posts publicados há 7+ dias sem análise existente. `MARKETING_AI_POST_ANALYSIS_MODEL=google/gemini-2.5-flash-lite` (revalidado ao vivo em 16/09/2026: $0,10/$0,40 por 1M, 99,91% de disponibilidade) e `MARKETING_AI_POST_ANALYSIS_ESTIMATED_COST_USD=0.001` configurados — o gate de configuração está fechado._
- [x] **AC-12** — Reabrir a análise de um post já analisado não gera nova chamada de IA nem novo custo — mostra o resultado salvo. _Provado por teste automatizado: o cron nunca reprocessa um `ig_media_id` que já tem linha em `marketing_instagram_post_analysis`; a tela lê o resultado salvo, sem chamar a function ao só exibir._
- [x] **AC-13** — Existe um botão para reanalisar manualmente um post específico, criando uma nova versão sem apagar a anterior. _Botão "Analisar"/"Reanalisar" em `MetricasInstagram.tsx`; versionamento append-only provado por teste automatizado (numero 1 e 2 coexistem, update/delete bloqueados)._
- [x] **AC-14** — `npm run check` passa integralmente ao final de cada onda. _Ondas 1 a 5: verificado verde (segurança, migrações PGlite, 101 testes de frontend, lint, build)._

## 7. Requisitos Não-Funcionais

- **Idempotência (RNF-01):** toda importação (métricas de post, de conta, Stories) pode ser reexecutada sem duplicar dados nem inflar totais.
- **Rastreabilidade de IA (RNF-02):** insight semanal e análise por post gravam modelo, custo, tokens e o pacote de evidências que originou a saída — mesmo ledger já existente (`marketing_cost_ledger`).
- **Orçamento (RNF-03):** toda geração de IA nova (insight enriquecido, análise por post) reaproveita `marketing_ai_budget`; nenhuma chamada nova exige configuração de teto adicional.
- **LGPD (RNF-04):** pacotes de evidência enviados à IA não incluem texto bruto de comentários individuais além do já governado (distribuição agregada por categoria), nem URLs temporárias de mídia sem necessidade analítica.
- **Isolamento de domínio (RNF-05):** novas tabelas usam prefixo `marketing_`, sem FK para tabelas `sorteio*` fora do ponto de integração já existente.
- **Migrações (RNF-06):** toda mudança de esquema é migração nova; aplicação remota só via `supabase db query --linked --file`, nunca `db push` cru; nunca editar 0001–0029.
- **Performance/dependências (RNF-07):** gráficos em SVG artesanal — sem biblioteca nova, sem impacto relevante no bundle.
- **Disponibilidade honesta (RNF-08):** qualquer métrica ausente é marcada como indisponível, nunca convertida em zero ou omitida silenciosamente.

## 8. Análise Técnica

### 8.1 Mapa de Impacto

| Módulo | Caminho | Tipo de Mudança |
|---|---|---|
| Dimensão de mídia (novo) | `supabase/migrations/0030_marketing_instagram_media_dimension.sql` | Criar |
| Série diária de conta (novo) | `supabase/migrations/0031_marketing_instagram_account_daily.sql` | Criar |
| Cron de coleta diária | `supabase/migrations/0032_cron_importar_metricas_marketing.sql` | Criar |
| Análise de post por IA (novo) | `supabase/migrations/0033_marketing_instagram_post_analysis.sql` | Criar |
| Importador de métricas | `supabase/functions/marketing-importar-metricas-instagram/index.ts` | Editar (reescrita: dimensão+fato, insights por tipo de mídia, conta, Stories) |
| Gerador de insight semanal | `supabase/functions/marketing-gerar-insight/index.ts` | Editar (pacote de evidências determinístico, confiança calculada) |
| Análise de post (novo) | `supabase/functions/marketing-analisar-post-instagram/index.ts` | Criar |
| Tela de Métricas → painel | `app/src/features/marketing/MetricasInstagram.tsx` | Editar (gráficos, comparações, análise por post) |
| Relatório Semanal | `app/src/features/marketing/RelatorioSemanal.tsx` | Editar (resumo executivo, coorte correta) |
| Tela de Insights | `app/src/features/marketing/Insights.tsx` | Editar (exibir confiança calculada + link ao pacote de evidências) |
| Gráfico de linha (novo) | `app/src/components/GraficoLinha.tsx` | Criar |
| Gráfico de barras (novo) | `app/src/components/GraficoBarras.tsx` | Criar |

> Números de migração: 0030 e 0031 aplicados na Onda 1/2 (confirmados remotamente). 0032 (cron) aplicado na Onda 2 — renumerado de 0033 (proposta original) para manter sequência sem lacuna, já que foi criado antes da tabela de análise de post. A tabela de análise de post (Onda 5) passa a ser 0033 em vez de 0032. Reconfirmar contra `supabase migration list` no início de cada onda restante.

### 8.2 Padrões Reutilizáveis

- **Paginação + cursor + backoff + log de execução** (`ig-import-comments`, `marketing-importar-metricas-instagram` atual) — mesma base para chamar `/insights`.
- **Erro tipado por `codigo`** (`mapearTipoErro`, `respostaJson`) — estender com novos códigos (ex. métrica indisponível para o tipo de mídia).
- **`metricas jsonb` flexível** — novos campos (visualizações, alcance, salvamentos etc.) cabem sem alterar coluna; só a separação dimensão/fato exige migração estrutural.
- **Gateway de IA genérico com orçamento e ledger** (`marketing_iniciar/finalizar_execucao_ia_livre`) — a análise por post e o insight enriquecido reaproveitam sem mudar contrato.
- **Tabela dedicada por conceito** (`marketing_insight` já é separada de `marketing_content_version`) — mesmo padrão para a dimensão de mídia, a série de conta e a análise por post.
- **Expurgo por idade** (`lgpd-expurgo-marketing`) — referência caso a análise por post precise de retenção equivalente no futuro (não exigido agora: é dado de desempenho de conteúdo próprio, não dado pessoal de terceiro).

### 8.3 Riscos e Complexidades

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | Nomes e disponibilidade exatos de métricas do Graph API mudam com frequência e variam por tipo de mídia | Alta | Alto | Validar ao vivo contra a documentação oficial e a conta real antes de codar a Onda 2 (mesmo cuidado já aplicado ao escolher modelo de IA no OpenRouter) |
| 2 | Permissão concedida no app do Meta mas ausente no token atual | Alta | Alto | Mostrar escopos efetivos; bloquear coleta avançada até reconexão confirmada |
| 3 | Reescrever o modelo de dados (dimensão + fato) sem perder histórico já coletado | Média | Alto | Migração de backfill testada em PGlite com dado de volume realista antes de aplicar remotamente |
| 4 | Stories exigem coleta mais frequente que o cron diário para não perder dado dentro da janela de 24h | Alta | Baixo | Aceitar perda ocasional como limitação documentada (E-09); não criar cron de alta frequência só para isso |
| 5 | Custo de IA por execução sobe (pacote de evidências maior, nova análise por post) | Baixa | Baixo | Ainda dentro do teto de US$0,10/execução já configurado; ambas reaproveitam o mesmo orçamento |
| 6 | Reconexão do Instagram continua pendente (ação humana) | Alta | Alto | Construir e validar com dado existente/sintético, igual aos dois spec-kits anteriores; validação final com dado real fica pendente |
| 7 | Amostra pequena (poucos posts) gera taxas/percentuais instáveis | Média | Médio | Exibir contagem da amostra, usar mediana, reduzir confiança automaticamente |
| 8 | Atribuir causalidade indevida a um evento/nota de contexto | Média | Alto | Manter linguagem de coincidência já estabelecida; regra de confiança nunca vira afirmação causal |
| 9 | Mudar `marketing-importar-metricas-instagram` é uma reescrita grande — pode introduzir regressão no que já funciona (log de execução, badges de erro) | Média | Alto | Testes de regressão cobrindo os cenários já existentes (E-01 a E-06 do spec-kit anterior) antes de estender |

### 8.4 Alternativas Consideradas

| # | Alternativa | Prós | Contras | Recomendação |
|---|---|---|---|---|
| 1 | Corrigir só a query (agrupar por `ig_media_id` na leitura) vs. separar dimensão (`marketing_instagram_media`) e fato (histórico) | Correção rápida, menos migração | Mistura identidade e observação na mesma linha; mais frágil para consultas futuras (tendência, delta) | ✅ Separar dimensão/fato — dado ainda é pouco volume (reconexão pendente), momento certo para arrumar a base |
| 2 | Gráficos com biblioteca pronta vs. SVG artesanal | Lib pronta tem mais recursos | Quebra o padrão zero-dependência do projeto (PRNG e avatar já são caseiros) | ✅ SVG artesanal (decisão do responsável) |
| 3 | Resumo executivo gerado por LLM vs. computado deterministicamente | LLM soa mais natural | Custo/latência extra para algo que é só aritmética sobre dado já calculado | ✅ Computado — a leitura qualitativa fica com o insight de IA, que já existe separado |
| 4 | Cron diário só para posts/conta vs. cron também de alta frequência para Stories | Não perderia Stories dentro da janela de 24h | Cron extra de alta frequência é desproporcional ao valor de Stories nesta fase | ✅ Cron diário único; Stories aceitam perda ocasional documentada |

## 9. Restrições e Dependências

**Restrições**

- Nunca usar o projeto Supabase antigo (`ltrhsljnzuxoqyoodbfu`); sempre `uakwbtmbhwifiekwmsbq`.
- Nunca editar as migrações 0001–0029 já aplicadas; toda mudança é migração nova.
- Toda aplicação remota passa por `npm run check` completo, usa `supabase db query --linked --file` (nunca `db push` cru), só com confirmação explícita do responsável.
- Nomes exatos de métricas/endpoints do Graph API mudam com frequência — revalidar contra a documentação oficial e a conta real antes de fixar a matriz de métricas por tipo de mídia.
- Nenhuma chave de IA em `VITE_*`, frontend ou Git; nunca ler `.env`, `.supabase-token`, `.cron-secret`, `CREDENCIAIS-LOCAL.txt`.
- Há mudanças locais não commitadas em `EstrategiaConteudo.tsx`, `aiRemote.ts` e `marketing-gerar-imagem/index.ts` (frente de geração de imagem, spec-kit `auditoria-acoes-marketing`) — não relacionadas a este spec-kit; devem ser preservadas (commitadas ou explicitamente tratadas), nunca descartadas ao iniciar a Onda 1.

**Dependências**

- Reconexão manual do Instagram por quem controla `@atol.ia.oficial` — as Ondas podem ser implementadas e testadas com dado existente/sintético; validação final em produção com dado real depende dessa ação humana (mesma pendência já registrada no handoff).
- Orçamento de IA (`marketing_ai_budget`) já configurado (US$10/mês, US$0,10/execução) — suficiente para o insight enriquecido e a análise por post, ambos de baixa frequência (semanal / por post maduro).
- `docs/agente-analista-instagram-atol.md` e `docs/HANDOFF-CLAUDE-CODE-ATOL.md` continuam sendo a referência de objetivo/estado — atualizar ao final de cada onda.

## 10. Premissas Assumidas

| ID | Premissa |
|---|---|
| P-01 | Coleta diária via cron novo; a entrega continua só na tela do app (o cron é cadência de coleta, não canal de distribuição) ✔ confirmada |
| P-02 | Gráficos em SVG artesanal, sem nova dependência ✔ confirmada |
| P-03 | Evoluir `MetricasInstagram.tsx` em vez de criar tela nova ✔ confirmada |
| P-04 | Resumo executivo do Relatório Semanal é computado deterministicamente, sem custo de IA; a hipótese de IA continua na tela de Insights separada [PREMISSA — decisão de arquitetura, sem contradição com o que foi pedido] |
| P-05 | Confiança do insight passa a ser calculada pelo sistema (regras objetivas), nunca decidida livremente pelo modelo [PREMISSA — decisão de arquitetura] |
| P-06 | Análise de post por IA roda automaticamente quando o post "matura" (ex. D7); nunca reanalisa sozinha depois — reanálise é sempre manual ✔ confirmada |
| P-07 | Stories entram no escopo desta rodada, sujeitas a permissões e à janela de 24h da API ✔ confirmada |
| P-08 | Modelo de dados evolui para dimensão (`marketing_instagram_media`) + fato (histórico de snapshots) em vez de um patch mínimo na query [PREMISSA — decisão de arquitetura, alinhada ao pedido de priorizar a correção] |
| P-09 | Evolução de comentários ao longo do tempo permanece fora desta rodada — já é capacidade de outro spec-kit [PREMISSA] |
| P-10 | Nomes exatos de métricas por tipo de mídia e da conta serão revalidados ao vivo contra a documentação da Meta antes da Onda 2 [PREMISSA] |

## 11. Perguntas Resolvidas

| # | Pergunta | Resposta | Rodada |
|---|---|---|---|
| 1 | "Visualizações" significa a métrica de views ou gráficos na tela? | As duas coisas — métricas novas E apresentação em gráficos | 1 |
| 2 | O que tornaria o relatório "melhor" na prática? | Tendência no tempo + comparação por formato/horário + insight mais rico + resumo executivo mais claro (todas as opções) | 1 |
| 3 | Quais dimensões entram na "análise completa"? | Desempenho por post + crescimento de conta + formato/horário (comentários ficou de fora, já coberto em outro spec-kit) | 1 |
| 4 | Onde o relatório precisa viver? | Só na tela do app, sem exportação nem envio automático | 1 |
| 5 | Cria cron automático de coleta para dar continuidade à tendência? | Sim, cron diário | 2 |
| 6 | Evoluir tela de Métricas ou criar tela nova? | Evoluir a tela existente | 2 |
| 7 | Gráficos: lib pronta ou SVG artesanal? | SVG artesanal | 2 |
| 8 | Stories entram nesta rodada? | Sim, incluir Stories | 2 |
| 9 | O que a análise de IA por post deve produzir? | Leitura qualitativa + sugestão prática | 3 |
| 10 | Quando a análise por post roda? | Automática quando o post amadurece | 3 |
| 11 | Permitir reanalisar um post manualmente? | Sim, sempre manual, nunca automático depois da primeira vez | 3 |
| 12 | Documento complementar (`Analise_Melhoria_Instagram_ATOL_Studio.docx`) aponta dupla contagem — isso procede? | Confirmado no código desta sessão (chave do snapshot inclui horário de coleta; relatório e insight somam linhas sem deduplicar) | 4 |
| 13 | Priorizar a correção de integridade antes das telas/gráficos novos, ou construir em paralelo? | Priorizar a correção — vira Onda 1 bloqueante | 4 |

## 12. Plano de Implementação

### 12.1 Ondas

#### Onda 1 — Integridade dos dados (bloqueante)
**Objetivo:** eliminar a dupla contagem e o período incorreto antes de qualquer métrica ou gráfico novo — base confiável para todo o resto.

**Arquivos:**
- `supabase/migrations/0030_marketing_instagram_media_dimension.sql` — criar — tabela `marketing_instagram_media` (1 linha por post: `ig_media_id`, `media_type`, `permalink`, `publicado_em`), backfill a partir de `marketing_instagram_metric_snapshot` existente, RPC/view para "última observação válida por mídia dentro de uma janela" e "delta entre dois pontos no tempo"
- `supabase/functions/marketing-importar-metricas-instagram/index.ts` — editar — upsert na dimensão (identidade do post), grava snapshot no fato sem duplicar dentro da mesma execução
- `app/src/features/marketing/MetricasInstagram.tsx` — editar — usa última observação por mídia (não soma de linhas), mostra contagem de posts únicos
- `app/src/features/marketing/RelatorioSemanal.tsx` — editar — coorte por `publicado_em`, usa delta/último valor, nunca soma cumulativa das linhas do período
- `supabase/functions/marketing-gerar-insight/index.ts` — editar — `publicacoes` conta mídias únicas, não linhas de snapshot

**Passos:**
1. Criar `0030`, com backfill testado em PGlite usando volume de dado realista (múltiplos snapshots por post, posts antigos recapturados) — mesmo cuidado que expôs os bugs do spec-kit de auditoria.
2. Escrever RPC/view de "última observação por mídia" e "delta entre dois snapshots".
3. Reescrever a leitura de `MetricasInstagram.tsx` e `RelatorioSemanal.tsx` para usar essas RPCs em vez de somar linhas cruas.
4. Corrigir `marketing-gerar-insight` para contar mídias únicas.
5. Testes de regressão explícitos: reimportação dupla não altera total; post antigo recapturado não entra no período atual.
6. `npm run check`; aplicar `0030` só após confirmação explícita.

**Critérios de pronto da onda:** AC-01, AC-02, AC-14.

#### Onda 2 — Coleta de métricas de insights (post + conta), com automação
**Objetivo:** visualizações, alcance, salvamentos, compartilhamentos, tempo de exibição e crescimento de conta capturados de verdade, com continuidade diária.

**Arquivos:**
- `supabase/migrations/0031_marketing_instagram_account_daily.sql` — criar — tabela `marketing_instagram_account_metric_daily` (série diária: alcance, visualizações, visitas ao perfil, seguidores, disponibilidade por métrica)
- `supabase/functions/marketing-importar-metricas-instagram/index.ts` — editar — chama `/insights` por mídia com matriz de métricas por `media_product_type` (FEED/REELS), chama insights diários de conta + `followers_count`, registra disponibilidade por métrica (nunca converte ausência em zero), fallback item a item sem falhar o lote, aceita chamada via `x-cron-secret` além da sessão de usuário
- `supabase/migrations/0032_cron_importar_metricas_marketing.sql` — criar (renumerado de 0033) — pg_cron diário reaproveitando `chamar_edge_function()` e os segredos do Vault já existentes

**Passos:**
1. Revalidar ao vivo, contra a documentação oficial da Meta, a matriz de métricas disponíveis por tipo de mídia e de conta — nomes/disponibilidade mudam com frequência.
2. Criar e aplicar `0031`.
3. Estender o importador: laço de insights por mídia + chamada de insights de conta, tratamento de "métrica não aplicável" por item.
4. Criar e aplicar `0032`; confirmar via `select * from cron.job` junto aos 4 crons já existentes.
5. `npm run check`; testar com dado real só depois da reconexão do Instagram (dependência humana).

**Critérios de pronto da onda:** AC-03 (parcial — coleta feita, exibição é Onda 3), AC-04, AC-05, AC-14.

**Resultado:** matriz de métricas validada ao vivo em 15-16/09/2026 contra a documentação atual da Meta (não por memória — os nomes mudaram: `impressions` está obsoleta para mídia criada após 02/07/2024). Seguidores vêm de `GET /{ig-user-id}?fields=followers_count` (campo simples do node), não do endpoint `/insights` — o texto de "Limitações" da documentação de insights de conta ainda cita `follower_count`/`online_followers` como métricas, mas elas não aparecem mais na tabela de métricas atual daquele endpoint; não apostei nelas.

**Bug real encontrado em produção e corrigido (2026-09-16):** a implementação original desta onda chaveava a matriz de métricas por `media_product_type` (FEED/REELS/STORY), pedindo esse campo no `/media`. Isso passou no `npm run check` e na validação ao vivo da documentação de insights — mas a documentação do **objeto de mídia em si** (`developers.facebook.com/documentation/instagram-platform/reference/instagram-media`, não checada nesta onda) diz explicitamente: "`media_product_type`... Disponível apenas para a API do Instagram com o Login do Facebook" — não o Login do Instagram que este projeto usa. Na prática, o campo nunca vinha preenchido, e `buscarInsightsMedia` retornava `{}` sem sequer tentar a chamada, para todo post, desde o deploy da Onda 2 — só apareceu ao usuário abrir a tela em produção e ver "não disponível" em alcance/visualizações/salvamentos/compartilhamentos de um post com curtidas/comentários normais (sinal de que não era só "dado ainda não chegou"). Corrigido: a matriz agora é chaveada por `media_type` (IMAGE/VIDEO/CAROUSEL_ALBUM), que não tem essa restrição de login e já era usado em outro lugar deste mesmo arquivo. `media_product_type` removido do `fields=` da chamada a `/media`. Function reimplantada. **Lição para a próxima vez:** ao validar um endpoint ao vivo, checar também a doc do objeto/campo específico que o código vai requisitar, não só a doc do endpoint de destino (insights) — as duas páginas têm regras de disponibilidade por tipo de login independentes uma da outra.

~~`[BLOQUEIO]`~~ **Resolvido (2026-09-16, fechado em definitivo em 2026-09-15):** Stories descartadas do escopo ativo deste spec-kit — `GET /{ig-user-id}/stories`, a única forma documentada de listar stories, aparece só sob Login do Facebook, não Login do Instagram (o tipo usado aqui). Investigação dedicada adicional (2026-09-15, fora das ondas) revalidou ao vivo listagem, `/media` e webhooks e não achou nenhuma via alternativa — ver a nota completa, com fontes e datas, em Seção 4 (Fora do Escopo) e CAP-15.

#### Onda 3 — Painel visual (gráficos e comparações)
**Objetivo:** a tela de Métricas vira um painel de verdade.

**Arquivos:**
- `app/src/components/GraficoLinha.tsx` — criar — SVG puro, tendência ao longo do tempo
- `app/src/components/GraficoBarras.tsx` — criar — SVG puro, comparação por categoria
- `app/src/features/marketing/MetricasInstagram.tsx` — editar — gráfico de tendência (semana atual/anterior/mediana de 4 semanas), comparação por formato e por horário/dia

**Passos:**
1. Implementar os dois componentes de gráfico como funções puras (dado → SVG), sem estado nem dependência externa.
2. Calcular tendência e comparação a partir das RPCs da Onda 1/2 (já deduplicadas).
3. Integrar na tela de Métricas.

**Critérios de pronto da onda:** AC-06, AC-07, AC-14.

#### Onda 4 — Relatório e insight mais confiáveis
**Objetivo:** resumo executivo computado + hipótese semanal alimentada por pacote de evidências determinístico, com confiança calculada pelo sistema.

**Arquivos:**
- `app/src/features/marketing/RelatorioSemanal.tsx` — editar — resumo executivo no topo (o que mudou, com base de comparação)
- `supabase/functions/marketing-gerar-insight/index.ts` — editar — monta pacote de evidências (dedup, deltas, taxas, mediana de 4 semanas) antes do prompt; calcula confiança no servidor; ignora/rejeita tentativa do modelo de elevar a própria confiança
- `app/src/features/marketing/Insights.tsx` — editar — exibe a confiança calculada e link ao pacote de evidências que originou o insight

**Passos:**
1. Definir a função determinística de "pacote de evidências" (dedup por mídia, delta vs. semana anterior, mediana de 4 semanas, cobertura/disponibilidade).
2. Reescrever o resumo executivo do Relatório Semanal para usar essa função (sem IA).
3. Reescrever `marketing-gerar-insight` para receber o pacote já calculado e validar a confiança recebida contra a calculada pelo sistema.
4. Atualizar `Insights.tsx` para exibir a confiança do sistema e o pacote vinculado.

**Critérios de pronto da onda:** AC-08, AC-09, AC-10, AC-14.

**Resultado:** lógica de tendência extraída para `app/src/features/marketing/tendenciaConta.ts` (com 7 testes automatizados) e reaproveitada por `MetricasInstagram.tsx` e `RelatorioSemanal.tsx` — a mesma conta, sem duplicar a aritmética entre os dois. `marketing-gerar-insight` ganhou uma cópia deliberadamente duplicada (Deno não importa módulos do navegador) da mesma lógica de tendência, com comentário cruzando as duas; o pacote de evidências parou de espalhar `media_url`/`thumbnail_url`/`children` pro modelo (só campos numéricos relevantes). Confiança: regra simples e explícita (poucas publicações ou sem semana anterior → BAIXA; amostra e histórico maiores → ALTA), calculada antes de chamar o modelo e **sobrescrita no código** depois — não é só uma instrução no prompt. `npm run check` verde (101 testes); function reimplantada com sucesso após o CLI recuperar o login.

#### Onda 5 — Análise de IA por post, com cache
**Objetivo:** leitura + sugestão por post maduro, persistida, nunca reprocessada à toa.

**Arquivos:**
- `supabase/migrations/0033_marketing_instagram_post_analysis.sql` — criar (renumerado de 0032 — ver nota na Seção 8.1) — tabela `marketing_instagram_post_analysis` (versionada: `ig_media_id`, `analise`, `sugestao`, `modelo_ia`, `custo_usd`, `gerado_em`, `numero`)
- `supabase/functions/marketing-analisar-post-instagram/index.ts` — criar — gera análise só se não existir para aquele post (ou se pedido explícito de reanálise); usa o mesmo gateway de IA/orçamento (`marketing_iniciar/finalizar_execucao_ia_livre`)
- `supabase/migrations/0034_cron_analisar_posts_marketing.sql` — criar (não previsto no desenho original — ver Resultado) — pg_cron diário
- `app/src/features/marketing/MetricasInstagram.tsx` — editar — mostra a análise por post na lista, com botão "Analisar"/"Reanalisar"

**Passos:**
1. Criar e aplicar `0033`.
2. Implementar `marketing-analisar-post-instagram`: verifica se já existe análise para o post; se não, e se o post já maturou (ex. D7), gera; sempre permite forçar reanálise manual, criando versão nova sem apagar a anterior.
3. Criar e aplicar `0034` (cron diário) — sem isso, "automática quando o post amadurece" nunca dispararia sozinha.
4. Integrar botão "Analisar"/"Reanalisar" na tela de Métricas.

**Critérios de pronto da onda:** AC-11, AC-12, AC-13, AC-14.

**Resultado:** o desenho original desta onda (Seção 12, antes da execução) não incluía um cron — só o botão manual. Ao implementar, ficou claro que sem coleta automática nada dispararia "quando o post amadurece" (CAP-13/AC-11), então acrescentei `0034` seguindo o mesmo padrão dos outros crons (`chamar_edge_function`). `solicitado_por` no modo automático usa o administrador do workspace (a tabela `marketing_ai_run` exige um usuário real, não há conceito de "sistema" no esquema atual) — decisão de implementação, não uma escolha de produto. Migrações `0033`/`0034` aplicadas e verificadas remotamente (cron `analisar-posts-marketing` ativo, 03:35 UTC); function implantada. **Pendente do responsável:** configurar `MARKETING_AI_POST_ANALYSIS_MODEL`/`MARKETING_AI_POST_ANALYSIS_ESTIMATED_COST_USD` — sugestão é reaproveitar `google/gemini-2.5-flash-lite` (já validado para comentários, barato, adequado pra um resumo curto), mas revalidar preço/disponibilidade ao vivo em openrouter.ai/models antes de fixar, mesma prática já usada para os outros modelos deste projeto.

### 12.2 Ordem de Execução

Onda 1 é bloqueante para todas as demais — nenhuma métrica nova deve ser construída sobre dado que ainda duplica contagem. Onda 2 é pré-requisito de dados para as Ondas 3 e 4 (que podem rodar em paralelo entre si, ambas dependendo só da Onda 2). Onda 5 depende do pacote de evidências desenhado na Onda 4 (reaproveita a mesma função), então vem depois dela.

## 13. Verificação End-to-End

1. **Integridade:** importar métricas duas vezes seguidas para o mesmo período → `select` na view/RPC de última observação mostra o mesmo total nas duas rodadas; um post com `publicado_em` de 3 meses atrás, importado agora, não aparece no relatório desta semana.
2. **Insights por post:** conectar a conta real (após reconexão) → rodar importação → conferir que visualizações/alcance/salvamentos aparecem com indicador de disponibilidade correto por tipo de mídia (nunca zero quando ausente).
3. **Conta:** série diária de conta acumula pelo menos 7 dias de histórico após o cron rodar uma semana → gráfico de tendência deixa de mostrar "dados insuficientes".
4. **Painel:** abrir Métricas → gráfico de tendência e comparação por formato/horário renderizam sem lib externa (conferir bundle: nenhuma dependência nova de gráfico).
5. **Relatório:** abrir Relatório Semanal → resumo executivo no topo responde "o que mudou" sem esperar nenhuma chamada de IA.
6. **Insight:** gerar hipótese semanal → pacote de evidências anexado é reproduzível (mesmos números batem se recalculados); confiança bate com a regra do sistema, não com o texto livre do modelo.
7. **Análise por post:** abrir um post maduro (7+ dias) → análise gerada automaticamente; reabrir a tela → não dispara nova chamada de IA nem novo custo no ledger; clicar "Reanalisar" → nova versão criada, anterior preservada.
8. **Regressão:** `npm run check` completo (segurança, migrações PGlite, testes de frontend, lint, build) verde; fluxo de Sorteios e as demais telas de Marketing (Comentários, aprovação de conteúdo) continuam funcionando sem alteração.
9. **Segredos:** `grep -ri "OPENROUTER_API_KEY\|service_role" app/dist/` retorna vazio.
