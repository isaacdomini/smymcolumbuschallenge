import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CrosswordData, GameSubmission, Clue, GameType } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { submitGame, getGameState, saveGameState, clearGameState } from '../../services/api';
import { DarkModeCrossword } from './DarkModeCrossword';
import GameInstructionsModal from './GameInstructionsModal';

interface CrosswordGameProps {
    gameId: string;
    gameData: CrosswordData;
    submission?: GameSubmission | null;
    onComplete: () => void;
    isPreview?: boolean;
}

const SAMPLE_DATA: CrosswordData = {
    rows: 3,
    cols: 3,
    acrossClues: [
        { number: 1, clue: 'vehicle', answer: 'CAR', row: 0, col: 0, direction: 'across' },
        { number: 2, clue: 'you do this to your broken down car', answer: 'TOW', row: 2, col: 0, direction: 'across' },
    ],
    downClues: [
        { number: 1, clue: 'meow', answer: 'CAT', row: 0, col: 0, direction: 'down' },
        { number: 2, clue: 'you do this to your broken down car', answer: 'ROW', row: 0, col: 2, direction: 'down' },
    ],
};

const CrosswordGame: React.FC<CrosswordGameProps> = ({ gameId, gameData, submission, onComplete, isPreview = false }) => {
    const { user } = useAuth();
    const isSample = gameId.startsWith('sample-');
    const isReadOnly = !!submission;

    // Use correct data for initialization
    const activeData = useMemo(() => {
        if (isSample) return SAMPLE_DATA;
        if (submission?.submissionData?.puzzle) return submission.submissionData.puzzle;
        return gameData;
    }, [isSample, gameData, submission]);

    const [userGrid, setUserGrid] = useState<(string | null)[][]>(() =>
        Array(activeData.rows).fill(null).map(() => Array(activeData.cols).fill(null))
    );
    const [isSubmitted, setIsSubmitted] = useState(!!submission);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [showInstructions, setShowInstructions] = useState(!isReadOnly && !isPreview);
    const [feedback, setFeedback] = useState<any>(null);

    const solutionGrid = useMemo(() => {
        const grid: (string | null)[][] = Array(activeData.rows).fill(null).map(() => Array(activeData.cols).fill(null));
        const allClues: Clue[] = [...activeData.acrossClues, ...activeData.downClues];
        allClues.forEach(clue => {
            if (!clue.answer) return;
            for (let i = 0; i < clue.answer.length; i++) {
                const r = clue.direction === 'across' ? clue.row : clue.row + i;
                const c = clue.direction === 'across' ? clue.col + i : clue.col;
                if (grid[r] && c < activeData.cols) {
                    grid[r][c] = clue.answer[i];
                }
            }
        });
        return grid;
    }, [activeData]);

    useEffect(() => {
        if (isReadOnly && submission) {
            if (isReadOnly && submission) {
                // When reviewing, show the user's submitted grid
                if (submission.submissionData?.grid) {
                    setUserGrid(submission.submissionData.grid);
                } else {
                    setUserGrid(solutionGrid);
                }
                setIsSubmitted(true);
                setShowInstructions(false);
                return;
            }
            setIsSubmitted(true);
            setShowInstructions(false);
            return;
        }
        if (!user || isSample || isPreview) return;

        const loadState = async () => {
            const savedProgress = await getGameState(user.id, gameId);
            if (savedProgress?.gameState) {
                try {
                    const savedState = savedProgress.gameState;
                    if (savedState.grid) {
                        setUserGrid(savedState.grid);
                    }
                    if (savedState.startTime) {
                        setStartTime(savedState.startTime);
                        setShowInstructions(false);
                    }
                } catch (e) {
                    console.error("Failed to parse saved Crossword state", e);
                }
            }
        };
        loadState();
    }, [gameId, isReadOnly, submission, activeData.rows, activeData.cols, user, solutionGrid, isSample, isPreview]);

    useEffect(() => {
        if (isReadOnly || isSubmitted || !user || startTime === null || isSample || isPreview) return;
        const stateToSave = {
            grid: userGrid,
            startTime,
        };

        const handler = setTimeout(() => {
            saveGameState(user.id, gameId, stateToSave);
        }, 1000);

        return () => clearTimeout(handler);
    }, [userGrid, startTime, isReadOnly, isSubmitted, user, gameId, isPreview]);

    const handleSubmit = useCallback(async () => {
        if (!user || isReadOnly || isSubmitted || startTime === null) return;

        if (isSample || isPreview) {
            setIsSubmitted(true);
            setTimeout(onComplete, 2000);
            return;
        }

        const isGridEmpty = userGrid.every(row => row.every(cell => !cell));
        if (isGridEmpty && !window.confirm("Your crossword is empty. Are you sure you want to submit?")) {
            return;
        }

        const timeTaken = Math.round((Date.now() - startTime) / 1000);

        // Mistakes are calculated on server
        const mistakes = 0;
        const correctCells = 0;
        const totalFillableCells = 0;

        const response = await submitGame({
            userId: user.id,
            gameId,
            startedAt: new Date(startTime).toISOString(),
            timeTaken,
            mistakes,
            submissionData: {
                grid: userGrid,
                correctCells,
                totalFillableCells,
                puzzle: activeData // Store the puzzle definition with submission
            },
        });

        if (response.feedback) {
            setFeedback(response.feedback);
        }

        setIsSubmitted(true);
        await clearGameState(user.id, gameId);
        setTimeout(onComplete, 3000);
    }, [user, isReadOnly, isSubmitted, startTime, gameData.rows, gameData.cols, userGrid, solutionGrid, gameId, onComplete, isSample, isPreview]);

    const handleCellChange = useCallback((row: number, col: number, char: string | null) => {
        if (isSubmitted) return;
        setUserGrid(currentGrid => {
            const newGrid = currentGrid.map(r => [...r]);
            newGrid[row][col] = char;
            return newGrid;
        });
    }, [isSubmitted]);

    const handleInstructionsClose = () => {
        if (startTime === null && !isReadOnly) {
            setStartTime(Date.now());
        }
        setShowInstructions(false);
    };

    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);

    useEffect(() => {
        if (!startTime || isSubmitted || isReadOnly || showInstructions) return;

        const interval = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime, isSubmitted, isReadOnly, showInstructions]);

    if (showInstructions) {
        return <GameInstructionsModal gameType={GameType.CROSSWORD} onStart={handleInstructionsClose} onClose={handleInstructionsClose} />;
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col items-center pb-8">
            <div className={`flex flex-col w-full max-w-md mb-4 bg-zinc-800 rounded-xl shadow-lg border border-zinc-700 transition-all duration-300 sticky top-0 z-30 ${isHeaderExpanded ? 'p-3 gap-2' : 'p-2'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className={`font-bold text-yellow-400 leading-none transition-all ${isHeaderExpanded ? 'text-xl' : 'text-lg'}`}>
                            Crossword
                        </h2>
                        {!isHeaderExpanded && (
                            <span className="font-mono text-zinc-300 font-bold text-sm bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700/50">
                                {isReadOnly && submission ? formatTime(submission.timeTaken) : formatTime(elapsedSeconds)}
                            </span>
                        )}
                        <div className="flex gap-2">
                            {isSample && <span className="text-xs bg-blue-600 px-1.5 py-0.5 rounded text-white font-medium">Sample</span>}
                            {isPreview && <span className="text-xs bg-purple-600 px-1.5 py-0.5 rounded text-white font-medium">Preview</span>}
                        </div>
                    </div>

                    <button
                        onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
                        className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-700 rounded transition-colors"
                        title={isHeaderExpanded ? "Collapse Header" : "Expand Header"}
                    >
                        {isHeaderExpanded ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        )}
                    </button>
                </div>

                {isHeaderExpanded && (
                    <div className="flex items-center justify-between animate-fade-in gap-2 border-t border-zinc-700/50 pt-2">
                        <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-700/50">
                            <button onClick={() => setZoom(z => Math.max(z - 0.25, 1.0))} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors" title="Zoom Out">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                            <span className="text-xs font-mono text-zinc-500 w-8 text-center">{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom(z => Math.min(z + 0.25, 2.5))} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors" title="Zoom In">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                        </div>

                        <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-700/50 flex-grow justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            <span className="font-mono text-zinc-100 font-bold tracking-wider">
                                {isReadOnly && submission ? formatTime(submission.timeTaken) : formatTime(elapsedSeconds)}
                            </span>
                        </div>

                        <button onClick={() => setShowInstructions(true)} className="text-zinc-400 hover:text-white p-2 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700/50 bg-zinc-900" title="Show Instructions">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </button>
                    </div>
                )}
            </div>

            <DarkModeCrossword
                puzzleData={isSample ? SAMPLE_DATA : gameData}
                onCellChange={isReadOnly || isSubmitted ? undefined : handleCellChange}
                onPuzzleComplete={isReadOnly ? undefined : handleSubmit}
                initialGrid={userGrid}
                isReviewMode={isReadOnly}
                incorrectCells={feedback?.incorrectCells || submission?.submissionData?.incorrectCells}
                onSubmit={isReadOnly ? undefined : handleSubmit}
                zoom={zoom}
            />

            <div className="mt-6 w-full max-w-md flex flex-col items-center">
                {!isReadOnly ? (
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitted}
                        className="hidden md:block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg disabled:bg-gray-600 disabled:cursor-not-allowed transition-transform hover:scale-105"
                    >
                        {isSubmitted ? "Submitted!" : "Submit Puzzle"}
                    </button>
                ) : (
                    <div className="text-center p-4 rounded-lg bg-gray-800 w-full animate-fade-in border border-gray-700">
                        {submission && (
                            <div className="text-lg text-gray-300 space-y-1">
                                <p><span className="text-gray-500">Score:</span> <span className="font-bold text-yellow-400">{submission.score}</span></p>
                                <p className="text-sm"><span className="text-gray-500">Time:</span> {submission.timeTaken}s <span className="mx-2">|</span> <span className="text-gray-500">Mistakes:</span> {submission.mistakes}</p>
                            </div>
                        )}
                        <button onClick={onComplete} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-full transition-transform hover:scale-105">
                            Back to Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CrosswordGame;