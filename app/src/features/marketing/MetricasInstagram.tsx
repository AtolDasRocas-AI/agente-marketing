import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { buscarContaConectada, type ContaConectada } from '../conta/api';
import { exigirSupabase } from '../../lib/supabase';
import { obterRepositorioMarketingRemoto, type WorkspaceMarketing } from './repositoryRemote';

interface Conexao { id: string; username: string }
interface Snapshot { ig_media_id: string; permalink: string | null; media_type: string | null; publicado_em: string | null; metricas: { likes?: number; comentarios?: number }; coletado_em: string }

export function MetricasInstagramMarketing() {
  const [workspace, setWorkspace] = useState<WorkspaceMarketing | null>(null);
  const [conta, setConta] = useState<ContaConectada | null>(null);
  const [conexao, setConexao] = useState<Conexao | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [erro, setErro] = useState(''); const [aviso, setAviso] = useState(''); const [carregando, setCarregando] = useState(true);
  async function carregar() {
    const repo = obterRepositorioMarketingRemoto(); const ws = await repo.preparar(); const account = await buscarContaConectada();
    const sb = exigirSupabase();
    const [{ data: linked, error: linkedError }, { data: rows, error: rowsError }] = await Promise.all([
      sb.from('marketing_instagram_connection').select('id,username').eq('workspace_id', ws.id).maybeSingle(),
      sb.from('marketing_instagram_metric_snapshot').select('ig_media_id,permalink,media_type,publicado_em,metricas,coletado_em').eq('workspace_id', ws.id).order('coletado_em', { ascending: false }).limit(50),
    ]);
    if (linkedError || rowsError) throw linkedError ?? rowsError;
    setWorkspace(ws); setConta(account); setConexao(linked as Conexao | null); setSnapshots((rows ?? []) as Snapshot[]);
  }
  async function carregarInicial() {
    try { await carregar(); } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar métricas.'); } finally { setCarregando(false); }
  }
  useEffect(() => {
    const tarefa = window.setTimeout(() => { void carregarInicial(); }, 0);
    return () => window.clearTimeout(tarefa);
  }, []);
  async function vincular() {
    if (!workspace || !conta) return; setErro('');
    const { error } = await exigirSupabase().rpc('marketing_vincular_conta_instagram', { p_workspace_id: workspace.id, p_ig_account_id: conta.id });
    if (error) { setErro(error.message); return; } await carregar(); setAviso('Conta ATOL vinculada ao workspace de Marketing.');
  }
  async function importar() {
    if (!workspace) return; setErro(''); setAviso('');
    const { data, error } = await exigirSupabase().functions.invoke('marketing-importar-metricas-instagram', { body: { workspace_id: workspace.id } });
    if (error || data?.codigo) { setErro(data?.codigo ?? error?.message ?? 'Importação indisponível.'); return; }
    await carregar(); setAviso(`${data.importados} publicações importadas somente para leitura.`);
  }
  const likes = snapshots.reduce((total, row) => total + Number(row.metricas.likes ?? 0), 0);
  const comments = snapshots.reduce((total, row) => total + Number(row.metricas.comentarios ?? 0), 0);
  if (carregando) return <div className="sx-wrap--narrow"><div className="sx-empty sx-card">Carregando métricas…</div></div>;
  return <div className="sx-wrap--narrow"><header className="sx-head"><p className="ra-eyebrow">Marketing · Instagram</p><h1 className="sx-h1">Sinais do <em>Instagram</em></h1><p className="sx-lede">Leitura de desempenho. Nada é publicado pelo ATOL Studio.</p></header>{erro && <div className="sx-note sx-note--warn" role="alert">{erro}</div>}{aviso && <div className="sx-note" role="status">{aviso}</div>}<section className="sx-card sx-card--pad"><p className="sx-step"><b>Conta</b> conexão de leitura</p>{!conta ? <p className="sx-hint">Conecte a conta Instagram da ATOL antes de importar métricas.</p> : !conexao ? <><p className="sx-hint">Conta disponível: @{conta.username}</p><button className="sx-btn sx-btn--primary" type="button" onClick={() => void vincular()}>Usar esta conta no Marketing</button></> : <><p className="sx-hint">@{conexao.username} vinculada ao workspace.</p><button className="sx-btn sx-btn--primary" type="button" onClick={() => void importar()}>Importar métricas agora</button></>}</section><section style={{ marginTop: 18 }}><p className="sx-step"><b>Resumo</b> último retrato importado</p><div className="sm-grid-2"><div className="sx-card sx-card--pad"><strong>{snapshots.length}</strong><p className="sx-hint">publicações no retrato</p></div><div className="sx-card sx-card--pad"><strong>{likes + comments}</strong><p className="sx-hint">interações visíveis</p></div></div>{snapshots.length ? <div className="sm-agenda" style={{ marginTop: 16 }}>{snapshots.slice(0, 10).map((row) => <article className="sm-item" key={row.ig_media_id + row.coletado_em}><div className="sm-item-main"><h2>{row.media_type ?? 'Publicação'}</h2><p>♥ {Number(row.metricas.likes ?? 0)} · comentários {Number(row.metricas.comentarios ?? 0)}</p>{row.permalink && <a href={row.permalink} target="_blank" rel="noreferrer">Abrir no Instagram</a>}</div></article>)}</div> : <div className="sx-empty sx-card" style={{ marginTop: 16 }}>Ainda não há métricas importadas.</div>}</section><div className="sx-actions" style={{ marginTop: 20 }}><Link to="/marketing/agenda" className="sx-btn sx-btn--ghost">Agenda</Link></div></div>;
}
