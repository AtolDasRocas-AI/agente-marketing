# Spec Kit: Auditoria de Ações e Botões do Módulo Marketing

**Criado em:** 2026-09-15
**Status:** approved
**Escopo:** `app/src/features/marketing`, `app/src/lib`, `supabase/functions/marketing-*`, `supabase/migrations` (só via migração nova)

---

## Context

Ao testar o módulo Marketing pela primeira vez com dados e sessão reais (nesta mesma sessão, logo após a implementação das Sprints A–F), vários botões/ações que pareciam corretos no código se revelaram quebrados na prática: mensagens de erro genéricas do Supabase (`error.context` nunca lido), o link para a tela de Estratégia sumindo da Agenda fora de um status específico, a aprovação de conteúdo falhando desde a fundação (migração 0017) por falta de cast de enum, a capa dos posts nunca implementada no Marketing, `response_format` incompatível quebrando a geração de hipótese, e a auditoria de insight estourando um limite de tamanho já existente. Todos esses bugs ficaram invisíveis para `npm run check` porque os testes automatizados usavam dados triviais (`'{}'::jsonb`, sem checar o corpo de erro) em vez de volumes e fluxos realistas.

Isso indica um padrão, não incidentes isolados: partes do módulo nunca foram exercitadas de ponta a ponta por um usuário real antes de hoje. Este spec-kit organiza uma varredura sistemática pelo restante das ações do módulo — tanto por classes de bug já conhecidas (repetidas em outros arquivos) quanto por fluxos que ainda não foram clicados nem uma vez com dados reais.

---

## 1. Visão e Motivação

- **Problema:** ações que parecem prontas no código podem estar silenciosamente quebradas; o usuário só descobre ao usar, e a mensagem de erro nem sempre indica a causa real.
- **Situação atual:** 6 bugs reais já corrigidos hoje (ver Seção 11). Várias ações do módulo nunca foram clicadas com sessão e dados reais: criar/editar briefing, salvar orçamento pela UI, importar/classificar/reclassificar comentários, criar/arquivar nota de contexto, gerar imagem.
- **Resultado ideal:** toda ação clicável do módulo Marketing (a) faz algo observável ao ser clicada, (b) mostra sucesso ou erro específico — nunca "sem ação visual" —, e (c) foi de fato exercitada uma vez com dado real, não só revisada no código.

## 2. Usuários e Stakeholders

| Persona | Descrição | Necessidades Principais |
|---|---|---|
| Administrador do workspace | Quem está testando agora (você) | Clicar em qualquer botão e confiar que ele fez o que prometeu, ou ver por que não fez |
| Revisor de conteúdo | Papel `REVISOR` | Mesmas garantias, num subconjunto menor de ações (sem aprovar/orçamento) |
| Claude Code (este agente) | Executa a auditoria | Encontrar cada instância das mesmas classes de bug, não só a que foi reportada |

## 3. Capacidades Desejadas

| ID | Capacidade |
|---|---|
| CAP-01 | Varrer todas as migrações `marketing_*` por colunas enum atribuídas via `CASE`/expressão sem cast explícito (classe de bug da 0017/0028) |
| CAP-02 | Varrer todos os gatilhos de auditoria `after ... on marketing_*` por tabelas com coluna jsonb potencialmente grande sem gatilho dedicado (classe de bug da 0025/0029) |
| CAP-03 | Varrer todas as chamadas a modelos não-OpenAI por uso de `response_format` (classe de bug do insight/comentários) |
| CAP-04 | Confirmar que toda tela de Marketing usa `mensagemDeErroFuncao`/trata `error.context` em vez de `error.message` cru para chamadas a Edge Functions |
| CAP-05 | Testar de ponta a ponta, com dado real, cada ação ainda não exercitada: criar briefing, editar briefing, salvar orçamento pela UI, importar comentários, classificar comentários, reclassificar comentário manualmente, criar nota de contexto, arquivar nota, gerar imagem |
| CAP-06 | Corrigir cada bug encontrado com o mesmo padrão já validado hoje: migração nova (nunca editar uma aplicada), teste de regressão com dado realista, aplicação remota só após `npm run check` |

## 4. Fora do Escopo

- Módulo de Sorteios (fora deste módulo, exceto o `CapaPost` já compartilhado)
- Novas capacidades ou telas — isto é auditoria e correção, não sprint nova
- Reconexão do Instagram ou geração de imagem/comentários que dependam disso funcionar de ponta a ponta com a conta real — o que a API do Meta devolve, este agente não controla; o teste vai até onde os dados atuais permitirem
- Redesign visual — só corrigir o que estiver funcionalmente quebrado

## 5. Cenários e Edge Cases

| # | Cenário | Comportamento Esperado | Prioridade |
|---|---|---|---|
| E-01 | Criar briefing com título vazio | Botão desabilitado ou erro de validação claro, nunca uma chamada que falha silenciosamente | Alta |
| E-02 | Editar briefing com versão desatualizada (outra aba mudou primeiro) | Mensagem de conflito legível (já existe `CONFLITO` em `repositoryRemote.ts` — confirmar que aparece na tela) | Média |
| E-03 | Salvar orçamento com valor negativo ou não numérico | Rejeitado com mensagem clara antes ou depois da chamada | Média |
| E-04 | Importar comentários sem nenhuma publicação ainda importada | Mensagem clara de que não há posts para buscar comentários, não um erro genérico | Alta |
| E-05 | Classificar comentários sem nenhum pendente | Já tratado (`Nenhum comentário pendente de classificação`) — confirmar que aparece na tela, não só na resposta da function | Média |
| E-06 | Reclassificar manualmente um comentário | Categoria muda na tela imediatamente após a chamada | Média |
| E-07 | Criar nota de contexto com data futura ou texto vazio | Validação clara antes de gravar | Baixa |
| E-08 | Arquivar nota já arquivada (clique duplo) | Segunda tentativa não deve gerar erro visível ao usuário nem duplicar auditoria | Baixa |
| E-09 | Gerar imagem sem `OPENROUTER_API_KEY`/modelo configurado (já é o caso hoje) | `CONFIGURACAO_IA_AUSENTE` aparece de forma legível, não genérica | Alta |
| E-10 | Qualquer chamada a `.functions.invoke` que retorne 4xx/5xx | Mensagem real do corpo (`codigo`/`mensagem`) aparece, nunca "Edge Function returned a non-2xx status code" | Alta |

## 6. Critérios de Aceite

- [x] AC-01 — Nenhuma migração `marketing_*` atribui um `CASE`/expressão a uma coluna de tipo enum sem cast explícito (varredura + correção onde necessário). _Varredura completa em todas as migrações e nos 5 enums existentes; único caso real era a 0017, já corrigido pela 0028. Nenhum novo caso encontrado._
- [x] AC-02 — Toda tabela `marketing_*` com coluna jsonb que pode crescer (ex.: `entrada_resumida`, `conteudo`, `metricas`) tem um gatilho de auditoria que não duplica esse campo em UPDATE, ou está comprovadamente sempre pequena. _Toda tabela com o gatilho genérico revisada: `marketing_insight` já corrigida (0029); `marketing_ai_run.resposta` sem duplicação (old é sempre null) e limitado a 1200 tokens; demais campos grandes (`nota`, `observacao`, `mensagem`, `texto` de comentário) têm cap explícito ou são limitados pela própria plataforma (Instagram). `marketing_image_asset` só audita INSERT._
- [x] AC-03 — Nenhuma chamada a modelo não-OpenAI usa `response_format` sem confirmação de suporte. _Encontrado e corrigido: `marketing-gerar-conteudo/index.ts` ainda usava `response_format`+`JSON.parse` cru (mesmo padrão já corrigido hoje em insight/comentários); alinhado ao padrão `extrairJson()`. Deploy pendente — bloqueado pelo CLI do Supabase (ver bloqueio na Onda 1)._
- [x] AC-04 — Toda chamada `.functions.invoke` nas telas de Marketing usa `mensagemDeErroFuncao` (ou equivalente) para erros, nunca `error.message` cru. _6 chamadas encontradas (Comentarios.tsx×2, aiRemote.ts×2, MetricasInstagram.tsx, Insights.tsx), todas já corretas._
- [ ] AC-05 — Criar um briefing novo pela tela funciona e aparece na Agenda.
- [ ] AC-06 — Editar um briefing existente pela tela salva e reflete a mudança.
- [ ] AC-07 — Salvar orçamento de IA pela UI (não por SQL direto) funciona e é confirmado visualmente.
- [ ] AC-08 — Importar comentários de pelo menos uma publicação real funciona ou falha com mensagem específica e correta sobre o motivo.
- [ ] AC-09 — Classificar comentários pendentes funciona quando há orçamento e modelo configurados.
- [ ] AC-10 — Reclassificar um comentário manualmente atualiza a tela sem recarregar a página inteira.
- [ ] AC-11 — Criar e arquivar uma nota de contexto funciona e é confirmado visualmente.
- [ ] AC-12 — Gerar imagem a partir de um prompt aprovado funciona ou falha com mensagem específica (não crash silencioso) — formato real da resposta do OpenRouter validado nesta rodada.
- [x] AC-13 — `npm run check` permanece verde após cada correção. _Verificado após o fix da Onda 1 (segurança, migrações PGlite, 94 testes de frontend, lint, build — todos verdes)._

## 7. Requisitos Não-Funcionais

- **Consistência de erro (RNF-01):** todo erro de Edge Function em qualquer tela nova de Marketing usa o mesmo helper (`mensagemDeErroFuncao`), sem exceção.
- **Regressão com dado realista (RNF-02):** todo teste de banco novo usa volume/tamanho de dado comparável ao real (não `{}`/strings vazias), para não repetir o padrão que escondeu os bugs de hoje.
- **Sem regressão (RNF-03):** nenhuma correção desta auditoria pode quebrar uma ação já confirmada funcionando hoje (aprovação de conteúdo, insight, importação de métricas, login).

## 8. Análise Técnica

### 8.1 Mapa de Impacto

| Módulo | Caminho | Tipo de Mudança |
|---|---|---|
| Migrações existentes | `supabase/migrations/00*.sql` | Ler (varredura); corrigir via migração nova se achar algo |
| Functions de Marketing | `supabase/functions/marketing-*/index.ts` | Ler + possível correção pontual |
| Telas de Marketing | `app/src/features/marketing/*.tsx` | Ler + possível correção pontual |
| `lib/erro.ts` | `app/src/lib/erro.ts` | Já corrigido hoje; só referência |
| Novas migrações de correção | `supabase/migrations/003X_*.sql` | Criar conforme achados |

### 8.2 Padrões Reutilizáveis

- `mensagemDeErroFuncao` (`app/src/lib/erro.ts`) — já corrigido hoje para ler `{codigo, mensagem}` além de `{error}`.
- Padrão de migração de correção via `create or replace function`/`drop trigger + create trigger`, nunca editando arquivo já aplicado — usado em 0028 e 0029 hoje.
- Padrão de teste de regressão com dado de volume realista, adicionado a `scripts/test-marketing-migration.mjs` — replicar para qualquer novo achado.

### 8.3 Riscos e Complexidades

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | Mais bugs da mesma classe (enum/auditoria/response_format) existirem em código ainda não clicado | Alta | Médio | Varredura por grep antes de testar manualmente (Onda 1) |
| 2 | Geração de imagem falhar por formato de resposta do OpenRouter nunca validado | Alta | Médio | Testar cedo (Onda 5); se o formato estiver errado, é um ajuste de parsing, não um redesenho |
| 3 | Importação de comentários depender de reconexão do Instagram que ainda não aconteceu | Média | Médio | Testar o que der com os posts já importados; documentar o que ficou bloqueado por depender do responsável |
| 4 | Corrigir um bug introduzir outro (ex.: mexer no `marketing_auditar_mutacao` genérico quebrar outra tabela) | Baixa | Alto | Preferir gatilhos/funções dedicados por tabela em vez de alterar a função genérica compartilhada |

### 8.4 Alternativas Consideradas

| # | Alternativa | Prós | Contras | Recomendação |
|---|---|---|---|---|
| 1 | Corrigir só o que o usuário reportar, um de cada vez | Menos esforço agora | Mesmo padrão de bug se repete em outro lugar depois | ❌ Rejeitada — é exatamente o que já aconteceu hoje |
| 2 | Varredura sistemática (grep) + teste manual guiado do que falta | Encontra a mesma classe de bug em todo lugar de uma vez | Mais trabalho nesta rodada | ✅ Escolhida |

## 9. Restrições e Dependências

**Restrições**
- Nunca editar migrations já aplicadas — toda correção é migração nova.
- Aplicação remota só via `supabase db query --linked --file`, nunca `db push`, sempre após `npm run check`.
- Este agente não tem sessão de usuário real — ações que só existem atrás de login (clicar de verdade em botões) dependem de você testar e relatar o resultado; o agente testa a lógica por SQL/código sempre que possível.

**Dependências**
- Geração de imagem e importação de comentários reais dependem de orçamento configurado (já está) e, para dados novos do Instagram, da reconexão da conta (ainda pendente, fora do controle deste agente).

## 10. Premissas Assumidas

| ID | Premissa |
|---|---|
| P-01 | O critério de pronto de cada onda é "achou e corrigiu o que der para testar sem depender de você clicar" — partes que exigem clique real ficam listadas para você testar e relatar. |
| P-02 | Correções seguem sempre o padrão já validado hoje (migração nova + teste de regressão realista), sem exceção, mesmo para bugs pequenos. |

## 11. Perguntas Resolvidas

| # | Pergunta | Resposta | Rodada |
|---|---|---|---|
| 1 | Fazer entrevista completa ou ir direto para a síntese? | Síntese direta — contexto já rico da própria sessão, usuário priorizando velocidade | 1 |

## 12. Plano de Implementação

### 12.1 Ondas

#### Onda 1 — Varredura por classes de bug já conhecidas
**Objetivo:** achar qualquer outra instância das 4 classes de bug já confirmadas hoje, antes de testar manualmente.

**Arquivos:** leitura ampla, correção pontual em qualquer migração/function/tela onde algo for encontrado.

**Passos:**
1. Grep em `supabase/migrations/00*.sql` por `case when.*then '` seguido de `set` numa coluna — conferir cada resultado contra o tipo real da coluna (enum vs text).
2. Grep em `supabase/migrations/00*.sql` por `after insert or update` + `marketing_auditar_mutacao` — para cada tabela, checar se alguma coluna jsonb pode crescer sem limite (ex.: agrega dados de outra tabela).
3. Grep em `supabase/functions/marketing-*/index.ts` por `response_format` — confirmar modelo (só manter se for OpenAI).
4. Grep em `app/src/features/marketing/*.tsx` e `aiRemote.ts` por `.functions.invoke` — confirmar que todo `error` passa por `mensagemDeErroFuncao` antes de virar mensagem na tela.

**Critérios de pronto da onda:** AC-01, AC-02, AC-03, AC-04.

**Resultado:** os 4 grep/leitura feitos. Único achado real: `marketing-gerar-conteudo/index.ts` ainda tinha `response_format`+`JSON.parse` cru (mesma classe já corrigida hoje em insight/comentários) — corrigido para `extrairJson()`, `npm run check` verde.

~~`[BLOQUEIO]`~~ Resolvido: responsável refez o login na conta certa (`uakwbtmbhwifiekwmsbq` voltou a aparecer `linked: true`). `marketing-gerar-conteudo` implantado com sucesso.

#### Onda 2 — Briefing e orçamento pela UI
**Objetivo:** confirmar que criar/editar briefing e salvar orçamento pela tela funcionam de verdade.

**Arquivos:** `app/src/features/marketing/NovoBriefing.tsx`, `EstrategiaConteudo.tsx` (revisão; correção só se achar algo).

**Passos:**
1. Revisar `NovoBriefing.tsx` e as RPCs que chama (`marketing_criar_briefing_idempotente`, `marketing_atualizar_briefing`) contra os mesmos padrões de bug da Onda 1.
2. Pedir para você criar um briefing novo e editar um existente pela tela, relatando o resultado.
3. Pedir para você clicar "Salvar limites" na tela de Estratégia (mesmo com os valores já configurados por SQL) para confirmar que o caminho pela UI também funciona.
4. Corrigir o que for encontrado, com migração nova se necessário.

**Critérios de pronto da onda:** AC-05, AC-06, AC-07.

#### Onda 3 — Comentários (importar, classificar, reclassificar)
**Objetivo:** exercitar pela primeira vez o fluxo de comentários, hoje com 0 linhas na tabela.

**Arquivos:** `supabase/functions/marketing-importar-comentarios-instagram/index.ts`, `marketing-classificar-comentarios/index.ts`, `app/src/features/marketing/Comentarios.tsx`.

**Passos:**
1. Revisão de código dos dois contra os padrões da Onda 1 (nenhum usa `response_format` hoje, já corrigido; confirmar).
2. Pedir para você clicar "Importar comentários agora" na tela e relatar o resultado (sucesso, mensagem de erro específica, ou "sem ação").
3. Se importar funcionar, pedir para clicar "Classificar pendentes" e depois reclassificar manualmente um comentário.
4. Corrigir o que for encontrado.

**Critérios de pronto da onda:** AC-08, AC-09, AC-10.

#### Onda 4 — Notas de contexto
**Objetivo:** confirmar criar e arquivar nota de contexto pela tela (hoje 0 notas na tabela).

**Arquivos:** `app/src/features/marketing/RelatorioSemanal.tsx`.

**Passos:**
1. Revisão de código contra os padrões da Onda 1.
2. Pedir para você criar uma nota de contexto pela tela e depois arquivá-la, relatando o resultado.
3. Corrigir o que for encontrado.

**Critérios de pronto da onda:** AC-11.

#### Onda 5 — Geração de imagem
**Objetivo:** validar pela primeira vez o formato real de resposta do OpenRouter para o modelo de imagem — o maior risco já sinalizado no código desde a Sprint F.

**Arquivos:** `supabase/functions/marketing-gerar-imagem/index.ts`.

**Passos:**
1. Pedir para você clicar "Gerar imagem a partir deste prompt" num `PROMPT_IMAGEM` já aprovado.
2. Se falhar, ler o erro específico retornado e ajustar o parsing da resposta do OpenRouter (`corpo?.choices?.[0]?.message?.images?.[0]?.image_url?.url`) para o formato real.
3. Reimplantar e testar de novo até funcionar ou até esgotar tentativas razoáveis de ajuste de parsing.

**Critérios de pronto da onda:** AC-12.

**Resultado:** você testou ao vivo e recebeu 422 em `marketing-gerar-imagem`. Diagnóstico **confirmado por consulta direta** ao `marketing_content_version` (id `fa21e61b-...`): `operacao='PROMPT_IMAGEM'`, mas `conteudo` só tem `estrategia/angulo/legenda/cta/hashtags/alt_text` — sem `prompt_imagem` — criada às 16:23, antes do fix de hoje que corrigiu `promptPara()`. Aprovação confirmada `APROVADO` (não é esse o problema). Causa raiz: essa v1 é anterior ao fix, nunca teve `prompt_imagem` preenchido, e a function corretamente recusa com `PROMPT_VAZIO`. Não é um bug novo a corrigir — é dado de teste anterior ao fix já aplicado hoje.

**Pendente:** você gerar uma v2 de "Prompt de imagem" (com o fix já implantado), aprovar, e testar "Gerar imagem" nela — só assim fecha AC-12 com evidência real.

### 12.2 Ordem de Execução

Onda 1 primeiro (mais barata, sem depender de você, encontra o que puder de forma automática). Ondas 2–5 podem ser feitas em qualquer ordem entre si — cada uma é independente das outras — mas todas dependem de você estar disponível para clicar e relatar, já que este agente não tem sessão de usuário real.

## 13. Verificação End-to-End

1. `npm run check` verde após cada correção aplicada.
2. Cada AC da Seção 6 marcado com evidência (SQL de teste, ou relato seu de clique real).
3. Nenhuma ação já confirmada funcionando hoje (login, importar métricas, aprovar conteúdo, gerar/decidir insight) regride.
