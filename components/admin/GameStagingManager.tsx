import React, { useState, useEffect } from 'react';
import { StagingGame, GameType, Challenge } from '../../types';
import { getStagingGames, generateStagingGames, promoteStagingGame, deleteStagingGame, getChallenges } from '../../services/api';
import { getGroups } from '../../services/groups';
import WordleGame from '../game/WordleGame';
import ConnectionsGame from '../game/ConnectionsGame';
import CrosswordGame from '../game/CrosswordGame';
import MatchTheWordGame from '../game/MatchTheWordGame';
import VerseScrambleGame from '../game/VerseScrambleGame';
import WhoAmIGame from '../game/WhoAmIGame';
import WordSearchGame from '../game/WordSearchGame';
import PropertyMatcherGame from '../game/PropertyMatcherGame';
import BookGuesserGame from '../game/BookGuesserGame';

interface GameStagingManagerProps {
    userId: string;
}

const ALLOWED_GAME_TYPES = [
    GameType.WORDLE,
    GameType.WORDLE_ADVANCED,
    GameType.CONNECTIONS,
    GameType.CROSSWORD,
    GameType.MATCH_THE_WORD,
    GameType.VERSE_SCRAMBLE,
    GameType.WHO_AM_I,
    GameType.WORD_SEARCH,
    GameType.PROPERTY_MATCHER,
    GameType.BOOK_GUESSER,
];

const GameStagingManager: React.FC<GameStagingManagerProps> = ({ userId }) => {
    const [suggestions, setSuggestions] = useState<StagingGame[]>([]);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [previewGame, setPreviewGame] = useState<StagingGame | null>(null);
    const [viewRawGame, setViewRawGame] = useState<StagingGame | null>(null);
    const [promoteGameId, setPromoteGameId] = useState<string | null>(null);
    
    // Promote Form
    const [selectedChallengeId, setSelectedChallengeId] = useState('');
    const [selectedDate, setSelectedDate] = useState('');

    // Generate Form
    const [generateTypes, setGenerateTypes] = useState<string[]>([]);
    const [showGenerateModal, setShowGenerateModal] = useState(false);

    useEffect(() => {
        fetchSuggestions();
        fetchMetadata();
    }, [userId]);

    const fetchMetadata = async () => {
        try {
            const [fetchedChallenges, fetchedGroups] = await Promise.all([
                getChallenges(userId),
                getGroups(userId)
            ]);
            setChallenges(fetchedChallenges);
            setGroups(fetchedGroups);
        } catch (err) {
            console.error('Failed to fetch challenges or groups', err);
        }
    };

    const fetchSuggestions = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getStagingGames(userId, { status: 'pending' });
            setSuggestions(data);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch game suggestions');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (generateTypes.length === 0) return;
        setGenerating(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await generateStagingGames(userId, generateTypes);
            setSuccess(res.message);
            setShowGenerateModal(false);
            setGenerateTypes([]);
            fetchSuggestions();
        } catch (err: any) {
            setError(err.message || 'Failed to generate games');
        } finally {
            setGenerating(false);
        }
    };

    const handlePromote = async () => {
        if (!promoteGameId || !selectedChallengeId || !selectedDate) return;
        setLoading(true);
        setError(null);
        try {
            await promoteStagingGame(userId, promoteGameId, selectedChallengeId, selectedDate);
            setSuccess('Game promoted successfully!');
            setPromoteGameId(null);
            setSelectedChallengeId('');
            setSelectedDate('');
            fetchSuggestions();
        } catch (err: any) {
            setError(err.message || 'Failed to promote game');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to dismiss this suggestion?')) return;
        setLoading(true);
        try {
            await deleteStagingGame(userId, id);
            setSuccess('Suggestion dismissed.');
            fetchSuggestions();
        } catch (err: any) {
            setError(err.message || 'Failed to delete suggestion');
        } finally {
            setLoading(false);
        }
    };

    const toggleGenerateType = (type: string) => {
        setGenerateTypes(prev => 
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const renderPreview = () => {
        if (!previewGame) return null;
        
        // Render the actual playable game component
        let gameElement = null;
        const noop = () => {};

        switch (previewGame.type) {
            case GameType.WORDLE:
            case GameType.WORDLE_ADVANCED:
                gameElement = <WordleGame gameData={previewGame.data} onComplete={noop} gameId="preview" />; break;
            case GameType.CONNECTIONS:
                gameElement = <ConnectionsGame gameData={previewGame.data} onComplete={noop} gameId="preview" />; break;
            case GameType.CROSSWORD:
                gameElement = <CrosswordGame gameData={previewGame.data} onComplete={noop} gameId="preview" />; break;
            case GameType.MATCH_THE_WORD:
                gameElement = <MatchTheWordGame gameData={previewGame.data} onComplete={noop} gameId="preview" />; break;
            case GameType.VERSE_SCRAMBLE:
                gameElement = <VerseScrambleGame gameData={previewGame.data} onComplete={noop} gameId="preview" />; break;
            case GameType.WHO_AM_I:
                gameElement = <WhoAmIGame gameData={previewGame.data} onComplete={noop} gameId="preview" />; break;
            case GameType.WORD_SEARCH:
                gameElement = <WordSearchGame gameData={previewGame.data} onComplete={noop} gameId="preview" />; break;
            case GameType.PROPERTY_MATCHER:
                gameElement = <PropertyMatcherGame gameData={previewGame.data} onComplete={noop} gameId="preview" />; break;
            case GameType.BOOK_GUESSER:
                gameElement = <BookGuesserGame gameData={previewGame.data} onComplete={noop} gameId="preview" />; break;
            default:
                gameElement = <div className="text-white">Preview not available for this type.</div>;
        }

        return (
            <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto flex flex-col items-center py-8">
                <div className="w-full max-w-lg flex justify-between items-center mb-4 px-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider">{previewGame.type.replace(/_/g, ' ')} PREVIEW</h2>
                    <button 
                        onClick={() => setPreviewGame(null)}
                        className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full"
                    >
                        ✕
                    </button>
                </div>
                <div className="w-full max-w-lg bg-gray-900 rounded-xl overflow-hidden shadow-2xl relative" style={{ minHeight: '600px' }}>
                    {/* The game component assumes it's in a normal flow. We wrapper it here */}
                    {gameElement}
                </div>
            </div>
        );
    };

    const renderRawJsonModal = () => {
        if (!viewRawGame) return null;
        return (
            <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto p-4 flex justify-center items-start sm:items-center">
                <div className="bg-gray-800 p-6 rounded-xl max-w-2xl w-full shadow-2xl border border-gray-700 my-8 sm:my-0 flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <span>{'{ }'}</span> Raw Game Data
                        </h3>
                        <button 
                            onClick={() => setViewRawGame(null)}
                            className="bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-grow bg-gray-900 rounded border border-gray-700">
                        <pre className="p-4 text-green-400 text-sm overflow-x-auto">
                            {JSON.stringify(viewRawGame.data, null, 2)}
                        </pre>
                    </div>
                </div>
            </div>
        );
    };

    const renderPromoteModal = () => {
        if (!promoteGameId) return null;
        return (
            <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto p-4 flex justify-center items-start sm:items-center">
                <div className="bg-gray-800 p-6 rounded-xl max-w-md w-full shadow-2xl border border-gray-700 my-8 sm:my-0">
                    <h3 className="text-xl font-bold text-white mb-4">Promote Game to Live</h3>
                    <p className="text-gray-400 mb-6 text-sm">Select the challenge and date to assign this game to.</p>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-gray-300 text-sm font-bold mb-2">Challenge</label>
                            <select
                                className="w-full bg-gray-700 text-white rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={selectedChallengeId}
                                onChange={(e) => setSelectedChallengeId(e.target.value)}
                            >
                                <option value="">Select Challenge...</option>
                                {challenges.map(c => {
                                    const group = groups.find((g: any) => g.id === c.group_id);
                                    return (
                                        <option key={c.id} value={c.id}>
                                            {c.name} ({group?.name || 'Unknown Group'})
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-300 text-sm font-bold mb-2">Date</label>
                            <input
                                type="date"
                                className="w-full bg-gray-700 text-white rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>
                        
                        <div className="flex justify-end gap-3 mt-8">
                            <button
                                onClick={() => setPromoteGameId(null)}
                                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePromote}
                                disabled={!selectedChallengeId || !selectedDate || loading}
                                className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded font-bold disabled:opacity-50 transition-colors"
                            >
                                {loading ? 'Promoting...' : 'Promote'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderGenerateModal = () => {
        if (!showGenerateModal) return null;
        return (
            <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto p-4 flex justify-center items-start sm:items-center">
                <div className="bg-gray-800 p-6 rounded-xl max-w-md w-full shadow-2xl border border-gray-700 my-8 sm:my-0">
                    <h3 className="text-xl font-bold text-white mb-4">Generate Game Suggestions</h3>
                    <p className="text-gray-400 mb-6 text-sm">Select which game types you want the AI to generate new suggestions for. (Takes 1-3 mins per game)</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {ALLOWED_GAME_TYPES.map(type => (
                            <label key={type} className="flex items-center p-3 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={generateTypes.includes(type)}
                                    onChange={() => toggleGenerateType(type)}
                                    className="mr-3 h-5 w-5 rounded border-gray-500 text-blue-500 focus:ring-blue-500 bg-gray-800"
                                />
                                <span className="text-white capitalize text-sm font-medium">{type.replace(/_/g, ' ')}</span>
                            </label>
                        ))}
                    </div>
                    
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setShowGenerateModal(false)}
                            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={generateTypes.length === 0 || generating}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                            {generating ? (
                                <>
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                    Generating...
                                </>
                            ) : (
                                'Generate Now'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span>🎮</span> AI Game Suggestions
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">Review and promote AI-generated games to live challenges.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchSuggestions}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-bold transition-colors"
                    >
                        ↻ Refresh
                    </button>
                    <button
                        onClick={() => setShowGenerateModal(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold transition-colors"
                    >
                        + Generate New
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded mb-6 flex justify-between items-center">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">✕</button>
                </div>
            )}
            
            {success && (
                <div className="bg-green-900/50 border border-green-500 text-green-200 p-4 rounded mb-6 flex justify-between items-center">
                    <span>{success}</span>
                    <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-200">✕</button>
                </div>
            )}

            {loading && !generating ? (
                <div className="text-center py-12 text-gray-400 flex flex-col items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-4 border-gray-500 border-t-transparent rounded-full mb-4"></div>
                    <p>Loading suggestions...</p>
                </div>
            ) : suggestions.length === 0 ? (
                <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800">
                    <div className="text-4xl mb-4">🤖</div>
                    <h3 className="text-xl font-bold text-white mb-2">No pending suggestions</h3>
                    <p className="text-gray-400 mb-6">The AI hasn't generated any new games, or all have been reviewed.</p>
                    <button
                        onClick={() => setShowGenerateModal(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold transition-colors"
                    >
                        Generate Games Now
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {suggestions.map(suggestion => (
                        <div key={suggestion.id} className="bg-gray-900 border border-gray-700 rounded-xl p-5 flex flex-col hover:border-gray-500 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <span className="bg-blue-900/50 text-blue-300 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                                    {suggestion.type.replace(/_/g, ' ')}
                                </span>
                                <span className="text-gray-500 text-xs">
                                    {new Date(suggestion.generated_at).toLocaleDateString()}
                                </span>
                            </div>
                            
                            <div className="flex-grow mb-6">
                                <p className="text-gray-300 text-sm italic">
                                    "A new auto-generated game ready for review."
                                </p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPreviewGame(suggestion)}
                                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-bold transition-colors flex justify-center items-center gap-2"
                                    >
                                        <span>👁️</span> Preview
                                    </button>
                                    <button
                                        onClick={() => setViewRawGame(suggestion)}
                                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-bold transition-colors flex justify-center items-center gap-2"
                                    >
                                        <span>{'{ }'}</span> JSON
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPromoteGameId(suggestion.id)}
                                        className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded font-bold transition-colors"
                                    >
                                        Promote
                                    </button>
                                    <button
                                        onClick={() => handleDelete(suggestion.id)}
                                        className="bg-red-900 hover:bg-red-800 text-red-200 px-4 rounded font-bold transition-colors"
                                        title="Dismiss Suggestion"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {renderPreview()}
            {renderRawJsonModal()}
            {renderPromoteModal()}
            {renderGenerateModal()}
        </div>
    );
};

export default GameStagingManager;
