
import React from 'react';
import { useGroup } from './GroupContext';

const GroupSelector: React.FC = () => {
  const { currentGroup, userGroups, setCurrentGroup } = useGroup();
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (userGroups.length <= 1) {
    return null; // Don't show if user has only one group (or zero)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors border border-gray-700"
      >
        <span className="font-medium truncate max-w-[150px]">
          {currentGroup?.name || 'Select Group'}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
          <div className="max-h-60 overflow-y-auto">
            {userGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => {
                  setCurrentGroup(group);
                  setIsOpen(false);
                  // Reload page to refresh content for the new group
                  window.location.reload();
                }}
                className="w-full text-left px-4 py-3 hover:bg-gray-700 flex items-center justify-between transition-colors border-b border-gray-700 last:border-0"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-gray-200">{group.name}</span>
                  <span className="text-xs text-gray-400 capitalize">{group.role}</span>
                </div>
                {currentGroup?.id === group.id && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-yellow-500"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </button>
            ))}
          </div>
          <div className="p-2 bg-gray-900 border-t border-gray-700">
            <button className="w-full text-center text-xs text-gray-400 hover:text-white transition-colors py-1">
              Manage Groups
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupSelector;
