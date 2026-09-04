import { useEffect, useState, useRef, useCallback } from 'react';
import { Volume2 } from 'lucide-react';
import { TextSegment, DictionaryWord } from '../types';
import { isSkipAnswer, stripAccents } from '../utils/levenshtein';
import { chineseTerm, englishTerm } from '../learningLanguage';
import { useLanguage } from '../i18n';
import { LiveAnswerLetters } from './LiveTypingFeedback';

interface NarrativeBoxProps {
  text: string;
  dictionary: DictionaryWord[];
  explainedWords: Set<string>;
  onSkip?: () => void;
  onDone: () => void;
  onLearnWord?: (french: string, english: string) => void;
  onExplainWord?: (french: string) => void;
  onSpeak?: (text: string) => void;
}

function isWordLearned(french: string, dictionary: DictionaryWord[]): boolean {
  return dictionary.some((w) => w.french === french);
}

function parseSegments(raw: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\{([^:}]+):([^}]+)\}/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'plain', text: raw.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'french', french: match[1], english: match[2] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < raw.length) {
    segments.push({ type: 'plain', text: raw.slice(lastIndex) });
  }
  return segments;
}

function effectiveText(segments: TextSegment[]): string {
  return segments.map((s) => (s.type === 'plain' ? s.text : englishTerm(s.french))).join('');
}

interface FrenchWordSpanProps {
  french: string;
  english: string;
  visible: boolean;
  locked: boolean;
  isFirstEncounter: boolean;
  onLearn?: (f: string, e: string) => void;
  onExplain?: (f: string) => void;
  onSpeak?: (f: string) => void;
}

function FrenchWordSpan({ french, english, visible, locked, isFirstEncounter, onLearn, onExplain, onSpeak }: FrenchWordSpanProps) {
  const { isChinese } = useLanguage();
  const [hovered, setHovered] = useState(false);
  const [learning, setLearning] = useState(false);
  const [learnInput, setLearnInput] = useState('');
  const [wrong, setWrong] = useState(false);
  const [explained, setExplained] = useState(false);

  useEffect(() => {
    if (visible && isFirstEncounter && !explained) {
      setExplained(true);
      onExplain?.(french);
    }
  }, [visible, isFirstEncounter, explained, french, onExplain]);

  if (!visible) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (locked && !learning) {
      setLearning(true);
      setLearnInput('');
      setWrong(false);
    }
  };

  const handleLearnSubmit = (e: React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const input = learnInput.trim().toLowerCase();
    const target = stripAccents(englishTerm(french)).toLowerCase();
    if (isSkipAnswer(learnInput) || stripAccents(input) === target) {
      onLearn?.(french, english);
      setLearning(false);
    } else {
      setWrong(true);
      setLearnInput('');
      setTimeout(() => setWrong(false), 500);
    }
  };

  return (
    <span className="relative inline-block">
      <span
        className={locked ? 'cursor-pointer' : 'cursor-help'}
        style={{
          color: '#c4942a',
          textDecoration: locked ? 'underline dashed' : 'underline dotted',
          textDecorationColor: locked ? 'rgba(196,148,42,0.7)' : 'rgba(196,148,42,0.5)',
        }}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <LiveAnswerLetters target={englishTerm(french)} value={learning ? learnInput : ''} neutralClassName="text-inherit" />
      </span>
      {onSpeak && (
        <button
          className="inline-flex items-center justify-center text-[#8b6914] hover:text-[#c4942a] transition-colors ml-0.5 align-middle"
          onClick={e => { e.stopPropagation(); onSpeak(englishTerm(french)); }}
          title={isChinese ? '听发音' : 'Listen'}
          style={{ verticalAlign: 'middle', lineHeight: 1 }}
        >
          <Volume2 size={11} />
        </button>
      )}
      {hovered && !locked && !learning && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#0d0804] border border-[#8b6914]/50 text-[#e8d5a3] text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
          = {isChinese ? chineseTerm(french, english) : english}
        </span>
      )}
      {hovered && locked && !learning && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#0d0804] border border-[#8b6914]/50 text-[#c4942a] text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
          {isChinese ? '点击学习' : 'Click to learn'}
        </span>
      )}
      {learning && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <form
            onSubmit={handleLearnSubmit}
            className="flex items-center gap-1 bg-[#0d0804] border rounded px-2 py-1 shadow-lg whitespace-nowrap"
            style={{ borderColor: wrong ? '#8b1a1a' : 'rgba(139,105,20,0.5)' }}
          >
            <span className="text-[#8b6914] text-xs">{isChinese ? '输入：' : 'Type:'}</span>
            <input
              autoFocus
              value={learnInput}
              onChange={(e) => setLearnInput(e.target.value)}
              className="w-20 bg-transparent text-[#e8d5a3] text-xs outline-none border-b caret-[#c4942a]"
              style={{ borderColor: wrong ? '#8b1a1a' : 'rgba(139,105,20,0.3)' }}
              placeholder={englishTerm(french)}
              spellCheck={false}
              autoComplete="off"
            />
            <button type="submit" className="text-[#c4942a] text-xs hover:text-[#e8d5a3]">
              &#x2713;
            </button>
          </form>
        </span>
      )}
    </span>
  );
}

export default function NarrativeBox({
  text,
  dictionary,
  explainedWords,
  onSkip,
  onDone,
  onLearnWord,
  onExplainWord,
  onSpeak,
}: NarrativeBoxProps) {
  const { isChinese } = useLanguage();
  const segments = parseSegments(text);
  const effective = effectiveText(segments);

  const [progress, setProgress] = useState(0);
  const [animating, setAnimating] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animatingRef = useRef(true);

  const finish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(effective.length);
    setAnimating(false);
    animatingRef.current = false;
    onSkip?.();
  }, [effective.length, onSkip]);

  useEffect(() => {
    setProgress(0);
    setAnimating(true);
    animatingRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);

    let i = 0;
    timerRef.current = setInterval(() => {
      if (i < effective.length) {
        i++;
        setProgress(i);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        setAnimating(false);
        animatingRef.current = false;
      }
    }, 20);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const handleClick = useCallback(() => {
    if (animatingRef.current) {
      finish();
    } else {
      onDone();
    }
  }, [finish, onDone]);

  // Global click listener so clicking anywhere on screen works
  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      // Don't intercept clicks on form inputs, buttons, or interactive elements
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'FORM'
        || target.tagName === 'BUTTON' || target.closest('button') || target.closest('[role="button"]')) return;
      e.preventDefault();
      e.stopPropagation();
      handleClick();
    };
    window.addEventListener('click', handler, true);
    return () => window.removeEventListener('click', handler, true);
  }, [handleClick]);

  let charsLeft = progress;
  const renderedNodes: React.ReactNode[] = [];
  let segIdx = 0;

  for (const seg of segments) {
    const segLen = seg.type === 'plain' ? seg.text.length : englishTerm(seg.french).length;
    if (charsLeft <= 0) break;

    if (seg.type === 'plain') {
      const visible = seg.text.slice(0, Math.min(charsLeft, segLen));
      renderedNodes.push(<span key={segIdx}>{visible}</span>);
    } else {
      const fullyVisible = charsLeft >= segLen;
      renderedNodes.push(
        <FrenchWordSpan
          key={segIdx}
          french={seg.french}
          english={seg.english}
          visible={fullyVisible}
          locked={!isWordLearned(seg.french, dictionary)}
          isFirstEncounter={!explainedWords.has(seg.french)}
          onLearn={onLearnWord}
          onExplain={onExplainWord}
          onSpeak={onSpeak}
        />
      );
    }

    charsLeft -= segLen;
    segIdx++;
  }

  return (
    <div
      className="story-dialogue-panel absolute z-20 cursor-pointer"
      onClick={handleClick}
      title={animating ? 'Click to skip' : 'Click to dismiss'}
    >
      <div className="story-dialogue-content">
        <div className="scene-eyebrow">Narrator</div>
        <p className="story-dialogue-text whitespace-pre-line">
          {renderedNodes}
          {animating && (
            <span className="inline-block w-0.5 h-4 bg-[#c4942a] ml-0.5 animate-pulse align-middle" />
          )}
        </p>
        <div className="cop-narration-footer"><span>{animating ? (isChinese ? '点击跳过文字动画' : 'click to skip text animation') : (isChinese ? '点击任意位置继续' : 'click anywhere to continue')}</span>{onSpeak && <button onClick={(event) => { event.stopPropagation(); onSpeak(text); }}><Volume2 size={12} /> {isChinese ? '听发音' : 'Listen'}</button>}</div>
      </div>
    </div>
  );
}
