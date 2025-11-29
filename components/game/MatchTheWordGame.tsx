import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MatchTheWordData, GameSubmission, GameType } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { submitGame, getGameState, saveGameState, clearGameState } from '../../services/api';
import GameInstructionsModal from './GameInstructionsModal';

interface MatchTheWordGameProps {
  gameId: string;
  gameData: MatchTheWordData;
  submission?: GameSubmission | null;
  onComplete: () => void;
}

const COLORS = ['#4ade80', '#60a5fa', '#f87171', '#fbbf24', '#a78bfa', '#f472b6'];

const SAMPLE_DATA: MatchTheWordData = {
  pairs: [
    { word: 'David', match: 'Shepherd King' },
    { word: 'Moses', match: 'Lawgiver' },
    { word: 'Abraham', match: 'Father of Nations' },
    { word: 'Paul', match: 'Apostle to the Gentiles' },
    { word: 'Esther', match: 'Queen of Persia' }
  ]
};

const MatchTheWordGame: React.FC<MatchTheWordGameProps> = ({ gameId, gameData, submission, onComplete }) => {
  const { user } = useAuth();
  const isSample = gameId.startsWith('sample-');
  const isReadOnly = !!submission;
  const maxMistakes = 5;

  const [words, setWords] = useState<string[]>([]);
  const [matches, setMatches] = useState<string[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [foundPairs, setFoundPairs] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(!isReadOnly);

  const [pairColors, setPairColors] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<{ from: string; to: string; color: string }[]>([]);
  const [lineCoords, setLineCoords] = useState<{ x1: number; y1: number; x2: number; y2: number; color: string }[]>([]);

  const wordRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const matchRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const shuffledWords = useMemo(() => {
    const dataToUse = isSample ? SAMPLE_DATA : gameData;
    const allWords = dataToUse.pairs.map(p => p.word);
    return allWords.sort(() => Math.random() - 0.5);
  }, [gameData.pairs, isSample]);

  const shuffledMatches = useMemo(() => {
    const dataToUse = isSample ? SAMPLE_DATA : gameData;
    const allMatches = dataToUse.pairs.map(p => p.match);
    return allMatches.sort(() => Math.random() - 0.5);
  }, [gameData.pairs, isSample]);

  useEffect(() => {
    const loadState = async () => {
      if (isReadOnly && submission) {
        const pairs = gameData.pairs.map(p => p.word);
        setFoundPairs(pairs);
        const loadedLines = gameData.pairs.map((p, i) => ({ from: p.word, to: p.match, color: COLORS[i % COLORS.length] }));
        const loadedColors = gameData.pairs.reduce((acc, p, i) => ({ ...acc, [p.word]: COLORS[i % COLORS.length] }), {});
        setLines(loadedLines);
        setPairColors(loadedColors);
        setWords([]);
        setMatches([]);
        setMistakes(submission.mistakes);
        setGameState(submission.mistakes >= maxMistakes ? 'lost' : 'won');
        setShowInstructions(false);
      } else if (isSample) {
        setWords(shuffledWords);
        setMatches(shuffledMatches);
      } else if (user) {
        const savedProgress = await getGameState(user.id, gameId);
        if (savedProgress?.gameState) {
          const savedState = savedProgress.gameState;
          setWords(savedState.words || shuffledWords);
          setMatches(savedState.matches || shuffledMatches);
          const savedFoundPairs = savedState.foundPairs || [];
          setFoundPairs(savedFoundPairs);
          setMistakes(savedState.mistakes || 0);
          setGameState(savedState.gameState || 'playing');

          const loadedLines = savedFoundPairs.map((word, i) => {
            const pair = gameData.pairs.find(p => p.word === word);
            return { from: word, to: pair!.match, color: COLORS[i % COLORS.length] };
          });
          const loadedColors = savedFoundPairs.reduce((acc, word, i) => ({ ...acc, [word]: COLORS[i % COLORS.length] }), {});
          setLines(loadedLines);
          setPairColors(loadedColors);

          if (savedState.startTime) {
            setStartTime(savedState.startTime);
            setShowInstructions(false);
          }
        } else {
          setWords(shuffledWords);
          setMatches(shuffledMatches);
        }
      }
    };
    loadState();
  }, [gameData, isReadOnly, submission, gameId, user, shuffledWords, shuffledMatches]);

  useEffect(() => {
    if (isReadOnly || gameState !== 'playing' || !user || startTime === null || isSample) return;
    const stateToSave = { words, matches, foundPairs, mistakes, gameState, startTime };
    const handler = setTimeout(() => saveGameState(user.id, gameId, stateToSave), 1000);
    return () => clearTimeout(handler);
  }, [words, matches, foundPairs, mistakes, gameState, startTime, isReadOnly, user, gameId]);

  const handleWordClick = (word: string) => {
    if (gameState !== 'playing' || isReadOnly || showInstructions || foundPairs.includes(word)) return;
    setSelectedWord(word);
  };

  const handleMatchClick = (match: string) => {
    if (gameState !== 'playing' || isReadOnly || showInstructions) return;
    const dataToUse = isSample ? SAMPLE_DATA : gameData;
    const isAlreadyMatched = dataToUse.pairs.some(p => foundPairs.includes(p.word) && p.match === match);
    if (isAlreadyMatched) return;
    setSelectedMatch(match);
  };

  useEffect(() => {
    if (selectedWord && selectedMatch) {
      const dataToUse = isSample ? SAMPLE_DATA : gameData;
      const correctPair = dataToUse.pairs.find(p => p.word === selectedWord && p.match === selectedMatch);
      if (correctPair) {
        const newFoundPairs = [...foundPairs, selectedWord];
        setFoundPairs(newFoundPairs);
        const color = COLORS[(newFoundPairs.length - 1) % COLORS.length];
        setPairColors(prev => ({ ...prev, [selectedWord]: color }));
        if (selectedMatch) {
          setLines(prev => [...prev, { from: selectedWord, to: selectedMatch, color }]);
        }

        if (newFoundPairs.length === dataToUse.pairs.length) {
          setGameState('won');
        }
      } else {
        setMistakes(prev => prev + 1);
        if (mistakes + 1 >= maxMistakes) {
          setGameState('lost');
        }
      }
      setSelectedWord(null);
      setSelectedMatch(null);
    }
  }, [selectedWord, selectedMatch, gameData.pairs, foundPairs, mistakes, isSample]);

  useEffect(() => {
    const calculateCoords = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();

      const coords = lines.map(({ from, to, color }) => {
        const fromEl = wordRefs.current[from];
        const toEl = matchRefs.current[to];

        if (fromEl && toEl) {
          const fromRect = fromEl.getBoundingClientRect();
          const toRect = toEl.getBoundingClientRect();

          return {
            x1: fromRect.right - containerRect.left,
            y1: fromRect.top + fromRect.height / 2 - containerRect.top,
            x2: toRect.left - containerRect.left,
            y2: toRect.top + toRect.height / 2 - containerRect.top,
            color,
          };
        }
        return null;
      }).filter((c): c is { x1: number; y1: number; x2: number; y2: number; color: string } => c !== null);

      setLineCoords(coords);
    };

    calculateCoords();

    const resizeObserver = new ResizeObserver(calculateCoords);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [lines]);

  useEffect(() => {
    const saveResult = async () => {
      if ((gameState === 'won' || gameState === 'lost') && !isReadOnly && startTime !== null && !isSample) {
        if (!user) return;
        await clearGameState(user.id, gameId);
        const timeTaken = Math.round((Date.now() - startTime) / 1000);
        await submitGame({
          userId: user.id,
          gameId,
          startedAt: new Date(startTime).toISOString(),
          timeTaken,
          mistakes,
          submissionData: { foundPairsCount: foundPairs.length }
        });
        setTimeout(onComplete, 3000);
      }
    };
    saveResult();
  }, [gameState, user, isReadOnly, gameId, mistakes, onComplete, startTime, foundPairs.length]);

  const handleStartGame = () => {
    setStartTime(Date.now());
    setShowInstructions(false);
  };

  if (showInstructions) {
    return <GameInstructionsModal gameType={GameType.MATCH_THE_WORD} onStart={handleStartGame} onClose={handleStartGame} />;
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
      <div className="flex items-center justify-between w-full mb-2">
        <h2 className="text-2xl font-bold">Match the Word {isSample && <span className="text-sm bg-blue-600 px-2 py-1 rounded ml-2">Sample</span>}</h2>
        <button onClick={() => setShowInstructions(true)} className="text-gray-400 hover:text-white" title="Show Instructions">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </button>
      </div>
      <p className="mb-4 text-gray-400">Match the words with their correct pairs.</p>

      <div ref={containerRef} className="relative grid grid-cols-2 gap-8 w-full mb-4">
        <div className="flex flex-col space-y-2">
          {words.map(word => {
            const isFound = foundPairs.includes(word);
            return (
              <button
                ref={el => (wordRefs.current[word] = el)}
                key={word}
                onClick={() => handleWordClick(word)}
                disabled={isFound || isReadOnly}
                className={`p-4 rounded-md font-semibold text-center transition-all duration-200 ${isFound
                  ? 'text-white'
                  : selectedWord === word
                    ? 'bg-blue-600 text-white scale-105'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                  }`}
                style={{ backgroundColor: isFound ? pairColors[word] : undefined }}
              >
                {word}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col space-y-2">
          {matches.map(match => {
            const dataToUse = isSample ? SAMPLE_DATA : gameData;
            const pair = dataToUse.pairs.find(p => p.match === match);
            const isFound = pair ? foundPairs.includes(pair.word) : false;
            return (
              <button
                ref={el => (matchRefs.current[match] = el)}
                key={match}
                onClick={() => handleMatchClick(match)}
                disabled={isFound || isReadOnly}
                className={`p-4 rounded-md font-semibold text-center transition-all duration-200 ${isFound
                  ? 'text-white'
                  : selectedMatch === match
                    ? 'bg-blue-600 text-white scale-105'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                  }`}
                style={{ backgroundColor: isFound && pair && pairColors[pair.word] ? pairColors[pair.word] : undefined }}
              >
                {match}
              </button>
            );
          })}
        </div>
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
          {lineCoords.map((coords, i) => (
            <line key={i} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2} stroke={coords.color} strokeWidth="3" />
          ))}
        </svg>
      </div>

      {!isReadOnly && gameState === 'playing' && (
        <div className="flex flex-col items-center w-full">
          <div className="flex items-center space-x-4 mb-4">
            <span className="text-gray-300">Mistakes remaining:</span>
            <div className="flex space-x-2">
              {Array.from(Array(maxMistakes - mistakes)).map((_, i) => (
                <div key={`remaining-${i}`} className="w-4 h-4 bg-zinc-500 rounded-full"></div>
              ))}
              {Array.from(Array(mistakes)).map((_, i) => (
                <div key={`mistake-${i}`} className="w-4 h-4 bg-red-900/50 rounded-full animate-pulse"></div>
              ))}
            </div>
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

export default MatchTheWordGame;
