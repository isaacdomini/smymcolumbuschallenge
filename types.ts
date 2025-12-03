export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
  isVerified?: boolean;
  createdAt?: string;
}

export enum GameType {
  WORDLE = 'wordle',
  CONNECTIONS = 'connections',
  CROSSWORD = 'crossword',
  MATCH_THE_WORD = 'match_the_word',
  VERSE_SCRAMBLE = 'verse_scramble',
  WHO_AM_I = 'who_am_i',
  WORD_SEARCH = 'word_search',
}

export interface WordleData {
  solution: string;
}

export interface ConnectionsData {
  words: string[];
  categories: {
    name: string;
    words: string[];
  }[];
}

export type Direction = 'across' | 'down';

export interface Clue {
  number: number;
  clue: string;
  answer: string;
  row: number;
  col: number;
  direction: Direction;
}

export interface CrosswordData {
  rows: number; // Changed from gridSize
  cols: number; // Added cols
  acrossClues: Clue[];
  downClues: Clue[];
}

export interface MatchTheWordData {
  pairs: {
    word: string;
    match: string;
  }[];
}

export interface VerseScrambleData {
  verse: string;
  reference: string;
}

export interface WhoAmIData {
  answer: string;
  hint?: string;
}

export interface WordSearchData {
  grid: string[][];
  words: string[];
}

export type Game = {
  id: string;
  challengeId: string;
  date: string; // ISO string
} & (
    | {
      type: GameType.WORDLE;
      data: WordleData;
    }
    | {
      type: GameType.CONNECTIONS;
      data: ConnectionsData;
    }
    | {
      type: GameType.CROSSWORD;
      data: CrosswordData;
    }
    | {
      type: GameType.MATCH_THE_WORD;
      data: MatchTheWordData;
    }
    | {
      type: GameType.VERSE_SCRAMBLE;
      data: VerseScrambleData;
    }
    | {
      type: GameType.WHO_AM_I;
      data: WhoAmIData;
    }
    | {
      type: GameType.WORD_SEARCH;
      data: WordSearchData;
    }
  );

export interface Challenge {
  id: string;
  name: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
}

export interface DailyMessage {
  id: string;
  date: string;
  content: string;
  createdAt?: string;
} // ISO string

export interface GameSubmission {
  id: string;
  userId: string;
  gameId: string;
  challengeId: string;
  startedAt: string;
  completedAt: string;
  timeTaken: number;
  mistakes: number;
  score: number;
  submissionData?: any;
}

export interface SubmitGamePayload {
  userId: string;
  gameId: string;
  startedAt: string;
  timeTaken: number;
  mistakes: number;
  submissionData?: any;
}

export interface GameProgress {
  id: string;
  userId: string;
  gameId: string;
  gameState: any;
  updatedAt: string;
}

export interface AdminStats {
  totalUsers: number;
  playsToday: number;
  totalPlays: number;
  upcomingGames: number;
}

export interface LogEntry {
  id: number;
  ip_address: string;
  user_agent: string;
  path: string;
  method: string;
  user_id: string | null;
  metadata: any;
  created_at: string;
}

export interface BannerMessage {
  id: number;
  content: string;
  type: 'system' | 'user';
  targetUserId?: string;
  linkUrl?: string;
  linkText?: string;
  active: boolean;
  created_at: string;
  expires_at?: string;
}

export interface ScoringCriterion {
  title: string;
  description: string;
  points: string[];
}

export type DailyMessageBlock =
  | { type: 'verse'; text: string; reference: string }
  | { type: 'paragraph'; text: string };

export type DailyMessageContent = DailyMessageBlock[];
