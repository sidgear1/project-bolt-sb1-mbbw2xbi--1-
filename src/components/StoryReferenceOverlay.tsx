import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Label = { code: string; x: number; y: number; text?: string };

function referenceId(value: string, prefix: string) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36).toUpperCase()}`;
}

function visible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
}

function sceneElement() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(
    '#root > *, .world-map-scene, .scene-panel, .fixed.inset-0, [class*="adventure"], [class*="cinematic"]',
  )).filter(visible);
  return candidates.sort((a, b) => {
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();
    return (bRect.width * bRect.height) - (aRect.width * aRect.height);
  })[0] ?? null;
}

// A heading is often shared by a whole adventure (for example every garden
// beat says "English Adventure"), so it cannot identify a scene on its own.
// Combine the currently visible art and readable scene text instead. That
// gives every distinct moment its own stable S-code while returning to the
// same moment gives the same code again.
function sceneSignature(root: HTMLElement) {
  const imageSources = Array.from(root.querySelectorAll<HTMLImageElement>('img'))
    .filter(visible)
    .map(image => image.currentSrc || image.src || image.alt)
    .join('|');
  const sceneText = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3, p, [class*="narration"], [class*="dialogue"]'))
    .filter(visible)
    .map(element => element.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .filter(Boolean)
    .join('|');
  return `${imageSources}::${sceneText}` || root.className;
}

/**
 * Pressing the apostrophe key exposes compact, shareable references for the
 * currently visible story scene.  It uses a portal so it also covers scenes
 * rendered by independently mounted adventure components.
 */
export default function StoryReferenceOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [scene, setScene] = useState<Label | null>(null);
  const [lines, setLines] = useState<Label[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "'" && event.code !== 'Quote') return;
      event.preventDefault();
      setEnabled(current => !current);
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const update = () => {
      const root = sceneElement();
      if (!root) {
        setScene(null);
        setLines([]);
        return;
      }
      const rootRect = root.getBoundingClientRect();
      const signature = sceneSignature(root);
      const sceneCode = referenceId(signature, 'SC');
      setScene({ code: sceneCode, x: Math.max(8, rootRect.left + 8), y: Math.max(8, rootRect.top + 8) });

      // Be intentionally generous: every visible reading item and every
      // button gets a short N-code. That makes it easy to point at any part
      // of Roam, an adventure, or a dialogue screen without describing it.
      const selector = 'p, h1, h2, h3, button, a, [role="button"], [class*="scene-eyebrow"], [class*="narration"], [class*="dialogue-label"]';
      const seen = new Set<HTMLElement>();
      const nextLines = Array.from(document.querySelectorAll<HTMLElement>(selector))
        .filter(element => root.contains(element) && !element.closest('[data-story-reference-overlay]') && visible(element) && !seen.has(element) && (seen.add(element), true))
        .map((element, index) => {
          const rect = element.getBoundingClientRect();
          const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
          const code = referenceId(`${signature}|${index}|${text}`, 'N');
          return { code, text, x: Math.max(4, rect.right + 7), y: Math.max(4, rect.top - 2) };
        });
      setLines(nextLines);
    };

    update();
    const observer = new MutationObserver(update);
    // The labels are portalled into document.body; observe only the app root so
    // adding a label never triggers another label update.
    const appRoot = document.getElementById('root');
    if (appRoot) observer.observe(appRoot, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [enabled]);

  // Text selection should never advance an adventure. This makes dialogue on
  // every screen copyable directly: select it, then press Ctrl/Cmd+C.
  useEffect(() => {
    const stopClickAfterSelection = (event: MouseEvent) => {
      if (window.getSelection()?.toString().trim()) event.stopPropagation();
    };
    window.addEventListener('click', stopClickAfterSelection, true);
    return () => window.removeEventListener('click', stopClickAfterSelection, true);
  }, []);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const input = document.createElement('textarea');
      input.value = code;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode(current => current === code ? null : current), 1400);
  };

  if (!enabled) return null;
  return createPortal(
    <div data-story-reference-overlay aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 2147483647, pointerEvents: 'none', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
      <div style={{ position: 'fixed', right: 12, top: 12, border: '2px solid #facc15', borderRadius: 8, background: 'rgba(0,0,0,.9)', color: '#fef08a', padding: '7px 10px', fontSize: 13, fontWeight: 800 }}>REFERENCE CODES · press ' to hide</div>
      {scene && <button type="button" onClick={() => void copyCode(scene.code)} title="Copy scene code" style={{ position: 'fixed', left: scene.x, top: scene.y, pointerEvents: 'auto', border: 0, borderRadius: 7, background: '#facc15', color: '#111827', padding: '5px 9px', fontSize: 18, fontWeight: 900, boxShadow: '0 2px 7px rgba(0,0,0,.7)', cursor: 'copy' }}>{copiedCode === scene.code ? 'Copied!' : scene.code}</button>}
      {lines.map((line, index) => <button type="button" key={`${line.code}-${index}`} onClick={() => void copyCode(line.code)} title="Copy reference code" style={{ position: 'fixed', left: line.x, top: line.y, pointerEvents: 'auto', border: '2px solid #facc15', borderRadius: 7, background: 'rgba(0,0,0,.94)', color: '#fef08a', padding: '4px 8px', fontSize: 16, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: '0 2px 7px rgba(0,0,0,.7)', cursor: 'copy' }}>{copiedCode === line.code ? 'Copied!' : line.code}</button>)}
    </div>,
    document.body,
  );
}
