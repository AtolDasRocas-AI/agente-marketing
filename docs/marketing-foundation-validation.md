# Fundação Marketing — plano de validação da migração 0013

## Estado e limite desta etapa

A migração `0013_marketing_foundation.sql` foi endurecida apenas no repositório local. Ela não está autorizada para aplicação remota. Este roteiro deve ser executado primeiro em um banco PostgreSQL/Supabase descartável, sem reutilizar credenciais ou dados de produção.

## Gates automáticos atuais

Na raiz do projeto:

```text
npm test
```

Esse comando executa as garantias estáticas da migração e toda a suíte do frontend. O teste estático confirma a presença de RLS nas seis tabelas, FKs compostas por workspace, idempotência, proteção do último administrador, auditoria e ledger append-only, controle otimista e ausência de escrita direta sensível.

O teste estático não interpreta SQL e não substitui os cenários abaixo em PostgreSQL real.

## Pré-condições para o banco descartável

- Confirmar que o ambiente não contém dados ou credenciais reais.
- Aplicar as migrações `0001` a `0013` em ordem e em uma base recém-criada.
- Usar ao menos três usuários de teste: administrador, revisor e não membro.
- Criar dois workspaces independentes para os testes de isolamento.
- Manter logs da aplicação das migrações e das asserções, sem tokens ou dados pessoais.

## Casos P0 de esquema e privilégios

1. As seis tabelas `marketing_*` existem com RLS habilitada.
2. `anon` não possui acesso às tabelas nem às RPCs.
3. `authenticated` possui somente leitura direta; mutações ocorrem pelas RPCs concedidas.
4. Todas as funções `SECURITY DEFINER` têm `search_path` vazio e proprietário confiável.
5. Nenhum objeto `sorteio*`, função Meta, segredo ou política existente é modificado.
6. Uma falha durante a `0013` desfaz o arquivo inteiro, sem objetos parciais.

## Casos P0 de workspace e membros

1. Usuário não autenticado não cria workspace.
2. A mesma `idempotency_key` retorna o mesmo workspace para o mesmo criador.
3. Uma chave diferente cria outro workspace.
4. O bootstrap cria exatamente um membro `ADMINISTRADOR`.
5. Revisor e não membro não adicionam, removem ou promovem membros.
6. Alteração direta de `marketing_member` falha.
7. Remoção ou rebaixamento do último administrador falha.
8. Com dois administradores e duas sessões concorrentes, somente uma remoção/rebaixamento pode concluir se a outra deixaria o workspace sem administrador.
9. `workspace_id`, `user_id` e `criado_em` de uma associação não podem ser alterados.

## Casos P0 de briefing e isolamento

1. Somente título gera `IDEIA`.
2. Qualquer campo editorial adicional gera `EM_BRIEFING`.
3. Preparar estratégia exige todos os campos e gera `PRONTO_PARA_ESTRATEGIA`.
4. Atualização com a versão esperada incrementa `versao` e preserva identidade e criação.
5. Atualização com versão antiga falha como conflito.
6. Um briefing em etapa posterior a `PRONTO_PARA_ESTRATEGIA` não volta pelo RPC genérico.
7. Usuário do workspace A não lê nem altera conteúdo do workspace B.
8. Alterações de `id`, `workspace_id`, `criado_por` e `criado_em` falham, inclusive com escrita privilegiada.

## Casos P0 de auditoria

1. Criação e atualização de workspace, membros, briefing, execução de IA e ledger geram exatamente um evento por mutação.
2. O ator é derivado da sessão; operações sem usuário são marcadas como `SISTEMA`.
3. Cliente autenticado não insere eventos diretamente.
4. `UPDATE` e `DELETE` de eventos falham inclusive com `service_role`.
5. Metadados que não sejam objeto ou excedam 32 KiB falham.
6. Workspace com auditoria não pode ser removido fisicamente.

## Casos P0 de IA e custos

1. `ai_run` do workspace A não referencia conteúdo do workspace B.
2. Ledger do workspace A não referencia execução do workspace B.
3. Chave de idempotência repetida no mesmo workspace falha.
4. Custos negativos ou `NaN`, moeda minúscula e limites de tokens inválidos falham.
5. Estados finais exigem `concluido_em`; estados em andamento não o aceitam.
6. `ESTORNO` exige lançamento anterior no mesmo workspace e um lançamento só pode ser estornado uma vez.
7. `UPDATE` e `DELETE` do ledger falham, inclusive com `service_role`.

## Critério para aplicação remota

A aplicação remota permanece **NO-GO** até que:

- seja confirmado no histórico do ambiente que a versão anterior da `0013` nunca foi aplicada;
- todos os casos P0 passem em banco descartável;
- exista backup e procedimento de rollback validado;
- o diff final receba aprovação de Banco, Arquitetura e QA;
- a aplicação remota seja autorizada explicitamente.

Após a primeira aplicação, a `0013` torna-se imutável. Qualquer correção deve ser uma nova migração.
