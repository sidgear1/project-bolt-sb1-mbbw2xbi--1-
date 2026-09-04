import { useState, useRef, useEffect } from 'react';
import { X, Lock, Unlock, Volume2, Check, AlertTriangle, Zap } from 'lucide-react';
import { stripAccents } from '../utils/levenshtein';

type Mood = 'warm' | 'happy' | 'amused' | 'offended' | 'nostalgic' | 'thoughtful' | 'worried' | 'flustered' | 'proud';

interface Sentence { it: string; en: string; }
interface LuciaResponse { sentences: Sentence[]; mood: Mood; }
interface ChatEntry {
  type: 'player' | 'lucia';
  text?: string;
  response?: LuciaResponse;
  id: number;
}

interface Props {
  xp: number;
  onSpendXp: (n: number) => void;
  onAwardXp: (n: number) => void;
  speak: (text: string, voice?: 'male' | 'female') => void;
  onClose: () => void;
  onAddInventory: (item: string) => void;
}

interface SentenceOption { id: string; text: string; itText?: string; }

const LEFT_OPTIONS: SentenceOption[] = [
  { id: 'i_want_to_buy', text: 'I want to buy', itText: 'Voglio comprare' },
  { id: 'have_you_seen', text: 'Have you seen', itText: 'Hai visto' },
  { id: 'what_do_you_think_of', text: 'What do you think of', itText: 'Cosa pensi di' },
  { id: 'tell_me_about', text: 'Tell me about', itText: 'Parlami di' },
];

const RIGHT_OPTIONS: Record<string, SentenceOption[]> = {
  i_want_to_buy: [
    { id: 'bread', text: 'some bread', itText: 'del pane' },
    { id: 'wine', text: 'some wine', itText: 'del vino' },
    { id: 'the_newspaper', text: 'the newspaper', itText: 'il giornale' },
    { id: 'something_to_eat', text: 'something to eat', itText: 'qualcosa da mangiare' },
  ],
  have_you_seen: [
    { id: 'any_men', text: 'any men', itText: 'degli uomini' },
    { id: 'a_stranger', text: 'a stranger', itText: 'uno sconosciuto' },
    { id: 'a_black_car', text: 'a black car', itText: 'una macchina nera' },
    { id: 'anything_suspicious', text: 'anything suspicious', itText: 'qualcosa di sospetto' },
  ],
  what_do_you_think_of: [
    { id: 'florence', text: 'Florence', itText: 'Firenze' },
    { id: 'the_neighborhood', text: 'the neighborhood', itText: 'il quartiere' },
    { id: 'the_weather', text: 'the weather', itText: 'il tempo' },
    { id: 'the_market', text: 'the market', itText: 'il mercato' },
  ],
  tell_me_about: [
    { id: 'yourself', text: 'yourself', itText: 'te stessa' },
    { id: 'your_family', text: 'your family', itText: 'la tua famiglia' },
    { id: 'your_bread', text: 'your bread', itText: 'il tuo pane' },
    { id: 'the_cafe', text: 'the café', itText: 'il caffè' },
  ],
};

interface Quiz { question: string; enQuestion: string; options: string[]; correctIndex: number; xpReward: number; }

interface ComboResult {
  playerIt: string;
  playerEn: string;
  response: LuciaResponse;
  quiz?: Quiz;
  bread?: boolean;
}

const COMBOS: Record<string, ComboResult> = {
  'i_want_to_buy_bread': {
    playerEn: 'I want to buy some bread.',
    playerIt: 'Voglio comprare del pane.',
    response: {
      mood: 'happy',
      sentences: [
        { it: 'Certo! Ho le migliori pagnottelle di tutto il quartiere. Mio padre mi ha trasmesso la ricetta segreta.', en: 'Of course! I have the best bread rolls in the whole neighborhood. My father passed me the secret recipe.' },
      ],
    },
    quiz: {
      question: 'Chi ha trasmesso la ricetta a Lucia?',
      enQuestion: 'Who passed the recipe onto Lucia?',
      options: ['Suo padre', 'Sua madre', 'Suo fratello', 'Un amico'],
      correctIndex: 0,
      xpReward: 120,
    },
    bread: true,
  },
  'i_want_to_buy_wine': {
    playerEn: 'I want to buy some wine.',
    playerIt: 'Voglio comprare del vino.',
    response: {
      mood: 'amused',
      sentences: [
        { it: 'Del vino? Non è proprio il mio campo, ma c\'è un\'enoteca eccellente in via Tornabuoni.', en: 'Wine? That\'s not really my area, but there\'s an excellent wine shop on Via Tornabuoni.' },
      ],
    },
  },
  'i_want_to_buy_the_newspaper': {
    playerEn: 'I want to buy the newspaper.',
    playerIt: 'Voglio comprare il giornale.',
    response: {
      mood: 'thoughtful',
      sentences: [
        { it: 'Il giornale... non vendo i giornali, signore. Ma c\'è un\'edicola proprio all\'angolo.', en: 'The newspaper... I don\'t sell newspapers, sir. But there\'s a kiosk just at the corner.' },
      ],
    },
  },
  'i_want_to_buy_something_to_eat': {
    playerEn: 'I want to buy something to eat.',
    playerIt: 'Voglio comprare qualcosa da mangiare.',
    response: {
      mood: 'warm',
      sentences: [
        { it: 'Hai l\'aria di aver fame! Tieni, prendi questa pagnotta. Mi fido che pagherai la prossima volta.', en: 'You look hungry! Here, take this bread loaf. I trust you to pay next time.' },
      ],
    },
    bread: true,
  },
  'have_you_seen_any_men': {
    playerEn: 'Have you seen any men?',
    playerIt: 'Hai visto degli uomini?',
    response: {
      mood: 'worried',
      sentences: [
        { it: 'Se parli degli uomini in completi neri — sì, li ho visti ieri sera. Cercavano qualcuno.', en: 'If you mean the men in black suits — yes, I saw them last night. They were looking for someone.' },
      ],
    },
  },
  'have_you_seen_a_stranger': {
    playerEn: 'Have you seen a stranger?',
    playerIt: 'Hai visto uno sconosciuto?',
    response: {
      mood: 'worried',
      sentences: [
        { it: 'Sì, degli uomini sospetti sono andati verso il mercato coperto. Indossavano completi neri.', en: 'Yes, suspicious-looking men went toward the covered market. They were wearing black suits.' },
      ],
    },
  },
  'have_you_seen_a_black_car': {
    playerEn: 'Have you seen a black car?',
    playerIt: 'Hai visto una macchina nera?',
    response: {
      mood: 'thoughtful',
      sentences: [
        { it: 'Una macchina nera era parcheggiata davanti al caffè tutta la notte. È partita prima dell\'alba.', en: 'A black car was parked in front of the café all night. It left before dawn.' },
      ],
    },
  },
  'have_you_seen_anything_suspicious': {
    playerEn: 'Have you seen anything suspicious?',
    playerIt: 'Hai visto qualcosa di sospetto?',
    response: {
      mood: 'worried',
      sentences: [
        { it: 'Ieri sera, degli uomini in completi neri facevano domande al padrone del caffè. Cercavano qualcuno.', en: 'Last night, men in black suits were asking questions to the café owner. They were looking for someone.' },
      ],
    },
  },
  'what_do_you_think_of_florence': {
    playerEn: 'What do you think of Florence?',
    playerIt: 'Cosa pensi di Firenze?',
    response: {
      mood: 'proud',
      sentences: [
        { it: 'Firenze? Questa città mi fa ancora venire i brividi dopo vent\'anni! Sono arrivata da Siena a ventidue anni.', en: 'Florence? This city still gives me chills after twenty years! I arrived from Siena at twenty-two.' },
      ],
    },
  },
  'what_do_you_think_of_the_neighborhood': {
    playerEn: 'What do you think of the neighborhood?',
    playerIt: 'Cosa pensi del quartiere?',
    response: {
      mood: 'worried',
      sentences: [
        { it: 'Il quartiere cambia troppo in fretta. I vecchi vicini partono e l\'affitto aumenta ogni anno.', en: 'The neighborhood is changing too fast. Old neighbors leave and rent increases every year.' },
      ],
    },
  },
  'what_do_you_think_of_the_weather': {
    playerEn: 'What do you think of the weather?',
    playerIt: 'Cosa pensi del tempo?',
    response: {
      mood: 'warm',
      sentences: [
        { it: 'Ah, il sole oggi — fa venire voglia di stare fuori! Ma a Firenze, può cambiare in dieci minuti.', en: 'Ah, the sun today — it makes you want to stay outside! But in Florence, it can change in ten minutes.' },
      ],
    },
  },
  'what_do_you_think_of_the_market': {
    playerEn: 'What do you think of the market?',
    playerIt: 'Cosa pensi del mercato?',
    response: {
      mood: 'proud',
      sentences: [
        { it: 'Questo mercato è la mia seconda casa. Lavoro qui da dodici anni. Ogni mattina mi alzo alle cinque.', en: 'This market is my second home. Twelve years I\'ve worked here. Every morning I get up at five.' },
      ],
    },
  },
  'tell_me_about_yourself': {
    playerEn: 'Tell me about yourself.',
    playerIt: 'Parlami di te stessa.',
    response: {
      mood: 'warm',
      sentences: [
        { it: 'Mi chiamo Lucia Romano. Sono una fornaia da dodici anni, arrivata da Siena.', en: 'My name is Lucia Romano. I\'ve been a baker for twelve years, arrived from Siena.' },
      ],
    },
  },
  'tell_me_about_your_family': {
    playerEn: 'Tell me about your family.',
    playerIt: 'Parlami della tua famiglia.',
    response: {
      mood: 'nostalgic',
      sentences: [
        { it: 'Mio marito Marco è falegname. Ho due figli: Giulia vuole diventare architetto, e Tommaso è adorabile!', en: 'My husband Marco is a carpenter. I have two children: Giulia wants to become an architect, and Tommaso is adorable!' },
      ],
    },
  },
  'tell_me_about_your_bread': {
    playerEn: 'Tell me about your bread.',
    playerIt: 'Parlami del tuo pane.',
    response: {
      mood: 'proud',
      sentences: [
        { it: 'Il mio pane? Il migliore di tutta la via! Mio padre mi ha dato la ricetta segreta.', en: 'My bread? The best on the whole street! My father gave me the secret recipe.' },
      ],
    },
    quiz: {
      question: 'Chi ha dato la ricetta segreta a Lucia?',
      enQuestion: 'Who gave the secret recipe to Lucia?',
      options: ['Suo padre', 'Sua madre', 'Suo marito', 'Un amico'],
      correctIndex: 0,
      xpReward: 120,
    },
  },
  'tell_me_about_the_cafe': {
    playerEn: 'Tell me about the café.',
    playerIt: 'Parlami del caffè.',
    response: {
      mood: 'worried',
      sentences: [
        { it: 'Il caffè all\'angolo? Qualcosa di strano succede lì da ieri sera. Uomini in completi neri, una macchina parcheggiata tutta la notte...', en: 'The café on the corner? Something strange has been happening there since last night. Men in black suits, a car parked all night...' },
      ],
    },
  },
};

const V: Record<string, string> = {
  io: 'I', tu: 'you', lui: 'he', lei: 'she', noi: 'we', voi: 'you', loro: 'they',
  sono: 'am', e: 'is', ha: 'has', hai: 'have',
  il: 'the', la: 'the', lo: 'the', i: 'the', le: 'the', un: 'a', uno: 'a', una: 'a',
  e_conj: 'and', ma: 'but', o: 'or', non: 'not', mai: 'never',
  che: 'that', chi: 'who', molto: 'very', bene: 'well', buono: 'good', bello: 'beautiful',
  grazie: 'thank you', ciao: 'hello', si: 'yes', no: 'no',
  mio: 'my', mia: 'my', miei: 'my', suo: 'his', sua: 'her', vostro: 'your', loro_p: 'their',
  con: 'with', per: 'for', 'in': 'in', su: 'on', di: 'of', da: 'from',
  marito: 'husband', moglie: 'wife', figlio: 'son', figlia: 'daughter', bambini: 'children',
  madre: 'mother', padre: 'father', pane: 'bread', pagnotta: 'bread loaf',
  caffè: 'coffee', vino: 'wine', firenze: 'Florence', via: 'street', quartiere: 'neighborhood',
  mercato: 'market', uomini: 'men', uomo: 'man', completi: 'suits', neri: 'black',
  sospetto: 'suspicious', cercavano: 'were looking for',
  macchina: 'car', notte: 'night', mattina: 'morning', sera: 'evening', ieri: 'yesterday',
  cinque: 'five', anni: 'years', vecchio: 'old', giovane: 'young',
  segreto: 'secret', ricetta: 'recipe', trasmesso: 'passed', dato: 'gave',
  migliori: 'best', tutto: 'all',
  campo: 'area', enoteca: 'wine shop', edicola: 'kiosk', angolo: 'corner',
  giornale: 'newspaper', fame: 'hungry', fiducia: 'trust',
  pagare: 'pay', prossima: 'next', volta: 'time', piccolo: 'small',
  coperto: 'covered', indossavano: 'wore', sicuro: 'sure',
  parcheggiata: 'parked', davanti: 'front', partita: 'left', prima: 'before',
  alba: 'dawn', senza: 'without', rumore: 'noise', preoccupata: 'worried', facevano: 'asked',
  padrone: 'owner', attenzione: 'careful', città: 'city',
  brividi: 'chills', arrivata: 'arrived', voluto: 'wanted', partire: 'leave', cambia: 'changes',
  vecchi: 'old', vicini: 'neighbors', partono: 'leave', affitto: 'rent', aumenta: 'increases',
  ogni: 'each', anno: 'year', triste: 'sad', sole: 'sun', stare: 'stay', fuori: 'outside',
  dieci: 'ten', minuti: 'minutes', sa: 'knows', seconda: 'second', casa: 'home',
  lavoro: 'work', alzo: 'get up', preparare: 'prepare', fresco: 'fresh',
  chiamo: 'am called', romano: 'Romano', fornaia: 'baker',
  dodici: 'twelve', qui: 'here',
  alzata: 'get up', ore: 'hours',
  marito_p: 'husband', marco: 'Marco', falegname: 'carpenter',
  vuole: 'wants', diventare: 'become', architetto: 'architect', odia: 'hates', matematica: 'math',
  adorabile: 'adorable', strano: 'strange', aperto: 'opened',
  hai_v: 'have', aria: 'look', prendi: 'take', fai: 'do',
  voglio: 'want', comprare: 'buy', pensi: 'think', parla: 'speak', mi: 'me',
  about: 'about', think: 'think', buy: 'buy', seen: 'seen', your: 'your', bread: 'bread',
  myself: 'myself', family: 'family', man: 'man', weather: 'weather',
  market: 'market', neighborhood: 'neighborhood', something: 'something', eat: 'eat',
  anything: 'anything', suspicious: 'suspicious', stranger: 'stranger', black: 'black',
  car: 'car', men: 'men', newspaper: 'newspaper', wine: 'wine', the: 'the', some: 'some',
  to: 'to', what: 'what', do: 'do', you: 'you', of: 'of', tell: 'tell',
  have: 'have', want: 'want',
  certo: 'of course', ho: 'I have',
  padre_p: 'father', questa: 'this',
  davvero: 'really',
  eccellente: 'excellent', tornabuoni: 'Tornabuoni',
  vendo: 'sell', signore: 'sir', proprio: 'just',
  laria: 'the look', daver: 'to have', tieni: 'here',
  qualcuno: 'someone',
  sospetti: 'suspicious',
  era: 'was',
  succede: 'happens',
  ancora: 'still', dopo: 'after', venti: 'twenty',
  siena: 'Siena', due: 'two',
  troppo: 'too', 'in fretta': 'fast',
  piu: 'more', stesso: 'same',
  oggi: 'today', fa: 'makes', voglia: 'desire',
  puo: 'can', cambiare: 'change',
  giulia: 'Giulia', tommaso: 'Tommaso',
  migliore_p: 'best',
  qualcosa: 'something', cosa: 'thing',
};

function lookupWord(w: string): string | undefined {
  const key = stripAccents(w.toLowerCase().replace(/[^a-z]/g, ''));
  return V[key];
}

const MOOD_COLORS: Record<Mood, string> = {
  warm: 'text-[#c4942a]', happy: 'text-[#4ade80]', amused: 'text-[#f59e0b]',
  offended: 'text-red-400', nostalgic: 'text-[#a78bfa]', thoughtful: 'text-[#60a5fa]',
  worried: 'text-[#fb923c]', flustered: 'text-[#f472b6]', proud: 'text-[#34d399]',
};

const MOOD_LABEL: Record<Mood, string> = {
  warm: 'warmly', happy: 'happily', amused: 'with a smile', offended: 'firmly',
  nostalgic: 'wistfully', thoughtful: 'thoughtfully', worried: 'with concern',
  flustered: 'flustered', proud: 'proudly',
};

function WordSpan({ word, unlockedWords, xp, onUnlock }: {
  word: string; unlockedWords: Set<string>; xp: number;
  onUnlock: (w: string) => void;
}) {
  const [tooltip, setTooltip] = useState(false);
  const stripped = stripAccents(word.toLowerCase().replace(/[^a-zàâäéèêëîïôùûüçœæ]/gi, ''));
  const normalized = stripAccents(stripped);
  const translation = lookupWord(word);
  const unlocked = unlockedWords.has(normalized);
  if (!translation) return <span className="text-[#f0e8d8] text-[14px] leading-relaxed">{word}</span>;
  return (
    <span className="relative inline-block">
      {unlocked ? (
        <span className="text-[#f0e8d8] text-[14px] leading-relaxed underline decoration-dotted decoration-[#c4942a]/50 cursor-help"
          onMouseEnter={() => setTooltip(true)} onMouseLeave={() => setTooltip(false)}>
          {word}
        </span>
      ) : (
        <button onClick={() => onUnlock(normalized)}
          className={`text-[#c4a855] text-[14px] leading-relaxed hover:text-[#e8c870] transition-colors cursor-pointer underline decoration-dotted decoration-[#c4942a]/50 ${xp < 1 ? 'opacity-50' : ''}`}
          title={xp >= 1 ? 'Click to unlock (1 AP)' : 'Not enough AP'}>
          {word}
        </button>
      )}
      {tooltip && unlocked && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded-lg bg-[#1a1208] border border-[#c4942a]/50 text-[#c4942a] text-xs whitespace-nowrap z-50 pointer-events-none shadow-lg">
          {translation}
        </span>
      )}
    </span>
  );
}

function SpacedSentence({ sentence, unlockedWords, xp, onUnlock }: {
  sentence: string; unlockedWords: Set<string>; xp: number;
  onUnlock: (w: string) => void;
}) {
  const words = sentence.split(' ');
  return (
    <span className="flex flex-wrap gap-1">
      {words.map((word, i) => (
        <span key={i}>
          <WordSpan word={word} unlockedWords={unlockedWords} xp={xp} onUnlock={onUnlock} />
        </span>
      ))}
    </span>
  );
}

export default function FemmeDuMarcheDialogue({ xp, onSpendXp, onAwardXp, speak, onClose, onAddInventory }: Props) {
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [unlockedWords, setUnlockedWords] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<string | null>(null);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [typingInput, setTypingInput] = useState('');
  const [typingTarget, setTypingTarget] = useState<string | null>(null);
  const [typingTargetEn, setTypingTargetEn] = useState<string | null>(null);
  const [currentCombo, setCurrentCombo] = useState<ComboResult | null>(null);
  const [typingWrong, setTypingWrong] = useState(false);
  const [showEnglish, setShowEnglish] = useState(true);
  const [showTutorial, setShowTutorial] = useState(true);
  const [activeComprehension, setActiveComprehension] = useState<Quiz | null>(null);
  const [compSelected, setCompSelected] = useState<number | null>(null);
  const [compWrong, setCompWrong] = useState(false);
  const [compDone, setCompDone] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [history]);

  useEffect(() => {
    const greeting: LuciaResponse = {
      mood: 'warm',
      sentences: [
        { it: 'Ciao! Benvenuto al mio banco. Cosa posso fare per te?', en: 'Hello! Welcome to my stall. What can I do for you?' },
      ],
    };
    idRef.current += 1;
    setHistory([{ type: 'lucia', response: greeting, id: idRef.current }]);
    speak(greeting.sentences[0].en, 'male');
  }, []);

  const showNotif = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2200);
  };

  const handleUnlockWord = (normalized: string) => {
    if (unlockedWords.has(normalized)) return;
    if (xp < 1) { showNotif('Not enough AP! (Need 1 AP)'); return; }
    onSpendXp(1);
    setUnlockedWords(prev => new Set([...prev, normalized]));
  };

  const handleLeftSelect = (leftId: string) => {
    setSelectedLeft(leftId === selectedLeft ? null : leftId);
    setSelectedRight(null);
  };

  const handleRightSelect = (rightId: string) => {
    if (!selectedLeft) return;
    setSelectedRight(rightId);
    const comboKey = `${selectedLeft}_${rightId}`;
    const combo = COMBOS[comboKey];
    if (!combo) return;
    setCurrentCombo(combo);
    setTypingTarget(combo.playerEn);
    setTypingTargetEn(null);
    setTypingInput('');
    setTypingWrong(false);
  };

  const handleTypingSubmit = () => {
    if (!typingTarget || !currentCombo) return;
    const normalizedInput = stripAccents(typingInput.toLowerCase().trim());
    const normalizedTarget = stripAccents(typingTarget.toLowerCase().trim());
    if (normalizedInput === normalizedTarget) {
      const playerEntry: ChatEntry = { type: 'player', text: currentCombo.playerEn, id: ++idRef.current };
      const luciaEntry: ChatEntry = { type: 'lucia', response: currentCombo.response, id: ++idRef.current };
      setHistory(prev => [...prev, playerEntry, luciaEntry]);
      // First repeat the typed phrase so the player hears it, then Lucia's response
      speak(currentCombo.playerEn, 'male');
      setTimeout(() => speak(currentCombo.response.sentences.map(s => s.en).join(' '), 'male'), 2000);
      setTypingTarget(null);
      setTypingTargetEn(null);
      setTypingInput('');
      setSelectedLeft(null);
      setSelectedRight(null);
      if (currentCombo.quiz) {
        setTimeout(() => {
          setActiveComprehension(currentCombo.quiz!);
          setCompSelected(null);
          setCompWrong(false);
          setCompDone(false);
        }, 500);
      }
      if (currentCombo.bread) {
        onAddInventory('baguette');
        showNotif('You received a Bread Loaf! (+20 HP in combat)');
      }
      setCurrentCombo(null);
    } else {
      setTypingWrong(true);
      setTimeout(() => setTypingWrong(false), 1500);
    }
  };

  const handleComprehensionAnswer = (idx: number) => {
    if (!activeComprehension || compDone) return;
    setCompSelected(idx);
    if (idx === activeComprehension.correctIndex) {
      setCompDone(true);
      onAwardXp(activeComprehension.xpReward);
      setTimeout(() => {
        setActiveComprehension(null);
        setCompSelected(null);
        setCompWrong(false);
        setCompDone(false);
      }, 2000);
    } else {
      setCompWrong(true);
      setTimeout(() => { setCompWrong(false); setCompSelected(null); }, 1000);
    }
  };

  const rightOptions = selectedLeft ? RIGHT_OPTIONS[selectedLeft] ?? [] : [];

  const getTypingStatus = (pos: number): 'correct' | 'incorrect' | 'none' => {
    const target = stripAccents((typingTarget || '').toLowerCase());
    const input = stripAccents(typingInput.toLowerCase());
    if (pos >= input.length) return 'none';
    const inputChar = input[pos];
    const targetChar = target[pos];
    if (!inputChar) return 'none';
    if (inputChar === targetChar) return 'correct';
    return 'incorrect';
  };

  return (
    <>
      {/* Tutorial prompt — appears on the side when dialogue opens */}
      {showTutorial && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 max-w-[180px] pointer-events-auto">
          <div className="rounded-2xl border border-[#c4942a]/40 px-3 py-3 shadow-2xl"
            style={{ background: 'rgba(10,6,4,0.95)', backdropFilter: 'blur(8px)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[#c4942a] text-[10px] uppercase tracking-wider font-bold">Tip</span>
              <button onClick={() => setShowTutorial(false)} className="text-[#8b6914] hover:text-[#c4942a] transition-colors">
                <X size={12} />
              </button>
            </div>
            <p className="text-[#c4b080] text-[11px] leading-relaxed">
              Click on the highlighted words in Lucia's speech to explore their meanings, or turn them off with the toggle above.
            </p>
            <button onClick={() => setShowTutorial(false)} className="mt-2 text-[#8b6914] hover:text-[#c4942a] text-[9px] uppercase tracking-wider transition-colors">
              Got it
            </button>
          </div>
        </div>
      )}

    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-lg px-4">
      <div data-task-editor-panel={typingTarget ? "market-dialogue-typing" : undefined} className="rounded-2xl shadow-2xl overflow-hidden border border-[#8b6914]/35"
        style={{ background: 'rgba(6,3,2,0.97)', backdropFilter: 'blur(12px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
          style={{ borderColor: 'rgba(139,105,20,0.2)', background: 'rgba(10,6,4,0.7)' }}>
          <div>
            <div className="text-[#e8d5a3] text-sm font-bold tracking-wide">Lucia Romano</div>
            <div className="text-[#a08060] text-xs">La Donna del Mercato</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowEnglish(true)}
              className="text-[#8b6914] hover:text-[#c4942a] text-[10px] uppercase tracking-wider border border-[#8b6914]/30 rounded px-2 py-0.5 transition-colors">
              EN
            </button>
            <div className="flex items-center gap-1">
              <Zap size={10} className="text-[#c4942a]" />
              <span className="text-[#c4942a] font-mono font-bold text-sm">{xp}</span>
              <span className="text-[#8b6914] text-[10px]">AP</span>
            </div>
            <button onClick={onClose} className="text-[#8b6914] hover:text-[#c4942a] transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* AP info */}
        <div className="flex items-center gap-4 px-4 py-1 border-b text-[#7a6040] text-[10px] flex-shrink-0"
          style={{ borderColor: 'rgba(139,105,20,0.1)', background: 'rgba(10,6,4,0.4)' }}>
          <span className="flex items-center gap-1"><Lock size={8} /> 1 AP = word</span>
        </div>

        {/* Chat history */}
        <div ref={historyRef} className="overflow-y-auto px-3 py-2 space-y-2 max-h-[180px] min-h-[80px]">
          {history.map(entry => (
            <div key={entry.id}>
              {entry.type === 'player' && (
                <div className="flex justify-end">
                  <div className="rounded-2xl rounded-tr-sm px-3 py-1.5 max-w-[85%]"
                    style={{ background: 'rgba(26,18,8,1)', border: '1px solid rgba(139,105,20,0.35)' }}>
                    <p className="text-[#f0e8d8] text-[13px] leading-relaxed">{entry.text}</p>
                  </div>
                </div>
              )}
              {entry.type === 'lucia' && entry.response && (
                <div className="flex justify-start">
                  <div className="max-w-[94%]">
                    <div className={`text-[10px] mb-1 font-medium ${MOOD_COLORS[entry.response.mood]}`}>
                      Lucia — <em className="font-normal">{MOOD_LABEL[entry.response.mood]}</em>
                    </div>
                    <div className="rounded-2xl rounded-tl-sm px-3 py-2 space-y-2"
                      style={{ background: 'rgba(16,10,4,0.85)', border: '1px solid rgba(139,105,20,0.25)' }}>
                      {entry.response.sentences.map((s, si) => (
                        <div key={si}>
                          <div className="flex items-start gap-1.5">
                            <button onClick={() => speak(s.en, 'male')}
                              className="text-[#8b6914] hover:text-[#c4942a] transition-colors flex-shrink-0 mt-0.5"
                              title="Listen">
                              <Volume2 size={11} />
                            </button>
                            <div className="text-[14px] leading-relaxed">
                              <SpacedSentence sentence={s.en} unlockedWords={unlockedWords} xp={xp}
                                onUnlock={handleUnlockWord} />
                            </div>
                          </div>
                          <p className="text-[#a08060] text-xs italic mt-0.5 pl-5">{s.en}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Notification */}
        {notification && (
          <div className="px-4 py-1 border-t text-[#c4942a] text-[10px] flex-shrink-0"
            style={{ background: 'rgba(196,148,42,0.15)', borderColor: 'rgba(196,148,42,0.3)' }}>
            {notification}
          </div>
        )}

        {/* Comprehension quiz overlay */}
        {activeComprehension && (
          <div className="px-4 py-3 border-t" style={{ borderColor: 'rgba(139,105,20,0.25)', background: 'rgba(10,6,4,0.8)' }}>
            <div className="text-[#c4942a] text-[11px] font-bold mb-2">{activeComprehension.question}</div>
            <div className="text-[#a08060] text-[10px] mb-2">{activeComprehension.enQuestion}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {activeComprehension.options.map((opt, i) => (
                <button key={i} onClick={() => handleComprehensionAnswer(i)}
                  className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] border transition-all ${
                    compSelected === i && compWrong ? 'bg-red-900/40 border-red-600/60 text-red-300' :
                    compDone && compSelected === i ? 'bg-green-900/40 border-green-600/60 text-green-300' :
                    'bg-[#0d0804]/60 border-[#8b6914]/30 text-[#c4b080] hover:border-[#c4942a]/50 hover:text-[#e8d5a3]'
                  }`}>
                  {opt}
                </button>
              ))}
            </div>
            {compDone && (
              <div className="flex items-center gap-1 text-green-400 text-[10px] mt-1.5">
                <Check size={10} /> Correct! +{activeComprehension.xpReward} XP
              </div>
            )}
            {compWrong && !compDone && (
              <div className="flex items-center gap-1 text-red-400 text-[10px] mt-1">
                <AlertTriangle size={10} /> Try again
              </div>
            )}
          </div>
        )}

        {/* Typing area - when a sentence is selected */}
        {typingTarget && !activeComprehension && (
          <div className="px-4 py-2 border-t" style={{ borderColor: 'rgba(139,105,20,0.25)', background: 'rgba(10,6,4,0.7)' }}>
            <div className="text-[#8b6914] text-[10px] uppercase tracking-widest mb-1.5">输入英语句子：</div>
            <div className="bg-[#1a1208] border border-[#8b6914]/30 rounded-lg px-3 py-2 mb-2">
              <div className="flex flex-wrap gap-0.5 font-mono text-[13px]">
                {typingTarget.split('').map((char, idx) => {
                  const status = getTypingStatus(idx);
                  let textColor = 'text-[#c4942a]/50';
                  let bgColor = 'bg-transparent';
                  if (status === 'correct') { textColor = 'text-green-400'; bgColor = 'bg-green-500/20'; }
                  else if (status === 'incorrect') { textColor = 'text-red-400'; bgColor = 'bg-red-500/20'; }
                  return (
                    <span key={idx} className={`${textColor} ${bgColor} px-0.5 rounded transition-all duration-150`}>
                      {char === ' ' ? '\u00A0' : char}
                    </span>
                  );
                })}
              </div>
            </div>
            {showEnglish && (
              <div className="text-[#a08060] text-[10px] mb-1.5 italic">{typingTargetEn}</div>
            )}
            <div className="flex items-center gap-2">
              <input value={typingInput} onChange={e => setTypingInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleTypingSubmit(); }}
                className="flex-1 bg-transparent text-[#f0e8d8] text-sm font-mono outline-none placeholder-[#8b6914]/50 caret-[#c4942a] min-w-0 border-b border-[#8b6914]/30 focus:border-[#c4942a] py-1"
                autoComplete="off" spellCheck={false} placeholder="type here..." />
              <button onClick={handleTypingSubmit}
                className="bg-[#8b6914]/30 hover:bg-[#c4942a]/40 border border-[#8b6914]/40 hover:border-[#c4942a] text-[#c4942a] text-[10px] px-2.5 py-1 rounded-lg transition-all uppercase tracking-wider flex-shrink-0">
                Enter
              </button>
            </div>
            {typingWrong && (
              <div className="flex items-center gap-1 text-red-400 text-[10px] mt-1">
                <AlertTriangle size={10} /> Not quite — try again
              </div>
            )}
          </div>
        )}

        {/* Two-column sentence builder - side by side */}
        {!typingTarget && !activeComprehension && (
          <div className="flex-shrink-0 border-t" style={{ borderColor: 'rgba(139,105,20,0.25)', background: 'rgba(10,6,4,0.7)' }}>
            <div className="px-3 py-2">
              <div className="text-[#8b6914] text-[10px] uppercase tracking-widest mb-1.5">Select a sentence:</div>
              <div className="flex gap-2">
                {/* Left column */}
                <div className="flex-1 flex flex-col gap-1">
                  {LEFT_OPTIONS.map(opt => (
                    <button key={opt.id} onClick={() => handleLeftSelect(opt.id)}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                        selectedLeft === opt.id
                          ? 'border-[#c4942a]/70 bg-[#c4942a]/15 text-[#e8d5a3]'
                          : 'border-[#8b6914]/30 bg-[#1a1208]/80 text-[#c4b080] hover:border-[#c4942a]/50'
                      }`}>
                      <div>{showEnglish ? opt.text : opt.itText}</div>
                      <div className="text-[#8b6914]/60 text-[9px] mt-0.5">{showEnglish ? opt.itText : opt.text}</div>
                    </button>
                  ))}
                </div>
                {/* Right column */}
                <div className="flex-1 flex flex-col gap-1">
                  {selectedLeft ? (
                    rightOptions.map(opt => (
                      <button key={opt.id} onClick={() => handleRightSelect(opt.id)}
                        className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                          selectedRight === opt.id
                            ? 'border-[#c4942a]/70 bg-[#c4942a]/15 text-[#e8d5a3]'
                            : 'border-[#8b6914]/30 bg-[#1a1208]/80 text-[#c4b080] hover:border-[#c4942a]/50'
                        }`}>
                        <div>{showEnglish ? opt.text : opt.itText}</div>
                        <div className="text-[#8b6914]/60 text-[9px] mt-0.5">{showEnglish ? opt.itText : opt.text}</div>
                      </button>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-[#8b6914]/40 text-[10px] italic">
                      Choose left first
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
