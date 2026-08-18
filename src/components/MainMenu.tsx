import { useEffect, useState, useRef } from 'react';
import {
  BookOpen, ChevronLeft, Globe2, Settings, ArrowRight, Check, AlertTriangle, Volume2, VolumeX,
  Users, LockKeyhole, RotateCcw, Play, X, Footprints, Pause, Power, Sparkles,
} from 'lucide-react';
import { useSave } from '../hooks/useSave';
import { useDebugOverlay } from '../hooks/useDebugOverlay';
import { useSpeech } from '../hooks/useSpeech';
import { useLanguage } from '../i18n';
import DebugOverlayPanel from './DebugOverlayPanel';
import BackyardAdventure from './BackyardAdventure';
import { BusTicketAdventure, HomeAdventure, SoccerMatchAdventure } from './ElderwoodAdventures';
import { isSkipAnswer, levenshtein, stripAccents } from '../utils/levenshtein';
import { assetUrl } from '../utils/assetUrl';
import type { GamePhase } from '../types';

export type HubSection = 'home' | 'world' | 'roam' | 'backyard' | 'shop' | 'market' | 'bus' | 'family-home' | 'soccer-match' | 'adventure' | 'revision' | 'multiplayer' | 'settings';

interface MainMenuProps {
  onNewGame: () => void;
  onContinue: () => void;
  onStartAudio: () => void;
}

const navItems: Array<{ id: Exclude<HubSection, 'home'>; label: string; labelZh: string; icon: typeof Globe2; note: string; noteZh: string }> = [
  { id: 'roam', label: 'Roam', labelZh: '漫游', icon: Footprints, note: 'Wander the streets', noteZh: '探索街道' },
  { id: 'world', label: 'World map', labelZh: '世界地图', icon: Globe2, note: 'Choose a region', noteZh: '选择地区' },
  { id: 'adventure', label: 'Adventure', labelZh: '冒险', icon: BookOpen, note: 'Play a story', noteZh: '体验故事' },
  { id: 'revision', label: 'Revision', labelZh: '复习', icon: RotateCcw, note: 'Sharpen your words', noteZh: '巩固单词' },
  { id: 'multiplayer', label: 'Multiplayer', labelZh: '多人模式', icon: Users, note: 'Challenge a rival', noteZh: '挑战对手' },
  { id: 'settings', label: 'Settings', labelZh: '设置', icon: Settings, note: 'Coming soon', noteZh: '即将推出' },
];

const HOME_BACKGROUNDS = [
  assetUrl('home-wallpapers/learn-english-room.png'),
  assetUrl('home-wallpapers/watercolor-adventure.png'),
  assetUrl('home-wallpapers/island-quest.png'),
  assetUrl('home-wallpapers/notebook-adventure.png'),
];
const WORLD_MAP_IMG = assetUrl('ChatGPT_Image_Aug_12,_2026,_06_03_48_AM_(1).png');
const ROAM_VIDEOS = [
  assetUrl('videos/woodstock-roam.mp4'),
  'https://res.cloudinary.com/tjjlhlpp/video/upload/Video_Project_13_1.mp4',
];

function useMenuMusic(section: HubSection, muted: boolean) {
  useEffect(() => {
    const source = section === 'home'
      ? assetUrl('music/crystal-menu-drift.mp3')
      : section === 'world'
        ? assetUrl('music/pumpkin-hop-world-map.mp3')
        : null;
    if (!source) return;
    const audio = new Audio(source);
    audio.loop = true;
    audio.volume = muted ? 0 : 0.32;
    const play = () => { audio.play().catch(() => { /* Browsers wait for the player's first interaction. */ }); };
    play();
    window.addEventListener('pointerdown', play, { once: true });
    return () => { window.removeEventListener('pointerdown', play); audio.pause(); audio.currentTime = 0; };
  }, [section, muted]);
}

// Images used after leaving the menu. Fetch them while the player is choosing
// where to go, so scene changes never reveal an empty background while loading.
const WORLD_PRELOAD_IMAGES = [
  WORLD_MAP_IMG,
  assetUrl('maps/usa-roam-map.png'),
  assetUrl('cafe_room.png'),
  assetUrl('Use_AI_Image_Jun_15,_2026,_19_20_35.png'),
  assetUrl('Gemini_Generated_Image_a625ema625ema625.png'),
  assetUrl('ChatGPT_Image_Jun_14,_2026,_05_36_59_PM.png'),
  assetUrl('man_in_g.png'),
  assetUrl('man_in_g_on_floor.png'),
  assetUrl('a1.png'),
  assetUrl('a2.png'),
  assetUrl('a3.png'),
  assetUrl('a4.png'),
  assetUrl('scenes/bella/a5.png'),
  assetUrl('scenes/bella/a6.png'),
  assetUrl('scenes/bella/b1-woman.png'),
  assetUrl('scenes/bella/b2.png'),
  assetUrl('scenes/bella/b3-no-cyclists.png'),
  assetUrl('scenes/bella/b4-no-cyclists.png'),
  assetUrl('scenes/bella/b5-no-cyclists.png'),
  assetUrl('scenes/bella/b6 copy.png'),
  assetUrl('scenes/shop/c1.png'),
  assetUrl('scenes/shop/c2.png'),
  assetUrl('scenes/shop/c3.png'),
  assetUrl('scenes/shop/c4.png'),
  assetUrl('scenes/shop/c5.png'),
  assetUrl('scenes/shop/c1-v2.png'),
  assetUrl('scenes/shop/c2-v2.png'),
  assetUrl('scenes/shop/c7.png'),
  assetUrl('scenes/shop/c8.png'),
  assetUrl('scenes/bus/d1.png'),
  assetUrl('scenes/bus/d2.png'),
  assetUrl('scenes/bus/d3.png'),
  assetUrl('scenes/bus/d4.png'),
  assetUrl('scenes/home/e1-enhanced.png'),
  assetUrl('scenes/home/e2-enhanced.png'),
  assetUrl('scenes/home/e3-enhanced.png'),
  assetUrl('scenes/home/e4-enhanced.png'),
  assetUrl('scenes/home/e5-enhanced.png'),
  assetUrl('scenes/soccer/g1.png'),
  assetUrl('scenes/soccer/g2.png'),
  assetUrl('scenes/soccer/g3.png'),
  assetUrl('scenes/soccer/g4.png'),
  assetUrl('scenes/soccer/g5.png'),
  assetUrl('scenes/soccer/g6.png'),
  assetUrl('scenes/soccer/g7.png'),
  assetUrl('scenes/garden/f1.png'),
  assetUrl('scenes/garden/f2.png'),
  assetUrl('scenes/garden/f3.png'),
  assetUrl('scenes/garden/f4.png'),
];

function preloadImage(source: string): Promise<void> {
  return new Promise(resolve => {
    const image = new Image();
    const timeout = window.setTimeout(resolve, 6000);
    const finish = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    image.onload = async () => {
      try { await image.decode(); } catch { /* The image can still be painted. */ }
      finish();
    };
    // A missing optional asset must not leave the app on its loading screen.
    image.onerror = finish;
    image.src = source;
  });
}

// Keep the previous scene visible while the next image decodes. This prevents
// the black/blank flash that occurs when a large scene image is swapped.
function SceneBackground({ source, alt }: { source: string; alt: string }) {
  const [visibleSource, setVisibleSource] = useState(source);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (source === visibleSource) return;
    let active = true;
    setLoading(true);
    const image = new Image();
    const reveal = async () => { try { await image.decode(); } catch { /* paintable even if decode is unavailable */ } if (active) { setVisibleSource(source); setLoading(false); } };
    image.onload = reveal;
    image.onerror = reveal;
    image.src = source;
    return () => { active = false; };
  }, [source, visibleSource]);
  return <><img src={visibleSource} alt={alt} className="absolute inset-0 h-full w-full object-cover" draggable={false} />{loading && <div className="scene-preload z-20"><span>Loading scene…</span></div>}</>;
}

const revisionWords = [
  { italian: 'hello', english: '你好' },
  { italian: 'thank you', english: '谢谢' },
  { italian: 'window', english: '窗户' },
  { italian: 'key', english: '钥匙' },
  { italian: 'coffee', english: '咖啡' },
];

export default function MainMenu({ onNewGame, onContinue, onStartAudio }: MainMenuProps) {
  const { isChinese } = useLanguage();
  const menuOverlay = useDebugOverlay();
  const { debugMode: menuDebugMode, sceneRef: menuSceneRef, handleSceneMouseMove: handleMenuMouseMove } = menuOverlay;
  const [homeBackground] = useState(() => HOME_BACKGROUNDS[Math.floor(Math.random() * HOME_BACKGROUNDS.length)]);
  const [isMenuReady, setIsMenuReady] = useState(false);
  const [worldAssetsReady, setWorldAssetsReady] = useState(false);
  const [isWorldLoading, setIsWorldLoading] = useState(false);
  const { hasSave, selectSlot, getActiveSlot } = useSave();
  const [saveExists, setSaveExists] = useState(false);
  const [activeSaveSlot, setActiveSaveSlot] = useState(() => getActiveSlot());
  const [worldReady, setWorldReady] = useState(false);
  const [section, setSection] = useState<HubSection>('home');
  const [soundMuted, setSoundMuted] = useState(() => localStorage.getItem('taletalk-sound-muted') === 'true');
  const [creditsOpen, setCreditsOpen] = useState(false);
  useMenuMusic(section, soundMuted);
  const [revisionIndex, setRevisionIndex] = useState(0);
  const [revisionInput, setRevisionInput] = useState('');
  const [revisionResult, setRevisionResult] = useState<'correct' | 'wrong' | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [multiplayerIndex, setMultiplayerIndex] = useState(0);
  const [multiInput, setMultiInput] = useState('');
  const [multiResult, setMultiResult] = useState<'correct' | 'wrong' | null>(null);
  const progressKey = (name: string, slot = activeSaveSlot) => `taletalk-slot-${slot}-${name}`;
  const [bellaMemoryComplete, setBellaMemoryComplete] = useState(() => localStorage.getItem(`taletalk-slot-${getActiveSlot()}-bella-complete`) === 'true');
  const [shopMemoryComplete, setShopMemoryComplete] = useState(() => localStorage.getItem(`taletalk-slot-${getActiveSlot()}-shop-complete`) === 'true');
  const [busComplete, setBusComplete] = useState(() => localStorage.getItem(`taletalk-slot-${getActiveSlot()}-bus-complete`) === 'true');
  const [homeComplete, setHomeComplete] = useState(() => localStorage.getItem(`taletalk-slot-${getActiveSlot()}-home-complete`) === 'true');
  const [soccerComplete, setSoccerComplete] = useState(() => localStorage.getItem(`taletalk-slot-${getActiveSlot()}-soccer-complete`) === 'true');

  const switchSaveSlot = (slot: number) => {
    selectSlot(slot); setActiveSaveSlot(slot);
    setWorldReady(true);
    setBellaMemoryComplete(localStorage.getItem(progressKey('bella-complete', slot)) === 'true');
    setShopMemoryComplete(localStorage.getItem(progressKey('shop-complete', slot)) === 'true');
    setBusComplete(localStorage.getItem(progressKey('bus-complete', slot)) === 'true');
    setHomeComplete(localStorage.getItem(progressKey('home-complete', slot)) === 'true');
    setSoccerComplete(localStorage.getItem(progressKey('soccer-complete', slot)) === 'true');
    hasSave().then(setSaveExists);
  };

  // A tiny synthesized UI tick keeps the menu responsive without requiring an external sound file.
  useEffect(() => {
    let lastButton: Element | null = null;
    const play = (event: MouseEvent) => {
      if (soundMuted) return;
      const button = (event.target as Element).closest('.nav-item');
      const previousButton = (event.relatedTarget as Element | null)?.closest?.('.nav-item');
      if (!button || button === lastButton || button === previousButton) return;
      lastButton = button;
      try { const context = new AudioContext(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = 520; gain.gain.setValueAtTime(0.025, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.055); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.06); } catch { /* optional audio */ }
    };
    const clear = (event: MouseEvent) => {
      const button = (event.target as Element).closest('.nav-item');
      const nextButton = (event.relatedTarget as Element | null)?.closest?.('.nav-item');
      if (button && button !== nextButton && button === lastButton) lastButton = null;
    };
    document.addEventListener('mouseover', play);
    document.addEventListener('mouseout', clear);
    return () => { document.removeEventListener('mouseover', play); document.removeEventListener('mouseout', clear); };
  }, [soundMuted]);

  useEffect(() => {
    if (!isWorldLoading) return;
    let cancelled = false;
    Promise.all(WORLD_PRELOAD_IMAGES.map(preloadImage)).then(() => {
      if (!cancelled) setWorldAssetsReady(true);
    });
    return () => { cancelled = true; };
  }, [isWorldLoading]);

  // The menu controls used to mount before its CSS background had arrived.
  // Wait for the selected image to decode so the entire screen appears together,
  // both on first launch and when returning from an adventure.
  useEffect(() => {
    let cancelled = false;
    const startedAt = performance.now();
    const finish = async () => {
      const remainingDelay = Math.max(0, 180 - (performance.now() - startedAt));
      window.setTimeout(() => {
        if (!cancelled) setIsMenuReady(true);
      }, remainingDelay);
    };

    preloadImage(homeBackground).then(finish);

    return () => { cancelled = true; };
  }, [homeBackground]);

  const keyBufferRef = useRef('');
  const keyBufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { hasSave().then(setSaveExists); }, [hasSave]);

  // Global key buffer — detects .1 .2 .3 (launch scenes) shortcuts in menu screens
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Accumulate printable chars in buffer (max length 3)
      if (e.key.length === 1) {
        keyBufferRef.current = (keyBufferRef.current + e.key).slice(-3);
        if (keyBufferTimerRef.current) clearTimeout(keyBufferTimerRef.current);
        keyBufferTimerRef.current = setTimeout(() => { keyBufferRef.current = ''; }, 2000);

        const buf = keyBufferRef.current;
        if (buf.endsWith('.1')) { 
          e.preventDefault();
          keyBufferRef.current = ''; 
          if (section === 'world') {
            setSection('backyard');
          } else {
            onStartAudio();
            onNewGame();
          }
        }
        else if (buf.endsWith('.2')) { 
          e.preventDefault();
          keyBufferRef.current = ''; 
          setSection('shop');
        }
        else if (buf.endsWith('.3')) { 
          e.preventDefault();
          keyBufferRef.current = ''; 
          setSection('market');
        }
      }
    };
    // Use capture mode to intercept events before they reach input elements
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [section, setSection, onNewGame, onStartAudio]);

  const openSection = (next: HubSection) => {
    if (next === 'world') { setIsWorldLoading(true); return; }
    setSection(next);
  };

  useEffect(() => {
    if (isWorldLoading && worldAssetsReady) {
      setSection('world');
      setIsWorldLoading(false);
    }
  }, [isWorldLoading, worldAssetsReady]);

  if (!isMenuReady || isWorldLoading) {
    return <MenuLoadingScreen isChinese={isChinese} />;
  }

  if (section === 'world') return <WorldMapSection onMenu={() => { setWorldReady(false); setSection('home'); }} startMapLoaded={worldReady} onStartNewGame={onNewGame} onOpenMemory={() => setSection('backyard')} onOpenShop={() => setSection('shop')} onOpenMarket={() => setSection('market')} onOpenBus={() => setSection('bus')} onOpenHome={() => setSection('family-home')} onOpenSoccer={() => setSection('soccer-match')} onSelectSaveSlot={switchSaveSlot} activeSaveSlot={activeSaveSlot} bellaMemoryComplete={bellaMemoryComplete} shopMemoryComplete={shopMemoryComplete} busComplete={busComplete} homeComplete={homeComplete} soccerComplete={soccerComplete} />;
  if (section === 'roam') return <RoamSection onMenu={() => setSection('home')} />;
  if (section === 'backyard') return <BackyardAdventure onMenu={() => setSection('world')} onComplete={() => { localStorage.setItem(progressKey('bella-complete'), 'true'); setBellaMemoryComplete(true); setSection('world'); }} />;
  if (section === 'shop') return <BellaShopAdventure onMenu={() => setSection('world')} onComplete={() => { localStorage.setItem(progressKey('shop-complete'), 'true'); setShopMemoryComplete(true); setSection('world'); }} />;
  if (section === 'market') return <ShopTripAdventure onMenu={() => setSection('world')} onComplete={() => { localStorage.setItem(progressKey('shop-complete'), 'true'); setShopMemoryComplete(true); setSection('world'); }} />;
  if (section === 'bus') return <BusTicketAdventure onBack={() => setSection('world')} onBusComplete={() => { localStorage.setItem(progressKey('bus-complete'), 'true'); setBusComplete(true); setSection('world'); }} />;
  if (section === 'family-home') return <HomeAdventure onBack={() => setSection('world')} onHomeComplete={() => { localStorage.setItem(progressKey('home-complete'), 'true'); setHomeComplete(true); setSection('world'); }} />;
  if (section === 'soccer-match') return <SoccerMatchAdventure onBack={() => setSection('world')} onComplete={() => { localStorage.setItem(progressKey('soccer-complete'), 'true'); setSoccerComplete(true); setSection('world'); }} />;

  if (section !== 'home') {
    return (
      <div className="hub-shell">
        <div className="hub-backdrop" />
        <header className="hub-header">
          <button className="icon-button" onClick={() => setSection('home')} aria-label={isChinese ? '返回主页' : 'Back to home'}><ChevronLeft size={20} /></button>
          <div className="brand-lockup compact"><strong>TaleTalk</strong></div>
          <div style={{ width: 40 }} />
        </header>
        <main className="hub-content">{renderSection(section)}</main>
        <nav className="mobile-nav">{navItems.map(item => <NavButton key={item.id} item={item} active={section === item.id} onClick={() => openSection(item.id)} />)}</nav>
      </div>
    );
  }

  return (
    <div ref={menuSceneRef} onMouseMove={handleMenuMouseMove} className={`hub-shell home-shell${homeBackground.includes('island-quest') ? ' home-shell-chalkboard' : ''}${homeBackground.includes('notebook-adventure') ? ' home-shell-notebook' : ''}`}>
      <div className="home-image" style={{ backgroundImage: `url('${homeBackground}')` }} />
      <div className="home-wash" />
      <div className="home-menu-tools">
        <button className="home-tool-button" onClick={() => { const next = !soundMuted; setSoundMuted(next); localStorage.setItem('taletalk-sound-muted', String(next)); }} aria-label={soundMuted ? 'Turn sound on' : 'Mute sound'}>{soundMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}<span>{soundMuted ? 'Sound off' : 'Sound on'}</span></button>
        <button className="home-tool-button" onClick={() => setCreditsOpen(true)}>Credits</button>
      </div>
      <main className="home-content-centered">
        <div className="home-title-block">
          <h1 className="home-title">{isChinese ? <>汉语桥<br /><em>英语探险</em></> : <>Chinese Bridge<br /><em>English Quest</em></>}</h1>
          <p className="home-subtitle">{isChinese ? '在记忆的阴影中学习英语' : 'A language learned in the shadow of memory'}</p>
        </div>
        <div className="nav-grid">
          {navItems.map(item => <NavButton key={item.id} item={item} active={false} onClick={() => openSection(item.id)} />)}
        </div>
      </main>
      <footer className="home-footer"><span>{isChinese ? '第一章 · 艾尔德伍兹' : 'Chapter I · Elderwoods'}</span><span>{isChinese ? '学习 · 探索 · 记住' : 'Learn · Explore · Remember'}</span></footer>
      {menuDebugMode && <DebugOverlayPanel overlay={menuOverlay} mediaLabel="main-menu" />}
      {creditsOpen && <div className="credits-backdrop" role="dialog" aria-modal="true" aria-label="TaleTalk credits" onClick={() => setCreditsOpen(false)}><section className="credits-card" onClick={event => event.stopPropagation()}><button className="credits-close" onClick={() => setCreditsOpen(false)} aria-label="Close credits"><X size={18} /></button><div className="credits-mark">TT</div><p className="credits-eyebrow">A TaleTalk production</p><h2>Built for stories that teach.</h2><p>TaleTalk creates immersive language adventures where every choice, word, and memory moves the story forward.</p><div className="credits-rule" /><p className="credits-meta">© 2026 TaleTalk · All rights reserved</p></section></div>}
    </div>
  );

  function renderSection(activeSection: HubSection) {
    if (activeSection === 'world') return <WorldMapSection onMenu={() => { setWorldReady(false); setSection('home'); }} startMapLoaded={worldReady} onStartNewGame={onNewGame} onOpenMemory={() => setSection('backyard')} onOpenShop={() => setSection('shop')} onOpenMarket={() => setSection('market')} onOpenBus={() => setSection('bus')} onOpenHome={() => setSection('family-home')} onOpenSoccer={() => setSection('soccer-match')} onSelectSaveSlot={switchSaveSlot} activeSaveSlot={activeSaveSlot} bellaMemoryComplete={bellaMemoryComplete} shopMemoryComplete={shopMemoryComplete} busComplete={busComplete} homeComplete={homeComplete} soccerComplete={soccerComplete} />;
    if (activeSection === 'roam') return <RoamSection onMenu={() => setSection('home')} />;
    if (activeSection === 'adventure') return <AdventureSection />;
    if (activeSection === 'revision') return <RevisionSection />;
    if (activeSection === 'multiplayer') return <MultiplayerSection />;
    return <SettingsSection />;
  }

  function AdventureSection() {
    return <section className="section-stack">
      <SectionHeading eyebrow={isChinese ? '选择故事' : 'Choose your story'} title={isChinese ? '冒险' : 'Adventure'} description={isChinese ? '在这个世界里，每个英语单词都会改变接下来发生的事。' : 'Step into a world where every word can change what happens next.'} />
      <div className="adventure-card active-card" onClick={() => { onStartAudio(); onNewGame(); }}>
        <div className="adventure-art" style={{ backgroundImage: `url('${assetUrl('cafe_room.png')}')` }} />
        <div className="adventure-copy">
          <div className="card-label">{isChinese ? '第一章 · 艾尔德伍兹' : 'Chapter I · Elderwoods'}</div>
          <h2>{isChinese ? '汉语桥·英语探险' : 'Chinese Bridge · English Quest'}</h2>
          <p>{isChinese ? '他在佛罗伦萨一家安静的咖啡馆醒来，失去了记忆，必须学习英语才能逃离。' : 'You wake in a quiet Florentine café with no memory and a language you must learn to escape.'}</p>
          <div className="card-cta">{isChinese ? '开始冒险' : 'Begin adventure'} <span>→</span></div>
        </div>
      </div>
      {saveExists && (
        <button className="continue-journey" onClick={(e) => { e.stopPropagation(); onStartAudio(); onContinue(); }}>
          <Play size={16} /> {isChinese ? '继续旅程' : 'Continue your journey'} <span>↗</span>
        </button>
      )}
      <div className="locked-row"><LockKeyhole size={18} /><div><strong>{isChinese ? '更多冒险正在制作中' : 'More adventures are taking shape'}</strong><span>{isChinese ? '随着旅程发展，新故事将会出现。' : 'New stories will appear here as your journey grows.'}</span></div></div>
    </section>;
  }

  function RevisionSection() {
    const word = revisionWords[revisionIndex];
    const submit = (event: React.FormEvent) => {
      event.preventDefault();
      const correct = isSkipAnswer(revisionInput) || revisionInput.trim().toLowerCase() === word.italian;
      setRevisionResult(correct ? 'correct' : 'wrong');
      if (correct) setTimeout(() => { setRevisionIndex((revisionIndex + 1) % revisionWords.length); setRevisionInput(''); setRevisionResult(null); }, 700);
    };
    return <section className="section-stack"><SectionHeading eyebrow={isChinese ? '巩固记忆' : 'Keep your memory sharp'} title={isChinese ? '复习' : 'Revision'} description={isChinese ? '练习已经学过的英语单词。' : 'Short practice rounds for the words you have gathered.'} /><div className="practice-card"><div className="practice-top"><span>{isChinese ? '单词冲刺' : 'Word sprint'}</span><span>{revisionIndex + 1} / {revisionWords.length}</span></div><div className="practice-prompt">{isChinese ? word.english : word.italian}</div><p>{isChinese ? '输入英语单词' : 'Type the English word'}</p><form onSubmit={submit} className="answer-form"><input autoFocus value={revisionInput} onChange={event => setRevisionInput(event.target.value)} placeholder={isChinese ? '输入答案…' : 'your answer…'} /><button type="submit">{isChinese ? '检查' : 'Check'}</button></form>{revisionResult && <div className={revisionResult === 'correct' ? 'result good' : 'result bad'}>{revisionResult === 'correct' ? (isChinese ? '正确，继续！' : 'Correct. Keep going.') : (isChinese ? `还不对，试试 “${word.italian}”。` : `Not quite — try "${word.italian}".`)}</div>}<div className="practice-dots">{revisionWords.map((_, index) => <span key={index} className={index === revisionIndex ? 'active' : ''} />)}</div></div></section>;
  }

  function MultiplayerSection() {
    const questions = [{ prompt: '早上好', answer: 'good morning' }, { prompt: '朋友', answer: 'friend' }, { prompt: '谢谢', answer: 'thank you' }];
    const question = questions[multiplayerIndex];
    const submit = (event: React.FormEvent) => {
      event.preventDefault();
      const correct = isSkipAnswer(multiInput) || multiInput.trim().toLowerCase() === question.answer;
      setMultiResult(correct ? 'correct' : 'wrong');
      if (correct) setPlayerScore(playerScore + 1);
      setTimeout(() => { setMultiplayerIndex((multiplayerIndex + 1) % questions.length); setMultiInput(''); setMultiResult(null); }, 900);
    };
    return <section className="section-stack"><SectionHeading eyebrow={isChinese ? '实时练习 · 电脑对手' : 'Live practice · computer opponent'} title={isChinese ? '多人模式' : 'Multiplayer'} description={isChinese ? '与对手进行英语单词对决。' : 'A head-to-head English word match. Your rival is ready whenever you are.'} /><div className="match-card"><div className="match-header"><div className="player"><div className="avatar you">Y</div><span>{isChinese ? '你' : 'You'}</span><strong>{playerScore}</strong></div><div className="versus">VS</div><div className="player rival"><div className="avatar">L</div><span>Lucia</span><strong>2</strong></div></div><div className="match-progress"><span style={{ width: `${Math.min(100, ((multiplayerIndex + 1) / questions.length) * 100)}%` }} /></div><div className="practice-prompt">{question.prompt}</div><p>{isChinese ? '输入对应的英语答案' : 'Type the English answer'}</p><form onSubmit={submit} className="answer-form"><input autoFocus value={multiInput} onChange={event => setMultiInput(event.target.value)} placeholder={isChinese ? '输入答案…' : 'type your answer…'} /><button type="submit">{isChinese ? '开始' : 'Play'}</button></form>{multiResult && <div className={multiResult === 'correct' ? 'result good' : 'result bad'}>{multiResult === 'correct' ? (isChinese ? '你得分了。' : 'Point to you.') : (isChinese ? `Lucia 更快——“${question.answer}”。` : `Lucia was faster — "${question.answer}".`)}</div>}</div></section>;
  }

  function SettingsSection() { return <section className="section-stack"><SectionHeading eyebrow="Quiet for now" title="Settings" description="Your preferences will live here soon." /><div className="empty-card"><Settings size={28} /><h2>Nothing to change yet</h2><p>Audio, language, and accessibility options are coming in a future chapter.</p></div></section>; }
}

function MenuLoadingScreen({ isChinese }: { isChinese: boolean }) {
  return (
    <div className="menu-loading-screen" role="status" aria-live="polite">
      <div className="menu-loading-content">
        <div className="menu-loading-mark">CB</div>
        <p>{isChinese ? '正在准备你的冒险…' : 'Preparing your adventure…'}</p>
        <span className="menu-loading-bar" />
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div className="section-heading"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>; }





function WorldMapSection({ onMenu, startMapLoaded, onStartNewGame, onOpenMemory, onOpenShop, onOpenMarket, onOpenBus, onOpenHome, onOpenSoccer, onSelectSaveSlot, activeSaveSlot, bellaMemoryComplete, shopMemoryComplete, busComplete, homeComplete, soccerComplete }: { onMenu: () => void; startMapLoaded: boolean; onStartNewGame: () => void; onOpenMemory: () => void; onOpenShop: () => void; onOpenMarket: () => void; onOpenBus: () => void; onOpenHome: () => void; onOpenSoccer: () => void; onSelectSaveSlot: (slot: number) => void; activeSaveSlot: number; bellaMemoryComplete: boolean; shopMemoryComplete: boolean; busComplete: boolean; homeComplete: boolean; soccerComplete: boolean }) {
  const { isChinese } = useLanguage();
  const { listSlots, nameSlot, removeSlot } = useSave();
  const [hovered, setHovered] = useState(false);
  const [hoveredShop, setHoveredShop] = useState(false);
  const [hoveredMarket, setHoveredMarket] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => localStorage.getItem('elderwood-map-welcome-seen') !== 'true');
  const [wordBoxOpen, setWordBoxOpen] = useState(false);
  const [saveSlots, setSaveSlots] = useState(() => listSlots());
  const [mapLoaded, setMapLoaded] = useState(startMapLoaded);
  const [creatingSlot, setCreatingSlot] = useState<number | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<{ slot: number; name: string } | null>(null);
  const [fileName, setFileName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [savedWords] = useState(() => JSON.parse(localStorage.getItem('elderwood-unlocked-words') ?? '[]') as string[]);
  const overlay = useDebugOverlay();
  const { debugMode, sceneRef, handleSceneMouseMove } = overlay;
  const chooseSaveFile = (file: { slot: number; name: string | null; avatar: string | null; phase: GamePhase | null }) => {
    if (!file.name && !file.phase) { setCreatingSlot(file.slot); setFileName(''); setAvatar(null); return; }
    onSelectSaveSlot(file.slot);
    setMapLoaded(true);
  };

  const createSaveFile = () => {
    if (creatingSlot === null || !fileName.trim()) return;
    ['bella-complete', 'shop-complete', 'bus-complete', 'home-complete', 'soccer-complete'].forEach(name => localStorage.removeItem(`taletalk-slot-${creatingSlot}-${name}`));
    localStorage.removeItem(`taletalk-save-slot-${creatingSlot}`);
    nameSlot(creatingSlot, fileName.trim(), avatar);
    onSelectSaveSlot(creatingSlot);
    setCreatingSlot(null);
    onStartNewGame();
  };
  const readAvatar = (file: File | undefined) => { if (!file) return; const reader = new FileReader(); reader.onload = () => setAvatar(String(reader.result)); reader.readAsDataURL(file); };

  if (!mapLoaded) return <div className="save-select-screen"><img className="save-select-bg" src={HOME_BACKGROUNDS[0]} alt="" /><div className="save-select-shade" /><main className="save-select-card"><p className="save-select-label">Data List</p><h1>Select data to load</h1><div className="save-select-list">{saveSlots.map(file => <div key={file.slot} className={`save-file-row ${file.slot === activeSaveSlot ? 'active' : ''}`}>{file.name ? <><button className="save-file-load" onClick={() => chooseSaveFile(file)}>{file.avatar ? <img src={file.avatar} className="save-avatar-image" alt="" /> : <span className={`save-avatar save-avatar-${file.slot}`}>{file.name.slice(0, 2).toUpperCase()}</span>}<span><strong>{file.name}</strong><small>Last scene · {file.phase ?? 'Opening scene'}</small></span><span className="save-file-time">Play time<br /><b>{file.updatedAt ? 'In progress' : '00:00'}</b></span></button><button className="save-file-delete" onClick={() => setDeletingSlot({ slot: file.slot, name: file.name! })} aria-label={`Delete ${file.name}`}><X size={17} /></button></> : <button className="save-file-new" onClick={() => chooseSaveFile(file)}><span className="save-avatar">+</span><span><strong>Create a new story</strong><small>Empty save file {file.slot}</small></span></button>}</div>)}</div><button className="save-select-menu" onClick={onMenu}>Back to menu</button>{creatingSlot !== null && <div className="save-form"><h2>Create a new story</h2><input value={fileName} onChange={event => setFileName(event.target.value)} placeholder="File name" autoFocus /><label>Choose avatar photo<input type="file" accept="image/*" onChange={event => readAvatar(event.target.files?.[0])} /></label>{avatar && <img src={avatar} className="save-avatar-preview" alt="Avatar preview" />}<div><button onClick={() => setCreatingSlot(null)}>Cancel</button><button onClick={createSaveFile}>Start adventure</button></div></div>}{deletingSlot && <div className="save-form"><h2>Delete {deletingSlot.name}?</h2><p>Type the file name to confirm.</p><input autoFocus placeholder={deletingSlot.name} onChange={event => { if (event.target.value === deletingSlot.name) { removeSlot(deletingSlot.slot); setSaveSlots(listSlots()); setDeletingSlot(null); } }} /><button onClick={() => setDeletingSlot(null)}>Cancel</button></div>}</main></div>;

  return (
    <div
      className="world-map-scene"
      ref={sceneRef}
      onMouseMove={handleSceneMouseMove}
      onClick={() => { if (showWelcome) { localStorage.setItem('elderwood-map-welcome-seen', 'true'); setShowWelcome(false); } }}
    >
      <img className="world-map-image" src={WORLD_MAP_IMG} alt="The world map" draggable={false} />
      <div className="world-map-vignette" />
      <header className="world-map-topbar">
        <div>
          <h1>TaleTalk</h1>
          <span>{isChinese ? '世界地图 · 第一章' : 'THE WORLD MAP · CHAPTER I'}</span>
        </div>
        <div className="flex gap-2"><button className="world-map-menu" onClick={() => { setSaveSlots(listSlots()); setMapLoaded(false); }}>{isChinese ? '存档' : `Save files · ${activeSaveSlot}/6`}</button><button className="world-map-menu" onClick={() => setWordBoxOpen(open => !open)}>{isChinese ? '已解锁单词' : `Words${savedWords.length ? ` (${savedWords.length})` : ''}`}</button><button className="world-map-menu" onClick={onMenu}>{isChinese ? '菜单' : 'Menu'}</button></div>
      </header>


      {wordBoxOpen && <div className="absolute right-5 top-20 z-30 w-56 rounded-2xl border border-white/15 bg-black/90 p-3 shadow-2xl"><div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#c4942a]">{isChinese ? '已解锁单词' : 'Unlocked words'}</div>{savedWords.length ? <div className="max-h-56 space-y-1 overflow-y-auto">{savedWords.map(word => <div key={word} className="rounded-lg bg-white/5 px-2 py-1.5 text-sm text-white">{word}</div>)}</div> : <p className="text-xs text-white/55">{isChinese ? '输入单词即可在这里解锁。' : 'Type words in scenes to unlock them here.'}</p>}</div>}

      <div className="world-map-intro world-map-intro-sm">
        <div className="eyebrow">{isChinese ? '第一章 · 艾尔德伍兹' : 'Chapter I · Elderwoods'}</div>
        <h2>{isChinese ? '探索世界' : 'Explore the world'}</h2>
        <p>{isChinese ? '每个发光点都藏着一段等待重温的记忆。旅程从艾尔德伍兹开始。' : 'Each glowing point holds a memory waiting to be relived. Your journey begins in Elderwoods, where it all began.'}</p>
      </div>

      {showWelcome && <button className="world-map-dialogue" onClick={() => { localStorage.setItem('elderwood-map-welcome-seen', 'true'); setShowWelcome(false); }}><div className="world-map-dialogue-head"><div><div className="eyebrow">Welcome to Elderwood</div><h3>欢迎来到艾尔德伍德！</h3></div></div><p>在这里，你将探索新的区域，认识新的人，并在学习一门新语言的同时发现新的冒险。</p><span>点击任意位置继续</span></button>}

      <button
        className="map-memory-point"
        style={{ left: '37%', top: '59%' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => { e.stopPropagation(); if (shopMemoryComplete) window.alert('You must gain a ★ Star in order to proceed to the next level.'); else onOpenMemory(); }}
        aria-label={isChinese ? '打开第一段记忆' : 'Open the first memory'}
      >
        <span className="hotspot-pulse" />
        <span className="map-memory-badge">{shopMemoryComplete ? '2/6' : bellaMemoryComplete ? '1/6' : '0/6'}</span>
        {hovered && <span className="hotspot-tooltip">{isChinese ? '第一段记忆' : 'The first memory'}</span>}
      </button>

      {bellaMemoryComplete && (
        <button
          className="map-memory-point"
          style={{ left: '58.5%', top: '51.1%' }}
          onMouseEnter={() => setHoveredShop(true)}
          onMouseLeave={() => setHoveredShop(false)}
          onClick={(e) => { e.stopPropagation(); onOpenShop(); }}
          aria-label={isChinese ? '打开冰淇淋记忆' : 'Open the ice cream memory'}
        >
          <span className="hotspot-pulse" />
          <span className="map-memory-badge">{shopMemoryComplete ? '4/4' : '0/4'}</span>
          {hoveredShop && <span className="hotspot-tooltip">{isChinese ? '冰淇淋记忆' : 'The ice cream memory'}</span>}
        </button>
      )}

      {shopMemoryComplete && <button className="map-memory-point" style={{ left: '46.3%', top: '38.6%' }} onClick={onOpenBus} aria-label="Unlock a star at the bus stop"><span className="hotspot-pulse" /><span className="map-memory-badge">{busComplete ? '★' : '☆'}</span><span className="hotspot-tooltip">Bus stop · unlock a star</span></button>}
      {busComplete && <button className="map-memory-point" style={{ left: '41.7%', top: '34.3%' }} onClick={onOpenHome} aria-label="Open the house"><span className="hotspot-pulse" /><span className="map-memory-badge">{homeComplete ? '★' : '★'}</span><span className="hotspot-tooltip">The Corner House</span></button>}
      {homeComplete && <button className="map-memory-point" style={{ left: '50.6%', top: '33.4%' }} onClick={onOpenSoccer} aria-label="Open the soccer match"><span className="hotspot-pulse" /><span className="map-memory-badge">{soccerComplete ? 'GOAL!' : 'NEW'}</span><span className="hotspot-tooltip">Soccer Match</span></button>}

      {debugMode && <DebugOverlayPanel overlay={overlay} mediaLabel={WORLD_MAP_IMG.split('/').pop()!} />}

      {(
        <button
          className="map-memory-point"
          style={{ left: '64.3%', top: '55.9%' }}
          onMouseEnter={() => setHoveredMarket(true)}
          onMouseLeave={() => setHoveredMarket(false)}
          onClick={(e) => { e.stopPropagation(); onOpenMarket(); }}
          aria-label={isChinese ? '打开去商店的旅行' : 'Open a trip to the shop'}
        >
          <span className="hotspot-pulse" />
          <span className="map-memory-badge">0/1</span>
          {hoveredMarket && <span className="hotspot-tooltip">{isChinese ? '去商店的旅行' : 'A trip to the shop'}</span>}
        </button>
      )}

      <footer className="world-map-footer"><span>{isChinese ? (shopMemoryComplete ? '已解锁 2 / 2 段记忆' : bellaMemoryComplete ? '已解锁 1 / 2 段记忆' : '已解锁 0 / 2 段记忆') : (shopMemoryComplete ? '2 / 2 memories unlocked' : bellaMemoryComplete ? '1 / 2 memories unlocked' : '0 / 2 memories unlocked')}</span><span>{isChinese ? '点击发光点重温记忆 · 按 # 查看坐标' : 'Click a glowing point to remember · Press # for coordinates'}</span></footer>
    </div>
  );
}

interface ShopWordTooltip { word: string; translation: string; }

const SHOP_CHOICES: Array<{
  id: string;
  italianLabel: string;
  englishLabel: string;
  prompt: string;
  correct: boolean;
  responseIt: string;
  responseEn: string;
  wordTooltips: ShopWordTooltip[];
}> = [
  {
    id: 'gelato',
    italianLabel: 'I would like an ice cream, please',
    englishLabel: '我想要一个冰淇淋，谢谢。',
    prompt: 'i would like an ice cream please',
    correct: true,
    responseIt: '',
    responseEn: '',
    wordTooltips: [
      { word: 'I would like', translation: '我想要' },
      { word: 'an', translation: '一个' },
      { word: 'ice cream', translation: '冰淇淋' },
      { word: 'please', translation: '请' },
    ],
  },
  {
    id: 'pizza',
    italianLabel: 'I would like a pizza, please',
    englishLabel: '我想要一个披萨，谢谢。',
    prompt: 'i would like a pizza please',
    correct: false,
    responseIt: 'We do not have pizza.',
    responseEn: '我们没有披萨。',
    wordTooltips: [
      { word: 'I would like', translation: '我想要' },
      { word: 'a', translation: '一个' },
      { word: 'pizza', translation: '披萨' },
      { word: 'please', translation: '请' },
    ],
  },
  {
    id: 'acqua',
    italianLabel: 'I would like some water, please',
    englishLabel: '我想要一些水，谢谢。',
    prompt: 'i would like some water please',
    correct: false,
    responseIt: 'Questa è una gelateria!',
    responseEn: 'This is an ice cream shop!',
    wordTooltips: [
      { word: 'I would like', translation: '我想要' },
      { word: 'some water', translation: '一些水' },
      { word: 'please', translation: '请' },
    ],
  },
];

const GRAZIE_WORDS: ShopWordTooltip[] = [{ word: 'Thank you', translation: '谢谢' }];
const PREGO_WORDS: ShopWordTooltip[] = [{ word: 'You are welcome', translation: '不客气' }];

function matchShopChoiceInput(raw: string): typeof SHOP_CHOICES[number] | null {
  if (isSkipAnswer(raw)) {
    return SHOP_CHOICES.find(choice => choice.correct) ?? null;
  }

  const normalized = stripAccents(raw.toLowerCase().replace(/[.,!?]/g, '').replace(/\s+/g, ' ').trim());
  if (!normalized) return null;

  const exact = SHOP_CHOICES.find(choice => stripAccents(choice.prompt) === normalized);
  if (exact) return exact;

  const inputTokens = normalized.split(/\s+/).filter(Boolean);
  const scoredChoices = SHOP_CHOICES.map(choice => {
    const choiceTokens = stripAccents(choice.prompt).split(/\s+/).filter(Boolean);
    const overlap = choiceTokens.filter(choiceToken =>
      inputTokens.some(inputToken =>
        inputToken === choiceToken ||
        inputToken.includes(choiceToken) ||
        choiceToken.includes(inputToken) ||
        levenshtein(inputToken, choiceToken) <= 2
      )
    ).length;
    const productWord = choice.id;
    const productHit = inputTokens.some(token => token.includes(productWord) || productWord.includes(token));
    const politeHit = inputTokens.some(token => token.includes('favore') || token.includes('favor') || token.includes('vaore') || token.includes('vavore'));
    const score = overlap + (productHit ? 3 : 0) + (politeHit ? 2 : 0);
    return { choice, score };
  });

  const best = scoredChoices.sort((a, b) => b.score - a.score)[0];
  return best && best.score >= 4 ? best.choice : null;
}

type ShopPhase = 'intro' | 'bella-excited' | 'counter' | 'order' | 'order-speaking' | 'grazie' | 'prego' | 'ending' | 'phone-call' | 'wife-angry' | 'wife-warning' | 'wife-hangup';

function BellaShopAdventure({ onMenu, onComplete }: { onMenu: () => void; onComplete: () => void }) {
  const overlay = useDebugOverlay();
  const { debugMode, sceneRef, handleSceneMouseMove } = overlay;
  const [phase, setPhase] = useState<ShopPhase>('intro');
  const [orderInput, setOrderInput] = useState('');
  const [orderWrong, setOrderWrong] = useState(false);
  const [orderTypingWrong, setOrderTypingWrong] = useState(false);
  const [grazieInput, setGrazieInput] = useState('');
  const [grazieWrong, setGrazieWrong] = useState(false);
  const [grazieDone, setGrazieDone] = useState(false);
  const [pregoInput, setPregoInput] = useState('');
  const [pregoWrong, setPregoWrong] = useState(false);
  const [pregoDone, setPregoDone] = useState(false);
  const [chosenOrder, setChosenOrder] = useState<typeof SHOP_CHOICES[number] | null>(null);
  const [shopUnlockedWords, setShopUnlockedWords] = useState<ShopWordTooltip[]>([]);
  const [shopWordLibraryOpen, setShopWordLibraryOpen] = useState(false);
  const [shopPracticeWord, setShopPracticeWord] = useState<ShopWordTooltip | null>(null);
  const [shopPracticeInput, setShopPracticeInput] = useState('');
  const [shopPracticeCorrect, setShopPracticeCorrect] = useState(false);
  const { speak, cancel, enabled: speechEnabled, toggle: toggleSpeech } = useSpeech();
  const { isChinese } = useLanguage();
  const keyBufferRef = useRef('');

  const sceneDialogue = (currentPhase: ShopPhase) => {
    const lines: Partial<Record<ShopPhase, { en: string; zh: string }>> = {
      intro: { en: 'At long last he makes it to the ice cream shop. Bella is bursting with excitement.', zh: '终于，他来到了冰淇淋店。贝拉兴奋极了。' },
      'bella-excited': { en: 'Delicious!', zh: 'Delicious!' },
      counter: { en: 'He then moves up to the counter to order.', zh: '随后，他走到柜台前点单。' },
      ending: { en: 'Bella is happy. He made her day.', zh: '贝拉很开心。他让她度过了快乐的一天。' },
      'phone-call': { en: 'And just at that moment he gets a call from his wonderful wife.', zh: '就在这时，他接到了妻子的电话。' },
      'wife-angry': { en: 'Ahhhhhh!', zh: '啊——！' },
      'wife-warning': { en: 'His wife reminds him that he has not helped with the shopping he promised to do. She tells him: either come home with the shopping done, or do not come home at all! She also reminds him that she loves him.', zh: '妻子提醒他：他还没有完成答应帮忙买的东西。她告诉他，要么买完东西回家，要么就别回家！她也提醒他，她爱他。' },
      'wife-hangup': { en: 'And she hangs up.', zh: '然后，她挂断了电话。' },
    };
    const line = lines[currentPhase];
    return line ? (isChinese ? line.zh : line.en) : '';
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.length === 1) {
        keyBufferRef.current = (keyBufferRef.current + e.key).slice(-2);
        if (keyBufferRef.current.endsWith('/2')) {
          keyBufferRef.current = '';
          cancel();
          onComplete();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cancel, onComplete]);

  useEffect(() => {
    if (phase === 'grazie') speak(isChinese ? '谢谢！' : 'Thank you!', 'bella');
    else if (phase === 'prego') speak(isChinese ? '不客气！' : 'You are welcome!', 'shopkeeper');
    else {
      const dialogue = sceneDialogue(phase);
      if (dialogue) speak(dialogue, phase === 'bella-excited' ? 'bella' : phase === 'wife-angry' ? 'wife' : 'josh');
    }
  }, [phase, isChinese, speak]);

  const images = ['scenes/bella/b1-woman.png', 'scenes/bella/b2.png', 'scenes/bella/b3-no-cyclists.png', 'scenes/bella/b4-no-cyclists.png', 'scenes/bella/b5-no-cyclists.png', 'scenes/bella/b6 copy.png'].map(assetUrl);
  const image =
    phase === 'intro' || phase === 'bella-excited' ? images[0]
    : phase === 'counter' || phase === 'order' || phase === 'order-speaking' ? images[1]
    : phase === 'grazie' || phase === 'prego' ? images[2]
    : phase === 'ending' ? images[3]
    : phase === 'phone-call' ? images[3]
    : phase === 'wife-angry' ? images[4]
    : images[5];

  const advance = () => {
    if (phase === 'intro') setPhase('bella-excited');
    else if (phase === 'bella-excited') setPhase('counter');
    else if (phase === 'counter') setPhase('order');
    else if (phase === 'ending') setPhase('phone-call');
    else if (phase === 'phone-call') setPhase('wife-angry');
    else if (phase === 'wife-angry') setPhase('wife-warning');
    else if (phase === 'wife-warning') setPhase('wife-hangup');
    else if (phase === 'wife-hangup') { cancel(); onComplete(); }
  };

  const canClick = phase === 'intro' || phase === 'bella-excited' || phase === 'counter' || phase === 'ending' || phase === 'phone-call' || phase === 'wife-angry' || phase === 'wife-warning' || phase === 'wife-hangup';

  useEffect(() => {
    const skip = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowRight') return;
      event.preventDefault();
      if (canClick) advance();
      else if (phase === 'order') { setChosenOrder(SHOP_CHOICES.find(choice => choice.correct) ?? null); setPhase('grazie'); }
      else if (phase === 'grazie') setPhase('prego');
      else if (phase === 'prego') setPhase('ending');
    };
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [phase, canClick]);

  const getWordMatchState = (choice: typeof SHOP_CHOICES[number]) => {
    const flatString = choice.wordTooltips.map(w => stripAccents(w.word.toLowerCase())).join(' ');
    const typedFlat = stripAccents(orderInput.toLowerCase().replace(/\s+/g, ' ').trim());
    let totalMatched = 0;
    for (let i = 0; i < typedFlat.length && i < flatString.length; i++) {
      if (typedFlat[i] === flatString[i]) totalMatched++;
      else break;
    }
    let charOffset = 0;
    const wordStates = choice.wordTooltips.map(w => {
      const word = stripAccents(w.word.toLowerCase());
      const wordStart = charOffset;
      const wordEnd = charOffset + word.length;
      const matchedInWord = Math.max(0, Math.min(word.length, totalMatched - wordStart));
      const isComplete = totalMatched >= wordEnd;
      charOffset = wordEnd + 1;
      return { matchedLetters: matchedInWord, totalLetters: word.length, isComplete };
    });
    const isFullMatch = wordStates.every(ws => ws.isComplete);
    return { wordStates, isFullMatch };
  };

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const shortcutMatch = isSkipAnswer(orderInput) ? SHOP_CHOICES.find(c => c.correct) ?? null : null;
    const match = shortcutMatch ?? matchShopChoiceInput(orderInput) ?? null;
    if (match) {
      if (match.correct) {
        setOrderWrong(false);
        setOrderTypingWrong(false);
        setChosenOrder(match);
        setPhase('order-speaking');
        speak(isChinese ? match.englishLabel : match.prompt, 'male', () => setTimeout(() => setPhase('grazie'), 3500));
      } else {
        setOrderWrong(true);
        speak(match.responseIt, 'shopkeeper');
      }
      setOrderInput('');
    } else {
      setOrderTypingWrong(true);
      setTimeout(() => setOrderTypingWrong(false), 1500);
    }
  };

  const getSimpleMatchState = (input: string, words: ShopWordTooltip[]) => {
    const flatString = words.map(w => stripAccents(w.word.toLowerCase())).join(' ');
    const typedFlat = stripAccents(input.toLowerCase().replace(/\s+/g, ' ').trim());
    let totalMatched = 0;
    for (let i = 0; i < typedFlat.length && i < flatString.length; i++) {
      if (typedFlat[i] === flatString[i]) totalMatched++;
      else break;
    }
    let charOffset = 0;
    const wordStates = words.map(w => {
      const word = stripAccents(w.word.toLowerCase());
      const wordStart = charOffset;
      const wordEnd = charOffset + word.length;
      const matchedInWord = Math.max(0, Math.min(word.length, totalMatched - wordStart));
      const isComplete = totalMatched >= wordEnd;
      charOffset = wordEnd + 1;
      return { matchedLetters: matchedInWord, totalLetters: word.length, isComplete };
    });
    return wordStates;
  };

  const handleGrazieSubmit = () => {
    if (isSkipAnswer(grazieInput) || stripAccents(grazieInput.toLowerCase().trim()) === 'thank you') {
      setGrazieDone(true);
      setShopUnlockedWords(prev => {
        const existing = new Set(prev.map(w => w.word));
        return [...prev, ...GRAZIE_WORDS.filter(w => !existing.has(w.word))];
      });
      speak('Thank you', 'bella');
      setGrazieInput('');
      setTimeout(() => { setGrazieDone(false); setPhase('prego'); }, 2000);
    } else {
      setGrazieWrong(true);
      setTimeout(() => setGrazieWrong(false), 1500);
    }
  };

  const handlePregoSubmit = () => {
    if (isSkipAnswer(pregoInput) || stripAccents(pregoInput.toLowerCase().trim()) === 'you are welcome') {
      setPregoDone(true);
      setShopUnlockedWords(prev => {
        const existing = new Set(prev.map(w => w.word));
        return [...prev, ...PREGO_WORDS.filter(w => !existing.has(w.word))];
      });
      speak('You are welcome', 'shopkeeper');
      setPregoInput('');
      setTimeout(() => { setPregoDone(false); setPhase('ending'); }, 2000);
    } else {
      setPregoWrong(true);
      setTimeout(() => setPregoWrong(false), 1500);
    }
  };

  const isGirl = phase === 'bella-excited' || phase === 'wife-angry';
  const dialogueText = sceneDialogue(phase);
  const speakerName = isChinese
    ? (phase === 'bella-excited' ? '贝拉' : phase === 'wife-angry' ? '妻子' : '旁白')
    : (phase === 'bella-excited' ? 'Bella' : phase === 'wife-angry' ? 'Wife' : 'Narrator');
  const showDialogue = canClick;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center" onClick={() => { if (canClick) advance(); }}>
      <div ref={sceneRef} className="relative h-screen aspect-square max-w-screen max-h-screen" onMouseMove={handleSceneMouseMove}>
        <SceneBackground source={image} alt="Bella's ice cream memory" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 pointer-events-none" />
        <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 pt-4">
          <div><h1 className="text-white text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>{isChinese ? '英语冒险' : 'English Adventure'}</h1><span className="text-white/70 text-[10px] uppercase tracking-[0.2em]">{isChinese ? '冰淇淋店' : 'The ice cream shop'}</span></div>
          <div className="flex items-center gap-2">
            <button onClick={toggleSpeech} className="w-9 h-9 rounded-full flex items-center justify-center bg-black/60 border border-white/20 hover:border-white/50 text-white/80 hover:text-white transition-all" title={speechEnabled ? 'Mute voices' : 'Unmute voices'}>{speechEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
            <button onClick={() => { cancel(); onMenu(); }} className="px-4 py-2 rounded-full text-[11px] bg-black/60 border border-white/20 text-white/80 uppercase tracking-wider">{isChinese ? '菜单' : 'Menu'}</button>
          </div>
        </header>

        {shopUnlockedWords.length > 0 && (
          <div className="absolute left-4 top-28 z-30" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShopWordLibraryOpen(open => !open)}
              className="rounded-xl border border-[#c4942a]/50 bg-black/75 px-3 py-2 text-left text-white shadow-xl backdrop-blur-sm transition hover:bg-black/90"
            >
              <span className="mt-1 block text-[9px] uppercase tracking-wider text-white/60">{isChinese ? '词汇' : 'Words'}</span>
            </button>
            {shopWordLibraryOpen && (
              <div className="mt-2 w-52 rounded-xl border border-white/15 bg-black/90 p-3 shadow-2xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#c4942a]">{isChinese ? '词汇表' : 'Vocabulary'}</span>
                  <button className="text-white/50 hover:text-white" onClick={() => setShopWordLibraryOpen(false)}>×</button>
                </div>
                <div className="space-y-1.5">
                  {[...shopUnlockedWords].sort((a, b) => a.word.localeCompare(b.word)).map(word => (
                    <button
                      key={word.word}
                      onClick={() => { setShopPracticeWord(word); setShopPracticeInput(''); setShopPracticeCorrect(false); }}
                      className="flex w-full items-center justify-between rounded-lg bg-white/5 px-2.5 py-2 text-left transition hover:bg-white/10"
                    >
                      <span className="text-sm text-white">{word.word}</span>
                      <span className="text-[10px] text-white/45">{word.translation}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {shopPracticeWord && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-5" onClick={() => setShopPracticeWord(null)}>
            <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#120d08]/95 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[#c4942a]">Practice word</div>
              <h2 className="text-2xl text-white" style={{ fontFamily: "'Playfair Display', serif" }}>{shopPracticeWord.word}</h2>
              <p className="mb-4 text-sm text-white/55">{shopPracticeWord.translation}</p>
              {shopPracticeCorrect ? (
                <p className="mb-4 text-sm text-green-400">Correct. The word is yours.</p>
              ) : (
                <form onSubmit={e => { e.preventDefault(); setShopPracticeCorrect(stripAccents(shopPracticeInput.trim().toLowerCase()) === stripAccents(shopPracticeWord.word.toLowerCase())); }} className="flex gap-2">
                  <input autoFocus value={shopPracticeInput} onChange={e => setShopPracticeInput(e.target.value)} placeholder={isChinese ? "输入英语单词" : "type the English word"} className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/60" />
                  <button className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs uppercase tracking-wider text-white">Check</button>
                </form>
              )}
              <button onClick={() => setShopPracticeWord(null)} className="mt-4 text-xs text-white/50 hover:text-white">Close</button>
            </div>
          </div>
        )}

        {debugMode && <DebugOverlayPanel overlay={overlay} mediaLabel="bella-shop-scene" />}

        {showDialogue && (
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10" onClick={e => e.stopPropagation()}>
            <div className="rounded-2xl border border-white/10 px-4 pb-3 pt-3" style={{ background: 'rgba(0,0,0,0.92)' }}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: isGirl ? '#e8a59c' : '#ccc' }} />
                <span className={`text-[11px] uppercase tracking-[0.2em] font-semibold ${isGirl ? 'text-[#e8a59c]' : 'text-white/60'}`}>{speakerName}</span>
              </div>
              <p className={`text-white ${isGirl ? 'text-2xl' : 'text-base'} leading-snug`} style={{ fontFamily: "'Playfair Display', serif" }}>{dialogueText}</p>
              {phase === 'bella-excited' && <p className="mt-1 text-sm text-white/60">太好吃了！</p>}
              <div className="flex items-center justify-between mt-3">
                {phase === 'wife-hangup' ? (
                  <button onClick={() => { cancel(); onComplete(); }} className="flex items-center gap-1.5 text-white/70 hover:text-white text-[11px] uppercase tracking-wider transition-colors">{isChinese ? '返回地图' : 'Return to map'} <ArrowRight size={12} /></button>
                ) : phase === 'ending' ? (
                  <button onClick={() => advance()} className="flex items-center gap-1.5 text-white/70 hover:text-white text-[11px] uppercase tracking-wider transition-colors">Continue <ArrowRight size={12} /></button>
                ) : (
                  <span className="text-white/40 text-[11px]">{isChinese ? '点击任意位置继续' : 'click anywhere to continue'}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {phase === 'order' && (
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10" onClick={e => e.stopPropagation()}>
            <div className="rounded-2xl border border-white/10 px-3 pb-2 pt-2" style={{ background: 'rgba(0,0,0,0.92)' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-[#c4942a] flex-shrink-0" />
                <span className={`text-[#c4942a] uppercase tracking-[0.12em] font-semibold ${isChinese ? 'text-xs' : 'text-[9px]'}`}>{isChinese ? '店员：你好！请输入你想要的东西：' : 'Shopkeeper: Hello! Type what you would like:'}</span>
              </div>
              <div className="flex flex-col gap-1 mb-2">
                {SHOP_CHOICES.map((c) => {
                  const { wordStates, isFullMatch } = getWordMatchState(c);
                  return (
                    <div key={c.id} className={`px-3 py-1 rounded-lg bg-white/5 border transition-all ${isFullMatch ? 'border-green-400/60 bg-green-400/10' : 'border-white/15'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${isFullMatch ? 'bg-green-400/30 text-green-300' : 'bg-white/10 text-white/60'}`}>{SHOP_CHOICES.indexOf(c) + 1}</span>
                        <div className="flex flex-col">
                          <span className="text-xs">
                            {c.wordTooltips.map((wt, wi) => {
                              const ws = wordStates[wi];
                              const letters = wt.word.split('');
                              return (
                                <span key={wi}>
                                  <span className="underline decoration-dotted decoration-white/30 underline-offset-2">
                                    {letters.map((letter, li) => (
                                      <span key={li} className={`transition-colors ${ws && li < ws.matchedLetters ? 'text-green-400' : 'text-white/90'}`}>{letter}</span>
                                    ))}
                                  </span>
                                  {wi < c.wordTooltips.length - 1 ? '\u00A0' : ''}
                                </span>
                              );
                            })}
                          </span>
                          <span className="text-xs mt-1">
                            {c.wordTooltips.map((wt, ewi) => (
                              <span key={ewi} className={`transition-colors ${wordStates[ewi]?.isComplete ? 'text-green-400' : 'text-white/40'}`}>{wt.translation}{ewi < c.wordTooltips.length - 1 ? '\u00A0' : ''}</span>
                            ))}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={handleOrderSubmit} className="flex items-center gap-2">
                <input value={orderInput} onChange={e => setOrderInput(e.target.value)} autoFocus autoComplete="off" spellCheck={false} placeholder="type your order..." className="flex-1 min-w-0 bg-white/5 text-white text-xs outline-none placeholder-white/30 caret-white border-b border-white/20 focus:border-white/60 py-1.5 rounded-lg px-2" />
                <button className="rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-xs px-4 py-2 transition-all uppercase tracking-wider flex-shrink-0">{isChinese ? '确认' : 'Order'}</button>
              </form>
              {orderTypingWrong && <div className="flex items-center gap-1.5 text-red-400 text-xs mt-2"><AlertTriangle size={11} /> Not a valid choice — type one of the options above</div>}
              {orderWrong && <p className="text-yellow-300 text-xs mt-2">The shopkeeper says: "That's not what we sell here." Try the ice cream option.</p>}
            </div>
          </div>
        )}

        {phase === 'order-speaking' && chosenOrder && (
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10" onClick={e => e.stopPropagation()}>
            <div className="rounded-2xl border border-blue-400/30 px-4 pb-3 pt-3" style={{ background: 'rgba(0,0,0,0.92)' }}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0 animate-pulse" />
                <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-blue-300">{isChinese ? '乔希正在点单…' : 'Josh is ordering...'}</span>
              </div>
              <p className="text-white text-lg leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>{isChinese ? chosenOrder.englishLabel : chosenOrder.italianLabel}</p>
              <p className="text-white/50 text-xs italic mt-1">{isChinese ? chosenOrder.italianLabel : chosenOrder.englishLabel}</p>
            </div>
          </div>
        )}

        {phase === 'grazie' && (
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10" onClick={e => e.stopPropagation()}>
            <div className="rounded-2xl border border-white/10 px-4 pb-3 pt-3" style={{ background: 'rgba(0,0,0,0.92)' }}>
              {grazieDone ? (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                    <Sparkles size={20} /><span className="text-lg font-bold">{isChinese ? '已解锁新单词！' : 'You unlocked the word!'}</span><Sparkles size={20} />
                  </div>
                  <p className="text-white/60 text-sm"><span className="text-green-400 font-medium">Thank you</span> = 谢谢</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#e8a59c] flex-shrink-0" />
                    <span className="text-[#e8a59c] text-[9px] uppercase tracking-[0.12em] font-semibold">{isChinese ? '贝拉说——输入她说的话' : 'Bella says — type what she says'}</span>
                  </div>
                  <div className="bg-white/5 rounded-lg px-3 py-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white/50 text-[10px]">{isChinese ? '贝拉：' : 'Bella:'}</span>
                      {(() => {
                        const ws = getSimpleMatchState(grazieInput, GRAZIE_WORDS);
                        return GRAZIE_WORDS.map((wt, wi) => wt.word.split('').map((letter, li) => (
                          <span key={li} className={`transition-colors ${ws[wi] && li < ws[wi].matchedLetters ? 'text-green-400' : 'text-white/90'} underline decoration-dotted decoration-white/30 underline-offset-2`}>{letter}</span>
                        )));
                      })()}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {(() => {
                        const ws = getSimpleMatchState(grazieInput, GRAZIE_WORDS);
                        return GRAZIE_WORDS.map((wt, ewi) => (
                          <span key={ewi} className={`text-xs transition-colors ${ws[ewi]?.isComplete ? 'text-green-400' : 'text-white/40'}`}>{wt.translation}</span>
                        ));
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input value={grazieInput} onChange={e => setGrazieInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleGrazieSubmit(); }} className="flex-1 bg-white/5 text-white text-xs outline-none placeholder-white/30 caret-white min-w-0 border-b border-white/20 focus:border-white/60 py-1.5 rounded-lg px-2" autoComplete="off" spellCheck={false} placeholder="输入 Bella 说的话…" autoFocus />
                    <button onClick={handleGrazieSubmit} className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-xs px-4 py-2 rounded-lg transition-all uppercase tracking-wider flex-shrink-0">确认</button>
                  </div>
                  {grazieWrong && <div className="flex items-center gap-1.5 text-red-400 text-xs mt-2"><AlertTriangle size={11} /> Not quite — listen to Bella and try again</div>}
                </>
              )}
            </div>
          </div>
        )}

        {phase === 'prego' && (
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10" onClick={e => e.stopPropagation()}>
            <div className="rounded-2xl border border-white/10 px-4 pb-3 pt-3" style={{ background: 'rgba(0,0,0,0.92)' }}>
              {pregoDone ? (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                    <Sparkles size={20} /><span className="text-lg font-bold">{isChinese ? '已解锁新单词！' : 'You unlocked the word!'}</span><Sparkles size={20} />
                  </div>
                  <p className="text-white/60 text-sm"><span className="text-green-400 font-medium">You are welcome</span> = 不客气</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#c4942a] flex-shrink-0" />
                    <span className={`text-[#c4942a] uppercase tracking-[0.12em] font-semibold ${isChinese ? 'text-xs' : 'text-[9px]'}`}>{isChinese ? '店员说——输入店员说的话' : 'Shopkeeper says — type what they say'}</span>
                  </div>
                  <div className="bg-white/5 rounded-lg px-3 py-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-white/50 ${isChinese ? 'text-xs' : 'text-[10px]'}`}>{isChinese ? '店员：' : 'Shopkeeper:'}</span>
                      {(() => {
                        const ws = getSimpleMatchState(pregoInput, PREGO_WORDS);
                        return PREGO_WORDS.map((wt, wi) => wt.word.split('').map((letter, li) => (
                          <span key={li} className={`transition-colors ${ws[wi] && li < ws[wi].matchedLetters ? 'text-green-400' : 'text-white/90'} underline decoration-dotted decoration-white/30 underline-offset-2`}>{letter}</span>
                        )));
                      })()}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {(() => {
                        const ws = getSimpleMatchState(pregoInput, PREGO_WORDS);
                        return PREGO_WORDS.map((wt, ewi) => (
                          <span key={ewi} className={`text-xs transition-colors ${ws[ewi]?.isComplete ? 'text-green-400' : 'text-white/40'}`}>{wt.translation}</span>
                        ));
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input value={pregoInput} onChange={e => setPregoInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handlePregoSubmit(); }} className="flex-1 bg-white/5 text-white text-xs outline-none placeholder-white/30 caret-white min-w-0 border-b border-white/20 focus:border-white/60 py-1.5 rounded-lg px-2" autoComplete="off" spellCheck={false} placeholder="输入店主说的话…" autoFocus />
                    <button onClick={handlePregoSubmit} className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-xs px-4 py-2 rounded-lg transition-all uppercase tracking-wider flex-shrink-0">确认</button>
                  </div>
                  {pregoWrong && <div className="flex items-center gap-1.5 text-red-400 text-xs mt-2"><AlertTriangle size={11} /> Not quite — listen and try again</div>}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface RoamWordBox {
  id: string;
  italian: string;
  english: string;
  fact: string;
  points: { x: number; y: number }[];
  showFrom: number;
  showUntil: number;
}

const roamWordBoxes: RoamWordBox[] = [
  {
    id: 'bridge',
    italian: 'Bridge',
    english: '桥',
    fact: '这里原来的铁桥建于约 1870 年，是帕克桥设计早期的重要范例。1980 年重建时，桥梁两侧保留了具有历史价值的铁桁架，因此它至今仍保有这种独特的老式外观。',
    points: [{ x: 65.7, y: 56.1 }, { x: 73.6, y: 55.3 }, { x: 65.4, y: 60.8 }, { x: 73.3, y: 60.8 }],
    showFrom: 1,
    showUntil: 10,
  },
  {
    id: 'trees',
    italian: 'Trees',
    english: '树木',
    fact: '伍德斯托克以枫树闻名。秋天尤为壮观，因为糖枫会变成明亮的黄色、橙色和深红色。',
    points: [{ x: 28, y: 43.3 }, { x: 35.4, y: 42.2 }, { x: 28.1, y: 47.6 }, { x: 35, y: 47.9 }],
    showFrom: 14,
    showUntil: 21,
  },
  {
    id: 'river',
    italian: 'River',
    english: '河流',
    fact: '流经伍德斯托克的河流是奥塔奎奇河（Ottauquechee River）。有趣的是，它的名字来自一个原住民词语，常被解释为“湍急的山间溪流”。',
    points: [{ x: 21.1, y: 62 }, { x: 27.3, y: 61.2 }, { x: 21, y: 67.8 }, { x: 27.5, y: 67.5 }],
    showFrom: 21,
    showUntil: 33,
  },
];

function bboxFromPoints(points: { x: number; y: number }[]) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    width: Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10,
    height: Math.round((Math.max(...ys) - Math.min(...ys)) * 10) / 10,
  };
}

function RoamSection({ onMenu }: { onMenu: () => void }) {
  const overlay = useDebugOverlay();
  const { debugMode, sceneRef, handleSceneMouseMove } = overlay;
  const { speak } = useSpeech();
  const { isChinese } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoMuted, setVideoMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [toolsEnabled, setToolsEnabled] = useState(true);
  const [activeWord, setActiveWord] = useState<RoamWordBox | null>(null);
  const [autoPauseOnWord, setAutoPauseOnWord] = useState(true);
  const [pausedForActiveWord, setPausedForActiveWord] = useState(false);
  const [videoIndex, setVideoIndex] = useState(0);
  const [locationSelected, setLocationSelected] = useState(false);
  const [roamLoading, setRoamLoading] = useState(false);
  // Dismissed words stay hidden only until the player leaves Roam.
  const [dismissedWordIds, setDismissedWordIds] = useState<string[]>([]);
  // Do not carry saved words from the previous roam into this refreshed video.
  const [savedWords, setSavedWords] = useState<RoamWordBox[]>([]);
  const [savedWordsOpen, setSavedWordsOpen] = useState(false);

  useEffect(() => { localStorage.setItem('memorie-roam-saved-words', JSON.stringify(savedWords)); }, [savedWords]);

  const closeActiveWord = () => {
    if (!activeWord) return;
    setDismissedWordIds(ids => ids.includes(activeWord.id) ? ids : [...ids, activeWord.id]);
    setActiveWord(null);
    const video = videoRef.current;
    if (pausedForActiveWord && video?.paused) video.play().then(() => setIsPlaying(true)).catch(() => setVideoMuted(true));
    setPausedForActiveWord(false);
  };

  const saveActiveWord = () => {
    if (!activeWord) return;
    setSavedWords(words => words.some(word => word.italian === activeWord.italian) ? words : [...words, activeWord]);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== ']') return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      setShowControls(s => !s);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    // Native controls do not emit timeupdate at the same cadence in every
    // browser. Poll the media clock so timed word overlays stay in sync.
    const clock = window.setInterval(() => setCurrentTime(v.currentTime), 100);
    v.play().catch(() => {
      // Browsers can block autoplay with sound. Retry immediately as muted
      // rather than leaving the video paused at 0:00 until the user moves it.
      v.muted = true;
      setVideoMuted(true);
      v.play().catch(() => setIsPlaying(false));
    });
    return () => {
      window.clearInterval(clock);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [locationSelected, videoIndex]);

  if (!locationSelected) {
    return <div ref={sceneRef} className="roam-location-screen" onMouseMove={handleSceneMouseMove}>
          <img src={assetUrl('maps/usa-roam-map.png')} alt="Map of the United States" className="roam-location-map" draggable={false} />
      <div className="roam-location-shade" />
      <header className="roam-location-header"><div><p>{isChinese ? '选择目的地' : 'Choose a destination'}</p><h1>{isChinese ? '美国漫游地图' : 'USA Roam Map'}</h1></div><button className="world-map-menu" onClick={onMenu}>{isChinese ? '菜单' : 'Menu'}</button></header>
      <button className="roam-location-marker roam-location-marker-woodstock" onClick={() => { setRoamLoading(true); setLocationSelected(true); }}>
        <strong>Woodstock, Vermont</strong><small>{isChinese ? '开始漫游' : 'Start roaming'}</small>
      </button>
      <span className="roam-location-label roam-location-seattle">Seattle</span><span className="roam-location-label roam-location-chicago">Chicago</span><span className="roam-location-label roam-location-miami">Miami</span><span className="roam-location-label roam-location-la">Los Angeles</span>
      <footer className="roam-location-footer">{isChinese ? '点击佛蒙特州伍德斯托克开始本次漫游。' : 'Select Woodstock, Vermont to begin this roam.'}</footer>
      {debugMode && <DebugOverlayPanel overlay={overlay} mediaLabel="usa-roam-map.png" />}
    </div>;
  }

  return (
    <div
      className="world-map-scene"
      ref={sceneRef}
      onMouseMove={handleSceneMouseMove}
    >
      <video
        key={videoIndex}
        ref={videoRef}
        className="world-map-image"
        src={ROAM_VIDEOS[videoIndex]}
        autoPlay
        preload="auto"
        muted={videoMuted}
        controls={showControls}
        playsInline
        draggable={false}
        onEnded={() => setVideoIndex(index => (index + 1) % ROAM_VIDEOS.length)}
        onCanPlay={() => setRoamLoading(false)}
      />
      {roamLoading && <div className="scene-preload z-50"><span>Loading roam…</span></div>}
      <video
        aria-hidden="true"
        className="hidden"
        src={ROAM_VIDEOS[(videoIndex + 1) % ROAM_VIDEOS.length]}
        preload="auto"
        muted
      />
      <div className="world-map-vignette" />
      <header className="world-map-topbar">
        <div>
          <h1>TaleTalk</h1>
        </div>
        <div className="roam-top-actions">
          <button className="roam-tools-btn" onClick={() => setSavedWordsOpen(open => !open)}>
            <BookOpen size={14} /> {isChinese ? `已保存单词${savedWords.length ? ` (${savedWords.length})` : ''}` : `Saved words${savedWords.length ? ` (${savedWords.length})` : ''}`}
          </button>
          <button className="roam-tools-btn" onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            const next = !videoMuted;
            setVideoMuted(next);
            if (!next) v.play().catch(() => setVideoMuted(true));
          }}>
            {videoMuted ? <VolumeX size={14} /> : <Volume2 size={14} />} {videoMuted ? (isChinese ? '打开声音' : 'Unmute') : (isChinese ? '静音' : 'Mute')}
          </button>
          {toolsEnabled ? (
            <button className="roam-tools-btn" onClick={() => setToolsEnabled(false)}>
              <Power size={14} /> {isChinese ? '关闭提示' : 'Turn off tools'}
            </button>
          ) : (
            <button className="roam-tools-btn off" onClick={() => setToolsEnabled(true)}>
              <Power size={14} /> {isChinese ? '打开提示' : 'Turn on tools'}
            </button>
          )}
          <button className="world-map-menu" onClick={onMenu}>{isChinese ? '菜单' : 'Menu'}</button>
        </div>
      </header>

      {/* Tutorial prompt — shows when mare first appears */}
      {toolsEnabled && currentTime >= 2 && currentTime < 10 && activeWord === null && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 max-w-[200px] pointer-events-auto">
          <div className="rounded-2xl border border-[#c4942a]/40 px-3 py-3 shadow-2xl"
            style={{ background: 'rgba(10,6,4,0.95)', backdropFilter: 'blur(8px)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[#c4942a] text-[10px] uppercase tracking-wider font-bold">{isChinese ? '提示' : 'Tip'}</span>
            </div>
            <p className="text-[#c4b080] text-[11px] leading-relaxed">
              {isChinese ? '点击高亮单词来探索，或使用上方按钮关闭提示。' : 'Click on the highlighted words to explore more, or turn them off with the Turn off tools button above.'}
            </p>
          </div>
        </div>
      )}

      {debugMode && <DebugOverlayPanel overlay={overlay} mediaLabel="roam-video.mp4" />}

      {toolsEnabled && activeWord === null && roamWordBoxes
        .filter(w => currentTime >= w.showFrom && currentTime < w.showUntil && !dismissedWordIds.includes(w.id))
        .map(w => {
          const bb = bboxFromPoints(w.points);
          return (
            <button
              key={w.id}
              className="roam-word-box"
              style={{
                left: `${bb.left + bb.width / 2}%`,
                top: `${bb.top + bb.height / 2}%`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveWord(w);
                speak(w.italian, 'female');
                const video = videoRef.current;
                const wasPlaying = Boolean(video && !video.paused);
                setPausedForActiveWord(autoPauseOnWord && wasPlaying);
                if (autoPauseOnWord) {
                  if (video && wasPlaying) video.pause();
                }
              }}
            >
              {w.italian}
            </button>
          );
        })}

      {activeWord && (
        <div className="roam-word-popup-backdrop" onClick={closeActiveWord}>
          <div className="roam-word-popup" onClick={(e) => e.stopPropagation()}>
            <div className="roam-word-popup-header-actions">
              <button
                className="roam-word-popup-pause"
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  if (v.paused) {
                    v.play();
                    setIsPlaying(true);
                    setAutoPauseOnWord(false);
                    setPausedForActiveWord(false);
                  } else {
                    v.pause();
                    setIsPlaying(false);
                    setAutoPauseOnWord(true);
                    setPausedForActiveWord(false);
                  }
                }}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                {isPlaying ? (isChinese ? '暂停' : 'Pause') : (isChinese ? '播放' : 'Play')}
              </button>
              <button className="roam-word-popup-pause" onClick={saveActiveWord}>
                <BookOpen size={14} /> {savedWords.some(word => word.italian === activeWord.italian) ? (isChinese ? '已保存' : 'Saved') : (isChinese ? '保存单词' : 'Save word')}
              </button>
              <button className="roam-word-popup-close" onClick={closeActiveWord}>
                <X size={16} />
              </button>
            </div>
            <div className="roam-word-popup-eyebrow">{isChinese ? '中文' : 'English'}</div>
            <div className="flex items-center gap-2">
              <h2 className="roam-word-popup-italian">{activeWord.italian}</h2>
              <button className="text-[#c4942a] transition hover:text-white" onClick={() => speak(activeWord.italian, 'female')} title={`Hear ${activeWord.italian} in English`} aria-label={`Hear ${activeWord.italian} in English`}><Volume2 size={18} /></button>
            </div>
            <div className="roam-word-popup-english">{activeWord.english}</div>
            <div className="roam-word-popup-divider" />
            <p className="roam-word-popup-fact">{activeWord.fact}</p>
          </div>
        </div>
      )}

      {savedWordsOpen && (
        <div className="absolute right-4 top-16 z-40 w-64 rounded-2xl border border-white/15 bg-[#100b08]/95 p-3 shadow-2xl backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-[#c4942a]">{isChinese ? '已保存单词' : 'Saved words'}</span><button className="text-white/50 hover:text-white" onClick={() => setSavedWordsOpen(false)}>×</button></div>
          {savedWords.length ? <div className="max-h-64 space-y-1 overflow-y-auto">{[...savedWords].sort((a, b) => a.italian.localeCompare(b.italian)).map(word => <div key={word.italian} className="rounded-lg bg-white/5 px-2.5 py-2"><span className="block text-sm text-white">{word.italian}</span><span className="text-[10px] text-white/45">{word.english}</span></div>)}</div> : <p className="text-xs text-white/50">{isChinese ? '从信息卡保存单词，它会显示在这里。' : 'Save a word from its information card to keep it here.'}</p>}
        </div>
      )}

      <footer className="world-map-footer"><span>{isChinese ? '漫游模式' : 'Roam mode'}</span><span>{isChinese ? '按 # 查看坐标 · 按 ] 显示视频控制' : 'Press # for coordinates · Press ] for video controls'}</span></footer>
    </div>
  );
}

const LEGACY_SHOPPING_STOPS = [
  { id: 'bread', italian: 'Bread', english: '面包', image: assetUrl('scenes/shop/c3.png'), imageAlt: 'The bread shelf', foodPoint: { left: '78%', top: '28%' }, choices: ['Bread', 'Eggs', 'Honey'] },
  { id: 'water', italian: 'Water', english: '水', image: assetUrl('scenes/shop/c4.png'), imageAlt: 'The drinks shelf', foodPoint: { left: '82%', top: '36%' }, choices: ['Water', 'Juice', 'Milk'] },
  { id: 'fruit', italian: 'Fruit', english: '水果', image: assetUrl('scenes/shop/c5.png'), imageAlt: 'The food shelf', foodPoint: { left: '24%', top: '48%' }, choices: ['Fruit', 'Pasta', 'Sauce'] },
] as const;

void LEGACY_SHOPPING_STOPS;

const SHOPPING_STOPS = [
  { id: 'bread', italian: 'Bread', english: 'Bread', image: assetUrl('scenes/shop/c3.png'), imageAlt: 'The bread shelf', foodPoint: { left: '78%', top: '28%' }, choices: ['A loaf of bread', 'Eggs', 'Honey'] },
  { id: 'water', italian: 'Drinks', english: 'Drinks', image: assetUrl('scenes/shop/c4.png'), imageAlt: 'The drinks shelf', foodPoint: { left: '82%', top: '36%' }, choices: ['Water', 'Juice', 'Milk'] },
  { id: 'fruit', italian: 'Fruit', english: 'Fruit, apples and bananas', image: assetUrl('scenes/shop/c5.png'), imageAlt: 'The food shelf', foodPoint: { left: '24%', top: '48%' }, choices: ['Apples and bananas', 'Pasta', 'Sauce'] },
] as const;

function ShopTripAdventure({ onMenu, onComplete }: { onMenu: () => void; onComplete: () => void }) {
  const overlay = useDebugOverlay();
  const { debugMode, sceneRef, handleSceneMouseMove } = overlay;
  const { isChinese } = useLanguage();
  const [phase, setPhase] = useState<'approach' | 'word-puzzle' | 'inside' | 'food-word' | 'pick-food' | 'detail-word' | 'checkout' | 'paid'>('approach');
  const [wordInput, setWordInput] = useState('');
  const [wordWrong, setWordWrong] = useState(false);
  const [wordDone, setWordDone] = useState(false);
  const [unlockedWords, setUnlockedWords] = useState<ShopWordTooltip[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [practiceWord, setPracticeWord] = useState<ShopWordTooltip | null>(null);
  const [practiceInput, setPracticeInput] = useState('');
  const [practiceCorrect, setPracticeCorrect] = useState(false);
  const [activeFoodIndex, setActiveFoodIndex] = useState(0);
  const [pickedFoodIds, setPickedFoodIds] = useState<string[]>([]);
  const [foodInput, setFoodInput] = useState('');
  const [foodWrong, setFoodWrong] = useState(false);
  const [paymentInput, setPaymentInput] = useState('');
  const [paymentWrong, setPaymentWrong] = useState(false);
  const { speak, cancel, enabled: speechEnabled, toggle: toggleSpeech } = useSpeech();
  const SHOP_WORD: ShopWordTooltip = { word: 'Shop', translation: '商店' };

  useEffect(() => {
    if (phase === 'approach') speak(isChinese ? '他来到了本地商店。点击商店进入。' : 'He arrives at the local shop. Click on the shop to enter.', 'male');
    else if (phase === 'word-puzzle') speak(isChinese ? '输入“商店”的英语单词即可进入。' : 'Type the English word for shop to enter.', 'male');
    else if (phase === 'inside') speak(isChinese ? '他走进了商店。购物清单上有面包、水和水果。' : 'He steps inside the shop. The shopping list has bread, water, and fruit.', 'male');
    else if (phase === 'food-word') speak(`Type the English word for ${SHOPPING_STOPS[activeFoodIndex].english}.`, 'male');
    else if (phase === 'pick-food') speak('Choose the correct item from the shelf.', 'male');
    else if (phase === 'checkout') speak('Type pay 5 euro to complete the shop.', 'male');
  }, [phase, isChinese, speak]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.length === 1) {
        const buf = (e.key + e.key).slice(-2);
        if (buf === '//') { cancel(); onComplete(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cancel, onComplete]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSkipAnswer(wordInput) || stripAccents(wordInput.toLowerCase().trim()) === 'shop') {
      setWordDone(true);
      setUnlockedWords(prev => {
        const existing = new Set(prev.map(w => w.word));
        return existing.has(SHOP_WORD.word) ? prev : [...prev, SHOP_WORD];
      });
      speak('Shop', 'male');
      setWordInput('');
      setTimeout(() => { setWordDone(false); setPhase('inside'); }, 1800);
    } else {
      setWordWrong(true);
      setTimeout(() => setWordWrong(false), 1500);
    }
  };

  const activeFood = SHOPPING_STOPS[activeFoodIndex];
  // Keyboard progression always supplies the correct answer, so a player can
  // read through any scene with the Right Arrow instead of repeatedly clicking.
  useEffect(() => {
    const skip = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowRight') return;
      event.preventDefault();
      if (phase === 'approach') setPhase('word-puzzle');
      else if (phase === 'word-puzzle') { setUnlockedWords(words => words.some(w => w.word === SHOP_WORD.word) ? words : [...words, SHOP_WORD]); setPhase('inside'); }
      else if (phase === 'inside') { setActiveFoodIndex(SHOPPING_STOPS.findIndex(item => !pickedFoodIds.includes(item.id))); setFoodInput(''); setPhase('food-word'); }
      else if (phase === 'food-word') { setUnlockedWords(words => words.some(w => w.word === activeFood.italian) ? words : [...words, { word: activeFood.italian, translation: activeFood.english }]); setPhase('pick-food'); }
      else if (phase === 'pick-food') setPhase('detail-word');
      else if (phase === 'detail-word') { const picked = [...pickedFoodIds, activeFood.id]; setPickedFoodIds(picked); setPhase(picked.length === SHOPPING_STOPS.length ? 'checkout' : 'inside'); }
      else if (phase === 'checkout') setPhase('paid');
      else if (phase === 'paid') onComplete();
    };
    window.addEventListener('keydown', skip); return () => window.removeEventListener('keydown', skip);
  }, [phase, activeFood, pickedFoodIds, onComplete]);
  const typedFood = stripAccents(foodInput.toLowerCase().trim());
  const foodPrefixLength = stripAccents(activeFood.italian.toLowerCase()).startsWith(typedFood) ? typedFood.length : 0;
  const submitFoodWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (stripAccents(foodInput.trim().toLowerCase()) === stripAccents(activeFood.italian.toLowerCase())) {
      setUnlockedWords(prev => prev.some(word => word.word === activeFood.italian) ? prev : [...prev, { word: activeFood.italian, translation: activeFood.english }]);
      setFoodInput('');
      setPhase('detail-word');
    } else {
      setFoodWrong(true);
      setTimeout(() => setFoodWrong(false), 1500);
    }
  };

  const chooseFood = (choice: string) => {
    const expected = activeFood.id === 'bread' ? 'A loaf of bread' : activeFood.id === 'water' ? 'Water' : 'Apples and bananas';
    if (choice !== expected) return;
    setFoodInput('');
    setPhase('detail-word');
    return;
    const picked = [...pickedFoodIds, activeFood.id];
    setPickedFoodIds(picked);
    if (picked.length === SHOPPING_STOPS.length) setPhase('checkout');
    else setPhase('inside');
  };
  const detailWord = activeFood.id === 'bread' ? 'a loaf of bread' : activeFood.id === 'water' ? 'water' : 'apples and bananas';
  const submitDetailWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (stripAccents(foodInput.trim().toLowerCase()) !== detailWord) { setFoodWrong(true); setTimeout(() => setFoodWrong(false), 1500); return; }
    setUnlockedWords(prev => {
      const additions = activeFood.id === 'fruit' ? ['apples', 'bananas'] : [detailWord];
      return additions.reduce((words, value) => words.some(word => word.word === value) ? words : [...words, { word: value, translation: value }], prev);
    });
    const stored = new Set<string>(JSON.parse(localStorage.getItem('elderwood-unlocked-words') ?? '[]'));
    stored.add(activeFood.italian.toLowerCase());
    (activeFood.id === 'fruit' ? ['apples', 'bananas'] : [detailWord]).forEach(value => stored.add(value));
    localStorage.setItem('elderwood-unlocked-words', JSON.stringify([...stored].sort()));
    const picked = [...pickedFoodIds, activeFood.id]; setPickedFoodIds(picked); setFoodInput('');
    setPhase(picked.length === SHOPPING_STOPS.length ? 'checkout' : 'inside');
  };

  const submitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (stripAccents(paymentInput.trim().toLowerCase()) === 'pay 5 euro') {
      cancel();
      setPhase('paid');
    } else {
      setPaymentWrong(true);
      setTimeout(() => setPaymentWrong(false), 1500);
    }
  };

  const image = phase === 'approach' || phase === 'word-puzzle' ? assetUrl('scenes/shop/c1-v2.png') : phase === 'inside' ? assetUrl('scenes/shop/c2-v2.png') : phase === 'checkout' ? assetUrl('scenes/shop/c7.png') : phase === 'paid' ? assetUrl('scenes/shop/c8.png') : activeFood.image;
  const typedShopWord = stripAccents(wordInput.toLowerCase().trim());
  const shopWordPrefixLength = 'shop'.startsWith(typedShopWord) ? typedShopWord.length : 0;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center">
      <div ref={sceneRef} className="relative h-screen aspect-square max-w-screen max-h-screen" onMouseMove={handleSceneMouseMove}>
        <SceneBackground source={image} alt="A trip to the shop" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 pointer-events-none" />
        <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 pt-4">
          <div><h1 className="text-white text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>{isChinese ? '英语冒险' : 'English Adventure'}</h1><span className="text-white/70 text-[10px] uppercase tracking-[0.2em]">{isChinese ? '商店' : 'The shop'}</span></div>
          <div className="flex items-center gap-2">
            <button onClick={toggleSpeech} className="w-9 h-9 rounded-full flex items-center justify-center bg-black/60 border border-white/20 hover:border-white/50 text-white/80 hover:text-white transition-all" title={speechEnabled ? 'Mute voices' : 'Unmute voices'}>{speechEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
            <button onClick={() => { cancel(); onMenu(); }} className="px-4 py-2 rounded-full text-[11px] bg-black/60 border border-white/20 text-white/80 uppercase tracking-wider">{isChinese ? '菜单' : 'Menu'}</button>
          </div>
        </header>

        {unlockedWords.length > 0 && (
          <div className="absolute left-4 top-28 z-30" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLibraryOpen(open => !open)} className="rounded-xl border border-[#c4942a]/50 bg-black/75 px-3 py-2 text-left text-white shadow-xl backdrop-blur-sm transition hover:bg-black/90">
              <span className="mt-1 block text-[9px] uppercase tracking-wider text-white/60">Words</span>
            </button>
            {libraryOpen && (
              <div className="mt-2 w-52 rounded-xl border border-white/15 bg-black/90 p-3 shadow-2xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#c4942a]">Vocabulary</span>
                  <button className="text-white/50 hover:text-white" onClick={() => setLibraryOpen(false)}>×</button>
                </div>
                <div className="space-y-1.5">
                  {[...unlockedWords].sort((a, b) => a.word.localeCompare(b.word)).map(word => (
                    <button key={word.word} onClick={() => { setPracticeWord(word); setPracticeInput(''); setPracticeCorrect(false); }} className="flex w-full items-center justify-between rounded-lg bg-white/5 px-2.5 py-2 text-left transition hover:bg-white/10">
                      <span className="text-sm text-white">{word.word}</span>
                      <span className="text-[10px] text-white/45">{word.translation}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {practiceWord && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-5" onClick={() => setPracticeWord(null)}>
            <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#120d08]/95 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[#c4942a]">Practice word</div>
              <h2 className="text-2xl text-white" style={{ fontFamily: "'Playfair Display', serif" }}>{practiceWord.word}</h2>
              <p className="mb-4 text-sm text-white/55">{practiceWord.translation}</p>
              {practiceCorrect ? (
                <p className="mb-4 text-sm text-green-400">Correct. The word is yours.</p>
              ) : (
                <form onSubmit={e => { e.preventDefault(); setPracticeCorrect(stripAccents(practiceInput.trim().toLowerCase()) === stripAccents(practiceWord.word.toLowerCase())); }} className="flex gap-2">
                  <input autoFocus value={practiceInput} onChange={e => setPracticeInput(e.target.value)} placeholder={isChinese ? "输入英语单词" : "type the English word"} className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/60" />
                  <button className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs uppercase tracking-wider text-white">Check</button>
                </form>
              )}
              <button onClick={() => setPracticeWord(null)} className="mt-4 text-xs text-white/50 hover:text-white">Close</button>
            </div>
          </div>
        )}

        {debugMode && <DebugOverlayPanel overlay={overlay} mediaLabel="grocery-shop-scene" />}

        {phase === 'approach' && (
          <>
            <button
              className="absolute z-20 flex items-center justify-center rounded-full border-2 border-[#c4942a] bg-[#c4942a]/20 hover:bg-[#c4942a]/40 transition-all"
              style={{ left: '81.15%', top: '53.55%', width: '48px', height: '48px', transform: 'translate(-50%, -50%)', boxShadow: '0 0 24px rgba(196,148,42,0.8)' }}
              onClick={(e) => { e.stopPropagation(); setPhase('word-puzzle'); }}
              aria-label="Click on the shop"
            ><span className="hotspot-pulse" /></button>
            <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10" onClick={e => e.stopPropagation()}>
              <div className="rounded-2xl border border-white/10 px-4 pb-3 pt-3" style={{ background: 'rgba(0,0,0,0.92)' }}>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ccc] flex-shrink-0" />
                  <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-white/60">{isChinese ? '旁白' : 'Narrator'}</span>
                </div>
                <p className="text-white text-base leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>{isChinese ? '他来到了本地商店。点击商店进入。' : 'He arrives at the local shop. Click on the shop to enter.'}</p>
                <span className="text-white/40 text-[11px]">{isChinese ? '点击发光点' : 'click on the glowing point'}</span>
              </div>
            </div>
          </>
        )}

        {phase === 'word-puzzle' && (
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10" onClick={e => e.stopPropagation()}>
            <div className="rounded-2xl border border-white/10 px-4 pb-3 pt-3" style={{ background: 'rgba(0,0,0,0.92)' }}>
              {wordDone ? (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                    <Sparkles size={20} /><span className="text-lg font-bold">{isChinese ? '已解锁新单词！' : 'You unlocked the word!'}</span><Sparkles size={20} />
                  </div>
                  <p className="text-white/60 text-sm"><span className="text-green-400 font-medium">Shop</span> = 商店</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#c4942a] flex-shrink-0" />
                    <span className={`text-[#c4942a] uppercase tracking-[0.12em] font-semibold ${isChinese ? 'text-xs' : 'text-[9px]'}`}>{isChinese ? '输入“商店”的英语单词' : 'Type the English word for shop'}</span>
                  </div>
                  <div className="mb-2 flex gap-0.5 text-lg font-semibold tracking-[0.24em]" aria-label="Shop">
                    {'Shop'.split('').map((letter, index) => <span key={index} className={index < shopWordPrefixLength ? 'text-green-400' : 'text-white/45'}>{letter}</span>)}
                  </div>
                  <p className="mb-2 text-sm text-white/55">商店</p>
                  <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <input value={wordInput} onChange={e => setWordInput(e.target.value)} autoFocus autoComplete="off" spellCheck={false} placeholder={isChinese ? '输入 Shop…' : 'type Shop...'} className="flex-1 min-w-0 bg-white/5 text-white text-sm outline-none placeholder-white/30 caret-white border-b border-white/20 focus:border-white/60 py-2 rounded-lg px-3" />
                    <button className="rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-xs px-4 py-2 transition-all uppercase tracking-wider flex-shrink-0">{isChinese ? '确认' : 'Enter'}</button>
                  </form>
                  {wordWrong && <div className="flex items-center gap-1.5 text-red-400 text-xs mt-2"><AlertTriangle size={11} /> Not quite — try again</div>}
                </>
              )}
            </div>
          </div>
        )}

        {phase === 'inside' && (
          <>
            <div className="absolute left-4 top-28 z-30 w-44 rounded-xl border border-[#c4942a]/50 bg-black/80 p-3 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#c4942a]">Shopping list</div>
              <div className="mb-2 text-xs text-white/55">3 pieces of food</div>
              {SHOPPING_STOPS.map((food, index) => <div key={food.id} className={`flex items-center justify-between py-1 text-sm ${pickedFoodIds.includes(food.id) ? 'text-green-400 line-through' : 'text-white'}`}><span>{food.english}</span>{pickedFoodIds.includes(food.id) ? <Check size={14} /> : <span className="text-white/35">{index + 1}</span>}</div>)}
            </div>
            {SHOPPING_STOPS.filter(food => !pickedFoodIds.includes(food.id)).map((food, index) => <button key={food.id} className="absolute z-20 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#c4942a] bg-[#c4942a]/20 transition hover:bg-[#c4942a]/40" style={{ left: `${31 + index * 18}%`, top: '43%', boxShadow: '0 0 22px rgba(196,148,42,0.8)' }} onClick={() => { setActiveFoodIndex(SHOPPING_STOPS.findIndex(item => item.id === food.id)); setFoodInput(''); setPhase('food-word'); }} aria-label={`Explore ${food.english}`}><span className="hotspot-pulse" /></button>)}
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10" onClick={e => e.stopPropagation()}>
            <div className="rounded-2xl border border-white/10 px-4 pb-3 pt-3" style={{ background: 'rgba(0,0,0,0.92)' }}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ccc] flex-shrink-0" />
                <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-white/60">{isChinese ? '旁白' : 'Narrator'}</span>
              </div>
              <p className="text-white text-base leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>{isChinese ? '他走进了商店。点击每个发光点，找到清单上的物品。' : 'He steps inside the shop. Click each glowing point to find the items on the list.'}</p>
            </div>
          </div>
          </>
        )}

        {(phase === 'food-word' || phase === 'pick-food') && (
          <>
            <button className="absolute z-20 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#c4942a] bg-[#c4942a]/20 transition hover:bg-[#c4942a]/40" style={{ left: activeFood.foodPoint.left, top: activeFood.foodPoint.top, transform: 'translate(-50%, -50%)', boxShadow: '0 0 24px rgba(196,148,42,0.8)' }} onClick={() => setPhase('pick-food')} aria-label={`Select ${activeFood.english}`}><span className="hotspot-pulse" /></button>
            <div className="absolute left-4 top-28 z-30 rounded-xl border border-[#c4942a]/50 bg-black/80 px-3 py-2 text-xs text-white"><span className="text-[#c4942a]">Shopping list:</span> {activeFood.english}</div>
            <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10" onClick={e => e.stopPropagation()}><div className="rounded-2xl border border-white/10 px-4 pb-3 pt-3" style={{ background: 'rgba(0,0,0,0.92)' }}>
              {phase === 'food-word' ? <><span className="text-[#c4942a] text-[9px] uppercase tracking-[0.12em] font-semibold">{isChinese ? `输入“${activeFood.english}”的英语单词` : `Type the English word for ${activeFood.english}`}</span><div className="my-2 flex gap-0.5 text-lg font-semibold tracking-[0.2em]">{activeFood.italian.split('').map((letter, index) => <span key={index} className={index < foodPrefixLength ? 'text-green-400' : 'text-white/45'}>{letter}</span>)}</div><form onSubmit={submitFoodWord} className="flex gap-2"><input autoFocus value={foodInput} onChange={e => setFoodInput(e.target.value)} placeholder={`type ${activeFood.italian}...`} className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none" /><button className="rounded-lg border border-white/20 bg-white/10 px-4 text-xs text-white">{isChinese ? '确认' : 'Enter'}</button></form>{foodWrong && <p className="mt-2 text-xs text-red-400">{isChinese ? '还不对，请再试一次。' : 'Not quite — try again.'}</p>}</> : <><span className="text-[#c4942a] text-[9px] uppercase tracking-[0.12em] font-semibold">{isChinese ? '从货架上选择该物品' : 'Choose the item from the shelf'}</span><div className="mt-3 flex flex-wrap gap-2">{activeFood.choices.map(choice => <button key={choice} onClick={() => chooseFood(choice)} className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white transition hover:border-[#c4942a]">{choice}</button>)}</div></>}
            </div></div>
          </>
        )}

        {phase === 'detail-word' && (
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10" onClick={e => e.stopPropagation()}><div className="rounded-2xl border border-white/10 px-4 pb-3 pt-3" style={{ background: 'rgba(0,0,0,0.92)' }}><span className="text-[#c4942a] text-[9px] uppercase tracking-[0.12em] font-semibold">Type the item to add it to your words</span><p className="my-2 text-white">Type <span className="text-green-400">{detailWord}</span></p><form onSubmit={submitDetailWord} className="flex gap-2"><input autoFocus value={foodInput} onChange={e => setFoodInput(e.target.value)} placeholder={`type ${detailWord}...`} className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none" /><button className="rounded-lg border border-white/20 bg-white/10 px-4 text-xs text-white">Enter</button></form>{foodWrong && <p className="mt-2 text-xs text-red-400">Not quite — type the whole item.</p>}</div></div>
        )}

        {phase === 'checkout' && (
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10" onClick={e => e.stopPropagation()}><div className="rounded-2xl border border-white/10 px-4 pb-3 pt-3" style={{ background: 'rgba(0,0,0,0.92)' }}><span className="text-[#c4942a] text-[9px] uppercase tracking-[0.12em] font-semibold">Checkout</span><p className="my-2 text-white">Type <span className="text-green-400">pay 5 euro</span> to complete the shop.</p><form onSubmit={submitPayment} className="flex gap-2"><input autoFocus value={paymentInput} onChange={e => setPaymentInput(e.target.value)} placeholder="pay 5 euro" className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none" /><button className="rounded-lg border border-white/20 bg-white/10 px-4 text-xs text-white">Pay</button></form>{paymentWrong && <p className="mt-2 text-xs text-red-400">Type “pay 5 euro” exactly.</p>}</div></div>
        )}
        {phase === 'paid' && (
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"><div className="rounded-2xl border border-green-400/30 px-4 pb-3 pt-3" style={{ background: 'rgba(0,0,0,0.92)' }}><span className="text-green-400 text-[9px] uppercase tracking-[0.12em] font-semibold">Shop complete</span><p className="my-2 text-white">Payment accepted. You completed the shop and unlocked new areas on the world map.</p><button onClick={onComplete} className="rounded-lg border border-green-400/40 bg-green-400/15 px-4 py-2 text-xs text-white">Return to map</button></div></div>
        )}
      </div>
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: typeof navItems[number]; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  const { isChinese } = useLanguage();
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><Icon size={18} /><span><strong>{isChinese ? item.labelZh : item.label}</strong><small>{isChinese ? item.noteZh : item.note}</small></span><span className="nav-arrow">→</span></button>;
}
