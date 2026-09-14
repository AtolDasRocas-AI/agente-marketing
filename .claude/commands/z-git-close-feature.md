# /z-git-close-feature — Fechar Branch de Feature

Ao receber este comando, fecha a branch de feature atual: commita e faz push do pendente, realiza merge na branch `developer`, faz push da developer e deleta a branch local e remota.

**⚠️ REGRA DE LINGUAGEM: Toda comunicação DEVE ser em português brasileiro (pt-BR).**

**Sintaxe:** `/z-git-close-feature [<repo>]`

---

## Passo 1 — Identificar o Repositório

Se `<repo>` foi informado como argumento (ex: `/z-git-close-feature frontend`):
- Usar `apps/{repo}` como diretório de trabalho

Se não foi informado:
- Listar repos em `apps/` que possuem branch `feature/*` ativa:
  ```bash
  for d in apps/*/; do echo "$d: $(git -C $d branch --show-current 2>/dev/null)"; done
  ```
- Se apenas um repo tiver branch de feature ativa, usar esse automaticamente
- Se múltiplos, perguntar ao usuário: "Em qual repositório deseja fechar a feature?"
- Aguardar resposta antes de continuar

---

## Passo 2 — Verificar Estado Atual

Execute:

```bash
git -C apps/{repo} status
git -C apps/{repo} branch --show-current
git -C apps/{repo} log developer..HEAD --oneline
```

---

## Passo 3 — Validar Branch

Se a branch atual **não** começa com `feature/`, avise o usuário:

```
⚠️ A branch atual ({branch}) em apps/{repo} não parece ser uma branch de feature.
Este comando foi criado para fechar branches do tipo feature/*.

Deseja continuar mesmo assim? (Sim/Não)
```

---

## Passo 4 — Apresentar Plano Completo e Solicitar Confirmação

Exiba ao usuário:

```
📋 Plano de fechamento da feature:

Repositório: apps/{repo}
Branch de feature: {branch-atual}
Branch de destino: developer

{SE houver mudanças pendentes:}
Arquivos com mudanças pendentes:
  {lista de arquivos modificados}

Commits que serão mergeados na developer:
  {lista do git log developer..HEAD --oneline}

Operações que serão executadas:
  {SE houver pendências:
    1. git add -u
    2. git commit -m "{mensagem gerada automaticamente}"
    3. git push origin {branch-atual}
  SENÃO:
    1. git push origin {branch-atual}  (garantir sync remoto)
  }
  {N}. git checkout developer
  {N}. git pull origin developer
  {N}. git merge {branch-atual}
  {N}. git push origin developer
  {N}. git branch -d {branch-atual}           (deletar local)
  {N}. git push origin --delete {branch-atual} (deletar remota)

🚨 ATENÇÃO — Operações irreversíveis:
  - A branch {branch-atual} será DELETADA local e remotamente
  - Certifique-se de que o código foi revisado antes de fechar a feature

Deseja prosseguir? (Sim/Não)
```

**Aguarde confirmação explícita antes de continuar.**

Se o usuário responder **Não** → encerre sem fazer nada.
Se o usuário responder **Sim** → prossiga para o Passo 5.

---

## Passo 5 — Executar

### 5.1 — Commit do Pendente (se houver)

Se `git status` indicou arquivos modificados:

Analise `git -C apps/{repo} diff` e gere mensagem seguindo Conventional Commits, então:

```bash
git -C apps/{repo} add -u
git -C apps/{repo} commit -m "{mensagem gerada}"
```

### 5.2 — Push da Feature

```bash
git -C apps/{repo} push origin {branch-atual}
```

### 5.3 — Merge na Developer

```bash
git -C apps/{repo} checkout developer
git -C apps/{repo} pull origin developer
git -C apps/{repo} merge {branch-feature}
```

Se o merge gerar conflitos → **pare imediatamente** e informe ao usuário:

```
❌ Conflito de merge detectado em apps/{repo}.
Por favor, resolva os conflitos manualmente e execute:
  cd apps/{repo}
  git add .
  git commit
  git push origin developer
  git branch -d {branch-feature}
  git push origin --delete {branch-feature}
```

### 5.4 — Push da Developer

```bash
git -C apps/{repo} push origin developer
```

### 5.5 — Deletar Branch Local e Remota

```bash
git -C apps/{repo} branch -d {branch-feature}
git -C apps/{repo} push origin --delete {branch-feature}
```

---

## Passo 6 — Confirmar ao Usuário

```
✅ Feature fechada com sucesso!

📦 Repositório: apps/{repo}
🔀 Merge realizado: {branch-feature} → developer
🚀 Push: origin/developer atualizado
🗑️ Branch deletada: {branch-feature} (local e remota)

{SE houve commit:}
🔖 Commit gerado: {mensagem do commit}
```
