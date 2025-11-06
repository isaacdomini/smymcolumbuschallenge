import React, { useState, useEffect, useCallback } from 'react';
import { WordleData, GameSubmission } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { submitGame, getGameState, saveGameState, clearGameState } from '../../services/api';

interface WordleGameProps {
  gameId: string;
  gameData: WordleData;
  submission?: GameSubmission | null;
  onComplete: () => void;
}

const WordleGame: React.FC<WordleGameProps> = ({ gameId, gameData, submission, onComplete }) => {
  const { user } = useAuth();
  const [guesses, setGuesses] = useState<string[]>(Array(6).fill(''));
  const [currentGuess, setCurrentGuess] = useState('');
  const [activeGuessIndex, setActiveGuessIndex] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [startTime, setStartTime] = useState(Date.now());
  const isReadOnly = !!submission;
  const solution = gameData.solution.toUpperCase();

  useEffect(() => {
    if (isReadOnly || !user) return;

    const loadState = async () => {
        const savedProgress = await getGameState(user.id, gameId);
        if (savedProgress?.gameState) {
            try {
                const savedState = savedProgress.gameState;
                setGuesses(savedState.guesses || Array(6).fill(''));
                setActiveGuessIndex(savedState.activeGuessIndex || 0);
                setGameState(savedState.gameState || 'playing');
                setStartTime(savedState.startTime || Date.now());
            } catch (e) {
                console.error("Failed to parse saved Wordle state", e);
            }
        }
    };
    loadState();
  }, [gameId, isReadOnly, user]);

  useEffect(() => {
    if (isReadOnly || gameState !== 'playing' || !user) return;

    const stateToSave = {
      guesses,
      activeGuessIndex,
      gameState,
      startTime,
    };
    
    const handler = setTimeout(() => {
        saveGameState(user.id, gameId, stateToSave);
    }, 1000); // Debounce save

    return () => clearTimeout(handler);
  }, [guesses, activeGuessIndex, gameState, startTime, isReadOnly, user, gameId]);


  useEffect(() => {
    if (isReadOnly && submission) {
      const submittedGuesses = submission.submissionData.guesses;
      const finalGuesses = [...submittedGuesses];
      while (finalGuesses.length < 6) {
        finalGuesses.push('');
      }
      setGuesses(finalGuesses);
      setActiveGuessIndex(submittedGuesses.length);
      
      const lastGuess = submittedGuesses[submittedGuesses.length - 1];
      if (lastGuess === solution) {
        setGameState('won');
      } else {
        setGameState('lost');
      }
    }
  }, [isReadOnly, submission, solution]);

  const handleKeyPress = useCallback((key: string) => {
    if (gameState !== 'playing' || isRevealing || isReadOnly) return;

    if (key === 'Enter') {
      if (currentGuess.length === 5) {
        const newGuesses = [...guesses];
        newGuesses[activeGuessIndex] = currentGuess;
        setGuesses(newGuesses);
        setIsRevealing(true);
      }
    } else if (key === 'Backspace') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (currentGuess.length < 5 && /^[A-Z]$/i.test(key)) {
      setCurrentGuess(prev => prev + key.toUpperCase());
    }
  }, [currentGuess, activeGuessIndex, guesses, gameState, isRevealing, isReadOnly]);
  
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
        } else if (activeGuessIndex === 5) {
            setGameState('lost');
        } else {
            setActiveGuessIndex(prev => prev + 1);
            setCurrentGuess('');
            setIsRevealing(false);
        }
    }, 5 * 350);
  }, [isRevealing, activeGuessIndex, guesses, solution]);

  useEffect(() => {
     const saveResult = async () => {
        if ((gameState === 'won' || gameState === 'lost') && !isReadOnly) {
            if (!user) return;
            await clearGameState(user.id, gameId);
            const timeTaken = Math.round((Date.now() - startTime) / 1000);
            const mistakes = gameState === 'won' ? activeGuessIndex : 6;
            await submitGame({
                userId: user.id,
                gameId,
                timeTaken,
                mistakes,
                submissionData: { guesses: guesses.filter(g => g) }
            });
            setTimeout(onComplete, 2000);
        }
     }
     saveResult();
  }, [gameState, user, isReadOnly, startTime, activeGuessIndex, gameId, guesses, onComplete]);


  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-4">Wordle</h2>
      <div className="grid grid-rows-6 gap-1.5 mb-4">
        {guesses.map((guess, i) => (
          <Row
            key={i}
            guess={i === activeGuessIndex ? currentGuess : guess}
            isSubmitted={i < activeGuessIndex || (i === activeGuessIndex && (isRevealing || isReadOnly))}
            solution={solution}
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
    </div>
  );
};


const Row: React.FC<{ guess: string; isSubmitted: boolean; solution: string; }> = ({ guess, isSubmitted, solution }) => {
  const letters = Array.from(Array(5));
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {letters.map((_, i) => {
        const char = guess[i];
        const status = getTileStatus(char, i, isSubmitted, solution, guess);
        return <Tile key={i} char={char} status={status} isRevealing={isSubmitted} index={i}/>
      })}
    </div>
  );
};

const getTileStatus = (char: string, index: number, isSubmitted: boolean, solution: string, guess: string) => {
    if (!isSubmitted || !char) return 'empty';
    if (solution[index] === char) return 'correct';
    if (solution.includes(char)) {
       const solutionCount = [...solution].filter(x => x === char).length;
       const guessCount = [...guess].slice(0, index + 1).filter(x => x === char).length;
       const correctPositions = [...guess].filter((x, pos) => x === char && solution[pos] === char).length;
       if (guessCount <= solutionCount - correctPositions) return 'present';
    }
    return 'absent';
};

const Tile: React.FC<{char?: string; status: 'empty' | 'correct' | 'present' | 'absent'; isRevealing: boolean; index: number}> = ({ char, status, isRevealing, index }) => {
    const baseClasses = "w-14 h-14 sm:w-16 sm:h-16 border-2 flex items-center justify-center text-3xl font-bold uppercase transition-all duration-300";
    const statusClasses = {
        empty: 'border-gray-600',
        absent: 'bg-gray-700 border-gray-700',
        present: 'bg-yellow-500 border-yellow-500',
        correct: 'bg-green-600 border-green-600',
    };
    const animationDelay = isRevealing ? `${index * 350}ms` : '0ms';
    const transformClass = isRevealing ? 'animate-flip-in' : '';

    return (
        <div 
        className={`${baseClasses} ${isRevealing ? statusClasses[status] : statusClasses.empty} ${transformClass}`}
        style={{ animationDelay }}
        >
            {char}
        </div>
    );
}

export default WordleGame;
