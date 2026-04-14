import React, { useState, useEffect } from 'react';
import { BookGuesserData, GameSubmission, GameType } from '../../types';
import GameInstructionsModal from './GameInstructionsModal';

const SAMPLE_DATA: BookGuesserData = {
  verses: [
    "In the beginning God created the heaven and the earth.",
    "And the earth was without form, and void; and darkness was upon the face of the deep.",
    "And God said, Let there be light: and there was light."
  ],
  answer: 'Genesis',
  options: ['Genesis', 'Exodus', 'Psalms', 'Isaiah', 'Matthew', 'Revelation']
};

interface BookGuesserGameProps {
  gameId: string;
  gameData: BookGuesserData;
  submission: GameSubmission | null;
  onComplete: () => void;
  isPreview?: boolean;
}

const BookGuesserGame: React.FC<BookGuesserGameProps> = ({ gameId, gameData, submission, onComplete, isPreview = false }) => {
  const isSample = gameId.startsWith('sample-');
  const dataToUse = isSample ? SAMPLE_DATA : gameData;

  const [revealedVerses, setRevealedVerses] = useState<number>(1);
  const [guess, setGuess] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [showInstructions, setShowInstructions] = useState(!submission && !isPreview);

  useEffect(() => {
    if (submission && submission.submissionData) {
      if (submission.submissionData.guess) {
        setGuess(submission.submissionData.guess);
      }
      if (submission.submissionData.revealedVerses) {
        setRevealedVerses(submission.submissionData.revealedVerses);
      }
      if (submission.submissionData.solved !== undefined) {
        setIsCompleted(true);
      }
    }
  }, [submission]);

  const handleRevealMore = () => {
    if (revealedVerses < dataToUse.verses.length) {
      setRevealedVerses(prev => prev + 1);
    }
  };

  const handleGuess = (selectedBook: string) => {
    if (isCompleted || guess) return;

    setGuess(selectedBook);
    const isWin = selectedBook.toLowerCase() === dataToUse.answer.toLowerCase();

    // We only allow one guess in this game
    setIsCompleted(true);
    if (!isPreview && !isSample) {
      submitResult(isWin, selectedBook);
    }
  };

  const submitResult = (solved: boolean, finalGuess: string) => {
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    // Mistake penalty calculation: 
    // They get 1 guess. If wrong, mistake = max. Max score is 50. Let's send mistake=1 if wrong, 0 if right.
    const mistakes = solved ? 0 : 3; // Setting penalty as 3 mistakes equivalent for wrong answer

    const customEvent = new CustomEvent('gameCompleted', {
      detail: {
        payload: {
          gameId,
          timeTaken,
          mistakes,
          submissionData: {
            solved,
            guess: finalGuess,
            revealedVerses,
            answer: dataToUse.answer
          }
        },
        complete: onComplete
      }
    });
    window.dispatchEvent(customEvent);
  };

  const handleStartGame = () => {
    setStartTime(Date.now());
    setShowInstructions(false);
  };

  if (showInstructions) {
    return <GameInstructionsModal gameType={GameType.BOOK_GUESSER} onStart={handleStartGame} onClose={handleStartGame} />;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col items-center">
      <h2 className="text-3xl font-bold text-white mb-6 text-center">Book Guesser {isSample && <span className="text-sm bg-blue-600 px-2 py-1 rounded ml-2">Sample</span>}</h2>

      <div className="w-full bg-gray-800 rounded-xl p-6 shadow-xl border border-gray-700 mb-8">
        <h3 className="text-xl font-semibold text-yellow-400 mb-4 border-b border-gray-700 pb-2">Where are these verses found?</h3>

        <div className="space-y-4 mb-6">
          {dataToUse.verses.slice(0, revealedVerses).map((verse, idx) => (
            <div key={idx} className="bg-gray-900 p-4 rounded-lg border-l-4 border-yellow-500 shadow-sm animate-fade-in relative group">
              <span className="absolute top-2 left-2 text-yellow-500/30 text-4xl font-serif">"</span>
              <p className="text-gray-200 text-lg leading-relaxed pl-6 relative z-10 italic">
                {verse}
              </p>
            </div>
          ))}
        </div>

        {!isCompleted && revealedVerses < dataToUse.verses.length && (
          <button
            onClick={handleRevealMore}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors mb-2 shadow-md animate-pulse"
          >
            Reveal Next Verse
          </button>
        )}
        {!isCompleted && revealedVerses >= dataToUse.verses.length && (
          <div className="text-center text-gray-400 italic mb-2">All verses revealed. Make a guess!</div>
        )}
      </div>

      <div className="w-full">
        {!isCompleted && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {dataToUse.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleGuess(opt)}
                className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-4 px-4 rounded-lg shadow transition-transform transform hover:-translate-y-1 hover:shadow-lg active:scale-95 break-words"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      {isCompleted && (
        <div className="mt-4 text-center animate-fade-in bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 w-full">
          {guess?.toLowerCase() === dataToUse.answer.toLowerCase() ? (
            <div>
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-green-400 mb-2">Excellent!</h3>
              <p className="text-gray-300 mb-6 text-lg">You correctly guessed <span className="font-bold text-white">{dataToUse.answer}</span>.</p>
            </div>
          ) : (
            <div>
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-red-500 mb-2">Incorrect</h3>
              <p className="text-gray-300 mb-6 text-lg">
                Your guess was <span className="line-through opacity-75">{guess}</span>.<br />
                The correct book was <strong className="text-white text-xl">{dataToUse.answer}</strong>.
              </p>
            </div>
          )}

          <div className="bg-gray-900 rounded-lg p-4 mb-6">
            <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Score Summary</p>
            <p className="text-gray-200">Revealed: <span className="font-bold">{revealedVerses} of {dataToUse.verses.length}</span> verses</p>
          </div>

          {isPreview && <p className="text-yellow-400 font-bold mb-4">Preview Mode Active - Not Submitting</p>}
          <button
            onClick={onComplete}
            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all w-full text-lg uppercase tracking-wide"
          >
            {isPreview ? 'Close Preview' : 'Back to Dashboard'}
          </button>
        </div>
      )}
    </div>
  );
};

export default BookGuesserGame;
