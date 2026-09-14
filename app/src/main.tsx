import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import { Layout } from './routes/Layout';
import { Home } from './routes/Home';
import { Login } from './features/auth/Login';
import { ConectarConta } from './features/conta/ConectarConta';
import { AuthCallback } from './features/conta/AuthCallback';
import { DemoRoleta } from './routes/DemoRoleta';
import { NovoSorteio } from './features/sorteios/NovoSorteio';
import { Participantes } from './features/sorteios/Participantes';
import { Comprovante } from './features/sorteios/Comprovante';
import { Executar } from './features/sorteios/Executar';
import { Live } from './features/sorteios/Live';
import { Historico } from './features/historico/Historico';
import { AgendaMarketing } from './features/marketing/Agenda';
import { NovoBriefingMarketing } from './features/marketing/NovoBriefing';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'login', element: <Login /> },
      { path: 'conectar', element: <ConectarConta /> },
      { path: 'auth/callback', element: <AuthCallback /> },
      { path: 'demo/roleta', element: <DemoRoleta /> },
      { path: 'historico', element: <Historico /> },
      { path: 'sorteios/novo', element: <NovoSorteio /> },
      { path: 'sorteios/:id/participantes', element: <Participantes /> },
      { path: 'sorteios/:id/executar', element: <Executar /> },
      { path: 'sorteios/:id/comprovante', element: <Comprovante /> },
      { path: 'sorteios/:id/live', element: <Live /> },
      { path: 'marketing/agenda', element: <AgendaMarketing /> },
      { path: 'marketing/novo', element: <NovoBriefingMarketing /> },
      { path: 'marketing/briefings/:id', element: <NovoBriefingMarketing /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
