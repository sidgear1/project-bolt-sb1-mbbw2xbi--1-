import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Point = { x: number; y: number };

// One viewport-level overlay is more reliable than scene-specific overlays:
// every map, menu, adventure and game scene lives beneath this same viewport.
export default function GlobalDebugOverlay() {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '#' && !(event.code === 'Digit3' && event.shiftKey)) return;
      event.preventDefault();
      setOpen(current => !current);
      setPoints([]);
      setCursor(null);
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);

  if (!open) return null;
  const position = (event: React.MouseEvent): Point => ({
    x: Math.round((event.clientX / window.innerWidth) * 1000) / 10,
    y: Math.round((event.clientY / window.innerHeight) * 1000) / 10,
  });
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const box = points.length < 2 ? null : {
    x: Math.min(...xs), y: Math.min(...ys),
    w: Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10,
    h: Math.round((Math.max(...ys) - Math.min(...ys)) * 10) / 10,
  };
  const coordinateText = box
    ? `x:${box.x} y:${box.y} width:${box.w} height:${box.h}`
    : points.length === 1
      ? `x:${points[0].x} y:${points[0].y}`
      : '';
  const copyCoordinates = async () => {
    if (!coordinateText) return;
    try {
      await navigator.clipboard.writeText(coordinateText);
    } catch {
      const input = document.createElement('textarea');
      input.value = coordinateText;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return createPortal(
    <div data-global-debug-overlay style={{ position: 'fixed', inset: 0, zIndex: 2147483646, cursor: 'crosshair' }} onMouseMove={event => setCursor(position(event))} onClick={event => setPoints(current => [...current, position(event)])}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {box && <div style={{ position: 'absolute', left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, border: '2px dashed #facc15', background: 'rgba(250,204,21,.1)' }}><span style={{ position: 'absolute', bottom: '100%', left: 0, background: '#facc15', color: '#111', padding: '3px 6px', font: '700 12px ui-monospace, monospace', whiteSpace: 'nowrap' }}>x:{box.x} y:{box.y} w:{box.w} h:{box.h}</span></div>}
        {points.map((point, index) => <span key={`${point.x}-${point.y}-${index}`} style={{ position: 'absolute', left: `${point.x}%`, top: `${point.y}%`, transform: 'translate(-50%, -50%)', display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: '50%', background: '#facc15', border: '2px solid #111', color: '#111', font: '800 11px ui-monospace, monospace' }}>{index + 1}</span>)}
      </div>
      <aside onClick={event => event.stopPropagation()} style={{ position: 'absolute', left: 12, top: 12, minWidth: 275, border: '2px solid rgba(250,204,21,.75)', borderRadius: 12, background: 'rgba(0,0,0,.91)', color: 'white', padding: 12, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
        <b style={{ color: '#facc15', fontSize: 14 }}>DEBUG MODE</b><span style={{ float: 'right', color: '#aaa' }}>Press # to exit</span>
        <div style={{ marginTop: 8, color: '#bbb' }}>Screen: <span style={{ color: 'white' }}>global viewport</span></div>
        {cursor && <div style={{ marginTop: 4, color: '#bbb' }}>Cursor: <span style={{ color: '#86efac' }}>x:{cursor.x}% y:{cursor.y}%</span></div>}
        <div style={{ marginTop: 7, color: '#aaa', fontSize: 11 }}>Click points around anything to measure it.</div>
        {coordinateText && <div style={{ marginTop: 8, borderRadius: 6, background: 'rgba(250,204,21,.14)', color: '#fef08a', padding: '5px 7px', fontWeight: 700 }}>{coordinateText}</div>}
        <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
          <button disabled={!coordinateText} onClick={copyCoordinates} style={{ border: 0, borderRadius: 6, background: coordinateText ? '#facc15' : '#555', color: '#111', padding: '5px 9px', fontWeight: 800, cursor: coordinateText ? 'pointer' : 'not-allowed' }}>{copied ? 'Copied!' : 'Copy coordinates'}</button>
          <button onClick={() => { setPoints([]); setCopied(false); }} style={{ border: 0, borderRadius: 6, background: '#b91c1c', color: 'white', padding: '5px 9px', fontWeight: 700, cursor: 'pointer' }}>Clear points</button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
