import puppeteer from 'puppeteer';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
// const APP_URL = process.env.APP_URL || 'http://localhost:5173';
// const DB_CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smym_bible_games';
const APP_URL = 'http://10.0.0.3:6144';//process.env.APP_URL || 'http://localhost:5173';
const DB_CONNECTION_STRING = 'postgresql://postgres:postgres@10.0.0.3:5432/smym_bible_games'//process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smym_bible_games';

const HEADLESS = false; //process.env.HEADLESS !== 'false'; // Default to headless, set HEADLESS=false to see browser

const pool = new Pool({
  connectionString: DB_CONNECTION_STRING,
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runBrowserTests() {
  console.log('Starting Browser Integration Tests...');
  console.log(`Target: ${APP_URL}`);
  console.log(`Headless: ${HEADLESS}`);

  let browser;
  let page;

  try {
    browser = await puppeteer.launch({
      headless: HEADLESS,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    page.on('requestfailed', request => {
      console.log(`PAGE LOG: Request failed: ${request.url()} - ${request.failure()?.errorText}`);
    });
    page.on('requestfinished', request => {
      console.log(`PAGE LOG: Request finished: ${request.url()} [${request.response()?.status()}]`);
    });

    // ... (lines 47-153)

    await page.keyboard.press('Enter');
    await sleep(5000);

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    // 1. User Registration
    console.log('\n--- 1. User Registration ---');
    const userEmail = `browser-user-${uuidv4()}@test.com`;
    const userPass = 'password123';

    console.log(`Registering User: ${userEmail}`);
    await page.goto(`${APP_URL}`);

    // Open Auth Modal
    const openAuthBtn = await page.waitForSelector('xpath///button[text()="Login / Sign Up"]');
    if (openAuthBtn) await openAuthBtn.click();
    else throw new Error('Login / Sign Up button not found');

    // Switch to Sign Up
    const signUpTab = await page.waitForSelector('xpath///button[text()="Sign Up"]');
    if (signUpTab) await signUpTab.click();
    else throw new Error('Sign Up tab not found');

    // Wait for form
    await page.waitForSelector('input[placeholder="John Doe"]');
    await page.type('input[placeholder="John Doe"]', 'Browser User');
    await page.type('input[type="email"]', userEmail);
    // Password field is the first password input
    await page.type('input[type="password"]', userPass);

    // Submit
    const submitBtn = await page.waitForSelector('button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    else throw new Error('Register submit button not found');

    // Wait for success message
    await page.waitForSelector('xpath///div[contains(text(), "Signup successful")]', { timeout: 5000 }).catch(() => console.log('Success message not found or different text'));

    // Close modal or refresh
    await page.reload();

    // Verify User in DB & Verify Email
    await sleep(2000);
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
    if (userRes.rows.length === 0) throw new Error('User not found in DB');
    const userId = userRes.rows[0].id;
    await pool.query('UPDATE users SET is_verified = true WHERE id = $1', [userId]);
    console.log('User verified in DB');

    // Login
    console.log('Logging in...');
    await page.goto(`${APP_URL}`);

    // Open Auth Modal again
    const loginOpenBtn = await page.waitForSelector('xpath///button[text()="Login / Sign Up"]');
    if (loginOpenBtn) await loginOpenBtn.click();

    // Ensure Login tab (default)
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', userEmail);
    await page.type('input[type="password"]', userPass);

    const loginBtn = await page.waitForSelector('button[type="submit"]');
    if (loginBtn) await loginBtn.click();

    // Wait for login to complete (modal closes, user profile appears)
    await page.waitForSelector('xpath///span[contains(text(), "Browser User")]', { timeout: 10000 });
    await sleep(2000);

    // Check if logged in (e.g., look for "Logout" or user name)
    // Assuming dashboard has some unique element
    const url = page.url();
    if (!url.includes('dashboard') && !url.includes('challenge')) {
      console.log('Current URL:', url);
      // Maybe still on login?
    }
    console.log('Logged in successfully');

    // 2. Admin Setup (Backend)
    console.log('\n--- 2. Admin Setup (Backend) ---');
    const challengeId = `browser-challenge-${uuidv4()}`;
    await pool.query("INSERT INTO challenges (id, name, start_date, end_date) VALUES ($1, 'Browser Test Challenge', NOW(), NOW() + INTERVAL '1 day')", [challengeId]);

    // Create Wordle
    const wordleId = `browser-wordle-${uuidv4()}`;
    const wordleData = { solutions: ['APPLE', 'BERRY', 'PEACH'], wordLength: 5 };
    await pool.query("INSERT INTO games (id, challenge_id, date, type, data) VALUES ($1, $2, NOW(), 'wordle', $3)", [wordleId, challengeId, JSON.stringify(wordleData)]);
    console.log(`Created Wordle Game: ${wordleId}`);

    // 3. Gameplay (Wordle)
    console.log('\n--- 3. Gameplay (Wordle) ---');
    // Navigate to game directly
    await page.goto(`${APP_URL}/game/${wordleId}`);
    await sleep(2000);

    // Check if game loaded
    const grid = await page.$('.grid');
    if (!grid) console.warn('Game grid not found immediately');

    // Check DB for assignment
    let progress = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, wordleId]);
    let assignedSolution = progress.rows[0]?.game_state?.assignedSolution;
    if (!assignedSolution) throw new Error('No solution assigned in DB after load');
    console.log(`Assigned Solution: ${assignedSolution}`);

    // Close instructions modal
    const startBtn = await page.waitForSelector('xpath///button[text()="Start Game"]');
    if (startBtn) await startBtn.click();
    await page.waitForSelector('.grid'); // Wait for game grid
    await sleep(1000);

    // Play the game
    console.log(`Typing solution: ${assignedSolution}`);
    await page.keyboard.type(assignedSolution);
    await page.keyboard.press('Enter');
    await sleep(5000);

    // Check for win
    let submission = await pool.query('SELECT * FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, wordleId]);
    if (submission.rows.length > 0) {
      console.log('Wordle submitted successfully!');
    } else {
      throw new Error('Wordle submission not found in DB');
    }

    // --- 4. Gameplay (Connections) ---
    console.log('\n--- 4. Gameplay (Connections) ---');
    const connectionsId = `browser-connections-${uuidv4()}`;
    const connectionsData = {
      categories: [
        { name: 'FRUITS', words: ['APPLE', 'BANANA', 'CHERRY', 'DATE'] },
        { name: 'COLORS', words: ['RED', 'BLUE', 'GREEN', 'YELLOW'] },
        { name: 'ANIMALS', words: ['DOG', 'CAT', 'BIRD', 'FISH'] },
        { name: 'NUMBERS', words: ['ONE', 'TWO', 'THREE', 'FOUR'] }
      ]
    };
    await pool.query("INSERT INTO games (id, challenge_id, date, type, data) VALUES ($1, $2, NOW(), 'connections', $3)", [connectionsId, challengeId, JSON.stringify(connectionsData)]);
    console.log(`Created Connections Game: ${connectionsId}`);

    await page.goto(`${APP_URL}/game/${connectionsId}`);
    await sleep(2000);

    // Close instructions modal
    const connStartBtn = await page.waitForSelector('xpath///button[text()="Start Game"]');
    if (connStartBtn) await connStartBtn.click();
    await page.waitForSelector('.grid'); // Wait for game grid
    await sleep(1000);

    // We need to click 4 words that belong to a category
    // The words are shuffled. We need to find them in the DOM.
    // We know the categories from our data.
    const category = connectionsData.categories[0];
    console.log(`Solving category: ${category.name}`);

    // Find buttons with text matching words
    // We can use XPath to find buttons by text
    for (const word of category.words) {
      const button = await page.waitForSelector(`xpath///button[contains(text(), '${word}')]`);
      if (button) await button.click();
      await sleep(200);
    }

    // Click Submit
    const connectionsSubmitBtn = await page.waitForSelector('xpath///button[contains(text(), "Submit")]');
    if (connectionsSubmitBtn) await connectionsSubmitBtn.click();
    await sleep(2000);

    // Verify progress (foundGroups)
    progress = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, connectionsId]);
    const foundGroups = progress.rows[0]?.game_state?.foundGroups;
    if (!foundGroups || foundGroups.length !== 1 || foundGroups[0].name !== category.name) {
      throw new Error('Connections progress not saved correctly');
    }
    console.log('Connections category solved and saved.');


    // --- 5. Gameplay (Match The Word) ---
    console.log('\n--- 5. Gameplay (Match The Word) ---');
    const matchId = `browser-match-${uuidv4()}`;
    const matchData = {
      pairs: [
        { word: 'David', match: 'King' },
        { word: 'Moses', match: 'Leader' },
        { word: 'Paul', match: 'Apostle' },
        { word: 'Peter', match: 'Rock' },
        { word: 'Mary', match: 'Mother' },
        { word: 'Eve', match: 'First' },
        { word: 'Adam', match: 'Man' } // 7 pairs, should pick 6
      ]
    };
    await pool.query("INSERT INTO games (id, challenge_id, date, type, data) VALUES ($1, $2, NOW(), 'match_the_word', $3)", [matchId, challengeId, JSON.stringify(matchData)]);
    console.log(`Created Match The Word Game: ${matchId}`);

    await page.goto(`${APP_URL}/game/${matchId}`);
    await sleep(2000);

    // Check if assignedPairs exists immediately after load
    let initialProgress = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, matchId]);
    console.log('Initial Progress (after load):', initialProgress.rows[0]?.game_state?.assignedPairs ? 'Found' : 'Missing');
    if (initialProgress.rows[0]?.game_state) {
      console.log('Initial Game State Keys:', Object.keys(initialProgress.rows[0].game_state));
    }

    // Close instructions modal
    console.log('Clicking Start Game for Match The Word...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const startBtn = buttons.find(b => b.textContent?.includes('Start Game'));
      if (startBtn) {
        startBtn.click();
      } else {
        console.error('Start Game button not found in DOM');
      }
    });

    // Wait for modal to disappear (button gone)
    await page.waitForSelector('xpath///button[text()="Start Game"]', { hidden: true, timeout: 5000 }).catch(() => console.log('Start button did not disappear?'));

    console.log('Waiting for .grid...');
    await page.waitForSelector('.grid'); // Wait for game grid
    console.log('.grid found');
    await sleep(1000);

    // Check assignment
    progress = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, matchId]);
    const assignedPairs = progress.rows[0]?.game_state?.assignedPairs;
    if (!assignedPairs || assignedPairs.length !== 6) throw new Error('Match The Word assignment failed (should be 6 pairs)');
    console.log(`Assigned Pairs: ${assignedPairs.join(', ')}`);

    // Solve one pair
    const wordToSolve = assignedPairs[0];
    const pair = matchData.pairs.find(p => p.word === wordToSolve);
    if (!pair) throw new Error('Assigned word not found in data');

    console.log(`Matching ${pair.word} with ${pair.match}`);
    const wordBtn = await page.waitForSelector(`xpath///button[contains(., '${pair.word}')]`);
    if (wordBtn) await wordBtn.click();
    await sleep(200);
    const matchBtn = await page.waitForSelector(`xpath///button[contains(., '${pair.match}')]`);
    if (matchBtn) await matchBtn.click();
    await sleep(1000);

    // Verify progress
    progress = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, matchId]);
    const foundPairs = progress.rows[0]?.game_state?.foundPairs;
    if (!foundPairs || !foundPairs.includes(wordToSolve)) throw new Error('Match The Word progress not saved');
    console.log('Match The Word pair solved and saved.');


    // --- 6. Gameplay (Verse Scramble) ---
    console.log('\n--- 6. Gameplay (Verse Scramble) ---');
    const verseId = `browser-verse-${uuidv4()}`;
    const verseData = { verses: [{ verse: "JESUS WEPT", reference: "John 11:35" }] };
    await pool.query("INSERT INTO games (id, challenge_id, date, type, data) VALUES ($1, $2, NOW(), 'verse_scramble', $3)", [verseId, challengeId, JSON.stringify(verseData)]);
    console.log(`Created Verse Scramble Game: ${verseId}`);

    await page.goto(`${APP_URL}/game/${verseId}`);
    await sleep(2000);

    // Close instructions modal
    const verseStartBtn = await page.waitForSelector('xpath///button[text()="Start Game"]');
    if (verseStartBtn) await verseStartBtn.click();
    // Verse scramble might not use .grid, check component
    await sleep(1000);

    // Check assignment
    progress = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, verseId]);
    const assignedVerse = progress.rows[0]?.game_state?.assignedVerse;
    if (!assignedVerse || assignedVerse.verse !== "JESUS WEPT") throw new Error('Verse Scramble assignment failed');
    console.log(`Assigned Verse: ${assignedVerse.verse}`);

    // Solve it
    // Words are in pool. Click them in order.
    const words = assignedVerse.verse.split(' ');
    for (const word of words) {
      // Find button in pool (gray-700)
      // Note: Placed words are yellow-500.
      // We need to be careful if words are duplicate.
      // The component uses unique IDs for words, but we only see text in DOM.
      // We can click the first available button with that text in the pool container.
      // Pool container class: flex flex-wrap gap-3 justify-center mb-8 min-h-[80px]
      // Actually, let's just click by text and hope for best (unique words in this sample).
      const btn = await page.waitForSelector(`xpath///button[contains(., '${word}')]`);
      if (btn) await btn.click();
      await sleep(200);
    }
    await sleep(2000);

    // Verify submission
    submission = await pool.query('SELECT * FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, verseId]);
    if (submission.rows.length > 0) {
      console.log('Verse Scramble submitted successfully!');
    } else {
      throw new Error('Verse Scramble submission not found');
    }


    // --- 7. Gameplay (Who Am I) ---
    console.log('\n--- 7. Gameplay (Who Am I) ---');
    const whoAmIId = `browser-whoami-${uuidv4()}`;
    const whoAmIData = { solutions: [{ answer: "DAVID", hint: "King" }] };
    await pool.query("INSERT INTO games (id, challenge_id, date, type, data) VALUES ($1, $2, NOW(), 'who_am_i', $3)", [whoAmIId, challengeId, JSON.stringify(whoAmIData)]);
    console.log(`Created Who Am I Game: ${whoAmIId}`);

    await page.goto(`${APP_URL}/game/${whoAmIId}`);
    await sleep(2000);

    // Close instructions modal
    const whoStartBtn = await page.waitForSelector('xpath///button[text()="Start Game"]');
    if (whoStartBtn) await whoStartBtn.click();
    // Who Am I uses inputs, maybe wait for input?
    await sleep(1000);

    // Check assignment
    progress = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, whoAmIId]);
    const assignedWhoAmI = progress.rows[0]?.game_state?.assignedSolution;
    if (!assignedWhoAmI || assignedWhoAmI.answer !== "DAVID") throw new Error('Who Am I assignment failed');
    console.log(`Assigned Answer: ${assignedWhoAmI.answer}`);

    // Solve it
    const answer = assignedWhoAmI.answer;
    for (const char of answer) {
      await page.keyboard.type(char);
      await sleep(100);
    }
    await sleep(2000);

    // Verify submission
    submission = await pool.query('SELECT * FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, whoAmIId]);
    if (submission.rows.length > 0) {
      console.log('Who Am I submitted successfully!');
    } else {
      throw new Error('Who Am I submission not found');
    }


    // --- 8. Gameplay (Word Search) ---
    console.log('\n--- 8. Gameplay (Word Search) ---');
    const wordSearchId = `browser-wordsearch-${uuidv4()}`;
    const wordSearchGrid = [
      ['A', 'B', 'C', 'D'],
      ['E', 'F', 'G', 'H'],
      ['I', 'J', 'K', 'L'],
      ['M', 'N', 'O', 'P']
    ];
    // Let's make a simple one: WORD at top row
    const simpleGrid = [
      ['W', 'O', 'R', 'D'],
      ['A', 'B', 'C', 'D'],
      ['E', 'F', 'G', 'H'],
      ['I', 'J', 'K', 'L']
    ];
    const wordSearchData = { puzzles: [{ grid: simpleGrid, words: ['WORD'] }] };
    await pool.query("INSERT INTO games (id, challenge_id, date, type, data) VALUES ($1, $2, NOW(), 'word_search', $3)", [wordSearchId, challengeId, JSON.stringify(wordSearchData)]);
    console.log(`Created Word Search Game: ${wordSearchId}`);

    await page.goto(`${APP_URL}/game/${wordSearchId}`);
    await sleep(2000);

    // Close instructions modal
    const wsStartBtn = await page.waitForSelector('xpath///button[text()="Start Game"]');
    if (wsStartBtn) await wsStartBtn.click();
    await page.waitForSelector('.grid'); // Word search uses grid
    await sleep(1000);

    // Check assignment
    progress = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, wordSearchId]);
    const assignedPuzzleIdx = progress.rows[0]?.game_state?.assignedWordSearchIndex;
    if (assignedPuzzleIdx === undefined) throw new Error('Word Search assignment failed');
    console.log(`Assigned Puzzle Index: ${assignedPuzzleIdx}`);

    // Solve it: Drag from (0,0) to (0,3)
    // We need to find cells. They have data-r and data-c attributes.
    const startCell = await page.waitForSelector('div[data-r="0"][data-c="0"]');
    const endCell = await page.waitForSelector('div[data-r="0"][data-c="3"]');

    if (startCell && endCell) {
      const startBox = await startCell.boundingBox();
      const endBox = await endCell.boundingBox();

      if (startBox && endBox) {
        await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 10 });
        await page.mouse.up();
      }
    }
    await sleep(2000);

    // Verify submission
    submission = await pool.query('SELECT * FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, wordSearchId]);
    if (submission.rows.length > 0) {
      console.log('Word Search submitted successfully!');
    } else {
      throw new Error('Word Search submission not found');
    }

    console.log('\n-----------------------------------');
    console.log('✅ BROWSER INTEGRATION TESTS PASSED');
    console.log('-----------------------------------');

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error(error);
    if (page) await page.screenshot({ path: 'test-failure.png' });
    if (page) await page.screenshot({ path: 'test-failure.png' });
    // process.exit(1); // Let finally block run
  } finally {
    if (browser) await browser.close();

    // Cleanup
    console.log('\n--- Cleanup ---');
    // We need variables from the scope. 
    // Since we can't easily access them here without restructuring, let's just delete by pattern or ID if we have it.
    // Actually, we should move variables to outer scope or just delete based on patterns used.
    // The user email pattern is `browser-user-${uuid}@test.com`
    // The challenge ID pattern is `browser-challenge-${uuid}`
    // The game ID pattern is `browser-wordle-${uuid}`, etc.

    try {
      await pool.query("DELETE FROM game_submissions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'browser-user-%')");
      await pool.query("DELETE FROM game_progress WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'browser-user-%')");
      await pool.query("DELETE FROM visit_logs WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'browser-user-%')");
      await pool.query("DELETE FROM users WHERE email LIKE 'browser-user-%'");

      // Delete games and challenges
      // Games depend on challenges, submissions depend on games.
      // We already deleted submissions.
      await pool.query("DELETE FROM games WHERE id LIKE 'browser-%'");
      await pool.query("DELETE FROM challenges WHERE id LIKE 'browser-challenge-%'");

      console.log('Cleanup completed successfully.');
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError);
    }

    await pool.end();
  }
}

runBrowserTests();
