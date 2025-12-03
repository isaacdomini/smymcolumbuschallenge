import { storage } from '@/utils/storage';
import { User, Challenge, Game, GameType, GameSubmission, WordleData, ConnectionsData, CrosswordData, MatchTheWordData, SubmitGamePayload, GameProgress, AdminStats, LogEntry, BannerMessage } from '@/types';

const USE_MOCK_DATA = import.meta.env.MODE === 'development';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const isTestUser = async (): Promise<boolean> => {
    try {
        const stored = await storage.get('user');
        if (stored) {
            const user = JSON.parse(stored);
            return user && user.email && user.email.split('@')[0] === 'test';
        }
    } catch (e) { }
    return false;
};




// --- MOCK DATABASE ---

const MOCK_USERS: User[] = [
    { id: 'user-1', name: 'John Doe', email: 'john@example.com', isAdmin: true },
    { id: 'user-2', name: 'Jane Smith', email: 'jane@example.com' },
    { id: 'user-3', name: 'Peter Jones', email: 'peter@example.com' },
];

const MOCK_CHALLENGE: Challenge = {
    id: 'challenge-1',
    name: 'Lenten Challenge 2025',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString()
};

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
    } else if (gameTypeIndex === 1) {
        game = {
            id: `game-match-${dateStr}`,
            challengeId: MOCK_CHALLENGE.id,
            date: gameDate.toISOString(),
            type: GameType.MATCH_THE_WORD,
            data: {
                pairs: [
                    { word: 'David', match: 'Shepherd King' },
                    { word: 'Moses', match: 'Lawgiver' },
                    { word: 'Abraham', match: 'Father of Nations' },
                    { word: 'Paul', match: 'Apostle to the Gentiles' },
                    { word: 'Esther', match: 'Queen of Persia' }
                ]
            } as MatchTheWordData,
        };
    } else {
        const crosswordData: CrosswordData = {
            rows: 5,
            cols: 5,
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

const now = new Date();
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

const MOCK_SUBMISSIONS: GameSubmission[] = [
    { id: 'sub-1', userId: 'user-1', gameId: MOCK_GAMES[0].id, challengeId: MOCK_CHALLENGE.id, startedAt: new Date(twoDaysAgo.getTime() - 60000).toISOString(), completedAt: twoDaysAgo.toISOString(), timeTaken: 60, mistakes: 2, score: 76, submissionData: { guesses: ['WRONG', 'GUESS', 'GRACE'] } },
    { id: 'sub-2', userId: 'user-2', gameId: MOCK_GAMES[0].id, challengeId: MOCK_CHALLENGE.id, startedAt: new Date(twoDaysAgo.getTime() - 45000).toISOString(), completedAt: twoDaysAgo.toISOString(), timeTaken: 45, mistakes: 1, score: 87, submissionData: { guesses: ['OTHER', 'GRACE'] } },
    { id: 'sub-4', userId: 'user-2', gameId: MOCK_GAMES[1].id, challengeId: MOCK_CHALLENGE.id, startedAt: new Date(yesterday.getTime() - 90000).toISOString(), completedAt: yesterday.toISOString(), timeTaken: 90, mistakes: 0, score: 94 },
];

const MOCK_GAME_PROGRESS: GameProgress[] = [];

// --- HELPER for Auth Headers ---
const getAuthHeaders = async (userId?: string) => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (userId) {
        headers['X-User-ID'] = userId;
    }
    else {
        try {
            const stored = await storage.get('user');
            if (stored) {
                const user = JSON.parse(stored);
                if (user.id) headers['X-User-ID'] = user.id;
            }
        } catch (e) { }
    }
    return headers;
};

const simulateDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- API FUNCTIONS ---

export const login = async (email: string, pass: string): Promise<User> => {
    const useMock = USE_MOCK_DATA || email.split('@')[0] === 'test';
    if (useMock) {
        await simulateDelay(500);
        const user = MOCK_USERS.find(u => u.email === email);
        if (user) {
            // MOCK ONLY: Map is_admin to isAdmin if it existed in a different format in legacy mock data, 
            // but here we defined it correctly above.
            return user;
        }
        if (email.split('@')[0] === 'test') {
            const newUser: User = { id: `user-${Date.now()}`, name: 'Test User', email, isAdmin: true };
            MOCK_USERS.push(newUser);
            return newUser;
        }
        throw new Error("Invalid credentials");
    } else {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Invalid credentials');
        }

        return await response.json();
    }
};

export const signup = async (name: string, email: string, pass: string, emailNotifications: boolean): Promise<{ message: string }> => {
    const useMock = USE_MOCK_DATA || email.split('@')[0] === 'test';
    if (useMock) {
        await simulateDelay(500);
        if (MOCK_USERS.some(u => u.email === email)) {
            throw new Error("User already exists");
        }
        // New mock users are not admins by default
        const newUser: User = { id: `user-${Date.now()}`, name, email };
        MOCK_USERS.push(newUser);
        return { message: "Signup successful. Please check your email to verify your account. (Mock)" };
    } else {
        const response = await fetch(`${API_BASE_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password: pass, emailNotifications }),
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

export const forgotPassword = async (email: string): Promise<{ message: string }> => {
    const useMock = USE_MOCK_DATA || email.split('@')[0] === 'test';
    if (useMock) {
        await simulateDelay(500);
        return { message: 'If an account with that email exists, a password reset link has been sent. (Mock)' };
    } else {
        const response = await fetch(`${API_BASE_URL}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to request password reset');
        }
        return await response.json();
    }
}

export const resetPassword = async (token: string, password: string): Promise<{ message: string }> => {
    if (USE_MOCK_DATA) {
        await simulateDelay(500);
        return { message: 'Password has been reset successfully. You can now log in. (Mock)' };
    } else {
        const response = await fetch(`${API_BASE_URL}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to reset password');
        }
        return await response.json();
    }
}

// --- NEW Account Deletion Request ---
export const requestAccountDeletion = async (email: string, password: string): Promise<{ message: string }> => {
    const useMock = USE_MOCK_DATA || email.split('@')[0] === 'test';
    if (useMock) {
        await simulateDelay(500);
        const user = MOCK_USERS.find(u => u.email === email);
        if (!user) throw new Error("Invalid credentials");
        return { message: 'Your account deletion request has been submitted. (Mock)' };
    } else {
        const response = await fetch(`${API_BASE_URL}/request-deletion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to submit deletion request');
        }
        return await response.json();
    }
};

export const getChallenge = async (): Promise<Challenge | null> => {
    if (USE_MOCK_DATA || await isTestUser()) {
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
    if (USE_MOCK_DATA || await isTestUser()) {
        await simulateDelay(200);
        if (challengeId !== MOCK_CHALLENGE.id) return null;
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        return MOCK_GAMES.find(g => g.date.startsWith(today)) ?? null;
    } else {
        const response = await fetch(`${API_BASE_URL}/challenge/${challengeId}/daily`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch daily game');
        }
        return await response.json();
    }
};

export const getGameById = async (gameId: string): Promise<Game | null> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        await simulateDelay(200);
        return MOCK_GAMES.find(g => g.id === gameId) ?? null;
    } else {
        const response = await fetch(`${API_BASE_URL}/games/${gameId}`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch game');
        }
        return await response.json();
    }
};


export const getGamesForChallenge = async (challengeId: string): Promise<Game[]> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        await simulateDelay(400);
        if (challengeId !== MOCK_CHALLENGE.id) return [];
        // Updated to return ALL games, irrespective of current date
        return MOCK_GAMES;
    } else {
        const response = await fetch(`${API_BASE_URL}/challenge/${challengeId}/games`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch games');
        }
        return await response.json();
    }
};

export const getSubmissionsForUser = async (userId: string, challengeId: string): Promise<GameSubmission[]> => {
    if (USE_MOCK_DATA || await isTestUser()) {
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
    if (USE_MOCK_DATA || await isTestUser()) {
        await simulateDelay(100);
        return MOCK_SUBMISSIONS.find(s => s.userId === userId && s.gameId === gameId) ?? null;
    } else {
        const response = await fetch(`${API_BASE_URL}/submissions/user/${userId}/game/${gameId}`);
        if (!response.ok) {
            if (response.status === 404) return null;
            const data = await response.json().catch(() => null);
            return data || null;
        }
        return await response.json();
    }
};

export const getLeaderboard = async (challengeId: string): Promise<(GameSubmission & { user: User })[]> => {
    if (USE_MOCK_DATA || await isTestUser()) {
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
            id: `leaderboard-${us.user.id}`,
            userId: us.user.id,
            challengeId,
            score: us.totalScore,
            user: us.user,
            gameId: '',
            startedAt: '',
            completedAt: '',
            timeTaken: 0,
            mistakes: 0,
        }));
    } else {
        const response = await fetch(`${API_BASE_URL}/challenge/${challengeId}/leaderboard`);
        if (!response.ok) {
            throw new Error('Failed to fetch leaderboard');
        }
        return await response.json();
    }
};

const calculateScore = (payload: SubmitGamePayload, game: Game): number => {
    const { timeTaken, mistakes, submissionData } = payload;

    switch (game.type) {
        case GameType.WORDLE: {
            const maxGuesses = 6;
            if (mistakes >= maxGuesses) {
                return 0;
            }
            return (maxGuesses - mistakes) * 10;
        }

        case GameType.CONNECTIONS: {
            const categoriesFound = submissionData?.categoriesFound ?? 0;
            const categoryScore = categoriesFound * 20;
            const mistakePenalty = mistakes * 5;
            return Math.max(0, categoryScore - mistakePenalty);
        }

        case GameType.CROSSWORD: {
            const correctCells = submissionData?.correctCells ?? 0;
            const totalFillableCells = submissionData?.totalFillableCells ?? 1;
            if (totalFillableCells === 0) return 0;

            const accuracyScore = Math.round((correctCells / totalFillableCells) * 70);
            const timeBonus = Math.max(0, 30 - Math.floor(timeTaken / 60));
            return Math.max(0, accuracyScore + timeBonus);
        }

        case GameType.MATCH_THE_WORD: {
            const foundPairsCount = submissionData?.foundPairsCount ?? 0;
            const pairScore = foundPairsCount * 20;
            const mistakePenalty = mistakes * 10;
            return Math.max(0, pairScore - mistakePenalty);
        }

        case GameType.VERSE_SCRAMBLE: {
            // Max Score: 100
            // Completion: 50
            // Accuracy: 30 (deduct 5 per mistake, though mistakes might not be tracked heavily in UI yet)
            // Time: 20
            if (!submissionData?.completed) return 0;

            const completionScore = 50;
            const accuracyScore = Math.max(0, 30 - (mistakes * 5));
            const timeBonus = Math.max(0, 20 - Math.floor(timeTaken / 10)); // Lose 1 pt every 10s after base time? Or just simple decay

            return completionScore + accuracyScore + timeBonus;
        }

        case GameType.WHO_AM_I: {
            // Max Score: 100
            // Win: 50
            // Guesses Remaining: 5 pts each (max 6 guesses allowed -> 5 * 6 = 30)
            // Time: 20
            if (!submissionData?.solved) return 0;

            const winScore = 50;
            const maxMistakes = 6;
            const remainingGuesses = Math.max(0, maxMistakes - mistakes);
            const guessBonus = remainingGuesses * 5;
            const timeBonus = Math.max(0, 20 - Math.floor(timeTaken / 15));

            return winScore + guessBonus + timeBonus;
        }

        case GameType.WORD_SEARCH: {
            // Max Score: 100 (assuming ~5 words)
            // Words: 10 pts each
            // Completion: 20 pts
            // Time: 30 pts
            const wordsFound = submissionData?.wordsFound ?? 0;
            const totalWords = submissionData?.totalWords ?? 5; // Default to 5 if unknown

            const wordScore = wordsFound * 10;
            const completionBonus = (wordsFound === totalWords) ? 20 : 0;
            const timeBonus = Math.max(0, 30 - Math.floor(timeTaken / 20));

            return wordScore + completionBonus + timeBonus;
        }

        default: {
            const timePenalty = Math.floor(timeTaken / 15);
            const mistakePenalty = mistakes * 10;
            return Math.max(0, 100 - mistakePenalty - timePenalty);
        }
    }
}

export const submitGame = async (payload: SubmitGamePayload): Promise<GameSubmission> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        await simulateDelay(500);
        const game = MOCK_GAMES.find(g => g.id === payload.gameId);
        if (!game) throw new Error("Game not found to submit to.");

        const score = calculateScore(payload, game);

        const newSubmission: GameSubmission = {
            id: `sub-${Date.now()}`,
            userId: payload.userId,
            gameId: payload.gameId,
            challengeId: MOCK_CHALLENGE.id,
            startedAt: payload.startedAt,
            completedAt: new Date().toISOString(),
            timeTaken: payload.timeTaken,
            mistakes: payload.mistakes,
            score,
            submissionData: payload.submissionData,
        };
        const existingIndex = MOCK_SUBMISSIONS.findIndex(s => s.userId === payload.userId && s.gameId === payload.gameId);
        if (existingIndex > -1) {
            if (score > MOCK_SUBMISSIONS[existingIndex].score) {
                MOCK_SUBMISSIONS[existingIndex] = newSubmission;
            }
            return MOCK_SUBMISSIONS[existingIndex];
        } else {
            MOCK_SUBMISSIONS.push(newSubmission);
            return newSubmission;
        }
    } else {
        // Backend now calculates score, so we just send the raw data
        const response = await fetch(`${API_BASE_URL}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error('Failed to submit game');
        }

        return await response.json();
    }
};

export const getGameState = async (userId: string, gameId: string): Promise<GameProgress | null> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        await simulateDelay(200);
        return MOCK_GAME_PROGRESS.find(p => p.userId === userId && p.gameId === gameId) ?? null;
    } else {
        const response = await fetch(`${API_BASE_URL}/game-state/user/${userId}/game/${gameId}`);
        if (!response.ok) {
            if (response.status === 404) return null;
            const data = await response.json().catch(() => null);
            return data;
        }
        return await response.json();
    }
};

export const saveGameState = async (userId: string, gameId: string, gameState: any): Promise<GameProgress> => {
    if (USE_MOCK_DATA || await isTestUser()) {
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
    if (USE_MOCK_DATA || await isTestUser()) {
        await simulateDelay(100);
        const index = MOCK_GAME_PROGRESS.findIndex(p => p.userId === userId && p.gameId === gameId);
        if (index > -1) {
            MOCK_GAME_PROGRESS.splice(index, 1);
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

// --- ADMIN API ---

export const getAdminStats = async (userId: string): Promise<AdminStats> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        // Mock admin stats
        return {
            totalUsers: MOCK_USERS.length,
            playsToday: 5,
            totalPlays: MOCK_SUBMISSIONS.length,
            upcomingGames: MOCK_GAMES.filter(g => new Date(g.date) > new Date()).length
        };
    }
    const response = await fetch(`${API_BASE_URL}/admin/stats`, {
        headers: await getAuthHeaders(userId)
    });
    if (!response.ok) throw new Error('Failed to fetch admin stats');
    return await response.json();
}

export const getChallenges = async (userId: string): Promise<Challenge[]> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        return [MOCK_CHALLENGE];
    }
    const response = await fetch(`${API_BASE_URL}/admin/challenges`, {
        headers: await getAuthHeaders(userId)
    });
    if (!response.ok) throw new Error('Failed to fetch challenges');
    return await response.json();
}

export const createGame = async (userId: string, gameData: any): Promise<void> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        console.log("Mock create game:", gameData);
        MOCK_GAMES.push({
            id: `game-${gameData.type}-${gameData.date}`,
            challengeId: gameData.challengeId,
            date: new Date(gameData.date).toISOString(),
            type: gameData.type,
            data: gameData.data
        } as Game);
        return;
    }
    const response = await fetch(`${API_BASE_URL}/admin/games`, {
        method: 'POST',
        headers: await getAuthHeaders(userId),
        body: JSON.stringify(gameData)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create game');
    }
}

export const createChallenge = async (userId: string, challengeData: Partial<Challenge>): Promise<void> => {
    if (USE_MOCK_DATA || await isTestUser()) return; // Not implemented for mock
    const response = await fetch(`${API_BASE_URL}/admin/challenges`, {
        method: 'POST',
        headers: await getAuthHeaders(userId),
        body: JSON.stringify(challengeData)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create challenge');
    }
}

export const updateChallenge = async (userId: string, challengeId: string, challengeData: Partial<Challenge>): Promise<void> => {
    if (USE_MOCK_DATA || await isTestUser()) return; // Not implemented for mock
    const response = await fetch(`${API_BASE_URL}/admin/challenges/${challengeId}`, {
        method: 'PUT',
        headers: await getAuthHeaders(userId),
        body: JSON.stringify(challengeData)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update challenge');
    }
}

export const deleteChallenge = async (userId: string, challengeId: string): Promise<void> => {
    if (USE_MOCK_DATA || await isTestUser()) return; // Not implemented for mock
    const response = await fetch(`${API_BASE_URL}/admin/challenges/${challengeId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(userId)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete challenge');
    }
}

export const getUsers = async (userId: string, limit = 50, offset = 0): Promise<User[]> => {
    if (USE_MOCK_DATA || await isTestUser()) return MOCK_USERS;
    const response = await fetch(`${API_BASE_URL}/admin/users?limit=${limit}&offset=${offset}`, {
        headers: await getAuthHeaders(userId)
    });
    if (!response.ok) throw new Error('Failed to fetch users');
    return await response.json();
};

export const updateUserAsAdmin = async (adminUserId: string, targetUserId: string, data: { isAdmin?: boolean, isVerified?: boolean }): Promise<void> => {
    if (USE_MOCK_DATA || await isTestUser()) return;
    const response = await fetch(`${API_BASE_URL}/admin/users/${targetUserId}`, {
        method: 'PUT',
        headers: await getAuthHeaders(adminUserId),
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update user');
};

export const deleteUserAsAdmin = async (adminUserId: string, targetUserId: string): Promise<void> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        await simulateDelay(500);
        const index = MOCK_USERS.findIndex(u => u.id === targetUserId);
        if (index === -1) throw new Error("User not found");
        MOCK_USERS.splice(index, 1);
        return;
    }
    const response = await fetch(`${API_BASE_URL}/admin/users/${targetUserId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(adminUserId)
    });
    if (!response.ok) throw new Error('Failed to delete user');
};

export const updateUserProfile = async (userId: string, data: { name: string }): Promise<User> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        await simulateDelay(500);
        const user = MOCK_USERS.find(u => u.id === userId);
        if (!user) throw new Error("User not found");
        user.name = data.name;
        return user;
    }
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: await getAuthHeaders(userId),
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update user profile');
    return await response.json();
}

export const deleteUser = async (userId: string): Promise<void> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        await simulateDelay(500);
        const index = MOCK_USERS.findIndex(u => u.id === userId);
        if (index === -1) throw new Error("User not found");
        MOCK_USERS.splice(index, 1);
        return;
    }
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(userId)
    });
    if (!response.ok) throw new Error('Failed to delete user');
}

export const getLogs = async (userId: string, limit = 100, offset = 0): Promise<LogEntry[]> => {
    if (USE_MOCK_DATA || await isTestUser()) return [];
    const response = await fetch(`${API_BASE_URL}/admin/logs?limit=${limit}&offset=${offset}`, {
        headers: await getAuthHeaders(userId)
    });
    if (!response.ok) throw new Error('Failed to fetch logs');
    return await response.json();
};

export const getGames = async (userId: string, challengeId: string): Promise<Game[]> => {
    if (USE_MOCK_DATA || await isTestUser()) return []; // Not implemented for mock
    const response = await fetch(`${API_BASE_URL}/admin/games?challengeId=${challengeId}`, {
        headers: await getAuthHeaders(userId)
    });
    if (!response.ok) throw new Error('Failed to fetch games');
    return await response.json();
};

export const deleteGame = async (userId: string, gameId: string): Promise<void> => {
    if (USE_MOCK_DATA || await isTestUser()) return; // Not implemented for mock
    const response = await fetch(`${API_BASE_URL}/admin/games/${gameId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(userId)
    });
    if (!response.ok) throw new Error('Failed to delete game');
};


// --- DAILY MESSAGES ---

export interface DailyMessage {
    id: string;
    date: string;
    content: string;
    createdAt?: string;
}

export const getDailyMessage = async (date?: string): Promise<DailyMessage | null> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        // Mock data
        return {
            id: 'msg-mock',
            date: date || new Date().toISOString().split('T')[0],
            content: 'This is a mock daily message for testing purposes.'
        };
    }
    const query = date ? `?date=${date}` : '';
    const response = await fetch(`${API_BASE_URL}/daily-message${query}`);
    if (!response.ok) throw new Error('Failed to fetch daily message');
    return await response.json();
};

// --- BANNER MESSAGES ---

export const getBannerMessages = async (): Promise<BannerMessage[]> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        await simulateDelay(300);
        return [
            { id: 1, content: 'Welcome to the Lenten Challenge! (Mock)', type: 'system', active: true, created_at: new Date().toISOString() }
        ];
    }
    const response = await fetch(`${API_BASE_URL}/banner-messages`, {
        headers: await getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch banner messages');
    return await response.json();
};

export const dismissBannerMessage = async (id: number): Promise<void> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        await simulateDelay(200);
        return;
    }
    const response = await fetch(`${API_BASE_URL}/banner-messages/${id}/dismiss`, {
        method: 'POST',
        headers: await getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to dismiss banner message');
};

export const createBannerMessage = async (userId: string, messageData: { content: string, type: 'system' | 'user', targetUserIds?: string[], expiresAt?: string, linkUrl?: string, linkText?: string }): Promise<void> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        await simulateDelay(300);
        return;
    }
    const response = await fetch(`${API_BASE_URL}/admin/banner-messages`, {
        method: 'POST',
        headers: await getAuthHeaders(userId),
        body: JSON.stringify(messageData)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create banner message');
    }
};

// --- SUPPORT TICKETS ---

export const createTicket = async (email: string, issue: string, userId?: string): Promise<{ ticketId: string }> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        await simulateDelay(500);
        return { ticketId: `ticket-${Date.now()}` };
    }
    const response = await fetch(`${API_BASE_URL}/support/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, issue, userId }),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create ticket');
    }
    return await response.json();
};

export const getTicket = async (ticketId: string): Promise<{ ticket: any, notes: any[] }> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        await simulateDelay(300);
        return {
            ticket: {
                id: ticketId,
                email: 'mock@example.com',
                issue: 'This is a mock issue description.',
                status: 'open',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            notes: []
        };
    }
    const response = await fetch(`${API_BASE_URL}/support/ticket/${ticketId}`);
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch ticket');
    }
    return await response.json();
};

// Admin Support Functions

export const getAdminTickets = async (userId: string, limit = 50, offset = 0, status?: string): Promise<any[]> => {
    if (USE_MOCK_DATA || await isTestUser()) {
        return [];
    }
    let url = `${API_BASE_URL}/admin/support/tickets?limit=${limit}&offset=${offset}`;
    if (status) url += `&status=${status}`;

    const response = await fetch(url, {
        headers: await getAuthHeaders(userId)
    });
    if (!response.ok) throw new Error('Failed to fetch tickets');
    return await response.json();
};

export const addTicketNote = async (userId: string, ticketId: string, note: string): Promise<void> => {
    if (USE_MOCK_DATA || await isTestUser()) return;

    const response = await fetch(`${API_BASE_URL}/admin/support/tickets/${ticketId}/notes`, {
        method: 'POST',
        headers: await getAuthHeaders(userId),
        body: JSON.stringify({ note, userId }) // API expects userId in body currently
    });
    if (!response.ok) throw new Error('Failed to add note');
};

export const updateTicketStatus = async (userId: string, ticketId: string, status: string): Promise<void> => {
    if (USE_MOCK_DATA || await isTestUser()) return;

    const response = await fetch(`${API_BASE_URL}/admin/support/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: await getAuthHeaders(userId),
        body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Failed to update status');
};

export const getAllDailyMessages = async (userId: string, limit = 50, offset = 0): Promise<DailyMessage[]> => {
    if (USE_MOCK_DATA || await isTestUser()) return [];
    const response = await fetch(`${API_BASE_URL}/admin/daily-messages?limit=${limit}&offset=${offset}`, {
        headers: await getAuthHeaders(userId)
    });
    if (!response.ok) throw new Error('Failed to fetch daily messages');
    return await response.json();
};

export const saveDailyMessage = async (userId: string, message: { date: string, content: string }): Promise<void> => {
    if (USE_MOCK_DATA || await isTestUser()) return;
    const response = await fetch(`${API_BASE_URL}/admin/daily-messages`, {
        method: 'POST',
        headers: await getAuthHeaders(userId),
        body: JSON.stringify(message)
    });
    if (!response.ok) throw new Error('Failed to save daily message');
};

export const deleteDailyMessage = async (userId: string, messageId: string): Promise<void> => {
    if (USE_MOCK_DATA || await isTestUser()) return;
    const response = await fetch(`${API_BASE_URL}/admin/daily-messages/${messageId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(userId)
    });
    if (!response.ok) throw new Error('Failed to delete daily message');
};
export const getScoringCriteria = async (): Promise<any[]> => {
    return [
        {
            title: 'Wordle',
            description: 'Your score is based solely on the number of guesses used.',
            hidden: false,
            points: [
                'Guess Score: Up to 60 points (10 points for every unused guess remaining).',
                'Losing (6 incorrect guesses) results in a score of 0.'
            ]
        },
        {
            title: 'Connections',
            description: 'Solve the puzzle by grouping words into categories.',
            hidden: false,
            points: [
                'Category Score: 20 points for each correct category found.',
                'Mistake Penalty: -5 points for each incorrect guess.'
            ]
        },
        {
            title: 'Crossword',
            description: 'Complete the crossword by solving the clues.',
            hidden: false,
            points: [
                'Accuracy Score: Up to 70 points based on the percentage of correctly filled cells.',
                'Time Bonus: Up to 30 points for a fast completion time.'
            ]
        },
        {
            title: 'Match the Word',
            description: 'Your score is based on how quickly and accurately you match the words.',
            hidden: false,
            points: [
                'Match Score: 10 points for each correct match.',
                'Time Bonus: Up to 30 points for a fast completion time.',
                'Mistake Penalty: -5 points for each incorrect match.'
            ]
        },
        {
            title: 'Verse Scramble',
            description: 'Unscramble the Bible verse by dragging words into the correct order.',
            hidden: false,
            points: [
                'Completion Score: 50 points for completing the verse.',
                'Accuracy Bonus: Up to 30 points for minimal mistakes.',
                'Time Bonus: Up to 20 points for fast completion.'
            ]
        },
        {
            title: 'Who Am I?',
            description: 'Guess the biblical figure before running out of guesses (Hangman style).',
            hidden: false,
            points: [
                'Win Score: 50 points for guessing the correct answer.',
                'Guess Bonus: 5 points for each remaining incorrect guess allowed.',
                'Time Bonus: Up to 20 points for fast completion.'
            ]
        },
        {
            title: 'Word Search',
            description: 'Find all the hidden words in the grid.',
            hidden: true,
            points: [
                'Word Score: 10 points for each word found.',
                'Completion Bonus: 20 points for finding all words.',
                'Time Bonus: Up to 30 points for speed.'
            ]
        }
    ];
};