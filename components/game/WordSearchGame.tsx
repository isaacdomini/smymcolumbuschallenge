import React, { useState, useEffect, useRef } from 'react';
import { WordSearchData, GameSubmission, GameType } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { submitGame, getGameState, saveGameState, clearGameState } from '../../services/api';
import GameInstructionsModal from './GameInstructionsModal';

interface WordSearchGameProps {
  gameId: string;
  gameData: WordSearchData;
  submission?: GameSubmission | null;
  onComplete: () => void;
}

const SAMPLE_DATA: WordSearchData = {
  grid: [
    ['J', 'E', 'S', 'U', 'S', 'X', 'Y', 'Z'],
    ['O', 'A', 'B', 'C', 'D', 'E', 'F', 'G'],
    ['H', 'H', 'I', 'J', 'K', 'L', 'M', 'N'],
    ['N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'],
    ['V', 'W', 'X', 'Y', 'Z', 'A', 'B', 'C'],
    ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'],
    ['L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'],
    ['T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'A']
  ],
  words: ['JESUS', 'JOHN']
};

const WordSearchGame: React.FC<WordSearchGameProps> = ({ gameId, gameData, submission, onComplete }) => {
  const { user } = useAuth();
  const isSample = gameId.startsWith('sample-');
  const isReadOnly = !!submission;

  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [foundCells, setFoundCells] = useState<{ r: number, c: number }[]>([]);
  const [selectedCells, setSelectedCells] = useState<{ r: number, c: number }[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ r: number, c: number } | null>(null);

  const [gameState, setGameState] = useState<'playing' | 'won'>('playing');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(!isReadOnly);

  const dataToUse = isSample ? SAMPLE_DATA : gameData;
  const grid = dataToUse.grid;

  useEffect(() => {
    const loadState = async () => {
      if (isReadOnly && submission) {
        setFoundWords(dataToUse.words);
        setFoundCells(submission.submissionData?.foundCells || []);
        setGameState('won');
        setShowInstructions(false);
      } else if (isSample) {
        setFoundWords([]);
        setFoundCells([]);
        setGameState('playing');
      } else if (user) {
        const savedProgress = await getGameState(user.id, gameId);
        if (savedProgress?.gameState) {
          setFoundWords(savedProgress.gameState.foundWords || []);
          setFoundCells(savedProgress.gameState.foundCells || []);
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
    const stateToSave = { foundWords, foundCells, gameState, startTime };
    const handler = setTimeout(() => saveGameState(user.id, gameId, stateToSave), 1000);
    return () => clearTimeout(handler);
  }, [foundWords, foundCells, gameState, startTime, isReadOnly, user, gameId]);

  const getWordFromSelection = (start: { r: number, c: number }, end: { r: number, c: number }) => {
    const dr = end.r - start.r;
    const dc = end.c - start.c;
    const steps = Math.max(Math.abs(dr), Math.abs(dc));

    if (steps === 0) return { word: grid[start.r][start.c], cells: [{ r: start.r, c: start.c }] };

    // Check if diagonal, horizontal, or vertical
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null; // Invalid angle

    const rStep = dr === 0 ? 0 : dr / steps;
    const cStep = dc === 0 ? 0 : dc / steps;

    let word = '';
    const cells = [];
    for (let i = 0; i <= steps; i++) {
      const r = start.r + i * rStep;
      const c = start.c + i * cStep;
      word += grid[r][c];
      cells.push({ r, c });
    }
    return { word, cells };
  };

  const handleCellDown = (r: number, c: number) => {
    if (gameState !== 'playing' || isReadOnly) return;
    setIsSelecting(true);
    setSelectionStart({ r, c });
    setSelectedCells([{ r, c }]);
  };

  const handleCellEnter = (r: number, c: number) => {
    if (!isSelecting || !selectionStart) return;
    const result = getWordFromSelection(selectionStart, { r, c });
    if (result) {
      setSelectedCells(result.cells);
    }
  };

  const handleCellUp = () => {
    if (!isSelecting || !selectionStart) return;
    setIsSelecting(false);

    // Check word
    if (selectedCells.length > 0) {
      const lastCell = selectedCells[selectedCells.length - 1];
      const result = getWordFromSelection(selectionStart, lastCell);

      if (result) {
        const word = result.word;
        // Check forward and backward
        const reversed = word.split('').reverse().join('');

        if (dataToUse.words.includes(word) && !foundWords.includes(word)) {
          const newFound = [...foundWords, word];
          setFoundWords(newFound);
          setFoundCells(prev => [...prev, ...result.cells]);
          if (newFound.length === dataToUse.words.length) {
            setGameState('won');
          }
        } else if (dataToUse.words.includes(reversed) && !foundWords.includes(reversed)) {
          const newFound = [...foundWords, reversed];
          setFoundWords(newFound);
          setFoundCells(prev => [...prev, ...result.cells]);
          if (newFound.length === dataToUse.words.length) {
            setGameState('won');
          }
        }
      }
    }
    setSelectedCells([]);
    setSelectionStart(null);
  };

  // Global mouse up to catch releases outside grid
  useEffect(() => {
    const handleGlobalUp = () => {
      if (isSelecting) handleCellUp();
    }
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
    }
  }, [isSelecting, selectionStart, selectedCells]);


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
          submissionData: {
            foundWordsCount: foundWords.length,
            foundWords,
            foundCells,
            grid: dataToUse.grid,
            words: dataToUse.words
          }
        });
        setTimeout(onComplete, 3000);
      }
    };
    saveResult();
  }, [gameState, user, isReadOnly, gameId, onComplete, startTime, foundWords.length, foundCells]);

  const handleStartGame = () => {
    setStartTime(Date.now());
    setShowInstructions(false);
  };

  if (showInstructions) {
    return <GameInstructionsModal gameType={GameType.WORD_SEARCH} onStart={handleStartGame} onClose={handleStartGame} />;
  }

  // Helper to check if a cell is part of a found word
  // This is tricky without storing cell coordinates for found words. 
  // For simplicity in this iteration, we won't highlight found words on the grid permanently, 
  // or we'd need to calculate their positions again or store them.
  // Let's just cross them off the list.
  // Ideally we should store the cells of found words.
  // Let's improve this: we need to find where the words are to highlight them.
  // But since we don't store coordinates in data, we'd have to search the grid again.
  // For now, let's just highlight the current selection.

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSelecting || !selectionStart) return;

    // Prevent scrolling while selecting
    e.preventDefault();

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    if (element) {
      // Check if the element is a grid cell (or inside one)
      // We can use data attributes to identify cells
      const cell = element.closest('[data-grid-cell]');
      if (cell) {
        const r = parseInt(cell.getAttribute('data-r') || '-1');
        const c = parseInt(cell.getAttribute('data-c') || '-1');

        if (r !== -1 && c !== -1) {
          handleCellEnter(r, c);
        }
      }
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center p-4 select-none">
      <div className="flex items-center justify-between w-full mb-6">
        <h2 className="text-2xl font-bold text-yellow-400">Word Search {isSample && <span className="text-sm bg-blue-600 text-white px-2 py-1 rounded ml-2">Sample</span>}</h2>
        <button onClick={() => setShowInstructions(true)} className="text-gray-400 hover:text-white" title="Show Instructions">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Grid */}
        <div
          className="bg-gray-800 p-2 rounded-lg shadow-xl touch-none"
          onMouseLeave={handleCellUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleCellUp}
        >
          {grid.map((row, r) => (
            <div key={r} className="flex">
              {row.map((char, c) => {
                const isSelected = selectedCells.some(cell => cell.r === r && cell.c === c);
                const isFound = foundCells.some(cell => cell.r === r && cell.c === c);
                return (
                  <div
                    key={`${r}-${c}`}
                    data-grid-cell="true"
                    data-r={r}
                    data-c={c}
                    onMouseDown={() => handleCellDown(r, c)}
                    onMouseEnter={() => handleCellEnter(r, c)}
                    onMouseUp={handleCellUp}
                    onTouchStart={(e) => {
                      handleCellDown(r, c);
                    }}
                    // Touch move is harder to handle with individual elements, usually requires global handler
                    className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center font-bold text-lg cursor-pointer transition-colors select-none ${isSelected || isFound ? 'bg-yellow-500 text-gray-900' : 'text-gray-300 hover:bg-gray-700'
                      }`}
                  >
                    {char}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Word List */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg min-w-[200px]">
          <h3 className="text-xl font-bold text-gray-200 mb-4 border-b border-gray-700 pb-2">Words to Find</h3>
          <ul className="space-y-2">
            {dataToUse.words.map(word => (
              <li key={word} className={`text-lg transition-all ${foundWords.includes(word) ? 'text-green-500 line-through opacity-50' : 'text-gray-300'}`}>
                {word}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {gameState === 'won' && (
        <div className="mt-8 text-center animate-fade-in">
          <p className="text-2xl text-green-400 font-bold mb-4">Puzzle Complete!</p>
          <button onClick={onComplete} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full transition-transform hover:scale-105">
            Continue
          </button>
        </div>
      )}
    </div>
  );
};

export default WordSearchGame;
