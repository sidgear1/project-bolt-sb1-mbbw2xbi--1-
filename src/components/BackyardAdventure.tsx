import { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX, ArrowRight, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { preloadGeneratedSpeech, useSpeech } from '../hooks/useSpeech';
import { isSkipAnswer, stripAccents } from '../utils/levenshtein';
import { useLanguage } from '../i18n';
import { assetUrl } from '../utils/assetUrl';
import { capitaliseStandalone } from '../utils/textCase';
import { recordDailyLearnedWords } from '../utils/learningProgress';
import { LiveAnswerLetters } from './LiveTypingFeedback';
import SmoothSceneImage from './SmoothSceneImage';
import { preloadSceneWindow } from '../utils/imagePreloader';

interface Scene {
  image: string;
  speaker: string;
  speakerType: 'narrator' | 'girl';
  text: string;
  textZh?: string;
  spoken?: string;
}

const SCENES: Scene[] = [
  {
    image: assetUrl('a1.png'),
    speaker: 'Narrator',
    speakerType: 'narrator',
    text: 'Deep within the heart of the small town of Elderwoods, on a sunny Sunday afternoon, sits Joshua Stilts. Not your everyday hero, but a man with his priorities straight: a cold beer in one hand and a smile on his face. Life is good.',
    textZh: '在艾尔德伍兹小镇的中心，一个阳光明媚的周日下午，乔舒亚·斯蒂尔茨正坐在那里。他不是普通的英雄，却是一个很清楚自己想要什么的人：手里拿着冰啤酒，脸上带着笑容。生活很美好。',
    spoken: 'Deep within the heart of the small town of Elderwoods, on a sunny Sunday afternoon, sits Joshua Stilts. Not your everyday hero, but a man with his priorities straight: a cold beer in one hand and a smile on his face. Life is good.',
  },
  {
    image: assetUrl('a2.png'),
    speaker: 'Narrator',
    speakerType: 'narrator',
    text: 'But just at that moment, he hears crying.',
    textZh: '但就在这时，他听到了哭声。',
    spoken: 'But just at that moment, he hears crying.',
  },
  {
    image: assetUrl('a2.png'),
    speaker: 'Bella',
    speakerType: 'girl',
    text: 'Wahhhhh!',
    textZh: '哇啊啊！',
    spoken: 'Wahhhhh!',
  },
  {
    image: assetUrl('a3.png'),
    speaker: 'Narrator',
    speakerType: 'narrator',
    text: 'He gets up to investigate the source of the commotion.',
    textZh: '他站起来，去看看骚动从哪里传来。',
    spoken: 'He gets up to investigate the source of the commotion.',
  },
  {
    image: assetUrl('a4.png'),
    speaker: 'Narrator',
    speakerType: 'narrator',
    text: 'He follows the sound toward the back doors.',
    textZh: '他循着声音走向后门。',
    spoken: 'He follows the sound toward the back doors.',
  },
  {
    image: assetUrl('scenes/bella/a5.png'),
    speaker: 'Josh',
    speakerType: 'narrator',
    text: '벨라?',
    textZh: '贝拉？',
    spoken: '벨라?',
  },
  {
    image: assetUrl('scenes/bella/a5.png'),
    speaker: 'Bella',
    speakerType: 'girl',
    text: 'Wahhhhh!',
    textZh: '哇啊啊！',
    spoken: 'Wahhhhh!',
  },
  {
    image: assetUrl('scenes/bella/a5.png'),
    speaker: 'Narrator',
    speakerType: 'narrator',
    text: "But try as he might, he isn't getting a word out of his daughter Bella.",
    textZh: '但无论他怎么努力，女儿贝拉就是一句话也不说。',
    spoken: "But try as he might, he isn't getting a word out of his daughter Bella.",
  },
  {
    image: assetUrl('scenes/bella/a5.png'),
    speaker: 'Bella',
    speakerType: 'girl',
    text: '저는 슬퍼요.',
    textZh: 'I am unhappy.',
    spoken: '저는 슬퍼요.',
  },
];

interface WordTooltip { word: string; translation: string; explanation: string; }

const GIRL_WORDS: WordTooltip[] = [
  { word: '저는', translation: 'I am', explanation: 'A polite topic form meaning “I am”.' },
  { word: '슬퍼요', translation: 'unhappy', explanation: 'A polite Korean adjective meaning “I am unhappy” or “I am sad”.' },
];

interface ChoiceOption {
  id: string;
  italianLabel: string;
  englishLabel: string;
  prompt: string;
  correct: boolean;
  responseIt: string;
  responseEn: string;
  wordTooltips?: WordTooltip[];
}

const CHOICES: ChoiceOption[] = [
  {
    id: 'gelato',
    italianLabel: '아이스크림?',
    englishLabel: 'Ice cream?',
    prompt: '아이스크림?',
    correct: true,
    responseIt: '네',
    responseEn: 'She smiles and wipes away her tears.',
    wordTooltips: [
      { word: '아이스크림?', translation: 'ice cream?', explanation: 'The Korean word for “ice cream”.' },
    ],
  },
];

interface Props {
  onMenu: () => void;
  onComplete: () => void;
}

const STAND_UP_WORD: WordTooltip = { word: '일어서다', translation: 'stand up', explanation: 'A Korean verb meaning “to stand up”.' };
const NE_WORD: WordTooltip = { word: '네', translation: 'Yes / OK', explanation: 'A polite Korean response meaning “yes” or “OK”.' };

function stopGardenAmbience() {
  document.querySelectorAll<HTMLAudioElement>('audio[data-garden-ambience="true"]').forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
  });
}

const SONO_INFELICE_WORDS: WordTooltip[] = [
  { word: '저는', translation: 'I am', explanation: 'A polite topic form meaning “I am”.' },
  { word: '슬퍼요', translation: 'unhappy', explanation: 'A polite Korean adjective meaning “I am unhappy” or “I am sad”.' },
];

export default function BackyardAdventure({ onMenu, onComplete }: Props) {
  const { isChinese } = useLanguage();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [showWordPuzzle, setShowWordPuzzle] = useState(false);
  const [showFirstTaskTutorial, setShowFirstTaskTutorial] = useState(false);
  const [showStandUpPuzzle, setShowStandUpPuzzle] = useState(false);
  const [standUpInput, setStandUpInput] = useState('');
  const [standUpWrong, setStandUpWrong] = useState(false);
  const [wordPuzzleInput, setWordPuzzleInput] = useState('');
  const [wordPuzzleWrong, setWordPuzzleWrong] = useState(false);
  const [wordPuzzleDone, setWordPuzzleDone] = useState(false);
  const [showWordPuzzleRomanisation, setShowWordPuzzleRomanisation] = useState(() => localStorage.getItem('taletalk-romanisation-enabled') === 'true');
  useEffect(() => { const syncRomanisation = (event: Event) => setShowWordPuzzleRomanisation(Boolean((event as CustomEvent<boolean>).detail)); window.addEventListener('taletalk-romanisation-change', syncRomanisation); return () => window.removeEventListener('taletalk-romanisation-change', syncRomanisation); }, []);
  const [showChoices, setShowChoices] = useState(false);
  const [showWorried, setShowWorried] = useState(false);
  const [typingInput, setTypingInput] = useState('');
  const [typingWrong, setTypingWrong] = useState(false);
  const [chosenOption, setChosenOption] = useState<ChoiceOption | null>(null);
  const [speakingChoice, setSpeakingChoice] = useState<ChoiceOption | null>(null);
  const [showNeTask, setShowNeTask] = useState(false);
  const [neInput, setNeInput] = useState('');
  const [neWrong, setNeWrong] = useState(false);
  const [unlockedWords, setUnlockedWords] = useState<WordTooltip[]>([]);
  const [wordLibraryOpen, setWordLibraryOpen] = useState(false);
  const [wordLibraryTutorial, setWordLibraryTutorial] = useState(false);
  const [practiceWord, setPracticeWord] = useState<WordTooltip | null>(null);
  useEffect(() => {
    if (!unlockedWords.length) return;
    const slot = Number(localStorage.getItem('taletalk_active_save_slot') ?? '1');
    const sceneKey = `taletalk-slot-${slot}-scene-backyard-words`;
    const globalKey = `taletalk-slot-${slot}-unlocked-words`;
    const sceneWords = new Set<string>(JSON.parse(localStorage.getItem(sceneKey) ?? '[]'));
    const globalWords = new Set<string>(JSON.parse(localStorage.getItem(globalKey) ?? '[]'));
    unlockedWords.forEach(word => {
      sceneWords.add(word.word.toLowerCase());
      globalWords.add(word.word.toLowerCase());
    });
    localStorage.setItem(sceneKey, JSON.stringify([...sceneWords].sort()));
    localStorage.setItem(globalKey, JSON.stringify([...globalWords].sort()));
    recordDailyLearnedWords(unlockedWords.map(word => word.word), slot);
    window.dispatchEvent(new Event('taletalk-words-changed'));
  }, [unlockedWords]);
  const [practiceInput, setPracticeInput] = useState('');
  const [practiceCorrect, setPracticeCorrect] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [debugPoints, setDebugPoints] = useState<{ x: number; y: number }[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const gardenAudioRef = useRef<HTMLAudioElement>(null);
  const { speak, cancel, enabled: speechEnabled, toggle: toggleSpeech } = useSpeech();
  const keyBufferRef = useRef('');

  // Keep nearby frames ready without making every scene compete for bandwidth.
  useEffect(() => {
    preloadSceneWindow(
      [...SCENES.map(scene => scene.image), assetUrl('scenes/bella/a6.png')],
      sceneIndex,
      12,
    );
  }, [sceneIndex]);

  useEffect(() => {
    SCENES.forEach(scene => {
      const voice = scene.speakerType === 'girl' ? 'bella' : scene.speaker === 'Josh' ? 'josh' : 'male';
      preloadGeneratedSpeech(scene.spoken ?? scene.text, voice);
      if (scene.speaker === 'Narrator' && scene.textZh) preloadGeneratedSpeech(scene.textZh, 'male');
    });
    preloadGeneratedSpeech('Worried, he tries to think of something else.', 'adventure');
    preloadGeneratedSpeech('他很担心，努力想别的办法。', 'adventure');
    preloadGeneratedSpeech('아이스크림?', 'josh');
    preloadGeneratedSpeech('네', 'bella');
  }, []);

  // Only the “gets up” narration plays the full movement. The frames are
  // character-only layers, so every frame sits over the exact same garden.

  // Scene-one ambience is a local MP3. Try as soon as this scene mounts and again
  // after it has buffered; the first player click below is the browser-safe fallback.
  useEffect(() => {
    const audio = gardenAudioRef.current;
    if (!audio) return;
    stopGardenAmbience();
    audio.volume = 0.38;
    const startMusic = () => { void audio.play().catch(() => undefined); };
    audio.addEventListener('canplay', startMusic, { once: true });
    startMusic();
    return () => {
      audio.removeEventListener('canplay', startMusic);
      audio.pause();
      audio.currentTime = 0;
      stopGardenAmbience();
    };
  }, []);

  // /1 shortcut — skip to end of scene (choices)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.length === 1) {
        keyBufferRef.current = (keyBufferRef.current + e.key).slice(-2);
        if (keyBufferRef.current.endsWith('/1')) {
          keyBufferRef.current = '';
          cancel();
          setShowWordPuzzle(false);
          setWordPuzzleDone(false);
          setShowWorried(false);
          setShowChoices(true);
          setChosenOption(null);
          setSceneIndex(SCENES.length - 1);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cancel]);

  useEffect(() => {
    if (!chosenOption && !showChoices && !showWordPuzzle && !showStandUpPuzzle && !showWorried && !showNeTask) return;
    if (chosenOption?.correct) {
      setShowWordPuzzle(false);
      setShowWorried(false);
    }
  }, [chosenOption, showChoices, showWordPuzzle, showStandUpPuzzle, showWorried, showNeTask]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '#') return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      setDebugMode(d => !d);
      setDebugPoints([]);
      setMousePos(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const pctFromEvent = useCallback((e: React.MouseEvent): { x: number; y: number } | null => {
    if (!sceneRef.current) return null;
    const rect = sceneRef.current.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10,
      y: Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10,
    };
  }, []);

  const handleSceneMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!debugMode) return;
    const pos = pctFromEvent(e);
    if (pos) setMousePos(pos);
  }, [debugMode, pctFromEvent]);

  const handleDebugClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const pos = pctFromEvent(e);
    if (pos) setDebugPoints(prev => [...prev, pos]);
  }, [pctFromEvent]);

  const currentScene = SCENES[sceneIndex];

  const dismissFirstTaskTutorial = useCallback(() => {
    const slot = Number(localStorage.getItem('taletalk_active_save_slot') ?? '1');
    localStorage.setItem(`taletalk-slot-${slot}-first-task-tutorial-seen`, 'true');
    setShowFirstTaskTutorial(false);
  }, []);

  useEffect(() => {
    if (!showWordPuzzle || wordPuzzleDone) return;
    const slot = Number(localStorage.getItem('taletalk_active_save_slot') ?? '1');
    if (localStorage.getItem(`taletalk-slot-${slot}-first-task-tutorial-seen`) !== 'true') {
      setShowFirstTaskTutorial(true);
    }
  }, [showWordPuzzle, wordPuzzleDone]);

  const speakScene = useCallback((scene: Scene) => {
    // Narration follows the selected language. The learning dialogue spoken
    // by Bella and Josh remains English for practice.
    const characterSpeaksEnglish = scene.speaker === 'Bella' || scene.speaker === 'Josh';
    const dialogue = characterSpeaksEnglish ? (scene.spoken ?? scene.text) : (isChinese ? (scene.textZh ?? scene.spoken ?? scene.text) : (scene.spoken ?? scene.text));
    if (scene.speakerType === 'girl') {
      speak(dialogue, 'bella');
    } else if (scene.speaker === 'Josh') {
      speak(dialogue, 'josh');
    } else {
      speak(dialogue, 'male');
    }
  }, [isChinese, speak]);

  useEffect(() => {
    speakScene(currentScene);
  }, [sceneIndex, speakScene, isChinese]);

  useEffect(() => {
    if (showWorried) speak(isChinese ? '他很担心，努力想别的办法。' : 'Worried, he tries to think of something else.', 'adventure');
  }, [showWorried, isChinese, speak]);

  const completeStandUp = () => {
    const slot = Number(localStorage.getItem('taletalk_active_save_slot') ?? '1');
    const key = `taletalk-slot-${slot}-unlocked-words`;
    const savedWords = new Set<string>(JSON.parse(localStorage.getItem(key) ?? '[]'));
    savedWords.add(STAND_UP_WORD.word);
    localStorage.setItem(key, JSON.stringify([...savedWords].sort()));
    setUnlockedWords(previous => previous.some(word => word.word === STAND_UP_WORD.word) ? previous : [...previous, STAND_UP_WORD]);
    setWordLibraryTutorial(true);
    setStandUpInput('');
    setShowStandUpPuzzle(false);
    setSceneIndex(3);
  };

  const advance = useCallback(() => {
    cancel();
    if (sceneIndex === 2) {
      // Scene one progresses directly into the garden; "stand up" is no
      // longer a required typing exercise.
      setSceneIndex(3);
      return;
    }
    if (sceneIndex < SCENES.length - 1) {
      setSceneIndex(sceneIndex + 1);
    } else {
      // Last scene (Bella saying "Sono infelice") — show the word typing puzzle
      setShowWordPuzzle(true);
    }
  }, [sceneIndex, cancel]);

  const finishSpeakingChoice = useCallback(() => {
    setSpeakingChoice(null);
    setNeInput('');
    setShowNeTask(true);
  }, []);

  useEffect(() => {
    const skip = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowRight') return;
      event.preventDefault();
      if (showFirstTaskTutorial) { dismissFirstTaskTutorial(); return; }
      if (speakingChoice) { cancel(); finishSpeakingChoice(); return; }
      if (showNeTask) { completeNeTask(); return; }
      if (chosenOption) { if (chosenOption.correct) onComplete(); else onMenu(); return; }
      if (showChoices) { handleChoiceSubmit(true); return; }
      if (showWordPuzzle) { setShowWordPuzzle(false); setShowChoices(true); return; }
      if (showStandUpPuzzle) { completeStandUp(); return; }
      if (showWorried) { setShowWorried(false); setShowChoices(true); return; }
      advance();
    };
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [advance, chosenOption, completeStandUp, dismissFirstTaskTutorial, finishSpeakingChoice, speakingChoice, showChoices, showFirstTaskTutorial, showWordPuzzle, showStandUpPuzzle, showWorried, showNeTask, onComplete, onMenu, cancel]);

  // Word puzzle: type "sono infelice"
  const wordPuzzleTarget = '저는 슬퍼요';

  const getWordPuzzleMatchState = () => {
    const words = /[a-z]/i.test(wordPuzzleInput) ? ['jeoneun', 'seulpeoyo'] : SONO_INFELICE_WORDS.map(w => stripAccents(w.word.toLowerCase()));
    const target = words.join(' ');
    const typed = stripAccents(wordPuzzleInput.toLowerCase().replace(/\s+/g, ' ').trim());
    let totalMatched = 0;
    for (let i = 0; i < typed.length && i < target.length; i++) {
      if (typed[i] !== target[i]) break;
      totalMatched++;
    }
    let offset = 0;
    const wordStates = words.map((word) => {
      const matchedLetters = Math.max(0, Math.min(word.length, totalMatched - offset));
      const isComplete = totalMatched >= offset + word.length;
      offset += word.length + 1;
      return { matchedLetters, totalLetters: word.length, isComplete };
    });
    const isFullMatch = wordStates.every(ws => ws.isComplete);
    return { wordStates, isFullMatch };
  };

  const handleWordPuzzleSubmit = () => {
    const normalized = stripAccents(wordPuzzleInput.toLowerCase().trim());
    if (isSkipAnswer(wordPuzzleInput) || normalized === stripAccents(wordPuzzleTarget) || normalized === 'jeoneun seulpeoyo') {
      setWordPuzzleDone(true);
      setUnlockedWords(previous => {
        const existing = new Set(previous.map(word => word.word));
        return [...previous, ...SONO_INFELICE_WORDS.filter(word => !existing.has(word.word))];
      });
      setWordLibraryTutorial(true);
      speak('저는 슬퍼요', 'bella');
      setWordPuzzleInput('');
      setTimeout(() => {
        setShowWordPuzzle(false);
        setWordPuzzleDone(false);
        setShowWorried(true);
      }, 2800);
    } else {
      setWordPuzzleWrong(true);
      setTimeout(() => setWordPuzzleWrong(false), 1500);
    }
  };

  const handleStandUpSubmit = () => {
    const normalized = stripAccents(standUpInput.toLowerCase().replace(/\s+/g, ' ').trim());
    if (normalized !== STAND_UP_WORD.word) {
      setStandUpWrong(true);
      setTimeout(() => setStandUpWrong(false), 1500);
      return;
    }

    completeStandUp();
  };

  useEffect(() => {
    if (showChoices) speak('아이스크림?', 'josh');
  }, [showChoices, speak]);

  useEffect(() => {
    if (showNeTask) speak('네', 'bella');
  }, [showNeTask, speak]);

  const completeNeTask = () => {
    const normalized = neInput.trim().toLowerCase();
    if (!isSkipAnswer(neInput) && normalized !== '네' && normalized !== 'ne') {
      setNeWrong(true);
      return;
    }
    const slot = Number(localStorage.getItem('taletalk_active_save_slot') ?? '1');
    const globalKey = `taletalk-slot-${slot}-unlocked-words`;
    const globalWords = new Set<string>(JSON.parse(localStorage.getItem(globalKey) ?? '[]'));
    globalWords.add(NE_WORD.word);
    localStorage.setItem(globalKey, JSON.stringify([...globalWords].sort()));
    const sceneKey = `taletalk-slot-${slot}-scene-backyard-words`;
    const sceneWords = new Set<string>(JSON.parse(localStorage.getItem(sceneKey) ?? '[]'));
    sceneWords.add(NE_WORD.word);
    localStorage.setItem(sceneKey, JSON.stringify([...sceneWords].sort()));
    recordDailyLearnedWords([NE_WORD.word], slot);
    window.dispatchEvent(new Event('taletalk-words-changed'));
    setUnlockedWords(previous => previous.some(word => word.word === NE_WORD.word) ? previous : [...previous, NE_WORD]);
    setNeWrong(false);
    speak('네', 'bella', () => {
      stopGardenAmbience();
      onComplete();
    });
  };

  const handleChoiceSubmit = (useCorrectAnswer = false) => {
    const normalizedInput = stripAccents(typingInput.toLowerCase().trim());
    const shortcutMatch = useCorrectAnswer || isSkipAnswer(typingInput) ? CHOICES.find(c => c.correct) ?? null : null;
    const romanisationMatch = showWordPuzzleRomanisation && normalizedInput.replace(/[^a-z]/g, '') === 'aiseukeurim'
      ? CHOICES.find(c => c.correct) ?? null
      : null;
    const match = shortcutMatch ?? romanisationMatch ?? CHOICES.find(c => stripAccents(c.prompt) === normalizedInput) ?? null;
    if (match) {
      setTypingInput('');
      if (match.correct) {
        setShowWordPuzzle(false);
        setShowWorried(false);
        setShowChoices(false);
        setSpeakingChoice(match);
        setUnlockedWords(previous => {
          const existing = new Set(previous.map(word => word.word));
          return [...previous, ...(match.wordTooltips || []).filter(word => word.word === '아이스크림?' && !existing.has(word.word))];
        });
        speak(match.prompt, 'josh', finishSpeakingChoice);
        // A cached or interrupted browser audio element does not always emit
        // `ended`. Never leave Scene One trapped on Josh's speaking panel.
        window.setTimeout(finishSpeakingChoice, 2500);
      } else {
        setShowWordPuzzle(false);
        setShowWorried(false);
        setShowChoices(false);
        setChosenOption(match);
        speak('Waaaaah!', 'bella');
      }
    } else {
      setTypingWrong(true);
      setTimeout(() => setTypingWrong(false), 1500);
    }
  };

  const isGirlScene = currentScene.speakerType === 'girl';
  const displaySpeaker = isChinese
    ? ({ Narrator: '旁白', Bella: '贝拉', Josh: '乔希' }[currentScene.speaker] ?? currentScene.speaker)
    : currentScene.speaker;

  // Per-letter matching: for each choice, figure out how many letters of each word
  // have been typed correctly so far, and whether each word is fully matched.
  const typedText = typingInput.toLowerCase().trim();
  const typedWords = typedText.split(/\s+/).filter(Boolean);

  const getWordMatchState = (c: ChoiceOption) => {
    if (!c.wordTooltips) return { wordStates: [], isFullMatch: false };
    const words = c.wordTooltips.map(w => stripAccents(w.word.toLowerCase()));
    const wordStates = words.map((word, wi) => {
      const typedWord = typedWords[wi] || '';
      // Count how many leading letters match
      let matchedLetters = 0;
      for (let li = 0; li < typedWord.length && li < word.length; li++) {
        if (stripAccents(typedWord[li]) === word[li]) {
          matchedLetters++;
        } else {
          break;
        }
      }
      const isComplete = typedWord.length >= word.length && stripAccents(typedWord) === word;
      return { matchedLetters, totalLetters: word.length, isComplete };
    });
    const isFullMatch = wordStates.every(ws => ws.isComplete);
    return { wordStates, isFullMatch };
  };

  return (
    <div
      className="fixed inset-0 flex select-none items-center justify-center overflow-hidden bg-black"
      style={{ WebkitTapHighlightColor: 'transparent', userSelect: 'none' }}
      onClick={() => {
        // Browsers permit unmuted ambience after this direct player action.
        gardenAudioRef.current?.play().catch(() => { /* the next click can retry */ });
        if (speakingChoice) { cancel(); finishSpeakingChoice(); return; }
        if (!showChoices && !chosenOption && !showWordPuzzle && !showStandUpPuzzle && !showWorried && !showNeTask) advance();
      }}
    >
      <div
        ref={sceneRef}
        className="relative h-full w-full"
        onMouseMove={handleSceneMouseMove}
      >
        <SmoothSceneImage
          src={showNeTask ? assetUrl('scenes/bella/a6.png') : currentScene.image}
          alt="Backyard scene"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
        <audio
          ref={gardenAudioRef}
          src="/audio/garden-scene-music.mp3"
          data-garden-ambience="true"
          autoPlay
          loop
          preload="auto"
          playsInline
          onCanPlay={event => { event.currentTarget.volume = 0.38; }}
        />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 30%, transparent 55%, rgba(0,0,0,0.85) 100%)' }} />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 px-5 pt-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white text-lg font-bold tracking-wide leading-none" style={{ fontFamily: "'Playfair Display', serif" }}>
                {isChinese ? '英语冒险' : 'English Adventure'}
              </h1>
              <div className="text-white/70 text-[10px] uppercase tracking-[0.2em] mt-1">
                Il Giardino — The Backyard
              </div>
            </div>
            <div className="scene-native-controls flex items-center gap-2">
              <button
                onClick={toggleSpeech}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-black/60 border border-white/20 hover:border-white/50 text-white/80 hover:text-white transition-all"
                title={speechEnabled ? 'Mute voices' : 'Unmute voices'}
              >
                {speechEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              <button
                onClick={() => { stopGardenAmbience(); cancel(); onMenu(); }}
                className="px-4 py-2 rounded-full text-[11px] bg-black/60 border border-white/20 hover:border-white/50 text-white/80 hover:text-white transition-all uppercase tracking-wider"
              >
                {isChinese ? '菜单' : 'Menu'}
              </button>
            </div>
          </div>
        </div>

        {false && unlockedWords.length > 0 && (
          <div className="absolute left-4 top-28 z-30" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setWordLibraryOpen(open => !open)}
              className="rounded-xl border border-[#c4942a]/50 bg-black/75 px-3 py-2 text-left text-white shadow-xl backdrop-blur-sm transition hover:bg-black/90"
            >
              <span className="mt-1 block text-[9px] uppercase tracking-wider text-white/60">{isChinese ? '词汇' : 'Words'}</span>
            </button>
            {wordLibraryOpen && (
              <div className="mt-2 w-52 rounded-xl border border-white/15 bg-black/90 p-3 shadow-2xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#c4942a]">{isChinese ? '词汇表' : 'Vocabulary'}</span>
                  <button className="text-white/50 hover:text-white" onClick={() => setWordLibraryOpen(false)}>×</button>
                </div>
                <div className="space-y-1.5">
                  {[...unlockedWords].sort((a, b) => a.word.localeCompare(b.word)).map(word => (
                    <button
                      key={word.word}
                      onClick={() => { setPracticeWord(word); setPracticeInput(''); setPracticeCorrect(false); }}
                      className="flex w-full items-center justify-between rounded-lg bg-white/5 px-2.5 py-2 text-left transition hover:bg-white/10"
                    >
                      <span className="text-sm text-white">{word.word}</span>
                      <span className="text-[10px] text-white/45">{word.translation}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {wordLibraryTutorial && (
              <div className="mt-2 w-52 rounded-xl border border-[#c4942a]/40 bg-[#120d08]/95 p-3 shadow-2xl">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#c4942a]">{isChinese ? '新词汇' : 'New word box'}</div>
                <p className="text-[11px] leading-relaxed text-[#c4b080]">{isChinese ? '新词已保存到这里。随时点击一个词练习拼写。' : 'You unlocked these words. They are saved here — click one anytime to practise typing it.'}</p>
                <button onClick={() => setWordLibraryTutorial(false)} className="mt-2 text-[10px] uppercase tracking-wider text-white/60 hover:text-white">{isChinese ? '知道了' : 'Got it'}</button>
              </div>
            )}
          </div>
        )}

        {practiceWord && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-5" onClick={() => setPracticeWord(null)}>
            <div data-task-editor-panel="backyard-word-practice" className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#120d08]/95 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[#c4942a]">Practice word</div>
              <h2 className="text-2xl text-white" style={{ fontFamily: "'Playfair Display', serif" }}><LiveAnswerLetters target={capitaliseStandalone(practiceWord.word)} value={practiceInput} neutralClassName="text-white" /></h2>
              <p className="mb-4 text-sm text-white/55">{practiceWord.translation}</p>
              {practiceCorrect ? (
                <p className="mb-4 text-sm text-green-400">Correct. The word is yours.</p>
              ) : (<>
                <form onSubmit={e => { e.preventDefault(); setPracticeCorrect(stripAccents(practiceInput.trim().toLowerCase()) === stripAccents(practiceWord.word.toLowerCase())); }} className="flex gap-2">
                  <input autoFocus value={practiceInput} onChange={e => setPracticeInput(e.target.value)} placeholder="type the English word" className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/60" />
                  <button className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs uppercase tracking-wider text-white">Check</button>
                </form>
              </>)}
              <button onClick={() => setPracticeWord(null)} className="mt-4 text-xs text-white/50 hover:text-white">Close</button>
            </div>
          </div>
        )}

        {showStandUpPuzzle && !chosenOption && (
          <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/35 p-5 pb-10" onClick={event => event.stopPropagation()}>
            <form data-task-editor-panel="backyard-stand-up" onSubmit={event => { event.preventDefault(); handleStandUpSubmit(); }} className="w-full max-w-lg rounded-2xl border border-[#c4942a]/50 bg-[#120d08]/95 p-5 shadow-2xl">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e9bd60]">Your action</div>
              <h2 className="text-2xl text-white" style={{ fontFamily: "'Playfair Display', serif" }}>What does Joshua do?</h2>
              <p className="mt-1 text-sm text-white/60">Type the English words to make him get out of the hammock.</p>
              <div className="mt-4 rounded-lg bg-white/5 px-3 py-2 text-xl font-medium"><LiveAnswerLetters target="Stand up" value={standUpInput} neutralClassName="text-white" /></div>
              <div className="mt-3 flex gap-2">
                <input autoFocus value={standUpInput} onChange={event => setStandUpInput(event.target.value)} placeholder="type the English words" className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/35 px-3 py-2.5 text-white outline-none focus:border-[#e9bd60]" />
                <button className="rounded-lg bg-[#c4942a] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e9bd60]">Stand up</button>
              </div>
              {standUpWrong && <p className="mt-2 text-sm text-red-300">Try again: type “stand up”.</p>}
            </form>
          </div>
        )}

        {/* Cinematic dialogue bar */}
        {!showChoices && !chosenOption && !showWordPuzzle && !showStandUpPuzzle && !showWorried && !showNeTask && !speakingChoice && (
          <div className="absolute bottom-0 left-0 right-0 z-20">
            <div className="px-6 pb-5 pt-8" style={{ background: 'linear-gradient(0deg, rgba(8,27,67,0.34) 0%, rgba(8,27,67,0.12) 70%, transparent 100%)' }}>
              <div className="max-w-lg mx-auto">
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: isGirlScene ? '#e8a59c' : '#ccc' }}
                  />
                  <span
                    className={`text-[11px] uppercase tracking-[0.2em] font-semibold ${isGirlScene ? 'text-[#e8a59c]' : 'text-white/60'}`}
                  >
                    {displaySpeaker}
                  </span>
                </div>

                {isGirlScene && currentScene.text === '저는 슬퍼요.' ? (
                  <div className="mb-2">
                    <p className="text-white text-2xl leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {GIRL_WORDS.map((w, i) => (
                        <span key={i}>
                          <span className="relative inline-block cursor-help underline decoration-dotted decoration-white/40 underline-offset-4">
                            {w.word}
                          </span>
                          {i < GIRL_WORDS.length - 1 ? '\u00A0' : ''}
                        </span>
                      ))}
                    </p>
                    <p className="text-white/50 text-sm italic mt-1">I am unhappy.</p>
                  </div>
                ) : (
                  <p className="text-white text-2xl leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {currentScene.speaker === 'Bella' || currentScene.speaker === 'Josh'
                      ? currentScene.text
                      : (isChinese ? (currentScene.textZh || currentScene.text) : currentScene.text)}
                  </p>
                )}

                <div className="flex items-center justify-between mt-3">
                  <span className="text-white/40 text-[11px]">{isChinese ? '点击任意位置继续' : 'click anywhere to continue'}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); speakScene(currentScene); }}
                    className="text-white/50 hover:text-white transition-colors flex items-center gap-1.5 text-[11px]"
                  >
                    <Volume2 size={12} /> {isChinese ? '听发音' : 'Listen'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* "Sono infelice" word typing puzzle */}
        {showWordPuzzle && !chosenOption && (
          <div className="shop-task-frame absolute bottom-[2.5%] left-1/2 z-20 w-[min(30rem,calc(100%-2rem))] -translate-x-1/2" onClick={(e) => e.stopPropagation()}>
            <div data-task-editor-panel="backyard-unhappy-words" className="shop-task-box shared-task-bar-ui relative px-4 pb-3 pt-3">
                {wordPuzzleDone ? (
                  <div className="text-center py-4">
                    <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                      <Sparkles size={20} />
                      <span className="text-lg font-bold">{isChinese ? '已解锁新单词！' : 'You unlocked the words!'}</span>
                      <Sparkles size={20} />
                    </div>
                    <p className="text-white/60 text-sm">
                      <span className="text-green-400 font-medium">저는</span> = <span className="text-green-400">I am</span> &nbsp;·&nbsp;
                      <span className="text-green-400 font-medium">슬퍼요</span> = <span className="text-green-400">unhappy</span>
                    </p>
                  </div>
                ) : (
                  <>
                    <div data-task-editor-item="instruction" className="flex w-fit items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-[#c4942a] flex-shrink-0" />
                      <span className="text-[#c4942a] text-[9px] uppercase tracking-[0.12em] font-semibold">Type the Korean words using the keyboard</span>
                    </div>
                    <p data-task-editor-item="english-cue" className="mt-1 text-sm text-white/60">I am unhappy</p>
                    <div data-task-editor-item="hangul-cue" className="my-2 flex w-fit items-center gap-2 text-2xl font-semibold tracking-[0.12em]">
                        {(() => {
                          const { wordStates } = getWordPuzzleMatchState();
                          return SONO_INFELICE_WORDS.map((wt, wi) => {
                            const ws = wordStates[wi];
                            const letters = wt.word.split('');
                            return (
                              <span key={wi}>
                                <span className="relative inline-block">
                                    {letters.map((letter, li) => (
                                      <span
                                        key={li}
                                        className={`transition-colors ${
                                          !/[a-z]/i.test(wordPuzzleInput) && ws && li < ws.matchedLetters ? 'text-green-400' : 'text-white/90'
                                        }`}
                                      >
                                        {letter}
                                      </span>
                                    ))}
                                </span>
                                {wi < SONO_INFELICE_WORDS.length - 1 ? '\u00A0' : ''}
                              </span>
                            );
                          });
                        })()}
                      <button type="button" onClick={() => speak('저는 슬퍼요', 'bella')} title="Listen" className="text-[#f6d46b] hover:text-white"><Volume2 size={19} /></button>
                    </div>
                    {showWordPuzzleRomanisation && <div data-task-editor-item="romanisation-cue" className="mb-2 w-fit text-sm font-semibold tracking-wide"><LiveAnswerLetters target="Jeoneun Seulpeoyo" value={/[a-z]/i.test(wordPuzzleInput) ? wordPuzzleInput : ''} neutralClassName="text-[#f6d46b]" /></div>}
                    <div data-task-editor-item="answer-form" className="flex w-full items-center gap-2">
                      <input
                        value={wordPuzzleInput}
                        onChange={(e) => setWordPuzzleInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleWordPuzzleSubmit(); }}
                        className="flex-1 bg-white/5 text-white text-xs outline-none placeholder-white/30 caret-white min-w-0 border-b border-white/20 focus:border-white/60 py-1.5 rounded-lg px-2"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Type the Korean words..."
                        autoFocus
                      />
                      <button
                        onClick={handleWordPuzzleSubmit}
                        className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-xs px-4 py-2 rounded-lg transition-all uppercase tracking-wider flex-shrink-0"
                      >
                        Enter
                      </button>
                    </div>
                    {wordPuzzleWrong && (
                      <div className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
                        <AlertTriangle size={11} /> Not quite — listen to Bella and try again
                      </div>
                    )}
                  </>
                )}
            </div>
          </div>
        )}

        {showFirstTaskTutorial && showWordPuzzle && !wordPuzzleDone && (
          <div className="absolute inset-0 z-50 grid place-items-center bg-black/55 px-5 backdrop-blur-[2px]" onClick={event => event.stopPropagation()}>
            <section className="shop-task-box shared-task-bar-ui w-full max-w-lg px-6 py-6 text-left shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="first-task-tutorial-title">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#f6d46b]">First task tutorial</div>
              <h2 id="first-task-tutorial-title" className="text-2xl text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Welcome to your first task</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/75">Here, you’ll become accustomed to words that you will need to progress. Hover over the words for more detailed definitions. These words will then be saved to your Collection!</p>
              <button type="button" onClick={dismissFirstTaskTutorial} className="mt-5 rounded-xl border border-[#f6d46b] bg-[#d6a52c] px-5 py-2.5 text-sm font-bold text-[#191207] transition hover:bg-[#f6d46b]">Continue to task</button>
            </section>
          </div>
        )}

        {/* Worried narrator interstitial */}
        {showWorried && !chosenOption && (
          <div className="absolute bottom-0 left-0 right-0 z-20" onClick={() => { setShowWorried(false); setShowChoices(true); }}>
            <div className="px-6 pb-5 pt-8" style={{ background: 'linear-gradient(0deg, rgba(8,27,67,0.34) 0%, rgba(8,27,67,0.12) 70%, transparent 100%)' }}>
              <div className="max-w-lg mx-auto">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#ccc' }} />
                  <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-white/60">{isChinese ? '旁白' : 'Narrator'}</span>
                </div>
                <p className="text-white text-2xl leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {isChinese ? '他很担心，努力想别的办法。' : 'Worried, he tries to think of something else.'}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-white/40 text-[11px]">{isChinese ? '点击任意位置继续' : 'click anywhere to continue'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Choice typing area */}
        {showChoices && !chosenOption && !speakingChoice && (
          <div className="shop-task-frame absolute bottom-[2.5%] left-1/2 z-20 w-[min(30rem,calc(100%-2rem))] -translate-x-1/2" onClick={(e) => e.stopPropagation()}>
            <div data-task-editor-panel="backyard-choice" className="shop-task-box shared-task-bar-ui px-4 pb-3 pt-3">
                <div data-task-editor-item="instruction" className="mb-1 flex w-fit items-center gap-2">
                  <div className="h-2 w-2 flex-shrink-0 rounded-full bg-[#c4942a]" />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#c4942a]">{isChinese ? '你会怎么做？' : 'What do you do?'}</span>
                </div>
                <p data-task-editor-item="prompt" className="mt-1 text-sm text-white/60">{isChinese ? '贝拉在哭。输入你想给她买的东西。' : 'Bella is crying. Type what you would like to buy for her.'}</p>
                <button data-task-editor-item="hangul-cue" type="button" onClick={() => speak('아이스크림?', 'josh')} className="my-2 flex w-fit items-center gap-2 text-2xl font-semibold tracking-[.08em] text-white">
                  <LiveAnswerLetters target="아이스크림?" value={/[가-힣]/.test(typingInput) ? typingInput : ''} neutralClassName="text-white" />
                  <Volume2 size={19} className="text-[#f6d46b]" />
                </button>
                {showWordPuzzleRomanisation && <p data-task-editor-item="romanisation-cue" className="mb-1 w-fit text-sm font-semibold tracking-wide"><LiveAnswerLetters target="Aiseukeurim?" value={/[a-z]/i.test(typingInput) ? typingInput : ''} neutralClassName="text-[#f6d46b]" /></p>}
                <p data-task-editor-item="english-cue" className="mb-2 text-sm text-white/60">Ice cream?</p>
                <div data-task-editor-item="answer-form" className="flex w-full items-center gap-2">
                  <input
                    value={typingInput}
                    onChange={(e) => setTypingInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleChoiceSubmit(); }}
                    className="flex-1 bg-white/5 text-white text-xs outline-none placeholder-white/30 caret-white min-w-0 border-b border-white/20 focus:border-white/60 py-1.5 rounded-lg px-2"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={isChinese ? '输入韩语单词…' : 'Type the Korean word...'}
                    autoFocus
                  />
                  <button
                    onClick={() => handleChoiceSubmit()}
                    className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-xs px-4 py-2 rounded-lg transition-all uppercase tracking-wider flex-shrink-0"
                  >
                    {isChinese ? '确认' : 'Enter'}
                  </button>
                </div>
                {typingWrong && (
                  <div data-task-editor-item="error-message" className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
                    <AlertTriangle size={11} /> Try again — type the Korean word shown above
                  </div>
                )}
            </div>
          </div>
        )}

        {showNeTask && (
          <div className="shop-task-frame absolute bottom-[2.5%] left-1/2 z-20 w-[min(30rem,calc(100%-2rem))] -translate-x-1/2" onClick={(event) => event.stopPropagation()}>
            <div data-task-editor-panel="backyard-ne-response" className="shop-task-box shared-task-bar-ui relative px-4 pb-3 pt-3">
              <div data-task-editor-item="instruction" className="flex w-fit items-center gap-2 mb-1"><div className="h-2 w-2 flex-shrink-0 rounded-full bg-[#c4942a]" /><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#c4942a]">Bella replies — type what she says</span></div>
              <p data-task-editor-item="english-cue" className="mt-1 text-sm text-white/60">Yes / OK</p>
              <div data-task-editor-item="hangul-cue" className="my-2 flex w-fit items-center gap-2 text-2xl font-semibold"><LiveAnswerLetters target="네" value={/[가-힣]/.test(neInput) ? neInput : ''} neutralClassName="text-white" /><button type="button" onClick={() => speak('네', 'bella')} className="text-[#f6d46b] hover:text-white" aria-label="Hear 네"><Volume2 size={19} /></button></div>
              {showWordPuzzleRomanisation && <p data-task-editor-item="romanisation-cue" className="mb-2 w-fit text-sm font-semibold"><LiveAnswerLetters target="Ne" value={/[a-z]/i.test(neInput) ? neInput : ''} neutralClassName="text-[#f6d46b]" /></p>}
              <form data-task-editor-item="answer-form" className="flex w-full gap-2" onSubmit={(event) => { event.preventDefault(); completeNeTask(); }}><input autoFocus value={neInput} onChange={event => setNeInput(event.target.value)} placeholder="Type the Korean word..." className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none" /><button className="rounded-lg border border-white/20 bg-white/10 px-4 text-xs uppercase tracking-wider text-white">Enter</button></form>
              {neWrong && <p data-task-editor-item="error-message" className="mt-2 text-xs text-red-400">Not quite — listen to Bella and try again.</p>}
            </div>
          </div>
        )}

        {/* Debug overlay — toggle with # key */}
        {debugMode && (() => {
          const xs = debugPoints.map(p => p.x);
          const ys = debugPoints.map(p => p.y);
          const bbox = debugPoints.length >= 2 ? {
            x: Math.min(...xs),
            y: Math.min(...ys),
            w: Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10,
            h: Math.round((Math.max(...ys) - Math.min(...ys)) * 10) / 10,
          } : null;
          return (
            <div className="absolute inset-0 z-50">
              <div
                className="absolute inset-0"
                style={{ cursor: 'crosshair', zIndex: 1 }}
                onClick={handleDebugClick}
                onMouseMove={handleSceneMouseMove}
              />
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
                {debugPoints.length >= 2 && (
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                    viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polygon
                      points={debugPoints.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="rgba(250,204,21,0.18)"
                      stroke="#facc15"
                      strokeWidth="0.4"
                      strokeDasharray="1.5,0.8"
                    />
                  </svg>
                )}
                {bbox && (
                  <div style={{
                    position: 'absolute',
                    left: `${bbox.x}%`, top: `${bbox.y}%`,
                    width: `${bbox.w}%`, height: `${bbox.h}%`,
                    border: '2px dashed #facc15',
                    background: 'rgba(250,204,21,0.06)',
                    boxSizing: 'border-box',
                  }}>
                    <div style={{ position: 'absolute', bottom: '100%', left: 0, background: '#facc15', color: '#000', fontSize: '9px', fontFamily: 'monospace', fontWeight: 'bold', padding: '1px 4px', whiteSpace: 'nowrap' }}>
                      x:{bbox.x} y:{bbox.y} w:{bbox.w} h:{bbox.h}
                    </div>
                  </div>
                )}
                {debugPoints.map((pt, i) => (
                  <div key={i} style={{
                    position: 'absolute',
                    left: `${pt.x}%`, top: `${pt.y}%`,
                    transform: 'translate(-50%,-50%)',
                    width: 18, height: 18,
                    borderRadius: '50%',
                    background: '#facc15',
                    border: '2px solid #000',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '8px', fontWeight: 'bold', color: '#000', fontFamily: 'monospace',
                  }}>
                    {i + 1}
                  </div>
                ))}
              </div>
              <div className="absolute top-2 left-2 pointer-events-auto" style={{ zIndex: 3 }}>
                <div style={{ background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(250,204,21,0.5)', borderRadius: 12, padding: '10px 14px', fontFamily: 'monospace', fontSize: '11px', color: '#fff', minWidth: 300, maxWidth: 420 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color: '#facc15', fontWeight: 'bold', fontSize: 12 }}>DEBUG MODE</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>Press # to exit</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                    Image: <span style={{ color: '#fff' }}>{currentScene.image.split('/').pop()}</span>
                  </div>
                  {mousePos && (
                    <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                      Cursor: <span style={{ color: '#86efac' }}>x:{mousePos.x}% y:{mousePos.y}%</span>
                    </div>
                  )}
                  <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontSize: 10 }}>
                    Click points around an object to draw its area
                  </div>
                  {debugPoints.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 6, marginBottom: 6 }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
                        Points ({debugPoints.length}): {debugPoints.map((p, i) => (
                          <span key={i} style={{ color: '#facc15' }}>[{p.x},{p.y}] </span>
                        ))}
                      </div>
                      {bbox && (
                        <div style={{ background: 'rgba(250,204,21,0.15)', border: '1px solid rgba(250,204,21,0.4)', borderRadius: 6, padding: '5px 8px', marginTop: 4 }}>
                          <div style={{ color: '#facc15', fontWeight: 'bold', marginBottom: 2 }}>Bounding Box:</div>
                          <div style={{ color: '#fff', fontSize: 12 }}>x:{bbox.x} y:{bbox.y} width:{bbox.w} height:{bbox.h}</div>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setDebugPoints([])}
                    style={{ background: 'rgba(239,68,68,0.7)', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 10, cursor: 'pointer' }}
                  >
                    Clear Points
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Speaking choice — Josh says the line, then Bella responds */}
        {speakingChoice && !chosenOption && (
          <section className="story-dialogue-panel absolute z-20" onClick={(event) => { event.stopPropagation(); cancel(); finishSpeakingChoice(); }}>
            <div className="story-dialogue-content">
              <div className="scene-eyebrow"><span className="cop-narrator-dot bg-blue-400" />{isChinese ? '乔希' : 'Josh'}</div>
              <p className="story-dialogue-text">{speakingChoice.italianLabel}</p>
              <p className="mt-1 text-sm italic text-white/55">{speakingChoice.englishLabel}</p>
              <div className="cop-narration-footer">
                <span>{isChinese ? '点击任意位置继续' : 'click anywhere to continue'}</span>
                <button type="button" onClick={(event) => { event.stopPropagation(); speak(speakingChoice.prompt, 'josh', finishSpeakingChoice); }}><Volume2 size={12} /> {isChinese ? '听发音' : 'Listen'}</button>
              </div>
            </div>
          </section>
        )}

        {/* Result */}
        {chosenOption && (
          chosenOption.correct ? (
            <SmoothSceneImage
              src={assetUrl('scenes/bella/a6.png')}
              alt="Bella happy with gelato"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-700"
              draggable={false}
            />
          ) : null
        )}
        {chosenOption && (
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-20" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-2xl border border-white/10 px-3 pb-2 pt-2" style={{ background: 'rgba(0,0,0,0.92)' }}>
              <div className="max-w-lg mx-auto">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: chosenOption.correct ? '#4ade80' : '#f87171' }} />
                  <span className={`text-[9px] uppercase tracking-[0.12em] font-semibold ${chosenOption.correct ? 'text-green-400' : 'text-red-400'}`}>
                    {chosenOption.correct ? (isChinese ? '她笑了' : 'She smiles') : (isChinese ? '她哭得更厉害了' : 'She cries harder')}
                  </span>
                </div>
                <p className="text-white text-base leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {chosenOption.responseIt}
                </p>
                <p className="text-white/50 text-xs italic mt-0.5">{chosenOption.responseEn}</p>
                {chosenOption.correct && (
                  <div className="flex items-center gap-1.5 text-green-400 text-[10px] mt-1.5">
                    <Check size={10} /> {isChinese ? '正确！你选对了词语。' : 'Correct! You chose the right words.'}
                  </div>
                )}
                <button
                  onClick={() => { stopGardenAmbience(); cancel(); chosenOption.correct ? onComplete() : onMenu(); }}
                  className="mt-2 flex items-center gap-1.5 text-white/70 hover:text-white text-[10px] uppercase tracking-wider transition-colors"
                >
                  {isChinese ? '返回地图' : 'Return to map'} <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
