import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Zap } from 'lucide-react';
import type { DictionaryWord, GamePhase } from '../types';
import { useSave } from '../hooks/useSave';
import { preloadGeneratedSpeech, useSpeech } from '../hooks/useSpeech';
import { assetUrl } from '../utils/assetUrl';
import CombatPanel from './CombatPanel';
import type { PlayerStats } from './StatsPanel';
import StatsPanel from './StatsPanel';
import InventoryPanel from './InventoryPanel';
import DictionaryPanel from './DictionaryPanel';
import LiveTypingFeedback from './LiveTypingFeedback';
import SmoothSceneImage from './SmoothSceneImage';
import { preloadSceneWindow } from '../utils/imagePreloader';

type Props = { initialPhase?: GamePhase; initialLearnedWords?: string[]; initialInventory?: string[]; initialDictionary?: DictionaryWord[]; initialXp?: number; initialCombatCleared?: boolean; showIntro?: boolean; onMenu: () => void; onFadeAudio?: () => void; audioMuted?: boolean; onToggleAudio?: () => void };

const PHASES: GamePhase[] = ['tied', 'has_knife', 'freed', 'has_key', 'escaped', 'flashback', 'cat_7', 'cat_8', 'cat_9', 'cat_10', 'cat_10a', 'cat_11', 'cat_12', 'cat_13', 'cat_14', 'cat_15', 'cat_17', 'cat_18', 'cat_19', 'cat_20', 'cat_21', 'cat_22', 'cat_23', 'cat_24', 'cat_25'];
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
  { image: '7.png', text: 'Then a large cat steps out of the shadows.' },
  { image: '8.png', text: '“Hi,” says the big cat, his voice gentle despite his size.' },
  { image: '9.png', text: 'He looks at Tammy with kind, curious eyes. “Why are you lost, little one?”' },
  { image: '10.png', text: 'Tammy tells him about the strange city and how far away home feels.' },
  { image: '10a.png', text: 'The big cat listens without interrupting.' },
  { image: '11.png', text: '“You should not be alone out here,” he says. “Follow me.”' },
  { image: '12.png', text: 'Tammy takes a careful step after him.' },
  { image: '13.png', text: 'Together they leave the noisy street behind.' },
  { image: '14.png', text: 'The big cat knows every turn, every quiet corner, and every safe path.' },
  { image: '15.png', text: '“Stay close,” he says. Tammy follows his warm, steady footsteps.' },
  { image: '17.png', text: 'At last, they reach a hidden place away from the city rush.' },
  { image: '18.png', text: 'This is the big cat’s lair—his home.' },
  { image: '19.png', text: 'It is safe, quiet, and warmer than Tammy expected.' },
  { image: '20.png', text: '“You can rest here,” the big cat says. “We will help you find your way.”' },
  { image: '21.png', text: 'For the first time since she was lost, Tammy feels a little less afraid.' },
  { image: '22.png', text: 'She looks around the lair and begins to believe she is not alone.' },
  { image: '23.png', text: 'The big cat has given Tammy more than shelter: he has given her hope.' },
  { image: '24.png', text: 'Tonight, Tammy has a safe home to rest in.' },
  { image: '25.png', text: 'Tomorrow, her journey home will begin.' },
] as const;

const IMAGE_TEXT: Record<string, string> = {
  '3.png': 'A place where softness has no place, with only rough corners, rough edges, and rougher people.',
  '5.png': '',
  '6.png': 'In the heart of it lies Tammy the cat: lost, afraid, and unsure of what to make of this new world.',
  '8.png': 'Tammy edges closer to the bins, searching for a place to rest.',
  '9.png': 'A mouse appears—vicious and defensive of its space.',
};

type TammyLesson = { word: string; sentence: string; onComplete: () => void };

function TammyLessonPanel({ lesson, onComplete, onClose }: { lesson: TammyLesson; onComplete: (word: string) => void; onClose: () => void }) {
  const [step, setStep] = useState<'word' | 'sentence'>('word');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const expected = step === 'word' ? lesson.word : lesson.sentence;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (answer.trim().toLowerCase() !== expected.toLowerCase()) { setError(`Type: ${expected}`); return; }
    setAnswer(''); setError('');
    if (step === 'word') { setStep('sentence'); return; }
    onComplete(lesson.word); lesson.onComplete();
  };
  return <section className="absolute bottom-0 left-0 right-0 z-40 border-t border-[#c4942a]/50 bg-[#0d0804]/95 px-5 py-4 backdrop-blur-md"><div data-task-editor-panel="tammy-lesson" className="mx-auto max-w-2xl"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#e8d5a3]">{step === 'word' ? 'Unlock the word' : 'Use the word in a sentence'}</p><button onClick={onClose} className="text-xs text-white/60">Close</button></div><p className="mt-2 text-sm text-white/85">{step === 'word' ? 'Type the word to unlock it.' : 'Now type the full sentence to continue.'}</p><LiveTypingFeedback target={expected} value={answer} className="mt-2 block text-base" /><form onSubmit={submit} className="mt-3 flex gap-2"><input autoFocus value={answer} onChange={event => setAnswer(event.target.value)} placeholder={step === 'word' ? 'type the word…' : 'type the full sentence…'} className="min-w-0 flex-1 rounded-lg border border-white/25 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#c4942a]" /><button className="rounded-lg bg-[#c4942a] px-4 py-2 text-sm font-bold text-[#171008]">Enter</button></form>{error && <p className="mt-2 text-xs text-rose-300">{error}</p>}</div></section>;
}

function PreyStyleTammyPanel({ lesson, onComplete, onClose }: { lesson: TammyLesson; onComplete: (word: string) => void; onClose: () => void }) {
  const [step, setStep] = useState<'word' | 'verb' | 'noun'>('word');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const parts = lesson.sentence.split(' ');
  const verb = parts.slice(0, 2).join(' ');
  const noun = parts.slice(2).join(' ');
  const expected = step === 'word' ? lesson.word : step === 'verb' ? verb : noun;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (answer.trim().toLowerCase() !== expected.toLowerCase()) { setError(`Type: ${expected}`); return; }
    setAnswer(''); setError('');
    if (step === 'word') { setStep('verb'); return; }
    if (step === 'verb') { setStep('noun'); return; }
    onComplete(lesson.word); lesson.onComplete();
  };
  const prompt = step === 'word' ? 'Type the word to unlock it.' : step === 'verb' ? 'Type a verb: look at · look for' : 'Now type the noun.';
  return <section className="absolute bottom-0 left-0 right-0 z-40 border-t border-[#c4942a]/50 bg-[#0d0804]/95 px-5 py-4 backdrop-blur-md"><div data-task-editor-panel="tammy-prey-lesson" className="mx-auto max-w-2xl"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#e8d5a3]">{step === 'word' ? 'Unlock word' : step === 'verb' ? 'Choose verb' : 'Choose noun'}</p><button onClick={onClose} className="text-xs text-white/60">Close</button></div><p className="mt-2 text-sm text-white/85">{prompt}</p><LiveTypingFeedback target={expected} value={answer} className="mt-2 block text-base" /><form onSubmit={submit} className="mt-3 flex gap-2"><input autoFocus value={answer} onChange={event => setAnswer(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/25 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#c4942a]" /><button className="rounded-lg bg-[#c4942a] px-4 py-2 text-sm font-bold text-[#171008]">Enter</button></form>{error && <p className="mt-2 text-xs text-rose-300">{error}</p>}</div></section>;
}

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
  const [searchGoal, setSearchGoal] = useState<'food' | 'shelter' | null>(null);
  const [lesson, setLesson] = useState<TammyLesson | null>(null);
  const [xp, setXp] = useState(initialXp);
  const [dictionary, setDictionary] = useState<DictionaryWord[]>(initialDictionary);
  const sceneText = scene.image === '7.png'
    ? `Tammy makes her way towards the bins, looking for ${searchGoal ?? 'shelter'}.`
    : (IMAGE_TEXT[scene.image] ?? scene.text);
  const isLastScene = sceneIndex === SCENES.length - 1;
  const isExplorationImage = scene.image === '6.png';
  const [combatPhase, setCombatPhase] = useState<CombatPhase>('none');
  const [tammyHp, setTammyHp] = useState(TAMMY_MAX_HP);
  const [mouseHp, setMouseHp] = useState(MOUSE_MAX_HP);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [parryReady, setParryReady] = useState(false);
  const [mouseDefeated, setMouseDefeated] = useState(false);
  const inCombat = combatPhase !== 'none';

  useEffect(() => {
    preloadSceneWindow(SCENES.map(item => assetUrl(`scenes/cat/${item.image}`)), sceneIndex, 12);
  }, [sceneIndex]);
  useEffect(() => {
    SCENES.forEach(item => {
      const line = IMAGE_TEXT[item.image] ?? item.text;
      if (line) preloadGeneratedSpeech(line, 'tammyNarrator');
    });
    preloadGeneratedSpeech('Tammy makes her way towards the bins, looking for food.', 'tammyNarrator');
    preloadGeneratedSpeech('Tammy makes her way towards the bins, looking for shelter.', 'tammyNarrator');
    preloadGeneratedSpeech('It looks like some kind of delivery box. Someone must have put Tammy in there before taking her away. She worries about how worried her mother must be.', 'tammyNarrator');
    preloadGeneratedSpeech('The alleyway is cold and wet. There is no forgiveness in this concrete pavement.', 'tammyNarrator');
    preloadGeneratedSpeech('Tammy looks up to see if anyone is looking down at her. There is no one there, but it still feels like the world is looking down at her.', 'tammyNarrator');
  }, []);
  useEffect(() => {
    if (!sceneText) return;
    speak(sceneText, 'tammyNarrator');
  }, [sceneText, speak]);

  const advance = useCallback(() => {
    startTammyMusic();
    cancel();
    if (isLastScene) return;
    const nextIndex = sceneIndex + 1;
    // Image 6 is a choice point. Keep it as the checkpoint until the player
    // reaches the mouse encounter, so replaying always offers the choice again.
    void save({ phase: isExplorationImage ? 'flashback' : PHASES[nextIndex], learnedWords: initialLearnedWords, inventory: initialInventory, dictionary: initialDictionary, introSeen: true, xp: initialXp, combatCleared: false });
    setSceneIndex(nextIndex);
  }, [cancel, initialDictionary, initialInventory, initialLearnedWords, initialXp, isExplorationImage, isLastScene, onFadeAudio, onMenu, save, sceneIndex, startTammyMusic]);

  const beginSearch = (goal: 'food' | 'shelter') => {
    startTammyMusic();
    cancel();
    setSearchGoal(goal);
    void save({ phase: 'flashback', learnedWords: initialLearnedWords, inventory: initialInventory, dictionary: initialDictionary, introSeen: true, xp: initialXp, combatCleared: false });
    setSceneIndex(6);
  };
  // The original controls remain hidden for this image; retain these aliases
  // so older markup can never interrupt the new hover-only exploration flow.
  const checkFood = (event: React.MouseEvent) => { event.stopPropagation(); beginSearch('food'); };
  const checkShelter = (event: React.MouseEvent) => { event.stopPropagation(); beginSearch('shelter'); };
  const openLesson = (event: React.MouseEvent, word: string, sentence: string, onComplete: () => void) => {
    event.stopPropagation();
    setLesson({ word, sentence, onComplete });
  };
  const unlockLessonWord = (word: string) => {
    setDictionary(current => current.some(item => item.french === word) ? current : [...current, { french: word, english: word }]);
    setXp(current => current + 10);
    setLesson(null);
  };
  const playerStats: PlayerStats = { ...TAMMY_STATS, currentHp: tammyHp, level: Math.max(1, Math.floor(xp / 100) + 1) };
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
    if (scene.image !== '9.png' || mouseDefeated || combatPhase !== 'none') return;
    setTammyHp(TAMMY_MAX_HP); setMouseHp(MOUSE_MAX_HP); setCombatLog([]); setParryReady(false); setCombatPhase('intro');
  }, [combatPhase, mouseDefeated, scene.image]);
  useEffect(() => {
    if (combatPhase !== 'victory') return;
    const timer = window.setTimeout(() => { setMouseDefeated(true); setCombatPhase('none'); void save({ phase: 'cat_10', learnedWords: initialLearnedWords, inventory: initialInventory, dictionary: initialDictionary, introSeen: true, xp: initialXp, combatCleared: true }); setSceneIndex(9); }, 1800);
    return () => window.clearTimeout(timer);
  }, [combatPhase, initialDictionary, initialInventory, initialLearnedWords, initialXp, save]);

  useEffect(() => { const handleKeyDown = (event: KeyboardEvent) => { if (!inCombat && !isExplorationImage && (event.key === 'ArrowRight' || event.key === 'Enter')) { event.preventDefault(); advance(); } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [advance, inCombat, isExplorationImage]);

  return <main className="cat-adventure fixed inset-0 overflow-hidden bg-black text-white" onClick={inCombat || isExplorationImage ? undefined : advance}>
    <SmoothSceneImage src={assetUrl(`scenes/cat/${scene.image}`)} alt={`Tammy in New York — scene ${sceneIndex + 1}`} className={`absolute inset-0 h-full w-full ${scene.image === '6.png' ? 'object-contain' : 'object-cover'}`} draggable={false} />
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/35" />
    <header className="absolute left-0 right-0 top-0 z-10 flex items-start justify-between p-5" onClick={event => event.stopPropagation()}><div><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/60">Adventure</p><h1 className="mt-1 text-lg font-bold tracking-wide">TAMMY: LOST IN NEW YORK</h1></div><div className="flex gap-2"><button onClick={() => { toggle(); onToggleAudio?.(); }} className="rounded-full border border-white/20 bg-black/55 p-2.5 text-white/80 hover:text-white" title={audioMuted ? 'Turn sound on' : 'Mute voices and music'}>{audioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button><button onClick={() => { cancel(); onMenu(); }} className="rounded-full border border-white/20 bg-black/55 px-4 py-2 text-xs uppercase tracking-wider text-white/80 hover:text-white">Menu</button></div></header>
    {scene.image === '6.png' && !inCombat && <><button aria-label="Check for food" onClick={checkFood} className="absolute z-20 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#c4942a] bg-[#c4942a]/20 text-lg shadow-[0_0_22px_rgba(196,148,42,0.8)] transition hover:bg-[#c4942a]/40" style={{ left: '66.6%', top: '53%', transform: 'translate(-50%, -50%)' }}><span className="hotspot-pulse" /><span aria-hidden="true">🍖</span><span className="hotspot-tooltip">Check for food</span></button><button aria-label="Check for shelter" onClick={checkShelter} className="absolute z-20 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#c4942a] bg-[#c4942a]/20 text-lg shadow-[0_0_22px_rgba(196,148,42,0.8)] transition hover:bg-[#c4942a]/40" style={{ left: '90%', top: '49.2%', transform: 'translate(-50%, -50%)' }}><span className="hotspot-pulse" /><span aria-hidden="true">🛖</span><span className="hotspot-tooltip">Check for shelter</span></button></>}
    <div className="cat-xp-hud absolute left-1/2 top-5 z-20 -translate-x-1/2"><div className="cat-xp-hud-row"><span><Zap size={12} />Level {playerStats.level}</span><strong>{xp} XP</strong></div><div className="cat-xp-track"><div style={{ width: `${xp % 100}%` }} /></div></div>
    <aside className="absolute left-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2" onClick={event => event.stopPropagation()}><StatsPanel stats={playerStats} /><InventoryPanel items={initialInventory} /><DictionaryPanel words={dictionary} /></aside>
    {scene.image === '6.png' && !inCombat && <>
      <button aria-label="Cardboard box" onClick={event => openLesson(event, 'cardboard box', 'look at the cardboard box', () => speak('It looks like some kind of delivery box. Someone must have put Tammy in there before taking her away. She worries about how worried her mother must be.', 'tammyNarrator'))} className="tammy-hotspot" style={{ left: '38%', top: '53.1%', width: '2.1%', height: '2.4%' }}><span className="hotspot-tooltip">Cardboard box</span></button>
      <button aria-label="Alleyway" onClick={event => openLesson(event, 'alleyway', 'look at the alleyway', () => speak('The alleyway is cold and wet. There is no forgiveness in this concrete pavement.', 'tammyNarrator'))} className="tammy-hotspot" style={{ left: '69.3%', top: '66.4%', width: '2.8%', height: '3.1%' }}><span className="hotspot-tooltip">Alleyway</span></button>
      <button aria-label="Balcony" onClick={event => openLesson(event, 'balcony', 'look at the balcony', () => speak('Tammy looks up to see if anyone is looking down at her. There is no one there, but it still feels like the world is looking down at her.', 'tammyNarrator'))} className="tammy-hotspot" style={{ left: '74.8%', top: '21.1%', width: '3.3%', height: '4.9%' }}><span className="hotspot-tooltip">Balcony</span></button>
      <button aria-label="Look for food" onClick={event => openLesson(event, 'food', 'look for food', () => beginSearch('food'))} className="tammy-hotspot" style={{ left: '66.6%', top: '53%', width: '2.8%', height: '3.1%' }}><span className="hotspot-tooltip">Look for food</span></button>
      <button aria-label="Look for shelter" onClick={event => openLesson(event, 'shelter', 'look for shelter', () => beginSearch('shelter'))} className="tammy-hotspot" style={{ left: '89.6%', top: '46.7%', width: '5.5%', height: '12.2%' }}><span className="hotspot-tooltip">Look for shelter</span></button>
    </>}
    {lesson && <PreyStyleTammyPanel lesson={lesson} onComplete={unlockLessonWord} onClose={() => setLesson(null)} />}
    {inCombat && <CombatPanel combatPhase={combatPhase as Exclude<CombatPhase, 'none'>} playerHp={tammyHp} playerMaxHp={TAMMY_MAX_HP} enemyHp={mouseHp} enemyMaxHp={MOUSE_MAX_HP} combatLog={combatLog} stats={playerStats} onAttack={attackMouse} onParry={parryMouse} parryReady={parryReady} />}
    {!inCombat && sceneText && <section className="story-dialogue-panel absolute z-10"><div className="story-dialogue-content"><div className="scene-eyebrow">Narrator</div><p className="story-dialogue-text">{sceneText}</p><div className="cop-narration-footer"><span>{isExplorationImage ? "explore the glowing points" : isLastScene ? "click anywhere to finish" : "click anywhere to continue"}</span><button onClick={event => { event.stopPropagation(); speak(sceneText, 'tammyNarrator'); }}><Volume2 size={12} /> Listen</button></div></div></section>}
  </main>;
}
