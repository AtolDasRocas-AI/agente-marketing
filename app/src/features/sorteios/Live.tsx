import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Roleta } from './Roleta';
import { Confete } from '../../components/Confete';
import { Avatar } from '../../components/Avatar';
import { Icone } from '../../components/Icone';
import {
  buscarResultado, buscarSorteio, listarChances,
  type ResultadoPersistido, type SorteioResumo,
} from './api';
import { mensagemDeErro } from '../../lib/erro';

const ORDINAIS = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º', '10º'];
const ordinal = (i: number) => ORDINAIS[i] ?? `${i + 1}º`;

/** A API não informa se a pessoa segue o perfil — conferência é manual */
function LinkPerfil({ username }: { username: string }) {
  return (
    <a
      href={`https://www.instagram.com/${username}/`}
      target="_blank"
      rel="noreferrer"
      style={{ fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      conferir perfil
      <Icone nome="externo" tamanho={12} traco={2} />
    </a>
  );
}

/** Modo palco (CAP-10): revela todos os ganhadores em sequência */
export function Live() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sorteio, setSorteio] = useState<SorteioResumo | null>(null);
  const [resultado, setResultado] = useState<ResultadoPersistido | null>(null);
  const [pool, setPool] = useState<Array<{ autor_username: string }>>([]);
  const [erro, setErro] = useState<string | null>(null);

  const [revelados, setRevelados] = useState(0);
  const [girando, setGirando] = useState(false);
  const [rodada, setRodada] = useState(0);
  const [conferidos, setConferidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    Promise.all([buscarSorteio(id), buscarResultado(id), listarChances(id)])
      .then(([s, r, chances]) => {
        setSorteio(s);
        setResultado(r);
        const distintos = [...new Set(chances.map((c) => c.autor_username))];
        setPool(distintos.map((autor_username) => ({ autor_username })));
      })
      .catch((e) => setErro(mensagemDeErro(e)));
  }, [id]);

  const vencedores = useMemo(() => resultado?.vencedores ?? [], [resultado]);
  const suplentes = useMemo(() => resultado?.suplentes ?? [], [resultado]);
  const faltam = vencedores.length - revelados;
  const terminou = faltam <= 0 && !girando;

  function alternarConferido(username: string) {
    setConferidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(username)) novo.delete(username);
      else novo.add(username);
      return novo;
    });
  }

  if (erro)
    return (
      <div className="sx-wrap">
        <div className="sx-note sx-note--warn" role="alert">
          <Icone nome="info" tamanho={15} traco={2} />
          <span>{erro}</span>
        </div>
      </div>
    );
  if (!sorteio) return <p className="sx-hint">Carregando…</p>;
  if (!resultado)
    return (
      <div className="sx-wrap--narrow">
        <div className="sx-card sx-card--pad" style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22 }}>
            Sorteio ainda não executado
          </h2>
          <p className="sx-hint" style={{ margin: '8px auto 18px', maxWidth: '46ch' }}>
            Execute o sorteio com a semente publicada para liberar o modo palco.
          </p>
          <button className="sx-btn sx-btn--primary" onClick={() => navigate(`/sorteios/${id}/executar`)}>
            Ir para o sorteio
          </button>
        </div>
      </div>
    );

  return (
    <div className="sx-wrap">
      <Confete ativo={terminou && revelados > 0} />

      <header className="sx-head">
        <p className="ra-eyebrow">Modo palco</p>
        <h1 className="sx-h1">
          {revelados === 0 ? (
            <>
              A urna está <em>congelada</em>
            </>
          ) : terminou ? (
            <>
              Temos <em>{vencedores.length > 1 ? 'ganhadores' : 'vencedor'}</em>
            </>
          ) : (
            <>
              Girando a <em>urna</em>
            </>
          )}
        </h1>
        <p className="sx-lede">
          {sorteio.titulo} · o resultado já está calculado e assinado — a animação apenas revela.
        </p>
      </header>

      <div className="sx-stage">
        <div className="sx-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: 420, margin: '0 auto' }}>
          <div className="sx-stat">
            <div className="sx-stat-n">{resultado.total_comentarios}</div>
            <div className="sx-stat-l">comentários</div>
          </div>
          <div className="sx-stat sx-stat--hero">
            <div className="sx-stat-n is-teal">{resultado.total_chances}</div>
            <div className="sx-stat-l">concorrendo</div>
          </div>
          <div className="sx-stat">
            <div className="sx-stat-n">{vencedores.length}</div>
            <div className="sx-stat-l">ganhador{vencedores.length > 1 ? 'es' : ''}</div>
          </div>
        </div>

        {girando || revelados > 0 ? (
          <>
            <Roleta
              key={rodada}
              participantes={pool}
              vencedor={vencedores[Math.min(revelados, vencedores.length - 1)]?.autor_username ?? ''}
              onFim={() => {
                setRevelados((n) => Math.min(n + 1, vencedores.length));
                setGirando(false);
              }}
            />
            <p className="sx-hint" style={{ marginTop: 12 }}>
              {girando
                ? `${resultado.total_chances} chances na urna · desacelerando…`
                : `sorteado entre ${resultado.total_chances} chances · semente ${resultado.seed_publica}`}
            </p>
          </>
        ) : (
          <p className="sx-hint" style={{ marginTop: 22 }}>
            cada pessoa conta uma vez, não importa quantos comentários fez · semente{' '}
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-2)' }}>
              {resultado.seed_publica}
            </span>
          </p>
        )}

        {revelados > 0 && (
          <div className="sx-winner" style={{ marginTop: 22 }}>
            {vencedores.slice(0, revelados).map((v, i) => (
              <div key={v.ig_comment_id} style={{ marginBottom: i < revelados - 1 ? 18 : 0 }}>
                {vencedores.length > 1 && (
                  <div className="sx-winner-pos">{ordinal(i)} lugar</div>
                )}
                <Avatar username={v.autor_username} tamanho={i === revelados - 1 ? 'xl' : 'lg'} />
                <div className="sx-winner-user">@{v.autor_username}</div>
                <div
                  style={{
                    display: 'flex', gap: 12, justifyContent: 'center',
                    alignItems: 'center', marginTop: 6, flexWrap: 'wrap',
                  }}
                >
                  <LinkPerfil username={v.autor_username} />
                  <label className="sx-check" style={{ fontSize: 11.5 }}>
                    <input
                      type="checkbox"
                      checked={conferidos.has(v.autor_username)}
                      onChange={() => alternarConferido(v.autor_username)}
                    />
                    conferido
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        {terminou && revelados > 0 && suplentes.length > 0 && (
          <div className="sx-alts" style={{ maxWidth: 420, marginInline: 'auto' }}>
            <p className="sx-proof-label">Suplentes</p>
            {suplentes.map((s, i) => (
              <div key={s.ig_comment_id} className="sx-alt">
                <b>{ordinal(i)}</b>
                <Avatar username={s.autor_username} />
                <span style={{ flex: 1 }}>@{s.autor_username}</span>
                <LinkPerfil username={s.autor_username} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sx-actions">
        <button
          className="sx-btn sx-btn--primary sx-btn--lg"
          disabled={girando}
          onClick={() => {
            if (faltam <= 0) {
              setRevelados(0);
              setConferidos(new Set());
            }
            setGirando(true);
            setRodada((r) => r + 1);
          }}
        >
          {girando
            ? 'Sorteando…'
            : faltam <= 0
              ? 'Rever a animação'
              : revelados === 0
                ? vencedores.length > 1 ? `Sortear ${ordinal(0)} lugar` : 'Revelar vencedor'
                : `Sortear ${ordinal(revelados)} lugar`}
        </button>
        {terminou && revelados > 0 && (
          <button className="sx-btn" onClick={() => navigate(`/sorteios/${id}/comprovante`)}>
            Gerar comprovante
          </button>
        )}
      </div>

      {revelados > 0 && (
        <>
          <p className="sx-step">
            <b>·</b> Prova do resultado
          </p>
          <div className="sx-card">
            <dl className="sx-kv">
              <dt>Semente pública</dt>
              <dd>{resultado.seed_publica}</dd>
              <dt>Hash da lista</dt>
              <dd>{resultado.hash_lista}</dd>
              <dt>Execução (UTC)</dt>
              <dd>{new Date(resultado.executado_em).toISOString()}</dd>
            </dl>
            <p className="sx-hint" style={{ marginTop: 12 }}>
              A API do Instagram não informa se a pessoa segue o perfil — use os links acima
              para conferir antes de premiar.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
