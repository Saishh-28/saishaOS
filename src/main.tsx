import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import PlannerApp from './planner/PlannerApp';
import './index.css';

// One app: every path opens the planner ("/" is Home).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlannerApp />
  </StrictMode>,
);
