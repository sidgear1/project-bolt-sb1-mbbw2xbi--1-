import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { assetUrl } from "../utils/assetUrl";
import { useLanguage } from "../i18n";
import { preloadGeneratedSpeech, useSpeech } from "../hooks/useSpeech";
import { LiveAnswerLetters } from "./LiveTypingFeedback";
import { preloadSceneWindow } from "../utils/imagePreloader";
import { recordDailyLearnedWords } from "../utils/learningProgress";
import SmoothSceneImage from "./SmoothSceneImage";

// The original track supplied alongside the Masked Baron image sequence.
const MASKED_BARON_MUSIC = assetUrl("audio/masked-baron-video-project-21.mp3");

const legacyScenes = [
  { image: "1.png", text: "艾德伍德的灯火渐渐熄灭，拉斯皮静静地坐在墙上，看着下面的村庄。", english: "As Elderwoods falls asleep, Raspy sits quietly on the wall, watching the village below.", word: "view", chinese: "看", korean: "보다" },
  { image: "2.png", text: "但是，一个蒙面人进入了画面。他打开门后非法闯了进去。拉斯皮决定跟随他。", english: "But then a masked figure enters the scene. He opens the door and enters unlawfully. Raspy decides to follow." },
  { image: "7.png", text: "他走进黑暗，继续追寻。", english: "He steps into the darkness and continues the pursuit." },
] as const;

const scenes = [
  { image: "1a.png", text: "As Elderwoods begins its descent into slumber, there sits one lone figure whose vigilance over the suburbs never sleeps.", english: "As Elderwoods begins its descent into slumber, there sits one lone figure whose vigilance over the suburbs never sleeps." },
  { image: "1b.png", text: "Here we see our hero Raspy sitting perched on a nearby wall.", english: "Here we see our hero Raspy sitting perched on a nearby wall." },
  { image: "1.png", text: "", english: "", word: "sitting", chinese: "坐", korean: "앉다" },
  { image: "2.png", text: "But suddenly, at that moment, a masked figure enters the scene.", english: "But suddenly, at that moment, a masked figure enters the scene." },
  { image: "3.png", text: "He makes his way over to the nearby emergency door.", english: "He makes his way over to the nearby emergency door." },
  { image: "4.png", text: "He carefully opens the back door with his lock picks.", english: "He carefully opens the back door with his lock picks." },
  { image: "5-v2.png", text: "", english: "" },
  { image: "6.png", text: "", english: "", word: "follow", chinese: "跟随", korean: "따라가다" },
  { image: "7.png", text: "Raspy decides to follow this masked man, for better or for worse.", english: "Raspy decides to follow this masked man, for better or for worse." },
] as const;

const VIEW_SCENE_INDEX = 2;
const FOLLOW_SCENE_INDEX = 7;

export function MaskedBaronAdventure({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const [index, setIndex] = useState(0);
  const [viewOpened, setViewOpened] = useState(false);
  const [viewNarrated, setViewNarrated] = useState(false);
  const [followOpened, setFollowOpened] = useState(false);
  const [followNarrated, setFollowNarrated] = useState(false);
  const [input, setInput] = useState("");
  const [wrong, setWrong] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const [romanisation, setRomanisation] = useState(() => localStorage.getItem("taletalk-romanisation-enabled") === "true");
  const { isChinese } = useLanguage();
  const { speak } = useSpeech();
  const scene = scenes[index];
  useEffect(() => {
    preloadSceneWindow(scenes.map(item => assetUrl(`scenes/masked-baron/${item.image}`)), index, 12);
  }, [index]);
  useEffect(() => {
    scenes.forEach(item => { if (item.english) preloadGeneratedSpeech(item.english, "adventure"); });
    preloadGeneratedSpeech("앉다", "female");
    preloadGeneratedSpeech("따라가다", "female");
  }, []);
  const next = () => index < scenes.length - 1 ? setIndex(value => value + 1) : onComplete();
  const toggleRomanisation = () => { const enabled = !romanisation; setRomanisation(enabled); localStorage.setItem("taletalk-romanisation-enabled", String(enabled)); window.dispatchEvent(new CustomEvent("taletalk-romanisation-change", { detail: enabled })); };
  const maskedBaronMusic = () => {
    if (!musicRef.current) {
      musicRef.current = new Audio(MASKED_BARON_MUSIC);
      musicRef.current.preload = "auto";
      musicRef.current.loop = true;
    }
    return musicRef.current;
  };
  useEffect(() => {
    const music = maskedBaronMusic();
    music.load();
  }, []);
  const primeMaskedBaronMusic = () => {
    const music = maskedBaronMusic();
    music.currentTime = 0;
    music.muted = false;
    music.volume = 0;
    void music.play().catch(() => undefined);
  };
  const unlockMaskedBaronWord = (word: string) => {
    const slot = Number(localStorage.getItem("taletalk_active_save_slot") ?? "1");
    const sceneKey = `taletalk-slot-${slot}-scene-masked-baron-words`;
    const globalKey = `taletalk-slot-${slot}-unlocked-words`;
    const sceneWords = new Set<string>(JSON.parse(localStorage.getItem(sceneKey) ?? "[]"));
    const globalWords = new Set<string>(JSON.parse(localStorage.getItem(globalKey) ?? "[]"));
    sceneWords.add(word);
    globalWords.add(word);
    localStorage.setItem(sceneKey, JSON.stringify([...sceneWords].sort()));
    localStorage.setItem(globalKey, JSON.stringify([...globalWords].sort()));
    recordDailyLearnedWords([word], slot);
    window.dispatchEvent(new Event("taletalk-words-changed"));
  };
  const completeViewTask = () => {
    // Prepare playback inside the player's gesture, but keep it silent until
    // Image four appears after the Sitting answer has finished speaking.
    primeMaskedBaronMusic();
    unlockMaskedBaronWord("앉다");
    setInput("");
    setWrong(false);
    setViewNarrated(true);
    speak("앉다", "female", () => setIndex(VIEW_SCENE_INDEX + 1));
  };
  const completeFollowTask = () => {
    unlockMaskedBaronWord("따라가다");
    setInput("");
    setWrong(false);
    setFollowNarrated(true);
    speak("따라가다", "female", () => setIndex(FOLLOW_SCENE_INDEX + 1));
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const answer = input.trim().toLowerCase().replace(/[\s-]/g, "");
    if (index === FOLLOW_SCENE_INDEX) {
      if (answer !== "따라가다" && answer !== "ttaragada") { setWrong(true); return; }
      completeFollowTask();
      return;
    }
    if (answer !== "앉다" && answer !== "anjda" && answer !== "antda") { setWrong(true); return; }
    completeViewTask();
  };

  useEffect(() => { const sync = (event: Event) => setRomanisation(Boolean((event as CustomEvent<boolean>).detail)); window.addEventListener("taletalk-romanisation-change", sync); return () => window.removeEventListener("taletalk-romanisation-change", sync); }, []);
  const makeMaskedBaronMusicAudible = () => {
    const music = maskedBaronMusic();
    music.muted = false;
    music.volume = .75;
    void music.play().catch(() => undefined);
  };
  useEffect(() => {
    if (index <= VIEW_SCENE_INDEX) return;
    window.addEventListener("pointerdown", makeMaskedBaronMusicAudible, { capture: true });
    window.addEventListener("keydown", makeMaskedBaronMusicAudible, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", makeMaskedBaronMusicAudible, { capture: true });
      window.removeEventListener("keydown", makeMaskedBaronMusicAudible, { capture: true });
    };
  }, [index]);
  useEffect(() => () => { musicRef.current?.pause(); if (musicRef.current) musicRef.current.currentTime = 0; }, []);
  useEffect(() => { if (index !== VIEW_SCENE_INDEX && scene.english) speak(scene.english, "adventure"); }, [index, scene, speak]);
  useEffect(() => { const skip = (event: KeyboardEvent) => { if (event.key !== "ArrowRight") return; if (index === VIEW_SCENE_INDEX && !viewNarrated) { if (viewOpened) { event.preventDefault(); completeViewTask(); } return; } if (index === FOLLOW_SCENE_INDEX && !followNarrated) { if (followOpened) { event.preventDefault(); completeFollowTask(); } return; } event.preventDefault(); next(); }; window.addEventListener("keydown", skip); return () => window.removeEventListener("keydown", skip); }, [index, viewNarrated, viewOpened, followNarrated, followOpened]);

  const viewTaskOpen = index === VIEW_SCENE_INDEX && viewOpened && !viewNarrated;
  const followTaskOpen = index === FOLLOW_SCENE_INDEX && followOpened && !followNarrated;
  const taskOpen = viewTaskOpen || followTaskOpen;
  const taskEnglish = followTaskOpen ? "Follow" : "Sitting";
  const taskKorean = followTaskOpen ? "따라가다" : "앉다";
  const taskRomanisation = followTaskOpen ? "Ttaragada" : "Anjda";
  useEffect(() => { if (taskOpen) speak(taskKorean, "female"); }, [taskOpen, taskKorean, speak]);
  return <div className="masked-baron-adventure cop-adventure fixed inset-0 overflow-hidden bg-black" onClick={event => {
    if (event.target instanceof HTMLElement && event.target.closest("button,input,form,label")) return;
    if (taskOpen || (index === VIEW_SCENE_INDEX && !viewNarrated) || (index === FOLLOW_SCENE_INDEX && !followNarrated)) return;
    next();
  }}>
    <SmoothSceneImage
      src={assetUrl(`scenes/masked-baron/${scene.image}`)}
      alt={`The Masked Baron scene ${index + 1}`}
      data-story-image-number={index + 1}
      className="absolute inset-0 h-full w-full object-cover brightness-130 contrast-105"
      draggable={false}
      onDisplayed={() => { if (index === VIEW_SCENE_INDEX + 1) makeMaskedBaronMusicAudible(); }}
    /><div className="absolute inset-0 bg-black/5" />
    <header className="scene-header"><button onClick={onBack}>{isChinese ? "地图" : "Map"}</button></header>
    {index === VIEW_SCENE_INDEX && !viewOpened && <button className="map-memory-point" style={{ left: "42.8%", top: "47.9%", zIndex: 5 }} onClick={event => { event.stopPropagation(); setViewOpened(true); }} aria-label="Sitting"><span className="hotspot-pulse" /><span className="map-memory-badge">Sitting</span></button>}
    {index === FOLLOW_SCENE_INDEX && !followOpened && <button className="map-memory-point" style={{ left: "95.8%", top: "85%", zIndex: 5 }} onClick={event => { event.stopPropagation(); setFollowOpened(true); }} aria-label="Follow the masked man"><span className="hotspot-pulse" /><span className="map-memory-badge">Follow</span></button>}
    {(taskOpen || Boolean(scene.english)) && <main data-task-editor-panel={taskOpen ? "masked-baron-view" : undefined} className={taskOpen ? "shop-task-frame absolute bottom-[2.5%] left-1/2 z-10 w-[min(30rem,calc(100%-2rem))] -translate-x-1/2" : "scene-panel cop-dialogue-panel story-dialogue-panel"}>
      {taskOpen ? <div className="shop-task-box shared-task-bar-ui rounded-2xl border border-white/10 px-4 pb-3 pt-3">
        <span data-task-editor-item="instruction" className="block w-fit text-[#c4942a] text-[11px] uppercase tracking-[0.12em] font-semibold">Type the Korean word using the keyboard</span>
        <p data-task-editor-item="english-cue" className="mt-1 text-sm text-white/60">{taskEnglish}</p>
        <div data-task-editor-item="korean-answer" className="my-2 flex gap-0.5 text-2xl font-semibold tracking-[0.2em]"><button type="button" onClick={() => speak(taskKorean, "female")} className="inline-flex items-center gap-2 text-white/45 hover:text-white" aria-label={`Hear ${taskKorean}`}><LiveAnswerLetters target={taskKorean} value={/[가-힣]/.test(input) ? input : ""} neutralClassName="text-white/45" /><Volume2 size={19} className="text-[#f6d46b]" /></button></div>
        {romanisation && <p data-task-editor-item="romanisation-cue" className="mb-2 text-sm font-semibold"><LiveAnswerLetters target={taskRomanisation} value={/[a-z]/i.test(input) ? input : ""} neutralClassName="text-[#f6d46b]" /></p>}
        <form data-task-editor-item="answer-form" onSubmit={submit} className="flex gap-2"><input autoFocus value={input} onChange={event => setInput(event.target.value)} placeholder="Type the Korean word..." className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none" /><button className="rounded-lg border border-white/20 bg-white/10 px-4 text-xs text-white">Check</button></form>{wrong && <p data-task-editor-item="error-message" className="mt-2 text-xs text-red-400">Try again.</p>}
      </div> : <div className="cop-dialogue-content"><div className="scene-eyebrow"><span className="cop-narrator-dot" />Narrator</div><h1>{scene.english}</h1><div className="cop-narration-footer"><span>click anywhere to continue</span><button onClick={event => { event.stopPropagation(); speak(scene.english, "adventure"); }}><Volume2 size={12} /> Listen</button></div></div>}
    </main>}
  </div>;
}
