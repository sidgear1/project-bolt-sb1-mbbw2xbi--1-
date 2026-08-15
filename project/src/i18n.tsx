import { createContext, useContext, useEffect, useState } from 'react';

export type DisplayLanguage = 'zh' | 'en';

interface LanguageContextValue {
  language: DisplayLanguage;
  isChinese: boolean;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<DisplayLanguage>('zh');
  const toggleLanguage = () => setLanguage(current => current === 'zh' ? 'en' : 'zh');

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'l') return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      toggleLanguage();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return <LanguageContext.Provider value={{ language, isChinese: language === 'zh', toggleLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
