import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ImageLabel = { id: string; number: string; filename: string; x: number; y: number };

function isVisible(image: HTMLImageElement) {
  const rect = image.getBoundingClientRect();
  const style = window.getComputedStyle(image);
  return rect.width > 8 && rect.height > 8 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
}

function sceneImage() {
  return Array.from(document.querySelectorAll<HTMLImageElement>('#root img'))
    .filter(isVisible)
    .sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return br.width * br.height - ar.width * ar.height;
    })[0] ?? null;
}

/** Press ' to label the current story image without changing the scene. */
export default function ImageNumberOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [images, setImages] = useState<ImageLabel[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const storyNumbers = useRef(new Map<string, Map<string, number>>());
  const activeStory = useRef<string | null>(null);
  const latest = useRef<ImageLabel | null>(null);
  const copiedTimer = useRef<number | null>(null);

  const copyImageLabel = async (image: ImageLabel) => {
    const label = `${image.number} · ${image.filename}`;
    try {
      await navigator.clipboard.writeText(label);
    } catch {
      // Clipboard access can be unavailable on a non-HTTPS preview. Keep the
      // click useful there with the browser's older copy mechanism.
      const field = document.createElement('textarea');
      field.value = label;
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    setCopiedId(image.id);
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopiedId(null), 1200);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "'" && event.code !== 'Quote') return;
      event.preventDefault();
      setEnabled(current => {
        return !current;
      });
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  useEffect(() => {
    const update = () => {
      const image = sceneImage();
      if (!image) { latest.current = null; if (enabled) setImages([]); return; }
      const rect = image.getBoundingClientRect();
      const source = image.currentSrc || image.src || image.alt;
      const storyRoot = image.closest<HTMLElement>('[class*="adventure"], .world-map-scene, .fixed.inset-0')?.className || 'app';
      if (activeStory.current !== storyRoot) activeStory.current = storyRoot;
      const numbers = storyNumbers.current.get(storyRoot) ?? new Map<string, number>();
      storyNumbers.current.set(storyRoot, numbers);
      const assigned = image.dataset.storyImageNumber;
      const number = assigned ?? String(numbers.get(source) ?? numbers.size + 1);
      if (!assigned && !numbers.has(source)) numbers.set(source, Number(number));
      const filename = source.split('/').pop()?.split('?')[0] ?? image.alt ?? 'image';
      latest.current = { id: source, number, filename, x: Math.max(6, rect.left + 8), y: Math.max(6, rect.top + 8) };
      if (enabled) setImages([latest.current]);
    };
    update();
    const appRoot = document.getElementById('root');
    const observer = new MutationObserver(update);
    if (appRoot) observer.observe(appRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'style', 'class'] });
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [enabled]);

  if (!enabled) return null;
  return createPortal(
    <div aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 2147483645, pointerEvents: 'none', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
      <div style={{ position: 'fixed', right: 12, top: 12, border: '2px solid #67e8f9', borderRadius: 8, background: 'rgba(0,0,0,.9)', color: '#cffafe', padding: '7px 10px', fontSize: 13, fontWeight: 800 }}>IMAGE NUMBERS · press ' to hide</div>
      {images.map(image => <button type="button" key={image.id} onClick={() => void copyImageLabel(image)} aria-label={`Copy ${image.number} · ${image.filename}`} title="Click to copy" style={{ position: 'fixed', left: image.x, top: image.y, pointerEvents: 'auto', cursor: 'copy', border: `2px solid ${copiedId === image.id ? '#22c55e' : '#111827'}`, borderRadius: 8, background: copiedId === image.id ? '#86efac' : '#67e8f9', color: '#111827', padding: '4px 8px', fontFamily: 'inherit', fontSize: 14, fontWeight: 900, boxShadow: '0 2px 7px rgba(0,0,0,.7)' }}>{image.number} · {image.filename}{copiedId === image.id ? ' ✓' : ''}</button>)}
    </div>,
    document.body,
  );
}
