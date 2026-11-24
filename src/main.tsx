import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import {isPlannerPath} from './planner/router';
import {CLASSIC_READ_ONLY} from './supabaseSync';
import './index.css';

// One app: every path opens the planner ("/" is Home). The old dashboard is
// kept at /classic, read-only, only so you can compare until it's removed.
const classic = !isPlannerPath(window.location.pathname);
if (classic) CLASSIC_READ_ONLY.on = true;
const App = lazy(() => import('./App.tsx'));
const PlannerApp = lazy(() => import('./planner/PlannerApp'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {classic ? <App /> : <PlannerApp />}
    </Suspense>
  </StrictMode>,
);
