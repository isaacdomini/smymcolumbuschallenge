import React, { useState, useEffect } from 'react';
import { Challenge, GameType } from '../../types';
import { createGame, getChallenges } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const GameBuilder: React.FC = () => {
    const { user } = useAuth();
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [selectedChallenge, setSelectedChallenge] = useState('');
    const [date, setDate] = useState('');
    const [gameType, setGameType] = useState<GameType>(GameType.WORDLE);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // Wordle State
    const [wordleSolution, setWordleSolution] = useState('');

    // Connections State
    const [connectionsCategories, setConnectionsCategories] = useState([
        { name: '', words: ['', '', '', ''] },
        { name: '', words: ['', '', '', ''] },
        { name: '', words: ['', '', '', ''] },
        { name: '', words: ['', '', '', ''] },
    ]);

    // Crossword State
    const [crosswordJson, setCrosswordJson] = useState('');

    useEffect(() => {
        if (user?.id) {
            getChallenges(user.id).then(setChallenges).catch(console.error);
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id) return;
        setIsLoading(true);
        setMessage({ text: '', type: '' });

        try {
            let gameData: any = {};
            if (gameType === GameType.WORDLE) {
                gameData = { solution: wordleSolution.toUpperCase() };
            } else if (gameType === GameType.CONNECTIONS) {
                gameData = {
                    categories: connectionsCategories.map(c => ({
                        name: c.name.toUpperCase(),
                        words: c.words.map(w => w.toUpperCase())
                    })),
                    words: connectionsCategories.flatMap(c => c.words).map(w => w.toUpperCase())
                };
            } else if (gameType === GameType.CROSSWORD) {
                try {
                    gameData = JSON.parse(crosswordJson);
                    if (!gameData.rows || !gameData.cols) {
                         throw new Error("Crossword JSON must include 'rows' and 'cols'.");
                    }
                } catch (err: any) {
                    throw new Error("Invalid Crossword JSON: " + err.message);
                }
            }

            await createGame(user.id, {
                challengeId: selectedChallenge,
                date,
                type: gameType,
                data: gameData
            });

            setMessage({ text: 'Game created successfully!', type: 'success' });
            if (gameType === GameType.WORDLE) setWordleSolution('');
        } catch (error: any) {
            setMessage({ text: error.message || 'Failed to create game', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleConnectionChange = (catIndex: number, wordIndex: number | null, value: string) => {
        const newCats = [...connectionsCategories];
        if (wordIndex === null) {
            newCats[catIndex].name = value;
        } else {
            newCats[catIndex].words[wordIndex] = value;
        }
        setConnectionsCategories(newCats);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700">
            <h2 className="text-2xl font-bold text-yellow-400 mb-6">Game Builder</h2>
            
            {message.text && (
                <div className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Challenge</label>
                        <select 
                            value={selectedChallenge} 
                            onChange={e => setSelectedChallenge(e.target.value)}
                            required
                            className="w-full p-2 bg-gray-900 border border-gray-700 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white"
                        >
                            <option value="">Select Challenge</option>
                            {challenges.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
                        <input 
                            type="date" 
                            value={date} 
                            onChange={e => setDate(e.target.value)}
                            required
                            className="w-full p-2 bg-gray-900 border border-gray-700 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Game Type</label>
                        <select 
                            value={gameType} 
                            onChange={e => setGameType(e.target.value as GameType)}
                            className="w-full p-2 bg-gray-900 border border-gray-700 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white"
                        >
                            <option value={GameType.WORDLE}>Wordle</option>
                            <option value={GameType.CONNECTIONS}>Connections</option>
                            <option value={GameType.CROSSWORD}>Crossword (JSON)</option>
                        </select>
                    </div>
                </div>

                <div className="border-t border-gray-700 pt-6">
                    {gameType === GameType.WORDLE && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Solution Word (5-letters standard)</label>
                            <input 
                                type="text" 
                                value={wordleSolution}
                                onChange={e => setWordleSolution(e.target.value)}
                                maxLength={5}
                                required
                                className="w-full p-2 bg-gray-900 border border-gray-700 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white uppercase"
                                placeholder="FAITH"
                            />
                        </div>
                    )}

                    {gameType === GameType.CONNECTIONS && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-400 mb-2">Enter 4 categories with 4 words each. Order them by difficulty if desired (e.g., Yellow, Green, Blue, Purple).</p>
                            {connectionsCategories.map((cat, catIdx) => (
                                <div key={catIdx} className="p-4 bg-gray-900/50 rounded border border-gray-700">
                                    <input 
                                        type="text"
                                        value={cat.name}
                                        onChange={e => handleConnectionChange(catIdx, null, e.target.value)}
                                        placeholder={`Category ${catIdx + 1} Name`}
                                        required
                                        className="w-full p-2 mb-2 bg-gray-800 border border-gray-600 rounded text-yellow-400 font-bold"
                                    />
                                    <div className="grid grid-cols-4 gap-2">
                                        {cat.words.map((word, wordIdx) => (
                                            <input 
                                                key={wordIdx}
                                                type="text"
                                                value={word}
                                                onChange={e => handleConnectionChange(catIdx, wordIdx, e.target.value)}
                                                placeholder={`Word ${wordIdx + 1}`}
                                                required
                                                className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {gameType === GameType.CROSSWORD && (
                         <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Crossword JSON Data</label>
                            <textarea 
                                value={crosswordJson}
                                onChange={e => setCrosswordJson(e.target.value)}
                                required
                                rows={10}
                                className="w-full p-2 bg-gray-900 border border-gray-700 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white font-mono text-sm"
                                placeholder='{"rows": 6, "cols": 5, "acrossClues": [...], "downClues": [...] }'
                            />
                            <p className="text-xs text-gray-500 mt-1">Paste the full JSON object for the crossword structure here. Must include 'rows' and 'cols'.</p>
                        </div>
                    )}
                </div>

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-600"
                >
                    {isLoading ? 'Creating...' : 'Create Game'}
                </button>
            </form>
        </div>
    );
};

export default GameBuilder;