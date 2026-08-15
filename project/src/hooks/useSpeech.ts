import { useRef, useCallback, useState, useEffect } from 'react';

export type VoiceGender = 'male' | 'female' | 'character';
type SpeechLanguage = 'en' | 'zh';

export interface SpeechSegment {
  text: string;
  lang: 'en';
}

function pickVoice(gender: VoiceGender, language: SpeechLanguage): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

  if (language === 'zh') {
    const chineseVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('zh'));
    return chineseVoices.find((v) => v.name.toLowerCase().includes(gender === 'female' ? 'female' : 'male'))
      ?? chineseVoices[0]
      ?? null;
  }

  if (gender === 'female') {
    const enVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    return enVoices.find((v) => v.name.toLowerCase().includes('female')) ?? enVoices[0] ?? voices[0] ?? null;
  }

  if (gender === 'character') {
    const enVoices = voices.filter((v) => v.lang.startsWith('en'));
    return enVoices[0] ?? voices[0] ?? null;
  }

  // Male — narrator, English voice
  const gbVoices = voices.filter((v) => v.lang === 'en-GB');
  const gbMale = gbVoices.find((v) => v.name.toLowerCase().includes('male'));
  if (gbMale) return gbMale;
  if (gbVoices.length > 0) return gbVoices[0];
  const enVoices = voices.filter((v) => v.lang.startsWith('en'));
  const enMale = enVoices.find((v) => v.name.toLowerCase().includes('male'));
  if (enMale) return enMale;
  return enVoices[0] ?? voices[0] ?? null;
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

  // Resume speech synthesis if it pauses when tab is backgrounded
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && speechSynthesis.paused) {
        speechSynthesis.resume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    speechSynthesis.cancel();
    setTimeout(() => { cancelledRef.current = false; }, 50);
  }, []);

  const speakUtterance = (text: string, gender: VoiceGender, onEnd?: () => void, language: SpeechLanguage = /[\u3400-\u9fff]/.test(text) ? 'zh' : 'en') => {
    const utterance = new SpeechSynthesisUtterance(text);

    if (language === 'zh') {
      utterance.lang = 'zh-CN';
      utterance.pitch = gender === 'female' ? 1.08 : 0.92;
      utterance.rate = 0.92;
      utterance.volume = 1.0;
    } else if (gender === 'male') {
      // Deep, attractive, powerful English narrator
      utterance.lang = 'en-GB';
      utterance.pitch = 0.4;
      utterance.rate = 0.95;
      utterance.volume = 1.0;
    } else if (gender === 'character') {
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

    const voice = pickVoice(gender, language);
    if (voice) utterance.voice = voice;
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    speechSynthesis.speak(utterance);
  };

  const speakSegmented = useCallback(
    (segments: SpeechSegment[], onEnd?: () => void) => {
      if (!enabled) { onEnd?.(); return; }
      cancelledRef.current = false;
      speechSynthesis.cancel();

      let index = 0;
      const next = () => {
        if (cancelledRef.current || index >= segments.length) { onEnd?.(); return; }
        const seg = segments[index++];
        const gender: VoiceGender = 'male';
        speakUtterance(seg.text, gender, next, seg.lang === 'en' ? 'en' : 'zh');
      };

      if (!speechSynthesis.getVoices().length) {
        speechSynthesis.onvoiceschanged = next;
      } else {
        next();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled]
  );

  const speak = useCallback(
    (text: string, gender: VoiceGender, onEnd?: () => void) => {
      if (!enabled) { onEnd?.(); return; }
      cancelledRef.current = false;
      speechSynthesis.cancel();

      const doIt = () => {
        if (gender === 'female' || gender === 'character') {
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

      if (!speechSynthesis.getVoices().length) {
        speechSynthesis.onvoiceschanged = doIt;
      } else {
        doIt();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled]
  );

  const toggle = useCallback(() => {
    speechSynthesis.cancel();
    setEnabled((e) => !e);
  }, []);

  return { speak, speakSegmented, cancel, enabled, toggle };
}
