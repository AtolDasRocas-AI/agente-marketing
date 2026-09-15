import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icone } from '../../components/Icone';
import { CapaPost } from '../../components/CapaPost';
import {
  listarMidias, criarSorteio, importarTudo, processarRegras,
  contarComentarios,
  type MidiaInstagram, type ContagemPost,
} from './api';
import { mensagemDeErro } from '../../lib/erro';

function Stepper({
  rotulo, valor, minimo, aoMudar,
}: { rotulo: string; valor: number; minimo: number; aoMudar: (n: number) => void }) {
  return (
    <div className="sx-field">
      <label>{rotulo}</label>
      <div className="sx-stepper">
        <button type="button" onClick={() => aoMudar(Math.max(minimo, valor - 1))} aria-label={`Diminuir ${rotulo}`}>
          −
        </button>
        <span>{valor}</span>
        <button type="button" onClick={() => aoMudar(valor + 1)} aria-label={`Aumentar ${rotulo}`}>
          +
        </button>
      </div>
    </div>
  );
}

export function NovoSorteio() {
  const navigate = useNavigate();
  const [midias, setMidias] = useState<MidiaInstagram[] | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [conta, setConta] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState<MidiaInstagram | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [pct, setPct] = useState(0);

  const [contagem, setContagem] = useState<ContagemPost | null>(null);
  const [contando, setContando] = useState(false);

  const [incluirRespostas, setIncluirRespostas] = useState(false);
  const [modo, setModo] = useState<'POR_PESSOA' | 'POR_COMENTARIO'>('POR_PESSOA');
  const [tetoChances, setTetoChances] = useState(3);
  const [mencoesMinimas, setMencoesMinimas] = useState(1);
  const [palavraChave, setPalavraChave] = useState('');
  const [qtdVencedores, setQtdVencedores] = useState(1);
  const [qtdSuplentes, setQtdSuplentes] = useState(3);

  useEffect(() => {
    listarMidias()
      .then(({ midias, account_id, username }) => {
        setMidias(midias);
        setAccountId(account_id);
        setConta(username);
      })
      .catch((e) => setErro(mensagemDeErro(e)));
  }, []);

  /** ao escolher o post, busca a contagem exata (1º nível + respostas) */
  function escolher(m: MidiaInstagram) {
    setEscolhido(m);
    setContagem(null);
    setContando(true);
    contarComentarios(m.id)
      .then(setContagem)
      .catch(() => setContagem(null))
      .finally(() => setContando(false));
  }

  async function criar() {
    if (!escolhido || !accountId) return;
    setSalvando(true);
    setErro(null);
    try {
      const { id } = await criarSorteio({
        account_id: accountId,
        ig_media_id: escolhido.id,
        permalink: escolhido.permalink,
        titulo: (escolhido.caption ?? 'Sorteio').split('\n')[0].slice(0, 80),
        modo,
        teto_chances: modo === 'POR_COMENTARIO' ? tetoChances : null,
        mencoes_minimas: mencoesMinimas,
        palavra_chave: palavraChave.trim() || null,
        marcar_suspeitos: false,
        incluir_respostas: incluirRespostas,
        qtd_vencedores: qtdVencedores,
        qtd_suplentes: qtdSuplentes,
        janela_inicio: null,
        janela_fim: null,
      });

      setProgresso('Importando comentários');
      const total = await importarTudo(id, (n) => {
        setProgresso(`Importando comentários — ${n} de ${escolhido.comments_count}`);
        setPct(Math.min(100, Math.round((n / Math.max(1, escolhido.comments_count)) * 100)));
      });
      setProgresso(`Aplicando as regras em ${total} comentários`);
      setPct(100);
      await processarRegras(id);
      navigate(`/sorteios/${id}/participantes`);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setProgresso(null);
    } finally {
      setSalvando(false);
    }
  }

  if (erro && !midias)
    return (
      <div className="sx-wrap">
        <div className="sx-note sx-note--warn" role="alert">
          <Icone nome="info" tamanho={15} traco={2} />
          <span>{erro}</span>
        </div>
      </div>
    );
  if (!midias) return <p className="sx-hint">Carregando seus posts…</p>;

  return (
    <div className="sx-wrap">
      <header className="sx-head">
        <p className="ra-eyebrow">Novo sorteio</p>
        <h1 className="sx-h1">
          Escolha o post e as <em>regras</em>
        </h1>
        <p className="sx-lede">
          Só posts do feed das contas vinculadas. Reels e stories não são suportados pela API.
        </p>
      </header>

      <p className="sx-step">
        <b>01</b> Qual post
      </p>

      <div className="sx-posts">
        {midias.map((m) => (
          <button
            key={m.id}
            className={`sx-post${escolhido?.id === m.id ? ' is-on' : ''}`}
            aria-pressed={escolhido?.id === m.id}
            onClick={() => escolher(m)}
          >
            <CapaPost midia={m} />
            <span className="sx-post-check">
              <Icone nome="check" tamanho={11} traco={3} />
            </span>
            <span className="sx-post-meta">
              <span>{new Date(m.timestamp).toLocaleDateString('pt-BR')}</span>
              <span>
                💬 <b>{m.comments_count}</b>
              </span>
            </span>
          </button>
        ))}
      </div>

      {escolhido && (
        <div className="sx-note" style={{ marginTop: 14 }}>
          <Icone nome="info" tamanho={15} traco={2} />
          <span>
            <strong>{(escolhido.caption ?? 'Sem legenda').split('\n')[0].slice(0, 70)}</strong>
            <br />
            {contando ? (
              <>contando comentários…</>
            ) : contagem ? (
              <>
                <b style={{ fontFamily: "'JetBrains Mono', monospace" }}>{contagem.nivel1}</b>{' '}
                comentários
                {contagem.respostas > 0 && (
                  <>
                    {' '}+{' '}
                    <b style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {contagem.respostas}
                    </b>{' '}
                    respostas
                    {incluirRespostas ? ' (participam)' : ' (não participam)'}
                  </>
                )}
                {' · '}
                {contagem.respostas > 0 && (
                  <>o Instagram mostra {contagem.total} · </>
                )}
              </>
            ) : (
              <>{escolhido.comments_count} comentários · </>
            )}
            publicado em {new Date(escolhido.timestamp).toLocaleDateString('pt-BR')} · @{conta}
          </span>
        </div>
      )}

      <p className="sx-step">
        <b>02</b> Regras de participação
      </p>

      <div className="sx-card sx-card--pad" style={{ display: 'grid', gap: 20 }}>
        <div className="sx-field">
          <label>Como contar as chances</label>
          <div className="sx-seg" role="group">
            <button
              type="button"
              className={modo === 'POR_PESSOA' ? 'is-on' : ''}
              aria-pressed={modo === 'POR_PESSOA'}
              onClick={() => setModo('POR_PESSOA')}
            >
              Uma por pessoa
            </button>
            <button
              type="button"
              className={modo === 'POR_COMENTARIO' ? 'is-on' : ''}
              aria-pressed={modo === 'POR_COMENTARIO'}
              onClick={() => setModo('POR_COMENTARIO')}
            >
              Uma por comentário
            </button>
          </div>
          <p className="sx-hint">
            {modo === 'POR_PESSOA'
              ? 'Cada pessoa concorre uma vez, não importa quantas vezes comentou.'
              : 'Cada comentário válido vira uma chance, até o teto configurado.'}
          </p>
        </div>

        <div className="sx-row" style={{ gap: 26 }}>
          <Stepper rotulo="Menções mínimas" valor={mencoesMinimas} minimo={0} aoMudar={setMencoesMinimas} />
          <Stepper rotulo="Ganhadores" valor={qtdVencedores} minimo={1} aoMudar={setQtdVencedores} />
          <Stepper rotulo="Suplentes" valor={qtdSuplentes} minimo={0} aoMudar={setQtdSuplentes} />
          {modo === 'POR_COMENTARIO' && (
            <Stepper rotulo="Teto de chances" valor={tetoChances} minimo={1} aoMudar={setTetoChances} />
          )}
        </div>

        <div className="sx-field">
          <label>Respostas a comentários</label>
          <label className="sx-check">
            <input
              type="checkbox"
              checked={incluirRespostas}
              onChange={(e) => setIncluirRespostas(e.target.checked)}
            />
            <span>
              Respostas também concorrem
              {contagem && contagem.respostas > 0 && (
                <>
                  {' '}— este post tem{' '}
                  <b style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {contagem.respostas}
                  </b>
                </>
              )}
            </span>
          </label>
          <p className="sx-hint">
            O Instagram soma as respostas na contagem que você vê no app; a API as separa.
            Normalmente são conversa ("boa sorte!"), por isso vêm desligadas.
          </p>
        </div>

        <div className="sx-field">
          <label>
            Palavra ou hashtag obrigatória{' '}
            <span style={{ color: 'var(--muted-2)', fontWeight: 500 }}>— opcional</span>
          </label>
          <input
            className="sx-input"
            placeholder="ex.: EU QUERO"
            value={palavraChave}
            onChange={(e) => setPalavraChave(e.target.value)}
          />
          <p className="sx-hint">Ignora acentos e maiúsculas. Vazio desativa a regra.</p>
        </div>

        <p className="sx-hint">
          {qtdVencedores === 1
            ? 'Um ganhador.'
            : `${qtdVencedores} ganhadores — revelados em sequência no modo palco (1º, 2º…).`}{' '}
          Suplentes só assumem se alguém for desclassificado.
        </p>
      </div>

      {salvando && progresso && (
        <div className="sx-card" style={{ marginTop: 16 }}>
          <p className="sx-proof-label">{progresso}</p>
          <div className="sx-bar">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {erro && (
        <div className="sx-note sx-note--warn" role="alert" style={{ marginTop: 16 }}>
          <Icone nome="info" tamanho={15} traco={2} />
          <span>{erro}</span>
        </div>
      )}

      <div className="sx-actions">
        <button
          className="sx-btn sx-btn--primary sx-btn--lg"
          disabled={!escolhido || salvando}
          onClick={criar}
        >
          {salvando
            ? 'Importando…'
            : escolhido
              ? `Importar ${escolhido.comments_count} comentários`
              : 'Escolha um post acima'}
        </button>
        <button className="sx-btn sx-btn--ghost" onClick={() => navigate('/')} disabled={salvando}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
