# Handoff: Atol Sorteios — redesign visual sobre o design system da Atol AI

## Overview

O **Sorteio ATOL** é um PWA já em produção (React 18 + TS + Vite + Supabase) que executa sorteios a partir dos comentários de posts do Instagram, com prova criptográfica reproduzível do resultado. Funcionalmente está completo (68 testes, 8 Edge Functions, 8 migrações).

O que **não** estava resolvido era o visual: o app nasceu com uma identidade genérica de SaaS dark (fonte Inter, gradiente indigo→cyan→fuchsia, fundo `#0b0d14`) que não conversa com o app principal da Atol AI. Um usuário que sai do app Atol e entra no Sorteios sente que são dois produtos de empresas diferentes.

Este handoff entrega o **redesign completo da camada visual** do Sorteios, reconstruído sobre os tokens, a tipografia e o vocabulário de componentes do design system da Atol AI. Nenhuma regra de negócio, motor de sorteio, contrato de API ou schema muda — a tarefa é exclusivamente de apresentação.

### Antes → Depois

| Aspecto | Antes (atual em produção) | Depois (este handoff) |
|---|---|---|
| Fonte de texto | Inter | **Manrope** (300–800) |
| Fonte de display | Inter 800 | **Instrument Serif** 400 (+ itálico para ênfase) |
| Fonte de números | Inter | **JetBrains Mono** (hashes, contadores, sementes) |
| Fundo | `#0b0d14` (quase preto neutro) | `#061820` (ink oceânico da Atol) |
| Marca | gradiente `#22d3ee → #818cf8 → #e879f9` | **teal `#5CC5BE`** sólido + coral `#ED9079` de apoio |
| Cor de texto | `#eef0f8` (branco azulado) | `#F2E8D6` (areia) |
| Layout | container central de 960px, nav horizontal | **shell com topbar + rail lateral**, igual ao app Atol |
| Estilização | inline styles em quase todo componente | **classes CSS** (`sx-*`) + tokens |

---

## About the Design Files

Os arquivos deste bundle são **referências de design feitas em HTML/CSS/JS** — protótipos que mostram a aparência e o comportamento pretendidos. **Não são código de produção para copiar direto.**

A tarefa é **recriar estes designs no codebase existente do Sorteio ATOL** (`app/`, React 18 + TypeScript + Vite), usando os padrões já estabelecidos lá: componentes funcionais, `react-router-dom`, os módulos puros de `src/lib/`, e as chamadas de API em `src/features/*/api.ts`.

Concretamente, isso significa:

- **`sorteio.css` pode ser aproveitado quase integralmente** — é CSS puro, sem dependência de framework. Recomendação: substituir o conteúdo de `app/src/index.css` pelos tokens da Atol (Seção "Design Tokens") e adicionar `sorteio.css` como folha de componentes.
- **`Atol Sorteios.html` é apenas o protótipo navegável.** O JS dele (template strings, objeto `ST`, `render()` global) existe só para tornar o protótipo clicável — **descarte-o**. Os componentes React reais já existem em `app/src/features/` e devem ser **reestilizados**, não reescritos.
- O protótipo usa **dados fictícios** (`POSTS`, `PART`, `HIST`). No app real esses dados vêm do Supabase pelas funções já implementadas em `api.ts`.

### Mapa: tela do protótipo → arquivo real a reestilizar

| Tela no protótipo | Arquivo no codebase | Ação |
|---|---|---|
| Início | `app/src/routes/Home.tsx` | Reescrever: hoje é um hero de 29 linhas; passa a ter métricas + próximo passo + "como funciona" |
| Shell (topbar + rail) | `app/src/routes/Layout.tsx` | Reescrever: nav horizontal inline → topbar + rail lateral com estado ativo |
| Novo sorteio | `app/src/features/sorteios/NovoSorteio.tsx` | Reestilizar: remover inline styles, aplicar `.sx-post`, `.sx-seg`, `.sx-stepper` |
| Participantes | `app/src/features/sorteios/Participantes.tsx` | Reestilizar: aplicar `.sx-filter`, `.sx-list`, `.sx-p`, `.sx-tag` |
| Sortear | `app/src/features/sorteios/Executar.tsx` | Reestilizar: aplicar `.sx-card`, `.sx-field`, `.sx-note--warn` |
| Modo palco | `app/src/features/sorteios/Live.tsx` + `Roleta.tsx` | Reestilizar a moldura (`.sx-stage`, `.sx-reel`); **manter a lógica de `fita.ts` e a salvaguarda de `setTimeout`** |
| Comprovante | `app/src/features/sorteios/Comprovante.tsx` | **Reescrever o `desenharCard()` do canvas** com a paleta nova (ver Seção "Comprovante / canvas") |
| Histórico | `app/src/features/historico/Historico.tsx` | Reestilizar: aplicar `.sx-hitem` |
| Conta | `app/src/features/conta/ConectarConta.tsx` | Reestilizar: aplicar `.sx-acct`, `.sx-substep` |
| Avatares | `app/src/components/Avatar.tsx` + `lib/avatar/gerarAvatar.ts` | Ajustar saturação/luminosidade (ver Seção "Avatares") |

---

## Fidelity

**Alta fidelidade (hifi).** Cores, tipografia, espaçamentos, raios e estados estão definidos em valores exatos, tanto neste README quanto em `sorteio.css`. O desenvolvedor deve reproduzir a UI fielmente.

Duas ressalvas:

1. O protótipo foi desenhado no viewport desktop (~1280×820). O comportamento responsivo/mobile está descrito na Seção "Responsive behavior" mas **não** está implementado no protótipo — precisa ser construído.
2. A roleta do protótipo é uma simplificação (uma fita de ~19 itens com uma transição CSS). A implementação real em `fita.ts` já é superior (fita de 120 itens, janela virtual de ≤7 nós no DOM, testada com 20.000 participantes) — **mantenha a implementação real** e aproveite apenas a moldura visual.

---

## Screens / Views

Todas as telas compartilham o mesmo shell. Descrito uma vez aqui:

### Shell (todas as telas)

**Container** — `.sx-app`: `display:flex; flex-direction:column; height:100%; background:var(--ink); overflow:hidden`. Fonte base Manrope.

**Topbar** — `.sx-top`: `flex; align-items:center; justify-content:space-between; gap:20px; padding:12px 20px; border-bottom:1px solid var(--hairline); background:var(--ink-2); flex:none`.
- Esquerda: marca reaproveitada do app Atol (`.ra-brand` + `.ra-brand-logo` 36×36 com `assets/rocas-logo.png` + `.ra-brand-text`). Wordmark "Atol" em Instrument Serif com "Sorteios" em itálico teal; tagline "Resultados verificáveis" (`.ra-brand-tag`).
- Direita (`.sx-top-right`, gap 12px): pill de status `@atolai conectada` (`.sx-tag--ok`) + botão primário "Novo sorteio" com ícone de mais.

**Rail lateral** — `.sx-rail`: `width:232px; flex:none; border-right:1px solid var(--hairline); background:var(--ink-2); padding:16px 12px; flex-direction:column; gap:4px; overflow-y:auto`.
- Dois grupos, cada um precedido por `.sx-rail-label` (10px, `letter-spacing:.16em`, uppercase, `var(--muted-2)`, weight 700, `padding:14px 10px 6px`):
  - **FLUXO** — Início, Novo sorteio, Participantes, Sortear, Modo palco, Comprovante
  - **GERAL** — Histórico, Conta
- Item (`.sx-rail-item`): `flex; align-items:center; gap:10px; width:100%; border-radius:10px; padding:9px 10px; font-size:13px; weight:600; color:var(--muted)`. Ícone 17×17 stroke 1.9 em `var(--muted-2)`.
  - `:hover` → `background:var(--surface); color:var(--text)`
  - `.is-active` → `background:var(--card); color:var(--text); box-shadow:inset 2px 0 0 var(--teal)`; ícone vira `var(--teal)`
  - Contador opcional à direita (`.sx-rail-num`): JetBrains Mono 10.5px, `var(--muted-2)`, `margin-left:auto`

**Área principal** — `.sx-main`: `flex:1; overflow-y:auto; padding:28px 32px 60px; background:var(--ink); position:relative`. Um `::before` sobrepõe `radial-gradient(ellipse 70% 50% at 85% -5%, var(--teal-glow), transparent 70%)` com `pointer-events:none` — glow oceânico sutil no canto superior direito. Conteúdo em `.sx-wrap` (`max-width:900px`) ou `.sx-wrap--narrow` (`max-width:560px`).

**Cabeçalho de tela** — `.sx-head` (`margin-bottom:24px`):
- Eyebrow: `.ra-eyebrow` do design system Atol (10.5px, `letter-spacing:.16em`, uppercase, teal, com bullet `::before` de 6px)
- Título: `.sx-h1` — **Instrument Serif 400, 31px, line-height 1.15**, `margin:10px 0 8px`. Uma palavra-chave sempre em `<em>` → itálico + `color:var(--teal)`
- Lede: `.sx-lede` — 13.5px, line-height 1.6, `var(--text-2)`, `max-width:62ch`

**Separador de etapa** — `.sx-step`: usado para numerar seções dentro de uma tela. `flex; align-items:center; gap:10px; font-size:10.5px; letter-spacing:.15em; uppercase; color:var(--muted); weight:700; margin:30px 0 12px`. O `<b>` interno leva o número em JetBrains Mono teal; um `::after` (`flex:1; height:1px; background:var(--hairline)`) desenha a linha até a borda.

---

### 1. Início

**Purpose:** ponto de entrada — mostra a saúde da operação e empurra para a próxima ação pendente.

**Layout:** `.sx-wrap` (900px). Cabeçalho → faixa de métricas → etapa 01 (próximo passo) → etapa 02 (como funciona).

**Componentes:**

- **Cabeçalho** — eyebrow "Sorteio ATOL"; título `Sorteios do Instagram,` / `<em>auditáveis</em> de ponta a ponta` (quebra explícita com `<br/>`); lede: "Escolha o post, importe os comentários pela API oficial e sorteie com prova criptográfica — qualquer participante recalcula o vencedor com a semente publicada."

- **Métricas** — `.sx-stats`: `grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:12px`. Cada `.sx-stat`: `background:var(--surface); border:1px solid var(--hairline); border-radius:var(--radius) /*14px*/; padding:16px 18px`. Número `.sx-stat-n` em JetBrains Mono 26px weight 700 line-height 1.1; rótulo `.sx-stat-l` 11.5px `var(--muted)` com `margin-top:4px`.
  - O primeiro card recebe `.sx-stat--hero`: `background:linear-gradient(155deg,var(--teal-glow),transparent 70%),var(--surface)`, `border-color:color-mix(in srgb,var(--teal) 34%,transparent)`, e o número em `.is-teal`.
  - Conteúdo: **14** sorteios realizados · **8.4k** comentários processados · **0** resultados contestados · **58d** token válido.

- **Próximo passo** — `.sx-card.sx-card--pad` (padding 24px) em `flex; align-items:center; gap:20px; flex-wrap:wrap`. À esquerda (`flex:1; min-width:240px`): título do sorteio em Instrument Serif 20px + `.sx-hint` "1.247 comentários importados · 842 pessoas concorrendo · aguardando a semente ser publicada." À direita: botão primário "Sortear agora" → navega para Sortear.

- **Como funciona** — grid `repeat(auto-fit,minmax(200px,1fr))`, gap 14px, 4 `.sx-card`. Cada um: numeral `01`–`04` em JetBrains Mono 11px teal (`margin-bottom:8px`), título 13.5px weight 700 `var(--text)`, corpo em `.sx-hint`. Textos exatos:
  1. **Cole ou escolha o post** — "A API oficial resolve a mídia e traz os comentários em lotes, sem scraping."
  2. **Regras claras** — "Menções mínimas, palavra-chave, chances por pessoa ou por comentário."
  3. **Semente pública** — "Você publica a semente antes. Ela entra no cálculo junto com o hash da lista congelada."
  4. **Prova reproduzível** — "Comprovante para stories, CSV e um verificador que qualquer um roda."

---

### 2. Novo sorteio

**Purpose:** escolher o post e configurar as regras de qualificação (CAP-03, CAP-06).

**Layout:** `.sx-wrap`. Cabeçalho → etapa 01 galeria → nota do post escolhido → etapa 02 regras → ações.

**Componentes:**

- **Cabeçalho** — eyebrow "Novo sorteio"; título `Escolha o post e as <em>regras</em>`; lede "Só posts do feed das contas vinculadas. Reels e stories não são suportados pela API."

- **Galeria** — `.sx-posts`: `grid; grid-template-columns:repeat(auto-fill,minmax(132px,1fr)); gap:12px`.
  - `.sx-post`: `position:relative; padding:0; border:1px solid var(--hairline); background:var(--ink-2); border-radius:12px; overflow:hidden; cursor:pointer; text-align:left`
  - `:hover` → `border-color:var(--hairline-2)`
  - `.is-on` → `border-color:var(--teal); box-shadow:0 0 0 2px var(--teal-glow)`
  - `.sx-post-img`: `aspect-ratio:1; grid; place-items:center; background:linear-gradient(140deg,var(--card),var(--surface)); color:var(--muted-2); font-size:11px; gap:4px`. Ícone 22×22 conforme `media_type` (foto / vídeo / carrossel) + label do tipo em texto. **Quando a capa real da CDN do Instagram existir, ela substitui o ícone** — mantenha o fallback atual de `CapaPost` (URLs da CDN expiram).
  - `.sx-post-meta`: `flex; justify-content:space-between; padding:8px 10px; border-top:1px solid var(--hairline); font-size:10.5px; color:var(--muted)`. Contador de comentários em `<b>` (JetBrains Mono, `var(--text-2)`).
  - `.sx-post-check`: badge 20×20 circular teal com check no canto superior direito (`top:8px; right:8px`), `display:none` → `grid` quando `.is-on`.

- **Nota do post** — `.sx-note`: `flex; gap:11px; background:var(--ink-2); border:1px solid var(--hairline); border-left:2px solid var(--teal); border-radius:10px; padding:13px 15px; font-size:12.5px; color:var(--text-2); line-height:1.55`. Ícone info 15×15 teal. Conteúdo: legenda do post em `<strong>` + "N comentários · publicado DATA · @conta".

- **Card de regras** — `.sx-card.sx-card--pad` como grid com `gap:20px`:
  - **Modo de contagem** — `.sx-field` (`flex-direction:column; gap:6px`; label 11.5px weight 700 `var(--text-2)`) contendo `.sx-seg`: `flex; gap:6px; background:var(--ink-2); border:1px solid var(--hairline); border-radius:10px; padding:4px`. Botões `flex:1; border-radius:7px; padding:8px 10px; font-size:12.5px; weight:600; color:var(--muted)`; `.is-on` → `background:var(--card); color:var(--text)`. Opções: "Uma por pessoa" / "Uma por comentário". Abaixo, `.sx-hint` que muda com a seleção:
    - `POR_PESSOA`: "Cada pessoa concorre uma vez, não importa quantas vezes comentou."
    - `POR_COMENTARIO`: "Cada comentário válido vira uma chance, até o teto configurado."
  - **Três steppers em linha** (`.sx-row` gap 26px): Menções mínimas / Ganhadores / Suplentes. `.sx-stepper`: `flex; background:var(--ink-2); border:1px solid var(--hairline-2); border-radius:10px; overflow:hidden; width:fit-content`. Botões 34×36px `color:var(--muted)`, hover `background:var(--surface); color:var(--text)`. Valor central: `min-width:40px; text-align:center; JetBrains Mono 14px weight 600 var(--text)`. Mínimos: menções 0, ganhadores 1, suplentes 1.
  - **Palavra-chave** — `.sx-field` com label "Palavra ou hashtag obrigatória" + sufixo "— opcional" em `var(--muted-2)` weight 500. `.sx-input` com placeholder "ex.: EU QUERO".
  - Quando o modo é `POR_COMENTARIO`, exibir também o stepper de **teto de chances** (existe no state atual como `tetoChances`, default 3).

- **Ações** — `.sx-actions` (`flex; gap:10px; margin-top:22px`): botão primário grande "Importar comentários" + `.sx-btn--ghost` "Cancelar".

**Input base** — `.sx-input`: `font-size:13.5px; color:var(--text); background:var(--ink-2); border:1px solid var(--hairline-2); border-radius:10px; padding:10px 12px; width:100%`. Foco: `outline:none; border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-glow)`. Placeholder em `var(--muted-2)`.

---

### 3. Importação (estado intermediário)

**Purpose:** dar visibilidade ao job assíncrono de importação (RNF-05) — a request nunca espera a paginação.

Não tem tela dedicada no protótipo, mas os componentes estão em `sorteio.css` e o estado já existe em `NovoSorteio.tsx` (`progresso`) e em `Importacao.tsx`. Especificação:

- **Barra** — `.sx-bar`: `height:6px; border-radius:999px; background:var(--ink-2); border:1px solid var(--hairline); overflow:hidden`. Preenchimento `.sx-bar i`: `height:100%; background:linear-gradient(90deg,var(--teal-deep),var(--teal)); border-radius:999px`; largura = `importados / comments_count`.
- **Lista de subetapas** — `.sx-steps` (`flex-direction:column; gap:12px; margin-top:18px`). Cada `.sx-substep`: `flex; align-items:center; gap:11px; font-size:12.5px; color:var(--muted)`.
  - `.sx-dot`: 18×18 circular, `border:1px solid var(--hairline-2); background:var(--ink-2)`
  - `.is-done` → texto `var(--text-2)`; dot `background:var(--ok-bg); border-color:color-mix(in srgb,var(--ok) 45%,transparent); color:var(--ok)` com ícone de check
  - `.is-now` → texto `var(--text)` weight 600; dot `background:var(--teal-glow); border-color:var(--teal); color:var(--teal)`
- Etapas sugeridas: "Resolvendo a mídia" → "Importando comentários (N de M)" → "Aplicando as regras" → "Pronto".

---

### 4. Participantes

**Purpose:** conferir a classificação de cada comentário com o motivo (CAP-07, AC-09, AC-12).

**Layout:** `.sx-wrap`. Cabeçalho → métricas → filtros → busca → lista → ações.

**Componentes:**

- **Cabeçalho** — eyebrow "Participantes"; título `842 pessoas <em>concorrendo</em>` (o número que realmente importa: pessoas distintas, não comentários); lede com título do sorteio + "mínimo N menções" + modo de contagem.

- **Métricas** — mesma `.sx-stats`. Primeiro card `.sx-stat--hero`: **842** concorrendo. Depois: **1.247** comentários · **218** extras · **187** fora das regras.

- **Filtros** — `.sx-filters` (`flex; gap:8px; flex-wrap:wrap; margin:18px 0 14px`). `.sx-filter`: `background:var(--ink-2); border:1px solid var(--hairline); border-radius:999px; padding:7px 14px; font-size:12px; weight:600; color:var(--muted)`. `.is-on` → `background:var(--teal); border-color:var(--teal); color:var(--ink)`. Contagem em `<b>` (JetBrains Mono, `opacity:.7; margin-left:4px`). Opções: Todos · Concorrem · Extras · Fora · Revisar (este último **só aparece se houver suspeitos**).

- **Busca** — `.sx-input` com placeholder "Buscar @username…", `max-width:320px; margin-bottom:14px`.

- **Lista** — `.sx-list`: `background:var(--surface); border:1px solid var(--hairline); border-radius:var(--radius); overflow:hidden`. Cada linha `.sx-p`: `flex; align-items:center; gap:12px; padding:11px 16px; border-bottom:1px solid var(--hairline)` (último sem borda). Composição:
  1. Avatar gerado 32×32 (ver Seção "Avatares")
  2. `.sx-p-main` (`flex:1; min-width:0`): `.sx-p-user` (`@username`, 13px weight 700 `var(--text)`, block) + `.sx-p-txt` (texto do comentário, 11.5px `var(--muted)`, truncado com ellipsis em `max-width:52ch`)
  3. `.sx-p-reason` — código do motivo em JetBrains Mono 10.5px `var(--muted-2)`, só quando houver
  4. `.sx-tag` — status, 9.5px weight 800 `letter-spacing:.09em` uppercase, `padding:4px 9px; border-radius:999px; border:1px solid`

  **Mapa de status → tag** (mantém os rótulos em português que já existem em `Participantes.tsx`):

  | status interno | rótulo | classe | cor / borda / fundo |
  |---|---|---|---|
  | `HABILITADO` | CONCORRE | `.sx-tag--ok` | `var(--ok)` / `color-mix(in srgb,var(--ok) 40%,transparent)` / `var(--ok-bg)` |
  | `EXTRA` | EXTRA | `.sx-tag--extra` | `var(--muted)` / `var(--hairline-2)` / `var(--ink-2)` |
  | `DESQUALIFICADO` | FORA | `.sx-tag--out` | `var(--danger)` / 40% / `var(--danger-bg)` |
  | `SUSPEITO` | REVISAR | `.sx-tag--warn` | `var(--warn)` / 40% / `var(--warn-bg)` |

  **EXTRA é deliberadamente neutro, não negativo** — a pessoa participa, só não acumula chance. Não use vermelho.

  Manter a janela de 300 nós já implementada (`.slice(0, 300)`).

- **Ações** — botão primário "Seguir para o sorteio" + `.sx-btn` "Exportar CSV" com ícone de download.

---

### 5. Sortear

**Purpose:** entrada da semente e confirmação de que ela foi publicada antes (CAP-08, P-06).

**Layout:** `.sx-wrap--narrow` (560px) — decisão crítica, coluna estreita.

**Componentes:**

- **Cabeçalho** — eyebrow "Sortear"; título `Congelar a lista e <em>sortear</em>`; lede "A semente precisa ter sido publicada antes — é isso que torna o resultado incontestável."

- **Três métricas** — `.sx-stats` forçado a `grid-template-columns:repeat(3,1fr)`, `margin-bottom:18px`: **842** chances na urna · **N** ganhador(es) · **N** suplentes.

- **Card do formulário** — `.sx-card.sx-card--pad` grid `gap:18px`:
  - **Semente pública** — `.sx-input` com `font-family:'JetBrains Mono',monospace`. `.sx-hint`: "Qualquer texto. O que importa é ter sido publicado antes — ele entra no cálculo junto com o hash da lista congelada."
  - **Onde você publicou** — `.sx-input`, default "Stories do @atolai, DD mmm HH:MM"
  - **Confirmação** — `.sx-check`: `flex; align-items:flex-start; gap:10px; font-size:12.5px; line-height:1.55; color:var(--text-2); cursor:pointer`. Checkbox 15×15 `accent-color:var(--teal)`, `margin-top:2px`. Texto: "Confirmo que a semente já foi publicada e que o snapshot será congelado agora — a importação para e o sorteio roda uma única vez."
  - **Aviso** — `.sx-note.sx-note--warn` (borda esquerda `var(--warn)`, ícone de cadeado `var(--warn)`): "Depois de sortear, esta rodada não roda de novo. Para sortear outra vez, crie uma nova rodada no mesmo post."

- **Ações** — primário grande "Congelar e sortear" (habilitado só com semente ≥3 caracteres + checkbox marcado + chances > 0) + ghost "Voltar".

- **Estado já sorteado** — quando `status === 'SORTEADO'`, substituir o formulário por um `.sx-card` centrado: "Sorteio já executado" + "Cada rodada roda uma única vez. Para sortear de novo, crie uma nova rodada." + botão "Ver o resultado".

---

### 6. Modo palco

**Purpose:** o momento da live — roleta animada revelando um resultado que **já está calculado e assinado**.

**Layout:** `.sx-wrap`. Cabeçalho → palco → ações. O título muda com o estado: `Girando a <em>urna</em>` → `Temos <em>vencedor</em>`.

**Componentes:**

- **Palco** — `.sx-stage`: `background:radial-gradient(ellipse 60% 45% at 50% 0%,var(--teal-glow),transparent 70%),var(--ink); border:1px solid var(--hairline); border-radius:var(--radius-lg) /*20px*/; padding:34px; text-align:center; overflow:hidden`.

- **Roleta (girando)** — `.sx-reel`: `position:relative; height:196px; max-width:420px; margin:22px auto 0; overflow:hidden; background:var(--ink-2); border-top/bottom:1px solid var(--hairline); border-radius:12px`.
  - Máscaras de fade: `::before` (topo, 58px, `linear-gradient(var(--ink-2),transparent)`) e `::after` (base, invertido), ambos `z-index:2; pointer-events:none`
  - Ponteiro `.sx-reel-ptr`: faixa de 66px centrada verticalmente (`top:50%; transform:translateY(-50%)`), `border-top/bottom:1px solid var(--teal); background:var(--teal-glow); z-index:3`
  - Fita `.sx-reel-strip`: `flex-direction:column; transition:transform 4.6s cubic-bezier(.13,.72,.06,1)`
  - Item `.sx-reel-item`: **altura fixa 66px**, `flex; align-items:center; justify-content:center; gap:10px; font-size:16px; weight:700; color:var(--text-2)` — avatar 32px + `@username`
  - Legenda abaixo: `.sx-hint` "842 chances na urna · desacelerando…"

- **Vencedor (revelado)** — `.sx-winner`: `flex-direction:column; align-items:center; gap:12px`.
  - `.sx-winner-pos` — "1º LUGAR", 10.5px `letter-spacing:.16em` uppercase teal weight 800
  - Avatar `.sx-av--xl` (92×92, fonte 31px)
  - `.sx-winner-user` — `@username` em **Instrument Serif 34px** line-height 1.1
  - `.sx-hint` — "sorteado entre 842 chances · semente SEED"
  - **Suplentes** — `.sx-alts` (`flex-direction:column; gap:8px; margin-top:20px; text-align:left; max-width:420px; margin-inline:auto`). Label "SUPLENTES" em `.sx-proof-label`. Cada `.sx-alt`: `flex; align-items:center; gap:10px; background:var(--surface); border:1px solid var(--hairline); border-radius:10px; padding:9px 13px; font-size:13px; color:var(--text-2)`, com a posição em `<b>` (JetBrains Mono 11px `var(--muted-2)`) + avatar 32px + `@username`.

- **Ações** — girando: primário grande "Revelar vencedor". Revelado: primário "Gerar comprovante" + ghost "Rever a animação".

**⚠️ Sobre a animação:** o protótipo anima uma fita curta com uma única transição CSS. **Não substitua a implementação real.** `app/src/lib/avatar/fita.ts` já resolve isso melhor e tem testes garantindo: fita de comprimento fixo (120 itens) independente do tamanho da urna, janela de ≤7 nós no DOM em qualquer posição, construção com 20.000 participantes em <5ms, vencedor parando exatamente sob o ponteiro central, e **salvaguarda por `setTimeout`** caso o navegador congele `requestAnimationFrame` (aba oculta durante a live). Aproveite apenas a moldura visual (`.sx-reel*`) e mantenha `height:66px` por item, que é o número de que a matemática da fita depende.

---

### 7. Comprovante

**Purpose:** entregar a prova pública — card para stories, PDF, CSV e o comando do verificador (AC-14, AC-15).

**Layout:** `.sx-wrap`. Cabeçalho → `.sx-proof-row` (`flex; gap:24px; align-items:flex-start; flex-wrap:wrap`): card de stories à esquerda (largura fixa) + coluna de dados à direita (`flex:1; min-width:280px`).

**Cabeçalho** — eyebrow "Comprovante"; título `Prova <em>pública</em> do resultado`; lede "Card pronto para os stories, mais o CSV e o comando que qualquer participante roda para recalcular o vencedor."

**Card de stories (preview)** — `.sx-proof`: `width:296px; aspect-ratio:1080/1920` (preview em escala do card real). Fundo em três camadas: `radial-gradient(ellipse 70% 40% at 80% 0%,var(--teal-glow),transparent 65%)`, `radial-gradient(ellipse 60% 40% at 10% 100%,var(--coral-glow),transparent 60%)`, `var(--ink)`. `border:1px solid var(--hairline-2); border-radius:16px; padding:26px 20px; flex-direction:column; align-items:center; text-align:center`.

Hierarquia interna (tamanhos do **preview** de 296px; multiplicar por **3.649** para o canvas de 1080px):
- `.sx-proof-eyebrow` — "SORTEIO ATOL · VERIFICÁVEL", 8px `letter-spacing:.2em` uppercase teal weight 800
- `.sx-proof-title` — "Resultado do sorteio", Instrument Serif 20px, `margin:8px 0 3px`
- `.sx-proof-sub` — título do post + data, 8.5px `var(--muted)`, `margin-bottom:18px`
- `.sx-proof-label` — "VENCEDOR", 8px `letter-spacing:.16em` uppercase `var(--muted)` weight 800
- Avatar `.sx-av--lg` (64×64, fonte 22px)
- `.sx-proof-user` — `@username`, Instrument Serif 19px
- `.sx-proof-alts` — bloco de suplentes, 9px line-height 1.8 `var(--text-2)`, precedido do label "SUPLENTES"
- `.sx-proof-nums` — `flex; gap:14px; margin-top:auto; padding-top:16px; border-top:1px solid var(--hairline); justify-content:center`. Cada `.sx-proof-num`: valor em JetBrains Mono 13px `var(--text)` (block) + rótulo 7.5px `letter-spacing:.06em` uppercase `var(--muted)`. Colunas: comentários · chances · menções
- `.sx-proof-hash` — semente + hash SHA-256 quebrado em duas linhas, JetBrains Mono 7px `var(--muted-2)` line-height 1.7 `word-break:break-all`
- `.sx-proof-brand` — "🪸 atol.ai/sorteios", 8px `var(--muted)`

**Coluna de dados** (`flex-direction:column; gap:16px`):
- **Card "Números da rodada"** — `.sx-card` com `.sx-kv`: `grid; grid-template-columns:auto 1fr; gap:9px 16px; font-size:12px`. `dt` em `var(--muted)`; `dd` em JetBrains Mono `var(--text-2)` com `word-break:break-all`. Linhas: Semente pública · Publicada em · Hash da lista (SHA-256 completo) · Execução (UTC, ISO 8601) · Comentários · Chances na urna.
- **Card "Qualquer um confere"** — `.sx-code`: `background:var(--ink-2); border:1px solid var(--hairline); border-radius:10px; padding:12px 14px; JetBrains Mono 11px; color:var(--aqua); white-space:pre; overflow-x:auto`. Conteúdo: `node verificador/verificar.mjs \` / `  participantes.csv "SEED" 1 3`. Abaixo, `.sx-hint`: "Script autocontido, sem dependências. Reproduz o hash, a semente final e os vencedores."
- **Downloads** — `.sx-row` com primário "Card 1080×1920" + "PDF" + "CSV", todos com ícone de download.

#### Comprovante / canvas — reescrever `desenharCard()`

O `desenharCard()` atual em `Comprovante.tsx` desenha com a paleta antiga. Substituições necessárias:

| Elemento | Antes | Depois |
|---|---|---|
| Fundo | `#0b0d14` | `#061820` |
| Glow 1 | `rgba(129,140,248,.30)` em (0.8L, −100) r1100 | `rgba(92,197,190,.22)` mesma posição |
| Glow 2 | `rgba(34,211,238,.26)` em (80, A+100) r900 | `rgba(237,144,121,.18)` mesma posição |
| Título | gradiente cyan→indigo→fuchsia, `800 74px Inter` | **`400 76px 'Instrument Serif'`**, cor sólida `#F2E8D6` |
| Eyebrow (novo) | — | `800 26px Manrope`, `letter-spacing` manual, `#5CC5BE`, acima do título |
| Subtítulo | `400 34px Inter`, `#9aa1b5` | `400 32px Manrope`, `#8FA0A8` |
| Label de seção | `700 40px Inter` com emoji 🏆 | `800 30px Manrope` uppercase, `#8FA0A8`, **sem emoji** |
| Username vencedor | `800 56px Inter`, `#eef0f8` | `400 62px 'Instrument Serif'`, `#F2E8D6` |
| Suplentes | `400 36px Inter`, `#c8cddd` | `400 34px Manrope`, `#C9C0AC` |
| Avatar (gradiente) | `hsl(h 72% 58%)` → `hsl(h+60 68% 46%)` | `hsl(h 58% 52%)` → `hsl(h+52 54% 40%)` |
| Iniciais no avatar | `700 44px Inter` | `800 42px Manrope` |
| Números | `Inter` | `700 xx 'JetBrains Mono'` |
| Hash / semente | `Inter` | `400 xx 'JetBrains Mono'`, `#6A7B83` |
| Divisor | `rgba(255,255,255,.10)` | `rgba(235,223,201,.10)` |
| Rodapé (novo) | — | "atol.ai/sorteios", `400 26px Manrope`, `#8FA0A8` |

**Atenção com fontes no canvas:** Instrument Serif, Manrope e JetBrains Mono precisam estar carregadas **antes** do `fillText`. Aguarde `document.fonts.ready` (ou `document.fonts.load("400 76px 'Instrument Serif'")`) antes de desenhar, senão o canvas cai no fallback serif do sistema — o único ponto onde o redesign pode falhar silenciosamente em produção.

---

### 8. Histórico

**Purpose:** navegar sorteios passados e reabrir comprovantes (CAP-13).

**Componentes:**

- **Cabeçalho** — eyebrow "Histórico"; título `Todos os <em>sorteios</em>`; lede "Dados pessoais são expurgados 90 dias após a execução; o comprovante agregado fica para sempre."
- **Lista** — `.sx-hist` (`flex-direction:column; gap:10px`). Cada `.sx-hitem`: `flex; align-items:center; gap:16px; background:var(--surface); border:1px solid var(--hairline); border-radius:12px; padding:14px 16px; cursor:pointer`. Hover: `border-color:var(--hairline-2); background:var(--surface-2)`.
  1. `.sx-hitem-thumb` — 44×44, `border-radius:9px; background:linear-gradient(140deg,var(--card),var(--surface))`, ícone de imagem `var(--muted-2)` centrado (ou a capa real do post)
  2. `.sx-hitem-main` (`flex:1; min-width:0`) — `.sx-hitem-t` (13px weight 700 `var(--text)`, truncado) + `.sx-hitem-m` (11.5px `var(--muted)`): "DATA · N comentários · N concorrendo"
  3. À direita: se sorteado, `.sx-hitem-w` — "venceu" + `<b>@username</b>` em teal, `text-align:right`. Se ainda importando, `.sx-tag--warn` "Importando".

---

### 9. Conta

**Purpose:** estado da vinculação do Instagram e transparência das automações (CAP-01, CAP-02).

**Layout:** `.sx-wrap--narrow`.

**Componentes:**

- **Cabeçalho** — eyebrow "Conta"; título `Instagram <em>vinculado</em>`; lede "A vinculação acontece uma vez. Depois disso o token renova sozinho — você só escolhe o post."
- **Card da conta** — `.sx-acct`: `flex; align-items:center; gap:14px; background:var(--surface); border:1px solid var(--hairline); border-radius:var(--radius); padding:18px`. `.sx-acct-av`: 52×52 circular, `background:linear-gradient(140deg,var(--teal),var(--moss))`, iniciais em `var(--ink)` weight 800 18px. Nome `@atolai` 14px weight 700; `.sx-hint` "Conta Business · token válido por N dias". À direita, `.sx-tag--ok` "Conectada".
  - **Badge de expiração (RNF/risco 7):** quando faltarem <7 dias, trocar para `.sx-tag--warn` com "Renovando"; se o token expirou, `.sx-tag--out` "Reconectar" + CTA de reconexão em destaque.
- **Card de automações** — `.sx-card` com `.sx-proof-label` "AUTOMAÇÕES" + `.sx-steps` de três `.sx-substep.is-done`: "Renovação do token — diária, 03:10 UTC" · "Expurgo LGPD — 90 dias após a execução" · "Watchdog de importação — a cada 5 min".
- **Nota de segurança** — `.sx-note` com ícone de cadeado: "Nenhum token do Instagram chega ao navegador. Toda chamada à API oficial acontece no servidor." (AC-17)
- **Ações** — `.sx-btn` "Revincular conta" + link ghost "Política de privacidade".

---

## Avatares

A API do Instagram **não expõe a foto de perfil de comentaristas** — os avatares são gerados de forma determinística a partir do username (CAP-11, AC-12: o mesmo username sempre produz o mesmo avatar).

O algoritmo atual em `lib/avatar/gerarAvatar.ts` continua válido — **só a faixa de saturação/luminosidade muda**, para os avatares não brigarem com a paleta oceânica:

```
matiz   = hash(username) % 360                    // inalterado
início  = hsl(matiz, 58%, 52%)                    // era 72% 58%
fim     = hsl((matiz + 52) % 360, 54%, 40%)       // era (matiz+60), 68% 46%
gradiente = linear-gradient(140deg, início, fim)  // era 135deg
iniciais  = primeiros 2 caracteres alfanuméricos, uppercase
cor do texto = rgba(255,255,255,.95)
```

Função de hash usada no protótipo (FNV-1a — troque pela que já existe em `gerarAvatar.ts`, o importante é ser determinística):

```js
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
```

**Tamanhos** — classe base `.sx-av` (`grid; place-items:center; border-radius:50%; font-weight:800; color:rgba(255,255,255,.95); letter-spacing:.02em`):

| Classe | Tamanho | Fonte | Uso |
|---|---|---|---|
| `.sx-av` | 32×32 | 12px | linhas de participante, fita da roleta, suplentes |
| `.sx-av--lg` | 64×64 | 22px | card do comprovante |
| `.sx-av--xl` | 92×92 | 31px | vencedor no modo palco |

---

## Interactions & Behavior

**Navegação** — o rail é a navegação primária; a rota ativa recebe `.is-active` (fundo `var(--card)` + barra teal de 2px à esquerda via `box-shadow: inset`). Fluxo canônico: Início → Novo sorteio → (Importação) → Participantes → Sortear → Modo palco → Comprovante. Ao trocar de tela, resetar o scroll de `.sx-main` para o topo.

**Seleção de post** — clique alterna `.is-on` (só um por vez, `aria-pressed`); a nota abaixo da galeria atualiza com a legenda e a contagem do post escolhido.

**Segmented / steppers** — `POR_PESSOA ⇄ POR_COMENTARIO` troca o texto de ajuda e mostra/esconde o teto de chances. Steppers respeitam os mínimos (menções 0; ganhadores e suplentes 1). Não há máximo rígido, mas ganhadores > habilitados deve bloquear a execução (E-15).

**Filtros de participantes** — filtro exclusivo + busca por substring de username, combináveis. "Revisar" só existe quando há ≥1 suspeito.

**Execução** — botão habilitado só com semente ≥3 caracteres **e** checkbox marcado **e** chances > 0. Ao confirmar: congela o snapshot, grava `resultado` (append-only) e navega para o palco. Re-execução é bloqueada (E-18).

**Roleta** — 4,6s de `transform` com `cubic-bezier(.13,.72,.06,1)` (desaceleração longa, suspense). O protótipo revela em 4,9s via `setTimeout`. **O resultado já está calculado quando a animação começa — a animação nunca decide nada.** Com `prefers-reduced-motion: reduce`, pular a roleta e revelar direto com fade (E-22). Manter a salvaguarda de `setTimeout` de `Roleta.tsx` para o caso de `requestAnimationFrame` congelar.

**Loading** — a importação é assíncrona com progresso em tempo real (Realtime ou polling); a request do usuário nunca espera a paginação. Usar `.sx-bar` + `.sx-steps`.

**Erros** — mensagens específicas, não genéricas, em `.sx-note` (ou `.sx-note--warn` conforme severidade), com `role="alert"`:
- E-19 post de terceiro: "Este post não é da conta vinculada"
- E-21 Reel/Story: "Só posts do feed. Reels e stories não são suportados pela API."
- E-20 link malformado: validar no campo, antes de chamar a API
- E-14 zero habilitados / E-15 ganhadores > habilitados: bloquear com mensagem explícita
- E-17 token expirado: bloquear e pedir reconexão da conta

**Hover** — cards de post e itens de histórico clareiam a borda para `var(--hairline-2)`; itens do rail ganham `var(--surface)`; botões primários escurecem para `var(--teal-deep)`; `.sx-btn` normal vai para `var(--card-2)`.

**Foco** — `.sx-input:focus` → `border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-glow)`. Manter foco visível em todos os controles interativos (o `index.css` atual já usa `outline: 2px solid` — preservar o comportamento com a cor teal).

---

## State Management

Nada novo. O state já existe nos componentes atuais; a lista abaixo é só o inventário do que a UI redesenhada consome.

| Tela | State | Origem |
|---|---|---|
| Novo sorteio | `midias`, `accountId`, `escolhido`, `modo`, `tetoChances`, `mencoesMinimas`, `palavraChave`, `qtdVencedores`, `qtdSuplentes`, `salvando`, `progresso`, `erro` | `listarMidias()`, `criarSorteio()`, `importarTudo()`, `processarRegras()` |
| Participantes | `sorteio`, `linhas`, `filtro`, `busca`, `erro` + derivados `contagens`, `pessoasConcorrendo`, `visiveis` | `buscarSorteio()`, `listarParticipantes()` |
| Sortear | `sorteio`, `totalChances`, `semente`, `fonte`, `confirmou`, `executando`, `erro` | `buscarSorteio()`, `listarChances()`, `executarSorteio()` |
| Modo palco | `resultado`, `fita`, `girando`, `revelado`, índice do vencedor | `buscarResultado()`, `lib/avatar/fita.ts` |
| Comprovante | `sorteio`, `resultado`, `chances` | `buscarResultado()`, `buscarSorteio()`, `listarChances()` |
| Histórico | lista de sorteios com status e vencedor | `features/historico` |
| Conta | conta conectada, `token_expira_em` | `features/conta/api.ts` |

**Sem novas requisições.** O redesign consome exatamente os mesmos dados. As únicas adições de UI que pedem dados já disponíveis: as métricas do Início (contagens agregadas do histórico) e o "próximo passo" (o sorteio mais recente com `status !== 'SORTEADO'`).

---

## Design Tokens

Copiar de `styles.css` (design system da Atol AI) — tema dark, que é o padrão do Sorteios (P-10).

### Cores

```css
/* superfícies — do mais escuro ao mais claro */
--ink:        #061820;   /* fundo da app */
--ink-2:      #0A2230;   /* topbar, rail, inputs, code blocks */
--navy:       #0E2A3F;
--surface:    #102C3D;   /* cards, listas */
--surface-2:  #143447;   /* hover de superfície */
--card:       #173B50;   /* card elevado, item ativo do rail */
--card-2:     #1C485F;   /* hover de card */
--hairline:   rgba(235, 223, 201, 0.10);   /* bordas padrão */
--hairline-2: rgba(235, 223, 201, 0.18);   /* bordas de destaque, inputs */

/* texto */
--text:       #F2E8D6;   /* areia — texto principal */
--text-2:     #C9C0AC;   /* secundário */
--muted:      #8FA0A8;   /* rótulos, hints */
--muted-2:    #6A7B83;   /* placeholders, códigos de motivo */

/* acentos */
--teal:       #5CC5BE;   /* marca / ação primária */
--teal-deep:  #2BA7A8;   /* hover do primário */
--teal-glow:  rgba(92, 197, 190, 0.18);   /* glows, focus ring */
--aqua:       #9FE0E1;   /* texto de código */
--coral:      #ED9079;   /* acento secundário */
--coral-deep: #DC6E58;
--coral-glow: rgba(237, 144, 121, 0.16);
--sand:       #EBDFC9;
--moss:       #5C9D8E;   /* gradiente do avatar da conta */
--algae:      #8FB873;

/* semântico */
--ok:      #6FCE9F;   --ok-bg:     rgba(111, 206, 159, 0.12);
--warn:    #E8B85F;   --warn-bg:   rgba(232, 184, 95, 0.14);
--danger:  #E37464;   --danger-bg: rgba(227, 116, 100, 0.14);
```

### Tipografia

```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap');
```

- **Manrope** — todo o texto de interface. Pesos usados: 500, 600, 700, 800.
- **Instrument Serif** 400 — títulos de tela (`.sx-h1` 31px), nome do vencedor (34px), títulos do comprovante (19–20px), wordmark. O itálico é sempre intencional: marca a palavra-chave do título, colorida em teal.
- **JetBrains Mono** — números, contadores, hashes, sementes, códigos de motivo, blocos de código. Nunca para texto corrido.

**Escala em uso:** 7px / 7.5px / 8px / 8.5px / 9px / 9.5px (tags e micro-copy do card de stories) · 10.5px / 11px / 11.5px (rótulos, hints, metadados) · 12px / 12.5px / 13px / 13.5px (corpo, botões, inputs) · 14px / 16px (stepper, item da roleta) · 19px / 20px / 22px (títulos do comprovante, Instrument Serif) · 26px (métricas) · 31px (`.sx-h1`) · 34px (vencedor).

**Letter-spacing:** `.09em` nas tags de status · `.15em` nos separadores de etapa · `.16em` nos eyebrows e labels · `.2em` no eyebrow do comprovante.

### Espaçamento

Escala de 4px, com os valores efetivamente usados: 4 · 6 · 8 · 10 · 11 · 12 · 14 · 16 · 18 · 20 · 22 · 24 · 26 · 28 · 30 · 32 · 34 · 60 (padding inferior do main).

### Raios

```css
--radius-sm: 8px;    /* pouco usado aqui */
--radius:    14px;   /* cards, listas, stats, .sx-acct */
--radius-lg: 20px;   /* .sx-stage */
--radius-xl: 28px;
/* literais no CSS de componentes */
7px    /* botão interno do segmented */
9px    /* thumb do histórico */
10px   /* inputs, botões, notas, itens do rail, .sx-alt, .sx-stepper */
12px   /* card de post, .sx-reel, .sx-hitem */
16px   /* .sx-proof */
999px  /* pills, tags, filtros, barra de progresso */
50%    /* avatares, .sx-dot, .sx-post-check */
```

### Sombras

O design usa **bordas e camadas de fundo em vez de sombras** — a única sombra é funcional: `box-shadow: inset 2px 0 0 var(--teal)` (barra do item ativo do rail) e `box-shadow: 0 0 0 2px var(--teal-glow)` / `0 0 0 3px var(--teal-glow)` (seleção e foco). Os tokens `--shadow-sm/md/lg` existem em `styles.css` mas não são usados aqui.

### Transições

Curtas e discretas em hover/focus. A única de longa duração é a roleta: `transform 4.6s cubic-bezier(.13,.72,.06,1)`.

---

## Assets

| Asset | Origem | Uso |
|---|---|---|
| `assets/rocas-logo.png` | design system da Atol AI (incluído neste bundle) | marca na topbar (36×36) e no rodapé |
| Ícones | **SVG inline**, desenhados neste protótipo | rail, cards de post, notas, botões |
| Capas dos posts | CDN do Instagram, via `capaDaMidia()` | galeria e thumbs do histórico |

**Ícones** — 24×24 viewBox, `fill="none"`, `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"`. Largura de traço: **1.9** no rail, **1.7** nos cards de post, **2** em ícones pequenos (info, cadeado, download, check) e **3** no check dentro do badge de seleção. Os paths estão no objeto `I` de `Atol Sorteios.html` — se o codebase já tiver uma lib de ícones (Lucide, Phosphor), use a equivalente com a mesma espessura em vez de copiar os paths.

**Capas dos posts** — as URLs da CDN do Instagram **expiram**. O fallback já implementado em `CapaPost` (ícone por `media_type` + label do tipo) continua obrigatório; o protótipo mostra o estado de fallback.

**Emoji** — o design system da Atol AI evita emoji em UI. Os únicos aceitos aqui: 🪸 na assinatura do card de stories e 💬 no contador de comentários da galeria. O 🏆 e o 🎰 do design antigo **saem** — as posições agora são tipográficas ("1º LUGAR" em teal).

---

## Responsive behavior

O protótipo é desktop (~1280×820) e **não** implementa o mobile — mas o produto é um PWA e o organizador costuma sortear ao vivo pelo celular. A ser construído:

- **≥1024px** — rail fixo de 232px + main fluido. Como no protótipo.
- **640–1023px** — rail colapsa em ícones (~64px) ou vira drawer sob o botão de menu na topbar; `.sx-main` cai para `padding:20px`; `.sx-proof-row` empilha.
- **<640px** — rail vira barra inferior de navegação com os 4 destinos principais (Início, Novo, Participantes, Histórico); topbar reduz para marca + avatar; `.sx-posts` em `minmax(112px,1fr)`; `.sx-stats` em 2 colunas; steppers e segmented em largura cheia; `.sx-p-txt` truncado mais curto; `.sx-proof` em `width:100%; max-width:320px`.
- **Modo palco** — merece um layout dedicado em mobile/landscape: o `.sx-stage` deve ocupar a viewport inteira, sem rail, com o vencedor legível a distância (é conteúdo de live). O tamanho do avatar (`.sx-av--xl`) e o nome (34px) devem crescer, não encolher, no palco em tela cheia.
- **Toques** — mínimo 44×44px nos alvos. Os botões do `.sx-stepper` (34×36) e os `.sx-filter` (7px 14px) precisam crescer em mobile.

---

## Accessibility

- Contraste WCAG AA (RNF-08). `--text` (#F2E8D6) sobre `--ink` (#061820) passa com folga. **Atenção:** `--muted-2` (#6A7B83) sobre `--ink-2` fica no limite — reserve para texto ≥11px e nunca para informação essencial sozinha.
- `prefers-reduced-motion: reduce` → roleta substituída por reveal com fade (E-22). O `index.css` atual já tem a regra global de cancelar animações; preservar.
- Status nunca é comunicado só por cor: cada tag tem rótulo textual (CONCORRE / EXTRA / FORA / REVISAR).
- `aria-pressed` nos cards de post e filtros; `aria-current="page"` no item ativo do rail; `role="alert"` nas mensagens de erro.
- Foco visível em todos os controles.

---

## Files

Neste bundle:

| Arquivo | O que é |
|---|---|
| `Atol Sorteios.html` | protótipo navegável das 8 telas — **referência de design**, o JS é descartável |
| `sorteio.css` | camada de componentes `sx-*` — **aproveitável quase integralmente** |
| `styles.css` | design system da Atol AI: tokens, fontes, `.ra-brand`, `.ra-eyebrow` (arquivo grande; só os tokens e os poucos utilitários `ra-*` citados importam aqui) |
| `assets/rocas-logo.png` | logo da marca |
| `README.md` | este documento |

No codebase do Sorteio ATOL (não incluídos aqui — são a origem que deve ser reestilizada):

```
app/src/index.css                        ← substituir tokens pelos da Atol
app/src/routes/Layout.tsx                ← reescrever: topbar + rail
app/src/routes/Home.tsx                  ← reescrever: métricas + próximo passo
app/src/features/sorteios/NovoSorteio.tsx
app/src/features/sorteios/Participantes.tsx
app/src/features/sorteios/Executar.tsx
app/src/features/sorteios/Live.tsx
app/src/features/sorteios/Roleta.tsx     ← só a moldura visual; lógica intacta
app/src/features/sorteios/Comprovante.tsx ← reescrever desenharCard()
app/src/features/historico/Historico.tsx
app/src/features/conta/ConectarConta.tsx
app/src/components/Avatar.tsx
app/src/lib/avatar/gerarAvatar.ts        ← só saturação/luminosidade
```

**Não tocar:** `lib/sorteio/*` (regras, sorteio, motivos), `lib/instagram/permalink.ts`, `lib/avatar/fita.ts`, `supabase/**`, `verificador/**`. São motores puros com testes — o redesign é estritamente de apresentação.

---

## Ordem sugerida de implementação

1. **Tokens e fontes** — substituir `app/src/index.css` pelos tokens da Atol; importar as três famílias; adicionar `sorteio.css`. Nesse ponto o app inteiro já muda de identidade, ainda que os layouts sejam os antigos.
2. **Shell** — `Layout.tsx` com topbar + rail. Dá a estrutura em que todas as telas passam a viver.
3. **Telas de leitura** — Início, Histórico, Conta. Baixo risco, pega o padrão.
4. **Telas de fluxo** — Novo sorteio, Participantes, Sortear. Mais controles de formulário, é onde os inline styles saem.
5. **Modo palco** — reestilizar a moldura mantendo `fita.ts` e a salvaguarda de `setTimeout`. Testar com urna grande e com `prefers-reduced-motion`.
6. **`desenharCard()`** — o canvas, por último. **Verificar `document.fonts.ready` antes de desenhar** e conferir o PNG exportado em 1080×1920 real, não só no preview.
7. **Responsivo** — o que está descrito em "Responsive behavior", com atenção especial ao palco em tela cheia.

## Checklist de aceite visual

- [ ] Nenhuma ocorrência de Inter, `#0b0d14`, `#22d3ee`, `#818cf8` ou `#e879f9` restante no `app/src` (incluindo o canvas do comprovante)
- [ ] `grep -r "var(--gradient-brand)" app/src` retorna vazio
- [ ] Títulos de tela em Instrument Serif com uma palavra em itálico teal
- [ ] Todo número, hash e semente em JetBrains Mono
- [ ] Item ativo do rail com a barra teal de 2px à esquerda
- [ ] Tag EXTRA neutra (nunca vermelha)
- [ ] Card de stories exportado em 1080×1920 com as fontes certas (não o fallback serif do sistema)
- [ ] Roleta ainda passa os testes de `fita.test.ts`; vencedor para sob o ponteiro
- [ ] `prefers-reduced-motion` pula a roleta
- [ ] Alvos de toque ≥44px em mobile
