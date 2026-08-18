import { DebugOverlay } from '../hooks/useDebugOverlay';

interface DebugOverlayPanelProps {
  overlay: DebugOverlay;
  mediaLabel: string;
}

export default function DebugOverlayPanel({ overlay, mediaLabel }: DebugOverlayPanelProps) {
  const { debugPoints, mousePos, handleSceneMouseMove, handleDebugClick, clearPoints } = overlay;

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
      <div
        className="absolute inset-0"
        style={{ cursor: 'crosshair', zIndex: 1 }}
        onClick={handleDebugClick}
        onMouseMove={handleSceneMouseMove}
      />

      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
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

      <div className="absolute top-2 left-2 pointer-events-auto" style={{ zIndex: 3 }}>
        <div style={{ background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(250,204,21,0.5)', borderRadius: 12, padding: '10px 14px', fontFamily: 'monospace', fontSize: '11px', color: '#fff', minWidth: 300, maxWidth: 420 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ color: '#facc15', fontWeight: 'bold', fontSize: 12 }}>DEBUG MODE</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>Press # to exit</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
            Source: <span style={{ color: '#fff' }}>{mediaLabel}</span>
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
            onClick={clearPoints}
            style={{ background: 'rgba(239,68,68,0.7)', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 10, cursor: 'pointer' }}
          >
            Clear Points
          </button>
        </div>
      </div>
    </div>
  );
}
