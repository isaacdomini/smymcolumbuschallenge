import React, { useState, useEffect } from 'react';
import { CrosswordData, GameSubmission } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { submitGame } from '../../services/api';

interface CrosswordGameProps {
  gameId: string;
  gameData: CrosswordData;
  submission?: GameSubmission | null;
  onComplete: () => void;
}

const CrosswordGame: React.FC<CrosswordGameProps> = ({ gameId, gameData, submission, onComplete }) => {
  const { user } = useAuth();
  const [grid, setGrid] = useState<(string | null)[][]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [startTime] = useState(Date.now());
  const isReadOnly = !!submission;

  useEffect(() => {
    if (isReadOnly && submission) {
      setGrid(submission.submissionData.grid);
      setIsComplete(true);
    } else {
      setGrid(gameData.grid.map(row => row.map(cell => cell === '#' ? '#' : null)));
    }
  }, [isReadOnly, submission, gameData]);

  const handleSubmit = async () => {
    if (!user || isReadOnly) return;
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    
    let mistakes = 0;
    for(let r=0; r < gameData.grid.length; r++) {
        for (let c=0; c < gameData.grid[r].length; c++) {
            if(gameData.grid[r][c] !== '#' && grid[r][c] !== gameData.grid[r][c]) {
                mistakes++;
            }
        }
    }

    await submitGame({
      userId: user.id,
      gameId,
      timeTaken,
      mistakes,
      submissionData: { grid },
    });
    setIsComplete(true);
    setTimeout(onComplete, 3000);
  };

  const handleInputChange = (r: number, c: number, value: string) => {
    if (isComplete) return;
    const newGrid = grid.map(row => [...row]);
    newGrid[r][c] = value.toUpperCase().slice(-1);
    setGrid(newGrid);
  };

  const getCellColor = (r: number, c: number) => {
    if (!isReadOnly || grid[r][c] === '#' || !grid[r][c]) {
      return 'bg-gray-700';
    }
    if (grid[r][c] === gameData.grid[r][c]) {
      return 'bg-green-700'; // Correct
    }
    return 'bg-red-700'; // Incorrect
  };

  if (!grid.length) {
    return <div>Loading...</div>; // Render nothing until grid is initialized
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col lg:flex-row gap-8">
      <div className="flex-grow">
        <h2 className="text-2xl font-bold mb-4 text-center">Crossword</h2>
        <div className="aspect-square bg-gray-800 p-2 rounded-lg grid" style={{gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))`}}>
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <div key={`${r}-${c}`} className={`aspect-square ${cell === '#' ? 'bg-gray-900' : ''}`}>
                {cell !== '#' && (
                  <input
                    type="text"
                    maxLength={1}
                    value={grid[r][c] || ''}
                    onChange={(e) => handleInputChange(r, c, e.target.value)}
                    className={`w-full h-full text-center text-white font-bold uppercase focus:outline-none focus:bg-gray-600 ${isReadOnly ? getCellColor(r, c) : 'bg-gray-700'}`}
                    disabled={isComplete}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
      <div className="flex-shrink-0 lg:w-1/3">
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-bold text-yellow-400 border-b border-gray-600 pb-2 mb-2">Across</h3>
                <ul className="space-y-1 text-sm">
                    {Object.entries(gameData.clues.across).map(([num, clue]) => <li key={`a-${num}`}><strong className="mr-2">{num}.</strong>{clue}</li>)}
                </ul>
            </div>
             <div>
                <h3 className="text-xl font-bold text-yellow-400 border-b border-gray-600 pb-2 mb-2">Down</h3>
                <ul className="space-y-1 text-sm">
                    {Object.entries(gameData.clues.down).map(([num, clue]) => <li key={`d-${num}`}><strong className="mr-2">{num}.</strong>{clue}</li>)}
                </ul>
            </div>
        </div>
        {!isReadOnly ? (
          <button 
              onClick={handleSubmit} 
              disabled={isComplete}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isComplete ? "Submitted!" : "Submit Puzzle"}
          </button>
        ) : (
          <div className="mt-6 text-center p-4 rounded-lg bg-gray-800 w-full">
              {submission && (
                <div className="text-sm text-gray-300">
                  <p>Time Taken: {submission.timeTaken}s | Mistakes: {submission.mistakes} | Score: {submission.score}</p>
                </div>
              )}
              <button onClick={onComplete} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                  Back
              </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CrosswordGame;
