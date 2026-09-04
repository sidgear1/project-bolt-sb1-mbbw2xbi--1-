import { createContext, useContext, useEffect, useState } from 'react';

export type DisplayLanguage = 'zh' | 'en';

interface LanguageContextValue {
  language: DisplayLanguage;
  isChinese: boolean;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<DisplayLanguage>('en');
  const toggleLanguage = () => setLanguage('en');

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Semicolon is the universal language key, including maps and every adventure.
      // `key` varies on some keyboard layouts; `code` keeps the language
      // shortcut dependable everywhere, including interactive story scenes.
      if (event.key !== ';' && event.code !== 'Semicolon') return;
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      toggleLanguage();
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, []);

  return <LanguageContext.Provider value={{ language, isChinese: language === 'zh', toggleLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
