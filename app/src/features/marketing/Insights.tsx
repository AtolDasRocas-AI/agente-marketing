import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { exigirSupabase } from '../../lib/supabase';
import { obterRepositorioMarketingRemoto, type WorkspaceMarketing } from './repositoryRemote';

interface Insight {
  id: string; periodo_inicio: string; periodo_fim: string; hipotese: string; evidencias: string[];
  limitacoes: string; confianca: string; proxima_acao: string; custo_usd: number | null; modelo_ia: string; decisao: string;
}

const ROTULOS_CONFIANCA: Record<string, string> = { BAIXA: 'Confiança baixa', MEDIA: 'Confiança média', ALTA: 'Confiança alta' };

export function InsightsMarketing() {
  const [workspace, setWorkspace] = useState<WorkspaceMarketing | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [erro, setErro] = useState(''); const [aviso, setAviso] = useState(''); const [carregando, setCarregando] = useState(true); const [gerando, setGerando] = useState(false);

  async function carregar() {
    const repo = obterRepositorioMarketingRemoto(); const ws = await repo.preparar();
    const { data, error } = await exigirSupabase()
      .from('marketing_insight')
      .select('id,periodo_inicio,periodo_fim,hipotese,evidencias,limitacoes,confianca,proxima_acao,custo_usd,modelo_ia,decisao')
      .eq('workspace_id', ws.id).order('gerado_em', { ascending: false }).limit(20);
    if (error) throw error;
    setWorkspace(ws); setInsights((data ?? []) as Insight[]);
  }
  async function carregarInicial() {
    try { await carregar(); } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar as hipóteses.'); } finally { setCarregando(false); }
  }
  useEffect(() => {
    const tarefa = window.setTimeout(() => { void carregarInicial(); }, 0);
    return () => window.clearTimeout(tarefa);
  }, []);

  async function gerar() {
    if (!workspace) return; setErro(''); setAviso(''); setGerando(true);
    try {
      const { data, error } = await exigirSupabase().functions.invoke('marketing-gerar-insight', { body: { workspace_id: workspace.id, idempotency_key: crypto.randomUUID() } });
      if (error || data?.codigo) { setErro(data?.mensagem ?? data?.codigo ?? error?.message ?? 'Geração indisponível.'); return; }
      await carregar(); setAviso('Nova hipótese gerada — revise antes de aprovar.');
    } finally { setGerando(false); }
  }
  async function decidir(id: string, aprovar: boolean) {
    if (!workspace) return; setErro('');
    const { error } = await exigirSupabase().rpc('marketing_decidir_insight', { p_workspace_id: workspace.id, p_insight_id: id, p_aprovar: aprovar });
    if (error) { setErro(error.message); return; } await carregar();
  }

  if (carregando) return <div className="sx-wrap--narrow"><div className="sx-empty sx-card">Carregando hipóteses…</div></div>;
  return <div className="sx-wrap--narrow">
    <header className="sx-head"><p className="ra-eyebrow">Marketing · Produto</p><h1 className="sx-h1">Hipóteses de <em>inteligência</em></h1><p className="sx-lede">Correlações entre métricas, notas e comentários — sempre hipótese, nunca causalidade, sempre com revisão humana.</p></header>
    {erro && <div className="sx-note sx-note--warn" role="alert">{erro}</div>}
    {aviso && <div className="sx-note" role="status">{aviso}</div>}
    <section className="sx-card sx-card--pad">
      <p className="sx-step"><b>Gerar</b> hipótese da última semana</p>
      <button className="sx-btn sx-btn--primary" type="button" onClick={() => void gerar()} disabled={gerando}>{gerando ? 'Gerando…' : 'Gerar hipótese agora'}</button>
    </section>
    <section style={{ marginTop: 18 }}>
      {insights.length ? insights.map((i) => (
        <article className="sx-card sx-card--pad" key={i.id} style={{ marginBottom: 12 }}>
          <p className="sx-step"><b>{i.periodo_inicio} a {i.periodo_fim}</b> {ROTULOS_CONFIANCA[i.confianca] ?? i.confianca}</p>
          <p>{i.hipotese}</p>
          {i.evidencias?.length > 0 && <ul className="sx-hint">{i.evidencias.map((e, idx) => <li key={idx}>{e}</li>)}</ul>}
          {i.limitacoes && <p className="sx-hint">Limitações: {i.limitacoes}</p>}
          {i.proxima_acao && <p className="sx-hint">Próxima ação sugerida: {i.proxima_acao}</p>}
          <p className="sx-hint">Modelo {i.modelo_ia} · custo {i.custo_usd != null ? `US$ ${Number(i.custo_usd).toFixed(4)}` : '—'}</p>
          {i.decisao === 'PENDENTE'
            ? <div className="sx-actions"><button className="sx-btn sx-btn--primary" type="button" onClick={() => void decidir(i.id, true)}>Aprovar</button><button className="sx-btn sx-btn--ghost" type="button" onClick={() => void decidir(i.id, false)}>Descartar</button></div>
            : <span className={i.decisao === 'APROVADO' ? 'sx-tag sx-tag--ok' : 'sx-tag sx-tag--out'}>{i.decisao === 'APROVADO' ? 'Aprovada' : 'Descartada'}</span>}
        </article>
      )) : <div className="sx-empty sx-card">Nenhuma hipótese gerada ainda.</div>}
    </section>
    <div className="sx-actions" style={{ marginTop: 20 }}><Link to="/marketing/relatorio" className="sx-btn sx-btn--ghost">Relatório semanal</Link></div>
  </div>;
}
