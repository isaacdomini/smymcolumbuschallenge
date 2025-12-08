export const getGameName = (gameType: string): string => {
  switch (gameType) {
    case 'wordle':
    case 'wordle_advanced':
      return "Wordle";
    case 'connections':
      return "Connections";
    case 'crossword':
      return "Crossword";
    case 'match_the_word':
      return "Match the Word";
    case 'who_am_i':
      return "Hangman";
    case 'verse_scramble':
      return "Verse Scramble";
    case 'word_search':
      return "Word Search";
    default:
      return gameType.charAt(0).toUpperCase() + gameType.slice(1);
  }
};
