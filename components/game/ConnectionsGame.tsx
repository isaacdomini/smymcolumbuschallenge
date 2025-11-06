import React, { useState, useEffect } from 'react';
import { ConnectionsData, GameSubmission } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { submitGame } from '../../services/api';

interface ConnectionsGameProps {
  gameId: string;
  gameData: ConnectionsData;
  submission?: GameSubmission | null;
  onComplete: () => void;
}

const ConnectionsGame: React.FC<ConnectionsGameProps> = ({ gameId, gameData, submission, onComplete }) => {
  const { user } = useAuth();
  const [words, setWords] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [foundGroups, setFoundGroups] = useState<ConnectionsData['categories']>([]);
  const [mistakes, setMistakes] = useState(0);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [startTime] = useState(Date.now());
  const isReadOnly = !!submission;

  useEffect(() => {
    if (isReadOnly && submission) {
      // In revisit mode, show the full solution
      setFoundGroups(gameData.categories);
      setWords([]);
      setMistakes(submission.mistakes);
      setGameState(submission.mistakes >= 4 ? 'lost' : 'won');
    } else {
      // Shuffle words for a new game
      setWords([...gameData.words].sort(() => Math.random() - 0.5));
    }
  }, [gameData, isReadOnly, submission]);

  const handleWordClick = (word: string) => {
    if (gameState !== 'playing' || isReadOnly || foundGroups.flatMap(g => g.words).includes(word)) return;
    
    if (selected.includes(word)) {
      setSelected(prev => prev.filter(w => w !== word));
    } else if (selected.length < 4) {
      setSelected(prev => [...prev, word]);
    }
  };

  const handleSubmit = () => {
    if (selected.length !== 4) return;
    
    const correctGroup = gameData.categories.find(category => 
      category.words.every(word => selected.includes(word)) &&
      selected.every(word => category.words.includes(word))
    );
    
    if (correctGroup) {
      setFoundGroups(prev => [...prev, correctGroup]);
      setWords(prev => prev.filter(w => !selected.includes(w)));
      setSelected([]);
      if (foundGroups.length === 3) {
        setGameState('won');
      }
    } else {
      setMistakes(prev => prev + 1);
      if (mistakes + 1 >= 4) {
        setGameState('lost');
      }
    }
  };

  useEffect(() => {
     const saveResult = async () => {
        if ((gameState === 'won' || gameState === 'lost') && !isReadOnly) {
            if (!user) return;
            const timeTaken = Math.round((Date.now() - startTime) / 1000);
            await submitGame({
                userId: user.id,
                gameId,
                timeTaken,
                mistakes,
                submissionData: { foundGroups: foundGroups.map(g => g.name) }
            });
            setTimeout(onComplete, 3000);
        }
     }
     saveResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, user, isReadOnly]);
  
  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-2">Connections</h2>
      <p className="mb-4 text-gray-400">Create four groups of four!</p>
      
      <div className="w-full space-y-2 mb-4">
        {foundGroups.map(group => (
          <div key={group.name} className="bg-green-800 p-4 rounded-lg text-center">
            <p className="font-bold">{group.name}</p>
            <p>{group.words.join(', ')}</p>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-4 gap-2 w-full mb-4">
        {words.map(word => (
          <button 
            key={word} 
            onClick={() => handleWordClick(word)}
            className={`h-20 rounded-md font-semibold text-center transition-colors ${selected.includes(word) ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            {word}
          </button>
        ))}
      </div>
      
      {!isReadOnly && gameState === 'playing' && (
        <>
        <div className="flex items-center space-x-4 mb-4">
            <span>Mistakes remaining:</span>
            <div className="flex space-x-2">
                {Array.from(Array(4 - mistakes)).map((_, i) => <div key={i} className="w-4 h-4 bg-yellow-400 rounded-full"></div>)}
                {Array.from(Array(mistakes)).map((_, i) => <div key={i} className="w-4 h-4 bg-gray-600 rounded-full"></div>)}
            </div>
        </div>
        
        <button 
            onClick={handleSubmit} 
            disabled={selected.length !== 4}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
            Submit
        </button>
        </>
      )}

      {(gameState !== 'playing' || isReadOnly) && (
        <div className="mt-4 text-center p-4 rounded-lg bg-gray-800 w-full">
            {gameState === 'won' && <p className="text-xl text-green-400 font-bold">Congratulations!</p>}
            {gameState === 'lost' && <p className="text-xl text-red-400 font-bold">Better luck next time!</p>}
            {isReadOnly && submission && (
              <div className="mt-4 text-sm text-gray-300">
                <p>Time Taken: {submission.timeTaken}s | Mistakes: {submission.mistakes} | Score: {submission.score}</p>
              </div>
            )}
            <button onClick={onComplete} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                Back
            </button>
        </div>
      )}
    </div>
  );
};

export default ConnectionsGame;
