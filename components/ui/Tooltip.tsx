import React, { ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  text: string;
}

const Tooltip: React.FC<TooltipProps> = ({ children, text }) => {
  return (
    <div className="relative flex items-center group z-10">
      {children}
      {/* Changed positioning to 'top-full' and 'mt-2' to place tooltip BELOW the element by default.
        This helps avoid clipping when the element is near the top of a container.
      */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-xs p-2 text-sm text-white bg-gray-900 border border-gray-600 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[100] whitespace-normal text-center">
        {text}
        {/* Arrow pointing up */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-[1px] border-4 border-transparent border-b-gray-900"></div>
      </div>
    </div>
  );
};

export default Tooltip;