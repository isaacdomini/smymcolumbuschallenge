import React, { useState, useEffect } from 'react';
import { Challenge, GameType } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface GameBuilderProps {
    initialData?: any;
    challengeId?: string;
    date?: string;
    onSave: (gameData: any) => Promise<void>;
    onCancel: () => void;
    onPreview: (type: GameType, data: any) => void;
    challenges?: Challenge[]; // Optional, if passed from parent
}

const GameBuilder: React.FC<GameBuilderProps> = ({
    initialData,
    challengeId: initialChallengeId = '',
    date: initialDate = '',
    onSave,
    onCancel,
    onPreview,
    challenges = []
}) => {
    const { user } = useAuth();
    const [selectedChallenge, setSelectedChallenge] = useState(initialChallengeId);
    const [date, setDate] = useState(initialDate);
    const [gameType, setGameType] = useState<GameType>(initialData?.type || GameType.WORDLE);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // Wordle State
    const [wordleSolution, setWordleSolution] = useState('');
    const [wordleAdvancedSolutions, setWordleAdvancedSolutions] = useState<string[]>(['', '', '', '', '']);

    // Connections State
    const [connectionsCategories, setConnectionsCategories] = useState([
        { name: '', words: ['', '', '', ''] },
        { name: '', words: ['', '', '', ''] },
        { name: '', words: ['', '', '', ''] },
        { name: '', words: ['', '', '', ''] },
    ]);

    // Crossword State
    const [crosswordJson, setCrosswordJson] = useState('');

    // Match The Word State
    const [matchPairs, setMatchPairs] = useState<{ word: string, match: string }[]>([
        { word: '', match: '' },
        { word: '', match: '' },
        { word: '', match: '' },
        { word: '', match: '' },
        { word: '', match: '' }
    ]);

    // Verse Scramble State
    const [verseScrambleVerse, setVerseScrambleVerse] = useState('');
    const [verseScrambleReference, setVerseScrambleReference] = useState('');

    // Who Am I State
    const [whoAmIAnswer, setWhoAmIAnswer] = useState('');
    const [whoAmIHint, setWhoAmIHint] = useState('');
    const [whoAmISolutions, setWhoAmISolutions] = useState<{ answer: string, hint: string }[]>([{ answer: '', hint: '' }]);

    // Word Search State
    const [wordSearchWords, setWordSearchWords] = useState<string[]>(['', '', '', '', '']);
    const [wordSearchGridSize, setWordSearchGridSize] = useState(10);

    // Initialize state from initialData
    useEffect(() => {
        if (initialData) {
            setGameType(initialData.type);
            if (initialData.type === GameType.WORDLE && initialData.data?.solution) {
                setWordleSolution(initialData.data.solution);
            } else if (initialData.type === GameType.WORDLE_ADVANCED && initialData.data?.solutions) {
                setWordleAdvancedSolutions(initialData.data.solutions);
            } else if (initialData.type === GameType.CONNECTIONS && initialData.data?.categories) {
                setConnectionsCategories(initialData.data.categories);
            } else if (initialData.type === GameType.CROSSWORD && initialData.data) {
                setCrosswordJson(JSON.stringify(initialData.data, null, 2));
            } else if (initialData.type === GameType.MATCH_THE_WORD && initialData.data) {
                setMatchPairs(initialData.data.pairs);
            } else if (initialData.type === GameType.VERSE_SCRAMBLE && initialData.data) {
                setVerseScrambleVerse(initialData.data.verse);
                setVerseScrambleReference(initialData.data.reference);
            } else if (initialData.type === GameType.WHO_AM_I && initialData.data) {
                if (initialData.data.solutions) {
                    setWhoAmISolutions(initialData.data.solutions);
                } else {
                    setWhoAmIAnswer(initialData.data.answer);
                    setWhoAmIHint(initialData.data.hint || '');
                }
            } else if (initialData.type === GameType.WORD_SEARCH && initialData.data) {
                setWordSearchWords(initialData.data.words);
                setWordSearchGridSize(initialData.data.grid.length);
            }
        }
    }, [initialData]);

    // Update local state if props change (e.g. switching between games)
    useEffect(() => {
        setSelectedChallenge(initialChallengeId);
        setDate(initialDate);
    }, [initialChallengeId, initialDate]);


    const getGameData = () => {
        let gameData: any = {};
        if (gameType === GameType.WORDLE) {
            gameData = { solution: wordleSolution.toUpperCase() };
        } else if (gameType === GameType.WORDLE_ADVANCED) {
            gameData = { solutions: wordleAdvancedSolutions.filter(w => w.trim() !== '').map(w => w.toUpperCase()) };
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
        } else if (gameType === GameType.MATCH_THE_WORD) {
            gameData = {
                pairs: matchPairs.filter(p => p.word && p.match).map(p => ({
                    word: p.word,
                    match: p.match
                }))
            };
        } else if (gameType === GameType.VERSE_SCRAMBLE) {
            gameData = {
                verse: verseScrambleVerse,
                reference: verseScrambleReference
            };
        } else if (gameType === GameType.WHO_AM_I) {
            // If multiple solutions are used (check if the array has content beyond default or if user switched mode)
            // For now, let's prefer the multiple solutions format if it has valid data
            const validSolutions = whoAmISolutions.filter(s => s.answer.trim() !== '');
            if (validSolutions.length > 0) {
                gameData = {
                    solutions: validSolutions.map(s => ({ answer: s.answer.toUpperCase(), hint: s.hint }))
                };
            } else {
                gameData = {
                    answer: whoAmIAnswer.toUpperCase(),
                    hint: whoAmIHint
                };
            }
        } else if (gameType === GameType.WORD_SEARCH) {
            const grid = Array(wordSearchGridSize).fill(null).map(() => Array(wordSearchGridSize).fill(''));
            gameData = {
                words: wordSearchWords.filter(w => w.trim() !== '').map(w => w.toUpperCase()),
                grid: grid
            };
        }
        return gameData;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id) return;
        setIsLoading(true);
        setMessage({ text: '', type: '' });

        try {
            const gameData = getGameData();

            await onSave({
                challengeId: selectedChallenge,
                date,
                type: gameType,
                data: gameData
            });

            setMessage({ text: 'Game saved successfully!', type: 'success' });
        } catch (error: any) {
            setMessage({ text: error.message || 'Failed to save game', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePreviewClick = () => {
        try {
            const gameData = getGameData();
            onPreview(gameType, gameData);
        } catch (error: any) {
            setMessage({ text: error.message || 'Failed to preview game', type: 'error' });
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

    const handleMatchPairChange = (index: number, field: 'word' | 'match', value: string) => {
        const newPairs = [...matchPairs];
        newPairs[index][field] = value;
        setMatchPairs(newPairs);
    };

    const handleWordSearchWordChange = (index: number, value: string) => {
        const newWords = [...wordSearchWords];
        newWords[index] = value;
        setWordSearchWords(newWords);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700">
            <h2 className="text-2xl font-bold text-yellow-400 mb-6">
                {initialData ? 'Edit Game' : 'Create Game'}
            </h2>

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
                            disabled={!!initialChallengeId} // Disable if passed from parent
                            className="w-full p-2 bg-gray-900 border border-gray-700 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white disabled:opacity-50"
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
                            disabled={!!initialDate} // Disable if passed from parent
                            className="w-full p-2 bg-gray-900 border border-gray-700 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white disabled:opacity-50"
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
                            <option value={GameType.WORDLE_ADVANCED}>Wordle Advanced (Word Bank)</option>
                            <option value={GameType.CONNECTIONS}>Connect the Words</option>
                            <option value={GameType.CROSSWORD}>Crossword (JSON)</option>
                            <option value={GameType.MATCH_THE_WORD}>Match the Word</option>
                            <option value={GameType.VERSE_SCRAMBLE}>Verse Scramble</option>
                            <option value={GameType.WHO_AM_I}>Hangman</option>
                            <option value={GameType.WORD_SEARCH}>Word Search</option>
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
                                required
                                className="w-full p-2 bg-gray-900 border border-gray-700 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white uppercase"
                                placeholder="FAITH"
                            />
                        </div>
                    )}

                    {gameType === GameType.WORDLE_ADVANCED && (
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-300 mb-1">Solution Bank (5-letters each)</label>
                            <p className="text-xs text-gray-400 mb-2">Enter multiple words. One will be randomly assigned to each user.</p>
                            {wordleAdvancedSolutions.map((word, idx) => (
                                <input
                                    key={idx}
                                    type="text"
                                    value={word}
                                    onChange={e => {
                                        const newSolutions = [...wordleAdvancedSolutions];
                                        newSolutions[idx] = e.target.value;
                                        setWordleAdvancedSolutions(newSolutions);
                                    }}
                                    placeholder={`Word ${idx + 1}`}
                                    className="w-full p-2 mb-2 bg-gray-900 border border-gray-700 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white uppercase"
                                />
                            ))}
                            <button
                                type="button"
                                onClick={() => setWordleAdvancedSolutions([...wordleAdvancedSolutions, ''])}
                                className="text-sm text-yellow-400 hover:text-yellow-300"
                            >
                                + Add Word
                            </button>
                        </div>
                    )}

                    {gameType === GameType.CONNECTIONS && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-400 mb-2">Enter at least 4 categories with 4 words each. If more than 4 are provided, 4 will be randomly assigned to each user.</p>
                            {connectionsCategories.map((cat, catIdx) => (
                                <div key={catIdx} className="p-4 bg-gray-900/50 rounded border border-gray-700 relative">
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
                                    {connectionsCategories.length > 4 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newCats = connectionsCategories.filter((_, i) => i !== catIdx);
                                                setConnectionsCategories(newCats);
                                            }}
                                            className="absolute top-2 right-2 text-red-400 hover:text-red-300 text-xs"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => setConnectionsCategories([...connectionsCategories, { name: '', words: ['', '', '', ''] }])}
                                className="text-sm text-yellow-400 hover:text-yellow-300"
                            >
                                + Add Category
                            </button>
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

                    {gameType === GameType.MATCH_THE_WORD && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-400 mb-2">Enter pairs of words to match.</p>
                            {matchPairs.map((pair, idx) => (
                                <div key={idx} className="flex gap-4">
                                    <input
                                        type="text"
                                        value={pair.word}
                                        onChange={e => handleMatchPairChange(idx, 'word', e.target.value)}
                                        placeholder="Word"
                                        className="flex-1 p-2 bg-gray-900 border border-gray-700 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white"
                                    />
                                    <input
                                        type="text"
                                        value={pair.match}
                                        onChange={e => handleMatchPairChange(idx, 'match', e.target.value)}
                                        placeholder="Match"
                                        className="flex-1 p-2 bg-gray-900 border border-gray-700 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white"
                                    />
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => setMatchPairs([...matchPairs, { word: '', match: '' }])}
                                className="text-sm text-yellow-400 hover:text-yellow-300"
                            >
                                + Add Pair
                            </button>
                        </div>
                    )}

                    {gameType === GameType.VERSE_SCRAMBLE && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Verse Text</label>
                                <textarea
                                    value={verseScrambleVerse}
                                    onChange={e => setVerseScrambleVerse(e.target.value)}
                                    required
                                    rows={3}
                                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white"
                                    placeholder="For God so loved the world..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Reference</label>
                                <input
                                    type="text"
                                    value={verseScrambleReference}
                                    onChange={e => setVerseScrambleReference(e.target.value)}
                                    required
                                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white"
                                    placeholder="John 3:16"
                                />
                            </div>
                        </div>
                    )}

                    {gameType === GameType.WHO_AM_I && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-400 mb-2">Enter one or more Answer/Hint pairs. If multiple are provided, one will be randomly assigned to each user.</p>

                            {whoAmISolutions.map((sol, idx) => (
                                <div key={idx} className="p-4 bg-gray-900/50 rounded border border-gray-700 relative">
                                    <div className="mb-2">
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Answer (Word or Phrase)</label>
                                        <input
                                            type="text"
                                            value={sol.answer}
                                            onChange={e => {
                                                const newSols = [...whoAmISolutions];
                                                newSols[idx].answer = e.target.value;
                                                setWhoAmISolutions(newSols);
                                            }}
                                            required={idx === 0} // Only first one required initially
                                            className="w-full p-2 bg-gray-800 border border-gray-600 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white uppercase"
                                            placeholder="FAITH"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Hint (Optional)</label>
                                        <input
                                            type="text"
                                            value={sol.hint}
                                            onChange={e => {
                                                const newSols = [...whoAmISolutions];
                                                newSols[idx].hint = e.target.value;
                                                setWhoAmISolutions(newSols);
                                            }}
                                            className="w-full p-2 bg-gray-800 border border-gray-600 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white"
                                            placeholder="Evidence of things not seen"
                                        />
                                    </div>
                                    {whoAmISolutions.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newSols = whoAmISolutions.filter((_, i) => i !== idx);
                                                setWhoAmISolutions(newSols);
                                            }}
                                            className="absolute top-2 right-2 text-red-400 hover:text-red-300 text-xs"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => setWhoAmISolutions([...whoAmISolutions, { answer: '', hint: '' }])}
                                className="text-sm text-yellow-400 hover:text-yellow-300"
                            >
                                + Add Another Solution
                            </button>
                        </div>
                    )}

                    {gameType === GameType.WORD_SEARCH && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Grid Size</label>
                                <input
                                    type="number"
                                    value={wordSearchGridSize}
                                    onChange={e => setWordSearchGridSize(parseInt(e.target.value))}
                                    required
                                    min={5}
                                    max={20}
                                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Words to Find</label>
                                {wordSearchWords.map((word, idx) => (
                                    <input
                                        key={idx}
                                        type="text"
                                        value={word}
                                        onChange={e => handleWordSearchWordChange(idx, e.target.value)}
                                        placeholder={`Word ${idx + 1}`}
                                        className="w-full p-2 mb-2 bg-gray-900 border border-gray-700 rounded focus:ring-yellow-500 focus:border-yellow-500 text-white uppercase"
                                    />
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setWordSearchWords([...wordSearchWords, ''])}
                                    className="text-sm text-yellow-400 hover:text-yellow-300"
                                >
                                    + Add Word
                                </button>
                            </div>
                        </div>
                    )}
                </div>



                <div className="flex gap-4 pt-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handlePreviewClick}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                    >
                        Preview
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-600"
                    >
                        {isLoading ? 'Saving...' : 'Save Game'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default GameBuilder;