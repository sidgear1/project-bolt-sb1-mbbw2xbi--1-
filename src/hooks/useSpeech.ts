import { useRef, useCallback, useEffect, useState } from 'react';

export type VoiceGender = 'male' | 'female' | 'character' | 'bella' | 'josh' | 'shopkeeper' | 'busWoman' | 'wife' | 'adventure';
type SpeechLanguage = 'en' | 'zh';

export interface SpeechSegment {
  text: string;
  lang: 'en';
}

function pickVoice(gender: VoiceGender, language: SpeechLanguage): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

  const preferredEnglishVoice = (candidates: SpeechSynthesisVoice[], preferredNames: string[]) =>
    candidates.find((voice) => preferredNames.some((name) => voice.name.toLowerCase().includes(name)))
    ?? candidates.find((voice) => /\b(online|natural|neural|enhanced)\b/i.test(voice.name));

  if (language === 'zh') {
    const chineseVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('zh'));
    return chineseVoices.find((v) => v.name.toLowerCase().includes(gender === 'female' ? 'female' : 'male'))
      ?? chineseVoices[0]
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
  bella: 'MF3mGyEYCl7XYWbV9V6O',
  josh: 'TxGEqnHWrfWFTfGW9XjX',
  shopkeeper: 'EXAVITQu4vr4xnSDxMaL',
  busWoman: '21m00Tcm4TlvDq8ikWAM',
  wife: 'AZnzlk1XvdvUeBnXmlld',
  adventure: 'VR6AewLTigWG4xSOukaG',
} as const;

function voiceFileId(text: string, voice: VoiceGender, language: SpeechLanguage): string {
  let hash = 2166136261;
  const fileKey = voice === 'bella' ? `${language}:bella:${text}` : `${language}:${text}`;
  for (const char of fileKey) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `line-${language}-${(hash >>> 0).toString(36)}`;
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
  const [enabled, setEnabled] = useState(true);
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

  const speakUtterance = (text: string, gender: VoiceGender, onEnd?: () => void, language: SpeechLanguage = /[\u3400-\u9fff]/.test(text) ? 'zh' : 'en') => {
    const utterance = new SpeechSynthesisUtterance(text);
    const nativeGender: 'male' | 'female' | 'character' = gender === 'bella' || gender === 'shopkeeper' || gender === 'busWoman' || gender === 'wife' ? 'female' : gender === 'josh' || gender === 'adventure' ? 'male' : gender;

    if (language === 'zh') {
      utterance.lang = 'zh-CN';
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

    const file = `${import.meta.env.BASE_URL}audio/voices/${voiceFileId(text, gender, language)}.mp3`;
    const audio = new Audio(file);
    audioRef.current = audio;
    audio.onended = () => { if (audioRef.current === audio) audioRef.current = null; finish(); };
    // Generated MP3s are preferred, but new Chinese lines do not always have
    // a matching file yet. Use the device's Chinese voice rather than silence.
    const useNativeVoice = () => {
      if (audioRef.current === audio) audioRef.current = null;
      if (cancelledRef.current) { finish(); return; }
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    };
    audio.onerror = useNativeVoice;
    audio.play().catch(useNativeVoice);
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
        speakUtterance(seg.text, gender, next, seg.lang === 'en' ? 'en' : 'zh');
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
    setEnabled((e) => !e);
  }, [cancel]);

  return { speak, speakSegmented, cancel, enabled, toggle };
}
