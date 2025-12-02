import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WordleData, GameSubmission, GameType } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { submitGame, getGameState, saveGameState, clearGameState } from '../../services/api';
import GameInstructionsModal from './GameInstructionsModal';

interface WordleGameProps {
  gameId: string;
  gameData: WordleData;
  submission?: GameSubmission | null;
  onComplete: () => void;
  isPreview?: boolean;
}

const WordleGame: React.FC<WordleGameProps> = ({ gameId, gameData, submission, onComplete, isPreview = false }) => {
  const { user } = useAuth();
  const isSample = gameId.startsWith('sample-');
  const solution = useMemo(() => isSample ? 'FAITH' : gameData.solution.toUpperCase(), [gameData.solution, isSample]);
  const wordLength = useMemo(() => solution.length, [solution]);
  const maxGuesses = 6;
  const isReadOnly = !!submission;

  const [guesses, setGuesses] = useState<string[]>(() => Array(maxGuesses).fill(''));
  const [currentGuess, setCurrentGuess] = useState('');
  const [activeGuessIndex, setActiveGuessIndex] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  // startTime is now nullable and set only when game starts
  const [startTime, setStartTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(!isReadOnly && !isPreview);

  useEffect(() => {
    if (isReadOnly || !user || isSample || isPreview) return;

    const loadState = async () => {
      const savedProgress = await getGameState(user.id, gameId);
      if (savedProgress?.gameState) {
        try {
          const savedState = savedProgress.gameState;
          if (savedState.guesses && savedState.guesses.length === maxGuesses) {
            setGuesses(savedState.guesses);
          } else {
            setGuesses(Array(maxGuesses).fill(''));
          }
          setActiveGuessIndex(savedState.activeGuessIndex || 0);
          setGameState(savedState.gameState || 'playing');
          // Use saved start time, or if it doesn't exist (old save), don't set it yet (wait for user to "start" again if we wanted, but better to just set it now to avoid issues)
          if (savedState.startTime) {
            setStartTime(savedState.startTime);
            setShowInstructions(false); // Don't show instructions if resuming
          }
        } catch (e) {
          console.error("Failed to parse saved Wordle state", e);
          setGuesses(Array(maxGuesses).fill(''));
        }
      }
    };
    loadState();
  }, [gameId, isReadOnly, user, maxGuesses, isSample, isPreview]);

  useEffect(() => {
    // Only save state if the game has actually started (startTime is set)
    if (isReadOnly || gameState !== 'playing' || !user || startTime === null || isSample || isPreview) return;

    const stateToSave = {
      guesses,
      activeGuessIndex,
      gameState,
      startTime,
    };

    const handler = setTimeout(() => {
      saveGameState(user.id, gameId, stateToSave);
    }, 1000);

    return () => clearTimeout(handler);
  }, [guesses, activeGuessIndex, gameState, startTime, isReadOnly, user, gameId, isPreview]);


  useEffect(() => {
    if (isReadOnly && submission) {
      const submittedGuesses = submission.submissionData.guesses;
      const finalGuesses = [...submittedGuesses];
      while (finalGuesses.length < maxGuesses) {
        finalGuesses.push('');
      }
      setGuesses(finalGuesses);
      setActiveGuessIndex(submittedGuesses.length);
      setShowInstructions(false);

      const lastGuess = submittedGuesses[submittedGuesses.length - 1];
      if (lastGuess === solution) {
        setGameState('won');
      } else {
        setGameState('lost');
      }
    }
  }, [isReadOnly, submission, solution, maxGuesses]);

  const [extraWords, setExtraWords] = useState<Set<string> | null>(null);

  const checkWordValidity = async (word: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);

      if (response.ok) {
        setIsLoading(false);
        return true;
      }

      if (response.status === 404) {
        // Fallback: Check local list
        let currentExtraWords = extraWords;
        if (!currentExtraWords) {
          try {
            const res = await fetch('/valid_words.txt');
            if (res.ok) {
              const text = await res.text();
              // Split by newlines, trim, and convert to uppercase for set
              const words = text.split(/\r?\n/).map(w => w.trim().toUpperCase()).filter(w => w.length > 0);
              currentExtraWords = new Set(words);
              setExtraWords(currentExtraWords);
            }
          } catch (e) {
            console.error("Failed to load extra words list", e);
          }
        }

        if (currentExtraWords && currentExtraWords.has(word.toUpperCase())) {
          setIsLoading(false);
          return true;
        }

        setIsLoading(false);
        setError("Not in word list");
        return false;
      }

      setIsLoading(false);
      setError("Error checking word");
      return false;
    } catch (err) {
      console.error("Dictionary API error:", err);
      setIsLoading(false);
      setError("Could not check word");
      return false;
    }
  };

  const handleKeyPress = useCallback(async (key: string) => {
    if (gameState !== 'playing' || isRevealing || isReadOnly || isLoading || showInstructions) return;

    if (key === 'Enter') {
      if (currentGuess.length === wordLength) {
        const isValid = await checkWordValidity(currentGuess);
        if (!isValid) {
          return;
        }
        const newGuesses = [...guesses];
        newGuesses[activeGuessIndex] = currentGuess;
        setGuesses(newGuesses);
        setIsRevealing(true);
      } else {
        setError(`Word must be ${wordLength} letters`);
      }
    } else if (key === 'Backspace') {
      setError(null);
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (currentGuess.length < wordLength && /^[A-Z]$/i.test(key)) {
      setError(null);
      setCurrentGuess(prev => prev + key.toUpperCase());
    }
  }, [currentGuess, activeGuessIndex, guesses, gameState, isRevealing, isReadOnly, isLoading, wordLength, checkWordValidity, showInstructions]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKeyPress(e.key);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKeyPress]);

  useEffect(() => {
    if (!isRevealing) return;

    const guess = guesses[activeGuessIndex];

    setTimeout(() => {
      if (guess === solution) {
        setGameState('won');
        setIsRevealing(false); // stop revealing further rows
      } else if (activeGuessIndex === maxGuesses - 1) {
        setGameState('lost');
        setIsRevealing(false);
      } else {
        setActiveGuessIndex(prev => prev + 1);
        setCurrentGuess('');
        setIsRevealing(false);
      }
    }, wordLength * 350);
  }, [isRevealing, activeGuessIndex, guesses, solution, maxGuesses, wordLength]);

  useEffect(() => {
    const saveResult = async () => {
      // Ensure startTime is present before submitting
      if ((gameState === 'won' || gameState === 'lost') && !isReadOnly && startTime !== null && !isSample && !isPreview) {
        if (!user) return;
        await clearGameState(user.id, gameId);
        const timeTaken = Math.round((Date.now() - startTime) / 1000);
        const mistakes = gameState === 'won' ? activeGuessIndex : maxGuesses;
        await submitGame({
          userId: user.id,
          gameId,
          startedAt: new Date(startTime).toISOString(),
          timeTaken,
          mistakes,
          submissionData: { guesses: guesses.filter(g => g) }
        });
        setTimeout(onComplete, 2000);
      }
    }
    saveResult();
  }, [gameState, user, isReadOnly, startTime, activeGuessIndex, gameId, guesses, onComplete, maxGuesses, isSample, isPreview]);

  const handleInstructionsClose = () => {
    // Only set start time if it hasn't been set yet AND it's not read-only mode
    if (startTime === null && !isReadOnly) {
      setStartTime(Date.now());
    }
    setShowInstructions(false);
  };

  const letterStatuses = useMemo(() => {
    const statuses: { [key: string]: 'correct' | 'present' | 'absent' } = {};
    const submittedGuesses = guesses.slice(0, activeGuessIndex + (isRevealing ? 1 : 0));

    submittedGuesses.forEach(guess => {
      [...guess].forEach((char, i) => {
        if (solution[i] === char) {
          statuses[char] = 'correct';
        } else if (solution.includes(char)) {
          if (statuses[char] !== 'correct') {
            statuses[char] = 'present';
          }
        } else {
          statuses[char] = 'absent';
        }
      });
    });
    return statuses;
  }, [guesses, activeGuessIndex, solution, isRevealing]);

  if (showInstructions) {
    return <GameInstructionsModal gameType={GameType.WORDLE} onStart={handleInstructionsClose} onClose={handleInstructionsClose} />;
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center">
      <div className="flex items-center justify-between w-full mb-4">
        <h2 className="text-2xl font-bold">
          Wordle
          {isSample && <span className="text-sm bg-blue-600 px-2 py-1 rounded ml-2">Sample</span>}
          {isPreview && <span className="text-sm bg-purple-600 px-2 py-1 rounded ml-2">Preview</span>}
        </h2>
        <button onClick={() => setShowInstructions(true)} className="text-gray-400 hover:text-white" title="Show Instructions">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </button>
      </div>

      <div className="h-8 mb-2 flex items-center justify-center">
        {isLoading && (
          <div className="text-blue-400">Checking word...</div>
        )}
        {error && !isLoading && (
          <div className="text-red-400 bg-red-900/50 px-3 py-1 rounded-md">{error}</div>
        )}
      </div>

      <div
        className="grid gap-1 sm:gap-1.5 mb-2 sm:mb-4 w-full max-w-[350px] sm:max-w-md"
        style={{ gridTemplateRows: `repeat(${maxGuesses}, 1fr)` }}
      >
        {guesses.map((guess, i) => (
          <Row
            key={i}
            guess={i === activeGuessIndex ? currentGuess : guess}
            isSubmitted={i < activeGuessIndex || (i === activeGuessIndex && (isRevealing || isReadOnly))}
            solution={solution}
            wordLength={wordLength}
          />
        ))}
      </div>
      {(gameState !== 'playing' || isReadOnly) && (
        <div className="text-center p-4 rounded-lg bg-gray-800 w-full">
          {gameState === 'won' && <p className="text-xl text-green-400 font-bold">You won!</p>}
          {gameState === 'lost' && <p className="text-xl text-red-400 font-bold">Nice try! The word was <span className="font-bold">{solution}</span>.</p>}
          {isReadOnly && submission && (
            <div className="mt-4 text-sm text-gray-300">
              <p>Time Taken: {submission.timeTaken}s | Mistakes: {submission.mistakes} | Score: {submission.score}</p>
            </div>
          )}
          <button onClick={onComplete} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Back to Dashboard
          </button>
        </div>
      )}

      {!isReadOnly && gameState === 'playing' && (
        <Keyboard onKeyPress={handleKeyPress} letterStatuses={letterStatuses} />
      )}
    </div>
  );
};


const Row: React.FC<{ guess: string; isSubmitted: boolean; solution: string; wordLength: number; }> = ({ guess, isSubmitted, solution, wordLength }) => {
  const letters = Array.from(Array(wordLength));
  return (
    <div
      className="grid gap-1 sm:gap-1.5"
      style={{ gridTemplateColumns: `repeat(${wordLength}, 1fr)` }}
    >
      {letters.map((_, i) => {
        const char = guess[i];
        const status = getTileStatus(char, i, isSubmitted, solution, guess);
        return <Tile key={i} char={char} status={status} isRevealing={isSubmitted} index={i} />
      })}
    </div>
  );
};

const getTileStatus = (char: string, index: number, isSubmitted: boolean, solution: string, guess: string) => {
  if (!isSubmitted || !char) return 'empty';
  if (solution[index] === char) return 'correct';
  if (solution.includes(char)) {
    const solutionChars = [...solution];
    const guessChars = [...guess];

    let solutionCount = 0;
    solutionChars.forEach(sChar => {
      if (sChar === char) solutionCount++;
    });

    let correctCount = 0;
    guessChars.forEach((gChar, i) => {
      if (gChar === char && solutionChars[i] === char) {
        correctCount++;
      }
    });

    let presentCount = 0;
    for (let i = 0; i <= index; i++) {
      if (guessChars[i] === char && solutionChars[i] !== char) {
        presentCount++;
      }
    }

    if (presentCount <= solutionCount - correctCount) {
      return 'present';
    }
  }
  return 'absent';
};

const Tile: React.FC<{ char?: string; status: 'empty' | 'correct' | 'present' | 'absent'; isRevealing: boolean; index: number }> = ({ char, status, isRevealing, index }) => {
  const baseClasses = "aspect-square w-full border-2 flex items-center justify-center text-xl sm:text-3xl font-bold uppercase transition-all duration-300";
  const statusClasses = {
    empty: 'border-gray-600',
    absent: 'bg-gray-700 border-gray-700',
    present: 'bg-yellow-500 border-yellow-500',
    correct: 'bg-green-600 border-green-600',
  };
  const animationDelay = isRevealing ? `${index * 350}ms` : '0ms';
  const transformClass = isRevealing ? 'animate-flip-in' : '';

  return (
    <>
      <style>
        {`
            @keyframes flip-in {
                0% { transform: rotateX(0deg); background-color: #4B5563; border-color: #4B5563; }
                50% { transform: rotateX(90deg); background-color: #4B5563; border-color: #4B5563; }
                100% { transform: rotateX(0deg); }
            }
            .animate-flip-in {
                animation: flip-in 0.5s ease;
            }
            `}
      </style>
      <div
        className={`${baseClasses} ${isRevealing ? statusClasses[status] : statusClasses.empty} ${transformClass}`}
        style={{ animationDelay }}
      >
        {char}
      </div>
    </>
  );
};

const KEY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Backspace'],
];

const Keyboard: React.FC<{ onKeyPress: (key: string) => void; letterStatuses: { [key: string]: 'correct' | 'present' | 'absent' }; }> = ({ onKeyPress, letterStatuses }) => {
  return (
    <div className="w-full max-w-lg mt-2 sm:mt-4">
      {KEY_ROWS.map((row, i) => (
        <div key={i} className="flex justify-center gap-1 my-0.5 sm:my-1 w-full">
          {row.map(key => {
            const status = letterStatuses[key];
            const keyClasses = {
              correct: 'bg-green-600 hover:bg-green-700',
              present: 'bg-yellow-500 hover:bg-yellow-600',
              absent: 'bg-gray-700 hover:bg-gray-600',
              default: 'bg-gray-500 hover:bg-gray-600'
            };
            const flexClass = (key === 'Enter' || key === 'Backspace') ? 'flex-[1.5]' : 'flex-1';
            const textSize = (key === 'Enter' || key === 'Backspace') ? 'text-[10px] sm:text-xs' : 'text-sm sm:text-base';

            return (
              <button
                key={key}
                onClick={() => onKeyPress(key)}
                className={`h-10 sm:h-14 rounded font-semibold uppercase text-white transition-colors ${flexClass} ${status ? keyClasses[status] : keyClasses.default} ${textSize}`}
              >
                {key === 'Backspace' ? '⌫' : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};


export default WordleGame;