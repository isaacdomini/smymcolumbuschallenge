import { User, Challenge, Game, GameType, GameSubmission, WordleData, ConnectionsData, CrosswordData, SubmitGamePayload, GameProgress} from '../types';

// Check if we should use mock data (development mode only)
const USE_MOCK_DATA = import.meta.env.MODE === 'development';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Mock API service to simulate a backend.
// In a real application, these functions would make network requests.

// --- MOCK DATABASE ---

const MOCK_USERS: User[] = [
    { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
    { id: 'user-2', name: 'Jane Smith', email: 'jane@example.com' },
    { id: 'user-3', name: 'Peter Jones', email: 'peter@example.com' },
];

const MOCK_CHALLENGE: Challenge = {
    id: 'challenge-1', 
    name: 'Lenten Challenge 2025', 
    // Set to start 2 days ago for demonstration
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), 
    // Set to end in 38 days
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 38).toISOString() 
};

// Generate mock games for the challenge duration
const MOCK_GAMES: Game[] = [];
const startDate = new Date(MOCK_CHALLENGE.startDate);
for (let i = 0; i < 40; i++) {
    const gameDate = new Date(startDate);
    gameDate.setDate(startDate.getDate() + i);
    const dateStr = gameDate.toISOString().split('T')[0];

    const gameTypeIndex = i % 3;
    let game: Game;

    if (gameTypeIndex === 0) {
        game = {
            id: `game-wordle-${dateStr}`,
            challengeId: MOCK_CHALLENGE.id,
            date: gameDate.toISOString(),
            type: GameType.WORDLE,
            data: { solution: i === 0 ? 'GRACE' : i === 3 ? 'ANGEL' : 'FAITH' } as WordleData,
        };
    } else if (gameTypeIndex === 1) {
        game = {
            id: `game-conn-${dateStr}`,
            challengeId: MOCK_CHALLENGE.id,
            date: gameDate.toISOString(),
            type: GameType.CONNECTIONS,
            data: {
                words: [
                    'PETER', 'ANDREW', 'JAMES', 'JOHN',
                    'GENESIS', 'EXODUS', 'LEVITICUS', 'NUMBERS',
                    'BREAD', 'WINE', 'FISH', 'LAMB',
                    'CROSS', 'THORNS', 'NAILS', 'TOMB'
                ],
                categories: [
                    { name: 'FIRST FOUR APOSTLES', words: ['PETER', 'ANDREW', 'JAMES', 'JOHN'] },
                    { name: 'BOOKS OF THE PENTATEUCH', words: ['GENESIS', 'EXODUS', 'LEVITICUS', 'NUMBERS'] },
                    { name: 'BIBLICAL FOODS', words: ['BREAD', 'WINE', 'FISH', 'LAMB'] },
                    { name: 'SYMBOLS OF THE PASSION', words: ['CROSS', 'THORNS', 'NAILS', 'TOMB'] },
                ],
            } as ConnectionsData,
        };
    } else {
         const crosswordData: CrosswordData = {
            gridSize: 5,
            acrossClues: [
                { number: 1, clue: 'On the ___ (using Tinder or Bumble)', answer: 'APPS', row: 0, col: 0, direction: 'across' },
                { number: 5, clue: 'Color of the second-hardest Connections category', answer: 'BLUE', row: 1, col: 0, direction: 'across' },
                { number: 6, clue: 'Prepare, as a Thanksgiving turkey', answer: 'CARVE', row: 2, col: 0, direction: 'across' },
                { number: 8, clue: 'Have to have', answer: 'NEED', row: 3, col: 1, direction: 'across' },
                { number: 9, clue: 'Camper\'s construction', answer: 'TENT', row: 4, col: 1, direction: 'across' },
            ],
            downClues: [
                { number: 1, clue: 'Kimmel\'s channel', answer: 'ABC', row: 0, col: 0, direction: 'down' },
                { number: 2, clue: 'Audience member who\'s in on the magic trick', answer: 'PLANT', row: 0, col: 1, direction: 'down' },
                { number: 3, clue: 'Many a baby food', answer: 'PUREE', row: 0, col: 2, direction: 'down' },
                { number: 4, clue: 'Typical number of objects that humans can hold in working memory, hence phone numbers', answer: 'SEVEN', row: 0, col: 3, direction: 'down' },
                { number: 7, clue: 'Summer hrs. in N.Y.C.', answer: 'EDT', row: 2, col: 4, direction: 'down' },
            ],
        };
        game = {
            id: `game-cross-${dateStr}`,
            challengeId: MOCK_CHALLENGE.id,
            date: gameDate.toISOString(),
            type: GameType.CROSSWORD,
            data: crosswordData,
        };
    }
    MOCK_GAMES.push(game);
}

const MOCK_SUBMISSIONS: GameSubmission[] = [
    // Submissions for game from 2 days ago
    { id: 'sub-1', userId: 'user-1', gameId: MOCK_GAMES[0].id, challengeId: MOCK_CHALLENGE.id, completedAt: new Date().toISOString(), timeTaken: 60, mistakes: 2, score: 76, submissionData: { guesses: ['WRONG', 'GUESS', 'GRACE'] } },
    { id: 'sub-2', userId: 'user-2', gameId: MOCK_GAMES[0].id, challengeId: MOCK_CHALLENGE.id, completedAt: new Date().toISOString(), timeTaken: 45, mistakes: 1, score: 87, submissionData: { guesses: ['OTHER', 'GRACE'] } },
    // Submissions for game from 1 day ago
    { id: 'sub-4', userId: 'user-2', gameId: MOCK_GAMES[1].id, challengeId: MOCK_CHALLENGE.id, completedAt: new Date().toISOString(), timeTaken: 90, mistakes: 0, score: 94 },
];

const MOCK_GAME_PROGRESS: GameProgress[] = [];

const simulateDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- API FUNCTIONS ---

export const login = async (email: string, pass: string): Promise<User> => {
    if (USE_MOCK_DATA) {
        await simulateDelay(500);
        const user = MOCK_USERS.find(u => u.email === email);
        if (user) { // No password check in mock
            return user;
        }
        throw new Error("Invalid credentials");
    } else {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass }),
        });
        
        if (!response.ok) {
            throw new Error('Invalid credentials');
        }
        
        return await response.json();
    }
};

export const signup = async (name: string, email: string, pass: string): Promise<User> => {
    if (USE_MOCK_DATA) {
        await simulateDelay(500);
        if (MOCK_USERS.some(u => u.email === email)) {
            throw new Error("User already exists");
        }
        const newUser: User = { id: `user-${Date.now()}`, name, email };
        MOCK_USERS.push(newUser);
        return newUser;
    } else {
        const response = await fetch(`${API_BASE_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password: pass }),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Signup failed');
        }
        
        return await response.json();
    }
};

export const logout = (): void => {
    // No-op in mock, session is managed client-side
};

export const getChallenge = async (): Promise<Challenge | null> => {
    if (USE_MOCK_DATA) {
        await simulateDelay(300);
        const now = new Date();
        const isFinished = new Date(MOCK_CHALLENGE.endDate) < now;
        
        if (isFinished) return null;

        return MOCK_CHALLENGE;
    } else {
        const response = await fetch(`${API_BASE_URL}/challenge`);
        if (!response.ok) {
            throw new Error('Failed to fetch challenge');
        }
        return await response.json();
    }
};

export const getDailyGame = async (challengeId: string): Promise<Game | null> => {
    if (USE_MOCK_DATA) {
        await simulateDelay(200);
        if (challengeId !== MOCK_CHALLENGE.id) return null;
        const today = new Date().toISOString().split('T')[0];
        return MOCK_GAMES.find(g => g.date.startsWith(today)) ?? null;
    } else {
        const response = await fetch(`${API_BASE_URL}/challenge/${challengeId}/daily`);
        if (!response.ok) {
            throw new Error('Failed to fetch daily game');
        }
        return await response.json();
    }
};

export const getGameById = async (gameId: string): Promise<Game | null> => {
    if (USE_MOCK_DATA) {
        await simulateDelay(200);
        return MOCK_GAMES.find(g => g.id === gameId) ?? null;
    } else {
        const response = await fetch(`${API_BASE_URL}/games/${gameId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch game');
        }
        return await response.json();
    }
};


export const getGamesForChallenge = async (challengeId: string): Promise<Game[]> => {
    if (USE_MOCK_DATA) {
        await simulateDelay(400);
        if (challengeId !== MOCK_CHALLENGE.id) return [];
        const now = new Date();
        // Return all games up to and including today
        return MOCK_GAMES.filter(g => new Date(g.date) <= now);
    } else {
        const response = await fetch(`${API_BASE_URL}/challenge/${challengeId}/games`);
        if (!response.ok) {
            throw new Error('Failed to fetch games');
        }
        return await response.json();
    }
};

export const getSubmissionsForUser = async (userId: string, challengeId: string): Promise<GameSubmission[]> => {
    if (USE_MOCK_DATA) {
        await simulateDelay(200);
        return MOCK_SUBMISSIONS.filter(s => s.userId === userId && s.challengeId === challengeId);
    } else {
        const response = await fetch(`${API_BASE_URL}/submissions/user/${userId}/challenge/${challengeId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch submissions');
        }
        return await response.json();
    }
};

export const getSubmissionForToday = async (userId: string, gameId: string): Promise<GameSubmission | null> => {
    if (USE_MOCK_DATA) {
        await simulateDelay(100);
        return MOCK_SUBMISSIONS.find(s => s.userId === userId && s.gameId === gameId) ?? null;
    } else {
        const response = await fetch(`${API_BASE_URL}/submissions/user/${userId}/game/${gameId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch submission');
        }
        return await response.json();
    }
};

export const getLeaderboard = async (challengeId: string): Promise<(GameSubmission & { user: User })[]> => {
    if (USE_MOCK_DATA) {
        await simulateDelay(400);
        if (challengeId !== MOCK_CHALLENGE.id) return [];

        const userScores: { [userId: string]: { totalScore: number, user: User } } = {};

        for (const sub of MOCK_SUBMISSIONS) {
            const user = MOCK_USERS.find(u => u.id === sub.userId);
            if (user) {
                if (!userScores[sub.userId]) {
                    userScores[sub.userId] = { totalScore: 0, user };
                }
                userScores[sub.userId].totalScore += sub.score;
            }
        }
        
        return Object.values(userScores).map(us => ({
            // This is a simplified entry for leaderboard display.
            id: `leaderboard-${us.user.id}`,
            userId: us.user.id,
            challengeId,
            score: us.totalScore,
            user: us.user,
            gameId: '', // Not relevant for aggregate view
            completedAt: '', // Not relevant
            timeTaken: 0, // Not relevant
            mistakes: 0, // Not relevant
        }));
    } else {
        const response = await fetch(`${API_BASE_URL}/challenge/${challengeId}/leaderboard`);
        if (!response.ok) {
            throw new Error('Failed to fetch leaderboard');
        }
        return await response.json();
    }
};

/**
 * Calculates a score based on game-specific rules.
 */
const calculateScore = (payload: SubmitGamePayload, game: Game): number => {
    const { timeTaken, mistakes, submissionData } = payload;

    switch (game.type) {
        case GameType.WORDLE: {
            // `mistakes` is the number of guesses - 1 (0 for 1st guess, 5 for 6th), or 6 for a loss.
            if (mistakes === 6) { // Loss
                return 0;
            }
            const guessIndex = mistakes;
            const guessScore = (6 - guessIndex) * 10; // 60 for 1st guess, 10 for 6th
            const timeScore = Math.max(0, 40 - Math.floor(timeTaken / 5)); // Max 40, drops to 0 after 200s
            return Math.max(0, guessScore + timeScore);
        }

        case GameType.CONNECTIONS: {
            const categoriesFound = submissionData?.categoriesFound ?? 0;
            // Base score on categories, penalize mistakes, add time bonus
            const categoryScore = categoriesFound * 20;
            const mistakePenalty = mistakes * 5;
            const timeBonus = Math.max(0, 20 - Math.floor(timeTaken / 30)); // Max 20, drops to 0 after 10 mins
            return Math.max(0, categoryScore - mistakePenalty + timeBonus);
        }

        case GameType.CROSSWORD: {
            const correctCells = submissionData?.correctCells ?? 0;
            const totalFillableCells = submissionData?.totalFillableCells ?? 1; // Avoid division by zero
            if (totalFillableCells === 0) return 0;

            const accuracyScore = Math.round((correctCells / totalFillableCells) * 70);
            const timeBonus = Math.max(0, 30 - Math.floor(timeTaken / 60)); // Max 30, drops to 0 after 30 mins
            return Math.max(0, accuracyScore + timeBonus);
        }

        default: {
            // Fallback to old simple scoring for any other game types
            const timePenalty = Math.floor(timeTaken / 15);
            const mistakePenalty = mistakes * 10;
            return Math.max(0, 100 - mistakePenalty - timePenalty);
        }
    }
}

export const submitGame = async (payload: SubmitGamePayload): Promise<GameSubmission> => {
    if (USE_MOCK_DATA) {
        await simulateDelay(500);
        const game = MOCK_GAMES.find(g => g.id === payload.gameId);
        if (!game) throw new Error("Game not found to submit to.");

        const score = calculateScore(payload, game);

        const newSubmission: GameSubmission = {
            id: `sub-${Date.now()}`,
            userId: payload.userId,
            gameId: payload.gameId,
            challengeId: MOCK_CHALLENGE.id,
            completedAt: new Date().toISOString(),
            timeTaken: payload.timeTaken,
            mistakes: payload.mistakes,
            score,
            submissionData: payload.submissionData,
        };
        MOCK_SUBMISSIONS.push(newSubmission);
        //
        // Force re-calculation of previous scores for demonstration purposes
        MOCK_SUBMISSIONS.forEach(sub => {
            const game = MOCK_GAMES.find(g => g.id === sub.gameId);
            if (game) {
                const tempPayload: SubmitGamePayload = {
                    userId: sub.userId,
                    gameId: sub.gameId,
                    mistakes: sub.mistakes,
                    timeTaken: sub.timeTaken,
                    submissionData: sub.submissionData
                }
                sub.score = calculateScore(tempPayload, game);
            }
        });
        //
        return newSubmission;
    } else {
        // Calculate score before submitting
        const game = await getGameById(payload.gameId);
        if (!game) throw new Error('Game not found');

        const score = calculateScore(payload, game);

        const payloadWithScore = { ...payload, score };

        const response = await fetch(`${API_BASE_URL}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadWithScore),
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit game');
        }
        
        return await response.json();
    }
};

export const getGameState = async (userId: string, gameId: string): Promise<GameProgress | null> => {
    if (USE_MOCK_DATA) {
        await simulateDelay(200);
        return MOCK_GAME_PROGRESS.find(p => p.userId === userId && p.gameId === gameId) ?? null;
    } else {
        const response = await fetch(`${API_BASE_URL}/game-state/user/${userId}/game/${gameId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch game state');
        }
        return await response.json();
    }
};

export const saveGameState = async (userId: string, gameId: string, gameState: any): Promise<GameProgress> => {
    if (USE_MOCK_DATA) {
        await simulateDelay(300);
        let progress = MOCK_GAME_PROGRESS.find(p => p.userId === userId && p.gameId === gameId);
        if (progress) {
            progress.gameState = gameState;
            progress.updatedAt = new Date().toISOString();
        } else {
            progress = {
                id: `progress-${userId}-${gameId}`,
                userId,
                gameId,
                gameState,
                updatedAt: new Date().toISOString(),
            };
            MOCK_GAME_PROGRESS.push(progress);
        }
        console.log("Game state saved:", progress);
        return progress;
    } else {
        const response = await fetch(`${API_BASE_URL}/game-state/user/${userId}/game/${gameId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameState }),
        });
        if (!response.ok) {
            throw new Error('Failed to save game state');
        }
        return await response.json();
    }
};

export const clearGameState = async (userId: string, gameId: string): Promise<void> => {
    if (USE_MOCK_DATA) {
        await simulateDelay(100);
        const index = MOCK_GAME_PROGRESS.findIndex(p => p.userId === userId && p.gameId === gameId);
        if (index > -1) {
            MOCK_GAME_PROGRESS.splice(index, 1);
            console.log("Game state cleared for", gameId);
        }
    } else {
        const response = await fetch(`${API_BASE_URL}/game-state/user/${userId}/game/${gameId}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            throw new Error('Failed to clear game state');
        }
    }
};
