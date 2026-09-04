import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Lock, ArrowRight, Zap, Volume2, VolumeX } from 'lucide-react';
import { DictionaryWord, HotspotData } from '../types';
import { STREET_HOTSPOTS } from '../gameData';
import Hotspot, { HotspotTooltip } from './Hotspot';
import WordUnlockPuzzle from './WordUnlockPuzzle';
import CommandPanel from './CommandPanel';
import FemmeDuMarcheDialogue from './FemmeDuMarcheDialogue';
import { englishTerm } from '../learningLanguage';
import { useLanguage } from '../i18n';
import { assetUrl } from '../utils/assetUrl';
import SmoothSceneImage from './SmoothSceneImage';

interface ParisStreetSceneProps {
  playerLevel: number;
  xp: number;
  dictionary: DictionaryWord[];
  onAddToDictionary: (french: string, english: string) => void;
  onAwardXp: (amount: number) => void;
  onSpendXp: (amount: number) => void;
  onCommandResult: (narrative: string) => void;
  onMoveOn: () => void;
  onMenu: () => void;
  speak: (text: string, voice?: 'male' | 'female' | 'character') => void;
  cancel: () => void;
}

interface LevelProgress { current: number; needed: number; fraction: number; }

function computeLevelProgress(xp: number, level: number): LevelProgress {
  const base = 500;
  const needed = base + (level - 1) * 200;
  const prev = level > 1 ? Array.from({ length: level - 1 }, (_, i) => base + i * 200).reduce((a, b) => a + b, 0) : 0;
  const current = xp - prev;
  return { current: Math.max(0, current), needed, fraction: Math.max(0, Math.min(1, current / needed)) };
}

const XP_PER_WORD = 150;

function isWordLearned(frenchName: string, dictionary: DictionaryWord[]) {
  return dictionary.some(w => w.french.toLowerCase() === frenchName.toLowerCase());
}

export default function ParisStreetScene({
  playerLevel,
  xp,
  dictionary,
  onAddToDictionary,
  onAwardXp,
  onSpendXp,
  onCommandResult,
  onMoveOn,
  onMenu,
  speak,
  cancel,
}: ParisStreetSceneProps) {
  const { isChinese } = useLanguage();
  const [activeHotspot, setActiveHotspot] = useState<HotspotData | null>(null);
  const [hoveredHotspot, setHoveredHotspot] = useState<HotspotData | null>(null);
  const [activePanel, setActivePanel] = useState<'puzzle' | 'command' | 'conversation' | 'library_locked' | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [debugPoints, setDebugPoints] = useState<{ x: number; y: number }[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [inventory, setInventory] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const levelProgress = computeLevelProgress(xp, playerLevel);

  const closePanel = useCallback(() => {
    setActiveHotspot(null);
    setActivePanel(null);
  }, []);

  // Debug mode — exactly like Scene 1
  const pctFromEvent = useCallback((e: React.MouseEvent): { x: number; y: number } | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
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

  // Debug shortcut: ## to skip to end
  useEffect(() => {
    const keyBuffer = { current: '' };
    const handler = (e: KeyboardEvent) => {
      if (e.key.length === 1) {
        keyBuffer.current = (keyBuffer.current + e.key).slice(-2);
        if (keyBuffer.current.endsWith('##')) {
          keyBuffer.current = '';
          cancel();
          onMoveOn();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cancel, onMoveOn]);

  useEffect(() => {
    const skip = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowRight') return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      event.preventDefault();
      cancel();
      onMoveOn();
    };
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [cancel, onMoveOn]);

  const handleHotspotClick = useCallback((hotspot: HotspotData) => {
    cancel();
    setNarrative(null);

    if (hotspot.id === 'librairie') {
      setActiveHotspot(hotspot);
      setActivePanel('library_locked');
      return;
    }

    if (hotspot.id === 'femme_marche') {
      setActiveHotspot(hotspot);
      setActivePanel('conversation');
      return;
    }

    setActiveHotspot(hotspot);
    const learned = isWordLearned(hotspot.frenchName, dictionary);
    setActivePanel(learned ? 'command' : 'puzzle');
    if (!learned) {
      const fullName = englishTerm(hotspot.frenchName);
      speak(fullName, 'female');
    }
  }, [cancel, dictionary, speak]);

  const handlePuzzleComplete = useCallback((accuracy: number) => {
    const earned = Math.round((accuracy / 100) * XP_PER_WORD);
    onAwardXp(earned);
    setActivePanel('command');
  }, [onAwardXp]);

  const handleCommandResult = useCallback((result: { narrative: string; inventoryAdd?: string; inventoryRemove?: string; hpChange?: number; typoWarning?: string }) => {
    setActiveHotspot(null);
    setActivePanel(null);
    if (result.inventoryAdd) setInventory(prev => [...prev, result.inventoryAdd!]);
    const prefix = result.typoWarning ? `[${result.typoWarning}]\n` : '';
    const text = prefix + result.narrative;
    setNarrative(text);
    onCommandResult(text);
  }, [onCommandResult]);

  const handleAddInventory = useCallback((item: string) => {
    setInventory(prev => [...prev, item]);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0d0804] flex items-center justify-center overflow-hidden">
      <div
        ref={containerRef}
        className="relative h-full w-full"
        onMouseMove={handleSceneMouseMove}
      >
        {/* Scene image */}
        <SmoothSceneImage
          src={assetUrl('Gemini_Generated_Image_a625ema625ema625.png')}
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/8248092/pexels-photo-8248092.jpeg?auto=compress&cs=tinysrgb&w=1920'; (e.target as HTMLImageElement).onerror = null; }}
          alt="Florence street"
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          draggable={false}
        />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(13,8,4,0.55) 100%)' }} />

        {/* Top bar — EXACT same as Scene 1 */}
        <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 pointer-events-none">
          <div className="flex items-start justify-between gap-3">
            {/* Title + phase */}
            <div className="min-w-0">
              <h1 className="text-[#e8d5a3] text-base font-bold font-display leading-none">
                TaleTalk
              </h1>
              <div className="text-[#c4b080] text-xs uppercase tracking-widest mt-0.5">
                {isChinese ? '佛罗伦萨街道 · 场景 3' : 'Florence Street · Scene 3'}
              </div>
            </div>

            {/* XP bar — EXACT same as Scene 1 */}
            <div className="flex-1 max-w-[220px] select-none pt-1">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Zap size={11} className="text-[#c4b080]" />
                  <span className="text-[#c4b080] text-[10px] font-bold uppercase tracking-wider">LVL {playerLevel}</span>
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
                onClick={() => { cancel(); onMenu(); }}
                className="px-3 py-1.5 rounded-xl text-xs bg-[#0d0804]/80 border border-[#8b6914]/40 hover:border-[#c4942a]/60 text-[#c4b080] hover:text-[#c4942a] transition-all uppercase tracking-wider"
              >
                {isChinese ? '菜单' : 'Menu'}
              </button>
            </div>
          </div>
        </div>

        {/* Debug overlay — EXACT same as Scene 1 */}
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
                {STREET_HOTSPOTS.map((h, i) => {
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

              {/* Info panel — top-left */}
              <div className="absolute top-2 left-2 pointer-events-auto" style={{ zIndex: 3 }}>
                <div style={{ background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(250,204,21,0.5)', borderRadius: 12, padding: '10px 14px', fontFamily: 'monospace', fontSize: '11px', color: '#fff', minWidth: 300, maxWidth: 420 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color: '#facc15', fontWeight: 'bold', fontSize: 12 }}>DEBUG MODE</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>Press # to exit</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                    Image: <span style={{ color: '#fff' }}>Gemini_Generated_Image_a625ema625ema625.png</span>
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

        {/* Hotspots */}
        {STREET_HOTSPOTS.map(hotspot => (
          <Hotspot
            key={hotspot.id}
            hotspot={hotspot}
            isActive={activeHotspot?.id === hotspot.id}
            onClick={() => handleHotspotClick(hotspot)}
            onHover={hovered => setHoveredHotspot(hovered ? hotspot : null)}
          />
        ))}

        {hoveredHotspot?.labelPosition && <HotspotTooltip hotspot={hoveredHotspot} />}

        {/* Level-locked librairie tooltip */}
        {hoveredHotspot?.id === 'librairie' && !hoveredHotspot.labelPosition && (
          <div className="absolute pointer-events-none" style={{ top: '15%', right: '5%', zIndex: 30 }}>
            <div className="bg-[#0d0804]/95 border border-[#8b6914]/50 text-[#e8d5a3] text-xs px-3 py-2 rounded-lg font-medium shadow-xl">
              <div className="flex items-center gap-1.5 text-[#c4942a] mb-0.5">
                <Lock size={11} />
                <span>La Libreria — the bookshop</span>
              </div>
              <span className="text-[#6a5040]">{isChinese ? '需要等级 5' : 'Requires Level 5'}</span>
            </div>
          </div>
        )}

        {/* Narrator / Narrative box — like Scene 1 */}
        {narrative && !activePanel && (
          <div
            className="story-dialogue-panel absolute z-20 cursor-pointer"
            onClick={() => setNarrative(null)}
          >
            <div className="story-dialogue-content">
              {/* Speaker header — narrator */}
              <div className="scene-eyebrow">
                <div className="cop-narrator-dot" />
                <span>Narrator</span>
              </div>
              <p className="story-dialogue-text">{narrative}</p>
              <div className="cop-narration-footer"><span>click anywhere to continue</span><button onClick={(event) => { event.stopPropagation(); speak(narrative, 'male'); }}><Volume2 size={12} /> Listen</button></div>
            </div>
          </div>
        )}

        {/* Library locked panel */}
        {activePanel === 'library_locked' && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-4">
            <div className="bg-[#0a0604]/96 border border-[#8b6914]/30 rounded-2xl px-5 py-4 shadow-2xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Lock size={16} className="text-[#8b6914]" />
                  <span className="text-[#c4b080] font-medium">La Libreria</span>
                </div>
                <button onClick={closePanel} className="text-[#8b6914] hover:text-[#c4942a] transition-colors">
                  <X size={16} />
                </button>
              </div>
              {playerLevel >= 5 ? (
                <p className="text-[#f0e8d8] text-sm">The door swings open... <span className="text-[#8b6914] text-xs">(Bookshop chapter coming soon)</span></p>
              ) : (
                <>
                  <p className="text-[#f0e8d8] text-sm leading-relaxed mb-2">
                    The door is locked. A sign reads: <span className="text-[#c4942a] italic">"La connaissance est la clé."</span>
                  </p>
                  <p className="text-[#8b6914] text-xs">{isChinese ? `知识是钥匙。需要等级 5 才能进入。（当前：等级 ${playerLevel}）` : `Knowledge is the key. You need Level 5 to enter. (Current: Level ${playerLevel})`}</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Market woman dialogue */}
        {activePanel === 'conversation' && (
          <FemmeDuMarcheDialogue
            xp={xp}
            onSpendXp={onSpendXp}
            onAwardXp={onAwardXp}
            speak={(text, voice) => speak(text, voice || 'female')}
            onClose={closePanel}
            onAddInventory={handleAddInventory}
          />
        )}

        {/* Puzzle panel */}
        {activeHotspot && activePanel === 'puzzle' && (
          <WordUnlockPuzzle
            hotspot={activeHotspot}
            dictionary={dictionary}
            isFirstWord={dictionary.length === 0}
            onComplete={handlePuzzleComplete}
            onClose={closePanel}
            onAddToDictionary={onAddToDictionary}
            onSpeak={text => speak(text, 'female')}
          />
        )}

        {/* Command panel */}
        {activeHotspot && activePanel === 'command' && (
          <CommandPanel
            hotspot={activeHotspot}
            phase="paris_street"
            playerLevel={playerLevel}
            dictionary={dictionary}
            onResult={handleCommandResult}
            onClose={closePanel}
            onAddToDictionary={onAddToDictionary}
            onSpeak={(text, voice) => speak(text, voice || 'female')}
          />
        )}

        {/* Avanzare nella via — end of street clickable area */}
        <button
          onClick={() => { cancel(); onMoveOn(); }}
          className="absolute z-20 flex flex-col items-center gap-1 group"
          style={{ bottom: '8%', right: '2%', width: '12%', height: '16%', background: 'transparent', border: 'none', outline: 'none' }}
          title="Avanzare nella via — Continue down the street"
        >
          <div className="absolute inset-0 rounded-xl transition-all duration-300 group-hover:bg-[#c4942a]/10" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pb-2">
            <div className="bg-[#0d0804]/80 border border-[#8b6914]/40 group-hover:border-[#c4942a]/60 rounded-xl px-2 py-1.5 transition-all">
              <ArrowRight size={14} className="text-[#c4b080] group-hover:text-[#c4942a] transition-colors" />
            </div>
            <span className="text-[#c4b080] group-hover:text-[#c4942a] text-[9px] uppercase tracking-wider transition-colors text-center leading-tight whitespace-nowrap">
              Avanzare<br />nella via
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
