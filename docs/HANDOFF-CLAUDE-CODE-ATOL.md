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

### Banco remoto confirmado

As migrações abaixo estão aplicadas no Supabase Sorteio:

- `0013_marketing_foundation`
- `0014_security_and_idempotency`
- `0015_ai_strategy_and_versions`
- `0016_ai_strategy_indexes`
- `0017_content_approval_workflow`
- `0018_marketing_instagram_readonly`
- `0019_marketing_context_notes`

O arquivo local `supabase/migrations/0019_marketing_context_notes.sql` foi validado contra o banco e versionado nesta sessão — não precisa ser reaplicado.

**Ainda não aplicada remotamente:** `0020_google_only_atol_auth` (cria `hook_permitir_somente_google_atol`). Passou em `npm run test:database` localmente e foi versionada nesta sessão, mas a aplicação no Supabase remoto e a ativação manual como **Before User Created Hook** continuam pendentes — decisão de aplicar ficou para depois.

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

Continua valendo: não aplicar a 0020 no Supabase remoto nem publicar no Vercel sem confirmação explícita de quem está conduzindo.

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

Após a migração 0020 estar aplicada, no painel Supabase Auth:

1. habilitar Google e desabilitar Email, telefone e outros provedores;
2. inserir Client ID e Client Secret OAuth do Google;
3. selecionar `public.hook_permitir_somente_google_atol` como **Before User Created Hook**;
4. configurar a URL/redirect de produção para `https://app-one-fawn-32.vercel.app`.

Não tentar adivinhar, criar ou registrar credenciais OAuth.

**Atualização desta sessão:** o responsável compartilhou uma captura do painel Auth > Providers mostrando o passo 1/2 aparentemente já feito — "Enable Sign in with Google" ligado, Client ID e Client Secret já preenchidos, Callback URL apontando para o projeto correto (`uakwbtmbhwifiekwmsbq.supabase.co`). Claude Code não abriu o painel Supabase nem confirmou isso diretamente, e a captura não mostra se Email/telefone foram desabilitados (passo 1) nem se o hook (passo 3) e a URL de redirect de produção (passo 4) já foram configurados — confirmar os quatro passos antes de considerar o Google-only pronto para publicar. O Client ID/Secret vistos na captura não foram registrados em nenhum arquivo deste repositório.

### Instagram e IA

- Reconectar `@atol.ia.oficial` aceitando a permissão de leitura de métricas; o código pede `instagram_business_manage_insights` e não pede publicação.
- Publicar as Edge Functions locais `marketing-importar-metricas-instagram` e `marketing-gerar-conteudo` apenas após revisar o destino correto e configurar os segredos necessários.
- Para IA: modelo e custo decididos nesta sessão (`MARKETING_AI_TEXT_MODEL=openai/gpt-4o-mini`, `MARKETING_AI_ESTIMATED_COST_USD=0.02`), mas ver `docs/estudo-llms-agentes-atol.md` — o estudo comparativo feito depois dessa decisão recomenda trocar para `openai/gpt-5.6-luna` (preço quase igual, muito mais novo e melhor ranqueado em Marketing no OpenRouter); ainda não há confirmação de qual dos dois usar. O estudo também cobre os agentes de classificação de comentários, correlação/hipóteses e geração de imagem, todos ainda não implementados. A chave OpenRouter foi fornecida pelo responsável nesta sessão, mas **ainda não foi configurada como secret no Supabase** — o ambiente do Claude Code não tem `supabase` CLI nem acesso a `.supabase-token`, então é preciso rodar manualmente (projeto `uakwbtmbhwifiekwmsbq`):
  ```
  supabase secrets set OPENROUTER_API_KEY=... MARKETING_AI_TEXT_MODEL=openai/gpt-4o-mini MARKETING_AI_ESTIMATED_COST_USD=0.02
  ```
  Sem isso a geração continua bloqueada (a function exige as três variáveis juntas, por design).
- "Modelo de imagem", citado como pendência em versões anteriores deste documento, ainda não tem nenhum código que o consuma — não é bloqueio atual.
- Definir no aplicativo os limites mensal e por execução antes de qualquer chamada de IA (o limite mensal fica em `marketing_ai_budget`, separado do teto por execução acima).
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
