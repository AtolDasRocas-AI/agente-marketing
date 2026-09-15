import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { exigirSupabase } from '../../lib/supabase';
import { obterRepositorioMarketingRemoto } from './repositoryRemote';

interface Snapshot { ig_media_id: string; permalink: string | null; media_type: string | null; metricas: { likes?: number; comentarios?: number }; coletado_em: string }

export function RelatorioSemanalMarketing() {
  const [items, setItems] = useState<Snapshot[]>([]); const [erro, setErro] = useState(''); const [carregando, setCarregando] = useState(true);
  async function carregar() {
    const workspace = await obterRepositorioMarketingRemoto().preparar();
    const { data, error } = await exigirSupabase().from('marketing_instagram_metric_snapshot')
      .select('ig_media_id,permalink,media_type,metricas,coletado_em').eq('workspace_id', workspace.id)
      .gte('coletado_em', new Date(Date.now() - 7 * 86400000).toISOString()).order('coletado_em', { ascending: false });
    if (error) throw error; setItems((data ?? []) as Snapshot[]);
  }
  async function carregarInicial() { try { await carregar(); } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível montar o relatório.'); } finally { setCarregando(false); } }
  useEffect(() => { const tarefa = window.setTimeout(() => { void carregarInicial(); }, 0); return () => window.clearTimeout(tarefa); }, []);
  const interacoes = (item: Snapshot) => Number(item.metricas.likes ?? 0) + Number(item.metricas.comentarios ?? 0);
  const melhor = [...items].sort((a, b) => interacoes(b) - interacoes(a))[0]; const total = items.reduce((soma, item) => soma + interacoes(item), 0);
  if (carregando) return <div className="sx-wrap--narrow"><div className="sx-empty sx-card">Montando relatório…</div></div>;
  return <div className="sx-wrap--narrow"><header className="sx-head"><p className="ra-eyebrow">Marketing · Produto</p><h1 className="sx-h1">Relatório <em>semanal</em></h1><p className="sx-lede">Sinais a partir dos instantâneos importados. Leitura humana antes de qualquer decisão.</p></header>{erro && <div className="sx-note sx-note--warn">{erro}</div>}<section className="sm-grid-2"><div className="sx-card sx-card--pad"><strong>{items.length}</strong><p className="sx-hint">retratos coletados nos últimos 7 dias</p></div><div className="sx-card sx-card--pad"><strong>{total}</strong><p className="sx-hint">interações observadas</p></div></section><section className="sx-card sx-card--pad" style={{ marginTop: 16 }}><p className="sx-step"><b>Sinal prioritário</b> hipótese editorial</p>{melhor ? <><p>A publicação com melhor resposta teve <b>{interacoes(melhor)} interações</b> ({melhor.media_type ?? 'formato não informado'}).</p><p className="sx-hint">Próxima ação sugerida: revisar o formato, assunto e chamada dessa publicação e criar uma hipótese explícita para o próximo briefing.</p>{melhor.permalink && <a href={melhor.permalink} target="_blank" rel="noreferrer">Abrir publicação de referência</a>}</> : <p className="sx-hint">Importe métricas para produzir o primeiro sinal.</p>}</section><div className="sx-actions" style={{ marginTop: 20 }}><button className="sx-btn" type="button" onClick={() => window.print()}>Exportar manualmente</button><Link to="/marketing/metricas" className="sx-btn sx-btn--ghost">Métricas</Link></div></div>;
}
