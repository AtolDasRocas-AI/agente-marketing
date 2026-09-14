# /z-new-spec-kit — Levantamento Iterativo de Demanda + Plano de Implementação

Quando este comando for recebido, conduza um levantamento profundo e iterativo da demanda do humano, combinando reflexão sobre o codebase existente com ciclos de clarificação, até produzir um **spec-kit completo com plano de implementação executável embutido**.

**⚠️ REGRA DE LINGUAGEM: Toda comunicação DEVE ser em português brasileiro (pt-BR).**

**Você atua como Senior PO + Senior Architect + Spec Analyst.** Seu objetivo é entender profundamente a demanda e já entregar um plano acionável. Não aceite respostas vagas. Desafie premissas. Explore edge cases. O spec-kit resultante deve ser completo o suficiente para que o próximo passo seja apenas executar (`/z-execute-spec-kit`).

**Filosofia:** Inspirado no [GitHub Spec Kit](https://github.com/github/spec-kit) — foco em **O QUE e POR QUÊ**. O **COMO** vive na Seção 12 (Plano de Implementação), separado da especificação conceitual.

---

## Passo 0 — Reconhecimento do Codebase

Antes de iniciar a entrevista, obter contexto técnico silenciosamente:

1. Ler, se existirem:
   - `reef-system-app/CLAUDE.md`
   - `melhorias.md`, `plano_arquitetura_aquario.md`, `database_analysis.md`, `code_review.md` na raiz
2. Ler `.claude/skills/react.skill.md` (stack principal: React + Vite + Supabase + IndexedDB).
3. Listar `spec-kits/` para verificar se já existe spec-kit cobrindo tema similar (evitar duplicação).
4. Identificar módulos, padrões e features existentes relacionados à demanda.
5. Produzir contexto interno (não mostrar ao humano — usar para informar a entrevista e desafiar premissas).

---

## Passo 1 — Entrevista Inicial (Fase de Descoberta)

Foco em **O QUE e POR QUÊ**, nunca em COMO. Conduzir em blocos:

### Bloco 1 — Visão:

1. **Qual o nome desta demanda?** (será usado no nome do arquivo spec-kit, em kebab-case)
2. **Qual problema estamos resolvendo? Por que agora?**
   - Se vago: "Qual é o impacto quantificável desse problema hoje? Existe workaround?"
3. **Quem são os usuários/stakeholders afetados?**
4. **Qual o resultado ideal quando estiver pronto?** (critérios mensuráveis)

### Bloco 2 — Escopo:

5. **Quais são as capacidades principais que devem existir?** (listar como itens)
6. **O que explicitamente NÃO faz parte do escopo?** — Insistir, é crítico para evitar scope creep
7. **Há restrições conhecidas?** (técnicas, prazo, compliance)

### Bloco 3 — Contexto (informado pelo Passo 0):

8. **Apresentar achados do codebase:** "Encontrei que [módulos/features existentes] são relacionados. Isso muda algo no seu entendimento do escopo?"
9. **Há referências externas?** (mockups, docs, exemplos, benchmarks)

### Regras da entrevista:
- Não aceitar respostas vagas — reformular com opções concretas
- Desafiar premissas de escopo construtivamente
- Marcar áreas com `[PRECISA CLARIFICAÇÃO]` quando a resposta for insuficiente
- Se a demanda parecer muito ampla, sinalizar mas **não interromper** — o loop de clarificação vai refinar

---

## Passo 2 — Relatório de Reflexão Técnica

Após a entrevista inicial, fazer análise profunda cruzando as respostas com o codebase. Apresentar ao humano como **"Relatório de Reflexão Técnica"**:

### 2.1 — Mapa de Impacto
Quais módulos, arquivos e APIs serão tocados:

```
| Módulo | Caminho | Tipo de Mudança |
|---|---|---|
```

### 2.2 — Padrões Reutilizáveis
Código e módulos existentes que podem ser aproveitados (com caminhos).

### 2.3 — Gaps Identificados
Áreas da demanda que ainda precisam de mais detalhes. Listar cada gap com:
- O que está indefinido
- Por que é importante definir
- Sugestão de como resolver

### 2.4 — Riscos e Tensões
Conflitos com arquitetura existente, complexidade oculta, dívida técnica potencial.

### 2.5 — Alternativas
Abordagens diferentes que o humano pode não ter considerado. Para cada:
- O que muda
- Prós e contras
- Recomendação

### 2.6 — Perguntas de Clarificação
Lista numerada de perguntas derivadas da reflexão técnica. Alimentam o Passo 3.

---

## Passo 3 — Loop de Clarificação Iterativo

**Este é o coração do spec-kit.** O loop continua até que não haja mais gaps pendentes.

### Mecânica:

```
ENQUANTO existirem [PRECISA CLARIFICAÇÃO] no rascunho interno:
  1. Apresentar lista de gaps pendentes com contexto do porquê importam
  2. Fazer perguntas direcionadas (máximo 3-5 por rodada)
  3. Receber respostas do humano
  4. Atualizar rascunho interno do spec
  5. Re-analisar: novas respostas revelaram novos gaps?
  6. Se sim → nova rodada
  7. Se não → apresentar resumo do que foi resolvido
```

### Categorias de perguntas:

- **Edge cases:** "O que acontece se X falhar? E se o usuário tentar Y?"
- **Critérios de aceite:** "Como saberemos que isso está funcionando? Qual o critério mensurável?"
- **Integração:** "Como isso interage com [módulo existente]?"
- **Performance:** "Qual volume esperado? Qual latência aceitável?"
- **Segurança/privacidade:** "Há dados sensíveis envolvidos? Quem pode acessar?"
- **Fronteiras:** "Até onde vai a responsabilidade desta feature vs adjacentes?"
- **Priorização:** "Se tivesse que entregar em metade do tempo, o que cortaria?"

### Condição de saída:

O agente declara: **"Não identifiquei mais gaps pendentes."** e pergunta:
- "Há algo mais que você gostaria de adicionar ou ajustar?"

Se o humano responder "não" **duas vezes consecutivas**, o loop encerra e avança para o Passo 4.

### Regras:
- Cada rodada: **no máximo 5 perguntas**
- Mostrar progresso: "Resolvemos X de Y gaps. Restam Z."
- Se o humano parecer impaciente, oferecer: "Posso prosseguir com premissas razoáveis e marcar como [PREMISSA] no documento. Concorda?"
- Premissas assumidas devem ser explicitamente marcadas no documento final

---

## Passo 4 — Síntese do Spec Kit

Gerar o documento usando o template abaixo. **Todas as seções são obrigatórias** — a Seção 12 (Plano de Implementação) é o que torna o spec-kit executável.

```markdown
# Spec Kit: {Título da Demanda}

**Criado em:** {YYYY-MM-DD}
**Status:** draft
**Escopo:** {ex: reef-system-app, raiz, docs}

---

## Context
{Por que esta demanda existe, qual problema resolve, qual o impacto esperado, em 2-4 parágrafos.}

---

## 1. Visão e Motivação
{Problema, situação atual, resultado ideal}

## 2. Usuários e Stakeholders
| Persona | Descrição | Necessidades Principais |
|---|---|---|

## 3. Capacidades Desejadas
- CAP-01: {capacidade}
- CAP-02: {capacidade}

## 4. Fora do Escopo
{O que explicitamente NÃO será feito}

## 5. Cenários e Edge Cases
| # | Cenário | Comportamento Esperado | Prioridade |
|---|---|---|---|

## 6. Critérios de Aceite
- [ ] AC-01: {critério mensurável}
- [ ] AC-02: {critério mensurável}

## 7. Requisitos Não-Funcionais
- **Performance:** {targets concretos}
- **Offline/Sync:** {requisitos}
- **Acessibilidade:** {requisitos WCAG}
- **Compatibilidade:** {padrões a respeitar}

## 8. Análise Técnica

### 8.1 Mapa de Impacto
| Módulo | Caminho | Tipo de Mudança |
|---|---|---|

### 8.2 Padrões Reutilizáveis
{Código existente que pode ser aproveitado, com caminhos}

### 8.3 Riscos e Complexidades
| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|

### 8.4 Alternativas Consideradas
| # | Alternativa | Prós | Contras | Recomendação |
|---|---|---|---|---|

## 9. Restrições e Dependências
{Restrições técnicas, prazo, compliance, dependências externas}

## 10. Premissas Assumidas
{Itens marcados como [PREMISSA] durante o loop}

## 11. Perguntas Resolvidas
| # | Pergunta | Resposta | Rodada |
|---|---|---|---|

## 12. Plano de Implementação

### 12.1 Ondas

_Se o trabalho couber em uma única passada, registrar apenas Onda 1. Dividir em ondas adicionais somente quando: (a) ondas posteriores dependem do feedback/uso da anterior, (b) há cortes verticais de valor independentes que podem ser entregues separadamente, ou (c) o escopo total ultrapassa ~15 arquivos._

#### Onda 1 — {nome curto}
**Objetivo:** {valor entregue ao final desta onda — frase única}

**Arquivos:**
- `caminho/arquivo.ts` — criar | editar — {o que muda em 1 linha}
- `caminho/outro.tsx` — editar — {o que muda}

**Passos:**
1. {passo concreto, citando função/símbolo afetado e referência ao padrão reutilizável quando aplicável}
2. {próximo passo}
3. ...

**Critérios de pronto da onda:** AC-XX, AC-YY + {verificação manual específica}

#### Onda 2 — {nome curto} (opcional)
... mesmo formato ...

### 12.2 Ordem de Execução
{Dependências entre ondas, ou "Linear" se sequencial. Ex: "Onda 2 depende da migração SQL da Onda 1."}

## 13. Verificação End-to-End
{Passos numerados para validar a feature inteira após todas as ondas — comandos exatos, cenários de uso, queries SQL se aplicável.}
```

---

## Passo 5 — Revisão Final com Humano

Apresentar o documento completo e perguntar:

- "Este spec kit captura tudo que você tinha em mente?"
- "O plano de implementação na Seção 12 está executável? Algum passo precisa ser mais granular?"
- "Há algo que você gostaria de adicionar, remover ou ajustar?"

Se houver ajustes:
1. Incorporar as mudanças
2. Reapresentar as seções afetadas
3. Repetir até aprovação

Quando o humano aprovar, atualizar `**Status:**` de `draft` para `approved`.

---

## Passo 6 — Salvar e Orientar

1. Salvar em `spec-kits/{nome-da-demanda}.spec-kit.md` (nome em kebab-case, derivado do título).
2. Apresentar confirmação:

```
✅ Spec Kit criado com sucesso!

📄 Arquivo: spec-kits/{nome}.spec-kit.md

📊 Resumo:
   - {N} capacidades documentadas
   - {N} critérios de aceite
   - {N} cenários/edge cases
   - {N} riscos técnicos
   - {N} clarificações resolvidas
   - {N} premissas assumidas
   - {N} onda(s) de implementação

▶️ Para executar:
   /z-execute-spec-kit {nome}

   Onda específica:
   /z-execute-spec-kit {nome} --onda 1

   Pré-visualizar sem editar:
   /z-execute-spec-kit {nome} --dry-run
```
