import React, { useState, useEffect } from 'react';
import { Challenge, Game, GameType } from '../../types';
import { getChallenges, getGames, createGame, deleteGame } from '../../services/api';
import GameBuilder from './GameBuilder';
import WordleGame from '../game/WordleGame';
import ConnectionsGame from '../game/ConnectionsGame';
import CrosswordGame from '../game/CrosswordGame';
import WordBankEditor from './WordBankEditor';

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
    const [previewGame, setPreviewGame] = useState<{ type: GameType, data: any } | null>(null);

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

    const handleSaveGame = async (gameData: any) => {
        if (!selectedChallenge) return;

        try {
            await createGame(user.id, {
                ...gameData,
                challengeId: selectedChallenge.id
            });
            setEditingGame(null);
            loadGames(selectedChallenge.id);
        } catch (err) {
            throw err; // Let GameBuilder handle the error display
        }
    };

    const handlePreview = (type: GameType, data: any) => {
        setPreviewGame({ type, data });
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

                {/* Word Bank Manager */}
                {selectedChallenge && (
                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mt-6">
                        <h3 className="text-xl font-bold text-white mb-4">Word Bank</h3>
                        <p className="text-gray-400 text-sm mb-2">One word per line. Used by 'Wordle Bank' games.</p>
                        <WordBankEditor
                            challengeId={selectedChallenge.id}
                            userId={user.id}
                            initialWords={selectedChallenge.wordBank || []}
                        />
                    </div>
                )}
            </div>

            {/* Game List / Calendar */}
            <div className="md:col-span-2 bg-gray-800 p-4 rounded-lg border border-gray-700">
                {selectedChallenge ? (
                    <>
                        <h3 className="text-xl font-bold text-white mb-4">Games for {selectedChallenge.name}</h3>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                            {getDatesInRange(selectedChallenge.startDate, selectedChallenge.endDate).map(date => {
                                const gamesForDate = games.filter(g => g.date.startsWith(date));
                                return (
                                    <div key={date} className="bg-gray-700 p-4 rounded-lg border border-gray-600 flex flex-col gap-2">
                                        <div className="flex justify-between items-center border-b border-gray-600 pb-2 mb-2">
                                            <div className="font-bold text-white">
                                                {new Date(date + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                                            </div>
                                            <button
                                                onClick={() => setEditingGame({
                                                    challengeId: selectedChallenge.id,
                                                    date: date,
                                                    type: GameType.WORDLE, // Default
                                                    data: {}
                                                })}
                                                className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-bold"
                                            >
                                                + Add Game
                                            </button>
                                        </div>

                                        {gamesForDate.length > 0 ? (
                                            gamesForDate.map(game => (
                                                <div key={game.id} className="flex justify-between items-center bg-gray-800 p-2 rounded">
                                                    <span className="text-green-400 font-bold uppercase text-sm">{game.type.replace(/_/g, ' ')}</span>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => setEditingGame(game)}
                                                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteGame(game.id)}
                                                            className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-sm text-gray-500 italic p-2">No games scheduled</div>
                                        )}
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


            {/* Edit Modal */}
            {
                editingGame && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-gray-800 rounded-xl max-w-4xl w-full border border-gray-700 max-h-[90vh] overflow-y-auto">
                            <GameBuilder
                                initialData={editingGame}
                                challengeId={editingGame.challengeId}
                                date={editingGame.date}
                                challenges={challenges}
                                onSave={handleSaveGame}
                                onCancel={() => setEditingGame(null)}
                                onPreview={handlePreview}
                            />
                        </div>
                    </div>
                )
            }

            {/* Preview Modal */}
            {
                previewGame && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]">
                        <div className="bg-gray-900 p-6 rounded-xl max-w-4xl w-full border border-gray-700 max-h-[90vh] overflow-y-auto relative">
                            <button
                                onClick={() => setPreviewGame(null)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-white"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>

                            <div className="mt-4">
                                {previewGame.type === GameType.WORDLE && (
                                    <WordleGame
                                        gameId="preview-wordle"
                                        gameData={previewGame.data}
                                        onComplete={() => setPreviewGame(null)}
                                        isPreview={true}
                                    />
                                )}
                                {previewGame.type === GameType.CONNECTIONS && (
                                    <ConnectionsGame
                                        gameId="preview-connections"
                                        gameData={previewGame.data}
                                        onComplete={() => setPreviewGame(null)}
                                        isPreview={true}
                                    />
                                )}
                                {previewGame.type === GameType.CROSSWORD && (
                                    <CrosswordGame
                                        gameId="preview-crossword"
                                        gameData={previewGame.data}
                                        onComplete={() => setPreviewGame(null)}
                                        isPreview={true}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};