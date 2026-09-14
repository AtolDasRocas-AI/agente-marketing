import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icone } from '../../components/Icone';
import { concluirConexao } from './api';
import { mensagemDeErro } from '../../lib/erro';

type Estado =
  | { fase: 'trocando' }
  | { fase: 'ok'; username: string }
  | { fase: 'erro'; mensagem: string };

/** Recebe o ?code do Instagram e conclui a troca de token via Edge Function */
export function AuthCallback() {
  const [params] = useSearchParams();
  const [estado, setEstado] = useState<Estado>({ fase: 'trocando' });
  const executou = useRef(false); // code é de uso único — StrictMode não pode disparar 2x

  useEffect(() => {
    if (executou.current) return;
    executou.current = true;

    const code = params.get('code');
    const erro = params.get('error_description') || params.get('error');
    if (!code) {
      setEstado({ fase: 'erro', mensagem: erro ?? 'Nenhum código recebido no callback.' });
      return;
    }
    concluirConexao(code.replace(/#_$/, ''))
      .then((conta) => setEstado({ fase: 'ok', username: conta.username }))
      .catch((err) =>
        setEstado({ fase: 'erro', mensagem: mensagemDeErro(err) })
      );
  }, [params]);

  return (
    <div className="sx-wrap--narrow">
      <div className="sx-card sx-card--pad" style={{ textAlign: 'center' }}>
        {estado.fase === 'trocando' && (
          <>
            <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22 }}>Conectando…</h2>
            <p className="sx-hint" style={{ marginTop: 8 }}>
              Trocando o código por um token seguro no servidor.
            </p>
          </>
        )}
        {estado.fase === 'ok' && (
          <>
            <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22 }}>
              Conta conectada
            </h2>
            <p className="sx-hint" style={{ margin: '8px 0 18px' }}>
              <strong>@{estado.username}</strong> vinculada com sucesso.
            </p>
            <Link to="/sorteios/novo" className="sx-btn sx-btn--primary">
              Escolher um post
            </Link>
          </>
        )}
        {estado.fase === 'erro' && (
          <>
            <div className="sx-note sx-note--warn" role="alert" style={{ textAlign: 'left' }}>
              <Icone nome="info" tamanho={15} traco={2} />
              <span>{estado.mensagem}</span>
            </div>
            <Link to="/conectar" className="sx-btn" style={{ marginTop: 16 }}>
              Tentar de novo
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
