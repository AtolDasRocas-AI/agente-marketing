# Handoff — ATOL Studio para Claude Code

Atualizado em 16/09/2026. Este documento separa fatos confirmados de alterações locais ainda não validadas. Não exponha, copie ou versione arquivos de segredo.

## Spec-kit `atol-analise-instagram-avancada` concluído e aplicado (2026-09-15/16, `spec-kits/atol-analise-instagram-avancada.spec-kit.md`, status `done`)

As 5 ondas foram implementadas, validadas localmente (`npm run check` verde a cada onda — segurança, migrações PGlite, 101 testes de frontend, lint, build) **e aplicadas/implantadas remotamente** (diferente do handoff das Sprints A–F abaixo, que ficou só local). Resumo:

- **Onda 1 (integridade):** corrigido o bug real de dupla contagem — `marketing_instagram_metric_snapshot` grava uma linha nova a cada reimportação (chave inclui `coletado_em`); o relatório e o insight somavam todas as linhas do período em vez da última observação por mídia. `0030_marketing_instagram_media_dimension.sql` separa identidade (`marketing_instagram_media`, dimensão) de observação (fato, sem mudar), com backfill, FK nova, e as funções `marketing_instagram_ultimo_snapshot`/`marketing_instagram_delta_snapshot` (deduplicadas, nunca somam linhas). `MetricasInstagram.tsx`, `RelatorioSemanal.tsx` e `marketing-gerar-insight` reescritos para usar essas funções.
- **Onda 2 (insights de post + conta):** `marketing-importar-metricas-instagram` passou a chamar `/insights` por mídia (matriz de métricas validada ao vivo contra a doc da Meta em 15-16/09/2026 — chave certa é `media_product_type`, FEED/REELS, não `media_type`) e `/insights` de conta + `followers_count`. Nova tabela `0031_marketing_instagram_account_daily.sql` (série diária, upsert por dia). Cron novo `importar-metricas-marketing` (`0032`, 03:20 UTC). A function aceita chamada via `x-cron-secret` além de sessão de usuário (implantada com `--no-verify-jwt`, mesmo padrão de `lgpd-expurgo-marketing`). **Stories ficou fora** — investigado ao vivo e descartado em definitivo (ver seção própria abaixo).
- **Onda 3 (painel visual):** `GraficoLinha.tsx`/`GraficoBarras.tsx` (SVG artesanal, zero dependência nova — confirmado no bundle). `MetricasInstagram.tsx` ganhou gráfico de tendência de alcance, comparação por formato (Imagem/Vídeo-Reels/Carrossel) e por dia da semana, e cada post mostra alcance/visualizações/salvamentos/compartilhamentos com "não disponível" explícito.
- **Onda 4 (relatório/insight confiáveis):** lógica de tendência extraída pra `app/src/features/marketing/tendenciaConta.ts` (testada, 7 casos) e reaproveitada por Métricas e Relatório; `marketing-gerar-insight` ganhou uma cópia (Deno não importa módulo do navegador) com o mesmo comentário cruzando as duas. Pacote de evidências não manda mais `media_url`/`children` pro modelo. Confiança do insight é calculada por regra no servidor (poucas publicações ou sem semana anterior → BAIXA) e **sempre sobrescrita** no código, nunca decidida pelo modelo.
- **Onda 5 (análise por post):** nova tabela `0033_marketing_instagram_post_analysis.sql` (versionada, append-only) e function `marketing-analisar-post-instagram` (nova). Cron `0034` (`analisar-posts-marketing`, 03:35 UTC) — **não estava no desenho original do spec-kit**, precisou ser acrescentado porque nada dispararia a análise automática sem ele. `solicitado_por` no modo automático usa o administrador do workspace (`marketing_ai_run` exige usuário real). Botão "Analisar"/"Reanalisar" em `MetricasInstagram.tsx`.

**Aplicado remotamente nesta sessão, com autorização do responsável a cada passo:** migrações `0030`–`0034` (via `supabase db query --linked --file`, nunca `db push`); functions `marketing-importar-metricas-instagram`, `marketing-gerar-insight`, `marketing-analisar-post-instagram` implantadas. Todos os 6 cron jobs confirmados ativos em `cron.job`.

**Resolvido nesta sessão (16/09/2026):** `MARKETING_AI_POST_ANALYSIS_MODEL=google/gemini-2.5-flash-lite` (revalidado ao vivo: $0,10/$0,40 por 1M, 99,91% de disponibilidade) e `MARKETING_AI_POST_ANALYSIS_ESTIMATED_COST_USD=0.001` configurados via `supabase secrets set` — `marketing-analisar-post-instagram` não depende mais de nenhuma configuração pendente.

**Publicado no Vercel nesta sessão (16/09/2026), a pedido explícito do responsável:** `dpl_4hvqFEWqULcpowogZ2Nrb55Dh6wx`, alias `https://app-one-fawn-32.vercel.app` confirmado. Verificado no navegador: a página inicial carrega sem erro de console.

- **Correção ao padrão de deploy documentado antes:** o comando `vercel pull`/`vercel build --prebuilt` rodando de dentro de `app/` (como este documento recomendava) passou a falhar com `Cannot resolve entry module index.html` — o projeto Vercel tem `rootDirectory: "app"` configurado, então rodar já de dentro de `app/` faz o CLI tentar descer em `app/app/`. Rodar os mesmos comandos a partir da **raiz do repositório** (onde já existe um `.vercel/project.json` de uma sessão anterior) parou de dar esse erro, mas o build local ficou com `.vercel/output` sem a pasta `static/` (aviso "Build output contains no functions or static directory") — o prebuilt ficaria vazio se implantado assim.
- **O que funcionou:** `npx vercel deploy --prod` (sem `--prebuilt`, sem passo de `vercel build` separado) direto da raiz do repositório — deixa a Vercel buildar remotamente (`Running "npm run build"` no log), ~10s de build, mesma URL de produção. Mais simples e mais robusto que o pipeline prebuilt de duas etapas. Se o prebuilt voltar a ser necessário no futuro, investigar por que `vercel build` não está populando `static/` antes de tentar de novo — não gastar tempo repetindo o mesmo comando.

**Pendente do responsável:**
1. Validação com dado real do Instagram (visualizações, alcance, tempo de exibição de Reels, crescimento de conta, análise de post) segue bloqueada pela reconexão de `@atol.ia.oficial`, mesma pendência já registrada abaixo.
2. Recorrência (4ª vez nesta sessão) do problema de troca de conta do CLI do Supabase — ver [[project-atol-marketing]] na memória do Claude Code; recomendação de `SUPABASE_ACCESS_TOKEN` persistente segue de pé.

### Stories via Login do Instagram — investigado e descartado em definitivo (2026-09-15)

Ver detalhe completo, com fontes e datas de cada página da Meta consultada, em `spec-kits/atol-analise-instagram-avancada.spec-kit.md` (Seção 4 e CAP-15) e na seção "Agente analista de Instagram" mais abaixo neste documento. Resumo: não há via alternativa via Login do Instagram (`graph.instagram.com`) para ler Stories hoje — nem listagem, nem mistura no `/media`, nem webhook. Não reabrir sem mudança documentada pela própria Meta.

## Sprints A–F implementadas localmente (2026-09-15, spec-kit `spec-kits/atol-studio-continuacao.spec-kit.md`)

Todas as 6 ondas do spec-kit foram escritas e validadas localmente (`npm run check` verde após cada onda — segurança, migrações 0021–0026 em PGlite, 94 testes do frontend, lint, build). **Nada foi aplicado ou implantado remotamente ainda** — migrations, Edge Functions e secrets novos seguem como pendência explícita, listada no final desta seção.

Resumo por onda:

- **Onda 1 (banco):** `0021_restringir_acesso_institucional.sql` restringe o hook a só `atoldasrocas.ai@gmail.com`; `acesso.ts` atualizado. Divergência da migração 0020 investigada e documentada acima ("Divergência da migração 0020"). `supabase migration list` confirmou também que 0013–0019 estão registradas sob 7 versões de timestamp que não casam com os nomes locais — mesma causa raiz, sem risco funcional.
- **Onda 2 (dados do Instagram):** `0022_marketing_instagram_import_run.sql` cria o log de execuções (`marketing_instagram_import_run`, com `tipo` METRICAS/COMENTARIOS). `marketing-importar-metricas-instagram/index.ts` foi reescrita: agora pagina de verdade via `paging.next` (a versão anterior só buscava `limit=50` sem paginar — publicações mais antigas nunca eram importadas em contas com mais de 50 posts; achado durante a implementação, não um requisito novo), grava início/fim/erro no log, e usa um `coletado_em` fixo por execução para não duplicar snapshot se uma página repetir dentro do mesmo run. `MetricasInstagram.tsx` mostra última coleta e última falha.
- **Onda 3 (comentários):** `0023_marketing_instagram_comment.sql` cria `marketing_instagram_comment_snapshot` e **generaliza o gateway de IA** com `marketing_iniciar_execucao_ia_livre`/`marketing_finalizar_execucao_ia_livre` — as RPCs originais (`marketing_iniciar/finalizar_execucao_ia`) exigem `content_item_id` e sempre criam `marketing_content_version`, o que não faz sentido para classificar comentário; as novas RPCs reaproveitam o mesmo orçamento/ledger sem essas duas exigências, e não foram alteradas as RPCs originais. Novas functions: `marketing-importar-comentarios-instagram` (lê os `ig_media_id` já conhecidos via métricas, pagina comentários, upsert por `(workspace_id, ig_comment_id)` preservando classificação em reimportações), `marketing-classificar-comentarios` (lote de até 20, IA em `MARKETING_AI_COMMENT_MODEL`), `lgpd-expurgo-marketing` (90 dias, anonimiza autor/texto preservando categoria para agregados — não é hard-delete). Tela nova `Comentarios.tsx`, rota `/marketing/comentarios`.
- **Onda 4 (notas de contexto):** `0024_marketing_context_note_edicao.sql` adiciona `marketing_editar_nota_contexto`/`marketing_arquivar_nota_contexto` (edição in-place + `arquivado_em`, nunca DELETE; a auditoria já existente em `marketing_auditar_mutacao` passa a rodar também em UPDATE, preservando o antes/depois). `RelatorioSemanal.tsx` filtra notas arquivadas e mostra a frase de hipótese ("coincide com o período... não é causalidade confirmada") quando uma nota está a ≤3 dias da publicação de maior interação.
- **Onda 5 (inteligência de produto):** `0025_marketing_insight.sql` cria `marketing_insight` (evidências/limitações/confiança/próxima ação/custo) + `marketing_decidir_insight` (só administrador, só uma vez). `marketing-gerar-insight/index.ts` usa `MARKETING_AI_INSIGHT_MODEL`, junta métricas + notas não arquivadas + distribuição de categorias de comentário do período, grava o insight **antes** de chamar `marketing_finalizar_execucao_ia_livre` (se algo falhar depois, o pior caso é um `ai_run` preso em EXECUTANDO sem custo debitado — nunca custo debitado sem hipótese visível). Tela nova `Insights.tsx`, rota `/marketing/insights`.
- **Onda 6 (conteúdo e imagem):** achado real durante a implementação — a operação `PROMPT_IMAGEM` já existia desde o Sprint 2 anterior, mas `marketing-gerar-conteudo`'s `promptPara()` nunca pedia esse campo ao modelo (só pedia os campos editoriais fixos); corrigido para pedir só `prompt_imagem` quando a operação é essa. "Pedir nova versão" (CAP-17) já funcionava antes desta rodada — não precisou de código novo, só passou a exibir `prompt_imagem` na lista de campos da versão. `0026_marketing_image_generation.sql` cria `marketing_image_asset`, o bucket privado `marketing-imagens` (via `insert into storage.buckets`) e a policy de leitura por posse (`marketing_pode_acessar_objeto_imagem`, sem depender de `storage.foldername`). `marketing-gerar-imagem/index.ts` só gera a partir de uma `marketing_content_version` com `operacao='PROMPT_IMAGEM'` e aprovação `APROVADO` registrada. **Aviso explícito no topo do arquivo:** o formato exato da resposta de imagem do OpenRouter (campo `images` na mensagem, data URI) nunca foi testado contra a API real — revalidar antes de ativar. A UI de geração foi colocada dentro de `EstrategiaConteudo.tsx` (ao lado da versão de prompt aprovada), não numa tela separada — mudança de organização de arquivo em relação ao spec-kit original, sem mudança de capacidade.

**Aplicado nesta sessão, com autorização explícita do responsável (2026-09-15):**

- ✅ Migrações `0021` a `0026` aplicadas no Supabase remoto, uma por vez, via `supabase db query --linked --file` (nunca `db push`). Confirmado por leitura: as 4 tabelas novas (`marketing_instagram_import_run`, `marketing_instagram_comment_snapshot`, `marketing_insight`, `marketing_image_asset`) existem em `information_schema.tables`.
- ✅ Deploy das 7 Edge Functions: `marketing-importar-metricas-instagram` (v2, reescrita), `marketing-gerar-conteudo` (v2, fix do `prompt_imagem`), `marketing-importar-comentarios-instagram` (v1), `marketing-classificar-comentarios` (v1), `lgpd-expurgo-marketing` (v1), `marketing-gerar-insight` (v1), `marketing-gerar-imagem` (v1) — todas `ACTIVE` conforme `supabase functions list`.
  - **Correção aplicada no processo:** `lgpd-expurgo-marketing` foi implantada por padrão com `verify_jwt: true`; como a função autentica só via header `x-cron-secret` (igual a `lgpd-expurgo` de Sorteios, que tem `verify_jwt: false`), isso bloquearia a chamada do pg_cron. Reimplantada com `--no-verify-jwt` para igualar o padrão da função irmã.

**Secrets de IA configurados nesta sessão (2026-09-15), com valores revalidados ao vivo no catálogo do OpenRouter antes de aplicar:**

- `MARKETING_AI_COMMENT_MODEL=google/gemini-2.5-flash-lite` (confirmado $0,10/$0,40 por 1M tokens) + `MARKETING_AI_COMMENT_ESTIMATED_COST_USD=0.001` (lote de ~20 comentários, ~1500 tokens de entrada + até 800 de saída).
- `MARKETING_AI_INSIGHT_MODEL=anthropic/claude-haiku-4.5` (confirmado $1/$5 por 1M) + `MARKETING_AI_INSIGHT_ESTIMATED_COST_USD=0.01`.
- `MARKETING_AI_IMAGE_MODEL=google/gemini-3.1-flash-lite-image` — **atenção ao slug**: é "Nano Banana 2 Lite", não a Nano Banana original (`gemini-2.5-flash-image`); confirmado $0,25/$30 por 1M tokens, com um exemplo real no playground custando $0,0336/imagem — `MARKETING_AI_IMAGE_ESTIMATED_COST_USD=0.05` (com margem sobre esse exemplo real).
- `marketing-gerar-imagem` reimplantada com o comentário do topo do arquivo atualizado (modelo confirmado; formato da resposta de imagem continua não testado contra a API real).
- **Incidente no meio do processo:** a sessão do CLI do Supabase trocou de conta de novo (mesmo padrão já documentado acima) — `projects list` passou a mostrar só projetos "Atol-AI-DEV"/"AtolDasRocas-AI's Project" (o ref antigo proibido), sem o Sorteio. O responsável rodou `supabase login` de novo escolhendo a conta certa; confirmado com `uakwbtmbhwifiekwmsbq` aparecendo com `"linked": true` antes de repetir o `secrets set`.

**pg_cron do expurgo LGPD de comentários configurado (2026-09-15, mesma sessão):** migração `0027_cron_expurgo_marketing.sql` (sem `begin;`/`commit;`, mesmo padrão de 0007/0008 — `cron.schedule` não fica bem em transação) agenda `expurgo-lgpd-marketing` diário às 03:50 UTC, reaproveitando a função `chamar_edge_function()` e os segredos do Vault já existentes (`projeto_url`, `cron_secret`) — nenhum segredo novo, nenhuma alteração em `scripts/configurar-cron.mjs`. Confirmado ativo via `select * from cron.job`, junto aos outros 3 jobs (`renovar-token-instagram`, `expurgo-lgpd`, `watchdog-importacao`).

**Orçamento de IA do workspace configurado (2026-09-15, mesma sessão):** `marketing_ai_budget` estava zerado; o fluxo normal é um administrador configurar em `/marketing/briefings/:id/estrategia` ("Salvar limites"), que chama `marketing_configurar_orcamento_ia` — RPC que exige um `auth.uid()` real de administrador, algo que este agente não tem (não faz login). Como o responsável pediu explicitamente a configuração nesta sessão, os valores foram gravados por SQL direto (`supabase db query`, upsert em `marketing_ai_budget`), não pela RPC — por isso a auditoria desta linha específica não vai mostrar o clique de um admin na tela, mas a decisão foi pedida e confirmada pelo responsável no chat antes de aplicar. Valores: `limite_mensal_usd = 10` (alinhado ao teto da conta OpenRouter), `limite_por_execucao_usd = 0.10` (2x de margem sobre o maior custo estimado atual, a geração de imagem a US$0,05). Workspace `02ad7dfb-0c55-4701-a72a-f0e62f15447b` ("ATOL Marketing"), único administrador `93284251-9165-4148-a988-92aaf37d7933`.

**Ainda pendente** (cada uma continua exigindo confirmação explícita própria, nunca em lote):

1. `MARKETING_AI_TEXT_MODEL` trocar para `openai/gpt-5.6-luna` continua decidido mas não aplicado (fora do pedido desta rodada, que era só os 3 pares que faltavam).
2. Reconexão do Instagram (`@atol.ia.oficial`) — segue pendente, ação humana no Meta, fora do alcance de qualquer agente. Bloqueia a validação real de todo o Sprint B e C.
3. Validação em produção com dados reais de todos os ACs marcados como pendente em `spec-kits/atol-studio-continuacao.spec-kit.md` (Seção 6) — hoje 10 de 22.
4. **Recomendação operacional nova:** configurar `SUPABASE_ACCESS_TOKEN` como variável de ambiente persistente (gerado em supabase.com/dashboard/account/tokens, na conta certa) para parar de depender da sessão de login interativa do CLI, que trocou de conta 3 vezes nesta única sessão (provavelmente por outro terminal/sessão tocando o Supabase de outro projeto, ex.: `reef-system-app`). Ver [[project-atol-marketing]] na memória do Claude Code para o histórico completo do problema.

## Auditoria de bugs de UI/ação (2026-09-15)

Depois de 6 correções pontuais ao vivo (erro genérico de function, link de estratégia sumindo da Agenda, aprovação de conteúdo quebrada desde a 0017 por cast de enum, capa de post ausente, `response_format` incompatível no insight/comentários, auditoria de insight estourando 32KB), o responsável pediu uma varredura sistemática em vez de continuar corrigindo bug a bug — `spec-kits/auditoria-acoes-marketing.spec-kit.md` (status `approved`, Onda 1 concluída, Ondas 2-4 revisadas por código, Onda 5 com causa raiz confirmada).

- **Achado e corrigido:** `marketing-gerar-conteudo/index.ts` tinha a mesma classe de bug do `response_format`/`JSON.parse` cru já visto no insight e nos comentários — nunca tinha sido corrigido aqui. Alinhado ao padrão `extrairJson()`, implantado (`npm run check` verde antes do deploy).
- **Achado, não é bug:** `marketing_editar_nota_contexto` (RPC da Sprint 4/Onda 4) existe no banco mas não tem nenhum botão na tela — capacidade nunca ligada à UI. Registrado para decisão futura, não construído agora (seria escopo novo).
- **Diagnóstico confirmado por SQL:** o erro 422 (`PROMPT_VAZIO`) ao gerar imagem a partir do prompt v1 de um briefing é porque essa versão foi criada às 16:23, antes do fix de `promptPara()` — seu `conteudo` tem os campos editoriais gerais, não `prompt_imagem`. Não precisa de correção; precisa gerar uma v2 (já com o fix) e testar de novo.
- Varredura de enum-sem-cast (mesma classe da 0017) e de gatilho de auditoria sem limite de tamanho (mesma classe do insight) não encontrou nenhum outro caso — ambos os bugs originais já eram os únicos existentes no repo.

## Objetivo do produto

Evoluir este repositório em uma ferramenta externa de marketing e inteligência de produto da ATOL, coexistindo com Sorteios no projeto Supabase **Sorteio**. O módulo de Marketing usa tabelas `marketing_*`, RLS por workspace, auditoria e não publica conteúdo automaticamente.

## Estado confirmado

### Ambiente e publicação

- Aplicação publicada em produção: `https://app-one-fawn-32.vercel.app`. Já contém a tela de login Google-only desta sessão — verificado no navegador em produção: `/login` mostra as duas contas autorizadas, e `/marketing/agenda` sem sessão redireciona para `/login`, sem erros no console.
- Último deploy Vercel confirmado: `dpl_6Nx39ATm2So7DaYFyuxNaNWq5i22` (2026-09-15, substituiu `dpl_Fa6dJQ22ovaCPxraRJaPxNKXe9En`).
- Projeto Vercel: equipe `atol-ai-s-projects`, projeto `app`.
- **Como esse deploy foi feito (padrão do projeto — builds na Vercel demoram 6-10s porque não há build remoto, o app já sobe pré-buildado):**
  ```
  cd app
  npx vercel pull --yes --environment production   # baixa .vercel/.env.production.local e project.json (nao versionados, no .gitignore)
  npx vercel build --prod                          # build local, usa as env vars puxadas no passo acima
  npx vercel deploy --prebuilt --prod              # sobe .vercel/output pronto, sem rebuildar na Vercel
  ```
  Vercel CLI já estava autenticado nesta máquina (mesma lógica do Supabase — sessão não é por-terminal). `vercel env ls production` mostrou "No Environment Variables found", o que é enganoso — `vercel pull` baixou normalmente; não confiar em `env ls` para decidir se as env vars existem.
- Supabase correto: projeto **Sorteio**, ref `uakwbtmbhwifiekwmsbq`, URL `https://uakwbtmbhwifiekwmsbq.supabase.co`.
- Nunca usar o projeto/ref antigo `ltrhsljnzuxoqyoodbfu`.
- `npx supabase <comando> --project-ref uakwbtmbhwifiekwmsbq` funciona autenticado direto pelo Claude Code nesta máquina, depois que o responsável roda `supabase login` uma vez em qualquer terminal local (a sessão do CLI não é por-terminal). Foi assim que o deploy de `marketing-gerar-conteudo` (2026-09-15) foi feito. Continua valendo nunca ler `.supabase-token` deste repo — não foi e não é necessário para isso.
- **Não rodar `supabase db push` neste projeto sem investigar antes.** `supabase migration list` mostra que o histórico remoto registra 0013–0019 sob versões timestamp (ex.: `20260914212813`), não sob os nomes locais (`0013`, `0014`...) — ou seja, o CLI não reconhece nenhuma migração local como já aplicada e um `db push` tentaria reexecutar 0001–0020 inteiras, provavelmente falhando em `create table`/`create function` já existentes. Para aplicar só um arquivo novo específico, use `supabase db query --linked --project-ref uakwbtmbhwifiekwmsbq --file supabase/migrations/000X_arquivo.sql` (foi assim que a 0020 foi aplicada).

### Banco remoto confirmado

As migrações abaixo estão aplicadas no Supabase Sorteio:

- `0013_marketing_foundation`
- `0014_security_and_idempotency`
- `0015_ai_strategy_and_versions`
- `0016_ai_strategy_indexes`
- `0017_content_approval_workflow`
- `0018_marketing_instagram_readonly`
- `0019_marketing_context_notes`
- `0020_google_only_atol_auth` — aplicada nesta sessão via `supabase db query --file` (não por `db push`; ver nota acima). Confirmado com `select proname, prosecdef from pg_proc where proname = 'hook_permitir_somente_google_atol'` retornando a função.

O arquivo local `supabase/migrations/0019_marketing_context_notes.sql` foi validado contra o banco e versionado nesta sessão — não precisa ser reaplicado.

### Divergência da migração 0020 — causa raiz e decisão (Sprint A, spec-kit `atol-studio-continuacao`)

`npx supabase migration list --project-ref uakwbtmbhwifiekwmsbq` (consulta somente leitura) mostra que **todos** os arquivos locais 0001–0020 aparecem com `remote` vazio, e a tabela de histórico remoto (`supabase_migrations.schema_migrations`) tem 7 versões com nome de timestamp (`20260914212813`, `20260914230357`, `20260915002402`, `20260915002538`, `20260915002834`, `20260915023513`, `20260915024802`) que não correspondem a nenhum nome de arquivo local.

**Causa raiz:** as migrações 0013–0019 (7 arquivos) foram aplicadas ao banco remoto por um caminho que registrou cada uma na tabela de histórico sob uma versão de timestamp gerada automaticamente, não sob o nome do arquivo local — daí as 7 entradas remotas sem correspondência de nome. Já a 0020 foi aplicada via `supabase db query --file` (método usado nesta sessão exatamente para não disparar um `db push` cru), que executa o SQL diretamente sem inserir nenhuma linha na tabela de histórico — por isso ela não aparece nem como "aplicada", nem como mismatch: simplesmente não existe registro dela lá, embora a função `hook_permitir_somente_google_atol` exista de fato no banco (confirmado por `pg_proc` nesta sessão e por `[auth.hook.before_user_created] enabled = true` em `supabase/config.toml`).

**Decisão registrada:** conviver com essa divergência de bookkeeping por enquanto. O esquema real está correto e aplicado nas duas situações — o único efeito da divergência é tornar `migration list` confuso, não há risco funcional ou de integridade. `supabase migration repair --status applied <versão>` poderia realinhar o histórico, mas essa é uma mutação remota (mesmo que só de bookkeeping) e não traz benefício funcional, só cosmético — não será executada sem um pedido explícito e separado. Novas migrações (0021 em diante) continuam sendo aplicadas pelo mesmo método já validado (`supabase db query --linked --file`), nunca por `db push` cru.

**Ainda pendente mesmo com a 0020 aplicada:** a função `hook_permitir_somente_google_atol` existe no banco, mas **não está ativa** como hook — falta selecioná-la manualmente em Auth > Hooks > Before User Created no painel Supabase (não há CLI/API para esse passo específico). Sem isso, o Google continua criando qualquer conta normalmente; a restrição às duas contas autorizadas só passa a valer depois desse passo manual.

O banco de Marketing já possui:

- agenda e briefing remoto;
- versões imutáveis, orçamento e ledger de IA;
- aprovação humana por administrador;
- associação de conta Instagram ao workspace, instantâneos somente-leitura e painel de métricas;
- relatório semanal e notas de contexto para eventos relevantes de marca.

### Commits relevantes

- `9068b92` baseline
- `877c4e5` fundação de marketing
- `a6158bf` testes de banco
- `f0707c4` agenda conectada ao Supabase
- `230ed40` estratégia e aprovação
- `3f71919` permissão de métricas Instagram
- `e8ca169` métricas Instagram
- `5970d1c` relatório semanal

## Alterações validadas e versionadas nesta sessão — aplicação remota e ativação manual ainda pendentes

Passaram por `npm run check` completo (segurança, migrações, testes, lint, build) e foram commitadas:

- `supabase/migrations/0020_google_only_atol_auth.sql`
  - cria `public.hook_permitir_somente_google_atol(jsonb)`;
  - permite criar usuários apenas via Google e apenas para duas contas autorizadas: `atoldasrocas.ai@gmail.com` e `lipe.kosse@gmail.com` (lista ampliada nesta sessão a pedido do responsável — originalmente só a conta institucional);
  - validada localmente (`npm run test:database`), **ainda não aplicada no Supabase remoto** — decisão de aplicar ficou para depois;
  - a ativação como **Before User Created Hook** exige ação manual no painel Supabase Auth, mesmo depois de aplicada.
- `app/src/features/auth/acesso.ts` (novo), `app/src/features/auth/AcessoAtol.tsx`, `app/src/features/auth/Login.tsx` e `app/src/main.tsx`
  - substituem login por senha por login Google e protegem quase todas as rotas da aplicação (inclusive as de Sorteio, não só Marketing) atrás da mesma lista de duas contas usada na migração 0020 (`EMAILS_PERMITIDOS` em `acesso.ts`);
  - lint, build e testes passaram; havia um bug real de TypeScript (`supabase` possivelmente nulo dentro de um closure em `AcessoAtol.tsx`) corrigido nesta sessão;
  - **atenção ao sequenciamento (resolvida nesta sessão):** publicar este código no Vercel antes de configurar o provedor Google deixaria a produção sem login funcional — isso não é mais um risco, o checklist Google-only (seção abaixo) está completo: Google habilitado, hook ativo, Email/telefone sem signup novo, URL de produção configurada. Falta só decidir publicar no Vercel.
- `app/src/features/marketing/RelatorioSemanal.tsx`
  - ganhou o formulário de notas de contexto, integrado com a migração 0019.
- `supabase/migrations/0019_marketing_context_notes.sql`
  - já aplicada remotamente antes desta sessão; arquivo local validado contra o banco e agora versionado.
- `docs/agente-analista-instagram-atol.md`
  - especifica o agente analista em modo observação: postagens, Reels, carrosséis, comentários, marcações/menções, Stories quando a API permitir, métricas e correlação com notas.
- `docs/ativacao-google-only-atol.md`
  - roteiro de ativação do Google-only no Supabase Auth.

A 0020 foi aplicada nesta sessão (ver "Banco remoto confirmado" acima), a pedido explícito do responsável. Continua valendo: não publicar no Vercel sem confirmação explícita de quem está conduzindo.

## Sequência obrigatória de validação

1. Verificar o estado da árvore com `git status --short`; preservar os arquivos não rastreados do usuário `Apresentacao_Agente_Marketing_ATOL.html` e `Apresentacao_Sistema_ATOL.html` (ambos decks de apresentação focados só no ATOL Studio, criado/ajustado em 2026-09-15, publicado também como Artifact).
2. Revisar o diff local, sobretudo a estrutura de rotas em `app/src/main.tsx`.
3. Rodar:

   ```text
   npm run test:database
   npm --prefix app test
   npm --prefix app run lint
   npm --prefix app run build
   npm run check
   ```

4. Corrigir qualquer falha antes de preparar arquivos no Git.
5. Aplicar a migração `0020_google_only_atol_auth` somente após validação local e confirmação do projeto Supabase correto.
6. Confirmar a migração remota com a lista oficial de migrations.
7. Publicar no Vercel somente depois de validar a build final.

## Pendências que exigem a pessoa responsável

### Google-only

Login Google-only testado e funcionando de ponta a ponta nesta sessão (conta autorizada real, via UI de produção). Com a sessão ativa, foram criados 11 briefings de conteúdo na Agenda (`/marketing/agenda`), a partir de uma análise de Instagram (`ANALISE_INSTAGRAM_ATOL_IA_2026-09-13.md`) fornecida pelo responsável — cobrindo 4 semanas (16/09 a 11/10), todos com status `PRONTO_PARA_ESTRATEGIA`. Conteúdo e datas ficam só no banco (tabela `marketing_content_item`), não neste documento — ver na própria Agenda do app.

Migração 0020 já aplicada (função existe no banco). **Checklist de 4 passos completo nesta sessão:**

1. ~~habilitar Google e desabilitar Email, telefone e outros provedores~~ — **feito**: Google já estava ligado; `auth.email.enable_signup` mudado de `true` para `false` via `config push` (confirmado pela saída do comando no terminal do responsável); `auth.sms.enable_signup` já estava `false` remotamente (cadastro por telefone já era bloqueado antes desta sessão). O provedor Twilio em si continua ligado (`auth.sms.twilio.enabled = true`) mas deliberadamente não foi tocado — não é usado para signup, ver nota abaixo;
2. ~~inserir Client ID e Client Secret OAuth do Google~~ — **feito**, mas trocado nesta sessão: o Client ID original (`807634178322-...`) não pertencia a nenhum dos projetos Google Cloud acessíveis pela conta do responsável (checados: "ATOL-AI", "Atol AI", "My First Project" — nenhum tinha esse Client ID) e o login em produção falhava com `redirect_uri_mismatch`. O responsável criou um Client ID novo no projeto "ATOL-AI" já com a Redirect URI certa (`https://uakwbtmbhwifiekwmsbq.supabase.co/auth/v1/callback`) e atualizou Client ID + Secret no Supabase via `supabase config push` (secret passado por `$env:SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` no terminal do responsável — Claude Code tentou rodar isso e foi bloqueado pelo próprio classificador de auto mode como "Credential Leakage", então o comando final foi executado pelo responsável, não por aqui). Client ID atual: `467978480715-ibumimff7v8kmspp24l5q08iltlke4ru.apps.googleusercontent.com`. O Client Secret não foi registrado em nenhum arquivo deste repositório nem na memória do Claude Code.
3. ~~selecionar `public.hook_permitir_somente_google_atol` como **Before User Created Hook**~~ — **feito nesta sessão**, ver abaixo;
4. ~~configurar a URL/redirect de produção~~ — **feito**: `site_url` agora `https://app-one-fawn-32.vercel.app`, `additional_redirect_urls` agora `["https://app-one-fawn-32.vercel.app/**"]` (confirmado pela saída do `config push` no terminal do responsável).

Não tentar adivinhar, criar ou registrar credenciais OAuth. Login local por Google (ex.: testar em `https://localhost:5173`) não está no allowlist de redirect — só foi adicionada a URL de produção; se precisar testar o fluxo Google localmente, adicionar `https://localhost:5173/**` a `additional_redirect_urls` primeiro.

**Hook ativado nesta sessão via `supabase config push` (não pelo painel):**

```
npx supabase init                                              # criou supabase/config.toml local (nao existia)
npx supabase config pull --project-ref uakwbtmbhwifiekwmsbq --yes --force   # sincronizou com o estado real
# editado a mao: [auth.hook.before_user_created] enabled=true, uri="pg-functions://postgres/public/hook_permitir_somente_google_atol"
# [auth.sms.twilio] inteiro comentado — nao apagar o comentario: sem isso, config push tentaria
# desativar o Twilio real (a API mascara account_sid/auth_token, entao o pull nunca preenche esse bloco
# corretamente, e declarar enabled=true sem os demais campos falha na validacao do schema)
npx supabase config diff --project-ref uakwbtmbhwifiekwmsbq     # confirmado: só o hook mudaria, Twilio ficaria remote_only/undeclared
npx supabase config push --project-ref uakwbtmbhwifiekwmsbq --yes
```

Resposta do push confirmou `"service":"auth","status":"updated"` com as chaves do hook, e `"remote_only":1` (o Twilio, propositalmente não tocado). Um `config diff` de confirmação pós-push foi bloqueado pelo classificador de auto mode do próprio Claude Code (ação repetida de config); a confirmação que temos é a resposta do próprio `push`, que já é autoritativa.

`supabase/config.toml` e `supabase/.gitignore` ficaram **não versionados** de propósito — o pull trouxe um snapshot amplo (email, mfa, pooler, storage, etc.), não só o hook, e versionar isso formalizaria um novo fluxo de "config declarativo" que ninguém pediu ainda. Se quiser adotar `config.toml` versionado como fonte de verdade daqui pra frente, é uma decisão separada — por ora o arquivo só serviu para aplicar o hook.

### Instagram e IA

- Reconectar `@atol.ia.oficial` aceitando a permissão de leitura de métricas; o código pede `instagram_business_manage_insights` e não pede publicação.
- `marketing-importar-metricas-instagram` e `marketing-gerar-conteudo` **já estão publicadas** no projeto `uakwbtmbhwifiekwmsbq` (deploy feito nesta sessão via `supabase functions deploy`, confirmadas como `v1 ACTIVE` em `supabase functions list`).
- **Vinculação ao workspace concluída nesta sessão** (o responsável clicou em "Usar esta conta no Marketing" em `/marketing/metricas`): `marketing_instagram_connection` já tem a linha de `@atol.ia.oficial` (desde 15/09 14:26). "Importar métricas agora" ainda falhava com `Edge Function returned a non-2xx status code`.
- **Causa raiz encontrada nesta sessão:** a conexão OAuth de 21/08 nunca teve, no lado do Meta, as permissões `instagram_business_manage_comments` e `instagram_business_manage_insights` configuradas como caso de uso do app **"Sorteio ATOL"** no developers.facebook.com — apareciam como "—"/"Adicionar" em Casos de uso > API do Instagram > Permissões e recursos (só `instagram_business_basic` já existia, com 445 chamadas). Isso gerava `OAuthException` código 200 "API access blocked" em qualquer chamada à Graph API usando esse token, inclusive fora do Marketing (mesmo erro apareceu em `/sorteios/novo`).
  - **Diagnóstico:** "Caixa de Entrada de alertas" e "Ações necessárias" no painel do Meta não mostraram nada (sem bloqueio geral/violação) — o problema era só essas duas permissões nunca terem sido adicionadas ao app.
  - **Ação do responsável:** clicou "+ Adicionar" em todas as permissões da lista de Casos de uso, não só nas três necessárias — inclui **`instagram_content_publish`** (publicação) e **`ads_management`/`ads_read`/`business_management`** (Gerenciador de Anúncios/Negócios), sem relação com este projeto. Decisão deliberada e mantida ("para no futuro podermos fazer mais coisas") — Claude Code recomendou reverter as desnecessárias e foi explicitamente dispensado.
  - **Importante:** isso não muda o comportamento atual do app. O código só solicita `instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_insights` no `scope` de `urlAutorizacaoInstagram()` (`app/src/features/conta/api.ts`) — ter `instagram_content_publish`/`ads_management` habilitados no app do Meta não dá essa capacidade ao token atual nem a um token futuro, a menos que esse `scope` também mude.
  - **Próximo passo (ainda pendente, exige login real no Meta):** clicar "Revincular conta" em `/conectar` para gerar um token novo já com as permissões corretas. Só depois disso "Importar métricas agora" deve funcionar.
- Para IA: modelo e custo decididos nesta sessão (`MARKETING_AI_TEXT_MODEL=openai/gpt-4o-mini`, `MARKETING_AI_ESTIMATED_COST_USD=0.02`), mas ver `docs/estudo-llms-agentes-atol.md` — o estudo comparativo feito depois dessa decisão recomenda trocar para `openai/gpt-5.6-luna` (preço quase igual, muito mais novo e melhor ranqueado em Marketing no OpenRouter); ainda não há confirmação de qual dos dois usar. O estudo também cobre os agentes de classificação de comentários, correlação/hipóteses e geração de imagem, todos ainda não implementados.
- **Secret do OpenRouter:** configurado — o responsável rodou `supabase login`, `supabase link --project-ref uakwbtmbhwifiekwmsbq` e `supabase secrets set OPENROUTER_API_KEY=... MARKETING_AI_TEXT_MODEL=openai/gpt-4o-mini MARKETING_AI_ESTIMATED_COST_USD=0.02` no próprio terminal. Correção a uma nota anterior deste documento: o ambiente do Claude Code **consegue** rodar `npx supabase` autenticado nesta máquina (a sessão de login do CLI é compartilhada, não é por-terminal) — foi assim que os deploys acima foram feitos diretamente por aqui. `.supabase-token` (arquivo deste repo) continua não lido, e não foi necessário para nada disso.
- **Cuidado com troca de conta no `supabase login`:** nesta sessão a sessão do CLI trocou de conta no meio do trabalho (alguém rodou `supabase login` de novo com uma conta Google diferente) e passou a enxergar apenas dois projetos completamente errados — nenhum era o Sorteio, e um deles era o próprio ref antigo proibido (`ltrhsljnzuxoqyoodbfu`). Sintoma: `supabase functions list`/`deploy` que funcionavam minutos antes passam a devolver 403 "does not have the necessary privileges". Diagnóstico rápido: `supabase projects list -o json` e conferir se `uakwbtmbhwifiekwmsbq` ("Sorteio") aparece com `"linked": true`. Se não aparecer, é preciso `supabase logout` + `supabase login` de novo escolhendo a conta certa antes de repetir qualquer comando.
- Único portão que falta para a geração de IA funcionar: **orçamento do workspace**. `marketing_ai_budget` começa zerado; um administrador precisa definir limite mensal e por execução em `/marketing/briefings/:id/estrategia` (seção "Salvar limites" em `EstrategiaConteudo.tsx`) — isso é uma ação dentro do app, não uma migração ou secret, e ninguém fez isso ainda.
- "Modelo de imagem", citado como pendência em versões anteriores deste documento, ainda não tem nenhum código que o consuma — não é bloqueio atual.
- A rotação da senha que existiu no histórico Git continua deliberadamente adiada por decisão do responsável.

## Agente analista de Instagram — próxima implementação

O documento `docs/agente-analista-instagram-atol.md` é a referência. Implementar por etapas e sempre sem publicação automática:

1. importar métricas e metadados próprios;
2. importar comentários e classificar localmente; não responder automaticamente;
3. incluir marcações, menções e Stories somente se as permissões e limites atuais da API permitirem;
4. correlacionar métricas com `marketing_context_note` sem alegar causalidade;
5. gerar hipóteses revisáveis para briefs, com custos e aprovação humana.

**Stories via Login do Instagram — investigado e descartado em definitivo (2026-09-15):** para o item 3 acima, a resposta é não. Revalidação ao vivo da documentação oficial da Meta confirmou que não existe via alternativa via Login do Instagram (`graph.instagram.com`) para ler Stories: `GET /{ig-user-id}/stories` (listagem) exige Login do Facebook; `GET /{ig-user-id}/media` (o endpoint que este projeto já usa) declara explicitamente que Stories não aparecem nessa listagem, em nenhum login; e o único campo de webhook relacionado (`story_insights`) é marcado indisponível para Login do Instagram. O único achado novo — `GET /{ig-media-id}/insights` aceita Login do Instagram e tem métricas de STORY — só serviria se este projeto passasse a publicar a própria story pela API (mudança de escopo, contraria a política de nunca publicar automaticamente; não construir sem decisão explícita). Detalhe completo, com fontes e datas, em `spec-kits/atol-analise-instagram-avancada.spec-kit.md` (Seção 4 e CAP-15).

## Regras de segurança

- Não usar o Supabase antigo.
- Não ler ou exibir `.env`, `.supabase-token`, `.cron-secret`, `CREDENCIAIS-LOCAL.txt` ou outros arquivos sensíveis.
- Nunca colocar chave de IA em `VITE_*`, frontend ou Git.
- Usar migrations novas e transacionais; nunca editar migrations já aplicadas.
- Não publicar no Instagram sem pedido explícito e aprovação humana.
