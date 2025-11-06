import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CrosswordData, GameSubmission, Clue } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { submitGame, getGameState, saveGameState, clearGameState } from '../../services/api';
import { DarkModeCrossword } from './DarkModeCrossword';

interface CrosswordGameProps {
  gameId: string;
  gameData: CrosswordData;
  submission?: GameSubmission | null;
  onComplete: () => void;
}

const CrosswordGame: React.FC<CrosswordGameProps> = ({ gameId, gameData, submission, onComplete }) => {
  const { user } = useAuth();
  const [userGrid, setUserGrid] = useState<(string | null)[][]>(() => 
    Array(gameData.gridSize).fill(null).map(() => Array(gameData.gridSize).fill(null))
  );
  const [isSubmitted, setIsSubmitted] = useState(!!submission);
  const [startTime, setStartTime] = useState(Date.now());
  const isReadOnly = !!submission;
  
  const solutionGrid = useMemo(() => {
    const grid: (string | null)[][] = Array(gameData.gridSize).fill(null).map(() => Array(gameData.gridSize).fill(null));
    const allClues: Clue[] = [...gameData.acrossClues, ...gameData.downClues];
    allClues.forEach(clue => {
        for (let i = 0; i < clue.answer.length; i++) {
            const r = clue.direction === 'across' ? clue.row : clue.row + i;
            const c = clue.direction === 'across' ? clue.col + i : clue.col;
            if (grid[r]) {
                grid[r][c] = clue.answer[i];
            }
        }
    });
    return grid;
  }, [gameData]);

  useEffect(() => {
    if (isReadOnly && submission) {
      setUserGrid(submission.submissionData?.grid || Array(gameData.gridSize).fill(null).map(() => Array(gameData.gridSize).fill(null)));
      return;
    }
    if (!user) return;

    const loadState = async () => {
        const savedProgress = await getGameState(user.id, gameId);
        if (savedProgress?.gameState) {
            try {
                const savedState = savedProgress.gameState;
                setUserGrid(savedState.grid || Array(gameData.gridSize).fill(null).map(() => Array(gameData.gridSize).fill(null)));
                setStartTime(savedState.startTime || Date.now());
            } catch(e) {
                console.error("Failed to parse saved Crossword state", e);
            }
        }
    };
    loadState();
  }, [gameId, isReadOnly, submission, gameData.gridSize, user]);

  useEffect(() => {
    if (isReadOnly || isSubmitted || !user) return;
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
    if (!user || isReadOnly || isSubmitted) return;

    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    
    let mistakes = 0;
    let correctCells = 0;
    let totalFillableCells = 0;

    for(let r = 0; r < gameData.gridSize; r++) {
        for (let c = 0; c < gameData.gridSize; c++) {
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
  }, [user, isReadOnly, isSubmitted, startTime, gameData.gridSize, userGrid, solutionGrid, gameId, onComplete]);
  
  const handleCellChange = useCallback((row: number, col: number, char: string | null) => {
    if (isSubmitted) return;
    setUserGrid(currentGrid => {
        const newGrid = currentGrid.map(r => [...r]);
        newGrid[row][col] = char;
        return newGrid;
    });
  }, [isSubmitted]);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
        <DarkModeCrossword
            puzzleData={gameData}
            onCellChange={isReadOnly || isSubmitted ? undefined : handleCellChange}
            onPuzzleComplete={isReadOnly ? undefined : handleSubmit}
            initialGrid={userGrid}
            isReviewMode={isReadOnly}
        />
        <div className="mt-6 w-full max-w-md">
            {!isReadOnly ? (
                <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitted}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    {isSubmitted ? "Submitted!" : "Submit Puzzle"}
                </button>
            ) : (
                <div className="text-center p-4 rounded-lg bg-gray-800 w-full">
                    {submission && (
                        <div className="text-lg text-gray-300">
                            <p>Time Taken: {submission.timeTaken}s | Mistakes: {submission.mistakes} | Score: {submission.score}</p>
                        </div>
                    )}
                    <button onClick={onComplete} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                        Back to Dashboard
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};

export default CrosswordGame;
