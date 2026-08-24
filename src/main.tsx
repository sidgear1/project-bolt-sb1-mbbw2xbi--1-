import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import StoryReferenceOverlay from './components/StoryReferenceOverlay.tsx';
import GlobalDebugOverlay from './components/GlobalDebugOverlay.tsx';
import './index.css';
import { LanguageProvider } from './i18n.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider><App /><StoryReferenceOverlay /><GlobalDebugOverlay /></LanguageProvider>
  </StrictMode>
);
