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
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const [grid, setGrid] = useState<(string | null)[][]>(() =>
    initialGrid || Array(rows).fill(null).map(() => Array(cols).fill(null))
  );
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [direction, setDirection] = useState<Direction>('across');
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
      if (initialGrid) {
          setGrid(initialGrid);
      }
  }, [initialGrid]);

  const { fullGridData, clueData, solutionGrid } = useMemo(() => {
    const newGridData: CellData[][] = Array(rows).fill(null).map(() => Array(cols).fill(null).map(() => ({ row: 0, col: 0, isBlack: true })));
    for(let r=0; r<rows; r++) {
        for(let c=0; c<cols; c++) {
            newGridData[r][c] = { row: r, col: c, isBlack: true };
        }
    }

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
    if (!activeCell) return { number: undefined, clueText: '', cells: [] };
    const cellData = fullGridData[activeCell.row][activeCell.col];
    const clueNumber = direction === 'across' ? cellData.acrossClueNumber : cellData.downClueNumber;
    if (!clueNumber) return { number: undefined, clueText: '', cells: [] };
    
    const clue = clueData[direction].get(clueNumber);
    if (!clue) return { number: clueNumber, clueText: '', cells: [] };
    
    const cells: ActiveCell[] = [];
    for (let i = 0; i < clue.answer.length; i++) {
      cells.push({
        row: direction === 'across' ? clue.row : clue.row + i,
        col: direction === 'across' ? clue.col + i : clue.col,
      });
    }
    return { number: clueNumber, clueText: clue.clue, cells };
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

  useEffect(() => {
    if (activeCell && !isReviewMode && !isCompleted) {
        // Small delay to ensure render is complete before focusing, helps on some devices
        setTimeout(() => {
             hiddenInputRef.current?.focus({ preventScroll: true });
        }, 10);
    }
  }, [activeCell, isReviewMode, isCompleted]);

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
  }, [isReviewMode]);

  const handleHiddenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeCell || isCompleted || isReviewMode) return;

    const val = e.target.value;
    // We only care about the last character typed if multiple were somehow pasted or typed quickly
    if (val.length > 0) {
         const lastChar = val.slice(-1).toUpperCase();
         if (lastChar.match(/[A-Z]/)) {
             processInput(lastChar);
         }
    }
    e.target.value = '';
  };

  const processInput = (char: string | null) => {
      if (!activeCell) return;
      const newGrid = grid.map(r => [...r]);
      newGrid[activeCell.row][activeCell.col] = char;
      setGrid(newGrid);
      onCellChange?.(activeCell.row, activeCell.col, char);

      if (char) {
          const currentIndex = activeClueInfo.cells.findIndex(c => c.row === activeCell.row && c.col === activeCell.col);
          if(currentIndex < activeClueInfo.cells.length - 1) {
              setActiveCell(activeClueInfo.cells[currentIndex + 1]);
          }
      } else {
           const currentIndex = activeClueInfo.cells.findIndex(c => c.row === activeCell.row && c.col === activeCell.col);
           if(currentIndex > 0) {
               setActiveCell(activeClueInfo.cells[currentIndex - 1]);
           }
      }
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement | HTMLInputElement>) => {
    if (!activeCell || isCompleted || isReviewMode) return;
    
    // Always prevent default for navigation keys to prevent page scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Backspace', ' '].includes(e.key)) {
        e.preventDefault();
    }

    if (e.key.length === 1 && e.key.match(/[a-z]/i) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Prevent default to stop the input event from firing twice (once here, once in onChange if we didn't prevent it)
      // AND to potentially stop some browsers from doing weird scroll-to-cursor things.
      e.preventDefault();
      processInput(e.key.toUpperCase());
    } else if (e.key === 'Backspace' || e.key === ' ') {
        if (!grid[activeCell.row][activeCell.col] && e.key === 'Backspace') {
             const currentIndex = activeClueInfo.cells.findIndex(c => c.row === activeCell.row && c.col === activeCell.col);
             if (currentIndex > 0) {
                 const prevCell = activeClueInfo.cells[currentIndex - 1];
                 setActiveCell(prevCell);
                 const newGrid = grid.map(r => [...r]);
                 newGrid[prevCell.row][prevCell.col] = null;
                 setGrid(newGrid);
                 onCellChange?.(prevCell.row, prevCell.col, null);
                 return;
             }
        }
        processInput(null);
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
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
        const clueList = direction === 'across' ? puzzleData.acrossClues : puzzleData.downClues;
        const currentClueNumber = activeClueInfo.number;
        const currentIndex = clueList.findIndex(c => c.number === currentClueNumber);
        const nextIndex = (currentIndex + (e.shiftKey ? -1 : 1) + clueList.length) % clueList.length;
        handleClueClick(clueList[nextIndex]);
    }

  }, [activeCell, grid, activeClueInfo, onCellChange, puzzleData, handleClueClick, rows, cols, fullGridData, isCompleted, isReviewMode, direction]);

  return (
    <div className="relative flex flex-col items-center md:pb-0 pb-20"> {/* Added bottom padding for sticky clue */}
      <input 
          ref={hiddenInputRef}
          type="text" 
          inputMode="text"
          className="fixed top-0 left-0 opacity-0 h-px w-px pointer-events-none" // Minimized and removed from pointer events
          style={{ fontSize: '16px' }} // Prevents iOS zoom on focus
          onChange={handleHiddenInputChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck="false"
      />

      {isCompleted && !isReviewMode && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center rounded-lg z-20 p-4">
          <div className="text-center p-6 md:p-8 bg-zinc-800 rounded-xl shadow-2xl border-2 border-yellow-400 animate-bounce-in">
            <h2 className="text-2xl md:text-3xl font-bold text-yellow-400 mb-4 animate-pulse">Congratulations!</h2>
            <p className="text-zinc-200 text-base md:text-lg">You've solved the puzzle!</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6 md:gap-8 justify-center items-start w-full">
        <div 
          ref={gridRef}
          className="grid outline-none self-center md:self-start shadow-2xl" 
          style={{ 
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            aspectRatio: `${cols} / ${rows}`,
            width: 'clamp(300px, 95vw, 550px)',
          }}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          onClick={() => !isReviewMode && hiddenInputRef.current?.focus({ preventScroll: true })}
        >
          {fullGridData.flat().map(({ row, col, isBlack, number }) => {
            const isSelected = activeCell?.row === row && activeCell?.col === col;
            const isHighlighted = activeClueInfo.cells.some(c => c.row === row && c.col === col);
            
            let cellClasses = 'relative flex items-center justify-center uppercase font-bold text-lg md:text-2xl border-zinc-700 border select-none';
            
            if (isBlack) {
              cellClasses += ' bg-zinc-950';
            } else {
              if (isReviewMode) {
                  cellClasses += ' bg-green-900/30 text-green-100';
              } else if (isSelected) {
                cellClasses += ' bg-yellow-500 text-gray-900 z-10 ring-2 ring-yellow-400';
              } else if (isHighlighted) {
                cellClasses += ' bg-yellow-500/30 text-white';
              } else {
                cellClasses += ' bg-zinc-800 text-zinc-100 hover:bg-zinc-700 cursor-pointer transition-colors';
              }
            }

            return (
              <div key={`${row}-${col}`} className={cellClasses} onClick={(e) => { e.stopPropagation(); handleCellClick(row, col); }}>
                {number && <span className="absolute top-0.5 left-0.5 text-[10px] md:text-xs leading-none text-zinc-400 font-normal pointer-events-none">{number}</span>}
                {!isBlack && <span className="pointer-events-none">{grid[row][col]}</span>}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 w-full md:w-64 lg:w-72 self-stretch max-h-[60vh] md:max-h-[550px] overflow-hidden">
          <div className="flex-1 bg-zinc-800/80 rounded-xl p-4 border border-zinc-700/50 flex flex-col overflow-hidden">
            <h2 className="text-lg font-bold text-yellow-400 mb-2 uppercase tracking-wider border-b border-zinc-700 pb-2">Across</h2>
            <ul className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin">
              {puzzleData.acrossClues.map(clue => (
                <li 
                  key={`across-${clue.number}`} 
                  ref={(el) => { if (activeClueInfo.number === clue.number && direction === 'across' && el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }}
                  className={`cursor-pointer p-2 rounded text-sm transition-all ${activeClueInfo.number === clue.number && direction === 'across' && !isReviewMode ? 'bg-yellow-500/20 text-yellow-300 border-l-2 border-yellow-500 pl-1.5' : 'text-zinc-300 hover:bg-zinc-700/50'}`}
                  onClick={() => handleClueClick(clue)}
                >
                  <span className="font-bold mr-1">{clue.number}.</span>{clue.clue}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1 bg-zinc-800/80 rounded-xl p-4 border border-zinc-700/50 flex flex-col overflow-hidden">
            <h2 className="text-lg font-bold text-yellow-400 mb-2 uppercase tracking-wider border-b border-zinc-700 pb-2">Down</h2>
             <ul className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin">
              {puzzleData.downClues.map(clue => (
                <li 
                  key={`down-${clue.number}`} 
                  ref={(el) => { if (activeClueInfo.number === clue.number && direction === 'down' && el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }}
                  className={`cursor-pointer p-2 rounded text-sm transition-all ${activeClueInfo.number === clue.number && direction === 'down' && !isReviewMode ? 'bg-yellow-500/20 text-yellow-300 border-l-2 border-yellow-500 pl-1.5' : 'text-zinc-300 hover:bg-zinc-700/50'}`}
                  onClick={() => handleClueClick(clue)}
                >
                  <span className="font-bold mr-1">{clue.number}.</span>{clue.clue}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

       {/* Sticky Bottom Clue for Mobile */}
       {!isReviewMode && activeClueInfo.number && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-sm border-t-2 border-yellow-500 p-3 md:hidden z-50 animate-slide-up shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
             <p className="text-base font-medium text-white text-center">
                 <span className="font-bold text-yellow-400 mr-2">{activeClueInfo.number}{direction === 'across' ? 'A' : 'D'}.</span>
                 {activeClueInfo.clueText}
             </p>
        </div>
      )}
    </div>
  );
};