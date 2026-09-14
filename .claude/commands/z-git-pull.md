# /z-git-pull — Pull nos Repositórios

Ao receber este comando, realiza `git pull` nos repositórios dentro de `apps/`.
Se um repositório específico for informado, opera apenas nele. Caso contrário, opera em todos.

**⚠️ REGRA DE LINGUAGEM: Toda comunicação DEVE ser em português brasileiro (pt-BR).**

**Sintaxe:** `/z-git-pull [<repo>]`

---

## Passo 1 — Identificar Repositórios

Se `<repo>` foi informado como argumento (ex: `/z-git-pull backend`):
- Usar `apps/{repo}` como diretório de trabalho
- Verificar se o diretório existe; se não, informar erro e encerrar

Se não foi informado:
- Listar os diretórios em `apps/`:
  ```bash
  ls apps/
  ```
- Operar em **todos** os repositórios encontrados

---

## Passo 2 — Verificar Estado de Cada Repositório

Para **cada** repositório, execute:

```bash
git -C apps/{repo} branch --show-current
git -C apps/{repo} status --porcelain
git -C apps/{repo} log @{u}.. --oneline 2>/dev/null
```

### 2.1 — Mudanças não commitadas

Se `git status --porcelain` retornar algo (arquivos modificados, não rastreados, etc.):

```
⚠️ Repositório apps/{repo} possui mudanças não commitadas:
  {lista de arquivos}

Este repositório NÃO pode receber pull com mudanças pendentes.
Opções:
  1. Pular este repositório
  2. Fazer commit primeiro (/z-git-commit {repo})
  3. Cancelar toda a operação

O que deseja fazer?
```

**Aguardar resposta do usuário antes de continuar.**

### 2.2 — Commits locais não pushados

Se `git log @{u}..` retornar commits:

```
⚠️ Repositório apps/{repo} possui commits locais não enviados ao remoto:
  {lista de commits}

O pull pode gerar um merge commit ou conflitos.
Opções:
  1. Continuar mesmo assim (pull com possível merge)
  2. Fazer push primeiro (/z-git-commit {repo} --push)
  3. Pular este repositório
  4. Cancelar toda a operação

O que deseja fazer?
```

**Aguardar resposta do usuário antes de continuar.**

---

## Passo 3 — Apresentar Plano e Solicitar Confirmação

Após verificar todos os repositórios, exiba o resumo:

```
📋 Resumo do pull:

{Para cada repo que será atualizado:}
  📦 apps/{repo} — Branch: {branch}
{Para cada repo pulado:}
  ⏭️ apps/{repo} — Pulado ({motivo})

Operações que serão executadas em cada repositório:
  1. git fetch origin
  2. git pull origin {branch}

Deseja prosseguir? (Sim/Não)
```

**Aguarde confirmação explícita antes de continuar.**

Se o usuário responder **Não** → encerre sem fazer nada.
Se o usuário responder **Sim** → prossiga para o Passo 4.

---

## Passo 4 — Executar Pull

Para cada repositório aprovado, execute:

```bash
git -C apps/{repo} fetch origin
git -C apps/{repo} pull origin {branch}
```

### Tratamento de Conflitos

Se o pull gerar conflitos de merge → **pare imediatamente** e informe ao usuário:

```
❌ Conflito de merge detectado em apps/{repo}!

Arquivos com conflito:
  {lista de arquivos conflitantes}

O pull foi interrompido. Você precisa resolver os conflitos manualmente:
  cd apps/{repo}
  # Edite os arquivos conflitantes
  git add .
  git commit

⚠️ Os repositórios restantes NÃO foram atualizados.
Deseja continuar o pull nos demais repositórios? (Sim/Não)
```

**Aguardar resposta do usuário.**

---

## Passo 5 — Confirmar ao Usuário

```
✅ Pull concluído!

{Para cada repo atualizado com sucesso:}
  ✅ apps/{repo} — Branch: {branch} — Atualizado com sucesso
{Para cada repo pulado:}
  ⏭️ apps/{repo} — Pulado
{Para cada repo com erro:}
  ❌ apps/{repo} — Erro: {descrição}

📊 Resumo: {N} atualizado(s), {N} pulado(s), {N} erro(s)
```
