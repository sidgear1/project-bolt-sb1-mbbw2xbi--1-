import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { assetUrl } from "../utils/assetUrl";
import { useSpeech } from "../hooks/useSpeech";
import CombatPanel from "./CombatPanel";
import type { PlayerStats } from "./StatsPanel";

type Props = { onBack: () => void; onComplete: () => void };

const scenes = [
  // Source-of-truth order from David's `ai adventure/masked man` folders.
  "source/1 intro/11.png", "source/1 intro/12.png", "source/1 intro/13.png", "source/1 intro/14.png",
  "source/1 intro/15.png", "source/1 intro/16.png", "source/1 intro/17.png", "source/1 intro/18.png",
  "source/1 intro/19.png", "intro-video",
  "source/2 battle/21.png", "source/2 battle/22.png", "source/2 battle/23.png", "source/2 battle/24.png",
  "source/2 battle/25.png", "source/2 battle/26.png", "source/2 battle/27.png", "source/2 battle/28.png",
  "source/2 battle/29.png", "source/2 battle/210.png", "source/2 battle/211.png", "source/2 battle/212.png",
  "source/3 roam/31.png", "source/3 roam/32.png", "source/3 roam/33.png", "source/3 roam/34.png",
  "source/3 roam/35.png", "source/3 roam/36.png", "source/3 roam/37.png", "source/3 roam/38.png",
  "source/3 roam/39.png", "source/3 roam/331.png", "source/3 roam/332.png", "source/3 roam/333.png",
  "source/3 roam/334.png", "source/3 roam/335.png", "source/3 roam/336.png", "source/3 roam/337.png",
  "source/3 roam/338.png", "source/3 roam/339.png", "source/3 roam/340.png", "source/3 roam/341.png",
  "source/3 roam/342.png",
  "source/outside/a.png", "source/outside/a23.png", "source/outside/a24.png", "source/outside/a25.png",
  "source/outside/a26.png", "source/outside/a26 b.png", "source/outside/a27.png", "source/outside/a28.png",
  "source/outside/a29.png", "source/outside/a30.png", "source/outside/a31.png", "source/outside/a32.png",
  "source/outside/a41.png", "source/outside/a43.png", "source/outside/a44.png", "source/outside/a45.png",
  "source/outside/31.png", "source/outside/42.png",
];

const fullscreenScenes: Record<string, string> = {
  "a5.png": "a5-fullscreen-v2.png",
  "a7.png": "a7.png",
  "a18.png": "a18-fullscreen-v2.png",
  "a19 b.png": "a19b-fullscreen-v2.png",
  "a24.png": "a24-fullscreen-v2.png",
  "a25.png": "a25-fullscreen-v2.png",
  "a26.png": "a26-fullscreen-v2.png",
};

type CombatPhase = "none" | "intro" | "player_turn" | "enemy_turn" | "victory";
const battleFirstScene = "source/2 battle/21.png";
const battleLastScene = "source/2 battle/212.png";
const firstRoamScene = "source/3 roam/31.png";
const battleMusicStartScene = "source/2 battle/28.png";
const PLAYER_MAX_HP = 50;
const ENEMY_MAX_HP = 20;
const PLAYER_STATS: PlayerStats = { maxHp: PLAYER_MAX_HP, currentHp: PLAYER_MAX_HP, damageMin: 2, damageMax: 4, defense: 2, agility: 4, luck: 3, level: 1 };

const lines: Record<string, string> = {
  "source/1 intro/11.png": "Down here, you can get lost in the memories, shrouded in the shadows of the past. We become overburdened by the comfort of what was taken from us.",
  "source/1 intro/12.png": "Memories.",
  "source/1 intro/15.png": "I found a memory. A play with my friends. I collect these... of a world forgotten now, deep underground.",
  "source/3 roam/39.png": "You've been gone for too long. We have a meeting in the distance.",
};

function musicFor(scene: string) {
  if (scene.startsWith("source/3 roam/")) return "source/3 roam/a23 music.mp3";
  if (scene.startsWith("source/outside/")) return "source/a16 msuic Broken Staircase (Quiet Subtle Version) (1).mp3";
  return "source/2 battle/a8 batle music .mp3";
}

export function MaskedManAdventure({ onBack, onComplete }: Props) {
  const started = true;
  const [answer, setAnswer] = useState("");
  const [index, setIndex] = useState(0);
  const [combatPhase, setCombatPhase] = useState<CombatPhase>("none");
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);
  const [enemyHp, setEnemyHp] = useState(ENEMY_MAX_HP);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [parryReady, setParryReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingSourceRef = useRef<string | null>(null);
  const { speak, cancel } = useSpeech();
  const scene = scenes[index];
  const hasCombat = true;
  const inCombat = hasCombat && combatPhase !== "none";
  // The supplied music handoff is exact: tunnel ambience at 11–17, then
  // battle music starts on intro image 18.
  const hasTunnelAmbience = false;
  const hasSceneMusic = index >= scenes.indexOf(battleMusicStartScene);
  const isIntroVideo = scene === "intro-video";

  useEffect(() => {
    // Entering the chapter must begin silent except for the tunnel bed. This
    // also clears a track left over from a hot reload or a previous scene.
    audioRef.current?.pause();
    audioRef.current = null;
    playingSourceRef.current = null;
  }, []);

  useEffect(() => {
    // The opening is intentionally quiet apart from the tunnel ambience below.
    // Music starts only once the encounter has begun.
    if (!hasSceneMusic) {
      audioRef.current?.pause();
      audioRef.current = null;
      playingSourceRef.current = null;
      return;
    }
    const source = assetUrl(`scenes/masked-man/${musicFor(scene)}`);
    if (playingSourceRef.current === source) return;
    const audio = new Audio(source);
    audio.loop = true;
    audio.volume = scene.startsWith("source/2 battle/") ? 0.38 : 0.23;
    audioRef.current?.pause();
    audioRef.current = audio;
    playingSourceRef.current = source;
    void audio.play().catch(() => undefined);
  }, [scene, hasSceneMusic]);

  useEffect(() => {
    if (!hasTunnelAmbience) return;

    // An empty underground tunnel: low air pressure, long reflections, and
    // irregular water drops whose echoes reveal the size of the space.
    const context = new window.AudioContext();
    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let sample = 0; sample < samples.length; sample += 1) {
      previous = (previous * 0.985) + ((Math.random() * 2 - 1) * 0.015);
      samples[sample] = previous;
    }
    const source = context.createBufferSource();
    const lowPass = context.createBiquadFilter();
    const gain = context.createGain();
    const echo = context.createDelay(2.5);
    const feedback = context.createGain();
    const echoFilter = context.createBiquadFilter();
    source.buffer = buffer;
    source.loop = true;
    lowPass.type = "lowpass";
    lowPass.frequency.value = 360;
    lowPass.Q.value = 0.45;
    gain.gain.value = 0.09;
    echo.delayTime.value = 0.95;
    feedback.gain.value = 0.52;
    echoFilter.type = "lowpass";
    echoFilter.frequency.value = 1150;
    source.connect(lowPass).connect(gain);
    gain.connect(context.destination);
    gain.connect(echo);
    echo.connect(echoFilter).connect(context.destination);
    echoFilter.connect(feedback).connect(echo);
    source.start();
    void context.resume().catch(() => undefined);

    let stopped = false;
    let dripTimer: number | undefined;
    const scheduleDrip = () => {
      if (stopped) return;
      const oscillator = context.createOscillator();
      const dripGain = context.createGain();
      const now = context.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1120 + Math.random() * 480, now);
      oscillator.frequency.exponentialRampToValueAtTime(290 + Math.random() * 100, now + 0.17);
      dripGain.gain.setValueAtTime(0.0001, now);
      dripGain.gain.exponentialRampToValueAtTime(0.07 + Math.random() * 0.035, now + 0.012);
      dripGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
      oscillator.connect(dripGain);
      dripGain.connect(context.destination);
      dripGain.connect(echo);
      oscillator.start(now);
      oscillator.stop(now + 0.38);
      dripTimer = window.setTimeout(scheduleDrip, 2600 + Math.random() * 4400);
    };
    dripTimer = window.setTimeout(scheduleDrip, 1100);

    return () => {
      stopped = true;
      if (dripTimer !== undefined) window.clearTimeout(dripTimer);
      source.stop();
      source.disconnect();
      lowPass.disconnect();
      gain.disconnect();
      echo.disconnect();
      feedback.disconnect();
      echoFilter.disconnect();
      void context.close();
    };
  }, [hasTunnelAmbience]);

  useEffect(() => {
    const line = lines[scene];
    if (line) speak(line, "adventure");
    return cancel;
  }, [scene, speak, cancel]);

  useEffect(() => () => audioRef.current?.pause(), []);

  useEffect(() => {
    if (!hasCombat || !started || scene !== battleLastScene || combatPhase !== "none") return;
    setPlayerHp(PLAYER_MAX_HP);
    setEnemyHp(ENEMY_MAX_HP);
    setCombatLog([]);
    setParryReady(false);
    setCombatPhase("intro");
  }, [scene, combatPhase]);

  useEffect(() => {
    if (combatPhase !== "intro") return;
    const timer = window.setTimeout(() => {
      setCombatPhase("player_turn");
    }, 450);
    return () => window.clearTimeout(timer);
  }, [combatPhase]);

  useEffect(() => {
    if (combatPhase !== "enemy_turn") return;
    const hitTimer = window.setTimeout(() => {
      const damage = parryReady ? 3 : 10;
      setPlayerHp((hp) => Math.max(0, hp - damage));
      setCombatLog((log) => [...log.slice(-3), parryReady ? "Parry! You deflect the blow and take only 3 damage." : "The monster strikes you for 10 damage!"]);
      setParryReady(false);
    }, 500);
    const returnTimer = window.setTimeout(() => {
      setCombatPhase("player_turn");
    }, 1200);
    return () => {
      window.clearTimeout(hitTimer);
      window.clearTimeout(returnTimer);
    };
  }, [combatPhase]);

  useEffect(() => {
    if (combatPhase !== "victory") return;
    const timer = window.setTimeout(() => {
      setIndex(scenes.indexOf(firstRoamScene));
      setCombatPhase("none");
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [combatPhase]);

  const advance = () => {
    if (index === scenes.length - 1) onComplete();
    else setIndex((current) => current + 1);
  };
  // Kept only for the unreachable legacy screen below while existing saves
  // are migrated; every new Masked Man run starts directly in the intro.
  const begin = () => undefined;
  const attack = () => {
    if (combatPhase !== "player_turn") return;
    const damage = Math.min(enemyHp, Math.floor(Math.random() * 3) + 2);
    const nextHp = Math.max(0, enemyHp - damage);
    setEnemyHp(nextHp);
    setCombatLog((log) => [...log.slice(-3), `You attack the monster for ${damage} damage!`]);
    setCombatPhase(nextHp === 0 ? "victory" : "enemy_turn");
  };
  const parry = () => {
    if (combatPhase !== "player_turn") return;
    setParryReady(true);
    setCombatLog((log) => [...log.slice(-3), "Parry ready — the next 10 damage hit becomes 3 damage."]);
    setCombatPhase("enemy_turn");
  };

  if (!started) return <div className="fixed inset-0 grid place-items-center bg-black p-5 text-center text-white">
    <main className="max-w-xl space-y-6">
      <p className="text-xl leading-relaxed text-white/85">A voice in the darkness says: “I've been lost down here for so long, in the memories of the past. I need to return to the light, before I forget myself.”</p>
      <form onSubmit={begin} className="flex flex-col gap-3 sm:flex-row">
        <input autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Type the word..." className="min-w-0 flex-1 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-center text-lg outline-none focus:border-amber-300" />
        <button className="rounded-xl bg-amber-300 px-5 py-3 font-bold text-slate-950">Enter the light</button>
      </form>
      {answer && answer.trim().toLowerCase() !== "light" && <p className="text-sm text-rose-300">Listen carefully. The way forward is one word.</p>}
    </main>
  </div>;

  return <div className="fixed inset-0 overflow-hidden bg-black text-white">
    {isIntroVideo ? (
      <video
        key={scene}
        src={assetUrl("scenes/masked-man/source/1 intro/masked man.mp4")}
        autoPlay
        playsInline
        controls
        onEnded={() => setIndex(scenes.indexOf(battleFirstScene))}
        onError={() => setIndex(scenes.indexOf(battleFirstScene))}
        className="absolute inset-0 h-full w-full object-contain"
      />
    ) : (
      <img src={assetUrl(`scenes/masked-man/${fullscreenScenes[scene] ?? scene}`)} alt={`Masked Man scene ${index + 1}`} className={`absolute inset-0 h-full w-full ${fullscreenScenes[scene] ? "object-cover" : "object-contain"}`} />
    )}
    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/35" />
    <header className="scene-header"><button onClick={onBack}>Map</button><span>Masked Man · {index + 1}/{scenes.length}</span></header>
    {!inCombat && !isIntroVideo && <main className="absolute bottom-0 left-1/2 w-full max-w-3xl -translate-x-1/2 p-5 text-center md:p-8">
      {lines[scene] && <p className="mb-4 text-lg font-medium leading-relaxed text-white md:text-2xl">{lines[scene]}</p>}
      <button onClick={advance} className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 font-bold text-slate-950 shadow-lg hover:bg-amber-200">
        {index === scenes.length - 1 ? "Return to the map" : <>Continue <ArrowRight size={19} /></>}
      </button>
    </main>}
    {inCombat && <CombatPanel combatPhase={combatPhase as Exclude<CombatPhase, "none">} playerHp={playerHp} playerMaxHp={PLAYER_MAX_HP} enemyHp={enemyHp} enemyMaxHp={ENEMY_MAX_HP} combatLog={combatLog} stats={{ ...PLAYER_STATS, currentHp: playerHp }} onAttack={attack} onParry={parry} parryReady={parryReady} />}
  </div>;
}
