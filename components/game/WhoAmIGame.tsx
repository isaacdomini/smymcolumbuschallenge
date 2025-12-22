import React, { useState, useEffect, useCallback } from 'react';
import { WhoAmIData, GameSubmission, GameType } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { submitGame, getGameState, saveGameState, clearGameState, checkAnswer } from '../../services/api';
import GameInstructionsModal from './GameInstructionsModal';

interface WhoAmIGameProps {
  gameId: string;
  gameData: WhoAmIData;
  submission?: GameSubmission | null;
  onComplete: () => void;
}

const SAMPLE_DATA: WhoAmIData = {
  answer: "DAVID",
  hint: "A man after God's own heart"
};

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

const WhoAmIGame: React.FC<WhoAmIGameProps> = ({ gameId, gameData, submission, onComplete }) => {
  const { user } = useAuth();
  const isSample = gameId.startsWith('sample-');
  const isReadOnly = !!submission;
  const maxMistakes = 6;

  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [revealedPositions, setRevealedPositions] = useState<number[]>([]);
  const [revealedMap, setRevealedMap] = useState<{ [index: number]: string }>({});
  const [correctLetters, setCorrectLetters] = useState<string[]>([]);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(!isReadOnly);

  const dataToUse = isSample ? SAMPLE_DATA : gameData;
  // For real game, we don't have answer. We use maskedAnswer.
  const maskedAnswer = isSample ? SAMPLE_DATA.answer.replace(/[a-zA-Z0-9]/g, '_') : (gameData.maskedAnswer || '');
  const answerLength = isSample ? SAMPLE_DATA.answer.length : (gameData.wordLength || maskedAnswer.length);

  useEffect(() => {
    const loadState = async () => {
      if (isReadOnly && submission) {
        // Show completed state
        // If won, show all. If lost, show what was revealed?
        // Usually we reveal answer on loss.
        // But we don't have answer locally unless we fetch it or it's in submissionData.
        // submissionData.answer should be there.
        const answer = submission.submissionData.answer || (isSample ? SAMPLE_DATA.answer : '');
        if (answer) {
          // Mock revealed positions for all letters
          const positions = [];
          const map: { [index: number]: string } = {};
          const correct: string[] = [];
          for (let i = 0; i < answer.length; i++) {
            positions.push(i);
            map[i] = answer[i];
            if (answer[i] !== ' ' && !correct.includes(answer[i])) correct.push(answer[i]);
          }
          setRevealedPositions(positions);
          setRevealedMap(map);
          setCorrectLetters(correct);
          setGuessedLetters(answer.split('').filter((c: string) => c !== ' '));
        }
        setMistakes(submission.mistakes);
        setGameState(submission.mistakes >= maxMistakes ? 'lost' : 'won');
        setShowInstructions(false);
      } else if (isSample) {
        // Reset for sample
        setGuessedLetters([]);
        setRevealedPositions([]);
        setRevealedMap({});
        setCorrectLetters([]);
        setMistakes(0);
        setGameState('playing');
      } else if (user) {
        const savedProgress = await getGameState(user.id, gameId);
        if (savedProgress?.gameState) {
          setGuessedLetters(savedProgress.gameState.guessedLetters || []);
          setRevealedPositions(savedProgress.gameState.revealedPositions || []);
          setRevealedMap(savedProgress.gameState.revealedMap || {});
          setCorrectLetters(savedProgress.gameState.correctLetters || []);
          setMistakes(savedProgress.gameState.mistakes || 0);
          setGameState(savedProgress.gameState.gameState || 'playing');
          if (savedProgress.gameState.startTime) {
            setStartTime(savedProgress.gameState.startTime);
            setShowInstructions(false);
          }
        }
      }
    };
    loadState();
  }, [gameData, isReadOnly, submission, gameId, user, isSample]);

  useEffect(() => {
    if (isReadOnly || gameState !== 'playing' || !user || startTime === null || isSample) return;
    const stateToSave = { guessedLetters, revealedPositions, revealedMap, correctLetters, mistakes, gameState, startTime };
    const handler = setTimeout(() => saveGameState(user.id, gameId, stateToSave), 1000);
    return () => clearTimeout(handler);
  }, [guessedLetters, revealedPositions, revealedMap, correctLetters, mistakes, gameState, startTime, isReadOnly, user, gameId]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGuess = useCallback(async (letter: string) => {
    if (gameState !== 'playing' || isReadOnly || guessedLetters.includes(letter) || isSubmitting) return;

    const newGuessed = [...guessedLetters, letter];
    setGuessedLetters(newGuessed);

    if (isSample) {
      const answer = SAMPLE_DATA.answer.toUpperCase();
      if (!answer.includes(letter)) {
        setMistakes(prev => {
          const newMistakes = prev + 1;
          if (newMistakes >= maxMistakes) {
            setGameState('lost');
          }
          return newMistakes;
        });
      } else {
        // Update revealed positions locally for sample
        const newRevealed = [...revealedPositions];
        for (let i = 0; i < answer.length; i++) {
          if (answer[i] === letter) newRevealed.push(i);
        }
        setRevealedPositions(newRevealed);
        setCorrectLetters(prev => [...prev, letter]);

        // Check win
        const isWon = answer.split('').every(char => char === ' ' || newGuessed.includes(char));
        if (isWon) setGameState('won');
      }
    } else {
      // Backend check
      setIsSubmitting(true);
      try {
        const response = await checkAnswer(gameId, letter);
        if (response.correct) {
          setRevealedPositions(prev => [...prev, ...response.positions]);
          setRevealedMap(prev => {
            const newMap = { ...prev };
            response.positions.forEach((pos: number) => {
              newMap[pos] = letter;
            });
            return newMap;
          });
          setCorrectLetters(prev => [...prev, letter]);

          // Check win: if all non-space chars are revealed.
          const totalLetters = (maskedAnswer.match(/_/g) || []).length;
          const newRevealedPositions = [...revealedPositions, ...response.positions];
          const uniqueRevealed = new Set(newRevealedPositions);

          if (uniqueRevealed.size === totalLetters) {
            setGameState('won');
          }

        } else {
          setMistakes(prev => {
            const newMistakes = prev + 1;
            if (newMistakes >= maxMistakes) {
              setGameState('lost');
            }
            return newMistakes;
          });
        }
      } catch (e) {
        console.error("Check failed", e);
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [gameState, isReadOnly, guessedLetters, mistakes, isSample, gameId, maskedAnswer, revealedPositions, isSubmitting]);

  // Handle physical keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing' || isReadOnly || showInstructions) return;
      const char = e.key.toUpperCase();
      if (/^[A-Z]$/.test(char)) {
        handleGuess(char);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGuess, gameState, isReadOnly, showInstructions]);

  useEffect(() => {
    const saveResult = async () => {
      if ((gameState === 'won' || gameState === 'lost') && !isReadOnly && startTime !== null && !isSample) {
        if (!user) return;
        const timeTaken = Math.round((Date.now() - startTime) / 1000);
        await submitGame({
          userId: user.id,
          gameId,
          startedAt: new Date(startTime).toISOString(),
          timeTaken,
          mistakes,
          submissionData: { solved: gameState === 'won', guessedLetters, answer: isSample ? SAMPLE_DATA.answer : undefined } // Backend will fill answer if won? Or we don't need it.
        });
        await clearGameState(user.id, gameId);
        setTimeout(onComplete, 3000);
      }
    };
    saveResult();
  }, [gameState, user, isReadOnly, gameId, mistakes, onComplete, startTime]);

  const handleStartGame = () => {
    setStartTime(Date.now());
    setShowInstructions(false);
  };

  if (showInstructions) {
    return <GameInstructionsModal gameType={GameType.WHO_AM_I} onStart={handleStartGame} onClose={handleStartGame} />;
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center p-4">
      <div className="flex items-center justify-between w-full mb-6">
        <h2 className="text-2xl font-bold text-yellow-400">Hangman {isSample && <span className="text-sm bg-blue-600 text-white px-2 py-1 rounded ml-2">Sample</span>}</h2>
        <button onClick={() => setShowInstructions(true)} className="text-gray-400 hover:text-white" title="Show Instructions">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </button>
      </div>

      {dataToUse.hint && (
        <div className="mb-8 p-4 bg-gray-800 rounded-lg border border-gray-700 text-center w-full">
          <span className="text-gray-400 text-sm uppercase tracking-wider block mb-1">Hint</span>
          <p className="text-lg text-gray-200 italic">"{dataToUse.hint}"</p>
        </div>
      )}

      {/* Word Display */}
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {maskedAnswer.split('').map((char, i) => {
          const isSpace = char === ' '; // maskedAnswer preserves spaces? Yes, we replaced [a-zA-Z0-9]/g, _.
          // Wait, maskedAnswer in api.ts: `gameData.answer.replace(/[a-zA-Z0-9]/g, '_')`.
          // So spaces remain spaces.
          // If it's a space, we show space.
          // If it's _, we show blank or letter if revealed.

          // For sample, we have answer.
          // For real game, we have maskedAnswer and revealedPositions.

          let displayChar = '';
          if (isSample) {
            displayChar = SAMPLE_DATA.answer[i];
          } else {
            // We don't have the letter locally unless we revealed it!
            // Wait, checkAnswer returns positions, but does it return the letter?
            // No, checkAnswer returns { correct: true, positions: [...] }.
            // It does NOT return the letter because we sent the letter!
            // So we know the letter.
            // But we need to map position to letter.
            // We can reconstruct the word from guessedLetters and positions?
            // Yes. If i is in revealedPositions, we need to find which guessed letter corresponds to it?
            // No, we can just iterate guessedLetters and check if they are correct?
            // But we don't know which letter is at position i unless we store it.
            // We stored `revealedPositions`. But we didn't store "position i is letter X".
            // We need to store that mapping.
            // Or we can just use `guessedLetters` if I had the answer.
            // But I don't have the answer.

            // So I need `revealedMap`: { [index: number]: string }.
            // I'll update the state to include `revealedMap` or derive it.
            // I'll update handleGuess to update a map.
          }

          return (
            <div key={i} className={`w-10 h-12 flex items-end justify-center border-b-4 ${isSpace ? 'border-transparent' : 'border-gray-500'} mx-1`}>
              <span className={`text-3xl font-bold ${revealedPositions.includes(i) || isSpace ? 'visible' : 'invisible'}`}>
                {isSpace ? ' ' : (isSample ? SAMPLE_DATA.answer[i] : (revealedMap[i] || '?'))}
              </span>
            </div>
          );
        })}
      </div>

      {/* Hangman Visual & Mistakes */}
      <div className="flex flex-col items-center mb-8">
        <div className="mb-4">
          <svg width="120" height="150" viewBox="0 0 120 150" className="stroke-gray-300" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {/* Base */}
            <line x1="10" y1="140" x2="110" y2="140" />
            <line x1="60" y1="140" x2="60" y2="10" />
            <line x1="60" y1="10" x2="100" y2="10" />
            <line x1="100" y1="10" x2="100" y2="30" />

            {/* Head */}
            {mistakes >= 1 && <circle cx="100" cy="45" r="15" />}

            {/* Body */}
            {mistakes >= 2 && <line x1="100" y1="60" x2="100" y2="100" />}

            {/* Left Arm */}
            {mistakes >= 3 && <line x1="100" y1="70" x2="80" y2="90" />}

            {/* Right Arm */}
            {mistakes >= 4 && <line x1="100" y1="70" x2="120" y2="90" />}

            {/* Left Leg */}
            {mistakes >= 5 && <line x1="100" y1="100" x2="80" y2="130" />}

            {/* Right Leg */}
            {mistakes >= 6 && <line x1="100" y1="100" x2="120" y2="130" />}
          </svg>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-gray-400">Mistakes:</span>
          <div className="flex space-x-1">
            {Array.from({ length: maxMistakes }).map((_, i) => (
              <div key={i} className={`w-3 h-3 rounded-full ${i < mistakes ? 'bg-red-500' : 'bg-gray-700'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Keyboard */}
      <div className="w-full max-w-lg">
        {KEYBOARD_ROWS.map((row, i) => (
          <div key={i} className="flex justify-center gap-1 mb-2">
            {row.map(char => {
              const isGuessed = guessedLetters.includes(char);
              // We don't know isCorrect locally for real game unless we check.
              // But we know if we guessed it and it was correct (revealed something).
              // We can track correct guesses.
              // Or check if any revealed position corresponds to this char (if we had map).
              // For now, let's assume if it's guessed and not in mistakes, it's correct?
              // No, mistakes tracks count.
              // We need to track `correctGuessedLetters` and `incorrectGuessedLetters`.
              // I'll update state to track this.

              const isCorrect = isSample ? SAMPLE_DATA.answer.includes(char) : correctLetters.includes(char);
              let bgColor = 'bg-gray-700 hover:bg-gray-600';
              if (isGuessed) {
                bgColor = isCorrect ? 'bg-green-600' : 'bg-gray-800 text-gray-500';
              }

              return (
                <button
                  key={char}
                  onClick={() => handleGuess(char)}
                  disabled={isGuessed || gameState !== 'playing' || isReadOnly}
                  className={`w-8 h-10 sm:w-10 sm:h-12 rounded font-bold transition-colors ${bgColor} ${isGuessed ? 'cursor-default' : ''}`}
                >
                  {char}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {(gameState !== 'playing' || isReadOnly) && (
        <div className="mt-8 text-center animate-fade-in">
          {gameState === 'won' && <p className="text-2xl text-green-400 font-bold mb-4">You got it!</p>}
          {gameState === 'lost' && (
            <div className="mb-4">
              <p className="text-xl text-red-400 font-bold mb-2">Game Over</p>
              <p className="text-gray-300">The answer was hidden.</p>
            </div>
          )}
          <button onClick={onComplete} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full transition-transform hover:scale-105">
            Continue
          </button>
        </div>
      )}
    </div>
  );
};

export default WhoAmIGame;
