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

**Atenção:** o arquivo local `supabase/migrations/0019_marketing_context_notes.sql` ainda não foi versionado, embora a migração já esteja aplicada remotamente. Ao retomar, valide que o arquivo local corresponde ao banco e registre-o no Git sem tentar reaplicá-lo.

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

## Alterações locais pendentes — NÃO validadas, NÃO aplicadas e NÃO publicadas

Foram iniciadas, mas devem ser revisadas antes de prosseguir:

- `supabase/migrations/0020_google_only_atol_auth.sql`
  - cria `public.hook_permitir_somente_google_atol(jsonb)`;
  - permite criar usuários apenas via Google e apenas para `atoldasrocas.ai@gmail.com`;
  - ainda não foi aplicada remotamente;
  - a ativação como **Before User Created Hook** exige ação manual no painel Supabase Auth.
- `app/src/features/auth/AcessoAtol.tsx`, `app/src/features/auth/Login.tsx` e `app/src/main.tsx`
  - substituem login por senha por login Google e protegem as rotas da aplicação;
  - ainda precisam de lint, build, testes e revisão de rotas.
- `app/src/features/marketing/RelatorioSemanal.tsx`
  - ganhou o formulário de notas de contexto;
  - requer validação de UI e integração com a migração 0019.
- `supabase/migrations/0019_marketing_context_notes.sql`
  - arquivo local correspondente a uma migração já aplicada remotamente; falta apenas validação e versionamento, não reaplicação.
- `docs/agente-analista-instagram-atol.md`
  - especifica o agente analista em modo observação: postagens, Reels, carrosséis, comentários, marcações/menções, Stories quando a API permitir, métricas e correlação com notas.
- `docs/ativacao-google-only-atol.md`
  - roteiro de ativação do Google-only no Supabase Auth.

Não aplicar ou publicar esses arquivos sem passar a sequência de validação abaixo.

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

### Instagram e IA

- Reconectar `@atol.ia.oficial` aceitando a permissão de leitura de métricas; o código pede `instagram_business_manage_insights` e não pede publicação.
- Publicar as Edge Functions locais `marketing-importar-metricas-instagram` e `marketing-gerar-conteudo` apenas após revisar o destino correto e configurar os segredos necessários.
- Para IA: o responsável precisa configurar chave OpenRouter, modelo textual, modelo de imagem e custo estimado. Sem isso a geração deve continuar bloqueada.
- Definir no aplicativo os limites mensal e por execução antes de qualquer chamada de IA.
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
