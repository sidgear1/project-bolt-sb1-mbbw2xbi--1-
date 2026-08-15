import { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX, ArrowRight, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { useSpeech } from '../hooks/useSpeech';
import { isSkipAnswer, stripAccents } from '../utils/levenshtein';
import { useLanguage } from '../i18n';

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
    image: '/a1.png',
    speaker: 'Narrator',
    speakerType: 'narrator',
    text: 'Deep within the heart of the small town of Elderwoods, on a sunny Sunday afternoon, sits Joshua Stilts. Not your everyday hero, but a man with his priorities straight: a cold beer in one hand and a smile on his face. Life is good.',
    textZh: '在艾尔德伍兹小镇的中心，一个阳光明媚的周日下午，乔舒亚·斯蒂尔茨正坐在那里。他不是普通的英雄，却是一个很清楚自己想要什么的人：手里拿着冰啤酒，脸上带着笑容。生活很美好。',
    spoken: 'Deep within the heart of the small town of Elderwoods, on a sunny Sunday afternoon, sits Joshua Stilts. Not your everyday hero, but a man with his priorities straight: a cold beer in one hand and a smile on his face. Life is good.',
  },
  {
    image: '/a2.png',
    speaker: 'Narrator',
    speakerType: 'narrator',
    text: 'But just at that moment, he hears crying.',
    textZh: '但就在这时，他听到了哭声。',
    spoken: 'But just at that moment, he hears crying.',
  },
  {
    image: '/a2.png',
    speaker: 'Bella',
    speakerType: 'girl',
    text: 'Wahhhhh!',
    spoken: 'Wahhhhh!',
  },
  {
    image: '/a3.png',
    speaker: 'Narrator',
    speakerType: 'narrator',
    text: 'He gets up to investigate the source of the commotion.',
    textZh: '他站起来，去看看骚动从哪里传来。',
    spoken: 'He gets up to investigate the source of the commotion.',
  },
  {
    image: '/a4.png',
    speaker: 'Narrator',
    speakerType: 'narrator',
    text: 'He follows the sound toward the back doors.',
    textZh: '他循着声音走向后门。',
    spoken: 'He follows the sound toward the back doors.',
  },
  {
    image: '/scenes/bella/a5.png',
    speaker: 'Josh',
    speakerType: 'narrator',
    text: 'Bella?',
    textZh: '贝拉？',
    spoken: 'Bella?',
  },
  {
    image: '/scenes/bella/a5.png',
    speaker: 'Bella',
    speakerType: 'girl',
    text: 'Wahhhhh!',
    spoken: 'Wahhhhh!',
  },
  {
    image: '/scenes/bella/a5.png',
    speaker: 'Narrator',
    speakerType: 'narrator',
    text: "But try as he might, he isn't getting a word out of his daughter Bella.",
    textZh: '但无论他怎么努力，女儿贝拉就是一句话也不说。',
    spoken: "But try as he might, he isn't getting a word out of his daughter Bella.",
  },
  {
    image: '/scenes/bella/a5.png',
    speaker: 'Bella',
    speakerType: 'girl',
    text: 'I am unhappy.',
    textZh: '我不开心。',
    spoken: 'I am unhappy.',
  },
];

interface WordTooltip { word: string; translation: string; }

const GIRL_WORDS: WordTooltip[] = [
  { word: 'I am', translation: '我是' },
  { word: 'unhappy', translation: '不开心' },
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
    italianLabel: 'Would you like an ice cream?',
    englishLabel: '你想要冰淇淋吗？',
    prompt: 'would you like an ice cream',
    correct: true,
    responseIt: 'Yes!',
    responseEn: '她笑了，擦去眼泪。',
    wordTooltips: [
      { word: 'Would you like', translation: '你想要吗' },
      { word: 'an', translation: '一个' },
      { word: 'ice cream', translation: '冰淇淋' },
    ],
  },
  {
    id: 'ignore',
    italianLabel: 'Ignore her',
    englishLabel: '忽略她',
    prompt: 'ignore her',
    correct: false,
    responseIt: '*Bella cries louder*',
    responseEn: '她感到被抛弃，哭得更厉害。',
    wordTooltips: [
      { word: 'Ignore her', translation: '忽略她' },
    ],
  },
  {
    id: 'shout',
    italianLabel: 'Shout at her',
    englishLabel: '对她大喊',
    prompt: 'shout at her',
    correct: false,
    responseIt: '*Bella cries louder*',
    responseEn: '你的喊叫让她更害怕。',
    wordTooltips: [
      { word: 'Shout', translation: '大喊' },
      { word: 'at her', translation: '对她' },
    ],
  },
];

interface Props {
  onMenu: () => void;
  onComplete: () => void;
}

const SONO_INFELICE_WORDS: WordTooltip[] = [
  { word: 'I am', translation: '我是' },
  { word: 'unhappy', translation: '不开心' },
];

export default function BackyardAdventure({ onMenu, onComplete }: Props) {
  const { isChinese } = useLanguage();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [showWordPuzzle, setShowWordPuzzle] = useState(false);
  const [wordPuzzleInput, setWordPuzzleInput] = useState('');
  const [wordPuzzleWrong, setWordPuzzleWrong] = useState(false);
  const [wordPuzzleDone, setWordPuzzleDone] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  const [showWorried, setShowWorried] = useState(false);
  const [typingInput, setTypingInput] = useState('');
  const [typingWrong, setTypingWrong] = useState(false);
  const [chosenOption, setChosenOption] = useState<ChoiceOption | null>(null);
  const [speakingChoice, setSpeakingChoice] = useState<ChoiceOption | null>(null);
  const [hoveredWord, setHoveredWord] = useState<number | null>(null);
  const [clickedWord, setClickedWord] = useState<number | null>(null);
  const [hoveredChoiceWord, setHoveredChoiceWord] = useState<string | null>(null);
  const [clickedChoiceWord, setClickedChoiceWord] = useState<string | null>(null);
  const [unlockedWords, setUnlockedWords] = useState<WordTooltip[]>([]);
  const [wordLibraryOpen, setWordLibraryOpen] = useState(false);
  const [wordLibraryTutorial, setWordLibraryTutorial] = useState(false);
  const [practiceWord, setPracticeWord] = useState<WordTooltip | null>(null);
  const [practiceInput, setPracticeInput] = useState('');
  const [practiceCorrect, setPracticeCorrect] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [debugPoints, setDebugPoints] = useState<{ x: number; y: number }[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const { speak, cancel, enabled: speechEnabled, toggle: toggleSpeech } = useSpeech();
  const keyBufferRef = useRef('');

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
    if (!chosenOption && !showChoices && !showWordPuzzle && !showWorried) return;
    if (chosenOption?.correct) {
      setShowWordPuzzle(false);
      setShowWorried(false);
    }
  }, [chosenOption, showChoices, showWordPuzzle, showWorried]);

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

  const speakScene = useCallback((scene: Scene) => {
    const dialogue = isChinese ? (scene.textZh ?? scene.spoken ?? scene.text) : (scene.spoken ?? scene.text);
    if (scene.speakerType === 'girl') {
      speak(dialogue, 'female');
    } else {
      speak(dialogue, 'male');
    }
  }, [isChinese, speak]);

  useEffect(() => {
    speakScene(currentScene);
  }, [sceneIndex, speakScene, isChinese]);

  useEffect(() => {
    if (showWorried) speak(isChinese ? '他很担心，努力想别的办法。' : 'Worried, he tries to think of something else.', 'male');
  }, [showWorried, isChinese, speak]);

  const advance = useCallback(() => {
    cancel();
    if (sceneIndex < SCENES.length - 1) {
      setSceneIndex(sceneIndex + 1);
    } else {
      // Last scene (Bella saying "Sono infelice") — show the word typing puzzle
      setShowWordPuzzle(true);
    }
  }, [sceneIndex, cancel]);

  // Word puzzle: type "sono infelice"
  const wordPuzzleTarget = 'i am unhappy';

  const getWordPuzzleMatchState = () => {
    const words = SONO_INFELICE_WORDS.map(w => stripAccents(w.word.toLowerCase()));
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
    if (isSkipAnswer(wordPuzzleInput) || normalized === stripAccents(wordPuzzleTarget)) {
      setWordPuzzleDone(true);
      setUnlockedWords(previous => {
        const existing = new Set(previous.map(word => word.word));
        return [...previous, ...SONO_INFELICE_WORDS.filter(word => !existing.has(word.word))];
      });
      setWordLibraryTutorial(true);
      speak(isChinese ? '我不开心。' : 'I am unhappy', 'female');
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

  const handleChoiceSubmit = () => {
    const normalizedInput = stripAccents(typingInput.toLowerCase().trim());
    const shortcutMatch = isSkipAnswer(typingInput) ? CHOICES.find(c => c.correct) ?? null : null;
    const match = shortcutMatch ?? CHOICES.find(c => stripAccents(c.prompt) === normalizedInput) ?? null;
    if (match) {
      setTypingInput('');
      if (match.correct) {
        setShowWordPuzzle(false);
        setShowWorried(false);
        setShowChoices(false);
        setSpeakingChoice(match);
        setUnlockedWords(previous => {
          const existing = new Set(previous.map(word => word.word));
          return [...previous, ...(match.wordTooltips || []).filter(word => !existing.has(word.word))];
        });
        speak(match.prompt, 'male', () => {
          setSpeakingChoice(null);
          setChosenOption(match);
          setTimeout(() => speak(match.responseIt, 'female'), 300);
        });
      } else {
        setShowWordPuzzle(false);
        setShowWorried(false);
        setShowChoices(false);
        setChosenOption(match);
        speak('Waaaaah!', 'female');
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
      className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center"
      onClick={() => {
        if (!showChoices && !chosenOption && !showWordPuzzle && !showWorried) advance();
      }}
    >
      <div
        ref={sceneRef}
        className="relative"
        style={{ height: '100vh', aspectRatio: '1 / 1', maxWidth: '100vw', maxHeight: '100vh' }}
        onMouseMove={handleSceneMouseMove}
      >
        <img
          key={currentScene.image + sceneIndex}
          src={currentScene.image}
          alt="Backyard scene"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-700"
          draggable={false}
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
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSpeech}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-black/60 border border-white/20 hover:border-white/50 text-white/80 hover:text-white transition-all"
                title={speechEnabled ? 'Mute voices' : 'Unmute voices'}
              >
                {speechEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              <button
                onClick={() => { cancel(); onMenu(); }}
                className="px-4 py-2 rounded-full text-[11px] bg-black/60 border border-white/20 hover:border-white/50 text-white/80 hover:text-white transition-all uppercase tracking-wider"
              >
                {isChinese ? '菜单' : 'Menu'}
              </button>
            </div>
          </div>
        </div>

        {unlockedWords.length > 0 && (
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
            <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#120d08]/95 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[#c4942a]">Practice word</div>
              <h2 className="text-2xl text-white" style={{ fontFamily: "'Playfair Display', serif" }}>{practiceWord.word}</h2>
              <p className="mb-4 text-sm text-white/55">{practiceWord.translation}</p>
              {practiceCorrect ? (
                <p className="mb-4 text-sm text-green-400">Correct. The word is yours.</p>
              ) : (
                <form onSubmit={e => { e.preventDefault(); setPracticeCorrect(stripAccents(practiceInput.trim().toLowerCase()) === stripAccents(practiceWord.word.toLowerCase())); }} className="flex gap-2">
                  <input autoFocus value={practiceInput} onChange={e => setPracticeInput(e.target.value)} placeholder="type the English word" className="min-w-0 flex-1 rounded-lg border-b border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/60" />
                  <button className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs uppercase tracking-wider text-white">Check</button>
                </form>
              )}
              <button onClick={() => setPracticeWord(null)} className="mt-4 text-xs text-white/50 hover:text-white">Close</button>
            </div>
          </div>
        )}

        {/* Cinematic dialogue bar */}
        {!showChoices && !chosenOption && !showWordPuzzle && !showWorried && !speakingChoice && (
          <div className="absolute bottom-0 left-0 right-0 z-20">
            <div className="px-6 pb-5 pt-8" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 70%, transparent 100%)' }}>
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

                {isGirlScene && currentScene.text === 'I am unhappy.' ? (
                  <div className="mb-2">
                    <p className="text-white text-2xl leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {GIRL_WORDS.map((w, i) => (
                        <span key={i}>
                          <span
                            className="relative inline-block cursor-pointer underline decoration-dotted decoration-white/40 underline-offset-4"
                            onClick={(e) => { e.stopPropagation(); setClickedWord(clickedWord === i ? null : i); }}
                            onMouseEnter={() => setHoveredWord(i)}
                            onMouseLeave={() => setHoveredWord(null)}
                          >
                            {w.word}
                            {(hoveredWord === i || clickedWord === i) && (
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium whitespace-nowrap z-50 shadow-xl" style={{ pointerEvents: clickedWord === i ? 'auto' : 'none' }}>
                                {w.word} = {w.translation}
                              </span>
                            )}
                          </span>
                          {i < GIRL_WORDS.length - 1 ? '\u00A0' : ''}
                        </span>
                      ))}
                    </p>
                    <p className="text-white/50 text-sm italic mt-1">我不开心</p>
                  </div>
                ) : (
                  <p className="text-white text-2xl leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {isChinese ? (currentScene.textZh || currentScene.text) : currentScene.text}
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
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-20" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-2xl border border-white/10 px-4 pb-3 pt-3" style={{ background: 'rgba(0,0,0,0.92)' }}>
              <div className="max-w-lg mx-auto">
                {wordPuzzleDone ? (
                  <div className="text-center py-4">
                    <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                      <Sparkles size={20} />
                      <span className="text-lg font-bold">{isChinese ? '已解锁新单词！' : 'You unlocked the words!'}</span>
                      <Sparkles size={20} />
                    </div>
                    <p className="text-white/60 text-sm">
                      <span className="text-green-400 font-medium">I am</span> = <span className="text-green-400">我是</span> &nbsp;·&nbsp;
                      <span className="text-green-400 font-medium">unhappy</span> = <span className="text-green-400">不开心</span>
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-[#e8a59c] flex-shrink-0" />
                      <span className="text-[#e8a59c] text-[9px] uppercase tracking-[0.12em] font-semibold">{isChinese ? '贝拉在哭——输入她说的话' : 'Bella is crying — type what she says'}</span>
                    </div>

                    {/* Target words with per-letter green highlighting */}
                    <div className="bg-white/5 rounded-lg px-3 py-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white/50 text-[10px]">{isChinese ? '贝拉：' : 'Bella:'}</span>
                        {(() => {
                          const { wordStates } = getWordPuzzleMatchState();
                          return SONO_INFELICE_WORDS.map((wt, wi) => {
                            const ws = wordStates[wi];
                            const letters = wt.word.split('');
                            return (
                              <span key={wi}>
                                <span className="relative inline-block">
                                  <span className="underline decoration-dotted decoration-white/30 underline-offset-2">
                                    {letters.map((letter, li) => (
                                      <span
                                        key={li}
                                        className={`transition-colors ${
                                          ws && li < ws.matchedLetters ? 'text-green-400' : 'text-white/90'
                                        }`}
                                      >
                                        {letter}
                                      </span>
                                    ))}
                                  </span>
                                </span>
                                {wi < SONO_INFELICE_WORDS.length - 1 ? '\u00A0' : ''}
                              </span>
                            );
                          });
                        })()}
                      </div>
                      {/* English translation underneath, green when matched */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {(() => {
                          const { wordStates } = getWordPuzzleMatchState();
                          return SONO_INFELICE_WORDS.map((wt, ewi) => (
                            <span
                              key={ewi}
                              className={`text-[10px] transition-colors ${
                                wordStates[ewi]?.isComplete ? 'text-green-400' : 'text-white/40'
                              }`}
                            >
                              {wt.translation}{ewi < SONO_INFELICE_WORDS.length - 1 ? '\u00A0' : ''}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        value={wordPuzzleInput}
                        onChange={(e) => setWordPuzzleInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleWordPuzzleSubmit(); }}
                        className="flex-1 bg-white/5 text-white text-xs outline-none placeholder-white/30 caret-white min-w-0 border-b border-white/20 focus:border-white/60 py-1.5 rounded-lg px-2"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="type what bella says..."
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
          </div>
        )}

        {/* Worried narrator interstitial */}
        {showWorried && !chosenOption && (
          <div className="absolute bottom-0 left-0 right-0 z-20" onClick={() => { setShowWorried(false); setShowChoices(true); }}>
            <div className="px-6 pb-5 pt-8" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 70%, transparent 100%)' }}>
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
        {showChoices && !chosenOption && (
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-20" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-2xl border border-white/10 px-3 pb-2 pt-2" style={{ background: 'rgba(0,0,0,0.92)' }}>
              <div className="max-w-lg mx-auto">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-[#c4942a] flex-shrink-0" />
                  <span className="text-[#c4942a] text-[9px] uppercase tracking-[0.12em] font-semibold">{isChinese ? '你会怎么做？' : 'What do you do?'}</span>
                </div>
                <p className="text-white/80 text-xs mb-1.5">{isChinese ? '贝拉在哭。输入你想做的事：' : 'Bella is crying. Type what you want to do:'}</p>

                <div className="flex flex-col gap-1 mb-2">
                  {CHOICES.map((c) => {
                    const { wordStates, isFullMatch } = getWordMatchState(c);
                    return (
                      <div
                        key={c.id}
                        className={`px-3 py-1 rounded-lg bg-white/5 border transition-all ${
                          isFullMatch ? 'border-green-400/60 bg-green-400/10' : 'border-white/15'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            isFullMatch ? 'bg-green-400/30 text-green-300' : 'bg-white/10 text-white/60'
                          }`}>
                            {CHOICES.indexOf(c) + 1}
                          </span>
                          <div className="flex flex-col">
                            {/* Italian with per-letter green highlighting */}
                            <span className="text-xs">
                              {c.wordTooltips?.map((wt, wi) => {
                                const ws = wordStates[wi];
                                const letters = wt.word.split('');
                                return (
                                  <span key={wi}>
                                    <span
                                      className="relative inline-block cursor-pointer"
                                      onClick={(e) => { e.stopPropagation(); setClickedChoiceWord(clickedChoiceWord === `${c.id}-${wi}` ? null : `${c.id}-${wi}`); }}
                                      onMouseEnter={() => setHoveredChoiceWord(`${c.id}-${wi}`)}
                                      onMouseLeave={() => setHoveredChoiceWord(null)}
                                    >
                                      <span className="underline decoration-dotted decoration-white/30 underline-offset-2">
                                        {letters.map((letter, li) => (
                                          <span
                                            key={li}
                                            className={`transition-colors ${
                                              ws && li < ws.matchedLetters ? 'text-green-400' : 'text-white/90'
                                            }`}
                                          >
                                            {letter}
                                          </span>
                                        ))}
                                      </span>
                                      {(hoveredChoiceWord === `${c.id}-${wi}` || clickedChoiceWord === `${c.id}-${wi}`) && (
                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium whitespace-nowrap z-50 shadow-xl" style={{ pointerEvents: clickedChoiceWord === `${c.id}-${wi}` ? 'auto' : 'none' }}>
                                          {wt.word} = {wt.translation}
                                        </span>
                                      )}
                                    </span>
                                    {wi < (c.wordTooltips!.length - 1) ? '\u00A0' : ''}
                                  </span>
                                );
                              })}
                            </span>
                            {/* English underneath — full translation per Italian word, green when matched */}
                            <span className="text-[10px] mt-0.5">
                              {c.wordTooltips?.map((wt, ewi) => (
                                <span
                                  key={ewi}
                                  className={`transition-colors ${
                                    wordStates[ewi]?.isComplete ? 'text-green-400' : 'text-white/40'
                                  }`}
                                >
                                  {wt.translation}{ewi < (c.wordTooltips!.length - 1) ? '\u00A0' : ''}
                                </span>
                              ))}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    value={typingInput}
                    onChange={(e) => setTypingInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleChoiceSubmit(); }}
                    className="flex-1 bg-white/5 text-white text-xs outline-none placeholder-white/30 caret-white min-w-0 border-b border-white/20 focus:border-white/60 py-1.5 rounded-lg px-2"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={isChinese ? '输入你的选择…' : 'type your choice...'}
                    autoFocus
                  />
                  <button
                    onClick={handleChoiceSubmit}
                    className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-xs px-4 py-2 rounded-lg transition-all uppercase tracking-wider flex-shrink-0"
                  >
                    {isChinese ? '确认' : 'Enter'}
                  </button>
                </div>
                {typingWrong && (
                  <div className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
                    <AlertTriangle size={11} /> Not a valid choice — type one of the options above
                  </div>
                )}
              </div>
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
          <div className="absolute left-[2.7%] right-[9.6%] bottom-[1%] z-20" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-2xl border border-blue-400/30 px-4 pb-3 pt-3" style={{ background: 'rgba(0,0,0,0.92)' }}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0 animate-pulse" />
                <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-blue-300">{isChinese ? '乔希正在说话…' : 'Josh is speaking...'}</span>
              </div>
              <p className="text-white text-lg leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>{speakingChoice.italianLabel}</p>
              <p className="text-white/50 text-xs italic mt-1">{speakingChoice.englishLabel}</p>
            </div>
          </div>
        )}

        {/* Result */}
        {chosenOption && (
          chosenOption.correct ? (
            <img
              src="/scenes/bella/a6.png"
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
                  onClick={() => { cancel(); chosenOption.correct ? onComplete() : onMenu(); }}
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
