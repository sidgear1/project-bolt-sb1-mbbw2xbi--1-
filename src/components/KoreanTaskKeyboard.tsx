import { Keyboard, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const rows = [
  ["ㅂ", "ㅈ", "ㄷ", "ㄱ", "ㅅ", "ㅛ", "ㅕ", "ㅑ", "ㅐ", "ㅔ"],
  ["ㅁ", "ㄴ", "ㅇ", "ㄹ", "ㅎ", "ㅗ", "ㅓ", "ㅏ", "ㅣ"],
  ["ㅋ", "ㅌ", "ㅊ", "ㅍ", "ㅠ", "ㅜ", "ㅡ"],
];
const keys: Record<string, string> = { q:"ㅂ", w:"ㅈ", e:"ㄷ", r:"ㄱ", t:"ㅅ", y:"ㅛ", u:"ㅕ", i:"ㅑ", o:"ㅐ", p:"ㅔ", a:"ㅁ", s:"ㄴ", d:"ㅇ", f:"ㄹ", g:"ㅎ", h:"ㅗ", j:"ㅓ", k:"ㅏ", l:"ㅣ", z:"ㅋ", x:"ㅌ", c:"ㅊ", v:"ㅍ", b:"ㅠ", n:"ㅜ", m:"ㅡ" };
const lead = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const vowel = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
const tail = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const combos: Record<string, string> = { "ㅗㅏ":"ㅘ", "ㅗㅐ":"ㅙ", "ㅗㅣ":"ㅚ", "ㅜㅓ":"ㅝ", "ㅜㅔ":"ㅞ", "ㅜㅣ":"ㅟ", "ㅡㅣ":"ㅢ" };
const romanized: Record<string, string> = { boda:"보다", aiseukeurim:"아이스크림", gage:"가게", dalgogi:"닭고기", gamja:"감자", mul:"물", chimdae:"침대", ginjanghan:"긴장한", sijakhada:"시작하다", dallida:"달리다", ttwida:"뛰다", oreuda:"오르다", geotda:"걷다", nareuda:"나르다", kkeutnaeda:"끝내다", "keopireul masida":"커피를 마시다", "jeoneun seulpeoyo":"저는 슬퍼요", "geunyeoege kkocheul juda":"그녀에게 꽃을 주다", jeoneun:"저는", "jeo-neun":"저는", seulpeoyo:"슬퍼요", annyeonghaseyo:"안녕하세요", gamsahamnida:"감사합니다", changmun:"창문", yeolsoe:"열쇠", keopi:"커피", dari:"다리", namu:"나무", gang:"강", chingu:"친구", "joeun achim":"좋은 아침" };
romanized.ttaragada = "따라가다";
romanized.anjda = "앉다";
romanized.antda = "앉다";
const normaliseRomanisation = (value: string) => value.toLowerCase().replace(/[\s\-']/g, "");
const onset = ["g","kk","n","d","tt","r","m","b","pp","s","ss","ng","j","jj","ch","k","t","p","h"];
const vowelRomanisation = ["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","wo","we","wi","yu","eu","ui","i"];
const coda = ["","k","k","ks","n","nj","nh","t","l","lk","lm","lb","ls","lt","lp","lh","m","p","ps","t","t","ng","t","t","k","t","p","h"];
function romaniseHangul(value: string) { return [...value].map(char => { const code = char.charCodeAt(0) - 0xac00; if (code < 0 || code >= 11172) return char; const first = Math.floor(code / 588); const middle = Math.floor((code % 588) / 28); const last = code % 28; return `${onset[first]}${vowelRomanisation[middle]}${coda[last]}`; }).join("-"); }
function contextualKoreanCandidates(input: HTMLInputElement) {
  const scopes = [input.closest("form"), input.parentElement, input.closest("main"), input.parentElement?.parentElement].filter((scope): scope is HTMLElement => Boolean(scope));
  const text = scopes.map(scope => scope.innerText).join(" ");
  const terms = [...text.matchAll(/[\uAC00-\uD7AF]+(?:\s+[\uAC00-\uD7AF]+){0,5}/g)].map(match => match[0]);
  const candidates = new Map<string, string>();
  terms.forEach(term => candidates.set(normaliseRomanisation(romaniseHangul(term)), term));
  Object.entries(romanized).forEach(([romanisation, term]) => { if (text.includes(term)) candidates.set(normaliseRomanisation(romanisation), term); });
  return candidates;
}

function compose(value: string) {
  const chars = [...value]; let out = ""; let i = 0;
  while (i < chars.length) {
    if (!lead.includes(chars[i]) && !vowel.includes(chars[i])) { out += chars[i++]; continue; }
    let l = "ㅇ"; if (lead.includes(chars[i])) l = chars[i++];
    if (!vowel.includes(chars[i])) { out += l; continue; }
    let v = chars[i++]; const combo = combos[v + (chars[i] ?? "")]; if (combo) { v = combo; i++; }
    let t = ""; if (tail.includes(chars[i]) && !vowel.includes(chars[i + 1])) t = chars[i++];
    out += String.fromCharCode(0xac00 + (lead.indexOf(l) * 21 + vowel.indexOf(v)) * 28 + Math.max(0, tail.indexOf(t)));
  }
  return out;
}
function decompose(value: string) { return [...value].flatMap(char => { const code = char.charCodeAt(0) - 0xac00; return code < 0 || code >= 11172 ? [char] : [lead[Math.floor(code / 588)], vowel[Math.floor((code % 588) / 28)], ...(code % 28 ? [tail[code % 28]] : [])]; }).join(""); }
function setValue(input: HTMLInputElement, value: string, cursor = value.length) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); requestAnimationFrame(() => input.setSelectionRange(cursor, cursor)); }
function isTaskInput(input: HTMLInputElement) {
  if (["checkbox", "radio", "range", "number", "file"].includes(input.type)) return false;
  return Boolean(input.closest(".scene-panel .scene-form, .shop-task-box form, .revision-quiz-panel form, .roam-word-popup form"));
}

export default function KoreanTaskKeyboard() {
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [romanisation, setRomanisation] = useState(() => localStorage.getItem("taletalk-romanisation-enabled") === "true");
  // Start each task at the familiar bottom-right position. A previous dragged
  // location must not make the keyboard reopen in the middle of a new task.
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoOpenedRoamInputsRef = useRef<WeakSet<HTMLInputElement>>(new WeakSet());
  const dragRef = useRef<{ offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const didDragRef = useRef(false);
  const insert = (jamo: string) => { const active = inputRef.current; if (!active) return; const start = active.selectionStart ?? active.value.length; const end = active.selectionEnd ?? start; const next = compose(`${decompose(active.value.slice(0, start))}${jamo}${decompose(active.value.slice(end))}`); setValue(active, next, Math.min(next.length, start + 1)); };
  useEffect(() => {
    document.querySelectorAll<HTMLInputElement>('input').forEach(field => field.style.removeProperty('color'));
    const focus = (event: FocusEvent) => {
      if (event.target instanceof HTMLInputElement && isTaskInput(event.target)) {
        setInput(event.target);
        inputRef.current = event.target;
        if (!romanisation && event.target.closest(".roam-word-popup") && !autoOpenedRoamInputsRef.current.has(event.target)) {
          autoOpenedRoamInputsRef.current.add(event.target);
          setOpen(true);
        }
      } else if (event.target instanceof HTMLInputElement) {
        setInput(null);
        inputRef.current = null;
        setOpen(false);
      }
    };
    const keydown = (event: KeyboardEvent) => { if (!(event.target instanceof HTMLInputElement) || !isTaskInput(event.target) || romanisation) return; if (event.key === "Backspace") { event.preventDefault(); const start = event.target.selectionStart ?? event.target.value.length; const end = event.target.selectionEnd ?? start; setValue(event.target, `${event.target.value.slice(0, Math.max(0, start - 1))}${event.target.value.slice(end)}`, Math.max(0, start - 1)); return; } if (event.key === " ") { event.preventDefault(); insert(" "); return; } const jamo = keys[event.key.toLowerCase()]; if (jamo) { event.preventDefault(); insert(jamo); } };
    const submit = (event: Event) => { if (!romanisation || !(event.target instanceof HTMLFormElement)) return; const field = event.target.querySelector("input"); if (!(field instanceof HTMLInputElement) || !isTaskInput(field)) return; const typed = normaliseRomanisation(field.value); const converted = contextualKoreanCandidates(field).get(typed) ?? romanized[field.value.trim().toLowerCase()]; if (!converted) return; event.preventDefault(); event.stopPropagation(); setValue(field, converted); requestAnimationFrame(() => event.target instanceof HTMLFormElement && event.target.requestSubmit()); };
    document.addEventListener("focusin", focus); document.addEventListener("keydown", keydown); document.addEventListener("submit", submit, true);
    return () => { document.removeEventListener("focusin", focus); document.removeEventListener("keydown", keydown); document.removeEventListener("submit", submit, true); };
  }, [romanisation]);
  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && isTaskInput(active)) { setInput(active); inputRef.current = active; }
  }, []);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const active = inputRef.current;
      if (active && (!document.contains(active) || !isTaskInput(active))) { inputRef.current = null; setInput(null); setOpen(false); }
    });
    observer.observe(document.getElementById("root")!, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const change = (event: Event) => {
      const enabled = Boolean((event as CustomEvent<boolean>).detail);
      setRomanisation(enabled);
      if (enabled) {
        setOpen(false);
        return;
      }
      // In Roam, switching from Romanisation to Hangul opens the existing
      // Korean keyboard once. The player can close it normally; it will not
      // reopen unless they deliberately toggle Romanisation off again.
      const active = inputRef.current ?? document.querySelector<HTMLInputElement>(".roam-word-popup form input");
      if (active && document.contains(active) && active.closest(".roam-word-popup")) {
        autoOpenedRoamInputsRef.current.add(active);
        inputRef.current = active;
        setInput(active);
        setOpen(true);
      }
    };
    window.addEventListener("taletalk-romanisation-change", change);
    return () => window.removeEventListener("taletalk-romanisation-change", change);
  }, []);
  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => { const rect = event.currentTarget.getBoundingClientRect(); didDragRef.current = false; dragRef.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); };
  const drag = (event: React.PointerEvent<HTMLButtonElement>) => { const state = dragRef.current; if (!state) return; if (Math.abs(event.movementX) + Math.abs(event.movementY) > 1) { state.moved = true; didDragRef.current = true; } const next = { x: Math.max(8, Math.min(window.innerWidth - 52, event.clientX - state.offsetX)), y: Math.max(8, Math.min(window.innerHeight - 52, event.clientY - state.offsetY)) }; setPosition(next); };
  const endDrag = () => { dragRef.current = null; };
  if (!input || romanisation) return null;
  return <div className="fixed z-[200]" style={position ? { left: position.x, top: position.y } : { right: 16, bottom: 16 }}>{open && <div className="absolute bottom-14 right-0 w-80 rounded-2xl border border-white/20 bg-[#111827]/95 p-2.5 shadow-2xl backdrop-blur"><div className="mb-2 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-wider text-white/70"><span>Korean keyboard</span><button aria-label="Close Korean keyboard" onClick={() => setOpen(false)}><X size={15} /></button></div>{rows.map((row, index) => <div key={index} className="mb-1 flex gap-1">{row.map(jamo => <button key={jamo} type="button" onClick={() => insert(jamo)} className="grid h-9 flex-1 place-items-center rounded-lg border border-white/15 bg-white/10 text-sm font-semibold text-white hover:bg-[#c4942a] hover:text-black">{jamo}</button>)}</div>)}<button type="button" onClick={() => insert(" ")} className="mt-1 h-7 w-full rounded-lg border border-white/15 bg-white/10 text-[10px] text-white">Space</button></div>}<button type="button" aria-label="Open Korean keyboard" title="Drag to move · click to open Korean keyboard" onPointerDown={startDrag} onPointerMove={drag} onPointerUp={endDrag} onClick={() => { if (didDragRef.current) { didDragRef.current = false; return; } setOpen(value => !value); }} className="grid h-11 w-11 touch-none cursor-grab place-items-center rounded-full border border-white/25 bg-black/80 text-white shadow-xl active:cursor-grabbing"><Keyboard size={20} /></button></div>;
}
