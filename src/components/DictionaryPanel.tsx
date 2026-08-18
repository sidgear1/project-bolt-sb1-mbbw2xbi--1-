import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { DictionaryWord } from '../types';
import { useLanguage } from '../i18n';
import { chineseTerm, englishTerm } from '../learningLanguage';

interface DictionaryPanelProps {
  words: DictionaryWord[];
}

function toTitleCase(str: string): string {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function DictionaryPanel({ words }: DictionaryPanelProps) {
  const [open, setOpen] = useState(false);
  const { isChinese } = useLanguage();

  // Group words alphabetically by first letter of French word
  const grouped: Record<string, DictionaryWord[]> = {};
  [...words]
    .sort((a, b) => englishTerm(a.french).localeCompare(englishTerm(b.french)))
    .forEach((w) => {
      const letter = englishTerm(w.french)[0].toUpperCase();
      if (!grouped[letter]) grouped[letter] = [];
      grouped[letter].push(w);
    });

  const letters = Object.keys(grouped).sort();

  return (
    <div className="flex items-center gap-2">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 font-bold text-sm border shadow-xl ${
          open
            ? 'bg-[#1a3a5c] border-[#4a8ab4] text-white'
            : 'bg-[#0d0804]/90 border-[#4a6a8a]/40 text-[#7ab0d4] hover:border-[#4a8ab4]/70 hover:bg-[#0d1a2a]/90'
        } ${words.length > 0 ? 'ring-1 ring-[#4a8ab4]/40' : ''}`}
        title={isChinese ? '单词本 (D)' : 'Dictionary (D)'}
      >
        D
      </button>

      {/* Panel */}
      {open && (
        <div className="bg-[#0a1220]/97 border border-[#4a6a8a]/40 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm min-w-[260px]">
          <div className="px-4 pt-3 pb-2 border-b border-[#4a6a8a]/20">
            <div className="flex items-center gap-2">
              <BookOpen size={12} className="text-[#4a8ab4]" />
              <span className="text-[#7ab0d4] text-xs uppercase tracking-widest">
                {isChinese ? '单词本' : 'Dictionary'}
              </span>
              <span className="text-[#4a6a8a] text-xs ml-1">({words.length} {isChinese ? '个单词' : 'words'})</span>
            </div>
          </div>

          <div className="p-3 max-h-[280px] overflow-y-auto">
            {words.length === 0 ? (
              <div className="text-[#3a5a7a] text-xs italic px-1 py-2">
                {isChinese ? '还没有学过单词。点击物品来解锁。' : 'No words learned yet. Click on objects to unlock them.'}
              </div>
            ) : (
              letters.map((letter) => (
                <div key={letter} className="mb-2">
                  <div className="text-[#4a8ab4] text-xs font-bold uppercase tracking-widest mb-1.5 px-1 border-b border-[#4a6a8a]/20 pb-1">
                    {letter}
                  </div>
                  {grouped[letter].map((w) => (
                    <div key={w.french} className="flex items-baseline gap-2 px-1 py-0.5 hover:bg-[#4a6a8a]/10 rounded transition-colors">
                      <span className="text-[#c4942a] text-sm font-mono font-medium w-28 flex-shrink-0">
                        {toTitleCase(englishTerm(w.french))}
                      </span>
                      <span className="text-[#e0d8c8] text-xs">{toTitleCase(isChinese ? chineseTerm(w.french, w.english) : w.english)}</span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
