# /z-review-code — Revisão Geral de Código

Ao receber este comando, realize uma revisão completa do código alterado (sem card associado).

**⚠️ REGRA DE LINGUAGEM: Toda comunicação DEVE ser em português brasileiro (pt-BR).**

---

## Persona

Assuma o papel de **arquiteto de software sênior**. Esta revisão deve ser:
- **Rigorosa:** Não tolerar atalhos, anti-patterns ou dívida técnica silenciosa
- **Propositiva:** Vá além do checklist genérico — sugira melhorias que elevem a qualidade
- **Educativa:** Explique o "porquê" de cada achado, referenciando princípios de engenharia
- **Pragmática:** Avalie aderência a padrões do framework, oportunidades de melhoria e qualidade arquitetural

---

## Passo 1 — Identificar Escopo

Identifique os arquivos a revisar:

```bash
git diff --name-only developer
```

Se não houver branch `developer`, tente `develop` ou `main`. Se não houver histórico git, peça ao usuário os arquivos/módulos a revisar.

---

## Passo 1.5 — Carregar Skills dos Apps Afetados

Identificar os apps afetados pelos arquivos listados no diff:

1. Para cada app (identificado pelo path, e.g. `apps/backend/`), ler `apps/{app}/CLAUDE.md`
2. Carregar o skill indicado na seção `## Skill`
3. Se o CLAUDE.md não indicar skill, usar mapeamento padrão:
   - Frontend (React): `.claude/skills/react.skill.md`
   - Frontend (Next.js): `.claude/skills/nextjs.skill.md`
   - Frontend (Angular): `.claude/skills/angular.skill.md`
   - Backend (NestJS): `.claude/skills/nestjs.skill.md`
   - Backend (Spring Boot): `.claude/skills/spring-boot.skill.md`
   - Backend (Python): `.claude/skills/python.skill.md`
   - Desktop (Tauri): `.claude/skills/tauri.skill.md`
4. Para tecnologias de UI (React, Next.js, Angular), TAMBÉM carregar `.claude/skills/ux-design.skill.md`
5. Se os arquivos não estiverem dentro de `apps/`, verificar se há um `CLAUDE.md` na raiz do repo com seção `## Skill`

Os skills carregados serão usados como referência adicional no Passo 2.

---

## Passo 2 — Checklist de Revisão

### Arquitetura e Estrutura

- [ ] Segue a estrutura de pastas definida no `CLAUDE.md` do repo?
- [ ] Responsabilidades bem separadas (controller/service/repository)?
- [ ] Sem lógica de negócio em controllers ou componentes de UI?
- [ ] Módulos/features são auto-contidos?

### Qualidade de Código

- [ ] TypeScript strict sem `any`
- [ ] Nomenclatura segue as convenções (kebab-case arquivos, PascalCase classes)
- [ ] Funções pequenas e focadas (< 30 linhas preferencialmente)
- [ ] Sem código duplicado
- [ ] Sem código morto/comentado
- [ ] Tratamento de erros adequado (sem catch vazio)

### Segurança

- [ ] Inputs validados via DTOs/Zod
- [ ] Sem dados sensíveis hardcoded
- [ ] Sem SQL/NoSQL injection (queries parametrizadas)
- [ ] CORS configurado corretamente

### Performance

- [ ] Queries com indexes adequados
- [ ] Sem N+1 queries
- [ ] Paginação implementada em listagens
- [ ] Lazy loading no frontend quando aplicável

### Testes

- [ ] Testes unitários para lógica de negócio
- [ ] Testes cobrem cenários de erro
- [ ] Mocks adequados (não mockando demais)

### Documentação

- [ ] `docs/` atualizado para as mudanças feitas?
- [ ] Comentários em pontos de decisão não óbvios?

### Aderência ao Skill (framework-specific)

Com base nos skills carregados no Passo 1.5:
- [ ] Arquitetura de camadas/módulos conforme o skill?
- [ ] Padrões do framework aplicados corretamente (decorators, hooks, lifecycle)?
- [ ] Anti-patterns documentados no skill estão ausentes?
- [ ] Ferramentas do ecossistema usadas corretamente (e.g. TanStack Query vs useEffect para server state, Mongoose vs driver raw)?
- [ ] Checklists de qualidade e performance do skill atendidos?
- [ ] Convenções de nomenclatura do framework respeitadas?
- [ ] Padrões de composição do framework aplicados (e.g. custom hooks, modules, compound components)?

---

## Passo 3 — Relatório

Apresente os findings organizados por severidade:

- 🔴 **Crítico**: Deve ser corrigido (bugs, segurança, quebra de contrato, violações "NUNCA" do skill)
- 🟡 **Importante**: Deveria ser corrigido (code smells, falta de testes, violações de aderência ao skill)
- 🔵 **Sugestão**: Pode ser melhorado (legibilidade, performance, DX)

Para cada finding, inclua:

1. Arquivo e linha
2. Problema identificado
3. Sugestão de correção com código exemplo

---

## Passo 3.5 — Propostas de Melhoria

Após apresentar os achados, listar proativamente oportunidades de melhoria:

- **🔧 Ajuste na atividade corrente** — melhorias pequenas que cabem no escopo atual
- **📋 Novo spec-kit** — melhorias significativas que merecem `/z-new-spec-kit` próprio

Para cada proposta, incluir:
1. Área afetada (arquivo ou módulo)
2. Proposta concreta
3. Justificativa técnica (referenciando o skill quando aplicável)
4. Estimativa de esforço (P/M/G)

Incluir pelo menos 1 proposta por revisão, se houver oportunidade genuína. Não forçar propostas artificiais.

### Formato

```markdown
### Propostas de Melhoria

| # | Tipo | Área | Proposta | Justificativa | Esforço |
|---|---|---|---|---|---|
| 1 | 🔧 Ajuste | {área} | {proposta} | {justificativa} | {P/M/G} |
| 2 | 📋 Backlog | {área} | {proposta} | {justificativa} | {P/M/G} |
```

---

## Passo 4 — Correções (se solicitado)

Se o usuário pedir para corrigir, aplique as correções seguindo a ordem de severidade (crítico primeiro).
