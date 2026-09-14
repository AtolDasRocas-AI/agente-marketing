# /z-git-commit — Commit de Arquivos Rastreados

Ao receber este comando, realize um commit dos arquivos rastreados com mudanças pendentes.
Se recebido com `--push`, também faz push para a branch remota após o commit.

**⚠️ REGRA DE LINGUAGEM: Toda comunicação DEVE ser em português brasileiro (pt-BR).**

**Sintaxe:** `/z-git-commit [<repo>] [--push]`

---

## Passo 1 — Identificar o Repositório

Se `<repo>` foi informado como argumento (ex: `/z-git-commit apps/frontend`):
- Usar `apps/{repo}` como diretório de trabalho

Se não foi informado:
- Listar os diretórios em `apps/`:
  ```bash
  ls apps/
  ```
- Perguntar ao usuário: "Em qual repositório deseja fazer o commit? (ex: frontend, backend)"
- Aguardar resposta antes de continuar

---

## Passo 2 — Verificar Estado do Repositório

Execute no diretório do repo escolhido:

```bash
git -C apps/{repo} status
git -C apps/{repo} diff --stat
```

Se `--push` foi passado, também execute:
```bash
git -C apps/{repo} remote -v
```

---

## Passo 3 — Apresentar Resumo e Solicitar Confirmação

Exiba ao usuário:

```
📋 Resumo das operações a serem realizadas:

Repositório: apps/{repo}
Branch atual: {branch}
{SE --push: Repositório remoto: {remote URL}}

Arquivos modificados (rastreados):
  {lista de arquivos com git diff --stat}

⚠️ Atenção:
  - Apenas arquivos já rastreados pelo git serão incluídos (git add -u)
  - Arquivos novos não rastreados NÃO serão incluídos
  {SE --push: - O push enviará as mudanças para o repositório REMOTO (origin/{branch})}

Operações:
  1. git add -u
  2. git commit -m "{mensagem gerada}"
  {SE --push: 3. git push origin {branch}}

Deseja prosseguir? (Sim/Não)
```

**Aguarde confirmação explícita antes de continuar.**

Se o usuário responder **Não** → encerre sem fazer nada.
Se o usuário responder **Sim** → prossiga para o Passo 4.

---

## Passo 4 — Analisar as Mudanças e Gerar Mensagem

Execute:

```bash
git -C apps/{repo} diff
```

Gere mensagem seguindo as convenções de Conventional Commits:
- Formato: `<tipo>(<escopo>): <descrição>`
- Tipos: feat, fix, docs, style, refactor, test, chore, perf
- Escopo: nome do repo ou módulo afetado

---

## Passo 5 — Executar

```bash
git -C apps/{repo} add -u
git -C apps/{repo} commit -m "{mensagem gerada}"
```

Se `--push`:
```bash
git -C apps/{repo} push origin {branch}
```

---

## Passo 6 — Confirmar ao Usuário

```
✅ Commit {SE --push: e push }realizado(s) com sucesso!

📦 Repositório: apps/{repo}
🔖 Mensagem: {mensagem do commit}
📁 Arquivos commitados: {N}
🌿 Branch: {branch}
{SE --push: 🚀 Push: origin/{branch}}
{SE NÃO --push:
Para enviar ao repositório remoto:
  /z-git-commit {repo} --push}
```
