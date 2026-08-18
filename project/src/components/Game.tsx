import { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX, Zap, BookOpen } from 'lucide-react';
import { GamePhase, HotspotData, CommandResult, DictionaryWord } from '../types';
import { HOTSPOTS, PHASE_NARRATIVES, INITIAL_DICTIONARY } from '../gameData';
import { useSpeech } from '../hooks/useSpeech';
import { useSave } from '../hooks/useSave';
import Hotspot, { HotspotTooltip } from './Hotspot';
import CommandPanel from './CommandPanel';
import WordUnlockPuzzle from './WordUnlockPuzzle';
import InventoryPanel from './InventoryPanel';
import DictionaryPanel from './DictionaryPanel';
import NarrativeBox from './NarrativeBox';
import IntroSequence from './IntroSequence';
import StatsPanel, { PlayerStats } from './StatsPanel';
import CombatPanel from './CombatPanel';
import FlashbackScene from './FlashbackScene';
import ParisStreetScene from './ParisStreetScene';
import { englishTerm } from '../learningLanguage';
import { useLanguage } from '../i18n';
import { assetUrl } from '../utils/assetUrl';

type CombatPhaseType = 'none' | 'intro' | 'player_turn' | 'enemy_turn' | 'victory' | 'cleared';

const ENEMY_MAX_HP = 20;

interface GameProps {
  initialPhase?: GamePhase;
  initialLearnedWords?: string[];
  initialInventory?: string[];
  initialDictionary?: DictionaryWord[];
  initialXp?: number;
  initialCombatCleared?: boolean;
  showIntro?: boolean;
  onMenu: () => void;
  onFadeAudio?: () => void;
}

// ─── XP / Level system ────────────────────────────────────────────
const XP_PER_WORD = 150;
const LEVEL_THRESHOLDS = [0, 500, 1200, 2200];

function getLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

function getLevelProgress(xp: number): { current: number; needed: number; fraction: number } {
  const level = getLevel(xp);
  const levelStart = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level];
  if (nextThreshold === undefined) {
    const span = LEVEL_THRESHOLDS[level - 1] - (LEVEL_THRESHOLDS[level - 2] ?? 0);
    return { current: span, needed: span, fraction: 1 };
  }
  const needed = nextThreshold - levelStart;
  return { current: xp - levelStart, needed, fraction: (xp - levelStart) / needed };
}

// ─── Player stats ─────────────────────────────────────────────────
function computeStats(level: number, currentHp: number): PlayerStats {
  const maxHp = 100 + (level - 1) * 20;
  return {
    maxHp,
    currentHp,
    damageMin: 5 + (level - 1),
    damageMax: 8 + (level - 1) * 2,
    defense: 4 + (level - 1) * 2,
    agility: 5 + (level - 1),
    luck: 3 + (level - 1),
    level,
  };
}
// ──────────────────────────────────────────────────────────────────

function sceneImage(phase: GamePhase, combatPhase: CombatPhaseType): string {
  if (combatPhase === 'intro' || combatPhase === 'player_turn' || combatPhase === 'enemy_turn') {
    return assetUrl('man_in_g.png');
  }
  if (combatPhase === 'victory' || combatPhase === 'cleared') return assetUrl('man_in_g_on_floor.png');
  if (phase === 'tied' || phase === 'has_knife') return assetUrl('cafe_room.png');
  return assetUrl('ChatGPT_Image_Jun_14,_2026,_05_36_59_PM.png');
}

export default function Game({
  initialPhase = 'tied',
  initialLearnedWords = [],
  initialInventory = [],
  initialDictionary = [],
  initialXp = 0,
  initialCombatCleared = false,
  showIntro = false,
  onMenu,
  onFadeAudio,
}: GameProps) {
  const { isChinese } = useLanguage();
  const [phase, setPhase] = useState<GamePhase>(initialPhase);
  const [learnedWords, setLearnedWords] = useState<Set<string>>(new Set(initialLearnedWords));
  const [inventory, setInventory] = useState<string[]>(initialInventory);
  const [dictionary, setDictionary] = useState<DictionaryWord[]>(() => {
    const map = new Map<string, string>();
    INITIAL_DICTIONARY.forEach((w) => map.set(w.french, w.english));
    initialDictionary.forEach((w) => map.set(w.french, w.english));
    return Array.from(map.entries()).map(([french, english]) => ({ french, english }));
  });
  const [explainedWords, setExplainedWords] = useState<Set<string>>(new Set());
  const [introActive, setIntroActive] = useState(showIntro);
  const [activeHotspot, setActiveHotspot] = useState<HotspotData | null>(null);
  const [hoveredHotspot, setHoveredHotspot] = useState<HotspotData | null>(null);
  const [activePanel, setActivePanel] = useState<'puzzle' | 'command' | null>(null);
  const [narrative, setNarrative] = useState<{ text: string; key: number } | null>(null);
  const [xp, setXp] = useState(initialXp);
  const [xpPopup, setXpPopup] = useState<{ amount: number; key: number } | null>(null);
  const [levelUpBanner, setLevelUpBanner] = useState<{ level: number; key: number } | null>(null);

  // Combat state
  const [combatPhase, setCombatPhase] = useState<CombatPhaseType>('none');
  const [playerHp, setPlayerHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState(ENEMY_MAX_HP);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [combatCleared, setCombatCleared] = useState(initialCombatCleared);

  const [chapterDone, setChapterDone] = useState(false);

  const [debugMode, setDebugMode] = useState(false);
  const [debugPoints, setDebugPoints] = useState<{ x: number; y: number }[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  const narrativeKeyRef = useRef(0);
  const popupKeyRef = useRef(0);
  const initialPhaseRef = useRef(initialPhase);
  const mountedRef = useRef(false);
  const currentLevelRef = useRef(getLevel(initialXp));
  const keyBufferRef = useRef('');
  const keyBufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { speak, cancel, enabled: speechEnabled, toggle: toggleSpeech } = useSpeech();
  const { save } = useSave();

  // Keep level ref in sync
  const currentLevel = getLevel(xp);
  useEffect(() => { currentLevelRef.current = currentLevel; }, [currentLevel]);

  // Jump to a specific scene — used by /1 /2 /3 shortcuts
  const jumpToScene = useCallback((scene: 1 | 2 | 3) => {
    cancel();
    setActiveHotspot(null);
    setActivePanel(null);
    setNarrative(null);
    setChapterDone(false);
    if (scene === 1) {
      setPhase('tied');
      setLearnedWords(new Set());
      setInventory([]);
      setDictionary(INITIAL_DICTIONARY);
      setCombatPhase('none');
      setCombatCleared(false);
      setPlayerHp(100);
      setEnemyHp(ENEMY_MAX_HP);
      setCombatLog([]);
      const text = PHASE_NARRATIVES['tied'];
      narrativeKeyRef.current += 1;
      setNarrative({ text, key: narrativeKeyRef.current });
      speak(text, 'male');
    } else if (scene === 2) {
      setPhase('flashback');
    } else {
      setPhase('paris_street');
    }
  }, [cancel, speak]);

  // Global key buffer — detects /1 /2 /3 and ## typed anywhere, even inside inputs
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Accumulate printable chars in buffer (max length 3)
      if (e.key.length === 1) {
        keyBufferRef.current = (keyBufferRef.current + e.key).slice(-3);
        if (keyBufferTimerRef.current) clearTimeout(keyBufferTimerRef.current);
        keyBufferTimerRef.current = setTimeout(() => { keyBufferRef.current = ''; }, 2000);

        const buf = keyBufferRef.current;
        if (buf.endsWith('/1')) { 
          e.preventDefault();
          keyBufferRef.current = ''; 
          jumpToScene(1); 
        }
        else if (buf.endsWith('/2')) { 
          e.preventDefault();
          keyBufferRef.current = ''; 
          jumpToScene(2); 
        }
        else if (buf.endsWith('/3')) { 
          e.preventDefault();
          keyBufferRef.current = ''; 
          jumpToScene(3); 
        }
        else if (buf.endsWith('##')) { 
          e.preventDefault();
          keyBufferRef.current = ''; 
          setChapterDone(true); 
        }
      }
    };
    // Use capture mode to intercept events before they reach input elements
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [jumpToScene]);

  // Right Arrow is the player-friendly progression shortcut: it advances to
  // the next chapter state using the successful path rather than requiring a
  // debug command or repeated object clicks.
  useEffect(() => {
    const skip = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowRight') return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      event.preventDefault();
      if (phase === 'tied') jumpToScene(2);
      else if (phase === 'flashback') jumpToScene(3);
      else if (phase === 'paris_street') setChapterDone(true);
    };
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [phase, jumpToScene]);

  // Debug mode toggle — # key (ignored when typing in an input)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '#') return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      setDebugMode(d => !d);
      setDebugPoints([]);
      setMousePos(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const pctFromEvent = useCallback((e: React.MouseEvent): { x: number; y: number } | null => {
    if (!sceneRef.current) return null;
    const rect = sceneRef.current.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10,
      y: Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10,
    };
  }, []);

  const handleSceneMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!debugMode) return;
    const pos = pctFromEvent(e);
    if (pos) setMousePos(pos);
  }, [debugMode, pctFromEvent]);

  const handleDebugClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const pos = pctFromEvent(e);
    if (pos) setDebugPoints(prev => [...prev, pos]);
  }, [pctFromEvent]);

  // Initial narrative
  useEffect(() => {
    if (!showIntro) {
      const text = PHASE_NARRATIVES[initialPhaseRef.current];
      narrativeKeyRef.current += 1;
      setNarrative({ text, key: narrativeKeyRef.current });
      speak(text, 'male');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on state changes
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    save({
      phase,
      learnedWords: Array.from(learnedWords),
      inventory,
      dictionary,
      introSeen: !showIntro || !introActive,
      xp,
      combatCleared,
    });
  }, [phase, learnedWords, inventory, dictionary, xp, combatCleared, save, showIntro, introActive]);

  // ─── XP helpers ────────────────────────────────────────────────
  const awardXp = useCallback((amount: number) => {
    setXp((prev) => {
      const next = prev + amount;
      const prevLevel = getLevel(prev);
      const nextLevel = getLevel(next);
      if (nextLevel > prevLevel) {
        popupKeyRef.current += 1;
        const key = popupKeyRef.current;
        setLevelUpBanner({ level: nextLevel, key });
        setTimeout(() => setLevelUpBanner(null), 3500);
      }
      return next;
    });
    if (amount > 0) {
      popupKeyRef.current += 1;
      const key = popupKeyRef.current;
      setXpPopup({ amount, key });
      setTimeout(() => setXpPopup(null), 2200);
    }
  }, []);

  // ─── Combat effects ────────────────────────────────────────────

  // Intro: speak lines then start combat
  useEffect(() => {
    if (combatPhase !== 'intro') return;
    const t: ReturnType<typeof setTimeout>[] = [];
    t.push(setTimeout(() => speak("Ehi! È sveglio! Uccidetelo!", 'female'), 800));
    t.push(setTimeout(() => speak("I don't understand.", 'character'), 4000));
    t.push(setTimeout(() => setCombatPhase('player_turn'), 6200));
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combatPhase]);

  // Enemy turn: attack after short delay
  useEffect(() => {
    if (combatPhase !== 'enemy_turn') return;
    const timer = setTimeout(() => {
      const stats = computeStats(currentLevelRef.current, 0);
      const rawDmg = Math.floor(Math.random() * 8) + 8;
      const dmg = Math.max(1, rawDmg - stats.defense);
      setCombatLog(prev => [...prev.slice(-4), `The stranger strikes you for ${dmg} damage!`]);
      setPlayerHp(prev => Math.max(1, prev - dmg));
      setCombatPhase('player_turn');
    }, 1000);
    return () => clearTimeout(timer);
  }, [combatPhase]);

  // Victory: award XP, then transition back to normal game
  useEffect(() => {
    if (combatPhase !== 'victory') return;
    awardXp(200);
    const timer = setTimeout(() => {
      setCombatPhase('cleared');
      setCombatCleared(true);
      const text = 'The stranger is down. The café falls silent. You are alone again — find a way out.';
      narrativeKeyRef.current += 1;
      setNarrative({ text, key: narrativeKeyRef.current });
      speak(text, 'male');
    }, 3500);
    return () => clearTimeout(timer);
  }, [combatPhase, awardXp, speak]);

  // ─── Combat actions ───────────────────────────────────────────

  const handleAttack = useCallback(() => {
    if (combatPhase !== 'player_turn') return;
    const stats = computeStats(currentLevelRef.current, playerHp);
    const dmg = Math.floor(Math.random() * (stats.damageMax - stats.damageMin + 1)) + stats.damageMin;
    const newEnemyHp = Math.max(0, enemyHp - dmg);
    setCombatLog(prev => [...prev.slice(-4), `You hit the stranger for ${dmg} damage!`]);
    setEnemyHp(newEnemyHp);
    if (newEnemyHp <= 0) {
      setCombatLog(prev => [...prev.slice(-4), 'The stranger collapses to the floor.']);
      setCombatPhase('victory');
    } else {
      setCombatPhase('enemy_turn');
    }
  }, [combatPhase, playerHp, enemyHp]);

  const initiateCombat = useCallback(() => {
    cancel();
    setNarrative(null);
    setActiveHotspot(null);
    setActivePanel(null);
    const stats = computeStats(currentLevelRef.current, 0);
    setPlayerHp(stats.maxHp);
    setEnemyHp(ENEMY_MAX_HP);
    setCombatLog([]);
    setCombatPhase('intro');
  }, [cancel]);

  // ─── Normal game callbacks ─────────────────────────────────────

  const addToDictionary = useCallback((french: string, english: string) => {
    setDictionary(prev => {
      if (prev.some(w => w.french === french)) return prev;
      return [...prev, { french, english }];
    });
  }, []);

  const markWordExplained = useCallback((french: string) => {
    setExplainedWords(prev => {
      if (prev.has(french)) return prev;
      return new Set([...prev, french]);
    });
  }, []);

  const showNarrative = useCallback((text: string) => {
    cancel();
    narrativeKeyRef.current += 1;
    setNarrative({ text, key: narrativeKeyRef.current });
    speak(text, 'male');
  }, [speak, cancel]);

  const handleIntroComplete = useCallback(() => {
    setIntroActive(false);
    onFadeAudio?.();
    const text = PHASE_NARRATIVES['tied'];
    narrativeKeyRef.current += 1;
    setNarrative({ text, key: narrativeKeyRef.current });
    speak(text, 'male');
  }, [speak, onFadeAudio]);

  const handleHotspotClick = useCallback((hotspot: HotspotData) => {
    // Trigger combat on first interaction after being freed
    if (phase === 'freed' && !combatCleared && combatPhase === 'none') {
      initiateCombat();
      return;
    }
    setLearnedWords(prev => new Set([...prev, hotspot.id]));
    setActiveHotspot(hotspot);
    const isLearned = dictionary.some(w => w.french.toLowerCase() === hotspot.frenchName.toLowerCase());
    setActivePanel(isLearned ? 'command' : 'puzzle');
    if (!isLearned) {
      const fullName = englishTerm(hotspot.frenchName);
      speak(fullName, 'female');
    }
  }, [phase, combatCleared, combatPhase, initiateCombat, speak, dictionary]);

  const handlePuzzleComplete = useCallback((accuracy: number) => {
    const earned = Math.round((accuracy / 100) * XP_PER_WORD);
    awardXp(earned);
    setActivePanel('command');
  }, [awardXp]);

  const handleCommandResult = useCallback((result: CommandResult) => {
    setActiveHotspot(null);
    if (result.inventoryAdd) setInventory(prev => [...prev, result.inventoryAdd!]);
    if (result.inventoryRemove) setInventory(prev => prev.filter(i => i !== result.inventoryRemove));
    if (result.hpChange) setPlayerHp(prev => Math.max(1, prev + result.hpChange!));
    if (result.transitionTo) {
      setPhase(result.transitionTo);
      showNarrative(result.narrative + '\n\n' + PHASE_NARRATIVES[result.transitionTo]);
    } else {
      const prefix = result.typoWarning ? `[${result.typoWarning}]\n` : '';
      showNarrative(prefix + result.narrative);
    }
  }, [showNarrative]);

  const handleRestart = useCallback(() => {
    setPhase('tied');
    setLearnedWords(new Set());
    setInventory([]);
    setDictionary(INITIAL_DICTIONARY);
    setExplainedWords(new Set());
    setActiveHotspot(null);
    setIntroActive(false);
    setXp(0);
    setCombatPhase('none');
    setCombatCleared(false);
    setPlayerHp(100);
    setEnemyHp(ENEMY_MAX_HP);
    setCombatLog([]);
    const text = PHASE_NARRATIVES['tied'];
    narrativeKeyRef.current += 1;
    setNarrative({ text, key: narrativeKeyRef.current });
    speak(text, 'male');
  }, [speak]);

  // ─── Render ────────────────────────────────────────────────────

  // Chapter end
  if (chapterDone) {
    return <ChapterEndScreen onMenu={() => { cancel(); onMenu(); }} />;
  }

  // Paris street scene
  if (phase === 'paris_street') {
    return (
      <ParisStreetScene
        playerLevel={currentLevel}
        xp={xp}
        dictionary={dictionary}
        onAddToDictionary={addToDictionary}
        onAwardXp={awardXp}
        onSpendXp={(amount) => setXp(prev => Math.max(0, prev - amount))}
        onCommandResult={(text) => { void text; }}
        onMoveOn={() => setChapterDone(true)}
        onMenu={() => { cancel(); onMenu(); }}
        speak={(text, voice) => speak(text, voice || 'male')}
        cancel={cancel}
      />
    );
  }

  const visibleHotspots = HOTSPOTS.filter(h =>
    h.visiblePhases.includes(phase) && (!h.requiresCombatCleared || combatCleared)
  ).sort((a, b) => {
    // Render larger hotspots first so smaller ones (like cocaine over cadavre) win on hover overlap
    const areaA = a.region.width * a.region.height;
    const areaB = b.region.width * b.region.height;
    return areaB - areaA;
  });
  const currentImage = sceneImage(phase, combatPhase);
  const levelProgress = getLevelProgress(xp);
  const inCombat = combatPhase === 'intro' || combatPhase === 'player_turn' || combatPhase === 'enemy_turn' || combatPhase === 'victory';
  const playerStats = computeStats(currentLevel, playerHp);

  return (
    <div className="fixed inset-0 bg-[#0d0804] flex items-center justify-center overflow-hidden">
      <div
        ref={sceneRef}
        className="relative"
        style={{ height: '100vh', aspectRatio: '1 / 1', maxWidth: '100vw', maxHeight: '100vh' }}
        onMouseMove={handleSceneMouseMove}
      >
        {/* Scene image */}
        <img
          key={currentImage}
          src={currentImage}
          alt="Florentine café scene"
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none transition-opacity duration-700"
          draggable={false}
        />

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(13,8,4,0.6) 100%)' }}
        />

        {/* Hotspots — only when not in active combat */}
        {!introActive && !inCombat &&
          visibleHotspots.map(hotspot => (
            <Hotspot
              key={hotspot.id}
              hotspot={hotspot}
              isActive={activeHotspot?.id === hotspot.id}
              onClick={() => handleHotspotClick(hotspot)}
              onHover={(hovered) => setHoveredHotspot(hovered ? hotspot : null)}
            />
          ))}

        {/* Tooltip for hovered hotspot — rendered at scene level for correct positioning */}
        {!introActive && !inCombat && hoveredHotspot && hoveredHotspot.labelPosition && (
          <HotspotTooltip hotspot={hoveredHotspot} />
        )}

        {/* Debug overlay — toggle with # key */}
        {debugMode && (() => {
          const hotspotColors = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#6366f1'];
          const xs = debugPoints.map(p => p.x);
          const ys = debugPoints.map(p => p.y);
          const bbox = debugPoints.length >= 2 ? {
            x: Math.min(...xs),
            y: Math.min(...ys),
            w: Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10,
            h: Math.round((Math.max(...ys) - Math.min(...ys)) * 10) / 10,
          } : null;

          return (
            <div className="absolute inset-0 z-50">
              {/* Click-capture layer */}
              <div
                className="absolute inset-0"
                style={{ cursor: 'crosshair', zIndex: 1 }}
                onClick={handleDebugClick}
                onMouseMove={handleSceneMouseMove}
              />

              {/* Existing hotspot boxes */}
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
                {HOTSPOTS.map((h, i) => {
                  const col = hotspotColors[i % hotspotColors.length];
                  return (
                    <div key={h.id} style={{
                      position: 'absolute',
                      left: `${h.region.x}%`, top: `${h.region.y}%`,
                      width: `${h.region.width}%`, height: `${h.region.height}%`,
                      border: `1px solid ${col}`, background: `${col}18`,
                    }}>
                      <div style={{ background: col, color: '#000', fontSize: '8px', fontFamily: 'monospace', padding: '1px 3px', lineHeight: 1.3 }}>
                        <strong>{h.id}</strong> x:{h.region.x} y:{h.region.y} w:{h.region.width} h:{h.region.height}
                      </div>
                    </div>
                  );
                })}

                {/* SVG polygon connecting clicked points */}
                {debugPoints.length >= 2 && (
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                    viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polygon
                      points={debugPoints.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="rgba(250,204,21,0.18)"
                      stroke="#facc15"
                      strokeWidth="0.4"
                      strokeDasharray="1.5,0.8"
                    />
                  </svg>
                )}

                {/* Bounding box */}
                {bbox && (
                  <div style={{
                    position: 'absolute',
                    left: `${bbox.x}%`, top: `${bbox.y}%`,
                    width: `${bbox.w}%`, height: `${bbox.h}%`,
                    border: '2px dashed #facc15',
                    background: 'rgba(250,204,21,0.06)',
                    boxSizing: 'border-box',
                  }}>
                    <div style={{ position: 'absolute', bottom: '100%', left: 0, background: '#facc15', color: '#000', fontSize: '9px', fontFamily: 'monospace', fontWeight: 'bold', padding: '1px 4px', whiteSpace: 'nowrap' }}>
                      x:{bbox.x} y:{bbox.y} w:{bbox.w} h:{bbox.h}
                    </div>
                  </div>
                )}

                {/* Clicked point markers */}
                {debugPoints.map((pt, i) => (
                  <div key={i} style={{
                    position: 'absolute',
                    left: `${pt.x}%`, top: `${pt.y}%`,
                    transform: 'translate(-50%,-50%)',
                    width: 18, height: 18,
                    borderRadius: '50%',
                    background: '#facc15',
                    border: '2px solid #000',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '8px', fontWeight: 'bold', color: '#000', fontFamily: 'monospace',
                  }}>
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Info panel — top-left to stay out of the way */}
              <div className="absolute top-2 left-2 pointer-events-auto" style={{ zIndex: 3 }}>
                <div style={{ background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(250,204,21,0.5)', borderRadius: 12, padding: '10px 14px', fontFamily: 'monospace', fontSize: '11px', color: '#fff', minWidth: 300, maxWidth: 420 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color: '#facc15', fontWeight: 'bold', fontSize: 12 }}>DEBUG MODE</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>Press # to exit</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                    Image: <span style={{ color: '#fff' }}>{currentImage.split('/').pop()}</span>
                  </div>
                  {mousePos && (
                    <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                      Cursor: <span style={{ color: '#86efac' }}>x:{mousePos.x}% y:{mousePos.y}%</span>
                    </div>
                  )}
                  <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontSize: 10 }}>
                    Click points around an object to draw its area
                  </div>
                  {debugPoints.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 6, marginBottom: 6 }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
                        Points ({debugPoints.length}): {debugPoints.map((p, i) => (
                          <span key={i} style={{ color: '#facc15' }}>[{p.x},{p.y}] </span>
                        ))}
                      </div>
                      {bbox && (
                        <div style={{ background: 'rgba(250,204,21,0.15)', border: '1px solid rgba(250,204,21,0.4)', borderRadius: 6, padding: '5px 8px', marginTop: 4 }}>
                          <div style={{ color: '#facc15', fontWeight: 'bold', marginBottom: 2 }}>Bounding Box:</div>
                          <div style={{ color: '#fff', fontSize: 12 }}>x:{bbox.x} y:{bbox.y} width:{bbox.w} height:{bbox.h}</div>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setDebugPoints([])}
                    style={{ background: 'rgba(239,68,68,0.7)', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 10, cursor: 'pointer' }}
                  >
                    Clear Points
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 pointer-events-none">
          <div className="flex items-start justify-between gap-3">
            {/* Title + phase */}
            <div className="min-w-0">
              <h1 className="text-[#e8d5a3] text-base font-bold font-display leading-none">
                TaleTalk
              </h1>
              <div className="text-[#c4b080] text-xs uppercase tracking-widest mt-0.5">
                {phase === 'tied' && 'Hands bound'}
                {phase === 'has_knife' && 'Armed'}
                {(phase === 'freed' || phase === 'has_key') && !inCombat && 'Hands free'}
                {inCombat && <span className="text-red-400">Combat</span>}
                {phase === 'has_key' && !inCombat && ' — Key found'}
                {phase === 'escaped' && 'Free!'}
              </div>
            </div>

            {/* XP bar only — HP bar is shown in combat */}
            <div className="flex-1 max-w-[220px] select-none pt-1">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Zap size={11} className="text-[#c4b080]" />
                  <span className="text-[#c4b080] text-[10px] font-bold uppercase tracking-wider">LVL {currentLevel}</span>
                </div>
                <div className="flex-1 h-2 bg-[#1a1208] rounded-full border border-[#8b6914]/40 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#c4942a] to-[#e8d5a3] rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, levelProgress.fraction * 100)}%` }}
                  />
                </div>
                <span className="text-[#8b6914]/80 text-[9px] flex-shrink-0 tabular-nums">
                  {levelProgress.current}/{levelProgress.needed}
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 pointer-events-auto flex-shrink-0">
              <button
                onClick={toggleSpeech}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#0d0804]/80 border border-[#8b6914]/40 hover:border-[#c4942a]/60 text-[#c4b080] hover:text-[#c4942a] transition-all"
                title={speechEnabled ? 'Mute voices' : 'Unmute voices'}
              >
                {speechEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              <button
                onClick={() => { cancel(); onMenu(); }}
                className="px-3 py-1.5 rounded-xl text-xs bg-[#0d0804]/80 border border-[#8b6914]/40 hover:border-[#c4942a]/60 text-[#c4b080] hover:text-[#c4942a] transition-all uppercase tracking-wider"
              >
                {isChinese ? '菜单' : 'Menu'}
              </button>
            </div>
          </div>
        </div>

        {/* XP popup */}
        {xpPopup && (
          <div
            key={xpPopup.key}
            className="absolute top-14 left-1/2 z-30 pointer-events-none animate-xp-popup"
            style={{ transform: 'translateX(-50%)' }}
          >
            <div className="bg-[#2a1e00]/80 border border-[#c4942a]/60 rounded-lg px-3 py-1.5 backdrop-blur-sm">
              <span className="text-[#e8d5a3] text-sm font-bold">+{xpPopup.amount} XP</span>
            </div>
          </div>
        )}

        {/* Level up banner */}
        {levelUpBanner && (
          <div
            key={levelUpBanner.key}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
          >
            <div className="bg-[#0d0804]/90 border-2 border-[#c4942a] rounded-2xl px-8 py-4 text-center shadow-2xl backdrop-blur-md">
              <div className="text-[#c4b080] text-xs uppercase tracking-widest mb-1">{isChinese ? '升级！' : 'Level Up!'}</div>
              <div className="text-[#e8d5a3] text-3xl font-bold">{isChinese ? `等级 ${levelUpBanner.level}` : `Level ${levelUpBanner.level}`}</div>
              {levelUpBanner.level === 2 && (
                <div className="text-[#d4c090] text-xs mt-2">You can now search the coat.</div>
              )}
            </div>
          </div>
        )}

        {/* Narrative box — hidden during combat */}
        {narrative && !introActive && !inCombat && (
          <NarrativeBox
            key={narrative.key}
            text={narrative.text}
            dictionary={dictionary}
            explainedWords={explainedWords}
            onSkip={() => cancel()}
            onDone={() => { cancel(); setNarrative(null); }}
            onLearnWord={addToDictionary}
            onExplainWord={markWordExplained}
            onSpeak={text => speak(text, 'character')}
          />
        )}

        {/* Left sidebar */}
        {!introActive && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
            <StatsPanel stats={playerStats} />
            <InventoryPanel items={inventory} />
            <DictionaryPanel words={dictionary} />
          </div>
        )}

        {/* Puzzle panel */}
        {activeHotspot && activePanel === 'puzzle' && !inCombat && (
          <WordUnlockPuzzle
            hotspot={activeHotspot}
            dictionary={dictionary}
            isFirstWord={dictionary.length === 0}
            onComplete={handlePuzzleComplete}
            onClose={() => { setActiveHotspot(null); setActivePanel(null); }}
            onAddToDictionary={addToDictionary}
            onSpeak={text => speak(text, 'female')}
          />
        )}

        {/* Command panel */}
        {activeHotspot && activePanel === 'command' && !inCombat && (
          <CommandPanel
            hotspot={activeHotspot}
            phase={phase}
            playerLevel={currentLevel}
            dictionary={dictionary}
            onResult={handleCommandResult}
            onClose={() => { setActiveHotspot(null); setActivePanel(null); }}
            onAddToDictionary={addToDictionary}
            onSpeak={(text, voice) => speak(text, voice || 'female')}
          />
        )}

        {/* Combat panel */}
        {inCombat && (
          <CombatPanel
            combatPhase={combatPhase as 'intro' | 'player_turn' | 'enemy_turn' | 'victory'}
            playerHp={playerHp}
            playerMaxHp={playerStats.maxHp}
            enemyHp={enemyHp}
            enemyMaxHp={ENEMY_MAX_HP}
            combatLog={combatLog}
            stats={playerStats}
            onAttack={handleAttack}
          />
        )}

        {/* Intro sequence overlay */}
        {introActive && (
          <IntroSequence
            onComplete={handleIntroComplete}
            speak={speak}
            cancel={cancel}
          />
        )}
      </div>

      {/* Flashback scene — shown when escaped or in flashback phase */}
      {(phase === 'escaped' || phase === 'flashback') && (
        <FlashbackScene
          onComplete={() => setPhase('paris_street')}
          onAwardXp={awardXp}
          speak={speak}
          cancel={cancel}
          onMenu={() => { cancel(); onMenu(); }}
          xp={xp}
          playerLevel={currentLevel}
        />
      )}
    </div>
  );
}

function ChapterEndScreen({ onMenu }: { onMenu: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-[#0a0604]/97 flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-[#8b6914]/15 border-2 border-[#c4942a]/60 flex items-center justify-center shadow-[0_0_30px_rgba(196,148,42,0.3)]">
            <BookOpen size={26} className="text-[#c4942a]" />
          </div>
        </div>
        <h1 className="font-display text-3xl font-bold text-[#e8d5a3] mb-2">Fine del Capitolo I</h1>
        <p className="text-[#8b6914] text-sm mb-1">End of Chapter One</p>
        <p className="text-[#6a4a2a] text-sm leading-relaxed mb-8 max-w-sm mx-auto">
          You walk deeper into Florence. The city holds its breath. Your memory is returning — fragment by fragment. Chapter II is coming soon.
        </p>
        <div className="bg-[#1a1008] border border-[#8b6914]/25 rounded-2xl p-4 mb-6">
          <p className="text-[#a08060] text-xs uppercase tracking-widest">Capitolo II — Prossimamente</p>
          <p className="text-[#6a4a2a] text-sm mt-1">Chapter II — Coming soon</p>
        </div>
        <button
          onClick={onMenu}
          className="border border-[#8b6914]/40 hover:border-[#c4942a]/60 text-[#c4b080] hover:text-[#c4942a] py-3 px-8 rounded-xl transition-all duration-200 text-sm uppercase tracking-wider"
        >
          Return to Menu
        </button>
      </div>
    </div>
  );
}
