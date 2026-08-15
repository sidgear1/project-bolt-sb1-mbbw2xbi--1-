import { Trophy, RefreshCw, Home } from 'lucide-react';
import { HOTSPOTS } from '../gameData';
import { englishTerm, chineseTerm } from '../learningLanguage';
import { useLanguage } from '../i18n';

function toTitleCase(str: string): string {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

interface VictoryScreenProps {
  learnedWords: Set<string>;
  onRestart: () => void;
  onMenu: () => void;
}

export default function VictoryScreen({ learnedWords, onRestart, onMenu }: VictoryScreenProps) {
  const { isChinese } = useLanguage();
  const pct = Math.round((learnedWords.size / HOTSPOTS.length) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0604]/97 flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-lg w-full text-center">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-[#8b6914]/15 border-2 border-[#c4942a]/60 flex items-center justify-center shadow-[0_0_30px_rgba(196,148,42,0.3)]">
            <Trophy size={26} className="text-[#c4942a]" />
          </div>
        </div>

        <h1 className="font-display text-4xl font-bold text-[#e8d5a3] mb-1">{isChinese ? '自由了！' : 'You are free!'}</h1>
        <p className="text-[#8b6914] text-sm mb-2">{isChinese ? '你成功逃离了！' : 'You are free!'}</p>
        <p className="text-[#6a4a2a] text-sm leading-relaxed mb-8 max-w-sm mx-auto">
          {isChinese ? '他逃离了咖啡馆，消失在佛罗伦萨的夜色中。记忆仍然没有恢复，但他已经学会了英语。' : 'You escaped the café and vanished into the Florence night. Your memory is still gone. But you learned English — and that is something.'}
        </p>

        {/* Score */}
        <div className="bg-[#1a1008] border border-[#8b6914]/25 rounded-2xl p-5 mb-5">
          <div className="text-[#8b6914]/50 text-xs uppercase tracking-widest mb-4">
            {isChinese ? '已发现单词' : 'Words discovered'} — {learnedWords.size}/{HOTSPOTS.length} {isChinese ? '个' : 'words'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {HOTSPOTS.map((h) => (
              <div
                key={h.id}
                className={`flex items-center gap-2 rounded-xl p-2.5 border text-left transition-colors ${
                  learnedWords.has(h.id)
                    ? 'bg-[#0d2a0d]/60 border-[#2a6b2a]/50 text-[#4caf50]'
                    : 'bg-[#0d0804] border-[#2a1a08]/80 text-[#3a2510]'
                }`}
              >
                <span className="text-sm">{learnedWords.has(h.id) ? '✓' : '·'}</span>
                <div>
                  <div className="text-xs font-bold leading-tight">{toTitleCase(englishTerm(h.frenchName))}</div>
                  <div className="text-xs opacity-70 leading-tight">{toTitleCase(isChinese ? chineseTerm(h.frenchName, h.english) : h.english)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-[#c4942a] text-2xl font-bold font-display mb-6">{pct}% {isChinese ? '已探索' : 'explored'}</div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onMenu}
            className="flex items-center gap-2 border border-[#3a2010]/60 hover:border-[#8b6914]/50 text-[#6a4a2a] hover:text-[#c4942a] py-3 px-5 rounded-xl transition-all duration-200 text-sm uppercase tracking-wider"
          >
            <Home size={15} />
            {isChinese ? '菜单' : 'Menu'}
          </button>
          <button
            onClick={onRestart}
            className="flex items-center gap-2 bg-[#8b6914] hover:bg-[#c4942a] text-[#0d0804] font-bold py-3 px-6 rounded-xl transition-all duration-200 text-sm uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98]"
          >
            <RefreshCw size={15} />
            {isChinese ? '再玩一次' : 'Play again'}
          </button>
        </div>
      </div>
    </div>
  );
}
