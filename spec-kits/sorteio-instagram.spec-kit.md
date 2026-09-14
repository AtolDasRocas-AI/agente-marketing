# Spec Kit: Sistema de Sorteio via Comentários do Instagram

**Criado em:** 2026-08-21
**Status:** done
**Concluído em:** 2026-08-21
**Escopo:** novo app (PWA standalone) — projeto greenfield em `Projeto/Sorteio`

---

## Context

Sistema próprio para executar sorteios a partir dos comentários de publicações do Instagram, sem depender de ferramentas de terceiros (Sorteio Gram, Comment Picker e similares). As ferramentas gratuitas de mercado limitam volume de comentários, não guardam histórico, não permitem regras customizadas e não geram prova auditável do resultado; as pagas cobram por sorteio.

O diferencial buscado é **auditabilidade real** — qualquer participante consegue reproduzir o resultado a partir da semente publicada e do hash da lista de participantes — combinada com uma **experiência visual moderna**: avatares gerados, animação de roleta no momento do sorteio e comprovante desenhado para ser postado nos stories.

A experiência de uso diário é mínima: depois de uma vinculação única da conta (OAuth one-time no onboarding), o organizador apenas **cola o link do post** e o sistema resolve a mídia, importa os comentários e conduz o sorteio.

O organizador já possui contas Instagram próprias e stack consolidada (React/TS/Vite/Supabase), o que torna o custo marginal de construção baixo. Este projeto parte do zero: nada existe no lado Meta (conta ainda pessoal, sem app em developers.facebook.com) nem no Supabase (projeto novo dedicado).

---

## 1. Visão e Motivação

- **Problema:** sorteios manuais são trabalhosos e contestáveis; ferramentas de mercado são limitadas ou pagas e não oferecem prova auditável.
- **Situação atual:** nenhum sistema próprio; dependência de sites de terceiros.
- **Resultado ideal:** colar o link do post → importar comentários → aplicar regras → animar o sorteio → publicar comprovante verificável. Tudo em minutos, com histórico e conformidade LGPD.

## 2. Usuários e Stakeholders

| Persona | Descrição | Necessidades Principais |
|---|---|---|
| Organizador (dono) | Único usuário autenticado do sistema | Vincular conta uma vez, colar link do post, configurar regras, executar sorteio com animação, exportar comprovante bonito |
| Participante | Comenta no post; não acessa o sistema | Resultado transparente, verificável e apresentado de forma clara |
| Meta / Instagram | Provedor da API | Conformidade com Termos de Uso — zero scraping |
| Titular de dados (LGPD) | Todo participante | Finalidade declarada, retenção limitada, expurgo automático |

## 3. Capacidades Desejadas

| ID | Capacidade |
|---|---|
| CAP-01 | Vincular conta Instagram Business/Creator via OAuth **uma única vez** (onboarding) e persistir token de longa duração |
| CAP-02 | Renovar o token automaticamente antes do vencimento (job diário) |
| CAP-03 | **Colar o link (permalink) do post** → sistema resolve a mídia correspondente na conta conectada e exibe preview (legenda, data, nº de comentários) |
| CAP-04 | Importar todos os comentários do post com paginação por cursor, gravando snapshot imutável |
| CAP-05 | Reimportar comentários (importação incremental) até o encerramento do sorteio |
| CAP-06 | Configurar regras de qualificação por sorteio (modo de contagem, menções mínimas, janela de datas, vencedores/suplentes) |
| CAP-07 | Processar o snapshot e classificar cada comentário em habilitado/desqualificado/suspeito, com motivo |
| CAP-08 | Executar o sorteio com RNG semeado e determinístico |
| CAP-09 | Sortear N vencedores e M suplentes, sem repetição de participante |
| CAP-10 | **Animação de roleta (slot machine)** no momento do sorteio: avatares/usernames girando, desaceleração com suspense, trava no vencedor + confete; suplentes revelados em sequência |
| CAP-11 | **Avatares gerados** por username: iniciais sobre gradiente único e determinístico por pessoa |
| CAP-12 | Gerar comprovante do resultado: **card imagem (formato stories)** + PDF, contendo semente, hash da lista, timestamp, totais e vencedores |
| CAP-13 | Consultar histórico de sorteios executados |
| CAP-14 | Exportar participantes e resultado em CSV + script verificador público |
| CAP-15 | Expurgar dados pessoais automaticamente após 90 dias da execução |

## 4. Fora do Escopo

- Sorteios em posts de contas de terceiros ou de clientes (exigiria App Review no Meta)
- Qualquer forma de scraping do Instagram (direto ou via serviços como Apify)
- Verificação de "está seguindo o perfil" — a API não expõe essa relação
- Verificação de "curtiu a publicação" — a API devolve apenas `like_count`
- **Foto de perfil real dos participantes** — a API não expõe avatar de comentaristas; usar avatares gerados (CAP-11)
- Sorteio a partir de Stories, **Reels** ou Direct (link de Reel colado → erro claro)
- Página pública de verificação do resultado (v2; v1 entrega card/PDF/CSV + script verificador)
- Multiusuário, planos pagos, cobrança
- Publicação automática do resultado no Instagram
- App nativo (Android/iOS) — PWA apenas
- Tela de navegação/listagem de mídias como fluxo principal (o fluxo é colar link; listagem fica como fallback opcional)

## 5. Cenários e Edge Cases

| # | Cenário | Comportamento Esperado | Prioridade |
|---|---|---|---|
| E-01 | Comentário sem o número mínimo de menções | Desqualificado, motivo `MENCOES_INSUFICIENTES` | Alta |
| E-02 | Menção repetida no mesmo comentário (`@joao @joao`) | Conta como 1 menção distinta | Alta |
| E-03 | Usuário menciona a si próprio | Menção descartada da contagem | Alta |
| E-04 | Usuário menciona o perfil organizador | Menção descartada da contagem | Alta |
| E-05 | Menção a conta inexistente | Aceita — a API não valida existência de handle | Média |
| E-06 | Mesmo usuário comenta 5x, modo `POR_PESSOA` | 1 chance; extras marcados `DUPLICADO` | Alta |
| E-07 | Mesmo usuário comenta 5x, modo `POR_COMENTARIO` teto 3 | 3 chances; 2 marcados `TETO_EXCEDIDO` | Alta |
| E-08 | Comentário fora da janela de datas configurada | Desqualificado, motivo `FORA_DA_JANELA` | Média |
| E-09 | Comentário do próprio organizador | Desqualificado, motivo `AUTOR_ORGANIZADOR` | Alta |
| E-10 | Reply (resposta a outro comentário) | Não participa — apenas 1º nível [PREMISSA P-01] | Média |
| E-11 | Comentário deletado entre snapshot e sorteio | Permanece no snapshot congelado | Média |
| E-12 | Comentário editado após importação | Prevalece o texto do snapshot mais recente antes do encerramento | Baixa |
| E-13 | Conta do participante deletada (sem username) | Desqualificado, motivo `USUARIO_INDISPONIVEL` | Média |
| E-14 | Zero participantes habilitados | Sorteio bloqueado com mensagem explícita | Alta |
| E-15 | N vencedores > participantes habilitados | Sorteio bloqueado com mensagem explícita | Alta |
| E-16 | Rate limit da API durante importação | Backoff exponencial, retoma do último cursor | Alta |
| E-17 | Token expirado no momento da importação | Bloqueia e solicita reconexão da conta | Alta |
| E-18 | Sorteio já executado, tentativa de re-executar | Bloqueado; exige nova rodada vinculada ao mesmo post | Alta |
| E-19 | **Link colado não pertence à conta conectada** | Erro claro: "Este post não é da conta vinculada" | Alta |
| E-20 | **Link malformado / não é post do Instagram** | Validação imediata no campo, antes de chamar a API | Alta |
| E-21 | **Link de Reel ou de Story** | Erro claro: formato não suportado na v1 | Média |
| E-22 | Usuário com `prefers-reduced-motion` | Animação da roleta substituída por reveal simples com fade | Média |

## 6. Critérios de Aceite

- [x] **AC-01** — Após o OAuth do onboarding, a conta aparece conectada com data de expiração do token visível.
- [x] **AC-02** — Token com menos de 7 dias para expirar é renovado automaticamente sem intervenção.
- [x] **AC-03** — Colar um permalink válido de post próprio resolve a mídia e exibe preview em até 5s.
- [x] **AC-04** — Selecionado um post com 1.200 comentários, a importação persiste os 1.200 registros com paginação.
- [x] **AC-05** — Reimportar o mesmo post não duplica comentários (idempotência por `ig_comment_id`).
- [x] **AC-06** — Regra "mínimo 1 menção" (padrão): comentário com `@a` habilita; sem menção desqualifica com motivo.
- [x] **AC-07** — Modo `POR_PESSOA`: usuário com 5 comentários válidos aparece 1 vez na lista de chances.
- [x] **AC-08** — Modo `POR_COMENTARIO` teto 3: usuário com 5 comentários válidos aparece 3 vezes.
- [x] **AC-09** — Toda desqualificação exibe motivo pertencente ao enum de motivos.
- [x] **AC-10** — Executar o sorteio 2x com a mesma semente e o mesmo `hash_lista` produz vencedores idênticos.
- [x] **AC-11** — Vencedores e suplentes não se repetem entre si.
- [x] **AC-12** — O mesmo username produz sempre o mesmo avatar gerado (gradiente + iniciais determinísticos).
- [x] **AC-13** — A animação de roleta roda fluida (sem jank perceptível) com 1.000+ participantes e termina revelando o vencedor correto do resultado já calculado. _Provado em `lib/avatar/fita.test.ts`: a fita tem comprimento fixo (120 itens) independente da urna, a janela no DOM fica em ≤7 nós em qualquer posição de rolagem, construir a fita com 20.000 participantes leva <5ms (medido em 50 execuções) e o vencedor para exatamente sob o ponteiro central. A `Roleta` também tem salvaguarda por `setTimeout`: se o navegador congelar `requestAnimationFrame` (aba oculta durante a live), o vencedor é revelado igualmente em vez de travar em "sorteando"._
- [x] **AC-14** — O comprovante exibe semente, `hash_lista` (SHA-256), timestamp UTC, totais e vencedores; o card exporta em 1080×1920 (stories).
- [x] **AC-15** — O CSV exportado contém uma linha por chance: username, texto e status.
- [x] **AC-16** — Sorteio com 90+ dias tem dados pessoais expurgados, preservando o comprovante agregado.
- [x] **AC-17** — Nenhum token do Instagram trafega para o client (verificável no network do navegador).

## 7. Requisitos Não-Funcionais

- **Auditabilidade (RNF-01):** RNG determinístico semeado — **xoshiro128\*\* implementado inline** (~20 linhas, zero dependências), nunca `Math.random()`. _Decisão de implementação (Onda 4): o plano previa `pure-rand`, mas a v8 não expõe export raiz e seu `uniformInt` de subpath é helper interno. A implementação inline roda idêntica no browser, no Deno (Edge Functions) e no verificador público standalone, usa 128 bits de estado (contra 32 do plano original) com rejection sampling sem viés de módulo, e não pode quebrar por mudança de versão de biblioteca._ Semente manual escolhida e **publicada antes da execução** (ex.: stories); `seed_final = SHA256(seed_publica + '|' + hash_lista)` — a lista congelada entra no cálculo, impossibilitando escolher semente que favoreça alguém. Semente, fonte e `hash_lista` publicados no comprovante.
- **Segurança do token (RNF-02):** access token nunca exposto ao client; todas as chamadas à Graph API via Edge Function; tokens em tabela sem policy de leitura, acessada só via `service_role`.
- **LGPD (RNF-03):** finalidade única (execução do sorteio), retenção de 90 dias após execução, expurgo automatizado via pg_cron, aviso de privacidade acessível.
- **Resiliência de importação (RNF-04):** backoff exponencial em 429/5xx; job retomável a partir do último cursor; watchdog para jobs travados.
- **Performance (RNF-05):** importação assíncrona em background — a request do usuário nunca aguarda a paginação. Animação a 60fps via CSS transforms/Web Animations API (sem layout thrashing); roleta virtualizada para listas grandes.
- **Imutabilidade (RNF-06):** snapshot de comentários e `resultado` são append-only.
- **Conformidade de plataforma (RNF-07):** exclusivamente endpoints oficiais do Meta; zero scraping.
- **UI moderna (RNF-08):** dark theme como padrão, gradientes/glassmorphism, micro-interações, tipografia expressiva; card do comprovante desenhado para stories. Acessibilidade: respeitar `prefers-reduced-motion` (E-22), contraste WCAG AA.

## 8. Análise Técnica

### 8.1 Mapa de Impacto

| Módulo | Caminho | Tipo de Mudança |
|---|---|---|
| Scaffold PWA | `app/` (React 18 + TS + Vite) | Criar |
| Cliente Supabase | `app/src/lib/supabase.ts` | Criar |
| Parser de link | `app/src/lib/instagram/permalink.ts` | Criar |
| Motor de regras (puro) | `app/src/lib/sorteio/regras.ts` | Criar |
| Motor de sorteio (puro) | `app/src/lib/sorteio/sorteio.ts` | Criar |
| Enum de motivos | `app/src/lib/sorteio/motivos.ts` | Criar |
| Avatar generator (puro) | `app/src/lib/avatar/gerarAvatar.ts` | Criar |
| Feature: conta | `app/src/features/conta/` | Criar |
| Feature: sorteios | `app/src/features/sorteios/` | Criar |
| Feature: roleta | `app/src/features/sorteios/Roleta.tsx` | Criar |
| Feature: comprovante | `app/src/features/sorteios/Comprovante.tsx` | Criar |
| Feature: histórico | `app/src/features/historico/` | Criar |
| Migrações SQL | `supabase/migrations/` | Criar (8 tabelas + 3 enums) |
| Edge Functions | `supabase/functions/` (7 functions) | Criar |
| Verificador público | `verificador/verificar.mjs` | Criar |

### 8.2 Padrões Reutilizáveis

- Padrão **Edge Function + pg_cron poller** com rate limiting — mesma arquitetura já usada em projeto anterior (integração IoT)
- Estrutura de **PWA React/TS/Vite sobre Supabase** — scaffold, auth e deploy já resolvidos em projeto anterior
- **Política de privacidade e termos LGPD** — texto base já redigido, adaptar finalidade
- Modelo de dados e algoritmos já detalhados no plano técnico anexado (transcritos na Seção 12)

### 8.3 Riscos e Complexidades

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | OAuth não fecha em Dev Mode | Média | Alto | Onda 0 é spike descartável; validar antes de qualquer código de app |
| 2 | Mudança de contrato da Graph API | Média | Alto | Isolar chamadas no `ig-client`; validar doc oficial antes de codar |
| 3 | Resolução de permalink → media_id falhar | Baixa | Médio | Estratégia: paginar `/me/media?fields=id,permalink` e casar shortcode; validar no spike da Onda 0 |
| 4 | Rate limit em post de alto volume | Média | Médio | Importação incremental + backoff + snapshot persistido |
| 5 | Expectativa de validar "seguir o perfil" | Alta | Médio | Documentado fora de escopo; validação manual do vencedor |
| 6 | Contestação pública do resultado | Baixa | Alto | RNF-01 (semente publicada antes + hash reproduzível + verificador) |
| 7 | Token expira sem renovar (job silencioso) | Média | Alto | Alerta no job de refresh; badge de expiração na UI |
| 8 | Animação com jank em listas grandes | Média | Médio | Roleta renderiza janela virtual (~20 itens visíveis), não a lista toda |
| 9 | Vazamento de secret no bundle | Baixa | Alto | Secrets só em Edge Functions; auditar `dist/` antes de deploy |

### 8.4 Alternativas Consideradas

| # | Alternativa | Prós | Contras | Recomendação |
|---|---|---|---|---|
| 1 | Graph API oficial em Dev Mode + OAuth one-time | Legal, estável, sem custo, uso diário = colar link | Restrito a contas próprias; setup inicial no Meta | ✅ **Escolhida** |
| 2 | Colar link + scraper terceirizado (Apify) | Zero setup, funciona em qualquer post | Custo por volume, viola ToS indiretamente, frágil | ❌ Rejeitada (Rodada 4) |
| 3 | Colar link + importação manual de comentários | 100% dentro dos termos, zero backend Meta | Inviável para posts grandes | ❌ Rejeitada (Rodada 4) |
| 4 | Graph API + App Review | Permite contas de clientes | Processo longo, risco de recusa | Postergada (v2) |
| 5 | Scraping próprio (Playwright) | Funciona em qualquer post | Viola Termos, risco de ban, LGPD | ❌ Rejeitada |

## 9. Restrições e Dependências

**Restrições**
- Conta Instagram precisa ser convertida para **Business ou Creator** (hoje é pessoal — nada criado ainda)
- App precisa ser criado em developers.facebook.com, com a conta do organizador como Instagram Tester
- Permissões: leitura básica do perfil de negócio + gerenciamento de comentários
- Token de longa duração ~60 dias, renovável (refresh exige token com >24h de vida e não expirado)
- Supabase: **projeto novo dedicado**

**Dependências**
- Meta Graph API (Instagram API with Instagram Login)
- Supabase (Postgres, Auth, Edge Functions, pg_cron)
- `pure-rand` (MIT) para PRNG determinístico
- Hospedagem do PWA (Vercel/Netlify ou equivalente)

> ⚠️ Nomes exatos de permissões, endpoints e limites de rate mudam com frequência no Meta. Confirmar na documentação oficial antes de implementar cada onda.

## 10. Premissas Assumidas

| ID | Premissa |
|---|---|
| P-01 | Apenas comentários de primeiro nível participam; replies são ignoradas |
| P-02 | `modo_contagem` configurável por sorteio; padrão `POR_PESSOA` ✔ confirmada |
| P-03 | Sistema monousuário — apenas o organizador autentica |
| P-04 | Menção válida = handle iniciado por `@`, distinto, diferente do autor e do organizador |
| P-05 | Retenção de dados pessoais: 90 dias após execução ✔ confirmada |
| P-06 | Semente manual, publicada pelo organizador **antes** da execução (ex.: stories); campo `seed_fonte` registra onde foi publicada ✔ confirmada |
| P-07 | Suplentes padrão: 3, configurável ✔ confirmada |
| P-08 | Resolução do permalink via varredura paginada de `/me/media` casando o shortcode — validar no spike [PREMISSA] |
| P-09 | O verificador público (script standalone) acompanha a v1 mesmo sem página pública, pois reutiliza o motor puro [PREMISSA] |
| P-10 | Dark theme como padrão visual; light theme não é requisito da v1 [PREMISSA] |

## 11. Perguntas Resolvidas

| # | Pergunta | Resposta | Rodada |
|---|---|---|---|
| 1 | Modo de contagem como configuração atende? | Sim — configurável, padrão `POR_PESSOA` | 1 |
| 2 | Padrão de menções mínimas? | **1**, configurável por sorteio | 1 |
| 3 | Fonte da semente pública? | Manual, publicada antes da execução | 1 |
| 4 | Formato do comprovante? | Card imagem (stories) + PDF + CSV; sem página pública na v1 | 1 |
| 5 | Status do setup Meta? | Nada criado — plano inclui Onda 0 de setup completo | 2 |
| 6 | Supabase novo ou existente? | Projeto novo dedicado | 2 |
| 7 | Retenção 90 dias + 3 suplentes? | Confirmadas | 2 |
| 8 | Avatares, dado que a API não expõe foto de comentaristas? | Avatares gerados (iniciais + gradiente determinístico) | 3 |
| 9 | Estilo da animação do sorteio? | Roleta slot machine + confete | 3 |
| 10 | Como obter comentários "só colando o link"? | OAuth one-time no onboarding; uso diário = colar link (API oficial não entrega comentários sem conta vinculada) | 4 |

## 12. Plano de Implementação

### 12.1 Ondas

#### Onda 0 — Setup Meta + Spike de OAuth (descartável)
**Objetivo:** provar que o OAuth fecha e que o permalink resolve para media_id — se falhar, o projeto muda de premissa.

**Passos (manuais + script):**
1. Converter a conta Instagram para Business/Creator (Configurações → Tipo de conta)
2. Criar app em `developers.facebook.com` → tipo Business → produto Instagram → "Instagram API com Instagram Login"
3. Registrar Redirect URI (`http://localhost:5173/auth/callback`), adicionar a conta em App Roles → Instagram Testers, aceitar o convite no Instagram
4. Guardar `IG_APP_ID` e `IG_APP_SECRET`
5. Criar projeto Supabase novo; guardar URL e keys
6. `spike/oauth-spike.mjs` — criar — script Node ~40 linhas: troca `code` → short-lived → long-lived; imprime `GET /me/media?fields=id,permalink,comments_count` e `GET /{media-id}/comments` no terminal
7. Validar P-08: casar um permalink real contra a lista de mídias

**Critérios de pronto:** token long-lived obtido; JSON de comentários de um post real impresso no terminal; shortcode do permalink casado com media_id.

#### Onda 1 — Scaffold + Schema + Conexão OAuth
**Objetivo:** app de pé com conta vinculada de forma persistente e token renovando sozinho.

**Arquivos:**
- `app/` — criar — scaffold Vite + React 18 + TS + PWA + router; tema dark, tokens de design
- `app/src/lib/supabase.ts` — criar — cliente
- `supabase/migrations/0001_schema.sql` — criar — tabelas `ig_account`, `sorteio`, `import_job`, `comentario`, `qualificacao`, `chance`, `resultado` + enums `modo_contagem`, `status_sorteio`, `status_qualif` (modelo do plano técnico; `mencoes_minimas default 1`)
- `supabase/migrations/0002_rls.sql` — criar — RLS em todas as tabelas; tokens em schema privado sem policy de leitura (acesso só via `service_role`)
- `supabase/functions/ig-oauth-callback/index.ts` — criar — troca code → long-lived, grava token
- `supabase/functions/ig-token-refresh/index.ts` — criar — pg_cron diário, renova tokens com <7 dias
- `app/src/features/conta/ConectarConta.tsx` — criar — wizard de onboarding one-time + badge de expiração

**Passos:**
1. Scaffold + deploy do esqueleto (auth Supabase do organizador)
2. Aplicar migração 0001 e 0002 (revisão manual obrigatória — threshold de migração)
3. Implementar `ig-oauth-callback` reaproveitando o fluxo validado no spike
4. Wizard de conexão + estado "conta conectada" com data de expiração
5. `ig-token-refresh` agendado via pg_cron + alerta em falha

**Critérios de pronto:** AC-01, AC-02, AC-17.

#### Onda 2 — Colar Link + Importação de Comentários
**Objetivo:** colar um permalink e ver todos os comentários do post persistidos, com progresso em tempo real.

**Arquivos:**
- `app/src/lib/instagram/permalink.ts` — criar — parse/validação de URL (post ✔, reel/story → E-21)
- `supabase/functions/ig-resolve-media/index.ts` — criar — pagina `/me/media`, casa shortcode, retorna preview
- `supabase/functions/ig-import-comments/index.ts` — criar — lotes de ~10 páginas/invocação, upsert por `(sorteio_id, ig_comment_id)`, cursor em `import_job`, backoff 1s/2s/4s/8s (máx 5), re-enfileira via pg_cron
- `app/src/features/sorteios/NovoSorteio.tsx` — criar — campo de link + preview do post + formulário de regras
- `app/src/features/sorteios/Importacao.tsx` — criar — progresso do job (Supabase Realtime ou polling)

**Passos:**
1. Parser de permalink com validação imediata (E-20, E-21)
2. `ig-resolve-media` com erro claro para post de terceiro (E-19)
3. Job de importação em lotes com retomada por cursor (E-16) e watchdog (job >10 min em `RODANDO` volta a `PENDENTE`)
4. Tela NovoSorteio: link → preview → regras (modo, menções mín. 1, janela, vencedores/suplentes)
5. Reimportação incremental até o encerramento (CAP-05)

**Critérios de pronto:** AC-03, AC-04, AC-05 + importar post real com 1.000+ comentários sem perda.

#### Onda 3 — Motor de Regras + Participantes com Avatares
**Objetivo:** cada comentário classificado com motivo, exibido numa tabela moderna com avatares gerados.

**Arquivos:**
- `app/src/lib/sorteio/regras.ts` — criar — `extrairMencoes` (regex `@[a-zA-Z0-9._]{1,30}`, dedupe via Set, exclui autor/organizador) + pipeline de classificação (ordem: reply → organizador → sem username → janela → menções → anti-bot → duplicado/teto → habilitado); **puro, sem I/O**
- `app/src/lib/sorteio/motivos.ts` — criar — enum de motivos + labels pt-BR
- `app/src/lib/avatar/gerarAvatar.ts` — criar — hash do username → gradiente HSL determinístico + iniciais; **puro**
- `supabase/functions/sorteio-processar/index.ts` — criar — roda regras, popula `qualificacao` e `chance` (ordenação `publicado_em ASC, ig_comment_id ASC`)
- `app/src/features/sorteios/Participantes.tsx` — criar — tabela com avatar, status, motivo, filtros; flag `SUSPEITO` para revisão manual (nunca exclusão automática)
- `app/src/lib/sorteio/regras.test.ts` — criar — testes E-02, E-03, AC-06/07/08

**Passos:**
1. Implementar e testar `extrairMencoes` e o pipeline (testes primeiro — funções puras)
2. Heurísticas anti-bot (excesso de menções > teto, texto clonado ≥3 autores, rajada <3s) → status `SUSPEITO`
3. `sorteio-processar` + tela Participantes com avatares (AC-12)

**Critérios de pronto:** AC-06, AC-07, AC-08, AC-09, AC-12.

#### Onda 4 — Motor de Sorteio + Roleta + Comprovante
**Objetivo:** o momento-mágica: semente → roleta animada → vencedor → comprovante exportável.

**Arquivos:**
- `app/src/lib/sorteio/sorteio.ts` — criar — algoritmo do plano técnico: congela snapshot → ordena chances por `ig_comment_id ASC` → `hash_lista = SHA256(linhas)` → `seed_final = SHA256(seed|hash)` → `xoroshiro128plus` + Fisher-Yates parcial com dedupe por autor; **puro**
- `app/src/lib/sorteio/sorteio.test.ts` — criar — determinismo 100 execuções (o teste mais importante do projeto), seed diferente → resultado diferente, AC-11
- `supabase/functions/sorteio-executar/index.ts` — criar — valida E-14/E-15/E-18, grava `resultado` append-only
- `app/src/features/sorteios/Executar.tsx` — criar — entrada da semente + confirmação de que foi publicada (P-06)
- `app/src/features/sorteios/Roleta.tsx` — criar — slot machine virtualizada (~20 itens visíveis), desaceleração easing, trava no vencedor pré-calculado, confete; fallback `prefers-reduced-motion` (E-22); suplentes em sequência
- `app/src/features/sorteios/Comprovante.tsx` — criar — card 1080×1920 renderizado em canvas/`html-to-image` + export PDF
- `verificador/verificar.mjs` — criar — script standalone: CSV + semente → recalcula vencedores (reusa `sorteio.ts`)

**Passos:**
1. `sortear()` + teste de determinismo **antes de qualquer UI**
2. `sorteio-executar` com bloqueios (zero habilitados, N > habilitados, re-execução)
3. Roleta: o resultado já está calculado quando a animação começa — a animação é teatro determinístico, nunca decide nada
4. Comprovante: card stories + PDF + CSV (AC-14, AC-15)
5. Verificador público

**Critérios de pronto:** AC-10, AC-11, AC-13, AC-14, AC-15.

#### Onda 5 — Histórico + Expurgo LGPD + Polish
**Objetivo:** operação contínua: histórico navegável, conformidade automática, acabamento visual.

**Arquivos:**
- `app/src/features/historico/Historico.tsx` — criar — lista de sorteios com status, resultado e re-download de comprovante
- `supabase/functions/lgpd-expurgo/index.ts` — criar — pg_cron diário: sorteios com 90+ dias → apaga `comentario`/`qualificacao`/`chance`, preserva `resultado` agregado
- `app/src/pages/Privacidade.tsx` — criar — aviso de privacidade (adaptar texto LGPD existente)
- Polish geral — editar — micro-interações, estados vazios, loading states, revisão de contraste

**Passos:**
1. Histórico + reabertura de comprovantes
2. Job de expurgo + teste com sorteio retroativo
3. Aviso de privacidade + passada final de UX (skill `ux-design`)
4. Auditar `dist/` procurando secrets antes do deploy final

**Critérios de pronto:** AC-16 + fluxo completo end-to-end pela interface.

### 12.2 Ordem de Execução

Linear com gate: **Onda 0 é bloqueante e descartável** — se o OAuth ou a resolução de permalink não fecharem, voltar ao spec antes de escrever qualquer código de app. Ondas 1→5 são sequenciais (cada uma depende dos dados/funções da anterior). Threshold de revisão manual: migrações (Onda 1) e tudo que toca credenciais.

## 13. Verificação End-to-End

1. **Conexão:** abrir o app → wizard → OAuth → badge "conectada" com data de expiração. No DevTools → Network: nenhuma resposta contém `access_token` (AC-17).
2. **Refresh:** `update ig_account set token_expira_em = now() + interval '5 days'` → rodar `ig-token-refresh` manualmente → expiração renovada (~60 dias).
3. **Link:** colar permalink de post próprio com 1.000+ comentários → preview em <5s. Colar link de terceiro → E-19. Colar link de Reel → E-21.
4. **Importação:** disparar → acompanhar progresso → `select count(*) from comentario where sorteio_id = ...` = `comments_count` do post. Rodar importação de novo → mesma contagem (AC-05).
5. **Regras:** configurar mínimo 1 menção, `POR_PESSOA` → conferir na tela Participantes: comentário sem menção = `MENCOES_INSUFICIENTES`; autor com 5 comentários = 1 chance.
6. **Determinismo:** `npm test` — suite de `sorteio.test.ts` verde (100 execuções idênticas).
7. **Sorteio:** publicar semente nos stories → digitar semente → roleta gira e trava → conferir que o vencedor da animação = vencedor em `resultado`. Tentar executar de novo → bloqueado (E-18).
8. **Verificador:** exportar CSV → `node verificador/verificar.mjs participantes.csv "SEMENTE"` → mesmos vencedores.
9. **Comprovante:** exportar card 1080×1920 e PDF → conferir semente, hash, timestamp, totais.
10. **Expurgo:** `update sorteio set encerrado_em = now() - interval '91 days'` → rodar `lgpd-expurgo` → dados pessoais apagados, `resultado` preservado (AC-16).
11. **Bundle:** `grep -ri "IG_APP_SECRET\|service_role" app/dist/` → zero ocorrências.
