# /z-execute-spec-kit {nome} [--onda N] [--dry-run] [--auto]

Executa o plano de implementação contido em `spec-kits/{nome}.spec-kit.md`, onda por onda.

**⚠️ REGRA DE LINGUAGEM: Toda comunicação DEVE ser em português brasileiro (pt-BR).**

---

## Passo 0 — Parse de Argumentos

Do input após `/z-execute-spec-kit`:

- Primeiro token não-flag → `nome` (aceitar com ou sem sufixo `.spec-kit.md`)
- `--onda N` → executar apenas a onda N (1-indexed)
- `--dry-run` → listar arquivos/passos sem editar nada
- `--auto` → não pausar entre ondas (continuar automaticamente). Sempre pausar se houver `[BLOQUEIO]` ou erro.

Se o nome não foi fornecido, listar os arquivos em `spec-kits/` e pedir ao humano que escolha.

---

## Passo 1 — Localizar e Validar o Spec Kit

1. Resolver caminho: `spec-kits/{nome}.spec-kit.md`. Se não existir, listar candidatos próximos e pedir confirmação.
2. Ler o arquivo. Extrair:
   - Header (`Status`)
   - Seção 6 (Critérios de Aceite)
   - Seção 8 (Análise Técnica — Mapa de Impacto, Padrões Reutilizáveis)
   - Seção 12 (Plano de Implementação — ondas)
   - Seção 13 (Verificação End-to-End), se existir
3. Validar:
   - Se `Status: draft` → perguntar ao humano: "Spec-kit ainda em draft. Confirma execução assim mesmo?"
   - Se `Status: done` → perguntar: "Spec-kit já marcado como concluído. Re-executar?"
   - Se Seção 12 não tem nenhuma onda → abortar com mensagem: "Plano de implementação ausente. Rode `/z-new-spec-kit` para gerar."

---

## Passo 2 — Selecionar Ondas a Executar

- Sem `--onda`: executar todas as ondas em ordem (respeitar a ordem em 12.2 quando explícita).
- Com `--onda N`: executar apenas a onda N. Se N inválido (ex: spec-kit só tem 2 ondas e usuário pediu 3), abortar.
- Apresentar ao humano antes de começar:

```
📄 Spec Kit: {título} ({nome}.spec-kit.md)
📋 Status: {status}
🌊 Ondas a executar: {lista}
🎯 Modo: {execução | dry-run}

Prosseguir? (s/n)
```

Aguardar confirmação (exceto em `--auto` se já houver contexto explícito).

---

## Passo 3 — Execução de Cada Onda

Para cada onda selecionada, em ordem:

### 3.1 — Apresentar a Onda
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌊 Onda {N} — {nome}
🎯 Objetivo: {objetivo}
📂 Arquivos: {N criar, N editar}
📝 Passos: {N}
✅ Critérios de pronto: {AC-XX, AC-YY}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3.2 — Modo `--dry-run`
Listar arquivos e passos sem ler conteúdo nem editar. Pular para próxima onda.

### 3.3 — Modo execução
1. Para cada arquivo a editar: usar `Read` antes de `Edit`. Para arquivo novo: usar `Write`.
2. Seguir os passos em ordem. Respeitar:
   - **Padrões Reutilizáveis** (Seção 8.2 do spec-kit) — referenciar funções/hooks/componentes citados ao invés de criar lógica nova equivalente.
   - **Restrições** (Seção 9) — stack, idempotência de migrações, etc.
   - **Premissas** (Seção 10) — assumir como verdade.
3. Ao final dos passos, executar a verificação da onda (campo "Critérios de pronto da onda").
4. Marcar os AC correspondentes na Seção 6 do spec-kit com `[x]` via `Edit`.
5. Reportar:

```
✅ Onda {N} concluída
📝 Arquivos alterados: {lista}
✅ AC marcados: {lista}
⚠️ Observações: {se houver}
```

### 3.4 — Checkpoint Entre Ondas
- Modo padrão: aguardar OK do humano antes da próxima onda ("Prosseguir para Onda {N+1}?").
- Modo `--auto`: continuar direto, exceto se a onda terminou com erro/bloqueio.

### 3.5 — Tratamento de Bloqueios
Se durante a execução surgir algo que impeça progresso (decisão de produto pendente, ambiguidade real, falha técnica não trivial):
1. Adicionar bloco `[BLOQUEIO] {descrição}` ao final da onda dentro do spec-kit (via `Edit`).
2. Parar a execução.
3. Apresentar ao humano com sugestões de resolução. Aguardar instrução.

---

## Passo 4 — Fechamento

Quando todas as ondas selecionadas concluírem com sucesso:

1. Se **todas** as ondas do spec-kit foram executadas e **todos** os AC da Seção 6 estão marcados:
   - Atualizar o header do spec-kit:
     - `**Status:** done`
     - Adicionar linha `**Concluído em:** {YYYY-MM-DD}`
2. Apresentar resumo final + sugerir verificação E2E (Seção 13) se existir:

```
🎉 {Spec Kit} executado com sucesso!

📊 Resumo:
   - {N} ondas concluídas
   - {N} arquivos alterados
   - {N} AC marcados como concluídos

▶️ Próximos passos sugeridos:
   1. Rodar verificação E2E (Seção 13 do spec-kit)
   2. /z-review-code  — revisão geral antes de commitar
   3. /z-git-commit   — commitar as alterações
```

---

## Regras Gerais

- **Nunca pular onda** sem confirmação humana (exceto `--auto` quando explicitamente solicitado).
- **Nunca alterar Seções 1-11 do spec-kit durante execução** — só Seção 6 (marcação de AC), Seção 12 (registro de bloqueio), e Header (Status/Concluído em).
- **Nunca executar** ações fora do escopo declarado no spec-kit. Se notar a necessidade, registrar como `[BLOQUEIO]` e perguntar.
- **Stack do projeto:** React + Vite + Supabase + IndexedDB. Respeitar padrões do `reef-system-app/` e `.claude/skills/react.skill.md`.
- Comunicação sempre em pt-BR.
