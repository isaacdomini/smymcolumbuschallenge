import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BookGuesserData, GameSubmission, GameType } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { submitGame } from '../../services/api';
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
  const { user } = useAuth();
  const isSample = gameId.startsWith('sample-');
  const dataToUse = isSample ? SAMPLE_DATA : gameData;

  const [revealedVerses, setRevealedVerses] = useState<number>(1);
  const [guess, setGuess] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const submitResult = async (solved: boolean, finalGuess: string) => {
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    // mistakes=0 for correct (max bonus), mistakes=3 for wrong (score will be 0 server-side)
    const mistakes = solved ? 0 : 3;
    try {
      await submitGame({
        userId: user.id,
        gameId,
        startedAt: new Date(startTime).toISOString(),
        timeTaken,
        mistakes,
        submissionData: {
          solved,
          guess: finalGuess,
          revealedVerses,
          answer: dataToUse.answer
        }
      });
    } catch (err) {
      console.error('BookGuesser submit failed:', err);
    } finally {
      setIsSubmitting(false);
      setTimeout(onComplete, 2000);
    }
  };

  const handleStartGame = () => {
    setStartTime(Date.now());
    setShowInstructions(false);
  };

  // --- Header Timer ---
  const isReadOnly = !!submission;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderTarget(document.getElementById('game-header-target'));
  }, []);

  useEffect(() => {
    if (!startTime || isCompleted || isReadOnly || showInstructions) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, isCompleted, isReadOnly, showInstructions]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const headerControls = (
    <div className="flex items-center gap-2">
      <h2 className="text-lg font-bold text-yellow-400 leading-none mr-2 hidden sm:block">
        Book Guesser {isSample && <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded ml-1 align-middle">Sample</span>}
      </h2>
      <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-700/50">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <span className="font-mono text-zinc-100 font-bold text-sm tracking-wide">
          {isReadOnly && submission ? formatTime(submission.timeTaken) : formatTime(elapsedSeconds)}
        </span>
      </div>
      <button onClick={() => setShowInstructions(true)} className="text-zinc-400 hover:text-white p-1.5 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700/50 bg-zinc-900" title="Show Instructions">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      </button>
    </div>
  );

  if (showInstructions) {
    return <GameInstructionsModal gameType={GameType.BOOK_GUESSER} onStart={handleStartGame} onClose={handleStartGame} />;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col items-center">
      {headerTarget && createPortal(headerControls, headerTarget)}

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
