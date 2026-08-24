import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Volume2, VolumeX } from 'lucide-react';
import type { DictionaryWord, GamePhase } from '../types';
import { useSpeech } from '../hooks/useSpeech';
import { useSave } from '../hooks/useSave';
import { assetUrl } from '../utils/assetUrl';
import CombatPanel from './CombatPanel';
import type { PlayerStats } from './StatsPanel';

type Props = {
  initialPhase?: GamePhase;
  initialLearnedWords?: string[];
  initialInventory?: string[];
  initialDictionary?: DictionaryWord[];
  initialXp?: number;
  initialCombatCleared?: boolean;
  showIntro?: boolean;
  onMenu: () => void;
  onFadeAudio?: () => void;
  audioMuted?: boolean;
  onToggleAudio?: () => void;
};

type CombatPhase = 'none' | 'intro' | 'player_turn' | 'enemy_turn' | 'victory' | 'cleared';
const ENEMY_MAX_HP = 20;
const PLAYER_STATS: PlayerStats = { maxHp: 100, currentHp: 100, damageMin: 5, damageMax: 8, defense: 4, agility: 5, luck: 3, level: 1 };

const PHASES: GamePhase[] = ['tied', 'has_knife', 'freed', 'has_key', 'escaped', 'flashback', 'paris_street'];
const STORY = [
  { image: 'a1.png', text: '他在一间寂静的房间里醒来，被绑在一盏孤灯下的椅子上。' },
  { image: 'a2.png', text: '两个陌生人坐在他的对面。谁也没有说话。' },
  { image: 'a3.png', text: '终于，其中一人向前倾身，问了一个问题。' },
  { image: 'a4.png', text: '他低头看着绳子，等待合适的时机。' },
  { image: 'a5.png', text: '其中一人掏出枪。你必须杀出一条路。' },
  { image: 'a6.png', text: '危险已经过去，只剩下他的呼吸声。' },
  { image: 'a7.png', text: '他独自站在灯下，环顾房间。' },
  { image: 'a8.png', text: '他寻找任何能解释自己为何被带到这里的线索。' },
  { image: 'a9.png', text: '没有时间可以浪费。他检查最后一条线索，作出了决定。' },
  { image: 'a10.png', text: '他没有回头，走进了黑暗的走廊。' },
] as const;

export default function Game({
  initialPhase = 'tied',
  initialLearnedWords = [],
  initialInventory = [],
  initialDictionary = [],
  initialXp = 0,
  initialCombatCleared = false,
  onMenu,
  onFadeAudio,
  audioMuted = false,
  onToggleAudio,
}: Props) {
  const initialIndex = Math.max(0, PHASES.indexOf(initialPhase));
  const [sceneIndex, setSceneIndex] = useState(Math.min(initialIndex, STORY.length - 1));
  const { speak, cancel, enabled, toggle } = useSpeech();
  const { save } = useSave();
  const isFinalScene = sceneIndex === STORY.length - 1;
  const [combatPhase, setCombatPhase] = useState<CombatPhase>('none');
  const [playerHp, setPlayerHp] = useState(PLAYER_STATS.maxHp);
  const [enemyHp, setEnemyHp] = useState(ENEMY_MAX_HP);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [combatCleared, setCombatCleared] = useState(initialCombatCleared);
  const [xp, setXp] = useState(initialXp);
  const [wakeInput, setWakeInput] = useState('');
  const [wakeWrong, setWakeWrong] = useState(false);
  const [wakeComplete, setWakeComplete] = useState(false);
  const inCombat = combatPhase === 'intro' || combatPhase === 'player_turn' || combatPhase === 'enemy_turn' || combatPhase === 'victory';
  const playerStats = { ...PLAYER_STATS, currentHp: playerHp };

  useEffect(() => {
    if (sceneIndex === 0 && !wakeComplete) return;
    STORY.forEach((_, index) => {
      const image = new Image();
      image.src = assetUrl(`scenes/adventure/${STORY[index].image}`);
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => speak(STORY[sceneIndex].text, 'male'), 220);
    return () => window.clearTimeout(timer);
  }, [sceneIndex, speak]);

  // The gunman scene uses the saved adventure's combat values: 100 player HP,
  // 20 enemy HP, 5–8 player damage, and 8–15 enemy damage reduced by defence.
  useEffect(() => {
    if (sceneIndex !== 4 || combatCleared || combatPhase !== 'none') return;
    const timer = window.setTimeout(() => {
      setPlayerHp(PLAYER_STATS.maxHp);
      setEnemyHp(ENEMY_MAX_HP);
      setCombatLog([]);
      setCombatPhase('intro');
    }, 450);
    return () => window.clearTimeout(timer);
  }, [sceneIndex, combatCleared, combatPhase]);

  useEffect(() => {
    if (combatPhase !== 'intro') return;
    const timer = window.setTimeout(() => setCombatPhase('player_turn'), 2600);
    return () => window.clearTimeout(timer);
  }, [combatPhase]);

  useEffect(() => {
    if (combatPhase !== 'enemy_turn') return;
    const timer = window.setTimeout(() => {
      const damage = 6;
      setCombatLog(log => [...log.slice(-4), `The gunman hits you for ${damage} damage!`]);
      setPlayerHp(hp => Math.max(1, hp - damage));
      setCombatPhase('player_turn');
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [combatPhase]);

  useEffect(() => {
    if (combatPhase !== 'victory') return;
    const timer = window.setTimeout(() => {
      setCombatCleared(true);
      setXp(value => value + 200);
      setCombatPhase('cleared');
      setSceneIndex(6);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [combatPhase]);

  const shoot = useCallback(() => {
    if (combatPhase !== 'player_turn') return;
    // First shot wounds him; the second is a guaranteed critical hit.
    const damage = enemyHp === ENEMY_MAX_HP ? 10 : enemyHp;
    const nextHp = Math.max(0, enemyHp - damage);
    setEnemyHp(nextHp);
    setCombatLog(log => [...log.slice(-4), enemyHp === ENEMY_MAX_HP ? `You shoot the gunman for ${damage} damage!` : `Critical hit! You shoot the gunman for ${damage} damage!`]);
    if (nextHp === 0) {
      setCombatLog(log => [...log.slice(-4), 'The gunman collapses to the floor.']);
      setCombatPhase('victory');
    } else {
      setCombatPhase('enemy_turn');
    }
  }, [combatPhase, enemyHp]);

  const submitWake = (event: React.FormEvent) => {
    event.preventDefault();
    if (wakeInput.trim().toLowerCase() !== 'wake up') { setWakeWrong(true); return; }
    setWakeWrong(false); setWakeInput(''); setWakeComplete(true);
    speak(STORY[0].text, 'male');
  };

  const advance = useCallback(() => {
    cancel();
    if (isFinalScene) {
      onFadeAudio?.();
      onMenu();
      return;
    }
    const nextIndex = sceneIndex + 1;
    const phase = PHASES[Math.min(nextIndex, PHASES.length - 1)];
    void save({
      phase,
      learnedWords: initialLearnedWords,
      inventory: initialInventory,
      dictionary: initialDictionary,
      introSeen: true,
      xp,
      combatCleared,
    });
    setSceneIndex(nextIndex);
  }, [cancel, combatCleared, initialDictionary, initialInventory, initialLearnedWords, isFinalScene, onFadeAudio, onMenu, save, sceneIndex, xp]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!inCombat && (event.key === 'ArrowRight' || event.key === 'Enter')) {
        event.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advance, inCombat]);

  const sceneImage = inCombat
    ? enemyHp === 0 ? 'a7.png' : enemyHp < ENEMY_MAX_HP ? 'a6.png' : STORY[sceneIndex].image
    : STORY[sceneIndex].image;

  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-white" onClick={() => { if (!inCombat && (sceneIndex !== 0 || wakeComplete)) advance(); }}>
      <img src={assetUrl(`scenes/adventure/${sceneImage}`)} alt="The Interrogation" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0 bg-black/30" />
      <header className="absolute left-0 right-0 top-0 z-10 flex items-start justify-between p-5" onClick={event => event.stopPropagation()}>
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/60">Adventure</p><h1 className="mt-1 text-lg font-bold tracking-wide">THE INTERROGATION</h1></div>
        <div className="flex gap-2"><button onClick={() => { toggle(); onToggleAudio?.(); }} className="rounded-full border border-white/20 bg-black/55 p-2.5 text-white/80 hover:text-white" title={audioMuted ? 'Turn sound on' : 'Mute voices and music'}>{audioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button><button onClick={() => { cancel(); onMenu(); }} className="rounded-full border border-white/20 bg-black/55 px-4 py-2 text-xs uppercase tracking-wider text-white/80 hover:text-white">Menu</button></div>
      </header>
      <div className="absolute left-1/2 top-5 z-20 w-52 -translate-x-1/2 rounded-full border border-white/20 bg-black/65 px-3 py-2 text-center text-[10px] uppercase tracking-wider text-white/80">XP <span className="ml-1 text-[#f0d88f]">{xp}</span><div className="mt-1 h-1 overflow-hidden rounded bg-white/15"><div className="h-full bg-[#f0d88f] transition-all duration-500" style={{ width: `${Math.min(100, (xp / 300) * 100)}%` }} /></div></div>
      {!inCombat && <section className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black via-black/75 to-transparent px-6 pb-7 pt-20"><div className="mx-auto max-w-2xl"><div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60"><span className="h-2 w-2 rounded-full bg-white/70" />旁白</div>{sceneIndex === 0 && !wakeComplete ? <><p className="text-2xl leading-snug text-white" style={{ fontFamily: "'Playfair Display', serif" }}>输入中文“醒来”的英文。</p><form onSubmit={submitWake} onClick={e => e.stopPropagation()} className="mt-4 flex gap-2"><input autoFocus value={wakeInput} onChange={e => setWakeInput(e.target.value)} placeholder="type in English..." className="min-w-0 flex-1 rounded-lg bg-white/10 px-3 py-2 text-white" /><button className="rounded-lg bg-white/15 px-4">Check</button></form>{wakeWrong && <p className="mt-2 text-sm text-red-300">再试一次。</p>}</> : <><p className="text-2xl leading-snug text-white" style={{ fontFamily: "'Playfair Display', serif" }}>{STORY[sceneIndex].text}</p><div className="mt-5 flex items-center justify-between"><span className="text-xs text-white/45">场景 {sceneIndex + 1} / {STORY.length}</span><button onClick={event => { event.stopPropagation(); advance(); }} className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-white/20">{isFinalScene ? '结束' : '继续'} <ArrowRight size={15} /></button></div></>}</div></section>}
      {inCombat && <CombatPanel combatPhase={combatPhase as 'intro' | 'player_turn' | 'enemy_turn' | 'victory'} playerHp={playerHp} playerMaxHp={PLAYER_STATS.maxHp} enemyHp={enemyHp} enemyMaxHp={ENEMY_MAX_HP} combatLog={combatLog} stats={playerStats} onAttack={shoot} />}
    </main>
  );
}
