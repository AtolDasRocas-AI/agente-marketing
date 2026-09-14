# /z-git-create-feature — Criar Nova Branch de Feature

Ao receber este comando com um nome como argumento (ex: `/z-git-create-feature novo-modulo`), cria a branch `feature/novo-modulo` baseada na branch `developer` atualizada.

**⚠️ REGRA DE LINGUAGEM: Toda comunicação DEVE ser em português brasileiro (pt-BR).**

**Sintaxe:** `/z-git-create-feature <nome> [<repo>]`

---

## Passo 1 — Validar Argumentos

Se nenhum nome de feature foi fornecido, peça ao usuário:

```
Qual é o nome da feature? (ex: /z-git-create-feature meu-modulo)
```

O nome da branch será: `feature/{argumento}` (em kebab-case).

---

## Passo 2 — Identificar o Repositório

Se `<repo>` foi informado como segundo argumento (ex: `/z-git-create-feature novo-modulo frontend`):
- Usar `apps/{repo}` como diretório de trabalho

Se não foi informado:
- Listar os diretórios em `apps/`:
  ```bash
  ls apps/
  ```
- Perguntar ao usuário: "Em qual repositório deseja criar a feature? (ex: frontend, backend)"
- Aguardar resposta antes de continuar

---

## Passo 3 — Verificar Estado Atual

Execute:

```bash
git -C apps/{repo} status
git -C apps/{repo} branch --show-current
```

---

## Passo 4 — Apresentar Plano e Solicitar Confirmação

Exiba ao usuário:

```
📋 Plano de execução:

Repositório: apps/{repo}
Branch atual: {branch-atual}
Nova branch: feature/{nome}
Base: developer (será atualizada via pull)

{SE houver mudanças pendentes:}
⚠️ Você tem mudanças não commitadas:
  {lista de arquivos modificados}
  → Será feito git stash automático antes de mudar de branch
  → O stash será restaurado na nova branch após sua criação

Operações que serão executadas:
  {SE houver pendências: 1. git stash}
  {N}. git checkout developer
  {N}. git pull origin developer
  {N}. git checkout -b feature/{nome}
  {N}. {SE houver stash: git stash pop}

⚠️ Atenção:
  - A branch developer será atualizada com o remoto antes de criar a nova branch
  - Se houver conflitos no pull da developer, você será notificado para resolver manualmente

Deseja prosseguir? (Sim/Não)
```

**Aguarde confirmação explícita antes de continuar.**

Se o usuário responder **Não** → encerre sem fazer nada.
Se o usuário responder **Sim** → prossiga para o Passo 5.

---

## Passo 5 — Executar

### 5.1 — Stash (se houver mudanças pendentes)

Se `git status` indicou arquivos modificados:

```bash
git -C apps/{repo} stash push -m "z-git-create-feature: stash antes de criar feature/{nome}"
```

### 5.2 — Atualizar Developer

```bash
git -C apps/{repo} checkout developer
git -C apps/{repo} pull origin developer
```

Se o pull gerar conflitos → **pare imediatamente** e informe ao usuário:

```
❌ Conflito detectado ao atualizar a branch developer em apps/{repo}.
Por favor, resolva os conflitos manualmente e execute o comando novamente.

{SE foi feito stash:}
⚠️ Suas mudanças estão salvas no stash. Para recuperá-las:
  cd apps/{repo} && git stash pop
```

### 5.3 — Criar Nova Branch

```bash
git -C apps/{repo} checkout -b feature/{nome}
```

### 5.4 — Restaurar Stash (se aplicável)

Se foi feito stash no passo 5.1:

```bash
git -C apps/{repo} stash pop
```

Se o stash pop gerar conflitos → informe ao usuário para resolver manualmente.

---

## Passo 6 — Confirmar ao Usuário

```
✅ Branch criada com sucesso!

📦 Repositório: apps/{repo}
🌿 Branch atual: feature/{nome}
📦 Base: developer (atualizada)
{SE havia stash: 📋 Mudanças anteriores restauradas do stash}

Para fechar esta feature quando terminar, execute:
  /z-git-close-feature {repo}
```
