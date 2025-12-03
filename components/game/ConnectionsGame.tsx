import React, { useState, useEffect, useCallback } from 'react';
import { ConnectionsData, GameSubmission, GameType } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { submitGame, getGameState, saveGameState, clearGameState } from '../../services/api';
import GameInstructionsModal from './GameInstructionsModal';

interface ConnectionsGameProps {
  gameId: string;
  gameData: ConnectionsData;
  submission?: GameSubmission | null;
  onComplete: () => void;
  isPreview?: boolean;
}

const ConnectionsGame: React.FC<ConnectionsGameProps> = ({ gameId, gameData, submission, onComplete, isPreview = false }) => {
  const { user } = useAuth();
  const isSample = gameId.startsWith('sample-');
  const isReadOnly = !!submission;
  const [words, setWords] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [foundGroups, setFoundGroups] = useState<ConnectionsData['categories']>([]);
  const [mistakes, setMistakes] = useState(0);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(!isReadOnly && !isPreview);

  // Animation and feedback states
  const [isShaking, setIsShaking] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const generateShuffledWords = useCallback((): string[] => {
    const sampleData: ConnectionsData = {
      words: ['APPLE', 'BANANA', 'CHERRY', 'DATE', 'RED', 'BLUE', 'GREEN', 'YELLOW', 'DOG', 'CAT', 'BIRD', 'FISH', 'ONE', 'TWO', 'THREE', 'FOUR'],
      categories: [
        { name: 'FRUITS', words: ['APPLE', 'BANANA', 'CHERRY', 'DATE'] },
        { name: 'COLORS', words: ['RED', 'BLUE', 'GREEN', 'YELLOW'] },
        { name: 'ANIMALS', words: ['DOG', 'CAT', 'BIRD', 'FISH'] },
        { name: 'NUMBERS', words: ['ONE', 'TWO', 'THREE', 'FOUR'] }
      ]
    };
    const dataToUse = isSample ? sampleData : gameData;
    const original = [...dataToUse.words];
    const categories = dataToUse.categories.map(c => new Set(c.words));
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Fisher-Yates shuffle
      const arr = [...original];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      // Check no full category is contiguous in the shuffled order
      let hasContiguousCategory = false;
      for (let i = 0; i <= arr.length - 4 && !hasContiguousCategory; i++) {
        const sliceSet = new Set(arr.slice(i, i + 4));
        if (categories.some(cat => cat.size === sliceSet.size && [...cat].every(w => sliceSet.has(w)))) {
          hasContiguousCategory = true;
        }
      }
      if (!hasContiguousCategory) return arr;
    }
    return original.sort(() => Math.random() - 0.5); // fallback
  }, [gameData.words, gameData.categories, isSample]);

  useEffect(() => {
    const loadState = async () => {
      if (isReadOnly && submission) {
        setFoundGroups(gameData.categories);
        setWords([]);
        setMistakes(submission.mistakes);
        setGameState(submission.mistakes >= 4 ? 'lost' : 'won');
        setShowInstructions(false);
      } else if (isSample || isPreview) {
        setWords(generateShuffledWords());
      } else if (user) {
        const savedProgress = await getGameState(user.id, gameId);
        if (savedProgress?.gameState) {
          try {
            const savedState = savedProgress.gameState;
            if (savedState.words && savedState.words.length > 0) {
              setWords(savedState.words);
            } else {
              setWords(generateShuffledWords());
            }
            setFoundGroups(savedState.foundGroups || []);
            setMistakes(savedState.mistakes || 0);
            setGameState(savedState.gameState || 'playing');
            if (savedState.startTime) {
              setStartTime(savedState.startTime);
              setShowInstructions(false);
            }
          } catch (e) {
            console.error("Failed to parse saved Connections state", e);
            setWords(generateShuffledWords());
          }
        } else {
          setWords(generateShuffledWords());
        }
      }
    };
    loadState();
  }, [gameData, isReadOnly, submission, gameId, user, generateShuffledWords, isSample, isPreview]);

  useEffect(() => {
    if (isReadOnly || gameState !== 'playing' || !user || !words.length || startTime === null || isSample || isPreview) return;
    const stateToSave = {
      words,
      foundGroups,
      mistakes,
      gameState,
      startTime,
    };

    const handler = setTimeout(() => {
      saveGameState(user.id, gameId, stateToSave);
    }, 1000);

    return () => clearTimeout(handler);
  }, [words, foundGroups, mistakes, gameState, startTime, isReadOnly, user, gameId, isPreview]);

  const handleWordClick = (word: string) => {
    if (gameState !== 'playing' || isReadOnly || showInstructions || isShaking || foundGroups.flatMap(g => g.words).includes(word)) return;

    if (selected.includes(word)) {
      setSelected(prev => prev.filter(w => w !== word));
    } else if (selected.length < 4) {
      setSelected(prev => [...prev, word]);
    }
  };

  const handleSubmit = () => {
    if (selected.length !== 4) return;

    const sampleData: ConnectionsData = {
      words: ['APPLE', 'BANANA', 'CHERRY', 'DATE', 'RED', 'BLUE', 'GREEN', 'YELLOW', 'DOG', 'CAT', 'BIRD', 'FISH', 'ONE', 'TWO', 'THREE', 'FOUR'],
      categories: [
        { name: 'FRUITS', words: ['APPLE', 'BANANA', 'CHERRY', 'DATE'] },
        { name: 'COLORS', words: ['RED', 'BLUE', 'GREEN', 'YELLOW'] },
        { name: 'ANIMALS', words: ['DOG', 'CAT', 'BIRD', 'FISH'] },
        { name: 'NUMBERS', words: ['ONE', 'TWO', 'THREE', 'FOUR'] }
      ]
    };
    const dataToUse = isSample ? sampleData : gameData;

    const correctGroup = dataToUse.categories.find(category =>
      category.words.every(word => selected.includes(word)) &&
      selected.every(word => category.words.includes(word))
    );

    if (correctGroup) {
      setFoundGroups(prev => [...prev, correctGroup]);
      setWords(prev => prev.filter(w => !selected.includes(w)));
      setSelected([]);
      if (foundGroups.length === 3) {
        setGameState('won');
      }
    } else {
      // Check for "One away"
      const isOneAway = dataToUse.categories.some(category => {
        // Only check against categories that haven't been found yet
        if (foundGroups.some(found => found.name === category.name)) return false;

        // Count how many of the selected words are in this category
        const matchCount = selected.filter(word => category.words.includes(word)).length;
        return matchCount === 3;
      });

      if (isOneAway) {
        setFeedbackMessage("One away!");
        // Clear message after 2 seconds
        setTimeout(() => setFeedbackMessage(null), 2000);
      }

      // Trigger shake animation
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);

      setMistakes(prev => prev + 1);
      if (mistakes + 1 >= 4) {
        setGameState('lost');
      }
    }
  };

  useEffect(() => {
    const saveResult = async () => {
      if ((gameState === 'won' || gameState === 'lost') && !isReadOnly && startTime !== null && !isSample && !isPreview) {
        if (!user) return;
        await clearGameState(user.id, gameId);
        const timeTaken = Math.round((Date.now() - startTime) / 1000);
        await submitGame({
          userId: user.id,
          gameId,
          startedAt: new Date(startTime).toISOString(),
          timeTaken,
          mistakes,
          submissionData: {
            foundGroups: foundGroups.map(g => g.name),
            categoriesFound: foundGroups.length,
            assignedCategories: gameData.categories.map(c => c.name)
          }
        });
        setTimeout(onComplete, 3000);
      }
    }
    saveResult();
  }, [gameState, user, isReadOnly, gameId, mistakes, onComplete, startTime, foundGroups, isSample, isPreview]);

  const handleStartGame = () => {
    setStartTime(Date.now());
    setShowInstructions(false);
  };

  const handleShuffle = () => {
    if (isReadOnly || gameState !== 'playing') return;
    // Only shuffle remaining words; keep found groups intact
    setSelected([]);
    setWords(prev => generateShuffledWords().filter(w => prev.includes(w) || !foundGroups.flatMap(g => g.words).includes(w)));
  };

  // Define colors for groups based on index to make them visually distinct
  const GROUP_COLORS = [
    'bg-green-700',
    'bg-yellow-600',
    'bg-blue-700',
    'bg-purple-700'
  ];

  if (showInstructions) {
    return <GameInstructionsModal gameType={GameType.CONNECTIONS} onStart={handleStartGame} onClose={handleStartGame} />;
  }

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center relative">

      {/* Feedback Message (One Away) */}
      {feedbackMessage && (
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-zinc-900 text-white px-6 py-3 rounded-md font-bold animate-fade-in z-50 shadow-2xl border border-zinc-700 pointer-events-none">
          {feedbackMessage}
        </div>
      )}

      <div className="flex items-center justify-between w-full mb-2">
        <h2 className="text-2xl font-bold">
          Connections
          {isSample && <span className="text-sm bg-blue-600 px-2 py-1 rounded ml-2">Sample</span>}
          {isPreview && <span className="text-sm bg-purple-600 px-2 py-1 rounded ml-2">Preview</span>}
        </h2>
        <button onClick={() => setShowInstructions(true)} className="text-gray-400 hover:text-white" title="Show Instructions">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </button>
      </div>
      <p className="mb-4 text-gray-400">Create four groups of four!</p>

      <div className="w-full space-y-2 mb-4 min-h-[20px]">
        {foundGroups.map((group, index) => (
          <div
            key={group.name}
            className={`${GROUP_COLORS[index % GROUP_COLORS.length]} p-4 rounded-lg text-center animate-bounce-in`}
          >
            <p className="font-bold text-white">{group.name}</p>
            <p className="text-white/90 text-sm">{group.words.join(', ')}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 w-full mb-4">
        {words.map(word => {
          const isSelected = selected.includes(word);
          return (
            <button
              key={word}
              onClick={() => handleWordClick(word)}
              className={`
                        h-20 rounded-md font-semibold text-sm sm:text-base text-center transition-all duration-200
                        ${isSelected ? 'bg-zinc-600 text-white scale-95' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'}
                        ${isSelected && isShaking ? 'animate-shake bg-red-900/50' : ''}
                    `}
            >
              {word}
            </button>
          );
        })}
      </div>

      {!isReadOnly && gameState === 'playing' && (
        <div className="flex flex-col items-center w-full">
          <div className="flex items-center space-x-4 mb-4">
            <span className="text-gray-300">Mistakes remaining:</span>
            <div className="flex space-x-2">
              {Array.from(Array(4 - mistakes)).map((_, i) => (
                <div key={`remaining-${i}`} className="w-4 h-4 bg-zinc-500 rounded-full transition-all"></div>
              ))}
              {Array.from(Array(mistakes)).map((_, i) => (
                <div key={`mistake-${i}`} className="w-4 h-4 bg-red-900/50 rounded-full animate-pulse"></div>
              ))}
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={() => setSelected([])}
              disabled={selected.length === 0 || isShaking}
              className="border border-zinc-600 text-zinc-300 hover:bg-zinc-800 font-bold py-2 px-6 rounded-full disabled:opacity-50 transition-colors"
            >
              Deselect All
            </button>
            <button
              onClick={handleSubmit}
              disabled={selected.length !== 4 || isShaking}
              className="bg-white hover:bg-gray-200 text-black font-bold py-2 px-6 rounded-full disabled:bg-zinc-600 disabled:text-zinc-400 transition-colors"
            >
              Submit
            </button>
            <button
              onClick={handleShuffle}
              disabled={isShaking}
              className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-6 rounded-full transition-colors"
            >
              Shuffle
            </button>
          </div>
        </div>
      )}

      {(gameState !== 'playing' || isReadOnly) && (
        <div className="mt-4 text-center p-6 rounded-xl bg-zinc-800 w-full animate-fade-in border border-zinc-700">
          {gameState === 'won' && <p className="text-2xl text-green-400 font-bold mb-2">Perfect!</p>}
          {gameState === 'lost' && <p className="text-xl text-red-400 font-bold mb-2">Next time!</p>}
          {isReadOnly && submission && (
            <div className="mt-2 text-sm text-zinc-400">
              <p>Time: {submission.timeTaken}s | Score: {submission.score}</p>
            </div>
          )}
          <button onClick={onComplete} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full transition-transform hover:scale-105">
            Continue
          </button>
        </div>
      )}
    </div>
  );
};

export default ConnectionsGame;