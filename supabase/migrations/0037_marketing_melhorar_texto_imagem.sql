-- ATOL Studio — agente que melhora o texto sobreposto de um post informativo (título e
-- itens) antes da composição. É uma chamada de modelo como qualquer outra, então precisa
-- passar pelo controle de orçamento — daí a nova operação no check de marketing_ai_run.
-- Não gera marketing_content_version: usa o par de RPCs "_livre", porque o resultado é um
-- texto devolvido para revisão imediata na tela, não uma versão editorial do briefing.

begin;
set local lock_timeout = '5s';

alter table public.marketing_ai_run drop constraint marketing_ai_run_operacao_check;
alter table public.marketing_ai_run add constraint marketing_ai_run_operacao_check check (operacao in (
  'ESTRATEGIA', 'ANGULO', 'LEGENDA', 'CTA', 'PROMPT_IMAGEM',
  'CLASSIFICAR_COMENTARIO', 'GERAR_INSIGHT', 'GERAR_IMAGEM', 'ANALISAR_POST',
  'MELHORAR_TEXTO_IMAGEM'
));

commit;
