import { useState, useRef, useEffect } from 'react';
import { X, ChevronRight, AlertTriangle, Volume2 } from 'lucide-react';
import { HotspotData, CommandResult, GamePhase, DictionaryWord } from '../types';
import { findClosestCommand, isSkipAnswer, stripAccents } from '../utils/levenshtein';
import { englishTerm } from '../learningLanguage';
import { chineseTerm } from '../learningLanguage';
import { useLanguage } from '../i18n';
import LiveTypingFeedback, { LiveAnswerLetters } from './LiveTypingFeedback';

interface CommandPanelProps {
  hotspot: HotspotData;
  phase: GamePhase;
  playerLevel: number;
  dictionary: DictionaryWord[];
  onResult: (result: CommandResult) => void;
  onClose: () => void;
  onAddToDictionary: (french: string, english: string) => void;
  onSpeak: (text: string, voice?: 'male' | 'female') => void;
}

function toTitleCase(str: string): string {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Calculate accuracy percentage
function sentenceAccuracy(input: string, target: string): number {
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

// Normalize for comparison: remove articles, accents, extra words
function normalizeForMatch(input: string): string {
  const stripped = stripAccents(input.toLowerCase().trim());

  // Remove common articles
  const articles = ['il ', 'lo ', 'la ', 'i ', 'gli ', 'le ', 'un ', 'uno ', 'una ', 'un\'', 'l\'', 'del ', 'della ', 'dei ', 'delle ', 'di '];
  let cleaned = stripped;
  for (const article of articles) {
    if (cleaned.startsWith(article)) {
      cleaned = cleaned.slice(article.length);
      break;
    }
  }

  return cleaned.trim();
}

// Check if input matches the target name (forgiving)
function matchesName(input: string, targetName: string): boolean {
  const normalizedInput = normalizeForMatch(input);
  const normalizedTarget = normalizeForMatch(targetName);

  // Direct match after normalization
  if (normalizedInput === normalizedTarget) return true;

  // Check if input is contained in target or vice versa
  if (normalizedTarget.includes(normalizedInput) && normalizedInput.length >= 4) return true;
  if (normalizedInput.includes(normalizedTarget)) return true;

  // Split by spaces and check if main parts match
  const inputParts = normalizedInput.split(/\s+/);
  const targetParts = normalizedTarget.split(/\s+/);

  // If input has the key words from target
  const keyTargetWords = targetParts.filter(w => w.length > 2);
  const matchedWords = keyTargetWords.filter(tw =>
    inputParts.some(ip => ip === tw || (tw.includes(ip) && ip.length >= 3))
  );

  // Need at least one key word match for multi-word names, or exact for single words
  if (targetParts.length === 1) {
    return inputParts[0] === targetParts[0];
  }
  return matchedWords.length > 0 && matchedWords.length >= Math.min(1, keyTargetWords.length);
}

export default function CommandPanel({ hotspot, phase, playerLevel, dictionary, onResult, onClose, onAddToDictionary, onSpeak }: CommandPanelProps) {
  const { isChinese } = useLanguage();
  const [mode, setMode] = useState<'name' | 'verb'>('name');
  const [input, setInput] = useState('');
  const [typoWarning, setTypoWarning] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [sentenceWarning, setSentenceWarning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fullName = englishTerm(hotspot.frenchName);
  const commandTargets = hotspot.commands.map(command => `${englishTerm(command.verb)} ${fullName}`);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  // Check if this object's name is already in dictionary
  const isObjectNameLearned = dictionary.some(w => w.french.toLowerCase() === hotspot.frenchName.toLowerCase());

  // If already learned, skip to verb mode
  useEffect(() => {
    if (isObjectNameLearned) {
      setMode('verb');
    }
  }, [isObjectNameLearned]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2000);
  };

  const resolveVerb = (verb: string): CommandResult | null => {
    const cmd = hotspot.commands.find((c) => englishTerm(c.verb).toLowerCase() === verb.toLowerCase());
    if (!cmd) return null;
    const effect = cmd.effects.find((e) => e.phases.includes(phase));
    if (!effect) return { narrative: cmd.fallback, sentence: `${verb} ${fullName}` };

    if (effect.minLevel !== undefined && playerLevel < effect.minLevel) {
      return {
        narrative: effect.lockedNarrative ?? `You need to be Level ${effect.minLevel} to do this. Unlock more words to gain XP.`,
        sentence: `${verb} ${fullName}`,
      };
    }

    return {
      narrative: effect.narrative,
      transitionTo: effect.transitionTo,
      inventoryAdd: effect.inventoryAdd,
      inventoryRemove: effect.inventoryRemove,
      hpChange: effect.hpChange,
      sentence: `${verb} ${fullName}`,
    };
  };

  // Returns the best verb to progress the story: first pick one with transitionTo,
  // then any verb with an effect in the current phase, then fall back to 'examiner'.
  const findBestVerb = (): string => {
    for (const cmd of hotspot.commands) {
      if (cmd.effects.some(e => e.phases.includes(phase) && e.transitionTo)) return englishTerm(cmd.verb);
    }
    for (const cmd of hotspot.commands) {
      if (cmd.effects.some(e => e.phases.includes(phase))) return englishTerm(cmd.verb);
    }
    return 'examine';
  };

  const autoExecuteBestVerb = () => {
    const bestVerb = findBestVerb();
    const result = resolveVerb(bestVerb);
    if (result) {
      onSpeak(result.sentence || `${bestVerb} ${hotspot.article} ${hotspot.frenchName}`, 'female');
      setTimeout(() => onResult(result), 2000);
    }
    setInput('');
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;

    if (isSkipAnswer(raw) || matchesName(raw, englishTerm(hotspot.frenchName))) {
      onAddToDictionary(hotspot.frenchName, hotspot.english);
      showNotification(isChinese ? `已加入单词本：${englishTerm(hotspot.frenchName)}` : `Added to dictionary: ${englishTerm(hotspot.frenchName)}`);
      const wordToSay = englishTerm(hotspot.frenchName);
      onSpeak(wordToSay, 'female');
      setMode('verb');
      setInput('');
      setTypoWarning(null);
    } else {
      setTypoWarning(`Try again — type the name to unlock`);
      setTimeout(() => setTypoWarning(null), 2000);
    }
    setInput('');
  };

  const handleVerbSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;

    const verbPart = raw.split(/\s+/)[0].toLowerCase();
    const allVerbs = hotspot.commands.map((c) => englishTerm(c.verb));

    const exactVerb = allVerbs.find((v) => v.toLowerCase() === verbPart);

    // Check if input is just the verb (missing the object)
    const normalizedName = stripAccents(englishTerm(hotspot.frenchName).toLowerCase());
    const normalizedInput = stripAccents(raw.toLowerCase());
    const normalizedFullName = stripAccents(fullName.toLowerCase());

    // If they only typed the verb (no object), show warning
    const inputParts = raw.split(/\s+/);
    const hasObjectName = inputParts.length > 1 && (
      normalizedInput.includes(normalizedName) ||
      normalizedInput.includes(normalizedFullName) ||
      normalizedInput.includes(stripAccents(hotspot.article.toLowerCase()) + normalizedName)
    );

    if (exactVerb && !hasObjectName) {
      // They typed just the verb, need full sentence
      setSentenceWarning(true);
      setTimeout(() => setSentenceWarning(false), 3000);
      return;
    }

    if (isSkipAnswer(raw) || exactVerb) {
      const resolvedVerb = exactVerb || findBestVerb();
      const expectedSentence = `${resolvedVerb} ${fullName}`;
      const accuracy = isSkipAnswer(raw) ? 100 : sentenceAccuracy(raw, expectedSentence);
      if (!isSkipAnswer(raw) && accuracy < 40) {
        setTypoWarning(`Need at least 40% correct — you got ${Math.round(accuracy)}%`);
        setTimeout(() => setTypoWarning(null), 2000);
        return;
      }
      setTypoWarning(null);
      setSentenceWarning(false);
      const result = resolveVerb(resolvedVerb);
      if (result) {
        // Speak the full sentence as confirmation (woman), then narrator will speak after
        onSpeak(result.sentence || `${exactVerb} ${fullName}`, 'female');
        // Delay to let woman finish speaking before narrator
        setTimeout(() => {
          onResult(result);
        }, 2000);
      }
    } else {
      const matchResult = findClosestCommand(verbPart, allVerbs);
      if (matchResult.match) {
        // Check for full sentence with matched verb too
        const matchedHasObject = inputParts.length > 1 && hasObjectName;
        if (!matchedHasObject) {
          setSentenceWarning(true);
          setTimeout(() => setSentenceWarning(false), 3000);
          return;
        }
        const expectedSentence = `${matchResult.match} ${fullName}`;
        const accuracy = sentenceAccuracy(raw, expectedSentence);
        if (accuracy < 40) {
          setTypoWarning(`Need at least 40% correct — you got ${Math.round(accuracy)}%`);
          setTimeout(() => setTypoWarning(null), 2000);
          return;
        }
        if (matchResult.kind === 'accent') {
          setTypoWarning(null);
          setSentenceWarning(false);
          const result = resolveVerb(matchResult.match);
          if (result) {
            onSpeak(result.sentence || `${matchResult.match} ${fullName}`, 'female');
            setTimeout(() => {
              onResult(result);
            }, 2000);
          }
        } else if (matchResult.kind === 'typo') {
          setTypoWarning(`Spelling correction: "${verbPart}" → "${matchResult.match}"`);
          setSentenceWarning(false);
          const result = resolveVerb(matchResult.match);
          if (result) {
            onSpeak(result.sentence || `${matchResult.match} ${fullName}`, 'female');
            setTimeout(() => {
              onResult({ ...result, typoWarning: `Errore di battitura (typo): "${verbPart}" → "${matchResult.match}"` });
            }, 2000);
          }
        }
      } else {
        setTypoWarning(null);
        onResult({
          narrative: `Non capisco "${raw}". (I don't understand.) Try one of the verbs listed below.`,
        });
        setInput('');
        return;
      }
    }
    setInput('');
  };

  // Need to track activeHotspot in parent to close panel properly
  const handleClose = () => {
    onClose();
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30" style={{ maxHeight: '52%' }}>
      <div data-task-editor-panel={mode === 'name' || mode === 'verb' ? "command-panel" : undefined} className="bg-[#0a0604]/96 border-t border-[#8b6914]/30 backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-[#8b6914]/20">
          <div className="flex items-baseline flex-wrap gap-x-2">
            <button
              onClick={() => onSpeak(fullName, 'female')}
              className="text-[#8b6914] hover:text-[#c4942a] transition-colors flex-shrink-0 mr-1"
              title="Listen"
            >
              <Volume2 size={13} />
            </button>
            <span className="text-[#8b6914]/60 text-xs tracking-widest">{isChinese ? '英语单词' : 'English word'}</span>
            <span className="text-[#e8d5a3] text-xl font-bold font-display"><LiveAnswerLetters target={toTitleCase(fullName)} value={mode === 'name' ? input : ''} neutralClassName="text-[#e8d5a3]" /></span>
            <span className="text-[#8b6914]/70 text-xs">[{hotspot.pronunciation}]</span>
            <span className="text-[#d4c090] text-sm">— {toTitleCase(isChinese ? chineseTerm(hotspot.frenchName, hotspot.english) : hotspot.english)}</span>
          </div>
          <button onClick={handleClose} className="text-[#d4c090] hover:text-[#c4942a] transition-colors ml-3 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Notification */}
        {notification && (
          <div className="flex items-center gap-2 px-5 py-2 bg-[#1a3a5c]/50 border-b border-[#4a8ab4]/20">
            <span className="text-[#6aabcf] text-xs">{notification}</span>
          </div>
        )}

        {/* Typo warning */}
        {typoWarning && (
          <div className="flex items-center gap-2 px-5 py-2 bg-[#2a1a00]/60 border-b border-[#8b6914]/20">
            <AlertTriangle size={13} className="text-[#c4942a] flex-shrink-0" />
            <span className="text-[#c4942a] text-xs">{typoWarning}</span>
          </div>
        )}

        {/* Sentence warning */}
        {sentenceWarning && (
          <div className="flex items-center gap-2 px-5 py-2 bg-amber-900/40 border-b border-amber-700/30">
            <AlertTriangle size={13} className="text-amber-400 flex-shrink-0" />
            <span className="text-amber-400 text-xs">{isChinese ? `输入包含物品的完整英语句子（例如 “examine ${englishTerm(hotspot.frenchName)}”）` : `Type the full sentence including the object (e.g., "examine ${englishTerm(hotspot.frenchName)}")`}</span>
          </div>
        )}

        {/* Name typing mode */}
        {mode === 'name' && (
          <form onSubmit={handleNameSubmit} className="flex items-center gap-2 px-5 py-4 border-b border-[#8b6914]/15">
            <span className="text-[#8b6914]/60 text-sm font-mono flex-shrink-0 whitespace-nowrap">
              {isChinese ? '输入英语单词来解锁：' : 'Type to unlock:'}
            </span>
            <ChevronRight size={14} className="text-[#c4942a] flex-shrink-0" />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); setTypoWarning(null); }}
              className="flex-1 bg-transparent text-[#f0e8d8] text-sm font-mono outline-none placeholder-[#8b6914]/50 caret-[#c4942a] min-w-0"
              autoComplete="off"
              spellCheck={false}
              placeholder="type to unlock..."
            />
            <button
              type="submit"
              className="bg-[#8b6914]/30 hover:bg-[#c4942a]/40 border border-[#8b6914]/40 hover:border-[#c4942a] text-[#c4942a] text-xs px-3 py-1.5 rounded-lg transition-all uppercase tracking-wider flex-shrink-0"
            >
              {isChinese ? '确认' : 'Enter'}
            </button>
          </form>
        )}

        {/* Verb input mode */}
        {mode === 'verb' && (
          <>
            <form onSubmit={handleVerbSubmit} className="flex items-center gap-2 px-5 py-3 border-b border-[#8b6914]/15">
              <span className="text-[#8b6914]/60 text-sm font-mono flex-shrink-0 whitespace-nowrap">
                Cosa fai?
                <span className="text-[#b09060] ml-1">{isChinese ? '（输入英语动作）' : '(What do you do?)'}</span>
              </span>
              <ChevronRight size={14} className="text-[#c4942a] flex-shrink-0" />
              <LiveTypingFeedback target={commandTargets[0] ?? `examine ${fullName}`} alternatives={commandTargets.slice(1)} value={input} className="text-sm" />
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-transparent text-[#f0e8d8] text-sm font-mono outline-none placeholder-[#8b6914]/50 caret-[#c4942a] min-w-0"
                autoComplete="off"
                spellCheck={false}
                placeholder={`examine ${fullName}`}
              />
              <button
                type="submit"
                className="bg-[#8b6914]/30 hover:bg-[#c4942a]/40 border border-[#8b6914]/40 hover:border-[#c4942a] text-[#c4942a] text-xs px-3 py-1.5 rounded-lg transition-all uppercase tracking-wider flex-shrink-0"
              >
                {isChinese ? '确认' : 'Enter'}
              </button>
            </form>

            {/* Command list */}
            <div className="px-5 py-3 overflow-y-auto" style={{ maxHeight: '130px' }}>
              <div className="text-[#b09060] text-xs uppercase tracking-widest mb-2">
                {isChinese ? '可用动作' : 'Available actions'}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {hotspot.commands.map((cmd) => (
                  <div key={cmd.verb} className="flex items-baseline gap-2">
                    <span className="text-[#c4942a] text-sm font-mono font-medium flex-shrink-0 w-28">
                      {englishTerm(cmd.verb).charAt(0).toUpperCase() + englishTerm(cmd.verb).slice(1)}
                    </span>
                    <span className="text-[#d4c090] text-xs">{toTitleCase(cmd.english)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
