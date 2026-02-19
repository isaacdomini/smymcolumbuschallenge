import React from 'react';
import Modal from '../ui/Modal';
import { GameType } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { getGameName } from '../../utils/game';

interface GameInstructionsModalProps {
  gameType: GameType;
  onStart: () => void;
  onClose: () => void;
}

const GameInstructionsModal: React.FC<GameInstructionsModalProps> = ({ gameType, onStart, onClose }) => {
  const { user } = useAuth();
  const isTestUser = user?.email?.toLowerCase().startsWith('test') || false;

  const renderWordleInstructions = () => (
    <div className="space-y-4">
      <p>Guess the hidden word in 6 tries.</p>
      <ul className="list-disc pl-5 space-y-2 text-gray-300">
        <li>Each guess must be a valid word.</li>
        <li>The color of the tiles will change to show how close your guess was to the word.</li>
      </ul>
      <div className="my-4 p-4 bg-gray-900/50 rounded-lg">
        <h4 className="font-bold mb-2">Examples</h4>
        <div className="flex gap-2 mb-2">
          <div className="w-10 h-10 bg-green-600 border-2 border-green-600 flex items-center justify-center font-bold">W</div>
          <div className="w-10 h-10 border-2 border-gray-600 flex items-center justify-center font-bold">E</div>
          <div className="w-10 h-10 border-2 border-gray-600 flex items-center justify-center font-bold">A</div>
          <div className="w-10 h-10 border-2 border-gray-600 flex items-center justify-center font-bold">R</div>
          <div className="w-10 h-10 border-2 border-gray-600 flex items-center justify-center font-bold">Y</div>
        </div>
        <p className="text-sm mb-4"><span className="font-bold text-green-400">W</span> is in the word and in the correct spot.</p>

        <div className="flex gap-2 mb-2">
          <div className="w-10 h-10 border-2 border-gray-600 flex items-center justify-center font-bold">P</div>
          <div className="w-10 h-10 bg-yellow-500 border-2 border-yellow-500 flex items-center justify-center font-bold text-black">I</div>
          <div className="w-10 h-10 border-2 border-gray-600 flex items-center justify-center font-bold">L</div>
          <div className="w-10 h-10 border-2 border-gray-600 flex items-center justify-center font-bold">O</div>
          <div className="w-10 h-10 border-2 border-gray-600 flex items-center justify-center font-bold">T</div>
        </div>
        <p className="text-sm mb-4"><span className="font-bold text-yellow-400">I</span> is in the word but in the wrong spot.</p>

        <div className="flex gap-2 mb-2">
          <div className="w-10 h-10 border-2 border-gray-600 flex items-center justify-center font-bold">V</div>
          <div className="w-10 h-10 border-2 border-gray-600 flex items-center justify-center font-bold">A</div>
          <div className="w-10 h-10 border-2 border-gray-600 flex items-center justify-center font-bold">G</div>
          <div className="w-10 h-10 bg-gray-700 border-2 border-gray-700 flex items-center justify-center font-bold">U</div>
          <div className="w-10 h-10 border-2 border-gray-600 flex items-center justify-center font-bold">E</div>
        </div>
        <p className="text-sm"><span className="font-bold text-gray-400">U</span> is not in the word in any spot.</p>
      </div>
    </div>
  );

  const renderConnectionsInstructions = () => (
    <div className="space-y-4">
      <p>Group words that share a common thread.</p>
      <ul className="list-disc pl-5 space-y-2 text-gray-300">
        <li>Select four items and tap 'Submit' to check if your guess is correct.</li>
        <li>Find all 4 groups to win!</li>
        <li>You have 4 mistakes allowed before the game ends.</li>
      </ul>
      <div className="my-4 p-4 bg-gray-900/50 rounded-lg">
        <h4 className="font-bold mb-2">Category Examples</h4>
        <ul className="text-sm space-y-2">
          <li><span className="font-bold text-yellow-400">FISH:</span> Bass, Flounder, Salmon, Trout</li>
          <li><span className="font-bold text-yellow-400">FIRE ___:</span> Ant, Drill, Island, Opal</li>
        </ul>
        <div className="mt-4 grid grid-cols-4 gap-2 opacity-75 pointer-events-none" aria-hidden="true">
          {/* Visual filler for grid */}
          {['BASS', 'FLOUNDER', 'SALMON', 'TROUT'].map((w, i) => (
            <div key={i} className="bg-green-800 text-xs p-1 rounded text-center flex items-center justify-center h-8">{w}</div>
          ))}
          {['ANT', 'DRILL', 'ISLAND', 'OPAL'].map((w, i) => (
            <div key={i} className="bg-yellow-600 text-xs p-1 rounded text-center flex items-center justify-center h-8">{w}</div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCrosswordInstructions = () => (
    <div className="space-y-4">
      <p>Fill in the grid with words based on the given clues.</p>
      <ul className="list-disc pl-5 space-y-2 text-gray-300">
        <li>Click on a cell or a clue to highlight the word.</li>
        <li>Click the same cell again to switch between Across and Down directions.</li>
        <li>Use keyboard to type answers. Arrow keys navigate the grid.</li>
        <li>Your score is based on accuracy and completion time.</li>
      </ul>
      <p className="text-yellow-400 text-sm italic border-l-2 border-yellow-400 pl-3 py-1 bg-yellow-400/10 rounded-r">
        <strong>Note:</strong> The timer starts immediately when you begin and continues running even if you leave the page.
      </p>
      <div className="my-4 flex justify-center">
        {/* Simple SVG Diagram for Crossword interaction */}
        <svg width="120" height="120" viewBox="0 0 120 120" className="bg-gray-900 rounded-lg">
          <rect x="10" y="10" width="30" height="30" fill="#3F3F46" stroke="#52525B" />
          <text x="25" y="35" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">C</text>
          <rect x="45" y="10" width="30" height="30" fill="#EAB308" stroke="#EAB308" />
          <text x="60" y="35" textAnchor="middle" fill="black" fontSize="20" fontWeight="bold">A</text>
          <rect x="80" y="10" width="30" height="30" fill="#3F3F46" stroke="#52525B" />
          <text x="95" y="35" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">T</text>

          <rect x="45" y="45" width="30" height="30" fill="#3F3F46" stroke="#52525B" />
          <rect x="45" y="80" width="30" height="30" fill="#3F3F46" stroke="#52525B" />

          {/* Highlight indicator */}
          <rect x="43" y="8" width="34" height="34" fill="none" stroke="#EAB308" strokeWidth="2" className="animate-pulse" />
        </svg>
      </div>
    </div>
  );

  const renderMatchTheWordInstructions = () => (
    <div className="space-y-4">
      <p>Match the words on the left with their corresponding pairs on the right.</p>
      <ul className="list-disc pl-5 space-y-2 text-gray-300">
        <li>Select a word from the first column, then select its matching pair from the second column.</li>
        <li>Correct pairs will be highlighted and locked in.</li>
        <li>You have a limited number of mistakes. The game ends if you exceed the mistake limit.</li>
        <li>Match all pairs to win!</li>
      </ul>
    </div>
  );

  const renderVerseScrambleInstructions = () => (
    <div className="space-y-4">
      <p>Rearrange the scrambled words to form the correct Bible verse.</p>
      <ul className="list-disc pl-5 space-y-2 text-gray-300">
        <li>Drag words from the pool to the solution area.</li>
        <li>Arrrange them in the correct order to form the verse.</li>
        <li>The game will automatically complete when the order is correct.</li>
      </ul>
      <p className="text-yellow-400 text-sm italic border-l-2 border-yellow-400 pl-3 py-1 bg-yellow-400/10 rounded-r">
        <strong>Note:</strong> The timer starts immediately when you begin and continues running even if you leave the page.
      </p>
    </div>
  );

  const renderWhoAmIInstructions = () => (
    <div className="space-y-4">
      <p>Guess the biblical figure or term by suggesting letters.</p>
      <ul className="list-disc pl-5 space-y-2 text-gray-300">
        <li>Use the on-screen keyboard or your physical keyboard to guess letters.</li>
        <li>Each incorrect guess adds to your mistake count.</li>
        <li>You have 6 allowed mistakes before the game is over.</li>
        <li>Use the hint if you get stuck!</li>
      </ul>
    </div>
  );

  const renderWordSearchInstructions = () => (
    <div className="space-y-4">
      <p>Find all the hidden words in the grid.</p>
      <ul className="list-disc pl-5 space-y-2 text-gray-300">
        <li>Words can be horizontal, vertical, or diagonal.</li>
        <li>Click and drag (or tap start and end) to select a word.</li>
        <li>Find all the words listed on the side to win.</li>
      </ul>
    </div>
  );

  const getTitle = () => {
    return `How to Play ${getGameName(gameType, isTestUser)}`;
  };

  const getContent = () => {
    switch (gameType) {
      case GameType.WORDLE:
      case GameType.WORDLE_BANK: return renderWordleInstructions();
      case GameType.CONNECTIONS: return renderConnectionsInstructions();
      case GameType.CROSSWORD: return renderCrosswordInstructions();
      case GameType.MATCH_THE_WORD: return renderMatchTheWordInstructions();
      case GameType.VERSE_SCRAMBLE: return renderVerseScrambleInstructions();
      case GameType.WHO_AM_I: return renderWhoAmIInstructions();
      case GameType.WORD_SEARCH: return renderWordSearchInstructions();
      default: return null;
    }
  };

  return (
    <Modal onClose={onClose} title={getTitle()}>
      <div className="mb-6 max-h-[60vh] overflow-y-auto pr-2">
        {getContent()}
      </div>
      <div className="flex flex-col gap-3">
        <button
          onClick={onStart}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105"
        >
          Start Game
        </button>
        {/* Only show sample button if we are not already in a sample game (which would be handled by parent not passing onSample if so desired, or we can just always show it but maybe it's redundant) */}
        {/* Actually, the requirement is to add a button to try playing. */}
        <button
          onClick={() => {
            onClose();
            // We'll navigate to the sample game route.
            // Since this modal is used inside the game, we might need a way to switch context.
            // But wait, if we are inside a game, we are already at /game/:id.
            // If we want to play a sample, we should probably just switch the game component to sample mode.
            // However, the cleanest way given the App structure is to navigate to a sample URL.
            window.location.href = `/game/sample-${gameType}`;
          }}
          className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2 px-6 rounded-lg text-base transition-colors"
        >
          Try Sample Game
        </button>
      </div>
    </Modal>
  );
};

export default GameInstructionsModal;