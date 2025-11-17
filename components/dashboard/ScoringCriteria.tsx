import React, { useState, useEffect } from 'react';
import { getScoringCriteria } from '@/services/api';

interface Criteria {
  title: string;
  description: string;
  points: string[];
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
        <div className="grid md:grid-cols-3 gap-6">
          {criteria.map((item) => (
            <div key={item.title} className="bg-gray-700/50 p-4 rounded-lg border-l-4 border-yellow-500">
              <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
              <p className="text-gray-300 mb-3 text-sm">{item.description}</p>
              <ul className="list-none space-y-1 text-gray-400 text-sm">
                {item.points.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScoringCriteria;