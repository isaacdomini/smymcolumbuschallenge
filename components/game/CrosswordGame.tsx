import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = useCallback(async () => {
        if (!user || isReadOnly || isSubmitted || startTime === null || isSubmitting) return;

        if (isSample || isPreview) {
            setIsSubmitted(true);
            setTimeout(onComplete, 2000);
            return;
        }

        const isGridEmpty = userGrid.every(row => row.every(cell => !cell));
        if (isGridEmpty && !window.confirm("Your crossword is empty. Are you sure you want to submit?")) {
            return;
        }

        setIsSubmitting(true);
        try {
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
        } catch (error) {
            console.error("Submission failed", error);
            // Optionally show error to user
        } finally {
            setIsSubmitting(false);
        }
    }, [user, isReadOnly, isSubmitted, startTime, gameData.rows, gameData.cols, userGrid, solutionGrid, gameId, onComplete, isSample, isPreview, isSubmitting]);

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
    const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setHeaderTarget(document.getElementById('game-header-target'));
    }, []);

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

    const headerControls = (
        <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-yellow-400 leading-none mr-2 hidden sm:block">
                Crossword
            </h2>
            <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-700/50">
                <button onClick={() => setZoom(z => Math.max(z - 0.25, 1.0))} className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors" title="Zoom Out">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
                <span className="text-xs font-mono text-zinc-500 w-8 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(z + 0.25, 2.5))} className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors" title="Zoom In">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-700/50">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span className="font-mono text-zinc-100 font-bold text-sm tracking-wide">
                    {isReadOnly && submission ? formatTime(submission.timeTaken) : formatTime(elapsedSeconds)}
                </span>
            </div>

            <button onClick={() => setShowInstructions(true)} className="text-zinc-400 hover:text-white p-1.5 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700/50 bg-zinc-900" title="Show Instructions">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </button>
        </div>
    );

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col items-center pb-8 pt-4">
            {headerTarget && createPortal(headerControls, headerTarget)}



            <DarkModeCrossword
                key={submission ? submission.id : gameId}
                puzzleData={isSample ? SAMPLE_DATA : activeData}
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