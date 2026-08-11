import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './styles-modules.css';
import './styles-responsive.css';
import './entity-controls.css';
import './branding.css';
import './auth-theme.css';
import './login-fixes.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
