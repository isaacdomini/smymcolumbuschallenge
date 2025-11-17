import React from 'react';

const ChallengeIntro: React.FC = () => {
    return (
        <div className="bg-gray-800 rounded-lg p-6 md:p-8 text-center mb-8 border border-yellow-500/30">
            <h2 className="text-2xl md:text-3xl font-bold mb-3 text-yellow-400">Welcome to the SMYM Bible Games Challenge!</h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto">
                Join us for a fun and engaging challenge designed to test your Bible knowledge and bring our community together. 
                Each day features a new puzzle like Word of the Day, Match the Word, Connect the Words, or Crossword with a biblical theme.
            </p>
            <p className="mt-4 text-md text-gray-400">
                Sign up or log in to start playing, track your progress, and see how you rank on the leaderboard!
            </p>
        </div>
    );
};

export default ChallengeIntro;
