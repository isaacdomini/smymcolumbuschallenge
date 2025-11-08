export interface User {
  id: string;
  name: string;
  email: string;
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
  startedAt: string; // ISO string - ADDED
  completedAt: string; // ISO string
  timeTaken: number; // in seconds
  mistakes: number;
  score: number;
  submissionData?: any; // e.g., wordle guesses, crossword grid
}

export interface SubmitGamePayload {
    userId: string;
    gameId: string;
    startedAt: string; // ISO string - ADDED
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