import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Lightbulb, Volume2 } from "lucide-react";
import { assetUrl } from "../utils/assetUrl";
import { preloadGeneratedSpeech, useSpeech } from "../hooks/useSpeech";
import { useLanguage } from "../i18n";
import { createPortal, flushSync } from "react-dom";
import { capitaliseStandalone } from "../utils/textCase";
import { LiveAnswerLetters } from "./LiveTypingFeedback";
import SmoothSceneImage from "./SmoothSceneImage";
import { preloadSceneWindow } from "../utils/imagePreloader";
import QuizModeMenu from "./QuizModeMenu";
import { recordDailyLearnedWords } from "../utils/learningProgress";

type Props = {
  onBack: () => void;
  onBusComplete: () => void;
  onBusQuizFailed?: () => void;
  onHomeComplete: () => void;
};
function SceneImage({ src, alt, imageNumber }: { src: string; alt: string; imageNumber?: number }) {
  return (
    <SmoothSceneImage
      className="absolute inset-0 h-full w-full object-cover"
      src={src}
      alt={alt}
      data-story-image-number={imageNumber}
      draggable={false}
    />
  );
}
let primedSceneAmbience: { file: string; audio: HTMLAudioElement } | null = null;
let sceneAmbienceCleanupTimer: number | null = null;

export function primeSceneAmbience(file: string, volume: number) {
  if (primedSceneAmbience?.file !== file) {
    primedSceneAmbience?.audio.pause();
    const audio = new Audio(assetUrl(file));
    audio.loop = true;
    audio.preload = "auto";
    primedSceneAmbience = { file, audio };
  }
  const audio = primedSceneAmbience.audio;
  audio.volume = volume;
  audio.muted = localStorage.getItem("taletalk-sound-muted") === "true";
  if (!audio.muted) void audio.play().catch(() => undefined);
  return audio;
}

function stopPrimedSceneAmbience() {
  if (sceneAmbienceCleanupTimer !== null) {
    window.clearTimeout(sceneAmbienceCleanupTimer);
    sceneAmbienceCleanupTimer = null;
  }
  primedSceneAmbience?.audio.pause();
  if (primedSceneAmbience) primedSceneAmbience.audio.currentTime = 0;
  primedSceneAmbience = null;
}

function useLoopingSceneAmbience(file: string, volume: number, active = true) {
  useEffect(() => {
    if (sceneAmbienceCleanupTimer !== null) {
      window.clearTimeout(sceneAmbienceCleanupTimer);
      sceneAmbienceCleanupTimer = null;
    }
    if (!active) {
      if (primedSceneAmbience?.file === file) {
        primedSceneAmbience.audio.pause();
        primedSceneAmbience.audio.currentTime = 0;
      }
      return;
    }
    const audio = primeSceneAmbience(file, volume);
    const playAmbience = () => {
      if (!audio.muted && audio.paused) void audio.play().catch(() => undefined);
    };
    const syncSound = (event: Event) => {
      audio.muted = Boolean((event as CustomEvent<boolean>).detail);
      playAmbience();
    };
    playAmbience();
    window.addEventListener("pointerdown", playAmbience, { capture: true });
    window.addEventListener("keydown", playAmbience, { capture: true });
    window.addEventListener("taletalk-sound-change", syncSound);
    return () => {
      window.removeEventListener("pointerdown", playAmbience, { capture: true });
      window.removeEventListener("keydown", playAmbience, { capture: true });
      window.removeEventListener("taletalk-sound-change", syncSound);
      // Defer disposal by one tick so React Strict Mode's development-only
      // effect replay can adopt the click-primed audio instead of killing it.
      sceneAmbienceCleanupTimer = window.setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
        if (primedSceneAmbience?.audio === audio) primedSceneAmbience = null;
        sceneAmbienceCleanupTimer = null;
      }, 0);
    };
  }, [file, volume, active]);
}
const unlock = (word: string, scene: string) => {
  const slot = Number(localStorage.getItem("taletalk_active_save_slot") ?? "1");
  const key = `taletalk-slot-${slot}-scene-${scene}-words`;
  const saved = new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]"));
  saved.add(word.toLowerCase());
  localStorage.setItem(key, JSON.stringify([...saved].sort()));
  const mapKey = `taletalk-slot-${slot}-unlocked-words`;
  const mapWords = new Set<string>(JSON.parse(localStorage.getItem(mapKey) ?? "[]"));
  mapWords.add(word.toLowerCase());
  localStorage.setItem(mapKey, JSON.stringify([...mapWords].sort()));
  recordDailyLearnedWords([word], slot);
  window.dispatchEvent(new Event("taletalk-words-changed"));
};
type QuizAnswerScript = "Hangul" | "Romanisation";
const recordWorldQuizAttempt = (scene: string, word: string, correct: boolean, answerScript?: QuizAnswerScript, korean?: string) => {
  const slot = Number(localStorage.getItem("taletalk_active_save_slot") ?? "1");
  const key = `taletalk-slot-${slot}-world-quiz-attempts-v1`;
  const previous = JSON.parse(localStorage.getItem(key) ?? "[]") as { scene: string; word: string; correct: boolean; at: number; answerScript?: QuizAnswerScript; korean?: string }[];
  localStorage.setItem(key, JSON.stringify([...previous, { scene, word, correct, answerScript, korean, at: Date.now() }].slice(-100)));
};
const busQuizScene = (word: string) => ["ice cream", "please", "thank you", "you are welcome"].includes(word) ? "Ice Cream Shop" : "Shopping Centre";
const musicQuizScene = (word: string) => ["bed", "drink coffee"].includes(word) ? "Detective Mason" : ["start", "run", "jump", "climb", "finish"].includes(word) ? "Sports Day" : "Shopping Centre";
const SCENE_WORD_CHINESE: Record<string, string> = { "drink coffee": "喝咖啡", bed: "床", nervous: "紧张", flower: "花", start: "开始", run: "跑", jump: "跳", climb: "爬", walk: "走", "pick up": "捡起", carry: "搬运", "put down": "放下", finish: "完成" };
const DICTIONARY: Record<string, { chinese: string; explanation: string }> = {
  am: { chinese: "是", explanation: "be 动词第一人称单数现在时：I am。" },
  be: { chinese: "是；成为", explanation: "动词原形：be 是英语最重要的系动词，表示身份、状态或存在；会变化为 am、is、are、was、were。" },
  unhappy: { chinese: "不开心的", explanation: "形容词：un-（不、相反）+ happy（开心），表示“不开心的”。" },
  bed: { chinese: "床", explanation: "名词：睡觉用的床。" },
  "drink coffee": { chinese: "喝咖啡", explanation: "动词短语：drink 是“喝”，coffee 是“咖啡”。" },
  coffee: { chinese: "咖啡", explanation: "名词：一种由咖啡豆制成的饮料；常与 drink、have 搭配。" },
  start: { chinese: "开始", explanation: "动词：开始做某事。" }, run: { chinese: "跑", explanation: "动词：快速移动。" },
  jump: { chinese: "跳", explanation: "动词：双脚离地跳起。" }, climb: { chinese: "爬", explanation: "动词：向上攀爬。" },
  walk: { chinese: "走路", explanation: "动词：步行。" }, "pick up": { chinese: "捡起", explanation: "动词短语：从地上或某处拿起。" },
  carry: { chinese: "搬运", explanation: "动词：带着或拿着某物移动。" }, finish: { chinese: "完成", explanation: "动词：做完、结束。" },
  "ice cream": { chinese: "冰淇淋", explanation: "名词：冷冻甜点。" }, shop: { chinese: "商店", explanation: "名词：买东西的地方。" },
  chicken: { chinese: "鸡肉", explanation: "名词：鸡的肉。" }, potatoes: { chinese: "土豆", explanation: "名词 potato 的复数。" },
  water: { chinese: "水", explanation: "名词：饮用的水。" }, "apples and bananas": { chinese: "苹果和香蕉", explanation: "名词短语：两种水果。" },
};
function DictionaryText({ text }: { text: string }) {
  const terms = Object.keys(DICTIONARY).sort((a, b) => b.length - a.length).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${terms.join("|")})`, "gi");
  return <>{text.split(pattern).filter(Boolean).map((part, index) => {
    const entry = DICTIONARY[part.toLowerCase()];
    return entry ? <span key={`${part}-${index}`} title={`${entry.chinese} · ${entry.explanation}`} className="cursor-help border-b border-dotted border-amber-200/80">{part}</span> : <span key={`${part}-${index}`}>{part}</span>;
  })}</>;
}
function SceneWordLibrary(_props: { scene: string; position?: "left" | "right" }) {
  // Saved vocabulary now lives exclusively in Collection on the world map.
  return null;
}
function BilingualTypeCue({
  english,
  chinese,
  value,
  showEnglish = true,
  showChinese = true,
  emphasizeChinese = false,
  displayEnglish = english,
  chineseParts,
  showRomanisationControl = true,
  showRomanisationText = true,
  wrapLine,
}: {
  english: string;
  chinese: string;
  value: string;
  showEnglish?: boolean;
  showChinese?: boolean;
  emphasizeChinese?: boolean;
  displayEnglish?: string;
  chineseParts?: string[];
  showRomanisationControl?: boolean;
  showRomanisationText?: boolean;
  wrapLine?: (id: "romanisation-control" | "hangul" | "romanisation" | "english", content: React.ReactNode) => React.ReactNode;
}) {
  const [showRomanisation, setShowRomanisation] = useState(() => localStorage.getItem("taletalk-romanisation-enabled") === "true");
  const romanise = (word: string) => ({
    "저는": "jeoneun", "슬퍼요": "seulpeoyo", "네": "ne",
    "아이스크림": "aiseukeurim", "아이스크림 주세요": "aiseukeurim juseyo",
    "주세요": "juseyo", "감사합니다": "gamsahamnida", "천만에요": "cheonmaneyo",
    "가게": "gage", "저녁": "jeonyeok", "음료": "eumryo", "과일": "gwail",
    "닭고기": "dalgogi", "감자": "gamja", "물": "mul", "사과": "sagwa",
    "창문": "changmun", "침대": "chimdae", "긴장한": "ginjanghan", "꽃": "kkot", "미안해": "mianhae",
    "그녀에게 꽃을 주다": "geunyeoege kkocheul juda", "커피를 마시다": "keopireul masida",
    "문": "mun", "열쇠": "yeolsoe", "개": "gae", "신문": "sinmun",
    "시작하다": "sijakhada", "달리다": "dallida", "뛰다": "ttwida", "오르다": "oreuda",
    "걷다": "geotda", "줍다": "jupda", "나르다": "nareuda", "내려놓다": "naeryeonota", "끝내다": "kkeutnaeda",
    "계산하다": "gyesanhada", "앉다": "anjda", "따라가다": "ttaragada",
  } as Record<string, string>)[word] ?? "";
  const toggleRomanisation = () => { const next = !showRomanisation; setShowRomanisation(next); localStorage.setItem("taletalk-romanisation-enabled", String(next)); window.dispatchEvent(new CustomEvent("taletalk-romanisation-change", { detail: next })); };
  useEffect(() => { const sync = (event: Event) => setShowRomanisation(Boolean((event as CustomEvent<boolean>).detail)); window.addEventListener("taletalk-romanisation-change", sync); return () => window.removeEventListener("taletalk-romanisation-change", sync); }, []);
  const romanisation = romanise(english);
  const answer = (showRomanisation && romanisation && /[a-z]/i.test(value) ? romanisation : english).toLowerCase();
  const line = (id: "romanisation-control" | "hangul" | "romanisation" | "english", content: React.ReactNode) => wrapLine ? wrapLine(id, content) : content;
  return (
    <div className="bilingual-type-cue mt-3 space-y-1 text-center text-lg">
      {showEnglish && line("hangul", <p className="font-semibold tracking-[.12em] text-white">
        <span className="inline-block" title={DICTIONARY[answer] ? `${DICTIONARY[answer].chinese} · ${DICTIONARY[answer].explanation}` : undefined}>
          <LiveAnswerLetters target={capitaliseStandalone(displayEnglish)} value={value} neutralClassName="text-white" />
        </span>
      </p>)}
      {showRomanisation && showRomanisationText && romanisation && line("romanisation", <p className="mt-1 text-xs tracking-wide text-sky-200"><LiveAnswerLetters target={capitaliseStandalone(romanisation)} value={/[a-z]/i.test(value) ? value : ""} neutralClassName="text-sky-200" /></p>)}
      {showChinese && line("english", <p className={`${emphasizeChinese ? "font-bold" : ""} text-[#f0d88f]`}>{chineseParts ? chineseParts.map((part, index) => <span key={`${part}-${index}`}>{capitaliseStandalone(part)}</span>) : capitaliseStandalone(chinese)}</p>)}
    </div>
  );
}

const BUS_WORD_POOL = [
  { chinese: "ice cream", english: "아이스크림", memoryImage: "scenes/shop/c1-v3.png" },
  { chinese: "please", english: "주세요", memoryImage: "scenes/shop/c1-v3.png" },
  { chinese: "thank you", english: "감사합니다", memoryImage: "scenes/shop/c1-v3.png" },
  { chinese: "you are welcome", english: "천만에요", memoryImage: "scenes/shop/c1-v3.png" },
  { chinese: "shop", english: "가게", memoryImage: "scenes/shop/c1-v3.png" },
  { chinese: "chicken", english: "닭고기", memoryImage: "scenes/shop/c2-v3.png" },
  { chinese: "water", english: "물", memoryImage: "scenes/shop/c2-v3.png" },
  { chinese: "apples", english: "사과", memoryImage: "scenes/shop/c2-v3.png" },
];
const BUS_QUESTION_COUNT = 7;

function shuffledQuizWords<T>(words: readonly T[]) {
  const shuffled = [...words];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
type BusStage = "welcome" | "intro" | "quiz" | "happy" | "running" | "failed";
const BUS_WELCOME_NARRATION = "Welcome to your first quiz. This is a chance to practise the words you have learned so far. Choose the level that feels right for you: Easy, Normal, Hard, or Very Hard. You can change it whenever you like, and you can always return to try the quiz again. Take your time, trust yourself, and good luck.";
const BUS_INTRO_NARRATION = "We never realise how important our exams are until we are about to take them. Jessica, a local college student, realises that her future may hang in the balance if she misses her next exam. With only five minutes until her bus leaves, she needs to quickly find the passwords for her tickets—or risk her future.";
const BUS_FINAL_NARRATION = "Hurrah! She unlocked the last password. She could cry with happiness. She has avoided missing her exams and future homelessness—for now.";
const BUS_FAILED_NARRATION = "The bus has gone. Jessica will need more practice before trying again.";
const BUS_PASSWORD_NARRATIONS = [
  "You unlocked the passcode to your account. Now enter the passcode for your ticket account.",
  "Your ticket account is unlocked. Next, enter the passcode sent to your email.",
  "Her email is open. Now unlock the payment verification.",
  "Payment verified. Now enter the identity confirmation passcode.",
  "Her identity is confirmed. One security passcode remains.",
  "Nearly there. Enter the final passcode to release the bus ticket.",
  "The final passcode is correct. Jessica's bus ticket is unlocked.",
] as const;
type BusLayoutOffsets = Record<string, { x: number; y: number }>;

function BusLayoutItem({ id, editing, offsets, onMove, children }: { id: string; editing: boolean; offsets: BusLayoutOffsets; onMove: (id: string, x: number, y: number) => void; children: React.ReactNode }) {
  const [dragStart, setDragStart] = useState<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const offset = offsets[id] ?? { x: 0, y: 0 };
  const usesStableCoordinates = Boolean(offsets.__stable_coordinates__);
  // The presence of a saved point matters even when it is exactly 0,0. That
  // means the player deliberately saved the item's current centred position.
  const moved = Object.prototype.hasOwnProperty.call(offsets, id);
  // CSS `translate` is independent from `transform`, so centred items can keep
  // their native translateX(-50%) while receiving the player's offset.
  const style = moved
    ? usesStableCoordinates
      ? { translate: `${offset.x}px ${offset.y}px` }
      : { transform: `translate(${offset.x}px, ${offset.y}px)` }
    : undefined;
  return <div data-layout-item={id} className={`bus-layout-item ${editing ? "is-editing" : ""} ${moved ? "has-custom-offset" : ""}`} style={style} onPointerDown={event => { if (!editing) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDragStart({ x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y }); }} onPointerMove={event => { if (!dragStart) return; onMove(id, dragStart.offsetX + event.clientX - dragStart.x, dragStart.offsetY + event.clientY - dragStart.y); }} onPointerUp={() => setDragStart(null)}>{children}</div>;
}

function toggleBusEditorWithoutMovingItems(
  _panel: HTMLElement | null,
  setEditing: React.Dispatch<React.SetStateAction<boolean>>,
  _setLayout: React.Dispatch<React.SetStateAction<BusLayoutOffsets>>,
) {
  // Edit mode now adds controls and outlines only. It does not alter wrapper
  // geometry, so saved task rows remain at exactly the same coordinates when
  // the editor is opened or closed.
  flushSync(() => setEditing(value => !value));
}

type BusTaskGeometry = { left: number; top: number; width: number; height: number };
const busLayoutKey = (romanisation: boolean) => `taletalk-bus-task-layout-romanisation-${romanisation ? "on" : "off"}`;
const busGeometryKey = (romanisation: boolean) => `taletalk-bus-task-geometry-romanisation-${romanisation ? "on" : "off"}`;
const BUS_HANGUL_LAYOUT_SEED_KEY = "taletalk-bus-hangul-layout-seeded-from-romanisation-v1";
function seedBusHangulLayoutFromRomanisation() {
  if (localStorage.getItem(BUS_HANGUL_LAYOUT_SEED_KEY) === "true") return;
  const romanisationLayout = localStorage.getItem(busLayoutKey(true));
  const romanisationGeometry = localStorage.getItem(busGeometryKey(true));
  if (romanisationLayout) localStorage.setItem(busLayoutKey(false), romanisationLayout);
  if (romanisationGeometry) localStorage.setItem(busGeometryKey(false), romanisationGeometry);
  localStorage.setItem(BUS_HANGUL_LAYOUT_SEED_KEY, "true");
}
function readBusLayout(romanisation: boolean): BusLayoutOffsets {
  try {
    seedBusHangulLayoutFromRomanisation();
    const layout = JSON.parse(localStorage.getItem(busLayoutKey(romanisation)) ?? (!romanisation ? localStorage.getItem(busLayoutKey(true)) : null) ?? localStorage.getItem("taletalk-bus-task-layout") ?? "{}") as BusLayoutOffsets;
    // The old Mode offset belonged to a full-width wrapper and can leave its
    // menu detached from the visible button. Preserve every other saved item.
    if (!layout.__positioned_mode__) {
      delete layout.mode;
      layout.__positioned_mode__ = { x: 1, y: 1 };
    }
    return layout;
  }
  catch { return {}; }
}
function readBusGeometry(romanisation: boolean): BusTaskGeometry | null {
  try {
    seedBusHangulLayoutFromRomanisation();
    const saved = JSON.parse(localStorage.getItem(busGeometryKey(romanisation)) ?? (!romanisation ? localStorage.getItem(busGeometryKey(true)) : null) ?? localStorage.getItem("taletalk-bus-task-geometry") ?? "null") as BusTaskGeometry | null;
    return saved ? clampBusTaskGeometry(saved) : null;
  } catch { return null; }
}
function clampBusTaskGeometry(geometry: BusTaskGeometry): BusTaskGeometry {
  const width = Math.max(30, Math.min(96, Number.isFinite(geometry.width) ? geometry.width : 60));
  const height = Math.max(18, Math.min(82, Number.isFinite(geometry.height) ? geometry.height : 30));
  return {
    left: Math.max(0, Math.min(100 - width, Number.isFinite(geometry.left) ? geometry.left : (100 - width) / 2)),
    top: Math.max(0, Math.min(100 - height, Number.isFinite(geometry.top) ? geometry.top : 100 - height - 2)),
    width,
    height,
  };
}
function BusTaskResizeHandle({ direction, onChange }: { direction: string; onChange: (geometry: BusTaskGeometry) => void }) {
  const [start, setStart] = useState<{ x: number; y: number; geometry: BusTaskGeometry } | null>(null);
  return <div className={`bus-task-resize-handle ${direction}`} title={direction === "move" ? "Drag to move the task bar" : "Drag to reshape the task bar"} onPointerDown={event => { const panel = event.currentTarget.closest<HTMLElement>(".bus-quiz-panel"); if (!panel) return; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); const rect = panel.getBoundingClientRect(); setStart({ x: event.clientX, y: event.clientY, geometry: { left: rect.left / window.innerWidth * 100, top: rect.top / window.innerHeight * 100, width: rect.width / window.innerWidth * 100, height: rect.height / window.innerHeight * 100 } }); }} onPointerMove={event => { if (!start) return; const dx = (event.clientX - start.x) / window.innerWidth * 100; const dy = (event.clientY - start.y) / window.innerHeight * 100; let { left, top, width, height } = start.geometry; if (direction === "move") { left += dx; top += dy; } else { if (direction.includes("e")) width += dx; if (direction.includes("s")) height += dy; if (direction.includes("w")) { left += dx; width -= dx; } if (direction.includes("n")) { top += dy; height -= dy; } } width = Math.max(30, Math.min(96, width)); height = Math.max(18, Math.min(82, height)); left = Math.max(0, Math.min(100 - width, left)); top = Math.max(0, Math.min(100 - height, top)); onChange({ left, top, width, height }); }} onPointerUp={() => setStart(null)} />;
}

function BusTaskControl({ mode, panelRef, onChange }: { mode: "move" | "width" | "height"; panelRef: React.RefObject<HTMLElement>; onChange: (geometry: BusTaskGeometry) => void }) {
  const [start, setStart] = useState<{ x: number; y: number; geometry: BusTaskGeometry } | null>(null);
  const label = mode === "move" ? "Move task bar" : mode === "width" ? "Resize width" : "Resize height";
  return <button type="button" className={`bus-task-control ${mode}`} onPointerDown={event => { const panel = panelRef.current; if (!panel) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); const rect = panel.getBoundingClientRect(); setStart({ x: event.clientX, y: event.clientY, geometry: { left: rect.left / window.innerWidth * 100, top: rect.top / window.innerHeight * 100, width: rect.width / window.innerWidth * 100, height: rect.height / window.innerHeight * 100 } }); }} onPointerMove={event => { if (!start) return; const dx = (event.clientX - start.x) / window.innerWidth * 100; const dy = (event.clientY - start.y) / window.innerHeight * 100; const geometry = { ...start.geometry }; if (mode === "move") { geometry.left += dx; geometry.top += dy; } else if (mode === "width") geometry.width += dx; else geometry.height += dy; geometry.width = Math.max(30, Math.min(96, geometry.width)); geometry.height = Math.max(18, Math.min(82, geometry.height)); geometry.left = Math.max(0, Math.min(100 - geometry.width, geometry.left)); geometry.top = Math.max(0, Math.min(100 - geometry.height, geometry.top)); onChange(geometry); }} onPointerUp={() => setStart(null)}>{mode === "move" ? "✥ Move" : mode === "width" ? "↔ Width" : "↕ Height"}<span>{label}</span></button>;
}

function BusTaskEditorControls({ panelRef, onChange }: { panelRef: React.RefObject<HTMLElement>; onChange: (geometry: BusTaskGeometry) => void }) {
  return createPortal(<><div className="task-screen-center-guide" aria-hidden="true" /><div className="bus-layout-controls"><b>TASK BAR</b><BusTaskControl mode="move" panelRef={panelRef} onChange={onChange} /><BusTaskControl mode="width" panelRef={panelRef} onChange={onChange} /><BusTaskControl mode="height" panelRef={panelRef} onChange={onChange} /></div></>, document.body);
}

function stableLetterIndexes(word: string, ratio: number) {
  const letters = [...word].map((letter, index) => ({ letter, index })).filter(({ letter }) => /[a-z]/i.test(letter));
  const count = Math.max(1, Math.ceil(letters.length * ratio));
  return letters.sort((a, b) => ((a.index * 17 + word.length * 11) % 31) - ((b.index * 17 + word.length * 11) % 31)).slice(0, count).map(({ index }) => index);
}

function mixedRemainingLetters(word: string, shown: number[]) {
  return [...word].filter((letter, index) => /[a-z]/i.test(letter) && !shown.includes(index)).sort((a, b) => ((a.charCodeAt(0) * 13) % 17) - ((b.charCodeAt(0) * 13) % 17)).join(" ");
}

type QuizDifficulty = "easy" | "normal" | "hard" | "very-hard";
type QuizRunWordResult = { korean: string; english: string; correct: boolean; mode: QuizDifficulty; answerScript?: QuizAnswerScript };
type QuizWordStats = { attempts: number; correct: number; lastMode: QuizDifficulty; lastCorrectMode?: QuizDifficulty; lastCorrectScript?: QuizAnswerScript };

function quizMissingLetterCount(letterCount: number, difficulty: QuizDifficulty) {
  if (difficulty === "easy") return Math.min(letterCount, letterCount >= 10 ? 2 : 1);
  if (difficulty === "normal") return Math.min(letterCount, 3, Math.max(2, Math.round(letterCount * .3)));
  if (difficulty === "hard") return Math.min(letterCount, Math.max(2, Math.round(letterCount * .55)));
  return letterCount;
}

function recordDedicatedQuizAnswer(quizId: "bus" | "music", result: QuizRunWordResult) {
  const slot = Number(localStorage.getItem("taletalk_active_save_slot") ?? "1");
  const key = `taletalk-slot-${slot}-quiz-word-stats-v1`;
  let allStats: Record<string, Record<string, QuizWordStats>> = {};
  try { allStats = JSON.parse(localStorage.getItem(key) ?? "{}"); } catch { allStats = {}; }
  const quizStats = allStats[quizId] ?? {};
  const wordKey = result.korean.toLowerCase().replace(/\s/g, "");
  const previous = quizStats[wordKey] ?? { attempts: 0, correct: 0, lastMode: result.mode };
  quizStats[wordKey] = {
    attempts: previous.attempts + 1,
    correct: previous.correct + (result.correct ? 1 : 0),
    lastMode: result.mode,
    lastCorrectMode: result.correct ? result.mode : previous.lastCorrectMode,
    lastCorrectScript: result.correct ? result.answerScript : previous.lastCorrectScript,
  };
  allStats[quizId] = quizStats;
  localStorage.setItem(key, JSON.stringify(allStats));
}

function saveDedicatedQuizSummary(quizId: "bus" | "music", title: string, results: QuizRunWordResult[]) {
  const slot = Number(localStorage.getItem("taletalk_active_save_slot") ?? "1");
  const statsKey = `taletalk-slot-${slot}-quiz-word-stats-v1`;
  let allStats: Record<string, Record<string, QuizWordStats>> = {};
  try { allStats = JSON.parse(localStorage.getItem(statsKey) ?? "{}"); } catch { allStats = {}; }
  const quizStats = allStats[quizId] ?? {};
  const correct = results.filter(result => result.correct).length;
  const total = results.length;
  const grade = total ? Math.round(correct / total * 100) : 0;
  const scoreKey = `taletalk-slot-${slot}-${quizId}-score`;
  const previousScore = Number(localStorage.getItem(scoreKey));
  localStorage.setItem(scoreKey, String(Number.isFinite(previousScore) ? Math.max(previousScore, grade) : grade));
  const summary = {
    title,
    grade,
    correct,
    total,
    passed: grade >= 50,
    words: results.map(result => {
      const stats = quizStats[result.korean.toLowerCase().replace(/\s/g, "")];
      return {
        ...result,
        correctTimes: stats?.correct ?? (result.correct ? 1 : 0),
        mode: stats?.lastCorrectMode ?? result.mode,
        answerScript: stats?.lastCorrectScript ?? (result.correct ? result.answerScript : undefined),
      };
    }),
  };
  const latestKey = `taletalk-slot-${slot}-quiz-${quizId}-latest-summary-v1`;
  const bestKey = `taletalk-slot-${slot}-quiz-${quizId}-best-summary-v1`;
  const previousBestRaw = localStorage.getItem(bestKey) ?? localStorage.getItem(latestKey);
  let previousBest: { grade?: number } | null = null;
  try { previousBest = JSON.parse(previousBestRaw ?? "null"); } catch { previousBest = null; }
  if (!localStorage.getItem(bestKey) && previousBestRaw && previousBest && typeof previousBest.grade === "number") {
    localStorage.setItem(bestKey, previousBestRaw);
  }
  localStorage.setItem(latestKey, JSON.stringify(summary));
  if (!previousBest || typeof previousBest.grade !== "number" || grade >= previousBest.grade) {
    localStorage.setItem(bestKey, JSON.stringify(summary));
  }
}

export function BusTicketAdventure({
  onBack,
  onBusComplete,
  onBusQuizFailed,
}: Pick<Props, "onBack" | "onBusComplete" | "onBusQuizFailed">) {
  useLoopingSceneAmbience("audio/bus-stop-engine.mp3", 0.23);
  const [stage, setStage] = useState<BusStage>("welcome"),
    [index, setIndex] = useState(0),
    [questionWords] = useState(() => shuffledQuizWords(BUS_WORD_POOL).slice(0, BUS_QUESTION_COUNT)),
    [input, setInput] = useState(""),
    [wrong, setWrong] = useState(0),
    [revealedAnswer, setRevealedAnswer] = useState<string | null>(null),
    [successMessage, setSuccessMessage] = useState<string | null>(null),
    [answerSpeaking, setAnswerSpeaking] = useState(false),
    [showingCorrectAnswer, setShowingCorrectAnswer] = useState(false),
    [hints, setHints] = useState(0),
    [wordHints, setWordHints] = useState(0),
    [results, setResults] = useState<QuizRunWordResult[]>([]),
    [secondsLeft, setSecondsLeft] = useState(300),
    [difficulty, setDifficulty] = useState<QuizDifficulty>("normal"),
    [quizRomanisationEnabled, setQuizRomanisationEnabled] = useState(() => localStorage.getItem("taletalk-romanisation-enabled") === "true");
  const [busLayoutEditing, setBusLayoutEditing] = useState(false);
  const [busLayout, setBusLayout] = useState<BusLayoutOffsets>(() => readBusLayout(quizRomanisationEnabled));
  const [busTaskGeometry, setBusTaskGeometry] = useState<BusTaskGeometry | null>(() => readBusGeometry(quizRomanisationEnabled));
  const busTaskPanelRef = useRef<HTMLElement>(null);
  const { speak, cancel } = useSpeech();
  const { isChinese } = useLanguage();
  const word = questionWords[index],
    grade = questionWords.length ? Math.round((questionWords.length - wrong) / questionWords.length * 100) : 0,
    image = assetUrl(
      `scenes/bus/${stage === "welcome" || stage === "intro" || stage === "quiz" ? "d1" : stage === "happy" ? "d2" : stage === "running" ? "d3" : "d4"}.png`,
    );
  useEffect(() => {
    const busImages = ["d1", "d2", "d3", "d4"].map(name => assetUrl(`scenes/bus/${name}.png`));
    const current = Math.max(0, busImages.indexOf(image));
    preloadSceneWindow(busImages, current, 12);
  }, [image]);
  const advance = () => {
    if (stage === "welcome") setStage("intro");
    else if (stage === "intro") setStage("quiz");
    else if (stage === "quiz") {
      setSuccessMessage(null);
      setShowingCorrectAnswer(false);
      setRevealedAnswer(null);
      if (index < questionWords.length - 1) setIndex((n) => n + 1);
      else setStage(grade >= 50 ? "happy" : "failed");
    } else if (stage === "happy") finishBus();
    else if (stage === "running") finishBus();
    else if (stage === "failed") finishBus(false);
  };
  const finishBus = (passed = true) => {
    saveDedicatedQuizSummary("bus", "Bus Stop Quiz", results);
    if (passed) onBusComplete();
    else if (onBusQuizFailed) onBusQuizFailed();
    else onBack();
  };
  const completeWord = (playAnswerAudio = true, answerScript: QuizAnswerScript = quizRomanisationEnabled ? "Romanisation" : "Hangul") => {
    unlock(word.english, "bus");
    recordWorldQuizAttempt(busQuizScene(word.chinese), word.chinese, true, answerScript, word.english);
    const quizResult: QuizRunWordResult = { korean: word.english, english: capitaliseStandalone(word.chinese), correct: true, mode: difficulty, answerScript };
    recordDedicatedQuizAnswer("bus", quizResult);
    setResults(value => [...value, quizResult]);
    setInput("");
    setWordHints(0);
    setRevealedAnswer(null);
    const dialogue = BUS_PASSWORD_NARRATIONS[index] ?? "Password unlocked. Find the next password.";
    setSuccessMessage(dialogue);
    if (playAnswerAudio) {
      setAnswerSpeaking(true);
      setShowingCorrectAnswer(true);
      speak(word.english, "female", () => {
        setShowingCorrectAnswer(false);
        speak(dialogue, "adventure", () => setAnswerSpeaking(false));
      });
    } else {
      setAnswerSpeaking(false);
      setShowingCorrectAnswer(false);
    }
  };
  useEffect(() => {
    [
      ...BUS_PASSWORD_NARRATIONS,
      "Password unlocked. Find the next password.",
      BUS_WELCOME_NARRATION,
      BUS_INTRO_NARRATION,
      BUS_FINAL_NARRATION,
      BUS_FAILED_NARRATION,
    ].forEach(line => preloadGeneratedSpeech(line, "adventure"));
    BUS_WORD_POOL.forEach(item => preloadGeneratedSpeech(item.english, "female"));
  }, []);
  useEffect(() => {
    if (stage !== "quiz" || secondsLeft <= 0) return;
    const timer = window.setInterval(() => setSecondsLeft(value => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [stage, secondsLeft]);
  useEffect(() => {
    if (stage === "quiz" && secondsLeft === 0) setStage("failed");
  }, [stage, secondsLeft]);
  useEffect(() => {
    if (stage === "quiz") {
      cancel();
      return cancel;
    }
    const line = stage === "welcome"
      ? BUS_WELCOME_NARRATION
      : stage === "intro" ? BUS_INTRO_NARRATION
      : stage === "happy" ? BUS_FINAL_NARRATION
      : stage === "running" ? "I can catch the bus now!"
      : BUS_FAILED_NARRATION;
    speak(line, "adventure");
    return cancel;
  }, [stage, word, speak, cancel]);
  // Bus Stop answers stay silent while the player is working. Korean is
  // spoken only after a correct submission, followed by its narration.
  useEffect(() => { localStorage.setItem(busLayoutKey(quizRomanisationEnabled), JSON.stringify(busLayout)); }, [busLayout, quizRomanisationEnabled]);
  useEffect(() => { localStorage.setItem(busGeometryKey(quizRomanisationEnabled), JSON.stringify(busTaskGeometry)); }, [busTaskGeometry, quizRomanisationEnabled]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "[" || event.code === "BracketLeft") { event.preventDefault(); toggleBusEditorWithoutMovingItems(busTaskPanelRef.current, setBusLayoutEditing, setBusLayout); return; }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (answerSpeaking) return;
        if (stage === "quiz" && revealedAnswer) advance();
        else if (stage === "quiz" && !successMessage) completeWord();
        else advance();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const typedAnswer = input.trim().toLowerCase();
    const romanisedAnswer = romanisedBusWords[word.english]?.toLowerCase() ?? "";
    const answerScript: QuizAnswerScript = /[a-z]/i.test(typedAnswer) ? "Romanisation" : "Hangul";
    const correct = typedAnswer === word.english.toLowerCase() || (quizRomanisationEnabled && Boolean(romanisedAnswer) && typedAnswer === romanisedAnswer);
    if (!correct) {
      setWrong((n) => n + 1);
      recordWorldQuizAttempt(busQuizScene(word.chinese), word.chinese, false, answerScript, word.english);
      const quizResult: QuizRunWordResult = { korean: word.english, english: capitaliseStandalone(word.chinese), correct: false, mode: difficulty, answerScript };
      recordDedicatedQuizAnswer("bus", quizResult);
      setResults(value => [...value, quizResult]);
      setRevealedAnswer(capitaliseStandalone(quizAnswerGuide));
      setInput("");
      setWordHints(0);
      return;
    }
    completeWord(true, answerScript);
  };
  const hint = () => {
    if (wordHints >= 3) return;
    setHints((n) => n + 1);
    setWordHints((n) => n + 1);
  };
  const romanisedBusWords: Record<string, string> = { "아이스크림": "aiseukeurim", "주세요": "juseyo", "감사합니다": "gamsahamnida", "천만에요": "cheonmaneyo", "가게": "gage", "닭고기": "dalgogi", "물": "mul", "사과": "sagwa", "침대": "chimdae", "달리다": "dallida", "뛰다": "ttwida", "오르다": "oreuda", "사과와 바나나": "sagwa wa banana" };
  useEffect(() => { const sync = (event: Event) => { const next = Boolean((event as CustomEvent<boolean>).detail); setBusLayout(readBusLayout(next)); setBusTaskGeometry(readBusGeometry(next)); setQuizRomanisationEnabled(next); }; window.addEventListener("taletalk-romanisation-change", sync); return () => window.removeEventListener("taletalk-romanisation-change", sync); }, []);
  const quizAnswerGuide = quizRomanisationEnabled ? romanisedBusWords[word.english] ?? "" : word.english;
  const romanLetterCount = [...quizAnswerGuide].filter(letter => letter !== " ").length;
  const missingCount = quizMissingLetterCount(romanLetterCount, difficulty);
  const missingIndexes = new Set([...quizAnswerGuide].map((letter, index) => ({ letter, index })).filter(({ letter }) => letter !== " ").sort(({ index: a }, { index: b }) => ((a * 17 + quizAnswerGuide.length * 7) % 29) - ((b * 17 + quizAnswerGuide.length * 7) % 29)).slice(0, missingCount).map(({ index }) => index));
  const quizHint = [...capitaliseStandalone(quizAnswerGuide)].map((letter, index) => letter === " " ? " " : missingIndexes.has(index) ? "_" : letter).join("");
  const revealedIndexes = stableLetterIndexes(word.english, .3);
  const showingQuizPanel = stage === "quiz" && !successMessage;
  const passiveNarration = stage === "welcome" ? BUS_WELCOME_NARRATION
    : stage === "intro" ? BUS_INTRO_NARRATION
    : stage === "happy" ? BUS_FINAL_NARRATION
    : stage === "running" ? "Jessica runs towards the bus with her ticket ready."
    : stage === "failed" ? BUS_FAILED_NARRATION
    : null;
  const showingNarration = Boolean(successMessage || passiveNarration);
  return (
    <div
      className="fixed inset-0 overflow-hidden bg-black"
      onClick={(event) => {
        if (!showingNarration) return;
        if (event.target instanceof HTMLElement && event.target.closest("button,input,form")) return;
        if (answerSpeaking) {
          cancel();
          setAnswerSpeaking(false);
        }
        advance();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        nextHome();
      }}
    >
      <SceneImage src={image} alt="Jessica at the bus stop" />
      <div className="absolute inset-0 bg-black/35" />
      <header className="scene-header">
        <button onClick={onBack}>Map</button>
      </header>
      <main ref={busTaskPanelRef} className={`scene-panel ${showingQuizPanel ? "bus-quiz-panel" : showingNarration ? "story-dialogue-panel cursor-pointer" : ""}`} style={showingQuizPanel && busTaskGeometry ? { "--bus-task-left": `${busTaskGeometry.left}%`, "--bus-task-top": `${busTaskGeometry.top}%`, "--bus-task-width": `${busTaskGeometry.width}%`, "--bus-task-height": `${busTaskGeometry.height}%`, "--bus-task-bottom": "auto", "--bus-task-transform": "none" } as React.CSSProperties : undefined} onClickCapture={(event) => { if (busLayoutEditing) { event.preventDefault(); event.stopPropagation(); } }}>
        {stage === "welcome" || stage === "intro" ? <div className="story-dialogue-content">
          <div className="scene-eyebrow"><span className="cop-narrator-dot" />{isChinese ? "旁白" : "Narrator"}</div>
          <p className="story-dialogue-text">{passiveNarration}</p>
          <div className="cop-narration-footer">
            <span>{isChinese ? "点击任意位置继续" : "click anywhere to continue"}</span>
            <button type="button" onClick={(event) => { event.stopPropagation(); if (passiveNarration) speak(passiveNarration, "adventure"); }}><Volume2 size={12} /> {isChinese ? "听发音" : "Listen"}</button>
          </div>
        </div> : stage === "quiz" && revealedAnswer ? (
          <>
            <div className="scene-eyebrow">Incorrect</div>
            <h1>Correct answer: <strong className="text-[#f6d46b]">{revealedAnswer}</strong></h1>
            <button className="scene-action" onClick={advance}>Continue <ArrowRight size={16} /></button>
          </>
        ) : stage === "quiz" && successMessage && showingCorrectAnswer ? (
          <>
            <div className="scene-eyebrow">Correct</div>
            <h1>Correct answer: <strong className="text-[#f6d46b]">{capitaliseStandalone(quizAnswerGuide)}</strong></h1>
          </>
        ) : stage === "quiz" && successMessage ? (
          <div className="story-dialogue-content">
            <div className="scene-eyebrow"><span className="cop-narrator-dot" />{isChinese ? "旁白" : "Narrator"}</div>
            <p className="story-dialogue-text">{successMessage}</p>
            <div className="cop-narration-footer">
              <span>{answerSpeaking ? (isChinese ? "正在播放…" : "playing narration…") : (isChinese ? "点击任意位置继续" : "click anywhere to continue")}</span>
              <button type="button" onClick={(event) => { event.stopPropagation(); speak(successMessage, "adventure"); }}><Volume2 size={12} /> {isChinese ? "听发音" : "Listen"}</button>
            </div>
          </div>
        ) : stage === "quiz" && (
          <>
            <BusLayoutItem id="description" editing={busLayoutEditing} offsets={busLayout} onMove={(id, x, y) => setBusLayout(layout => ({ ...layout, [id]: { x, y } }))}>
              <p className="bus-quiz-description">Help Jessica find the passwords to her bus tickets!</p>
            </BusLayoutItem>
            {busLayoutEditing && <><div className="task-panel-center-guide" aria-hidden="true" /><BusTaskEditorControls panelRef={busTaskPanelRef} onChange={setBusTaskGeometry} /></>}
            <BusLayoutItem id="progress" editing={busLayoutEditing} offsets={busLayout} onMove={(id, x, y) => setBusLayout(layout => ({ ...layout, [id]: { x, y } }))}>
            <div className="scene-progress">
              Word {index + 1} / {questionWords.length} · Score {grade}%
            </div>
            <div className="scene-progress text-amber-200">Time left {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</div>
            </BusLayoutItem>
            <BusLayoutItem id="mode" editing={busLayoutEditing} offsets={busLayout} onMove={(id, x, y) => setBusLayout(layout => ({ ...layout, [id]: { x, y } }))}>
              <QuizModeMenu value={difficulty} onChange={setDifficulty} />
            </BusLayoutItem>
            <BilingualTypeCue english={word.english} chinese={word.chinese} value={input} showEnglish={false} showRomanisationText={false} wrapLine={(lineId, content) => <BusLayoutItem id={`word-${lineId}`} editing={busLayoutEditing} offsets={busLayout} onMove={(id, x, y) => setBusLayout(layout => ({ ...layout, [id]: { x, y } }))}>{content}</BusLayoutItem>} />
            <BusLayoutItem id="hint" editing={busLayoutEditing} offsets={busLayout} onMove={(id, x, y) => setBusLayout(layout => ({ ...layout, [id]: { x, y } }))}><p className="font-mono text-xl tracking-[.16em] text-[#f0d88f]">{quizHint}</p></BusLayoutItem>
            <BusLayoutItem id="input" editing={busLayoutEditing} offsets={busLayout} onMove={(id, x, y) => setBusLayout(layout => ({ ...layout, [id]: { x, y } }))}><form className="scene-form" onSubmit={submit}>
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type the Korean word…"
              />
              <button>Enter</button>
            </form></BusLayoutItem>
          </>
        )}
        {stage === "happy" && (
          <div className="story-dialogue-content">
            <div className="scene-eyebrow"><span className="cop-narrator-dot" />{isChinese ? "旁白" : "Narrator"}</div>
            <p className="story-dialogue-text">{BUS_FINAL_NARRATION}</p>
            <div className="cop-narration-footer">
              <span>{isChinese ? "点击任意位置继续" : "click anywhere to continue"}</span>
              <button type="button" onClick={(event) => { event.stopPropagation(); speak(BUS_FINAL_NARRATION, "adventure"); }}><Volume2 size={12} /> {isChinese ? "听发音" : "Listen"}</button>
            </div>
          </div>
        )}
        {stage === "running" && (
          <div className="story-dialogue-content">
            <div className="scene-eyebrow"><span className="cop-narrator-dot" />{isChinese ? "旁白" : "Narrator"}</div>
            <p className="story-dialogue-text">{passiveNarration}</p>
            <div className="cop-narration-footer"><span>{isChinese ? "点击任意位置继续" : "click anywhere to continue"}</span><button type="button" onClick={(event) => { event.stopPropagation(); if (passiveNarration) speak(passiveNarration, "adventure"); }}><Volume2 size={12} /> Listen</button></div>
          </div>
        )}
        {stage === "failed" && (
          <div className="story-dialogue-content">
            <div className="scene-eyebrow"><span className="cop-narrator-dot" />{isChinese ? "旁白" : "Narrator"}</div>
            <p className="story-dialogue-text">{BUS_FAILED_NARRATION}</p>
            <div className="cop-narration-footer"><span>{isChinese ? "点击任意位置继续" : "click anywhere to continue"}</span><button type="button" onClick={(event) => { event.stopPropagation(); speak(BUS_FAILED_NARRATION, "adventure"); }}><Volume2 size={12} /> Listen</button></div>
          </div>
        )}
      </main>
    </div>
  );
}

const HOME_LINES_EN = [
  "Joshua returns home. He can sense trouble nearby.",
  "",
  "His wife looks at him with a stare that could burn holes into the back of his head.",
  "She asks if he has been sleeping all day in the hammock drinking beer, when she asked him to do a million jobs before.",
  "Joshua hands her the flower—his last resort, a desperate man's attempt at world peace.",
  "She hugs him. Peace has returned to the world.",
  "At long last, Joshua finds what he's been looking for all day: a beer in one hand and a smile on his face.",
  "Just then, a football hits him in the face.",
  "His son George looks at him sheepishly.",
  "미안해. George says to him.",
  "Joshua asks him why he isn’t at Sports Day.",
  "George replies that he’s no good at that kind of stuff.",
  "“Nonsense,” Joshua says.",
  "He tells him that they will go over before it’s too late, and they’ll show them what he can do.",
];

export function HomeAdventure({
  onBack,
  onHomeComplete,
}: Pick<Props, "onBack" | "onHomeComplete">) {
  const [step, setStep] = useState(0);
  const { speak, cancel } = useSpeech();
  const [flowerTaskOpen, setFlowerTaskOpen] = useState(false);
  const [flowerInput, setFlowerInput] = useState("");
  const [flowerWrong, setFlowerWrong] = useState(false);
  const flowerCompletingRef = useRef(false);
  const [sorryTaskOpen, setSorryTaskOpen] = useState(false);
  const [sorryInput, setSorryInput] = useState("");
  const [sorryWrong, setSorryWrong] = useState(false);
  const sorryCompletingRef = useRef(false);
  const [homeRomanisation, setHomeRomanisation] = useState(() => localStorage.getItem("taletalk-romanisation-enabled") === "true");
  const homeLine = HOME_LINES_EN[step] ?? "";
  const homeImages = useMemo(
    () => [
      assetUrl("scenes/home/return-home-e1.webp"),
      assetUrl("scenes/home/return-home-e2.webp"),
      assetUrl("scenes/home/return-home-e3.webp"),
      assetUrl("scenes/home/return-home-e4.webp"),
      assetUrl("scenes/home/return-home-e5.webp"),
      assetUrl("scenes/home/return-home-e6.webp"),
      assetUrl("scenes/home/return-home-f1.webp"),
      assetUrl("scenes/home/return-home-f2.webp"),
      assetUrl("scenes/home/return-home-f3.webp"),
      assetUrl("scenes/home/return-home-f4.webp"),
      assetUrl("scenes/home/return-home-f4.webp"),
      assetUrl("scenes/home/return-home-f4.webp"),
      assetUrl("scenes/home/return-home-f4.webp"),
      assetUrl("scenes/home/return-home-f4.webp"),
    ],
    [],
  );
  useEffect(() => preloadSceneWindow(homeImages, step, 12), [homeImages, step]);
  useEffect(() => {
    HOME_LINES_EN.forEach((line, lineIndex) => {
      if (!line) return;
      if (lineIndex === 9) {
        preloadGeneratedSpeech("미안해", "character");
        preloadGeneratedSpeech("George says to him.", "adventure");
      } else {
        preloadGeneratedSpeech(line, "adventure");
      }
    });
    preloadGeneratedSpeech("꽃", "female");
    preloadGeneratedSpeech("미안해", "character");
  }, []);
  const playHomeLine = () => {
    if (step === 9) speak("미안해", "character", () => speak("George says to him.", "adventure"));
    else speak(homeLine, "adventure");
  };
  useEffect(() => {
    if (!homeLine || flowerTaskOpen || sorryTaskOpen) return cancel;
    playHomeLine();
    return cancel;
  }, [homeLine, flowerTaskOpen, sorryTaskOpen, step, speak, cancel]);
  useEffect(() => {
    if (!flowerTaskOpen) return;
    speak("꽃", "female");
  }, [flowerTaskOpen, speak]);
  useEffect(() => {
    if (!sorryTaskOpen) return;
    speak("미안해", "character");
  }, [sorryTaskOpen, speak]);
  useEffect(() => {
    const sync = (event: Event) => setHomeRomanisation(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("taletalk-romanisation-change", sync);
    return () => window.removeEventListener("taletalk-romanisation-change", sync);
  }, []);
  const nextHome = () => {
    if (flowerTaskOpen || sorryTaskOpen) return;
    if (step === 3) {
      setFlowerTaskOpen(true);
      return;
    }
    if (step === 8) {
      setSorryTaskOpen(true);
      return;
    }
    if (step < homeImages.length - 1) setStep((n) => n + 1);
    else onHomeComplete();
  };
  const completeFlower = () => {
    if (flowerCompletingRef.current) return;
    flowerCompletingRef.current = true;
    setFlowerWrong(false);
    unlock("꽃", "home");
    speak("꽃", "female", () => {
      setFlowerTaskOpen(false);
      setFlowerInput("");
      setStep(4);
      flowerCompletingRef.current = false;
    });
  };
  const submitFlower = (event: React.FormEvent) => {
    event.preventDefault();
    const answer = flowerInput.trim().toLowerCase().replace(/[\s-]+/g, "");
    if (answer !== "꽃" && !(homeRomanisation && answer === "kkot")) {
      setFlowerWrong(true);
      return;
    }
    completeFlower();
  };
  const completeSorry = () => {
    if (sorryCompletingRef.current) return;
    sorryCompletingRef.current = true;
    setSorryWrong(false);
    unlock("미안해", "home");
    speak("미안해", "character", () => {
      setSorryTaskOpen(false);
      setSorryInput("");
      setStep(9);
      sorryCompletingRef.current = false;
    });
  };
  const submitSorry = (event: React.FormEvent) => {
    event.preventDefault();
    const answer = sorryInput.trim().toLowerCase().replace(/[\s-]+/g, "");
    if (answer !== "미안해" && !(homeRomanisation && answer === "mianhae")) {
      setSorryWrong(true);
      return;
    }
    completeSorry();
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight") return;
      event.preventDefault();
      if (flowerTaskOpen) completeFlower();
      else if (sorryTaskOpen) completeSorry();
      else nextHome();
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  });
  return (
    <div className="fixed inset-0 overflow-hidden bg-black" onClick={(event) => {
      if (event.target instanceof HTMLElement && event.target.closest("button,input,form")) return;
      nextHome();
    }}>
      <SceneImage src={homeImages[step]} alt="Returning Home" imageNumber={step + 1} />
      <div className="absolute inset-0 bg-black/35" />
      <header className="scene-header">
        <button onClick={onBack}>Map</button>
      </header>
      <SceneWordLibrary scene="home" />
      {homeLine && !flowerTaskOpen && !sorryTaskOpen && <div className="absolute bottom-0 left-0 right-0 z-20">
        <div className="px-6 pb-5 pt-8" style={{ background: "linear-gradient(0deg, rgba(8,27,67,0.34) 0%, rgba(8,27,67,0.12) 70%, transparent 100%)" }}>
          <div className="mx-auto max-w-lg">
            <div className="mb-2 flex items-center gap-2.5">
              <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#ccc]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Narrator</span>
            </div>
            <p className="text-2xl leading-snug text-white" style={{ fontFamily: "'Playfair Display', serif" }}>{homeLine}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-white/40">click anywhere to continue</span>
              <button className="flex items-center gap-1.5 text-[11px] text-white/50 transition-colors hover:text-white" onClick={(event) => { event.stopPropagation(); playHomeLine(); }}><Volume2 size={12} /> Listen</button>
            </div>
          </div>
        </div>
      </div>}
      {flowerTaskOpen && <div className="absolute inset-x-0 bottom-5 z-30 flex justify-center px-4" onClick={(event) => event.stopPropagation()}>
        <form data-task-editor-panel="returning-home-flower" className="shared-task-bar-ui relative w-full max-w-xl rounded-2xl border border-[#f0d88f]/55 bg-[#081b1a]/95 px-5 pb-4 pt-5 shadow-2xl" onSubmit={submitFlower}>
          <button data-task-editor-item="close" type="button" className="absolute right-3 top-3 text-white/55 hover:text-white" onClick={() => { flowerCompletingRef.current = false; setFlowerTaskOpen(false); setFlowerInput(""); setFlowerWrong(false); }} aria-label="Close flower task">×</button>
          <p data-task-editor-item="instruction" className="text-[11px] font-semibold uppercase tracking-[.15em] text-[#f7d678]">Type the Korean word matching the English to progress</p>
          <div className="mt-2 flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <span data-task-editor-item="english-cue" className="block text-xl font-semibold text-white/75">Flower</span>
              <button data-task-editor-item="korean-cue" type="button" className="mt-1 inline-flex items-center gap-2 text-4xl font-semibold text-white" onClick={() => speak("꽃", "female")}><LiveAnswerLetters target="꽃" value={/[가-힣]/.test(flowerInput) ? flowerInput : ""} neutralClassName="text-white" /><Volume2 size={21} className="text-[#f7d678]" /></button>
              {homeRomanisation && <span data-task-editor-item="romanisation-cue" className="mt-1 block text-lg font-semibold text-sky-200"><LiveAnswerLetters target="Kkot" value={/[a-z]/i.test(flowerInput) ? flowerInput : ""} neutralClassName="text-sky-200" /></span>}
            </div>
          </div>
          <div data-task-editor-item="answer-form" className="mt-3 flex gap-2"><input autoFocus value={flowerInput} onChange={(event) => { setFlowerInput(event.target.value); setFlowerWrong(false); }} placeholder="Type the Korean word..." className="min-w-0 flex-1 rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#f7d678]" /><button className="rounded-xl bg-[#d9a525] px-5 font-semibold text-[#171006]">Enter</button></div>
          {flowerWrong && <p data-task-editor-item="error-message" className="mt-2 text-xs text-red-300">Not quite—try again.</p>}
        </form>
      </div>}
      {sorryTaskOpen && <div className="absolute inset-x-0 bottom-5 z-30 flex justify-center px-4" onClick={(event) => event.stopPropagation()}>
        <form data-task-editor-panel="returning-home-sorry" className="shared-task-bar-ui relative w-full max-w-xl rounded-2xl border border-[#f0d88f]/55 bg-[#081b1a]/95 px-5 pb-4 pt-5 shadow-2xl" onSubmit={submitSorry}>
          <button data-task-editor-item="close" type="button" className="absolute right-3 top-3 text-white/55 hover:text-white" onClick={() => { sorryCompletingRef.current = false; setSorryTaskOpen(false); setSorryInput(""); setSorryWrong(false); }} aria-label="Close sorry task">×</button>
          <p data-task-editor-item="instruction" className="text-[11px] font-semibold uppercase tracking-[.15em] text-[#f7d678]">Type the Korean word matching the English to progress</p>
          <div className="mt-2">
            <span data-task-editor-item="english-cue" className="block text-xl font-semibold text-white/75">Sorry</span>
            <button data-task-editor-item="korean-cue" type="button" className="mt-1 inline-flex items-center gap-2 text-4xl font-semibold text-white" onClick={() => speak("미안해", "character")}><LiveAnswerLetters target="미안해" value={/[가-힣]/.test(sorryInput) ? sorryInput : ""} neutralClassName="text-white" /><Volume2 size={21} className="text-[#f7d678]" /></button>
            {homeRomanisation && <span data-task-editor-item="romanisation-cue" className="mt-1 block text-lg font-semibold text-sky-200"><LiveAnswerLetters target="Mianhae" value={/[a-z]/i.test(sorryInput) ? sorryInput : ""} neutralClassName="text-sky-200" /></span>}
          </div>
          <div data-task-editor-item="answer-form" className="mt-3 flex gap-2"><input autoFocus value={sorryInput} onChange={(event) => { setSorryInput(event.target.value); setSorryWrong(false); }} placeholder="Type the Korean word..." className="min-w-0 flex-1 rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#f7d678]" /><button className="rounded-xl bg-[#d9a525] px-5 font-semibold text-[#171006]">Enter</button></div>
          {sorryWrong && <p data-task-editor-item="error-message" className="mt-2 text-xs text-red-300">Not quite—try again.</p>}
        </form>
      </div>}
    </div>
  );
}

type SportsStage =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16;
const SPORTS_COPY: Record<SportsStage, string> = {
  1: "准备，开始，跑！",
  2: "仔细听，用英语动作单词帮助威廉完成每一个项目。",
  3: "赛跑即将开始。请在计时结束前输入动作单词。",
  4: "前面有一个跨栏。威廉应该做什么？",
  5: "跳得真好！威廉继续前进。",
  6: "接下来是攀爬墙。请输入动作单词。",
  7: "他到达了顶端，继续前进。",
  8: "选择能让威廉前往下一站的动作。",
  9: "下一个挑战是把器材搬过操场。",
  10: "输入两个动作，完成搬运挑战。",
  11: "现在输入完成任务所需的动作。",
  12: "终点线就在眼前。输入最后一个动作单词。",
  13: "运动日完成了！",
  14: "威廉做到了！他因努力获得了一枚奖牌。",
  15: "晚餐准备好了。乔希很开心、很温暖，也为威廉感到骄傲。",
  16: "晚餐准备好了。乔希很开心、很温暖，也为威廉感到骄傲。",
};
const SPORTS_COPY_EN: Record<SportsStage, string> = {
  1: "George and Joshua approach the sports ground.",
  2: "Joshua gives him a pep talk as he prepares for his race, trying to dispel his nervousness. He tells him to just do his best, and that he’ll be cheering him on from the sidelines.",
  3: "The race is about to start. Type the action words before the timer runs out.",
  4: "There is a hurdle ahead. What should William do?",
  5: "A great jump! William keeps moving forward.",
  6: "Next is the climbing wall. Type the action word.",
  7: "He reaches the top and keeps going.",
  8: "Choose the action that lets William reach the next stop.",
  9: "The next challenge is carrying equipment across the field.",
  10: "Type two actions to complete the carrying challenge.",
  11: "Now type the action needed to complete the task.",
  12: "The finish line is in sight.",
  13: "Type Finish to complete Sports Day.",
  14: "After a well-fought battle, they return home at last, a job well done. It wasn't quite the Olympics, but it was the next best thing.",
  15: "At long last he can finally relax in his hammock, a flat beer in one hand and a not-so smile on his face. The appeal of sitting in his hammock is now long gone.",
  16: "And just at that moment he hears his name called for dinner. A perfect end to a perfect day.",
};

export function SportsDayAdventure({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  const [stage, setStage] = useState<SportsStage>(1);
  useLoopingSceneAmbience("audio/sports-day-soft-crowd.mp3", 0.192, stage < 14);
  const [answers, setAnswers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [wrong, setWrong] = useState(false);
  const [seconds, setSeconds] = useState(120);
  const [raceFailed, setRaceFailed] = useState(false);
  const [sportsRomanisation, setSportsRomanisation] = useState(() => localStorage.getItem("taletalk-romanisation-enabled") === "true");
  const { isChinese } = useLanguage();
  const { speak, cancel } = useSpeech();
  const sportsCopy = SPORTS_COPY_EN[stage];
  const timed = stage >= 3 && stage <= 13;
  const expected: Partial<Record<SportsStage, string[]>> = {
    3: ["start", "run"],
    4: ["jump"],
    6: ["climb"],
    8: ["walk"],
    10: ["pick up", "carry"],
    11: ["put down"],
    13: ["finish"],
  };
  const koreanActions: Record<string, string> = { start: "시작하다", run: "달리다", jump: "뛰다", climb: "오르다", walk: "걷다", "pick up": "줍다", carry: "나르다", "put down": "내려놓다", finish: "끝내다" };
  const sportsRomanise: Record<string, string> = { "시작하다": "sijakhada", "달리다": "dallida", "뛰다": "ttwida", "오르다": "oreuda", "걷다": "geotda", "줍다": "jupda", "나르다": "nareuda", "내려놓다": "naeryeonota", "끝내다": "kkeutnaeda" };
  const toggleSportsRomanisation = () => { const next = !sportsRomanisation; setSportsRomanisation(next); localStorage.setItem("taletalk-romanisation-enabled", String(next)); window.dispatchEvent(new CustomEvent("taletalk-romanisation-change", { detail: next })); };
  useEffect(() => { const sync = (event: Event) => setSportsRomanisation(Boolean((event as CustomEvent<boolean>).detail)); window.addEventListener("taletalk-romanisation-change", sync); return () => window.removeEventListener("taletalk-romanisation-change", sync); }, []);
  const currentEnglishAnswer = expected[stage]?.[answers.length] ?? "";
  const currentAnswer = koreanActions[currentEnglishAnswer] ?? "";
  const wordChoices: Record<string, [string, string]> = {
    start: ["start", "put down"],
    run: ["run", "climb"],
    jump: ["jump", "walk"],
    climb: ["climb", "run"],
    walk: ["walk", "jump"],
    "pick up": ["pick up", "carry"],
    carry: ["carry", "put down"],
    "put down": ["put down", "start"],
    finish: ["finish", "walk"],
  };
  const currentWordChoices = (wordChoices[currentEnglishAnswer] ?? []).map(word => koreanActions[word]);
  const sportsList = ["finish", "carry", "jump", "start", "walk", "climb", "put down", "run", "pick up"];
  const needsTyping = Boolean(expected[stage]);
  const transientSuccess = stage === 5 || stage === 7 || stage === 9;
  const imageStage = raceFailed ? 3 : stage;
  const sportsImageName = imageStage === 10 && answers.length > 0
    ? "g10-picked-up-v2.png"
    : imageStage === 15 || imageStage === 16
      ? `g${imageStage}-v3.png`
      : `g${imageStage}.png`;
  const image = assetUrl(`scenes/sports-day/${sportsImageName}`);
  useEffect(() => {
    Object.values(SPORTS_COPY_EN).forEach(line => preloadGeneratedSpeech(line, "adventure"));
    Object.values(koreanActions).forEach(word => preloadGeneratedSpeech(word, "female"));
  }, []);
  useEffect(() => {
    const sportsImages = Array.from({ length: 16 }, (_, index) => {
      const number = index + 1;
      return assetUrl(`scenes/sports-day/${number === 15 || number === 16 ? `g${number}-v3.png` : `g${number}.png`}`);
    });
    sportsImages.splice(10, 0, assetUrl("scenes/sports-day/g10-picked-up-v2.png"));
    preloadSceneWindow(sportsImages, Math.max(0, imageStage - 1), 12);
  }, [imageStage]);

  const playSportsNarration = () => {
    if (stage === 1) {
      speak("George and Joshua approach the sports ground.", "adventure");
      return;
    }
    if (stage === 2) {
      speak("Joshua gives him a pep talk as he prepares for his race, trying to dispel his nervousness. He tells him to just do his best, and that he’ll be cheering him on from the sidelines.", "adventure");
      return;
    }
    if (stage === 12) {
      speak("The finish line is in sight.", "adventure");
      return;
    }
    if (stage === 14) {
      speak("After a well-fought battle, they return home at last, a job well done. It wasn't quite the Olympics, but it was the next best thing.", "adventure");
      return;
    }
    if (stage === 15) {
      speak("At long last he can finally relax in his hammock, a flat beer in one hand and a not-so smile on his face. The appeal of sitting in his hammock is now long gone.", "adventure");
      return;
    }
    if (stage === 16) {
      speak("And just at that moment he hears his name called for dinner. A perfect end to a perfect day.", "adventure");
      return;
    }
    speak(sportsCopy, "adventure");
  };

  useEffect(() => {
    if (raceFailed || timed) return;
    playSportsNarration();
    return cancel;
  }, [raceFailed, sportsCopy, speak, cancel]);

  useEffect(() => {
    if (!needsTyping || !currentAnswer || raceFailed) return;
    speak(currentAnswer, "female");
    return cancel;
  }, [needsTyping, currentAnswer, raceFailed, speak, cancel]);

  useEffect(() => {
    if (!timed || seconds <= 0 || raceFailed) return;
    const timer = window.setInterval(
      () => setSeconds((value) => value - 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [timed, seconds, raceFailed]);

  useEffect(() => {
    if (seconds === 0 && timed) setRaceFailed(true);
  }, [seconds, timed]);

  const next = () => {
    setStage((value) => Math.min(16, value + 1) as SportsStage);
    setAnswers([]);
    setInput("");
    setWrong(false);
  };
  useEffect(() => {
    if (!transientSuccess) return;
    // Keep each action frame visible, but never stop for a success caption.
    const timer = window.setTimeout(next, 700);
    return () => window.clearTimeout(timer);
  }, [transientSuccess, stage]);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const words = (expected[stage] ?? []).map(word => koreanActions[word]);
    const answer = input.trim();
    if (answer !== words[answers.length]) {
      setWrong(true);
      return;
    }
    unlock(answer, "sports");
    speak(answer, "female", () => {
      setInput("");
      setWrong(false);
      if (answers.length + 1 < words.length)
        setAnswers((value) => [...value, answer]);
      else next();
    });
  };
  const retry = () => {
    setStage(3);
    setSeconds(120);
    setRaceFailed(false);
    setAnswers([]);
    setWrong(false);
  };
  const skipWithCorrectAnswer = () => {
    if (stage === 16) {
      onComplete();
      return;
    }
    if (raceFailed) {
      retry();
      return;
    }
    const requiredAnswers = expected[stage]?.map(word => koreanActions[word]);
    if (requiredAnswers) {
      requiredAnswers.slice(answers.length).forEach(answer => unlock(answer, "sports"));
      next();
      return;
    }
    next();
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight") return;
      event.preventDefault();
      skipWithCorrectAnswer();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div className="sports-day-adventure fixed inset-0 overflow-hidden bg-black" onClick={(event) => {
      if (stage > 2 || event.target instanceof HTMLElement && event.target.closest("button,input,form")) return;
      next();
    }}>
      <SceneImage src={image} alt="Sports Day" imageNumber={imageStage} />
      <div className="absolute inset-0 bg-black/35" />
      <header className="scene-header" onClick={(event) => event.stopPropagation()}>
        <button onClick={onBack}>Map</button>
      </header>
      {timed && <div className="pointer-events-none absolute right-5 top-20 z-40 rounded-2xl border-2 border-[#f7d678] bg-[#14221d]/95 px-6 py-2.5 text-center shadow-[0_0_26px_rgba(240,216,143,.45)]"><span className="block text-[10px] font-bold uppercase tracking-[.22em] text-[#f7d678]">Time left</span><strong className="block font-mono text-4xl font-black leading-none tabular-nums text-white">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</strong></div>}
      <SceneWordLibrary scene="sports" />
      {needsTyping && <aside className="sports-task-bar absolute z-30 w-max max-w-[min(19rem,calc(100vw-2rem))]" style={{ left: "1.1%", top: "8%" }}><div className="text-[15px] font-semibold uppercase tracking-wider text-[#f7d678]">Sports words</div><div>{sportsList.map(word => <div key={word} className={`py-1 text-white/80 ${sportsRomanisation ? "text-[15px]" : "text-[17.25px]"}`}><div className="flex items-center gap-1"><span className="text-[#f0d88f]">{koreanActions[word]}</span><b className="font-medium text-white">{capitaliseStandalone(word)}</b><button type="button" className="ml-1 inline-flex rounded p-1 text-[#f7d678] hover:bg-white/10 hover:text-white" onClick={(event) => { event.stopPropagation(); speak(koreanActions[word], "female"); }} aria-label={`Hear ${koreanActions[word]}`}><Volume2 size={14} /></button></div>{sportsRomanisation && <small className="block pl-0.5 text-[10.875px] tracking-wide text-sky-200">{capitaliseStandalone(sportsRomanise[koreanActions[word]])}</small>}</div>)}</div></aside>}
      {!transientSuccess && <main className={`scene-panel ${!needsTyping && !raceFailed ? "story-dialogue-panel" : ""}`} onClick={(event) => {
        event.stopPropagation();
        if (raceFailed || needsTyping || event.target instanceof HTMLElement && event.target.closest("button,input,form")) return;
        if (stage === 16) onComplete(); else next();
      }}>
        {!needsTyping && !raceFailed ? (
          <div className="story-dialogue-content">
            <div className="scene-eyebrow"><span className="cop-narrator-dot" />Narrator</div>
            <p className="story-dialogue-text">{sportsCopy}</p>
            <div className="cop-narration-footer">
              <span>{stage === 16 ? "click anywhere to finish" : "click anywhere to continue"}</span>
              <button onClick={(event) => { event.stopPropagation(); playSportsNarration(); }}><Volume2 size={12} /> Listen</button>
            </div>
          </div>
        ) : raceFailed ? (
          <>
          <h1>Try again.</h1>
          <button className="scene-action" onClick={retry}>
            Try again <ArrowRight size={16} />
          </button>
          </>
        ) : (
          <>
            <p className="mb-3 text-center text-base font-semibold tracking-wide text-[#f7d678]">Type the Korean word matching the English to progress</p>
            <BilingualTypeCue english={currentAnswer} chinese={currentEnglishAnswer} value={input} showEnglish={false} showRomanisationControl={false} showRomanisationText={false} />
            <form className="scene-form" onSubmit={submit}>
              <button type="button" className="task-close" onClick={onBack}>×</button>
              <input
                autoFocus
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type the Korean action…"
              />
              <button>Enter</button>
            </form>
            {wrong && <p className="scene-error">Try again.</p>}
          </>
        )}
      </main>}
    </div>
  );
}

const COP_SCENES = [
  {
    image: "i1.png",
    text: "我们的故事在离上一次不远的地方继续。",
    english: "Our story continues not far from where we were last.",
  },
  {
    image: "i1.png",
    text: "凌乱的公寓里坐着梅森侦探。离婚正式结束已经六个月了，他仍然没能见到女儿。",
    english: "Inside a messy apartment sits Detective Mason. Six months have passed since the divorce was finalised, and still he has not been able to see his daughter.",
  },
  {
    image: "i2.png",
    text: "他的律师打电话告诉他，妻子现在要求得到他拥有的一切的百分之九十。这让他笑了，因为他想着希望能靠剩下的百分之十退休。",
    english: "His lawyer calls to tell him his wife is now demanding 90% of everything he owns. This makes him laugh as he thinks about how he hopes to retire on the last 10%.",
  },
  { image: "i3.png", text: "但事实是，梅森已经和工作结婚了。", english: "But the truth is, Mason is already married to the job." },
  { image: "i4-no-sofa-coat.png", text: "喝完一杯咖啡后，他准备离开公寓。", english: "One coffee later, he is ready to leave the apartment." },
  { image: "i5-hallway-no-briefcase.png", text: "他打开门，走进安静的走廊。", english: "He opens the door and steps into the quiet hallway." },
  { image: "i6.png", text: "一位年长的女士正在楼梯旁艰难地搬着沉重的篮子。", english: "An older woman is struggling with a heavy basket at the stairs." },
  {
    image: "i7 a.png",
    text: "梅森开始下楼，然后停了下来。有些事情比下一桩案子更重要。",
    english: "Mason starts down the stairs, then stops. Some things are more important than the next case.",
  },
  {
    image: "i7 b.png",
    text: "他帮她把篮子搬下楼。有那么一刻，帮助别人就已经足够了。",
    english: "He carries her basket downstairs. For a moment, helping someone is enough.",
  },
] as const;

const COP_CAR_SCENES = [
  { image: "i8.webp", text: "雨越下越大。梅森站在警车旁，知道今晚还没有结束。", english: "The rain grows heavier. Mason stands beside the police car, knowing the night is not over." },
  { image: "i9.png", text: "他坐进副驾驶座，关上车门。", english: "He climbs into the passenger seat and closes the door." },
  { image: "i10.png", text: "他的搭档看了他一眼，雨水顺着挡风玻璃流下。他问梅森是不是还在接前妻的电话。", english: "His partner glances at him as rain streams down the windscreen. He tells Mason that he looks like crap and asks, ‘Is your wife still calling you?’" },
  { image: "i11.png", text: "梅森告诉他，他现在的前妻想做什么都可以，又说他应该少吃甜甜圈，因为他已经胖得不止一点点了。", english: "Mason tells him that his now ex-wife can do whatever she wants, and that he should stop eating the donuts, as he is getting more than a little fat." },
  { image: "i11-chief-arnold-donut-v2.png", text: "阿诺德警长笑了。每个人都有自己的嗜好：他的是甜甜圈，梅森的是抓住蒙面男爵。", english: "Chief Arnold laughs. Everyone has their own vices: his is donuts; Mason's is catching the Masked Baron." },
  { image: "i12-v4.png", text: "梅森厉声斥责他，骤然变得危险的神情甚至让阿诺德也感到害怕。他告诉阿诺德，这座城市唯一真正的恶习就是蒙面男爵；他宁愿死，也不会让这种不公再多逍遥一天。剩下的车程里，两人沉默不语，雨滴轻轻敲打着车窗。", english: "Mason snaps at him, his attitude turning deadly enough to scare Arnold. He tells him the only true vice this city has is the Masked Baron, and he'll die before he lets that injustice walk free a day longer than it has to. They sit in silence for the rest of the ride, the rain pattering gently against the windows." },
] as const;

export function CopAdventure({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [roomUnlocked, setRoomUnlocked] = useState(false);
  const [coffeeReady, setCoffeeReady] = useState(false);
  const [bedUnlocked, setBedUnlocked] = useState(false);
  const [hallwayStage, setHallwayStage] = useState<number | null>(null);
  const [carStage, setCarStage] = useState<number | null>(null);
  const [carOpeningBeat, setCarOpeningBeat] = useState<"rain" | "dog-bubble" | "dog-task" | "dog-result" | "car-bubble" | "newspaper-task">("rain");
  const [newspaperUnlocked, setNewspaperUnlocked] = useState(false);
  const carTaskReturnBeatRef = useRef<"dog-bubble" | "car-bubble">("dog-bubble");
  const [hallwayChoice, setHallwayChoice] = useState<"help" | "leave" | null>(null);
  const [copPointNotice, setCopPointNotice] = useState<"good" | "bad" | null>(null);
  const [roomNarration, setRoomNarration] = useState<string | null>(null);
  const [pendingRoomTask, setPendingRoomTask] = useState<{
    word: string;
    text: string;
    english: string;
  } | null>(null);
  const [taskInput, setTaskInput] = useState("");
  const [taskWrong, setTaskWrong] = useState(false);
  const [roomMemory, setRoomMemory] = useState<{
    word: string;
    text: string;
    english: string;
  } | null>(null);
  const { isChinese } = useLanguage();
  const { speak, cancel } = useSpeech();
  const scene = COP_SCENES[sceneIndex];
  const hallwayScene = hallwayStage === null ? null : COP_SCENES[[5, 6, 7, 8][hallwayStage]];
  const carScene = carStage === null ? null : COP_CAR_SCENES[carStage];
  const displayedScene = carScene ?? hallwayScene ?? (roomUnlocked
    ? coffeeReady ? { image: "i4.png" } : COP_SCENES[3]
    : scene);
  const dogResultNarration = isChinese ? "你抚摸它时，它也舔了舔你。" : "When you pet him, he licks you back.";
  const sceneText = carScene
    ? carStage === 0 && carOpeningBeat === "dog-result"
      ? dogResultNarration
      : isChinese ? carScene.text : carScene.english
    : hallwayScene
    ? hallwayStage === 2 && hallwayChoice === "leave"
      ? isChinese ? "梅森继续下楼，把那位女士留在了楼梯旁。" : "Mason continues downstairs, leaving the older woman at the stairs."
      : isChinese ? hallwayScene.text : hallwayScene.english
    : isChinese ? scene.text : scene.english;
  const hasFinishedIntro = sceneIndex === 3;
  const roomInstruction = isChinese ? "探索梅森的公寓。" : "Explore Mason's apartment.";
  const coffeeNarration = isChinese ? "喝完咖啡后，他几乎准备好出发了。" : "Now that he's had his coffee, he is nearly ready to go.";

  useEffect(() => {
    COP_SCENES.forEach(item => preloadGeneratedSpeech(item.english, "adventure"));
    COP_CAR_SCENES.forEach(item => preloadGeneratedSpeech(item.english, "adventure"));
    [
      "The coffee is still warm.",
      "A bed for two that has only ever known one since Mason moved in.",
      "When you pet him, he licks you back.",
      roomInstruction,
      coffeeNarration,
    ].forEach(line => preloadGeneratedSpeech(line, "adventure"));
    ["개", "문", "신문"].forEach(word => preloadGeneratedSpeech(word, "female"));
  }, []);
  useEffect(() => {
    const copImages = [
      ...COP_SCENES.slice(0, 4).map(item => assetUrl(`scenes/cop/${item.image}`)),
      assetUrl("scenes/cop/i4.png"),
      ...COP_SCENES.slice(4).map(item => assetUrl(`scenes/cop/${item.image}`)),
      ...COP_CAR_SCENES.map(item => assetUrl(`scenes/cop/${item.image}`)),
    ];
    const currentImage = assetUrl(`scenes/cop/${displayedScene.image}`);
    preloadSceneWindow(copImages, Math.max(0, copImages.indexOf(currentImage)), 12);
  }, [displayedScene.image]);
  useLayoutEffect(() => {
    if (roomUnlocked) {
      cancel();
      return;
    }
    if (carStage === 0 && carOpeningBeat !== "rain" && carOpeningBeat !== "dog-result") {
      cancel();
      return;
    }
    speak(sceneText, "adventure");
    return cancel;
  }, [roomUnlocked, hallwayStage, carStage, carOpeningBeat, sceneText, speak, cancel]);

  const next = () => {
    cancel();
    if (carStage !== null) {
      if (carStage < COP_CAR_SCENES.length - 1) setCarStage(stage => stage + 1);
      else onComplete();
      return;
    }
    if (hallwayStage !== null) {
      if (hallwayStage === 0) setHallwayStage(1);
      else if (hallwayStage === 2 && hallwayChoice === "help") setHallwayStage(3);
      else if (hallwayStage === 2) {
        // Declining skips only the basket-help image. The story still
        // continues to the police car and unlocks the remaining sequence.
        setHallwayStage(null);
        setCarOpeningBeat("rain");
        setCarStage(0);
      }
      else if (hallwayStage === 3) {
        setHallwayStage(null);
        setCarOpeningBeat("rain");
        setCarStage(0);
      }
      return;
    }
    if (roomUnlocked) return;
    if (hasFinishedIntro) {
      setRoomUnlocked(true);
      setTaskInput("");
      setTaskWrong(false);
      setRoomMemory(null);
      setCoffeeReady(false);
      setBedUnlocked(false);
      setRoomNarration(null);
      return;
    }
    setSceneIndex((index) => index + 1);
    setTaskInput("");
    setTaskWrong(false);
    setRoomMemory(null);
  };
  const requiredTask = roomMemory?.word;
  const isHallwayChoice = hallwayStage === 1;
  const koreanCopTasks: Record<string, string> = { "drink coffee": "커피를 마시다", bed: "침대", door: "문", dog: "개", newspaper: "신문" };
  const romanisedCopTasks: Record<string, string[]> = {
    "drink coffee": ["keopireul masida", "keopirel masida"],
    bed: ["chimdae"],
    door: ["mun"],
    dog: ["gae"],
    newspaper: ["sinmun"],
  };
  const requiredTarget = requiredTask ? koreanCopTasks[requiredTask] ?? requiredTask : "";
  const submitTask = (event: React.FormEvent) => {
    event.preventDefault();
    const typedAnswer = taskInput.normalize("NFKC").trim().toLowerCase().replace(/[-\s]+/g, " ");
    const romanisationEnabled = localStorage.getItem("taletalk-romanisation-enabled") === "true";
    const acceptedAnswers = requiredTask
      ? [requiredTarget, ...(romanisationEnabled ? romanisedCopTasks[requiredTask] ?? [] : [])]
          .map(answer => answer.normalize("NFKC").trim().toLowerCase().replace(/[-\s]+/g, " "))
      : [];
    if (!requiredTask || !acceptedAnswers.includes(typedAnswer)) {
      setTaskWrong(true);
      return;
    }
    completeTask(requiredTask);
  };
  useEffect(() => {
    if (requiredTarget) speak(requiredTarget, "female");
  }, [requiredTarget, speak]);
  const completeTask = (task: string) => {
    unlock(task, "cop");
    speak(koreanCopTasks[task] ?? task, "female", () => {
      setTaskInput("");
      setTaskWrong(false);
      if (roomMemory?.word === "drink coffee") {
        setCoffeeReady(true);
        setRoomMemory(null);
        setRoomNarration(coffeeNarration);
        speak(coffeeNarration, "adventure");
        return;
      }
      if (roomMemory?.word === "bed") {
        const narration = isChinese ? "一张双人床，自从梅森搬进来以后，却只睡过一个人。" : "A bed for two that has only ever known one since Mason moved in.";
        setBedUnlocked(true);
        setRoomMemory(null);
        setRoomNarration(narration);
        speak(narration, "adventure");
        return;
      }
      if (roomMemory?.word === "dog") {
        setRoomMemory(null);
        setCarOpeningBeat("dog-result");
        return;
      }
      if (roomMemory?.word === "newspaper") {
        setNewspaperUnlocked(true);
        setRoomMemory(null);
        setCarOpeningBeat(carTaskReturnBeatRef.current);
        return;
      }
      if (roomMemory?.word === "door") {
        setRoomMemory(null);
        setRoomUnlocked(false);
        setHallwayStage(0);
        setHallwayChoice(null);
        setRoomNarration(null);
        return;
      }
      setRoomMemory(null);
    });
  };
  const chooseHallwayAction = (choice: "help" | "leave") => {
    const slot = Number(localStorage.getItem("taletalk_active_save_slot") ?? "1");
    const key = `taletalk-slot-${slot}-${choice === "help" ? "good" : "bad"}-cop-points`;
    localStorage.setItem(key, String(Number(localStorage.getItem(key) ?? 0) + 5));
    window.dispatchEvent(new Event("taletalk-cop-points-changed"));
    setCopPointNotice(choice === "help" ? "good" : "bad");
    setHallwayChoice(choice);
    setHallwayStage(2);
  };
  useEffect(() => {
    if (!copPointNotice) return;
    const timeout = window.setTimeout(() => setCopPointNotice(null), 2100);
    return () => window.clearTimeout(timeout);
  }, [copPointNotice]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight") return;
      event.preventDefault();
      if (requiredTask) {
        completeTask(requiredTask);
        return;
      }
      if (hallwayStage === 1) {
        chooseHallwayAction("help");
        return;
      }
      if (carStage === 0) {
        if (carOpeningBeat === "rain") {
          cancel();
          setCarOpeningBeat("dog-bubble");
        } else if (carOpeningBeat === "dog-bubble") {
          setCarOpeningBeat("dog-task");
          setRoomMemory({ word: "dog", text: "개", english: "Dog" });
        } else if (carOpeningBeat === "dog-result") {
          cancel();
          setCarOpeningBeat("car-bubble");
        } else if (carOpeningBeat === "car-bubble") {
          setCarStage(1);
        }
        return;
      }
      next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cancel, carOpeningBeat, carStage, completeTask, hallwayStage, next, requiredTask]);

  const roomHotspots = [
    ...(!coffeeReady ? [{
      word: "drink coffee",
      text: "咖啡还是温的。",
      english: "The coffee is still warm.",
      left: "22.3%",
      top: "35.2%",
      width: "3.1%",
      height: "5.1%",
    }] : []),
    {
      word: "files",
      text: "这里是梅森每天花好几个小时翻看的侦探档案。他花在这些档案上的时间，比花在妻子身上的时间还多。",
      english: "Here are the detective files Mason spends hours each day looking over, spending more time on them than he ever did with his wife.",
      left: "83%",
      top: "87%",
      width: "4.5%",
      height: "4.2%",
    },
    {
      word: "pizza",
      text: "安吉洛披萨。披萨很糟糕，但价格很合适。",
      english: "Angelo's Pizza. The pizza was terrible, but the price was right.",
      left: "9.1%",
      top: "84.4%",
      width: "5.4%",
      height: "5.7%",
    },
    ...(!bedUnlocked ? [{
      word: "bed",
      text: "",
      english: "",
      left: "46.2%",
      top: "33.8%",
      width: "2.4%",
      height: "4.7%",
    }] : []),
    {
      word: "black-baron",
      text: "梅森咬紧牙关。蒙面男爵多逍遥法外一个夜晚，世间就多一个不公的夜晚。",
      english: "Mason grits his teeth. One more night the Masked Baron hasn't been arrested is one more night of injustice.",
      left: "64.1%",
      top: "14.4%",
      width: "3.5%",
      height: "4.4%",
    },
    {
      word: "door",
      text: "门现在可以使用了。点击离开公寓。",
      english: "The door is usable. Click it to leave the apartment.",
      left: "31.9%",
      top: "37.8%",
      width: "3.6%",
      height: "3.6%",
      locked: false,
    },
  ];
  const hotspotEnglish: Record<string, string> = {
    "drink coffee": "Drink coffee", files: "Detective files", pizza: "Angelo's pizza",
    bed: "Bed", "black-baron": "The Masked Baron", door: "Door",
  };
  useEffect(() => {
    document.querySelectorAll(".cop-adventure .hotspot-tooltip").forEach((tooltip) => {
      const word = tooltip.closest("button")?.getAttribute("aria-label") ?? "";
      if (hotspotEnglish[word]) tooltip.textContent = hotspotEnglish[word];
    });
  }, [roomUnlocked, coffeeReady, bedUnlocked]);
  const hotspotChinese: Record<string, string> = {
    "drink coffee": "喝咖啡", files: "侦探档案", pizza: "安吉洛披萨",
    bed: "床", "black-baron": "蒙面男爵", door: "门",
  };
  const showCopPanel = !(carStage === 0 && (carOpeningBeat === "dog-bubble" || carOpeningBeat === "car-bubble"));
  return (
    <div className="cop-adventure fixed inset-0 overflow-hidden bg-black" onClick={(event) => {
      if (event.target instanceof HTMLElement && event.target.closest("button,input,form")) return;
      if (pendingRoomTask) {
        cancel();
        setRoomMemory(pendingRoomTask);
        setPendingRoomTask(null);
        setRoomNarration(null);
        setTaskInput("");
        setTaskWrong(false);
        return;
      }
      if (roomUnlocked && roomNarration) {
        cancel();
        setRoomNarration(null);
        return;
      }
      if (carStage === 0) {
        if (carOpeningBeat === "rain") {
          cancel();
          setCarOpeningBeat("dog-bubble");
        } else if (carOpeningBeat === "dog-result") {
          cancel();
          setCarOpeningBeat("car-bubble");
        }
        return;
      }
      if (!roomUnlocked || (hallwayStage !== null && hallwayStage !== 1)) next();
    }}>
      <SceneImage
        src={assetUrl(`scenes/cop/${displayedScene.image}`)}
        alt="Detective Mason"
      />
      <div className="absolute inset-0 bg-black/35" />
      {carStage === 0 && carOpeningBeat === "dog-bubble" && (
        <button
          className="absolute z-20 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#f0d88f] bg-[#c4942a]/25"
          style={{ left: "68.2%", top: "85.7%", width: "46px", height: "46px", boxShadow: "0 0 22px rgba(240,216,143,.8)" }}
          onClick={(event) => {
            event.stopPropagation();
            setCarOpeningBeat("dog-task");
            setRoomMemory({ word: "dog", text: "개", english: "Dog" });
            setTaskInput("");
            setTaskWrong(false);
          }}
          aria-label="dog"
        >
          <span className="hotspot-pulse" />
          <span className="hotspot-tooltip cop-door-tooltip">Dog</span>
        </button>
      )}
      {carStage === 0 && (carOpeningBeat === "dog-bubble" || carOpeningBeat === "car-bubble") && (
        <button
          className="absolute z-20 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#f0d88f] bg-[#c4942a]/25"
          style={{ left: "41.5%", top: "47%", width: "46px", height: "46px", boxShadow: "0 0 22px rgba(240,216,143,.8)" }}
          onClick={(event) => { event.stopPropagation(); setCarStage(1); }}
          aria-label="Enter the police car"
        >
          <span className="hotspot-pulse" />
          <span className="hotspot-tooltip cop-door-tooltip">Enter the police car</span>
        </button>
      )}
      {carStage === 0 && !newspaperUnlocked && (carOpeningBeat === "dog-bubble" || carOpeningBeat === "car-bubble") && (
        <button
          className="absolute z-20 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#f0d88f] bg-[#c4942a]/25"
          style={{ left: "78.7%", top: "58.9%", width: "46px", height: "46px", boxShadow: "0 0 22px rgba(240,216,143,.8)" }}
          onClick={(event) => {
            event.stopPropagation();
            carTaskReturnBeatRef.current = carOpeningBeat;
            setCarOpeningBeat("newspaper-task");
            setRoomMemory({ word: "newspaper", text: "신문", english: "Newspaper" });
            setTaskInput("");
            setTaskWrong(false);
          }}
          aria-label="newspaper"
        >
          <span className="hotspot-pulse" />
          <span className="hotspot-tooltip cop-door-tooltip">Newspaper</span>
        </button>
      )}
      {copPointNotice && (
        <div className={`cop-point-notice ${copPointNotice}`} role="status" aria-live="polite">
          <span>+5</span>
          <strong>{copPointNotice === "good" ? "Good Cop" : "Bad Cop"}</strong>
          <small>{copPointNotice === "good" ? "You helped the older woman" : "You left the older woman behind"}</small>
        </div>
      )}
      {roomUnlocked && !roomMemory && !pendingRoomTask &&
        roomHotspots.map((item) => (
          <button
            key={item.word}
            className="absolute z-20 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#f0d88f] bg-[#c4942a]/25"
            style={{
              left: item.left,
              top: item.top,
              width: "46px",
              height: "46px",
              boxShadow: "0 0 22px rgba(240,216,143,.8)",
            }}
            onClick={() => {
              if (item.word === "files" || item.word === "pizza" || item.word === "black-baron") {
                const narration = isChinese ? item.text : item.english;
                setRoomNarration(narration);
                speak(narration, "adventure");
                return;
              }
              if (item.word === "drink coffee") {
                const narration = isChinese ? item.text : item.english;
                setPendingRoomTask(item);
                setRoomNarration(narration);
                speak(narration, "adventure");
                return;
              }
              setRoomMemory(item);
              setTaskInput("");
              setTaskWrong(false);
            }}
            aria-label={item.word}
          >
            <span className="hotspot-pulse" />
            <span className="hotspot-tooltip cop-door-tooltip">{hotspotEnglish[item.word]}</span>
          </button>
        ))}
      <header className="scene-header">
        <button onClick={onBack}>{isChinese ? "地图" : "Map"}</button>
      </header>
      <SceneWordLibrary scene="cop" position="left" />
      {showCopPanel && <main data-task-editor-panel={requiredTask ? `detective-mason-${requiredTask}` : undefined} className={`scene-panel ${requiredTask ? "" : isHallwayChoice ? "cop-choice-task-panel shared-task-bar-ui" : "story-dialogue-panel cursor-pointer"}`}>
        <div className={requiredTask ? "" : isHallwayChoice ? "cop-choice-task-content" : "story-dialogue-content"}>
        {!requiredTask && <div className="scene-eyebrow">{!isHallwayChoice && <span className="cop-narrator-dot" />}{isHallwayChoice ? (isChinese ? "你会怎么做？" : "What do you do?") : isChinese ? "旁白" : "Narrator"}</div>}
        {!requiredTask && <p className="story-dialogue-text">{roomMemory ? (isChinese ? roomMemory.text : roomMemory.english) : roomUnlocked ? (roomNarration ?? roomInstruction) : sceneText}</p>}
        {requiredTask ? (
          <form className="scene-form" onSubmit={submitTask}>
            <button data-task-editor-item="close" type="button" className="task-close" onClick={(event) => { event.stopPropagation(); if (requiredTask === "dog") setCarOpeningBeat("dog-bubble"); if (requiredTask === "newspaper") setCarOpeningBeat(carTaskReturnBeatRef.current); setRoomMemory(null); setTaskInput(""); setTaskWrong(false); }}>×</button>
            <span data-task-editor-item="instruction" className="block w-fit text-[11px] font-semibold uppercase tracking-[.12em] text-[#c4942a]">Type the Korean word using the keyboard</span>
            <BilingualTypeCue
              english={requiredTarget}
              chinese={requiredTask}
              value={taskInput}
              showEnglish
              showChinese
              emphasizeChinese
              displayEnglish={requiredTarget}
              wrapLine={(id, content) => <div data-task-editor-item={`word-${id}`}>{content}</div>}
            />
            <div data-task-editor-item="answer-form" className="flex w-full gap-2">
              <input
                autoFocus
                value={taskInput}
                onChange={(event) => setTaskInput(event.target.value)}
                placeholder="Type the Korean words..."
              />
              <button>{isChinese ? "检查" : "Check"}</button>
            </div>
            {taskWrong && <div data-task-editor-item="error-message" className="scene-error">{isChinese ? "再试一次。" : "Try again."}</div>}
          </form>
        ) : pendingRoomTask ? (
          <div className="cop-narration-footer"><span>{isChinese ? "点击任意位置继续" : "click anywhere to continue"}</span><button onClick={(event) => { event.stopPropagation(); speak(isChinese ? pendingRoomTask.text : pendingRoomTask.english, "adventure"); }}><Volume2 size={12} /> {isChinese ? "听发音" : "Listen"}</button></div>
        ) : hallwayStage === 1 ? (
          <div className="scene-choices">
            <p>{isChinese ? "你会帮助她吗？" : "Will Mason help her?"}</p>
            <button onClick={() => chooseHallwayAction("help")}>
              {isChinese ? "帮助那位女士" : "Help the older woman"}
            </button>
            <button onClick={() => chooseHallwayAction("leave")}>
              {isChinese ? "继续离开" : "Keep walking"}
            </button>
          </div>
        ) : (
          <div className="cop-narration-footer">
            <span>{carStage === 0 && carOpeningBeat === "car-bubble"
              ? isChinese ? "点击警车继续" : "click the police car to continue"
              : roomUnlocked && !roomNarration
              ? isChinese ? "探索发光点" : "explore the glowing points"
              : isChinese ? "点击任意位置继续" : "click anywhere to continue"}</span>
            <button onClick={(event) => {
              event.stopPropagation();
              const narration = roomUnlocked ? (roomNarration ?? roomInstruction) : sceneText;
              speak(narration, "adventure");
            }}><Volume2 size={12} /> {isChinese ? "听发音" : "Listen"}</button>
          </div>
        )}
        </div>
      </main>}
    </div>
  );
}

const MUSIC_SCENES = [
  { image: "1a.png", text: "灌木丛里，他紧紧抱着吉他。", english: "In the dead of night, love remains anything but dead. Adam, a hopeless romantic—more hopeless than romantic—peeks out from the bushes." },
  { image: "2a.png", text: "他从灌木丛里悄悄探出头来。", english: "He quietly peeks out from the bushes." },
  { image: "4a.png", text: "终于，他带着吉他走向那所房子。", english: "He quietly makes his way towards the house." },
  { image: "5a-v5.png", text: "他轻轻朝窗户扔了一颗小石子。", english: "He tosses some loose stones at the window." },
  { image: "6a.png", text: "屋里，杰西卡正安静地做作业。", english: "Despite the stress and success of her exams earlier, Jessica remains hard at work for her upcoming assessments." },
  { image: "7a-v5.png", text: "她听见窗外的声音，抬起头来。", english: "Just at that moment, she hears something tapping against her window." },
  { image: "8a-v5.png", text: "杰西卡走到窗边，想知道是谁在那里。", english: "She moves towards her balcony." },
  { image: "9-v4.png", text: "她打开窗户，夜风吹进房间。", english: "She peeks outside, checking who it might be." },
  { image: "11-v4.png", text: "他站在窗外，轻轻弹起吉他，希望她会喜欢。", english: "She sees her classmate and neighbor Adam waving up at her. ‘What’s this?’ she wonders." },
  { image: "12.png", text: "旋律在安静的花园里慢慢响起。", english: "The melody drifts softly through the quiet garden." },
  { image: "13.png", text: "杰西卡听见音乐，脸上露出了笑容。", english: "Jessica hears the music and a smile appears on her face." },
  { image: "14.png", text: "他继续演奏，把每一个音符都献给她。", english: "He keeps playing, giving every note to her." },
  { image: "15.png", text: "她喜欢这首歌，也喜欢这份小小的勇气。", english: "She likes the song, and the small courage behind it." },
  { image: "16.png", text: "男孩看见她的笑容，觉得一切都值得。", english: "When he sees her smile, the boy feels it was all worth it." },
  { image: "17.png", text: "可是夜已经很深了。", english: "But the night is getting late." },
  { image: "18.png", text: "杰西卡看了看手表，惊讶地发现时间不早了。", english: "Jessica checks her watch, surprised to see how late it is." },
  { image: "19.png", text: "她向他挥手，说自己该回去了。", english: "She waves to him and says that she has to leave." },
  { image: "20.png", text: "她离开了花园，音乐也渐渐停了下来。", english: "She leaves the garden, and the music slowly fades." },
] as const;

const MUSIC_QUIZ_START = 9;
const MUSIC_POST_QUIZ_START = 14;
const MUSIC_QUIZ_WORDS = [
  { english: "bed", chinese: "床", song: "你的拥抱比一张 bed 更温暖，让我整夜都梦见你。", memoryImage: "scenes/cop/i4.png" },
  { english: "drink coffee", chinese: "喝咖啡", song: "你唤醒我的心，就像清晨我 drink coffee 时一样。", memoryImage: "scenes/cop/i4.png" },
  { english: "start", chinese: "开始", song: "月光落在你脸上时，我的心才真正 start。", memoryImage: "scenes/sports-day/g3.png" },
  { english: "run", chinese: "跑", song: "为了追上你的微笑，我愿意 run 穿过每一条星光小路。", memoryImage: "scenes/sports-day/g3.png" },
  { english: "jump", chinese: "跳", song: "你一回头，我的心就 jump 得像夜空里的烟花。", memoryImage: "scenes/sports-day/g4.png" },
  { english: "climb", chinese: "爬", song: "为了靠近你的窗，我愿意 climb 上月亮做的楼梯。", memoryImage: "scenes/sports-day/g6.png" },
  { english: "shop", chinese: "商店", song: "Every quiet shop closes, but my song for you stays awake.", memoryImage: "scenes/shop/c1-v3.png" },
  { english: "water", chinese: "水", song: "Your voice moves through the night as softly as water.", memoryImage: "scenes/shop/c2-v3.png" },
  { english: "finish", chinese: "完成", song: "I hope this quiet song will not 끝내다 before the morning light.", memoryImage: "scenes/sports-day/g13.png" },
] as const;
const MUSIC_QUESTION_COUNT = 8;
const MUSIC_KOREAN_LESSONS: Record<string, { target: string; gloss: string; song: string }> = {
  bed: { target: "침대", gloss: "bed", song: "Your embrace is warmer than a 침대, and I dream of you all night." },
  "drink coffee": { target: "커피를 마시다", gloss: "drink coffee", song: "You wake my heart, just as 커피를 마시다 wakes me in the morning." },
  start: { target: "시작하다", gloss: "start", song: "When moonlight falls on your face, my heart can finally 시작하다." },
  run: { target: "달리다", gloss: "run", song: "To catch your smile, I would 달리다 along every starlit path." },
  jump: { target: "뛰다", gloss: "jump", song: "When you turn around, my heart will 뛰다 like fireworks in the night." },
  climb: { target: "오르다", gloss: "climb", song: "To get closer to your window, I would 오르다 a ladder made of moonlight." },
  shop: { target: "가게", gloss: "shop", song: "Every quiet 가게 closes, but my song for you stays awake." },
  water: { target: "물", gloss: "water", song: "Your voice moves through the night as softly as 물." },
  coffee: { target: "커피", gloss: "coffee", song: "Even warm 커피 cannot wake my heart the way you do." },
  finish: { target: "끝내다", gloss: "finish", song: "I hope this quiet song will not 끝내다 before the morning light." },
};

export function NightMusicAdventure({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [input, setInput] = useState("");
  const [wrong, setWrong] = useState(0);
  const [hints, setHints] = useState(0);
  const [quizResults, setQuizResults] = useState<QuizRunWordResult[]>([]);
  const [musicQuestionWords, setMusicQuestionWords] = useState(() => shuffledQuizWords(MUSIC_QUIZ_WORDS).slice(0, MUSIC_QUESTION_COUNT));
  const [singing, setSinging] = useState(false);
  const [sungDialogue, setSungDialogue] = useState(false);
  const [revealedQuizAnswer, setRevealedQuizAnswer] = useState(false);
  const [quizFailed, setQuizFailed] = useState(false);
  const [quizRomanisationEnabled, setQuizRomanisationEnabled] = useState(() => localStorage.getItem("taletalk-romanisation-enabled") === "true");
  const [quizDifficulty, setQuizDifficulty] = useState<QuizDifficulty>("normal");
  const [musicLayoutEditing, setMusicLayoutEditing] = useState(false);
  const [musicLayout, setMusicLayout] = useState<BusLayoutOffsets>(() => readBusLayout(quizRomanisationEnabled));
  const [musicTaskGeometry, setMusicTaskGeometry] = useState<BusTaskGeometry | null>(() => readBusGeometry(quizRomanisationEnabled));
  const musicTaskPanelRef = useRef<HTMLElement>(null);
  const soundtrackRef = useRef<HTMLAudioElement | null>(null);
  const { isChinese } = useLanguage();
  const { speak, cancel } = useSpeech();
  useEffect(() => { stopPrimedSceneAmbience(); }, []);
  const scene = MUSIC_SCENES[sceneIndex];
  const quizActive = sceneIndex >= MUSIC_QUIZ_START && sceneIndex < MUSIC_POST_QUIZ_START && quizIndex < musicQuestionWords.length;
  const musicActive = sceneIndex >= MUSIC_QUIZ_START && sceneIndex < MUSIC_POST_QUIZ_START;
  const quizWord = quizActive ? musicQuestionWords[quizIndex] : null;
  const quizLesson = quizWord ? MUSIC_KOREAN_LESSONS[quizWord.english] : null;
  const quizTarget = quizLesson?.target ?? quizWord?.english ?? "";
  const text = quizWord ? "He plays his guitar softly and waits for you to write the Korean word he sings." : scene.english;
  const grade = Math.round((musicQuestionWords.length - wrong) / musicQuestionWords.length * 100);
  const revealedIndexes = quizWord ? stableLetterIndexes(quizTarget, .3) : [];
  const romanisedMusicWords: Record<string, string> = { "침대": "chimdae", "커피를 마시다": "keopireul masida", "시작하다": "sijakhada", "달리다": "dallida", "뛰다": "ttwida", "오르다": "oreuda", "가게": "gage", "물": "mul", "커피": "keopi", "끝내다": "kkeutnaeda" };
  const quizAnswerGuide = quizRomanisationEnabled ? romanisedMusicWords[quizTarget] ?? "" : quizTarget;
  const romanLetterCount = [...quizAnswerGuide].filter(letter => letter !== " ").length;
  const missingCount = quizMissingLetterCount(romanLetterCount, quizDifficulty);
  const missingIndexes = new Set([...quizAnswerGuide].map((letter, index) => ({ letter, index })).filter(({ letter }) => letter !== " ").sort(({ index: a }, { index: b }) => ((a * 17 + quizAnswerGuide.length * 7) % 29) - ((b * 17 + quizAnswerGuide.length * 7) % 29)).slice(0, missingCount).map(({ index }) => index));
  const quizHint = [...capitaliseStandalone(quizAnswerGuide)].map((letter, index) => letter === " " ? " " : missingIndexes.has(index) ? "_" : letter).join("");
  const moveMusicLayoutItem = (id: string, x: number, y: number) => setMusicLayout(layout => ({ ...layout, [id]: { x, y } }));

  useEffect(() => {
    MUSIC_SCENES.forEach(item => preloadGeneratedSpeech(item.english, "adventure"));
    Object.values(MUSIC_KOREAN_LESSONS).forEach(item => {
      preloadGeneratedSpeech(item.target, "female");
      const [beforeTarget, afterTarget = ""] = item.song.split(item.target);
      if (beforeTarget.trim()) preloadGeneratedSpeech(beforeTarget.trim(), "adventure");
      if (afterTarget.trim()) preloadGeneratedSpeech(afterTarget.trim().replace(/^,\s*/, ""), "adventure");
    });
  }, []);
  useEffect(() => {
    preloadSceneWindow(MUSIC_SCENES.map(item => assetUrl(`scenes/music/${item.image}`)), sceneIndex, 12);
  }, [sceneIndex]);
  useLayoutEffect(() => {
    if (quizWord) {
      if (sungDialogue) {
        const song = quizLesson?.song ?? quizWord.song;
        const target = quizLesson?.target ?? "";
        const [beforeTarget, afterTarget = ""] = target ? song.split(target) : [song, ""];
        const spokenParts = [
          { text: beforeTarget.trim(), voice: "adventure" as const },
          ...(target ? [{ text: target, voice: "female" as const }] : []),
          { text: afterTarget.trim().replace(/^,\s*/, ""), voice: "adventure" as const },
        ].filter(part => Boolean(part.text));
        let stopped = false;
        const playPart = (partIndex: number) => {
          if (stopped || partIndex >= spokenParts.length) return;
          const part = spokenParts[partIndex];
          speak(part.text, part.voice, () => playPart(partIndex + 1));
        };
        playPart(0);
        return () => { stopped = true; cancel(); };
      }
      cancel();
      return cancel;
    }
    speak(text, "adventure");
    return cancel;
  }, [quizWord, quizLesson?.song, sungDialogue, text, speak, cancel]);
  useEffect(() => { const sync = (event: Event) => { const next = Boolean((event as CustomEvent<boolean>).detail); setMusicLayout(readBusLayout(next)); setMusicTaskGeometry(readBusGeometry(next)); setQuizRomanisationEnabled(next); }; window.addEventListener("taletalk-romanisation-change", sync); return () => window.removeEventListener("taletalk-romanisation-change", sync); }, []);
  useEffect(() => { localStorage.setItem(busLayoutKey(quizRomanisationEnabled), JSON.stringify(musicLayout)); }, [musicLayout, quizRomanisationEnabled]);
  useEffect(() => { localStorage.setItem(busGeometryKey(quizRomanisationEnabled), JSON.stringify(musicTaskGeometry)); }, [musicTaskGeometry, quizRomanisationEnabled]);
  useEffect(() => {
    if (!musicActive) {
      soundtrackRef.current?.pause();
      if (soundtrackRef.current) soundtrackRef.current.currentTime = 0;
      return;
    }
    const ensureGuitarMusic = () => {
      const track = soundtrackRef.current ?? new Audio(assetUrl("audio/Paper Strings.mp3"));
      track.loop = true;
      track.volume = 0.28;
      track.muted = localStorage.getItem("taletalk-sound-muted") === "true";
      soundtrackRef.current = track;
      if (!track.muted) void track.play().catch(() => undefined);
    };
    ensureGuitarMusic();
    window.addEventListener("pointerdown", ensureGuitarMusic, { capture: true });
    window.addEventListener("keydown", ensureGuitarMusic, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", ensureGuitarMusic, { capture: true });
      window.removeEventListener("keydown", ensureGuitarMusic, { capture: true });
    };
  }, [musicActive]);
  useEffect(() => () => {
    soundtrackRef.current?.pause();
    if (soundtrackRef.current) soundtrackRef.current.currentTime = 0;
    soundtrackRef.current = null;
  }, []);

  const advance = () => {
    cancel();
    setSungDialogue(false);
    setRevealedQuizAnswer(false);
    if (quizWord) {
      if (quizIndex < musicQuestionWords.length - 1) {
        const nextQuizIndex = quizIndex + 1;
        setQuizIndex(nextQuizIndex);
        const quizImageCount = MUSIC_POST_QUIZ_START - MUSIC_QUIZ_START;
        setSceneIndex(MUSIC_QUIZ_START + (nextQuizIndex % quizImageCount));
      } else if (grade >= 50) {
        saveDedicatedQuizSummary("music", "Night Music Quiz", quizResults);
        soundtrackRef.current?.pause();
        if (soundtrackRef.current) soundtrackRef.current.currentTime = 0;
        setQuizIndex(musicQuestionWords.length);
        setSceneIndex(MUSIC_POST_QUIZ_START);
      } else {
        saveDedicatedQuizSummary("music", "Night Music Quiz", quizResults);
        setQuizFailed(true);
      }
      return;
    }
    if (sceneIndex < MUSIC_SCENES.length - 1) {
      if (sceneIndex + 1 === MUSIC_QUIZ_START) {
        const track = soundtrackRef.current ?? new Audio(assetUrl("audio/Paper Strings.mp3"));
        track.loop = true;
        track.volume = 0.28;
        track.muted = localStorage.getItem("taletalk-sound-muted") === "true";
        soundtrackRef.current = track;
        if (!track.muted) void track.play().catch(() => undefined);
      }
      setSceneIndex(index => index + 1);
    }
    else if (grade >= 50) onComplete();
    else setQuizFailed(true);
  };
  const solveQuizWord = (recordCorrect = true, answerScript: QuizAnswerScript = quizRomanisationEnabled ? "Romanisation" : "Hangul") => {
    if (!quizWord || singing) return;
    unlock(quizTarget, "music");
    if (recordCorrect) recordWorldQuizAttempt(musicQuizScene(quizWord.english), quizWord.english, true, answerScript, quizTarget);
    setInput("");
    setRevealedQuizAnswer(false);
    // Night Music mirrors Bus Stop: no answer audio is given in advance, and
    // the Korean target plays once only after a correct answer.
    if (recordCorrect) {
      const quizResult: QuizRunWordResult = { korean: quizTarget, english: capitaliseStandalone(quizLesson?.gloss ?? quizWord.english), correct: true, mode: quizDifficulty, answerScript };
      recordDedicatedQuizAnswer("music", quizResult);
      setQuizResults(value => [...value, quizResult]);
      setSinging(true);
      speak(quizTarget, "female", () => {
        setSinging(false);
        setSungDialogue(true);
      });
    } else {
      setSinging(false);
      setSungDialogue(true);
    }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (quizWord) {
      const typedAnswer = input.trim().toLowerCase();
      const romanisedAnswer = romanisedMusicWords[quizTarget]?.toLowerCase() ?? "";
      const answerScript: QuizAnswerScript = /[a-z]/i.test(typedAnswer) ? "Romanisation" : "Hangul";
      const correct = typedAnswer === quizTarget.toLowerCase() || (quizRomanisationEnabled && Boolean(romanisedAnswer) && typedAnswer === romanisedAnswer);
      if (!correct) {
        recordWorldQuizAttempt(musicQuizScene(quizWord.english), quizWord.english, false, answerScript, quizTarget);
        const quizResult: QuizRunWordResult = { korean: quizTarget, english: capitaliseStandalone(quizLesson?.gloss ?? quizWord.english), correct: false, mode: quizDifficulty, answerScript };
        recordDedicatedQuizAnswer("music", quizResult);
        setQuizResults(value => [...value, quizResult]);
        setWrong(value => value + 1);
        setInput("");
        setRevealedQuizAnswer(true);
        return;
      }
      solveQuizWord(true, answerScript);
      return;
    }
    if (!scene.task || input.trim().toLowerCase() !== scene.task) { setWrong(value => value + 1); return; }
    unlock(scene.task, "music");
    setInput("");
    setWrong(0);
    advance();
  };
  const hint = () => {
    if (!quizWord || hints >= 3) return;
    setHints(value => value + 1);
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "[" || event.code === "BracketLeft") { event.preventDefault(); toggleBusEditorWithoutMovingItems(musicTaskPanelRef.current, setMusicLayoutEditing, setMusicLayout); return; }
      if (event.key !== "ArrowRight") return;
      event.preventDefault();
      if (quizFailed) {
        setSceneIndex(MUSIC_QUIZ_START);
        setQuizIndex(0);
        setMusicQuestionWords(shuffledQuizWords(MUSIC_QUIZ_WORDS).slice(0, MUSIC_QUESTION_COUNT));
        setWrong(0);
        setHints(0);
        setQuizResults([]);
        setQuizFailed(false);
        setRevealedQuizAnswer(false);
        setSungDialogue(false);
        return;
      }
      if (quizWord) {
        if (revealedQuizAnswer) advance();
        else if (sungDialogue) advance();
        else solveQuizWord();
      }
      else if (scene.task) {
        unlock(scene.task, "music");
        setInput("");
        setWrong(0);
        advance();
      } else advance();
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  });

  return (
    <div className="night-music-adventure fixed inset-0 overflow-hidden bg-black" onClick={(event) => {
      if (event.target instanceof HTMLElement && event.target.closest("button,input,form,label")) return;
      if (quizFailed) return;
      if (quizWord) {
        if (sungDialogue) advance();
        return;
      }
      if (scene.task) return;
      advance();
    }}>
      <SceneImage src={assetUrl(`scenes/music/${scene.image}`)} alt="Night Music" imageNumber={sceneIndex + 1} />
      <div className="absolute inset-0 bg-black/35" />
      <header className="scene-header"><button onClick={onBack}>{isChinese ? "地图" : "Map"}</button></header>
      <SceneWordLibrary scene="music" />
      <main ref={musicTaskPanelRef} className={`scene-panel ${quizWord && !sungDialogue && !quizFailed ? "bus-quiz-panel" : scene.task && !quizFailed ? "" : "story-dialogue-panel"}`} style={quizWord && !sungDialogue && !quizFailed && musicTaskGeometry ? { "--bus-task-left": `${musicTaskGeometry.left}%`, "--bus-task-top": `${musicTaskGeometry.top}%`, "--bus-task-width": `${musicTaskGeometry.width}%`, "--bus-task-height": `${musicTaskGeometry.height}%`, "--bus-task-bottom": "auto", "--bus-task-transform": "none" } as React.CSSProperties : undefined} onClickCapture={(event) => { if (musicLayoutEditing) { event.preventDefault(); event.stopPropagation(); } }}>
        {quizFailed ? (
          <>
            <div className="scene-eyebrow">Final grade · {grade}%</div>
            <h1>You need at least 50% to pass the Night Music quiz.</h1>
            <div className="cop-narration-footer"><span>Review the eight words and try again.</span><button type="button" onClick={() => { setSceneIndex(MUSIC_QUIZ_START); setQuizIndex(0); setMusicQuestionWords(shuffledQuizWords(MUSIC_QUIZ_WORDS).slice(0, MUSIC_QUESTION_COUNT)); setWrong(0); setHints(0); setQuizResults([]); setQuizFailed(false); setRevealedQuizAnswer(false); setSungDialogue(false); }}>Retry quiz</button></div>
          </>
        ) : quizWord && singing ? (
          <>
            <div className="scene-eyebrow">Correct</div>
            <h1>Correct answer: <strong className="text-[#f6d46b]">{capitaliseStandalone(quizAnswerGuide)}</strong></h1>
          </>
        ) : quizWord && !sungDialogue && revealedQuizAnswer ? (
          <>
            <div className="scene-eyebrow">Incorrect</div>
            <h1>Correct answer: <strong className="text-[#f6d46b]">{capitaliseStandalone(quizAnswerGuide)}</strong></h1>
            <button type="button" className="scene-action" onClick={advance}>Continue <ArrowRight size={16} /></button>
          </>
        ) : quizWord && !sungDialogue ? (
          <>
            <BusLayoutItem id="title" editing={musicLayoutEditing} offsets={musicLayout} onMove={moveMusicLayoutItem}><h1 className="music-quiz-title">Help Adam profess his love.</h1></BusLayoutItem>
            {musicLayoutEditing && <><div className="task-panel-center-guide" aria-hidden="true" /><BusTaskEditorControls panelRef={musicTaskPanelRef} onChange={setMusicTaskGeometry} /></>}
            <BusLayoutItem id="progress" editing={musicLayoutEditing} offsets={musicLayout} onMove={moveMusicLayoutItem}>
              <div className="scene-progress">Word {quizIndex + 1} / {musicQuestionWords.length} · Score {grade}%</div>
              <div className="scene-progress text-amber-200">Night Music quiz</div>
            </BusLayoutItem>
            <BusLayoutItem id="mode" editing={musicLayoutEditing} offsets={musicLayout} onMove={moveMusicLayoutItem}>
              <QuizModeMenu value={quizDifficulty} onChange={setQuizDifficulty} />
            </BusLayoutItem>
            <BilingualTypeCue english={quizTarget} chinese={quizLesson?.gloss ?? quizWord.chinese} value={input} showEnglish={false} showRomanisationText={false} wrapLine={(lineId, content) => <BusLayoutItem id={`word-${lineId}`} editing={musicLayoutEditing} offsets={musicLayout} onMove={moveMusicLayoutItem}>{content}</BusLayoutItem>} />
            <BusLayoutItem id="hint" editing={musicLayoutEditing} offsets={musicLayout} onMove={moveMusicLayoutItem}><p className="font-mono text-xl tracking-[.16em] text-[#f0d88f]">{quizHint}</p></BusLayoutItem>
            <BusLayoutItem id="input" editing={musicLayoutEditing} offsets={musicLayout} onMove={moveMusicLayoutItem}><form className="scene-form" onSubmit={submit} onClick={event => event.stopPropagation()}>
              <input autoFocus disabled={singing} value={input} onChange={event => setInput(event.target.value)} placeholder="Type the Korean word…" />
              <button disabled={singing}>Enter</button>
            </form></BusLayoutItem>
            <div className="scene-hint">
              <Lightbulb size={15} /> <span>{hints === 0 ? "Hints can help you remember." : "Hints used:"}{hints >= 1 && <> 1. Think about where you first saw it.</>}{hints >= 2 && <>  2. {[...quizWord.english].map((letter, index) => revealedIndexes.includes(index) ? letter : /[a-z]/i.test(letter) ? "_" : letter).join(" ")}</>}{hints >= 3 && <>  3. {mixedRemainingLetters(quizWord.english, revealedIndexes)}</>}</span>
              <button type="button" onClick={hint} disabled={hints >= 3} title={hints >= 3 ? "All hints have been used." : "This hint deducts 5% from your grade."}>{hints >= 3 ? "Hints used" : `Hint ${hints + 1} · −5%`}</button>
            </div>
          </>
        ) : scene.task ? (
          <form className="scene-form" onSubmit={submit} onClick={event => event.stopPropagation()}>
            <button type="button" className="task-close" onClick={() => { setInput(""); setWrong(0); }}>×</button>
            <p>{isChinese ? `输入“${scene.chinese}”的英语单词` : `Type the English word for ${scene.chinese}`}</p>
            <BilingualTypeCue english={scene.task} chinese={scene.chinese ?? ""} value={input} showEnglish />
            <input autoFocus value={input} onChange={event => setInput(event.target.value)} placeholder={`type ${scene.task}...`} />
            <button>{isChinese ? "确认" : "Check"}</button>
            {wrong > 0 && <p className="scene-error">{isChinese ? "再试一次。" : "Try again."}</p>}
          </form>
        ) : <div className="story-dialogue-content">
          <div className="scene-eyebrow"><span className="cop-narrator-dot" />Narrator</div>
          <p className="story-dialogue-text">{quizWord ? <DictionaryText text={quizLesson?.song ?? quizWord.song} /> : text}</p>
          {quizWord
            ? <div className="cop-narration-footer"><span>{isChinese ? "点击任意位置继续" : "click anywhere to continue"}</span></div>
            : <div className="cop-narration-footer"><span>{isChinese ? "点击任意位置继续" : "click anywhere to continue"}</span><button onClick={event => { event.stopPropagation(); speak(text, "adventure"); }}><Volume2 size={12} /> {isChinese ? "听发音" : "Listen"}</button></div>}
        </div>}
      </main>
    </div>
  );
}
