import React, { useEffect, useState } from 'react';
import { Challenge } from '../../types';
import { getUserChallenges } from '../../services/api';

interface MyChallengesProps {
  onSelectChallenge: (challengeId: string) => void;
  onBack: () => void;
}

const MyChallenges: React.FC<MyChallengesProps> = ({ onSelectChallenge, onBack }) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const data = await getUserChallenges();
        setChallenges(data);
      } catch (err) {
        console.error("Failed to load challenges", err);
        setError('Failed to load your challenge history.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchChallenges();
  }, []);

  return (
    <div className="animate-fade-in pb-12">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="text-gray-300 hover:text-white mr-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-white">My Challenge History</h1>
      </div>

      {isLoading ? (
        <div className="text-center p-8">Loading...</div>
      ) : error ? (
        <div className="text-center text-red-400 p-8">{error}</div>
      ) : challenges.length === 0 ? (
        <div className="text-center text-gray-400 p-8">
          <p>You haven't participated in any challenges yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {challenges.map((challenge) => (
            <div
              key={challenge.id}
              onClick={() => onSelectChallenge(challenge.id)}
              className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 hover:border-yellow-500 cursor-pointer transition-all transform hover:scale-[1.02]"
            >
              <h3 className="text-xl font-bold text-white mb-2">{challenge.name}</h3>
              <div className="text-sm text-gray-400">
                <p>Start: {new Date(challenge.startDate).toLocaleDateString()}</p>
                <p>End: {new Date(challenge.endDate).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyChallenges;
