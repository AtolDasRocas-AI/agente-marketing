import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { buscarContaConectada, type ContaConectada } from '../conta/api';
import { exigirSupabase } from '../../lib/supabase';
import { mensagemDeErroFuncao } from '../../lib/erro';
import { CapaPost } from '../../components/CapaPost';
import { obterRepositorioMarketingRemoto, type WorkspaceMarketing } from './repositoryRemote';

interface Conexao { id: string; username: string }
interface MetricasSnapshot {
  likes?: number; comentarios?: number; media_url?: string | null; thumbnail_url?: string | null;
  children?: { data?: Array<{ media_url?: string; thumbnail_url?: string; media_type?: string }> } | null;
}
interface Snapshot { ig_media_id: string; permalink: string | null; media_type: string | null; publicado_em: string | null; metricas: MetricasSnapshot; coletado_em: string }
interface ImportRun { status: 'RODANDO' | 'SUCESSO' | 'ERRO'; tipo_erro: string | null; quantidade_processada: number; iniciado_em: string; finalizado_em: string | null }

const ROTULOS_ERRO: Record<string, string> = {
  SEM_DADOS: 'Sem publicações novas', TOKEN_EXPIRADO: 'Token expirado', PERMISSAO_AUSENTE: 'Permissão ausente',
  LIMITE_META: 'Limite da Meta atingido', ERRO_DESCONHECIDO: 'Erro desconhecido',
};

export function MetricasInstagramMarketing() {
  const [workspace, setWorkspace] = useState<WorkspaceMarketing | null>(null);
  const [conta, setConta] = useState<ContaConectada | null>(null);
  const [conexao, setConexao] = useState<Conexao | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [erro, setErro] = useState(''); const [aviso, setAviso] = useState(''); const [carregando, setCarregando] = useState(true);
  async function carregar() {
    const repo = obterRepositorioMarketingRemoto(); const ws = await repo.preparar(); const account = await buscarContaConectada();
    const sb = exigirSupabase();
    const [{ data: linked, error: linkedError }, { data: rows, error: rowsError }, { data: importRuns, error: runsError }] = await Promise.all([
      sb.from('marketing_instagram_connection').select('id,username').eq('workspace_id', ws.id).maybeSingle(),
      sb.from('marketing_instagram_metric_snapshot').select('ig_media_id,permalink,media_type,publicado_em,metricas,coletado_em').eq('workspace_id', ws.id).order('coletado_em', { ascending: false }).limit(50),
      sb.from('marketing_instagram_import_run').select('status,tipo_erro,quantidade_processada,iniciado_em,finalizado_em').eq('workspace_id', ws.id).eq('tipo', 'METRICAS').order('iniciado_em', { ascending: false }).limit(10),
    ]);
    if (linkedError || rowsError || runsError) throw linkedError ?? rowsError ?? runsError;
    setWorkspace(ws); setConta(account); setConexao(linked as Conexao | null); setSnapshots((rows ?? []) as Snapshot[]); setRuns((importRuns ?? []) as ImportRun[]);
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
    if (error) { setErro(await mensagemDeErroFuncao(error)); return; }
    if (data?.codigo) { setErro(data.mensagem ?? data.codigo); return; }
    await carregar(); setAviso(`${data.importados} publicações importadas somente para leitura.`);
  }
  const likes = snapshots.reduce((total, row) => total + Number(row.metricas.likes ?? 0), 0);
  const comments = snapshots.reduce((total, row) => total + Number(row.metricas.comentarios ?? 0), 0);
  const ultimoSucesso = runs.find((r) => r.status === 'SUCESSO');
  const ultimaFalha = runs.find((r) => r.status === 'ERRO');
  if (carregando) return <div className="sx-wrap--narrow"><div className="sx-empty sx-card">Carregando métricas…</div></div>;
  return <div className="sx-wrap--narrow"><header className="sx-head"><p className="ra-eyebrow">Marketing · Instagram</p><h1 className="sx-h1">Sinais do <em>Instagram</em></h1><p className="sx-lede">Leitura de desempenho. Nada é publicado pelo ATOL Studio.</p></header>{erro && <div className="sx-note sx-note--warn" role="alert">{erro}</div>}{aviso && <div className="sx-note" role="status">{aviso}</div>}<section className="sx-card sx-card--pad"><p className="sx-step"><b>Conta</b> conexão de leitura</p>{!conta ? <p className="sx-hint">Conecte a conta Instagram da ATOL antes de importar métricas.</p> : !conexao ? <><p className="sx-hint">Conta disponível: @{conta.username}</p><button className="sx-btn sx-btn--primary" type="button" onClick={() => void vincular()}>Usar esta conta no Marketing</button></> : <><p className="sx-hint">@{conexao.username} vinculada ao workspace.</p><button className="sx-btn sx-btn--primary" type="button" onClick={() => void importar()}>Importar métricas agora</button></>}</section>{(ultimoSucesso || ultimaFalha) && <section className="sx-card sx-card--pad" style={{ marginTop: 12 }}><p className="sx-step"><b>Execuções</b> histórico de importação</p>{ultimoSucesso && <p className="sx-hint">Última coleta bem-sucedida: {new Date(ultimoSucesso.finalizado_em ?? ultimoSucesso.iniciado_em).toLocaleString('pt-BR')} · {ultimoSucesso.quantidade_processada} publicações{ultimoSucesso.tipo_erro === 'SEM_DADOS' ? ' (nenhuma nova)' : ''}</p>}{ultimaFalha && <p className="sx-note sx-note--warn" role="alert">Última falha: {new Date(ultimaFalha.finalizado_em ?? ultimaFalha.iniciado_em).toLocaleString('pt-BR')} · {ROTULOS_ERRO[ultimaFalha.tipo_erro ?? ''] ?? 'Erro desconhecido'}</p>}</section>}<section style={{ marginTop: 18 }}><p className="sx-step"><b>Resumo</b> último retrato importado</p><div className="sm-grid-2"><div className="sx-card sx-card--pad"><strong>{snapshots.length}</strong><p className="sx-hint">publicações no retrato</p></div><div className="sx-card sx-card--pad"><strong>{likes + comments}</strong><p className="sx-hint">interações visíveis</p></div></div>{snapshots.length ? <div className="sm-agenda" style={{ marginTop: 16 }}>{snapshots.slice(0, 10).map((row) => <article className="sm-item" key={row.ig_media_id + row.coletado_em}><div style={{ width: 64, height: 64, flex: 'none', borderRadius: 10, overflow: 'hidden' }}><CapaPost midia={{ media_type: row.media_type ?? 'IMAGE', media_url: row.metricas.media_url, thumbnail_url: row.metricas.thumbnail_url, children: row.metricas.children ?? undefined }} /></div><div className="sm-item-main"><h2>{row.media_type ?? 'Publicação'}</h2><p>♥ {Number(row.metricas.likes ?? 0)} · comentários {Number(row.metricas.comentarios ?? 0)}</p>{row.permalink && <a href={row.permalink} target="_blank" rel="noreferrer">Abrir no Instagram</a>}</div></article>)}</div> : <div className="sx-empty sx-card" style={{ marginTop: 16 }}>Ainda não há métricas importadas.</div>}</section><div className="sx-actions" style={{ marginTop: 20 }}><Link to="/marketing/agenda" className="sx-btn sx-btn--ghost">Agenda</Link></div></div>;
}
