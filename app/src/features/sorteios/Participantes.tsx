import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { Icone } from '../../components/Icone';
import { rotuloMotivo } from '../../lib/sorteio/motivos';
import {
  listarParticipantes, buscarSorteio, listarChances,
  type ParticipanteLinha, type SorteioResumo,
} from './api';
import { mensagemDeErro } from '../../lib/erro';

type Filtro = 'TODOS' | 'HABILITADO' | 'EXTRA' | 'DESQUALIFICADO' | 'SUSPEITO';

/** EXTRA é deliberadamente neutro: a pessoa participa, só não acumula chance */
const CLASSE_TAG: Record<string, string> = {
  HABILITADO: 'sx-tag sx-tag--ok',
  EXTRA: 'sx-tag sx-tag--extra',
  DESQUALIFICADO: 'sx-tag sx-tag--out',
  SUSPEITO: 'sx-tag sx-tag--warn',
};

const ROTULO_STATUS: Record<string, string> = {
  HABILITADO: 'concorre',
  EXTRA: 'extra',
  DESQUALIFICADO: 'fora',
  SUSPEITO: 'revisar',
};

const ROTULO_FILTRO: Record<Filtro, string> = {
  TODOS: 'Todos',
  HABILITADO: 'Concorrem',
  EXTRA: 'Extras',
  DESQUALIFICADO: 'Fora',
  SUSPEITO: 'Revisar',
};

export function Participantes() {
  const { id } = useParams<{ id: string }>();
  const [sorteio, setSorteio] = useState<SorteioResumo | null>(null);
  const [linhas, setLinhas] = useState<ParticipanteLinha[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([buscarSorteio(id), listarParticipantes(id)])
      .then(([s, p]) => {
        setSorteio(s);
        setLinhas(p);
      })
      .catch((e) => setErro(mensagemDeErro(e)));
  }, [id]);

  const contagens = useMemo(() => {
    const c: Record<Filtro, number> = {
      TODOS: linhas?.length ?? 0,
      HABILITADO: 0, EXTRA: 0, DESQUALIFICADO: 0, SUSPEITO: 0,
    };
    for (const l of linhas ?? []) c[l.status]++;
    return c;
  }, [linhas]);

  const pessoasConcorrendo = useMemo(() => {
    const set = new Set<string>();
    for (const l of linhas ?? []) {
      if ((l.status === 'HABILITADO' || l.status === 'SUSPEITO') && l.autor_username) {
        set.add(l.autor_username);
      }
    }
    return set.size;
  }, [linhas]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (linhas ?? [])
      .filter((l) => filtro === 'TODOS' || l.status === filtro)
      .filter((l) => !termo || (l.autor_username ?? '').toLowerCase().includes(termo))
      .slice(0, 300);
  }, [linhas, filtro, busca]);

  async function exportarCsv() {
    if (!id) return;
    const chances = await listarChances(id);
    const csv =
      'ordem,autor_username,ig_comment_id\n' +
      chances.map((c) => `${c.ordem},${c.autor_username},${c.ig_comment_id}`).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `participantes-${id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (erro && !linhas)
    return (
      <div className="sx-wrap">
        <div className="sx-note sx-note--warn" role="alert">
          <Icone nome="info" tamanho={15} traco={2} />
          {erro}
        </div>
      </div>
    );
  if (!linhas) return <p className="sx-hint">Carregando participantes…</p>;

  return (
    <div className="sx-wrap">
      <header className="sx-head">
        <p className="ra-eyebrow">Participantes</p>
        <h1 className="sx-h1">
          {pessoasConcorrendo} pessoas <em>concorrendo</em>
        </h1>
        <p className="sx-lede">
          {sorteio?.titulo} · mínimo {sorteio?.mencoes_minimas} menção
          {(sorteio?.mencoes_minimas ?? 0) > 1 ? 'ões' : ''}
          {sorteio?.modo === 'POR_COMENTARIO'
            ? ' · uma chance por comentário'
            : ' · uma chance por pessoa'}
        </p>
      </header>

      <div className="sx-stats">
        <div className="sx-stat sx-stat--hero">
          <div className="sx-stat-n is-teal">{pessoasConcorrendo}</div>
          <div className="sx-stat-l">concorrendo</div>
        </div>
        <div className="sx-stat">
          <div className="sx-stat-n">{contagens.TODOS}</div>
          <div className="sx-stat-l">comentários</div>
        </div>
        <div className="sx-stat">
          <div className="sx-stat-n">{contagens.EXTRA}</div>
          <div className="sx-stat-l">extras</div>
        </div>
        <div className="sx-stat">
          <div className="sx-stat-n">{contagens.DESQUALIFICADO}</div>
          <div className="sx-stat-l">fora das regras</div>
        </div>
      </div>

      <div className="sx-filters">
        {(['TODOS', 'HABILITADO', 'EXTRA', 'DESQUALIFICADO', 'SUSPEITO'] as Filtro[])
          .filter((f) => f !== 'SUSPEITO' || contagens.SUSPEITO > 0)
          .map((f) => (
            <button
              key={f}
              className={`sx-filter${filtro === f ? ' is-on' : ''}`}
              aria-pressed={filtro === f}
              onClick={() => setFiltro(f)}
            >
              {ROTULO_FILTRO[f]}
              <b>{contagens[f]}</b>
            </button>
          ))}
      </div>

      <input
        className="sx-input"
        placeholder="Buscar @username…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        style={{ maxWidth: 320, marginBottom: 14 }}
      />

      <div className="sx-list">
        {visiveis.map((l) => (
          <div key={l.comentario_id} className="sx-p">
            <Avatar username={l.autor_username} />
            <div className="sx-p-main">
              <span className="sx-p-user">@{l.autor_username ?? '—'}</span>
              <span className="sx-p-txt">{l.texto || '(sem texto)'}</span>
            </div>
            {l.motivo && <span className="sx-p-reason">{rotuloMotivo(l.motivo)}</span>}
            <span className={CLASSE_TAG[l.status]}>{ROTULO_STATUS[l.status] ?? l.status}</span>
          </div>
        ))}
        {visiveis.length === 0 && (
          <div className="sx-empty">Nenhum participante neste filtro.</div>
        )}
      </div>

      {contagens[filtro] > visiveis.length && (
        <p className="sx-hint" style={{ marginTop: 10, textAlign: 'center' }}>
          Mostrando {visiveis.length} de {contagens[filtro]} — refine a busca para ver outros.
        </p>
      )}

      <div className="sx-actions">
        {sorteio?.status === 'PRONTO' && (
          <Link to={`/sorteios/${id}/executar`} className="sx-btn sx-btn--primary sx-btn--lg">
            Seguir para o sorteio
          </Link>
        )}
        {sorteio?.status === 'SORTEADO' && (
          <Link to={`/sorteios/${id}/live`} className="sx-btn sx-btn--primary sx-btn--lg">
            Modo palco
          </Link>
        )}
        <button className="sx-btn" onClick={exportarCsv}>
          <Icone nome="download" tamanho={15} traco={2} />
          Exportar CSV
        </button>
      </div>
    </div>
  );
}
