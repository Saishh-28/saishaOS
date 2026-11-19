import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import {isPlannerPath} from './planner/router';
import './index.css';

// Each entry is loaded on demand, so opening a planner deep link (e.g. from
// MacroDroid) doesn't download the whole Saisha OS dashboard, and vice versa.
const App = lazy(() => import('./App.tsx'));
const PlannerApp = lazy(() => import('./planner/PlannerApp'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {isPlannerPath(window.location.pathname) ? <PlannerApp /> : <App />}
    </Suspense>
  </StrictMode>,
);
