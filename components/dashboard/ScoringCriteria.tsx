import React, { useState, useEffect } from 'react';
import { getScoringCriteria } from '@/services/api';

interface Criteria {
  title: string;
  description: string;
  points: string[];
  hidden?: boolean;
}

const ScoringCriteria: React.FC = () => {
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCriteria = async () => {
      try {
        setLoading(true);
        const data = await getScoringCriteria();
        setCriteria(data);
      } catch (error) {
        console.error("Failed to fetch scoring criteria:", error);
        // Optionally, set an error state to show in the UI
      } finally {
        setLoading(false);
      }
    };

    fetchCriteria();
  }, []);

  return (
    <div className="mt-12 bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-3xl font-bold text-center mb-6 text-yellow-400">How Scoring Works</h2>
      {loading ? (
        <div className="text-center text-white">Loading scoring criteria...</div>
      ) : (
        <div>
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700/50 rounded-lg text-center">
            <h3 className="text-xl font-bold text-red-300 mb-2">Late Submissions & Missed Games</h3>
            <p className="text-gray-300">
              Scores receive a <strong className="font-bold text-white">20% penalty for each day</strong> submitted after the game's date.
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Games are marked as "Missed" and become unplayable <strong className="font-bold text-white">more than 5 days</strong> after their release.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {criteria.filter(c => !c.hidden).map((item) => {
              let sampleUrl = '';
              if (item.title === 'Wordle') sampleUrl = '/game/sample-wordle';
              else if (item.title === 'Connections') sampleUrl = '/game/sample-connections';
              else if (item.title === 'Crossword') sampleUrl = '/game/sample-crossword';
              else if (item.title === 'Match the Word') sampleUrl = '/game/sample-match_the_word';
              else if (item.title === 'Verse Scramble') sampleUrl = '/game/sample-verse_scramble';
              else if (item.title === 'Who Am I?') sampleUrl = '/game/sample-who_am_i';
              else if (item.title === 'Word Search') sampleUrl = '/game/sample-word_search';
              else if (item.title === 'Hangman') sampleUrl = '/game/sample-hangman';

              return (
                <div key={item.title} className="bg-gray-700/50 p-4 rounded-lg border-l-4 border-yellow-500 flex flex-col h-full">
                  <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-300 mb-3 text-sm flex-grow">{item.description}</p>
                  <ul className="list-none space-y-1 text-gray-400 text-sm">
                    {item.points.map((point, index) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                  {sampleUrl && (
                    <button
                      onClick={() => window.location.href = sampleUrl}
                      className="mt-4 w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded text-sm transition-colors"
                    >
                      Try Sample
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoringCriteria;