import { useState, useEffect, useRef } from 'react';
import { Volume2 } from 'lucide-react';

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

  useEffect(() => {
    const skip = (event: KeyboardEvent) => { if (event.key === 'ArrowRight') { event.preventDefault(); handleClick(); } };
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  });

  return (
    <div
      className="absolute inset-0 z-40 cursor-pointer"
      onClick={handleClick}
    >
      {/* Dialogue box — character speech */}
      <div className="story-dialogue-panel absolute z-10">
        <div className="story-dialogue-content">
          <div className="scene-eyebrow">
            <div className="cop-narrator-dot animate-pulse" style={{ background: '#c4942a' }} />
            <span>
              You
            </span>
          </div>
          <p className="story-dialogue-text">
            "{displayedLine}
            <span className="inline-block w-0.5 h-4 bg-[#c4942a] ml-0.5 animate-pulse align-middle" />
            "
          </p>
          <div className="cop-narration-footer"><span>click anywhere to continue</span><button onClick={(event) => { event.stopPropagation(); speak(DIALOGUE_LINES[lineIndex] ?? '', 'character'); }}><Volume2 size={12} /> Listen</button></div>
        </div>
      </div>
    </div>
  );
}
