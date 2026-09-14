# Fundação Marketing — validação das migrações 0013 e 0014

## Estado atual

As migrações foram validadas localmente e aplicadas, com autorização, exclusivamente no projeto Supabase **Sorteio** (uakwbtmbhwifiekwmsbq):

| Migração | Versão remota | Estado |
| --- | --- | --- |
| 0013_marketing_foundation | 20260914212813 | Aplicada |
| 0014_security_and_idempotency | 20260914230357 | Aplicada |

Esses arquivos passam a ser imutáveis. Qualquer alteração posterior deve ser uma nova migração. Nenhum deploy de frontend foi realizado nesta etapa.

## Gate automático

Na raiz do projeto:

    npm run check

O comando executa, nesta ordem:

1. varredura de segredos nos arquivos rastreados;
2. aplicação de 0013 e 0014 em PostgreSQL descartável (PGlite);
3. testes do frontend;
4. lint;
5. build de produção.

O banco descartável reproduz os papéis anon, authenticated e service_role, incluindo BYPASSRLS, além de uma implementação mínima de auth.uid().

## Garantias automatizadas

- criação das seis tabelas marketing_* e ativação de RLS;
- bloqueio de acesso anônimo e de sessão sem usuário;
- criação idempotente de workspace e de briefing;
- rejeição quando a mesma chave idempotente é reutilizada com payload diferente;
- separação entre administrador e revisor;
- isolamento entre workspaces;
- classificação e edição otimista de briefing;
- rejeição de escrita direta pelo cliente autenticado;
- proteção do último administrador;
- auditoria das mutações e ledger append-only;
- FKs compostas impedindo referências entre workspaces;
- resultado único por sorteio;
- bloqueio de exclusão direta de resultado;
- funções internas não executáveis por anon ou authenticated;
- RLS fail-closed na tabela legada _migracoes, quando existente;
- índices para as FKs identificadas pelo advisor;
- rollback integral quando uma falha é induzida antes do commit.

## Verificação remota concluída

- get_project_url confirmou https://uakwbtmbhwifiekwmsbq.supabase.co.
- list_migrations confirmou as versões 20260914212813 e 20260914230357.
- A aplicação de 0014 começa verificando resultados duplicados e aborta integralmente se encontrar conflito.
- O advisor deixou de apontar FKs sem índice, search_path mutável em bloquear_mutacao e funções internas disponíveis anonimamente.

Avisos remanescentes não justificam mudança cega:

- tabelas deliberadamente fail-closed com RLS e nenhuma policy;
- extensão pg_net no schema público;
- RPCs SECURITY DEFINER que são a API autenticada intencional do produto;
- políticas que recalculam funções de autenticação por linha;
- índices novos ou ainda sem tráfego registrados como não utilizados;
- proteção contra senhas vazadas desabilitada no Auth.

Os itens de desempenho devem ser medidos com dados reais. A proteção contra senhas vazadas deve ser habilitada no painel antes do go-live. Mudanças em extensões exigem ensaio separado.

## Limites da validação local

PGlite executa PostgreSQL real em WebAssembly, mas não substitui o Data API, o Auth e concorrência entre conexões reais do Supabase. Permanecem como gates antes do deploy:

1. smoke test autenticado da agenda no app;
2. criação e retomada de briefing após recarregar a página;
3. teste de conflito com duas abas;
4. teste com administrador, revisor e não membro em dois workspaces;
5. confirmação de que Sorteios permanece funcional;
6. rotação da credencial de banco exposta no histórico Git;
7. backup operacional e plano de rollback por migração corretiva.

## Operação segura

- Usar SUPABASE_DB_URL ou DATABASE_URL; nunca colocar a senha em scripts.
- Manter TLS com validação de certificado.
- Usar o histórico oficial de migrations do Supabase como única fonte de verdade.
- Não editar 0013 ou 0014 após a aplicação.
- Não limpar nem reescrever o histórico Git sem autorização específica e backup.
