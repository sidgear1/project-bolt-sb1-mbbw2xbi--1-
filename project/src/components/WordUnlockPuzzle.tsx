import { useState, useRef, useEffect, useMemo } from 'react';
import { X, ArrowRight, CheckCircle, AlertTriangle, Volume2 } from 'lucide-react';
import { HotspotData, DictionaryWord } from '../types';
import { isSkipAnswer, stripAccents } from '../utils/levenshtein';
import { englishTerm } from '../learningLanguage';
import { chineseTerm } from '../learningLanguage';
import { useLanguage } from '../i18n';

interface WordUnlockPuzzleProps {
  hotspot: HotspotData;
  dictionary: DictionaryWord[];
  isFirstWord: boolean;
  onComplete: (accuracy: number) => void;
  onClose: () => void;
  onAddToDictionary: (french: string, english: string) => void;
  onSpeak: (text: string) => void;
}

function toTitleCase(str: string): string {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Get missing letters for puzzle 2
function getMissingLetters(word: string): { positions: number[]; letters: string[] } {
  const positions: number[] = [];
  const letters: string[] = [];
  for (let i = 1; i < word.length; i++) {
    if (word[i] !== ' ' && (i % 3 !== 0)) {
      positions.push(i);
      letters.push(word[i]);
    }
  }
  return { positions, letters };
}

// Calculate percentage of matching characters
function characterAccuracy(input: string, target: string): number {
  const normalizedInput = stripAccents(input.toLowerCase().trim());
  const normalizedTarget = stripAccents(target.toLowerCase().trim());
  if (normalizedTarget.length === 0) return 0;
  let matchCount = 0;
  const maxLen = Math.max(normalizedInput.length, normalizedTarget.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < normalizedInput.length && i < normalizedTarget.length && normalizedInput[i] === normalizedTarget[i]) {
      matchCount++;
    }
  }
  return (matchCount / normalizedTarget.length) * 100;
}

export default function WordUnlockPuzzle({
  hotspot, dictionary, isFirstWord, onComplete, onClose, onAddToDictionary, onSpeak,
}: WordUnlockPuzzleProps) {
  const { isChinese } = useLanguage();
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [completedPuzzles, setCompletedPuzzles] = useState<number[]>([]);
  const [puzzleScores, setPuzzleScores] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const fullName = toTitleCase(englishTerm(hotspot.frenchName));
  const missingInfo = useMemo(() => getMissingLetters(hotspot.frenchName), [hotspot.frenchName]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [puzzleIndex]);

  useEffect(() => {
    if (puzzleIndex === 0) {
      onSpeak(fullName);
    }
  }, [hotspot]);

  const getCharStatus = (position: number): 'correct' | 'incorrect' | 'none' => {
    const target = stripAccents(fullName.toLowerCase());
    const normalizedInput = stripAccents(input.toLowerCase());
    if (position >= normalizedInput.length) return 'none';
    const inputChar = normalizedInput[position];
    const targetChar = target[position];
    if (!inputChar) return 'none';
    if (inputChar === targetChar) return 'correct';
    return 'incorrect';
  };

  const getMissingLetterStatus = (positionInWord: number): 'correct' | 'incorrect' | 'none' => {
    const targetWord = stripAccents(hotspot.frenchName.toLowerCase());
    const normalizedInput = stripAccents(input.toLowerCase());
    const articleLength = hotspot.article.length;
    const hasSpace = !hotspot.article.endsWith("'");
    const positionInFullName = articleLength + (hasSpace ? 1 : 0) + positionInWord;
    if (positionInFullName >= normalizedInput.length) return 'none';
    const inputChar = normalizedInput[positionInFullName];
    const expectedChar = targetWord[positionInWord];
    if (!inputChar) return 'none';
    if (inputChar === expectedChar) return 'correct';
    return 'incorrect';
  };

  const getFillBlankDisplay = (): string => {
    const articlePart = hotspot.article;
    const spacePart = hotspot.article.endsWith("'") ? '' : ' ';
    const wordPart = hotspot.frenchName.split('').map((char, i) => {
      if (char === ' ') return ' ';
      if (missingInfo.positions.includes(i)) return '-';
      return char;
    }).join('');
    return articlePart + spacePart + wordPart;
  };

  const checkAnswer = (raw: string): boolean => {
    if (isSkipAnswer(raw)) return true;
    const normalized = stripAccents(raw.toLowerCase().trim());
    const fullTarget = stripAccents(fullName.toLowerCase());
    const nameOnly = stripAccents(englishTerm(hotspot.frenchName).toLowerCase());
    return normalized === fullTarget || normalized === nameOnly;
  };

  const handlePuzzle1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;
    if (checkAnswer(raw)) {
      setCompletedPuzzles(prev => [...prev, 0]);
      setPuzzleScores(prev => [...prev, 100]);
      setFeedback('correct');
      setFeedbackMessage('Correct!');
      onSpeak(fullName);
      setTimeout(() => {
        setFeedback(null);
        setFeedbackMessage('');
        setInput('');
        onAddToDictionary(hotspot.frenchName, hotspot.english);
        onComplete(100);
      }, 1200);
    } else {
      setFeedback('incorrect');
      setFeedbackMessage('Try again');
      setTimeout(() => { setFeedback(null); setFeedbackMessage(''); }, 1800);
    }
    setInput('');
  };

  const handlePuzzle2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;
    if (checkAnswer(raw)) {
      setCompletedPuzzles(prev => [...prev, 1]);
      setPuzzleScores(prev => [...prev, 100]);
      setFeedback('correct');
      setFeedbackMessage('Correct!');
      onSpeak(`${hotspot.article}${hotspot.article.endsWith("'") ? '' : ' '}${hotspot.frenchName}`);
      setTimeout(() => {
        setFeedback(null);
        setFeedbackMessage('');
        setInput('');
        setPuzzleIndex(2);
      }, 1200);
    } else {
      setFeedback('incorrect');
      setFeedbackMessage('Try again');
      setTimeout(() => { setFeedback(null); setFeedbackMessage(''); }, 1800);
    }
    setInput('');
  };

  const handlePuzzle3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;
    const accuracy = characterAccuracy(raw, fullName);
    if (accuracy >= 40) {
      setCompletedPuzzles(prev => [...prev, 2]);
      const allScores = [...puzzleScores, accuracy];
      const averageAccuracy = allScores.reduce((a, b) => a + b, 0) / allScores.length;
      setPuzzleScores(prev => [...prev, accuracy]);
      setFeedback('correct');
      setFeedbackMessage(`${Math.round(accuracy)}% - Correct!`);
      onSpeak(`${hotspot.article}${hotspot.article.endsWith("'") ? '' : ' '}${hotspot.frenchName}`);
      setTimeout(() => {
        setFeedback(null);
        setFeedbackMessage('');
        setInput('');
        onAddToDictionary(hotspot.frenchName, hotspot.english);
        onComplete(Math.round(averageAccuracy));
      }, 1200);
    } else {
      setFeedback('incorrect');
      setFeedbackMessage(`Need at least 40% correct — you got ${Math.round(accuracy)}%`);
      setTimeout(() => { setFeedback(null); setFeedbackMessage(''); }, 1800);
    }
    setInput('');
  };

  const speakWord = () => {
    onSpeak(fullName);
  };

  useEffect(() => {
    const skip = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowRight') return;
      event.preventDefault();
      onAddToDictionary(hotspot.frenchName, hotspot.english);
      onComplete(100);
    };
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [hotspot, onAddToDictionary, onComplete]);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30" style={{ maxHeight: '60%' }}>
      <div className="bg-[#0a0604]/96 border-t border-[#8b6914]/30 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-[#8b6914]/20">
          {puzzleIndex === 0 ? (
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={speakWord} className="text-[#8b6914] hover:text-[#c4942a] transition-colors flex-shrink-0" title="Listen">
                <Volume2 size={15} />
              </button>
              <span className="text-[#8b6914]/60 text-xs tracking-widest">{isChinese ? '英语单词' : 'English word'}</span>
              <span className="text-[#e8d5a3] text-xl font-bold">{fullName}</span>
              <span className="text-[#d4c090] text-sm">— {toTitleCase(isChinese ? chineseTerm(hotspot.frenchName, hotspot.english) : hotspot.english)}</span>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <button onClick={onClose} className="text-[#d4c090] hover:text-[#c4942a] transition-colors ml-3 flex-shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-2 flex items-center gap-2 border-b border-[#8b6914]/15">
          <span className="text-[#8b6914]/60 text-xs">{isChinese ? '第 1 部分（共 2 部分）· 学习单词' : 'Part 1 of 2 · Learn the word'}</span>
          <div className="flex gap-1">
            {[0, 1].map(i => (
              <div key={i} className={`w-8 h-1.5 rounded-full transition-all ${completedPuzzles.includes(i) ? 'bg-green-500' : i === puzzleIndex ? 'bg-[#c4942a]' : 'bg-[#8b6914]/30'}`} />
            ))}
          </div>
          {puzzleScores.length > 0 && (
            <span className="text-[#8b6914]/60 text-[10px] ml-auto">Score: {Math.round(puzzleScores.reduce((a, b) => a + b, 0) / puzzleScores.length)}%</span>
          )}
        </div>
        {feedback === 'correct' && (
          <div className="flex items-center gap-2 px-5 py-2 bg-green-900/40 border-b border-green-700/30">
            <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
            <span className="text-green-400 text-sm font-medium">{feedbackMessage}</span>
          </div>
        )}
        {feedback === 'incorrect' && (
          <div className="flex items-center gap-2 px-5 py-2 bg-red-900/40 border-b border-red-700/30">
            <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
            <span className="text-red-400 text-sm">{feedbackMessage}</span>
          </div>
        )}
        {puzzleIndex === 0 && (
          <form onSubmit={handlePuzzle1Submit} className="px-5 py-4">
            <p className="text-[#8b6914]/60 text-sm mb-2">{isChinese ? '发音：' : 'Pronunciation: '}<span className="text-[#e8d5a3] font-bold text-base tracking-wider">{hotspot.pronunciation}</span></p>
            <p className="text-[#e8d5a3] text-base font-medium mb-3">{isChinese ? '输入听到的英语单词：' : 'Type the word you hear:'}</p>
            <div className="bg-[#1a1208] border border-[#8b6914]/30 rounded-lg px-4 py-3 mb-3">
              <div className="flex flex-wrap gap-0.5 font-mono text-lg">
                {fullName.split('').map((char, idx) => {
                  const status = getCharStatus(idx);
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
            <div className="flex items-center gap-2">
              <ArrowRight size={14} className="text-[#c4942a] flex-shrink-0" />
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} className="flex-1 bg-transparent text-[#f0e8d8] text-sm font-mono outline-none placeholder-[#8b6914]/50 caret-[#c4942a] min-w-0 border-b border-[#8b6914]/30 focus:border-[#c4942a] py-1" autoComplete="off" spellCheck={false} placeholder={isChinese ? '输入答案…' : 'type your answer...'} />
              <button type="submit" className="bg-[#8b6914]/30 hover:bg-[#c4942a]/40 border border-[#8b6914]/40 hover:border-[#c4942a] text-[#c4942a] text-xs px-3 py-1.5 rounded-lg transition-all uppercase tracking-wider flex-shrink-0">{isChinese ? '确认' : 'Enter'}</button>
            </div>
          </form>
        )}
        {puzzleIndex === 1 && (
          <form onSubmit={handlePuzzle2Submit} className="px-5 py-4">
            <p className="text-[#8b6914]/60 text-sm mb-2">Pronunciation: <span className="text-[#e8d5a3] font-bold text-base tracking-wider">{hotspot.pronunciation}</span></p>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[#e8d5a3] text-base font-medium">Fill in the blanks:</p>
                <button type="button" onClick={speakWord} className="text-[#8b6914] hover:text-[#c4942a] transition-colors" title="Listen again"><Volume2 size={14} /></button>
              </div>
              <div className="bg-[#1a1208] border border-[#8b6914]/30 rounded-lg px-4 py-3 mb-3">
                <span className="text-[#c4942a] text-lg font-mono tracking-wider">{getFillBlankDisplay()}</span>
              </div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-[#8b6914] text-xs">Missing letters:</span>
                <div className="flex gap-1 flex-wrap">
                  {missingInfo.positions.map((pos, idx) => {
                    const letter = missingInfo.letters[idx];
                    const status = getMissingLetterStatus(pos);
                    let bgColor = 'bg-[#c4942a]/20';
                    let borderColor = 'border-[#c4942a]/50';
                    let textColor = 'text-[#c4942a]';
                    if (status === 'correct') { bgColor = 'bg-green-500/30'; borderColor = 'border-green-500'; textColor = 'text-green-400'; }
                    else if (status === 'incorrect') { bgColor = 'bg-red-500/30'; borderColor = 'border-red-500'; textColor = 'text-red-400'; }
                    return (
                      <span key={`pos-${pos}-${idx}`} className={`${bgColor} border ${borderColor} rounded px-2 py-0.5 ${textColor} text-sm font-mono transition-all duration-150`}>{letter}</span>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRight size={14} className="text-[#c4942a] flex-shrink-0" />
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} className="flex-1 bg-transparent text-[#f0e8d8] text-sm font-mono outline-none placeholder-[#8b6914]/50 caret-[#c4942a] min-w-0 border-b border-[#8b6914]/30 focus:border-[#c4942a] py-1" autoComplete="off" spellCheck={false} placeholder="type the full word..." />
              <button type="submit" className="bg-[#8b6914]/30 hover:bg-[#c4942a]/40 border border-[#8b6914]/40 hover:border-[#c4942a] text-[#c4942a] text-xs px-3 py-1.5 rounded-lg transition-all uppercase tracking-wider flex-shrink-0">Enter</button>
            </div>
          </form>
        )}
        {puzzleIndex === 2 && (
          <form onSubmit={handlePuzzle3Submit} className="px-5 py-4">
            <p className="text-[#8b6914]/60 text-sm mb-2">Pronunciation: <span className="text-[#e8d5a3] font-bold text-base tracking-wider">{hotspot.pronunciation}</span></p>
            <p className="text-[#e8d5a3] text-base font-medium mb-3">Type the full word (no hints):</p>
            <div className="flex items-center gap-2">
              <ArrowRight size={14} className="text-[#c4942a] flex-shrink-0" />
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} className="flex-1 bg-transparent text-[#f0e8d8] text-sm font-mono outline-none placeholder-[#8b6914]/50 caret-[#c4942a] min-w-0 border-b border-[#8b6914]/30 focus:border-[#c4942a] py-1" autoComplete="off" spellCheck={false} placeholder="type the full word..." />
              <button type="submit" className="bg-[#8b6914]/30 hover:bg-[#c4942a]/40 border border-[#8b6914]/40 hover:border-[#c4942a] text-[#c4942a] text-xs px-3 py-1.5 rounded-lg transition-all uppercase tracking-wider flex-shrink-0">Enter</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
