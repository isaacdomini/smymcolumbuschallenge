import React, { useState, useEffect } from 'react';
import { Challenge, Game, GameType } from '../../types';
import { getChallenges, getGames, createGame, deleteGame } from '../../services/api';

interface ChallengeManagerProps {
    user: any;
}

export const ChallengeManager: React.FC<ChallengeManagerProps> = ({ user }) => {
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingGame, setEditingGame] = useState<Partial<Game> | null>(null);

    useEffect(() => {
        loadChallenges();
    }, []);

    useEffect(() => {
        if (selectedChallenge) {
            loadGames(selectedChallenge.id);
        } else {
            setGames([]);
        }
    }, [selectedChallenge]);

    const loadChallenges = async () => {
        try {
            setLoading(true);
            const data = await getChallenges(user.id);
            setChallenges(data);
        } catch (err) {
            setError('Failed to load challenges');
        } finally {
            setLoading(false);
        }
    };

    const loadGames = async (challengeId: string) => {
        try {
            setLoading(true);
            const data = await getGames(user.id, challengeId);
            setGames(data);
        } catch (err) {
            setError('Failed to load games');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteGame = async (gameId: string) => {
        if (!confirm('Are you sure you want to delete this game?')) return;
        try {
            await deleteGame(user.id, gameId);
            if (selectedChallenge) loadGames(selectedChallenge.id);
        } catch (err) {
            alert('Failed to delete game');
        }
    };

    const handleSaveGame = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingGame || !selectedChallenge) return;

        try {
            // Parse data if it's a string (from textarea)
            let gameData = editingGame.data;
            if (typeof gameData === 'string') {
                try {
                    gameData = JSON.parse(gameData);
                } catch (e) {
                    alert('Invalid JSON data');
                    return;
                }
            }

            await createGame(user.id, {
                ...editingGame,
                challengeId: selectedChallenge.id,
                data: gameData
            });
            setEditingGame(null);
            loadGames(selectedChallenge.id);
        } catch (err) {
            alert('Failed to save game');
        }
    };

    const getDatesInRange = (startDate: string, endDate: string) => {
        const dates = [];
        const current = new Date(startDate);
        const end = new Date(endDate);
        // Add 12 hours to avoid timezone issues when just using date part
        current.setUTCHours(12, 0, 0, 0);
        end.setUTCHours(12, 0, 0, 0);

        while (current <= end) {
            dates.push(new Date(current).toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        return dates;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Challenge Manager</h2>
            </div>

            {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Challenge List */}
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <h3 className="text-xl font-bold text-white mb-4">Challenges</h3>
                    <div className="space-y-2">
                        {challenges.map(challenge => (
                            <button
                                key={challenge.id}
                                onClick={() => setSelectedChallenge(challenge)}
                                className={`w-full text-left p-3 rounded-lg transition-colors ${selectedChallenge?.id === challenge.id
                                        ? 'bg-yellow-500 text-gray-900 font-bold'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                            >
                                <div className="font-bold">{challenge.name}</div>
                                <div className="text-sm opacity-75">
                                    {new Date(challenge.startDate).toLocaleDateString()} - {new Date(challenge.endDate).toLocaleDateString()}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Game List / Calendar */}
                <div className="md:col-span-2 bg-gray-800 p-4 rounded-lg border border-gray-700">
                    {selectedChallenge ? (
                        <>
                            <h3 className="text-xl font-bold text-white mb-4">Games for {selectedChallenge.name}</h3>
                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                {getDatesInRange(selectedChallenge.startDate, selectedChallenge.endDate).map(date => {
                                    const game = games.find(g => g.date.startsWith(date));
                                    return (
                                        <div key={date} className="bg-gray-700 p-4 rounded-lg border border-gray-600 flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-white">
                                                    {new Date(date + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                                                </div>
                                                <div className="text-sm text-gray-400">
                                                    {game ? (
                                                        <span className="text-green-400 font-bold uppercase">{game.type}</span>
                                                    ) : (
                                                        <span className="text-gray-500 italic">No game scheduled</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditingGame({
                                                        challengeId: selectedChallenge.id,
                                                        date: date,
                                                        type: game?.type || GameType.WORDLE,
                                                        data: game?.data ? JSON.stringify(game.data, null, 2) : '{}'
                                                    })}
                                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                                                >
                                                    {game ? 'Edit' : 'Create'}
                                                </button>
                                                {game && (
                                                    <button
                                                        onClick={() => handleDeleteGame(game.id)}
                                                        className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-sm"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-gray-500 py-12">
                            Select a challenge to view games
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {editingGame && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 p-6 rounded-xl max-w-2xl w-full border border-gray-700 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {games.find(g => g.date.startsWith(editingGame.date!)) ? 'Edit Game' : 'Create Game'} - {editingGame.date}
                        </h3>
                        <form onSubmit={handleSaveGame} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Game Type</label>
                                <select
                                    value={editingGame.type}
                                    onChange={e => setEditingGame({ ...editingGame, type: e.target.value as GameType })}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                >
                                    {Object.values(GameType).map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Game Data (JSON)</label>
                                <textarea
                                    value={typeof editingGame.data === 'string' ? editingGame.data : JSON.stringify(editingGame.data, null, 2)}
                                    onChange={e => setEditingGame({ ...editingGame, data: e.target.value })}
                                    className="w-full h-64 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    Enter the JSON configuration for the game.
                                </p>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setEditingGame(null)}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-lg"
                                >
                                    Save Game
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};