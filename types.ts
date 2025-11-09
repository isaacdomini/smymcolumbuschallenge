export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
  isVerified?: boolean; // Added for user manager
  createdAt?: string;   // Added for user manager
}

export enum GameType {
  WORDLE = 'wordle',
  CONNECTIONS = 'connections',
  CROSSWORD = 'crossword',
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
  gridSize: number;
  acrossClues: Clue[];
  downClues: Clue[];
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
);

export interface Challenge {
  id: string;
  name: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
}

export interface GameSubmission {
  id:string;
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

// ADDED: Log Entry Type
export interface LogEntry {
    id: number;
    ip_address: string;
    user_agent: string | null;
    path: string;
    method: string;
    user_id: string | null;
    created_at: string;
}