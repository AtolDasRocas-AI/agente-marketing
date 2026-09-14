import { useState } from 'react';
import { Roleta } from '../features/sorteios/Roleta';
import { Confete } from '../components/Confete';
import { Avatar } from '../components/Avatar';

// Amostra de usernames reais de um sorteio importado (demonstração visual)
const PARTICIPANTES = [
  'gebarareef', 'neg4el', 'roobsonsant', 'lunnnari', 'jordaocas',
  'melissaduartebarbosa.adv', 'barrak_aquicultura', 'neusaboti', 'hccj100',
  'wenner_cantanhede', 'reef_ruivo', 'gustavo_lima504', 'arielreefbr',
  'nanoreefer13', 'drbananareef', 'ciclideosudi', 'forfishoficial',
].map((autor_username) => ({ autor_username }));

const VENCEDOR = 'reef_ruivo';
const SUPLENTES = ['neg4el', 'lunnnari', 'barrak_aquicultura'];

export function DemoRoleta() {
  const [rodada, setRodada] = useState(0);
  const [girou, setGirou] = useState(false);
  const [terminou, setTerminou] = useState(false);

  return (
    <div className="sx-wrap">
      <Confete ativo={terminou} />

      <header className="sx-head">
        <p className="ra-eyebrow">Demonstração</p>
        <h1 className="sx-h1">
          A roleta do <em>palco</em>
        </h1>
        <p className="sx-lede">
          O vencedor já foi decidido pelo motor determinístico — a animação apenas revela.
        </p>
      </header>

      <div className="sx-stage">
        {girou ? (
          <Roleta
            key={rodada}
            participantes={PARTICIPANTES}
            vencedor={VENCEDOR}
            onFim={() => setTerminou(true)}
          />
        ) : (
          <p className="sx-hint" style={{ padding: '48px 0' }}>
            {PARTICIPANTES.length} participantes na urna
          </p>
        )}

        {terminou && (
          <div className="sx-alts" style={{ maxWidth: 420, marginInline: 'auto' }}>
            <p className="sx-proof-label">Suplentes</p>
            {SUPLENTES.map((s, i) => (
              <div key={s} className="sx-alt">
                <b>{i + 1}º</b>
                <Avatar username={s} />
                <span>@{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sx-actions">
        <button
          className="sx-btn sx-btn--primary sx-btn--lg"
          disabled={girou && !terminou}
          onClick={() => {
            setTerminou(false);
            setGirou(true);
            setRodada((r) => r + 1);
          }}
        >
          {terminou ? 'Rodar de novo' : girou ? 'Sorteando…' : 'Sortear'}
        </button>
      </div>
    </div>
  );
}
