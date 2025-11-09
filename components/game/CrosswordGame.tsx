import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CrosswordData, GameSubmission, Clue, GameType } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { submitGame, getGameState, saveGameState, clearGameState } from '../../services/api';
import { DarkModeCrossword } from './DarkModeCrossword';
import GameInstructionsModal from './GameInstructionsModal';

interface CrosswordGameProps {
  gameId: string;
  gameData: CrosswordData;
  submission?: GameSubmission | null;
  onComplete: () => void;
}

const CrosswordGame: React.FC<CrosswordGameProps> = ({ gameId, gameData, submission, onComplete }) => {
  const { user } = useAuth();
  const isReadOnly = !!submission;
  const [userGrid, setUserGrid] = useState<(string | null)[][]>(() => 
    Array(gameData.rows).fill(null).map(() => Array(gameData.cols).fill(null))
  );
  const [isSubmitted, setIsSubmitted] = useState(!!submission);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(!isReadOnly);
  
  const solutionGrid = useMemo(() => {
    const grid: (string | null)[][] = Array(gameData.rows).fill(null).map(() => Array(gameData.cols).fill(null));
    const allClues: Clue[] = [...gameData.acrossClues, ...gameData.downClues];
    allClues.forEach(clue => {
        for (let i = 0; i < clue.answer.length; i++) {
            const r = clue.direction === 'across' ? clue.row : clue.row + i;
            const c = clue.direction === 'across' ? clue.col + i : clue.col;
            if (grid[r] && c < gameData.cols) {
                grid[r][c] = clue.answer[i];
            }
        }
    });
    return grid;
  }, [gameData]);

  useEffect(() => {
    if (isReadOnly && submission) {
      // When reviewing, show the perfect SOLUTION grid, not just what they submitted
      setUserGrid(solutionGrid);
      setIsSubmitted(true);
      setShowInstructions(false);
      return;
    }
    if (!user) return;

    const loadState = async () => {
        const savedProgress = await getGameState(user.id, gameId);
        if (savedProgress?.gameState) {
            try {
                const savedState = savedProgress.gameState;
                if (savedState.grid) {
                    setUserGrid(savedState.grid);
                }
                if (savedState.startTime) {
                    setStartTime(savedState.startTime);
                    setShowInstructions(false);
                }
            } catch(e) {
                console.error("Failed to parse saved Crossword state", e);
            }
        }
    };
    loadState();
  }, [gameId, isReadOnly, submission, gameData.rows, gameData.cols, user, solutionGrid]);

  useEffect(() => {
    if (isReadOnly || isSubmitted || !user || startTime === null) return;
    const stateToSave = {
      grid: userGrid,
      startTime,
    };
    
    const handler = setTimeout(() => {
        saveGameState(user.id, gameId, stateToSave);
    }, 1000);

    return () => clearTimeout(handler);
  }, [userGrid, startTime, isReadOnly, isSubmitted, user, gameId]);

  const handleSubmit = useCallback(async () => {
    if (!user || isReadOnly || isSubmitted || startTime === null) return;

    const isGridEmpty = userGrid.every(row => row.every(cell => !cell));
    if (isGridEmpty && !window.confirm("Your crossword is empty. Are you sure you want to submit?")) {
        return;
    }

    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    
    let mistakes = 0;
    let correctCells = 0;
    let totalFillableCells = 0;

    for(let r = 0; r < gameData.rows; r++) {
        for (let c = 0; c < gameData.cols; c++) {
            if (solutionGrid[r][c] !== null) { // This is a fillable cell
                totalFillableCells++;
                if (userGrid[r][c] === solutionGrid[r][c]) {
                    correctCells++;
                } else if (userGrid[r][c] !== null) {
                    mistakes++;
                }
            }
        }
    }

    await submitGame({
      userId: user.id,
      gameId,
      startedAt: new Date(startTime).toISOString(),
      timeTaken,
      mistakes,
      submissionData: { 
        grid: userGrid,
        correctCells,
        totalFillableCells
      },
    });
    
    setIsSubmitted(true);
    await clearGameState(user.id, gameId);
    setTimeout(onComplete, 3000);
  }, [user, isReadOnly, isSubmitted, startTime, gameData.rows, gameData.cols, userGrid, solutionGrid, gameId, onComplete]);
  
  const handleCellChange = useCallback((row: number, col: number, char: string | null) => {
    if (isSubmitted) return;
    setUserGrid(currentGrid => {
        const newGrid = currentGrid.map(r => [...r]);
        newGrid[row][col] = char;
        return newGrid;
    });
  }, [isSubmitted]);

  const handleInstructionsClose = () => {
    if (startTime === null && !isReadOnly) {
        setStartTime(Date.now());
    }
    setShowInstructions(false);
  };

  if (showInstructions) {
      return <GameInstructionsModal gameType={GameType.CROSSWORD} onStart={handleInstructionsClose} onClose={handleInstructionsClose} />;
  }

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center pb-8">
        <div className="flex items-center justify-between w-full max-w-md mb-4">
             <h2 className="text-2xl font-bold text-yellow-400">Crossword</h2>
             <div className="flex space-x-2">
                 {!isReadOnly && !isSubmitted && (
                     <button 
                        onClick={handleSubmit} 
                        className="md:hidden bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-lg text-sm transition-colors"
                     >
                         Submit
                     </button>
                 )}
                <button onClick={() => setShowInstructions(true)} className="text-gray-400 hover:text-white p-1" title="Show Instructions">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </button>
             </div>
        </div>

        <DarkModeCrossword
            puzzleData={gameData}
            onCellChange={isReadOnly || isSubmitted ? undefined : handleCellChange}
            onPuzzleComplete={isReadOnly ? undefined : handleSubmit}
            initialGrid={userGrid}
            isReviewMode={isReadOnly}
        />
        
        <div className="mt-6 w-full max-w-md flex flex-col items-center">
            {!isReadOnly ? (
                <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitted}
                    className="hidden md:block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg disabled:bg-gray-600 disabled:cursor-not-allowed transition-transform hover:scale-105"
                >
                    {isSubmitted ? "Submitted!" : "Submit Puzzle"}
                </button>
            ) : (
                <div className="text-center p-4 rounded-lg bg-gray-800 w-full animate-fade-in border border-gray-700">
                    {submission && (
                        <div className="text-lg text-gray-300 space-y-1">
                            <p><span className="text-gray-500">Score:</span> <span className="font-bold text-yellow-400">{submission.score}</span></p>
                            <p className="text-sm"><span className="text-gray-500">Time:</span> {submission.timeTaken}s <span className="mx-2">|</span> <span className="text-gray-500">Mistakes:</span> {submission.mistakes}</p>
                        </div>
                    )}
                    <button onClick={onComplete} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-full transition-transform hover:scale-105">
                        Back to Dashboard
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};

export default CrosswordGame;