import React, { useState, useEffect, useMemo } from 'react';
import { VerseScrambleData, GameSubmission, GameType } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { submitGame, getGameState, saveGameState, clearGameState } from '../../services/api';
import GameInstructionsModal from './GameInstructionsModal';

interface VerseScrambleGameProps {
  gameId: string;
  gameData: VerseScrambleData;
  submission?: GameSubmission | null;
  onComplete: () => void;
}

const SAMPLE_DATA: VerseScrambleData = {
  verse: "For God so loved the world that he gave his one and only Son",
  reference: "John 3:16"
};

const VerseScrambleGame: React.FC<VerseScrambleGameProps> = ({ gameId, gameData, submission, onComplete }) => {
  const { user } = useAuth();
  const isSample = gameId.startsWith('sample-');
  const isReadOnly = !!submission;

  const [availableWords, setAvailableWords] = useState<{ id: string, text: string }[]>([]);
  const [placedWords, setPlacedWords] = useState<{ id: string, text: string }[]>([]);
  const [correctOrder, setCorrectOrder] = useState<string[]>([]);
  const [gameState, setGameState] = useState<'playing' | 'won'>('playing');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(!isReadOnly);

  const dataToUse = isSample ? SAMPLE_DATA : gameData;

  useEffect(() => {
    const loadState = async () => {
      const verseWords = dataToUse.verse.split(' ');
      setCorrectOrder(verseWords);

      if (isReadOnly && submission) {
        // Show completed state
        setPlacedWords(verseWords.map((w, i) => ({ id: `sol-${i}`, text: w })));
        setAvailableWords([]);
        setGameState('won');
        setShowInstructions(false);
      } else if (isSample) {
        const scrambled = [...verseWords].sort(() => Math.random() - 0.5);
        setAvailableWords(scrambled.map((w, i) => ({ id: `pool-${i}`, text: w })));
        setPlacedWords([]);
      } else if (user) {
        const savedProgress = await getGameState(user.id, gameId);

        if (savedProgress?.gameState) {
          setAvailableWords(savedProgress.gameState.availableWords || []);
          setPlacedWords(savedProgress.gameState.placedWords || []);
          setGameState(savedProgress.gameState.gameState || 'playing');
          if (savedProgress.gameState.startTime) {
            setStartTime(savedProgress.gameState.startTime);
            setShowInstructions(false);
          }
        } else {
          const scrambled = [...verseWords].sort(() => Math.random() - 0.5);
          setAvailableWords(scrambled.map((w, i) => ({ id: `pool-${i}`, text: w })));
          setPlacedWords([]);
        }
      }
    };
    loadState();
  }, [gameData, isReadOnly, submission, gameId, user, isSample]);

  useEffect(() => {
    if (isReadOnly || gameState !== 'playing' || !user || startTime === null || isSample) return;
    const stateToSave = { availableWords, placedWords, gameState, startTime };
    const handler = setTimeout(() => saveGameState(user.id, gameId, stateToSave), 1000);
    return () => clearTimeout(handler);
  }, [availableWords, placedWords, gameState, startTime, isReadOnly, user, gameId]);

  const handlePoolWordClick = (wordObj: { id: string, text: string }) => {
    if (gameState !== 'playing' || isReadOnly) return;
    setAvailableWords(prev => prev.filter(w => w.id !== wordObj.id));
    setPlacedWords(prev => [...prev, wordObj]);
  };

  const handlePlacedWordClick = (wordObj: { id: string, text: string }) => {
    if (gameState !== 'playing' || isReadOnly) return;
    setPlacedWords(prev => prev.filter(w => w.id !== wordObj.id));
    setAvailableWords(prev => [...prev, wordObj]);
  };

  // Check win condition whenever placedWords changes
  useEffect(() => {
    if (gameState !== 'playing' || isReadOnly) return;

    if (correctOrder.length > 0 && placedWords.length === correctOrder.length && availableWords.length === 0) {
      const currentSentence = placedWords.map(w => w.text).join(' ');
      const correctSentence = correctOrder.join(' ');
      if (currentSentence === correctSentence) {
        setGameState('won');
      }
    }
  }, [placedWords, availableWords, correctOrder, gameState, isReadOnly]);

  useEffect(() => {
    const saveResult = async () => {
      if (gameState === 'won' && !isReadOnly && startTime !== null && !isSample) {
        if (!user) return;
        await clearGameState(user.id, gameId);
        const timeTaken = Math.round((Date.now() - startTime) / 1000);
        await submitGame({
          userId: user.id,
          gameId,
          startedAt: new Date(startTime).toISOString(),
          timeTaken,
          mistakes: 0,
          submissionData: { completed: true }
        });
        setTimeout(onComplete, 3000);
      }
    };
    saveResult();
  }, [gameState, user, isReadOnly, gameId, onComplete, startTime]);

  const handleStartGame = () => {
    setStartTime(Date.now());
    setShowInstructions(false);
  };

  if (showInstructions) {
    return <GameInstructionsModal gameType={GameType.VERSE_SCRAMBLE} onStart={handleStartGame} onClose={handleStartGame} />;
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center p-4">
      <div className="flex items-center justify-between w-full mb-6">
        <h2 className="text-2xl font-bold text-yellow-400">Verse Scramble {isSample && <span className="text-sm bg-blue-600 text-white px-2 py-1 rounded ml-2">Sample</span>}</h2>
        <button onClick={() => setShowInstructions(true)} className="text-gray-400 hover:text-white" title="Show Instructions">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </button>
      </div>

      <p className="mb-4 text-gray-300 text-center">Tap words to move them between the solution box and the pool.</p>

      {/* Solution Box */}
      <div className="w-full min-h-[100px] bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-4 mb-8 flex flex-wrap gap-2 justify-center items-start transition-colors duration-300 ${gameState === 'won' ? 'border-green-500 bg-green-900/20' : ''}">
        {placedWords.length === 0 && (
          <span className="text-gray-500 italic mt-2">Tap words below to place them here...</span>
        )}
        {placedWords.map((word) => (
          <button
            key={word.id}
            onClick={() => handlePlacedWordClick(word)}
            disabled={gameState === 'won' || isReadOnly}
            className="px-3 py-2 rounded-lg font-semibold text-lg bg-yellow-500 text-gray-900 shadow-md hover:bg-yellow-400 transition-all animate-fade-in"
          >
            {word.text}
          </button>
        ))}
      </div>

      {/* Word Pool */}
      <div className="flex flex-wrap gap-3 justify-center mb-8 min-h-[80px]">
        {availableWords.map((word) => (
          <button
            key={word.id}
            onClick={() => handlePoolWordClick(word)}
            disabled={gameState === 'won' || isReadOnly}
            className="px-4 py-2 rounded-lg font-semibold text-lg bg-gray-700 text-gray-100 hover:bg-gray-600 shadow transition-all"
          >
            {word.text}
          </button>
        ))}
      </div>

      {gameState === 'won' && (
        <div className="text-center animate-fade-in">
          <p className="text-2xl font-bold text-green-400 mb-2">Amen!</p>
          <p className="text-xl text-gray-200 mb-6">{dataToUse.reference}</p>
          <button onClick={onComplete} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full transition-transform hover:scale-105">
            Continue
          </button>
        </div>
      )}
    </div>
  );
};

export default VerseScrambleGame;
