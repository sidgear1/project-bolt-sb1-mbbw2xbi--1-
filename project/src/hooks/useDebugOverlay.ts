import { useState, useRef, useEffect, useCallback } from 'react';

export interface DebugPoint { x: number; y: number; }

export interface DebugOverlay {
  debugMode: boolean;
  debugPoints: DebugPoint[];
  mousePos: DebugPoint | null;
  sceneRef: React.RefObject<HTMLDivElement>;
  handleSceneMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleDebugClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  clearPoints: () => void;
}

export function useDebugOverlay(): DebugOverlay {
  const [debugMode, setDebugMode] = useState(false);
  const [debugPoints, setDebugPoints] = useState<DebugPoint[]>([]);
  const [mousePos, setMousePos] = useState<DebugPoint | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

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

  const pctFromEvent = useCallback((e: React.MouseEvent): DebugPoint | null => {
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

  const clearPoints = useCallback(() => setDebugPoints([]), []);

  return { debugMode, debugPoints, mousePos, sceneRef, handleSceneMouseMove, handleDebugClick, clearPoints };
}
