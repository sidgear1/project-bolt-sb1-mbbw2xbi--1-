import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import GlobalDebugOverlay from './components/GlobalDebugOverlay.tsx';
import ImageNumberOverlay from './components/ImageNumberOverlay.tsx';
import GlobalTaskBarEditor from './components/GlobalTaskBarEditor.tsx';
import GlobalRomanisationToggle from './components/GlobalRomanisationToggle.tsx';
import './index.css';
import { LanguageProvider } from './i18n.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider><App /><GlobalDebugOverlay /><ImageNumberOverlay /><GlobalTaskBarEditor /><GlobalRomanisationToggle /></LanguageProvider>
  </StrictMode>
);
