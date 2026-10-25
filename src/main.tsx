import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
/* Bundled rather than fetched from Google, so the app makes no third-party request. */
import '@fontsource-variable/nunito/wght.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
