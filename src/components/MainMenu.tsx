import { useEffect, useState, useRef } from "react";
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
} from "lucide-react";
import { useSave } from "../hooks/useSave";
import { useDebugOverlay } from "../hooks/useDebugOverlay";
import { useSpeech } from "../hooks/useSpeech";
import { useLanguage } from "../i18n";
import DebugOverlayPanel from "./DebugOverlayPanel";
import BackyardAdventure from "./BackyardAdventure";
import {
  BusTicketAdventure,
  CopAdventure,
  HomeAdventure,
  SportsDayAdventure,
} from "./ElderwoodAdventures";
import { MaskedManAdventure } from "./MaskedManAdventure";
import { isSkipAnswer, levenshtein, stripAccents } from "../utils/levenshtein";
import { assetUrl } from "../utils/assetUrl";
import type { GamePhase } from "../types";

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
  | "soccer-match"
  | "masked-man"
  | "adventure"
  | "revision"
  | "multiplayer"
  | "settings";

interface MainMenuProps {
  onNewGame: () => void;
  onStartTammy: () => void;
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
    label: "World map",
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
    label: "Revision & achievements",
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
const ROAM_VIDEOS = [
  assetUrl("videos/woodstock-roam.mp4"),
  "https://res.cloudinary.com/tjjlhlpp/video/upload/Video_Project_13_1.mp4",
];

function useMenuMusic(section: HubSection, muted: boolean) {
  useEffect(() => {
    const source =
      section === "home"
        ? assetUrl("music/crystal-menu-drift.mp3")
        : section === "world"
          ? assetUrl("music/pumpkin-hop-world-map.mp3")
          : null;
    if (!source) return;
    const audio = new Audio(source);
    audio.loop = true;
    audio.volume = muted ? 0 : 0.32;
    const play = () => {
      audio.play().catch(() => {
        /* Browsers wait for the player's first interaction. */
      });
    };
    play();
    window.addEventListener("pointerdown", play, { once: true });
    return () => {
      window.removeEventListener("pointerdown", play);
      audio.pause();
      audio.currentTime = 0;
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

// Images used after leaving the menu. Fetch them while the player is choosing
// where to go, so scene changes never reveal an empty background while loading.
const WORLD_PRELOAD_IMAGES = [
  WORLD_MAP_IMG,
  WORLD_MAP_DAY_IMG,
  WORLD_MAP_SUNSET_IMG,
  WORLD_MAP_NIGHT_IMG,
  TOWN_CENTRE_MAP_IMG,
  assetUrl("maps/north-america-roam-map-v2.png"),
  assetUrl("cafe_room.png"),
  assetUrl("Use_AI_Image_Jun_15,_2026,_19_20_35.png"),
  assetUrl("Gemini_Generated_Image_a625ema625ema625.png"),
  assetUrl("ChatGPT_Image_Jun_14,_2026,_05_36_59_PM.png"),
  assetUrl("man_in_g.png"),
  assetUrl("man_in_g_on_floor.png"),
  assetUrl("a1.png"),
  assetUrl("a2.png"),
  assetUrl("a3.png"),
  assetUrl("a4.png"),
  assetUrl("scenes/bella/a5.png"),
  assetUrl("scenes/bella/a6.png"),
  assetUrl("scenes/bella/b1-woman.png"),
  assetUrl("scenes/bella/b2.png"),
  assetUrl("scenes/bella/b3-no-cyclists.png"),
  assetUrl("scenes/bella/b4-no-cyclists.png"),
  assetUrl("scenes/bella/b5-no-cyclists.png"),
  assetUrl("scenes/bella/b6 copy.png"),
  assetUrl("scenes/shop/c1.png"),
  assetUrl("scenes/shop/c2.png"),
  assetUrl("scenes/shop/c3.png"),
  assetUrl("scenes/shop/c4.png"),
  assetUrl("scenes/shop/c5.png"),
  assetUrl("scenes/shop/c1-v3.png"),
  assetUrl("scenes/shop/c2-v2.png"),
  assetUrl("scenes/shop/c7.png"),
  assetUrl("scenes/shop/c8.png"),
  assetUrl("scenes/bus/d1.png"),
  assetUrl("scenes/bus/d2.png"),
  assetUrl("scenes/bus/d3.png"),
  assetUrl("scenes/bus/d4.png"),
  assetUrl("scenes/home/e1-enhanced.png"),
  assetUrl("scenes/home/e2-enhanced.png"),
  assetUrl("scenes/home/e3-enhanced.png"),
  assetUrl("scenes/home/e4-enhanced.png"),
  assetUrl("scenes/home/e5-enhanced.png"),
  assetUrl("scenes/garden/f1.png"),
  assetUrl("scenes/garden/f2.png"),
  assetUrl("scenes/garden/f3.png"),
  assetUrl("scenes/garden/f4.png"),
];

function preloadImage(source: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    const timeout = window.setTimeout(resolve, 6000);
    const finish = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    image.onload = async () => {
      try {
        await image.decode();
      } catch {
        /* The image can still be painted. */
      }
      finish();
    };
    // A missing optional asset must not leave the app on its loading screen.
    image.onerror = finish;
    image.src = source;
  });
}

// Keep the previous scene visible while the next image decodes. This prevents
// the black/blank flash that occurs when a large scene image is swapped.
function SceneBackground({ source, alt }: { source: string; alt: string }) {
  const [visibleSource, setVisibleSource] = useState(source);
  const [, setLoading] = useState(false);
  useEffect(() => {
    if (source === visibleSource) return;
    let active = true;
    setLoading(true);
    const image = new Image();
    const reveal = async () => {
      try {
        await image.decode();
      } catch {
        /* paintable even if decode is unavailable */
      }
      if (active) {
        setVisibleSource(source);
        setLoading(false);
      }
    };
    image.onload = reveal;
    image.onerror = reveal;
    image.src = source;
    return () => {
      active = false;
    };
  }, [source, visibleSource]);
  return (
    <img
      src={visibleSource}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover"
      draggable={false}
    />
  );
}

const revisionWords = [
  { italian: "ice cream", english: "冰淇淋" },
  { italian: "hello", english: "你好" },
  { italian: "thank you", english: "谢谢" },
  { italian: "window", english: "窗户" },
  { italian: "key", english: "钥匙" },
  { italian: "coffee", english: "咖啡" },
];

export default function MainMenu({
  onNewGame,
  onStartTammy,
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
  // Home wallpapers are decoded by the app-wide startup preloader, so the
  // menu can appear immediately without showing a second loading screen.
  const [isMenuReady, setIsMenuReady] = useState(true);
  const [worldAssetsReady, setWorldAssetsReady] = useState(false);
  const [isWorldLoading, setIsWorldLoading] = useState(false);
  const { hasSave, selectSlot, getActiveSlot, listSlots } = useSave();
  const [saveExists, setSaveExists] = useState(false);
  const [activeSaveSlot, setActiveSaveSlot] = useState(() => getActiveSlot());
  const [worldReady, setWorldReady] = useState(false);
  const [section, setSection] = useState<HubSection>(initialSection);
  const [soundMuted, setSoundMuted] = useState(false);
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
  const [revisionIndex, setRevisionIndex] = useState(0);
  const [revisionInput, setRevisionInput] = useState("");
  const [revisionResult, setRevisionResult] = useState<
    "correct" | "wrong" | null
  >(null);
  const [playerScore, setPlayerScore] = useState(0);
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
  const worldMapComplete = [
    bellaMemoryComplete,
    shopMemoryComplete,
    marketCompleted,
    busComplete,
    homeComplete,
    copComplete,
    soccerComplete,
  ].filter(Boolean).length;
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
  const totalProgressSteps = 16 + 7 + adventurePhases.length;
  const completedMilestones =
    roamWords.length + worldMapComplete + adventureComplete;
  const progressPercent = Math.round(
    (completedMilestones / totalProgressSteps) * 100,
  );
  const roamPercent = Math.round((roamWords.length / 16) * 100);
  const worldMapPercent = Math.round((worldMapComplete / 7) * 100);
  const adventurePercent = Math.round(
    (adventureComplete / adventurePhases.length) * 100,
  );

  const switchSaveSlot = (slot: number) => {
    selectSlot(slot);
    setActiveSaveSlot(slot);
    setWorldReady(true);
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
    const play = (event: MouseEvent) => {
      if (soundMuted) return;
      const button = (event.target as Element).closest(".nav-item");
      const previousButton = (event.relatedTarget as Element | null)?.closest?.(
        ".nav-item",
      );
      if (!button || button === lastButton || button === previousButton) return;
      lastButton = button;
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

  useEffect(() => {
    if (!isWorldLoading) return;
    let cancelled = false;
    Promise.all(WORLD_PRELOAD_IMAGES.map(preloadImage)).then(() => {
      if (!cancelled) setWorldAssetsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isWorldLoading]);

  // Keep the selected wallpaper warm in the browser cache after startup.
  useEffect(() => {
    let cancelled = false;
    const startedAt = performance.now();
    const finish = async () => {
      const remainingDelay = Math.max(0, 180 - (performance.now() - startedAt));
      window.setTimeout(() => {
        if (!cancelled) setIsMenuReady(true);
      }, remainingDelay);
    };

    preloadImage(homeBackground).then(finish);

    return () => {
      cancelled = true;
    };
  }, [homeBackground]);

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
            setSection("backyard");
          } else {
            onNewGame();
          }
        } else if (buf.endsWith(".2")) {
          e.preventDefault();
          keyBufferRef.current = "";
          setSection("shop");
        } else if (buf.endsWith(".3")) {
          e.preventDefault();
          keyBufferRef.current = "";
          setSection("market");
        }
      }
    };
    // Use capture mode to intercept events before they reach input elements
    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, { capture: true });
  }, [section, setSection, onNewGame, onStartAudio]);

  const openSection = (next: HubSection) => {
    setSection(next);
  };

  useEffect(() => {
    if (isWorldLoading && worldAssetsReady) {
      setSection("world");
      setIsWorldLoading(false);
    }
  }, [isWorldLoading, worldAssetsReady]);

  if (!isMenuReady) {
    return <MenuLoadingScreen isChinese={isChinese} />;
  }

  if (section === "world")
    return (
      <WorldMapSection
        onMenu={() => {
          setWorldReady(false);
          setSection("home");
        }}
        startMapLoaded={true}
        onOpenMemory={() => setSection("backyard")}
        onOpenShop={() => setSection("shop")}
        onOpenMarket={() => setSection("market")}
        onOpenBus={() => setSection("bus")}
        onOpenHome={() => setSection("family-home")}
        onOpenCop={() => setSection("cop")}
        onOpenSoccer={() => setSection("soccer-match")}
        onSelectSaveSlot={switchSaveSlot}
        activeSaveSlot={activeSaveSlot}
        bellaMemoryComplete={bellaMemoryComplete}
        shopMemoryComplete={shopMemoryComplete}
        busComplete={busComplete}
        homeComplete={homeComplete}
        copComplete={copComplete}
        soccerComplete={soccerComplete}
        soundMuted={soundMuted}
        onToggleSound={() => {
          const next = !soundMuted;
          setSoundMuted(next);
          localStorage.setItem("taletalk-sound-muted", String(next));
        }}
      />
    );
  if (section === "roam")
    return <RoamSection onMenu={() => setSection("home")} />;
  if (section === "backyard")
    return (
      <BackyardAdventure
        onMenu={() => setSection("world")}
        onComplete={() => {
          localStorage.setItem(progressKey("bella-complete"), "true");
          setBellaMemoryComplete(true);
          setSection("world");
        }}
      />
    );
  if (section === "shop")
    return (
      <BellaShopAdventure
        onMenu={() => setSection("world")}
        onComplete={() => {
          localStorage.setItem(progressKey("shop-complete"), "true");
          setShopMemoryComplete(true);
          setSection("world");
        }}
      />
    );
  if (section === "market")
    return (
      <ShopTripAdventure
        onMenu={() => setSection("world")}
        onComplete={() => {
          localStorage.setItem(progressKey("market-complete"), "true");
          setSection("world");
        }}
      />
    );
  if (section === "bus")
    return (
      <BusTicketAdventure
        onBack={() => setSection("world")}
        onBusComplete={() => {
          localStorage.setItem(progressKey("bus-complete"), "true");
          setBusComplete(true);
          setSection("world");
        }}
      />
    );
  if (section === "family-home")
    return (
      <HomeAdventure
        onBack={() => setSection("world")}
        onHomeComplete={() => {
          localStorage.setItem(progressKey("home-complete"), "true");
          setHomeComplete(true);
          setSection("world");
        }}
      />
    );
  if (section === "cop")
    return (
      <CopAdventure
        onBack={() => setSection("world")}
        onComplete={() => {
          localStorage.setItem(progressKey("cop-complete"), "true");
          setCopComplete(true);
          setSection("world");
        }}
      />
    );
  if (section === "soccer-match")
    return (
      <SportsDayAdventure
        onBack={() => setSection("world")}
        onComplete={() => {
          localStorage.setItem(progressKey("soccer-complete"), "true");
          setSoccerComplete(true);
          setSection("world");
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
      <div
        className="home-image"
        style={{ backgroundImage: `url('${homeBackground}')` }}
      />
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
                  {roamWords.length}/16 · {roamPercent}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>World Map</span>
                <span>
                  {worldMapComplete}/7 · {worldMapPercent}%
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
                <span>{worldMapComplete}/6 unlocked</span>
              </div>
              <div className="flex justify-between">
                <span>Words collected</span>
                <span>{roamWords.length}/16</span>
              </div>
              <div className="flex justify-between">
                <span>Daily words</span>
                <span>{dailyWords}/{dailyGoal}</span>
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
            setSoundMuted(next);
            localStorage.setItem("taletalk-sound-muted", String(next));
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
                Chinese Bridge
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
            setWorldReady(false);
            setSection("home");
          }}
          startMapLoaded={true}
          onOpenMemory={() => setSection("backyard")}
          onOpenShop={() => setSection("shop")}
          onOpenMarket={() => setSection("market")}
          onOpenBus={() => setSection("bus")}
          onOpenHome={() => setSection("family-home")}
          onOpenCop={() => setSection("cop")}
          onOpenSoccer={() => setSection("soccer-match")}
          onSelectSaveSlot={switchSaveSlot}
          activeSaveSlot={activeSaveSlot}
          bellaMemoryComplete={bellaMemoryComplete}
          shopMemoryComplete={shopMemoryComplete}
          busComplete={busComplete}
          homeComplete={homeComplete}
          copComplete={copComplete}
          soccerComplete={soccerComplete}
          soundMuted={soundMuted}
          onToggleSound={() => {
            const next = !soundMuted;
            setSoundMuted(next);
            localStorage.setItem("taletalk-sound-muted", String(next));
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
    return (
      <section className="section-stack">
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
          className="adventure-card active-card"
          onClick={() => {
            onNewGame();
          }}
        >
          <div
            className="adventure-art"
            style={{
              backgroundImage: `url('${assetUrl("cafe_room.png")}')`,
            }}
          />
          <div className="adventure-copy">
            <div className="card-label">
              {isChinese ? "第一章 · 佛罗伦萨" : "Chapter I · Florence"}
            </div>
            <h2>{isChinese ? "谁是猎物？" : "The Man Who Is Prey?"}</h2>
            <p>
              {isChinese
                ? "一个男人，被锁在房间里，困在牢笼中？但真正的猎物是谁？"
                : "You wake in a Florentine café, tied up beside a dead stranger. You remember nothing. But who is really the prey?"}
            </p>
            <div className="card-cta">
              {isChinese ? "开始冒险" : "Begin adventure"} <span>→</span>
            </div>
          </div>
        </div>
        <div
          className="adventure-card active-card"
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
    const word = revisionWords[revisionIndex];
    const [mode, setMode] = useState<"normal" | "easy" | "hard">("normal");
    const letters = [...word.italian];
    const letterIndexes = letters.map((letter, index) => letter === " " ? -1 : index).filter(index => index >= 0);
    const normalReveal = new Set([letterIndexes[1], letterIndexes[2], letterIndexes.at(-1)]);
    const easyReveal = new Set([letterIndexes[0], letterIndexes[1], letterIndexes[2], letterIndexes[4], letterIndexes[5], letterIndexes.at(-1)]);
    const revealed = mode === "hard" ? new Set<number>() : mode === "easy" ? easyReveal : normalReveal;
    const hint = letters.map((letter, index) => letter === " " ? " " : revealed.has(index) ? letter : "–").join(" ");
    const submit = (event: React.FormEvent) => {
      event.preventDefault();
      const correct =
        isSkipAnswer(revisionInput) ||
        revisionInput.trim().toLowerCase() === word.italian;
      setRevisionResult(correct ? "correct" : "wrong");
      if (correct)
        setTimeout(() => {
          setRevisionIndex((revisionIndex + 1) % revisionWords.length);
          setRevisionInput("");
          setRevisionResult(null);
        }, 700);
    };
    return (
      <section className="section-stack">
        <SectionHeading
          eyebrow={isChinese ? "巩固记忆" : "Keep your memory sharp"}
          title={isChinese ? "复习" : "Revision"}
          description={
            isChinese
              ? "练习已经学过的英语单词。"
              : "Short practice rounds for the words you have gathered."
          }
        />
        <div className="practice-card">
          <div className="practice-top">
            <span>{isChinese ? "单词冲刺" : "Word sprint"}</span>
            <span>
              {revisionIndex + 1} / {revisionWords.length}
            </span>
          </div>
          <div className="practice-prompt">{word.english}</div>
          <p className="text-2xl tracking-[.2em]">{hint}</p>
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" className={`rounded-lg px-3 py-2 text-xs ${mode === "easy" ? "bg-emerald-400 text-slate-900" : "bg-white/10"}`} onClick={() => setMode("easy")}>Easy mode · 2 more letters</button>
            <button type="button" className={`rounded-lg px-3 py-2 text-xs ${mode === "hard" ? "bg-amber-300 text-slate-900" : "bg-white/10"}`} onClick={() => setMode("hard")}>Hard mode · no hint · 120%</button>
            <button type="button" className="rounded-lg bg-white/10 px-3 py-2 text-xs" onClick={() => setSection("backyard")}>Where did this appear?</button>
          </div>
          <p>{isChinese ? "输入英语单词" : "Type the English word"}</p>
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
            {revisionWords.map((_, index) => (
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
  onOpenSoccer: () => void;
  onSelectSaveSlot: (slot: number) => void;
  activeSaveSlot: number;
  bellaMemoryComplete: boolean;
  shopMemoryComplete: boolean;
  busComplete: boolean;
  homeComplete: boolean;
  copComplete: boolean;
  soccerComplete: boolean;
  soundMuted: boolean;
  onToggleSound: () => void;
};

function WorldMapSection({
  onMenu,
  onOpenMemory,
  onOpenShop,
  onOpenMarket,
  onOpenBus,
  onOpenHome,
  onOpenCop,
  onOpenSoccer,
  activeSaveSlot,
  bellaMemoryComplete,
  shopMemoryComplete,
  busComplete,
  homeComplete,
  copComplete: savedCopComplete,
  soccerComplete,
  soundMuted,
  onToggleSound,
}: WorldMapProps) {
  const { isChinese } = useLanguage();
  const soundActionLabel = isChinese
    ? soundMuted ? "声音开" : "声音关"
    : soundMuted ? "Sound on" : "Sound off";
  const [mapPage, setMapPage] = useState<"elderwoods" | "town-centre">(
    "elderwoods",
  );
  const marketComplete =
    localStorage.getItem(`taletalk-slot-${activeSaveSlot}-market-complete`) ===
    "true";
  const progress = [
    bellaMemoryComplete,
    shopMemoryComplete,
    marketComplete,
    busComplete,
    homeComplete,
    savedCopComplete,
    soccerComplete,
  ].filter(Boolean).length;
  // Sports Day now completes Elderwoods. The next map then introduces Mason.
  const copComplete = savedCopComplete || homeComplete;
  const mapTime = marketComplete
    ? "4:16 PM"
    : shopMemoryComplete
      ? "3:45 PM"
      : bellaMemoryComplete
        ? "3:14 PM"
        : "2:12 PM";
  // This intentionally changes only the backdrop; all point coordinates below stay untouched.
  const elderwoodsMapImage = soccerComplete
    ? WORLD_MAP_NIGHT_IMG
    : homeComplete
      ? WORLD_MAP_SUNSET_IMG
      : shopMemoryComplete
        ? WORLD_MAP_DAY_IMG
        : WORLD_MAP_IMG;
  const point = (
    label: string,
    position: React.CSSProperties,
    onClick: () => void,
    badge: string,
    locked = false,
  ) => {
    if (label === "Detective Mason" && mapPage === "elderwoods") return null;
    const exactBounds: Record<string, React.CSSProperties> = {
      "The Corner House": { left: "33.7%", top: "63.9%", transform: "none" },
    };
    return (
      <>
        <button
          key={`${mapPage}-${label}`}
          className={`map-memory-point ${label === "Bus stop quiz" ? "bus-stop-star" : ""} ${locked ? "opacity-50" : ""}`}
          style={exactBounds[label] ?? position}
          onClick={() =>
            locked ? window.alert("You need a ★ star to continue.") : onClick()
          }
          aria-label={label === "★" ? "Bus stop test" : label}
        >
          <span className="hotspot-pulse" />
          <span className="map-memory-badge">{badge}</span>
          <span className="hotspot-tooltip">
            {locked ? "You need a ★ star to continue." : label === "★" ? "Bus stop test" : label}
          </span>
        </button>
        {label === "Sports Day" && soccerComplete && (
          <button
            className="world-map-page-arrow world-map-page-arrow-gold world-map-page-arrow-west"
            onClick={() => setMapPage("town-centre")}
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
      <div className="world-map-scene">
        <img
          className="world-map-image"
          src={TOWN_CENTRE_MAP_IMG}
          alt="Town centre map"
        />
        <div className="world-map-vignette" />
        <header className="world-map-topbar">
          <div>
            <h1>TaleTalk</h1>
            <span>THE WORLD MAP · CHAPTER II</span>
            <small className="world-map-time">8:39 PM</small>
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
        <button
          className="world-map-page-arrow world-map-page-arrow-west"
          onClick={() => setMapPage("elderwoods")}
          aria-label="Return to Elderwoods"
        >
          <ChevronRight />
        </button>
        {point(
          "Detective Mason",
          position(48.5, 65.5),
          onOpenCop,
          savedCopComplete ? "4/4" : "0/4",
        )}
        <footer className="world-map-footer">
          <span>{progress} / 7 story milestones unlocked</span>
        </footer>
      </div>
    );
  return (
    <div className="world-map-scene">
      <img
        className="world-map-image"
        src={elderwoodsMapImage}
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
      {!shopMemoryComplete && (
        <div className="world-map-intro world-map-intro-sm">
          <div className="eyebrow">Chapter I · Elderwoods</div>
          <h2>Welcome to Elderwoods</h2>
          <p>Explore, learn new words, and open each story in order.</p>
        </div>
      )}
      {point(
        "Scene one",
        position(41.9, 56.8),
        onOpenMemory,
        bellaMemoryComplete ? "2/2" : "0/2",
      )}
      {bellaMemoryComplete &&
        point(
          "Ice cream shop",
          position(42, 42.8),
          onOpenShop,
          shopMemoryComplete ? "4/4" : "0/4",
        )}
      {shopMemoryComplete &&
        point(
          "Shopping centre",
          position(72.4, 57.7),
          onOpenMarket,
          marketComplete ? "4/4" : "0/4",
        )}
      {marketComplete &&
        point(
          "Bus stop quiz",
          position(44.4, 25.5),
          onOpenBus,
          "\u2605",
        )}
      {shopMemoryComplete &&
        point(
          "The Corner House",
          { left: "41.7%", top: "34.3%" },
          onOpenHome,
          homeComplete ? "4/4" : "0/4",
          !busComplete,
        )}
      {homeComplete &&
        point(
          "Detective Mason",
          position(46.1, 29.6),
          onOpenCop,
          copComplete ? "4/4" : "0/4",
        )}
      {copComplete &&
        point(
          "Sports Day",
          position(60.1, 82.6),
          onOpenSoccer,
          soccerComplete ? "4/4" : "0/4",
        )}
      <footer className="world-map-footer">
        <span>{progress} / 7 story milestones unlocked</span>
      </footer>
    </div>
  );
  return (
    <div className="world-map-scene">
      <img
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
        "Scene one",
        position(41.9, 56.8),
        onOpenMemory,
        bellaMemoryComplete ? "2/2" : "0/2",
        marketComplete && !busComplete,
      )}
      {bellaMemoryComplete &&
        point(
          "Ice cream shop",
          position(42, 42.8),
          onOpenShop,
          shopMemoryComplete ? "complete" : "1/4",
        )}
      {shopMemoryComplete &&
        !marketComplete &&
        point("Shopping centre", position(70.9, 54.5), onOpenMarket, "0/4")}
      {point(
        "Bus stop quiz",
        { left: "46.3%", top: "38.6%" },
        onOpenBus,
        "\u2605",
      )}
      {busComplete &&
        point(
          "The Corner House",
          { left: "41.7%", top: "34.3%" },
          onOpenHome,
          homeComplete ? "done" : "new",
        )}
      {homeComplete &&
        point(
          "Sports Day",
          { left: "50.6%", top: "33.4%" },
          onOpenSoccer,
          soccerComplete ? "done" : "new",
        )}
      <footer className="world-map-footer">
        <span>{progress} / 4 story milestones unlocked</span>
      </footer>
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
      <img
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
          <span className="hotspot-tooltip">
            {isChinese ? "第一段记忆" : "The first memory"}
          </span>
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
            <span className="hotspot-tooltip">
              {isChinese ? "冰淇淋记忆" : "The ice cream memory"}
            </span>
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
          <span className="hotspot-tooltip">The Corner House</span>
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
            <span className="hotspot-tooltip">
              {isChinese ? "去商店的旅行" : "A trip to the shop"}
            </span>
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
    italianLabel: "One ice cream please",
    englishLabel: "一个冰淇淋，谢谢",
    prompt: "one ice cream please",
    correct: true,
    responseIt: "",
    responseEn: "",
    wordTooltips: [{ word: "One ice cream please", translation: "一个冰淇淋，谢谢" }],
  },
  {
    id: "pizza",
    italianLabel: "One pizza please",
    englishLabel: "我想要一个披萨，谢谢。",
    prompt: "one pizza please",
    correct: false,
    responseIt: "We do not have pizza.",
    responseEn: "我们没有披萨。",
    wordTooltips: [
      { word: "one pizza", translation: "一份披萨" },
      { word: "please", translation: "请" },
    ],
  },
  {
    id: "acqua",
    italianLabel: "One water please",
    englishLabel: "我想要一些水，谢谢。",
    prompt: "one water please",
    correct: false,
    responseIt: "Questa è una gelateria!",
    responseEn: "This is an ice cream shop!",
    wordTooltips: [
      { word: "one water", translation: "一瓶水" },
      { word: "please", translation: "请" },
    ],
  },
];

const GRAZIE_WORDS: ShopWordTooltip[] = [
  { word: "Thank you", translation: "谢谢" },
];
const PREGO_WORDS: ShopWordTooltip[] = [
  { word: "You are welcome", translation: "不客气" },
];

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
    (choice) => stripAccents(choice.prompt) === normalized,
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

function BellaShopAdventure({
  onMenu,
  onComplete,
}: {
  onMenu: () => void;
  onComplete: () => void;
}) {
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
  const recordDailyWords = (words: string[]) => {
    const slot = Number(localStorage.getItem("taletalk_active_save_slot") ?? "1");
    const day = new Date().toISOString().slice(0, 10);
    const seenKey = `taletalk-slot-${slot}-daily-word-list-${day}`;
    const seen = new Set<string>(JSON.parse(localStorage.getItem(seenKey) ?? "[]"));
    const before = seen.size;
    words.forEach((word) => seen.add(word.toLowerCase()));
    if (seen.size === before) return;
    localStorage.setItem(seenKey, JSON.stringify([...seen]));
    localStorage.setItem(`taletalk-slot-${slot}-daily-words-${day}`, String(seen.size));
    const goal = Number(localStorage.getItem(`taletalk-slot-${slot}-daily-word-goal`) ?? 5);
    const completeKey = `taletalk-slot-${slot}-daily-goal-completed-${day}`;
    if (seen.size >= goal && localStorage.getItem(completeKey) !== "true") {
      localStorage.setItem(completeKey, "true");
      const lastDayKey = `taletalk-slot-${slot}-daily-word-last-complete`;
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const nextStreak = localStorage.getItem(lastDayKey) === yesterday
        ? Number(localStorage.getItem(`taletalk-slot-${slot}-daily-word-streak`) ?? 0) + 1
        : 1;
      localStorage.setItem(`taletalk-slot-${slot}-daily-word-streak`, String(nextStreak));
      localStorage.setItem(lastDayKey, day);
    }
  };
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
  const { isChinese } = useLanguage();
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
    const lines: Partial<Record<ShopPhase, { en: string; zh: string }>> = {
      intro: {
        en: "At long last he makes it to the ice cream shop. Bella is bursting with excitement.",
        zh: "终于，他来到了冰淇淋店。贝拉兴奋极了。",
      },
      "bella-excited": { en: "Delicious!", zh: "Delicious!" },
      counter: {
        en: "He then moves up to the counter to order.",
        zh: "随后，他走到柜台前点单。",
      },
      ending: {
        en: "Bella is happy. He made her day.",
        zh: "贝拉很开心。他让她度过了快乐的一天。",
      },
      "phone-call": {
        en: "And just at that moment he gets a call from his wonderful wife.",
        zh: "就在这时，他接到了妻子的电话。",
      },
      "wife-angry": { en: "!!!!!", zh: "!!!!!" },
      "wife-warning": {
        en: "His wife reminds him that he has not helped with the shopping he promised to do. She tells him: either come home with the shopping done, or do not come home at all! She also reminds him that she loves him.",
        zh: "妻子提醒他：他还没有完成答应帮忙买的东西。她告诉他，要么买完东西回家，要么就别回家！她也提醒他，她爱他。",
      },
      "wife-hangup": { en: "And she hangs up.", zh: "然后，她挂断了电话。" },
    };
    // Keep Chinese narration as real Unicode text. The older imported strings
    // were mojibake, which made some Chinese narrator beats silent.
    const chineseNarration: Partial<Record<ShopPhase, string>> = {
      intro: "终于，他来到了冰淇淋店。贝拉兴奋极了。",
      counter: "随后，他走到柜台前点单。",
      ending: "贝拉很开心。他让她度过了快乐的一天。",
      "phone-call": "就在这时，他接到了妻子的电话。",
      "wife-angry": "!!!!!",
      "wife-warning":
        "妻子提醒他：他还没有完成答应帮忙买的东西。她告诉他，要么买完东西回家，要么就别回家！她也提醒他，她爱他。",
      "wife-hangup": "然后，她挂断了电话。",
    };
    const line = lines[currentPhase];
    const cleanChineseNarration: Partial<Record<ShopPhase, string>> = {
      intro:
        "\u7ec8\u4e8e\uff0c\u4ed6\u6765\u5230\u4e86\u51b0\u6dc7\u6dcb\u5e97\u3002\u8d1d\u62c9\u5174\u594b\u6781\u4e86\u3002",
      counter:
        "\u968f\u540e\uff0c\u4ed6\u8d70\u5230\u67dc\u53f0\u524d\u70b9\u5355\u3002",
      ending:
        "\u8d1d\u62c9\u5f88\u5f00\u5fc3\u3002\u4ed6\u8ba9\u5979\u5ea6\u8fc7\u4e86\u5feb\u4e50\u7684\u4e00\u5929\u3002",
      "phone-call":
        "\u5c31\u5728\u8fd9\u65f6\uff0c\u4ed6\u63a5\u5230\u4e86\u59bb\u5b50\u7684\u7535\u8bdd\u3002",
      "wife-angry": "!!!!!",
      "wife-warning":
        "\u59bb\u5b50\u63d0\u9192\u4ed6\uff1a\u4ed6\u8fd8\u6ca1\u6709\u5b8c\u6210\u7b54\u5e94\u5e2e\u5fd9\u4e70\u7684\u4e1c\u897f\u3002\u5979\u544a\u8bc9\u4ed6\uff0c\u8981\u4e48\u4e70\u5b8c\u4e1c\u897f\u56de\u5bb6\uff0c\u8981\u4e48\u5c31\u522b\u56de\u5bb6\uff01\u5979\u4e5f\u63d0\u9192\u4ed6\uff0c\u5979\u7231\u4ed6\u3002",
      "wife-hangup":
        "\u7136\u540e\uff0c\u5979\u6302\u65ad\u4e86\u7535\u8bdd\u3002",
    };
    const characterDialogue = currentPhase === "bella-excited";
    return line
      ? characterDialogue
        ? line.en
        : isChinese
          ? (cleanChineseNarration[currentPhase] ?? line.zh)
          : line.en
      : "";
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
    if (phase === "grazie") speak(isChinese ? "谢谢！" : "Thank you!", "bella");
    else if (phase === "prego")
      speak(isChinese ? "不客气！" : "You are welcome!", "shopkeeper");
    else {
      const dialogue = sceneDialogue(phase);
      if (dialogue)
        speak(
          dialogue,
          phase === "bella-excited"
            ? "bella"
            : phase === "wife-angry"
              ? "wife"
              : "josh",
        );
    }
  }, [phase, isChinese, speak]);

  const images = [
    "scenes/bella/b1-woman-no-boards-v2.png",
    "scenes/bella/b2-no-boards-v2.png",
    "scenes/bella/b3-no-boards-v2.png",
    "scenes/bella/b4-no-boards-v2.png",
    "scenes/bella/b5-no-boards-v2.png",
    "scenes/bella/b6-no-boards-v2.png",
  ].map(assetUrl);
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
    const flatString = choice.wordTooltips
      .map((w) => stripAccents(w.word.toLowerCase()))
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
    const wordStates = choice.wordTooltips.map((w) => {
      const word = stripAccents(w.word.toLowerCase());
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
        setPhase("order-speaking");
        speak(isChinese ? match.englishLabel : match.prompt, "male", () =>
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
    const flatString = words
      .map((w) => stripAccents(w.word.toLowerCase()))
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
      const word = stripAccents(w.word.toLowerCase());
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
    if (
      isSkipAnswer(grazieInput) ||
      stripAccents(grazieInput.toLowerCase().trim()) === "thank you"
    ) {
      setGrazieDone(true);
      setShopUnlockedWords((prev) => {
        const existing = new Set(prev.map((w) => w.word));
        return [...prev, ...GRAZIE_WORDS.filter((w) => !existing.has(w.word))];
      });
      speak("Thank you", "bella");
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
    if (
      isSkipAnswer(pregoInput) ||
      stripAccents(pregoInput.toLowerCase().trim()) === "you are welcome"
    ) {
      setPregoDone(true);
      setShopUnlockedWords((prev) => {
        const existing = new Set(prev.map((w) => w.word));
        return [...prev, ...PREGO_WORDS.filter((w) => !existing.has(w.word))];
      });
      speak("You are welcome", "shopkeeper");
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
  const speakerName = isChinese
    ? phase === "bella-excited"
      ? "贝拉"
      : phase === "wife-angry"
        ? "妻子"
        : "旁白"
    : phase === "bella-excited"
      ? "Bella"
      : phase === "wife-angry"
        ? "Wife"
        : "Narrator";
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
              {isChinese ? "英语冒险" : "English Adventure"}
            </h1>
            <span className="text-white/70 text-[10px] uppercase tracking-[0.2em]">
              {isChinese ? "冰淇淋店" : "The ice cream shop"}
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

        {shopUnlockedWords.length > 0 && (
          <div
            className="absolute left-4 top-28 z-30"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShopWordLibraryOpen((open) => !open)}
              className="rounded-xl border border-[#c4942a]/50 bg-black/75 px-3 py-2 text-left text-white shadow-xl backdrop-blur-sm transition hover:bg-black/90"
            >
              <span className="mt-1 block text-[9px] uppercase tracking-wider text-white/60">
                {isChinese ? "词汇" : "Words"}
              </span>
            </button>
            {shopWordLibraryOpen && (
              <div className="mt-2 w-52 rounded-xl border border-white/15 bg-black/90 p-3 shadow-2xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#c4942a]">
                    {isChinese ? "词汇表" : "Vocabulary"}
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
                        <span className="text-sm text-white">{word.word}</span>
                        <span className="text-[10px] text-white/45">
                          {word.translation}
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
                {shopPracticeWord.word}
              </h2>
              <p className="mb-4 text-sm text-white/55">
                {shopPracticeWord.translation}
              </p>
              {shopPracticeCorrect ? (
                <p className="mb-4 text-sm text-green-400">
                  Correct. The word is yours.
                </p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setShopPracticeCorrect(
                      stripAccents(shopPracticeInput.trim().toLowerCase()) ===
                        stripAccents(shopPracticeWord.word.toLowerCase()),
                    );
                  }}
                  className="flex gap-2"
                >
                  <input
                    autoFocus
                    value={shopPracticeInput}
                    onChange={(e) => setShopPracticeInput(e.target.value)}
                    placeholder={
                      isChinese ? "输入英语单词" : "type the English word"
                    }
                    className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/60"
                  />
                  <button className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs uppercase tracking-wider text-white">
                    Check
                  </button>
                </form>
              )}
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
            className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-2xl border border-white/10 px-4 pb-3 pt-3"
              style={{ background: "rgba(0,0,0,0.92)" }}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: isGirl ? "#e8a59c" : "#ccc" }}
                />
                <span
                  className={`text-[11px] uppercase tracking-[0.2em] font-semibold ${isGirl ? "text-[#e8a59c]" : "text-white/60"}`}
                >
                  {speakerName}
                </span>
              </div>
              <p
                className={`text-white ${isGirl ? "text-2xl" : "text-base"} leading-snug`}
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {dialogueText}
              </p>
              {phase === "bella-excited" && (
                <p className="mt-1 text-sm text-white/60">太好吃了！</p>
              )}
              <div className="flex items-center justify-between mt-3">
                {phase === "wife-hangup" ? (
                  <button
                    onClick={() => {
                      cancel();
                      onComplete();
                    }}
                    className="flex items-center gap-1.5 text-white/70 hover:text-white text-[11px] uppercase tracking-wider transition-colors"
                  >
                    {isChinese ? "返回地图" : "Return to map"}{" "}
                    <ArrowRight size={12} />
                  </button>
                ) : phase === "ending" ? (
                  <button
                    onClick={() => advance()}
                    className="flex items-center gap-1.5 text-white/70 hover:text-white text-[11px] uppercase tracking-wider transition-colors"
                  >
                    Continue <ArrowRight size={12} />
                  </button>
                ) : (
                  <span className="text-white/40 text-[11px]">
                    {isChinese
                      ? "点击任意位置继续"
                      : "click anywhere to continue"}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {phase === "order" && (
          <div
            className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative rounded-2xl border border-white/10 px-3 pb-2 pt-2"
              style={{ background: "rgba(0,0,0,0.92)" }}
            >
              <button onClick={() => { cancel(); setPhase("counter"); }} aria-label="Close task" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/10 text-lg text-white/75 hover:bg-white/20">×</button>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-[#c4942a] flex-shrink-0" />
                <span
                  className={`text-[#c4942a] uppercase tracking-[0.12em] font-semibold ${isChinese ? "text-xs" : "text-[9px]"}`}
                >
                  {isChinese
                    ? "店员：你好！请输入你想要的东西："
                    : "Shopkeeper: Hello! Type what you would like:"}
                </span>
              </div>
              <div className="flex flex-col gap-1 mb-2">
                {SHOP_CHOICES.map((c) => {
                  const { wordStates, isFullMatch } = getWordMatchState(c);
                  return (
                    <div
                      key={c.id}
                      className={`px-3 py-1 rounded-lg bg-white/5 border transition-all ${isFullMatch ? "border-green-400/60 bg-green-400/10" : "border-white/15"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${isFullMatch ? "bg-green-400/30 text-green-300" : "bg-white/10 text-white/60"}`}
                        >
                          {SHOP_CHOICES.indexOf(c) + 1}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-xs">
                            {c.wordTooltips.map((wt, wi) => {
                              const ws = wordStates[wi];
                              const letters = wt.word.split("");
                              return (
                                <span key={wi}>
                                  <span className="underline decoration-dotted decoration-white/30 underline-offset-2">
                                    {letters.map((letter, li) => (
                                      <span
                                        key={li}
                                        className={`transition-colors ${ws && li < ws.matchedLetters ? "text-green-400" : "text-white/90"}`}
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
                          <span className="text-xs mt-1">
                            {c.wordTooltips.map((wt, ewi) => (
                              <span
                                key={ewi}
                                className={`transition-colors ${wordStates[ewi]?.isComplete ? "text-green-400" : "text-white/40"}`}
                              >
                                {wt.translation}
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
                onSubmit={handleOrderSubmit}
                className="flex items-center gap-2"
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
                  {isChinese ? "确认" : "Order"}
                </button>
              </form>
              {orderTypingWrong && (
                <div className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
                  <AlertTriangle size={11} /> Not a valid choice — type one of
                  the options above
                </div>
              )}
              {orderWrong && (
                <p className="text-yellow-300 text-xs mt-2">
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
                  {isChinese ? "乔希正在点单…" : "Josh is ordering..."}
                </span>
              </div>
              <p
                className="text-white text-lg leading-snug"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {isChinese
                  ? chosenOrder.englishLabel
                  : chosenOrder.italianLabel}
              </p>
              <p className="text-white/50 text-xs italic mt-1">
                {isChinese
                  ? chosenOrder.italianLabel
                  : chosenOrder.englishLabel}
              </p>
            </div>
          </div>
        )}

        {phase === "grazie" && (
          <div
            className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative rounded-2xl border border-white/10 px-4 pb-3 pt-3"
              style={{ background: "rgba(0,0,0,0.92)" }}
            >
              <button onClick={() => { cancel(); setPhase("counter"); }} aria-label="Close task" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/10 text-lg text-white/75 hover:bg-white/20">×</button>
              {grazieDone ? (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                    <Sparkles size={20} />
                    <span className="text-lg font-bold">
                      {isChinese ? "已解锁新单词！" : "You unlocked the word!"}
                    </span>
                    <Sparkles size={20} />
                  </div>
                  <p className="text-white/60 text-sm">
                    <span className="text-green-400 font-medium">
                      Thank you
                    </span>{" "}
                    = 谢谢
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#e8a59c] flex-shrink-0" />
                    <span className="text-[#e8a59c] text-[9px] uppercase tracking-[0.12em] font-semibold">
                      {isChinese
                        ? "贝拉说——输入她说的话"
                        : "Bella says — type what she says"}
                    </span>
                  </div>
                  <div className="bg-white/5 rounded-lg px-3 py-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white/50 text-[10px]">
                        {isChinese ? "贝拉：" : "Bella:"}
                      </span>
                      {(() => {
                        const ws = getSimpleMatchState(
                          grazieInput,
                          GRAZIE_WORDS,
                        );
                        return GRAZIE_WORDS.map((wt, wi) =>
                          wt.word.split("").map((letter, li) => (
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
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {(() => {
                        const ws = getSimpleMatchState(
                          grazieInput,
                          GRAZIE_WORDS,
                        );
                        return GRAZIE_WORDS.map((wt, ewi) => (
                          <span
                            key={ewi}
                            className={`text-xs transition-colors ${(ws[ewi]?.matchedLetters ?? 0) > 0 ? "text-green-400" : "text-white/40"}`}
                          >
                            {wt.translation}
                          </span>
                        ));
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={grazieInput}
                      onChange={(e) => setGrazieInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleGrazieSubmit();
                      }}
                      className="flex-1 bg-white/5 text-white text-xs outline-none placeholder-white/30 caret-white min-w-0 border-b border-white/20 focus:border-white/60 py-1.5 rounded-lg px-2"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="输入 Bella 说的话…"
                      autoFocus
                    />
                    <button
                      onClick={handleGrazieSubmit}
                      className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-xs px-4 py-2 rounded-lg transition-all uppercase tracking-wider flex-shrink-0"
                    >
                      确认
                    </button>
                  </div>
                  {grazieWrong && (
                    <div className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
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
            className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative rounded-2xl border border-white/10 px-4 pb-3 pt-3"
              style={{ background: "rgba(0,0,0,0.92)" }}
            >
              <button onClick={() => { cancel(); setPhase("counter"); }} aria-label="Close task" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/10 text-lg text-white/75 hover:bg-white/20">×</button>
              {pregoDone ? (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                    <Sparkles size={20} />
                    <span className="text-lg font-bold">
                      {isChinese ? "已解锁新单词！" : "You unlocked the word!"}
                    </span>
                    <Sparkles size={20} />
                  </div>
                  <p className="text-white/60 text-sm">
                    <span className="text-green-400 font-medium">
                      You are welcome
                    </span>{" "}
                    = 不客气
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#c4942a] flex-shrink-0" />
                    <span
                      className={`text-[#c4942a] uppercase tracking-[0.12em] font-semibold ${isChinese ? "text-xs" : "text-[9px]"}`}
                    >
                      {isChinese
                        ? "店员说——输入店员说的话"
                        : "Shopkeeper says — type what they say"}
                    </span>
                  </div>
                  <div className="bg-white/5 rounded-lg px-3 py-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-white/50 ${isChinese ? "text-xs" : "text-[10px]"}`}
                      >
                        {isChinese ? "店员：" : "Shopkeeper:"}
                      </span>
                      {(() => {
                        const ws = getSimpleMatchState(pregoInput, PREGO_WORDS);
                        return PREGO_WORDS.map((wt, wi) =>
                          wt.word.split("").map((letter, li) => (
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
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {(() => {
                        const ws = getSimpleMatchState(pregoInput, PREGO_WORDS);
                        return PREGO_WORDS.map((wt, ewi) => (
                          <span
                            key={ewi}
                            className={`text-xs transition-colors ${(ws[ewi]?.matchedLetters ?? 0) > 0 ? "text-green-400" : "text-white/40"}`}
                          >
                            {wt.translation}
                          </span>
                        ));
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={pregoInput}
                      onChange={(e) => setPregoInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handlePregoSubmit();
                      }}
                      className="flex-1 bg-white/5 text-white text-xs outline-none placeholder-white/30 caret-white min-w-0 border-b border-white/20 focus:border-white/60 py-1.5 rounded-lg px-2"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="输入店主说的话…"
                      autoFocus
                    />
                    <button
                      onClick={handlePregoSubmit}
                      className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-xs px-4 py-2 rounded-lg transition-all uppercase tracking-wider flex-shrink-0"
                    >
                      确认
                    </button>
                  </div>
                  {pregoWrong && (
                    <div className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
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
const ROAM_WORD_TARGET = 16;
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
  const { isChinese } = useLanguage();
  const roamKey = `taletalk-slot-${Number(localStorage.getItem("taletalk_active_save_slot") ?? "1")}-roam-collected-words-v2`;
  const videoRef = useRef<HTMLVideoElement>(null);
  const roamAudioRef = useRef<HTMLAudioElement>(null);
  const [showControls, setShowControls] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoMuted, setVideoMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [toolsEnabled, setToolsEnabled] = useState(true);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [activeWord, setActiveWord] = useState<RoamWordBox | null>(null);
  const [activeWordInput, setActiveWordInput] = useState("");
  const [autoPauseOnWord, setAutoPauseOnWord] = useState(true);
  const [pausedForActiveWord, setPausedForActiveWord] = useState(false);
  const [videoIndex, setVideoIndex] = useState(0);
  const [locationSelected, setLocationSelected] = useState(false);
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

  useEffect(() => {
    localStorage.setItem(roamKey, JSON.stringify(savedWords));
  }, [roamKey, savedWords]);

  useEffect(
    () => () => {
      roamAudioRef.current?.pause();
      roamAudioRef.current = null;
    },
    [],
  );

  useEffect(() => {
    ROAM_REGION_WALLPAPERS.forEach((source) => void preloadImage(source));
  }, []);

  useEffect(() => () => {
    localStorage.setItem("taletalk-roam-region-wallpaper-index", String((regionWallpaperIndex + 1) % ROAM_REGION_WALLPAPERS.length));
  }, [regionWallpaperIndex]);

  const startRoam = () => {
    setVideoMuted(true);
    roamAudioRef.current?.pause();
    const audio = new Audio(assetUrl("audio/woodstock-roam-audio.mp3"));
    audio.preload = "auto";
    audio.volume = 1;
    audio
      .play()
      .then(() => setVideoMuted(false))
      .catch(() => setVideoMuted(true));
    roamAudioRef.current = audio;
    setRoamLoading(true);
    setLocationSelected(true);
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
  const activeRoamRegion = roamRegion ?? "usa";

  const closeActiveWord = () => {
    if (!activeWord) return;
    setDismissedWordIds((ids) =>
      ids.includes(activeWord.id) ? ids : [...ids, activeWord.id],
    );
    setActiveWord(null);
    const video = videoRef.current;
    if (pausedForActiveWord && video?.paused) {
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setVideoMuted(true));
      if (!videoMuted)
        roamAudioRef.current?.play().catch(() => setVideoMuted(true));
    }
    setPausedForActiveWord(false);
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
      if (!videoMuted && audio?.paused) {
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
    v.muted = true;
    v.defaultMuted = true;
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
  }, [locationSelected, videoIndex, videoMuted]);

  if (!locationSelected && !roamRegion) {
    return (
      <div ref={sceneRef} className="roam-location-screen roam-region-picker-screen" style={{ backgroundImage: `url('${ROAM_REGION_WALLPAPERS[regionWallpaperIndex]}')` }} onMouseMove={handleSceneMouseMove}>
        <audio autoPlay loop muted={mapMuted} volume={0.32} src={assetUrl("audio/countryside-roam.mp3")} />
        <header className="roam-location-header">
          <div>
            <p>{isChinese ? "选择目的地" : "Choose a destination"}</p>
            <h1>{isChinese ? "选择你想去旅行的地方" : "Select where you want to travel"}</h1>
          </div>
          <div className="roam-map-top-actions roam-region-picker-actions">
            <button className="world-map-menu" onClick={() => setMapMuted((muted) => !muted)}>{isChinese ? (mapMuted ? "声音开" : "声音关") : (mapMuted ? "Sound on" : "Sound off")}</button>
            <button className="world-map-menu" onClick={onMenu}>{isChinese ? "菜单" : "Menu"}</button>
          </div>
        </header>
        <div className="roam-region-grid">
          {(Object.entries(ROAM_REGIONS) as [RoamRegion, (typeof ROAM_REGIONS)[RoamRegion]][]).map(([key, region]) => (
            <button key={key} className="roam-region-card" onClick={() => setRoamRegion(key)} onMouseEnter={playMapHover}>
              <img src={assetUrl(region.map)} alt={`${region.label} map`} draggable={false} />
              <span>{isChinese ? region.labelZh : region.label}</span>
              <small>{key === "usa" ? (isChinese ? "开始漫游" : "Begin roaming") : (isChinese ? "查看地图" : "View map")}</small>
            </button>
          ))}
        </div>
        <footer className="roam-location-footer">{isChinese ? "选择一个地区查看它的漫游地图。" : "Choose a region to view its Roam map."}</footer>
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
        <audio autoPlay loop muted={mapMuted} volume={0.32} src={assetUrl("audio/countryside-roam.mp3")} />
        <img
          src={assetUrl(ROAM_REGIONS[activeRoamRegion].map)}
          alt={ROAM_REGIONS[activeRoamRegion].title}
          className="roam-location-map"
          draggable={false}
        />
        <video
          aria-hidden="true"
          className="hidden"
          src={ROAM_VIDEOS[0]}
          preload="auto"
          muted
          playsInline
        />
        <div className="roam-location-shade" />
        <header className="roam-location-header">
          <div>
            <p>{isChinese ? "选择目的地" : "Choose a destination"}</p>
            <h1>{isChinese ? ROAM_REGIONS[activeRoamRegion].titleZh : ROAM_REGIONS[activeRoamRegion].title}</h1>
          </div>
          <div className="roam-map-top-actions">
            <button className="world-map-menu" onClick={() => setRoamRegion(null)}>{isChinese ? "选择地区" : "Choose region"}</button>
            <button className="world-map-menu" onClick={() => setMapMuted((muted) => !muted)}>{isChinese ? (mapMuted ? "声音开" : "声音关") : (mapMuted ? "Sound on" : "Sound off")}</button>
          </div>
        </header>
        <button className="world-map-menu roam-choose-region" onClick={onMenu}>{isChinese ? "菜单" : "Menu"}</button>
        <div className="roam-map-summary">
          <span className="roam-map-progress"><b>1/1 地点已解锁</b></span>
          <span className="roam-map-progress">{savedWords.length}/{ROAM_WORD_TARGET} 伍德斯托克单词已解锁</span>
        </div>
        <span className="roam-map-instruction">{isChinese ? "选择一个区域开始本次漫游。" : "Select an area to begin this roam."}</span>
        {activeRoamRegion === "usa" && <button
          className="roam-location-marker roam-location-marker-woodstock"
          onClick={startRoam}
          onMouseEnter={playMapHover}
        >
          <strong>Woodstock, Vermont</strong>
          <small>{isChinese ? "开始漫游" : "Start roaming"}</small>
        </button>}
        {activeRoamRegion === "usa" && <button
          className="roam-location-marker roam-location-marker-woodstock roam-location-marker-account"
          onClick={startRoam}
          onMouseEnter={playMapHover}
        >
          <strong>Woodstock, Vermont</strong>
          <small>
            {savedWords.length}/{ROAM_WORD_TARGET} collected · Start roaming
          </small>
          <em>
            A peaceful historic village surrounded by Vermont’s Green Mountains.
          </em>
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
      className="world-map-scene"
      ref={sceneRef}
      onMouseMove={handleSceneMouseMove}
    >
      <video
        key={videoIndex}
        ref={videoRef}
        className="world-map-image"
        src={ROAM_VIDEOS[videoIndex]}
        autoPlay
        preload="auto"
        muted
        controls={showControls}
        playsInline
        draggable={false}
        onEnded={() => {
          roamAudioRef.current?.pause();
          setVideoIndex((index) => (index + 1) % ROAM_VIDEOS.length);
        }}
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
        src={ROAM_VIDEOS[(videoIndex + 1) % ROAM_VIDEOS.length]}
        preload="auto"
        muted
      />
      <div className="world-map-vignette" />
      <header className="world-map-topbar">
        <div>
          <h1>TaleTalk</h1>
        </div>
        <div className="roam-top-actions">
          <button
            className="roam-tools-btn"
            onClick={() => setSavedWordsOpen((open) => !open)}
          >
            <BookOpen size={14} />{" "}
            {isChinese
              ? `已收集单词 ${savedWords.length}/${ROAM_WORD_TARGET}`
              : `Collected words ${savedWords.length}/${ROAM_WORD_TARGET}`}
          </button>
          <button
            className="roam-tools-btn"
            onClick={() => {
              const v = videoRef.current;
              const audio = roamAudioRef.current;
              if (!v || !audio) return;
              const next = !videoMuted;
              audio.muted = next;
              if (!next) {
                audio.currentTime = v.currentTime;
                audio.volume = 1;
              }
              setVideoMuted(next);
              if (!next) audio.play().catch(() => setVideoMuted(true));
            }}
          >
            {videoMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}{" "}
            {videoMuted
              ? isChinese
                ? "打开声音"
                : "Unmute"
              : isChinese
                ? "静音"
                : "Mute"}
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
          <button className="world-map-menu" onClick={onMenu}>
            {isChinese ? "菜单" : "Menu"}
          </button>
        </div>
      </header>

      {/* Tutorial prompt — shows when mare first appears */}
      {toolsEnabled &&
        !tipDismissed &&
        currentTime >= 2 &&
        currentTime < 10 &&
        activeWord === null && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 max-w-[200px] pointer-events-auto">
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

      {debugMode && (
        <DebugOverlayPanel overlay={overlay} mediaLabel="roam-video.mp4" />
      )}

      {toolsEnabled &&
        activeWord === null &&
        roamWordBoxes
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
                  speak(w.italian, "female");
                  const video = videoRef.current;
                  const wasPlaying = Boolean(video && !video.paused);
                  setPausedForActiveWord(autoPauseOnWord && wasPlaying);
                  if (autoPauseOnWord) {
                    if (video && wasPlaying) video.pause();
                    roamAudioRef.current?.pause();
                  }
                }}
              >
                {w.italian}
              </button>
            );
          })}

      {activeWord && (
        <div className="roam-word-popup-backdrop" onClick={closeActiveWord}>
          <div className="roam-word-popup" onClick={(e) => e.stopPropagation()}>
            <div className="roam-word-popup-header-actions">
              <button
                className="roam-word-popup-pause"
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  if (v.paused) {
                    v.play();
                    setIsPlaying(true);
                    setAutoPauseOnWord(false);
                    setPausedForActiveWord(false);
                  } else {
                    v.pause();
                    setIsPlaying(false);
                    setAutoPauseOnWord(true);
                    setPausedForActiveWord(false);
                  }
                }}
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
                onClick={closeActiveWord}
              >
                <X size={16} />
              </button>
            </div>
            <div className="roam-word-popup-eyebrow">
              {isChinese ? "中文" : "English"}
            </div>
            <div className="flex items-center gap-2">
              <h2 className="roam-word-popup-italian">{activeWord.italian}</h2>
              <button
                className="text-[#c4942a] transition hover:text-white"
                onClick={() => speak(activeWord.italian, "female")}
                title={`Hear ${activeWord.italian} in English`}
                aria-label={`Hear ${activeWord.italian} in English`}
              >
                <Volume2 size={18} />
              </button>
            </div>
            <div className="roam-word-popup-english">{activeWord.english}</div>
            <div className="roam-word-popup-divider" />
            <p className="roam-word-popup-fact">{activeWord.fact}</p>
            <form onSubmit={(event) => { event.preventDefault(); if (activeWordInput.trim().toLowerCase() !== activeWord.italian.toLowerCase()) return; setSavedWords((words) => words.some((word) => word.id === activeWord.id) ? words : [...words, activeWord]); closeActiveWord(); }} className="mt-4 flex gap-2">
              <input autoFocus value={activeWordInput} onChange={(event) => setActiveWordInput(event.target.value)} placeholder={`Type ${activeWord.italian} to unlock`} className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none" />
              <button className="rounded-lg bg-[#c4942a] px-3 py-2 text-xs font-semibold text-[#1b1208]">Unlock</button>
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
                      {word.italian}
                    </span>
                    <span className="text-[10px] text-white/45">
                      {word.english}
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

function matchingPrefixLength(answer: string, typed: string) {
  const mismatch = [...typed].findIndex((letter, index) => answer[index] !== letter);
  return mismatch === -1 ? typed.length : mismatch;
}

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
  const { isChinese } = useLanguage();
  const [phase, setPhase] = useState<
    | "approach"
    | "word-puzzle"
    | "inside"
    | "food-word"
    | "detail-word"
    | "checkout"
    | "rose"
    | "paid"
  >("approach");
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
  const [foodWrong, setFoodWrong] = useState(false);
  const [detailWordIndex, setDetailWordIndex] = useState(0);
  const [paymentInput, setPaymentInput] = useState("");
  const [paymentWrong, setPaymentWrong] = useState(false);
  const recordDailyWords = (words: string[]) => {
    const slot = Number(localStorage.getItem("taletalk_active_save_slot") ?? "1");
    const day = new Date().toISOString().slice(0, 10);
    const seenKey = `taletalk-slot-${slot}-daily-word-list-${day}`;
    const seen = new Set<string>(JSON.parse(localStorage.getItem(seenKey) ?? "[]"));
    const before = seen.size;
    words.forEach((word) => seen.add(word.toLowerCase()));
    if (seen.size === before) return;
    localStorage.setItem(seenKey, JSON.stringify([...seen]));
    localStorage.setItem(`taletalk-slot-${slot}-daily-words-${day}`, String(seen.size));
    const goal = Number(localStorage.getItem(`taletalk-slot-${slot}-daily-word-goal`) ?? 5);
    const completeKey = `taletalk-slot-${slot}-daily-goal-completed-${day}`;
    if (seen.size >= goal && localStorage.getItem(completeKey) !== "true") {
      localStorage.setItem(completeKey, "true");
      const lastDayKey = `taletalk-slot-${slot}-daily-word-last-complete`;
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const nextStreak = localStorage.getItem(lastDayKey) === yesterday
        ? Number(localStorage.getItem(`taletalk-slot-${slot}-daily-word-streak`) ?? 0) + 1
        : 1;
      localStorage.setItem(`taletalk-slot-${slot}-daily-word-streak`, String(nextStreak));
      localStorage.setItem(lastDayKey, day);
    }
  };
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
  const SHOP_WORD: ShopWordTooltip = { word: "Shop", translation: "商店" };
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
    window.dispatchEvent(new Event("taletalk-words-changed"));
  };

  useEffect(() => {
    // The shopping-centre opening stays silent; only the shop-door bell plays.
    return;
  }, [phase]);

  useEffect(() => {
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
    else if (phase === "checkout") {
      speak("输入“支付”的英语单词来完成商店购物。", "male");
      speak("There is a rose by the counter and you decide to get it for your wife. Type Pay to finish your shopping.", "male");
    } else if (phase === "rose")
      speak(
        "付款后，你看见了玫瑰，也决定把它买下来。",
        "male",
      );
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
      stripAccents(wordInput.toLowerCase().trim()) === "shop"
    ) {
      setWordDone(true);
      setUnlockedWords((prev) => {
        const existing = new Set(prev.map((w) => w.word));
        return existing.has(SHOP_WORD.word) ? prev : [...prev, SHOP_WORD];
      });
      setWordInput("");
      recordDailyWords(["shop"]);
      saveToVocabulary("shop");
      playShopDoorBell();
      setTimeout(() => {
        setWordDone(false);
        setPhase("inside");
      }, 1800);
    } else {
      setWordWrong(true);
      setTimeout(() => setWordWrong(false), 1500);
    }
  };

  const activeFood = SHOPPING_STOPS[activeFoodIndex];
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
        setPhase("inside");
      } else if (phase === "inside") {
        setActiveFoodIndex(
          SHOPPING_STOPS.findIndex((item) => !pickedFoodIds.includes(item.id)),
        );
        setFoodInput("");
        setPhase("food-word");
      } else if (phase === "food-word") {
        setUnlockedWords((words) =>
          words.some((w) => w.word === activeFood.italian)
            ? words
            : [
                ...words,
                { word: activeFood.italian, translation: activeFood.chinese },
              ],
        );
        setPhase("detail-word");
      } else if (phase === "detail-word") {
        const picked = [...pickedFoodIds, activeFood.id];
        setPickedFoodIds(picked);
        setPhase(
          picked.length === SHOPPING_STOPS.length ? "checkout" : "inside",
        );
      } else if (phase === "checkout") setPhase("rose");
      else if (phase === "rose") setPhase("paid");
      else if (phase === "paid") onComplete();
    };
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [phase, activeFood, pickedFoodIds, onComplete]);
  const typedFood = stripAccents(foodInput.toLowerCase().trim());
  const foodPrefixLength = matchingPrefixLength(
    stripAccents(activeFood.italian.toLowerCase()),
    typedFood,
  );
  const foodHasWrongLetter = typedFood.length > foodPrefixLength;
  const submitFoodWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      stripAccents(foodInput.trim().toLowerCase()) ===
      stripAccents(activeFood.italian.toLowerCase())
    ) {
      setUnlockedWords((prev) =>
        prev.some((word) => word.word === activeFood.italian)
          ? prev
          : [
              ...prev,
              { word: activeFood.italian, translation: activeFood.chinese },
            ],
      );
      setFoodInput("");
      recordDailyWords([activeFood.italian]);
      saveToVocabulary(activeFood.italian);
      setPhase("detail-word");
    } else {
      setFoodWrong(true);
      setTimeout(() => setFoodWrong(false), 1500);
    }
  };

  const detailWords = [activeFood.english.toLowerCase()];
  const detailWord = detailWords[detailWordIndex];
  const detailPrefixLength = matchingPrefixLength(detailWord, typedFood);
  const detailHasWrongLetter = typedFood.length > detailPrefixLength;
  const submitDetailWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (stripAccents(foodInput.trim().toLowerCase()) !== detailWord) {
      setFoodWrong(true);
      setTimeout(() => setFoodWrong(false), 1500);
      return;
    }
    if (detailWordIndex < detailWords.length - 1) {
      setDetailWordIndex((index) => index + 1);
      setFoodInput("");
      setFoodWrong(false);
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
        chicken: "鸡肉",
        potatoes: "土豆",
        water: "水",
        apples: "苹果",
        bananas: "香蕉",
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
    setPhase(picked.length === SHOPPING_STOPS.length ? "checkout" : "inside");
  };

  const submitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (stripAccents(paymentInput.trim().toLowerCase()) === "pay") {
      cancel();
      setPhase("rose");
    } else {
      setPaymentWrong(true);
      setTimeout(() => setPaymentWrong(false), 1500);
    }
  };

  const image =
    phase === "approach" || phase === "word-puzzle"
      ? assetUrl("scenes/shop/c1-v3.png")
      : phase === "inside"
        ? assetUrl("scenes/shop/c2-v3.png")
        : phase === "checkout" || phase === "rose" || phase === "paid"
          ? assetUrl("scenes/shop/c9-taking-rose.png")
          : activeFood.image;
  const typedShopWord = stripAccents(wordInput.toLowerCase().trim());
  const shopWordPrefixLength = "shop".startsWith(typedShopWord)
    ? typedShopWord.length
    : 0;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center">
      <div
        ref={sceneRef}
        className="relative h-screen w-screen"
        onMouseMove={handleSceneMouseMove}
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

        {unlockedWords.length > 0 && (
          <div
            className="absolute left-4 top-28 z-30"
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
                  <button
                    className="text-white/50 hover:text-white"
                    onClick={() => setLibraryOpen(false)}
                  >
                    ×
                  </button>
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
                        className="flex w-full items-center justify-between rounded-lg bg-white/5 px-2.5 py-2 text-left transition hover:bg-white/10"
                      >
                        <span className="text-sm text-white">{word.word}</span>
                        <span className="text-[10px] text-white/45">
                          {word.translation}
                        </span>
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
                {practiceWord.word}
              </h2>
              <p className="mb-4 text-sm text-white/55">
                {practiceWord.translation}
              </p>
              {practiceCorrect ? (
                <p className="mb-4 text-sm text-green-400">
                  Correct. The word is yours.
                </p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPracticeCorrect(
                      stripAccents(practiceInput.trim().toLowerCase()) ===
                        stripAccents(practiceWord.word.toLowerCase()),
                    );
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
              )}
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
              <span className="hotspot-tooltip">商店</span>
            </button>
            <div
              className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="rounded-2xl border border-white/10 px-4 pb-3 pt-3"
                style={{ background: "rgba(0,0,0,0.92)" }}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ccc] flex-shrink-0" />
                  <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-white/60">
                    {isChinese ? "旁白" : "Narrator"}
                  </span>
                </div>
                <p
                  className="text-white text-base leading-snug"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {isChinese
                    ? "他来到了本地商店。点击商店进入。"
                    : "He arrives at the local shop. Click on the shop to enter."}
                </p>
                <span className="text-white/40 text-[11px]">
                  {isChinese ? "点击发光点" : "click on the glowing point"}
                </span>
              </div>
            </div>
          </>
        )}

        {phase === "word-puzzle" && (
          <div
            className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-2xl border border-white/10 px-4 pb-3 pt-3"
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
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#c4942a] flex-shrink-0" />
                    <span
                      className={`text-[#c4942a] uppercase tracking-[0.12em] font-semibold ${isChinese ? "text-xs" : "text-[9px]"}`}
                    >
                      {isChinese
                        ? "输入“商店”的英语单词"
                        : "Type the English word for shop"}
                    </span>
                  </div>
                  <div
                    className="mb-2 flex gap-0.5 text-lg font-semibold tracking-[0.24em]"
                    aria-label="Shop"
                  >
                    {"Shop".split("").map((letter, index) => (
                      <span
                        key={index}
                        className={
                          index < shopWordPrefixLength
                            ? "text-green-400"
                            : "text-white/45"
                        }
                      >
                        {letter}
                      </span>
                    ))}
                  </div>
                  <p className="mb-2 text-sm text-white/55">商店</p>
                  <form
                    onSubmit={handleSubmit}
                    className="flex items-center gap-2"
                  >
                    <input
                      value={wordInput}
                      onChange={(e) => setWordInput(e.target.value)}
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={isChinese ? "输入 Shop…" : "type Shop..."}
                      className="flex-1 min-w-0 bg-white/5 text-white text-sm outline-none placeholder-white/30 caret-white border-b border-white/20 focus:border-white/60 py-2 rounded-lg px-3"
                    />
                    <button className="rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-xs px-4 py-2 transition-all uppercase tracking-wider flex-shrink-0">
                      {isChinese ? "确认" : "Enter"}
                    </button>
                  </form>
                  {wordWrong && (
                    <div className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
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
            <div
              className="absolute left-4 top-28 z-30 w-44 rounded-xl border border-[#c4942a]/50 bg-black/80 p-3 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#c4942a]">
                Shopping list
              </div>
              <div className="mb-2 text-xs text-white/55">3 items</div>
              {SHOPPING_STOPS.map((food, index) => (
                <div
                  key={food.id}
                  className={`flex items-center justify-between py-1 text-sm ${pickedFoodIds.includes(food.id) ? "text-green-400 line-through" : "text-white"}`}
                >
                  <span>{food.english}</span>
                  {pickedFoodIds.includes(food.id) ? (
                    <Check size={14} />
                  ) : (
                    <span className="text-white/35">{index + 1}</span>
                  )}
                </div>
              ))}
            </div>
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
                  setFoodInput("");
                  setPhase("food-word");
                }}
                aria-label={`Explore ${food.english}`}
              >
                <span className="hotspot-pulse" />
                <span className="hotspot-tooltip">{food.chinese}</span>
              </button>
            ))}
            <div
              className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="rounded-2xl border border-white/10 px-4 pb-3 pt-3"
                style={{ background: "rgba(0,0,0,0.92)" }}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ccc] flex-shrink-0" />
                  <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-white/60">
                    {isChinese ? "旁白" : "Narrator"}
                  </span>
                </div>
                <p
                  className="text-white text-base leading-snug"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {isChinese
                    ? "他走进了商店。点击每个发光点，找到清单上的物品。"
                    : "He steps inside the shop. Click each glowing point to find the items on the list."}
                </p>
              </div>
            </div>
          </>
        )}

        {phase === "food-word" && (
          <>
            <div className="absolute left-4 top-28 z-30 w-44 rounded-xl border border-[#c4942a]/50 bg-black/80 p-3 text-xs text-white">
              <span className="text-[#c4942a]">Shopping list</span>
              {SHOPPING_STOPS.map((food) => (
                <div key={food.id} className={`mt-1 ${pickedFoodIds.includes(food.id) ? "text-green-400 line-through" : "text-white"}`}>
                  {food.english}
                </div>
              ))}
            </div>
            <div
              className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="rounded-2xl border border-white/10 px-4 pb-3 pt-3"
                style={{ background: "rgba(0,0,0,0.92)" }}
              >
                <span className="text-[#c4942a] text-[9px] uppercase tracking-[0.12em] font-semibold">
                  输入“{activeFood.chinese}”的英语单词
                </span>
                <p
                  className={`mt-1 text-sm ${foodHasWrongLetter ? "text-red-400" : foodPrefixLength ? "text-green-400" : "text-white/60"}`}
                >
                  {activeFood.chinese}
                </p>
                <div className="my-2 flex gap-0.5 text-lg font-semibold tracking-[0.2em]">
                  {activeFood.italian.split("").map((letter, index) => (
                    <span
                      key={index}
                      className={
                        index < foodPrefixLength
                          ? "text-green-400"
                          : foodHasWrongLetter && index < foodInput.length
                            ? "text-red-400"
                            : "text-white/45"
                      }
                    >
                      {letter}
                    </span>
                  ))}
                </div>
                <form onSubmit={submitFoodWord} className="flex gap-2">
                  <input
                    autoFocus
                    value={foodInput}
                    onChange={(e) => setFoodInput(e.target.value)}
                    placeholder={`type ${activeFood.italian}...`}
                    className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                  />
                  <button className="rounded-lg border border-white/20 bg-white/10 px-4 text-xs text-white">
                    确认
                  </button>
                </form>
                {foodWrong && (
                  <p className="mt-2 text-xs text-red-400">
                    还不对，请再试一次。
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {phase === "detail-word" && (
          <>
            <div className="absolute left-4 top-28 z-30 w-44 rounded-xl border border-[#c4942a]/50 bg-black/80 p-3 shadow-xl">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#c4942a]">
                Shopping list
              </div>
              {SHOPPING_STOPS.map((food) => (
                <div key={food.id} className="py-1 text-sm text-white/70">
                  {food.english}
                </div>
              ))}
            </div>
            <div
              className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="rounded-2xl border border-white/10 px-4 pb-3 pt-3"
                style={{ background: "rgba(0,0,0,0.92)" }}
              >
                <span className="text-[#c4942a] text-[9px] uppercase tracking-[0.12em] font-semibold">
                  Pick which one is right, then type it
                </span>
                <div className="my-2 flex flex-wrap gap-2">
                  {activeFood.choices.map((choice) => (
                    <span
                      key={choice}
                      className="rounded-full border border-white/20 px-2 py-1 text-xs text-white/60"
                    >
                      {choice.split("").map((letter, index) => (
                        <span
                          key={index}
                          className={choice.toLowerCase() !== detailWord ? "" : index < detailPrefixLength ? "text-green-400" : detailHasWrongLetter && index < foodInput.length ? "text-red-400" : ""}
                        >
                          {letter}
                        </span>
                      ))}
                    </span>
                  ))}
                </div>
                <div
                  className={`mb-2 text-sm ${detailHasWrongLetter ? "text-red-400" : detailPrefixLength ? "text-green-400" : "text-white/45"}`}
                >
                  {activeFood.chinese}
                </div>
                <form onSubmit={submitDetailWord} className="flex gap-2">
                  <input
                    autoFocus
                    value={foodInput}
                    onChange={(e) => setFoodInput(e.target.value)}
                    placeholder="type your choice..."
                    className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                  />
                  <button className="rounded-lg border border-white/20 bg-white/10 px-4 text-xs text-white">
                    Enter
                  </button>
                </form>
                {foodWrong && (
                  <p className="mt-2 text-xs text-red-400">
                    Not quite — type the whole item.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {phase === "checkout" && (
          <div
            className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-2xl border border-white/10 px-4 pb-3 pt-3"
              style={{ background: "rgba(0,0,0,0.92)" }}
            >
              <span className="text-[#c4942a] text-[9px] uppercase tracking-[0.12em] font-semibold">
                Checkout
              </span>
              <p className="my-2 text-white">
                提示：<span className="text-green-400">pay</span>
              </p>
              <p className="my-2 text-white">输入“支付”来完成购物。</p>
              <form onSubmit={submitPayment} className="flex gap-2">
                <input
                  autoFocus
                  value={paymentInput}
                  onChange={(e) => setPaymentInput(e.target.value)}
                  placeholder="Pay"
                  className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                />
                <button className="rounded-lg border border-white/20 bg-white/10 px-4 text-xs text-white">
                  Pay
                </button>
              </form>
              {paymentWrong && (
                <p className="mt-2 text-xs text-red-400">
                  请输入“pay”。
                </p>
              )}
            </div>
          </div>
        )}
        {phase === "rose" && (
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10">
            <div
              className="rounded-2xl border border-white/10 px-4 pb-3 pt-3"
              style={{ background: "rgba(0,0,0,0.92)" }}
            >
              <span className="text-[#c4942a] text-[9px] uppercase tracking-[0.12em] font-semibold">
                旁白
              </span>
              <p className="my-2 text-white">
                付款后，你看见了玫瑰，也决定把它买下来。
              </p>
              <button className="scene-action" onClick={() => setPhase("paid")}>购买玫瑰 <ArrowRight size={16} /></button>
            </div>
          </div>
        )}
        {phase === "paid" && (
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-10">
            <div
              className="rounded-2xl border border-green-400/30 px-4 pb-3 pt-3"
              style={{ background: "rgba(0,0,0,0.92)" }}
            >
              <span className="text-green-400 text-[9px] uppercase tracking-[0.12em] font-semibold">
                付款成功
              </span>
              <p className="my-2 text-white">杂货和玫瑰现在都在篮子里。</p>
              <button
                onClick={onComplete}
                className="rounded-lg border border-green-400/40 bg-green-400/15 px-4 py-2 text-xs text-white"
              >
                返回地图
              </button>
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
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={18} />
      <span>
        <strong>{isChinese ? item.labelZh : item.label}</strong>
        <small>{isChinese ? item.noteZh : item.note}</small>
      </span>
      <span className="nav-arrow">→</span>
    </button>
  );
}
