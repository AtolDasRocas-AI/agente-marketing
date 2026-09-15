import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { exigirSupabase } from '../../lib/supabase';
import { mensagemDeErroFuncao } from '../../lib/erro';
import { obterRepositorioMarketingRemoto, type WorkspaceMarketing } from './repositoryRemote';

interface Comentario { id: string; ig_media_id: string; autor_username: string | null; texto: string; publicado_em: string | null; categoria: string | null }

const CATEGORIAS = ['DUVIDA', 'ELOGIO', 'RECLAMACAO', 'INTENCAO_COMPRA', 'PEDIDO_SUPORTE', 'SPAM', 'NAO_CLASSIFICADO'] as const;
const ROTULOS_CATEGORIA: Record<string, string> = {
  DUVIDA: 'Dúvida', ELOGIO: 'Elogio', RECLAMACAO: 'Reclamação', INTENCAO_COMPRA: 'Intenção de compra',
  PEDIDO_SUPORTE: 'Pedido de suporte', SPAM: 'Spam', NAO_CLASSIFICADO: 'Não classificado',
};

export function ComentariosMarketing() {
  const [workspace, setWorkspace] = useState<WorkspaceMarketing | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [filtro, setFiltro] = useState('TODOS');
  const [erro, setErro] = useState(''); const [aviso, setAviso] = useState(''); const [carregando, setCarregando] = useState(true);

  async function carregar() {
    const repo = obterRepositorioMarketingRemoto(); const ws = await repo.preparar();
    const { data, error } = await exigirSupabase()
      .from('marketing_instagram_comment_snapshot')
      .select('id,ig_media_id,autor_username,texto,publicado_em,categoria')
      .eq('workspace_id', ws.id).order('publicado_em', { ascending: false }).limit(300);
    if (error) throw error;
    setWorkspace(ws); setComentarios((data ?? []) as Comentario[]);
  }
  async function carregarInicial() {
    try { await carregar(); } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar comentários.'); } finally { setCarregando(false); }
  }
  useEffect(() => {
    const tarefa = window.setTimeout(() => { void carregarInicial(); }, 0);
    return () => window.clearTimeout(tarefa);
  }, []);

  async function importar() {
    if (!workspace) return; setErro(''); setAviso('');
    const { data, error } = await exigirSupabase().functions.invoke('marketing-importar-comentarios-instagram', { body: { workspace_id: workspace.id } });
    if (error) { setErro(await mensagemDeErroFuncao(error)); return; }
    if (data?.codigo) { setErro(data.mensagem ?? data.codigo); return; }
    await carregar(); setAviso(`${data.importados} comentários importados de ${data.publicacoes} publicações.`);
  }
  async function classificar() {
    if (!workspace) return; setErro(''); setAviso('');
    const { data, error } = await exigirSupabase().functions.invoke('marketing-classificar-comentarios', { body: { workspace_id: workspace.id, idempotency_key: crypto.randomUUID() } });
    if (error) { setErro(await mensagemDeErroFuncao(error)); return; }
    if (data?.codigo) { setErro(data.mensagem ?? data.codigo); return; }
    await carregar(); setAviso(data.classificados ? `${data.classificados} comentários classificados.` : (data.mensagem ?? 'Nada pendente.'));
  }
  async function reclassificar(id: string, categoria: string) {
    if (!workspace || !categoria) return;
    const { error } = await exigirSupabase().rpc('marketing_reclassificar_comentario', { p_workspace_id: workspace.id, p_comentario_id: id, p_categoria: categoria });
    if (error) { setErro(error.message); return; }
    await carregar();
  }

  const contagens = CATEGORIAS.reduce<Record<string, number>>((acc, cat) => { acc[cat] = comentarios.filter((c) => c.categoria === cat).length; return acc; }, {});
  const pendentes = comentarios.filter((c) => !c.categoria).length;
  const visiveis = filtro === 'TODOS' ? comentarios : filtro === 'PENDENTE' ? comentarios.filter((c) => !c.categoria) : comentarios.filter((c) => c.categoria === filtro);

  if (carregando) return <div className="sx-wrap--narrow"><div className="sx-empty sx-card">Carregando comentários…</div></div>;
  return <div className="sx-wrap--narrow">
    <header className="sx-head"><p className="ra-eyebrow">Marketing · Instagram</p><h1 className="sx-h1">Sinais de <em>audiência</em></h1><p className="sx-lede">Leitura de comentários por categoria. Nada é respondido automaticamente.</p></header>
    {erro && <div className="sx-note sx-note--warn" role="alert">{erro}</div>}
    {aviso && <div className="sx-note" role="status">{aviso}</div>}
    <section className="sx-card sx-card--pad">
      <p className="sx-step"><b>Coleta</b> importação e classificação</p>
      <div className="sx-actions">
        <button className="sx-btn sx-btn--primary" type="button" onClick={() => void importar()}>Importar comentários agora</button>
        <button className="sx-btn" type="button" onClick={() => void classificar()} disabled={pendentes === 0}>Classificar pendentes ({pendentes})</button>
      </div>
    </section>
    <section style={{ marginTop: 18 }}>
      <p className="sx-step"><b>Categorias</b> volume por tipo</p>
      <div className="sx-filters" style={{ marginTop: 10 }}>
        <button className={`sx-filter${filtro === 'TODOS' ? ' is-on' : ''}`} type="button" onClick={() => setFiltro('TODOS')}>Todos <b>{comentarios.length}</b></button>
        <button className={`sx-filter${filtro === 'PENDENTE' ? ' is-on' : ''}`} type="button" onClick={() => setFiltro('PENDENTE')}>Pendentes <b>{pendentes}</b></button>
        {CATEGORIAS.map((cat) => (
          <button key={cat} className={`sx-filter${filtro === cat ? ' is-on' : ''}`} type="button" onClick={() => setFiltro(cat)}>{ROTULOS_CATEGORIA[cat]} <b>{contagens[cat]}</b></button>
        ))}
      </div>
    </section>
    <section style={{ marginTop: 16 }}>
      {visiveis.length ? (
        <div className="sx-list">
          {visiveis.slice(0, 100).map((c) => (
            <div className="sx-p" key={c.id}>
              <div className="sx-p-main">
                <span className="sx-p-user">@{c.autor_username ?? 'desconhecido'}</span>
                <span className="sx-p-txt">{c.texto || '(sem texto)'}</span>
              </div>
              <select className="sx-input" style={{ width: 'auto' }} value={c.categoria ?? ''} onChange={(e) => void reclassificar(c.id, e.target.value)}>
                <option value="" disabled>Classificar…</option>
                {CATEGORIAS.map((cat) => <option key={cat} value={cat}>{ROTULOS_CATEGORIA[cat]}</option>)}
              </select>
            </div>
          ))}
        </div>
      ) : <div className="sx-empty sx-card">Nenhum comentário nesta categoria.</div>}
    </section>
    <div className="sx-actions" style={{ marginTop: 20 }}><Link to="/marketing/metricas" className="sx-btn sx-btn--ghost">Métricas</Link></div>
  </div>;
}
