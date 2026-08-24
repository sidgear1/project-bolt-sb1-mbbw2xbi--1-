import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Lightbulb } from "lucide-react";
import { assetUrl } from "../utils/assetUrl";
import { useSpeech } from "../hooks/useSpeech";
import { useLanguage } from "../i18n";

type Props = {
  onBack: () => void;
  onBusComplete: () => void;
  onHomeComplete: () => void;
};
function SceneImage({ src, alt }: { src: string; alt: string }) {
  const [visibleSrc, setVisibleSrc] = useState(src);
  useEffect(() => {
    if (src === visibleSrc) return;
    let active = true;
    const image = new Image();
    const reveal = async () => {
      try {
        await image.decode();
      } catch {
        /* The browser can still paint the image. */
      }
      if (active) setVisibleSrc(src);
    };
    image.onload = reveal;
    image.onerror = reveal;
    image.src = src;
    return () => {
      active = false;
    };
  }, [src, visibleSrc]);
  return (
    <img
      className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
      src={visibleSrc}
      alt={alt}
    />
  );
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
  window.dispatchEvent(new Event("taletalk-words-changed"));
};
const SCENE_WORD_CHINESE: Record<string, string> = { "drink coffee": "喝咖啡", bed: "床", nervous: "紧张", flower: "花", start: "开始", run: "跑", jump: "跳", climb: "爬", walk: "走", "pick up": "捡起", carry: "搬运", "put down": "放下", finish: "完成" };
function SceneWordLibrary({ scene }: { scene: string }) {
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState<string[]>([]);
  const { isChinese } = useLanguage();
  useEffect(() => {
    const update = () => {
      const slot = Number(localStorage.getItem("taletalk_active_save_slot") ?? "1");
      setWords(JSON.parse(localStorage.getItem(`taletalk-slot-${slot}-scene-${scene}-words`) ?? "[]"));
    };
    update(); window.addEventListener("taletalk-words-changed", update);
    return () => window.removeEventListener("taletalk-words-changed", update);
  }, [scene]);
  if (!words.length) return null;
  return <div className="absolute right-4 top-28 z-30" onClick={event => event.stopPropagation()}><button onClick={() => setOpen(value => !value)} className="rounded-xl border border-[#c4942a]/50 bg-black/75 px-3 py-2 text-left text-white shadow-xl backdrop-blur-sm"><b>{isChinese ? "单词" : "Words"}</b><small className="ml-2 text-white/60">{words.length}</small></button>{open && <div className="mt-2 w-48 rounded-xl border border-white/15 bg-black/90 p-3 shadow-2xl"><div className="mb-2 text-[10px] uppercase tracking-wider text-[#c4942a]">{isChinese ? "词汇表" : "Vocabulary"}</div>{[...words].sort().map(word => <div key={word} className="flex justify-between border-b border-white/10 py-1.5 text-sm last:border-0"><span>{word}</span><span className="text-white/55">{SCENE_WORD_CHINESE[word] ?? ""}</span></div>)}</div>}</div>;
}
function BilingualTypeCue({
  english,
  chinese,
  value,
  showEnglish = true,
  chineseParts,
}: {
  english: string;
  chinese: string;
  value: string;
  showEnglish?: boolean;
  chineseParts?: string[];
}) {
  const typed = value.trim().toLowerCase();
  const answer = english.toLowerCase();
  const prefixLength = [...typed].findIndex((letter, index) => answer[index] !== letter);
  const matchingLength = prefixLength === -1 ? typed.length : prefixLength;
  const wrong = typed.length > matchingLength;
  const typedWords = typed.split(/\s+/).filter(Boolean);
  const answerWords = answer.split(/\s+/);
  return (
    <div className="bilingual-type-cue mt-3 space-y-1 text-center text-lg">
      <p className={wrong ? "text-red-400" : matchingLength ? "text-emerald-300" : "text-[#f0d88f]"}>{chineseParts ? chineseParts.map((part, index) => <span key={`${part}-${index}`} className={typedWords[index] === answerWords[index] ? "text-emerald-300" : ""}>{part}</span>) : chinese}</p>
      {showEnglish && <p className="font-semibold tracking-[.12em] text-white">
        {[...english].map((letter, index) => <span key={`${letter}-${index}`} className={index < matchingLength ? "text-emerald-300" : wrong && index < value.length ? "text-red-400" : ""}>{letter}</span>)}
      </p>}
    </div>
  );
}
const BUS_WORDS = [
  { chinese: "冰淇淋", english: "ice cream" },
  { chinese: "商店", english: "shop" },
  { chinese: "鸡肉", english: "chicken" },
  { chinese: "土豆", english: "potatoes" },
  { chinese: "水", english: "water" },
  { chinese: "苹果和香蕉", english: "apples and bananas" },
];
type BusStage = "quiz" | "happy" | "running" | "failed";

export function BusTicketAdventure({
  onBack,
  onBusComplete,
}: Pick<Props, "onBack" | "onBusComplete">) {
  const [stage, setStage] = useState<BusStage>("quiz"),
    [index, setIndex] = useState(0),
    [input, setInput] = useState(""),
    [wrong, setWrong] = useState(0),
    [hints, setHints] = useState(0);
  const { speak, cancel } = useSpeech();
  const { isChinese } = useLanguage();
  const word = BUS_WORDS[index],
    grade = Math.max(0, 100 - wrong * 10 - hints * 10),
    image = assetUrl(
      `scenes/bus/${stage === "quiz" ? "d1" : stage === "happy" ? "d2" : stage === "running" ? "d3" : "d4"}.png`,
    );
  const advance = () => {
    if (stage === "quiz") {
      if (index < BUS_WORDS.length - 1) setIndex((n) => n + 1);
      else setStage(grade >= 50 ? "happy" : "failed");
    } else if (stage === "happy") setStage("running");
    else if (stage === "running") onBusComplete();
  };
  useEffect(() => {
    const line =
      stage === "quiz"
        ? index === 0
          ? `杰西卡不能错过这班公交车，否则她会错过考试。请输入中文单词对应的英语来拿到通行证。`
          : `下一个单词是“${word.chinese}”。`
        : stage === "happy"
          ? "你找到了我的公交通行证。非常感谢！"
          : stage === "running"
            ? "我现在可以赶上公交车了！"
            : "我错过了公交车。我需要多练习。";
    speak(
      line,
      stage === "quiz" || stage === "happy" || stage === "running"
        ? "busWoman"
        : "adventure",
    );
    return cancel;
  }, [stage, word, speak, cancel]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (input.trim().toLowerCase() !== word.english) {
      setWrong((n) => n + 1);
      return;
    }
    unlock(word.english, "bus");
    setInput("");
    if (index < BUS_WORDS.length - 1) setIndex((n) => n + 1);
    else setStage(grade >= 50 ? "happy" : "failed");
  };
  const hint = () => {
    setHints((n) => n + 1);
  };
  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <SceneImage src={image} alt="Jessica at the bus stop" />
      <div className="absolute inset-0 bg-black/35" />
      <header className="scene-header">
        <button onClick={onBack}>地图</button>
        <span>公交通行证 · 艾尔德伍德</span>
      </header>
      <SceneWordLibrary scene="bus" />
      <main className="scene-panel" onClick={(event) => {
        if (stage === "quiz" || event.target instanceof HTMLElement && event.target.closest("button,input,form")) return;
        advance();
      }}>
        {stage === "quiz" && (
          <>
            <div className="scene-eyebrow">杰西卡："糟了，糟了……"</div>
            <h1>解锁公交通行证</h1>
            <p>
              杰西卡不能错过这班公交车，否则她会错过考试。请输入中文单词对应的英语。
            </p>
            <div className="scene-progress">
              单词 {index + 1} / {BUS_WORDS.length} · 成绩 {grade}%
            </div>
            <BilingualTypeCue english={word.english} chinese={word.chinese} value={input} showEnglish={!isChinese} />
            <form className="scene-form" onSubmit={submit}>
              <button type="button" className="task-close" onClick={onBack}>×</button>
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入英语单词……"
              />
              <button>检查</button>
            </form>
            {wrong > 0 && (
              <p className="scene-error">不对。错误字母会降低成绩。</p>
            )}
            <div className="scene-hint">
              <Lightbulb size={15} />{" "}
              {hints === 0
                ? "提示会降低最终成绩。"
                : hints === 1
                  ? `${word.english.slice(0, 3)}${"_".repeat(Math.max(1, word.english.length - 3))}`
                  : "语音正在读出这个单词。"}
              <button onClick={hint}>使用提示</button>
            </div>
          </>
        )}
        {stage === "happy" && (
          <>
            <div className="scene-eyebrow">通行证 · {grade}%</div>
            <h1>杰西卡想起了她的通行证！</h1>
            <p>她松了一口气——现在还有时间赶上公交车。</p>
            <button
              className="scene-action"
              onClick={() => setStage("running")}
            >
              继续 <ArrowRight size={16} />
            </button>
          </>
        )}
        {stage === "running" && (
          <>
            <div className="scene-eyebrow">关卡完成</div>
            <h1>杰西卡跑向公交车。</h1>
            <p>你的成绩是 {grade}%。地图上的转角房子现已解锁。</p>
            <button className="scene-action" onClick={onBusComplete}>
              返回地图 <ArrowRight size={16} />
            </button>
          </>
        )}
        {stage === "failed" && (
          <>
            <div className="scene-eyebrow">最终成绩 · {grade}%</div>
            <h1>公交车已经开走了。</h1>
            <p>至少需要 50% 才能通过。返回地图后再试一次。</p>
            <button className="scene-action" onClick={onBack}>
              返回地图
            </button>
          </>
        )}
      </main>
    </div>
  );
}

const HOME_LINES = [
  "他站在门厅里：进入厨房，还是逃命？",
  "妻子看到他回来后很生气。",
  "他把玫瑰花送给妻子。",
  "她拥抱了他，他们又开心起来。",
  "终于可以在后花园放松了，生活真好。",
  "他突然被足球击中了头。",
  "儿子问：为什么你不去运动日？",
  "儿子说：我太紧张了。爸爸说：胡说，你没有什么可害怕的。",
];
const HOME_LINES_EN = [
  "He stands in the hallway: go into the kitchen, or run away?",
  "His wife is angry when she sees him return.",
  "He gives his wife the rose.",
  "She hugs him, and they are happy again.",
  "At last he can relax in the back garden. Life is good.",
  "A football suddenly hits him on the head.",
  "His son asks: Why aren't you going to Sports Day?",
  "His son says: I am too nervous. Dad says: Nonsense, you have nothing to be afraid of.",
];

export function HomeAdventure({
  onBack,
  onHomeComplete,
}: Pick<Props, "onBack" | "onHomeComplete">) {
  const [step, setStep] = useState(0),
    [input, setInput] = useState(""),
    [wrong, setWrong] = useState(false);
  const { isChinese } = useLanguage();
  const { speak, cancel } = useSpeech();
  const homeLine = isChinese ? HOME_LINES[step] : HOME_LINES_EN[step];
  const homeImages = useMemo(
    () => [
      assetUrl("scenes/home/return-home-e1.png"),
      assetUrl("scenes/home/return-home-e2.png"),
      assetUrl("scenes/home/return-home-e3.png"),
      assetUrl("scenes/home/return-home-e4.png"),
      ...[1, 2, 3, 4].map((n) => assetUrl(`scenes/garden/f${n}.png`)),
    ],
    [],
  );
  useEffect(() => {
    speak(homeLine, "adventure");
    return cancel;
  }, [homeLine, speak, cancel]);
  useEffect(() => {
    if (step !== 4) return;
    const audio = new Audio(assetUrl("audio/garden-scene-ambience.mp4"));
    audio.loop = true;
    audio.volume = 0.12;
    void audio.play().catch(() => undefined);
    return () => { audio.pause(); audio.currentTime = 0; };
  }, [step]);
  const nextHome = () => {
    if (step < 7) setStep((n) => n + 1);
    else onHomeComplete();
  };
  const homeExpected = step === 1 ? "give her the flower" : "nervous";
  const homeChinese =
    step === 1 ? "把花送给她" : step === 6 ? "紧张" : "害怕";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim().toLowerCase() !== homeExpected) {
      setWrong(true);
      return;
    }
    unlock(homeExpected, "home");
    setInput("");
    setWrong(false);
    nextHome();
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight") return;
      event.preventDefault();
      nextHome();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <SceneImage src={homeImages[step]} alt="The Corner House" />
      <div className="absolute inset-0 bg-black/35" />
      <header className="scene-header">
        <button onClick={onBack}>{isChinese ? "地图" : "Map"}</button>
        <span>THE CORNER HOUSE</span>
      </header>
      <SceneWordLibrary scene="home" />
      <main className="scene-panel" onClick={(event) => {
        if (step === 0 || step === 1 || step === 6 || event.target instanceof HTMLElement && event.target.closest("button,input,form")) return;
        nextHome();
      }}>
        <div className="scene-eyebrow">{isChinese ? "旁白" : "Narrator"}</div>
        <h1>{homeLine}</h1>
        {step === 0 ? (
          <div className="scene-choices">
            <button
              onClick={() => {
                setWrong(false);
                nextHome();
              }}
            >
              {isChinese ? "进入厨房" : "Go into the kitchen"}
            </button>
            <button onClick={() => setWrong(true)}>{isChinese ? "逃命" : "Run away"}</button>
            {wrong && (
              <p className="scene-error">{isChinese ? "回家和家人在一起才是正确的选择。" : "Going home to be with your family is the right choice."}</p>
            )}
          </div>
        ) : step === 1 || step === 6 ? (
          <form className="scene-form" onSubmit={submit}>
            <button type="button" className="task-close" onClick={onBack}>×</button>
            <p>{isChinese ? "输入英语：" : "Type the English words:"}</p>
            <BilingualTypeCue english={homeExpected} chinese={homeChinese} value={input} showEnglish={!isChinese} />
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="type the English words..."
            />
            <button>Check</button>
            {wrong && <p className="scene-error">{isChinese ? "再试一次。" : "Try again."}</p>}
          </form>
        ) : (
          <button className="scene-action" onClick={nextHome}>
            {isChinese ? "继续" : "Continue"} <ArrowRight size={16} />
          </button>
        )}
      </main>
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
  1: "运动日到了。乔希和威廉准备迎接一项大挑战。",
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
  1: "Sports Day is here. Josh and William are ready for a big challenge.",
  2: "Listen carefully and use English action words to help William complete each event.",
  3: "The race is about to start. Type the action words before the timer runs out.",
  4: "There is a hurdle ahead. What should William do?",
  5: "A great jump! William keeps moving forward.",
  6: "Next is the climbing wall. Type the action word.",
  7: "He reaches the top and keeps going.",
  8: "Choose the action that lets William reach the next stop.",
  9: "The next challenge is carrying equipment across the field.",
  10: "Type two actions to complete the carrying challenge.",
  11: "Now type the action needed to complete the task.",
  12: "The finish line is in sight. Type the final action word.",
  13: "Sports Day is complete!",
  14: "William did it! He earns a medal for all his effort.",
  15: "Dinner is ready. Josh feels happy and proud of William.",
  16: "Dinner is ready. Josh feels happy and proud of William.",
};

export function SportsDayAdventure({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  const [stage, setStage] = useState<SportsStage>(1);
  const [answers, setAnswers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [wrong, setWrong] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [raceFailed, setRaceFailed] = useState(false);
  const { isChinese } = useLanguage();
  const { speak, cancel } = useSpeech();
  const sportsCopy = isChinese ? SPORTS_COPY[stage] : SPORTS_COPY_EN[stage];
  const timed = stage >= 3 && stage <= 12;
  const expected: Partial<Record<SportsStage, string[]>> = {
    3: ["start", "run"],
    4: ["jump"],
    6: ["climb"],
    8: ["walk"],
    10: ["pick up", "carry"],
    11: ["put down"],
    12: ["jump"],
    13: ["climb"],
    14: ["finish"],
  };
  const sportsChinese: Record<string, string> = {
    start: "开始",
    run: "跑",
    jump: "跳",
    climb: "爬",
    walk: "走",
    "pick up": "捡起",
    carry: "搬运",
    "put down": "放下",
    finish: "完成",
  };
  const currentAnswer = expected[stage]?.[answers.length] ?? "";
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
  const currentWordChoices = wordChoices[currentAnswer] ?? [];
  const sportsList = ["finish", "carry", "jump", "start", "walk", "climb", "put down", "run", "pick up"];
  const needsTyping = Boolean(expected[stage]);
  const imageStage = raceFailed ? 3 : stage === 15 ? 16 : stage === 16 ? 15 : stage;
  const image = assetUrl(`scenes/sports-day/g${imageStage}.png`);

  useEffect(() => {
    if (raceFailed || timed) return;
    speak(sportsCopy, "adventure");
    return cancel;
  }, [raceFailed, sportsCopy, speak, cancel]);

  useEffect(() => {
    if (stage !== 1) return;
    const audio = new Audio(assetUrl("audio/ice-cream-shop-market-ambience.mp3"));
    audio.loop = true;
    audio.volume = 0.12;
    void audio.play().catch(() => undefined);
    return () => { audio.pause(); audio.currentTime = 0; };
  }, [stage]);

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
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const words = expected[stage] ?? [];
    const answer = input.trim().toLowerCase();
    if (answer !== words[answers.length]) {
      setWrong(true);
      return;
    }
    unlock(answer, "sports");
    setInput("");
    setWrong(false);
    if (answers.length + 1 < words.length)
      setAnswers((value) => [...value, answer]);
    else if (stage === 15) onComplete();
    else next();
  };
  const retry = () => {
    setStage(3);
    setSeconds(60);
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
    const requiredAnswers = expected[stage];
    if (requiredAnswers) {
      requiredAnswers.slice(answers.length).forEach(unlock);
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
    <div className="fixed inset-0 overflow-hidden bg-black" onClick={(event) => {
      if (stage > 2 || event.target instanceof HTMLElement && event.target.closest("button,input,form")) return;
      next();
    }}>
      <SceneImage src={image} alt="Sports Day" />
      <div className="absolute inset-0 bg-black/35" />
      <header className="scene-header" onClick={(event) => event.stopPropagation()}>
        <button onClick={onBack}>{isChinese ? "地图" : "Map"}</button>
        <span>
          {isChinese ? "运动日" : "SPORTS DAY"}{" "}
          {timed && (
            <strong className="ml-3 text-[#f0d88f]">{seconds}秒</strong>
          )}
        </span>
      </header>
      <SceneWordLibrary scene="sports" />
      {needsTyping && <aside className="sports-task-bar absolute z-30" style={{ left: "1.1%", top: "26%", width: "min(14rem, 22vw)" }}><div className="text-sm font-semibold uppercase tracking-wider text-[#f7d678]">Sports words</div>{sportsList.map(word => <div key={word} className="py-0.5 text-base text-white/80"><span className="text-[#f0d88f]">{sportsChinese[word]}</span><b className="ml-1.5 font-medium text-white">{word.replace(/(^|\s)\S/g, letter => letter.toUpperCase())}</b></div>)}</aside>}
      <main className="scene-panel" onClick={(event) => {
        event.stopPropagation();
        if (raceFailed || needsTyping || event.target instanceof HTMLElement && event.target.closest("button,input,form")) return;
        if (stage === 16) onComplete(); else next();
      }}>
        {!timed && <div className="scene-eyebrow">{isChinese ? "旁白" : "Narrator"}</div>}
        <h1>{raceFailed ? (isChinese ? "再试一次。" : "Try again.") : timed ? "" : sportsCopy}</h1>
        {raceFailed ? (
          <button className="scene-action" onClick={retry}>
            {isChinese ? "再试一次" : "Try again"} <ArrowRight size={16} />
          </button>
        ) : needsTyping ? (
          <>
            <BilingualTypeCue english={currentAnswer} chinese={sportsChinese[currentAnswer] ?? ""} value={input} showEnglish={false} />
            <form className="scene-form" onSubmit={submit}>
              <button type="button" className="task-close" onClick={onBack}>×</button>
              <input
                autoFocus
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="输入动作……"
              />
              <button>检查</button>
            </form>
            {wrong && <p className="scene-error">再试一次。</p>}
          </>
        ) : (
          <button
            className="scene-action"
            onClick={stage === 16 ? onComplete : next}
          >
            {stage === 16 ? "完成运动日" : "继续"} <ArrowRight size={16} />
          </button>
        )}
      </main>
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
  const [hallwayChoice, setHallwayChoice] = useState<"help" | "leave" | null>(null);
  const [roomNarration, setRoomNarration] = useState<string | null>(null);
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
  const displayedScene = hallwayScene ?? (roomUnlocked
    ? coffeeReady ? { image: "i4.png" } : COP_SCENES[3]
    : scene);
  const sceneText = hallwayScene
    ? hallwayStage === 2 && hallwayChoice === "leave"
      ? isChinese ? "梅森继续下楼，把那位女士留在了楼梯旁。" : "Mason continues downstairs, leaving the older woman at the stairs."
      : isChinese ? hallwayScene.text : hallwayScene.english
    : isChinese ? scene.text : scene.english;
  const hasFinishedIntro = sceneIndex === 3;
  const roomInstruction = isChinese ? "探索梅森的公寓。" : "Explore Mason's apartment.";
  const coffeeNarration = isChinese ? "喝完咖啡后，他几乎准备好出发了。" : "Now that he's had his coffee, he is nearly ready to go.";

  useEffect(() => {
    COP_SCENES.forEach(({ image }) => {
      const preload = new Image();
      preload.src = assetUrl(`scenes/cop/${image}`);
    });
  }, []);
  useEffect(() => {
    if (roomUnlocked || hallwayStage !== null) {
      cancel();
      return;
    }
    speak(sceneText, "adventure");
    return cancel;
  }, [roomUnlocked, hallwayStage, sceneText, speak, cancel]);

  const next = () => {
    cancel();
    if (hallwayStage !== null) {
      if (hallwayStage === 0) setHallwayStage(1);
      else if (hallwayStage === 2 && hallwayChoice === "help") setHallwayStage(3);
      else if (hallwayStage === 2 || hallwayStage === 3) onComplete();
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
  const taskChinese: Record<string, string> = {
    "drink coffee": "喝咖啡",
    bed: "床",
  };
  const submitTask = (event: React.FormEvent) => {
    event.preventDefault();
    if (!requiredTask || taskInput.trim().toLowerCase() !== requiredTask) {
      setTaskWrong(true);
      return;
    }
    unlock(requiredTask, "cop");
    setTaskInput("");
    setTaskWrong(false);
    if (roomMemory) {
      if (roomMemory.word === "drink coffee") {
        setCoffeeReady(true);
        setRoomMemory(null);
        setRoomNarration(coffeeNarration);
        speak(coffeeNarration, "adventure");
        return;
      }
      if (roomMemory.word === "bed") {
        const narration = isChinese ? "一张双人床，自从梅森搬进来以后，却只睡过一个人。" : "A bed for two that has only ever known one since Mason moved in.";
        setBedUnlocked(true);
        setRoomMemory(null);
        setRoomNarration(narration);
        speak(narration, "adventure");
        return;
      }
      setRoomMemory(null);
      return;
    }
    next();
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight") return;
      event.preventDefault();
      next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const roomHotspots = [
    ...(!coffeeReady ? [{
      word: "drink coffee",
      text: "咖啡还热着。输入 drink coffee。",
      english: "The coffee is still warm. Type drink coffee.",
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
      text: "床。输入 bed。",
      english: "Bed. Type bed.",
      left: "46.2%",
      top: "33.8%",
      width: "2.4%",
      height: "4.7%",
    }] : []),
    {
      word: "black-baron",
      text: "梅森花了很多时间，近乎痴迷地想找出黑男爵是谁。",
      english: "Trying to find out who the Black Baron is.",
      left: "64.1%",
      top: "14.4%",
      width: "3.5%",
      height: "4.4%",
    },
    {
      word: "door",
      text: coffeeReady && bedUnlocked ? "门现在可以使用了。点击离开公寓。" : "需要解锁 2/2 个单词才能继续。",
      english: coffeeReady && bedUnlocked ? "The door is now usable. Click it to leave the apartment." : "Requires 2/2 words unlocked to progress.",
      left: "31.9%",
      top: "37.8%",
      width: "3.6%",
      height: "3.6%",
      locked: !(coffeeReady && bedUnlocked),
    },
  ];
  const hotspotChinese: Record<string, string> = {
    "drink coffee": "喝咖啡", files: "侦探档案", pizza: "安吉洛披萨",
    bed: "床", "black-baron": "黑男爵", door: "门",
  };
  return (
    <div className="fixed inset-0 overflow-hidden bg-black" onClick={(event) => {
      if (event.target instanceof HTMLElement && event.target.closest("button,input,form")) return;
      if (!roomUnlocked || (hallwayStage !== null && hallwayStage !== 1)) next();
    }}>
      <SceneImage
        src={assetUrl(`scenes/cop/${displayedScene.image}`)}
        alt="Detective Mason"
      />
      <div className="absolute inset-0 bg-black/35" />
      {roomUnlocked &&
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
              if (item.word === "door" && !item.locked) {
                unlock("carry", "cop");
                cancel();
                setRoomUnlocked(false);
                setHallwayStage(0);
                setHallwayChoice(null);
                setRoomNarration(null);
                return;
              }
              if (item.word === "door") {
                return;
              }
              if (item.word === "files" || item.word === "pizza" || item.word === "black-baron") {
                const narration = isChinese ? item.text : item.english;
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
            <span className="hotspot-tooltip cop-door-tooltip">{item.word === "door" && item.locked ? (isChinese ? "需要解锁 2/2 个单词才能继续。" : "Requires 2/2 words unlocked to progress.") : hotspotChinese[item.word]}</span>
          </button>
        ))}
      <header className="scene-header">
        <button onClick={onBack}>{isChinese ? "地图" : "Map"}</button>
        <span>{isChinese ? "梅森侦探" : "DETECTIVE MASON"}</span>
      </header>
      <SceneWordLibrary scene="cop" />
      <main className="scene-panel">
        <div className="scene-eyebrow">{isChinese ? "旁白" : "Narrator"}</div>
        <h1 className={roomUnlocked && !roomMemory ? "text-center" : ""}>{roomMemory ? (isChinese ? roomMemory.text : roomMemory.english) : roomUnlocked ? (roomNarration ?? roomInstruction) : sceneText}</h1>
        {requiredTask ? (
          <form className="scene-form" onSubmit={submitTask}>
            <button type="button" className="task-close" onClick={() => { setRoomMemory(null); setTaskInput(""); }}>×</button>
            <p>
              {isChinese ? "输入英语：" : "Type the English words:"}<strong>{requiredTask}</strong>
            </p>
            <BilingualTypeCue
              english={requiredTask}
              chinese={taskChinese[requiredTask] ?? ""}
              value={taskInput}
              showEnglish={!isChinese}
              chineseParts={requiredTask === "drink coffee" ? ["喝", "咖啡"] : undefined}
            />
            <input
              autoFocus
              value={taskInput}
              onChange={(event) => setTaskInput(event.target.value)}
              placeholder="type the English words..."
            />
            <button>{isChinese ? "检查" : "Check"}</button>
            {taskWrong && <p className="scene-error">{isChinese ? "再试一次。" : "Try again."}</p>}
          </form>
        ) : hallwayStage === 1 ? (
          <div className="scene-choices">
            <p>{isChinese ? "你会帮助她吗？" : "Will Mason help her?"}</p>
            <button onClick={() => { setHallwayChoice("help"); setHallwayStage(2); }}>
              {isChinese ? "帮助那位女士" : "Help the older woman"}
            </button>
            <button onClick={() => { setHallwayChoice("leave"); setHallwayStage(2); }}>
              {isChinese ? "继续离开" : "Keep walking"}
            </button>
          </div>
        ) : !roomUnlocked && hallwayStage === null ? (
          <>
            <button className="scene-action" onClick={next}>
              {hasFinishedIntro ? (isChinese ? "下一步：探索" : "Next to explore") : (isChinese ? "继续" : "Continue")} <ArrowRight size={16} />
            </button>
          </>
        ) : hallwayStage !== null ? <p className="mt-4 text-sm text-white/65">{isChinese ? "点击任意位置继续" : "Click anywhere to continue"}</p> : null}
      </main>
    </div>
  );
}
