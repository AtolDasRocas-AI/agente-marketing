# Handoff — ATOL Studio para Claude Code

Atualizado em 15/09/2026. Este documento separa fatos confirmados de alterações locais ainda não validadas. Não exponha, copie ou versione arquivos de segredo.

## Objetivo do produto

Evoluir este repositório em uma ferramenta externa de marketing e inteligência de produto da ATOL, coexistindo com Sorteios no projeto Supabase **Sorteio**. O módulo de Marketing usa tabelas `marketing_*`, RLS por workspace, auditoria e não publica conteúdo automaticamente.

## Estado confirmado

### Ambiente e publicação

- Aplicação publicada em produção: `https://app-one-fawn-32.vercel.app`.
- Último deploy Vercel confirmado: `dpl_Fa6dJQ22ovaCPxraRJaPxNKXe9En`.
- Projeto Vercel: equipe `atol-ai-s-projects`, projeto `app`.
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
  - **atenção ao sequenciamento:** publicar este código no Vercel antes de configurar o provedor Google no painel Supabase Auth deixa a produção sem nenhum método de login funcional (a senha foi removida e o Google ainda não está habilitado).
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

1. Verificar o estado da árvore com `git status --short`; preservar o arquivo não rastreado do usuário `Apresentacao_Agente_Marketing_ATOL.html`.
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

Migração 0020 já aplicada (função existe no banco). Checklist original de 4 passos no painel Supabase Auth:

1. habilitar Google e desabilitar Email, telefone e outros provedores — **ainda não feito**: `supabase config pull` (nesta sessão) mostrou `auth.email.enable_confirmations = true` e `auth.sms.twilio.enabled = true` remotamente, ou seja, Email e SMS/Twilio continuam habilitados;
2. ~~inserir Client ID e Client Secret OAuth do Google~~ — **feito**, confirmado tanto pelo screenshot do responsável quanto pelo `config pull` (`auth.external.google.enabled = true`, client_id bate com o da captura);
3. ~~selecionar `public.hook_permitir_somente_google_atol` como **Before User Created Hook**~~ — **feito nesta sessão**, ver abaixo;
4. configurar a URL/redirect de produção para `https://app-one-fawn-32.vercel.app` — **ainda não feito**: `config pull` mostrou `auth.site_url = http://localhost:3000` e `auth.additional_redirect_urls = []` remotamente.

Não tentar adivinhar, criar ou registrar credenciais OAuth.

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
- `marketing-importar-metricas-instagram` e `marketing-gerar-conteudo` **já estão publicadas** no projeto `uakwbtmbhwifiekwmsbq` (deploy feito nesta sessão via `supabase functions deploy`, confirmadas como `v1 ACTIVE` em `supabase functions list`). A do Instagram continua inerte na prática — sem conta vinculada ao workspace, qualquer chamada retorna `CONTA_NAO_VINCULADA`.
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

## Regras de segurança

- Não usar o Supabase antigo.
- Não ler ou exibir `.env`, `.supabase-token`, `.cron-secret`, `CREDENCIAIS-LOCAL.txt` ou outros arquivos sensíveis.
- Nunca colocar chave de IA em `VITE_*`, frontend ou Git.
- Usar migrations novas e transacionais; nunca editar migrations já aplicadas.
- Não publicar no Instagram sem pedido explícito e aprovação humana.
