export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
  isVerified?: boolean;
  createdAt?: string;
  token?: string;
}

export enum GameType {
  WORDLE = 'wordle',
  WORDLE_ADVANCED = 'wordle_advanced',
  WORDLE_BANK = 'wordle_bank',
  CONNECTIONS = 'connections',
  CROSSWORD = 'crossword',
  MATCH_THE_WORD = 'match_the_word',
  VERSE_SCRAMBLE = 'verse_scramble',
  WHO_AM_I = 'who_am_i',
  WORD_SEARCH = 'word_search',
}

export interface WordleData {
  solution?: string;
  solutions?: string[];
  wordLength?: number;
}

export interface ConnectionsData {
  words: string[];
  categories: {
    name: string;
    words: string[];
  }[];
  // For frontend (masked)
  shuffledWords?: string[];
}

export type Direction = 'across' | 'down';

export interface Clue {
  number: number;
  clue: string;
  answer?: string; // Made optional
  row: number;
  col: number;
  direction: Direction;
  length?: number; // Added length
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
  // For frontend (masked)
  shuffledWords?: string[];
  shuffledMatches?: string[];
}

export interface VerseScrambleData {
  verse?: string;
  reference?: string;
  verses?: { verse: string; reference: string }[];
  // For frontend (masked)
  scrambledWords?: string[];
}

export interface WhoAmIData {
  answer?: string;
  hint?: string;
  solutions?: { answer: string; hint?: string }[];
  // For frontend (masked)
  wordLength?: number;
  maskedAnswer?: string;
}

export interface WordSearchData {
  grid: string[][];
  words: string[];
  puzzles?: {
    grid: string[][];
    words: string[];
  }[];
}

export type Game = {
  id: string;
  challengeId: string;
  date: string; // ISO string
  revisitBlocked?: boolean;
  message?: string;
} & (
    | {
      type: GameType.WORDLE;
      data: WordleData;
    }
    | {
      type: GameType.WORDLE_ADVANCED;
      data: WordleData;
    }
    | {
      type: GameType.WORDLE_BANK;
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
  wordBank?: string[]; // Added for centralized word bank
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
  feedback?: any;
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
  priority?: 'high' | 'normal' | 'low';
}

export interface ScoringCriterion {
  title: string;
  description: string;
  points: string[];
}

export type DailyMessageBlock =
  | { type: 'verse'; text: string; reference: string }
  | { type: 'paragraph'; text: string }
  | { type: 'long_text'; title: string; text: string };

export type DailyMessageContent = DailyMessageBlock[];
