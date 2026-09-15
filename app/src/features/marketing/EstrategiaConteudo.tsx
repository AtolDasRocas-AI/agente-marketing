import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Icone } from '../../components/Icone';
import { obterRepositorioMarketingRemoto, type ConteudoMarketingRemoto } from './repositoryRemote';
import {
  carregarOrcamentoIa, configurarOrcamentoIa, decidirAprovacaoConteudo, formatarUsd, gerarConteudoIa, gerarImagemIa,
  listarAprovacoesConteudo, listarImagensGeradas, listarVersoesIa, obterPapelMarketing, OPERACOES_IA,
  solicitarAprovacaoConteudo, urlAssinadaImagem,
  type AprovacaoConteudo, type ImagemGerada, type OperacaoIa, type OrcamentoIa, type PapelMarketing, type VersaoConteudoIa,
} from './aiRemote';

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
      await gerarConteudoIa(item.id, operacao);
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

  async function gerarImagem(versaoId: string) {
    setErro(''); setAviso(''); setGerandoImagem(versaoId);
    try {
      await gerarImagemIa(versaoId);
      await recarregar();
      setAviso('Imagem gerada a partir do prompt aprovado.');
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível gerar a imagem.');
    } finally {
      setGerandoImagem(null);
    }
  }

  async function abrirImagem(storagePath: string) {
    if (urlsImagem[storagePath]) return;
    const url = await urlAssinadaImagem(storagePath);
    if (url) setUrlsImagem((atual) => ({ ...atual, [storagePath]: url }));
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
                    const aprovacao = aprovacoes.find((itemAprovacao) => itemAprovacao.content_version_id === versao.id);
                    if (!aprovacao) return <button className="sx-btn sx-btn--ghost" type="button" onClick={() => void enviarParaAprovacao(versao.id)}>Enviar para aprovação</button>;
                    if (aprovacao.decisao === 'PENDENTE') return <div className="sx-actions"><span className="sx-tag sx-tag--warn">Aguardando aprovação</span>{papel === 'ADMINISTRADOR' ? <><button className="sx-btn sx-btn--ghost" type="button" onClick={() => void decidir(aprovacao.id, true)}>Aprovar</button><button className="sx-btn sx-btn--ghost" type="button" onClick={() => void decidir(aprovacao.id, false)}>Devolver</button></> : <span className="sx-hint">A decisão é feita por um administrador.</span>}</div>;
                    return <span className={aprovacao.decisao === 'APROVADO' ? 'sx-tag sx-tag--ok' : 'sx-tag sx-tag--warn'}>{aprovacao.decisao === 'APROVADO' ? 'Aprovado' : 'Devolvido para revisão'}</span>;
                  })()}
                  {versao.operacao === 'PROMPT_IMAGEM' && aprovacoes.some((a) => a.content_version_id === versao.id && a.decisao === 'APROVADO') && (
                    <div style={{ marginTop: 10 }}>
                      <button className="sx-btn sx-btn--ghost" type="button" onClick={() => void gerarImagem(versao.id)} disabled={gerandoImagem === versao.id}>
                        {gerandoImagem === versao.id ? 'Gerando imagem…' : 'Gerar imagem a partir deste prompt'}
                      </button>
                      {imagens.filter((img) => img.content_version_id === versao.id).map((img) => (
                        <div key={img.id} style={{ marginTop: 8 }}>
                          {urlsImagem[img.storage_path]
                            ? <img src={urlsImagem[img.storage_path]} alt="Gerada por IA a partir do prompt aprovado" style={{ maxWidth: '100%', borderRadius: 10 }} />
                            : <button className="sx-btn" type="button" onClick={() => void abrirImagem(img.storage_path)}>Ver imagem gerada</button>}
                          <p className="sx-hint">{img.modelo_ia} · {img.custo_usd != null ? `US$ ${Number(img.custo_usd).toFixed(4)}` : '—'}</p>
                        </div>
                      ))}
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
    </div>
  );
}
