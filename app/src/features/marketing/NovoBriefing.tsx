import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  FORMATOS, estadoAoSalvar, type DadosBriefing, validarBriefing,
} from './model';
import { repositorioLocalMarketing } from './repository';

const INICIAL: DadosBriefing = {
  titulo: '', objetivo: '', publico: '', pilar: '', formato: 'CARROSSEL',
  data_planejada: '', hipotese: '',
};

function dadosDoItem(item: DadosBriefing): DadosBriefing {
  return {
    titulo: item.titulo,
    objetivo: item.objetivo,
    publico: item.publico,
    pilar: item.pilar,
    formato: item.formato,
    data_planejada: item.data_planejada,
    hipotese: item.hipotese,
  };
}

export function NovoBriefingMarketing() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [inicializacao] = useState<{
    dados: DadosBriefing;
    naoEncontrado?: boolean;
    erro?: string;
  }>(() => {
    if (!id) return { dados: INICIAL };
    try {
      const item = repositorioLocalMarketing.buscar(id);
      return item ? { dados: dadosDoItem(item) } : { dados: INICIAL, naoEncontrado: true };
    } catch (erro) {
      return {
        dados: INICIAL,
        erro: erro instanceof Error ? erro.message : 'Não foi possível abrir este briefing.',
      };
    }
  });
  const [dados, setDados] = useState<DadosBriefing>(inicializacao.dados);
  const [erros, setErros] = useState<Partial<Record<keyof DadosBriefing, string>>>({});
  const [erroGeral, setErroGeral] = useState(inicializacao.erro ?? '');
  const emEdicao = Boolean(id);

  function atualizar<K extends keyof DadosBriefing>(campo: K, valor: DadosBriefing[K]) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: undefined }));
    setErroGeral('');
  }

  function salvar(completo: boolean) {
    const validacao = validarBriefing(dados, completo);
    setErros(validacao);
    if (Object.keys(validacao).length) {
      const primeiroCampo = Object.keys(validacao)[0];
      document.getElementById(primeiroCampo === 'data_planejada' ? 'data' : primeiroCampo)?.focus();
      return;
    }

    try {
      const status = estadoAoSalvar(dados, completo);
      if (id) repositorioLocalMarketing.atualizar(id, dados, status);
      else repositorioLocalMarketing.criar(dados, status);
      navigate('/marketing/agenda', {
        state: { aviso: id ? 'Briefing atualizado com sucesso.' : 'Briefing salvo com sucesso.' },
      });
    } catch (erro) {
      setErroGeral(erro instanceof Error ? erro.message : 'Não foi possível salvar o briefing.');
    }
  }

  function salvarRascunho(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    salvar(false);
  }

  if (inicializacao.naoEncontrado) {
    return (
      <Navigate
        to="/marketing/agenda"
        replace
        state={{ aviso: 'O briefing solicitado não foi encontrado. A agenda foi mantida sem alterações.' }}
      />
    );
  }

  return (
    <div className="sx-wrap--narrow">
      <header className="sx-head">
        <p className="ra-eyebrow">Marketing · Agenda</p>
        <h1 className="sx-h1">{emEdicao ? 'Editar' : 'Novo'} <em>briefing</em></h1>
        <p className="sx-lede">
          {emEdicao
            ? 'Retome a ideia, complete o contexto e preserve o histórico deste briefing.'
            : 'Um bom briefing deixa o próximo passo da IA revisável e ligado a uma hipótese.'}
        </p>
      </header>

      <form className="sx-card sx-card--pad sm-form" onSubmit={salvarRascunho}>
        {erroGeral && <div className="sx-note sx-note--warn" role="alert">{erroGeral}</div>}

        <div className="sx-field">
          <label htmlFor="titulo">Título de trabalho</label>
          <input id="titulo" className="sx-input" value={dados.titulo} maxLength={180}
            aria-invalid={Boolean(erros.titulo)} aria-describedby={erros.titulo ? 'titulo-erro' : undefined}
            onChange={(e) => atualizar('titulo', e.target.value)} placeholder="Ex.: Guia de corais para iniciantes" />
          {erros.titulo && <span className="sm-error" id="titulo-erro">{erros.titulo}</span>}
        </div>

        <div className="sx-field">
          <label htmlFor="objetivo">Objetivo</label>
          <textarea id="objetivo" className="sx-input" rows={3} value={dados.objetivo}
            aria-invalid={Boolean(erros.objetivo)} aria-describedby={erros.objetivo ? 'objetivo-erro' : undefined}
            onChange={(e) => atualizar('objetivo', e.target.value)} placeholder="Qual comportamento ou resultado este conteúdo deve estimular?" />
          {erros.objetivo && <span className="sm-error" id="objetivo-erro">{erros.objetivo}</span>}
        </div>

        <div className="sx-field">
          <label htmlFor="publico">Público</label>
          <input id="publico" className="sx-input" value={dados.publico}
            aria-invalid={Boolean(erros.publico)} aria-describedby={erros.publico ? 'publico-erro' : undefined}
            onChange={(e) => atualizar('publico', e.target.value)} placeholder="Ex.: aquaristas iniciantes" />
          {erros.publico && <span className="sm-error" id="publico-erro">{erros.publico}</span>}
        </div>

        <div className="sx-field">
          <label htmlFor="pilar">Pilar editorial</label>
          <input id="pilar" className="sx-input" value={dados.pilar}
            aria-invalid={Boolean(erros.pilar)} aria-describedby={erros.pilar ? 'pilar-erro' : undefined}
            onChange={(e) => atualizar('pilar', e.target.value)} placeholder="Ex.: educação, produto, comunidade" />
          {erros.pilar && <span className="sm-error" id="pilar-erro">{erros.pilar}</span>}
        </div>

        <div className="sm-grid-2">
          <div className="sx-field">
            <label htmlFor="formato">Formato</label>
            <select id="formato" className="sx-input" value={dados.formato}
              onChange={(e) => atualizar('formato', e.target.value as DadosBriefing['formato'])}>
              {FORMATOS.map((formato) => <option key={formato.valor} value={formato.valor}>{formato.rotulo}</option>)}
            </select>
          </div>
          <div className="sx-field">
            <label htmlFor="data">Data planejada</label>
            <input id="data" className="sx-input" type="date" value={dados.data_planejada}
              aria-invalid={Boolean(erros.data_planejada)}
              aria-describedby={erros.data_planejada ? 'data-erro' : undefined}
              onChange={(e) => atualizar('data_planejada', e.target.value)} />
            {erros.data_planejada && <span className="sm-error" id="data-erro">{erros.data_planejada}</span>}
          </div>
        </div>

        <div className="sx-field">
          <label htmlFor="hipotese">Hipótese de teste</label>
          <textarea id="hipotese" className="sx-input" rows={3} value={dados.hipotese}
            aria-invalid={Boolean(erros.hipotese)} aria-describedby={erros.hipotese ? 'hipotese-erro' : undefined}
            onChange={(e) => atualizar('hipotese', e.target.value)} placeholder="Ex.: um checklist objetivo aumentará salvamentos." />
          {erros.hipotese && <span className="sm-error" id="hipotese-erro">{erros.hipotese}</span>}
        </div>

        <div className="sx-note">
          <span>O assistente de conteúdo será o próximo corte. Nenhuma chamada de IA ou publicação acontece nesta tela.</span>
        </div>

        <div className="sx-actions">
          <button className="sx-btn" type="submit">{emEdicao ? 'Salvar alterações' : 'Salvar rascunho'}</button>
          <button className="sx-btn sx-btn--primary" type="button" onClick={() => salvar(true)}>
            Preparar estratégia
          </button>
          <Link to="/marketing/agenda" className="sx-btn sx-btn--ghost">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
