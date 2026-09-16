import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Icone } from '../../components/Icone';
import { obterRepositorioMarketingRemoto, type ConteudoMarketingRemoto } from './repositoryRemote';
import {
  arquivoParaBase64, carregarOrcamentoIa, comporImagemComTexto, configurarOrcamentoIa, decidirAprovacaoConteudo,
  formatarUsd, FORMATOS_IMAGEM, gerarConteudoIa, gerarImagemIa, listarAprovacoesConteudo, listarImagensGeradas,
  listarVersoesIa, melhorarTextoImagem, obterPapelMarketing, OPERACOES_IA, solicitarAprovacaoConteudo,
  TELAS_DO_APP, urlAssinadaImagem,
  type AprovacaoConteudo, type FormatoImagem, type ImagemGerada, type OperacaoIa, type OrcamentoIa,
  type PapelMarketing, type TextoOverlay, type VersaoConteudoIa,
} from './aiRemote';
import { comporImagemInformativa } from './composicaoImagem';

const ROTULOS_OPERACAO: Record<OperacaoIa, string> = {
  ESTRATEGIA: 'Estratégia completa',
  ANGULO: 'Ângulo editorial',
  LEGENDA: 'Legenda',
  CTA: 'Chamada para ação',
  PROMPT_IMAGEM: 'Prompt de imagem',
};

function textoDaVersao(conteudo: Record<string, unknown>, chave: string) {
  const valor = conteudo[chave];
  return typeof valor === 'string' ? valor : '';
}

// A IA indica, a partir do briefing, quais telas do app fazem sentido neste post. Vira a
// seleção inicial do revisor, que continua livre para trocar.
function telasSugeridasDaVersao(conteudo: Record<string, unknown>): string[] {
  const valor = conteudo.telas_sugeridas;
  if (!Array.isArray(valor)) return [];
  return valor.filter((tela): tela is string => typeof tela === 'string' && tela in TELAS_DO_APP).slice(0, 2);
}

function textoOverlayDaVersao(conteudo: Record<string, unknown>): TextoOverlay | null {
  const valor = conteudo.texto_overlay;
  if (!valor || typeof valor !== 'object') return null;
  const objeto = valor as Record<string, unknown>;
  if (!Array.isArray(objeto.itens) || !objeto.itens.every((item) => typeof item === 'string')) return null;
  return {
    titulo: typeof objeto.titulo === 'string' ? objeto.titulo : undefined,
    itens: objeto.itens as string[],
  };
}

interface DadosEstrategia {
  item: ConteudoMarketingRemoto;
  orcamento: OrcamentoIa | null;
  versoes: VersaoConteudoIa[];
  aprovacoes: AprovacaoConteudo[];
  papel: PapelMarketing | null;
  imagens: ImagemGerada[];
}

async function carregarDadosEstrategia(id: string): Promise<DadosEstrategia | null> {
  const repositorio = obterRepositorioMarketingRemoto();
  const item = await repositorio.buscar(id);
  if (!item) return null;
  const [orcamento, versoes, aprovacoes, papel, imagens] = await Promise.all([
    carregarOrcamentoIa(item.workspace_id),
    listarVersoesIa(item.id),
    listarAprovacoesConteudo(item.id),
    obterPapelMarketing(item.workspace_id),
    listarImagensGeradas(item.id),
  ]);
  return { item, orcamento, versoes, aprovacoes, papel, imagens };
}

export function EstrategiaConteudoMarketing() {
  const { id } = useParams();
  const [item, setItem] = useState<ConteudoMarketingRemoto | null>(null);
  const [orcamento, setOrcamento] = useState<OrcamentoIa | null>(null);
  const [versoes, setVersoes] = useState<VersaoConteudoIa[]>([]);
  const [aprovacoes, setAprovacoes] = useState<AprovacaoConteudo[]>([]);
  const [papel, setPapel] = useState<PapelMarketing | null>(null);
  const [imagens, setImagens] = useState<ImagemGerada[]>([]);
  const [urlsImagem, setUrlsImagem] = useState<Record<string, string>>({});
  const [imagemExpandida, setImagemExpandida] = useState<string | null>(null);
  const [textoAjuste, setTextoAjuste] = useState<Record<string, string>>({});
  const [arquivoReferencia, setArquivoReferencia] = useState<Record<string, File | null>>({});
  const [informativo, setInformativo] = useState(false);
  const [formatoImagem, setFormatoImagem] = useState<FormatoImagem>('FEED');
  // Por versão: cada prompt tem sua própria sugestão da IA, e a escolha manual só sobrescreve
  // aquela versão (undefined = ainda usando a sugestão).
  const [telasPorVersao, setTelasPorVersao] = useState<Record<string, string[]>>({});
  // Texto editado à mão por versão (undefined = ainda usando o que a IA gerou).
  const [textoEditado, setTextoEditado] = useState<Record<string, TextoOverlay>>({});
  const [instrucaoMelhoria, setInstrucaoMelhoria] = useState<Record<string, string>>({});
  const [melhorandoTexto, setMelhorandoTexto] = useState<string | null>(null);
  const [composicoesPreview, setComposicoesPreview] = useState<Record<string, string>>({});
  const [compondo, setCompondo] = useState<string | null>(null);
  const [salvandoComposicao, setSalvandoComposicao] = useState<string | null>(null);
  const [operacao, setOperacao] = useState<OperacaoIa>('ESTRATEGIA');
  const [mensal, setMensal] = useState('0');
  const [porExecucao, setPorExecucao] = useState('0');
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [gerandoImagem, setGerandoImagem] = useState<string | null>(null);
  const [salvandoOrcamento, setSalvandoOrcamento] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  async function recarregar() {
    if (!id) return;
    const dados = await carregarDadosEstrategia(id);
    if (!dados) {
      setItem(null);
      return;
    }
    setItem(dados.item);
    setOrcamento(dados.orcamento);
    setMensal(String(dados.orcamento?.limite_mensal_usd ?? 0));
    setPorExecucao(String(dados.orcamento?.limite_por_execucao_usd ?? 0));
    setVersoes(dados.versoes);
    setAprovacoes(dados.aprovacoes);
    setPapel(dados.papel);
    setImagens(dados.imagens);
  }

  useEffect(() => {
    let ativo = true;
    if (!id) return () => { ativo = false; };
    carregarDadosEstrategia(id)
      .then((dados) => {
        if (!ativo) return;
        if (!dados) {
          setItem(null);
          return;
        }
        setItem(dados.item);
        setOrcamento(dados.orcamento);
        setMensal(String(dados.orcamento?.limite_mensal_usd ?? 0));
        setPorExecucao(String(dados.orcamento?.limite_por_execucao_usd ?? 0));
        setVersoes(dados.versoes);
        setAprovacoes(dados.aprovacoes);
        setPapel(dados.papel);
        setImagens(dados.imagens);
      })
      .catch((causa: unknown) => {
        if (ativo) setErro(causa instanceof Error ? causa.message : 'Não foi possível abrir o assistente.');
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [id]);

  async function salvarOrcamento() {
    if (!item) return;
    setErro('');
    setAviso('');
    setSalvandoOrcamento(true);
    try {
      const budget = await configurarOrcamentoIa(
        item.workspace_id,
        Number(mensal),
        Number(porExecucao),
      );
      setOrcamento(budget);
      setAviso('Orçamento salvo. A geração continua bloqueada até existir uma chave configurada no servidor.');
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível salvar o orçamento.');
    } finally {
      setSalvandoOrcamento(false);
    }
  }

  async function gerar() {
    if (!item) return;
    setErro('');
    setAviso('');
    setGerando(true);
    try {
      await gerarConteudoIa(item.id, operacao, operacao === 'PROMPT_IMAGEM' && informativo);
      await recarregar();
      setAviso('Versão gerada e registrada para revisão humana.');
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível gerar conteúdo.');
    } finally {
      setGerando(false);
    }
  }

  async function enviarParaAprovacao(versaoId: string) {
    if (!item) return;
    setErro(''); setAviso('');
    try {
      await solicitarAprovacaoConteudo(item.workspace_id, item.id, versaoId);
      await recarregar();
      setAviso('Versão enviada para aprovação humana.');
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível enviar para aprovação.');
    }
  }

  function telasDaVersao(versao: VersaoConteudoIa): string[] {
    return telasPorVersao[versao.id] ?? telasSugeridasDaVersao(versao.conteudo);
  }

  async function gerarImagem(versao: VersaoConteudoIa, comAjuste = false) {
    const versaoId = versao.id;
    setErro(''); setAviso(''); setGerandoImagem(versaoId);
    try {
      const arquivo = arquivoReferencia[versaoId] ?? undefined;
      await gerarImagemIa(versaoId, comAjuste ? {
        textoAjuste: textoAjuste[versaoId],
        imagemReferenciaBase64: arquivo ? await arquivoParaBase64(arquivo) : undefined,
      } : undefined, formatoImagem, telasDaVersao(versao));
      await recarregar();
      if (comAjuste) {
        setTextoAjuste((atual) => ({ ...atual, [versaoId]: '' }));
        setArquivoReferencia((atual) => ({ ...atual, [versaoId]: null }));
      }
      setAviso('Imagem gerada a partir do prompt aprovado.');
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível gerar a imagem.');
    } finally {
      setGerandoImagem(null);
    }
  }

  async function abrirImagem(storagePath: string) {
    if (urlsImagem[storagePath]) return urlsImagem[storagePath];
    const url = await urlAssinadaImagem(storagePath);
    if (url) setUrlsImagem((atual) => ({ ...atual, [storagePath]: url }));
    return url;
  }

  async function baixarImagem(storagePath: string) {
    const url = await abrirImagem(storagePath);
    if (!url) return;
    const resposta = await fetch(url);
    const blob = await resposta.blob();
    const urlLocal = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = urlLocal;
    link.download = storagePath.split('/').pop() ?? 'imagem-atol.png';
    link.click();
    URL.revokeObjectURL(urlLocal);
  }

  function textoDeTrabalho(versao: VersaoConteudoIa): TextoOverlay | null {
    return textoEditado[versao.id] ?? textoOverlayDaVersao(versao.conteudo);
  }

  function atualizarTexto(versaoId: string, atual: TextoOverlay, mudanca: Partial<TextoOverlay>) {
    setTextoEditado((anterior) => ({ ...anterior, [versaoId]: { ...atual, ...mudanca } }));
  }

  async function melhorarTexto(versaoId: string, atual: TextoOverlay) {
    setErro(''); setAviso(''); setMelhorandoTexto(versaoId);
    try {
      const sugestao = await melhorarTextoImagem(versaoId, atual, instrucaoMelhoria[versaoId]);
      setTextoEditado((anterior) => ({ ...anterior, [versaoId]: sugestao }));
      setInstrucaoMelhoria((anterior) => ({ ...anterior, [versaoId]: '' }));
      setAviso('Texto reescrito pela IA. Revise antes de compor.');
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível melhorar o texto.');
    } finally {
      setMelhorandoTexto(null);
    }
  }

  async function comporTexto(imagemBaseId: string, storagePath: string, textoOverlay: TextoOverlay) {
    setErro(''); setAviso(''); setCompondo(imagemBaseId);
    try {
      const url = await abrirImagem(storagePath);
      if (!url) throw new Error('Não foi possível abrir a imagem de fundo.');
      const composta = await comporImagemInformativa(url, textoOverlay, formatoImagem);
      setComposicoesPreview((atual) => ({ ...atual, [imagemBaseId]: composta }));
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível compor o texto sobre a imagem.');
    } finally {
      setCompondo(null);
    }
  }

  async function salvarComposicao(imagemBaseId: string, textoOverlay: TextoOverlay) {
    const composta = composicoesPreview[imagemBaseId];
    if (!composta) return;
    setErro(''); setAviso(''); setSalvandoComposicao(imagemBaseId);
    try {
      await comporImagemComTexto(imagemBaseId, composta, textoOverlay);
      await recarregar();
      setComposicoesPreview((atual) => Object.fromEntries(Object.entries(atual).filter(([id]) => id !== imagemBaseId)));
      setAviso('Composição salva.');
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível salvar a composição.');
    } finally {
      setSalvandoComposicao(null);
    }
  }

  async function decidir(approvalId: string, aprovar: boolean) {
    if (!item) return;
    setErro(''); setAviso('');
    try {
      await decidirAprovacaoConteudo(item.workspace_id, approvalId, aprovar);
      await recarregar();
      setAviso(aprovar ? 'Versão aprovada. A publicação ainda é manual.' : 'Versão devolvida para revisão.');
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível registrar a decisão.');
    }
  }

  if (!id) return <Navigate to="/marketing/agenda" replace />;
  if (carregando) return <div className="sx-wrap--narrow"><div className="sx-empty sx-card">Carregando assistente…</div></div>;
  if (!item) return <Navigate to="/marketing/agenda" replace state={{ aviso: 'O briefing não foi encontrado.' }} />;

  const pronto = !['IDEIA', 'EM_BRIEFING', 'PUBLICADO'].includes(item.status);
  const orcamentoAtivo = Boolean(
    orcamento && orcamento.limite_mensal_usd > 0 && orcamento.limite_por_execucao_usd > 0,
  );

  return (
    <div className="sx-wrap--narrow">
      <header className="sx-head">
        <p className="ra-eyebrow">Marketing · Assistente</p>
        <h1 className="sx-h1">Estratégia de <em>conteúdo</em></h1>
        <p className="sx-lede">A IA prepara uma versão revisável. Nada é publicado automaticamente.</p>
      </header>

      {erro && <div className="sx-note sx-note--warn" role="alert">{erro}</div>}
      {aviso && <div className="sx-note" role="status">{aviso}</div>}

      <section className="sx-card sx-card--pad sm-form">
        <p className="sx-step"><b>Briefing</b> {item.titulo}</p>
        <p className="sx-hint">{item.objetivo}</p>
        {!pronto && (
          <div className="sx-note sx-note--warn">
            Complete o briefing e use “Preparar estratégia” antes de pedir sugestões à IA.
          </div>
        )}
        <div className="sx-field">
          <label htmlFor="operacao-ia">O que preparar</label>
          <select
            id="operacao-ia"
            className="sx-input"
            value={operacao}
            onChange={(event) => setOperacao(event.target.value as OperacaoIa)}
          >
            {OPERACOES_IA.map((valor) => <option key={valor} value={valor}>{ROTULOS_OPERACAO[valor]}</option>)}
          </select>
        </div>
        {operacao === 'PROMPT_IMAGEM' && (
          <label className="sx-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={informativo} onChange={(event) => setInformativo(event.target.checked)} />
            Este post é informativo (checklist/dica/estatística com texto sobre a imagem)
          </label>
        )}
        <button className="sx-btn sx-btn--primary" type="button" onClick={() => void gerar()} disabled={!pronto || !orcamentoAtivo || gerando}>
          <Icone nome="mais" tamanho={15} />
          {gerando ? 'Gerando…' : 'Gerar versão para revisão'}
        </button>
        {!orcamentoAtivo && <p className="sx-hint" style={{ marginTop: 10 }}>Defina um teto abaixo para liberar a geração.</p>}
      </section>

      <section className="sx-card sx-card--pad sm-form" style={{ marginTop: 16 }}>
        <p className="sx-step"><b>Proteção de custo</b> Limites do workspace</p>
        <p className="sx-hint">O teto mensal e o máximo por execução são conferidos no banco antes de qualquer chamada externa.</p>
        <div className="sm-grid-2">
          <div className="sx-field">
            <label htmlFor="orcamento-mensal">Máximo mensal (USD)</label>
            <input id="orcamento-mensal" className="sx-input" inputMode="decimal" value={mensal} onChange={(event) => setMensal(event.target.value)} />
          </div>
          <div className="sx-field">
            <label htmlFor="orcamento-execucao">Máximo por execução (USD)</label>
            <input id="orcamento-execucao" className="sx-input" inputMode="decimal" value={porExecucao} onChange={(event) => setPorExecucao(event.target.value)} />
          </div>
        </div>
        <button className="sx-btn" type="button" onClick={() => void salvarOrcamento()} disabled={salvandoOrcamento}>
          {salvandoOrcamento ? 'Salvando…' : 'Salvar limites'}
        </button>
        {orcamento && <p className="sx-hint" style={{ marginTop: 10 }}>Ativo: {formatarUsd(orcamento.limite_mensal_usd)} por mês · {formatarUsd(orcamento.limite_por_execucao_usd)} por execução.</p>}
      </section>

      <section style={{ marginTop: 20 }}>
        <p className="sx-step"><b>Versões</b> Histórico revisável</p>
        {versoes.length === 0 ? (
          <div className="sx-empty sx-card">Ainda não há versões geradas para este briefing.</div>
        ) : (
          <div className="sm-agenda">
            {versoes.map((versao) => (
              <article className="sm-item" key={versao.id}>
                <div className="sm-item-main">
                  <div className="sm-item-top">
                    <h2>{ROTULOS_OPERACAO[versao.operacao]} · v{versao.numero}</h2>
                    <span className="sx-tag sx-tag--warn">{versao.origem}</span>
                  </div>
                  {['estrategia', 'angulo', 'legenda', 'cta', 'hashtags', 'alt_text', 'prompt_imagem'].map((chave) => {
                    const texto = textoDaVersao(versao.conteudo, chave);
                    return texto ? <p key={chave}><strong>{chave.replace('_', ' ')}:</strong> {texto}</p> : null;
                  })}
                  {(() => {
                    const textoOverlay = textoDeTrabalho(versao);
                    if (!textoOverlay) return null;
                    return (
                      <div className="sx-field" style={{ marginTop: 8 }}>
                        <label htmlFor={`overlay-titulo-${versao.id}`}>
                          Texto sobre a imagem {textoEditado[versao.id] ? '(editado)' : '(gerado pela IA)'}
                        </label>
                        <input
                          id={`overlay-titulo-${versao.id}`}
                          className="sx-input"
                          value={textoOverlay.titulo ?? ''}
                          placeholder="Título (opcional)"
                          onChange={(event) => atualizarTexto(versao.id, textoOverlay, { titulo: event.target.value })}
                        />
                        {textoOverlay.itens.map((item, indice) => (
                          <input
                            key={indice}
                            className="sx-input"
                            style={{ marginTop: 6 }}
                            value={item}
                            aria-label={`Item ${indice + 1}`}
                            onChange={(event) => atualizarTexto(versao.id, textoOverlay, {
                              itens: textoOverlay.itens.map((atual, i) => (i === indice ? event.target.value : atual)),
                            })}
                          />
                        ))}
                        <input
                          className="sx-input"
                          style={{ marginTop: 10 }}
                          value={instrucaoMelhoria[versao.id] ?? ''}
                          placeholder="O que melhorar? (opcional: mais curto, mais direto…)"
                          onChange={(event) => setInstrucaoMelhoria((atual) => ({ ...atual, [versao.id]: event.target.value }))}
                        />
                        <button
                          className="sx-btn sx-btn--ghost"
                          type="button"
                          style={{ marginTop: 8 }}
                          onClick={() => void melhorarTexto(versao.id, textoOverlay)}
                          disabled={melhorandoTexto === versao.id}
                        >
                          {melhorandoTexto === versao.id ? 'Melhorando…' : 'Melhorar texto com IA'}
                        </button>
                        <p className="sx-hint">
                          Este é o texto exato que será desenhado sobre a imagem — nada é reescrito na composição.
                        </p>
                      </div>
                    );
                  })()}
                  {(() => {
                    const aprovacao = aprovacoes.find((itemAprovacao) => itemAprovacao.content_version_id === versao.id);
                    if (!aprovacao) return <button className="sx-btn sx-btn--ghost" type="button" onClick={() => void enviarParaAprovacao(versao.id)}>Enviar para aprovação</button>;
                    if (aprovacao.decisao === 'PENDENTE') return <div className="sx-actions"><span className="sx-tag sx-tag--warn">Aguardando aprovação</span>{papel === 'ADMINISTRADOR' ? <><button className="sx-btn sx-btn--ghost" type="button" onClick={() => void decidir(aprovacao.id, true)}>Aprovar</button><button className="sx-btn sx-btn--ghost" type="button" onClick={() => void decidir(aprovacao.id, false)}>Devolver</button></> : <span className="sx-hint">A decisão é feita por um administrador.</span>}</div>;
                    return <span className={aprovacao.decisao === 'APROVADO' ? 'sx-tag sx-tag--ok' : 'sx-tag sx-tag--warn'}>{aprovacao.decisao === 'APROVADO' ? 'Aprovado' : 'Devolvido para revisão'}</span>;
                  })()}
                  {versao.operacao === 'PROMPT_IMAGEM' && aprovacoes.some((a) => a.content_version_id === versao.id && a.decisao === 'APROVADO') && (
                    <div style={{ marginTop: 10 }}>
                      <div className="sx-field">
                        <label htmlFor={`formato-${versao.id}`}>Formato da imagem</label>
                        <select
                          id={`formato-${versao.id}`}
                          className="sx-input"
                          value={formatoImagem}
                          onChange={(event) => setFormatoImagem(event.target.value as FormatoImagem)}
                        >
                          {Object.entries(FORMATOS_IMAGEM).map(([valor, { rotulo }]) => (
                            <option key={valor} value={valor}>{rotulo}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sx-field">
                        <label htmlFor={`telas-${versao.id}`}>Telas reais do app como referência (até 2)</label>
                        <select
                          id={`telas-${versao.id}`}
                          className="sx-input"
                          multiple
                          size={5}
                          value={telasDaVersao(versao)}
                          onChange={(event) => setTelasPorVersao((atual) => ({
                            ...atual,
                            [versao.id]: Array.from(event.target.selectedOptions, (opcao) => opcao.value).slice(0, 2),
                          }))}
                        >
                          {Object.entries(TELAS_DO_APP).map(([valor, rotulo]) => (
                            <option key={valor} value={valor}>{rotulo}</option>
                          ))}
                        </select>
                        <p className="sx-hint">
                          {telasPorVersao[versao.id]
                            ? 'Seleção manual. '
                            : 'Sugerido pela IA a partir do briefing — você pode trocar. '}
                          Sem nenhuma tela marcada, a cena é uma fotografia sem interface nenhuma.
                        </p>
                      </div>
                      <button className="sx-btn sx-btn--ghost" type="button" onClick={() => void gerarImagem(versao)} disabled={gerandoImagem === versao.id}>
                        {gerandoImagem === versao.id ? 'Gerando imagem…' : 'Gerar imagem a partir deste prompt'}
                      </button>
                      {imagens.filter((img) => img.content_version_id === versao.id).map((img) => {
                        const textoOverlay = textoDeTrabalho(versao);
                        const podeCompor = Boolean(textoOverlay) && !img.origem_imagem_id;
                        return (
                          <div key={img.id} style={{ marginTop: 8 }}>
                            {urlsImagem[img.storage_path] ? (
                              <>
                                <img
                                  src={urlsImagem[img.storage_path]}
                                  alt="Gerada por IA a partir do prompt aprovado"
                                  style={{ maxWidth: '100%', borderRadius: 10, cursor: 'zoom-in' }}
                                  onClick={() => setImagemExpandida(urlsImagem[img.storage_path])}
                                />
                                <div className="sx-actions" style={{ marginTop: 6 }}>
                                  <button className="sx-btn sx-btn--ghost" type="button" onClick={() => setImagemExpandida(urlsImagem[img.storage_path])}>Expandir</button>
                                  <button className="sx-btn sx-btn--ghost" type="button" onClick={() => void baixarImagem(img.storage_path)}>Baixar</button>
                                </div>
                              </>
                            ) : <button className="sx-btn" type="button" onClick={() => void abrirImagem(img.storage_path)}>Ver imagem gerada</button>}
                            <p className="sx-hint">{img.modelo_ia} · {img.custo_usd != null ? `US$ ${Number(img.custo_usd).toFixed(4)}` : '—'}</p>
                            {podeCompor && textoOverlay && (
                              <div style={{ marginTop: 8 }}>
                                {composicoesPreview[img.id] ? (
                                  <>
                                    <img
                                      src={composicoesPreview[img.id]}
                                      alt="Prévia da composição com o texto do briefing"
                                      style={{ maxWidth: '100%', borderRadius: 10 }}
                                    />
                                    <div className="sx-actions" style={{ marginTop: 6 }}>
                                      <button
                                        className="sx-btn sx-btn--primary"
                                        type="button"
                                        onClick={() => void salvarComposicao(img.id, textoOverlay)}
                                        disabled={salvandoComposicao === img.id}
                                      >
                                        {salvandoComposicao === img.id ? 'Salvando…' : 'Salvar composição'}
                                      </button>
                                      <button
                                        className="sx-btn sx-btn--ghost"
                                        type="button"
                                        onClick={() => void comporTexto(img.id, img.storage_path, textoOverlay)}
                                        disabled={compondo === img.id}
                                      >
                                        Refazer prévia
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <button
                                    className="sx-btn sx-btn--ghost"
                                    type="button"
                                    onClick={() => void comporTexto(img.id, img.storage_path, textoOverlay)}
                                    disabled={compondo === img.id}
                                  >
                                    {compondo === img.id ? 'Compondo…' : 'Compor texto sobre a imagem'}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {imagens.some((img) => img.content_version_id === versao.id) && (
                        <div className="sx-field" style={{ marginTop: 12 }}>
                          <label htmlFor={`ajuste-${versao.id}`}>Não gostou? Descreva o ajuste e gere de novo</label>
                          <textarea
                            id={`ajuste-${versao.id}`}
                            className="sx-input"
                            rows={2}
                            value={textoAjuste[versao.id] ?? ''}
                            onChange={(event) => setTextoAjuste((atual) => ({ ...atual, [versao.id]: event.target.value }))}
                            placeholder="Ex.: cores mais vivas, tirar o texto da imagem, aproximar o produto…"
                          />
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(event) => setArquivoReferencia((atual) => ({ ...atual, [versao.id]: event.target.files?.[0] ?? null }))}
                          />
                          <button
                            className="sx-btn sx-btn--ghost"
                            type="button"
                            style={{ marginTop: 8 }}
                            onClick={() => void gerarImagem(versao, true)}
                            disabled={gerandoImagem === versao.id || (!textoAjuste[versao.id]?.trim() && !arquivoReferencia[versao.id])}
                          >
                            {gerandoImagem === versao.id ? 'Gerando…' : 'Gerar nova versão com ajuste'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="sx-actions" style={{ marginTop: 20 }}>
        <Link to={"/marketing/briefings/" + item.id} className="sx-btn sx-btn--ghost">Voltar ao briefing</Link>
        <Link to="/marketing/agenda" className="sx-btn sx-btn--ghost">Agenda</Link>
      </div>

      {imagemExpandida && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Imagem expandida"
          onClick={() => setImagemExpandida(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, cursor: 'zoom-out', padding: 24,
          }}
        >
          <img
            src={imagemExpandida}
            alt="Imagem gerada, em tamanho maior"
            style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
}
