import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tokens.css';
import '../ui/stage.css';
import './host.css';
import { App } from './App';
import { BoothController } from './controller';

// One controller for the whole page, created outside React so StrictMode's
// double-mount in development can't open two camera streams or two links.
const controller = new BoothController();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App ctl={controller} />
  </StrictMode>,
);
