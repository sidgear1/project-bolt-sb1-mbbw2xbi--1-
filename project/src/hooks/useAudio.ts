import { useEffect, useRef, useCallback, useState } from 'react';
import { assetUrl } from '../utils/assetUrl';

/** Plays the opening-cafe music until the intro sequence ends. */
export function useCafeMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause(); audio.currentTime = 0; audioRef.current = null; setPlaying(false);
  }, []);
  const start = useCallback(() => {
    if (audioRef.current) return;
    const audio = new Audio(assetUrl('music/silent-tension.mp3'));
    audio.loop = true; audio.volume = 0.3; audioRef.current = audio;
    audio.play().then(() => setPlaying(true)).catch(() => { /* a player interaction may be required */ });
  }, []);
  const fadeOut = useCallback((durationSecs = 3) => {
    const audio = audioRef.current;
    if (!audio) return;
    const initial = audio.volume, started = performance.now();
    const fade = (now: number) => { const amount = Math.min(1, (now - started) / (durationSecs * 1000)); audio.volume = initial * (1 - amount); if (amount < 1) requestAnimationFrame(fade); else stop(); };
    requestAnimationFrame(fade);
  }, [stop]);
  useEffect(() => stop, [stop]);
  return { start, stop, fadeOut, playing };
}

export function useAmbientAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);
  const masterRef = useRef<GainNode | null>(null);
  const [playing, setPlaying] = useState(false);

  const stop = useCallback(() => {
    nodesRef.current.forEach((n) => {
      try { (n as OscillatorNode | AudioBufferSourceNode).stop?.(); } catch { /* already stopped */ }
    });
    nodesRef.current = [];
    ctxRef.current?.close();
    ctxRef.current = null;
    masterRef.current = null;
    setPlaying(false);
  }, []);

  const start = useCallback(() => {
    if (ctxRef.current) return;

    const ctx = new AudioContext();
    ctxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 3);
    master.connect(ctx.destination);
    masterRef.current = master;

    // Slow tremolo LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain);
    lfo.start();
    nodesRef.current.push(lfo);

    const createDrone = (freq: number, vol: number, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = vol;
      lfoGain.connect(g.gain);
      osc.connect(g);
      g.connect(master);
      osc.start();
      nodesRef.current.push(osc);
    };

    // Ominous minor cluster in audible range — all speakers should reproduce these
    createDrone(82.4, 0.45);      // E2 — deep
    createDrone(87.3, 0.30);      // F2 — minor second creates dissonance + ~4.9Hz beating
    createDrone(110.0, 0.20);     // A2 — minor third above E
    createDrone(123.5, 0.15);     // B2 — tritone from F — very eerie
    createDrone(164.8, 0.12);     // E3 — octave reinforcement

    // Filtered noise layer — adds texture
    const bufferSize = ctx.sampleRate * 6;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 250;
    filter.Q.value = 0.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.06;
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();
    nodesRef.current.push(noise);

    setPlaying(true);
  }, []);

  const fadeOut = useCallback((durationSecs = 3) => {
    if (!masterRef.current || !ctxRef.current) return;
    const now = ctxRef.current.currentTime;
    masterRef.current.gain.linearRampToValueAtTime(0, now + durationSecs);
    setTimeout(stop, durationSecs * 1000 + 100);
  }, [stop]);

  // Resume AudioContext when tab becomes visible again (prevents "game pause" on tab switch)
  useEffect(() => {
    const handleVisibility = () => {
      const ctx = ctxRef.current;
      if (ctx && document.visibilityState === 'visible' && ctx.state === 'suspended') {
        ctx.resume();
      }
    };
    // Also resume on any user interaction in case browser suspended it
    const handleInteraction = () => {
      const ctx = ctxRef.current;
      if (ctx?.state === 'suspended') ctx.resume();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('click', handleInteraction);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('click', handleInteraction);
    };
  }, []);

  // Keep-alive: check every 15s and resume if suspended
  useEffect(() => {
    const id = setInterval(() => {
      const ctx = ctxRef.current;
      if (ctx?.state === 'suspended') ctx.resume();
    }, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => { stop(); }, [stop]);

  return { start, stop, fadeOut, playing };
}
