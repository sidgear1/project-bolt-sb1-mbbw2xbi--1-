import { useCallback, useEffect, useState, Component } from 'react';
import { Screen, GamePhase, DictionaryWord } from './types';
import { SaveSlot, useSave } from './hooks/useSave';
import { useCafeMusic } from './hooks/useAudio';
import MainMenu, { type HubSection } from './components/MainMenu';
import CafeAdventure from './components/adventure test/Game';
import CatAdventure from './components/CatAdventure';
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

type AdventureKind = 'cafe' | 'tammy';


const LOADING_FRAMES = ['/loading/z1.png', '/loading/z2.png', '/loading/z3.png', '/loading/z4.png', '/loading/z5.png'];
const AVATARS = ['/avatars/avatar-2.jpg', '/avatars/avatar-3.jpg', '/avatars/avatar-4.jpg', '/avatars/avatar-5.jpg', '/avatars/avatar-6.png', '/avatars/avatar-7.png', '/avatars/avatar-8.png'];
const STARTUP_ASSETS = [
  ...LOADING_FRAMES,
  ...AVATARS,
  '/home-wallpapers/notebook-adventure-v3.png',
  '/home-wallpapers/learn-english-room.png',
  '/home-wallpapers/watercolor-adventure.png',
  '/home-wallpapers/island-quest.png',
  '/roam/roam-region-picker-wallpaper-v1.png',
  ...Array.from({ length: 9 }, (_, index) => `/roam/roam-region-wallpaper-${index + 1}-v1.png`),
  '/ChatGPT_Image_Aug_12,_2026,_06_03_48_AM_(1).png',
  '/world-ai/elderwoods-map-after-ice-cream-v1.png',
  '/maps/elderwoods-town-centre-map-v2.png',
  '/maps/north-america-roam-map-v2.png',
  '/cafe_room.png',
  '/Use_AI_Image_Jun_15,_2026,_19_20_35.png',
  '/Gemini_Generated_Image_a625ema625ema625.png',
  '/ChatGPT_Image_Jun_14,_2026,_05_36_59_PM.png',
  '/man_in_g.png', '/man_in_g_on_floor.png',
  '/a1.png', '/a2.png', '/a3.png', '/a4.png', '/scenes/bella/a5.png',
  '/scenes/bella/a6.png', '/scenes/bella/b1-woman.png', '/scenes/bella/b2.png',
  '/scenes/bella/b3-no-cyclists.png', '/scenes/bella/b4-no-cyclists.png',
  '/scenes/bella/b5-no-cyclists.png', '/scenes/bella/b6 copy.png',
  '/scenes/shop/c1.png', '/scenes/shop/c2.png', '/scenes/shop/c3.png', '/scenes/shop/c4.png',
  '/scenes/shop/c5.png', '/scenes/shop/c1-v3.png', '/scenes/shop/c2-v3.png',
  '/scenes/shop/c3-dinner.png', '/scenes/shop/c4-v2.png', '/scenes/shop/c5-v2.png', '/scenes/shop/c7-v2.png',
  '/scenes/shop/c8-rose-v2.png',
  '/scenes/bus/d1.png', '/scenes/bus/d2.png', '/scenes/bus/d3.png', '/scenes/bus/d4.png',
  '/scenes/home/e1-enhanced.png', '/scenes/home/e2-enhanced.png', '/scenes/home/e3-enhanced.png',
  '/scenes/home/e4-enhanced.png', '/scenes/home/e5-enhanced.png',
  '/scenes/garden/f1.png', '/scenes/garden/f2.png', '/scenes/garden/f3.png', '/scenes/garden/f4.png',
  '/scenes/cop/i1.png', '/scenes/cop/i2.png', '/scenes/cop/i3.png', '/scenes/cop/i4.png',
  '/scenes/cop/i5.png', '/scenes/cop/i6.png', '/scenes/cop/i7 a.png', '/scenes/cop/i7 b.png',
  ...Array.from({ length: 6 }, (_, index) => `/scenes/cat/${index + 1}.png`),
];

function preloadImage(source: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = source;
  });
}

function StartupLoading({ onDone }: { onDone: () => void }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    let active = true;
    const startedAt = performance.now();
    // Always let players see every supplied loading frame in order. Asset loading
    // can be faster than a single frame when files are cached, so it cannot decide
    // how quickly this sequence ends on its own.
    const frameDuration = 100;
    const minimumSequenceDuration = LOADING_FRAMES.length * frameDuration;
    const timer = window.setInterval(() => setFrame(current => Math.min(current + 1, LOADING_FRAMES.length - 1)), frameDuration);
    Promise.all(STARTUP_ASSETS.map(preloadImage)).then(() => {
      const remaining = Math.max(0, minimumSequenceDuration - (performance.now() - startedAt));
      window.setTimeout(() => {
        if (!active) return;
        window.requestAnimationFrame(onDone);
      }, remaining);
    });
    return () => { active = false; window.clearInterval(timer); };
  }, [onDone]);
  return <div className="fixed inset-0 overflow-hidden bg-[#07175d]"><img key={LOADING_FRAMES[frame]} src={LOADING_FRAMES[frame]} onError={event => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 h-full w-full animate-in fade-in duration-200 object-cover" alt="Loading TaleTalk" /></div>;
}

function formatPlayTime(seconds: number) {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${remaining}`;
}

function profileProgress(slot: number) {
  const key = (name: string) => `taletalk-slot-${slot}-${name}`;
  const complete = ['bella-complete', 'shop-complete', 'market-complete', 'bus-complete', 'home-complete', 'cop-complete', 'soccer-complete']
    .filter(name => localStorage.getItem(key(name)) === 'true').length;
  return Math.round((complete / 7) * 100);
}

function AccountAvatar({ src, label, className = '' }: { src: string | null; label: string; className?: string }) {
  const visibleSource = src === '/avatars/avatar-1.png' ? null : src;
  return <span className={`relative grid place-items-center overflow-hidden bg-gradient-to-br from-amber-200 to-orange-400 text-sm font-black text-[#58300b] ${className}`}><span>{label.slice(0, 2).toUpperCase()}</span>{visibleSource && <img src={visibleSource} onError={event => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 h-full w-full object-cover" alt="" />}</span>;
}

function AccountSelect({ onComplete }: { onComplete: () => void }) {
  const { listSlots, nameSlot, removeSlot, selectSlot } = useSave();
  const [slots, setSlots] = useState<SaveSlot[]>(() => listSlots());
  const [creating, setCreating] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [deleting, setDeleting] = useState<SaveSlot | null>(null);
  const refresh = () => setSlots(listSlots());
  const load = (slot: number) => { selectSlot(slot); onComplete(); };
  const create = () => {
    if (creating === null || !name.trim()) return;
    removeSlot(creating);
    ['bella-complete', 'shop-complete', 'bus-complete', 'home-complete', 'cop-complete', 'soccer-complete', 'unlocked-words', 'map-welcome-seen', 'roam-saved-words'].forEach(key => localStorage.removeItem(`taletalk-slot-${creating}-${key}`));
    nameSlot(creating, name.trim(), avatar);
    localStorage.setItem(`taletalk-slot-${creating}-welcome-pending`, "true");
    load(creating);
  };
  const erase = () => { if (!deleting || name !== deleting.name) return; removeSlot(deleting.slot); refresh(); setDeleting(null); setName(''); };
  return <div className="fixed inset-0 overflow-y-auto bg-[#0b163a] p-5 text-white"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#285bb5,transparent_45%)]" /><main className="relative mx-auto my-4 max-w-4xl rounded-3xl border border-white/20 bg-[#111936]/95 p-5 shadow-2xl md:p-8"><p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">TaleTalk</p><h1 className="mt-2 text-3xl font-black">Choose your story</h1><p className="mt-2 text-sm text-white/65">Every profile keeps its own adventure, world-map, and roam progress.</p><div className="mt-6 space-y-3">{slots.map(slot => <div key={slot.slot} className="flex min-h-20 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">{slot.name ? <><button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => load(slot.slot)}><AccountAvatar src={slot.avatar} label={slot.name} className="h-14 w-14 rounded-xl" /><span className="min-w-0"><b className="block truncate text-lg">{slot.name}</b><small className="text-white/55">Last scene · {slot.phase ?? 'New story'} · {slot.updatedAt ? 'In progress' : '00:00'}</small></span></button><button className="rounded-lg px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/20" onClick={() => { setDeleting(slot); setName(''); }}>Delete</button></> : <button className="flex flex-1 items-center gap-3 text-left" onClick={() => { setCreating(slot.slot); setName(''); setAvatar(AVATARS[0]); }}><span className="grid h-14 w-14 place-items-center rounded-xl bg-white/10 text-3xl">+</span><span><b className="block text-lg">Create a new story</b><small className="text-white/55">Empty profile {slot.slot}</small></span></button>}</div>)}</div>{creating !== null && <div className="mt-5 rounded-2xl border border-amber-300/30 bg-black/30 p-5"><h2 className="text-xl font-bold">Create your profile</h2><input className="mt-4 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 outline-none focus:border-amber-300" value={name} onChange={event => setName(event.target.value)} placeholder="Profile name" autoFocus /><p className="mt-4 text-sm font-semibold text-white/75">Choose an avatar</p><div className="mt-3 flex flex-wrap gap-3">{AVATARS.map((item, index) => <button key={item} onClick={() => setAvatar(item)} className={`rounded-xl p-1 ${avatar === item ? 'ring-2 ring-amber-300' : 'opacity-70'}`}><AccountAvatar src={item} label={`A${index + 1}`} className="h-14 w-14 rounded-lg" /></button>)}</div><div className="mt-5 flex gap-3"><button className="rounded-xl bg-white/10 px-4 py-2" onClick={() => setCreating(null)}>Cancel</button><button className="rounded-xl bg-amber-400 px-4 py-2 font-bold text-[#382005] disabled:opacity-40" disabled={!name.trim()} onClick={create}>Enter TaleTalk</button></div></div>}{deleting && <div className="mt-5 rounded-2xl border border-rose-300/30 bg-black/30 p-5"><h2 className="text-xl font-bold">Delete {deleting.name}?</h2><p className="mt-2 text-sm text-white/65">Type the profile name to confirm.</p><input className="mt-4 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 outline-none" value={name} onChange={event => setName(event.target.value)} placeholder={deleting.name ?? ''} /><div className="mt-4 flex gap-3"><button className="rounded-xl bg-white/10 px-4 py-2" onClick={() => setDeleting(null)}>Cancel</button><button className="rounded-xl bg-rose-500 px-4 py-2 font-bold" disabled={name !== deleting.name} onClick={erase}>Delete profile</button></div></div>}</main></div>;
}

function AccountSelectV2({ onComplete }: { onComplete: () => void }) {
  const { listSlots, nameSlot, removeSlot, selectSlot } = useSave();
  const [slots, setSlots] = useState<SaveSlot[]>(() => listSlots());
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [deleting, setDeleting] = useState<SaveSlot | null>(null);
  const visibleSlots = slots.slice(page * 5, page * 5 + 5);
  const slotSummary = (slot: SaveSlot) => `${slot.phase ?? 'New story'} · ${profileProgress(slot.slot)}% complete · ${formatPlayTime(slot.playTimeSeconds)}`;
  const enter = (slot: number) => { selectSlot(slot); onComplete(); };
  const create = () => {
    if (!name.trim() || creating === null) return;
    removeSlot(creating);
    ['bella-complete', 'shop-complete', 'market-complete', 'bus-complete', 'home-complete', 'cop-complete', 'soccer-complete', 'unlocked-words', 'map-welcome-seen', 'roam-saved-words'].forEach(key => localStorage.removeItem(`taletalk-slot-${creating}-${key}`));
    nameSlot(creating, name.trim(), avatar);
    localStorage.setItem(`taletalk-slot-${creating}-welcome-pending`, "true");
    enter(creating);
  };
  const deleteProfile = () => {
    if (!deleting || name !== deleting.name) return;
    removeSlot(deleting.slot); setSlots(listSlots()); setDeleting(null); setName('');
  };
  return <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-cover bg-center p-4 text-white" style={{ backgroundImage: "linear-gradient(rgba(5,11,30,.7),rgba(5,11,30,.78)),url('/home-wallpapers/notebook-adventure-v3.png')" }}>
    <main className="w-full max-w-3xl rounded-3xl border border-white/20 bg-[#10182ee8] p-4 shadow-2xl backdrop-blur-sm">
      <h1 className="text-center text-2xl font-black">Choose your story</h1>
      {!creating && !deleting && <><div className="mt-3 space-y-2">{visibleSlots.map(slot => <div className="flex h-16 items-center rounded-xl border border-white/10 bg-black/25 p-2" key={slot.slot}>{slot.name ? <><button onClick={() => enter(slot.slot)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><AccountAvatar src={slot.avatar} label={slot.name} className="h-12 w-12 rounded-lg" /><span className="min-w-0"><b className="block truncate">{slot.name}</b><small className="block truncate text-xs text-white/60">{slotSummary(slot)}</small></span></button><button onClick={() => { setDeleting(slot); setName(''); }} className="px-3 text-xs text-rose-200">Delete</button></> : <button onClick={() => { setCreating(slot.slot); setName(''); setAvatar(AVATARS[0]); }} className="flex flex-1 items-center gap-3 text-left"><span className="grid h-12 w-12 place-items-center rounded-lg bg-white/10 text-2xl">+</span><span><b className="block">Create a new story</b><small className="text-xs text-white/60">Empty profile {slot.slot}</small></span></button>}</div>)}</div>{page === 0 && <button onClick={() => setPage(1)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-2 text-sm">More profiles <span className="text-xl">→</span></button>}{page === 1 && <button onClick={() => setPage(0)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-2 text-sm">← First five profiles</button>}</>}
      {creating !== null && <div className="mt-3 rounded-2xl bg-black/35 p-4"><h2 className="text-lg font-bold">Create your profile</h2><input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Profile name" className="mt-3 w-full rounded-xl bg-white/10 px-4 py-2 outline-none" /><p className="mt-2 text-xs text-white/55">You will choose your daily learning goal after your welcome.</p><div className="mt-3 flex gap-2">{AVATARS.map((item, index) => <button key={item} onClick={() => setAvatar(item)} className={avatar === item ? 'rounded-lg p-1 ring-2 ring-amber-300' : 'rounded-lg p-1 opacity-70'}><AccountAvatar src={item} label={`A${index + 1}`} className="h-12 w-12 rounded-lg" /></button>)}</div><div className="mt-4 flex gap-2"><button onClick={() => setCreating(null)} className="rounded-lg bg-white/10 px-4 py-2">Cancel</button><button disabled={!name.trim()} onClick={create} className="rounded-lg bg-amber-300 px-4 py-2 font-bold text-slate-900 disabled:opacity-40">Enter TaleTalk</button></div></div>}
      {deleting && <div className="mt-3 rounded-2xl bg-black/35 p-4"><h2 className="text-lg font-bold">Delete {deleting.name}?</h2><p className="text-sm text-white/65">Type the profile name to confirm.</p><input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder={deleting.name ?? ''} className="mt-3 w-full rounded-xl bg-white/10 px-4 py-2 outline-none" /><div className="mt-4 flex gap-2"><button onClick={() => setDeleting(null)} className="rounded-lg bg-white/10 px-4 py-2">Cancel</button><button disabled={name !== deleting.name} onClick={deleteProfile} className="rounded-lg bg-rose-500 px-4 py-2 font-bold disabled:opacity-40">Delete</button></div></div>}
    </main>
  </div>;
}

export default function App() {
  const { isChinese } = useLanguage();
  const [screen, setScreen] = useState<Screen | 'loading' | 'profiles'>('loading');
  const [menuSection, setMenuSection] = useState<HubSection>('home');
  const [gameSession, setGameSession] = useState(0);
  const [adventureKind, setAdventureKind] = useState<AdventureKind>('cafe');
  const [adventureMuted, setAdventureMuted] = useState(() => localStorage.getItem('taletalk-adventure-muted') === 'true');
  const [gameConfig, setGameConfig] = useState<GameStartConfig>({
    phase: 'tied',
    learnedWords: [],
    inventory: [],
    dictionary: [],
    showIntro: true,
    xp: 0,
    combatCleared: false,
  });

  const { load, deleteSave, addPlayTime } = useSave();
  const { start: startAudio, stop: stopAudio, fadeOut: fadeAudio } = useCafeMusic(adventureMuted);

  const handleNewGame = async (adventure: AdventureKind = 'cafe', startPhase?: GamePhase) => {
    await deleteSave();
    stopAudio();
    setAdventureKind(adventure);
    setGameConfig({ phase: startPhase ?? 'tied', learnedWords: [], inventory: [], dictionary: [], showIntro: true, xp: 0, combatCleared: false });
    setGameSession(session => session + 1);
    setScreen('game');
  };

  const handleContinue = async () => {
    stopAudio();
    setAdventureKind('cafe');
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
    setGameSession(session => session + 1);
    setScreen('game');
  };

  const handleReturnToMenu = () => {
    stopAudio();
    setMenuSection('adventure');
    setScreen('menu');
  };

  const languageHint = <div className="fixed bottom-3 right-16 z-[100] rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-[10px] tracking-wide text-white/75 backdrop-blur-sm">{isChinese ? '中文 · 按 ; 查看英文' : 'English · Press ; for Chinese'}</div>;
  const copyrightNotice = <div className="fixed bottom-3 left-3 z-[100] rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-[10px] tracking-wide text-white/75 backdrop-blur-sm">© 2026 TaleTalk. All rights reserved.</div>;

  const finishLoading = useCallback(() => setScreen('profiles'), []);

  useEffect(() => {
    if (screen === 'loading' || screen === 'profiles') return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') addPlayTime(10);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [screen, addPlayTime]);

  if (screen === 'loading') return <StartupLoading onDone={finishLoading} />;
  if (screen === 'profiles') return <AccountSelectV2 onComplete={() => setScreen('menu')} />;

  if (screen === 'game') {
    const ActiveAdventure = adventureKind === 'tammy' ? CatAdventure : CafeAdventure;
    return (
      <><ErrorBoundary fallback={
        <div className="fixed inset-0 bg-[#0d0804] flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-[#c4942a] text-lg mb-4">Something went wrong.</p>
            <button onClick={() => handleReturnToMenu()} className="text-[#8b6914] underline">Return to menu</button>
          </div>
        </div>
      }>
        <ActiveAdventure
          key={gameSession}
          initialPhase={gameConfig.phase}
          initialLearnedWords={gameConfig.learnedWords}
          initialInventory={gameConfig.inventory}
          initialDictionary={gameConfig.dictionary}
          initialXp={gameConfig.xp}
          initialCombatCleared={gameConfig.combatCleared}
          showIntro={gameConfig.showIntro}
          onMenu={handleReturnToMenu}
          onFadeAudio={() => fadeAudio(4)}
          audioMuted={adventureMuted}
          onToggleAudio={() => setAdventureMuted(muted => {
            const next = !muted;
            localStorage.setItem('taletalk-adventure-muted', String(next));
            return next;
          })}
        />
      </ErrorBoundary></>
    );
  }

  return <MainMenu initialSection={menuSection} onNewGame={handleNewGame} onStartTammy={() => handleNewGame('tammy')} onContinue={handleContinue} onStartAudio={startAudio} onLogout={() => setScreen('profiles')} />;
}
