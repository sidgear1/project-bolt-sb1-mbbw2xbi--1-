import { useState, useRef, Component } from 'react';
import { Screen, GamePhase, DictionaryWord } from './types';
import { useSave } from './hooks/useSave';
import { useAmbientAudio } from './hooks/useAudio';
import MainMenu from './components/MainMenu';
import Game from './components/Game';
import { useLanguage } from './i18n';

interface EBProps { children: React.ReactNode; fallback: React.ReactNode }
interface EBState { hasError: boolean }

class ErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Game error:', error, info.componentStack);
  }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

interface GameStartConfig {
  phase: GamePhase;
  learnedWords: string[];
  inventory: string[];
  dictionary: DictionaryWord[];
  showIntro: boolean;
  xp: number;
  combatCleared: boolean;
}

export default function App() {
  const { isChinese } = useLanguage();
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameConfig, setGameConfig] = useState<GameStartConfig>({
    phase: 'tied',
    learnedWords: [],
    inventory: [],
    dictionary: [],
    showIntro: true,
    xp: 0,
    combatCleared: false,
  });

  const { load, deleteSave } = useSave();
  const { start: startAudio, stop: stopAudio, fadeOut: fadeAudio } = useAmbientAudio();
  const adventureAudioTimer = useRef<number | null>(null);

  const startAdventureAudio = () => {
    if (adventureAudioTimer.current !== null) window.clearTimeout(adventureAudioTimer.current);
    startAudio();
    adventureAudioTimer.current = window.setTimeout(() => {
      stopAudio();
      adventureAudioTimer.current = null;
    }, 5000);
  };

  const handleNewGame = async (startPhase?: GamePhase) => {
    await deleteSave();
    stopAudio();
    setGameConfig({ phase: startPhase ?? 'tied', learnedWords: [], inventory: [], dictionary: [], showIntro: true, xp: 0, combatCleared: false });
    startAdventureAudio();
    setScreen('game');
  };

  const handleContinue = async () => {
    stopAudio();
    const saved = await load();
    if (saved) {
      setGameConfig({
        phase: saved.phase,
        learnedWords: saved.learnedWords,
        inventory: saved.inventory,
        dictionary: saved.dictionary,
        showIntro: !saved.introSeen,
        xp: saved.xp ?? 0,
        combatCleared: saved.combatCleared ?? false,
      });
    } else {
      setGameConfig({ phase: 'tied', learnedWords: [], inventory: [], dictionary: [], showIntro: true, xp: 0, combatCleared: false });
    }
    startAdventureAudio();
    setScreen('game');
  };

  const handleReturnToMenu = () => {
    if (adventureAudioTimer.current !== null) window.clearTimeout(adventureAudioTimer.current);
    stopAudio();
    setScreen('menu');
  };

  const languageHint = <div className="fixed bottom-3 right-3 z-[100] rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-[10px] tracking-wide text-white/75 backdrop-blur-sm">{isChinese ? '中文 · 按 L 查看英文' : 'English · Press L for Chinese'}</div>;

  if (screen === 'game') {
    return (
      <><ErrorBoundary fallback={
        <div className="fixed inset-0 bg-[#0d0804] flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-[#c4942a] text-lg mb-4">Something went wrong.</p>
            <button onClick={() => handleReturnToMenu()} className="text-[#8b6914] underline">Return to menu</button>
          </div>
        </div>
      }>
        <Game
          initialPhase={gameConfig.phase}
          initialLearnedWords={gameConfig.learnedWords}
          initialInventory={gameConfig.inventory}
          initialDictionary={gameConfig.dictionary}
          initialXp={gameConfig.xp}
          initialCombatCleared={gameConfig.combatCleared}
          showIntro={gameConfig.showIntro}
          onMenu={handleReturnToMenu}
          onFadeAudio={() => fadeAudio(4)}
        />
      </ErrorBoundary>{languageHint}</>
    );
  }

  return <><MainMenu onNewGame={handleNewGame} onContinue={handleContinue} onStartAudio={startAudio} onStopAudio={stopAudio} />{languageHint}</>;
}
