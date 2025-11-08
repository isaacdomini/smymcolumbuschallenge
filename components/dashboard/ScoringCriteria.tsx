import React from 'react';

const ScoringCriteria: React.FC = () => {
  const criteria = [
    {
      title: 'Wordle',
      description: 'Your score is based solely on the number of guesses used.',
      points: [
        'Guess Score: Up to 60 points (10 points for every unused guess remaining).',
        'Losing (6 incorrect guesses) results in a score of 0.'
      ]
    },
    {
      title: 'Connections',
      description: 'Solve the puzzle by grouping words into categories.',
      points: [
        'Category Score: 20 points for each correct category found.',
        'Mistake Penalty: -5 points for each incorrect guess.'
      ]
    },
    {
      title: 'Crossword',
      description: 'Complete the crossword by solving the clues.',
      points: [
        'Accuracy Score: Up to 70 points based on the percentage of correctly filled cells.',
        'Time Bonus: Up to 30 points for a fast completion time.'
      ]
    }
  ];

  return (
    <div className="mt-12 bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-3xl font-bold text-center mb-6 text-yellow-400">How Scoring Works</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {criteria.map((item) => (
          <div key={item.title} className="bg-gray-700/50 p-4 rounded-lg border-l-4 border-yellow-500">
            <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
            <p className="text-gray-300 mb-3 text-sm">{item.description}</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400 text-sm">
              {item.points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScoringCriteria;