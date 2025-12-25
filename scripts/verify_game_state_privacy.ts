
import fetch from 'node-fetch';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'smym_bible_games',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const API_URL = 'http://localhost:3002/api';
let USER_ID = 'test-user-' + Date.now();

async function runTest() {
  console.log('Starting Game State Privacy Check...');

  // 0. Create a user
  console.log('Creating test user...');
  const signupRes = await fetch(`${API_URL}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test User',
      email: `${USER_ID}@example.com`,
      password: 'password123'
    })
  });

  // Manually verify user in DB
  await pool.query('UPDATE users SET is_verified = true WHERE email = $1', [`${USER_ID}@example.com`]);

  if (!signupRes.ok) {
    // If user already exists, try to login or just use the ID if we knew it.
    // But since we generate ID, it should be fine.
    // Wait, signup returns 201.
    console.error('Failed to create user:', await signupRes.text());
    // Try to login to get ID if needed, but we don't get ID from login easily without parsing.
    // Actually login returns user object with ID.
    const loginRes = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${USER_ID}@example.com`,
        password: 'password123'
      })
    });
    const user = await loginRes.json();
    console.log('Login Response (Error Path):', JSON.stringify(user, null, 2));
    USER_ID = user.id;
  } else {
    // Signup doesn't return ID directly in some implementations, but let's check.
    // The signup endpoint returns { message: ... }.
    // So we need to login to get the ID.
    const loginRes = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${USER_ID}@example.com`,
        password: 'password123'
      })
    });
    const user = await loginRes.json();
    console.log('Login Response (Success Path):', JSON.stringify(user, null, 2));
    USER_ID = user.id;
  }

  console.log('Using User ID:', USER_ID);

  // 1. Start a game (or get existing) to ensure state exists
  // We'll use a random game ID to ensure fresh state if possible, or just a fixed one
  const gameId = 'game-wordle-2025-11-25'; // Use a known date/game

  // First, we need to make sure the game exists in the DB (it should from seeding)
  // But to be safe, let's try to fetch it via the public endpoint first to trigger assignment if needed?
  // Actually, resolveGameData does assignment. So fetching /games/:id or /challenge/:id/daily triggers it?
  // Let's try to hit the daily game endpoint for a challenge.

  // We need a challenge ID. Let's fetch active challenge.
  const challengeRes = await fetch(`${API_URL}/challenge`);
  const challenge = await challengeRes.json();

  if (!challenge) {
    console.error('No active challenge found. Cannot run test.');
    return;
  }

  console.log('Active Challenge:', challenge.id);

  // Get games for this challenge
  const gamesRes = await fetch(`${API_URL}/challenge/${challenge.id}/games`, {
    headers: { 'x-user-id': USER_ID }
  });
  const games = await gamesRes.json();
  console.log('Games Response:', JSON.stringify(games, null, 2));

  if (!games || games.length === 0) {
    console.error('No games found for challenge.');
    return;
  }

  // Find a Wordle game
  const wordleGame = games.find((g: any) => g.type === 'wordle' || g.type === 'wordle_advanced');

  if (!wordleGame) {
    console.error('No Wordle game found in challenge.');
    return;
  }

  console.log('Testing with Game ID:', wordleGame.id);

  // 2. Fetch Game State
  const gameStateRes = await fetch(`${API_URL}/game-state/user/${USER_ID}/game/${wordleGame.id}`);
  const gameStateData = await gameStateRes.json();

  console.log('Game State Response:', JSON.stringify(gameStateData, null, 2));

  if (gameStateData && gameStateData.gameState) {
    const state = gameStateData.gameState;
    const sensitiveFields = [
      'assignedWord',
      'assignedSolution',
      'assignedVerse',
      'assignedCategories',
      'assignedCrosswordIndex',
      'assignedWhoAmI',
      'assignedPairs',
      'assignedWordSearchIndex'
    ];

    const exposedFields = sensitiveFields.filter(field => state[field] !== undefined);

    if (exposedFields.length > 0) {
      console.error('❌ FAILURE: Sensitive fields exposed:', exposedFields.join(', '));
      process.exit(1);
    } else {
      console.log('✅ SUCCESS: No sensitive fields found in game state.');
    }
  } else {
    // If no state, maybe we need to "play" first to create it?
    // The resolveGameData should have created it if we passed x-user-id above.
    // Let's check if we can save some state and see if it returns the assigned word.
    // If we just fetched games, resolveGameData might have assigned a word but maybe didn't save it to game_progress if it was just a read?
    // resolveGameData DOES insert into game_progress if not found.

    console.log('No game state returned. This might mean the user has no progress yet, but resolveGameData should have assigned a word.');
    // Let's try to save some dummy progress
    const saveRes = await fetch(`${API_URL}/game-state/user/${USER_ID}/game/${wordleGame.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameState: { guesses: ['TESTS'], activeGuessIndex: 1 } })
    });
    const savedData = await saveRes.json();
    console.log('Saved Data Response:', JSON.stringify(savedData, null, 2));

    if (savedData.gameState) {
      const state = savedData.gameState;
      const sensitiveFields = [
        'assignedWord',
        'assignedSolution',
      ];
      const exposedFields = sensitiveFields.filter(field => state[field] !== undefined);
      if (exposedFields.length > 0) {
        console.error('❌ FAILURE (After Save): Sensitive fields exposed:', exposedFields.join(', '));
        process.exit(1);
      } else {
        console.log('✅ SUCCESS (After Save): No sensitive fields found.');
      }
    }
  }
}

runTest().catch(console.error);
