import { User, Challenge, Game, GameType, GameSubmission, WordleData, ConnectionsData, CrosswordData, SubmitGamePayload, GameProgress, AdminStats, LogEntry} from '@/types';

const USE_MOCK_DATA = import.meta.env.MODE === 'development';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// --- MOCK DATABASE ---

const MOCK_USERS: User[] = [
    { id: 'user-1', name: 'John Doe', email: 'john@example.com', isAdmin: true },
    { id: 'user-2', name: 'Jane Smith', email: 'jane@example.com' },
    { id: 'user-3', name: 'Peter Jones', email: 'peter@example.com' },
];

const MOCK_CHALLENGE: Challenge = {
    id: 'challenge-1', 
    name: 'Lenten Challenge 2025', 
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), 
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 38).toISOString() 
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
const getAuthHeaders = (userId?: string) => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (userId) {
        headers['X-User-ID'] = userId;
    }
    else {
         try {
            const stored = localStorage.getItem('smym-user');
            if (stored) {
                const user = JSON.parse(stored);
                if (user.id) headers['X-User-ID'] = user.id;
            }
        } catch (e) {}
    }
    return headers;
};

const simulateDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- API FUNCTIONS ---

export const login = async (email: string, pass: string): Promise<User> => {
    if (USE_MOCK_DATA) {
        await simulateDelay(500);
        const user = MOCK_USERS.find(u => u.email === email);
        if (user) {
            // MOCK ONLY: Map is_admin to isAdmin if it existed in a different format in legacy mock data, 
            // but here we defined it correctly above.
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
            const error = await response.json();
            throw new Error(error.error || 'Invalid credentials');
        }
        
        return await response.json();
    }
};

export const signup = async (name: string, email: string, pass: string, emailNotifications: boolean): Promise<{ message: string }> => {
    if (USE_MOCK_DATA) {
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
    if (USE_MOCK_DATA) {
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
        // Updated to return ALL games, irrespective of current date
        return MOCK_GAMES;
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
             if (response.status === 404) return null;
             const data = await response.json();
             return data || null;
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

        default: {
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
    if (USE_MOCK_DATA) {
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
    if (USE_MOCK_DATA) {
        // Mock admin stats
        return {
            totalUsers: MOCK_USERS.length,
            playsToday: 5,
            totalPlays: MOCK_SUBMISSIONS.length,
            upcomingGames: MOCK_GAMES.filter(g => new Date(g.date) > new Date()).length
        };
    }
    const response = await fetch(`${API_BASE_URL}/admin/stats`, {
        headers: getAuthHeaders(userId)
    });
    if (!response.ok) throw new Error('Failed to fetch admin stats');
    return await response.json();
}

export const getChallenges = async (userId: string): Promise<Challenge[]> => {
    if (USE_MOCK_DATA) {
        return [MOCK_CHALLENGE];
    }
     const response = await fetch(`${API_BASE_URL}/admin/challenges`, {
        headers: getAuthHeaders(userId)
    });
    if (!response.ok) throw new Error('Failed to fetch challenges');
    return await response.json();
}

export const createGame = async (userId: string, gameData: any): Promise<void> => {
    if (USE_MOCK_DATA) {
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
        headers: getAuthHeaders(userId),
        body: JSON.stringify(gameData)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create game');
    }
}

export const createChallenge = async (userId: string, challengeData: Partial<Challenge>): Promise<void> => {
    if (USE_MOCK_DATA) return; // Not implemented for mock
    const response = await fetch(`${API_BASE_URL}/admin/challenges`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(challengeData)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create challenge');
    }
}

export const updateChallenge = async (userId: string, challengeId: string, challengeData: Partial<Challenge>): Promise<void> => {
    if (USE_MOCK_DATA) return; // Not implemented for mock
    const response = await fetch(`${API_BASE_URL}/admin/challenges/${challengeId}`, {
        method: 'PUT',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(challengeData)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update challenge');
    }
}

export const deleteChallenge = async (userId: string, challengeId: string): Promise<void> => {
    if (USE_MOCK_DATA) return; // Not implemented for mock
    const response = await fetch(`${API_BASE_URL}/admin/challenges/${challengeId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(userId)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete challenge');
    }
}

export const getUsers = async (userId: string, limit = 50, offset = 0): Promise<User[]> => {
    if (USE_MOCK_DATA) return MOCK_USERS;
    const response = await fetch(`${API_BASE_URL}/admin/users?limit=${limit}&offset=${offset}`, {
        headers: getAuthHeaders(userId)
    });
    if (!response.ok) throw new Error('Failed to fetch users');
    return await response.json();
};

export const updateUser = async (adminUserId: string, targetUserId: string, data: { isAdmin?: boolean, isVerified?: boolean }): Promise<void> => {
    if (USE_MOCK_DATA) return;
     const response = await fetch(`${API_BASE_URL}/admin/users/${targetUserId}`, {
        method: 'PUT',
        headers: getAuthHeaders(adminUserId),
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update user');
};

export const getLogs = async (userId: string, limit = 100, offset = 0): Promise<LogEntry[]> => {
    if (USE_MOCK_DATA) return [];
    const response = await fetch(`${API_BASE_URL}/admin/logs?limit=${limit}&offset=${offset}`, {
        headers: getAuthHeaders(userId)
    });
    if (!response.ok) throw new Error('Failed to fetch logs');
    return await response.json();
};