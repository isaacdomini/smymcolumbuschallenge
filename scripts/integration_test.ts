import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const APP_URL = process.env.TEST_APP_URL || 'http://localhost:5173';
const DB_CONNECTION_STRING = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smym_bible_games';

const pool = new Pool({
  connectionString: DB_CONNECTION_STRING,
});

// Helpers
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function request(method: string, path: string, token?: string, body?: any) {
  const headers: any = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // For some endpoints we might need x-user-id if we are simulating the client's behavior
  // But usually the token is enough if the backend verifies it. 
  // Wait, the current backend uses x-user-id header often? 
  // Let's check api.ts... yes, it uses req.headers['x-user-id'].
  // We should send that if we have it.

  const opts: any = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${APP_URL}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

// Test State
let adminToken: string;
let adminUserId: string;
let userToken: string;
let userId: string;
let challengeId: string;
let gameIds: Record<string, string> = {};

async function runTests() {
  console.log('Starting Integration Tests...');
  console.log(`Target: ${APP_URL}`);
  console.log(`DB: ${DB_CONNECTION_STRING.split('@')[1]}`); // Hide credentials

  try {
    // 1. User Management
    console.log('\n--- 1. User Management ---');

    // Register Admin
    const adminEmail = `admin-${uuidv4()}@test.com`;
    const adminPass = 'password123';
    console.log(`Registering Admin: ${adminEmail}`);
    let res = await request('POST', '/api/auth/register', undefined, { name: 'Admin User', email: adminEmail, password: adminPass });
    if (res.status !== 200) throw new Error(`Failed to register admin: ${JSON.stringify(res.data)}`);
    adminUserId = res.data.user.id;

    // Verify Admin in DB
    await pool.query('UPDATE users SET is_verified = true, is_admin = true WHERE id = $1', [adminUserId]);
    console.log('Verified Admin in DB');

    // Login Admin
    res = await request('POST', '/api/auth/login', undefined, { email: adminEmail, password: adminPass });
    if (res.status !== 200) throw new Error('Failed to login admin');
    adminToken = res.data.token;
    console.log('Admin Logged In');

    // Register User A
    const userEmail = `user-${uuidv4()}@test.com`;
    console.log(`Registering User A: ${userEmail}`);
    res = await request('POST', '/api/auth/register', undefined, { name: 'User A', email: userEmail, password: 'password123' });
    userId = res.data.user.id;

    // Verify User A in DB
    await pool.query('UPDATE users SET is_verified = true WHERE id = $1', [userId]);
    console.log('Verified User A in DB');

    // Login User A
    res = await request('POST', '/api/auth/login', undefined, { email: userEmail, password: 'password123' });
    userToken = res.data.token;
    console.log('User A Logged In');


    // 2. Challenge & Game Creation
    console.log('\n--- 2. Challenge & Game Creation ---');

    // Create Challenge
    challengeId = `test-challenge-${uuidv4()}`;
    await pool.query("INSERT INTO challenges (id, name, start_date, end_date) VALUES ($1, 'Integration Test Challenge', NOW(), NOW() + INTERVAL '1 day')", [challengeId]);
    console.log(`Created Challenge: ${challengeId}`);

    // Create Wordle with Multiple Solutions
    const wordleId = `game-wordle-${uuidv4()}`;
    const wordleData = { solutions: ['APPLE', 'BERRY', 'CHERRY'], wordLength: 5 };
    await pool.query("INSERT INTO games (id, challenge_id, date, type, data) VALUES ($1, $2, NOW(), 'wordle', $3)", [wordleId, challengeId, JSON.stringify(wordleData)]);
    gameIds['wordle'] = wordleId;
    console.log(`Created Wordle Game: ${wordleId}`);

    // Create Verse Scramble with Multiple Verses
    const verseId = `game-verse-${uuidv4()}`;
    const verseData = { verses: [{ verse: "JESUS WEPT", reference: "John 11:35" }, { verse: "GOD IS LOVE", reference: "1 John 4:8" }] };
    await pool.query("INSERT INTO games (id, challenge_id, date, type, data) VALUES ($1, $2, NOW(), 'verse_scramble', $3)", [verseId, challengeId, JSON.stringify(verseData)]);
    gameIds['verse'] = verseId;
    console.log(`Created Verse Scramble Game: ${verseId}`);


    // 3. Gameplay & Security (User A)
    console.log('\n--- 3. Gameplay & Security (User A) ---');

    // --- WORDLE TEST ---
    console.log('Testing Wordle...');
    // Fetch Game
    // Note: We need to pass x-user-id header if the API expects it, or just rely on token if middleware handles it.
    // The api.ts uses `req.headers['x-user-id']`. The auth middleware usually sets `req.user`, but `resolveGameData` uses `userId` passed to it.
    // Let's assume we need to send the header for now to be safe, or check if `useAuth` sends it. `useAuth` sends token.
    // If `api.ts` extracts from token, great. If it expects header, we must send it.
    // Looking at `api.ts`: `const userId = req.headers['x-user-id'] as string;`
    // It seems it expects the header explicitly!

    const userHeaders = { 'x-user-id': userId, 'Authorization': `Bearer ${userToken}` };

    const wordleRes = await fetch(`${APP_URL}/api/games/${gameIds['wordle']}`, { headers: userHeaders });
    let gameDataRes = await wordleRes.json();

    if (gameDataRes.data.solution) throw new Error('SECURITY FAIL: Wordle solution exposed in API response!');
    if (gameDataRes.data.solutions) throw new Error('SECURITY FAIL: Wordle solutions list exposed in API response!');
    console.log('Security Check Passed: Solution hidden');

    // Check Assignment in DB
    let progress = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameIds['wordle']]);
    let assignedSolution = progress.rows[0]?.game_state?.assignedSolution;
    if (!assignedSolution) throw new Error('Logic Fail: No solution assigned in DB');
    console.log(`Assigned Solution: ${assignedSolution}`);

    // Play (Check Answer)
    // Try a wrong guess
    let checkRes = await fetch(`${APP_URL}/api/games/${gameIds['wordle']}/check`, {
      method: 'POST',
      headers: { ...userHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ guess: 'ZZZZZ' })
    });
    let checkData = await checkRes.json();
    if (checkData.result.every((s: string) => s === 'correct')) throw new Error('Logic Fail: ZZZZZ should not be correct');

    // Try correct guess
    checkRes = await fetch(`${APP_URL}/api/games/${gameIds['wordle']}/check`, {
      method: 'POST',
      headers: { ...userHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ guess: assignedSolution })
    });
    checkData = await checkRes.json();
    if (!checkData.result.every((s: string) => s === 'correct')) throw new Error(`Logic Fail: Assigned solution ${assignedSolution} was not accepted`);
    console.log('Gameplay Check Passed: Validation works with assigned solution');

    // Submit
    let submitRes = await fetch(`${APP_URL}/api/submit`, {
      method: 'POST',
      headers: { ...userHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        gameId: gameIds['wordle'],
        startedAt: new Date().toISOString(),
        timeTaken: 60,
        mistakes: 1,
        submissionData: { guesses: ['ZZZZZ', assignedSolution] }
      })
    });
    let submitData = await submitRes.json();
    if (submitData.score <= 0) throw new Error('Logic Fail: Score should be positive');
    console.log('Submission Check Passed');


    // --- VERSE SCRAMBLE TEST ---
    console.log('\nTesting Verse Scramble...');
    const verseRes = await fetch(`${APP_URL}/api/games/${gameIds['verse']}`, { headers: userHeaders });
    gameDataRes = await verseRes.json();

    if (gameDataRes.data.verse) throw new Error('SECURITY FAIL: Verse text exposed in API response!');
    if (gameDataRes.data.verses) throw new Error('SECURITY FAIL: Verses list exposed in API response!');
    console.log('Security Check Passed: Verse hidden');

    progress = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameIds['verse']]);
    let assignedVerse = progress.rows[0]?.game_state?.assignedVerse;
    if (!assignedVerse) throw new Error('Logic Fail: No verse assigned in DB');
    console.log(`Assigned Verse: ${assignedVerse.verse}`);

    // 4. Random Assignment Verification (User B)
    console.log('\n--- 4. Random Assignment Verification (User B) ---');
    const userBEmail = `userb-${uuidv4()}@test.com`;
    res = await request('POST', '/api/auth/register', undefined, { name: 'User B', email: userBEmail, password: 'password123' });
    const userBId = res.data.user.id;
    await pool.query('UPDATE users SET is_verified = true WHERE id = $1', [userBId]);

    // Fetch Wordle for User B
    const userBHeaders = { 'x-user-id': userBId }; // Simulating auth headers
    await fetch(`${APP_URL}/api/games/${gameIds['wordle']}`, { headers: userBHeaders });

    progress = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userBId, gameIds['wordle']]);
    const assignedSolutionB = progress.rows[0]?.game_state?.assignedSolution;
    console.log(`User A Solution: ${assignedSolution}`);
    console.log(`User B Solution: ${assignedSolutionB}`);

    if (!assignedSolutionB) throw new Error('Logic Fail: User B got no assignment');
    // Note: They might be same, that's fine, just ensuring it works.

    console.log('\n-----------------------------------');
    console.log('✅ ALL INTEGRATION TESTS PASSED');
    console.log('-----------------------------------');

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
