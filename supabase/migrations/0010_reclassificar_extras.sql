-- ============================================================
-- Reclassifica o histórico com a semântica nova.
--
-- Só mexe em rótulos (tabela qualificacao). A tabela `chance` e os
-- resultados já gravados NÃO são tocados — o hash_lista de sorteios
-- executados continua válido.
-- ============================================================

-- comentários extras de quem já tinha chance
update qualificacao
   set status = 'EXTRA'
 where status = 'DESQUALIFICADO'
   and motivo in ('DUPLICADO', 'TETO_EXCEDIDO');

-- suspeitas viram habilitados (heurísticas agora desligadas por padrão)
update qualificacao
   set status = 'HABILITADO', motivo = null
 where status = 'SUSPEITO';
