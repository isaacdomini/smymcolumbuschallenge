import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import CrosswordKeyboard from './CrosswordKeyboard';
import { useIsMobile } from '../../hooks/useIsMobile';

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
  const isMobile = useIsMobile();

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

  const handleKeyPress = useCallback((key: string) => {
      if (!activeCell || isCompleted || isReviewMode) return;

      if (key === 'Backspace') {
          if (!grid[activeCell.row][activeCell.col]) {
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
          const newGrid = grid.map(r => [...r]);
          newGrid[activeCell.row][activeCell.col] = null;
          setGrid(newGrid);
          onCellChange?.(activeCell.row, activeCell.col, null);
      } else if (key === 'Enter' || key === 'Next') {
          const clueList = direction === 'across' ? puzzleData.acrossClues : puzzleData.downClues;
          const currentClueNumber = activeClueInfo.number;
          const currentIndex = clueList.findIndex(c => c.number === currentClueNumber);
          const nextIndex = (currentIndex + 1) % clueList.length;
          handleClueClick(clueList[nextIndex]);
      } else {
          const newGrid = grid.map(r => [...r]);
          newGrid[activeCell.row][activeCell.col] = key;
          setGrid(newGrid);
          onCellChange?.(activeCell.row, activeCell.col, key);
          const currentIndex = activeClueInfo.cells.findIndex(c => c.row === activeCell.row && c.col === activeCell.col);
          if(currentIndex < activeClueInfo.cells.length - 1) {
              setActiveCell(activeClueInfo.cells[currentIndex + 1]);
          }
      }
  }, [activeCell, grid, activeClueInfo, onCellChange, puzzleData, handleClueClick, isCompleted, isReviewMode, direction]);

  // Handle physical keyboard events (always active)
  useEffect(() => {
      if (isReviewMode || isCompleted) return;
      const handler = (e: KeyboardEvent) => {
          // Don't handle if a modifier key is pressed (e.g. Ctrl+R for refresh)
          if (e.ctrlKey || e.metaKey || e.altKey) return;

          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
               if (!activeCell) return;
               e.preventDefault();
               let { row, col } = activeCell;
               if(e.key === 'ArrowUp') row--;
               if(e.key === 'ArrowDown') row++;
               if(e.key === 'ArrowLeft') col--;
               if(e.key === 'ArrowRight') col++;
               if (row >= 0 && row < rows && col >= 0 && col < cols && !fullGridData[row][col].isBlack) {
                   setActiveCell({row, col});
               }
          } else if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
              e.preventDefault(); // Prevent potential scrolling or browser shortcuts
              handleKeyPress(e.key.toUpperCase());
          } else if (e.key === 'Backspace') {
              e.preventDefault(); // Prevent browser back navigation
              handleKeyPress('Backspace');
          } else if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              handleKeyPress('Enter');
          }
      };
      // Use 'keydown' instead of 'keyup' for more responsive feeling and to catch and prevent defaults early
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
  }, [handleKeyPress, activeCell, rows, cols, fullGridData, isReviewMode, isCompleted]);

  return (
    <div className="relative flex flex-col items-center w-full">
      {isCompleted && !isReviewMode && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center rounded-lg z-30 p-4">
          <div className="text-center p-6 md:p-8 bg-zinc-800 rounded-xl shadow-2xl border-2 border-yellow-400 animate-bounce-in">
            <h2 className="text-2xl md:text-3xl font-bold text-yellow-400 mb-4 animate-pulse">Congratulations!</h2>
            <p className="text-zinc-200 text-base md:text-lg">You've solved the puzzle!</p>
          </div>
        </div>
      )}

      {/* Sticky Top Clue for Mobile - when NOT in review mode */}
      {!isReviewMode && activeClueInfo.number && isMobile && (
        <div className="fixed top-[56px] left-0 right-0 bg-zinc-900/95 backdrop-blur-sm border-b-2 border-yellow-500 p-3 md:hidden z-20 animate-slide-down shadow-lg">
             <p className="text-base font-medium text-white text-center">
                 <span className="font-bold text-yellow-400 mr-2">{activeClueInfo.number}{direction === 'across' ? 'A' : 'D'}.</span>
                 {activeClueInfo.clueText}
             </p>
        </div>
      )}

      <div className={`flex flex-col md:flex-row gap-6 md:gap-8 justify-center items-start w-full ${!isReviewMode && isMobile ? 'mt-16' : ''}`}>
        <div 
          ref={gridRef}
          className="grid outline-none self-center md:self-start shadow-2xl" 
          style={{ 
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            aspectRatio: `${cols} / ${rows}`,
            width: 'clamp(300px, 95vw, 550px)',
          }}
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

        {/* Clue lists: Hidden on mobile unless in review mode */}
        <div className={`flex-col gap-4 w-full md:w-64 lg:w-72 self-stretch max-h-[60vh] md:max-h-[550px] overflow-hidden ${!isReviewMode && isMobile ? 'hidden' : 'flex'}`}>
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
      
      {/* On-screen Keyboard - ONLY ON MOBILE */}
      {!isReviewMode && !isCompleted && isMobile && (
          <CrosswordKeyboard onKeyPress={handleKeyPress} />
      )}

      <style>{`
        @keyframes slide-down {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
        }
        .animate-slide-down {
            animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};