import { GameType } from '../types';

export const getGameName = (gameType: GameType | string): string => {
  switch (gameType) {
    case GameType.WORDLE:
    case GameType.WORDLE_ADVANCED:
    case 'wordle':
    case 'wordle_advanced':
      return "Wordle";
    case GameType.CONNECTIONS:
    case 'connections':
      return "Connections";
    case GameType.CROSSWORD:
    case 'crossword':
      return "Crossword";
    case GameType.MATCH_THE_WORD:
    case 'match_the_word':
      return "Match the Word";
    case GameType.WHO_AM_I:
    case 'who_am_i':
      return "Hangman";
    case GameType.VERSE_SCRAMBLE:
    case 'verse_scramble':
      return "Verse Scramble";
    case GameType.WORD_SEARCH:
    case 'word_search':
      return "Word Search";
    default:
      return gameType.charAt(0).toUpperCase() + gameType.slice(1);
  }
};
