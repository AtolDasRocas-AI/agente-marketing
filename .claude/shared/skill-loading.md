# Skill Loading — Protocolo Compartilhado

Protocolo de carregamento dinâmico de skills. **Referenciado por:** Coder, Code Reviewer, QA Agent, z-review-code.

---

## Passo 1 — Identificar Skill do App

1. Ler o `CLAUDE.md` do app afetado (em `apps/{app}/CLAUDE.md`)
2. Procurar a seção `## Skill`
3. Se encontrada: carregar o arquivo `.claude/skills/{skill-indicado}.skill.md`
4. Se não encontrada: usar o mapeamento padrão abaixo

---

## Mapeamento Padrão

| Tecnologia detectada | Skill File |
|---|---|
| React | `react.skill.md` |
| Next.js | `nextjs.skill.md` |
| Angular | `angular.skill.md` |
| NestJS | `nestjs.skill.md` |
| Spring Boot | `spring-boot.skill.md` |
| Python / FastAPI | `python.skill.md` |
| Tauri | `tauri.skill.md` |

---

## Passo 2 — Auto-load UX Design

Para tecnologias de **UI** (React, Next.js, Angular), **TAMBÉM** carregar `.claude/skills/ux-design.skill.md` automaticamente.

Isso garante padrões de:
- Design tokens, tipografia, cores e contraste
- Layout, espaçamento e motion
- Acessibilidade (WCAG AA)
- Estados de componentes e anti-patterns

---

## Skills Disponíveis

| Categoria | Skills |
|---|---|
| Frontend | `react.skill.md`, `nextjs.skill.md`, `angular.skill.md` |
| Backend | `nestjs.skill.md`, `spring-boot.skill.md`, `python.skill.md` |
| Desktop | `tauri.skill.md` |
| Cross-cutting | `ux-design.skill.md` (auto-load para UI) |

---

## Fallback

Se a skill não puder ser carregada (arquivo não existe):
- Informar via log que o skill não foi encontrado
- Prosseguir com best practices genéricas
- Registrar no card como observação
