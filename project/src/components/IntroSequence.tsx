import { useState, useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';

interface IntroSequenceProps {
  onComplete: () => void;
  speak: (text: string, gender: 'male' | 'female' | 'character') => void;
  cancel: () => void;
}

const DIALOGUE_LINES = [
  'What is going on?',
  'Oh my God... is he dead?',
  "Why don't I remember anything?!",
];

export default function IntroSequence({ onComplete, speak, cancel }: IntroSequenceProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const [displayedLine, setDisplayedLine] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const line = DIALOGUE_LINES[lineIndex] ?? '';
    setDisplayedLine('');
    let i = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (i < line.length) {
        setDisplayedLine(line.slice(0, i + 1));
        i++;
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 30);
    speak(line, 'character');
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineIndex]);

  const handleClick = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    cancel();

    const line = DIALOGUE_LINES[lineIndex];
    setDisplayedLine(line ?? '');
    if (lineIndex < DIALOGUE_LINES.length - 1) {
      setLineIndex((l) => l + 1);
    } else {
      cancel();
      onComplete();
    }
  };

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-end pb-16 cursor-pointer"
      style={{ background: 'linear-gradient(to top, rgba(10,4,2,0.85) 0%, rgba(10,4,2,0.3) 60%, transparent 100%)' }}
      onClick={handleClick}
    >
      {/* Dialogue box — character speech */}
      <div className="max-w-xl w-full px-4 mb-4">
        <div className="bg-[#0d0804]/92 border border-[#8b6914]/40 rounded-2xl px-6 py-5 shadow-2xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#c4942a] animate-pulse" />
            <span className="text-[#c4942a] text-xs uppercase tracking-widest font-medium">
              You
            </span>
            <span className="text-[#8b6914]/50 text-xs ml-1">(waking up)</span>
          </div>
          <p className="text-[#f0e8d8] text-base leading-relaxed font-display italic">
            "{displayedLine}
            <span className="inline-block w-0.5 h-4 bg-[#c4942a] ml-0.5 animate-pulse align-middle" />
            "
          </p>
          <div className="flex items-center justify-end gap-1 mt-3 text-[#8b6914]/50 text-xs">
            click to continue — clicca per continuare
            <ChevronRight size={12} />
          </div>
        </div>
      </div>
    </div>
  );
}
