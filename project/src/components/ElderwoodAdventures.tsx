import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Lightbulb } from 'lucide-react';
import { assetUrl } from '../utils/assetUrl';
import { useSpeech } from '../hooks/useSpeech';

type Props = { onBack: () => void; onBusComplete: () => void; onHomeComplete: () => void };
function SceneImage({ src, alt }: { src: string; alt: string }) { const [ready, setReady] = useState(false); useEffect(() => { const image = new Image(); setReady(false); image.onload = image.onerror = () => setReady(true); image.src = src; }, [src]); return <>{!ready && <div className="scene-preload"><span>Loading scene...</span></div>}<img className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`} src={src} alt={alt} /></>; }
const unlock = (word: string) => { const saved = new Set<string>(JSON.parse(localStorage.getItem('elderwood-unlocked-words') ?? '[]')); saved.add(word); localStorage.setItem('elderwood-unlocked-words', JSON.stringify([...saved].sort())); };
const BUS_WORDS = ['ice cream', 'bread', 'welcome', 'water', 'i am'];
type BusStage = 'quiz' | 'happy' | 'running' | 'failed';

export function BusTicketAdventure({ onBack, onBusComplete }: Pick<Props, 'onBack' | 'onBusComplete'>) {
  const [stage, setStage] = useState<BusStage>('quiz'), [index, setIndex] = useState(0), [input, setInput] = useState(''), [wrong, setWrong] = useState(0), [hints, setHints] = useState(0);
  const { speak, cancel } = useSpeech();
  const word = BUS_WORDS[index], grade = Math.max(0, 100 - wrong * 10 - hints * 10), image = assetUrl(`scenes/bus/${stage === 'quiz' ? 'd1' : stage === 'happy' ? 'd2' : stage === 'running' ? 'd3' : 'd4'}.png`);
  const advance = () => { if (stage === 'quiz') { if (index < BUS_WORDS.length - 1) setIndex(n => n + 1); else setStage(grade >= 50 ? 'happy' : 'failed'); } else if (stage === 'happy') setStage('running'); else if (stage === 'running') onBusComplete(); };
  useEffect(() => {
    const line = stage === 'quiz' ? `Oh no, I need my bus pass. Please help me with the word ${word}.` : stage === 'happy' ? 'You found my bus pass. Thank you so much!' : stage === 'running' ? 'I can catch the bus now!' : 'I missed the bus. I need more practice.';
    speak(line, stage === 'quiz' || stage === 'happy' || stage === 'running' ? 'busWoman' : 'adventure');
    return cancel;
  }, [stage, word, speak, cancel]);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === 'ArrowRight') { event.preventDefault(); advance(); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); });
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (input.trim().toLowerCase() !== word) { setWrong(n => n + 1); return; } unlock(word); setInput(''); if (index < BUS_WORDS.length - 1) setIndex(n => n + 1); else setStage(grade >= 50 ? 'happy' : 'failed'); };
  const hint = () => { setHints(n => n + 1); if (hints >= 1) speechSynthesis.speak(new SpeechSynthesisUtterance(word)); };
  return <div className="fixed inset-0 overflow-hidden bg-black"><SceneImage src={image} alt="Jessica at the bus stop" /><div className="absolute inset-0 bg-black/35" /><header className="scene-header"><button onClick={onBack}>Map</button><span>BUS PASS - ELDERWOOD</span></header><main className="scene-panel">{stage === 'quiz' && <><div className="scene-eyebrow">Jessica: "Oh no, oh no..."</div><h1>Unlock the bus pass</h1><p>Jessica cannot miss this bus or she will miss her exams. Type the English word to access the pass.</p><div className="scene-progress">Word {index + 1} / {BUS_WORDS.length} - Grade {grade}%</div><form className="scene-form" onSubmit={submit}><input autoFocus value={input} onChange={e => setInput(e.target.value)} placeholder="type the word..." /><button>Check</button></form>{wrong > 0 && <p className="scene-error">Not quite. Incorrect letters reduce your grade.</p>}<div className="scene-hint"><Lightbulb size={15} /> {hints === 0 ? 'Hints lower your final grade.' : hints === 1 ? `${word.slice(0, 3)}${'_'.repeat(Math.max(1, word.length - 3))}` : 'The word is being read aloud.'}<button onClick={hint}>Use hint</button></div></>}{stage === 'happy' && <><div className="scene-eyebrow">Pass - {grade}%</div><h1>Jessica remembers her pass!</h1><p>She is relieved - and there is still time to catch the bus.</p><button className="scene-action" onClick={() => setStage('running')}>Continue <ArrowRight size={16} /></button></>}{stage === 'running' && <><div className="scene-eyebrow">Level complete</div><h1>Jessica runs to the bus.</h1><p>You passed with {grade}%. The Corner House is now unlocked on the map.</p><button className="scene-action" onClick={onBusComplete}>Return to map <ArrowRight size={16} /></button></>}{stage === 'failed' && <><div className="scene-eyebrow">Final grade - {grade}%</div><h1>The bus has gone.</h1><p>You need at least 50% to pass. Return to the map and try again.</p><button className="scene-action" onClick={onBack}>Return to map</button></>}</main></div>;
}

const HOME_LINES = ['You hear an angry woman. What do you do?', 'Your wife is mad at you for sleeping all day.', 'You give her the rose.', 'The house grows quiet as the argument ends.', 'The family is together again.'];

export function HomeAdventure({ onBack, onHomeComplete }: Pick<Props, 'onBack' | 'onHomeComplete'>) {
  const [step, setStep] = useState(0), [wrongChoice, setWrongChoice] = useState(false), [sportsDay, setSportsDay] = useState(false);
  const { speak, cancel } = useSpeech();
  const homeImages = useMemo(() => [1, 2, 3, 4, 5].map(n => assetUrl(`scenes/home/e${n}-enhanced.png`)), []);
  useEffect(() => {
    if (sportsDay) return;
    speak(HOME_LINES[step], step === 1 ? 'wife' : step === 2 ? 'josh' : 'adventure');
    return cancel;
  }, [step, sportsDay, speak, cancel]);
  const nextHome = () => { if (step < 4) setStep(n => n + 1); else setSportsDay(true); };
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key !== 'ArrowRight') return; event.preventDefault(); nextHome(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); });
  if (sportsDay) return <SportsDayAdventure onBack={onBack} onComplete={onHomeComplete} />;
  return <div className="fixed inset-0 overflow-hidden bg-black"><SceneImage src={homeImages[step]} alt="The Corner House" /><div className="absolute inset-0 bg-black/35" /><header className="scene-header"><button onClick={onBack}>Map</button><span>THE CORNER HOUSE</span></header><main className="scene-panel"><div className="scene-eyebrow">Narrator</div><h1>{HOME_LINES[step]}</h1>{step === 0 ? <div className="scene-choices"><button onClick={() => { setWrongChoice(false); setStep(1); }}>Go into the kitchen</button><button onClick={() => setWrongChoice(true)}>Run for your life</button>{wrongChoice && <p className="scene-error">Wrong choice - go into the kitchen.</p>}</div> : <button className="scene-action" onClick={nextHome}>{step === 1 ? 'Give her the rose' : step === 4 ? 'Go outside' : 'Continue'} <ArrowRight size={16} /></button>}</main></div>;
}

type SportsStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;
const SPORTS_COPY: Record<SportsStage, string> = {
  1: 'It is Sports Day. Josh and William arrive ready for a big challenge.',
  2: 'Listen carefully and use the English action words to help William through each event.',
  3: 'The race is about to begin. Type the action words before the clock runs out.',
  4: 'A hurdle is in the way. What should William do?',
  5: 'Great jump! William keeps moving.',
  6: 'The climbing wall is next. Type the action word.',
  7: 'He reaches the top and keeps going.',
  8: 'Choose the action that will get William to the next station.',
  9: 'The next challenge is carrying equipment across the field.',
  10: 'Type both actions to complete the carrying challenge.',
  11: 'Now type the action needed to finish the task.',
  12: 'The final line is in sight. Type the last action word.',
  13: 'Sports Day is complete!',
  14: 'William did it! He earns a medal for his hard work.',
  15: 'After a long day, you finally get peace and quiet in the back garden, just as you wanted. But it is cold now and something is missing. DINNER TIME!',
  16: 'Dinner is ready. Josh is happy, warm, and proud of William.'
};

export function SportsDayAdventure({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const [stage, setStage] = useState<SportsStage>(1);
  const [answers, setAnswers] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [wrong, setWrong] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const { speak, cancel } = useSpeech();
  const timed = stage >= 3 && stage <= 12;
  const expected: Partial<Record<SportsStage, string[]>> = { 3: ['start', 'run'], 4: ['jump'], 6: ['climb'], 10: ['pick up', 'carry'], 11: ['put down'], 12: ['finish'], 15: ['dinner time'] };
  const needsTyping = Boolean(expected[stage]);
  const image = assetUrl(`scenes/sports-day/g${stage}.png`);

  useEffect(() => {
    speak(SPORTS_COPY[stage], 'adventure');
    return cancel;
  }, [stage, speak, cancel]);

  useEffect(() => {
    if (!timed || seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds(value => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [timed, seconds]);

  useEffect(() => { if (seconds === 0 && timed) { setStage(13); setWrong(true); } }, [seconds, timed]);

  const next = () => { setStage(value => Math.min(16, value + 1) as SportsStage); setAnswers([]); setInput(''); setWrong(false); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const words = expected[stage] ?? [];
    const answer = input.trim().toLowerCase();
    if (answer !== words[answers.length]) { setWrong(true); return; }
    unlock(answer); setInput(''); setWrong(false);
    if (answers.length + 1 < words.length) setAnswers(value => [...value, answer]); else next();
  };
  const chooseWalk = (choice: string) => { if (choice === 'walk') { unlock(choice); next(); } else setWrong(true); };
  const retry = () => { setStage(3); setSeconds(60); setAnswers([]); setWrong(false); };

  return <div className="fixed inset-0 overflow-hidden bg-black"><SceneImage src={image} alt="Sports Day" /><div className="absolute inset-0 bg-black/35" /><header className="scene-header"><button onClick={onBack}>Map</button><span>SPORTS DAY {timed && <strong className="ml-3 text-[#f0d88f]">{seconds}s</strong>}</span></header><main className="scene-panel"><div className="scene-eyebrow">Narrator</div><h1>{SPORTS_COPY[stage]}</h1>{stage === 8 ? <div className="scene-choices"><button onClick={() => chooseWalk('run')}>run</button><button onClick={() => chooseWalk('walk')}>walk</button><button onClick={() => chooseWalk('jump')}>jump</button>{wrong && <p className="scene-error">Try again. Choose “walk”.</p>}</div> : stage === 13 ? <>{seconds === 0 ? <><p className="scene-error">Time is up. Try the sports challenges again.</p><button className="scene-action" onClick={retry}>Try again <ArrowRight size={16} /></button></> : <button className="scene-action" onClick={next}>See William's medal <ArrowRight size={16} /></button>}</> : needsTyping ? <><p>{stage === 15 ? 'Type “dinner time” to finish the day.' : `Type: ${expected[stage]!.length > 1 ? `${expected[stage]![answers.length]} (${answers.length + 1}/${expected[stage]!.length})` : expected[stage]![0]}`}</p><form className="scene-form" onSubmit={submit}><input autoFocus value={input} onChange={event => setInput(event.target.value)} placeholder="type the action..." /><button>Check</button></form>{wrong && <p className="scene-error">Try again.</p>}</> : <button className="scene-action" onClick={stage === 16 ? onComplete : next}>{stage === 16 ? 'Finish Sports Day' : 'Continue'} <ArrowRight size={16} /></button>}</main></div>;
}

const SOCCER_WORDS = ['run', 'drink water', 'walk', "you're doing great", 'good', 'you are playing well'];
export function SoccerMatchAdventure({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const [step, setStep] = useState(0), [wordIndex, setWordIndex] = useState(0), [input, setInput] = useState(''), [wrong, setWrong] = useState(false);
  const images = useMemo(() => [1, 2, 3, 4, 5, 6, 7].map(n => assetUrl(`scenes/soccer/g${n}.png`)), []);
  const lines = ['Josh and William arrive at the soccer match.', 'Dad tells William to listen closely to the words he says and focus on them. He will be okay.', 'Repeat the encouraging words to William as the match begins.', 'William keeps going and listens to Dad.', 'The whole crowd cheers him on.', 'Goal! William wins the match!', 'The match is over. Josh and William walk home together, proud and happy.'];
  const skip = () => { if (step < 2) setStep(n => n + 1); else if (step === 2) { SOCCER_WORDS.slice(wordIndex).forEach(unlock); setWordIndex(SOCCER_WORDS.length); setStep(3); } else if (step < 6) setStep(n => n + 1); else onComplete(); };
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === 'ArrowRight') { event.preventDefault(); skip(); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); });
  const submit = (event: React.FormEvent) => { event.preventDefault(); const word = SOCCER_WORDS[wordIndex]; if (input.trim().toLowerCase() !== word) { setWrong(true); return; } unlock(word); setInput(''); setWrong(false); if (wordIndex === SOCCER_WORDS.length - 1) setStep(3); else setWordIndex(n => n + 1); };
  return <div className="fixed inset-0 overflow-hidden bg-black"><SceneImage src={images[step]} alt="William's soccer match" /><div className="absolute inset-0 bg-black/35" /><header className="scene-header"><button onClick={onBack}>Map</button><span>SOCCER MATCH</span></header><main className="scene-panel"><div className="scene-eyebrow">Narrator</div><h1>{lines[step]}</h1>{step === 2 ? <><p>Type the words Dad says to William.</p><div className="scene-progress">Word {wordIndex + 1} / {SOCCER_WORDS.length}</div><form className="scene-form" onSubmit={submit}><input autoFocus value={input} onChange={e => setInput(e.target.value)} placeholder="type the words..." /><button>Say it</button></form>{wrong && <p className="scene-error">Try again and encourage William.</p>}</> : <button className="scene-action" onClick={skip}>{step === 6 ? 'Return to map' : 'Continue'} <ArrowRight size={16} /></button>}</main></div>;
}
