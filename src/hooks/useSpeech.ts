import { useRef, useCallback, useEffect, useState } from 'react';

export type VoiceGender = 'male' | 'female' | 'character' | 'bella' | 'josh' | 'shopkeeper' | 'busWoman' | 'wife' | 'adventure' | 'tammyNarrator';
type SpeechLanguage = 'en' | 'zh' | 'ko';

export interface SpeechSegment {
  text: string;
  lang: SpeechLanguage;
}

function pickVoice(gender: VoiceGender, language: SpeechLanguage): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

  const preferredEnglishVoice = (candidates: SpeechSynthesisVoice[], preferredNames: string[]) =>
    candidates.find((voice) => preferredNames.some((name) => voice.name.toLowerCase().includes(name)))
    ?? candidates.find((voice) => /\b(online|natural|neural|enhanced)\b/i.test(voice.name));

  if (language === 'zh' || language === 'ko') {
    const matchingVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(language));
    return matchingVoices.find((v) => v.name.toLowerCase().includes(gender === 'female' ? 'female' : 'male'))
      ?? matchingVoices[0]
      ?? null;
  }

  if (gender === 'female') {
    const enVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    return preferredEnglishVoice(enVoices, ['aria', 'ava', 'emma', 'jenny', 'libby', 'sonia', 'hazel', 'zira'])
      ?? enVoices[0]
      ?? voices[0]
      ?? null;
  }

  if (gender === 'character') {
    const enVoices = voices.filter((v) => v.lang.startsWith('en'));
    return enVoices[0] ?? voices[0] ?? null;
  }

  // Male — narrator, English voice
  const enVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  return preferredEnglishVoice(enVoices, [
    'guy', 'brian', 'ryan', 'davis', 'andrew', 'george', 'oliver', 'james', 'david', 'mark',
  ]) ?? enVoices[0] ?? voices[0] ?? null;
}

const ELEVENLABS_VOICES = {
  narrator: 'JBFqnCBsd6RMkjVDRZzb',
  narratorChinese: 'Xb7hH8MSUJpSbSDYk0k2',
  bella: 'cgSgspJ2msm6clMCkdW9',
  josh: 'IKne3meq5aSn9XLyUdCD',
  shopkeeper: 'EXAVITQu4vr4xnSDxMaL',
  busWoman: '21m00Tcm4TlvDq8ikWAM',
  wife: 'AZnzlk1XvdvUeBnXmlld',
  adventure: 'VR6AewLTigWG4xSOukaG',
  tammyNarrator: 'VR6AewLTigWG4xSOukaG',
} as const;

function voiceFileId(text: string, voice: VoiceGender, language: SpeechLanguage): string {
  let hash = 2166136261;
  // Ordinary Korean vocabulary deliberately keeps the original `ko:text`
  // filename so it uses the preferred female voice. Character dialogue gets
  // a speaker-specific filename, preventing Josh/Bella/shopkeeper recordings
  // of the same Korean phrase from overwriting or reusing one another.
  const koreanCharacterVoice = language === 'ko' && ['bella', 'josh', 'shopkeeper', 'busWoman', 'wife'].includes(voice);
  const fileKey = voice === 'bella' || voice === 'tammyNarrator' || koreanCharacterVoice ? `${language}:${voice}:${text}` : `${language}:${text}`;
  for (const char of fileKey) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `line-${language}-${(hash >>> 0).toString(36)}`;
}

// These Sports Day recordings use cache-busted filenames. Several older files
// had been generated against the wrong prompt, so they must never be reused by
// a browser cache when the matching Korean action is requested.
const SPORTS_KOREAN_VOICE_FILES: Record<string, string> = {
  '시작하다': 'line-ko-eslfak-sports-v2',
  '달리다': 'line-ko-r0vli9-sports-v2',
  '뛰다': 'line-ko-1imj5h7-sports-v2',
  '오르다': 'line-ko-1es4o5t-sports-v2',
  '걷다': 'line-ko-1mkt038-sports-v2',
  '줍다': 'line-ko-2ydxsm-sports-v2',
  '나르다': 'line-ko-1x8dsf9-sports-v2',
  '내려놓다': 'line-ko-r353ao-sports-v2',
  '끝내다': 'line-ko-u50xhy-sports-v2',
};

const generatedSpeechPreloads = new Map<string, HTMLAudioElement>();

function createPreparedAudio(file: string) {
  const audio = new Audio();
  audio.preload = 'auto';
  audio.src = file;
  audio.load();
  return audio;
}

function speechLanguage(text: string): SpeechLanguage {
  return /[\uac00-\ud7af]/.test(text) ? 'ko' : /[\u3400-\u9fff]/.test(text) ? 'zh' : 'en';
}

function generatedVoiceAssetId(text: string, voice: VoiceGender, language = speechLanguage(text)) {
  return language === 'ko' && SPORTS_KOREAN_VOICE_FILES[text]
    ? SPORTS_KOREAN_VOICE_FILES[text]
    : language === 'ko' && text === '미안해'
        ? 'line-ko-1kv8nsp-elevenlabs-v2'
        : voiceFileId(text, voice, language);
}

export function preloadGeneratedSpeech(text: string, voice: VoiceGender) {
  if (typeof Audio === 'undefined') return '';
  const language = speechLanguage(text);
  const file = `${import.meta.env.BASE_URL}audio/voices/${generatedVoiceAssetId(text, voice, language)}.mp3`;
  if (!generatedSpeechPreloads.has(file)) {
    generatedSpeechPreloads.set(file, createPreparedAudio(file));
  }
  return file;
}

function acquireGeneratedSpeech(text: string, voice: VoiceGender) {
  const file = preloadGeneratedSpeech(text, voice);
  const prepared = generatedSpeechPreloads.get(file) ?? createPreparedAudio(file);
  // Consume the already-buffering element itself. A fresh prepared copy is
  // immediately queued for Listen/replay without delaying this playback.
  generatedSpeechPreloads.set(file, createPreparedAudio(file));
  prepared.currentTime = 0;
  return { file, audio: prepared };
}

export function parseTextForSpeech(rawText: string): SpeechSegment[] {
  const segments: SpeechSegment[] = [];
  const regex = /\{([^:}]+):[^}]+\}/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: rawText.slice(lastIndex, match.index), lang: 'en' });
    }
    segments.push({ text: match[1], lang: 'en' });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < rawText.length) {
    segments.push({ text: rawText.slice(lastIndex), lang: 'en' });
  }
  return segments.filter((s) => s.text.trim().length > 0);
}

export function useSpeech() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('taletalk-sound-muted') !== 'true');
  const cancelledRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    requestRef.current?.abort();
    requestRef.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    const syncSound = (event: Event) => {
      const muted = Boolean((event as CustomEvent<boolean>).detail);
      if (muted) cancel();
      setEnabled(!muted);
    };
    window.addEventListener('taletalk-sound-change', syncSound);
    return () => window.removeEventListener('taletalk-sound-change', syncSound);
  }, [cancel]);

  // Every adventure owns its narration. When the player leaves that scene,
  // stop its ElevenLabs file and any native fallback immediately.
  useEffect(() => () => {
    cancelledRef.current = true;
    requestRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    speechSynthesis.cancel();
  }, []);

  const speakUtterance = (text: string, gender: VoiceGender, onEnd?: () => void, language: SpeechLanguage = speechLanguage(text)) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const nativeGender: 'male' | 'female' | 'character' = gender === 'bella' || gender === 'shopkeeper' || gender === 'busWoman' || gender === 'wife' ? 'female' : gender === 'josh' || gender === 'adventure' || gender === 'tammyNarrator' ? 'male' : gender;

    if (language === 'zh' || language === 'ko') {
      utterance.lang = language === 'ko' ? 'ko-KR' : 'zh-CN';
      utterance.pitch = nativeGender === 'female' ? 1.08 : 0.92;
      utterance.rate = 0.92;
      utterance.volume = 1.0;
    } else if (nativeGender === 'male') {
      // Deep, attractive, powerful English narrator
      utterance.lang = 'en-GB';
      utterance.pitch = 0.4;
      utterance.rate = 0.95;
      utterance.volume = 1.0;
    } else if (nativeGender === 'character') {
      // Panicked character — English voice, higher pitch, faster
      utterance.lang = 'en-GB';
      utterance.pitch = 1.35;
      utterance.rate = 1.05;
      utterance.volume = 1.0;
    } else {
      // English female voice for character speech
      utterance.lang = 'en-GB';
      utterance.pitch = 1.15;
      utterance.rate = 0.9;
      utterance.volume = 1.0;
    }

    const voice = pickVoice(nativeGender, language);
    if (voice) utterance.voice = voice;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onEnd?.();
    };
    utterance.onend = finish;
    utterance.onerror = finish;

    const { file, audio } = acquireGeneratedSpeech(text, gender);
    audioRef.current = audio;
    audio.onended = () => { if (audioRef.current === audio) audioRef.current = null; finish(); };
    let retryTimer: number | null = null;
    let retryAttempts = 0;
    let playPending = false;
    const removeGestureRetry = () => {
      window.removeEventListener('pointerdown', retryFromGesture, true);
      window.removeEventListener('keydown', retryFromGesture, true);
    };
    const retryFromGesture = () => {
      removeGestureRetry();
      tryGeneratedAudio();
    };
    const queueRetry = () => {
      if (audioRef.current !== audio || cancelledRef.current || retryTimer !== null) return;
      if (retryAttempts >= 1) {
        audio.onerror = null;
        audioRef.current = null;
        // A newly authored line may not have an ElevenLabs file yet. Fall
        // back once to the best installed native voice so narration still
        // plays and completion callbacks can never leave the UI locked.
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
        return;
      }
      retryAttempts += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        if (audioRef.current !== audio || cancelledRef.current) return;
        audio.load();
        tryGeneratedAudio();
      }, 900);
    };
    const tryGeneratedAudio = () => {
      if (audioRef.current !== audio || cancelledRef.current || playPending || !file) return;
      playPending = true;
      audio.play().then(() => {
        playPending = false;
        removeGestureRetry();
      }).catch((error: DOMException) => {
        playPending = false;
        if (audioRef.current !== audio || cancelledRef.current) return;
        if (error?.name === 'NotAllowedError') {
          window.addEventListener('pointerdown', retryFromGesture, { capture: true, once: true });
          window.addEventListener('keydown', retryFromGesture, { capture: true, once: true });
          return;
        }
        queueRetry();
      });
    };
    audio.onerror = queueRetry;
    audio.load();
    tryGeneratedAudio();
  };

  const speakSegmented = useCallback(
    (segments: SpeechSegment[], onEnd?: () => void) => {
      if (!enabled) { onEnd?.(); return; }
      cancel();
      cancelledRef.current = false;

      let index = 0;
      const next = () => {
        if (cancelledRef.current || index >= segments.length) { onEnd?.(); return; }
        const seg = segments[index++];
        const gender: VoiceGender = 'male';
        speakUtterance(seg.text, gender, next, seg.lang);
      };

      next();
    },
    [enabled, cancel]
  );

  const speak = useCallback(
    (text: string, gender: VoiceGender, onEnd?: () => void) => {
      if (!enabled) { onEnd?.(); return; }
      cancel();
      cancelledRef.current = false;

      const doIt = () => {
        if (gender !== 'male') {
          speakUtterance(text, gender, onEnd);
        } else {
          // Narrator — all vocabulary is now spoken in English.
          const segs = parseTextForSpeech(text);
          let idx = 0;
          const next = () => {
            if (cancelledRef.current || idx >= segs.length) { onEnd?.(); return; }
            const s = segs[idx++];
            speakUtterance(s.text, 'male', next);
          };
          next();
        }
      };

      doIt();
    },
    [enabled, cancel]
  );

  const toggle = useCallback(() => {
    cancel();
    setEnabled((current) => {
      const next = !current;
      const muted = !next;
      localStorage.setItem('taletalk-sound-muted', String(muted));
      window.dispatchEvent(new CustomEvent('taletalk-sound-change', { detail: muted }));
      return next;
    });
  }, [cancel]);

  return { speak, speakSegmented, cancel, enabled, toggle };
}
