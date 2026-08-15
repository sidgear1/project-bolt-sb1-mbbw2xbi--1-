export type GamePhase = 'tied' | 'has_knife' | 'freed' | 'has_key' | 'escaped' | 'flashback' | 'paris_street';
export type Screen = 'menu' | 'game';

export interface CommandEffect {
  phases: GamePhase[];
  narrative: string;
  transitionTo?: GamePhase;
  inventoryAdd?: string;
  inventoryRemove?: string;
  hpChange?: number;
  minLevel?: number;
  lockedNarrative?: string;
}

export interface Command {
  verb: string;
  english: string;
  effects: CommandEffect[];
  fallback: string;
}

export interface HotspotRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HotspotData {
  id: string;
  region: HotspotRegion;
  frenchName: string;
  article: string;
  pronunciation: string;
  english: string;
  commands: Command[];
  visiblePhases: GamePhase[];
  requiresCombatCleared?: boolean;
  labelPosition?: { x: number; y: number };
}

export interface DictionaryWord {
  french: string;
  english: string;
}

export interface SaveData {
  phase: GamePhase;
  learnedWords: string[];
  inventory: string[];
  dictionary: DictionaryWord[];
  introSeen: boolean;
  xp: number;
  combatCleared: boolean;
}

export interface CommandResult {
  narrative: string;
  transitionTo?: GamePhase;
  inventoryAdd?: string;
  inventoryRemove?: string;
  hpChange?: number;
  typoWarning?: string;
  sentence?: string;
}

// Parsed segment of narrative text — plain or French word
export type TextSegment =
  | { type: 'plain'; text: string }
  | { type: 'french'; french: string; english: string };

export type VoiceRole = 'narrator' | 'character' | 'item';
