import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { VerseScrambleData, GameSubmission, GameType } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { submitGame, getGameState, saveGameState, clearGameState, checkAnswer } from '../../services/api';
import GameInstructionsModal from './GameInstructionsModal';

interface VerseScrambleGameProps {
  gameId: string;
  gameData: VerseScrambleData;
  submission?: GameSubmission | null;
  onComplete: () => void;
}

const SAMPLE_DATA: VerseScrambleData = {
  verse: "For God so loved the world that he gave his one and only Son",
  reference: "John 3:16"
};

interface WordItem {
  id: string;
  text: string;
}

interface DragState {
  source: 'pool' | 'solution';
  index: number;
  word: WordItem;
  startX: number;
  startY: number;
}

const VerseScrambleGame: React.FC<VerseScrambleGameProps> = ({ gameId, gameData, submission, onComplete }) => {
  const { user } = useAuth();
  const isSample = gameId.startsWith('sample-');
  const isReadOnly = !!submission;

  const [availableWords, setAvailableWords] = useState<WordItem[]>([]);
  const [placedWords, setPlacedWords] = useState<WordItem[]>([]);
  const [gameState, setGameState] = useState<'playing' | 'won'>('playing');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(!isReadOnly);

  // Drag state
  const [draggingItem, setDraggingItem] = useState<DragState | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number, y: number } | null>(null);
  const dragItemRef = useRef<HTMLButtonElement | null>(null);

  const dataToUse = isSample ? SAMPLE_DATA : gameData;

  useEffect(() => {
    const loadState = async () => {
      let initialWords: string[] = [];
      if (isSample) {
        initialWords = SAMPLE_DATA.verse!.split(' ');
      } else if (gameData.scrambledWords) {
        initialWords = gameData.scrambledWords;
      } else if (gameData.verse) {
        initialWords = gameData.verse.split(' ');
      }

      if (isReadOnly && submission) {
        const verse = submission.submissionData.verse || (isSample ? SAMPLE_DATA.verse : '');
        if (verse) {
          const verseWords = verse.split(' ');
          setPlacedWords(verseWords.map((w: string, i: number) => ({ id: `sol-${i}`, text: w })));
          setAvailableWords([]);
        } else {
          const verseWords = isSample ? SAMPLE_DATA.verse!.split(' ') : (gameData.verse ? gameData.verse.split(' ') : initialWords);
          setPlacedWords(verseWords.map((w, i) => ({ id: `sol-${i}`, text: w })));
          setAvailableWords([]);
        }
        setGameState('won');
        setShowInstructions(false);
      } else if (isSample) {
        const scrambled = [...initialWords].sort(() => Math.random() - 0.5);
        setAvailableWords(scrambled.map((w, i) => ({ id: `pool-${i}`, text: w })));
        setPlacedWords([]);
      } else if (user) {
        const savedProgress = await getGameState(user.id, gameId);

        if (savedProgress?.gameState) {
          if (savedProgress.gameState.words) {
            setAvailableWords(savedProgress.gameState.words);
            setPlacedWords([]);
          } else if (savedProgress.gameState.placedWords || savedProgress.gameState.availableWords) {
            setAvailableWords(savedProgress.gameState.availableWords || []);
            setPlacedWords(savedProgress.gameState.placedWords || []);
          } else {
            let wordsToUse = initialWords;
            if (gameData.verse && !gameData.scrambledWords) {
              wordsToUse = [...initialWords].sort(() => Math.random() - 0.5);
            }
            setAvailableWords(wordsToUse.map((w, i) => ({ id: `pool-${i}`, text: w })));
            setPlacedWords([]);
          }

          setGameState(savedProgress.gameState.gameState || 'playing');
          if (savedProgress.gameState.startTime) {
            setStartTime(savedProgress.gameState.startTime);
            setShowInstructions(false);
          }
        } else {
          let wordsToUse = initialWords;
          if (gameData.verse && !gameData.scrambledWords) {
            wordsToUse = [...initialWords].sort(() => Math.random() - 0.5);
          }
          setAvailableWords(wordsToUse.map((w, i) => ({ id: `pool-${i}`, text: w })));
          setPlacedWords([]);
        }
      }
    };
    loadState();
  }, [gameData, isReadOnly, submission, gameId, user, isSample]);

  useEffect(() => {
    if (isReadOnly || gameState !== 'playing' || !user || startTime === null || isSample) return;
    const stateToSave = { availableWords, placedWords, gameState, startTime };
    const handler = setTimeout(() => saveGameState(user.id, gameId, stateToSave), 1000);
    return () => clearTimeout(handler);
  }, [availableWords, placedWords, gameState, startTime, isReadOnly, user, gameId]);

  // Win Check
  useEffect(() => {
    if (gameState !== 'playing' || isReadOnly) return;

    const totalWords = isSample ? SAMPLE_DATA.verse!.split(' ').length : (gameData.scrambledWords?.length || gameData.verse?.split(' ').length || 0);

    if (availableWords.length === 0 && placedWords.length === totalWords) {
      const currentSentence = placedWords.map(w => w.text).join(' ');
      const correctSentence = isSample ? SAMPLE_DATA.verse : gameData.verse;

      if (isSample) {
        if (currentSentence === correctSentence) {
          setGameState('won');
        }
      } else {
        const timer = setTimeout(() => {
          checkAnswer(gameId, placedWords.map(w => w.text))
            .then(res => {
              if (res.correct) {
                setGameState('won');
              }
            })
            .catch(console.error);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [placedWords, availableWords, gameState, isReadOnly, isSample, gameId, gameData]);

  // Submission
  useEffect(() => {
    const saveResult = async () => {
      if (gameState === 'won' && !isReadOnly && startTime !== null && !isSample) {
        if (!user) return;
        const timeTaken = Math.round((Date.now() - startTime) / 1000);
        await submitGame({
          userId: user.id,
          gameId,
          startedAt: new Date(startTime).toISOString(),
          timeTaken,
          mistakes: 0,
          submissionData: {
            completed: true,
            verse: placedWords.map(w => w.text).join(' '),
            reference: dataToUse.reference
          }
        });
        await clearGameState(user.id, gameId);
        setTimeout(onComplete, 3000);
      }
    };
    saveResult();
  }, [gameState, user, isReadOnly, gameId, onComplete, startTime, placedWords, isSample, dataToUse]);

  const handleStartGame = () => {
    setStartTime(Date.now());
    setShowInstructions(false);
  };

  // --- Header Timer ---
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderTarget(document.getElementById('game-header-target'));
  }, []);

  useEffect(() => {
    if (!startTime || gameState !== 'playing' || isReadOnly || showInstructions) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, gameState, isReadOnly, showInstructions]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const headerControls = (
    <div className="flex items-center gap-2">
      <h2 className="text-lg font-bold text-yellow-400 leading-none mr-2 hidden sm:block">
        Verse Scramble {isSample && <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded ml-1 align-middle">Sample</span>}
      </h2>
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

  // --- Pointer Drag Logic ---

  const handlePointerDown = (e: React.PointerEvent, source: 'pool' | 'solution', index: number, word: WordItem) => {
    if (gameState !== 'playing' || isReadOnly) return;

    // We intentionally do NOT use preventDefault here to allow scrolling if needed, 
    // BUT we need to prevent default touch behaviors like pull-to-refresh or text selection.
    // However, touch-action: none on container handles most.
    e.preventDefault();

    // We will use global window listener for better tracking specially for the overlay
    const target = e.currentTarget as HTMLButtonElement;
    target.setPointerCapture(e.pointerId);
    dragItemRef.current = target;

    setDraggingItem({ source, index, word, startX: e.clientX, startY: e.clientY });
    setDragPosition({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingItem) return;
    e.preventDefault();
    setDragPosition({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggingItem) return;
    e.preventDefault();

    if (dragItemRef.current) {
      dragItemRef.current.releasePointerCapture(e.pointerId);
      dragItemRef.current = null;
    }

    // Determine drop target using document.elementFromPoint
    // We check if we are over the solution area or the pool area
    const dropX = e.clientX;
    const dropY = e.clientY;

    const solutionArea = document.getElementById('verse-solution-area');
    const poolArea = document.getElementById('verse-pool-area');

    // Get the element at the drop coordinates
    const dropTarget = document.elementFromPoint(dropX, dropY);

    const inSolution = solutionArea?.contains(dropTarget) || dropTarget?.closest('#verse-solution-area');
    const inPool = poolArea?.contains(dropTarget) || dropTarget?.closest('#verse-pool-area');

    if (inSolution) {
      // Find if dropped ON specific item in solution to reorder
      const droppedOnItem = dropTarget?.closest('[data-solution-index]');
      let targetIndex = placedWords.length; // Default append

      if (droppedOnItem) {
        const idx = parseInt(droppedOnItem.getAttribute('data-solution-index') || '-1');
        if (idx !== -1) targetIndex = idx;
      }

      if (draggingItem.source === 'pool') {
        // Move from Pool -> Solution
        const wordToAdd = draggingItem.word;
        setAvailableWords(prev => prev.filter((_, i) => i !== draggingItem.index));
        setPlacedWords(prev => {
          const newPlaced = [...prev];
          newPlaced.splice(targetIndex, 0, wordToAdd);
          return newPlaced;
        });
      } else {
        // Reorder within Solution
        setPlacedWords(prev => {
          const newPlaced = [...prev];
          const [moved] = newPlaced.splice(draggingItem.index, 1);
          // Adjust target index if shifting. 
          // If we drag from index 0 to index 2 (current index 2 is shifted down), 
          // Logic: remove at oldIdx, insert at newIdx.
          // However, targetIndex is based on DOM before removal. 
          // If target > dragging, we need to decr target by 1?
          // Actually, standard splice logic:
          // If dragging index < targetIndex, we insert at targetIndex - 0?
          // Wait, if I drag item 0 to item 1. It should swap.
          // Let's rely on simple splicing.
          // If I am at 0 and drop on 2. 
          // Remove 0. New array length is N-1.
          // Insert at 2 (which is now effectively index 1 in new array).
          let finalTarget = targetIndex;
          if (draggingItem.index < targetIndex) {
            // element at targetIndex shifts down after removal if it was after
            // but since we found the element at drop time, its index is what we want to take the place of?
            // Actually, if we drop on item X, we typically want to insert BEFORE item X.
            // If target > index, the target index shifts down by 1 after removal.
            finalTarget = targetIndex - 1;
            // Wait, that logic is complex.
            // Let's just use simpler logic: remove then insert.
            // But if I drop ON the item at index 4, I want to be at index 4.
            // If I came from index 0, index 4 (old) becomes index 3 (new). 
            // So I insert at 3? No, I want to be *before* what was at 4?
            // Let's simplify: insert at index.
            // If draggingItem.index < targetIndex, we need to account for shift.
            finalTarget = targetIndex;
          }

          // Correction: if dropping on itself, do nothing.
          if (draggingItem.index === targetIndex) return prev;

          // Simple reorder: remove then splice.
          // If I remove index 0, everything shifts left.
          // If I insert at index 2 (old), that corresponds to index 1 (new).
          if (draggingItem.index < targetIndex) {
            newPlaced.splice(targetIndex, 0, moved);
            // This puts it AFTER? No splice inserts BEFORE index.
            // If I have [A, B, C] and drag A(0) to C(2).
            // Remove A -> [B, C].
            // splice(2, 0, A) -> [B, C, A]. Correct (inserted before old undefined/end).
            // If I drag A(0) to B(1).
            // Remove A -> [B, C].
            // splice(1, 0, A) -> [B, A, C]. Correct.
            // So if index < target, use target.
            // EXCEPT if simply moving 1 slot right?
          } else {
            newPlaced.splice(targetIndex, 0, moved);
          }

          return newPlaced;
        });
      }
    } else if (inPool) {
      // Return to pool (order doesn't matter much, append)
      if (draggingItem.source === 'solution') {
        setPlacedWords(prev => prev.filter((_, i) => i !== draggingItem.index));
        setAvailableWords(prev => [...prev, draggingItem.word]);
      }
    }

    setDraggingItem(null);
    setDragPosition(null);
  };


  if (showInstructions) {
    return <GameInstructionsModal gameType={GameType.VERSE_SCRAMBLE} onStart={handleStartGame} onClose={handleStartGame} />;
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center p-4 select-none">
      {headerTarget && createPortal(headerControls, headerTarget)}

      {/* Drag Overlay */}
      {draggingItem && dragPosition && createPortal(
        <div
          className="fixed pointer-events-none px-4 py-3 rounded-lg font-bold text-xl bg-yellow-500 text-gray-900 shadow-2xl z-50 transform -translate-x-1/2 -translate-y-1/2 border-2 border-white ring-4 ring-yellow-500/50 flex items-center justify-center min-w-[60px]"
          style={{ left: dragPosition.x, top: dragPosition.y }}
        >
          {draggingItem.word.text}
        </div>,
        document.body
      )}

      {/* Game Board - Only show if playing */}
      {gameState === 'playing' && (
        <>
          {/* Solution Area */}
          <div className="w-full mb-8">
            <p className="mb-2 text-gray-400 text-sm text-center uppercase tracking-wider font-bold">Solution Area</p>
            <div
              id="verse-solution-area"
              className="w-full min-h-[140px] bg-gray-800/80 border-2 border-dashed border-gray-600 rounded-xl p-4 flex flex-wrap gap-3 justify-center items-start content-start transition-colors duration-300"
            >
              {placedWords.length === 0 && !draggingItem && (
                <span className="text-gray-500 italic mt-8 pointer-events-none">Drag words here...</span>
              )}
              {placedWords.map((word, index) => (
                <button
                  key={word.id}
                  data-solution-index={index}
                  onPointerDown={(e) => handlePointerDown(e, 'solution', index, word)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  disabled={isReadOnly}
                  className={`
                        px-3 py-2 rounded-lg font-semibold text-lg bg-yellow-500 text-gray-900 shadow-md transition-all touch-none
                        ${draggingItem?.word.id === word.id ? 'opacity-0' : 'hover:scale-105 active:scale-95'}
                    `}
                >
                  {word.text}
                </button>
              ))}
            </div>
          </div>

          {/* Word Pool */}
          <div className="w-full">
            <p className="mb-2 text-gray-400 text-sm text-center uppercase tracking-wider font-bold">Word Pool</p>
            <div
              id="verse-pool-area"
              className="flex flex-wrap gap-3 justify-center min-h-[100px] bg-gray-900/50 p-4 rounded-xl border border-gray-800"
            >
              {availableWords.map((word, index) => (
                <button
                  key={word.id}
                  onPointerDown={(e) => handlePointerDown(e, 'pool', index, word)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  disabled={isReadOnly}
                  className={`
                        px-4 py-3 rounded-lg font-semibold text-lg bg-gray-700 text-gray-100 shadow transition-all touch-none
                        ${draggingItem?.word.id === word.id ? 'opacity-0' : 'hover:bg-gray-600 hover:scale-105 active:scale-95'}
                    `}
                >
                  {word.text}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {gameState === 'won' && (
        <div className="text-center animate-fade-in mt-8 p-6 bg-gray-800 rounded-2xl border border-gray-700 shadow-xl max-w-md">
          <p className="text-3xl font-bold text-green-400 mb-2">Amen!</p>
          <p className="text-xl text-white mb-6 font-serif italic">"{placedWords.map(w => w.text).join(' ')}"</p>
          <p className="text-lg text-gray-400 mb-6 font-bold">{dataToUse.reference}</p>
          <button onClick={onComplete} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full transition-all hover:scale-105 shadow-lg shadow-blue-900/50">
            Continue
          </button>
        </div>
      )}
    </div>
  );
};

export default VerseScrambleGame;
