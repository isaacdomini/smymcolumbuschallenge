import { User, Challenge, Game, GameType, GameSubmission, WordleData, ConnectionsData, CrosswordData, SubmitGamePayload } from '../types';

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
        game = {
            id: `game-cross-${dateStr}`,
            challengeId: MOCK_CHALLENGE.id,
            date: gameDate.toISOString(),
            type: GameType.CROSSWORD,
            data: {
                grid: [
                    ['A', 'D', 'A', 'M', null],
                    ['B', '#', 'R', '#', 'O'],
                    ['E', 'L', 'I', 'J', 'A', 'H'],
                    ['L', '#', 'A', '#', 'H']
                ],
                clues: {
                    across: { 1: "First man", 6: "Prophet fed by ravens" },
                    down: { 2: "Garden of Eden fruit", 3: "Slayer of Goliath" },
                },
            } as CrosswordData,
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

const simulateDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- API FUNCTIONS ---

export const login = async (email: string, pass: string): Promise<User> => {
    await simulateDelay(500);
    const user = MOCK_USERS.find(u => u.email === email);
    if (user) { // No password check in mock
        return user;
    }
    throw new Error("Invalid credentials");
};

export const signup = async (name: string, email: string, pass: string): Promise<User> => {
    await simulateDelay(500);
    if (MOCK_USERS.some(u => u.email === email)) {
        throw new Error("User already exists");
    }
    const newUser: User = { id: `user-${Date.now()}`, name, email };
    MOCK_USERS.push(newUser);
    return newUser;
};

export const logout = (): void => {
    // No-op in mock, session is managed client-side
};

export const getChallenge = async (): Promise<Challenge | null> => {
    await simulateDelay(300);
    const now = new Date();
    const isFinished = new Date(MOCK_CHALLENGE.endDate) < now;
    
    if (isFinished) return null;

    return MOCK_CHALLENGE;
};

export const getDailyGame = async (challengeId: string): Promise<Game | null> => {
    await simulateDelay(200);
    if (challengeId !== MOCK_CHALLENGE.id) return null;
    const today = new Date().toISOString().split('T')[0];
    return MOCK_GAMES.find(g => g.date.startsWith(today)) ?? null;
};

export const getGamesForChallenge = async (challengeId: string): Promise<Game[]> => {
    await simulateDelay(400);
    if (challengeId !== MOCK_CHALLENGE.id) return [];
    const now = new Date();
    // Return all games up to and including today
    return MOCK_GAMES.filter(g => new Date(g.date) <= now);
};

export const getSubmissionsForUser = async (userId: string, challengeId: string): Promise<GameSubmission[]> => {
    await simulateDelay(200);
    return MOCK_SUBMISSIONS.filter(s => s.userId === userId && s.challengeId === challengeId);
};

export const getSubmissionForToday = async (userId: string, gameId: string): Promise<GameSubmission | null> => {
    await simulateDelay(100);
    return MOCK_SUBMISSIONS.find(s => s.userId === userId && s.gameId === gameId) ?? null;
};

export const getLeaderboard = async (challengeId: string): Promise<(GameSubmission & { user: User })[]> => {
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
};

/**
 * Calculates a score based on performance.
 * - Base score: 100 points for completion.
 * - Mistake penalty: -10 points per mistake.
 * - Time penalty: -1 point for every 15 seconds taken.
 * - Minimum score is 0.
 */
const calculateScore = (timeTaken: number, mistakes: number): number => {
    const timePenalty = Math.floor(timeTaken / 15);
    const mistakePenalty = mistakes * 10;
    return Math.max(0, 100 - mistakePenalty - timePenalty);
}

export const submitGame = async (payload: SubmitGamePayload): Promise<GameSubmission> => {
    await simulateDelay(500);
    const game = MOCK_GAMES.find(g => g.id === payload.gameId);
    if (!game) throw new Error("Game not found to submit to.");

    const score = calculateScore(payload.timeTaken, payload.mistakes);

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
    return newSubmission;
};
