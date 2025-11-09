import React from 'react';

interface CrosswordKeyboardProps {
  onKeyPress: (key: string) => void;
}

const KEY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Backspace'],
];

const CrosswordKeyboard: React.FC<CrosswordKeyboardProps> = ({ onKeyPress }) => {
  return (
    <div className="w-full max-w-lg mt-4 select-none touch-manipulation">
      {KEY_ROWS.map((row, i) => (
        <div key={i} className="flex justify-center gap-1 my-1 w-full">
          {row.map(key => {
            const isSpecialKey = key.length > 1;
            const flexClass = isSpecialKey ? 'flex-[1.5]' : 'flex-1';
            const textSize = isSpecialKey ? 'text-xs sm:text-sm' : 'text-sm sm:text-base';
            
            let displayKey = key;
            if (key === 'Backspace') displayKey = '⌫';
            // Optional: Hide Enter if crossword auto-advances well enough, 
            // but it can be useful for "next clue" functionality.
            if (key === 'Enter') displayKey = 'Next'; 

            return (
                <button 
                    key={key} 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onKeyPress(key); }}
                    className={`h-12 sm:h-14 rounded font-semibold uppercase text-white transition-colors ${flexClass} bg-zinc-600 hover:bg-zinc-500 active:bg-zinc-700 ${textSize} flex items-center justify-center shadow-sm`}
                    type="button"
                >
                    {displayKey}
                </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default CrosswordKeyboard;