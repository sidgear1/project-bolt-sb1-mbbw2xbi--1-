import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Point = { x: number; y: number };
type Geometry = { left: number; top: number; width: number; height: number };
type SavedTask = { geometry?: Geometry; items?: Record<string, Point>; itemAnchors?: Record<string, Point> };
type SavedTasks = Record<string, SavedTask>;

const STORAGE_KEY = 'taletalk-custom-task-bars-v2';
const SHOP_RESET_KEY = 'taletalk-shop-task-layout-reset-v2';
const TASK_SELECTOR = [
  '[data-task-editor-panel]',
  '.scene-panel:has(input:not([type="checkbox"]):not([type="file"]))',
  '.shop-task-frame:has(input:not([type="checkbox"]):not([type="file"]))',
  '.shop-task-box:has(input:not([type="checkbox"]):not([type="file"]))',
  '.revision-quiz-panel:has(input:not([type="checkbox"]):not([type="file"]))',
  '.practice-card:has(input:not([type="checkbox"]):not([type="file"]))',
  '.match-card:has(input:not([type="checkbox"]):not([type="file"]))',
  '.roam-word-popup:has(input:not([type="checkbox"]):not([type="file"]))',
].join(',');

// Hover cards live in #root, but are not part of a task bar. Ignore their DOM
// changes so hovering a word cannot reapply and visibly snap the saved layout.
const TRANSIENT_OVERLAY_SELECTOR = [
  '.global-korean-word-guide',
  '.task-dictionary-overlay',
].join(',');

function isTransientOverlayMutation(record: MutationRecord) {
  if (record.target instanceof Element && record.target.closest(TRANSIENT_OVERLAY_SELECTOR)) return true;
  const changedNodes = [...record.addedNodes, ...record.removedNodes];
  return changedNodes.length > 0 && changedNodes.every(node =>
    node instanceof Element && (
      node.matches(TRANSIENT_OVERLAY_SELECTOR) ||
      Boolean(node.querySelector(TRANSIENT_OVERLAY_SELECTOR))
    )
  );
}

const readSaved = (): SavedTasks => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as SavedTasks; }
  catch { return {}; }
};

function resetShopLayoutsOnce() {
  if (localStorage.getItem(SHOP_RESET_KEY) === 'done') return;
  for (const storageKey of ['taletalk-custom-task-bars-v1', STORAGE_KEY]) {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as SavedTasks;
      let changed = false;
      for (const key of Object.keys(saved)) {
        if (/shop/i.test(key)) { delete saved[key]; changed = true; }
      }
      if (changed) localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch { /* A broken saved layout should never block the game. */ }
  }
  localStorage.setItem(SHOP_RESET_KEY, 'done');
}

function clampGeometry(geometry: Geometry, panel?: HTMLElement): Geometry {
  const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
  const compact = panel?.dataset.taskEditorCompact === 'true';
  const width = Math.max(compact ? 10 : 30, Math.min(96, finite(geometry.width, compact ? 18 : 60)));
  const height = Math.max(compact ? 10 : 18, Math.min(82, finite(geometry.height, 30)));
  return {
    left: Math.max(0, Math.min(100 - width, finite(geometry.left, (100 - width) / 2))),
    top: Math.max(0, Math.min(100 - height, finite(geometry.top, 100 - height - 2))),
    width,
    height,
  };
}

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 8 && rect.height > 8 && style.display !== 'none' && style.visibility !== 'hidden';
}

function hasNativeBusEditor(panel: HTMLElement) {
  return panel.classList.contains('bus-quiz-panel') && Boolean(panel.querySelector('.bus-layout-item'));
}

function hasVisibleSurface(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const colour = style.backgroundColor.replace(/\s/g, '');
  const hasBackgroundColour = colour !== 'transparent' && colour !== 'rgba(0,0,0,0)';
  const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some(side => parseFloat(style[`border${side}Width` as keyof CSSStyleDeclaration] as string) > 0);
  return hasBackgroundColour || style.backgroundImage !== 'none' || hasBorder || style.backdropFilter !== 'none';
}

function canonicalPanel(panel: HTMLElement) {
  const frame = panel.closest<HTMLElement>('.shop-task-frame');
  let target = frame ?? panel;
  if (!frame && !hasVisibleSurface(panel)) {
    let ancestor = panel.parentElement;
    for (let depth = 0; ancestor && depth < 2; depth += 1, ancestor = ancestor.parentElement) {
      const rect = ancestor.getBoundingClientRect();
      const isFullScreenLayer = rect.width >= window.innerWidth * 0.94 && rect.height >= window.innerHeight * 0.9;
      if (!isFullScreenLayer && ancestor.querySelector('input:not([type="checkbox"]):not([type="file"])') && hasVisibleSurface(ancestor)) {
        target = ancestor;
        break;
      }
    }
  }
  if (target !== panel) {
    if (panel.dataset.taskEditorPanel) target.dataset.taskEditorPanel = panel.dataset.taskEditorPanel;
    let readyElement: HTMLElement | null = panel;
    while (readyElement) {
      readyElement.classList.add('global-task-panel-ready');
      if (readyElement === target) break;
      readyElement = readyElement.parentElement;
    }
    for (const property of ['position', 'left', 'top', 'right', 'bottom', 'width', 'height', 'transform', 'box-sizing']) {
      panel.style.removeProperty(property);
    }
    panel.classList.remove('global-task-panel-editing');
    panel.classList.remove('global-task-panel-customised');
  }
  return target;
}

function visibleTask(): HTMLElement | null {
  const focused = document.activeElement instanceof HTMLElement
    ? document.activeElement.closest<HTMLElement>(TASK_SELECTOR)
    : null;
  if (focused && isVisible(focused) && !hasNativeBusEditor(focused)) return canonicalPanel(focused);

  const panels = [...document.querySelectorAll<HTMLElement>(TASK_SELECTOR)]
    .filter(panel => isVisible(panel) && !hasNativeBusEditor(panel));
  const panel = panels.find(candidate => !panels.some(other => other !== candidate && candidate.contains(other))) ?? null;
  return panel ? canonicalPanel(panel) : null;
}

function generatedTaskIdentity(panel: HTMLElement) {
  const root = panel.closest<HTMLElement>('[class*="adventure"], .revision-screen, .roam-screen, .fixed.inset-0') ?? panel.parentElement;
  const kind = [...panel.classList].filter(name =>
    name !== 'global-task-panel-editing'
    && name !== 'global-task-panel-customised'
    && name !== 'global-task-panel-ready'
    && !/^(absolute|fixed|relative|z-|left-|right-|top-|bottom-|w-|max-w-|translate)/.test(name),
  ).join('-') || panel.tagName.toLowerCase();
  return `${root?.className ?? 'task'}-${kind}`.replace(/[^a-z0-9_-]+/gi, '-');
}

function generatedTaskKey(panel: HTMLElement) {
  return `persistent-${generatedTaskIdentity(panel)}`.slice(0, 180);
}

function legacyGeneratedTaskKey(panel: HTMLElement) {
  const root = panel.closest<HTMLElement>('[class*="adventure"], .revision-screen, .roam-screen, .fixed.inset-0') ?? panel.parentElement;
  const image = root?.querySelector<HTMLImageElement>('img[src]')?.getAttribute('src')?.split('/').pop()?.split('?')[0] ?? 'default';
  return `${generatedTaskIdentity(panel)}-${image}`.slice(0, 180);
}

function baseTaskKey(panel: HTMLElement) {
  return panel.dataset.taskEditorPanel || generatedTaskKey(panel);
}

function taskKey(panel: HTMLElement) {
  const mode = localStorage.getItem('taletalk-romanisation-enabled') === 'true' ? 'on' : 'off';
  return `${baseTaskKey(panel)}--romanisation-${mode}`;
}

const HANGUL_LAYOUT_SEED_KEY = 'taletalk-hangul-layouts-seeded-from-romanisation-v1';

function seedHangulLayoutsFromRomanisation() {
  if (localStorage.getItem(HANGUL_LAYOUT_SEED_KEY) === 'true') return;
  const all = readSaved();
  let changed = false;
  Object.keys(all).forEach(key => {
    if (!key.endsWith('--romanisation-on')) return;
    const hangulKey = key.replace(/--romanisation-on$/, '--romanisation-off');
    all[hangulKey] = JSON.parse(JSON.stringify(all[key]));
    changed = true;
  });
  if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  localStorage.setItem(HANGUL_LAYOUT_SEED_KEY, 'true');
}

function readTask(panel: HTMLElement) {
  seedHangulLayoutsFromRomanisation();
  const all = readSaved();
  const key = taskKey(panel);
  if (all[key]) return all[key];

  // A newly encountered Hangul panel begins at its matching Romanisation
  // position, but is saved under its own key as soon as it is edited.
  if (key.endsWith('--romanisation-off')) {
    const romanisationKey = key.replace(/--romanisation-off$/, '--romanisation-on');
    if (all[romanisationKey]) {
      all[key] = JSON.parse(JSON.stringify(all[romanisationKey]));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      return all[key];
    }
  }

  // Older unnamed tasks were keyed by the current image. Migrate the exact
  // current-image save first, or another save for this same panel identity if
  // the task has reopened over a different scene image.
  const unsplitKey = baseTaskKey(panel);
  const legacyKey = legacyGeneratedTaskKey(panel);
  const identityPrefix = generatedTaskIdentity(panel).slice(0, 140);
  const fallbackKey = Object.keys(all).reverse().find(candidate => candidate.startsWith(identityPrefix));
  const migrated = all[unsplitKey] ?? all[legacyKey] ?? (fallbackKey ? all[fallbackKey] : undefined);
  if (migrated) {
    all[key] = migrated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return all[key];
  }
  return undefined;
}

function editableItems(panel: HTMLElement): HTMLElement[] {
  let container = panel;
  while (true) {
    const children = [...container.children].filter((child): child is HTMLElement =>
      child instanceof HTMLElement
      && !child.matches('.bus-layout-editor-notice,.global-task-editor-notice,.task-panel-center-guide,script,style')
      && isVisible(child),
    );
    if (children.length !== 1 || children[0].matches('form') || !children[0].querySelector('input:not([type="checkbox"]):not([type="file"])')) {
      return children.flatMap(child => {
        if (child.matches('[data-task-editor-item]')) return [child];
        const explicitItems = [...child.querySelectorAll<HTMLElement>('[data-task-editor-item]')]
          .filter(item => isVisible(item) && !item.parentElement?.closest('[data-task-editor-item]'));
        if (explicitItems.length) return explicitItems;

        // Legacy task bars often put every cue and control inside one form or
        // one bilingual cue. Treat their visible leaf controls as individual
        // editor items instead of turning the whole form into one drag box.
        if (child.matches('form')) {
          const formItems = [...child.querySelectorAll<HTMLElement>(
            ':scope > .task-close, :scope > input:not([type="checkbox"]):not([type="file"]), :scope > button, :scope > .scene-error, :scope > .bilingual-type-cue > p, :scope > .bilingual-type-cue > label',
          )].filter(isVisible);
          if (formItems.length) return [...new Set(formItems)];
        }
        if (child.matches('.bilingual-type-cue')) {
          const cueItems = [...child.querySelectorAll<HTMLElement>(':scope > p, :scope > label')].filter(isVisible);
          if (cueItems.length) return cueItems;
        }

        // A task header often groups its instruction and Romanisation switch in
        // one wide row. Make the real words/control draggable, so an invisible
        // row-sized hit box cannot block nearby items.
        const instructionItems = [...child.querySelectorAll<HTMLElement>('.scene-eyebrow, span[class*="uppercase"][class*="tracking"]')]
          .filter(item => isVisible(item));
        const romanisationItems = [...child.querySelectorAll<HTMLElement>('label:has(input[type="checkbox"])')]
          .filter(item => isVisible(item));
        if (instructionItems.length || romanisationItems.length) {
          const controls = [...child.querySelectorAll<HTMLElement>('button')].filter(item => isVisible(item));
          return [...new Set([...instructionItems, ...romanisationItems, ...controls])];
        }
        return [child];
      });
    }
    container = children[0];
  }
}

function itemRole(child: HTMLElement) {
  if (child.matches('label:has(input[type="checkbox"])')) return 'romanisation-toggle';
  if (child.matches('form') || child.querySelector('input:not([type="checkbox"]):not([type="file"])')) return 'answer-form';
  if (child.matches('h1,h2,h3')) return 'title';
  if (child.matches('.scene-eyebrow')) return 'instruction';
  if (child.matches('.scene-progress')) return 'progress';
  if (child.matches('.bilingual-type-cue')) return 'word-cue';
  if (child.matches('.live-typing-feedback')) return 'typing-feedback';
  if (child.matches('.scene-error,[class*="text-red"],[class*="text-rose"]')) return 'error-message';
  if (child.matches('button')) return child.getAttribute('aria-label')?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'button';
  return child.tagName.toLowerCase();
}

function applySaved(panel: HTMLElement, saved: SavedTask | undefined, editing: boolean) {
  panel.classList.add('global-task-panel-ready');
  panel.classList.toggle('global-task-panel-editing', editing);
  panel.classList.toggle('global-task-panel-customised', Boolean(saved?.geometry || Object.keys(saved?.items ?? {}).length));
  if (saved?.geometry) {
    const { left, top, width, height } = clampGeometry(saved.geometry, panel);
    panel.style.setProperty('position', 'fixed', 'important');
    panel.style.setProperty('left', `${left}%`, 'important');
    panel.style.setProperty('top', `${top}%`, 'important');
    panel.style.setProperty('width', `${width}%`, 'important');
    panel.style.setProperty('height', `${height}%`, 'important');
    panel.style.setProperty('right', 'auto', 'important');
    panel.style.setProperty('bottom', 'auto', 'important');
    panel.style.setProperty('transform', 'none', 'important');
    panel.style.setProperty('box-sizing', 'border-box');
  }
  const roles: Record<string, number> = {};
  editableItems(panel).forEach((child, index) => {
    const role = itemRole(child);
    const ordinal = roles[role] ?? 0;
    roles[role] = ordinal + 1;
    const legacyId = `${child.tagName.toLowerCase()}-${index}`;
    const id = child.dataset.taskEditorItem || (saved?.items?.[legacyId] ? legacyId : `${role}-${ordinal}`);
    child.dataset.taskEditorItem = id;
    child.classList.toggle('global-task-edit-item', editing);
    if (child.dataset.taskEditorBaseTransform === undefined) child.dataset.taskEditorBaseTransform = child.style.transform;
    const base = child.dataset.taskEditorBaseTransform || '';
    const point = saved?.items?.[id];
    const anchor = saved?.itemAnchors?.[id];
    child.style.transform = base;
    let appliedPoint = point ?? { x: 0, y: 0 };
    if (anchor) {
      const panelRect = panel.getBoundingClientRect();
      const itemRect = child.getBoundingClientRect();
      appliedPoint = {
        x: panelRect.left + anchor.x * panelRect.width - itemRect.left,
        y: panelRect.top + anchor.y * panelRect.height - itemRect.top,
      };
    }
    child.style.transform = appliedPoint.x || appliedPoint.y
      ? `${base} translate(${appliedPoint.x}px, ${appliedPoint.y}px)`.trim()
      : base;
    child.dataset.taskEditorAppliedX = String(appliedPoint.x);
    child.dataset.taskEditorAppliedY = String(appliedPoint.y);
  });
}

function saveTask(key: string, updater: (task: SavedTask) => SavedTask) {
  const all = readSaved();
  all[key] = updater(all[key] ?? {});
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function applyModeWithoutMovingItems(panel: HTMLElement, editing: boolean) {
  const key = taskKey(panel);
  const saved = readTask(panel);
  const before = new Map(editableItems(panel).map(item => [item.dataset.taskEditorItem ?? "", item.getBoundingClientRect()]));
  applySaved(panel, saved, editing);

  let changed = false;
  const adjustedItems = { ...(saved?.items ?? {}) };
  const adjustedAnchors = { ...(saved?.itemAnchors ?? {}) };
  const panelRect = panel.getBoundingClientRect();
  editableItems(panel).forEach(item => {
    const id = item.dataset.taskEditorItem ?? "";
    const previousRect = before.get(id);
    if (!id || !previousRect) return;
    const currentRect = item.getBoundingClientRect();
    const dx = previousRect.left - currentRect.left;
    const dy = previousRect.top - currentRect.top;
    if (Math.abs(dx) < .25 && Math.abs(dy) < .25) return;
    const point = adjustedItems[id] ?? { x: 0, y: 0 };
    adjustedItems[id] = { x: point.x + dx, y: point.y + dy };
    if (panelRect.width > 0 && panelRect.height > 0) {
      // The previous on-screen rectangle is the source of truth. Updating
      // only the pixel offset lets an older percentage anchor override this
      // correction on the next apply, which made cues jump after pressing [.
      adjustedAnchors[id] = {
        x: (previousRect.left - panelRect.left) / panelRect.width,
        y: (previousRect.top - panelRect.top) / panelRect.height,
      };
    }
    changed = true;
  });
  if (changed) {
    saveTask(key, task => ({ ...task, items: adjustedItems, itemAnchors: adjustedAnchors }));
    applySaved(panel, readSaved()[key], editing);
  }

  // Save the actual on-screen position as a percentage of the panel. Future
  // restores no longer depend on whether the item's natural layout is centred,
  // left aligned, full width, or temporarily styled for edit mode.
  if (panelRect.width > 0 && panelRect.height > 0) {
    const itemAnchors = { ...(readSaved()[key]?.itemAnchors ?? {}) };
    editableItems(panel).forEach(item => {
      const id = item.dataset.taskEditorItem ?? '';
      if (!id) return;
      const rect = item.getBoundingClientRect();
      itemAnchors[id] = {
        x: (rect.left - panelRect.left) / panelRect.width,
        y: (rect.top - panelRect.top) / panelRect.height,
      };
    });
    saveTask(key, task => ({ ...task, itemAnchors }));
    applySaved(panel, readSaved()[key], editing);
  }
}

export default function GlobalTaskBarEditor() {
  const [editing, setEditing] = useState(false);
  const [version, refresh] = useState(0);
  const editingRef = useRef(false);
  const activePanelRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    resetShopLayoutsOnce();
    const restore = () => {
      const panel = visibleTask();
      const previous = activePanelRef.current;
      if (previous && previous !== panel) applySaved(previous, readTask(previous), false);
      activePanelRef.current = panel;
      if (panel) applySaved(panel, readTask(panel), editingRef.current);
      if (!panel && editingRef.current) { editingRef.current = false; setEditing(false); }
      refresh(value => value + 1);
    };
    restore();
    const root = document.getElementById('root');
    if (!root) return;
    const observer = new MutationObserver(records => {
      if (records.every(isTransientOverlayMutation)) return;
      restore();
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== '[' && event.code !== 'BracketLeft') return;
      const panel = visibleTask();
      if (!panel) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const next = !editingRef.current;
      editingRef.current = next;
      activePanelRef.current = panel;
      applyModeWithoutMovingItems(panel, next);
      setEditing(next);
      refresh(value => value + 1);
    };
    window.addEventListener('keydown', keydown, { capture: true });
    return () => window.removeEventListener('keydown', keydown, { capture: true });
  }, []);

  useEffect(() => {
    if (!editing) return;
    const panel = activePanelRef.current ?? visibleTask();
    if (!panel) return;
    const key = taskKey(panel);
    let drag: { element: HTMLElement; id: string; startX: number; startY: number; point: Point } | null = null;
    const down = (event: PointerEvent) => {
      const item = (event.target as HTMLElement).closest<HTMLElement>('[data-task-editor-item]');
      if (!item || !panel.contains(item)) return;
      event.preventDefault();
      event.stopPropagation();
      item.setPointerCapture(event.pointerId);
      const id = item.dataset.taskEditorItem!;
      const point = {
        x: Number(item.dataset.taskEditorAppliedX ?? 0),
        y: Number(item.dataset.taskEditorAppliedY ?? 0),
      };
      drag = { element: item, id, startX: event.clientX, startY: event.clientY, point };
    };
    const move = (event: PointerEvent) => {
      if (!drag) return;
      const point = { x: drag.point.x + event.clientX - drag.startX, y: drag.point.y + event.clientY - drag.startY };
      const base = drag.element.dataset.taskEditorBaseTransform || '';
      drag.element.style.transform = `${base} translate(${point.x}px, ${point.y}px)`.trim();
      const rect = drag.element.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const leftEdge = Math.max(4, panelRect.left + 4);
      const topEdge = Math.max(4, panelRect.top + 4);
      const rightEdge = Math.min(innerWidth - 4, panelRect.right - 4);
      const bottomEdge = Math.min(innerHeight - 4, panelRect.bottom - 4);
      if (rect.left < leftEdge) point.x += leftEdge - rect.left;
      if (rect.top < topEdge) point.y += topEdge - rect.top;
      if (rect.right > rightEdge) point.x -= rect.right - rightEdge;
      if (rect.bottom > bottomEdge) point.y -= rect.bottom - bottomEdge;
      drag.element.style.transform = `${base} translate(${point.x}px, ${point.y}px)`.trim();
      drag.element.dataset.taskEditorAppliedX = String(point.x);
      drag.element.dataset.taskEditorAppliedY = String(point.y);
      const finalRect = drag.element.getBoundingClientRect();
      const anchor = {
        x: (finalRect.left - panelRect.left) / panelRect.width,
        y: (finalRect.top - panelRect.top) / panelRect.height,
      };
      saveTask(key, task => ({
        ...task,
        items: { ...task.items, [drag!.id]: point },
        itemAnchors: { ...task.itemAnchors, [drag!.id]: anchor },
      }));
    };
    const up = () => { drag = null; };
    const blockInteraction = (event: MouseEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    panel.addEventListener('pointerdown', down, true);
    panel.addEventListener('click', blockInteraction, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      panel.removeEventListener('pointerdown', down, true);
      panel.removeEventListener('click', blockInteraction, true);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [editing, version]);

  if (!editing || typeof document === 'undefined') return null;
  const panel = activePanelRef.current;
  if (!panel || !document.contains(panel)) return null;

  const changeGeometry = (mode: 'move' | 'width' | 'height', event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const key = taskKey(panel);
    const rect = panel.getBoundingClientRect();
    const initial: Geometry = { left: rect.left / innerWidth * 100, top: rect.top / innerHeight * 100, width: rect.width / innerWidth * 100, height: rect.height / innerHeight * 100 };
    const startX = event.clientX;
    const startY = event.clientY;
    const move = (pointer: PointerEvent) => {
      const geometry = { ...initial };
      const dx = (pointer.clientX - startX) / innerWidth * 100;
      const dy = (pointer.clientY - startY) / innerHeight * 100;
      if (mode === 'move') { geometry.left += dx; geometry.top += dy; }
      else if (mode === 'width') geometry.width += dx;
      else geometry.height += dy;
      const clamped = clampGeometry(geometry, panel);
      applySaved(panel, { ...readSaved()[key], geometry: clamped }, true);
      saveTask(key, task => ({ ...task, geometry: clamped }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return createPortal(<>
    <div className="task-screen-center-guide" aria-hidden="true" />
    {createPortal(<div className="task-panel-center-guide" aria-hidden="true" />, panel)}
    <div className="bus-layout-controls global-task-editor-controls">
      <b>TASK BAR</b>
      <button type="button" className="bus-task-control move" onPointerDown={event => changeGeometry('move', event)}>✥ Move<span>Move task bar</span></button>
      <button type="button" className="bus-task-control width" onPointerDown={event => changeGeometry('width', event)}>↔ Width<span>Resize width</span></button>
      <button type="button" className="bus-task-control height" onPointerDown={event => changeGeometry('height', event)}>↕ Height<span>Resize height</span></button>
    </div>
  </>, document.body);
}
