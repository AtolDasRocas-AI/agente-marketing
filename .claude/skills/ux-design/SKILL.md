---
name: ux-design
description: Use ao tomar decisoes de UI/UX: layout, hierarquia visual, tipografia, espacamento, cores, acessibilidade, microinteracoes. Acione automaticamente em qualquer trabalho de frontend que envolva escolhas de design, ou quando o usuario pedir feedback de design/usabilidade.
---

# UX & Design System Skill

Guia agnÃ³stico de tecnologia para criaÃ§Ã£o de interfaces de qualidade de produÃ§Ã£o com foco em experiÃªncia do usuÃ¡rio, acessibilidade e consistÃªncia visual.
**Leia este arquivo antes de escrever qualquer componente de UI, independente do framework.**

> Este skill Ã© carregado automaticamente junto com skills de tecnologias de UI (React, Next.js, Angular, Flutter). Ele complementa â€” nunca substitui â€” o skill da tecnologia.

---

## Design Thinking (Antes de Codar)

Antes de escrever qualquer cÃ³digo de interface, responda:

1. **PropÃ³sito:** Qual problema esta tela resolve? Quem Ã© o usuÃ¡rio e qual o contexto de uso?
2. **Tom visual:** Comprometa-se com uma direÃ§Ã£o estÃ©tica clara â€” minimalista, editorial, lÃºdica, industrial, corporativa. Seja intencional.
3. **RestriÃ§Ãµes:** Budget de performance, breakpoints obrigatÃ³rios, requisitos de acessibilidade, dispositivos-alvo.
4. **DiferenciaÃ§Ã£o:** O que torna esta interface memorÃ¡vel? Qual detalhe alguÃ©m vai notar?

---

## Design Tokens & Theming

### PrincÃ­pios

- **Toda** cor, tamanho, espaÃ§amento e tipografia deve vir de tokens â€” nunca valores hardcoded
- Tokens sÃ£o a fonte de verdade: se o design muda, muda nos tokens e propaga
- Nomeie tokens por semÃ¢ntica, nÃ£o por valor: `color-primary`, nÃ£o `blue-500`

### Estrutura MÃ­nima de Tokens

```
tokens/
  colors      â†’ primary, secondary, accent, neutral, semantic (success, warning, error, info)
  spacing     â†’ escala consistente (4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px)
  typography  â†’ font-family, font-size scale, font-weight, line-height, letter-spacing
  radius      â†’ none, sm, md, lg, full
  shadows     â†’ sm, md, lg, xl
  breakpoints â†’ sm (640px), md (768px), lg (1024px), xl (1280px), 2xl (1536px)
```

### Dark/Light Theme

- Temas devem ser intencionais â€” nÃ£o apenas inverter cores
- Use variÃ¡veis CSS (custom properties) ou o mecanismo do framework (Tailwind, Angular Material, etc.)
- Teste contraste em ambos os temas
- TransiÃ§Ã£o entre temas deve ser suave (CSS transition em `background-color` e `color`)

---

## Tipografia

- Escolha fontes distintivas e intencionais â€” evite defaults genÃ©ricos sem justificativa
- Combine uma fonte display (tÃ­tulos) com uma fonte de corpo (texto corrido)
- EstabeleÃ§a escala tipogrÃ¡fica com hierarquia clara: h1 > h2 > h3 > body > caption
- Use `font-weight`, `letter-spacing` e `line-height` de forma deliberada
- Tamanho mÃ­nimo de corpo: 16px em desktop, 14px em mobile
- Limite de largura de leitura: 60-80 caracteres por linha (`max-width: 65ch`)

---

## Cor & Contraste

- Defina paleta coesa: uma cor dominante com acentos marcantes
- Evite paletas distribuÃ­das igualmente â€” deve haver hierarquia cromÃ¡tica
- **WCAG AA obrigatÃ³rio:** ratio de contraste mÃ­nimo 4.5:1 para texto normal, 3:1 para texto grande
- Use ferramentas de contraste para validar (ex: contrast-ratio em DevTools)
- Cores semÃ¢nticas: success (verde), warning (amarelo/laranja), error (vermelho), info (azul)
- Nunca use cor como Ãºnico indicador â€” combine com Ã­cones, texto ou padrÃµes

---

## Layout & EspaÃ§amento

- Use escala de espaÃ§amento consistente (grid de 4px ou 8px)
- **Mobile-first obrigatÃ³rio:** comece pelo menor breakpoint, escale para maior
- EspaÃ§o negativo generoso OU densidade controlada â€” ambos funcionam se intencionais
- Alinhe elementos em grid consistente â€” desalinhamento acidental Ã© ruÃ­do visual
- Considere assimetria e quebra de grid quando intencional e com propÃ³sito
- Teste em breakpoints reais: 320px, 375px, 768px, 1024px, 1440px

### PadrÃµes de Layout

| PadrÃ£o | Quando usar |
|---|---|
| Stack (vertical) | FormulÃ¡rios, listas, cards empilhados |
| Grid | CatÃ¡logos, dashboards, galerias |
| Split (sidebar + content) | NavegaÃ§Ã£o + conteÃºdo principal |
| Full-bleed | Hero sections, landing pages |
| Centered | FormulÃ¡rios de login, pÃ¡ginas de status |

---

## Motion & InteraÃ§Ã£o

- **CSS transitions primeiro** para interaÃ§Ãµes simples (hover, focus, expand)
- Use animaÃ§Ã£o orquestrada (framer-motion, Angular animations, etc.) apenas para interaÃ§Ãµes complexas
- Foque em momentos de alto impacto: entrada na pÃ¡gina, feedback de aÃ§Ã£o, transiÃ§Ãµes de estado
- **Toda animaÃ§Ã£o deve ter propÃ³sito** â€” motion decorativo sem significado Ã© ruÃ­do
- DuraÃ§Ã£o padrÃ£o: 150-300ms para micro-interaÃ§Ãµes, 300-500ms para transiÃ§Ãµes de pÃ¡gina
- Easing: `ease-out` para entradas, `ease-in` para saÃ­das, `ease-in-out` para mudanÃ§as de estado
- **Respeite `prefers-reduced-motion`:** desabilite ou reduza animaÃ§Ãµes para usuÃ¡rios que preferem

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Estados de Componente

Todo componente interativo DEVE projetar todos os estados aplicÃ¡veis:

### Loading
- **Skeleton screens** para conteÃºdo estruturado (preferÃ­vel a spinners)
- **Spinner** apenas para aÃ§Ãµes pontuais (submit, fetch curto)
- **Progress bar** para operaÃ§Ãµes longas com progresso mensurÃ¡vel
- Nunca deixe a tela em branco durante loading

### Error
- **Inline:** junto ao campo/componente que falhou (formulÃ¡rios, inputs)
- **Toast/Snackbar:** para erros transitÃ³rios que nÃ£o bloqueiam fluxo
- **Full-page:** para erros irrecuperÃ¡veis (500, sem conexÃ£o)
- Sempre ofereÃ§a uma aÃ§Ã£o: "Tentar novamente", "Voltar", "Reportar"

### Empty
- IlustraÃ§Ã£o ou Ã­cone contextual + mensagem explicativa
- CTA (call-to-action) para o prÃ³ximo passo: "Criar primeiro item", "Importar dados"
- Nunca mostrar apenas "Nenhum resultado" sem contexto

### Success
- Feedback visual claro: checkmark, cor verde, animaÃ§Ã£o sutil
- Para aÃ§Ãµes destrutivas confirmadas: mensagem com opÃ§Ã£o de desfazer (undo)

### Disabled
- Opacidade reduzida (0.5-0.6) + `cursor: not-allowed`
- Tooltip explicando por que estÃ¡ desabilitado (quando possÃ­vel)

---

## Acessibilidade â€” WCAG AA (Bloqueador no Code Review)

### HTML SemÃ¢ntico
- Use tags corretas: `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<header>`, `<footer>`
- Headings em ordem hierÃ¡rquica (h1 â†’ h2 â†’ h3, sem pular nÃ­veis)
- Listas (`<ul>`, `<ol>`) para conteÃºdo de lista, nÃ£o `<div>` com bullets visuais

### FormulÃ¡rios
- Todo `<input>`, `<select>`, `<textarea>` DEVE ter `<label>` associado via `htmlFor`/`for` + `id`
- Mensagens de erro vinculadas via `aria-describedby`
- Grupo de campos relacionados em `<fieldset>` com `<legend>`

### BotÃµes & Links
- BotÃµes apenas com Ã­cone DEVEM ter `aria-label` descritivo
- Links devem ter texto descritivo (nÃ£o "clique aqui")
- Ãrea de clique mÃ­nima: 44x44px (WCAG 2.5.5)

### Modais & Dialogs
- `role="dialog"` + `aria-modal="true"`
- Focus trap: Tab/Shift-Tab ciclam dentro do modal
- Escape fecha o modal
- Focus retorna ao elemento que abriu o modal ao fechar

### ConteÃºdo DinÃ¢mico
- AtualizaÃ§Ãµes ao vivo: `aria-live="polite"` com `aria-atomic="true"`
- NotificaÃ§Ãµes urgentes: `aria-live="assertive"`
- Indicador de loading: `aria-busy="true"` no container

### NavegaÃ§Ã£o por Teclado
- Todo elemento interativo deve ser focÃ¡vel e ativÃ¡vel via teclado
- Ordem de tab lÃ³gica (nÃ£o use `tabindex` > 0)
- Indicador de focus visÃ­vel e com contraste suficiente (nunca `outline: none` sem substituto)
- Atalhos de teclado para aÃ§Ãµes frequentes (com documentaÃ§Ã£o)

---

## Anti-Patterns (Nunca FaÃ§a)

- Layouts de card genÃ©ricos sem personalidade ou hierarquia
- Gradientes sem propÃ³sito (estÃ©tica "IA" sobreutilizada)
- EspaÃ§amento ou alinhamento inconsistente entre componentes similares
- Misturar mÃºltiplas direÃ§Ãµes estÃ©ticas nÃ£o relacionadas
- ConteÃºdo placeholder em cÃ³digo de produÃ§Ã£o ("Lorem ipsum")
- Ignorar layout mobile ou tratar como afterthought
- Usar `!important` ao invÃ©s de corrigir especificidade CSS
- Inline styles quando o framework oferece soluÃ§Ã£o melhor
- Cores hardcoded em vez de tokens/variÃ¡veis
- Ignorar estados (loading, error, empty) â€” "happy path only"
- AnimaÃ§Ãµes que bloqueiam interaÃ§Ã£o ou duram mais que 500ms
- Remover outline de focus sem substituto visÃ­vel

---

## Checklist de Qualidade Visual

Antes de finalizar qualquer componente de interface:

- [ ] Responsivo em todos os breakpoints (mobile, tablet, desktop)
- [ ] NavegÃ¡vel por teclado (ordem de tab, estados de focus visÃ­veis)
- [ ] AcessÃ­vel para leitores de tela (HTML semÃ¢ntico, ARIA onde necessÃ¡rio)
- [ ] Contraste WCAG AA validado (4.5:1 texto normal, 3:1 texto grande)
- [ ] Estado de loading projetado (skeleton ou spinner)
- [ ] Estado de erro projetado (com aÃ§Ã£o de recuperaÃ§Ã£o)
- [ ] Estado vazio projetado (com CTA)
- [ ] Consistente com a linguagem visual do projeto (tokens, espaÃ§amento, tipografia)
- [ ] Sem valores hardcoded â€” usa design tokens/variÃ¡veis
- [ ] AnimaÃ§Ãµes suaves (60fps, respeita `prefers-reduced-motion`)
- [ ] Ãrea de toque mÃ­nima 44x44px em elementos interativos
- [ ] FormulÃ¡rios com labels, error messages e validaÃ§Ã£o acessÃ­veis

---

## Quando Aplicar Este Skill

Este skill Ã© **carregado automaticamente** pelo Coder quando trabalha em tecnologias de UI:
- React, Next.js, Angular, Flutter, ou qualquer framework de interface

Ele complementa o skill da tecnologia:
- `ux-design.skill.md` â†’ **o que** projetar (princÃ­pios, acessibilidade, estados, tokens)
- `{tech}.skill.md` â†’ **como** implementar (padrÃµes de cÃ³digo, hooks, signals, etc.)
