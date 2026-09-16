// Gera estratégia e textos somente no servidor. A chave do provedor nunca chega ao navegador.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { extrairJson, respostaCors, respostaJson } from '../_shared/ig.ts';

const OPERACOES = new Set(['ESTRATEGIA', 'ANGULO', 'LEGENDA', 'CTA', 'PROMPT_IMAGEM']);

interface Pedido {
  content_item_id?: string;
  operacao?: string;
  idempotency_key?: string;
  com_texto_sobreposto?: boolean;
}

function codigoSeguro(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'code' in erro && typeof erro.code === 'string') {
    return erro.code.slice(0, 120);
  }
  return 'FALHA_PROVEDOR';
}

function numeroAmbiente(nome: string): number | null {
  const valor = Number(Deno.env.get(nome));
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

// Identidade visual REAL da ATOL — paleta e tipografia extraídas do próprio código do app
// (reef-system-app/src/styles/theme.css, "dark navy + lagoon teal + living coral + sand
// cream"), não uma aproximação de memória. Revalidar de tempos em tempos, já que o padrão
// visual pode evoluir.
const IDENTIDADE_VISUAL_ATOL = 'A marca é a ATOL IA, um app real de aquarismo marinho com IA ' +
  '("conectando você ao seu aquário"). Esta é a identidade visual REAL do produto (paleta e ' +
  'tipografia extraídas do próprio app, não uma aproximação): fundo escuro azul-marinho profundo ' +
  '(#061820, #0a2230, #0e2a3f, #173b50), texto em areia clara (#f2e8d6), acentos turquesa/lagoa ' +
  '(#5cc5be, #2ba7a8, #9fe0e1) e coral vivo (#ed9079, #dc6e58), com toques pontuais de areia ' +
  '(#ebdfc9), musgo (#5c9d8e) e alga (#8fb873). O símbolo da marca é um atol visto de cima: um anel ' +
  'de recife colorido (corais-cérebro, corais-chifre e corais moles em amarelo, verde, laranja e ' +
  'azul-turquesa) envolvendo uma lagoa turquesa com uma ilhota de areia clara e um pequeno farol ' +
  'listrado de vermelho e branco. Use essa paleta real como base cromática da cena e, quando fizer ' +
  'sentido pro post sem forçar, o motivo de recife/atol/lagoa/farol como referência temática. A ' +
  'cena continua sendo uma fotografia profissional realista (não um desenho ou ilustração como o ' +
  'logotipo em si). Não tente redesenhar o logotipo nem escrever "ATOL" na imagem — isso é aplicado ' +
  'depois, por fora da imagem gerada; a etapa seguinte de geração de imagem já recebe fotos e telas ' +
  'reais do app como referência visual adicional. "Profissionalizar" aqui significa melhorar ' +
  'nitidez, iluminação e composição dentro desse padrão real — nunca trocar o estilo nem abandonar ' +
  'essas características.';

// Posts "informativos" (checklist/dica/estatística) não devem ter o texto desenhado pela
// própria IA de imagem — modelos de geração de imagem erram grafia com frequência (é
// exatamente o defeito que motivou isto: uma imagem de exemplo saiu com "Testas da Água",
// "Fococato" etc.). O padrão de mercado é a IA gerar só o FUNDO, e o texto (exato, extraído
// do briefing) ser composto por cima depois, de forma determinística (ver EstrategiaConteudo.tsx).
const INSTRUCAO_TEXTO_SOBREPOSTO = [
  'Este post é INFORMATIVO: o texto principal (título e itens) será desenhado por cima da ' +
  'imagem depois, de forma separada e exata — a IA de imagem não escreve esse texto.',
  'Por isso, estruture DUAS chaves: prompt_imagem (a cena de FUNDO) e texto_overlay (um ' +
  'objeto com "titulo" opcional e "itens": um array de 3 a 5 strings curtas), extraídas do ' +
  'conteúdo já rascunhado abaixo — nunca invente informação que não esteja lá.',
  'Na descrição de prompt_imagem, instrua explicitamente para NÃO desenhar nenhum texto, ' +
  'número, letra, rótulo ou legenda na cena, e deixar uma área visualmente limpa e com bom ' +
  'contraste (ex.: terço inferior mais escuro/uniforme, ou uma lateral com menos elementos) ' +
  'para receber esse texto por cima depois.',
].join(' ');

const INSTRUCAO_TEXTO_NA_CENA = 'Se a imagem tiver qualquer texto, legenda, botão, rótulo de ' +
  'interface ou logotipo com texto visível, esse texto deve estar em português do Brasil — ' +
  'nunca em inglês.';

function promptPara(
  item: Record<string, unknown>,
  operacao: string,
  conteudoAprovado: Record<string, unknown> | null,
  comTextoSobreposto: boolean,
): string {
  const instrucaoDeCampos = operacao === 'PROMPT_IMAGEM'
    ? [
        comTextoSobreposto
          ? 'Estruture as chaves: prompt_imagem (descrição visual longa e detalhada, em português do Brasil, pronta para um gerador de imagem) e texto_overlay (ver instrução específica abaixo).'
          : 'Estruture só a chave: prompt_imagem (descrição visual longa e detalhada, em português do Brasil, pronta para um gerador de imagem).',
        'Ordem de prioridade ao decidir o que a imagem mostra, da mais importante pra menos importante — nunca inverta essa ordem: ',
        '(1) a ideia/mensagem central deste post (objetivo, pilar, hipótese e o conteúdo já rascunhado abaixo — estratégia, ângulo, legenda, CTA); a imagem existe para comunicar essa ideia específica, não para ser uma foto bonita genérica desconectada do assunto;',
        '(2) a identidade visual da marca ATOL: ' + IDENTIDADE_VISUAL_ATOL + ' Além disso, qualquer elemento visual, cor ou característica de marca que já apareça no conteúdo rascunhado abaixo também precisa se refletir na cena — a peça tem que ser reconhecível como ATOL, nunca uma imagem de banco de imagens sem marca nenhuma;',
        '(3) só depois de (1) e (2) estarem claros, refine com técnica de fotografia profissional (câmera, lente, luz, enquadramento) — isso é um meio de deixar a cena que já representa a ideia e a marca mais bonita e realista, nunca o assunto principal da descrição. Para cena fotográfica: câmera/lente coerentes com a tendência atual de fotografia comercial/editorial (ex.: "85mm f/1.4" pra retrato com fundo desfocado, "24-35mm" pra grande angular, lente macro pra detalhe de coral/peixe), luz, enquadramento, profundidade de campo. Para telas de app/mockup: fotografia de produto em estúdio.',
        'Nunca deixe o detalhe técnico de fotografia tomar tanto espaço da descrição que a cena perca a ligação com a ideia do post ou com a marca — se tiver que escolher, ideia e marca vêm sempre antes de qualquer refinamento fotográfico.',
        'A cena inteira precisa ser coerente: todos os elementos combinam entre si e com o briefing, sem nada forçado ou colado artificialmente só para "encaixar" um conceito. Evite qualquer característica que entregue a imagem como gerada por IA à primeira vista — anatomia e proporções corretas quando houver pessoas ou animais, sombras e iluminação consistentes, texturas realistas, nunca composição genérica de banco de imagens.',
        comTextoSobreposto ? INSTRUCAO_TEXTO_SOBREPOSTO : INSTRUCAO_TEXTO_NA_CENA,
      ].join(' ')
    : 'Estruture sempre as chaves: estrategia, angulo, legenda, cta, hashtags, alt_text. Escreva com qualidade profissional de copywriting, sempre em português do Brasil.';
  return [
    'Você é o assistente editorial da ATOL. Responda exclusivamente JSON válido, sem markdown.',
    'Todo o conteúdo de texto da resposta deve estar em português do Brasil, nunca em inglês ou outro idioma — isso vale para todas as operações, incluindo PROMPT_IMAGEM.',
    'Não invente métricas, pesquisas ou promessas.',
    'Operação pedida: ' + operacao + '.',
    instrucaoDeCampos,
    'briefing:',
    JSON.stringify({
      titulo: item.titulo,
      objetivo: item.objetivo,
      publico: item.publico,
      pilar: item.pilar,
      formato: item.formato,
      data_planejada: item.data_planejada,
      hipotese: item.hipotese,
    }),
    ...(conteudoAprovado
      ? [
          'conteúdo já rascunhado para este post, agrupado por etapa editorial (ESTRATEGIA, ANGULO, LEGENDA, CTA). '
          + 'Considere TODAS as etapas presentes, não só uma: a cena precisa refletir o ângulo editorial, a mensagem '
          + 'da legenda e a chamada para ação em conjunto, nunca apenas a última etapa gerada.',
          JSON.stringify(conteudoAprovado),
        ]
      : []),
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respostaCors();
  if (req.method !== 'POST') return respostaJson({ codigo: 'METODO_NAO_PERMITIDO' }, 405);

  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
  const modelo = Deno.env.get('MARKETING_AI_TEXT_MODEL');
  const custoEstimado = numeroAmbiente('MARKETING_AI_ESTIMATED_COST_USD');
  if (!openRouterKey || !modelo || !custoEstimado) {
    return respostaJson({
      codigo: 'CONFIGURACAO_IA_AUSENTE',
      mensagem: 'A IA ainda não está configurada no servidor. Nenhuma chamada foi feita.',
    }, 503);
  }

  let aiRunId: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;
  try {
    const pedido = await req.json() as Pedido;
    if (
      !pedido.content_item_id
      || !pedido.idempotency_key
      || !pedido.operacao
      || !OPERACOES.has(pedido.operacao)
    ) {
      return respostaJson({ codigo: 'PEDIDO_INVALIDO' }, 400);
    }

    const auth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: usuarioData } = await auth.auth.getUser();
    const usuario = usuarioData.user;
    if (!usuario) return respostaJson({ codigo: 'NAO_AUTENTICADO' }, 401);

    const { data: item, error: itemErro } = await auth
      .from('marketing_content_item')
      .select('id,workspace_id,titulo,objetivo,publico,pilar,formato,data_planejada,hipotese,status')
      .eq('id', pedido.content_item_id)
      .maybeSingle();
    if (itemErro) throw itemErro;
    if (!item) return respostaJson({ codigo: 'BRIEFING_NAO_ENCONTRADO' }, 404);
    if (['IDEIA', 'EM_BRIEFING', 'PUBLICADO'].includes(item.status)) {
      return respostaJson({
        codigo: 'BRIEFING_INCOMPLETO',
        mensagem: 'Complete o briefing antes de pedir conteúdo à IA.',
      }, 422);
    }

    // O prompt de imagem precisa nascer do conteúdo editorial já rascunhado (estratégia/
    // ângulo/legenda/cta), não só do briefing abstrato — senão a cena perde a ligação com
    // o que a equipe já decidiu para este post especificamente.
    // Pega a versão mais recente de CADA operação, identificada por etapa: antes só a
    // última geração entrava, então pedir a imagem logo depois de gerar o CTA descartava
    // estratégia, ângulo e legenda já aprovados.
    let conteudoAprovado: Record<string, unknown> | null = null;
    if (pedido.operacao === 'PROMPT_IMAGEM') {
      const { data: versoes, error: versaoErro } = await auth
        .from('marketing_content_version')
        .select('operacao,conteudo')
        .eq('content_item_id', item.id)
        .neq('operacao', 'PROMPT_IMAGEM')
        .order('criado_em', { ascending: false });
      if (versaoErro) throw versaoErro;
      const porOperacao = new Map<string, unknown>();
      for (const versao of versoes ?? []) {
        if (!porOperacao.has(versao.operacao)) porOperacao.set(versao.operacao, versao.conteudo);
      }
      conteudoAprovado = porOperacao.size > 0 ? Object.fromEntries(porOperacao) : null;
    }

    admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: execucao, error: inicioErro } = await admin.rpc('marketing_iniciar_execucao_ia', {
      p_workspace_id: item.workspace_id,
      p_content_item_id: item.id,
      p_solicitado_por: usuario.id,
      p_operacao: pedido.operacao,
      p_provedor: 'openrouter',
      p_modelo: modelo,
      p_limite_tokens: 1200,
      p_idempotency_key: pedido.idempotency_key,
      p_custo_estimado: custoEstimado,
    });
    if (inicioErro) throw inicioErro;
    aiRunId = execucao.id;
    if (execucao.status === 'BLOQUEADO') {
      return respostaJson({
        codigo: execucao.erro_codigo,
        mensagem: 'A geração foi bloqueada pelo orçamento do workspace.',
        ai_run_id: execucao.id,
      }, 429);
    }
    if (execucao.status === 'CONCLUIDO') {
      return respostaJson({ ai_run_id: execucao.id, status: 'CONCLUIDO_REUTILIZADO' });
    }
    if (execucao.status !== 'EXECUTANDO') {
      return respostaJson({ codigo: 'EXECUCAO_NAO_DISPONIVEL', ai_run_id: execucao.id }, 409);
    }

    const resposta = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + openRouterKey,
        'Content-Type': 'application/json',
        'X-OpenRouter-Metadata': 'enabled',
        'X-OpenRouter-Title': 'ATOL Studio Marketing',
      },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: 'system', content: 'Você produz conteúdo editorial estruturado para revisão humana.' },
          { role: 'user', content: promptPara(item, pedido.operacao, conteudoAprovado, Boolean(pedido.com_texto_sobreposto)) },
        ],
        max_tokens: 1200,
        temperature: 0.5,
        // sem response_format: nao é suportado da mesma forma por todo modelo/provedor no
        // OpenRouter (json_object/json_schema variam por endpoint) — a instrucao no prompt
        // pedindo JSON puro já é suficiente e funciona com qualquer modelo.
      }),
    });
    const corpo = await resposta.json();
    if (!resposta.ok) {
      const erro = new Error('OPENROUTER_HTTP_' + resposta.status) as Error & { code?: string };
      erro.code = 'OPENROUTER_HTTP_' + resposta.status;
      throw erro;
    }

    const texto = corpo?.choices?.[0]?.message?.content;
    if (typeof texto !== 'string') {
      const erro = new Error('RESPOSTA_IA_INVALIDA') as Error & { code?: string };
      erro.code = 'RESPOSTA_IA_INVALIDA';
      throw erro;
    }
    let conteudo: Record<string, unknown>;
    try {
      conteudo = extrairJson(texto);
    } catch {
      const erro = new Error('RESPOSTA_IA_INVALIDA') as Error & { code?: string };
      erro.code = 'RESPOSTA_IA_INVALIDA';
      throw erro;
    }
    if (!conteudo || Array.isArray(conteudo) || typeof conteudo !== 'object') {
      const erro = new Error('RESPOSTA_IA_NAO_E_OBJETO') as Error & { code?: string };
      erro.code = 'RESPOSTA_IA_NAO_E_OBJETO';
      throw erro;
    }

    const { data: versao, error: fimErro } = await admin.rpc('marketing_finalizar_execucao_ia', {
      p_ai_run_id: aiRunId,
      p_resposta: conteudo,
      p_tokens_entrada: Math.max(0, Number(corpo?.usage?.prompt_tokens ?? 0)),
      p_tokens_saida: Math.max(0, Number(corpo?.usage?.completion_tokens ?? 0)),
      p_custo_real: Math.max(0, Number(corpo?.usage?.cost ?? custoEstimado)),
    });
    if (fimErro) throw fimErro;

    return respostaJson({
      ai_run_id: aiRunId,
      versao_id: versao.id,
      conteudo: versao.conteudo,
      custo_real: corpo?.usage?.cost ?? custoEstimado,
    });
  } catch (erro) {
    if (aiRunId && admin) {
      await admin.rpc('marketing_falhar_execucao_ia', {
        p_ai_run_id: aiRunId,
        p_erro_codigo: codigoSeguro(erro),
      });
    }
    console.error('marketing-gerar-conteudo:', codigoSeguro(erro));
    return respostaJson({
      codigo: 'GERACAO_INDISPONIVEL',
      mensagem: 'Não foi possível gerar o conteúdo agora. O briefing foi preservado.',
    }, 502);
  }
});
