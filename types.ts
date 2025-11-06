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

export interface CrosswordData {
  grid: (string | null)[][];
  clues: {
    across: { [key: number]: string };
    down: { [key: number]: string };
  };
}

// FIX: Replaced the `Game` interface with a discriminated union type to allow for correct type narrowing based on game type.
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
  id: string;
  userId: string;
  gameId: string;
  challengeId: string;
  completedAt: string; // ISO string
  timeTaken: number; // in seconds
  mistakes: number;
  score: number;
  submissionData?: any; // e.g., wordle guesses, crossword grid
}

export interface SubmitGamePayload {
    userId: string;
    gameId: string;
    timeTaken: number;
    mistakes: number;
    submissionData?: any;
}
