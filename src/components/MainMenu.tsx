import { useEffect, useMemo, useState, useRef } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Settings,
  ArrowRight,
  Check,
  AlertTriangle,
  Volume2,
  VolumeX,
  Users,
  LockKeyhole,
  RotateCcw,
  Play,
  X,
  Footprints,
  Pause,
  Power,
  Sparkles,
  Leaf,
  Lightbulb,
} from "lucide-react";
import { useSave } from "../hooks/useSave";
import { useDebugOverlay } from "../hooks/useDebugOverlay";
import { preloadGeneratedSpeech, useSpeech } from "../hooks/useSpeech";
import { useLanguage } from "../i18n";
import DebugOverlayPanel from "./DebugOverlayPanel";
import RevisionWorldStats from "./RevisionWorldStats";
import LiveTypingFeedback, { LiveAnswerLetters } from "./LiveTypingFeedback";
import { isSkipAnswer, levenshtein, stripAccents } from "../utils/levenshtein";
import { assetUrl } from "../utils/assetUrl";
import { capitaliseStandalone } from "../utils/textCase";
import { recordDailyLearnedWords } from "../utils/learningProgress";
import type { GamePhase } from "../types";
import SmoothSceneImage from "./SmoothSceneImage";
import { preloadImage, preloadSceneWindow, scheduleIdleImagePreload } from "../utils/imagePreloader";
import QuizModeMenu, { type QuizModeValue } from "./QuizModeMenu";
import BackyardAdventure from "./BackyardAdventure";
import {
  BusTicketAdventure,
  CopAdventure,
  HomeAdventure,
  NightMusicAdventure,
  primeSceneAmbience,
  SportsDayAdventure,
} from "./ElderwoodAdventures";
import { MaskedManAdventure } from "./MaskedManAdventure";
import { MaskedBaronAdventure } from "./MaskedBaronAdventure";

export type HubSection =
  | "home"
  | "world"
  | "roam"
  | "backyard"
  | "shop"
  | "market"
  | "bus"
  | "family-home"
  | "cop"
  | "music"
  | "soccer-match"
  | "masked-man"
  | "masked-baron"
  | "adventure"
  | "revision"
  | "multiplayer"
  | "settings";

const WORLD_SCENE_ENTRY_IMAGES: Partial<Record<HubSection, string>> = {
  backyard: assetUrl("a1.png"),
  shop: assetUrl("scenes/bella/b1-woman-no-boards-v2.png"),
  market: assetUrl("scenes/shop/c1-v3.png"),
  bus: assetUrl("scenes/bus/d1.png"),
  "family-home": assetUrl("scenes/home/return-home-e1.webp"),
  cop: assetUrl("scenes/cop/i1.png"),
  "soccer-match": assetUrl("scenes/sports-day/g1.png"),
  music: assetUrl("scenes/music/1a.png"),
  "masked-baron": assetUrl("scenes/masked-baron/1a.png"),
};

const REVISION_ENTRY_IMAGES = [
  assetUrl("world-ai/revision/revision-dashboard-frame-v7.png"),
  assetUrl("world-ai/revision/revision-card-adventure-v5.png"),
  assetUrl("world-ai/revision/revision-card-roam-v5.png"),
  assetUrl("world-ai/revision/revision-world-town-v1.png"),
  assetUrl("world-ai/revision/revision-card-locked-v5.png"),
] as const;

function preloadRevisionEntry(priority: "high" | "low" = "high") {
  const sources = [...new Set([...REVISION_ENTRY_IMAGES, ...Object.values(REVISION_LOCATION_IMAGES)])];
  return Promise.all(sources.map(source => preloadImage(source, priority)));
}

interface MainMenuProps {
  onNewGame: () => void;
  onStartTammy: () => void;
  onStartAgent: () => void;
  onContinue: () => void;
  onStartAudio: () => void;
  onLogout: () => void;
  initialSection?: HubSection;
}

const navItems: Array<{
  id: Exclude<HubSection, "home">;
  label: string;
  labelZh: string;
  icon: typeof Globe2;
  note: string;
  noteZh: string;
}> = [
  {
    id: "roam",
    label: "Roam",
    labelZh: "漫游",
    icon: Footprints,
    note: "Wander the streets",
    noteZh: "探索街道",
  },
  {
    id: "world",
    label: "World Map",
    labelZh: "世界地图",
    icon: Globe2,
    note: "Choose a region",
    noteZh: "选择地区",
  },
  {
    id: "adventure",
    label: "Adventure",
    labelZh: "冒险",
    icon: BookOpen,
    note: "Play a story",
    noteZh: "体验故事",
  },
  {
    id: "revision",
    label: "Revision & Achievements",
    labelZh: "复习与成就",
    icon: RotateCcw,
    note: "Sharpen your words",
    noteZh: "巩固单词",
  },
  {
    id: "multiplayer",
    label: "Multiplayer",
    labelZh: "多人模式",
    icon: Users,
    note: "Challenge a rival",
    noteZh: "挑战对手",
  },
  {
    id: "settings",
    label: "Settings",
    labelZh: "设置",
    icon: Settings,
    note: "Coming soon",
    noteZh: "即将推出",
  },
];

const HOME_BACKGROUNDS = [
  assetUrl("home-wallpapers/learn-english-room.png"),
  assetUrl("home-wallpapers/watercolor-adventure.png"),
  assetUrl("home-wallpapers/island-quest.png"),
  assetUrl("home-wallpapers/notebook-adventure-v3.png"),
];
const WORLD_MAP_IMG = assetUrl(
  "ChatGPT_Image_Aug_12,_2026,_06_03_48_AM_(1).png",
);
const WORLD_MAP_DAY_IMG = assetUrl(
  "world-ai/elderwoods-map-after-ice-cream-v1.png",
);
const WORLD_MAP_SUNSET_IMG = assetUrl("world-ai/elderwoods-map-sunset-v2.png");
const WORLD_MAP_NIGHT_IMG = assetUrl("world-ai/elderwoods-map-night-v2.png");
const TOWN_CENTRE_MAP_IMG = assetUrl("maps/elderwoods-town-centre-map-v2.png");
type RoamDestination = "woodstock" | "california";

type SceneSummaryWordDefinition = { korean: string; english: string; historyWord?: string };
type SceneSummaryDefinition = { title: string; storageScene: string; scored?: boolean; words: SceneSummaryWordDefinition[] };
type EndSceneSummary = {
  title: string;
  unlocked: number;
  total: number;
  words: Array<SceneSummaryWordDefinition & { seenBefore: number; difficulty: "Easy" | "Medium" | "Hard"; correct: number; unlocked: boolean }>;
};
type QuizSummaryMode = "easy" | "normal" | "hard" | "very-hard";
type EndQuizSummary = {
  title: string;
  grade: number;
  correct: number;
  total: number;
  passed: boolean;
  words: Array<{ korean: string; english: string; correct: boolean; correctTimes: number; mode: QuizSummaryMode; answerScript?: "Hangul" | "Romanisation" }>;
};

function historicalBestQuizScore(id: "bus" | "music", slot: number) {
  const expected = id === "bus"
    ? ["아이스크림", "가게", "닭고기", "감자", "물", "커피"]
    : ["bed", "drink coffee", "start", "run", "jump", "climb", "shop", "water"];
  let attempts: Array<{ word: string; correct: boolean }> = [];
  try {
    const stored = JSON.parse(localStorage.getItem(`taletalk-slot-${slot}-world-quiz-attempts-v1`) ?? "[]") as unknown;
    if (Array.isArray(stored)) attempts = stored.filter((entry): entry is { word: string; correct: boolean } => typeof entry === "object" && entry !== null && typeof (entry as { word?: unknown }).word === "string" && typeof (entry as { correct?: unknown }).correct === "boolean");
  } catch { attempts = []; }
  let expectedIndex = 0;
  let correct = 0;
  let best = -1;
  for (const attempt of attempts) {
    const word = attempt.word.trim().toLowerCase();
    if (word === expected[expectedIndex]) {
      if (attempt.correct) correct += 1;
      expectedIndex += 1;
      if (expectedIndex === expected.length) {
        best = Math.max(best, Math.round(correct / expected.length * 100));
        expectedIndex = 0;
        correct = 0;
      }
    } else if (word === expected[0]) {
      expectedIndex = 1;
      correct = attempt.correct ? 1 : 0;
    } else {
      expectedIndex = 0;
      correct = 0;
    }
  }
  return best;
}

function readBestQuizScore(id: "bus" | "music", slot: number) {
  const values: number[] = [];
  const storedScoreValue = localStorage.getItem(`taletalk-slot-${slot}-${id}-score`);
  const storedScore = storedScoreValue === null ? Number.NaN : Number(storedScoreValue);
  if (Number.isFinite(storedScore)) values.push(storedScore);
  for (const kind of ["best", "latest"] as const) {
    try {
      const summary = JSON.parse(localStorage.getItem(`taletalk-slot-${slot}-quiz-${id}-${kind}-summary-v1`) ?? "null") as { grade?: unknown } | null;
      if (summary && typeof summary.grade === "number") values.push(summary.grade);
    } catch { /* Ignore an invalid older summary. */ }
  }
  const historical = historicalBestQuizScore(id, slot);
  if (historical >= 0) values.push(historical);
  return values.length ? Math.max(...values) : null;
}

function readEndQuizSummary(id: "bus" | "music", slot: number): EndQuizSummary | null {
  try {
    const summary = JSON.parse(localStorage.getItem(`taletalk-slot-${slot}-quiz-${id}-best-summary-v1`) ?? localStorage.getItem(`taletalk-slot-${slot}-quiz-${id}-latest-summary-v1`) ?? "null") as EndQuizSummary | null;
    if (summary) {
      const allStats = JSON.parse(localStorage.getItem(`taletalk-slot-${slot}-quiz-word-stats-v1`) ?? "{}") as Record<string, Record<string, { lastCorrectScript?: "Hangul" | "Romanisation" }>>;
      const quizStats = allStats[id] ?? {};
      summary.words = summary.words.map(word => ({
        ...word,
        answerScript: quizStats[word.korean.toLowerCase().replace(/\s/g, "")]?.lastCorrectScript ?? word.answerScript,
      }));
    }
    const bestGrade = readBestQuizScore(id, slot);
    return summary && bestGrade !== null && bestGrade > summary.grade
      ? { ...summary, grade: bestGrade, correct: Math.round(bestGrade / 100 * summary.total), passed: bestGrade >= 50 }
      : summary;
  } catch {
    return null;
  }
}

const SCENE_SUMMARY_DEFINITIONS: Record<string, SceneSummaryDefinition> = {
  backyard: { title: "Scene One", storageScene: "backyard", words: [{ korean: "저는", english: "I (topic form)" }, { korean: "슬퍼요", english: "Unhappy / sad" }, { korean: "아이스크림", english: "Ice cream" }, { korean: "네", english: "Yes / OK" }] },
  icecream: { title: "Ice Cream Shop", storageScene: "icecream", words: [{ korean: "아이스크림 주세요", english: "Ice cream, please" }, { korean: "주세요", english: "Please give me", historyWord: "please" }, { korean: "감사합니다", english: "Thank you" }, { korean: "천만에요", english: "You are welcome" }] },
  shopping: { title: "Shopping Centre", storageScene: "shopping", words: [{ korean: "가게", english: "Shop" }, { korean: "저녁", english: "Dinner" }, { korean: "음료", english: "Drinks" }, { korean: "과일", english: "Fruit" }, { korean: "닭고기", english: "Chicken" }, { korean: "물", english: "Water" }, { korean: "사과", english: "Apples", historyWord: "Apple" }, { korean: "계산하다", english: "Pay" }] },
  bus: { title: "Bus Stop Quiz", storageScene: "bus", scored: true, words: [{ korean: "아이스크림", english: "Ice cream" }, { korean: "주세요", english: "Please" }, { korean: "감사합니다", english: "Thank you" }, { korean: "천만에요", english: "You are welcome" }, { korean: "가게", english: "Shop" }, { korean: "닭고기", english: "Chicken" }, { korean: "물", english: "Water" }, { korean: "사과", english: "Apples" }] },
  home: { title: "Returning Home", storageScene: "home", words: [{ korean: "꽃", english: "Flower" }, { korean: "미안해", english: "Sorry" }] },
  cop: { title: "Detective Mason", storageScene: "cop", words: [{ korean: "커피를 마시다", english: "Drink coffee" }, { korean: "침대", english: "Bed" }, { korean: "문", english: "Door" }, { korean: "개", english: "Dog" }, { korean: "신문", english: "Newspaper" }] },
  sports: { title: "Sports Day", storageScene: "sports", words: [{ korean: "시작하다", english: "Start" }, { korean: "달리다", english: "Run" }, { korean: "뛰다", english: "Jump" }, { korean: "오르다", english: "Climb" }, { korean: "걷다", english: "Walk" }, { korean: "줍다", english: "Pick up", historyWord: "Pickup" }, { korean: "나르다", english: "Carry" }, { korean: "내려놓다", english: "Put down", historyWord: "Putdown" }, { korean: "끝내다", english: "Finish" }] },
  music: { title: "Night Music", storageScene: "music", scored: true, words: [{ korean: "침대", english: "Bed", historyWord: "bed" }, { korean: "커피를 마시다", english: "Drink coffee", historyWord: "drink coffee" }, { korean: "시작하다", english: "Start", historyWord: "start" }, { korean: "달리다", english: "Run", historyWord: "run" }, { korean: "뛰다", english: "Jump", historyWord: "jump" }, { korean: "오르다", english: "Climb", historyWord: "climb" }, { korean: "가게", english: "Shop", historyWord: "shop" }, { korean: "물", english: "Water", historyWord: "water" }, { korean: "끝내다", english: "Finish", historyWord: "finish" }] },
  "masked-baron": { title: "The Masked Baron", storageScene: "masked-baron", words: [{ korean: "앉다", english: "Sitting" }, { korean: "따라가다", english: "Follow" }] },
};

const COLLECTION_EXTRA_WORDS: SceneSummaryWordDefinition[] = [
  { korean: "안녕하세요", english: "Hello" },
  { korean: "친구", english: "Friend" },
  { korean: "좋은 아침", english: "Good morning" },
  { korean: "일어서다", english: "Stand up" },
  { korean: "저녁", english: "Dinner" },
  { korean: "음료", english: "Drinks" },
  { korean: "과일", english: "Fruit" },
  { korean: "감자", english: "Potatoes" },
  { korean: "사과", english: "Apples", historyWord: "Apples" },
  { korean: "바나나", english: "Banana" },
  { korean: "걷다", english: "Walk" },
  { korean: "줍다", english: "Pick up", historyWord: "Pickup" },
  { korean: "내려놓다", english: "Put down", historyWord: "Putdown" },
  { korean: "끝내다", english: "Finish" },
  { korean: "계산하다", english: "Pay" },
  { korean: "다리", english: "Bridge" },
  { korean: "나무", english: "Trees" },
  { korean: "강", english: "River" },
];

const COLLECTION_WORD_BANK = [
  ...Object.values(SCENE_SUMMARY_DEFINITIONS).flatMap(scene => scene.words),
  ...COLLECTION_EXTRA_WORDS,
];

const summaryDifficulty = (word: string): "Easy" | "Medium" | "Hard" => {
  const length = [...word.replace(/\s/g, "")].length;
  return length <= 2 ? "Easy" : length <= 4 ? "Medium" : "Hard";
};

function buildEndSceneSummary(id: string, slot: number): EndSceneSummary | null {
  const definition = SCENE_SUMMARY_DEFINITIONS[id];
  if (!definition) return null;
  const normaliseWord = (value: string) => value.toLowerCase().replace(/[\s\-']/g, "");
  const statsKey = `taletalk-slot-${slot}-word-summary-stats-v1`;
  let stats: Record<string, { seen: number; correct: number }> = {};
  try { stats = JSON.parse(localStorage.getItem(statsKey) ?? "{}"); } catch { stats = {}; }
  const attempts = readStoredArray(localStorage.getItem(`taletalk-slot-${slot}-world-quiz-attempts-v1`)).filter((entry): entry is { word: string; correct: boolean } => typeof entry === "object" && entry !== null && typeof (entry as { word?: unknown }).word === "string" && typeof (entry as { correct?: unknown }).correct === "boolean");
  let revision: Record<string, { attempts?: number; correct?: number }> = {};
  try { revision = JSON.parse(localStorage.getItem(`taletalk-slot-${slot}-revision-history-v1`) ?? "{}"); } catch { revision = {}; }
  const sceneKey = `taletalk-slot-${slot}-scene-${definition.storageScene}-words`;
  const sceneWords = new Set(readStoredArray(localStorage.getItem(sceneKey)).filter((word): word is string => typeof word === "string").map(normaliseWord));
  const globalKey = `taletalk-slot-${slot}-unlocked-words`;
  const globalWords = new Set(readStoredArray(localStorage.getItem(globalKey)).filter((word): word is string => typeof word === "string").map(normaliseWord));

  // Finishing a story scene confirms its taught words. Scored quizzes retain
  // their real correct/incorrect result and do not award missed words.
  if (!definition.scored) definition.words.forEach(word => { sceneWords.add(normaliseWord(word.korean)); globalWords.add(normaliseWord(word.korean)); });

  const words = definition.words.map(word => {
    const key = normaliseWord(word.korean);
    const prior = stats[key] ?? { seen: 0, correct: 0 };
    const aliases = [word.korean, word.english, word.historyWord ?? ""].map(normaliseWord);
    const matchingAttempts = attempts.filter(attempt => aliases.includes(normaliseWord(attempt.word)));
    const revisionEntry = revision[key];
    const seenFromHistory = matchingAttempts.length + (revisionEntry?.attempts ?? 0);
    const correctFromHistory = matchingAttempts.filter(attempt => attempt.correct).length + (revisionEntry?.correct ?? 0);
    const seenBefore = Math.max(prior.seen, Math.max(0, seenFromHistory - 1));
    const correct = definition.scored ? Math.max(prior.correct, correctFromHistory) : prior.correct + 1;
    stats[key] = { seen: Math.max(prior.seen + 1, seenFromHistory), correct };
    return { ...word, seenBefore, difficulty: summaryDifficulty(word.korean), correct, unlocked: sceneWords.has(key) || globalWords.has(key) };
  });
  localStorage.setItem(statsKey, JSON.stringify(stats));
  localStorage.setItem(sceneKey, JSON.stringify([...sceneWords].sort()));
  localStorage.setItem(globalKey, JSON.stringify([...globalWords].sort()));
  recordDailyLearnedWords(words.filter(word => word.unlocked).map(word => word.korean), slot);
  window.dispatchEvent(new Event("taletalk-words-changed"));
  return { title: definition.title, unlocked: words.filter(word => word.unlocked).length, total: words.length, words };
}

const ROAM_DESTINATIONS: Record<RoamDestination, {
  videos: string[];
  usesWoodstockAudio: boolean;
}> = {
  woodstock: {
    videos: [
      assetUrl("videos/woodstock-roam-web.mp4"),
      "https://res.cloudinary.com/tjjlhlpp/video/upload/Video_Project_13_1.mp4",
    ],
    usesWoodstockAudio: true,
  },
  california: {
    videos: [
      "https://res.cloudinary.com/tjjlhlpp/video/upload/v1788083949/Cali_Hosue_1_comp.mp4",
      "https://res.cloudinary.com/tjjlhlpp/video/upload/v1788083966/cali_house_2.mp4",
    ],
    usesWoodstockAudio: false,
  },
};

function useMenuMusic(section: HubSection, muted: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const source =
      section === "home"
        ? assetUrl("music/crystal-menu-drift.mp3")
        : section === "world"
          ? assetUrl("music/pumpkin-hop-world-map.mp3")
          : null;
    if (!source) return;
    const audio = new Audio(source);
    audio.preload = "auto";
    audio.loop = true;
    audio.volume = muted ? 0 : 0.32;
    audioRef.current = audio;
    const play = () => {
      if (audio.paused) audio.play().catch(() => {
        /* Browsers wait for the player's first interaction. */
      });
    };
    play();
    // Some browsers reject playback during the profile-to-menu transition.
    // Retry on each real player action until the browser accepts it.
    window.addEventListener("pointerdown", play, true);
    window.addEventListener("keydown", play, true);
    return () => {
      window.removeEventListener("pointerdown", play, true);
      window.removeEventListener("keydown", play, true);
      audio.pause();
      audio.currentTime = 0;
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [section, muted]);
}

function formatProfilePlayTime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${minutes}:${remainingSeconds}`;
}

// Keep the previous scene visible while the next image decodes. This prevents
// the black/blank flash that occurs when a large scene image is swapped.
function SceneBackground({ source, alt }: { source: string; alt: string }) {
  return (
    <SmoothSceneImage
      src={source}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover"
      draggable={false}
    />
  );
}

const revisionWordBank = [
  { italian: "아이스크림", english: "ice cream", aliases: ["ice cream"] }, { italian: "안녕하세요", english: "hello", aliases: ["hello"] },
  { italian: "감사합니다", english: "thank you", aliases: ["thank you"] }, { italian: "창문", english: "window", aliases: ["window"] },
  { italian: "열쇠", english: "key", aliases: ["key"] }, { italian: "커피", english: "coffee", aliases: ["coffee"] },
  { italian: "다리", english: "bridge", aliases: ["bridge"] }, { italian: "나무", english: "trees", aliases: ["trees"] },
  { italian: "강", english: "river", aliases: ["river"] }, { italian: "친구", english: "friend", aliases: ["friend"] },
  { italian: "좋은 아침", english: "good morning", aliases: ["good morning"] }, { italian: "물", english: "water", aliases: ["water"] },
  { italian: "가게", english: "shop", aliases: ["shop"] }, { italian: "닭고기", english: "chicken", aliases: ["chicken"] },
  { italian: "감자", english: "potatoes", aliases: ["potatoes"] }, { italian: "침대", english: "bed", aliases: ["bed"] },
  { italian: "나르다", english: "carry", aliases: ["carry"] }, { italian: "달리다", english: "run", aliases: ["run"] },
  { italian: "뛰다", english: "jump", aliases: ["jump"] },
];

const sceneOneRevisionWords = [
  { italian: "\uC800\uB294", english: "I am", aliases: ["i am"] },
  { italian: "\uC2AC\uD37C\uC694", english: "unhappy", aliases: ["unhappy"] },
];

type RevisionCategory = "adventure" | "roam" | "world" | "new";
type RevisionWord = { italian: string; english: string; aliases?: string[] };
type QuizAttempt = { correct: boolean; at: number };
type QuizHistory = Record<string, { attempts: number; correct: number; recent?: QuizAttempt[] }>;

const REVISION_LOCATION_IMAGES: Record<string, string> = {
  "저는": assetUrl("scenes/bella/a5.png"), "슬퍼요": assetUrl("scenes/bella/a5.png"),
  "아이스크림": assetUrl("scenes/bella/a6.png"), "네": assetUrl("scenes/bella/a6.png"),
  "아이스크림 주세요": assetUrl("scenes/bella/b2-no-boards-v2.png"), "주세요": assetUrl("scenes/bella/b2-no-boards-v2.png"),
  "감사합니다": assetUrl("scenes/bella/b3-no-boards-v2.png"), "천만에요": assetUrl("scenes/bella/b3-no-boards-v2.png"),
  "가게": assetUrl("scenes/shop/c1-v3.png"), "저녁": assetUrl("scenes/shop/c3-dinner.png"),
  "음료": assetUrl("scenes/shop/c4-v2.png"), "과일": assetUrl("scenes/shop/c5-v2.png"),
  "닭고기": assetUrl("scenes/shop/c3-dinner.png"), "물": assetUrl("scenes/shop/c4-v2.png"),
  "사과": assetUrl("scenes/shop/c5-v2.png"), "계산하다": assetUrl("scenes/shop/c9-taking-rose.png"),
  "꽃": assetUrl("scenes/home/return-home-e4.webp"), "미안해": assetUrl("scenes/home/return-home-f3.webp"),
  "커피를 마시다": assetUrl("scenes/cop/i3.png"), "침대": assetUrl("scenes/cop/i3.png"),
  "문": assetUrl("scenes/cop/i4.png"), "개": assetUrl("scenes/cop/i8.webp"), "신문": assetUrl("scenes/cop/i8.webp"),
  "시작하다": assetUrl("scenes/sports-day/g3.png"), "달리다": assetUrl("scenes/sports-day/g3.png"),
  "뛰다": assetUrl("scenes/sports-day/g4.png"), "오르다": assetUrl("scenes/sports-day/g6.png"),
  "걷다": assetUrl("scenes/sports-day/g8.png"), "줍다": assetUrl("scenes/sports-day/g10.png"),
  "나르다": assetUrl("scenes/sports-day/g10-picked-up-v2.png"), "내려놓다": assetUrl("scenes/sports-day/g11.png"),
  "끝내다": assetUrl("scenes/sports-day/g13.png"),
  "앉다": assetUrl("scenes/masked-baron/1.png"), "따라가다": assetUrl("scenes/masked-baron/6.png"),
  "다리": assetUrl("roam/woodstock-vermont-aerial.png"), "나무": assetUrl("roam/woodstock-vermont-aerial.png"), "강": assetUrl("roam/woodstock-vermont-aerial.png"),
};

function readStoredArray(value: string | null): unknown[] {
  try { return JSON.parse(value ?? "[]") as unknown[]; } catch { return []; }
}

export default function MainMenu({
  onNewGame,
  onStartTammy,
  onStartAgent,
  onContinue,
  onStartAudio,
  onLogout,
  initialSection = "home",
}: MainMenuProps) {
  const { isChinese } = useLanguage();
  const menuOverlay = useDebugOverlay();
  const {
    debugMode: menuDebugMode,
    sceneRef: menuSceneRef,
    handleSceneMouseMove: handleMenuMouseMove,
  } = menuOverlay;
  const [homeBackground] = useState(
    () => HOME_BACKGROUNDS[Math.floor(Math.random() * HOME_BACKGROUNDS.length)],
  );
  const wallpaperPreloadRef = useRef<HTMLImageElement[]>([]);
  // Home wallpapers are decoded by the app-wide startup preloader, so the
  // menu can appear immediately without showing a second loading screen.
  const [isMenuReady, setIsMenuReady] = useState(true);
  const { hasSave, selectSlot, getActiveSlot, listSlots } = useSave();
  const [saveExists, setSaveExists] = useState(false);
  const [activeSaveSlot, setActiveSaveSlot] = useState(() => getActiveSlot());
  const [section, setSection] = useState<HubSection>(initialSection);
  const [endSceneSummary, setEndSceneSummary] = useState<EndSceneSummary | null>(null);
  const [endQuizSummary, setEndQuizSummary] = useState<EndQuizSummary | null>(null);
  const sceneEntryRequestRef = useRef(0);
  useEffect(() => {
    localStorage.setItem('taletalk-preview-section', section);
  }, [section]);
  const [soundMuted, setSoundMuted] = useState(() => localStorage.getItem("taletalk-sound-muted") === "true");
  const applySoundMuted = (muted: boolean) => {
    setSoundMuted(muted);
    localStorage.setItem("taletalk-sound-muted", String(muted));
    document.querySelectorAll<HTMLMediaElement>("audio,video").forEach(media => { media.muted = muted; });
    window.dispatchEvent(new CustomEvent("taletalk-sound-change", { detail: muted }));
  };
  const openSceneWithSound = (nextSection: HubSection) => {
    // Every scene opens audibly by default. The player can still mute it from
    // the scene controls after entering.
    applySoundMuted(false);
    const request = ++sceneEntryRequestRef.current;
    const firstFrame = WORLD_SCENE_ENTRY_IMAGES[nextSection];
    if (!firstFrame) {
      setSection(nextSection);
      return;
    }
    // Keep the fully painted map mounted until the destination's first frame
    // has downloaded and decoded. This protects every entry path, including
    // keyboard shortcuts and chapter-list buttons.
    void preloadImage(firstFrame, "high").then(() => {
      if (request !== sceneEntryRequestRef.current) return;
      window.requestAnimationFrame(() => setSection(nextSection));
    });
  };
  useEffect(() => {
    const storyScenes: HubSection[] = ["backyard", "shop", "market", "bus", "family-home", "cop", "music", "soccer-match", "masked-man", "masked-baron", "roam"];
    if (!storyScenes.includes(section)) return;
    setSoundMuted(false);
    localStorage.setItem("taletalk-sound-muted", "false");
    document.querySelectorAll<HTMLMediaElement>("audio,video").forEach(media => { media.muted = false; });
    window.dispatchEvent(new CustomEvent("taletalk-sound-change", { detail: false }));
  }, [section]);
  const soundActionLabel = isChinese
    ? soundMuted ? "声音开" : "声音关"
    : soundMuted ? "Sound on" : "Sound off";
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [profileDetailsOpen, setProfileDetailsOpen] = useState(false);
  const [welcomeDailyGoal, setWelcomeDailyGoal] = useState(5);
  const [welcomeGoalOpen, setWelcomeGoalOpen] = useState(
    () => localStorage.getItem(`taletalk-slot-${getActiveSlot()}-welcome-pending`) === "true",
  );
  useMenuMusic(section, soundMuted);
  const [revisionCategory, setRevisionCategory] = useState<RevisionCategory>("adventure");
  const [revisionWorldChapterOpen, setRevisionWorldChapterOpen] = useState(false);
  const [revisionPracticeOpen, setRevisionPracticeOpen] = useState(false);
  const [revisionScenePickerOpen, setRevisionScenePickerOpen] = useState(false);
  const [revisionProgressOpen, setRevisionProgressOpen] = useState(false);
  const [revisionProgressScene, setRevisionProgressScene] = useState<string | null>(null);
  const [revisionWorldStatsOpen, setRevisionWorldStatsOpen] = useState(false);
  const [revisionSceneName, setRevisionSceneName] = useState("");
  const [revisionSceneImage, setRevisionSceneImage] = useState("");
  const [selectedRevisionScenes, setSelectedRevisionScenes] = useState<string[]>([]);
  const revisionHistoryKey = `taletalk-slot-${activeSaveSlot}-revision-history-v1`;
  const [revisionHistory, setRevisionHistory] = useState<QuizHistory>(
    () => JSON.parse(localStorage.getItem(`taletalk-slot-${getActiveSlot()}-revision-history-v1`) ?? "{}") as QuizHistory,
  );
  const [revisionTheme] = useState(() => Math.floor(Math.random() * 5));
  const [revisionIndex, setRevisionIndex] = useState(0);
  const [revisionInput, setRevisionInput] = useState("");
  const [revisionHints, setRevisionHints] = useState(0);
  const [revisionResult, setRevisionResult] = useState<
    "correct" | "wrong" | null
  >(null);
  const { speak: speakRevision } = useSpeech();
  const revisionSpokenAudioKeyRef = useRef("");
  const [playerScore, setPlayerScore] = useState(0);
  const [onlineMode, setOnlineMode] = useState<"normal" | "matchmaking" | "placement">("normal");
  const [multiplayerIndex, setMultiplayerIndex] = useState(0);
  const [multiInput, setMultiInput] = useState("");
  const [multiResult, setMultiResult] = useState<"correct" | "wrong" | null>(
    null,
  );
  const progressKey = (name: string, slot = activeSaveSlot) =>
    `taletalk-slot-${slot}-${name}`;
  useEffect(() => {
    setWelcomeGoalOpen(
      localStorage.getItem(`taletalk-slot-${activeSaveSlot}-welcome-pending`) === "true",
    );
  }, [activeSaveSlot]);
  const saveWelcomeGoal = () => {
    localStorage.setItem(progressKey("daily-word-goal"), String(Math.max(1, welcomeDailyGoal)));
    localStorage.removeItem(progressKey("welcome-pending"));
    setWelcomeGoalOpen(false);
  };
  const [bellaMemoryComplete, setBellaMemoryComplete] = useState(
    () =>
      localStorage.getItem(
        `taletalk-slot-${getActiveSlot()}-bella-complete`,
      ) === "true",
  );
  const [shopMemoryComplete, setShopMemoryComplete] = useState(
    () =>
      localStorage.getItem(`taletalk-slot-${getActiveSlot()}-shop-complete`) ===
      "true",
  );
  const [busComplete, setBusComplete] = useState(
    () =>
      localStorage.getItem(`taletalk-slot-${getActiveSlot()}-bus-complete`) ===
      "true",
  );
  const [homeComplete, setHomeComplete] = useState(
    () =>
      localStorage.getItem(`taletalk-slot-${getActiveSlot()}-home-complete`) ===
      "true",
  );
  const [copComplete, setCopComplete] = useState(
    () =>
      localStorage.getItem(`taletalk-slot-${getActiveSlot()}-cop-complete`) ===
      "true",
  );
  const [soccerComplete, setSoccerComplete] = useState(
    () =>
      localStorage.getItem(
        `taletalk-slot-${getActiveSlot()}-soccer-complete`,
      ) === "true",
  );
  const [, refreshLearningProgress] = useState(0);
  useEffect(() => {
    const refresh = () => refreshLearningProgress(revision => revision + 1);
    window.addEventListener("taletalk-progress-changed", refresh);
    window.addEventListener("taletalk-words-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("taletalk-progress-changed", refresh);
      window.removeEventListener("taletalk-words-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  // Main-menu reset shortcut: remove every profile and all progress keys. It is
  // deliberately unavailable while an adventure or map scene is open.
  useEffect(() => {
    const resetAllGames = (event: KeyboardEvent) => {
      if (event.key !== "-" || section !== "home") return;
      event.preventDefault();
      [...Array(localStorage.length).keys()]
        .map((index) => localStorage.key(index))
        .filter(
          (key): key is string =>
            Boolean(key) &&
            (key!.startsWith("taletalk-save-slot-") ||
              key!.startsWith("taletalk-slot-") ||
              key === "taletalk_active_save_slot" ||
              key === "memoire_perdue_session"),
        )
        .forEach((key) => localStorage.removeItem(key));
      window.location.reload();
    };
    window.addEventListener("keydown", resetAllGames);
    return () => window.removeEventListener("keydown", resetAllGames);
  }, [section]);
  const activeProfile = listSlots().find(
    (slot) => slot.slot === activeSaveSlot,
  );
  const todayKey = new Date().toISOString().slice(0, 10);
  const dailyGoal = Number(localStorage.getItem(progressKey("daily-word-goal")) ?? 5);
  const dailyWords = Number(localStorage.getItem(progressKey(`daily-words-${todayKey}`)) ?? 0);
  const streak = Number(localStorage.getItem(progressKey("daily-word-streak")) ?? 0);
  const marketCompleted =
    localStorage.getItem(progressKey("market-complete")) === "true";
  const completedWorldMapScenes: Record<string, boolean> = {
    backyard: bellaMemoryComplete,
    icecream: shopMemoryComplete,
    shopping: marketCompleted,
    bus: busComplete,
    home: homeComplete,
    cop: copComplete,
    sports: soccerComplete,
    music: localStorage.getItem(progressKey("music-complete")) === "true",
    "masked-baron": localStorage.getItem(progressKey("masked-baron-complete")) === "true",
  };
  const worldMapScenesComplete = Object.values(completedWorldMapScenes).filter(Boolean).length;
  const normaliseProgressWord = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const worldMapWordTotal = Object.values(SCENE_SUMMARY_DEFINITIONS)
    .reduce((total, scene) => total + scene.words.length, 0);
  const worldMapWordsUnlocked = Object.entries(SCENE_SUMMARY_DEFINITIONS)
    .reduce((total, [sceneId, scene]) => {
      // Story scenes teach every listed word by completion. Quizzes only count
      // the answers actually unlocked, so a missed answer never becomes learned.
      if (!scene.scored && completedWorldMapScenes[sceneId]) return total + scene.words.length;
      const stored = new Set(
        readStoredArray(localStorage.getItem(progressKey(`scene-${scene.storageScene}-words`)))
          .filter((word): word is string => typeof word === "string")
          .map(normaliseProgressWord),
      );
      const unlocked = scene.words.filter(word =>
        [word.korean, word.english, word.historyWord ?? ""]
          .some(alias => stored.has(normaliseProgressWord(alias))),
      ).length;
      return total + unlocked;
    }, 0);
  const roamWords = (() => {
    try {
      return JSON.parse(
        localStorage.getItem(
          `taletalk-slot-${activeSaveSlot}-roam-collected-words-v2`,
        ) ?? "[]",
      ) as unknown[];
    } catch {
      return [];
    }
  })();
  const adventurePhases = [
    "tied",
    "has_knife",
    "freed",
    "has_key",
    "escaped",
    "flashback",
    "paris_street",
  ];
  const savedAdventurePhase = activeProfile?.phase ?? null;
  const adventureComplete = savedAdventurePhase
    ? Math.max(0, adventurePhases.indexOf(savedAdventurePhase) + 1)
    : 0;
  const totalProgressSteps = ROAM_WORD_TARGET + worldMapWordTotal + adventurePhases.length;
  const completedMilestones =
    roamWords.length + worldMapWordsUnlocked + adventureComplete;
  const progressPercent = Math.round(
    (completedMilestones / totalProgressSteps) * 100,
  );
  const roamPercent = Math.round((roamWords.length / ROAM_WORD_TARGET) * 100);
  const worldMapPercent = Math.round((worldMapWordsUnlocked / worldMapWordTotal) * 100);
  const adventurePercent = Math.round(
    (adventureComplete / adventurePhases.length) * 100,
  );

  const switchSaveSlot = (slot: number) => {
    selectSlot(slot);
    setActiveSaveSlot(slot);
    setBellaMemoryComplete(
      localStorage.getItem(progressKey("bella-complete", slot)) === "true",
    );
    setShopMemoryComplete(
      localStorage.getItem(progressKey("shop-complete", slot)) === "true",
    );
    setBusComplete(
      localStorage.getItem(progressKey("bus-complete", slot)) === "true",
    );
    setHomeComplete(
      localStorage.getItem(progressKey("home-complete", slot)) === "true",
    );
    setCopComplete(
      localStorage.getItem(progressKey("cop-complete", slot)) === "true",
    );
    setSoccerComplete(
      localStorage.getItem(progressKey("soccer-complete", slot)) === "true",
    );
    hasSave().then(setSaveExists);
  };

  // A tiny synthesized UI tick keeps the menu responsive without requiring an external sound file.
  useEffect(() => {
    let lastButton: Element | null = null;
    let lastPlayedAt = 0;
    const play = (event: MouseEvent) => {
      if (soundMuted) return;
      const button = (event.target as Element).closest(".nav-item");
      const previousButton = (event.relatedTarget as Element | null)?.closest?.(
        ".nav-item",
      );
      const now = performance.now();
      if (!button || button === lastButton || button === previousButton || now - lastPlayedAt < 180) return;
      lastButton = button;
      lastPlayedAt = now;
      try {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 520;
        gain.gain.setValueAtTime(0.025, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          context.currentTime + 0.055,
        );
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.06);
      } catch {
        /* optional audio */
      }
    };
    const clear = (event: MouseEvent) => {
      const button = (event.target as Element).closest(".nav-item");
      const nextButton = (event.relatedTarget as Element | null)?.closest?.(
        ".nav-item",
      );
      if (button && button !== nextButton && button === lastButton)
        lastButton = null;
    };
    document.addEventListener("mouseover", play);
    document.addEventListener("mouseout", clear);
    return () => {
      document.removeEventListener("mouseover", play);
      document.removeEventListener("mouseout", clear);
    };
  }, [soundMuted]);

  // Keep every possible home wallpaper decoded for the full lifetime of the
  // menu. This component stays mounted while changing World Map scenes, so a
  // return to the main menu never waits for its randomly selected wallpaper.
  useEffect(() => {
    let cancelled = false;
    const startedAt = performance.now();
    const finish = async () => {
      const remainingDelay = Math.max(0, 180 - (performance.now() - startedAt));
      window.setTimeout(() => {
        if (!cancelled) setIsMenuReady(true);
      }, remainingDelay);
    };

    const selectedImage = new Image();
    selectedImage.decoding = "async";
    selectedImage.fetchPriority = "high";
    selectedImage.src = homeBackground;
    wallpaperPreloadRef.current = [selectedImage];
    void preloadImage(homeBackground, "high").then(finish);
    const cancelIdlePreload = scheduleIdleImagePreload(
      HOME_BACKGROUNDS.filter((source) => source !== homeBackground),
    );

    return () => {
      cancelled = true;
      cancelIdlePreload();
      wallpaperPreloadRef.current = [];
    };
  }, [homeBackground]);

  // Revision is a bitmap-led full-screen dashboard. Decode its board and all
  // four card layers while the menu is visible so entering it is immediate.
  useEffect(() => {
    void preloadRevisionEntry("high");
  }, []);

  const keyBufferRef = useRef("");
  const keyBufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    hasSave().then(setSaveExists);
  }, [hasSave]);

  // Global key buffer — detects .1 .2 .3 (launch scenes) shortcuts in menu screens
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Accumulate printable chars in buffer (max length 3)
      if (e.key.length === 1) {
        keyBufferRef.current = (keyBufferRef.current + e.key).slice(-3);
        if (keyBufferTimerRef.current) clearTimeout(keyBufferTimerRef.current);
        keyBufferTimerRef.current = setTimeout(() => {
          keyBufferRef.current = "";
        }, 2000);

        const buf = keyBufferRef.current;
        if (buf.endsWith(".1")) {
          e.preventDefault();
          keyBufferRef.current = "";
          if (section === "world") {
            openSceneWithSound("backyard");
          } else {
            onNewGame();
          }
        } else if (buf.endsWith(".2")) {
          e.preventDefault();
          keyBufferRef.current = "";
          openSceneWithSound("shop");
        } else if (buf.endsWith(".3")) {
          e.preventDefault();
          keyBufferRef.current = "";
          openSceneWithSound("market");
        }
      }
    };
    // Use capture mode to intercept events before they reach input elements
    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, { capture: true });
  }, [section, setSection, onNewGame, onStartAudio]);

  const currentWorldMapImage = soccerComplete
    ? WORLD_MAP_NIGHT_IMG
    : homeComplete
      ? WORLD_MAP_SUNSET_IMG
      : shopMemoryComplete
        ? WORLD_MAP_DAY_IMG
        : WORLD_MAP_IMG;
  const showWorldMap = (source = currentWorldMapImage) => {
    // Keep the current complete screen visible while the map bitmap decodes.
    // Once mounted, its original page-arrow behaviour remains untouched.
    void preloadImage(source, "high").then(() => {
      window.requestAnimationFrame(() => setSection("world"));
    });
  };
  const finishSceneOnMap = (sceneId: string, source = currentWorldMapImage) => {
    setEndQuizSummary(null);
    setEndSceneSummary(buildEndSceneSummary(sceneId, activeSaveSlot));
    showWorldMap(source);
  };
  const finishQuizOnMap = (quizId: "bus" | "music", source = currentWorldMapImage) => {
    setEndSceneSummary(null);
    setEndQuizSummary(readEndQuizSummary(quizId, activeSaveSlot));
    showWorldMap(source);
  };
  const openSection = (next: HubSection) => {
    if (next === "world") { showWorldMap(); return; }
    if (next === "revision") {
      const request = ++sceneEntryRequestRef.current;
      void preloadRevisionEntry("high").then(() => {
        if (request !== sceneEntryRequestRef.current) return;
        window.requestAnimationFrame(() => {
          setRevisionPracticeOpen(false);
          setRevisionScenePickerOpen(false);
          setSection("revision");
        });
      });
      return;
    }
    setSection(next);
  };

  if (!isMenuReady) {
    return <MenuLoadingScreen isChinese={isChinese} />;
  }

  if (section === "world")
    return (
      <WorldMapSection
        onMenu={() => {
          setSection("home");
        }}
        startMapLoaded={true}
        onOpenMemory={() => openSceneWithSound("backyard")}
        onOpenShop={() => openSceneWithSound("shop")}
        onOpenMarket={() => openSceneWithSound("market")}
        onOpenBus={() => openSceneWithSound("bus")}
        onOpenHome={() => openSceneWithSound("family-home")}
        onOpenCop={() => openSceneWithSound("cop")}
        onOpenMusic={() => openSceneWithSound("music")}
        onOpenBaron={() => openSceneWithSound("masked-baron")}
        onOpenSoccer={() => openSceneWithSound("soccer-match")}
        onSelectSaveSlot={switchSaveSlot}
        activeSaveSlot={activeSaveSlot}
        revisionHistory={revisionHistory}
        bellaMemoryComplete={bellaMemoryComplete}
        shopMemoryComplete={shopMemoryComplete}
        busComplete={busComplete}
        homeComplete={homeComplete}
        copComplete={copComplete}
        soccerComplete={soccerComplete}
        soundMuted={soundMuted}
        endSceneSummary={endSceneSummary}
        onDismissEndSceneSummary={() => setEndSceneSummary(null)}
        endQuizSummary={endQuizSummary}
        onDismissEndQuizSummary={() => setEndQuizSummary(null)}
        onToggleSound={() => {
          applySoundMuted(!soundMuted);
        }}
      />
    );
  if (section === "roam")
    return <RoamSection onMenu={() => setSection("home")} />;
  if (section === "backyard")
    return (
      <BackyardAdventure
        onMenu={() => showWorldMap()}
        onComplete={() => {
          localStorage.setItem(progressKey("bella-complete"), "true");
          setBellaMemoryComplete(true);
          finishSceneOnMap("backyard");
        }}
      />
    );
  if (section === "shop")
    return (
      <BellaShopAdventure
        onMenu={() => showWorldMap()}
        onComplete={() => {
          localStorage.setItem(progressKey("shop-complete"), "true");
          setShopMemoryComplete(true);
          finishSceneOnMap("icecream", soccerComplete ? WORLD_MAP_NIGHT_IMG : homeComplete ? WORLD_MAP_SUNSET_IMG : WORLD_MAP_DAY_IMG);
        }}
      />
    );
  if (section === "market")
    return (
      <ShopTripAdventure
        onMenu={() => showWorldMap()}
        onComplete={() => {
          localStorage.setItem(progressKey("market-complete"), "true");
          finishSceneOnMap("shopping");
        }}
      />
    );
  if (section === "bus")
    return (
      <BusTicketAdventure
        onBack={() => showWorldMap()}
        onBusQuizFailed={() => finishQuizOnMap("bus")}
        onBusComplete={() => {
          localStorage.setItem(progressKey("bus-complete"), "true");
          setBusComplete(true);
          finishQuizOnMap("bus");
        }}
      />
    );
  if (section === "family-home")
    return (
      <HomeAdventure
        onBack={() => showWorldMap()}
        onHomeComplete={() => {
          localStorage.setItem(progressKey("home-complete"), "true");
          setHomeComplete(true);
          finishSceneOnMap("home", soccerComplete ? WORLD_MAP_NIGHT_IMG : WORLD_MAP_SUNSET_IMG);
        }}
      />
    );
  if (section === "cop")
    return (
      <CopAdventure
        onBack={() => showWorldMap()}
        onComplete={() => {
          localStorage.setItem(progressKey("cop-complete"), "true");
          setCopComplete(true);
          finishSceneOnMap("cop");
        }}
      />
    );
  if (section === "music")
    return (
      <NightMusicAdventure
        onBack={() => showWorldMap()}
        onComplete={() => {
          localStorage.setItem(progressKey("music-complete"), "true");
          finishQuizOnMap("music");
        }}
      />
    );
  if (section === "masked-baron") return <MaskedBaronAdventure onBack={() => showWorldMap()} onComplete={() => { localStorage.setItem(progressKey("masked-baron-complete"), "true"); finishSceneOnMap("masked-baron"); }} />;
  if (section === "soccer-match")
    return (
      <SportsDayAdventure
        onBack={() => showWorldMap()}
        onComplete={() => {
          localStorage.setItem(progressKey("soccer-complete"), "true");
          setSoccerComplete(true);
          finishSceneOnMap("sports", WORLD_MAP_NIGHT_IMG);
        }}
      />
    );
  if (section === "masked-man")
    return (
      <MaskedManAdventure
        onBack={() => setSection("adventure")}
        onComplete={() => {
          localStorage.setItem(progressKey("masked-man-complete"), "true");
          setSection("adventure");
        }}
      />
    );

  if (section !== "home") {
    return (
      <div className="hub-shell">
        <div className="hub-backdrop" />
        <header className="hub-header">
          <button
            className="icon-button"
            onClick={() => setSection("home")}
            aria-label={isChinese ? "返回主页" : "Back to home"}
          >
            <ChevronLeft size={20} />
          </button>
          <div className="brand-lockup compact">
            <strong>TaleTalk</strong>
          </div>
          <div style={{ width: 40 }} />
        </header>
        <main className="hub-content">{renderSection(section)}</main>
        <nav className="mobile-nav">
          {navItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={section === item.id}
              onClick={() => openSection(item.id)}
            />
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div
      ref={menuSceneRef}
      onMouseMove={handleMenuMouseMove}
      className={`hub-shell home-shell${homeBackground.includes("island-quest") ? " home-shell-chalkboard" : ""}${homeBackground.includes("notebook-adventure") ? " home-shell-notebook" : ""}`}
    >
      <SmoothSceneImage className="home-image" src={homeBackground} alt="" />
      <div className="home-wash" />
      {welcomeGoalOpen && (
        <div className="absolute inset-0 z-[80] grid place-items-center bg-[#081027]/70 p-5 backdrop-blur-sm">
          <section className="w-full max-w-lg rounded-3xl border border-amber-200/35 bg-[#15213ddd] p-6 text-white shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Welcome to TaleTalk</p>
            <h2 className="mt-2 text-2xl font-black">Language learning that fits your life</h2>
            <p className="mt-3 text-sm leading-6 text-white/80">Our goal is to help you become comfortable using a new language and to make learning feel like a natural part of your day. Small, steady steps build confidence for real conversations and everyday life.</p>
            <label className="mt-5 block text-sm font-semibold text-amber-100">What daily word goal would you like to set for yourself?
              <input type="number" min="1" max="100" value={welcomeDailyGoal} onChange={(event) => setWelcomeDailyGoal(Number(event.target.value) || 1)} className="mt-2 block w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-lg text-white outline-none focus:border-amber-300" />
            </label>
            <p className="mt-2 text-xs text-white/60">Your progress resets every 24 hours and helps build your daily streak.</p>
            <button onClick={saveWelcomeGoal} className="mt-5 w-full rounded-xl bg-amber-300 px-4 py-3 font-bold text-[#392307] hover:bg-amber-200">Start learning</button>
          </section>
        </div>
      )}
      <div className="absolute bottom-3 left-3 z-20 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-[10px] tracking-wide text-white/75 backdrop-blur-sm">
        © 2026 TaleTalk. All rights reserved.
      </div>
      <div className="absolute left-5 top-5 z-20 flex items-stretch overflow-visible rounded-2xl border border-white/20 bg-black/45 text-white shadow-xl backdrop-blur-md hover:z-30">
        <div className="group relative order-2 flex cursor-default flex-col justify-center border-l border-white/20 px-3 py-2">
          <b className="block text-sm">Progress {progressPercent}%</b>
          <small className="block text-xs text-white/65">
            {completedMilestones}/{totalProgressSteps} progress steps
          </small>
          <div className="pointer-events-none absolute left-0 top-[calc(100%+0.5rem)] w-56 translate-y-1 rounded-xl border border-white/15 bg-[#10182e]/95 p-3 text-xs text-white opacity-0 shadow-xl backdrop-blur-md transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
            <b className="mb-2 block text-sm">Progress breakdown</b>
            <div className="space-y-2 text-white/75">
              <div className="flex items-center justify-between">
                <span>Roam</span>
                <span>
                  {roamWords.length}/{ROAM_WORD_TARGET} · {roamPercent}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>World Map</span>
                <span>
                  {worldMapWordsUnlocked}/{worldMapWordTotal} · {worldMapPercent}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Adventure</span>
                <span>
                  {adventureComplete}/{adventurePhases.length} ·{" "}
                  {adventurePercent}%
                </span>
              </div>
            </div>
            <div className="mt-3 border-t border-white/15 pt-2 text-white">
              <b>Total</b>
              <span className="float-right">{progressPercent}%</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-white/15 pt-2 text-white/85">
              <span>Daily words</span><b>{dailyWords}/{dailyGoal}</b>
            </div>
          </div>
        </div>
        <div className="group relative order-1">
          <button
            onClick={() => setProfileDetailsOpen((open) => !open)}
            className="flex h-full items-center gap-2 bg-transparent px-3 py-2 text-left text-white"
          >
            <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-amber-300 text-xs font-black text-[#51300c]">
              {activeProfile?.name?.slice(0, 2).toUpperCase() ?? "TT"}
              {activeProfile?.avatar &&
                activeProfile.avatar !== "/avatars/avatar-1.png" && (
                  <img
                    src={activeProfile.avatar}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                    className="absolute inset-0 h-full w-full object-cover"
                    alt=""
                  />
                )}
            </span>
            <span>
              <b className="block max-w-32 truncate text-sm">
                {activeProfile?.name ?? "Player"}
              </b>
              <small className="text-[10px] text-white/65">
                Story {activeSaveSlot}
              </small>
            </span>
          </button>
          <div
            className={`absolute left-0 top-[calc(100%+0.5rem)] w-52 translate-y-1 rounded-xl border border-white/15 bg-[#10182e]/95 p-3 text-xs text-white shadow-xl backdrop-blur-md transition duration-150 ${profileDetailsOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100"}`}
          >
            <b className="block text-sm">{activeProfile?.name ?? "Player"}</b>
            <span className="mt-0.5 block text-white/55">
              Story {activeSaveSlot}
            </span>
            <div className="mt-3 space-y-1.5 border-t border-white/15 pt-2 text-white/75">
              <div className="flex justify-between">
                <span>Time played</span>
                <span>
                  {formatProfilePlayTime(activeProfile?.playTimeSeconds ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Achievements</span>
                <span>{worldMapScenesComplete}/{Object.keys(completedWorldMapScenes).length} unlocked</span>
              </div>
              <div className="flex justify-between">
                <span>Words collected</span>
                <span>{roamWords.length + worldMapWordsUnlocked}/{ROAM_WORD_TARGET + worldMapWordTotal}</span>
              </div>
              <div className="flex justify-between">
                <span>Streak</span>
                <span>{streak} days</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button
        className="absolute left-5 top-[4.75rem] z-20 rounded-lg border border-white/15 bg-black/45 px-3 py-1 text-[10px] text-white/80 backdrop-blur-md hover:bg-black/70"
        onClick={onLogout}
      >
        Log out
      </button>
      <div className="home-menu-tools">
        <button
          className="home-tool-button"
          onClick={() => {
            const next = !soundMuted;
            applySoundMuted(next);
          }}
          aria-label={soundMuted ? "Turn sound on" : "Mute sound"}
        >
          {soundMuted ? <Volume2 size={17} /> : <VolumeX size={17} />}
          <span>{soundActionLabel}</span>
        </button>
        <button
          className="home-tool-button"
          onClick={() => setCreditsOpen(true)}
        >
          Credits
        </button>
      </div>
      <main className="home-content-centered">
        <div className="home-title-block">
          <h1 className="home-title">
            {isChinese ? (
              <>
                汉语桥
                <br />
                <em>英语探险</em>
              </>
            ) : (
              <>
                Korean Bridge
                <br />
                <em>English Quest</em>
              </>
            )}
          </h1>
          <p className="home-subtitle">
            {isChinese
              ? "在记忆的阴影中学习英语"
              : "A language learned in the shadow of memory"}
          </p>
        </div>
        <div className="nav-grid">
          {navItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={false}
              onClick={() => openSection(item.id)}
            />
          ))}
        </div>
      </main>
      <footer className="home-footer">
        <span>
          {isChinese ? "第一章 · 艾尔德伍兹" : "Chapter I · Elderwoods"}
        </span>
        <span>
          {isChinese ? "学习 · 探索 · 记住" : "Learn · Explore · Remember"}
        </span>
      </footer>
      {menuDebugMode && (
        <DebugOverlayPanel overlay={menuOverlay} mediaLabel="main-menu" />
      )}
      {creditsOpen && (
        <div
          className="credits-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="TaleTalk credits"
          onClick={() => setCreditsOpen(false)}
        >
          <section
            className="credits-card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="credits-close"
              onClick={() => setCreditsOpen(false)}
              aria-label="Close credits"
            >
              <X size={18} />
            </button>
            <div className="credits-mark">TT</div>
            <p className="credits-eyebrow">A TaleTalk production</p>
            <h2>Built for stories that teach.</h2>
            <p>
              TaleTalk creates immersive language adventures where every choice,
              word, and memory moves the story forward.
            </p>
            <div className="credits-rule" />
            <p className="credits-meta">
              © 2026 TaleTalk · All rights reserved
            </p>
          </section>
        </div>
      )}
    </div>
  );

  function renderSection(activeSection: HubSection) {
    if (activeSection === "world")
      return (
        <WorldMapSection
          onMenu={() => {
            setSection("home");
          }}
          startMapLoaded={true}
          onOpenMemory={() => openSceneWithSound("backyard")}
          onOpenShop={() => openSceneWithSound("shop")}
          onOpenMarket={() => openSceneWithSound("market")}
          onOpenBus={() => openSceneWithSound("bus")}
          onOpenHome={() => openSceneWithSound("family-home")}
          onOpenCop={() => openSceneWithSound("cop")}
          onOpenMusic={() => openSceneWithSound("music")}
          onOpenBaron={() => openSceneWithSound("masked-baron")}
          onOpenSoccer={() => openSceneWithSound("soccer-match")}
          onSelectSaveSlot={switchSaveSlot}
          activeSaveSlot={activeSaveSlot}
          revisionHistory={revisionHistory}
          bellaMemoryComplete={bellaMemoryComplete}
          shopMemoryComplete={shopMemoryComplete}
          busComplete={busComplete}
          homeComplete={homeComplete}
          copComplete={copComplete}
          soccerComplete={soccerComplete}
          soundMuted={soundMuted}
          onToggleSound={() => {
            applySoundMuted(!soundMuted);
          }}
        />
      );
    if (activeSection === "roam")
      return <RoamSection onMenu={() => setSection("home")} />;
    if (activeSection === "adventure") return <AdventureSection />;
    if (activeSection === "revision") return <RevisionSection />;
    if (activeSection === "multiplayer") return <MultiplayerSection />;
    return <SettingsSection />;
  }

  function AdventureSection() {
    const [highlightedAdventure, setHighlightedAdventure] = useState<"tammy" | "agent">("tammy");
    const [adventureArtworkReady, setAdventureArtworkReady] = useState(false);
    const tammyArtwork = assetUrl("scenes/cat/1.png");
    const agentArtwork = assetUrl("scenes/bond/1.png");
    const highlightedImage = highlightedAdventure === "tammy"
      ? tammyArtwork
      : agentArtwork;
    useEffect(() => {
      let active = true;
      void Promise.all([
        preloadImage(tammyArtwork, "high"),
        preloadImage(agentArtwork, "high"),
      ]).then(() => {
        if (active) window.requestAnimationFrame(() => setAdventureArtworkReady(true));
      });
      return () => { active = false; };
    }, [agentArtwork, tammyArtwork]);
    const showAdventureArtwork = (next: "tammy" | "agent") => {
      const source = next === "tammy" ? tammyArtwork : agentArtwork;
      void preloadImage(source, "high").then(() => setHighlightedAdventure(next));
    };
    return (
      <section
        className={`section-stack adventure-highlight-menu ${adventureArtworkReady ? "is-composed" : "is-composing"}`}
        style={{ backgroundImage: adventureArtworkReady ? `linear-gradient(90deg, rgba(8, 12, 11, .94) 0%, rgba(8, 12, 11, .77) 50%, rgba(8, 12, 11, .45) 100%), url('${highlightedImage}')` : undefined }}
        aria-busy={!adventureArtworkReady}
      >
        <SectionHeading
          eyebrow={isChinese ? "选择故事" : "Choose your story"}
          title={isChinese ? "冒险" : "Adventure"}
          description={
            isChinese
              ? "在这个世界里，每个英语单词都会改变接下来发生的事。"
              : "Follow Tammy the cat on her journey home through New York."
          }
        />
        <div
          className="adventure-card agent-story-card is-locked"
          aria-disabled="true"
        >
          <div
            className="adventure-art"
            style={{
              backgroundImage: `url('${assetUrl("scenes/bond/1.png")}')`,
            }}
          />
          <div className="adventure-copy">
            <div className="card-label">
              {isChinese ? "第二章 · 行动" : "Chapter II · The Operation"}
            </div>
            <h2>{isChinese ? "佛罗伦萨陷阱" : "The Florence Trap"}</h2>
            <p>
              {isChinese
                ? "你在佛罗伦萨的一家咖啡馆中醒来，双手被绑，身旁躺着一名死去的陌生人。你失去了记忆，出口都被监视，而一名特工正在逼近。"
                : "You wake bound in a Florentine café beside a dead stranger, with no memory of how you got there. Every exit is watched—and an agent is closing in."}
            </p>
            <div className="card-cta locked-card-cta">
              <LockKeyhole size={13} /> {isChinese ? "尚未解锁" : "Locked"}
            </div>
          </div>
        </div>
        <div
          className="adventure-card active-card tammy-story-card"
          onMouseEnter={() => showAdventureArtwork("tammy")}
          onFocus={() => showAdventureArtwork("tammy")}
          onClick={onStartTammy}
        >
          <div
            className="adventure-art"
            style={{
              backgroundImage: `url('${assetUrl("scenes/cat/1.png")}')`,
            }}
          />
          <div className="adventure-copy">
            <div className="card-label">
              {isChinese ? "第一章 · 纽约" : "Chapter I · New York"}
            </div>
            <h2>{isChinese ? "Tammy 回家的路" : "Tammy's Way Home"}</h2>
            <p>
              {isChinese
                ? "迷失在纽约的塔米必须找到回家的路。"
                : "Lost and afraid in a city of rough corners, Tammy must find her way home."}
            </p>
            <div className="card-cta">
              {isChinese ? "开始冒险" : "Begin adventure"} <span>→</span>
            </div>
          </div>
        </div>
        {false && <div className="adventure-card active-card" onClick={() => setSection("masked-man")}>
          <div className="adventure-art" style={{ backgroundImage: `url('${assetUrl("scenes/masked-man/a1.png")}')` }} />
          <div className="adventure-copy">
            <div className="card-label">Chapter II · The Lost Memories</div>
            <h2>Masked Man</h2>
            <p>A journey through a forgotten underground world, searching for the light.</p>
            <div className="card-cta">Begin adventure <span>→</span></div>
          </div>
        </div>}
        {saveExists && (
          <button
            className="continue-journey"
            onClick={(e) => {
              e.stopPropagation();
              onContinue();
            }}
          >
            <Play size={16} />{" "}
            {isChinese ? "继续旅程" : "Continue your journey"} <span>↗</span>
          </button>
        )}
        <div className="locked-row">
          <LockKeyhole size={18} />
          <div>
            <strong>
              {isChinese
                ? "更多冒险正在制作中"
                : "More adventures are taking shape"}
            </strong>
            <span>
              {isChinese
                ? "随着旅程发展，新故事将会出现。"
                : "New stories will appear here as your journey grows."}
            </span>
          </div>
        </div>
      </section>
    );
  }

  function RevisionSection() {
    const playRevisionCardHover = () => {
      if (soundMuted) return;
      try {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 460;
        gain.gain.setValueAtTime(0.022, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.07);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(); oscillator.stop(context.currentTime + 0.075);
      } catch { /* Optional hover sound. */ }
    };
    const revisionScenes: Record<Exclude<RevisionCategory, "new">, { title: string; subtitle: string; image: string; words: string[] }[]> = {
      world: ([
        { id: "backyard", subtitle: "Chapter One · Bella's first Elderwoods scene.", image: "a1.png" },
        { id: "icecream", subtitle: "Chapter One · the ice cream shop story.", image: "scenes/bella/b1-woman-no-boards-v2.png" },
        { id: "shopping", subtitle: "Chapter One · shopping and food words.", image: "scenes/shop/c2-v3.png" },
        { id: "bus", subtitle: "Chapter One · Jessica's ticket quiz.", image: "scenes/bus/d1.png" },
        { id: "home", subtitle: "Chapter One · Joshua returns home.", image: "scenes/home/return-home-e1.webp" },
        { id: "cop", subtitle: "Chapter One · Mason's case.", image: "scenes/cop/i1.png" },
        { id: "sports", subtitle: "Chapter One · George and Joshua's challenge.", image: "scenes/sports-day/g1.png" },
        { id: "music", subtitle: "Chapter One · Adam's night-time song.", image: "scenes/music/1a.png" },
        { id: "masked-baron", subtitle: "Chapter One · Raspy follows the intruder.", image: "scenes/masked-baron/1a.png" },
      ] as const).map(scene => ({
        title: SCENE_SUMMARY_DEFINITIONS[scene.id].title,
        subtitle: scene.subtitle,
        image: scene.image,
        words: SCENE_SUMMARY_DEFINITIONS[scene.id].words.map(word => word.korean),
      })),
      adventure: [
        { title: "Tammy's Way Home", subtitle: "Words from Tammy's city adventure.", image: "world-ai/revision/revision-card-adventure-v5.png", words: ["hello", "key"] },
        { title: "The Agent", subtitle: "Words from the second adventure story.", image: "world-ai/revision/revision-card-adventure-v5.png", words: ["coffee", "thank you"] },
        { title: "Adventure Path", subtitle: "Review the words gathered in Adventure.", image: "world-ai/elderwoods-map-day-v2.png", words: ["friend", "window"] },
      ],
      roam: [
        { title: "Woodstock, Vermont", subtitle: "Words discovered while roaming Woodstock.", image: "roam/woodstock-vermont-aerial.png", words: ["bridge", "trees", "river"] },
        { title: "North America", subtitle: "Words gathered across the roaming map.", image: "maps/north-america-roam-map-v2.png", words: ["bridge", "trees", "river"] },
        { title: "New destinations", subtitle: "Return as you unlock more roaming places.", image: "world-ai/revision/revision-card-roam-v5.png", words: [] },
      ],
    };
    const savedAdventure = (() => { try { return JSON.parse(localStorage.getItem(`taletalk-save-slot-${activeSaveSlot}`) ?? "{}") as { learnedWords?: unknown[]; dictionary?: { french?: string }[] }; } catch { return {}; } })();
    const adventureWords = [...(savedAdventure?.learnedWords ?? []), ...(savedAdventure?.dictionary ?? []).map((word) => word.french ?? "")]
      .filter((word): word is string => typeof word === "string" && Boolean(word));
    const roamUnlocked = readStoredArray(localStorage.getItem(`taletalk-slot-${activeSaveSlot}-roam-collected-words-v2`))
      .map((word) => typeof word === "object" && word !== null ? (word as { italian?: string }).italian ?? "" : "").filter(Boolean);
    const worldUnlocked = readStoredArray(localStorage.getItem(`taletalk-slot-${activeSaveSlot}-unlocked-words`)).filter((word): word is string => typeof word === "string");
    const normalise = (value: string) => value.trim().toLowerCase();
    const worldRevisionWords: RevisionWord[] = Object.values(SCENE_SUMMARY_DEFINITIONS).flatMap(scene => scene.words.map(item => ({ italian: item.korean, english: item.english, aliases: [item.english, item.historyWord ?? ""].filter(Boolean) })));
    const makeWord = (value: string): RevisionWord => [...worldRevisionWords, ...revisionWordBank, ...sceneOneRevisionWords].find((item) => normalise(item.italian) === normalise(value) || item.aliases?.some((alias) => normalise(alias) === normalise(value))) ?? { italian: value, english: "Translation coming soon" };
    const categoryWords = revisionCategory === "adventure" ? adventureWords : revisionCategory === "roam" ? roamUnlocked : worldUnlocked;
    const unlockedWords = categoryWords.map(makeWord).filter((item, index, list) => list.findIndex((candidate) => normalise(candidate.italian) === normalise(item.italian)) === index);
    const selectedSceneWords = revisionCategory === "new" ? [] : revisionScenes[revisionCategory].filter((scene) => selectedRevisionScenes.includes(scene.title)).flatMap((scene) => scene.words);
    const practiceWords = revisionCategory === "new" ? revisionWordBank.filter((item) => ![...adventureWords, ...roamUnlocked, ...worldUnlocked].some((value) => normalise(value) === normalise(item.italian))) : selectedSceneWords.length ? selectedSceneWords.map(makeWord) : unlockedWords;
    const word = practiceWords[revisionIndex % practiceWords.length] ?? revisionWordBank[0];
    const revisionRomanisationText: Record<string, string> = {
      "저는": "jeoneun", "슬퍼요": "seulpeoyo", "아이스크림": "aiseukeurim", "네": "ne",
      "아이스크림 주세요": "aiseukeurim juseyo", "주세요": "juseyo", "감사합니다": "gamsahamnida", "천만에요": "cheonmaneyo",
      "가게": "gage", "저녁": "jeonyeok", "음료": "eumryo", "과일": "gwail", "닭고기": "dalgogi", "물": "mul", "사과": "sagwa", "계산하다": "gyesanhada",
      "꽃": "kkot", "미안해": "mianhae", "커피를 마시다": "keopireul masida", "침대": "chimdae", "문": "mun", "개": "gae", "신문": "sinmun",
      "시작하다": "sijakhada", "달리다": "dallida", "뛰다": "ttwida", "오르다": "oreuda", "걷다": "geotda", "줍다": "jupda", "나르다": "nareuda", "내려놓다": "naeryeonota", "끝내다": "kkeutnaeda",
      "앉다": "anjda", "따라가다": "ttaragada", "다리": "dari", "나무": "namu", "강": "gang",
      "안녕하세요": "annyeonghaseyo", "창문": "changmun", "열쇠": "yeolsoe", "커피": "keopi", "친구": "chingu", "좋은 아침": "joeun achim", "감자": "gamja",
    };
    const revisionRomanisedAnswer = revisionRomanisationText[word.italian] ?? "";
    const locationImage = REVISION_LOCATION_IMAGES[normalise(word.italian)]
      ?? (revisionCategory === "roam" ? assetUrl("maps/north-america-roam-map-v2.png")
        : revisionCategory === "adventure" ? assetUrl("cafe_room.png")
          : TOWN_CENTRE_MAP_IMG);
    const [mode, setMode] = useState<"normal" | "hard" | "very-hard">("normal");
    const [revisionRomanisation, setRevisionRomanisation] = useState(() => localStorage.getItem("taletalk-romanisation-enabled") === "true");
    useEffect(() => { const sync = (event: Event) => setRevisionRomanisation(Boolean((event as CustomEvent<boolean>).detail)); window.addEventListener("taletalk-romanisation-change", sync); return () => window.removeEventListener("taletalk-romanisation-change", sync); }, []);
    const revisionAnswerTarget = revisionRomanisation && revisionRomanisedAnswer ? revisionRomanisedAnswer : word.italian;
    const answerCharacters = [...revisionAnswerTarget];
    const answerIndexes = answerCharacters.map((letter, index) => /\s/.test(letter) ? -1 : index).filter(index => index >= 0);
    const hiddenCount = Math.max(1, Math.ceil(answerIndexes.length * (mode === "very-hard" ? 1 : mode === "hard" ? .6 : .35)));
    const hiddenIndexes = new Set(answerIndexes.slice().sort((a, b) => ((a * 17 + answerIndexes.length * 7) % 29) - ((b * 17 + answerIndexes.length * 7) % 29)).slice(0, hiddenCount));
    const hint = answerCharacters.map((letter, index) => /\s/.test(letter) ? " " : hiddenIndexes.has(index) ? "_" : letter).join(" ");
    const toggleRevisionRomanisation = () => {
      const next = !revisionRomanisation;
      setRevisionRomanisation(next);
      setRevisionInput("");
      localStorage.setItem("taletalk-romanisation-enabled", String(next));
      window.dispatchEvent(new CustomEvent("taletalk-romanisation-change", { detail: next }));
    };
    const quizHintIndexes = [...word.italian].map((letter, index) => ({ letter, index })).filter(({ letter }) => !/\s/.test(letter)).slice(0, Math.max(1, Math.ceil([...word.italian].filter(letter => !/\s/.test(letter)).length * .3))).map(({ index }) => index);
    const submit = (event: React.FormEvent) => {
      event.preventDefault();
      const correct =
        isSkipAnswer(revisionInput) ||
        revisionInput.trim() === word.italian ||
        (revisionRomanisation && revisionInput.trim().toLowerCase() === revisionRomanisedAnswer.toLowerCase());
      setRevisionResult(correct ? "correct" : "wrong");
      setRevisionHistory((history) => {
        const previous = history[normalise(word.italian)] ?? { attempts: 0, correct: 0, recent: [] };
        const recent = [...(previous.recent ?? []), { correct, at: Date.now() }].slice(-5);
        const next = { ...history, [normalise(word.italian)]: { attempts: previous.attempts + 1, correct: previous.correct + (correct ? 1 : 0), recent } };
        localStorage.setItem(revisionHistoryKey, JSON.stringify(next));
        return next;
      });
      if (revisionCategory === "world") {
        const selectedScenes = revisionScenes.world.filter((scene) => selectedRevisionScenes.includes(scene.title) && scene.words.some((sceneWord) => normalise(sceneWord) === normalise(word.italian)));
        const key = `taletalk-slot-${activeSaveSlot}-world-quiz-attempts-v1`;
        const previous = readStoredArray(localStorage.getItem(key)).filter((attempt): attempt is { scene: string; word: string; correct: boolean; at: number } => typeof attempt === "object" && attempt !== null && typeof (attempt as { scene?: unknown }).scene === "string" && typeof (attempt as { word?: unknown }).word === "string" && typeof (attempt as { correct?: unknown }).correct === "boolean" && typeof (attempt as { at?: unknown }).at === "number");
        const answerScript = /[a-z]/i.test(revisionInput) ? "Romanisation" : "Hangul";
        localStorage.setItem(key, JSON.stringify([...previous, ...selectedScenes.map((scene) => ({ scene: scene.title, word: word.english, korean: word.italian, correct, mode, answerScript, at: Date.now() }))].slice(-100)));
      }
      if (correct) {
        speakRevision(word.italian, "female", () => {
          setRevisionIndex((revisionIndex + 1) % practiceWords.length);
          setRevisionInput("");
          setRevisionHints(0);
          setRevisionResult(null);
        });
      }
    };
    useEffect(() => {
      if (!revisionPracticeOpen) {
        revisionSpokenAudioKeyRef.current = "";
        return;
      }
      const audioKey = `${revisionSceneName}:${revisionIndex}:${word.italian}`;
      if (revisionSpokenAudioKeyRef.current === audioKey) return;
      revisionSpokenAudioKeyRef.current = audioKey;
      speakRevision(word.italian, "female");
    }, [word.italian, speakRevision]);
    const worldQuizAttempts = (sceneTitle: string) => readStoredArray(localStorage.getItem(`taletalk-slot-${activeSaveSlot}-world-quiz-attempts-v1`))
      .filter((attempt): attempt is { scene: string; word: string; correct: boolean; at: number } => typeof attempt === "object" && attempt !== null && (attempt as { scene?: unknown }).scene === sceneTitle && typeof (attempt as { correct?: unknown }).correct === "boolean" && typeof (attempt as { at?: unknown }).at === "number")
      .sort((a, b) => a.at - b.at).slice(-5);
    const sceneScore = (scene: { words: string[]; title?: string }) => {
      const attempts = revisionCategory === "world" && scene.title ? worldQuizAttempts(scene.title) : scene.words.flatMap((sceneWord) => revisionHistory[normalise(sceneWord)]?.recent ?? []).sort((a, b) => a.at - b.at).slice(-5);
      const correct = attempts.filter((attempt) => attempt.correct).length;
      return attempts.length ? `${Math.round((correct / attempts.length) * 100)}% correct · ${attempts.length}/5 attempts` : "0% correct · not tested";
    };
    return (
      <section className={`section-stack revision-screen revision-theme-${revisionTheme}`}>
        <img className="revision-reference-board" src={assetUrl("world-ai/revision/revision-dashboard-frame-v7.png")} alt="TaleTalk revision dashboard" />
        <button className="revision-home-button" type="button" onClick={() => setSection("home")} aria-label="Back to main menu">
          <ChevronLeft aria-hidden="true" />
          <span>Main menu</span>
        </button>
        <div className="revision-ornaments" aria-hidden="true">
          <Leaf /><Leaf /><Sparkles /><Leaf /><Sparkles /><Leaf />
        </div>
        <SectionHeading
          eyebrow={isChinese ? "巩固记忆" : "Keep your memory sharp"}
          title={isChinese ? "复习" : "Revision"}
          description={
            isChinese
              ? "练习已经学过的英语单词。"
              : "Short practice rounds for the words you have gathered."
          }
        />
        <div className="revision-areas" role="tablist" aria-label="Revision areas">
          {([
            ["adventure", "Adventure", adventureWords.length, "revision-card-adventure-v5.png"],
            ["roam", "Roaming", roamUnlocked.length, "revision-card-roam-v5.png"],
            ["world", "World Map", worldUnlocked.length, "revision-world-town-v1.png"],
            ["new", "Not unlocked yet", practiceWords.length, "revision-card-locked-v5.png"],
          ] as [RevisionCategory, string, number, string][]).map(([category, label, count, image]) => (
            <button key={category} type="button" role="tab" aria-selected={revisionCategory === category} onMouseEnter={playRevisionCardHover} onFocus={playRevisionCardHover} onClick={() => { setRevisionCategory(category); setRevisionProgressOpen(category === "world"); setRevisionWorldChapterOpen(false); setRevisionProgressScene(null); setSelectedRevisionScenes([]); setRevisionIndex(0); setRevisionInput(""); setRevisionResult(null); if (category === "new") { setRevisionSceneName("Not unlocked yet"); setRevisionSceneImage("world-ai/revision/revision-card-locked-v5.png"); setRevisionPracticeOpen(true); } else { setRevisionScenePickerOpen(true); } }} className={revisionCategory === category ? "active" : ""}>
              <img className="revision-card-art" src={assetUrl(`world-ai/revision/${image}`)} alt="" />
              <span>{label}</span><b>{category === "world" ? "探索世界，拓展词汇边界" : category === "new" ? `${count} to practise` : `${count} unlocked`}</b>
            </button>
          ))}
        </div>
        {revisionScenePickerOpen && revisionCategory !== "new" && (
          <div className={`revision-scene-picker ${revisionCategory === "world" ? `revision-world-picker ${revisionWorldChapterOpen ? "chapter-open" : ""}` : ""}`} role="dialog" aria-modal="true" aria-label={`${revisionCategory} scenes`}>
            <section>
              <button className="revision-dialog-home" type="button" onClick={() => { setRevisionScenePickerOpen(false); setSection("home"); }} aria-label="Back to main menu"><ChevronLeft aria-hidden="true" /> Main menu</button>
              <button className="revision-sheet-close" onClick={() => setRevisionScenePickerOpen(false)} aria-label="Close scene picker">×</button>
              <p>{revisionCategory === "world" ? "WORLD MAP" : "CHOOSE A SCENE"}</p>
              <h2>{revisionCategory === "world" ? "Choose a chapter or section" : revisionCategory === "roam" ? "Roaming" : "Adventure"}</h2>
              {revisionCategory === "world" && <button className="revision-world-chapter-bar" type="button" aria-expanded={revisionWorldChapterOpen} onClick={() => setRevisionWorldChapterOpen(open => !open)}><span><small>CHAPTER ONE</small><strong>The Elderwoods</strong></span><b>{revisionWorldChapterOpen ? "Hide −" : "Expand +"}</b></button>}
              {revisionCategory === "world" ? <><div className="revision-world-scene-rows">{revisionScenes.world.map((scene) => { const selected = selectedRevisionScenes.includes(scene.title); return <div className={`revision-world-scene-row ${selected ? "selected" : ""}`} key={scene.title}><button className="revision-world-scene-button" type="button" style={{ backgroundImage: `linear-gradient(90deg,rgba(7,51,47,.91),rgba(7,51,47,.52)),url('${assetUrl(scene.image)}')` }} onClick={() => setSelectedRevisionScenes((scenes) => selected ? scenes.filter((title) => title !== scene.title) : [...scenes, scene.title])}><span><strong>{scene.title}</strong><small>{scene.subtitle}</small></span><i aria-hidden="true">{selected ? "✓" : ""}</i></button><div className="revision-world-progress-row"><img src={assetUrl(scene.image)} alt="" /><span><b>{scene.title}</b><em>{sceneScore(scene)}</em></span></div></div>; })}</div><div className="revision-world-actions"><button className="revision-begin-test" type="button" disabled={!selectedRevisionScenes.length} onClick={() => { const selected = revisionScenes.world.filter((scene) => selectedRevisionScenes.includes(scene.title)); setRevisionSceneName(selected.map((scene) => scene.title).join(" + ")); setRevisionSceneImage(selected[0]?.image ?? "world-ai/revision/revision-world-town-v1.png"); setRevisionIndex(0); setRevisionScenePickerOpen(false); setRevisionPracticeOpen(true); }}>Begin test · {selectedRevisionScenes.length} selected</button><button className="revision-show-stats" type="button" disabled={!selectedRevisionScenes.length} onClick={() => setRevisionWorldStatsOpen(true)}>Show stats</button></div>{revisionWorldStatsOpen && <div className="revision-world-stats" role="dialog" aria-modal="true"><section><button onClick={() => setRevisionWorldStatsOpen(false)} aria-label="Close statistics">×</button><h3>Quiz results</h3>{(() => { const attempts = readStoredArray(localStorage.getItem(`taletalk-slot-${activeSaveSlot}-world-quiz-attempts-v1`)).filter((attempt): attempt is { scene: string; word: string; correct: boolean } => typeof attempt === "object" && attempt !== null && typeof (attempt as { scene?: unknown }).scene === "string" && typeof (attempt as { word?: unknown }).word === "string" && typeof (attempt as { correct?: unknown }).correct === "boolean").filter((attempt) => selectedRevisionScenes.includes(attempt.scene)); const words = [...new Set(attempts.map((attempt) => attempt.word))]; const correct = attempts.filter((attempt) => attempt.correct).length; return <><strong>{attempts.length ? `${Math.round((correct / attempts.length) * 100)}% overall` : "No attempts yet"}</strong>{words.length ? words.map((word) => { const wordAttempts = attempts.filter((attempt) => attempt.word === word); return <p key={word}><b>{word}</b><span>{wordAttempts.filter((attempt) => attempt.correct).length} correct · {wordAttempts.filter((attempt) => !attempt.correct).length} wrong</span></p>; }) : <p>No quiz attempts for the selected scenes yet.</p>}</>; })()}</section></div>}</> : <div className="revision-scene-list">
                  {revisionScenes[revisionCategory].map((scene) => (
                    <label key={scene.title} className={selectedRevisionScenes.includes(scene.title) ? "selected" : ""}>
                      <input type="checkbox" checked={selectedRevisionScenes.includes(scene.title)} onChange={() => { if (revisionCategory === "world") { setRevisionSceneName(scene.title); setRevisionSceneImage(scene.image); setRevisionIndex(0); setRevisionScenePickerOpen(false); setRevisionPracticeOpen(true); return; } setSelectedRevisionScenes((selected) => selected.includes(scene.title) ? selected.filter((title) => title !== scene.title) : [...selected, scene.title]); }} />
                      <img src={assetUrl(scene.image)} alt="" />
                      <span><strong>{scene.title}</strong><small>{scene.subtitle}</small><em>Words: {scene.words.join(" · ")}</em><b>Quiz result: {sceneScore(scene)}</b></span>
                      <i aria-hidden="true">✓</i>
                    </label>
                  ))}
              </div>}
              <button className="revision-begin-test" type="button" disabled={!selectedRevisionScenes.length} onClick={() => { const selected = revisionScenes[revisionCategory].filter((scene) => selectedRevisionScenes.includes(scene.title)); setRevisionSceneName(selected.map((scene) => scene.title).join(" + ")); setRevisionSceneImage(selected[0]?.image ?? "world-ai/revision/revision-world-town-v1.png"); setRevisionIndex(0); setRevisionScenePickerOpen(false); setRevisionPracticeOpen(true); }}>Begin test · {selectedRevisionScenes.length} selected</button>
            </section>
          </div>
        )}
        {revisionWorldStatsOpen && <RevisionWorldStats slot={activeSaveSlot} scenes={selectedRevisionScenes} onClose={() => setRevisionWorldStatsOpen(false)} />}
        {revisionPracticeOpen && (
          <div className="revision-quiz-screen" role="dialog" aria-modal="true">
            <SmoothSceneImage className="revision-quiz-image" src={locationImage} alt={`The scene where ${word.english} was learned`} />
            <div className="revision-quiz-shade" />
            <button className="revision-quiz-home" type="button" onClick={() => { setRevisionPracticeOpen(false); setRevisionScenePickerOpen(false); setSection("home"); }} aria-label="Back to main menu"><ChevronLeft aria-hidden="true" /> Main menu</button>
            <button className="revision-quiz-back" onClick={() => { setRevisionPracticeOpen(false); if (revisionCategory !== "new") setRevisionScenePickerOpen(true); }} aria-label="Back to scene list"><ChevronLeft aria-hidden="true" /> Scenes</button>
            <section data-task-editor-panel="revision-quiz" className="revision-quiz-panel bus-quiz-panel">
              <div data-task-editor-item="heading" className="scene-eyebrow">{revisionSceneName || (revisionCategory === "new" ? "NOT UNLOCKED YET" : `${revisionCategory.toUpperCase()} WORDS`)} · REVISION</div>
              <div data-task-editor-item="progress" className="scene-progress">Word {revisionIndex + 1} / {practiceWords.length} · Revision</div>
              <div className="revision-quiz-controls">
              <div data-task-editor-item="mode">
                <QuizModeMenu value={mode} options={["normal", "hard", "very-hard"]} onChange={value => setMode(value as Exclude<QuizModeValue, "easy">)} />
              </div>
              <button className={`revision-romanisation-toggle ${revisionRomanisation ? "active" : ""}`} type="button" onClick={toggleRevisionRomanisation} aria-pressed={revisionRomanisation}>
                Romanisation <span aria-hidden="true">{revisionRomanisation ? "✓" : ""}</span>
              </button>
              </div>
              <div className="revision-bus-answer"><strong data-task-editor-item="answer-english">{capitaliseStandalone(word.english)}</strong>{revisionInput && <LiveTypingFeedback data-task-editor-item="answer-typed" target={revisionAnswerTarget} value={revisionInput} />}</div>
              <p data-task-editor-item="letter-hint" className="font-mono text-xl tracking-[.16em] text-[#f0d88f]">{hint}</p>
              <form data-task-editor-item="answer-form" className="scene-form" onSubmit={submit}><input autoFocus value={revisionInput} onChange={(event) => setRevisionInput(event.target.value)} placeholder={revisionRomanisation ? "Type the romanised answer…" : "Type the Korean word…"} /><button>Enter</button></form>
              <div data-task-editor-item="hints" className="scene-hint"><Lightbulb size={15} /><span>{revisionHints === 0 ? "Hints can help you remember." : "Hints used:"}{revisionHints >= 1 && <> 1. Read the Korean word aloud.</>}{revisionHints >= 2 && <>  2. {[...word.italian].map((letter, index) => quizHintIndexes.includes(index) ? letter : /\s/.test(letter) ? " " : "_").join(" ")}</>}{revisionHints >= 3 && <>  3. {word.italian}</>}</span><button type="button" onClick={() => setRevisionHints((count) => Math.min(3, count + 1))} disabled={revisionHints >= 3}>{revisionHints >= 3 ? "Hints used" : `Hint ${revisionHints + 1} · −5%`}</button></div>
              {revisionResult && <small data-task-editor-item="result">{revisionResult === "correct" ? "Correct! Continue to the next question." : `Incorrect. Correct answer: ${capitaliseStandalone(revisionRomanisation ? revisionRomanisedAnswer : word.italian)}.`}</small>}
            </section>
          </div>
        )}
        <section className="revision-memory-card">
          <img src={locationImage} alt={`Where you learned ${word.italian}`} />
          <div>
            <span>WHERE YOU LEARNED IT</span>
            <h2>{word.italian}</h2>
            <p>{revisionCategory === "roam" ? "Found while roaming the world map." : revisionCategory === "world" ? "Unlocked during a World Map adventure." : revisionCategory === "new" ? "Preview this word before you unlock it." : "Found in your adventure."}</p>
            <small className="revision-word-history">Test history · {(revisionHistory[normalise(word.italian)]?.attempts ?? 0)} attempts · {(revisionHistory[normalise(word.italian)]?.correct ?? 0)} correct</small>
          </div>
        </section>
        <div className="practice-card">
          <div className="practice-top">
            <span>{isChinese ? "单词冲刺" : "Word sprint"}</span>
            <span>
              {revisionIndex % practiceWords.length + 1} / {practiceWords.length}
            </span>
          </div>
          <div className="practice-prompt">{word.english}</div>
          <p className="text-2xl tracking-[.2em]">{hint}</p>
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" className={`rounded-lg px-3 py-2 text-xs ${mode === "easy" ? "bg-emerald-400 text-slate-900" : "bg-white/10"}`} onClick={() => setMode("easy")}>Easy mode · 2 more letters</button>
            <button type="button" className={`rounded-lg px-3 py-2 text-xs ${mode === "hard" ? "bg-amber-300 text-slate-900" : "bg-white/10"}`} onClick={() => setMode("hard")}>Hard mode · no hint · 120%</button>
          </div>
          <p>{isChinese ? "输入英语单词" : "Type the English word"}</p>
          <LiveTypingFeedback target={word.italian} value={revisionInput} className="mb-2 block text-lg" />
          <form onSubmit={submit} className="answer-form">
            <input
              autoFocus
              value={revisionInput}
              onChange={(event) => setRevisionInput(event.target.value)}
              placeholder={isChinese ? "输入答案…" : "your answer…"}
            />
            <button type="submit">{isChinese ? "检查" : "Check"}</button>
          </form>
          {revisionResult && (
            <div
              className={
                revisionResult === "correct" ? "result good" : "result bad"
              }
            >
              {revisionResult === "correct" && <span>{mode === "hard" ? "120" : "100"}% grade · </span>}
              {revisionResult === "correct"
                ? isChinese
                  ? "正确，继续！"
                  : "Correct. Keep going."
                : isChinese
                  ? `还不对，试试 “${word.italian}”。`
                  : `Not quite — try "${word.italian}".`}
            </div>
          )}
          <div className="practice-dots">
            {practiceWords.map((_, index) => (
              <span
                key={index}
                className={index === revisionIndex ? "active" : ""}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  function MultiplayerSection() {
    return (
      <section className="section-stack">
        <SectionHeading eyebrow="Online play" title="Play with others" description="Choose how you want to play online." />
        <div className="revision-areas" role="tablist" aria-label="Online play modes">
          {([
            ["normal", "Normal", "Casual games"],
            ["matchmaking", "Matchmaking", "Find an opponent"],
            ["placement", "Placement", "Set your starting rank"],
          ] as ["normal" | "matchmaking" | "placement", string, string][]).map(([mode, label, note]) => (
            <button key={mode} type="button" role="tab" aria-selected={onlineMode === mode} onClick={() => setOnlineMode(mode)} className={onlineMode === mode ? "active" : ""}>
              <span>{label}</span><b>{note}</b>
            </button>
          ))}
        </div>
        <div className="match-card">
          <div className="match-header"><div className="player"><div className="avatar you"><Users size={18} /></div><span>{onlineMode === "normal" ? "Normal match" : onlineMode === "matchmaking" ? "Matchmaking" : "Placement match"}</span></div><div className="versus">VS</div><div className="player rival"><div className="avatar">?</div><span>Another player</span></div></div>
          <p>{onlineMode === "normal" ? "A relaxed game with another player, with no rank at stake." : onlineMode === "matchmaking" ? "Find a player at your level for a competitive vocabulary match." : "Play placement games to choose your starting rank."}</p>
          <button type="button" className="matchmaking-button" onClick={() => window.alert("Online matching is unavailable right now. Please try again later.")}>{onlineMode === "normal" ? "Play normal" : onlineMode === "matchmaking" ? "Find a match" : "Start placement"}</button>
        </div>
      </section>
    );
    /* Legacy computer-opponent round retained below while online matchmaking is unavailable. */
    const questions = [
      { prompt: "早上好", answer: "good morning" },
      { prompt: "朋友", answer: "friend" },
      { prompt: "谢谢", answer: "thank you" },
    ];
    const question = questions[multiplayerIndex];
    const submit = (event: React.FormEvent) => {
      event.preventDefault();
      const correct =
        isSkipAnswer(multiInput) ||
        multiInput.trim().toLowerCase() === question.answer;
      setMultiResult(correct ? "correct" : "wrong");
      if (correct) setPlayerScore(playerScore + 1);
      setTimeout(() => {
        setMultiplayerIndex((multiplayerIndex + 1) % questions.length);
        setMultiInput("");
        setMultiResult(null);
      }, 900);
    };
    return (
      <section className="section-stack">
        <SectionHeading
          eyebrow={
            isChinese
              ? "实时练习 · 电脑对手"
              : "Live practice · computer opponent"
          }
          title={isChinese ? "多人模式" : "Multiplayer"}
          description={
            isChinese
              ? "与对手进行英语单词对决。"
              : "A head-to-head English word match. Your rival is ready whenever you are."
          }
        />
        <div className="match-card">
          <div className="match-header">
            <div className="player">
              <div className="avatar you">Y</div>
              <span>{isChinese ? "你" : "You"}</span>
              <strong>{playerScore}</strong>
            </div>
            <div className="versus">VS</div>
            <div className="player rival">
              <div className="avatar">L</div>
              <span>Lucia</span>
              <strong>2</strong>
            </div>
          </div>
          <div className="match-progress">
            <span
              style={{
                width: `${Math.min(100, ((multiplayerIndex + 1) / questions.length) * 100)}%`,
              }}
            />
          </div>
          <div className="practice-prompt">{question.prompt}</div>
          <p>{isChinese ? "输入对应的英语答案" : "Type the English answer"}</p>
          <LiveTypingFeedback target={question.answer} value={multiInput} className="mb-2 block text-lg" />
          <form onSubmit={submit} className="answer-form">
            <input
              autoFocus
              value={multiInput}
              onChange={(event) => setMultiInput(event.target.value)}
              placeholder={isChinese ? "输入答案…" : "type your answer…"}
            />
            <button type="submit">{isChinese ? "开始" : "Play"}</button>
          </form>
          {multiResult && (
            <div
              className={
                multiResult === "correct" ? "result good" : "result bad"
              }
            >
              {multiResult === "correct"
                ? isChinese
                  ? "你得分了。"
                  : "Point to you."
                : isChinese
                  ? `Lucia 更快——“${question.answer}”。`
                  : `Lucia was faster — "${question.answer}".`}
            </div>
          )}
        </div>
      </section>
    );
  }

  function SettingsSection() {
    return (
      <section className="section-stack">
        <SectionHeading
          eyebrow="Quiet for now"
          title="Settings"
          description="Your preferences will live here soon."
        />
        <div className="empty-card">
          <Settings size={28} />
          <h2>Nothing to change yet</h2>
          <p>
            Audio, language, and accessibility options are coming in a future
            chapter.
          </p>
        </div>
      </section>
    );
  }
}

function MenuLoadingScreen({ isChinese }: { isChinese: boolean }) {
  return (
    <div className="menu-loading-screen" role="status" aria-live="polite">
      <div className="menu-loading-content">
        <div className="menu-loading-mark">CB</div>
        <p>{isChinese ? "正在准备你的冒险…" : "Preparing your adventure…"}</p>
        <span className="menu-loading-bar" />
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="section-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

type WorldMapProps = {
  onMenu: () => void;
  startMapLoaded: boolean;
  onOpenMemory: () => void;
  onOpenShop: () => void;
  onOpenMarket: () => void;
  onOpenBus: () => void;
  onOpenHome: () => void;
  onOpenCop: () => void;
  onOpenMusic: () => void;
  onOpenBaron: () => void;
  onOpenSoccer: () => void;
  onSelectSaveSlot: (slot: number) => void;
  activeSaveSlot: number;
  revisionHistory: QuizHistory;
  bellaMemoryComplete: boolean;
  shopMemoryComplete: boolean;
  busComplete: boolean;
  homeComplete: boolean;
  copComplete: boolean;
  soccerComplete: boolean;
  soundMuted: boolean;
  onToggleSound: () => void;
  endSceneSummary?: EndSceneSummary | null;
  onDismissEndSceneSummary?: () => void;
  endQuizSummary?: EndQuizSummary | null;
  onDismissEndQuizSummary?: () => void;
};

function EndSceneSummaryCard({ summary, onClose }: { summary: EndSceneSummary; onClose: () => void }) {
  return (
    <div className="world-scene-summary-backdrop" role="dialog" aria-modal="true" aria-label={`${summary.title} results`}>
      <section className="world-scene-summary-card">
        <header>
          <p>Scene complete</p>
          <h2>{summary.title}</h2>
          <strong>You unlocked {summary.unlocked}/{summary.total} words</strong>
        </header>
        <div className="world-scene-summary-words">
          {summary.words.map((word) => (
            <article key={`${word.korean}-${word.english}`} className={word.unlocked ? "is-unlocked" : "is-locked"}>
              <div className="world-scene-summary-word">
                <b>{word.korean}</b>
                <span>{word.english}</span>
              </div>
              <dl>
                <div><dt>Seen before</dt><dd>{word.seenBefore} {word.seenBefore === 1 ? "time" : "times"}</dd></div>
              </dl>
            </article>
          ))}
        </div>
        <button className="world-scene-summary-continue" onClick={onClose}>Continue on the map</button>
      </section>
    </div>
  );
}

function EndQuizSummaryCard({ summary, onClose }: { summary: EndQuizSummary; onClose: () => void }) {
  const modeLabel = (mode: QuizSummaryMode) => mode === "very-hard" ? "Very Hard" : mode.charAt(0).toUpperCase() + mode.slice(1);
  return (
    <div className="world-scene-summary-backdrop" role="dialog" aria-modal="true" aria-label={`${summary.title} quiz results`}>
      <section className="world-scene-summary-card world-quiz-summary-card">
        <header>
          <p>Quiz summary</p>
          <h2>{summary.title}</h2>
          <strong>Grade {summary.grade}% · {summary.correct}/{summary.total} correct</strong>
          <span className={summary.passed ? "quiz-summary-pass" : "quiz-summary-fail"}>{summary.passed ? "Passed" : "At least 50% is required to pass"}</span>
        </header>
        <div className="world-scene-summary-words world-quiz-summary-words">
          {summary.words.map((word) => (
            <article key={`${word.korean}-${word.english}`} className={word.correct ? "is-correct" : "is-incorrect"}>
              <div className="world-scene-summary-word">
                <b>{word.korean}</b>
                <span>{word.english}</span>
              </div>
              <dl>
                <div><dt>Correct in quizzes</dt><dd>{word.correctTimes} {word.correctTimes === 1 ? "time" : "times"}</dd></div>
                <div><dt>Mode</dt><dd>{modeLabel(word.mode)}</dd></div>
                <div><dt>Last correct answer</dt><dd>{word.answerScript ?? "Not recorded"}</dd></div>
                <div><dt>This quiz</dt><dd className={word.correct ? "quiz-word-correct" : "quiz-word-incorrect"}>{word.correct ? "Correct" : "Incorrect"}</dd></div>
              </dl>
            </article>
          ))}
        </div>
        <button className="world-scene-summary-continue" onClick={onClose}>Continue on the map</button>
      </section>
    </div>
  );
}

type CollectionWord = { korean: string; english: string };
type CollectionScene = { title: string; complete: boolean; unlocked: number; words: CollectionWord[] };
type CollectionArea = { title: string; scenes: CollectionScene[] };
type CollectionChapter = { title: string; areas: CollectionArea[] };

function WorldMapCollection({ words, chapters, onClose }: { words: CollectionWord[]; chapters: CollectionChapter[]; onClose: () => void }) {
  const completedCount = chapters.flatMap(chapter => chapter.areas).flatMap(area => area.scenes).filter(scene => scene.complete).length;
  return (
    <div className="world-collection-backdrop" role="dialog" aria-modal="true" aria-label="Collection" onClick={onClose}>
      <section className="world-collection-card" onClick={event => event.stopPropagation()}>
        <header>
          <div><p>Your progress</p><h2>Collection</h2></div>
          <button onClick={onClose} aria-label="Close collection"><X size={19} /></button>
        </header>
        <div className="world-collection-content">
          <section className="world-collection-section world-collection-progress-section">
            <div className="world-collection-heading"><h3>Chapters completed so far</h3><span>{completedCount}</span></div>
            <div className="world-collection-chapters">
              {chapters.map(chapter => {
                const chapterScenes = chapter.areas.flatMap(area => area.scenes);
                const chapterUnlocked = chapterScenes.reduce((total, scene) => total + scene.unlocked, 0);
                const chapterWords = chapterScenes.reduce((total, scene) => total + scene.words.length, 0);
                return <details className="world-collection-chapter" key={chapter.title}>
                  <summary><b>{chapter.title}</b><span>{chapterUnlocked}/{chapterWords}</span></summary>
                  <div className="world-collection-areas">
                    {chapter.areas.map(area => {
                      const areaUnlocked = area.scenes.reduce((total, scene) => total + scene.unlocked, 0);
                      const areaWords = area.scenes.reduce((total, scene) => total + scene.words.length, 0);
                      const visibleScenes = area.scenes.filter(scene => scene.complete || scene.unlocked > 0);
                      return <details className="world-collection-area" key={area.title}>
                        <summary><b>{area.title}</b><span>{areaUnlocked}/{areaWords}</span></summary>
                        {visibleScenes.length ? <div className="world-collection-scenes">{visibleScenes.map(scene => <details className="world-collection-scene" key={scene.title}>
                          <summary><span>{scene.complete && <Check size={14} />} {scene.title}</span><small>{scene.unlocked}/{scene.words.length} words</small></summary>
                          <div>{scene.words.slice().sort((a, b) => a.english.localeCompare(b.english)).map(word => <p key={`${scene.title}-${word.korean}`}><b>{word.english}</b><span>{word.korean}</span></p>)}</div>
                        </details>)}</div> : <p>No scenes completed yet.</p>}
                      </details>;
                    })}
                  </div>
                </details>;
              })}
            </div>
          </section>
          <section className="world-collection-section world-collection-words-section">
            <div className="world-collection-heading"><h3>Saved words</h3><span>{words.length}</span></div>
            {words.length ? <div className="world-collection-word-grid">
              {words.map(word => <article key={`${word.korean}-${word.english}`} data-korean-guide={word.korean}><b>{word.english}</b><span>{word.korean}</span></article>)}
            </div> : <p className="world-collection-empty">Words you unlock will be saved here.</p>}
          </section>
        </div>
      </section>
    </div>
  );
}

function WorldMapSection({
  onMenu,
  onOpenMemory,
  onOpenShop,
  onOpenMarket,
  onOpenBus,
  onOpenHome,
  onOpenCop,
  onOpenMusic,
  onOpenBaron,
  onOpenSoccer,
  activeSaveSlot,
  revisionHistory,
  bellaMemoryComplete,
  shopMemoryComplete,
  busComplete,
  homeComplete,
  copComplete: savedCopComplete,
  soccerComplete,
  soundMuted,
  onToggleSound,
  endSceneSummary = null,
  onDismissEndSceneSummary = () => undefined,
  endQuizSummary = null,
  onDismissEndQuizSummary = () => undefined,
}: WorldMapProps) {
  const { isChinese } = useLanguage();
  const soundActionLabel = isChinese
    ? soundMuted ? "声音开" : "声音关"
    : soundMuted ? "Sound on" : "Sound off";
  const [mapPage, setMapPage] = useState<"elderwoods" | "town-centre">(
    "elderwoods",
  );
  const [mapSwitching, setMapSwitching] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [worldMapSettingsOpen, setWorldMapSettingsOpen] = useState(false);
  const mapSwitchRequestRef = useRef(0);
  const [progressOpen, setProgressOpen] = useState(true);
  const marketComplete =
    localStorage.getItem(`taletalk-slot-${activeSaveSlot}-market-complete`) ===
    "true";
  const busScore = readBestQuizScore("bus", activeSaveSlot);
  const savedMusicQuizSummary = readEndQuizSummary("music", activeSaveSlot);
  const musicScore = readBestQuizScore("music", activeSaveSlot)
    ?? savedMusicQuizSummary?.grade
    ?? null;
  const musicComplete = localStorage.getItem(`taletalk-slot-${activeSaveSlot}-music-complete`) === "true";
  const maskedBaronComplete = localStorage.getItem(`taletalk-slot-${activeSaveSlot}-masked-baron-complete`) === "true";
  // Sports Day now completes Elderwoods. The next map then introduces Mason.
  const copComplete = savedCopComplete || homeComplete;
  const mapTime = musicComplete
    ? "12:12 AM"
    : savedCopComplete
      ? "10:11 PM"
      : soccerComplete
        ? "8:41 PM"
        : homeComplete
          ? "6:01 PM"
          : busComplete
            ? "3:01 PM"
            : marketComplete
              ? "2:39 PM"
              : shopMemoryComplete
                ? "2:12 PM"
                : bellaMemoryComplete
                  ? "1:49 PM"
                  : "1:23 PM";
  // This intentionally changes only the backdrop; all point coordinates below stay untouched.
  const elderwoodsMapImage = soccerComplete
    ? WORLD_MAP_NIGHT_IMG
    : homeComplete
      ? WORLD_MAP_SUNSET_IMG
      : shopMemoryComplete
      ? WORLD_MAP_DAY_IMG
      : WORLD_MAP_IMG;
  useEffect(() => {
    [WORLD_MAP_IMG, WORLD_MAP_DAY_IMG, WORLD_MAP_SUNSET_IMG, WORLD_MAP_NIGHT_IMG, TOWN_CENTRE_MAP_IMG]
      .forEach(source => void preloadImage(source, "high"));
    // Once the map itself is ready, warm every story's real first frame in
    // the background. Pointer hover still prioritises the likely choice, while
    // this also covers touch input where no hover event exists.
    return scheduleIdleImagePreload(Object.values(WORLD_SCENE_ENTRY_IMAGES));
  }, []);
  const switchMapPage = (page: "elderwoods" | "town-centre") => {
    if (page === mapPage || mapSwitching) return;
    const request = ++mapSwitchRequestRef.current;
    const destinationImage = page === "town-centre" ? TOWN_CENTRE_MAP_IMG : elderwoodsMapImage;
    // Keep the current map and its markers intact while the destination
    // decodes. Once ready, the new bitmap and overlay enter the same render.
    void preloadImage(destinationImage, "high").then(() => {
      if (request !== mapSwitchRequestRef.current) return;
      setMapSwitching(true);
      setMapPage(page);
    });
  };
  const chapterScenes = [
    { title: "Scene One", note: "Chapter One · The first Elderwoods scene.", image: "a1.png", words: ["hello", "friend"], complete: bellaMemoryComplete, available: true, open: onOpenMemory },
    { title: "Ice Cream Shop", note: "Chapter One · The ice cream shop story.", image: "scenes/shop/c1-v3.png", words: ["ice cream", "water"], complete: shopMemoryComplete, available: bellaMemoryComplete, open: onOpenShop },
    { title: "Shopping Centre", note: "Chapter One · Shopping and food words.", image: "scenes/shop/c2-v3.png", words: ["water", "coffee"], complete: marketComplete, available: shopMemoryComplete, open: onOpenMarket },
    { title: "Returning Home", note: "Chapter One · Home and family words.", image: "scenes/home/e1-enhanced.png", words: ["window", "bed"], complete: homeComplete, available: marketComplete, open: onOpenHome },
    { title: "Detective Mason", note: "Chapter One · Mason's case.", image: "scenes/cop/i1.png", words: ["carry", "key"], complete: savedCopComplete, available: homeComplete, open: onOpenCop },
    { title: "Sports Day", note: "Chapter One · Josh and William's challenge.", image: "scenes/sports-day/g1.png", words: ["run", "jump"], complete: soccerComplete, available: savedCopComplete, open: onOpenSoccer },
  ];
  const collectionNormalise = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const resolveCollectionWord = (value: string): CollectionWord => {
    const key = collectionNormalise(value);
    const known = COLLECTION_WORD_BANK.find(word =>
      [word.korean, word.english, word.historyWord ?? ""].some(alias => collectionNormalise(alias) === key),
    );
    if (known) return { korean: known.korean, english: known.english };
    const isKorean = /[가-힣]/.test(value);
    return isKorean
      ? { korean: value, english: "Meaning not recorded" }
      : { korean: "Korean not recorded", english: capitaliseStandalone(value) };
  };
  const collectionWords = (() => {
    const rawWords = new Set(
      readStoredArray(localStorage.getItem(`taletalk-slot-${activeSaveSlot}-unlocked-words`))
        .filter((word): word is string => typeof word === "string" && Boolean(word.trim())),
    );
    Object.values(SCENE_SUMMARY_DEFINITIONS).filter(scene => !scene.scored).forEach(scene => {
      readStoredArray(localStorage.getItem(`taletalk-slot-${activeSaveSlot}-scene-${scene.storageScene}-words`))
        .filter((word): word is string => typeof word === "string" && Boolean(word.trim()))
        .forEach(word => rawWords.add(word));
    });
    const seen = new Set<string>();
    return [...rawWords].map(raw => {
      return resolveCollectionWord(raw);
    }).filter(word => {
      const key = collectionNormalise(word.korean);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.english.localeCompare(b.english, undefined, { sensitivity: "base" }) || a.korean.localeCompare(b.korean));
  })();
  const maskedBaronWordRequirement = 33;
  const maskedBaronUnlocked = maskedBaronComplete || collectionWords.length >= maskedBaronWordRequirement;
  const collectionSceneWords = (values: string[]) => values.map(resolveCollectionWord)
    .filter((word, index, list) => list.findIndex(candidate => collectionNormalise(candidate.korean) === collectionNormalise(word.korean)) === index);
  const collectionScene = (sceneId: string, title: string, complete: boolean): CollectionScene => {
    const definition = SCENE_SUMMARY_DEFINITIONS[sceneId];
    const saved = new Set(
      readStoredArray(localStorage.getItem(`taletalk-slot-${activeSaveSlot}-scene-${definition.storageScene}-words`))
        .filter((word): word is string => typeof word === "string")
        .map(collectionNormalise),
    );
    const unlocked = complete ? definition.words.length : definition.words.filter(word =>
      [word.korean, word.english, word.historyWord ?? ""].some(alias => saved.has(collectionNormalise(alias))),
    ).length;
    return { title, complete, unlocked, words: collectionSceneWords(definition.words.map(word => word.korean)) };
  };
  const sceneProgressBadge = (sceneId: string, completed = false) => {
    const definition = SCENE_SUMMARY_DEFINITIONS[sceneId];
    if (!definition || definition.scored) return "★";
    const saved = new Set(
      readStoredArray(localStorage.getItem(`taletalk-slot-${activeSaveSlot}-scene-${definition.storageScene}-words`))
        .filter((word): word is string => typeof word === "string")
        .map(collectionNormalise),
    );
    const unlocked = completed ? definition.words.length : definition.words.filter(word =>
      [word.korean, word.english, word.historyWord ?? ""].some(alias => saved.has(collectionNormalise(alias))),
    ).length;
    return `${unlocked}/${definition.words.length}`;
  };
  const collectionChapters: CollectionChapter[] = [
    { title: "Chapter I", areas: [
      { title: "Elderwoods", scenes: [
        collectionScene("backyard", "Scene One", bellaMemoryComplete),
        collectionScene("icecream", "Ice Cream Shop", shopMemoryComplete),
        collectionScene("shopping", "Shopping Centre", marketComplete),
        collectionScene("home", "Returning Home", homeComplete),
        collectionScene("sports", "Sports Day", soccerComplete),
      ] },
      { title: "Town Centre", scenes: [
        collectionScene("cop", "Detective Mason", savedCopComplete),
        collectionScene("masked-baron", "The Masked Baron", maskedBaronComplete),
      ] },
    ] },
  ];
  const collectionButton = (
    <button className="world-map-collection-button" onClick={() => setCollectionOpen(true)}>
      <BookOpen size={19} />
      <strong>Collection</strong>
    </button>
  );
  const collectionPanel = collectionOpen ? <WorldMapCollection words={collectionWords} chapters={collectionChapters} onClose={() => setCollectionOpen(false)} /> : null;
  const worldMapSettings = (
    <div className="map-settings">
      <button className="map-settings-trigger" type="button" onClick={() => setWorldMapSettingsOpen((open) => !open)} aria-label="World Map settings" aria-expanded={worldMapSettingsOpen}>
        <Settings size={20} />
      </button>
      {worldMapSettingsOpen && <div className="map-settings-menu">
        <button onClick={onToggleSound} aria-label={soundMuted ? "Turn sound on" : "Mute sound"}>
          {soundMuted ? <Volume2 size={15} /> : <VolumeX size={15} />}{soundActionLabel}
        </button>
        <button onClick={onMenu}>Menu</button>
      </div>}
    </div>
  );
  const sceneQuizScore = (words: string[]) => {
    const attempts = words.flatMap((word) => revisionHistory[word.toLowerCase()]?.recent ?? []).sort((a, b) => a.at - b.at).slice(-5);
    return { attempts: attempts.length, percent: attempts.length ? Math.round((attempts.filter((attempt) => attempt.correct).length / attempts.length) * 100) : 0 };
  };
  if (false) return (
    <div className="world-chapter-screen">
      <header className="world-chapter-header">
        <button onClick={onMenu}><ChevronLeft size={16} /> Main menu</button>
        <div><span>CHAPTER ONE</span><h1>World Map · Chapter One</h1></div>
        <button className="world-chapter-progress-toggle" onClick={() => setProgressOpen(true)}>Your progress</button>
      </header>
      <main className="world-chapter-list" aria-label="World Map scenes">
        {chapterScenes.map((scene, index) => {
          const score = sceneQuizScore(scene.words);
          return <button key={scene.title} className={`world-chapter-row ${scene.available ? "" : "is-locked"}`} style={{ backgroundImage: `linear-gradient(90deg, rgba(6, 44, 43, .9), rgba(6, 44, 43, .58)), url('${assetUrl(scene.image)}')` }} onClick={() => scene.available ? scene.open() : window.alert("Complete the previous scene to unlock this one.")}><b className="world-chapter-number">{index + 1}</b><span className="world-chapter-copy"><strong>{scene.title}</strong><small>{scene.note}</small><em>{score.percent}% correct · {score.attempts ? `${score.attempts} recent attempt${score.attempts === 1 ? "" : "s"}` : "not tested"}</em></span><i className={scene.complete ? "is-complete" : ""}>{scene.complete ? <Check size={16} /> : ""}</i></button>;
        })}
      </main>
      {progressOpen && <aside className="world-progress-drawer" aria-label="World Map quiz history"><button className="world-progress-close" onClick={() => setProgressOpen(false)} aria-label="Close progress"><X size={17} /></button><p>Your progress</p><span>Last five quiz attempts in each scene</span><div>{chapterScenes.map((scene) => { const score = sceneQuizScore(scene.words); return <article key={scene.title}><img src={assetUrl(scene.image)} alt="" /><section><strong>{scene.title}</strong><small>{score.percent}% · {score.attempts ? `${score.attempts}/5 attempts` : "not tested"}</small></section></article>; })}</div></aside>}
    </div>
  );
  const point = (
    label: string,
    position: React.CSSProperties,
    onClick: () => void,
    badge: string,
    locked = false,
  ) => {
    if (label === "Detective Mason" && mapPage === "elderwoods") return null;
    const sceneStartImages: Record<string, string> = {
      "Scene One": assetUrl("a1.png"),
      "Ice Cream Shop": assetUrl("scenes/bella/b1-woman-no-boards-v2.png"),
      "Shopping Centre": assetUrl("scenes/shop/c1-v3.png"),
      "Bus Stop Quiz": assetUrl("scenes/bus/d1.png"),
      "Returning Home": assetUrl("scenes/home/return-home-e1.webp"),
      "Detective Mason": assetUrl("scenes/cop/i1.png"),
      "Sports Day": assetUrl("scenes/sports-day/g1.png"),
      "Night Music": assetUrl("scenes/music/1a.png"),
      "The Masked Baron": assetUrl("scenes/masked-baron/1a.png"),
    };
    const startImage = sceneStartImages[label];
    const sceneAmbience: Partial<Record<string, { file: string; volume: number }>> = {
      "Bus Stop Quiz": { file: "audio/bus-stop-engine.mp3", volume: 0.23 },
      "Sports Day": { file: "audio/sports-day-soft-crowd.mp3", volume: 0.192 },
    };
    const exactBounds: Record<string, React.CSSProperties> = {
      "Returning Home": { left: "33.7%", top: "63.9%", transform: "none" },
    };
    return (
      <>
        <button
          key={`${mapPage}-${label}`}
          className={`map-memory-point ${label === "Bus Stop Quiz" || label === "Night Music" ? "bus-stop-star" : ""} ${label === "The Masked Baron" ? "masked-barron-point" : ""} ${locked ? "opacity-50" : ""}`}
          style={exactBounds[label] ?? position}
          onPointerEnter={() => { if (!locked && startImage) void preloadImage(startImage, "low"); }}
          onClick={() => {
            if (locked) {
              window.alert(label === "The Masked Baron"
                ? `Unlock ${maskedBaronWordRequirement} words to enter The Masked Baron. You currently have ${collectionWords.length}.`
                : "You need a ★ star to continue.");
              return;
            }
            const ambience = sceneAmbience[label];
            if (ambience) primeSceneAmbience(ambience.file, ambience.volume);
            onClick();
          }}
          aria-label={label === "★" ? "Bus stop test" : label}
        >
          <span className="hotspot-pulse" />
          <span className="map-memory-badge">{badge}</span>
          <span className="hotspot-tooltip">
            {locked
              ? label === "The Masked Baron"
                ? `Unlock ${maskedBaronWordRequirement} words to enter · ${collectionWords.length}/${maskedBaronWordRequirement}`
                : "You need a ★ star to continue."
              : label === "Bus Stop Quiz" && busScore !== null
                ? `Bus Stop Quiz · ${busScore}% · Click to retake`
                : label === "Night Music" && musicScore !== null
                  ? `Night Music Quiz · ${musicScore}% · Click to retake`
                  : label === "Night Music"
                    ? "Night Music Quiz"
                    : label === "★"
                      ? "Bus Stop Quiz"
                      : label}
          </span>
        </button>
        {label === "Sports Day" && soccerComplete && (
          <button
            className="world-map-page-arrow world-map-page-arrow-gold world-map-page-arrow-west"
            onClick={() => switchMapPage("town-centre")}
            aria-label="Open the town-centre map"
          >
            <ChevronLeft />
          </button>
        )}
      </>
    );
  };
  const position = (x: number, y: number): React.CSSProperties => ({
    left: `${x}%`,
    top: `${y}%`,
    transform: "none",
  });
  if (mapPage === "town-centre")
    return (
      <div className={`world-map-scene ${mapSwitching ? "world-map-is-switching" : ""}`}>
        <SmoothSceneImage
          className="world-map-image"
          src={TOWN_CENTRE_MAP_IMG}
          alt="Town centre map"
          onDisplayed={(src) => { if (src === TOWN_CENTRE_MAP_IMG) setMapSwitching(false); }}
        />
        <div className="world-map-vignette" />
        <header className="world-map-topbar">
          <div>
            <h1>TaleTalk</h1>
            <span>THE WORLD MAP · CHAPTER II</span>
            <small className="world-map-time">{mapTime}</small>
          </div>
          {worldMapSettings}
        </header>
        {collectionButton}
        <button
          className="world-map-page-arrow world-map-page-arrow-west"
          onClick={() => switchMapPage("elderwoods")}
          aria-label="Return to Elderwoods"
        >
          <ChevronRight />
        </button>
        {point(
          "Detective Mason",
          position(48.5, 65.5),
          onOpenCop,
          sceneProgressBadge("cop", savedCopComplete),
        )}
        {savedCopComplete && point("Night Music", position(68, 34), onOpenMusic, "★")}
        {musicComplete && point("The Masked Baron", position(50.4, 21.6), onOpenBaron, sceneProgressBadge("masked-baron", maskedBaronComplete), !maskedBaronUnlocked)}
        {collectionPanel}
        {endSceneSummary && <EndSceneSummaryCard summary={endSceneSummary} onClose={onDismissEndSceneSummary} />}
        {endQuizSummary && <EndQuizSummaryCard summary={endQuizSummary} onClose={onDismissEndQuizSummary} />}
      </div>
    );
  return (
    <div className={`world-map-scene ${mapSwitching ? "world-map-is-switching" : ""}`}>
      <SmoothSceneImage
        className="world-map-image"
        src={elderwoodsMapImage}
        alt="The world map"
        onDisplayed={(src) => { if (src === elderwoodsMapImage) setMapSwitching(false); }}
      />
      <div className="world-map-vignette" />
      <header className="world-map-topbar">
        <div>
          <h1>TaleTalk</h1>
          <span>THE WORLD MAP · CHAPTER I</span>
          <small className="world-map-time">{mapTime}</small>
        </div>
        {worldMapSettings}
      </header>
      {!bellaMemoryComplete ? (
        <div className="world-map-intro world-map-intro-sm">
          <div className="eyebrow">Chapter I · Elderwoods</div>
          <h2>Welcome to Elderwoods</h2>
          <p>Explore, learn new words, and open each story in order.</p>
        </div>
      ) : collectionButton}
      {point(
        "Scene One",
        position(41.9, 56.8),
        onOpenMemory,
        sceneProgressBadge("backyard", bellaMemoryComplete),
      )}
      {bellaMemoryComplete &&
        point(
          "Ice Cream Shop",
          position(42, 42.8),
          onOpenShop,
          sceneProgressBadge("icecream", shopMemoryComplete),
        )}
      {shopMemoryComplete &&
        point(
          "Shopping Centre",
          position(72.4, 57.7),
          onOpenMarket,
          sceneProgressBadge("shopping", marketComplete),
        )}
      {marketComplete &&
        point(
          "Bus Stop Quiz",
          position(44.4, 25.5),
          onOpenBus,
          "\u2605",
        )}
      {shopMemoryComplete &&
        point(
          "Returning Home",
          { left: "41.7%", top: "34.3%" },
          onOpenHome,
          sceneProgressBadge("home", homeComplete),
          !busComplete,
        )}
      {homeComplete &&
        point(
          "Detective Mason",
          position(46.1, 29.6),
          onOpenCop,
          sceneProgressBadge("cop", savedCopComplete),
        )}
      {copComplete &&
        point(
          "Sports Day",
          position(60.1, 82.6),
          onOpenSoccer,
          sceneProgressBadge("sports", soccerComplete),
        )}
      {collectionPanel}
      {endSceneSummary && <EndSceneSummaryCard summary={endSceneSummary} onClose={onDismissEndSceneSummary} />}
      {endQuizSummary && <EndQuizSummaryCard summary={endQuizSummary} onClose={onDismissEndQuizSummary} />}
    </div>
  );
  return (
    <div className="world-map-scene">
      <SmoothSceneImage
        className="world-map-image"
        src={WORLD_MAP_IMG}
        alt="The world map"
      />
      <div className="world-map-vignette" />
      <header className="world-map-topbar">
        <div>
          <h1>TaleTalk</h1>
          <span>THE WORLD MAP · CHAPTER I</span>
          <small className="world-map-time">{mapTime}</small>
        </div>
        <div className="flex gap-2">
          <button
            className="world-map-menu"
            onClick={onToggleSound}
            aria-label={soundMuted ? "Turn sound on" : "Mute sound"}
          >
            {soundMuted ? <Volume2 size={15} /> : <VolumeX size={15} />}{" "}
            {soundActionLabel}
          </button>
          <button className="world-map-menu" onClick={onMenu}>
            Menu
          </button>
        </div>
      </header>
      <div className="world-map-intro world-map-intro-sm">
        <div className="eyebrow">Chapter I · Elderwoods</div>
        <h2>Welcome to Elderwoods</h2>
        <p>Explore, learn new words, and open each story in order.</p>
      </div>
      {point(
        "Scene One",
        position(41.9, 56.8),
        onOpenMemory,
        sceneProgressBadge("backyard", bellaMemoryComplete),
        marketComplete && !busComplete,
      )}
      {bellaMemoryComplete &&
        point(
          "Ice Cream Shop",
          position(42, 42.8),
          onOpenShop,
          sceneProgressBadge("icecream", shopMemoryComplete),
        )}
      {shopMemoryComplete &&
        !marketComplete &&
        point("Shopping Centre", position(70.9, 54.5), onOpenMarket, sceneProgressBadge("shopping", marketComplete))}
      {point(
        "Bus Stop Quiz",
        { left: "46.3%", top: "38.6%" },
        onOpenBus,
        "\u2605",
      )}
      {busComplete &&
        point(
          "Returning Home",
          { left: "41.7%", top: "34.3%" },
          onOpenHome,
          sceneProgressBadge("home", homeComplete),
        )}
      {homeComplete &&
        point(
          "Sports Day",
          { left: "50.6%", top: "33.4%" },
          onOpenSoccer,
          sceneProgressBadge("sports", soccerComplete),
        )}
    </div>
  );
}

function LegacyWorldMapSection({
  onMenu,
  startMapLoaded,
  onOpenMemory,
  onOpenShop,
  onOpenMarket,
  onOpenBus,
  onOpenHome,
  onOpenSoccer,
  onSelectSaveSlot,
  activeSaveSlot,
  bellaMemoryComplete,
  shopMemoryComplete,
  busComplete,
  homeComplete,
  soccerComplete,
}: {
  onMenu: () => void;
  startMapLoaded: boolean;
  onOpenMemory: () => void;
  onOpenShop: () => void;
  onOpenMarket: () => void;
  onOpenBus: () => void;
  onOpenHome: () => void;
  onOpenSoccer: () => void;
  onSelectSaveSlot: (slot: number) => void;
  activeSaveSlot: number;
  bellaMemoryComplete: boolean;
  shopMemoryComplete: boolean;
  busComplete: boolean;
  homeComplete: boolean;
  soccerComplete: boolean;
}) {
  const { isChinese } = useLanguage();
  const { listSlots, nameSlot, removeSlot } = useSave();
  const [hovered, setHovered] = useState(false);
  const [hoveredShop, setHoveredShop] = useState(false);
  const [hoveredMarket, setHoveredMarket] = useState(false);
  const accountKey = (name: string) =>
    `taletalk-slot-${activeSaveSlot}-${name}`;
  const marketComplete =
    localStorage.getItem(accountKey("market-complete")) === "true";
  const [showWelcome, setShowWelcome] = useState(
    () =>
      localStorage.getItem(
        `taletalk-slot-${activeSaveSlot}-map-welcome-seen`,
      ) !== "true",
  );
  const [wordBoxOpen, setWordBoxOpen] = useState(false);
  const [saveSlots, setSaveSlots] = useState(() => listSlots());
  const [mapLoaded, setMapLoaded] = useState(startMapLoaded);
  const [creatingSlot, setCreatingSlot] = useState<number | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<{
    slot: number;
    name: string;
  } | null>(null);
  const [fileName, setFileName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [savedWords] = useState(
    () =>
      JSON.parse(
        localStorage.getItem(
          `taletalk-slot-${activeSaveSlot}-unlocked-words`,
        ) ?? "[]",
      ) as string[],
  );
  const overlay = useDebugOverlay();
  const { debugMode, sceneRef, handleSceneMouseMove } = overlay;
  const chooseSaveFile = (file: {
    slot: number;
    name: string | null;
    avatar: string | null;
    phase: GamePhase | null;
  }) => {
    if (!file.name && !file.phase) {
      setCreatingSlot(file.slot);
      setFileName("");
      setAvatar(null);
      return;
    }
    onSelectSaveSlot(file.slot);
    setMapLoaded(true);
  };

  const createSaveFile = () => {
    if (creatingSlot === null || !fileName.trim()) return;
    [
      "bella-complete",
      "shop-complete",
      "bus-complete",
      "home-complete",
      "soccer-complete",
    ].forEach((name) =>
      localStorage.removeItem(`taletalk-slot-${creatingSlot}-${name}`),
    );
    localStorage.removeItem(`taletalk-save-slot-${creatingSlot}`);
    nameSlot(creatingSlot, fileName.trim(), avatar);
    localStorage.setItem("taletalk-romanisation-enabled", "true");
    window.dispatchEvent(new CustomEvent("taletalk-romanisation-change", { detail: true }));
    onSelectSaveSlot(creatingSlot);
    setSaveSlots(listSlots());
    setCreatingSlot(null);
    setMapLoaded(true);
  };
  const readAvatar = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };

  if (!mapLoaded)
    return (
      <div className="save-select-screen">
        <img className="save-select-bg" src={HOME_BACKGROUNDS[0]} alt="" />
        <div className="save-select-shade" />
        <main className="save-select-card">
          <p className="save-select-label">Data List</p>
          <h1>Select data to load</h1>
          <div className="save-select-list">
            {saveSlots.map((file) => (
              <div
                key={file.slot}
                className={`save-file-row ${file.slot === activeSaveSlot ? "active" : ""}`}
              >
                {file.name ? (
                  <>
                    <button
                      className="save-file-load"
                      onClick={() => chooseSaveFile(file)}
                    >
                      {file.avatar ? (
                        <img
                          src={file.avatar}
                          className="save-avatar-image"
                          alt=""
                        />
                      ) : (
                        <span
                          className={`save-avatar save-avatar-${file.slot}`}
                        >
                          {file.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span>
                        <strong>{file.name}</strong>
                        <small>
                          Last scene · {file.phase ?? "Opening scene"}
                        </small>
                      </span>
                      <span className="save-file-time">
                        Play time
                        <br />
                        <b>{file.updatedAt ? "In progress" : "00:00"}</b>
                      </span>
                    </button>
                    <button
                      className="save-file-delete"
                      onClick={() =>
                        setDeletingSlot({ slot: file.slot, name: file.name! })
                      }
                      aria-label={`Delete ${file.name}`}
                    >
                      <X size={17} />
                    </button>
                  </>
                ) : (
                  <button
                    className="save-file-new"
                    onClick={() => chooseSaveFile(file)}
                  >
                    <span className="save-avatar">+</span>
                    <span>
                      <strong>Create a new story</strong>
                      <small>Empty save file {file.slot}</small>
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button className="save-select-menu" onClick={onMenu}>
            Back to menu
          </button>
          {creatingSlot !== null && (
            <div className="save-form">
              <h2>Create a new story</h2>
              <input
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
                placeholder="File name"
                autoFocus
              />
              <label>
                Choose avatar photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => readAvatar(event.target.files?.[0])}
                />
              </label>
              {avatar && (
                <img
                  src={avatar}
                  className="save-avatar-preview"
                  alt="Avatar preview"
                />
              )}
              <div>
                <button onClick={() => setCreatingSlot(null)}>Cancel</button>
                <button onClick={createSaveFile}>Start adventure</button>
              </div>
            </div>
          )}
          {deletingSlot && (
            <div className="save-form">
              <h2>Delete {deletingSlot.name}?</h2>
              <p>Type the file name to confirm.</p>
              <input
                autoFocus
                placeholder={deletingSlot.name}
                onChange={(event) => {
                  if (event.target.value === deletingSlot.name) {
                    removeSlot(deletingSlot.slot);
                    setSaveSlots(listSlots());
                    setDeletingSlot(null);
                  }
                }}
              />
              <button onClick={() => setDeletingSlot(null)}>Cancel</button>
            </div>
          )}
        </main>
      </div>
    );

  return (
    <div
      className="world-map-scene"
      ref={sceneRef}
      onMouseMove={handleSceneMouseMove}
      onClick={() => {
        if (showWelcome) {
          localStorage.setItem(accountKey("map-welcome-seen"), "true");
          setShowWelcome(false);
        }
      }}
    >
      <SmoothSceneImage
        className="world-map-image"
        src={WORLD_MAP_IMG}
        alt="The world map"
        draggable={false}
      />
      <div className="world-map-vignette" />
      <header className="world-map-topbar">
        <div>
          <h1>TaleTalk</h1>
          <span>
            {isChinese ? "世界地图 · 第一章" : "THE WORLD MAP · CHAPTER I"}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            className="world-map-menu"
            onClick={() => {
              setSaveSlots(listSlots());
              setMapLoaded(false);
            }}
          >
            {isChinese ? "存档" : `Save files · ${activeSaveSlot}/6`}
          </button>
          <button
            className="world-map-menu"
            onClick={() => setWordBoxOpen((open) => !open)}
          >
            {isChinese
              ? "已解锁单词"
              : `Words${savedWords.length ? ` (${savedWords.length})` : ""}`}
          </button>
          <button className="world-map-menu" onClick={onMenu}>
            {isChinese ? "菜单" : "Menu"}
          </button>
        </div>
      </header>

      {wordBoxOpen && (
        <div className="absolute right-5 top-20 z-30 w-56 rounded-2xl border border-white/15 bg-black/90 p-3 shadow-2xl">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#c4942a]">
            {isChinese ? "已解锁单词" : "Unlocked words"}
          </div>
          {savedWords.length ? (
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {savedWords.map((word) => (
                <div
                  key={word}
                  className="rounded-lg bg-white/5 px-2 py-1.5 text-sm text-white"
                >
                  {word}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/55">
              {isChinese
                ? "输入单词即可在这里解锁。"
                : "Type words in scenes to unlock them here."}
            </p>
          )}
        </div>
      )}

      <div className="world-map-intro world-map-intro-sm">
        <div className="eyebrow">
          {isChinese ? "第一章 · 艾尔德伍兹" : "Chapter I · Elderwoods"}
        </div>
        <h2>{isChinese ? "探索世界" : "Explore the world"}</h2>
        <p>
          {isChinese
            ? "每个发光点都藏着一段等待重温的记忆。旅程从艾尔德伍兹开始。"
            : "Each glowing point holds a memory waiting to be relived. Your journey begins in Elderwoods, where it all began."}
        </p>
      </div>

      {showWelcome && (
        <button
          className="world-map-dialogue"
          onClick={() => {
            localStorage.setItem(accountKey("map-welcome-seen"), "true");
            setShowWelcome(false);
          }}
        >
          <div className="world-map-dialogue-head">
            <div>
              <div className="eyebrow">Welcome to Elderwood</div>
              <h3>欢迎来到艾尔德伍德！</h3>
            </div>
          </div>
          <p>
            在这里，你将探索新的区域，认识新的人，并在学习一门新语言的同时发现新的冒险。
          </p>
          <span>点击任意位置继续</span>
        </button>
      )}

      <button
        className="map-memory-point"
        style={
          marketComplete
            ? { left: "34.9%", top: "55.8%" }
            : { left: "37%", top: "59%" }
        }
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (shopMemoryComplete)
            window.alert(
              "You must gain a ★ Star in order to proceed to the next level.",
            );
          else onOpenMemory();
        }}
        aria-label={isChinese ? "打开第一段记忆" : "Open the first memory"}
      >
        <span className="hotspot-pulse" />
        <span className="map-memory-badge">
          {marketComplete
            ? busComplete
              ? "2/4"
              : "2/4 locked"
            : bellaMemoryComplete
              ? "1/4"
              : "0/4"}
        </span>
        {hovered && (
          <span className="hotspot-tooltip">The first memory</span>
        )}
      </button>

      {bellaMemoryComplete && !shopMemoryComplete && (
        <button
          className="map-memory-point"
          style={{ left: "58.5%", top: "51.1%" }}
          onMouseEnter={() => setHoveredShop(true)}
          onMouseLeave={() => setHoveredShop(false)}
          onClick={(e) => {
            e.stopPropagation();
            onOpenShop();
          }}
          aria-label={
            isChinese ? "打开冰淇淋记忆" : "Open the ice cream memory"
          }
        >
          <span className="hotspot-pulse" />
          <span className="map-memory-badge">
            {shopMemoryComplete ? "4/4" : "0/4"}
          </span>
          {hoveredShop && (
            <span className="hotspot-tooltip">The ice cream memory</span>
          )}
        </button>
      )}

      {(marketComplete || shopMemoryComplete) && (
        <button
          className="map-memory-point bus-stop-star"
          style={{ left: "46.3%", top: "38.6%" }}
          onClick={onOpenBus}
          aria-label="Unlock a star at the bus stop"
        >
          <span className="hotspot-pulse" />
          <span className="map-memory-badge">{"\u2605"}</span>
          <span className="hotspot-tooltip">Bus stop test</span>
        </button>
      )}
      {busComplete && (
        <button
          className="map-memory-point"
          style={{ left: "41.7%", top: "34.3%" }}
          onClick={onOpenHome}
          aria-label="Open the house"
        >
          <span className="hotspot-pulse" />
          <span className="map-memory-badge">{homeComplete ? "★" : "★"}</span>
          <span className="hotspot-tooltip">Returning Home</span>
        </button>
      )}
      {homeComplete && (
        <button
          className="map-memory-point"
          style={{ left: "50.6%", top: "33.4%" }}
          onClick={onOpenSoccer}
          aria-label="Open the soccer match"
        >
          <span className="hotspot-pulse" />
          <span className="map-memory-badge">
            {soccerComplete ? "GOAL!" : "NEW"}
          </span>
          <span className="hotspot-tooltip">Soccer Match</span>
        </button>
      )}

      {debugMode && (
        <DebugOverlayPanel
          overlay={overlay}
          mediaLabel={WORLD_MAP_IMG.split("/").pop()!}
        />
      )}

      {shopMemoryComplete && !marketComplete && (
        <button
          className="map-memory-point"
          style={{ left: "64.3%", top: "55.9%" }}
          onMouseEnter={() => setHoveredMarket(true)}
          onMouseLeave={() => setHoveredMarket(false)}
          onClick={(e) => {
            e.stopPropagation();
            onOpenMarket();
          }}
          aria-label={
            isChinese ? "打开去商店的旅行" : "Open a trip to the shop"
          }
        >
          <span className="hotspot-pulse" />
          <span className="map-memory-badge">0/1</span>
          {hoveredMarket && (
            <span className="hotspot-tooltip">A trip to the shop</span>
          )}
        </button>
      )}

      <footer className="world-map-footer">
        <span>
          {isChinese
            ? shopMemoryComplete
              ? "已解锁 2 / 2 段记忆"
              : bellaMemoryComplete
                ? "已解锁 1 / 2 段记忆"
                : "已解锁 0 / 2 段记忆"
            : shopMemoryComplete
              ? "2 / 2 memories unlocked"
              : bellaMemoryComplete
                ? "1 / 2 memories unlocked"
                : "0 / 2 memories unlocked"}
        </span>
        <span>
          {isChinese
            ? "点击发光点重温记忆 · 按 # 查看坐标"
            : "Click a glowing point to remember · Press # for coordinates"}
        </span>
      </footer>
    </div>
  );
}

interface ShopWordTooltip {
  word: string;
  translation: string;
}

const SHOP_CHOICES: Array<{
  id: string;
  italianLabel: string;
  englishLabel: string;
  prompt: string;
  correct: boolean;
  responseIt: string;
  responseEn: string;
  wordTooltips: ShopWordTooltip[];
}> = [
  {
    id: "gelato",
    italianLabel: "Ice cream please",
    englishLabel: "Ice cream, please.",
    prompt: "ice cream please",
    correct: true,
    responseIt: "",
    responseEn: "",
    wordTooltips: [{ word: "Ice cream please", translation: "Ice cream, please." }],
  },
];

const GRAZIE_WORDS: ShopWordTooltip[] = [
  { word: "Thank you", translation: "Thank you" },
];
const PREGO_WORDS: ShopWordTooltip[] = [
  { word: "You are welcome", translation: "You are welcome" },
];

// This adventure teaches Korean: the word to type is Korean and the meaning
// underneath is English. The legacy data retains its old keys for saves.
const SHOP_KOREAN: Record<string, string> = {
  "Ice cream please": "아이스크림 주세요",
  "ice cream please": "아이스크림 주세요",
  "one pizza": "피자 하나",
  "one water": "물 하나",
  please: "주세요",
  "Thank you": "감사합니다",
  "You are welcome": "천만에요",
};
const SHOP_ENGLISH: Record<string, string> = {
  "Ice cream please": "Ice cream, please.",
  "ice cream please": "Ice cream, please.",
  "one pizza": "One pizza",
  "one water": "One water",
  please: "please",
  "Thank you": "Thank you",
  "You are welcome": "You are welcome",
};
const SHOP_ROMANISATION: Record<string, string> = {
  "아이스크림 주세요": "aiseukeurim juseyo",
  "피자 하나": "pija hana",
  "물 하나": "mul hana",
  "주세요": "juseyo",
  "감사합니다": "gamsahamnida",
  "천만에요": "cheonmaneyo",
};
const shopKorean = (word: string) => SHOP_KOREAN[word] ?? word;
const shopEnglish = (word: string, fallback: string) => SHOP_ENGLISH[word] ?? fallback;
const shopRomanisation = (word: string) => SHOP_ROMANISATION[shopKorean(word)] ?? "";

function matchShopChoiceInput(
  raw: string,
): (typeof SHOP_CHOICES)[number] | null {
  if (isSkipAnswer(raw)) {
    return SHOP_CHOICES.find((choice) => choice.correct) ?? null;
  }

  const normalized = stripAccents(
    raw
      .toLowerCase()
      .replace(/[.,!?]/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
  if (!normalized) return null;

  const exact = SHOP_CHOICES.find(
    (choice) => stripAccents(shopKorean(choice.prompt)) === normalized
      || stripAccents(choice.prompt) === normalized
      || localStorage.getItem("taletalk-romanisation-enabled") === "true" && stripAccents(shopRomanisation(choice.prompt)) === normalized,
  );
  if (exact) return exact;

  const inputTokens = normalized.split(/\s+/).filter(Boolean);
  const scoredChoices = SHOP_CHOICES.map((choice) => {
    const choiceTokens = stripAccents(choice.prompt)
      .split(/\s+/)
      .filter(Boolean);
    const overlap = choiceTokens.filter((choiceToken) =>
      inputTokens.some(
        (inputToken) =>
          inputToken === choiceToken ||
          inputToken.includes(choiceToken) ||
          choiceToken.includes(inputToken) ||
          levenshtein(inputToken, choiceToken) <= 2,
      ),
    ).length;
    const productWord = choice.id;
    const productHit = inputTokens.some(
      (token) => token.includes(productWord) || productWord.includes(token),
    );
    const politeHit = inputTokens.some(
      (token) =>
        token.includes("favore") ||
        token.includes("favor") ||
        token.includes("vaore") ||
        token.includes("vavore"),
    );
    const score = overlap + (productHit ? 3 : 0) + (politeHit ? 2 : 0);
    return { choice, score };
  });

  const best = scoredChoices.sort((a, b) => b.score - a.score)[0];
  return best && best.score >= 4 ? best.choice : null;
}

type ShopPhase =
  | "intro"
  | "bella-excited"
  | "counter"
  | "order"
  | "order-speaking"
  | "grazie"
  | "prego"
  | "ending"
  | "phone-call"
  | "wife-angry"
  | "wife-warning"
  | "wife-hangup";

const BELLA_SHOP_IMAGES = [
  "scenes/bella/b1-woman-no-boards-v2.png",
  "scenes/bella/b2-no-boards-v2.png",
  "scenes/bella/b3-no-boards-v2.png",
  "scenes/bella/b4-no-boards-v2.png",
  "scenes/bella/b5-no-boards-v2.png",
  "scenes/bella/b6-no-boards-v2.png",
].map(assetUrl);

function BellaShopAdventure({
  onMenu,
  onComplete,
}: {
  onMenu: () => void;
  onComplete: () => void;
}) {
  // This scene now uses English interface text with Korean learning prompts.
  const isChinese = false;
  const overlay = useDebugOverlay();
  const { debugMode, sceneRef, handleSceneMouseMove } = overlay;
  const [phase, setPhase] = useState<ShopPhase>("intro");
  const [orderInput, setOrderInput] = useState("");
  const [orderWrong, setOrderWrong] = useState(false);
  const [orderTypingWrong, setOrderTypingWrong] = useState(false);
  const [grazieInput, setGrazieInput] = useState("");
  const [grazieWrong, setGrazieWrong] = useState(false);
  const [grazieDone, setGrazieDone] = useState(false);
  const [pregoInput, setPregoInput] = useState("");
  const [pregoWrong, setPregoWrong] = useState(false);
  const [pregoDone, setPregoDone] = useState(false);
  const [shopRomanisationEnabled, setShopRomanisationEnabled] = useState(() => localStorage.getItem("taletalk-romanisation-enabled") === "true");
  const [chosenOrder, setChosenOrder] = useState<
    (typeof SHOP_CHOICES)[number] | null
  >(null);
  const [shopUnlockedWords, setShopUnlockedWords] = useState<ShopWordTooltip[]>(
    () => {
      const slot = Number(localStorage.getItem("taletalk_active_save_slot") ?? "1");
      const saved = new Set<string>(JSON.parse(localStorage.getItem(`taletalk-slot-${slot}-scene-icecream-words`) ?? "[]"));
      return [...GRAZIE_WORDS, ...PREGO_WORDS].filter(word => saved.has(word.word.toLowerCase()));
    },
  );
  const [shopWordLibraryOpen, setShopWordLibraryOpen] = useState(false);
  const [shopPracticeWord, setShopPracticeWord] =
    useState<ShopWordTooltip | null>(null);
  const [shopPracticeInput, setShopPracticeInput] = useState("");
  const [shopPracticeCorrect, setShopPracticeCorrect] = useState(false);
  const {
    speak,
    cancel,
    enabled: speechEnabled,
    toggle: toggleSpeech,
  } = useSpeech();
  useEffect(() => {
    if (shopPracticeWord) speak(shopKorean(shopPracticeWord.word), "female");
  }, [shopPracticeWord, speak]);
  const toggleShopRomanisation = () => {
    const next = !shopRomanisationEnabled;
    setShopRomanisationEnabled(next);
    localStorage.setItem("taletalk-romanisation-enabled", String(next));
    window.dispatchEvent(new CustomEvent("taletalk-romanisation-change", { detail: next }));
  };
  useEffect(() => { const sync = (event: Event) => setShopRomanisationEnabled(Boolean((event as CustomEvent<boolean>).detail)); window.addEventListener("taletalk-romanisation-change", sync); return () => window.removeEventListener("taletalk-romanisation-change", sync); }, []);
  useEffect(() => {
    if (!shopUnlockedWords.length) return;
    const slot = Number(localStorage.getItem("taletalk_active_save_slot") ?? "1");
    const key = `taletalk-slot-${slot}-scene-icecream-words`;
    const saved = new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]"));
    shopUnlockedWords.forEach(word => saved.add(word.word.toLowerCase()));
    localStorage.setItem(key, JSON.stringify([...saved].sort()));
    const mapKey = `taletalk-slot-${slot}-unlocked-words`;
    const mapWords = new Set<string>(JSON.parse(localStorage.getItem(mapKey) ?? "[]"));
    shopUnlockedWords.forEach(word => mapWords.add(word.word.toLowerCase()));
    localStorage.setItem(mapKey, JSON.stringify([...mapWords].sort()));
    recordDailyLearnedWords(shopUnlockedWords.map(word => word.word), slot);
    window.dispatchEvent(new Event("taletalk-words-changed"));
  }, [shopUnlockedWords]);
  useEffect(() => {
    if (phase !== "approach") return;
    // The first image is outside the shop: use a very quiet roadside bed,
    // not the indoor/garden ambience used by other scenes. It is created here
    // so it stops immediately when the player enters the shop.
    let context: AudioContext | null = null;
    let source: AudioBufferSourceNode | null = null;
    let trafficTimer: number | null = null;
    try {
      context = new AudioContext();
      const master = context.createGain();
      master.gain.value = 0.035;
      master.connect(context.destination);
      const noise = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
      const samples = noise.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
      source = context.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      const roadsideFilter = context.createBiquadFilter();
      roadsideFilter.type = "bandpass";
      roadsideFilter.frequency.value = 720;
      roadsideFilter.Q.value = 0.35;
      source.connect(roadsideFilter).connect(master);
      source.start();
      const distantCar = () => {
        if (!context) return;
        const car = context.createOscillator();
        const carGain = context.createGain();
        const start = context.currentTime;
        car.type = "sawtooth";
        car.frequency.setValueAtTime(55, start);
        car.frequency.exponentialRampToValueAtTime(95, start + 2.2);
        carGain.gain.setValueAtTime(0.0001, start);
        carGain.gain.exponentialRampToValueAtTime(0.018, start + 0.8);
        carGain.gain.exponentialRampToValueAtTime(0.0001, start + 2.5);
        car.connect(carGain).connect(master);
        car.start(start);
        car.stop(start + 2.6);
      };
      distantCar();
      trafficTimer = window.setInterval(distantCar, 7000);
      void context.resume().catch(() => undefined);
    } catch { /* Ambient sound is optional if Web Audio is unavailable. */ }
    return () => {
      if (trafficTimer !== null) window.clearInterval(trafficTimer);
      source?.stop();
      void context?.close();
    };
  }, [phase]);
  const recordDailyWords = (words: string[]) => recordDailyLearnedWords(words);
  const playShopDoorBell = () => {
    try {
      const context = new AudioContext();
      const gain = context.createGain();
      gain.connect(context.destination);
      gain.gain.setValueAtTime(0.18, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.1);
      [1046, 1318].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start(context.currentTime + index * 0.13);
        oscillator.stop(context.currentTime + 1.1);
      });
      void context.resume().catch(() => undefined);
    } catch { /* Audio is optional when a browser blocks it. */ }
  };
  const keyBufferRef = useRef("");
  const marketAmbienceRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = marketAmbienceRef.current;
    if (!audio) return;

    audio.volume = 0.12;
    void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  const sceneDialogue = (currentPhase: ShopPhase) => {
    const lines: Partial<Record<ShopPhase, string>> = {
      intro: "At long last he makes it to the ice cream shop. Bella is bursting with excitement.",
      "bella-excited": "맛있어!",
      counter: "He then moves up to the counter to order.",
      ending: "Bella is happy. He made her day.",
      "phone-call": "And just at that moment he gets a call from his wonderful wife.",
      "wife-angry": "!!!!!",
      "wife-warning": "His wife reminds him that he has not helped with the shopping he promised to do. She tells him: either come home with the shopping done, or do not come home at all! She also reminds him that she loves him.",
      "wife-hangup": "And she hangs up.",
    };
    return lines[currentPhase] ?? "";
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.length === 1) {
        keyBufferRef.current = (keyBufferRef.current + e.key).slice(-2);
        if (keyBufferRef.current.endsWith("/2")) {
          keyBufferRef.current = "";
          cancel();
          onComplete();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cancel, onComplete]);

  useEffect(() => {
    if (phase === "wife-angry") return;
    if (phase === "grazie") { speak("감사합니다", "bella"); return; }
    if (phase === "prego") { speak("천만에요", "shopkeeper"); return; }
    if (phase === "order") { speak(shopKorean(SHOP_CHOICES.find(choice => choice.correct)?.prompt ?? ""), "josh"); return; }
    const dialogue = sceneDialogue(phase);
    if (dialogue) speak(dialogue, phase === "bella-excited" ? "bella" : "male");
  }, [phase, isChinese, speak]);

  const images = BELLA_SHOP_IMAGES;
  const image =
    phase === "intro" || phase === "bella-excited"
      ? images[0]
      : phase === "counter" || phase === "order" || phase === "order-speaking"
        ? images[1]
        : phase === "grazie" || phase === "prego"
          ? images[2]
          : phase === "ending"
            ? images[3]
            : phase === "phone-call"
              ? images[3]
              : phase === "wife-angry"
                ? images[4]
                : images[5];
  useEffect(() => {
    preloadSceneWindow(images, Math.max(0, images.indexOf(image)), 12);
  }, [image]);

  const advance = () => {
    if (phase === "intro") setPhase("bella-excited");
    else if (phase === "bella-excited") setPhase("counter");
    else if (phase === "counter") setPhase("order");
    else if (phase === "ending") setPhase("phone-call");
    else if (phase === "phone-call") setPhase("wife-angry");
    else if (phase === "wife-angry") setPhase("wife-warning");
    else if (phase === "wife-warning") setPhase("wife-hangup");
    else if (phase === "wife-hangup") {
      cancel();
      onComplete();
    }
  };

  const canClick =
    phase === "intro" ||
    phase === "bella-excited" ||
    phase === "counter" ||
    phase === "ending" ||
    phase === "phone-call" ||
    phase === "wife-angry" ||
    phase === "wife-warning" ||
    phase === "wife-hangup";

  useEffect(() => {
    const skip = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight") return;
      event.preventDefault();
      if (canClick) advance();
      else if (phase === "order") {
        setChosenOrder(SHOP_CHOICES.find((choice) => choice.correct) ?? null);
        setPhase("grazie");
      } else if (phase === "grazie") setPhase("prego");
      else if (phase === "prego") setPhase("ending");
    };
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [phase, canClick]);

  const getWordMatchState = (choice: (typeof SHOP_CHOICES)[number]) => {
    const typingRomanisation = shopRomanisationEnabled && /[a-z]/i.test(orderInput);
    const targets = choice.wordTooltips.map((word) => typingRomanisation ? shopRomanisation(word.word) : shopKorean(word.word));
    const flatString = choice.wordTooltips
      .map((word, index) => stripAccents((targets[index] || word.word).toLowerCase()))
      .join(" ");
    const typedFlat = stripAccents(
      orderInput.toLowerCase().replace(/\s+/g, " ").trim(),
    );
    let totalMatched = 0;
    for (let i = 0; i < typedFlat.length && i < flatString.length; i++) {
      if (typedFlat[i] === flatString[i]) totalMatched++;
      else break;
    }
    let charOffset = 0;
    const wordStates = choice.wordTooltips.map((w, index) => {
      const word = stripAccents((targets[index] || shopKorean(w.word)).toLowerCase());
      const wordStart = charOffset;
      const wordEnd = charOffset + word.length;
      const matchedInWord = Math.max(
        0,
        Math.min(word.length, totalMatched - wordStart),
      );
      const isComplete = totalMatched >= wordEnd;
      charOffset = wordEnd + 1;
      return {
        matchedLetters: matchedInWord,
        totalLetters: word.length,
        isComplete,
        typedPart: typedFlat.slice(wordStart, Math.min(wordEnd, typedFlat.length)),
      };
    });
    const isFullMatch = wordStates.every((ws) => ws.isComplete);
    return { wordStates, isFullMatch };
  };

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const shortcutMatch = isSkipAnswer(orderInput)
      ? (SHOP_CHOICES.find((c) => c.correct) ?? null)
      : null;
    const match = shortcutMatch ?? matchShopChoiceInput(orderInput) ?? null;
    if (match) {
      if (match.correct) {
        setOrderWrong(false);
        setOrderTypingWrong(false);
        setChosenOrder(match);
        setShopUnlockedWords(previous => {
          const existing = new Set(previous.map(word => word.word));
          return [...previous, ...[...match.wordTooltips, { word: "please", translation: "Please give me" }].filter(word => !existing.has(word.word))];
        });
        setPhase("order-speaking");
        speak(shopKorean(match.prompt), "josh", () =>
          setTimeout(() => setPhase("grazie"), 3500),
        );
      } else {
        setOrderWrong(true);
        speak(match.responseIt, "shopkeeper");
      }
      setOrderInput("");
    } else {
      setOrderTypingWrong(true);
      setTimeout(() => setOrderTypingWrong(false), 1500);
    }
  };

  const getSimpleMatchState = (input: string, words: ShopWordTooltip[]) => {
    const typingRomanisation = shopRomanisationEnabled && /[a-z]/i.test(input);
    const flatString = words
      .map((w) => stripAccents((typingRomanisation ? shopRomanisation(w.word) : shopKorean(w.word)).toLowerCase()))
      .join(" ");
    const typedFlat = stripAccents(
      input.toLowerCase().replace(/\s+/g, " ").trim(),
    );
    let totalMatched = 0;
    for (let i = 0; i < typedFlat.length && i < flatString.length; i++) {
      if (typedFlat[i] === flatString[i]) totalMatched++;
      else break;
    }
    let charOffset = 0;
    const wordStates = words.map((w) => {
      const word = stripAccents((typingRomanisation ? shopRomanisation(w.word) : shopKorean(w.word)).toLowerCase());
      const wordStart = charOffset;
      const wordEnd = charOffset + word.length;
      const matchedInWord = Math.max(
        0,
        Math.min(word.length, totalMatched - wordStart),
      );
      const isComplete = totalMatched >= wordEnd;
      charOffset = wordEnd + 1;
      return {
        matchedLetters: matchedInWord,
        totalLetters: word.length,
        isComplete,
      };
    });
    return wordStates;
  };

  const handleGrazieSubmit = () => {
    const answer = stripAccents(grazieInput.toLowerCase().trim());
    if (
      isSkipAnswer(grazieInput) ||
      answer === shopKorean("Thank you") ||
      answer === shopRomanisation("Thank you")
    ) {
      setGrazieDone(true);
      setShopUnlockedWords((prev) => {
        const existing = new Set(prev.map((w) => w.word));
        return [...prev, ...GRAZIE_WORDS.filter((w) => !existing.has(w.word))];
      });
      speak(shopKorean("Thank you"), "bella");
      setGrazieInput("");
      setTimeout(() => {
        setGrazieDone(false);
        setPhase("prego");
      }, 2000);
    } else {
      setGrazieWrong(true);
      setTimeout(() => setGrazieWrong(false), 1500);
    }
  };

  const handlePregoSubmit = () => {
    const answer = stripAccents(pregoInput.toLowerCase().trim());
    if (
      isSkipAnswer(pregoInput) ||
      answer === shopKorean("You are welcome") ||
      answer === shopRomanisation("You are welcome")
    ) {
      setPregoDone(true);
      setShopUnlockedWords((prev) => {
        const existing = new Set(prev.map((w) => w.word));
        return [...prev, ...PREGO_WORDS.filter((w) => !existing.has(w.word))];
      });
      speak(shopKorean("You are welcome"), "shopkeeper");
      setPregoInput("");
      setTimeout(() => {
        setPregoDone(false);
        setPhase("ending");
      }, 2000);
    } else {
      setPregoWrong(true);
      setTimeout(() => setPregoWrong(false), 1500);
    }
  };

  const isGirl = phase === "bella-excited" || phase === "wife-angry";
  const dialogueText = sceneDialogue(phase);
  const speakerName = phase === "bella-excited" ? "Bella" : phase === "wife-angry" ? "Wife" : "Narrator";
  const showDialogue = canClick;

  return (
    <div
      className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center"
      onClick={() => {
        if (canClick) advance();
      }}
    >
      <div
        ref={sceneRef}
        className="relative h-screen w-screen max-w-screen"
        onMouseMove={handleSceneMouseMove}
      >
        <audio
          ref={marketAmbienceRef}
          src={assetUrl("audio/ice-cream-shop-market-ambience.mp3")}
          loop
          preload="auto"
        />
        <SceneBackground source={image} alt="Bella's ice cream memory" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 pointer-events-none" />
        <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 pt-4">
          <div>
            <h1
              className="text-white text-lg font-bold"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              English Adventure
            </h1>
            <span className="text-white/70 text-[10px] uppercase tracking-[0.2em]">
              The Ice Cream Shop
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSpeech}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-black/60 border border-white/20 hover:border-white/50 text-white/80 hover:text-white transition-all"
              title={speechEnabled ? "Mute voices" : "Unmute voices"}
            >
              {speechEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button
              onClick={() => {
                cancel();
                onMenu();
              }}
              className="px-4 py-2 rounded-full text-[11px] bg-black/60 border border-white/20 text-white/80 uppercase tracking-wider"
            >
              Menu
            </button>
          </div>
        </header>

        {false && shopUnlockedWords.length > 0 && (
          <div
            className="absolute left-4 top-28 z-30"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShopWordLibraryOpen((open) => !open)}
              className="rounded-xl border border-[#c4942a]/50 bg-black/75 px-3 py-2 text-left text-white shadow-xl backdrop-blur-sm transition hover:bg-black/90"
            >
              <span className="mt-1 block text-[9px] uppercase tracking-wider text-white/60">
                Words
              </span>
            </button>
            {shopWordLibraryOpen && (
              <div className="mt-2 w-52 rounded-xl border border-white/15 bg-black/90 p-3 shadow-2xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#c4942a]">
                    Vocabulary
                  </span>
                  <button
                    className="text-white/50 hover:text-white"
                    onClick={() => setShopWordLibraryOpen(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-1.5">
                  {[...shopUnlockedWords]
                    .sort((a, b) => a.word.localeCompare(b.word))
                    .map((word) => (
                      <button
                        key={word.word}
                        onClick={() => {
                          setShopPracticeWord(word);
                          setShopPracticeInput("");
                          setShopPracticeCorrect(false);
                        }}
                        className="flex w-full items-center justify-between rounded-lg bg-white/5 px-2.5 py-2 text-left transition hover:bg-white/10"
                      >
                        <span className="text-sm text-white">{shopKorean(word.word)}</span>
                        <span className="text-[10px] text-white/45">
                          {capitaliseStandalone(shopEnglish(word.word, word.translation))}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {shopPracticeWord && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-5"
            onClick={() => setShopPracticeWord(null)}
          >
            <div
              data-task-editor-panel="cafe-word-practice"
              className="shop-task-box shared-task-bar-ui relative w-full max-w-[30rem] px-4 pb-3 pt-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[#c4942a]">
                Practice word
              </div>
              <h2
                className="text-2xl text-white"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                <LiveAnswerLetters target={capitaliseStandalone(shopKorean(shopPracticeWord.word))} value={shopPracticeInput} neutralClassName="text-white" />
              </h2>
              {shopRomanisationEnabled && <p className="mb-1 text-sm text-sky-200"><LiveAnswerLetters target={capitaliseStandalone(shopRomanisation(shopPracticeWord.word))} value={/[a-z]/i.test(shopPracticeInput) ? shopPracticeInput : ""} neutralClassName="text-sky-200" /></p>}
              <p className="mb-4 text-sm text-white/55">
                {capitaliseStandalone(shopEnglish(shopPracticeWord.word, shopPracticeWord.translation))}
              </p>
              {shopPracticeCorrect ? (
                <p className="mb-4 text-sm text-green-400">
                  Correct. The word is yours.
                </p>
              ) : (<>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const correct =
                      stripAccents(shopPracticeInput.trim().toLowerCase()) ===
                        stripAccents(shopKorean(shopPracticeWord.word).toLowerCase());
                    setShopPracticeCorrect(correct);
                    if (correct) speak(shopKorean(shopPracticeWord.word), "female");
                  }}
                  className="flex gap-2"
                >
                  <input
                    autoFocus
                    value={shopPracticeInput}
                    onChange={(e) => setShopPracticeInput(e.target.value)}
                    placeholder="Type the Korean word or Romanisation"
                    className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/60"
                  />
                  <button className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs uppercase tracking-wider text-white">
                    Check
                  </button>
                </form>
              </>)}
              <button
                onClick={() => setShopPracticeWord(null)}
                className="mt-4 text-xs text-white/50 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {debugMode && (
          <DebugOverlayPanel overlay={overlay} mediaLabel="bella-shop-scene" />
        )}

        {showDialogue && (
          <div
            className="story-dialogue-panel absolute z-10 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); advance(); }}
          >
            <div className="story-dialogue-content">
              <div className="scene-eyebrow">
                <div
                  className="cop-narrator-dot"
                  style={{ background: isGirl ? "#e8a59c" : "#ccc" }}
                />
                <span
                  className={`text-[11px] uppercase tracking-[0.2em] font-semibold ${isGirl ? "text-[#e8a59c]" : "text-white/60"}`}
                >
                  {speakerName}
                </span>
              </div>
              <p
                className="story-dialogue-text"
              >
                {dialogueText}
              </p>
              {phase === "bella-excited" && <p className="mt-1 text-sm text-white/60">Yum!</p>}
              <div className="cop-narration-footer">
                <span>{phase === "wife-hangup" ? "click anywhere to return to the map" : "click anywhere to continue"}</span>
                <button onClick={(event) => { event.stopPropagation(); speak(dialogueText, isGirl ? "bella" : "male"); }}><Volume2 size={12} /> Listen</button>
              </div>
            </div>
          </div>
        )}

        {phase === "order" && (
          <div
            className="shop-task-frame absolute bottom-[2.5%] left-1/2 z-10 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              data-task-editor-panel="cafe-order"
              className="shop-task-box shared-task-bar-ui relative px-4 pb-3 pt-3"
            >
              <button data-task-editor-item="close" onClick={() => { cancel(); setPhase("counter"); }} aria-label="Close task" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/10 text-lg text-white/75 hover:bg-white/20">×</button>
              <div data-task-editor-item="instruction" className="flex w-fit items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-[#c4942a] flex-shrink-0" />
                <span
                  className={`text-[#c4942a] uppercase tracking-[0.12em] font-semibold ${isChinese ? "text-xs" : "text-[9px]"}`}
                >
                  Shopkeeper: Hello! Type what you would like:
                </span>
              </div>
              <div className="flex flex-col gap-1 mb-2">
                {SHOP_CHOICES.map((c) => {
                  const { wordStates, isFullMatch } = getWordMatchState(c);
                  return (
                    <div
                      key={c.id}
                      data-task-editor-item={`choice-${c.id}`}
                      className={`px-3 py-1 rounded-lg bg-white/5 border transition-all ${isFullMatch ? "border-green-400/60 bg-green-400/10" : "border-white/15"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${isFullMatch ? "bg-green-400/30 text-green-300" : "bg-white/10 text-white/60"}`}
                        >
                          {SHOP_CHOICES.indexOf(c) + 1}
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-sm text-white/90">
                            {c.wordTooltips.map((wt, wi) => {
                              const ws = wordStates[wi];
                              const letters = shopKorean(wt.word).split("");
                              return (
                                <span key={wi}>
                                  <span className="underline decoration-dotted decoration-white/30 underline-offset-2">
                                    {letters.map((letter, li) => (
                                      <span
                                        key={li}
                                        className={`transition-colors ${!/[a-z]/i.test(orderInput) && ws && li < ws.matchedLetters ? "text-green-400" : "text-white/90"}`}
                                      >
                                        {letter}
                                      </span>
                                    ))}
                                  </span>
                                  {wi < c.wordTooltips.length - 1
                                    ? "\u00A0"
                                    : ""}
                                </span>
                              );
                            })}
                          </span>
                          {shopRomanisationEnabled && (
                            <span className="text-[11px] text-sky-200">
                              {c.wordTooltips.map((wt) => capitaliseStandalone(shopRomanisation(wt.word))).join(" ")}
                            </span>
                          )}
                          <span className="text-xs text-white/55">
                            {c.wordTooltips.map((wt, ewi) => (
                              <span
                                key={ewi}
                                className="text-white/55"
                              >
                                {capitaliseStandalone(shopEnglish(wt.word, wt.translation))}
                                {ewi < c.wordTooltips.length - 1
                                  ? "\u00A0"
                                  : ""}
                              </span>
                            ))}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form
                data-task-editor-item="answer-form"
                onSubmit={handleOrderSubmit}
                className="flex w-full items-center gap-2"
              >
                <input
                  value={orderInput}
                  onChange={(e) => setOrderInput(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="type your order..."
                  className="flex-1 min-w-0 bg-white/5 text-white text-xs outline-none placeholder-white/30 caret-white border-b border-white/20 focus:border-white/60 py-1.5 rounded-lg px-2"
                />
                <button className="rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-xs px-4 py-2 transition-all uppercase tracking-wider flex-shrink-0">
                  Order
                </button>
              </form>
              {orderTypingWrong && (
                <div data-task-editor-item="error-message" className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
                  <AlertTriangle size={11} /> Not a valid choice — type one of
                  the options above
                </div>
              )}
              {orderWrong && (
                <p data-task-editor-item="sale-error" className="text-yellow-300 text-xs mt-2">
                  The shopkeeper says: "That's not what we sell here." Try the
                  ice cream option.
                </p>
              )}
            </div>
          </div>
        )}

        {phase === "order-speaking" && chosenOrder && (
          <div
            className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-2xl border border-blue-400/30 px-4 pb-3 pt-3"
              style={{ background: "rgba(0,0,0,0.92)" }}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0 animate-pulse" />
                <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-blue-300">
                  Josh is ordering...
                </span>
              </div>
              <p
                className="text-white text-xl leading-snug"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {shopKorean(chosenOrder.prompt)}
              </p>
              {shopRomanisationEnabled && <p className="mt-1 text-xs text-sky-200">{capitaliseStandalone(shopRomanisation(chosenOrder.prompt))}</p>}
              <p className="mt-1 text-xs text-white/55">{chosenOrder.englishLabel}</p>
            </div>
          </div>
        )}

        {phase === "grazie" && (
          <div
            className="shop-task-frame absolute bottom-[2.5%] left-1/2 z-10 w-[min(36rem,calc(100%-2rem))] -translate-x-1/2"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              data-task-editor-panel="cafe-thank-you"
              className="shop-task-box shared-task-bar-ui relative px-4 pb-3 pt-3"
            >
              <button data-task-editor-item="close" onClick={() => { cancel(); setPhase("counter"); }} aria-label="Close task" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/10 text-lg text-white/75 hover:bg-white/20">×</button>
              {grazieDone ? (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                    <Sparkles size={20} />
                    <span className="text-lg font-bold">
                      You unlocked the word!
                    </span>
                    <Sparkles size={20} />
                  </div>
                  <p className="text-white/60 text-sm">
                    <span className="text-green-400 font-medium">감사합니다</span>
                    {shopRomanisationEnabled && <span className="ml-2 text-sky-200">Gamsahamnida</span>}
                    <span className="ml-2">Thank you</span>
                  </p>
                </div>
              ) : (
                <>
                  <div data-task-editor-item="instruction" className="flex w-fit items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#e8a59c] flex-shrink-0" />
                    <span className="text-[#e8a59c] text-[9px] uppercase tracking-[0.12em] font-semibold">
                      Bella says — type what she says
                    </span>
                  </div>
                  <div data-task-editor-item="word-cue" className="my-2 w-fit">
                    <div className="flex items-center gap-2 flex-wrap text-2xl font-semibold tracking-[0.12em]">
                      <span className="text-white/50 text-[10px]">
                        Bella:
                      </span>
                      {(() => {
                        const ws = getSimpleMatchState(
                          grazieInput,
                          GRAZIE_WORDS,
                        );
                        return GRAZIE_WORDS.map((wt, wi) =>
                          shopKorean(wt.word).split("").map((letter, li) => (
                            <span
                              key={li}
                              className={`transition-colors ${ws[wi] && li < ws[wi].matchedLetters ? "text-green-400" : "text-white/90"} underline decoration-dotted decoration-white/30 underline-offset-2`}
                            >
                              {letter}
                            </span>
                          )),
                        );
                      })()}
                    </div>
                    {shopRomanisationEnabled && <p className="mt-1 text-xs text-sky-200">Gamsahamnida</p>}
                    <p data-task-editor-item="english-cue" className="mt-1 text-sm text-white/60">Thank you</p>
                  </div>
                  <div data-task-editor-item="answer-form" className="flex w-full items-center gap-2">
                    <input
                      value={grazieInput}
                      onChange={(e) => setGrazieInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleGrazieSubmit();
                      }}
                      className="flex-1 bg-white/5 text-white text-xs outline-none placeholder-white/30 caret-white min-w-0 border-b border-white/20 focus:border-white/60 py-1.5 rounded-lg px-2"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Type what Bella says..."
                      autoFocus
                    />
                    <button
                      onClick={handleGrazieSubmit}
                      className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-xs px-4 py-2 rounded-lg transition-all uppercase tracking-wider flex-shrink-0"
                    >
                      Enter
                    </button>
                  </div>
                  {grazieWrong && (
                    <div data-task-editor-item="error-message" className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
                      <AlertTriangle size={11} /> Not quite — listen to Bella
                      and try again
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {phase === "prego" && (
          <div
            className="shop-task-frame absolute bottom-[2.5%] left-1/2 z-10 w-[min(36rem,calc(100%-2rem))] -translate-x-1/2"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              data-task-editor-panel="cafe-you-are-welcome"
              className="shop-task-box shared-task-bar-ui relative px-4 pb-3 pt-3"
            >
              <button data-task-editor-item="close" onClick={() => { cancel(); setPhase("counter"); }} aria-label="Close task" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/10 text-lg text-white/75 hover:bg-white/20">×</button>
              {pregoDone ? (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                    <Sparkles size={20} />
                    <span className="text-lg font-bold">
                      You unlocked the word!
                    </span>
                    <Sparkles size={20} />
                  </div>
                  <p className="text-white/60 text-sm">
                    <span className="text-green-400 font-medium">천만에요</span>
                    {shopRomanisationEnabled && <span className="ml-2 text-sky-200">Cheonmaneyo</span>}
                    <span className="ml-2">You are welcome</span>
                  </p>
                </div>
              ) : (
                <>
                  <div data-task-editor-item="instruction" className="flex w-fit items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#c4942a] flex-shrink-0" />
                    <span
                      className={`text-[#c4942a] uppercase tracking-[0.12em] font-semibold ${isChinese ? "text-xs" : "text-[9px]"}`}
                    >
                      Shopkeeper says — type what they say
                    </span>
                  </div>
                  <div data-task-editor-item="word-cue" className="my-2 w-fit">
                    <div className="flex items-center gap-2 flex-wrap text-2xl font-semibold tracking-[0.12em]">
                      <span
                        className={`text-white/50 ${isChinese ? "text-xs" : "text-[10px]"}`}
                      >
                        Shopkeeper:
                      </span>
                      {(() => {
                        const ws = getSimpleMatchState(pregoInput, PREGO_WORDS);
                        return PREGO_WORDS.map((wt, wi) =>
                          shopKorean(wt.word).split("").map((letter, li) => (
                            <span
                              key={li}
                              className={`transition-colors ${ws[wi] && li < ws[wi].matchedLetters ? "text-green-400" : "text-white/90"} underline decoration-dotted decoration-white/30 underline-offset-2`}
                            >
                              {letter}
                            </span>
                          )),
                        );
                      })()}
                    </div>
                    {shopRomanisationEnabled && <p className="mt-1 text-xs text-sky-200">Cheonmaneyo</p>}
                    <p data-task-editor-item="english-cue" className="mt-1 text-sm text-white/60">You are welcome</p>
                  </div>
                  <div data-task-editor-item="answer-form" className="flex w-full items-center gap-2">
                    <input
                      value={pregoInput}
                      onChange={(e) => setPregoInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handlePregoSubmit();
                      }}
                      className="flex-1 bg-white/5 text-white text-xs outline-none placeholder-white/30 caret-white min-w-0 border-b border-white/20 focus:border-white/60 py-1.5 rounded-lg px-2"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Type what the shopkeeper says..."
                      autoFocus
                    />
                    <button
                      onClick={handlePregoSubmit}
                      className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-xs px-4 py-2 rounded-lg transition-all uppercase tracking-wider flex-shrink-0"
                    >
                      Enter
                    </button>
                  </div>
                  {pregoWrong && (
                    <div data-task-editor-item="error-message" className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
                      <AlertTriangle size={11} /> Not quite — listen and try
                      again
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface RoamWordBox {
  id: string;
  italian: string;
  english: string;
  fact: string;
  points: { x: number; y: number }[];
  moveAt?: number;
  movedPoints?: { x: number; y: number }[];
  showFrom: number;
  showUntil: number;
}

const roamWordBoxes: RoamWordBox[] = [
  {
    id: "bridge",
    italian: "Bridge",
    english: "桥",
    fact: "这里原来的铁桥建于约 1870 年，是帕克桥设计早期的重要范例。1980 年重建时，桥梁两侧保留了具有历史价值的铁桁架，因此它至今仍保有这种独特的老式外观。",
    points: [
      { x: 65.7, y: 56.1 },
      { x: 73.6, y: 55.3 },
      { x: 65.4, y: 60.8 },
      { x: 73.3, y: 60.8 },
    ],
    showFrom: 1,
    showUntil: 10,
  },
  {
    id: "trees",
    italian: "Trees",
    english: "树木",
    fact: "伍德斯托克以枫树闻名。秋天尤为壮观，因为糖枫会变成明亮的黄色、橙色和深红色。",
    points: [
      { x: 28, y: 43.3 },
      { x: 35.4, y: 42.2 },
      { x: 28.1, y: 47.6 },
      { x: 35, y: 47.9 },
    ],
    showFrom: 14,
    showUntil: 24,
  },
  {
    id: "river",
    italian: "River",
    english: "河流",
    fact: "流经伍德斯托克的河流是奥塔奎奇河（Ottauquechee River）。有趣的是，它的名字来自一个原住民词语，常被解释为“湍急的山间溪流”。",
    points: [{ x: 25.5, y: 72.4 }, { x: 31.2, y: 76.6 }],
    showFrom: 25,
    showUntil: 30,
  },
  { id: "sky", italian: "Sky", english: "天空", fact: "在佛蒙特州伍德斯托克，山区天气会带来飘动的云、突如其来的雨和湛蓝晴空，因此天空常常快速变化。", points: [{ x: 27.8, y: 4.6 }, { x: 34.9, y: 11.1 }], showFrom: 33, showUntil: 40 },
  { id: "leaves", italian: "Leaves", english: "树叶", fact: "在伍德斯托克，秋风会把红色、橙色和金色的树叶卷过街道和森林。", points: [{ x: 55.1, y: 65.1 }, { x: 58.3, y: 69.1 }], showFrom: 42, showUntil: 46 },
  { id: "rocks", italian: "Rocks", english: "岩石", fact: "古老的岩石和石墙随处可见，它们由冰川和一代又一代新英格兰农民塑造而成。", points: [{ x: 21.7, y: 75.9 }, { x: 27.4, y: 82.3 }], showFrom: 50, showUntil: 58 },
  { id: "current", italian: "Current", english: "水流", fact: "清澈的小溪从周围山丘流下，尤其是在下雨或积雪融化之后。", points: [{ x: 70.1, y: 80.4 }, { x: 78.2, y: 85.7 }], showFrom: 61, showUntil: 70 },
  { id: "cars", italian: "Cars", english: "汽车", fact: "秋天，前来欣赏佛蒙特著名秋色的游客让汽车常常停满伍德斯托克周边的道路。", points: [{ x: 62.9, y: 54.7 }, { x: 67, y: 59.8 }], moveAt: 79, movedPoints: [{ x: 52.9, y: 58.5 }, { x: 56.2, y: 62.8 }], showFrom: 76, showUntil: 85 },
  { id: "crosswalk", italian: "Crosswalk", english: "人行横道", fact: "这条人行横道靠近伍德斯托克较早的村庄路线；几代人一直沿着这里在住宅、商店和河流之间往来。", points: [{ x: 66.2, y: 68.6 }, { x: 71.6, y: 72.8 }], showFrom: 88, showUntil: 98 },
  { id: "road", italian: "Road", english: "道路", fact: "桥旁的道路沿着一条穿过村庄的路线；这个村庄主要在18和19世纪发展起来。", points: [{ x: 43.5, y: 68.3 }, { x: 47.9, y: 72.3 }], moveAt: 104, movedPoints: [{ x: 22.7, y: 69 }, { x: 27.8, y: 74 }], showFrom: 100, showUntil: 110 },
  { id: "forest", italian: "Forest", english: "森林", fact: "伍德斯托克周围的森林数百年来塑造了这座小镇，为早期定居者提供木材、柴火和土地。", points: [{ x: 76.5, y: 41 }, { x: 80.8, y: 45.9 }], showFrom: 110, showUntil: 120 },
];
const WOODSTOCK_WORD_TARGET = new Set(roamWordBoxes.map((word) => word.id)).size;
const ROAM_KOREAN: Record<string, string> = {
  bridge: "다리", trees: "나무", river: "강", sky: "하늘", leaves: "나뭇잎",
  rocks: "바위", current: "물살", cars: "자동차", crosswalk: "횡단보도", road: "도로", forest: "숲",
};
const ROAM_ROMANISATION: Record<string, string> = {
  bridge: "Da-ri", trees: "Na-mu", river: "Gang", sky: "Ha-neul", leaves: "Na-mun-nip",
  rocks: "Ba-wi", current: "Mul-ssal", cars: "Ja-dong-cha", crosswalk: "Hoeng-dan-bo-do", road: "Do-ro", forest: "Sup",
};
const ROAM_ENGLISH_FACTS: Record<string, string> = {
  bridge: "This iron bridge was first built around 1870. When it was rebuilt in 1980, its historic truss design was preserved.",
  trees: "Woodstock is known for its maple trees. In autumn, sugar maples turn bright yellow, orange, and deep red.",
  river: "The Ottauquechee River runs through Woodstock. Its name comes from an Indigenous word often interpreted as a fast mountain stream.",
  sky: "Woodstock's mountain weather brings moving clouds, sudden rain, and clear blue skies, so the sky can change quickly.",
  leaves: "In autumn, red, orange, and gold leaves sweep through Woodstock's streets and forests.",
  rocks: "Old rocks and stone walls are found throughout the area, shaped by glaciers and generations of New England farmers.",
  current: "Clear streams run down from the surrounding hills, especially after rain or melting snow.",
  cars: "During autumn, visitors coming to see Vermont's famous foliage often fill the roads around Woodstock with cars.",
  crosswalk: "This crosswalk sits near one of Woodstock's older village routes, used for generations between homes, shops, and the river.",
  road: "The road beside the bridge follows a route through the village that developed mainly during the eighteenth and nineteenth centuries.",
  forest: "The forests around Woodstock have shaped the town for centuries, providing timber, fuel, and land for early settlers.",
};
const HEARST_ROAM_WORDS: RoamWordBox[] = [
  { id: "hearst-stairs", italian: "Stairs", english: "계단", fact: "The grand stone stairways guide visitors toward Casa Grande, the main building, while giving sweeping views over the gardens and surrounding hills, making the entrance feel almost like arriving at a European palace.", points: [{ x: 32.8, y: 74.1 }, { x: 36.9, y: 77.5 }], showFrom: 2, showUntil: 9 },
  { id: "hearst-garden", italian: "Garden", english: "정원", fact: "The citrus trees near the entrance help give Hearst Castle its Mediterranean feel, matching the Spanish and southern European influences of the estate. The gardens were carefully planned by architect Julia Morgan and landscape designers, with plants chosen to complement the buildings. Hearst wanted the grounds to feel abundant and colourful rather than overly formal, which is why greenery like these trees surrounds the approach to the castle.", points: [{ x: 52.1, y: 55.3 }, { x: 58.6, y: 62.1 }], showFrom: 9, showUntil: 19 },
  { id: "hearst-statue", italian: "Statue", english: "조각상", fact: "Hearst filled the estate with sculptures and antiques inspired by ancient Greece, Rome, and Renaissance Europe, so statues like this were meant to make the terraces feel like part of a grand Mediterranean palace.", points: [{ x: 48.7, y: 46.2 }, { x: 53.1, y: 51.4 }], showFrom: 20, showUntil: 30 },
  { id: "hearst-ocean", italian: "Ocean", english: "바다", fact: "The Pacific Ocean is visible from many terraces and gardens because the estate sits high on a hill above San Simeon. William Randolph Hearst chose the location partly for these huge coastal views, and on clear days the ocean makes the castle feel even more dramatic and isolated, almost like a palace overlooking the sea.", points: [{ x: 24.4, y: 56.4 }, { x: 28.4, y: 59.5 }], showFrom: 36, showUntil: 43 },
  { id: "hearst-shadows", italian: "Shadows", english: "그림자", fact: "The strong California sunlight creates sharp shadows from the palm trees, statues, columns, and terraces. These shadows make the shapes and details of the architecture stand out more, especially on bright, clear days.", points: [{ x: 50.3, y: 76.7 }, { x: 54.6, y: 80.9 }], showFrom: 46, showUntil: 54 },
];
const HEARST_ROAM_KOREAN: Record<string, string> = Object.fromEntries(HEARST_ROAM_WORDS.map((word) => [word.id, word.english]));
const HEARST_ROAM_ROMANISATION: Record<string, string> = {
  "hearst-stairs": "Gye-dan",
  "hearst-garden": "Jeong-won",
  "hearst-statue": "Jo-gak-sang",
  "hearst-ocean": "Ba-da",
  "hearst-shadows": "Geu-rim-ja",
};
const HEARST_ROAM_FACTS: Record<string, string> = Object.fromEntries(HEARST_ROAM_WORDS.map((word) => [word.id, word.fact]));
const HEARST_WORD_TARGET = new Set(HEARST_ROAM_WORDS.map((word) => word.id)).size;
const ROAM_WORD_TARGET = WOODSTOCK_WORD_TARGET + HEARST_WORD_TARGET;
const ROAM_REGIONS = {
  canada: { label: "Canada", labelZh: "加拿大", title: "Canada Roam Map", titleZh: "加拿大漫游地图", map: "maps/roam-canada-map-v2.png" },
  usa: { label: "USA", labelZh: "美国", title: "USA Roam Map", titleZh: "美国漫游地图", map: "maps/north-america-roam-map-v2.png" },
  britain: { label: "England & Ireland", labelZh: "英格兰和爱尔兰", title: "England & Ireland Roam Map", titleZh: "英格兰和爱尔兰漫游地图", map: "maps/roam-england-ireland-map-v2.png" },
  oceania: { label: "Australia & New Zealand", labelZh: "澳大利亚和新西兰", title: "Australia & New Zealand Roam Map", titleZh: "澳大利亚和新西兰漫游地图", map: "maps/roam-australia-new-zealand-map-v2.png" },
} as const;
type RoamRegion = keyof typeof ROAM_REGIONS;
const ROAM_REGION_WALLPAPERS = [
  assetUrl("roam/roam-region-picker-wallpaper-v1.png"),
  ...Array.from({ length: 9 }, (_, index) => assetUrl(`roam/roam-region-wallpaper-${index + 1}-v1.png`)),
];

function bboxFromPoints(points: { x: number; y: number }[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    width: Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10,
    height: Math.round((Math.max(...ys) - Math.min(...ys)) * 10) / 10,
  };
}

function RoamSection({ onMenu }: { onMenu: () => void }) {
  const overlay = useDebugOverlay();
  const { debugMode, sceneRef, handleSceneMouseMove } = overlay;
  const { speak } = useSpeech();
  // Roam is intentionally English-only, independent of the app-wide language setting.
  const isChinese = false;
  const roamKey = `taletalk-slot-${Number(localStorage.getItem("taletalk_active_save_slot") ?? "1")}-roam-collected-words-v2`;
  const videoRef = useRef<HTMLVideoElement>(null);
  const roamAudioRef = useRef<HTMLAudioElement>(null);
  const mapAudioRef = useRef<HTMLAudioElement>(null);
  const [showControls, setShowControls] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoMuted, setVideoMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [toolsEnabled, setToolsEnabled] = useState(true);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [activeWord, setActiveWord] = useState<RoamWordBox | null>(null);
  const [activeWordInput, setActiveWordInput] = useState("");
  const [roamRomanisationEnabled, setRoamRomanisationEnabled] = useState(() => localStorage.getItem("taletalk-romanisation-enabled") === "true");
  useEffect(() => { const sync = (event: Event) => setRoamRomanisationEnabled(Boolean((event as CustomEvent<boolean>).detail)); window.addEventListener("taletalk-romanisation-change", sync); return () => window.removeEventListener("taletalk-romanisation-change", sync); }, []);
  const [videoIndex, setVideoIndex] = useState(0);
  const [roamDestination, setRoamDestination] = useState<RoamDestination>("woodstock");
  const [primedRoamDestination, setPrimedRoamDestination] = useState<RoamDestination>("woodstock");
  const [locationSelected, setLocationSelected] = useState(false);
  const [hearstIntroductionOpen, setHearstIntroductionOpen] = useState(false);
  const [mapMuted, setMapMuted] = useState(false);
  const [roamRegion, setRoamRegion] = useState<RoamRegion | null>(null);
  const [regionWallpaperIndex] = useState(() => Number(localStorage.getItem("taletalk-roam-region-wallpaper-index") ?? "0") % ROAM_REGION_WALLPAPERS.length);
  const [roamLoading, setRoamLoading] = useState(false);
  // Dismissed words stay hidden only until the player leaves Roam.
  const [dismissedWordIds, setDismissedWordIds] = useState<string[]>([]);
  // Do not carry saved words from the previous roam into this refreshed video.
  const [savedWords, setSavedWords] = useState<RoamWordBox[]>(
    () => JSON.parse(localStorage.getItem(roamKey) ?? "[]") as RoamWordBox[],
  );
  const [savedWordsOpen, setSavedWordsOpen] = useState(false);
  const [roamSettingsOpen, setRoamSettingsOpen] = useState(false);
  const [roamMapSettingsOpen, setRoamMapSettingsOpen] = useState(false);
  const [roamProgressOpen, setRoamProgressOpen] = useState(false);
  const [roamProgressSection, setRoamProgressSection] = useState<"words" | "locations" | null>(null);
  const [hearstUnlockNotice, setHearstUnlockNotice] = useState(false);
  const [unlockedWordNotice, setUnlockedWordNotice] = useState<{ korean: string; english: string } | null>(null);
  const uniqueSavedWords = [...new Map(savedWords.map((word) => [word.id, word])).values()];
  const woodstockWordCount = uniqueSavedWords.filter((word) => !word.id.startsWith("hearst-")).length;
  const hearstWordCount = uniqueSavedWords.filter((word) => word.id.startsWith("hearst-")).length;
  const hearstUnlocked = woodstockWordCount >= 5;
  const unlockedLocationCount = 1 + Number(hearstUnlocked);
  const currentDestinationWordCount = roamDestination === "california" ? hearstWordCount : woodstockWordCount;
  const currentDestinationWordTarget = roamDestination === "california" ? HEARST_WORD_TARGET : WOODSTOCK_WORD_TARGET;
  const hearstUnlockKey = `${roamKey}-hearst-unlocked`;

  useEffect(() => {
    localStorage.setItem(roamKey, JSON.stringify(savedWords));
    window.dispatchEvent(new Event("taletalk-progress-changed"));
  }, [roamKey, savedWords]);

  useEffect(() => {
    if (!roamLoading) return;
    const fallback = window.setTimeout(() => setRoamLoading(false), 350);
    return () => window.clearTimeout(fallback);
  }, [roamLoading, roamDestination]);

  useEffect(() => {
    if (!hearstUnlocked || localStorage.getItem(hearstUnlockKey) === "true") return;
    localStorage.setItem(hearstUnlockKey, "true");
    setHearstUnlockNotice(true);
  }, [hearstUnlocked, hearstUnlockKey]);

  useEffect(() => {
    if (!unlockedWordNotice) return;
    const timeout = window.setTimeout(() => setUnlockedWordNotice(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [unlockedWordNotice]);

  useEffect(
    () => () => {
      roamAudioRef.current?.pause();
      roamAudioRef.current = null;
    },
    [],
  );

  useEffect(() => {
    return scheduleIdleImagePreload([
      ROAM_REGION_WALLPAPERS[(regionWallpaperIndex + 1) % ROAM_REGION_WALLPAPERS.length],
    ]);
  }, [regionWallpaperIndex]);

  useEffect(() => () => {
    localStorage.setItem("taletalk-roam-region-wallpaper-index", String((regionWallpaperIndex + 1) % ROAM_REGION_WALLPAPERS.length));
  }, [regionWallpaperIndex]);

  const beginRoam = (destination: RoamDestination) => {
    const destinationConfig = ROAM_DESTINATIONS[destination];
    setRoamDestination(destination);
    setVideoIndex(0);
    setCurrentTime(0);
    setActiveWord(null);
    roamAudioRef.current?.pause();
    roamAudioRef.current = null;
    if (destinationConfig.usesWoodstockAudio) {
      setVideoMuted(true);
      const audio = new Audio(assetUrl("audio/woodstock-roam-audio.mp3"));
      audio.preload = "auto";
      audio.volume = 1;
      audio
        .play()
        .then(() => setVideoMuted(false))
        .catch(() => setVideoMuted(true));
      roamAudioRef.current = audio;
    } else {
      setVideoMuted(false);
    }
    setRoamLoading(true);
    setLocationSelected(true);
  };
  const startRoam = (destination: RoamDestination) => {
    if (destination === "california") {
      setRoamDestination(destination);
      setHearstIntroductionOpen(true);
      return;
    }
    beginRoam(destination);
  };
  const playMapHover = () => {
    if (mapMuted) return;
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.setValueAtTime(520, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(760, context.currentTime + 0.08);
      gain.gain.setValueAtTime(0.025, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + 0.17);
    } catch { /* Optional UI feedback. */ }
  };
  const returnToRegionPicker = () => {
    roamAudioRef.current?.pause();
    setHearstIntroductionOpen(false);
    setLocationSelected(false);
    setRoamRegion(null);
  };
  const toggleMapSound = () => {
    setMapMuted((muted) => {
      const nextMuted = !muted;
      const audio = mapAudioRef.current;
      if (audio) {
        audio.muted = nextMuted;
        if (!nextMuted) void audio.play().catch(() => undefined);
      }
      return nextMuted;
    });
  };
  const activeRoamRegion = roamRegion ?? "usa";
  const activeRoamVideos = ROAM_DESTINATIONS[roamDestination].videos;
  const usesWoodstockAudio = ROAM_DESTINATIONS[roamDestination].usesWoodstockAudio;
  const activeRoamWordBoxes = roamDestination === "california" ? HEARST_ROAM_WORDS : roamWordBoxes;
  const activeRoamKorean = roamDestination === "california" ? HEARST_ROAM_KOREAN : ROAM_KOREAN;
  const activeRoamRomanisations = roamDestination === "california" ? HEARST_ROAM_ROMANISATION : ROAM_ROMANISATION;
  const activeWordKorean = activeWord ? activeRoamKorean[activeWord.id] ?? activeWord.italian : "";
  const activeWordRomanisation = activeWord ? activeRoamRomanisations[activeWord.id] ?? "" : "";
  const roamInputTarget = roamRomanisationEnabled && /[a-z]/i.test(activeWordInput) ? activeWordRomanisation : activeWordKorean;
  const normaliseRoamAnswer = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, "");
  const activeRoamFacts = roamDestination === "california" ? HEARST_ROAM_FACTS : ROAM_ENGLISH_FACTS;
  const toggleRoamRomanisation = () => {
    const next = !roamRomanisationEnabled;
    setRoamRomanisationEnabled(next);
    localStorage.setItem("taletalk-romanisation-enabled", String(next));
    window.dispatchEvent(new CustomEvent("taletalk-romanisation-change", { detail: next }));
  };

  const toggleRoamPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  };

  const closeActiveWord = (dismissCompletedWord = false) => {
    if (!activeWord) return;
    if (dismissCompletedWord) {
      setDismissedWordIds((ids) =>
        ids.includes(activeWord.id) ? ids : [...ids, activeWord.id],
      );
    }
    setActiveWord(null);
    const video = videoRef.current;
    if (video?.paused) {
      void video.play().catch(() => setIsPlaying(false));
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "]") return;
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA")
      )
        return;
      setShowControls((s) => !s);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      setCurrentTime(v.currentTime);
      const audio = roamAudioRef.current;
      if (
        audio &&
        !audio.paused &&
        Math.abs(audio.currentTime - v.currentTime) > 0.35
      )
        audio.currentTime = v.currentTime;
    };
    const onPlay = () => {
      setIsPlaying(true);
      const audio = roamAudioRef.current;
      if (usesWoodstockAudio && !videoMuted && audio?.paused) {
        audio.currentTime = v.currentTime;
        audio.play().catch(() => setVideoMuted(true));
      }
    };
    const onPause = () => {
      setIsPlaying(false);
      roamAudioRef.current?.pause();
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    // React's muted attribute can be retained by the browser after an autoplay
    // fallback. Set the live media properties as well so a Woodstock click
    // really restores the video's audio track.
    v.muted = usesWoodstockAudio || videoMuted;
    v.defaultMuted = usesWoodstockAudio || videoMuted;
    // Native controls do not emit timeupdate at the same cadence in every
    // browser. Poll the media clock so timed word overlays stay in sync.
    const clock = window.setInterval(() => setCurrentTime(v.currentTime), 100);
    v.play().catch(() => {
      // Browsers can block autoplay with sound. Retry immediately as muted
      // rather than leaving the video paused at 0:00 until the user moves it.
      v.muted = true;
      v.play().catch(() => setIsPlaying(false));
    });
    return () => {
      window.clearInterval(clock);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [locationSelected, roamDestination, videoIndex, usesWoodstockAudio]);

  if (!locationSelected && !roamRegion) {
    return (
      <div ref={sceneRef} className="roam-location-screen roam-region-picker-screen" style={{ backgroundImage: `url('${ROAM_REGION_WALLPAPERS[regionWallpaperIndex]}')` }} onMouseMove={handleSceneMouseMove}>
        <audio ref={mapAudioRef} autoPlay loop muted={mapMuted} volume={0.32} src={assetUrl("audio/countryside-roam.mp3")} />
        <header className="roam-location-header">
          <div>
            <p>{isChinese ? "选择目的地" : "Choose a destination"}</p>
            <h1>{isChinese ? "选择你想去旅行的地方" : "Select where you want to travel"}</h1>
          </div>
          <div className="roam-map-top-actions roam-region-picker-actions">
            <button className="world-map-menu" onClick={toggleMapSound}>{isChinese ? (mapMuted ? "声音开" : "声音关") : (mapMuted ? "Sound on" : "Sound off")}</button>
            <button className="world-map-menu" onClick={onMenu}>{isChinese ? "菜单" : "Menu"}</button>
          </div>
        </header>
        <div className="roam-region-grid">
          {(Object.entries(ROAM_REGIONS) as [RoamRegion, (typeof ROAM_REGIONS)[RoamRegion]][]).map(([key, region]) => (
            <button
              key={key}
              className={`roam-region-card ${key === "usa" ? "" : "roam-region-card-locked"}`}
              onClick={() => { if (key === "usa") setRoamRegion(key); }}
              onMouseEnter={() => { if (key === "usa") playMapHover(); }}
              aria-disabled={key !== "usa"}
            >
              <img src={assetUrl(region.map)} alt={`${region.label} map`} draggable={false} />
              <span>{isChinese ? region.labelZh : region.label}</span>
              <small>{key === "usa" ? (isChinese ? "开始漫游" : "Begin roaming") : (isChinese ? "已锁定" : "Locked")}</small>
            </button>
          ))}
        </div>
        {debugMode && <DebugOverlayPanel overlay={overlay} mediaLabel="Roam destination selection" />}
      </div>
    );
  }

  if (!locationSelected) {
    return (
      <div
        ref={sceneRef}
        className="roam-location-screen"
        onMouseMove={handleSceneMouseMove}
      >
        <audio ref={mapAudioRef} autoPlay loop muted={mapMuted} volume={0.32} src={assetUrl("audio/countryside-roam.mp3")} />
        <SmoothSceneImage
          src={assetUrl(ROAM_REGIONS[activeRoamRegion].map)}
          alt={ROAM_REGIONS[activeRoamRegion].title}
          className="roam-location-map"
          draggable={false}
        />
        <video aria-hidden="true" className="hidden" src={ROAM_DESTINATIONS[primedRoamDestination].videos[0]} preload="auto" muted playsInline />
        <div className="roam-location-shade" />
        <header className="roam-location-header">
          <div>
            <p>{isChinese ? "选择目的地" : "Choose a destination"}</p>
            <h1>{isChinese ? ROAM_REGIONS[activeRoamRegion].titleZh : ROAM_REGIONS[activeRoamRegion].title}</h1>
          </div>
          <div className="map-settings roam-map-settings">
            <button className="map-settings-trigger" type="button" onClick={() => setRoamMapSettingsOpen((open) => !open)} aria-label="Roam map settings" aria-expanded={roamMapSettingsOpen}>
              <Settings size={20} />
            </button>
            {roamMapSettingsOpen && <div className="map-settings-menu">
              <button onClick={toggleMapSound}>{mapMuted ? <Volume2 size={15} /> : <VolumeX size={15} />}{mapMuted ? "Sound on" : "Sound off"}</button>
              <button onClick={returnToRegionPicker}>Choose region</button>
              <button onClick={onMenu}>Main menu</button>
            </div>}
          </div>
        </header>
        <div className={`roam-progress-panel ${roamProgressOpen ? "is-open" : ""}`}>
          <button
            type="button"
            className="roam-progress-trigger"
            onClick={() => setRoamProgressOpen((open) => !open)}
            aria-expanded={roamProgressOpen}
          >
            <BookOpen size={18} />
            <span>Progress</span>
            <ChevronRight size={16} className={roamProgressOpen ? "rotate-90" : ""} />
          </button>
          {roamProgressOpen && <div className="roam-progress-content">
            <section>
              <button type="button" onClick={() => setRoamProgressSection((section) => section === "words" ? null : "words")} aria-expanded={roamProgressSection === "words"}>
                <span>Words unlocked</span><b>{uniqueSavedWords.length}/{ROAM_WORD_TARGET}</b>
              </button>
              {roamProgressSection === "words" && <div className="roam-progress-list">
                {uniqueSavedWords.length ? uniqueSavedWords
                  .sort((a, b) => a.italian.localeCompare(b.italian))
                  .map((word) => <div key={word.id}>
                    <strong>{(word.id.startsWith("hearst-") ? HEARST_ROAM_KOREAN[word.id] : ROAM_KOREAN[word.id]) ?? word.italian}</strong>
                    <span>{capitaliseStandalone(word.italian)}</span>
                  </div>) : <p>No words unlocked yet.</p>}
              </div>}
            </section>
            <section>
              <button type="button" onClick={() => setRoamProgressSection((section) => section === "locations" ? null : "locations")} aria-expanded={roamProgressSection === "locations"}>
                <span>Locations unlocked</span><b>{unlockedLocationCount}/2</b>
              </button>
              {roamProgressSection === "locations" && <div className="roam-progress-list roam-progress-locations">
                <div><strong>Woodstock, Vermont</strong><span>{woodstockWordCount}/{WOODSTOCK_WORD_TARGET} words</span></div>
                <div className={hearstUnlocked ? "" : "is-locked"}><strong>Hearst Castle, California</strong><span>{hearstUnlocked ? `${hearstWordCount}/${HEARST_WORD_TARGET} words` : "Locked · unlock 5 Woodstock words"}</span></div>
              </div>}
            </section>
          </div>}
        </div>
        {hearstIntroductionOpen && (
          <div className="roam-hearst-introduction-backdrop" role="presentation">
            <section className="roam-hearst-introduction" role="dialog" aria-modal="true" aria-labelledby="hearst-introduction-title">
              <p>California Roam</p>
              <h2 id="hearst-introduction-title">Hearst Castle</h2>
              <div className="roam-hearst-introduction-rule" />
              <div>
                Hearst Castle is a famous historic estate located in San Simeon, California. Built for newspaper publisher William Randolph Hearst, it is known for its grand architecture, beautiful gardens, impressive art collection, and stunning views of the Pacific Ocean.
              </div>
              <button onClick={() => { setHearstIntroductionOpen(false); beginRoam("california"); }}>
                Enter Hearst Castle
              </button>
            </section>
          </div>
        )}
        {activeRoamRegion === "usa" && <button
          className="roam-location-marker roam-location-marker-woodstock"
          onClick={() => startRoam("woodstock")}
          onMouseEnter={() => { setPrimedRoamDestination("woodstock"); playMapHover(); }}
        >
          <strong>Woodstock, Vermont</strong>
          <small>{isChinese ? "开始漫游" : "Start roaming"}</small>
        </button>}
        {activeRoamRegion === "usa" && <button
          className="roam-location-marker roam-location-marker-woodstock roam-location-marker-account"
          onClick={() => startRoam("woodstock")}
          onMouseEnter={() => { setPrimedRoamDestination("woodstock"); playMapHover(); }}
        >
          <strong>Woodstock, Vermont</strong>
          <small>
            {woodstockWordCount}/{WOODSTOCK_WORD_TARGET} collected · Start roaming
          </small>
          <em>
            A peaceful historic village surrounded by Vermont’s Green Mountains.
          </em>
        </button>}
        {activeRoamRegion === "usa" && <button
          className={`roam-location-marker roam-location-marker-california roam-location-marker-california-account ${hearstUnlocked ? "" : "roam-location-marker-locked"}`}
          onClick={() => { if (hearstUnlocked) startRoam("california"); }}
          onMouseEnter={() => { if (hearstUnlocked) { setPrimedRoamDestination("california"); playMapHover(); } }}
          aria-label={hearstUnlocked ? "Start Hearst Castle roaming" : "Hearst Castle is locked"}
          aria-disabled={!hearstUnlocked}
        >
          <strong>Hearst Castle — California</strong>
          <small>{hearstUnlocked ? `${hearstWordCount}/${HEARST_WORD_TARGET} collected · Start roaming` : "Locked · collect 5 Woodstock words to progress"}</small>
          <em>A grand California estate above the Pacific coast.</em>
        </button>}
        {activeRoamRegion === "usa" && <><span className="roam-location-label roam-location-seattle">
          Seattle
        </span>
        <span className="roam-location-label roam-location-chicago">
          Chicago
        </span>
        <span className="roam-location-label roam-location-miami">Miami</span>
        <span className="roam-location-label roam-location-la">
          Los Angeles
        </span>
        </>}
        {debugMode && (
          <DebugOverlayPanel
            overlay={overlay}
            mediaLabel="north-america-roam-map-v2.png"
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="world-map-scene roam-video-screen"
      ref={sceneRef}
      onMouseMove={handleSceneMouseMove}
    >
      <video
        key={videoIndex}
        ref={videoRef}
        className="world-map-image"
        src={activeRoamVideos[videoIndex]}
        autoPlay
        preload="auto"
        muted={usesWoodstockAudio || videoMuted}
        controls={showControls}
        playsInline
        draggable={false}
        onEnded={() => {
          roamAudioRef.current?.pause();
          setVideoIndex((index) => (index + 1) % activeRoamVideos.length);
        }}
        onLoadedData={() => setRoamLoading(false)}
        onCanPlay={() => setRoamLoading(false)}
      />
      {roamLoading && (
        <div className="roam-preload">
          <span>Loading roam…</span>
        </div>
      )}
      <video
        aria-hidden="true"
        className="hidden"
        src={activeRoamVideos[(videoIndex + 1) % activeRoamVideos.length]}
        preload="auto"
        muted
      />
      <div className="world-map-vignette" />
      {hearstUnlockNotice && (
        <div className="roam-unlock-notice-backdrop">
          <section className="roam-unlock-notice" role="dialog" aria-modal="true" aria-labelledby="hearst-unlocked-title">
            <span>✦</span>
            <p>New Roam unlocked</p>
            <h2 id="hearst-unlocked-title">Hearst Castle</h2>
            <div>You unlocked Hearst Castle. It is now available on the USA Roam map.</div>
            <button onClick={() => setHearstUnlockNotice(false)}>Continue</button>
          </section>
        </div>
      )}
      <header className="world-map-topbar">
        <div>
          <h1>TaleTalk</h1>
        </div>
        <div className="roam-settings">
          <button className="roam-settings-trigger" type="button" onClick={() => setRoamSettingsOpen((open) => !open)} aria-label="Roam settings" aria-expanded={roamSettingsOpen}>
            <Settings size={20} />
          </button>
          {roamSettingsOpen && <div className="roam-settings-menu">
            <button
              className="roam-tools-btn"
              onClick={() => { setSavedWordsOpen((open) => !open); setRoamSettingsOpen(false); }}
            >
              <BookOpen size={14} />{" "}
              {isChinese
                ? `已收集单词 ${uniqueSavedWords.length}/${ROAM_WORD_TARGET}`
                : `Collected words ${currentDestinationWordCount}/${currentDestinationWordTarget}`}
            </button>
            <button
              className="roam-tools-btn"
              onClick={() => {
              const v = videoRef.current;
              const audio = roamAudioRef.current;
              if (!v) return;
              const next = !videoMuted;
              if (usesWoodstockAudio && audio) {
                audio.muted = next;
                if (!next) {
                  audio.currentTime = v.currentTime;
                  audio.volume = 1;
                }
                if (!next) audio.play().catch(() => setVideoMuted(true));
              } else {
                v.muted = next;
                if (!next) v.play().catch(() => setVideoMuted(true));
              }
              setVideoMuted(next);
              }}
            >
              {videoMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}{" "}
              {videoMuted ? "Unmute" : "Mute"}
            </button>
            {toolsEnabled ? (
            <button
              className="roam-tools-btn"
              onClick={() => setToolsEnabled(false)}
            >
              <Power size={14} /> {isChinese ? "关闭提示" : "Turn off tools"}
            </button>
          ) : (
            <button
              className="roam-tools-btn off"
              onClick={() => setToolsEnabled(true)}
            >
              <Power size={14} /> {isChinese ? "打开提示" : "Turn on tools"}
            </button>
            )}
            <button className="roam-tools-btn" onClick={onMenu}>
              {isChinese ? "菜单" : "Menu"}
            </button>
          </div>}
        </div>
      </header>

      {/* Tutorial prompt — shows when mare first appears */}
      {roamDestination === "woodstock" &&
        toolsEnabled &&
        !tipDismissed &&
        currentTime >= 2 &&
        currentTime < 10 &&
        activeWord === null && (
          <div className="roam-video-tip absolute right-4 top-1/2 -translate-y-1/2 z-30 pointer-events-auto">
            <button
              type="button"
              onClick={() => setTipDismissed(true)}
              className="block cursor-pointer border-0 bg-transparent p-2 text-left"
              title="Click to dismiss tip"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[#c4942a] text-[10px] uppercase tracking-wider font-bold">
                  {isChinese ? "提示" : "Tip"}
                </span>
              </div>
              <p className="text-[#c4b080] text-[11px] leading-relaxed">
                {isChinese
                  ? "点击高亮单词来探索，或使用上方按钮关闭提示。"
                  : "Click on the highlighted words to explore more, or turn them off with the Turn off tools button above."}
              </p>
            </button>
          </div>
        )}

      {unlockedWordNotice && (
        <div className="roam-word-unlocked-toast" role="status" aria-live="polite">
          <span><Check size={18} strokeWidth={3} /></span>
          <div>
            <small>Word unlocked</small>
            <strong>{unlockedWordNotice.korean}</strong>
            <em>{unlockedWordNotice.english}</em>
          </div>
        </div>
      )}

      {debugMode && (
        <DebugOverlayPanel overlay={overlay} mediaLabel="roam-video.mp4" />
      )}

      {toolsEnabled &&
        activeWord === null &&
        activeRoamWordBoxes
          .filter(
            (w) =>
              currentTime >= w.showFrom &&
              currentTime < w.showUntil &&
              !dismissedWordIds.includes(w.id),
          )
          .map((w) => {
            const bb = bboxFromPoints(w.moveAt && currentTime >= w.moveAt && w.movedPoints ? w.movedPoints : w.points);
            return (
              <button
                key={w.id}
                className="roam-word-box"
                style={{
                  left: `${bb.left + bb.width / 2}%`,
                  top: `${bb.top + bb.height / 2}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveWord(w);
                  setActiveWordInput("");
                  speak(activeRoamKorean[w.id] ?? w.italian, "female");
                }}
              >
                {activeRoamKorean[w.id] ?? w.italian}
              </button>
            );
          })}

      {activeWord && (
        <div className="roam-word-popup-backdrop">
          <div className="roam-word-popup" onClick={(e) => e.stopPropagation()}>
            <div className="roam-word-popup-header-actions">
              <button
                type="button"
                className={`roam-word-popup-romanisation ${roamRomanisationEnabled ? "is-enabled" : ""}`}
                onClick={toggleRoamRomanisation}
                aria-pressed={roamRomanisationEnabled}
              >
                <span>Romanisation</span><b aria-hidden="true">{roamRomanisationEnabled ? "✓" : ""}</b>
              </button>
              <button
                className="roam-word-popup-pause"
                onClick={toggleRoamPlayback}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                {isPlaying
                  ? isChinese
                    ? "暂停"
                    : "Pause"
                  : isChinese
                    ? "播放"
                    : "Play"}
              </button>
              <button
                className="roam-word-popup-close"
                onClick={() => closeActiveWord()}
              >
                <X size={16} />
              </button>
            </div>
            <div className="roam-word-popup-eyebrow">
              Korean word
            </div>
            <div className="flex items-center gap-2">
              <h2 className="roam-word-popup-italian"><LiveAnswerLetters target={activeWordKorean} value={/[가-힣]/.test(activeWordInput) ? activeWordInput : ""} neutralClassName="text-inherit" /></h2>
              <button
                className="text-[#c4942a] transition hover:text-white"
                onClick={() => speak(activeWordKorean, "female")}
                title={`Hear ${activeWord.italian} in Korean`}
                aria-label={`Hear ${activeWord.italian} in Korean`}
              >
                <Volume2 size={18} />
              </button>
            </div>
            {roamRomanisationEnabled && <p className="roam-word-popup-romanised"><LiveAnswerLetters target={activeWordRomanisation} value={/[a-z]/i.test(activeWordInput) ? activeWordInput : ""} neutralClassName="text-[#f6d46b]" /></p>}
            <div className="roam-word-popup-english">{capitaliseStandalone(activeWord.italian)}</div>
            <div className="roam-word-popup-divider" />
            <p className="roam-word-popup-fact">{activeRoamFacts[activeWord.id] ?? activeWord.fact}</p>
            <form onSubmit={(event) => { event.preventDefault(); const typed = normaliseRoamAnswer(activeWordInput); const isCorrect = typed === normaliseRoamAnswer(activeWordKorean) || (roamRomanisationEnabled && typed === normaliseRoamAnswer(activeWordRomanisation)); if (!isCorrect) return; speak(activeWordKorean, "female", () => { if (!savedWords.some((word) => word.id === activeWord.id)) recordDailyLearnedWords([activeWordKorean]); setSavedWords((words) => words.some((word) => word.id === activeWord.id) ? words : [...words, activeWord]); setUnlockedWordNotice({ korean: activeWordKorean, english: capitaliseStandalone(activeWord.italian) }); closeActiveWord(true); }); }} className="mt-4">
              <div className="flex gap-2"><input autoFocus value={activeWordInput} onChange={(event) => setActiveWordInput(event.target.value)} placeholder={roamRomanisationEnabled ? "Type the Korean word or Romanisation" : "Type the Korean word to unlock"} className={`min-w-0 flex-1 rounded-lg border bg-black/25 px-3 py-2 text-sm outline-none transition ${activeWordInput.length > 0 && normaliseRoamAnswer(roamInputTarget).startsWith(normaliseRoamAnswer(activeWordInput)) ? "border-green-400 text-green-300" : "border-white/20 text-white"}`} />
              <button className="rounded-lg bg-[#c4942a] px-3 py-2 text-xs font-semibold text-[#1b1208]">Unlock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {savedWordsOpen && (
        <div className="absolute right-4 top-16 z-40 w-64 rounded-2xl border border-white/15 bg-[#100b08]/95 p-3 shadow-2xl backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#c4942a]">
              {isChinese
                ? `已收集单词 ${savedWords.length}/${ROAM_WORD_TARGET}`
                : `Collected words ${savedWords.length}/${ROAM_WORD_TARGET}`}
            </span>
            <button
              className="text-white/50 hover:text-white"
              onClick={() => setSavedWordsOpen(false)}
            >
              ×
            </button>
          </div>
          {savedWords.length ? (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {[...savedWords]
                .sort((a, b) => a.italian.localeCompare(b.italian))
                .map((word) => (
                  <div
                    key={word.italian}
                    className="rounded-lg bg-white/5 px-2.5 py-2"
                  >
                    <span className="block text-sm text-white">
                      {(word.id.startsWith("hearst-") ? HEARST_ROAM_KOREAN[word.id] : ROAM_KOREAN[word.id]) ?? word.italian}
                    </span>
                    {roamRomanisationEnabled && <span className="block text-[10px] font-semibold text-[#f6d46b]">{word.id.startsWith("hearst-") ? HEARST_ROAM_ROMANISATION[word.id] : ROAM_ROMANISATION[word.id]}</span>}
                    <span className="text-[10px] text-white/45">
                      {word.italian}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-xs text-white/50">
              {isChinese
                ? "从信息卡保存单词，它会显示在这里。"
                : "Save a word from its information card to keep it here."}
            </p>
          )}
        </div>
      )}

      <footer className="world-map-footer">
        <span>{isChinese ? "漫游模式" : "Roam mode"}</span>
        <span>
          {isChinese
            ? "按 # 查看坐标 · 按 ] 显示视频控制"
            : "Press # for coordinates · Press ] for video controls"}
        </span>
      </footer>
    </div>
  );
}

const SHOPPING_STOPS = [
  {
    id: "dinner",
    italian: "Dinner",
    english: "Chicken",
    chinese: "鸡肉和土豆",
    image: assetUrl("scenes/shop/c3-dinner.png"),
    imageAlt: "The dinner aisle",
    foodPoint: { left: "81.8%", top: "41.8%" },
    choices: ["Chicken", "Pizza", "Fish and chips"],
  },
  {
    id: "water",
    italian: "Drinks",
    english: "Water",
    chinese: "水",
    image: assetUrl("scenes/shop/c4-v2.png"),
    imageAlt: "The drinks shelf",
    foodPoint: { left: "49%", top: "43%" },
    choices: ["Water", "Apple juice", "Coca-Cola"],
  },
  {
    id: "fruit",
    italian: "Fruit",
    english: "Apples",
    chinese: "苹果和香蕉",
    image: assetUrl("scenes/shop/c5-v2.png"),
    imageAlt: "The fruit shelf",
    foodPoint: { left: "67%", top: "43%" },
    choices: ["Apples", "Oranges", "Strawberries"],
  },
] as const;

const SHOPPING_OUTSIDE_IMAGE = assetUrl("scenes/shop/c1-v3.png");
const SHOPPING_INSIDE_IMAGE = assetUrl("scenes/shop/c2-v3.png");
const SHOPPING_SCENE_IMAGES = [
  SHOPPING_OUTSIDE_IMAGE,
  SHOPPING_INSIDE_IMAGE,
  ...SHOPPING_STOPS.map(stop => stop.image),
  assetUrl("scenes/shop/c9-taking-rose.png"),
];

const SHOPPING_KOREAN: Record<string, string> = { dinner: "닭고기", water: "물", fruit: "사과" };
const shoppingKorean = (id: string) => SHOPPING_KOREAN[id] ?? "";
const SHOPPING_POINT_ENGLISH: Record<string, string> = { dinner: "Dinner", water: "Drinks", fruit: "Fruits" };
const shoppingPointEnglish = (id: string) => SHOPPING_POINT_ENGLISH[id] ?? "";
const SHOPPING_ROMANISATION: Record<string, string> = { dinner: "dalgogi", water: "mul", fruit: "sagwa", shop: "gage" };
const SHOPPING_CHOICE_KOREAN: Record<string, string> = { Water: "물", "Apple juice": "사과 주스", "Coca-Cola": "코카콜라", Chicken: "닭고기", Pizza: "피자", "Fish and chips": "피시 앤 칩스", Apples: "사과", Oranges: "오렌지", Strawberries: "딸기" };
const SHOPPING_CHOICE_ROMANISATION: Record<string, string> = { Water: "Mul", "Apple juice": "Sagwa juseu", "Coca-Cola": "Kokakolla", Chicken: "Dalgogi", Pizza: "Pija", "Fish and chips": "Pisi aen chipseu", Apples: "Sagwa", Oranges: "Orenji", Strawberries: "Ttalgi" };
const SHOPPING_DETAIL_KOREAN: Record<string, string> = { dinner: "닭고기", water: "물", fruit: "사과" };
const SHOPPING_VOCAB_ROMANISATION: Record<string, string> = { shop: "Gage", dinner: "Jeonyeok", drinks: "Eum-ryo", fruit: "Gwa-il", chicken: "Dalgogi", water: "Mul", apples: "Sagwa" };
const SHOPPING_PAY_TARGET = "계산하다";
const SHOPPING_PAY_ROMANISATION = "Gyesanhada";
const SHOPPING_ROSE_NARRATION = "He finds a rose at the counter. This might help him if worse comes to worse.";
const SHOPPING_PAID_NARRATION = "The groceries and the rose are now safely in the bag.";
const shoppingChoiceKorean = (choice: string) => SHOPPING_CHOICE_KOREAN[choice] ?? choice;

function startQuietRoadsideAmbience() {
  try {
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.value = 0.028;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 680;
    filter.Q.value = 0.4;
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    noise.connect(filter).connect(gain).connect(context.destination);
    noise.start();
    void context.resume().catch(() => undefined);
    return () => { noise.stop(); void context.close(); };
  } catch {
    return () => undefined;
  }
}

function ShopTripAdventure({
  onMenu,
  onComplete,
}: {
  onMenu: () => void;
  onComplete: () => void;
}) {
  const overlay = useDebugOverlay();
  const { debugMode, sceneRef, handleSceneMouseMove } = overlay;
  const isChinese = false;
  const [phase, setPhase] = useState<
    | "approach"
    | "word-puzzle"
    | "inside"
    | "food-word"
    | "detail-word"
    | "checkout"
    | "payment"
    | "paid"
  >("approach");
  const shoppingNarratedPhaseRef = useRef<string | null>(null);
  const [approachDialogVisible, setApproachDialogVisible] = useState(true);
  const [wordInput, setWordInput] = useState("");
  const [wordWrong, setWordWrong] = useState(false);
  const [wordDone, setWordDone] = useState(false);
  const [unlockedWords, setUnlockedWords] = useState<ShopWordTooltip[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [practiceWord, setPracticeWord] = useState<ShopWordTooltip | null>(
    null,
  );
  const [practiceInput, setPracticeInput] = useState("");
  const [practiceCorrect, setPracticeCorrect] = useState(false);
  const [activeFoodIndex, setActiveFoodIndex] = useState(0);
  const [pickedFoodIds, setPickedFoodIds] = useState<string[]>([]);
  const [foodInput, setFoodInput] = useState("");
  const [aisleWordStep, setAisleWordStep] = useState<"category" | "item">("item");
  const [foodWrong, setFoodWrong] = useState(false);
  const [detailWordIndex, setDetailWordIndex] = useState(0);
  const [paymentInput, setPaymentInput] = useState("");
  const [paymentWrong, setPaymentWrong] = useState(false);
  const [shoppingRomanisationEnabled, setShoppingRomanisationEnabled] = useState(() => localStorage.getItem("taletalk-romanisation-enabled") === "true");
  useEffect(() => {
    // This short scene is small enough to decode in full while its first frame
    // is showing. Rapid answers can therefore never outrun the next aisle.
    preloadSceneWindow(SHOPPING_SCENE_IMAGES, 0, 12);
    preloadGeneratedSpeech(SHOPPING_ROSE_NARRATION, "adventure");
    preloadGeneratedSpeech(SHOPPING_PAID_NARRATION, "adventure");
    preloadGeneratedSpeech(SHOPPING_PAY_TARGET, "female");
  }, []);
  const enterShopInterior = (minimumDelay = 0) => {
    const delay = new Promise<void>(resolve => window.setTimeout(resolve, minimumDelay));
    void Promise.all([preloadImage(SHOPPING_INSIDE_IMAGE, "high"), delay]).then(() => {
      window.requestAnimationFrame(() => setPhase("inside"));
    });
  };
  const recordDailyWords = (words: string[]) => recordDailyLearnedWords(words);
  const playShopDoorBell = () => {
    try {
      const context = new AudioContext();
      const gain = context.createGain();
      gain.connect(context.destination);
      gain.gain.setValueAtTime(0.18, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.1);
      [1046, 1318].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start(context.currentTime + index * 0.13);
        oscillator.stop(context.currentTime + 1.1);
      });
      void context.resume().catch(() => undefined);
    } catch { /* Optional browser audio. */ }
  };
  const {
    speak,
    cancel,
    enabled: speechEnabled,
    toggle: toggleSpeech,
  } = useSpeech();
  const SHOP_WORD: ShopWordTooltip = { word: "Shop", translation: "가게" };
  const SHOP_TARGET = "가게";
  useEffect(() => {
    if (practiceWord) speak(practiceWord.translation, "female");
  }, [practiceWord, speak]);
  const toggleShoppingRomanisation = () => {
    const enabled = !shoppingRomanisationEnabled;
    setShoppingRomanisationEnabled(enabled);
    localStorage.setItem("taletalk-romanisation-enabled", String(enabled));
    window.dispatchEvent(new CustomEvent("taletalk-romanisation-change", { detail: enabled }));
  };
  useEffect(() => { const sync = (event: Event) => setShoppingRomanisationEnabled(Boolean((event as CustomEvent<boolean>).detail)); window.addEventListener("taletalk-romanisation-change", sync); return () => window.removeEventListener("taletalk-romanisation-change", sync); }, []);
  // Vocabulary repeat buttons must speak immediately from a direct user click.
  // Use a generated Korean recording first, with the device Korean voice as a fallback.
  const speakKorean = (word: string) => {
    const useDeviceVoice = () => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "ko-KR";
      utterance.rate = 0.88;
      utterance.pitch = 1;
      const koreanVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("ko"));
      if (koreanVoice) utterance.voice = koreanVoice;
      window.speechSynthesis.speak(utterance);
    };
    let hash = 2166136261;
    for (const character of `ko:${word}`) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    const recording = new Audio(assetUrl(`audio/voices/line-ko-${(hash >>> 0).toString(36)}.mp3`));
    recording.onerror = useDeviceVoice;
    recording.play().catch(useDeviceVoice);
  };
  const saveToVocabulary = (word: string) => {
    const slot = Number(localStorage.getItem("taletalk_active_save_slot") ?? "1");
    const key = `taletalk-slot-${slot}-unlocked-words`;
    const saved = new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]"));
    saved.add(word.toLowerCase());
    localStorage.setItem(key, JSON.stringify([...saved].sort()));
    const sceneKey = `taletalk-slot-${slot}-scene-shopping-words`;
    const sceneWords = new Set<string>(JSON.parse(localStorage.getItem(sceneKey) ?? "[]"));
    sceneWords.add(word.toLowerCase());
    localStorage.setItem(sceneKey, JSON.stringify([...sceneWords].sort()));
    recordDailyLearnedWords([word], slot);
    window.dispatchEvent(new Event("taletalk-words-changed"));
  };

  useEffect(() => {
    // The shopping-centre opening stays silent; only the shop-door bell plays.
    return;
  }, [phase]);

  useEffect(() => {
    const englishNarration: Partial<Record<typeof phase, string>> = {
      "word-puzzle": "가게",
      inside: "The little shop was quiet, almost still. Shelves stood patiently along the walls, packed with the same familiar things they had held a hundred mornings before, along with the faint hum of the lights and the soft click of the door closing behind him.",
      "food-word": activeFoodIndex === 0 ? "저녁" : activeFoodIndex === 1 ? "음료" : "과일",
      checkout: SHOPPING_ROSE_NARRATION,
      paid: SHOPPING_PAID_NARRATION,
    };
    const narration = englishNarration[phase];
    if (shoppingNarratedPhaseRef.current === phase) return;
    shoppingNarratedPhaseRef.current = phase;
    if (narration) { speak(narration, /[가-힣]/.test(narration) ? "female" : "adventure"); return; }
    if (phase === "approach") { speak("The little shop waits quietly at the end of the path, surrounded by flowers and the familiar stillness of the village. He has been here countless times before. Today is no different.", "male"); return; }
    if (phase === "approach") speak("他来到当地商店。点击商店进入。", "male");
    else if (phase === "word-puzzle")
      speak("输入“商店”的英语单词即可进入。", "male");
    else if (phase === "inside")
      speak("他走进了商店。购物清单上有鸡肉和土豆、水、苹果和香蕉。", "male");
    else if (phase === "food-word")
      speak(
        `请输入“${SHOPPING_STOPS[activeFoodIndex].chinese}”的英语单词。`,
        "male",
      );
    else if (phase === "payment") speak(SHOPPING_PAY_TARGET, "female");
  }, [phase, activeFoodIndex, speak]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.length === 1) {
        const buf = (e.key + e.key).slice(-2);
        if (buf === "//") {
          cancel();
          onComplete();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cancel, onComplete]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      isSkipAnswer(wordInput) ||
      stripAccents(wordInput.toLowerCase().trim()) === SHOP_TARGET
    ) {
      speak(SHOP_TARGET, "female");
      setWordDone(true);
      setUnlockedWords((prev) => {
        const existing = new Set(prev.map((w) => w.word));
        return existing.has(SHOP_WORD.word) ? prev : [...prev, SHOP_WORD];
      });
      setWordInput("");
      recordDailyWords(["shop"]);
      saveToVocabulary("shop");
      playShopDoorBell();
      enterShopInterior(1800);
      setTimeout(() => {
        setWordDone(false);
      }, 1800);
    } else {
      setWordWrong(true);
      setTimeout(() => setWordWrong(false), 1500);
    }
  };

  const activeFood = SHOPPING_STOPS[activeFoodIndex];
  const shuffledFoodChoices = useMemo(() => {
    const choices = [...activeFood.choices];
    for (let index = choices.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [choices[index], choices[swapIndex]] = [choices[swapIndex], choices[index]];
    }
    // The answer used to be first every time. Keep its position genuinely
    // unpredictable while ensuring this old pattern never returns.
    if (choices[0] === activeFood.english && choices.length > 1) {
      const swapIndex = 1 + Math.floor(Math.random() * (choices.length - 1));
      [choices[0], choices[swapIndex]] = [choices[swapIndex], choices[0]];
    }
    return choices;
  }, [activeFood.id, activeFood.choices, activeFood.english]);
  const activeFoodKorean = shoppingKorean(activeFood.id);
  const aisleKorean: Record<string, string> = { dinner: "저녁", water: "음료", fruit: "과일" };
  const aisleEnglish: Record<string, string> = { dinner: "Dinner", water: "Drinks", fruit: "Fruit" };
  const aisleRomanisation: Record<string, string> = { dinner: "jeonyeok", water: "eum-ryo", fruit: "gwa-il" };
  const isAisleCategoryStep = Boolean(aisleKorean[activeFood.id]) && aisleWordStep === "category";
  const activeFoodTarget = isAisleCategoryStep ? aisleKorean[activeFood.id] : activeFoodKorean;
  const activeFoodCue = isAisleCategoryStep ? aisleEnglish[activeFood.id] : activeFood.english;
  const activeFoodRomanisation = isAisleCategoryStep ? aisleRomanisation[activeFood.id] : SHOPPING_ROMANISATION[activeFood.id];
  useEffect(() => {
    const replacements: Record<string, string> = {
      "商店": "가게",
      "苹果和香蕉": "사과와 바나나",
      "水": "물",
      "鸡肉和土豆": "닭고기와 감자",
      "输入“苹果和香蕉”的英语单词": "Type the Korean word for apples and bananas.",
      "输入“水”的英语单词": "Type the Korean word for water.",
      "输入“鸡肉和土豆”的英语单词": "Type the Korean word for chicken and potatoes.",
      "输入“商店”的英语单词": "Type the Korean word using the keyboard.",
    };
    document.querySelectorAll<HTMLElement>(".shop-trip-adventure *").forEach((element) => {
      if (element.children.length || !element.textContent) return;
      const replacement = replacements[element.textContent.trim()];
      if (replacement) element.textContent = replacement;
      if (phase === "word-puzzle" && element.tagName === "P" && element.textContent.trim() === "가게") {
        element.textContent = "shop";
      }
      if (phase === "food-word" && element.tagName === "P" && element.textContent.trim() === activeFoodKorean) {
        element.textContent = activeFood.english;
      }
    });
  }, [phase, activeFoodIndex]);
  // Keyboard progression always supplies the correct answer, so a player can
  // read through any scene with the Right Arrow instead of repeatedly clicking.
  useEffect(() => {
    const skip = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight") return;
      event.preventDefault();
      if (phase === "approach") setPhase("word-puzzle");
      else if (phase === "word-puzzle") {
        setUnlockedWords((words) =>
          words.some((w) => w.word === SHOP_WORD.word)
            ? words
            : [...words, SHOP_WORD],
        );
        enterShopInterior();
      } else if (phase === "inside") {
        setActiveFoodIndex(
          SHOPPING_STOPS.findIndex((item) => !pickedFoodIds.includes(item.id)),
        );
        setAisleWordStep("category");
        setFoodInput("");
        setPhase("food-word");
      } else if (phase === "food-word") {
        if (isAisleCategoryStep) {
          setUnlockedWords((words) => words.some((word) => word.word === activeFood.italian)
            ? words
            : [...words, { word: activeFood.italian, translation: activeFoodTarget }]);
          saveToVocabulary(activeFood.italian);
          setFoodInput("");
          setPhase("detail-word");
          return;
        }
        setUnlockedWords((words) =>
          words.some((w) => w.word === activeFood.english)
            ? words
            : [
                ...words,
                { word: activeFood.english, translation: activeFoodKorean },
              ],
        );
        setPhase("detail-word");
      } else if (phase === "detail-word") {
        const picked = [...pickedFoodIds, activeFood.id];
        setPickedFoodIds(picked);
        setPhase(
          picked.length === SHOPPING_STOPS.length ? "checkout" : "inside",
        );
      } else if (phase === "checkout") setPhase("payment");
      else if (phase === "payment") completePayment();
      else if (phase === "paid") onComplete();
    };
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [phase, activeFood, pickedFoodIds, onComplete, isAisleCategoryStep]);
  const compactTaskAnswer = (value: string) => stripAccents(value.toLowerCase().trim()).replace(/[\s\-'’]/g, "");
  const foodUsesRomanisation = shoppingRomanisationEnabled && /[a-z]/i.test(foodInput);
  const submitFoodWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      compactTaskAnswer(foodInput) === compactTaskAnswer(activeFoodTarget)
      || (shoppingRomanisationEnabled && compactTaskAnswer(foodInput) === compactTaskAnswer(activeFoodRomanisation))
    ) {
      if (isAisleCategoryStep) {
        setUnlockedWords((words) => words.some((word) => word.word === activeFood.italian)
          ? words
          : [...words, { word: activeFood.italian, translation: activeFoodTarget }]);
        recordDailyWords([activeFood.italian]);
        saveToVocabulary(activeFood.italian);
        speak(activeFoodTarget, "female", () => {
          setFoodInput("");
          setFoodWrong(false);
          setPhase("detail-word");
        });
        return;
      }
      setUnlockedWords((prev) =>
        prev.some((word) => word.word === activeFood.english)
          ? prev
          : [
              ...prev,
              { word: activeFood.english, translation: activeFoodKorean },
            ],
      );
      setFoodInput("");
      recordDailyWords([activeFood.english]);
      saveToVocabulary(activeFood.english);
      speak(activeFoodTarget, "female", () => setPhase("detail-word"));
    } else {
      setFoodWrong(true);
      setTimeout(() => setFoodWrong(false), 1500);
    }
  };

  const detailWords = [SHOPPING_DETAIL_KOREAN[activeFood.id] ?? activeFood.english.toLowerCase()];
  const detailWord = detailWords[detailWordIndex];
  const submitDetailWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (stripAccents(foodInput.trim().toLowerCase()) !== detailWord) {
      setFoodWrong(true);
      setTimeout(() => setFoodWrong(false), 1500);
      return;
    }
    if (detailWordIndex < detailWords.length - 1) {
      speak(detailWord, "female", () => {
        setDetailWordIndex((index) => index + 1);
        setFoodInput("");
        setFoodWrong(false);
      });
      return;
    }
    setUnlockedWords((prev) => {
      const additions =
        activeFood.id === "fruit"
          ? ["apples"]
          : activeFood.id === "dinner"
            ? ["chicken"]
            : [detailWord];
      const translations: Record<string, string> = {
        chicken: "닭고기",
        potatoes: "감자",
        water: "물",
        apples: "사과",
        bananas: "바나나",
      };
      return additions.reduce(
        (words, value) =>
          words.some((word) => word.word === value)
            ? words
            : [
                ...words,
                { word: value, translation: translations[value] ?? value },
              ],
        prev,
      );
    });
    const wordKey = `taletalk-slot-${Number(localStorage.getItem("taletalk_active_save_slot") ?? "1")}-scene-shopping-words`;
    const stored = new Set<string>(
      JSON.parse(localStorage.getItem(wordKey) ?? "[]"),
    );
    stored.add(activeFood.italian.toLowerCase());
    (activeFood.id === "fruit"
      ? ["apples"]
      : activeFood.id === "dinner"
        ? ["chicken"]
        : [detailWord]
    ).forEach((value) => stored.add(value));
    localStorage.setItem(wordKey, JSON.stringify([...stored].sort()));
    recordDailyWords(
      activeFood.id === "fruit" ? ["apples"] : activeFood.id === "dinner" ? ["chicken"] : [detailWord],
    );
    const picked = [...pickedFoodIds, activeFood.id];
    setPickedFoodIds(picked);
    setFoodInput("");
    setDetailWordIndex(0);
    speak(detailWord, "female", () => setPhase(picked.length === SHOPPING_STOPS.length ? "checkout" : "inside"));
  };

  function completePayment() {
    setPaymentInput("");
    setPaymentWrong(false);
    saveToVocabulary(SHOPPING_PAY_TARGET);
    setUnlockedWords(words => words.some(word => word.word === "Pay")
      ? words
      : [...words, { word: "Pay", translation: SHOPPING_PAY_TARGET }]);
    speak(SHOPPING_PAY_TARGET, "female", () => setPhase("paid"));
  }
  const submitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const answer = compactTaskAnswer(paymentInput);
    if (answer === compactTaskAnswer(SHOPPING_PAY_TARGET)
      || (shoppingRomanisationEnabled && answer === compactTaskAnswer(SHOPPING_PAY_ROMANISATION))) {
      cancel();
      completePayment();
    } else {
      setPaymentWrong(true);
      setTimeout(() => setPaymentWrong(false), 1500);
    }
  };

  const image =
    phase === "approach" || phase === "word-puzzle"
      ? SHOPPING_OUTSIDE_IMAGE
      : phase === "inside"
        ? SHOPPING_INSIDE_IMAGE
        : phase === "checkout" || phase === "payment" || phase === "paid"
          ? assetUrl("scenes/shop/c9-taking-rose.png")
          : activeFood.image;
  return (
    <div className="shop-trip-adventure fixed inset-0 bg-black overflow-hidden flex items-center justify-center">
      <div
        ref={sceneRef}
        className="relative h-screen w-screen"
        onMouseMove={handleSceneMouseMove}
        onClick={(event) => {
          if (event.target instanceof HTMLElement && event.target.closest("button,input,form")) return;
          if (phase === "approach") setApproachDialogVisible(false);
          else if (phase === "checkout") { cancel(); setPhase("payment"); }
          else if (phase === "paid") { cancel(); onComplete(); }
        }}
      >
        <SceneBackground source={image} alt="A trip to the shop" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 pointer-events-none" />
        <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 pt-4">
          <div>
            <h1
              className="text-white text-lg font-bold"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {isChinese ? "英语冒险" : "English Adventure"}
            </h1>
            <span className="text-white/70 text-[10px] uppercase tracking-[0.2em]">
              {isChinese ? "商店" : "The shop"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSpeech}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-black/60 border border-white/20 hover:border-white/50 text-white/80 hover:text-white transition-all"
              title={speechEnabled ? "Mute voices" : "Unmute voices"}
            >
              {speechEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button
              onClick={() => {
                cancel();
                onMenu();
              }}
              className="px-4 py-2 rounded-full text-[11px] bg-black/60 border border-white/20 text-white/80 uppercase tracking-wider"
            >
              {isChinese ? "菜单" : "Menu"}
            </button>
          </div>
        </header>

        {(phase === "inside" || phase === "food-word" || phase === "detail-word") && (
          <aside className="absolute left-4 top-28 z-30 w-48 rounded-xl border border-[#c4942a]/50 bg-black/80 p-3 text-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-[#c4942a]">
              <span>Shopping list</span>
            </div>
            <div className="mb-2 text-sm text-white/55">3 items</div>
            <div className="space-y-2">
              {SHOPPING_STOPS.map((food, itemIndex) => {
                const picked = pickedFoodIds.includes(food.id);
                return <div key={food.id} className={`flex items-start justify-between border-t border-white/10 pt-2 ${picked ? "text-green-400" : "text-white"}`}>
                  <div className={`min-w-0 ${picked ? "line-through decoration-green-400/70" : ""}`}>
                    <button type="button" onClick={() => speakKorean(shoppingKorean(food.id))} className="flex items-center gap-1 text-xl font-semibold hover:text-[#f6d46b]">{shoppingKorean(food.id)} <Volume2 size={16} /></button>
                    {shoppingRomanisationEnabled && <span className="block text-sm font-medium text-[#f6d46b]">{capitaliseStandalone(SHOPPING_ROMANISATION[food.id])}</span>}
                  </div>
                  {picked ? <Check className="mt-1 shrink-0" size={18} /> : <span className="mt-1 text-lg text-white/35">{itemIndex + 1}</span>}
                </div>;
              })}
            </div>
          </aside>
        )}

        {false && unlockedWords.length > 0 && (
          <div
            className="absolute right-4 top-28 z-30"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLibraryOpen((open) => !open)}
              className="rounded-xl border border-[#c4942a]/50 bg-black/75 px-3 py-2 text-left text-white shadow-xl backdrop-blur-sm transition hover:bg-black/90"
            >
              <span className="mt-1 block text-[9px] uppercase tracking-wider text-white/60">
                Words
              </span>
            </button>
            {libraryOpen && (
              <div className="mt-2 w-52 rounded-xl border border-white/15 bg-black/90 p-3 shadow-2xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#c4942a]">
                    Vocabulary
                  </span>
                  <button className="text-white/50 hover:text-white" onClick={() => setLibraryOpen(false)}>×</button>
                </div>
                <div className="space-y-1.5">
                  {[...unlockedWords]
                    .sort((a, b) => a.word.localeCompare(b.word))
                    .map((word) => (
                      <button
                        key={word.word}
                        onClick={() => {
                          setPracticeWord(word);
                          setPracticeInput("");
                          setPracticeCorrect(false);
                        }}
                        className="block w-full rounded-lg bg-white/5 px-2.5 py-2 text-left transition hover:bg-white/10"
                      >
                        <span className="block text-sm font-semibold text-white">{word.translation}</span>
                        {shoppingRomanisationEnabled && <span className="block text-[10px] font-medium text-[#f6d46b]">{SHOPPING_VOCAB_ROMANISATION[word.word.toLowerCase()] ?? capitaliseStandalone(word.word)}</span>}
                        <span className="block text-xs text-white/55">{capitaliseStandalone(word.word)}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {practiceWord && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-5"
            onClick={() => setPracticeWord(null)}
          >
            <div
              data-task-editor-panel="shop-trip-word-practice"
              className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#120d08]/95 p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[#c4942a]">
                Practice word
              </div>
              <h2
                className="text-2xl text-white"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                <LiveAnswerLetters target={capitaliseStandalone(practiceWord.word)} value={practiceInput} neutralClassName="text-white" />
              </h2>
              <p className="mb-4 text-sm text-white/55">
                {practiceWord.translation}
              </p>
              {practiceCorrect ? (
                <p className="mb-4 text-sm text-green-400">
                  Correct. The word is yours.
                </p>
              ) : (<>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const correct =
                      stripAccents(practiceInput.trim().toLowerCase()) ===
                        stripAccents(practiceWord.word.toLowerCase());
                    setPracticeCorrect(correct);
                    if (correct) speak(practiceWord.translation, "female");
                  }}
                  className="flex gap-2"
                >
                  <input
                    autoFocus
                    value={practiceInput}
                    onChange={(e) => setPracticeInput(e.target.value)}
                    placeholder={
                      isChinese ? "输入英语单词" : "type the English word"
                    }
                    className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/60"
                  />
                  <button className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs uppercase tracking-wider text-white">
                    Check
                  </button>
                </form>
              </>)}
              <button
                onClick={() => setPracticeWord(null)}
                className="mt-4 text-xs text-white/50 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {debugMode && (
          <DebugOverlayPanel
            overlay={overlay}
            mediaLabel="grocery-shop-scene"
          />
        )}

        {phase === "approach" && (
          <>
            <button
              className="absolute z-20 flex items-center justify-center rounded-full border-2 border-[#c4942a] bg-[#c4942a]/20 hover:bg-[#c4942a]/40 transition-all"
              style={{
                left: "76.3%",
                top: "42%",
                width: "3.4%",
                height: "5%",
                minWidth: "42px",
                minHeight: "42px",
                transform: "translate(-50%, -50%)",
                boxShadow: "0 0 24px rgba(196,148,42,0.8)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setPhase("word-puzzle");
              }}
              aria-label="Click on the shop"
            >
              <span className="hotspot-pulse" />
              <span className="hotspot-tooltip">Shop</span>
            </button>
            {approachDialogVisible && <div className="story-dialogue-panel absolute z-10" onClick={(e) => { e.stopPropagation(); setApproachDialogVisible(false); }}>
              <div className="story-dialogue-content">
                <div className="scene-eyebrow">Narrator</div>
                <p className="story-dialogue-text">The little shop waits quietly at the end of the path, surrounded by flowers and the familiar stillness of the village. He has been here countless times before. Today is no different.</p>
                <div className="cop-narration-footer"><span>click on the glowing point</span><button onClick={(event) => { event.stopPropagation(); speak("The little shop waits quietly at the end of the path, surrounded by flowers and the familiar stillness of the village. He has been here countless times before. Today is no different.", "male"); }}><Volume2 size={12} /> Listen</button></div>
              </div>
            </div>}
          </>
        )}

        {phase === "word-puzzle" && (
          <div
            data-task-editor-panel="shopping-centre-shop-task"
            className="shop-task-frame absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="shop-task-box shared-task-bar-ui rounded-2xl border border-white/10 px-4 pb-3 pt-3"
              style={{ background: "rgba(0,0,0,0.92)" }}
            >
              {wordDone ? (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                    <Sparkles size={20} />
                    <span className="text-lg font-bold">
                      {isChinese ? "已解锁新单词！" : "You unlocked the word!"}
                    </span>
                    <Sparkles size={20} />
                  </div>
                  <p className="text-white/60 text-sm">
                    <span className="text-green-400 font-medium">Shop</span> =
                    商店
                  </p>
                </div>
              ) : (
                <>
                  <div data-task-editor-item="instruction" className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#c4942a] flex-shrink-0" />
                    <span
                      className={`text-[#c4942a] uppercase tracking-[0.12em] font-semibold ${isChinese ? "text-xs" : "text-[9px]"}`}
                    >
                      {isChinese
                        ? "输入“商店”的英语单词"
                        : "Type the Korean word using the keyboard"}
                    </span>
                  </div>
                  <div
                    data-task-editor-item="hangul-cue"
                    onClick={() => speakKorean(SHOP_TARGET)}
                    className="mb-1 flex cursor-pointer gap-0.5 text-2xl font-semibold tracking-[0.24em]"
                    aria-label="Shop"
                  >
                    <LiveAnswerLetters target={SHOP_TARGET} value={wordInput} neutralClassName="text-white/45" />
                    <button type="button" onClick={() => speakKorean(SHOP_TARGET)} className="ml-2 inline-flex items-center text-[#f6d46b] hover:text-white" aria-label="Hear 가게">
                      <Volume2 size={19} />
                    </button>
                  </div>
                  <p data-task-editor-item="english-cue" className="mb-2 text-base text-white/70">Shop</p>
                  {shoppingRomanisationEnabled && <p data-task-editor-item="romanisation-cue" className="mb-2 text-sm text-[#f6d46b]"><LiveAnswerLetters target="Gage" value={/[a-z]/i.test(wordInput) ? wordInput : ""} neutralClassName="text-[#f6d46b]" /></p>}
                  <form
                    data-task-editor-item="answer-form"
                    onSubmit={handleSubmit}
                    className="flex items-center gap-2"
                  >
                    <input
                      value={wordInput}
                      onChange={(e) => setWordInput(e.target.value)}
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Type the Korean word..."
                      className="flex-1 min-w-0 bg-white/5 text-white text-sm outline-none placeholder-white/30 caret-white border-b border-white/20 focus:border-white/60 py-2 rounded-lg px-3"
                    />
                    <button className="rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-xs px-4 py-2 transition-all uppercase tracking-wider flex-shrink-0">
                      {isChinese ? "确认" : "Enter"}
                    </button>
                  </form>
                  {wordWrong && (
                    <div data-task-editor-item="error-message" className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
                      <AlertTriangle size={11} /> Not quite — try again
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {phase === "inside" && (
          <>
            {SHOPPING_STOPS.filter(
              (food) => !pickedFoodIds.includes(food.id),
            ).map((food) => (
              <button
                key={food.id}
                className="absolute z-20 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#c4942a] bg-[#c4942a]/20 transition hover:bg-[#c4942a]/40"
                style={{
                  ...food.foodPoint,
                  boxShadow: "0 0 22px rgba(196,148,42,0.8)",
                }}
                onClick={() => {
                  setActiveFoodIndex(
                    SHOPPING_STOPS.findIndex((item) => item.id === food.id),
                  );
                  setAisleWordStep("category");
                  setFoodInput("");
                  setPhase("food-word");
                }}
                aria-label={`Explore ${food.english}`}
              >
                <span className="hotspot-pulse" />
                <span className="hotspot-tooltip text-base font-semibold">{shoppingPointEnglish(food.id)}</span>
              </button>
            ))}
            <div className="story-dialogue-panel absolute z-10" onClick={(e) => e.stopPropagation()}>
              <div className="story-dialogue-content">
                <div className="scene-eyebrow">Narrator</div>
                <p className="story-dialogue-text">The little shop was quiet, almost still. Shelves stood patiently along the walls, packed with the same familiar things they had held a hundred mornings before, along with the faint hum of the lights and the soft click of the door closing behind him.</p>
                <div className="cop-narration-footer"><span>click on the glowing point</span><button onClick={(event) => { event.stopPropagation(); speak("The little shop was quiet, almost still. Shelves stood patiently along the walls, packed with the same familiar things they had held a hundred mornings before, along with the faint hum of the lights and the soft click of the door closing behind him.", "male"); }}><Volume2 size={12} /> Listen</button></div>
              </div>
            </div>
          </>
        )}

        {phase === "food-word" && (
          <>
            <div
              data-task-editor-panel="shopping-centre-category-task"
              className="shop-task-frame absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="shop-task-box shared-task-bar-ui rounded-2xl border border-white/10 px-4 pb-3 pt-3"
                style={{ background: "rgba(0,0,0,0.92)" }}
              >
                <span data-task-editor-item="instruction" className="text-[#c4942a] text-[11px] uppercase tracking-[0.12em] font-semibold">Type the Korean word using the keyboard</span>
                <p
                  data-task-editor-item="english-cue"
                  className="mt-1 text-sm text-white/60"
                >
                  {capitaliseStandalone(activeFoodCue)}
                </p>
                <div data-task-editor-item="hangul-cue" onClick={() => speakKorean(activeFoodTarget)} className="my-2 flex cursor-pointer gap-0.5 text-2xl font-semibold tracking-[0.2em]">
                  <LiveAnswerLetters
                    target={activeFoodTarget}
                    value={foodUsesRomanisation ? "" : foodInput}
                    neutralClassName="text-white/45"
                  />
                  <button type="button" onClick={() => speakKorean(activeFoodTarget)} className="ml-2 inline-flex items-center text-[#f6d46b] hover:text-white" aria-label={`Hear ${activeFoodTarget}`}>
                    <Volume2 size={19} />
                  </button>
                </div>
                {shoppingRomanisationEnabled && <p data-task-editor-item="romanisation-cue" className="mb-2 text-sm"><LiveAnswerLetters target={capitaliseStandalone(activeFoodRomanisation)} value={foodUsesRomanisation ? foodInput : ""} neutralClassName="text-[#f6d46b]" /></p>}
                <form data-task-editor-item="answer-form" onSubmit={submitFoodWord} className="flex gap-2">
                  <input
                    autoFocus
                    value={foodInput}
                    onChange={(e) => setFoodInput(e.target.value)}
                    placeholder="Type the Korean word..."
                    className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                  />
                  <button className="rounded-lg border border-white/20 bg-white/10 px-4 text-xs text-white">
                    Enter
                  </button>
                </form>
                {foodWrong && (
                  <p data-task-editor-item="error-message" className="mt-2 text-xs text-red-400">
                    Not quite — try again.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {phase === "detail-word" && (
          <>
            <div
              data-task-editor-panel="shopping-centre-item-task"
              className="shop-task-frame absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="shop-task-box shared-task-bar-ui rounded-2xl border border-white/10 px-4 pb-3 pt-3"
                style={{ background: "rgba(0,0,0,0.92)" }}
              >
                <span data-task-editor-item="instruction" className="text-[#c4942a] text-[9px] uppercase tracking-[0.12em] font-semibold">
                  Pick which one is right, then type it
                </span>
                <div className="my-2 flex flex-wrap gap-2">
                  {shuffledFoodChoices.map((choice) => (
                    <button
                      data-task-editor-item={`choice-${choice.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                      type="button"
                      key={choice}
                      onClick={() => speakKorean(shoppingChoiceKorean(choice))}
                      className="inline-flex min-w-24 flex-col items-center rounded-2xl border border-white/20 px-3 py-2 text-lg text-white/80 hover:border-[#f6d46b] hover:text-[#f6d46b]"
                    >
                      <span className="inline-flex items-center"><LiveAnswerLetters target={shoppingChoiceKorean(choice)} value="" neutralClassName="text-white/80" /><Volume2 className="ml-1" size={13} /></span>
                      {shoppingRomanisationEnabled && <small className="mt-1 text-[10px] font-semibold text-[#f6d46b]"><LiveAnswerLetters target={SHOPPING_CHOICE_ROMANISATION[choice]} value="" neutralClassName="text-[#f6d46b]" /></small>}
                      <small className="mt-1 text-xs font-medium text-white/55">{choice}</small>
                    </button>
                  ))}
                </div>
                <form data-task-editor-item="answer-form" onSubmit={submitDetailWord} className="flex gap-2">
                  <input
                    autoFocus
                    value={foodInput}
                    onChange={(e) => setFoodInput(e.target.value)}
                    placeholder="Type the Korean word..."
                    className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                  />
                  <button className="rounded-lg border border-white/20 bg-white/10 px-4 text-xs text-white">
                    Enter
                  </button>
                </form>
                {foodWrong && (
                  <p data-task-editor-item="error-message" className="mt-2 text-xs text-red-400">
                    Not quite — type the whole item.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {phase === "checkout" && (
          <div className="story-dialogue-panel absolute z-10">
            <div className="story-dialogue-content">
              <div className="scene-eyebrow"><span className="cop-narrator-dot" />Narrator</div>
              <p className="story-dialogue-text">{SHOPPING_ROSE_NARRATION}</p>
              <div className="cop-narration-footer">
                <span>click anywhere to continue</span>
                <button type="button" onClick={(event) => { event.stopPropagation(); speak(SHOPPING_ROSE_NARRATION, "adventure"); }}><Volume2 size={12} /> Listen</button>
              </div>
            </div>
          </div>
        )}

        {phase === "payment" && (
          <div
            data-task-editor-panel="shopping-centre-payment-task"
            className="shop-task-frame absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="shop-task-box shared-task-bar-ui rounded-2xl border border-white/10 px-4 pb-3 pt-3"
            >
              <button data-task-editor-item="close" type="button" className="task-close" onClick={() => { setPaymentInput(""); setPaymentWrong(false); }}>×</button>
              <span data-task-editor-item="instruction" className="text-[#c4942a] text-[11px] uppercase tracking-[0.12em] font-semibold">
                Type the Korean word using the keyboard
              </span>
              <p data-task-editor-item="english-cue" className="mt-1 text-sm text-white/60">Pay</p>
              <div data-task-editor-item="hangul-cue" className="my-2 flex items-center gap-0.5 text-2xl font-semibold tracking-[0.2em]">
                <LiveAnswerLetters target={SHOPPING_PAY_TARGET} value={shoppingRomanisationEnabled && /[a-z]/i.test(paymentInput) ? "" : paymentInput} neutralClassName="text-white/45" />
                <button type="button" onClick={() => speakKorean(SHOPPING_PAY_TARGET)} className="ml-2 inline-flex text-[#f6d46b] hover:text-white" aria-label={`Hear ${SHOPPING_PAY_TARGET}`}><Volume2 size={19} /></button>
              </div>
              {shoppingRomanisationEnabled && <p data-task-editor-item="romanisation-cue" className="mb-2 text-sm"><LiveAnswerLetters target={SHOPPING_PAY_ROMANISATION} value={/[a-z]/i.test(paymentInput) ? paymentInput : ""} neutralClassName="text-[#f6d46b]" /></p>}
              <form data-task-editor-item="answer-form" onSubmit={submitPayment} className="flex gap-2">
                <input
                  autoFocus
                  value={paymentInput}
                  onChange={(e) => setPaymentInput(e.target.value)}
                  placeholder="Type the Korean word..."
                  className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                />
                <button className="rounded-lg border border-white/20 bg-white/10 px-4 text-xs text-white">
                  Enter
                </button>
              </form>
              {paymentWrong && (
                <p data-task-editor-item="error-message" className="mt-2 text-xs text-red-400">
                  Not quite — try again.
                </p>
              )}
            </div>
          </div>
        )}
        {phase === "paid" && (
          <div className="story-dialogue-panel absolute z-10">
            <div className="story-dialogue-content">
              <div className="scene-eyebrow"><span className="cop-narrator-dot" />Narrator</div>
              <p className="story-dialogue-text">{SHOPPING_PAID_NARRATION}</p>
              <div className="cop-narration-footer">
                <span>click anywhere to return to the map</span>
                <button type="button" onClick={(event) => { event.stopPropagation(); speak(SHOPPING_PAID_NARRATION, "adventure"); }}><Volume2 size={12} /> Listen</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: (typeof navItems)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const { isChinese } = useLanguage();
  return (
    <button
      className={`nav-item nav-item-${item.id} ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <Icon size={18} />
      <span>
        <strong>{isChinese ? item.labelZh : item.label}</strong>
        <small>{isChinese ? item.noteZh : item.note}</small>
      </span>
      <span className="nav-arrow">→</span>
    </button>
  );
}
