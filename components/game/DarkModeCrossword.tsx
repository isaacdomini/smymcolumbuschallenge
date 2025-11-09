import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

export type Direction = 'across' | 'down';

export interface Clue {
  number: number;
  clue: string;
  answer: string;
  row: number;
  col: number;
  direction: Direction;
}

export interface PuzzleData {
  rows: number;
  cols: number;
  acrossClues: Clue[];
  downClues: Clue[];
}

export interface CellData {
  row: number;
  col: number;
  isBlack: boolean;
  number?: number;
  acrossClueNumber?: number;
  downClueNumber?: number;
}

export interface ActiveCell {
  row: number;
  col: number;
}

interface DarkModeCrosswordProps {
  puzzleData: PuzzleData;
  onPuzzleComplete?: () => void;
  onCellChange?: (row: number, col: number, char: string | null) => void;
  initialGrid?: (string | null)[][];
  isReviewMode?: boolean;
}

export const DarkModeCrossword: React.FC<DarkModeCrosswordProps> = ({
  puzzleData,
  onPuzzleComplete,
  onCellChange,
  initialGrid,
  isReviewMode = false,
}) => {
  const { rows, cols } = puzzleData;
  const gridRef = useRef<HTMLDivElement>(null);

  const [grid, setGrid] = useState<(string | null)[][]>(() =>
    initialGrid || Array(rows).fill(null).map(() => Array(cols).fill(null))
  );
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [direction, setDirection] = useState<Direction>('across');
  const [isCompleted, setIsCompleted] = useState(false);

  const { fullGridData, clueData, solutionGrid } = useMemo(() => {
    const newGridData: CellData[][] = Array(rows).fill(null).map((_, r) =>
      Array(cols).fill(null).map((_, c) => ({
        row: r,
        col: c,
        isBlack: true,
      }))
    );
    const newSolutionGrid: (string | null)[][] = Array(rows).fill(null).map(() => Array(cols).fill(null));
    
    const acrossMap = new Map<number, Clue>();
    const downMap = new Map<number, Clue>();

    puzzleData.acrossClues.forEach(clue => {
      acrossMap.set(clue.number, clue);
      for (let i = 0; i < clue.answer.length; i++) {
        if (clue.col + i < cols) {
             const cell = newGridData[clue.row][clue.col + i];
             cell.isBlack = false;
             cell.acrossClueNumber = clue.number;
             newSolutionGrid[clue.row][clue.col + i] = clue.answer[i];
        }
      }
      if (clue.col < cols && clue.row < rows) {
         newGridData[clue.row][clue.col].number = clue.number;
      }
    });

    puzzleData.downClues.forEach(clue => {
      downMap.set(clue.number, clue);
      for (let i = 0; i < clue.answer.length; i++) {
        if (clue.row + i < rows) {
             const cell = newGridData[clue.row + i][clue.col];
             cell.isBlack = false;
             cell.downClueNumber = clue.number;
             newSolutionGrid[clue.row + i][clue.col] = clue.answer[i];
        }
      }
      if (clue.row < rows && clue.col < cols) {
         const existingCell = newGridData[clue.row][clue.col];
         existingCell.number = existingCell.number || clue.number;
      }
    });
    
    return { fullGridData: newGridData, clueData: { across: acrossMap, down: downMap }, solutionGrid: newSolutionGrid };
  }, [puzzleData, rows, cols]);

  const activeClueInfo = useMemo(() => {
    if (!activeCell) return { number: undefined, cells: [] };
    const cellData = fullGridData[activeCell.row][activeCell.col];
    const clueNumber = direction === 'across' ? cellData.acrossClueNumber : cellData.downClueNumber;
    if (!clueNumber) return { number: undefined, cells: [] };
    
    const clue = clueData[direction].get(clueNumber);
    if (!clue) return { number: clueNumber, cells: [] };
    
    const cells: ActiveCell[] = [];
    for (let i = 0; i < clue.answer.length; i++) {
      cells.push({
        row: direction === 'across' ? clue.row : clue.row + i,
        col: direction === 'across' ? clue.col + i : clue.col,
      });
    }
    return { number: clueNumber, cells };
  }, [activeCell, direction, fullGridData, clueData]);

  const checkCompletion = useCallback(() => {
    if (isCompleted || isReviewMode) return;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!fullGridData[r][c].isBlack && grid[r][c] !== solutionGrid[r][c]) {
          return;
        }
      }
    }
    setIsCompleted(true);
    onPuzzleComplete?.();
  }, [grid, onPuzzleComplete, isCompleted, isReviewMode, rows, cols, fullGridData, solutionGrid]);

  useEffect(() => {
    checkCompletion();
  }, [grid, checkCompletion]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (isReviewMode || fullGridData[row][col].isBlack) return;
    
    if (activeCell?.row === row && activeCell?.col === col) {
      const newDirection = direction === 'across' ? 'down' : 'across';
      const cellData = fullGridData[row][col];
      if (newDirection === 'across' && cellData.acrossClueNumber) {
        setDirection('across');
      } else if (newDirection === 'down' && cellData.downClueNumber) {
        setDirection('down');
      }
    } else {
      const cellData = fullGridData[row][col];
      if (direction === 'across' && cellData.acrossClueNumber) {
        // stay across
      } else if (direction === 'down' && cellData.downClueNumber) {
        // stay down
      } else if (cellData.acrossClueNumber) {
        setDirection('across');
      } else if (cellData.downClueNumber) {
        setDirection('down');
      }
    }
    setActiveCell({ row, col });
  }, [activeCell, direction, fullGridData, isReviewMode]);
  
  const handleClueClick = useCallback((clue: Clue) => {
    if(isReviewMode) return;
    setActiveCell({ row: clue.row, col: clue.col });
    setDirection(clue.direction);
    gridRef.current?.focus();
  }, [isReviewMode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!activeCell || isCompleted || isReviewMode) return;
    
    if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
      e.preventDefault();
      const newGrid = grid.map(r => [...r]);
      newGrid[activeCell.row][activeCell.col] = e.key.toUpperCase();
      setGrid(newGrid);
      onCellChange?.(activeCell.row, activeCell.col, e.key.toUpperCase());

      const currentIndex = activeClueInfo.cells.findIndex(c => c.row === activeCell.row && c.col === activeCell.col);
      if(currentIndex < activeClueInfo.cells.length - 1) {
        setActiveCell(activeClueInfo.cells[currentIndex + 1]);
      }
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      const newGrid = grid.map(r => [...r]);
      const currentVal = newGrid[activeCell.row][activeCell.col];
      newGrid[activeCell.row][activeCell.col] = null;
      setGrid(newGrid);
      onCellChange?.(activeCell.row, activeCell.col, null);

      if (!currentVal) {
         const currentIndex = activeClueInfo.cells.findIndex(c => c.row === activeCell.row && c.col === activeCell.col);
         if(currentIndex > 0) setActiveCell(activeClueInfo.cells[currentIndex - 1]);
      }
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      let { row, col } = activeCell;
      const move = (r: number, c: number): {row: number, col: number} => {
        let newRow = r, newCol = c;
        if(e.key === 'ArrowUp') newRow--;
        if(e.key === 'ArrowDown') newRow++;
        if(e.key === 'ArrowLeft') newCol--;
        if(e.key === 'ArrowRight') newCol++;

        if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols && !fullGridData[newRow][newCol].isBlack) {
            return {row: newRow, col: newCol};
        }
        return {row, col};
      }
      setActiveCell(move(row, col));
    } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const clueList = direction === 'across' ? puzzleData.acrossClues : puzzleData.downClues;
        const currentClueNumber = activeClueInfo.number;
        const currentIndex = clueList.findIndex(c => c.number === currentClueNumber);
        const nextIndex = (currentIndex + (e.shiftKey ? -1 : 1) + clueList.length) % clueList.length;
        handleClueClick(clueList[nextIndex]);
    }

  }, [activeCell,ZZ grid, activeClueInfo, onCellChange, puzzleData, handleClueClick, rows, cols, fullGridData, isCompleted, isReviewMode, direction]);

  useEffect(() => {
    if (activeCell) {
        const { row, col } = activeCell;
        // Guard against out of bounds if grid resized (unlikely but good practice)
        if (row >= rows || col >= cols) {
             setActiveCell(null);
             return;
        }
        const cellInfo = fullGridData[row][col];
        const canBeAcross = !!cellInfo.acrossClueNumber;
        const canBeDown = !!cellInfo.downClueNumber;
        if (direction === 'across' && !canBeAcross && canBeDown) {
            setDirection('down');
        } else if (direction === 'down' && !canBeDown && canBeAcross) {
            setDirection('across');
        }
    }
  }, [activeCell, direction, fullGridData, rows, cols]);


  return (
    <div className="relative">
      {isCompleted && !isReviewMode && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center rounded-lg z-10 p-4">
          <div className="text-center p-6 md:p-8 bg-zinc-800 rounded-xl shadow-2xl border-2 border-yellow-400">
            <h2 className="text-2xl md:text-3xl font-bold text-yellow-400 mb-4 animate-pulse">Congratulations!</h2>
            <p className="text-zinc-200 text-base md:text-lg">You've solved the puzzle!</p>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 justify-center items-start">
        <div 
          ref={gridRef}
          className="grid outline-none" 
          style={{ 
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            // Calculate aspect ratio based on rows/cols
            aspectRatio: `${cols} / ${rows}`,
            width: 'clamp(300px, 90vw, 500px)',
          }}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {fullGridData.flat().map(({ row, col, isBlack, number }) => {
            const isSelected = activeCell?.row === row && activeCell?.col === col;
            const isHighlighted = activeClueInfo.cells.some(c => c.row === row && c.col === col);
            
            let cellClasses = 'relative flex items-center justify-center uppercase font-bold text-lg md:text-xl aspect-square border-zinc-900 border';
            let isIncorrect = false;
            let correctChar = '';

            if (isReviewMode && !isBlack) {
                const userChar = grid[row][col];
                const solutionChar = solutionGrid[row][col];
                if (userChar && userChar !== solutionChar) {
                    isIncorrect = true;
                    correctChar = solutionChar || '';
                }
            }
            
            if (isBlack) {
              cellClasses += ' bg-zinc-900';
            } else {
              if (isIncorrect) {
                cellClasses += ' bg-red-800/80 text-red-200';
              } else if (isSelected) {
                cellClasses += ' bg-yellow-400 text-black';
              } else if (isHighlighted) {
                cellClasses += ' bg-zinc-700';
              } else {
                cellClasses += ' bg-zinc-800 text-white';
              }
            }

            return (
              <div key={`${row}-${col}`} className={cellClasses} onClick={() => handleCellClick(row, col)}>
                {number && <span className="absolute top-0.5 left-1 text-xs text-zinc-400">{number}</span>}
                {!isBlack && (
                    <>
                        <span>{grid[row][col]}</span>
                        {isIncorrect && <span className="absolute bottom-0 right-1 text-xs text-green-300 font-mono">{correctChar}</span>}
                    </>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex md:flex-col gap-4 w-full md:w-auto md:max-w-xs self-stretch">
          <div className="flex-1 bg-zinc-800/50 rounded-lg p-3">
            <h2 className="text-xl font-bold text-yellow-400 mb-2">Across</h2>
            <ul className="space-y-1 overflow-y-auto max-h-60 md:max-h-[450px] pr-2">
              {puzzleData.acrossClues.map(clue => (
                <li 
                  key={`across-${clue.number}`} 
                  className={`cursor-pointer p-1 rounded transition-colors text-sm ${activeClueInfo.number === clue.number && direction === 'across' ? 'text-yellow-400 font-semibold' : 'text-zinc-300 hover:bg-zinc-700'}`}
                  onClick={() => handleClueClick(clue)}
                >
                  <span className="font-bold w-6 inline-block">{clue.number}.</span> {clue.clue}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1 bg-zinc-800/50 rounded-lg p-3">
            <h2 className="text-xl font-bold text-yellow-400 mb-2">Down</h2>
            <ul className="space-y-1 overflow-y-auto max-h-60 md:max-h-[450px] pr-2">
              {puzzleData.downClues.map(clue => (
                <li 
                  key={`down-${clue.number}`} 
                  className={`cursor-pointer p-1 rounded transition-colors text-sm ${activeClueInfo.number === clue.number && direction === 'down' ? 'text-yellow-400 font-semibold' : 'text-zinc-300 hover:bg-zinc-700'}`}
                  onClick={() => handleClueClick(clue)}
                >
                  <span className="font-bold w-6 inline-block">{clue.number}.</span> {clue.clue}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};