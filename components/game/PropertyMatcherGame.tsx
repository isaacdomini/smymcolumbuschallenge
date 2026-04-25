import React, { useState, useEffect, useMemo } from 'react';
import { PropertyMatcherData, GameSubmission, GameType } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { submitGame } from '../../services/api';
import GameInstructionsModal from './GameInstructionsModal';

const SAMPLE_DATA: PropertyMatcherData = {
  answer: 'Moses',
  properties: ['Testament', 'Role', 'Gender', 'Era'],
  options: [
    { name: 'Moses', values: { 'Testament': 'Old', 'Role': 'Prophet', 'Gender': 'Male', 'Era': 'Exodus' } },
    { name: 'David', values: { 'Testament': 'Old', 'Role': 'King', 'Gender': 'Male', 'Era': 'United Kingdom' } },
    { name: 'Esther', values: { 'Testament': 'Old', 'Role': 'Queen', 'Gender': 'Female', 'Era': 'Exile' } },
    { name: 'Paul', values: { 'Testament': 'New', 'Role': 'Apostle', 'Gender': 'Male', 'Era': 'Early Church' } },
    { name: 'Ruth', values: { 'Testament': 'Old', 'Role': 'Ancestor', 'Gender': 'Female', 'Era': 'Judges' } },
    { name: 'Peter', values: { 'Testament': 'New', 'Role': 'Apostle', 'Gender': 'Male', 'Era': 'Early Church' } },
    { name: 'Abraham', values: { 'Testament': 'Old', 'Role': 'Patriarch', 'Gender': 'Male', 'Era': 'Patriarchal' } },
    { name: 'Mary', values: { 'Testament': 'New', 'Role': 'Mother of Jesus', 'Gender': 'Female', 'Era': 'Gospel' } },
  ]
};

interface PropertyMatcherGameProps {
  gameId: string;
  gameData: PropertyMatcherData;
  submission: GameSubmission | null;
  onComplete: () => void;
  isPreview?: boolean;
}

const PropertyMatcherGame: React.FC<PropertyMatcherGameProps> = ({ gameId, gameData, submission, onComplete, isPreview = false }) => {
  const { user } = useAuth();
  const isSample = gameId.startsWith('sample-');
  const dataToUse = isSample ? SAMPLE_DATA : gameData;

  const [guesses, setGuesses] = useState<typeof dataToUse.options>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [showInstructions, setShowInstructions] = useState(!submission && !isPreview);
  const maxGuesses = 6;

  // Masked answer might just be regular answer for logic, relying on gameData.answer
  // If we are given answer, we evaluate correctness based on it.
  const targetOption = useMemo(() => {
    return dataToUse.options.find(opt => opt.name.toLowerCase() === dataToUse.answer.toLowerCase());
  }, [dataToUse]);

  useEffect(() => {
    if (submission && submission.submissionData) {
      if (submission.submissionData.guesses) {
        setGuesses(submission.submissionData.guesses);
      }
      if (submission.submissionData.solved !== undefined) {
        setIsCompleted(true);
      }
    }
  }, [submission]);

  const availableOptions = useMemo(() => {
    return dataToUse.options
      .filter(opt => !guesses.some(g => g.name === opt.name))
      .filter(opt => opt.name.toLowerCase().includes(currentGuess.toLowerCase()));
  }, [dataToUse.options, guesses, currentGuess]);

  const handleGuess = (optionName: string) => {
    if (isCompleted || guesses.length >= maxGuesses) return;

    const option = dataToUse.options.find(opt => opt.name === optionName);
    if (!option) return;

    const newGuesses = [...guesses, option];
    setGuesses(newGuesses);
    setCurrentGuess('');

    const isWin = option.name.toLowerCase() === dataToUse.answer.toLowerCase();
    if (isWin || newGuesses.length >= maxGuesses) {
      setIsCompleted(true);
      if (!isPreview && !isSample) {
        submitResult(isWin, newGuesses);
      }
    }
  };

  const submitResult = async (solved: boolean, finalGuesses: typeof gameData.options) => {
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    const mistakes = solved ? finalGuesses.length - 1 : maxGuesses;
    try {
      await submitGame({
        userId: user.id,
        gameId,
        startedAt: new Date(startTime).toISOString(),
        timeTaken,
        mistakes,
        submissionData: {
          solved,
          guesses: finalGuesses,
          answer: dataToUse.answer
        }
      });
    } catch (err) {
      console.error('PropertyMatcher submit failed:', err);
    } finally {
      setIsSubmitting(false);
      setTimeout(onComplete, 2000);
    }
  };

  const handleStartGame = () => {
    setStartTime(Date.now());
    setShowInstructions(false);
  };

  if (showInstructions) {
    return <GameInstructionsModal gameType={GameType.PROPERTY_MATCHER} onStart={handleStartGame} onClose={handleStartGame} />;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col items-center">
      <h2 className="text-3xl font-bold text-white mb-6 text-center">Property Matcher {isSample && <span className="text-sm bg-blue-600 px-2 py-1 rounded ml-2">Sample</span>}</h2>

      {/* Guesses Grid */}
      <div className="w-full mb-6 overflow-x-auto">
        <div className="min-w-max border border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-left text-sm text-gray-200">
            <thead className="bg-gray-800 text-gray-400 capitalize">
              <tr>
                <th className="px-4 py-3 border-b border-gray-700 font-semibold">Guess</th>
                {dataToUse.properties.map((prop, idx) => (
                  <th key={idx} className="px-4 py-3 border-b border-gray-700 font-semibold">{prop}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guesses.map((guess, idx) => {
                const isCorrectStr = guess.name.toLowerCase() === dataToUse.answer.toLowerCase();
                return (
                  <tr key={idx} className="border-b border-gray-700 bg-gray-900">
                    <td className={`px-4 py-3 font-medium ${isCorrectStr ? 'text-green-400' : 'text-gray-200'}`}>
                      {guess.name}
                    </td>
                    {dataToUse.properties.map((prop, pIdx) => {
                      const guessVal = guess.values[prop];
                      const targetVal = targetOption?.values[prop];
                      let matchColor = 'bg-gray-600'; // unknown
                      if (targetVal) {
                        if (guessVal.toLowerCase() === targetVal.toLowerCase()) {
                          matchColor = 'bg-green-600 border-green-500';
                        } else {
                          matchColor = 'bg-red-900 border-red-700'; // red if mismatch entirely
                        }
                      }
                      return (
                        <td key={pIdx} className="px-4 py-3">
                          <div className={`px-3 py-1 rounded border inline-block text-xs font-bold shadow-sm ${matchColor} text-white`}>
                            {guessVal}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {/* Empty Rows Padding */}
              {Array.from({ length: Math.max(0, maxGuesses - guesses.length) }).map((_, idx) => (
                <tr key={`empty-${idx}`} className="border-b border-gray-700 bg-gray-800/50">
                  <td className="px-4 py-4">&nbsp;</td>
                  {dataToUse.properties.map((_, pIdx) => (
                    <td key={`empty-prop-${pIdx}`} className="px-4 py-4">&nbsp;</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Input Section */}
      {!isCompleted && (
        <div className="w-full max-w-md relative">
          <div className="text-gray-400 mb-2 font-semibold">
            Guesses remaining: <span className="text-white">{maxGuesses - guesses.length}</span> / {maxGuesses}
          </div>
          <input
            type="text"
            className="w-full bg-gray-800 text-white rounded-lg p-4 outline-none focus:ring-2 focus:ring-yellow-500 placeholder-gray-500"
            placeholder="Search for a character..."
            value={currentGuess}
            onChange={(e) => setCurrentGuess(e.target.value)}
          />
          {currentGuess.length > 0 && availableOptions.length > 0 && (
            <ul className="absolute z-10 w-full bg-gray-700 text-white rounded-lg mt-1 max-h-60 overflow-y-auto shadow-xl">
              {availableOptions.slice(0, 10).map((opt, idx) => (
                <li
                  key={idx}
                  className="px-4 py-3 hover:bg-gray-600 cursor-pointer border-b border-gray-600 last:border-b-0 transition-colors"
                  onClick={() => handleGuess(opt.name)}
                >
                  {opt.name}
                </li>
              ))}
              {availableOptions.length > 10 && (
                <li className="px-4 py-2 text-sm text-gray-400 text-center italic">
                  Keep typing to see more...
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Completion Message */}
      {isCompleted && (
        <div className="mt-8 text-center animate-fade-in bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 w-full max-w-md">
          {guesses.some(g => g.name.toLowerCase() === dataToUse.answer.toLowerCase()) ? (
            <div>
              <h3 className="text-3xl font-bold text-green-400 mb-2">Correct!</h3>
              <p className="text-gray-300 mb-6">You found the right property match.</p>
            </div>
          ) : (
            <div>
              <h3 className="text-3xl font-bold text-red-500 mb-2">Game Over!</h3>
              <p className="text-gray-300 mb-6">The correct answer was <strong className="text-white text-xl">{dataToUse.answer}</strong>.</p>
            </div>
          )}
          {isPreview && <p className="text-yellow-400 font-semibold mb-4">Preview Mode Active - Not Submitting</p>}
          <button
            onClick={onComplete}
            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all block w-full"
          >
            {isPreview ? 'Close Preview' : 'Back to Dashboard'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PropertyMatcherGame;
