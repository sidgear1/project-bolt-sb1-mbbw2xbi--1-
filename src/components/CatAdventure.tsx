import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Volume2, VolumeX } from 'lucide-react';
import type { DictionaryWord, GamePhase } from '../types';
import { useSave } from '../hooks/useSave';
import { useSpeech } from '../hooks/useSpeech';
import { assetUrl } from '../utils/assetUrl';
import CombatPanel from './CombatPanel';
import type { PlayerStats } from './StatsPanel';

type Props = { initialPhase?: GamePhase; initialLearnedWords?: string[]; initialInventory?: string[]; initialDictionary?: DictionaryWord[]; initialXp?: number; initialCombatCleared?: boolean; showIntro?: boolean; onMenu: () => void; onFadeAudio?: () => void; audioMuted?: boolean; onToggleAudio?: () => void };

const PHASES: GamePhase[] = ['tied', 'has_knife', 'freed', 'has_key', 'escaped', 'flashback'];
type CombatPhase = 'none' | 'intro' | 'player_turn' | 'enemy_turn' | 'victory';
const MOUSE_MAX_HP = 20;
const TAMMY_MAX_HP = 30;
const TAMMY_STATS: PlayerStats = { maxHp: TAMMY_MAX_HP, currentHp: TAMMY_MAX_HP, damageMin: 2, damageMax: 4, defense: 2, agility: 7, luck: 6, level: 1 };
const SCENES = [
  { image: '1.png', text: 'New York.' },
  { image: '2.png', text: 'A concrete jungle with a concrete heart.' },
  { image: '3.png', text: 'A place where softness has no place, with only rough corners and rougher people.' },
  { image: '4.png', text: 'Here, you conquer or become conquered.' },
  { image: '5.png', text: 'In the heart of it lies Tammy the cat: lost, afraid, and unsure of what to make of this new world.' },
  { image: '6.png', text: '“Where am I?” Tammy says. “Mommy?” She must find her way home.' },
] as const;

function useTammyMusic(muted: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const start = useCallback(() => {
    if (audioRef.current) return;
    const audio = new Audio(assetUrl('audio/cat/lost-kitten.mp3'));
    audio.loop = true;
    audio.volume = muted ? 0 : 0.28;
    audioRef.current = audio;
    void audio.play().catch(() => undefined);
  }, [muted]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = muted ? 0 : 0.28; }, [muted]);
  useEffect(() => () => { audioRef.current?.pause(); audioRef.current = null; }, []);
  return start;
}

export default function CatAdventure({ initialPhase = 'tied', initialLearnedWords = [], initialInventory = [], initialDictionary = [], initialXp = 0, onMenu, onFadeAudio, audioMuted = false, onToggleAudio }: Props) {
  const [sceneIndex, setSceneIndex] = useState(() => Math.max(0, PHASES.indexOf(initialPhase)));
  const { speak, cancel, toggle } = useSpeech();
  const { save } = useSave();
  const startTammyMusic = useTammyMusic(audioMuted);
  const scene = SCENES[Math.min(sceneIndex, SCENES.length - 1)];
  const isLastScene = sceneIndex === SCENES.length - 1;
  const [combatPhase, setCombatPhase] = useState<CombatPhase>('none');
  const [tammyHp, setTammyHp] = useState(TAMMY_MAX_HP);
  const [mouseHp, setMouseHp] = useState(MOUSE_MAX_HP);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [parryReady, setParryReady] = useState(false);
  const [mouseDefeated, setMouseDefeated] = useState(false);
  const inCombat = combatPhase !== 'none';

  useEffect(() => { SCENES.forEach(({ image }) => { const preload = new Image(); preload.src = assetUrl(`scenes/cat/${image}`); }); }, []);
  useEffect(() => { const timer = window.setTimeout(() => speak(scene.text, 'adventure'), 220); return () => window.clearTimeout(timer); }, [scene, speak]);

  const advance = useCallback(() => {
    startTammyMusic();
    cancel();
    if (isLastScene) return;
    const nextIndex = sceneIndex + 1;
    void save({ phase: PHASES[nextIndex], learnedWords: initialLearnedWords, inventory: initialInventory, dictionary: initialDictionary, introSeen: true, xp: initialXp, combatCleared: false });
    setSceneIndex(nextIndex);
  }, [cancel, initialDictionary, initialInventory, initialLearnedWords, initialXp, isLastScene, onFadeAudio, onMenu, save, sceneIndex, startTammyMusic]);

  const checkFood = (event: React.MouseEvent) => {
    event.stopPropagation(); startTammyMusic(); speak('Tammy searches for food, but finds only an empty wrapper.', 'adventure');
  };
  const checkShelter = (event: React.MouseEvent) => {
    event.stopPropagation(); startTammyMusic();
    if (mouseDefeated) { speak('The bin is quiet now. It could make a dry shelter for Tammy.', 'adventure'); return; }
    setTammyHp(TAMMY_MAX_HP); setMouseHp(MOUSE_MAX_HP); setCombatLog([]); setParryReady(false); setCombatPhase('intro');
    speak('A mouse darts out from the bin. It will not share its shelter without a fight.', 'adventure');
  };
  const attackMouse = () => {
    if (combatPhase !== 'player_turn') return;
    const damage = Math.min(mouseHp, Math.floor(Math.random() * 3) + 2);
    const nextHp = Math.max(0, mouseHp - damage);
    setMouseHp(nextHp);
    setCombatLog(log => [...log.slice(-3), `Tammy pounces for ${damage} damage!`]);
    setCombatPhase(nextHp === 0 ? 'victory' : 'enemy_turn');
  };
  const parryMouse = () => {
    if (combatPhase !== 'player_turn') return;
    setParryReady(true); setCombatLog(log => [...log.slice(-3), 'Tammy braces for the mouse’s next bite.']); setCombatPhase('enemy_turn');
  };

  useEffect(() => {
    if (combatPhase !== 'intro') return;
    const timer = window.setTimeout(() => setCombatPhase('player_turn'), 450);
    return () => window.clearTimeout(timer);
  }, [combatPhase]);
  useEffect(() => {
    if (combatPhase !== 'enemy_turn') return;
    const hitTimer = window.setTimeout(() => {
      const damage = parryReady ? 3 : 8;
      setTammyHp(hp => Math.max(1, hp - damage));
      setCombatLog(log => [...log.slice(-3), parryReady ? 'Parry! Tammy takes only 3 damage.' : 'The mouse bites Tammy for 8 damage!']);
      setParryReady(false);
    }, 500);
    const turnTimer = window.setTimeout(() => setCombatPhase('player_turn'), 1200);
    return () => { window.clearTimeout(hitTimer); window.clearTimeout(turnTimer); };
  }, [combatPhase, parryReady]);
  useEffect(() => {
    if (combatPhase !== 'victory') return;
    const timer = window.setTimeout(() => { setMouseDefeated(true); setCombatPhase('none'); speak('The mouse runs away. Tammy has found a shelter.', 'adventure'); }, 1800);
    return () => window.clearTimeout(timer);
  }, [combatPhase, speak]);

  useEffect(() => { const handleKeyDown = (event: KeyboardEvent) => { if (!inCombat && (event.key === 'ArrowRight' || event.key === 'Enter')) { event.preventDefault(); advance(); } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [advance, inCombat]);

  return <main className="fixed inset-0 overflow-hidden bg-black text-white" onClick={inCombat ? undefined : advance}>
    <img src={assetUrl(`scenes/cat/${scene.image}`)} alt={`Tammy in New York — scene ${sceneIndex + 1}`} className={`absolute inset-0 h-full w-full ${scene.image === '6.png' ? 'object-contain' : 'object-cover'}`} draggable={false} />
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/35" />
    <header className="absolute left-0 right-0 top-0 z-10 flex items-start justify-between p-5" onClick={event => event.stopPropagation()}><div><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/60">Adventure</p><h1 className="mt-1 text-lg font-bold tracking-wide">TAMMY: LOST IN NEW YORK</h1></div><div className="flex gap-2"><button onClick={() => { toggle(); onToggleAudio?.(); }} className="rounded-full border border-white/20 bg-black/55 p-2.5 text-white/80 hover:text-white" title={audioMuted ? 'Turn sound on' : 'Mute voices and music'}>{audioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button><button onClick={() => { cancel(); onMenu(); }} className="rounded-full border border-white/20 bg-black/55 px-4 py-2 text-xs uppercase tracking-wider text-white/80 hover:text-white">Menu</button></div></header>
    {scene.image === '6.png' && !inCombat && <><button aria-label="Check for food" onClick={checkFood} className="absolute z-20 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#c4942a] bg-[#c4942a]/20 text-lg shadow-[0_0_22px_rgba(196,148,42,0.8)] transition hover:bg-[#c4942a]/40" style={{ left: '66.6%', top: '53%', transform: 'translate(-50%, -50%)' }}><span className="hotspot-pulse" /><span aria-hidden="true">🍖</span><span className="hotspot-tooltip">Check for food</span></button><button aria-label="Check for shelter" onClick={checkShelter} className="absolute z-20 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#c4942a] bg-[#c4942a]/20 text-lg shadow-[0_0_22px_rgba(196,148,42,0.8)] transition hover:bg-[#c4942a]/40" style={{ left: '90%', top: '49.2%', transform: 'translate(-50%, -50%)' }}><span className="hotspot-pulse" /><span aria-hidden="true">🛖</span><span className="hotspot-tooltip">Check for shelter</span></button></>}
    {inCombat && <CombatPanel combatPhase={combatPhase as Exclude<CombatPhase, 'none'>} playerHp={tammyHp} playerMaxHp={TAMMY_MAX_HP} enemyHp={mouseHp} enemyMaxHp={MOUSE_MAX_HP} combatLog={combatLog} stats={{ ...TAMMY_STATS, currentHp: tammyHp }} onAttack={attackMouse} onParry={parryMouse} parryReady={parryReady} />}
    {!inCombat && <section className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black via-black/80 to-transparent px-6 pb-7 pt-24"><div className="mx-auto max-w-2xl"><div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60"><span className="h-2 w-2 rounded-full bg-white/70" />Narrator</div><p className="text-2xl leading-snug text-white" style={{ fontFamily: "'Playfair Display', serif" }}>{scene.text}</p><div className="mt-5 flex items-center justify-between"><span className="text-xs text-white/45">Scene {sceneIndex + 1} / {SCENES.length}</span>{!isLastScene && <button onClick={event => { event.stopPropagation(); advance(); }} className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-white/20">Continue <ArrowRight size={15} /></button>}</div></div></section>}
  </main>;
}
