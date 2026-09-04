import type { ReactNode } from 'react';

type Props = {
  target: string;
  value: string;
  alternatives?: string[];
  className?: string;
  neutralClassName?: string;
  'data-task-editor-item'?: string;
};

const characters = (value: string) => Array.from(value.normalize('NFC'));
const isDisplaySeparator = (character: string) => /[\s\-'’·‐‑–—]/.test(character);
const koreanLead = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const koreanVowel = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const koreanTail = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const containsKorean = (value: string) => /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(value);

function koreanPieces(character: string) {
  const syllable = character.charCodeAt(0) - 0xac00;
  if (syllable < 0 || syllable >= 11172) return [character];
  const lead = Math.floor(syllable / 588);
  const vowel = Math.floor((syllable % 588) / 28);
  const tail = syllable % 28;
  return [koreanLead[lead], koreanVowel[vowel], ...(tail ? [koreanTail[tail]] : [])];
}

function koreanFeedbackCharacters(display: string, comparison: string, value: string, neutralClassName: string): ReactNode[] {
  const answerPieces = characters(comparison).flatMap(character => isDisplaySeparator(character) ? [] : koreanPieces(character));
  const typedPieces = characters(value).flatMap(character => isDisplaySeparator(character) ? [] : koreanPieces(character));
  let pieceIndex = 0;
  return characters(display).map((character, index) => {
    if (isDisplaySeparator(character)) return <span key={`${character}-${index}`} className={neutralClassName}>{character === ' ' ? '\u00a0' : character}</span>;
    const pieces = koreanPieces(character);
    const enteredPieces = typedPieces.slice(pieceIndex, pieceIndex + pieces.length);
    const hasInput = enteredPieces.length > 0;
    const syllableComplete = enteredPieces.length === pieces.length;
    const wrong = enteredPieces.some((piece, offset) => piece !== answerPieces[pieceIndex + offset]);
    // A partially composed Hangul syllable can already contain the correct
    // opening jamo. Keep it neutral until every jamo in that visible syllable
    // has actually been entered; otherwise the untouched remainder appears
    // completed too early (for example ㄹ at the start of 리).
    const colour = !hasInput || !wrong && !syllableComplete
      ? neutralClassName
      : wrong
        ? 'text-red-400'
        : 'text-green-400';
    pieceIndex += pieces.length;
    return <span key={`${character}-${index}`} className={`transition-colors ${colour}`}>{character}</span>;
  });
}

const comparable = (value: string) => characters(value.toLocaleLowerCase()).map(character =>
  /[\u0000-\u024f]/.test(character)
    ? character.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : character,
).filter(character => !isDisplaySeparator(character));

function bestTarget(target: string, alternatives: string[], value: string) {
  const typed = comparable(value);
  return [target, ...alternatives].reduce((best, candidate) => {
    const candidateCharacters = comparable(candidate);
    const score = typed.reduce((total, character, index) => total + (candidateCharacters[index] === character ? 1 : 0), 0);
    return score > best.score ? { value: candidate, score } : best;
  }, { value: target, score: -1 }).value;
}

function feedbackCharacters(display: string, comparison: string, value: string, neutralClassName: string): ReactNode[] {
  if (containsKorean(display) && containsKorean(comparison) && containsKorean(value)) {
    return koreanFeedbackCharacters(display, comparison, value, neutralClassName);
  }
  const displayCharacters = characters(display);
  const answerCharacters = comparable(comparison);
  const typedCharacters = comparable(value);
  let answerIndex = 0;
  return displayCharacters.map((character, index) => {
    if (isDisplaySeparator(character)) return <span key={`${character}-${index}`} className={neutralClassName}>{character === ' ' ? '\u00a0' : character}</span>;
    const typedCharacter = typedCharacters[answerIndex];
    const colour = typedCharacter === undefined
      ? neutralClassName
      : typedCharacter === answerCharacters[answerIndex]
        ? 'text-green-400'
        : 'text-red-400';
    answerIndex += 1;
    return <span key={`${character}-${index}`} className={`transition-colors ${colour}`}>{character === ' ' ? '\u00a0' : character}</span>;
  });
}

/** Colours the visible answer itself as the player types it. */
export function LiveAnswerLetters({ target, value, alternatives = [], className = '', neutralClassName = 'text-white/70', ...spanProps }: Props) {
  const targetHasHangul = containsKorean(target);
  const targetHasLatin = /[a-z]/i.test(target);
  const valueHasHangul = containsKorean(value);
  const valueHasLatin = /[a-z]/i.test(value);
  const activeValue = targetHasHangul && valueHasLatin && !valueHasHangul
    ? ''
    : targetHasLatin && valueHasHangul && !valueHasLatin
      ? ''
      : value;
  const comparison = bestTarget(target, alternatives, activeValue);
  return <span {...spanProps} className={className} aria-label={target}>{feedbackCharacters(target, comparison, activeValue, neutralClassName)}</span>;
}

/** Shows only what the player has typed, so hidden-answer quizzes stay hidden. */
export default function LiveTypingFeedback({ target, value, alternatives = [], className = '', neutralClassName = 'text-white/70', ...spanProps }: Props) {
  if (!value) return null;
  const comparison = bestTarget(target, alternatives, value);
  return (
    <span {...spanProps} className={`live-typing-feedback font-mono font-semibold tracking-[.12em] ${className}`} aria-live="polite" aria-label={`Typed: ${value}`}>
      {feedbackCharacters(value, comparison, value, neutralClassName)}
    </span>
  );
}
