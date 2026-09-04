export type GamePhase = 'tied' | 'has_knife' | 'freed' | 'has_key' | 'escaped' | 'flashback' | 'cat_7' | 'cat_8' | 'cat_9' | 'cat_10' | 'cat_10a' | 'cat_11' | 'cat_12' | 'cat_13' | 'cat_14' | 'cat_15' | 'cat_17' | 'cat_18' | 'cat_19' | 'cat_20' | 'cat_21' | 'cat_22' | 'cat_23' | 'cat_24' | 'cat_25' | 'paris_street';
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
