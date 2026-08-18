import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, Volume2, TreePine, Armchair, Flower2, X, Zap, Check } from 'lucide-react';
import { useLanguage } from '../i18n';
import { assetUrl } from '../utils/assetUrl';

interface FlashbackSceneProps {
  onComplete: () => void;
  onAwardXp: (amount: number) => void;
  speak: (text: string, gender: 'male' | 'female' | 'character') => void;
  cancel: () => void;
  onMenu: () => void;
  xp: number;
  playerLevel: number;
}

type Speaker = 'narrator' | 'you' | 'emily' | 'wife';

interface DialogueStep {
  type: 'dialogue';
  speaker: Speaker;
  text: string;
  speakText?: string;
  speakVoice?: 'male' | 'female' | 'character';
}

interface QuizStep {
  type: 'quiz';
  speaker: Speaker;
  englishText: string;
  frenchText: string;
  speakText: string;
  options: { french: string; english: string }[];
  correctIndex: number;
  xpReward: number;
}

interface ItemStep {
  type: 'item';
  narrative: string;
  inventoryAdd?: string;
}

type Step = DialogueStep | QuizStep | ItemStep;

const STEPS: Step[] = [
  {
    type: 'dialogue',
    speaker: 'narrator',
    text: 'Something flashes through the darkness. Light. Warmth. The smell of flowers.',
    speakText: 'Something flashes through the darkness. Light. Warmth. The smell of flowers.',
    speakVoice: 'male',
  },
  {
    type: 'dialogue',
    speaker: 'you',
    text: "What's this?... I remember this. Is this... is this my family?",
    speakText: "What is this? I remember this. Is this my family?",
    speakVoice: 'character',
  },
  {
    type: 'dialogue',
    speaker: 'narrator',
    text: "这是你失落记忆的片段。仔细听：小女孩正在说英语。试着理解她说的话。",
    speakText: "This is a fragment of your lost memory. Listen carefully. A little girl is speaking English. Try to understand what she says.",
    speakVoice: 'male',
  },
  {
    type: 'quiz',
    speaker: 'emily',
    englishText: '“你好，我叫艾米丽。”',
    frenchText: 'Hello, my name is Emily.',
    speakText: 'Hello, my name is Emily.',
    options: [
      { french: 'Hello, my name is Emily.', english: '你好，我叫艾米丽。' },
      { french: "I don't know anyone named Emily.", english: '我不认识叫艾米丽的人。' },
      { french: 'Goodbye, Emily.', english: '再见，艾米丽。' },
    ],
    correctIndex: 0,
    xpReward: 120,
  },
  {
    type: 'quiz',
    speaker: 'emily',
    englishText: '“我今天五岁。”',
    frenchText: 'I am five years old today.',
    speakText: 'I am five years old today.',
    options: [
      { french: 'I am five years old today.', english: '我今天五岁。' },
      { french: 'I am ten years old.', english: '我十岁。' },
      { french: "It's my birthday tomorrow.", english: '我的生日是明天。' },
    ],
    correctIndex: 0,
    xpReward: 120,
  },
  {
    type: 'dialogue',
    speaker: 'emily',
    text: "I love you, Dad.",
    speakText: "I love you, Dad.",
    speakVoice: 'female',
  },
  {
    type: 'dialogue',
    speaker: 'narrator',
    text: "She squeezes your hand. The garden is still. Flowers bloom all around you. You feel an urge to pick one.",
    speakText: "She squeezes your hand. The garden is still. Flowers bloom all around you. You feel an urge to pick one.",
    speakVoice: 'male',
  },
  {
    type: 'item',
    narrative: 'You look at the flowers and the garden bench. Click on them to interact.',
  },
  {
    type: 'dialogue',
    speaker: 'narrator',
    text: "You press the flower into your wife's hand.",
    speakText: "You press the flower into your wife's hand.",
    speakVoice: 'male',
  },
  {
    type: 'dialogue',
    speaker: 'wife',
    text: "Thank you, darling.",
    speakText: "Thank you, darling.",
    speakVoice: 'female',
  },
  {
    type: 'dialogue',
    speaker: 'narrator',
    text: "Then — a scream.",
    speakText: "Then — a scream.",
    speakVoice: 'male',
  },
  {
    type: 'dialogue',
    speaker: 'emily',
    text: "They are coming, Dad!",
    speakText: "They are coming, Dad!",
    speakVoice: 'female',
  },
  {
    type: 'dialogue',
    speaker: 'emily',
    text: "They have weapons!",
    speakText: "They have weapons!",
    speakVoice: 'female',
  },
  {
    type: 'dialogue',
    speaker: 'you',
    text: "What's going on?! What's happening?! Don't worry baby — I'm coming! I'm coming!",
    speakText: "What's going on? What's happening? Don't worry baby, I'm coming to help you.",
    speakVoice: 'character',
  },
  {
    type: 'dialogue',
    speaker: 'narrator',
    text: "The memory shatters. The garden is gone. Cold Florence cobblestones beneath your feet.",
    speakText: "The memory shatters. The garden is gone. Cold Florence cobblestones beneath your feet.",
    speakVoice: 'male',
  },
];

const SPEAKER_LABELS: Record<Speaker, string> = {
  narrator: 'Narrator',
  you: 'You',
  emily: 'Emily',
  wife: 'Your Wife',
};

const SPEAKER_COLORS: Record<Speaker, string> = {
  narrator: '#a08060',
  you: '#c4942a',
  emily: '#7cc4a0',
  wife: '#c48a9a',
};

const FLASHBACK_CHINESE: Record<string, string> = {
  'Something flashes through the darkness. Light. Warmth. The smell of flowers.': '黑暗中闪过一些画面：光、温暖，还有花香。',
  "What's this?... I remember this. Is this... is this my family?": '这是什么？……他记得这里。这是……他的家人吗？',
  'I love you, Dad.': '我爱你，爸爸。',
  'She squeezes your hand. The garden is still. Flowers bloom all around you. You feel an urge to pick one.': '她紧紧握住他的手。花园很安静，四周鲜花盛开。他想摘一朵花。',
  'Thank you, darling.': '谢谢你，亲爱的。',
  'Then — a scream.': '接着——一声尖叫。',
  'They are coming, Dad!': '他们来了，爸爸！',
  'They have weapons!': '他们有武器！',
  "What's going on?! What's happening?! Don't worry baby — I'm coming! I'm coming!": '发生什么事了？！别害怕，宝贝——他来帮你！',
  'The memory shatters. The garden is gone. Cold Florence cobblestones beneath your feet.': '记忆碎裂了。花园消失了，脚下又是冰冷的佛罗伦萨石板路。',
};

// Interactive items in the garden
interface GardenItem {
  id: string;
  name: string;
  region: { x: number; y: number; width: number; height: number };
  icon: React.ReactNode;
  narrative: string;
  requiresStep: number;
}

const GARDEN_ITEMS: GardenItem[] = [
  {
    id: 'bench',
    name: 'Garden Bench',
    region: { x: 35, y: 45, width: 30, height: 25 },
    icon: <Armchair size={14} />,
    narrative: 'An old wooden bench where you used to sit with your wife. It smells like fresh varnish.',
    requiresStep: 7,
  },
  {
    id: 'flowers',
    name: 'Flowers',
    region: { x: 10, y: 35, width: 20, height: 25 },
    icon: <Flower2 size={14} />,
    narrative: 'Wild roses in full bloom. The red ones remind you of something — you reach for them instinctively.',
    requiresStep: 7,
  },
  {
    id: 'tree',
    name: 'Tree',
    region: { x: 65, y: 15, width: 30, height: 40 },
    icon: <TreePine size={14} />,
    narrative: 'An old oak tree. Emily carved her initials into the bark when she was three.',
    requiresStep: 7,
  },
];

export default function FlashbackScene({ onComplete, onAwardXp, speak, cancel, onMenu, xp, playerLevel }: FlashbackSceneProps) {
  const { isChinese } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [animating, setAnimating] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizWrong, setQuizWrong] = useState(false);
  const [quizDone, setQuizDone] = useState(false);
  const [shake, setShake] = useState(false);
  const [closing, setClosing] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [itemNarrative, setItemNarrative] = useState<string | null>(null);
  const [itemInteracted, setItemInteracted] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = STEPS[stepIndex];
  const displayDialogue = step?.type === 'dialogue' ? (isChinese ? (FLASHBACK_CHINESE[step.text] ?? step.text) : step.text) : '';

  const advance = useCallback(() => {
    const next = stepIndex + 1;
    if (next >= STEPS.length) {
      setClosing(true);
      setTimeout(() => onComplete(), 1200);
      return;
    }
    setStepIndex(next);
    setDisplayedText('');
    setAnimating(false);
    setSelectedOption(null);
    setQuizWrong(false);
    setQuizDone(false);
    setItemNarrative(null);
  }, [stepIndex, onComplete]);

  const animateText = useCallback((text: string) => {
    setAnimating(true);
    let i = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (i < text.length) {
        i++;
        setDisplayedText(text.slice(0, i));
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        setAnimating(false);
      }
    }, 22);
  }, []);

  useEffect(() => {
    if (step?.type === 'dialogue') {
      animateText(displayDialogue);
      if (step.speakText && step.speakVoice) {
        setTimeout(() => {
          speak(step.speakText!, step.speakVoice!);
        }, 300);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stepIndex, animateText, speak, step, displayDialogue]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Debug shortcut: ## to skip to end
  useEffect(() => {
    const keyBuffer = { current: '' };
    const handler = (e: KeyboardEvent) => {
      if (e.key.length === 1) {
        keyBuffer.current = (keyBuffer.current + e.key).slice(-2);
        if (keyBuffer.current.endsWith('##')) {
          keyBuffer.current = '';
          setClosing(true);
          setTimeout(() => onComplete(), 1200);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onComplete]);

  const handleClick = () => {
    if (animating) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (step?.type === 'dialogue') {
        setDisplayedText(displayDialogue);
        setAnimating(false);
      }
    } else if (step?.type === 'dialogue') {
      cancel();
      advance();
    } else if (step?.type === 'item') {
      // Click on item step to advance
      cancel();
      advance();
    }
  };

  const handleItemClick = (item: GardenItem) => {
    if (stepIndex < item.requiresStep) return;
    if (itemInteracted.has(item.id)) return;
    setItemInteracted(prev => new Set([...prev, item.id]));
    setItemNarrative(item.narrative);
    cancel();
    setTimeout(() => {
      setItemNarrative(null);
      if (item.id === 'flowers') {
        // If they picked the flower, advance
        advance();
      }
    }, 3000);
  };

  const handleQuizAnswer = (i: number) => {
    if (step?.type !== 'quiz') return;
    if (i === step.correctIndex) {
      setSelectedOption(i);
      setQuizDone(true);
      onAwardXp(step.xpReward);
    } else {
      setSelectedOption(i);
      setQuizWrong(true);
      setShake(true);
      setTimeout(() => { setQuizWrong(false); setShake(false); setSelectedOption(null); }, 700);
    }
  };

  useEffect(() => {
    const skip = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowRight') return;
      event.preventDefault();
      if (step?.type === 'quiz') handleQuizAnswer(step.correctIndex);
      else if (!animating) advance();
      else handleClick();
    };
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [step, animating, advance]);

  const isEmily = step?.type === 'dialogue' && step.speaker === 'emily';
  const isChaotic = step?.type === 'dialogue' && step.speaker === 'emily' && (step.text.includes('They are coming') || step.text.includes('They have weapons'));
  const isPanic = step?.type === 'dialogue' && step.speaker === 'you' && step.text.includes("What's going on");

  return (
    <div className="fixed inset-0 z-50">
      <div className={`absolute inset-0 bg-[#0a0604] transition-opacity duration-1000 ${closing ? 'opacity-0' : 'opacity-100'}`}>
        {/* Background garden image */}
        <img
          src={assetUrl('Use_AI_Image_Jun_15,_2026,_19_20_35.png')}
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg?auto=compress&cs=tinysrgb&w=1920'; (e.target as HTMLImageElement).onerror = null; }}
          alt="Memory garden"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.6 }}
        />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(10,6,4,0.85) 100%)' }} />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[#e8d5a3] text-base font-bold font-display leading-none">TaleTalk</h1>
              <div className="text-[#7cc4a0] text-xs uppercase tracking-widest mt-0.5">{isChinese ? '闪回 · 记忆' : 'Flashback — Memory'}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Zap size={10} className="text-[#c4b080]" />
                <span className="text-[#c4b080] text-[10px] font-bold uppercase tracking-wider">LVL {playerLevel}</span>
              </div>
              <button onClick={() => { cancel(); onMenu(); }} className="px-3 py-1.5 rounded-xl text-xs bg-[#0d0804]/80 border border-[#8b6914]/40 hover:border-[#c4942a]/60 text-[#c4b080] hover:text-[#c4942a] transition-all uppercase tracking-wider">
                {isChinese ? '菜单' : 'Menu'}
              </button>
            </div>
          </div>
        </div>

        {/* Interactive items on the garden image */}
        {stepIndex >= 7 && (
          <>
            {GARDEN_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="absolute z-30 group"
                style={{
                  left: `${item.region.x}%`, top: `${item.region.y}%`,
                  width: `${item.region.width}%`, height: `${item.region.height}%`,
                }}
                title={item.name}
              >
                <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                  itemInteracted.has(item.id) ? 'bg-[#7cc4a0]/10' : 'bg-[#c4942a]/10 group-hover:bg-[#c4942a]/20'
                }`} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1">
                  <div className={`text-[#c4942a] transition-all ${itemInteracted.has(item.id) ? 'opacity-50' : 'group-hover:scale-110'}`}>
                    {item.icon}
                  </div>
                </div>
                {!itemInteracted.has(item.id) && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-[#0d0804]/80 border border-[#8b6914]/40 rounded px-2 py-0.5 text-[#c4b080] text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.name}
                  </div>
                )}
              </button>
            ))}
          </>
        )}

        {/* Item narrative popup */}
        {itemNarrative && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-4">
            <div className="bg-[#0a0604]/92 border border-[#8b6914]/30 rounded-2xl px-5 py-4 shadow-2xl backdrop-blur-sm">
              <p className="text-[#f0e8d8] text-sm leading-relaxed">{itemNarrative}</p>
              <p className="text-[#b09060] text-xs mt-2 text-right">click to dismiss</p>
            </div>
          </div>
        )}

        {/* Main dialogue / quiz area */}
        <div className="absolute inset-0 flex items-end pb-4 px-4 pointer-events-none" onClick={handleClick}>
          <div className="w-full max-w-2xl mx-auto pointer-events-auto">
            {/* Narrator / Dialogue box */}
            {step?.type === 'dialogue' && (
              <div className={`transition-all duration-300 ${isChaotic ? 'animate-pulse' : ''} ${shake ? 'translate-x-1' : ''}`}>
                <div className="bg-[#0a0604]/96 border border-[#8b6914]/30 rounded-2xl px-6 py-5 shadow-2xl backdrop-blur-sm">
                  {/* Speaker header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SPEAKER_COLORS[step.speaker] }} />
                    <span className="text-xs uppercase tracking-widest font-medium" style={{ color: SPEAKER_COLORS[step.speaker] }}>
                      {isChinese ? ({ narrator: '旁白', you: '他', emily: '艾米丽', wife: '妻子' }[step.speaker]) : SPEAKER_LABELS[step.speaker]}
                    </span>
                    {/* Speaker button for Emily */}
                    {isEmily && step.speakText && (
                      <button
                        onClick={(e) => { e.stopPropagation(); speak(step.speakText!, 'female'); }}
                        className="text-[#8b6914] hover:text-[#c4942a] transition-colors ml-2"
                        title="Repeat"
                      >
                        <Volume2 size={14} />
                      </button>
                    )}
                  </div>
                  {/* Dialogue text */}
                  <p className={`text-[#f0e8d8] text-base leading-relaxed font-display ${isChaotic ? 'text-[#ef4444]' : ''} ${isPanic ? 'text-[#c4942a]' : ''}`}
                    style={{ fontStyle: step.speaker === 'narrator' ? 'italic' : 'normal' }}
                  >
                    {step.speaker === 'emily' || step.speaker === 'wife' ? '"' : ''}
                    {animating ? displayedText : displayDialogue}
                    {step.speaker === 'emily' || step.speaker === 'wife' ? '"' : ''}
                    {animating && (
                      <span className="inline-block w-0.5 h-4 bg-[#c4942a] ml-0.5 animate-pulse align-middle" />
                    )}
                  </p>
                  {/* Click to continue */}
                  {!animating && (
                    <div className="flex items-center gap-1 text-[#8b6914]/60 text-xs mt-3 cursor-pointer">
                      {isChinese ? '点击继续' : 'click to continue'}
                      <ChevronRight size={12} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quiz */}
            {step?.type === 'quiz' && (
              <div className="bg-[#0a0604]/96 border border-[#7cc4a0]/30 rounded-2xl px-6 py-5 shadow-2xl backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-[#7cc4a0] animate-pulse" />
                  <span className="text-[#7cc4a0] text-xs uppercase tracking-widest font-medium">{isChinese ? '艾米丽说：' : 'Emily said...'}</span>
                </div>
                <p className="text-[#f0e8d8] text-base font-display italic mb-4">{step.englishText}</p>
                <div className="text-[#8b6914]/60 text-xs uppercase tracking-wider mb-2">她说了哪一句英语？点击作答：</div>
                {!quizDone ? (
                  <div className="flex flex-col gap-2">
                    {step.options.map((opt, i) => (
                      <button key={i} onClick={() => handleQuizAnswer(i)}
                        className={`text-left px-4 py-2.5 rounded-xl border text-sm transition-all duration-150 ${
                          selectedOption === i && quizWrong
                            ? 'bg-[#2a0a0a]/80 border-red-600/60 text-red-300'
                            : 'bg-[#0d0804]/60 border-[#8b6914]/30 text-[#c4b080] hover:border-[#c4942a]/50 hover:text-[#e8d5a3] hover:bg-[#1a0e02]/60'
                        }`}
                      >
                        <span className="text-[#6a4a2a] mr-1.5">{String.fromCharCode(65 + i)}.</span>
                        <span className="font-medium">{opt.french}</span>
                        <span className="text-[#6a4a2a] text-xs ml-2">— {opt.english}</span>
                      </button>
                    ))}
                    {quizWrong && (
                      <div className="flex items-center gap-1 text-red-400 text-xs mt-1">
                        <X size={12} /> {isChinese ? '还不对，再试一次。' : 'Not quite — try again'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-[#4caf50] text-sm font-bold mb-3">
                      <Check size={16} /> {isChinese ? `正确！+${step.xpReward} 经验值` : `Correct! +${step.xpReward} XP`}
                    </div>
                    <button onClick={() => { cancel(); advance(); }}
                      className="flex items-center gap-1 text-[#c4942a] text-sm hover:text-[#e8d5a3] transition-colors">
                      {isChinese ? '继续' : 'Continue'} <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Item instruction */}
            {step?.type === 'item' && (
              <div className="bg-[#0a0604]/96 border border-[#8b6914]/30 rounded-2xl px-6 py-5 shadow-2xl backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#c4942a] animate-pulse" />
                  <span className="text-[#c4942a] text-xs uppercase tracking-widest font-medium">Garden</span>
                </div>
                <p className="text-[#f0e8d8] text-base leading-relaxed">{step.narrative}</p>
                <p className="text-[#8b6914]/60 text-xs mt-2">Click on the items in the garden to interact with them.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
