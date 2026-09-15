import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import { Layout } from './routes/Layout';
import { AcessoAtol } from './features/auth/AcessoAtol';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, lazy: async () => ({ Component: (await import('./routes/Home')).Home }) },
      { path: 'login', lazy: async () => ({ Component: (await import('./features/auth/Login')).Login }) },
      { element: <AcessoAtol />, children: [
      { path: 'conectar', lazy: async () => ({ Component: (await import('./features/conta/ConectarConta')).ConectarConta }) },
      { path: 'auth/callback', lazy: async () => ({ Component: (await import('./features/conta/AuthCallback')).AuthCallback }) },
      { path: 'demo/roleta', lazy: async () => ({ Component: (await import('./routes/DemoRoleta')).DemoRoleta }) },
      { path: 'historico', lazy: async () => ({ Component: (await import('./features/historico/Historico')).Historico }) },
      { path: 'sorteios/novo', lazy: async () => ({ Component: (await import('./features/sorteios/NovoSorteio')).NovoSorteio }) },
      { path: 'sorteios/:id/participantes', lazy: async () => ({ Component: (await import('./features/sorteios/Participantes')).Participantes }) },
      { path: 'sorteios/:id/executar', lazy: async () => ({ Component: (await import('./features/sorteios/Executar')).Executar }) },
      { path: 'sorteios/:id/comprovante', lazy: async () => ({ Component: (await import('./features/sorteios/Comprovante')).Comprovante }) },
      { path: 'sorteios/:id/live', lazy: async () => ({ Component: (await import('./features/sorteios/Live')).Live }) },
      {
        path: 'marketing',
        lazy: async () => ({ Component: (await import('./features/marketing/MarketingProtegido')).MarketingProtegido }),
        children: [
          { path: 'agenda', lazy: async () => ({ Component: (await import('./features/marketing/Agenda')).AgendaMarketing }) },
          { path: 'novo', lazy: async () => ({ Component: (await import('./features/marketing/NovoBriefing')).NovoBriefingMarketing }) },
          { path: 'briefings/:id', lazy: async () => ({ Component: (await import('./features/marketing/NovoBriefing')).NovoBriefingMarketing }) },
          { path: 'briefings/:id/estrategia', lazy: async () => ({ Component: (await import('./features/marketing/EstrategiaConteudo')).EstrategiaConteudoMarketing }) },
          { path: 'metricas', lazy: async () => ({ Component: (await import('./features/marketing/MetricasInstagram')).MetricasInstagramMarketing }) },
          { path: 'comentarios', lazy: async () => ({ Component: (await import('./features/marketing/Comentarios')).ComentariosMarketing }) },
          { path: 'relatorio', lazy: async () => ({ Component: (await import('./features/marketing/RelatorioSemanal')).RelatorioSemanalMarketing }) },
          { path: 'insights', lazy: async () => ({ Component: (await import('./features/marketing/Insights')).InsightsMarketing }) },
        ],
      },
      ] },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
