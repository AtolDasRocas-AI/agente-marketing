import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { exigirSupabase } from '../../lib/supabase';
import { obterRepositorioMarketingRemoto } from './repositoryRemote';

interface Snapshot { ig_media_id: string; permalink: string | null; media_type: string | null; metricas: { likes?: number; comentarios?: number }; coletado_em: string }
interface Nota { id: string; titulo: string; categoria: string; ocorrido_em: string; nota: string }

export function RelatorioSemanalMarketing() {
  const [items, setItems] = useState<Snapshot[]>([]); const [notas, setNotas] = useState<Nota[]>([]); const [workspaceId, setWorkspaceId] = useState(''); const [titulo, setTitulo] = useState(''); const [nota, setNota] = useState(''); const [erro, setErro] = useState(''); const [aviso, setAviso] = useState(''); const [carregando, setCarregando] = useState(true);
  async function carregar() {
    const workspace = await obterRepositorioMarketingRemoto().preparar();
    setWorkspaceId(workspace.id);
    const [{ data, error }, { data: notes, error: notesError }] = await Promise.all([exigirSupabase().from('marketing_instagram_metric_snapshot')
      .select('ig_media_id,permalink,media_type,metricas,coletado_em').eq('workspace_id', workspace.id)
      .gte('coletado_em', new Date(Date.now() - 7 * 86400000).toISOString()).order('coletado_em', { ascending: false }), exigirSupabase().from('marketing_context_note')
      .select('id,titulo,categoria,ocorrido_em,nota').eq('workspace_id', workspace.id).order('ocorrido_em', { ascending: false }).limit(8)]);
    if (error || notesError) throw error ?? notesError; setItems((data ?? []) as Snapshot[]); setNotas((notes ?? []) as Nota[]);
  }
  async function carregarInicial() { try { await carregar(); } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível montar o relatório.'); } finally { setCarregando(false); } }
  useEffect(() => { const tarefa = window.setTimeout(() => { void carregarInicial(); }, 0); return () => window.clearTimeout(tarefa); }, []);
  async function salvarNota() {
    if (!workspaceId || !titulo.trim() || !nota.trim()) return; setErro('');
    const { error } = await exigirSupabase().rpc('marketing_criar_nota_contexto', { p_workspace_id: workspaceId, p_idempotency_key: crypto.randomUUID(), p_titulo: titulo, p_categoria: 'EVENTO', p_ocorrido_em: new Date().toISOString().slice(0, 10), p_nota: nota, p_fonte_url: null });
    if (error) { setErro(error.message); return; } setTitulo(''); setNota(''); await carregar(); setAviso('Nota de contexto registrada.');
  }
  const interacoes = (item: Snapshot) => Number(item.metricas.likes ?? 0) + Number(item.metricas.comentarios ?? 0);
  const melhor = [...items].sort((a, b) => interacoes(b) - interacoes(a))[0]; const total = items.reduce((soma, item) => soma + interacoes(item), 0);
  if (carregando) return <div className="sx-wrap--narrow"><div className="sx-empty sx-card">Montando relatório…</div></div>;
  return <div className="sx-wrap--narrow"><header className="sx-head"><p className="ra-eyebrow">Marketing · Produto</p><h1 className="sx-h1">Relatório <em>semanal</em></h1><p className="sx-lede">Sinais a partir dos instantâneos importados. Leitura humana antes de qualquer decisão.</p></header>{erro && <div className="sx-note sx-note--warn">{erro}</div>}{aviso && <div className="sx-note">{aviso}</div>}<section className="sm-grid-2"><div className="sx-card sx-card--pad"><strong>{items.length}</strong><p className="sx-hint">retratos coletados nos últimos 7 dias</p></div><div className="sx-card sx-card--pad"><strong>{total}</strong><p className="sx-hint">interações observadas</p></div></section><section className="sx-card sx-card--pad" style={{ marginTop: 16 }}><p className="sx-step"><b>Sinal prioritário</b> hipótese editorial</p>{melhor ? <><p>A publicação com melhor resposta teve <b>{interacoes(melhor)} interações</b> ({melhor.media_type ?? 'formato não informado'}).</p><p className="sx-hint">Próxima ação sugerida: revisar o formato, assunto e chamada dessa publicação e criar uma hipótese explícita para o próximo briefing.</p>{melhor.permalink && <a href={melhor.permalink} target="_blank" rel="noreferrer">Abrir publicação de referência</a>}</> : <p className="sx-hint">Importe métricas para produzir o primeiro sinal.</p>}</section><section className="sx-card sx-card--pad sm-form" style={{ marginTop: 16 }}><p className="sx-step"><b>Nota de contexto</b> evento relevante para a marca</p><input className="sx-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: lançamento, evento ou matéria" /><textarea className="sx-input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="O que aconteceu e por que pode afetar as métricas?" /><button className="sx-btn" type="button" onClick={() => void salvarNota()} disabled={!titulo.trim() || !nota.trim()}>Registrar nota</button>{notas.map((item) => <p key={item.id} className="sx-hint"><b>{item.ocorrido_em}</b> · {item.titulo}: {item.nota}</p>)}</section><div className="sx-actions" style={{ marginTop: 20 }}><button className="sx-btn" type="button" onClick={() => window.print()}>Exportar manualmente</button><Link to="/marketing/metricas" className="sx-btn sx-btn--ghost">Métricas</Link></div></div>;
}
