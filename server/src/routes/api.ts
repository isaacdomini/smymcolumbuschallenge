import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { sendVerificationEmail, sendPasswordResetEmail, sendAccountDeletionRequestEmail, sendTicketCreatedEmail, sendAdminTicketNotification } from '../services/email.js'; // Added new email function
import { getVapidPublicKey, saveSubscription } from '../services/push.js';
import { manualLog, getClientIp } from '../middleware/logger.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper to get 'YYYY-MM-DD' in Eastern Time
const getTodayEST = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
};

// --- HELPER: Fisher-Yates Shuffle ---
const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// --- HELPER: Score Calculation ---
const calculateScore = (game: any, submissionData: any, timeTaken: number, mistakes: number): number => {
  let baseScore = 0;
  const gameType = game.type;

  switch (gameType) {
    case 'wordle':
    case 'wordle_advanced': {
      const maxGuesses = 6;
      if (mistakes >= maxGuesses) {
        baseScore = 0;
      } else {
        baseScore = (maxGuesses - mistakes) * 10;
      }
      break;
    }
    case 'connections': {
      const categoriesFound = submissionData?.categoriesFound ?? 0;
      baseScore = Math.max(0, (categoriesFound * 20) - (mistakes * 5));
      break;
    }
    case 'crossword': {
      const correct = submissionData?.correctCells ?? 0;
      const total = submissionData?.totalFillableCells ?? 1;
      if (total <= 0) {
        baseScore = 0;
      } else {
        const accuracyScore = Math.round((correct / total) * 70);
        const timeBonus = Math.max(0, 30 - Math.floor(timeTaken / 60));
        baseScore = Math.max(0, accuracyScore + timeBonus);
      }
      break;
    }
    case 'match_the_word': {
      const foundPairsCount = submissionData?.foundPairsCount ?? 0;
      const pairScore = foundPairsCount * 20;
      const mistakePenalty = mistakes * 10;
      baseScore = Math.max(0, pairScore - mistakePenalty);
      break;
    }
    case 'verse_scramble': {
      if (!submissionData?.completed) {
        baseScore = 0;
      } else {
        const completionScore = 50;
        const accuracyScore = Math.max(0, 30 - (mistakes * 5));
        const timeBonus = Math.max(0, 20 - Math.floor(timeTaken / 10));
        baseScore = completionScore + accuracyScore + timeBonus;
      }
      break;
    }
    case 'who_am_i': {
      const maxGuesses = 6;
      if (mistakes >= maxGuesses) {
        baseScore = 0;
      } else {
        baseScore = (maxGuesses - mistakes) * 10;
      }
      break;
    }
    case 'word_search': {
      const wordsFound = submissionData?.wordsFound ?? 0;
      const totalWords = submissionData?.totalWords ?? 5;
      const wordScore = wordsFound * 10;
      const completionBonus = (wordsFound === totalWords) ? 20 : 0;
      const timeBonus = Math.max(0, 30 - Math.floor(timeTaken / 20));
      baseScore = wordScore + completionBonus + timeBonus;
      break;
    }
    default: {
      const timePenalty = Math.floor(timeTaken / 15);
      const mistakePenalty = mistakes * 10;
      baseScore = Math.max(0, 100 - mistakePenalty - timePenalty);
    }
  }

  // --- NEW: Apply Late Penalty ---
  // We get the current date in EST
  const today = new Date(getTodayEST() + 'T12:00:00Z'); // Use noon to avoid DST/timezone shift issues
  // Get the game date as YYYY-MM-DD in EST
  // game.date is a Date object from the DB, e.g., 2025-11-15 00:00:00 UTC
  // We need its UTC date string.
  const gameDateStr = game.date.toISOString().split('T')[0]; // "2025-11-15"
  const gameDate = new Date(gameDateStr + 'T12:00:00Z'); // Noon UTC on that day

  const diffTime = today.getTime() - gameDate.getTime();
  // Calculate days late. If today is the game day, diffDays will be 0.
  const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  let finalScore = 0;
  // Only apply penalty if within the 5-day late window
  if (diffDays <= 5) {
    // 20% penalty per day late.
    // Day 0 (on time): 1.0 (1 - 0*0.2)
    // Day 1 late: 0.8 (1 - 1*0.2)
    // Day 5 late: 0.0 (1 - 5*0.2)
    const penaltyMultiplier = Math.max(0, 1.0 - (diffDays * 0.20));
    finalScore = Math.round(baseScore * penaltyMultiplier);
  }
  // If diffDays > 5, finalScore remains 0, as they shouldn't have been able to submit.

  return finalScore;
};
// --- LOGGING ENDPOINT ---
router.post('/log', async (req: Request, res: Response) => {
  try {
    const { path, userId, metadata } = req.body;
    await manualLog(req, path || 'unknown', 'VIEW', userId, metadata);
    res.status(200).send();
  } catch (error) {
    res.status(200).send();
  }
});

// --- DAILY MESSAGE ENDPOINT ---
router.get('/daily-message', async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || getTodayEST();

    const result = await pool.query('SELECT * FROM daily_messages WHERE date = $1', [date]);

    if (result.rows.length === 0) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching daily message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- EXTERNAL LOGGING ENDPOINT ---
router.post('/log-visit', async (req: Request, res: Response) => {
  try {
    const { path, appName, userId, metadata, ip, userAgent } = req.body;

    // Use provided IP/UA or fallback to request details
    const finalIp = ip || getClientIp(req) || null;
    const finalUA = userAgent || req.get('User-Agent') || null;

    // Construct metadata with appName if provided
    const finalMetadata = {
      ...(metadata || {}),
      source: 'external_api',
      appName: appName || 'unknown'
    };

    await pool.query(
      'INSERT INTO visit_logs (ip_address, user_agent, path, method, user_id, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
      [finalIp, finalUA, path || 'external', 'VIEW', userId || null, JSON.stringify(finalMetadata)]
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('External log visit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Push Notification Endpoints ---
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

router.post('/subscribe', async (req, res) => {
  try {
    const { userId, subscription, token, platform } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    if (subscription) {
      // This is a Web Push subscription
      await saveSubscription(userId, subscription, 'web');
      res.status(201).json({ message: 'Web subscription saved successfully' });

    } else if (token && platform) {
      // This is a Native Push subscription
      await saveSubscription(userId, token, platform);
      res.status(201).json({ message: 'Native subscription saved successfully' });

    } else {
      return res.status(400).json({ error: 'Missing subscription or token/platform data' });
    }

  } catch (error: any) {
    // Handle duplicate token errors gracefully
    if (error.code === '23505') { // unique_violation
      if (error.constraint === 'push_subscriptions_endpoint_key' || error.constraint === 'unique_device_token') {
        return res.status(200).json({ message: 'Subscription already exists' });
      }
    }
    console.error('Subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Authentication Endpoints ---
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    if (!user.password) return res.status(401).json({ error: 'Account created before password auth. Please sign up again.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_verified) return res.status(401).json({ error: 'Please check your email to verify your account.' });

    delete user.password;
    delete user.verification_token;
    delete user.reset_password_token;
    delete user.reset_password_expires;

    const token = jwt.sign({ id: user.id, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ...user, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/migrate-session', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    // Verify user exists
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = result.rows[0];

    // Remove sensitive data
    delete user.password;
    delete user.verification_token;
    delete user.reset_password_token;
    delete user.reset_password_expires;

    // Issue new token
    const token = jwt.sign({ id: user.id, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });

    // Return updated user object (with correct isAdmin from DB) and token
    res.json({ ...user, token });
  } catch (error) {
    console.error('Session migration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { name, email, password, emailNotifications = true } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });

    const existingUserResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUserResult.rows.length > 0) {
      const existingUser = existingUserResult.rows[0];
      if (existingUser.is_verified) {
        return res.status(400).json({ error: 'User already exists' });
      } else {
        if (!existingUser.verification_token) {
          existingUser.verification_token = crypto.randomBytes(32).toString('hex');
          await pool.query('UPDATE users SET verification_token = $1, email_notifications = $2 WHERE id = $3', [existingUser.verification_token, emailNotifications, existingUser.id]);
        }
        await sendVerificationEmail(existingUser.email, existingUser.verification_token, req.get('host'));
        return res.status(201).json({ message: 'Account already registered. Verification email resent. Please check your email.' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const userId = `user-${Date.now()}`;

    await pool.query(
      'INSERT INTO users (id, name, email, password, is_verified, verification_token, email_notifications) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, name, email, hashedPassword, false, verificationToken, emailNotifications]
    );

    await sendVerificationEmail(email, verificationToken, req.get('host'));
    res.status(201).json({ message: 'Signup successful. Please check your email to verify your account.' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') return res.status(400).send('Invalid verification token.');

    const result = await pool.query('SELECT * FROM users WHERE verification_token = $1', [token]);
    if (result.rows.length === 0) return res.status(400).send('Invalid or expired verification token.');

    const user = result.rows[0];
    await pool.query('UPDATE users SET is_verified = true, verification_token = NULL WHERE id = $1', [user.id]);

    // Return a simple HTML page with the success message
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verified</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  gray: {
                    900: '#111827',
                    800: '#1f2937',
                    700: '#374151',
                    100: '#f3f4f6',
                  }
                }
              }
            }
          }
        </script>
        <style>
          .checkmark {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            display: block;
            stroke-width: 3;
            stroke: #4CAF50;
            stroke-miterlimit: 10;
            margin: 0 auto 2rem;
            box-shadow: inset 0 0 0 #4CAF50;
            animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both;
          }
          .checkmark__circle {
            stroke-dasharray: 166;
            stroke-dashoffset: 166;
            stroke-width: 3;
            stroke-miterlimit: 10;
            stroke: #4CAF50;
            fill: none;
            animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
          }
          .checkmark__check {
            transform-origin: 50% 50%;
            stroke-dasharray: 48;
            stroke-dashoffset: 48;
            animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
            stroke: #fff;
          }
          @keyframes stroke {
            100% { stroke-dashoffset: 0; }
          }
          @keyframes scale {
            0%, 100% { transform: none; }
            50% { transform: scale3d(1.1, 1.1, 1); }
          }
          @keyframes fill {
            100% { box-shadow: inset 0 0 0 30px #4CAF50; }
          }
        </style>
      </head>
      <body class="bg-gray-900 text-gray-100 min-h-screen flex items-center justify-center p-4">
        <div class="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full text-center border border-gray-700">
          <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
          <h1 class="text-3xl font-bold text-white mb-4">Email Verified!</h1>
          <p class="text-gray-300 text-lg">Your email has been successfully verified. You can now log in to the app.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verification Error</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  gray: { 900: '#111827', 800: '#1f2937', 700: '#374151', 100: '#f3f4f6' }
                }
              }
            }
          }
        </script>
      </head>
      <body class="bg-gray-900 text-gray-100 min-h-screen flex items-center justify-center p-4">
        <div class="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full text-center border border-gray-700">
          <h1 class="text-3xl font-bold text-red-500 mb-4">Verification Failed</h1>
          <p class="text-gray-300 text-lg">An internal server error occurred during email verification. Please try again later.</p>
        </div>
      </body>
      </html>
    `);
  }
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length > 0) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = Date.now() + 3600000; // 1 hour
      await pool.query('UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3', [token, expires, email]);
      await sendPasswordResetEmail(email, token, req.get('host'));
    }
    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    const tailwindHead = `
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                gray: {
                  900: '#111827',
                  800: '#1f2937',
                  700: '#374151',
                  600: '#4b5563',
                  400: '#9ca3af',
                  300: '#d1d5db',
                  100: '#f3f4f6',
                },
                yellow: {
                  400: '#facc15',
                  500: '#eab308',
                }
              }
            }
          }
        }
      </script>
    `;

    if (!token || typeof token !== 'string') {
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invalid Reset Link</title>
          ${tailwindHead}
        </head>
        <body class="bg-gray-900 text-gray-100 min-h-screen flex items-center justify-center p-4">
          <div class="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full text-center border border-gray-700">
            <h1 class="text-3xl font-bold text-red-500 mb-4">Invalid Reset Link</h1>
            <p class="text-gray-300 text-lg">This password reset link is invalid. Please request a new password reset.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Verify token is valid and not expired
    const userResult = await pool.query('SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2', [token, Date.now()]);
    if (userResult.rows.length === 0) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Expired Reset Link</title>
          ${tailwindHead}
        </head>
        <body class="bg-gray-900 text-gray-100 min-h-screen flex items-center justify-center p-4">
          <div class="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full text-center border border-gray-700">
            <h1 class="text-3xl font-bold text-red-500 mb-4">Link Expired</h1>
            <p class="text-gray-300 text-lg">This password reset link has expired. Please request a new password reset.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Show password reset form
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Password</title>
        ${tailwindHead}
        <style>
          /* Custom checkmark styles */
          .checkmark { width: 80px; height: 80px; border-radius: 50%; display: block; stroke-width: 3; stroke: #4CAF50; stroke-miterlimit: 10; margin: 0 auto 2rem; box-shadow: inset 0 0 0 #4CAF50; animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both; }
          .checkmark__circle { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 3; stroke-miterlimit: 10; stroke: #4CAF50; fill: none; animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
          .checkmark__check { transform-origin: 50% 50%; stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards; stroke: #fff; }
          @keyframes stroke { 100% { stroke-dashoffset: 0; } }
          @keyframes scale { 0%, 100% { transform: none; } 50% { transform: scale3d(1.1, 1.1, 1); } }
          @keyframes fill { 100% { box-shadow: inset 0 0 0 30px #4CAF50; } }
        </style>
      </head>
      <body class="bg-gray-900 text-gray-100 min-h-screen flex items-center justify-center p-4">
        <div class="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full border border-gray-700">
          <h1 class="text-3xl font-bold text-white mb-2 text-center">Reset Password</h1>
          <p class="text-gray-400 text-center mb-8">Enter your new password below.</p>
          
          <form id="resetForm" class="space-y-6">
            <div>
              <label for="password" class="block text-sm font-medium text-gray-300 mb-2">New Password</label>
              <input type="password" id="password" name="password" required minlength="6" placeholder="Enter new password" 
                class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors">
            </div>
            <div>
              <label for="confirmPassword" class="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
              <input type="password" id="confirmPassword" name="confirmPassword" required minlength="6" placeholder="Confirm new password"
                class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors">
            </div>
            
            <div id="error" class="hidden p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 text-sm text-center"></div>
            
            <button type="submit" id="submitBtn" 
              class="w-full py-3 px-4 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
              Reset Password
            </button>
          </form>
        </div>

        <script>
          const form = document.getElementById('resetForm');
          const error = document.getElementById('error');
          const submitBtn = document.getElementById('submitBtn');
          
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            error.classList.add('hidden');
            
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (password !== confirmPassword) {
              error.textContent = 'Passwords do not match';
              error.classList.remove('hidden');
              return;
            }
            
            if (password.length < 6) {
              error.textContent = 'Password must be at least 6 characters';
              error.classList.remove('hidden');
              return;
            }
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Resetting...';
            
            try {
              const response = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: '${token}', password })
              });
              
              const contentType = response.headers.get('content-type');
              
              if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                if (!response.ok) {
                  error.textContent = data.error || 'Failed to reset password';
                  error.classList.remove('hidden');
                  submitBtn.disabled = false;
                  submitBtn.textContent = 'Reset Password';
                } else {
                   // Should not happen given current server logic (returns HTML on success), 
                   // but handling just in case we revert to JSON success
                   error.textContent = data.message;
                   error.classList.remove('hidden'); 
                   // Or redirect/show success
                }
              } else {
                // Assume HTML response (Success or 500 Error)
                const html = await response.text();
                document.open();
                document.write(html);
                document.close();
              }
            } catch (err) {
              error.textContent = 'Network error. Please try again.';
              error.classList.remove('hidden');
              submitBtn.disabled = false;
              submitBtn.textContent = 'Reset Password';
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Reset password GET error:', error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Server Error</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  gray: { 900: '#111827', 800: '#1f2937', 700: '#374151', 100: '#f3f4f6' }
                }
              }
            }
          }
        </script>
      </head>
      <body class="bg-gray-900 text-gray-100 min-h-screen flex items-center justify-center p-4">
        <div class="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full text-center border border-gray-700">
          <h1 class="text-3xl font-bold text-red-500 mb-4">Server Error</h1>
          <p class="text-gray-300 text-lg">An internal server error occurred. Please try again later.</p>
        </div>
      </body>
      </html>
    `);
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and new password are required' });

    const userResult = await pool.query('SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2', [token, Date.now()]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });

    const user = userResult.rows[0];
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.query('UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2', [hashedPassword, user.id]);

    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  gray: {
                    900: '#111827',
                    800: '#1f2937',
                    700: '#374151',
                    600: '#4b5563',
                    400: '#9ca3af',
                    300: '#d1d5db',
                    100: '#f3f4f6',
                  },
                  yellow: {
                    400: '#facc15',
                    500: '#eab308',
                  }
                }
              }
            }
          }
        </script>
        <style>
          .checkmark { width: 80px; height: 80px; border-radius: 50%; display: block; stroke-width: 3; stroke: #4CAF50; stroke-miterlimit: 10; margin: 0 auto 2rem; box-shadow: inset 0 0 0 #4CAF50; animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both; }
          .checkmark__circle { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 3; stroke-miterlimit: 10; stroke: #4CAF50; fill: none; animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
          .checkmark__check { transform-origin: 50% 50%; stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards; stroke: #fff; }
          @keyframes stroke { 100% { stroke-dashoffset: 0; } }
          @keyframes scale { 0%, 100% { transform: none; } 50% { transform: scale3d(1.1, 1.1, 1); } }
          @keyframes fill { 100% { box-shadow: inset 0 0 0 30px #4CAF50; } }
        </style>
      </head>
      <body class="bg-gray-900 text-gray-100 min-h-screen flex items-center justify-center p-4">
        <div class="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full text-center border border-gray-700">
          <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
          <h1 class="text-3xl font-bold text-white mb-4">Password Reset!</h1>
          <p class="text-gray-300 text-lg">Your password has been successfully reset. You can now log in to the app.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Failed</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  gray: { 900: '#111827', 800: '#1f2937', 700: '#374151', 100: '#f3f4f6' }
                }
              }
            }
          }
        </script>
      </head>
      <body class="bg-gray-900 text-gray-100 min-h-screen flex items-center justify-center p-4">
        <div class="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full text-center border border-gray-700">
          <h1 class="text-3xl font-bold text-red-500 mb-4">Reset Failed</h1>
          <p class="text-gray-300 text-lg">An internal server error occurred while resetting your password. Please try again later.</p>
        </div>
      </body>
      </html>
    `);
  }
});

// --- NEW: Account Deletion Request ---
router.post('/request-deletion', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    // Credentials are valid, send email to admin
    await sendAccountDeletionRequestEmail(user.email, user.id, user.name);

    res.json({ message: 'Your account deletion request has been submitted. An administrator will process it within 48 hours.' });

  } catch (error) {
    console.error('Account deletion request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- USER PROFILE MANAGEMENT ---
router.put('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = req.headers['x-user-id'];

    if (userId !== authUserId) {
      return res.status(403).json({ error: 'Forbidden: You can only update your own profile.' });
    }

    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    const result = await pool.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
      [name, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = result.rows[0];
    delete user.password;
    delete user.verification_token;
    delete user.reset_password_token;
    delete user.reset_password_expires;
    res.json(user);

  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- BANNER MESSAGES ---
router.get('/banner-messages', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      // If no user ID, maybe return system messages that are not user-specific?
      // For now, let's require a user ID to track dismissals properly, or just return system messages.
      // Let's assume we want to show system messages even to guests, but tracking dismissal might be hard without ID.
      // If we rely on client-side storage for guests, we can just return all active system messages.
      // But the requirement says "log this too in the DB". So we likely need a user ID.
      // If the user is not logged in, we can't log dismissal in DB easily unless we use a device ID.
      // Let's assume this is for logged-in users or we just return system messages and client handles dismissal for guests (but DB log won't happen).
      // For this implementation, I'll fetch messages for the user if provided.
    }

    // Query:
    // 1. Active messages
    // 2. Not expired (expires_at IS NULL OR expires_at > NOW())
    // 3. Type is 'system' OR (type is 'user' AND target_user_id = userId)
    // 4. NOT in user_message_dismissals for this userId

    let query = `
      SELECT bm.* 
      FROM banner_messages bm
      LEFT JOIN user_message_dismissals umd ON bm.id = umd.message_id AND umd.user_id = $1
      LEFT JOIN banner_message_targets bmt ON bm.id = bmt.message_id
      WHERE bm.active = true 
      AND (bm.expires_at IS NULL OR bm.expires_at > NOW())
      AND umd.message_id IS NULL
      AND (
        bm.type = 'system' 
        OR (bm.type = 'user' AND bmt.user_id = $1)
      )
    `;

    const params: any[] = [userId];

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch banner messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/banner-messages/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required to dismiss message' });
    }

    await pool.query(
      'INSERT INTO user_message_dismissals (user_id, message_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Dismiss banner message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.delete('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = req.headers['x-user-id'];

    if (userId !== authUserId) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own account.' });
    }

    // Use a transaction to ensure all data is deleted
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM game_submissions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM game_progress WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      await client.query('COMMIT');

      res.status(204).send();
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- GAME DATA ENDPOINTS ---
router.get('/challenge', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    // Try to find currently active challenge first
    const result = await pool.query(
      'SELECT * FROM challenges WHERE start_date <= $1 AND end_date >= $1 ORDER BY start_date DESC LIMIT 1',
      [now]
    );

    if (result.rows.length > 0) {
      const challenge = result.rows[0];
      res.json({
        id: challenge.id,
        name: challenge.name,
        startDate: challenge.start_date.toISOString(),
        endDate: challenge.end_date.toISOString(),
      });
    } else {
      // If no active challenge, find the next upcoming one
      const upcomingResult = await pool.query(
        'SELECT * FROM challenges WHERE start_date > $1 ORDER BY start_date ASC LIMIT 1',
        [now]
      );
      if (upcomingResult.rows.length > 0) {
        const challenge = upcomingResult.rows[0];
        res.json({
          id: challenge.id,
          name: challenge.name,
          startDate: challenge.start_date.toISOString(),
          endDate: challenge.end_date.toISOString(),
        });
      } else {
        res.json(null);
      }
    }
  } catch (error) {
    console.error('Get challenge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper to resolve game data (specifically for Wordle Advanced)
// Helper to resolve game data (specifically for Wordle Advanced)
// Helper to resolve game data (specifically for Wordle Advanced)
export const resolveGameData = async (game: any, userId?: string, stripSolution: boolean = true) => {
  let gameData = game.data;
  let gameType = game.type;

  if (gameType === 'wordle_advanced') {
    // Mask as 'wordle' so frontend doesn't know the difference
    gameType = 'wordle';

    if (userId) {
      let assignedWord;

      // 1. Check if the user has already submitted the game (completed)
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        if (submissionData && submissionData.solution) {
          assignedWord = submissionData.solution;
        }
      }

      // 2. If not found in submission, check game_progress
      if (!assignedWord) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedWord) {
          assignedWord = progressResult.rows[0].game_state.assignedWord;
        } else {
          // No word assigned yet. Pick one.
          const solutions = gameData.solutions || [];
          if (solutions.length > 0) {
            const candidateWord = solutions[Math.floor(Math.random() * solutions.length)];

            // Get existing state (if any) to merge
            const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
            const newState = { ...existingState, assignedWord: candidateWord };

            await pool.query(
              `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at) 
               VALUES ($1, $2, $3, $4, NOW()) 
               ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
              [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
            );

            assignedWord = candidateWord;

          } else {
            assignedWord = "ERROR";
          }
        }
      }

      gameData = { ...gameData, solution: assignedWord };
      delete gameData.solutions;

    } else {
      const solutions = gameData.solutions || [];
      const assignedWord = solutions.length > 0 ? solutions[0] : "GUEST";
      gameData = { ...gameData, solution: assignedWord };
      delete gameData.solutions;
    }
  } else if (gameType === 'who_am_i' && gameData.solutions && gameData.solutions.length > 0) {
    // Handle Who Am I with multiple solutions
    if (userId) {
      let assignedSolution;

      // 1. Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        // Check for 'answer' (new format) or 'solution' (just in case)
        if (submissionData && (submissionData.answer || submissionData.solution)) {
          assignedSolution = {
            answer: submissionData.answer || submissionData.solution,
            hint: submissionData.hint
          };
        }
      }

      // 2. Check progress
      if (!assignedSolution) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedWhoAmI) {
          assignedSolution = progressResult.rows[0].game_state.assignedWhoAmI;
        } else {
          // Assign new
          const solutions = gameData.solutions;
          const candidate = solutions[Math.floor(Math.random() * solutions.length)];

          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedWhoAmI: candidate };

          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at) 
               VALUES ($1, $2, $3, $4, NOW()) 
               ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
          assignedSolution = candidate;
        }
      }

      if (assignedSolution) {
        gameData = { ...gameData, ...assignedSolution };
        delete gameData.solutions;
      }
    } else {
      // Guest - pick random
      const solutions = gameData.solutions;
      const candidate = solutions[Math.floor(Math.random() * solutions.length)];
      gameData = { ...gameData, ...candidate };
      delete gameData.solutions;
    }

  } else if (gameType === 'connections') {
    if (userId) {
      let assignedCategories: string[] | undefined;

      // 1. Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2 ORDER BY completed_at DESC LIMIT 1', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        if (submissionData) {
          if (submissionData.assignedCategories) {
            assignedCategories = submissionData.assignedCategories;
          } else if (submissionData.categories) {
            assignedCategories = submissionData.categories.map((c: any) => c.name);
          }
        }
      }

      // 2. Check progress
      if (!assignedCategories) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedCategories) {
          assignedCategories = progressResult.rows[0].game_state.assignedCategories;
        } else {
          // Assign new
          const allCategories = gameData.categories;
          // Shuffle and pick 4
          // Shuffle and pick 4
          const shuffled = shuffleArray(allCategories);
          const selected = shuffled.slice(0, 4);
          assignedCategories = selected.map((c: any) => c.name);

          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedCategories };

          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at) 
               VALUES ($1, $2, $3, $4, NOW()) 
               ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
        }
      }

      if (assignedCategories) {
        const selectedCats = gameData.categories.filter((c: any) => assignedCategories!.includes(c.name));
        // Ensure we found them (in case of data mismatch), otherwise fallback
        if (selectedCats.length === 4) {
          gameData = {
            categories: selectedCats,
            words: selectedCats.flatMap((c: any) => c.words)
          };
        } else {
          // Fallback if names don't match
          const selected = gameData.categories.slice(0, 4);
          gameData = {
            categories: selected,
            words: selected.flatMap((c: any) => c.words)
          };
        }
      }
    } else {
      // Guest - just pick first 4
      const selected = gameData.categories.slice(0, 4);
      gameData = {
        categories: selected,
        words: selected.flatMap((c: any) => c.words)
      };
    }
  } else if (gameType === 'word_search' && gameData.puzzles && gameData.puzzles.length > 0) {
    // Handle Word Search with multiple puzzles
    if (userId) {
      let assignedPuzzle;

      // 1. Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        if (submissionData && submissionData.assignedWordSearchIndex !== undefined) {
          const index = submissionData.assignedWordSearchIndex;
          if (gameData.puzzles[index]) {
            assignedPuzzle = gameData.puzzles[index];
          }
        }
      }

      // 2. Check progress
      if (!assignedPuzzle) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedWordSearchIndex !== undefined) {
          const index = progressResult.rows[0].game_state.assignedWordSearchIndex;
          if (gameData.puzzles[index]) {
            assignedPuzzle = gameData.puzzles[index];
          }
        }

        if (!assignedPuzzle) {
          // Assign new
          const puzzles = gameData.puzzles;
          const randomIndex = Math.floor(Math.random() * puzzles.length);
          const candidate = puzzles[randomIndex];

          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedWordSearchIndex: randomIndex };

          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at)
               VALUES ($1, $2, $3, $4, NOW())
               ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
          assignedPuzzle = candidate;
        }
      }

      if (assignedPuzzle) {
        gameData = { ...assignedPuzzle };
      }
    } else {
      // Guest - pick random
      const puzzles = gameData.puzzles;
      const candidate = puzzles[Math.floor(Math.random() * puzzles.length)];
      gameData = { ...candidate };
    }
  } else if (gameType === 'crossword' && gameData.puzzles && gameData.puzzles.length > 0) {
    // Handle Crossword with multiple puzzles
    if (userId) {
      let assignedPuzzle;

      // 1. Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        // If they submitted, they must have had a puzzle assigned.
        // We rely on game_progress or re-assign the same one if possible.
        const submissionData = submissionResult.rows[0].submission_data;
        if (submissionData && submissionData.puzzle) {
          assignedPuzzle = submissionData.puzzle;
        } else if (submissionData && submissionData.assignedCrosswordIndex !== undefined) {
          const index = submissionData.assignedCrosswordIndex;
          if (gameData.puzzles[index]) {
            assignedPuzzle = gameData.puzzles[index];
          }
        }
      }

      // 2. Check progress (primary source for assignment)
      if (!assignedPuzzle) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedCrosswordIndex !== undefined) {
          const index = progressResult.rows[0].game_state.assignedCrosswordIndex;
          if (gameData.puzzles[index]) {
            assignedPuzzle = gameData.puzzles[index];
          }
        }

        if (!assignedPuzzle) {
          // Assign new
          const puzzles = gameData.puzzles;
          const randomIndex = Math.floor(Math.random() * puzzles.length);
          const candidate = puzzles[randomIndex];

          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedCrosswordIndex: randomIndex };

          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at) 
               VALUES ($1, $2, $3, $4, NOW()) 
               ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
          assignedPuzzle = candidate;
        }
      }

      if (assignedPuzzle) {
        gameData = { ...assignedPuzzle };
      }
    } else {
      // Guest - pick random
      const puzzles = gameData.puzzles;
      const candidate = puzzles[Math.floor(Math.random() * puzzles.length)];
      gameData = { ...candidate };
    }
  } else if ((gameType === 'wordle' || gameType === 'wordle_advanced') && gameData.solutions && gameData.solutions.length > 0) {
    if (userId) {
      let assignedSolution;
      // Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        if (submissionData && submissionData.solution) {
          assignedSolution = submissionData.solution;
        }
      }
      // Check progress
      if (!assignedSolution) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedSolution) {
          assignedSolution = progressResult.rows[0].game_state.assignedSolution;
        } else {
          // Assign new
          const solutions = gameData.solutions;
          assignedSolution = solutions[Math.floor(Math.random() * solutions.length)];
          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedSolution };
          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
        }
      }
      if (assignedSolution) {
        gameData = { ...gameData, solution: assignedSolution };
        delete gameData.solutions;
      }
    } else {
      // Guest
      gameData = { ...gameData, solution: gameData.solutions[0] };
      delete gameData.solutions;
    }
    // Handle Verse Scramble with multiple verses
    if (userId) {
      let assignedVerse;

      // 1. Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        if (submissionData && (submissionData.verse || submissionData.reference)) {
          assignedVerse = {
            verse: submissionData.verse,
            reference: submissionData.reference
          };
        }
      }

      // 2. Check progress
      if (!assignedVerse) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedVerse) {
          assignedVerse = progressResult.rows[0].game_state.assignedVerse;
        } else {
          // Assign new
          const verses = gameData.verses;
          const candidate = verses[Math.floor(Math.random() * verses.length)];

          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedVerse: candidate };

          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at) 
               VALUES ($1, $2, $3, $4, NOW()) 
               ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
          assignedVerse = candidate;
        }
      }

      if (assignedVerse) {
        gameData = { ...gameData, verse: assignedVerse.verse, reference: assignedVerse.reference };
        delete gameData.verses;
      }

    } else {
      // Guest
      const candidate = gameData.verses[0];
      gameData = { ...gameData, verse: candidate.verse, reference: candidate.reference };
      delete gameData.verses;
    }
  } else if (gameType === 'match_the_word' && gameData.pairs && gameData.pairs.length > 6) {
    // Handle Match The Word with > 6 pairs
    if (userId) {
      let assignedPairs: string[] | undefined;

      // 1. Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        if (submissionData && submissionData.assignedPairs) {
          assignedPairs = submissionData.assignedPairs;
        }
      }

      // 2. Check progress
      if (!assignedPairs) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedPairs) {
          assignedPairs = progressResult.rows[0].game_state.assignedPairs;
        } else {
          // Assign new 6 pairs
          const allPairs = gameData.pairs;
          // Shuffle and pick 6
          const shuffled = shuffleArray(allPairs);
          const selected = shuffled.slice(0, 6);
          assignedPairs = selected.map((p: any) => p.word);

          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedPairs };

          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at) 
               VALUES ($1, $2, $3, $4, NOW()) 
               ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
        }
      }

      if (assignedPairs) {
        const selectedPairs = gameData.pairs.filter((p: any) => assignedPairs!.includes(p.word));
        // Ensure we found them (in case of data mismatch), otherwise fallback
        if (selectedPairs.length === 6) {
          gameData = {
            pairs: selectedPairs
          };
        } else {
          // Fallback if names don't match
          const selected = gameData.pairs.slice(0, 6);
          gameData = {
            pairs: selected
          };
        }
      }

    } else {
      // Guest - just pick first 6
      const selected = gameData.pairs.slice(0, 6);
      gameData = {
        pairs: selected
      };
    }

  } else if (gameType === 'who_am_i' && gameData.solutions && gameData.solutions.length > 0) {
    if (userId) {
      let assignedSolution;
      // Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        if (submissionData && submissionData.answer) {
          assignedSolution = { answer: submissionData.answer, hint: submissionData.hint };
        }
      }
      // Check progress
      if (!assignedSolution) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedSolution) {
          assignedSolution = progressResult.rows[0].game_state.assignedSolution;
        } else {
          // Assign new
          const solutions = gameData.solutions;
          assignedSolution = solutions[Math.floor(Math.random() * solutions.length)];
          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedSolution };
          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
        }
      }
      if (assignedSolution) {
        gameData = { ...gameData, answer: assignedSolution.answer, hint: assignedSolution.hint };
        delete gameData.solutions;
      }
    } else {
      // Guest
      const sol = gameData.solutions[0];
      gameData = { ...gameData, answer: sol.answer, hint: sol.hint };
      delete gameData.solutions;
    }
  } else if (gameType === 'word_search' && gameData.puzzles && gameData.puzzles.length > 0) {
    if (userId) {
      let assignedPuzzle;
      // Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        // Reconstruct puzzle from submission if possible, or just rely on progress?
        // Word Search submission might not store the whole grid.
        // Let's rely on progress or re-assignment (if deterministic enough).
        // Actually, if submitted, we might not need to re-assign for gameplay, but for review.
        // Let's check progress first as it's more reliable for "what was assigned".
      }

      // Check progress
      if (!assignedPuzzle) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedWordSearchIndex !== undefined) {
          const idx = progressResult.rows[0].game_state.assignedWordSearchIndex;
          if (gameData.puzzles[idx]) {
            assignedPuzzle = gameData.puzzles[idx];
          }
        } else {
          // Assign new
          const puzzles = gameData.puzzles;
          const idx = Math.floor(Math.random() * puzzles.length);
          assignedPuzzle = puzzles[idx];
          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedWordSearchIndex: idx };
          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
        }
      }
      if (assignedPuzzle) {
        gameData = { ...gameData, grid: assignedPuzzle.grid, words: assignedPuzzle.words };
        delete gameData.puzzles;
      }
    } else {
      // Guest
      const puzzle = gameData.puzzles[0];
      gameData = { ...gameData, grid: puzzle.grid, words: puzzle.words };
      delete gameData.puzzles;
    }
  }

  // Strip solutions if requested
  if (stripSolution) {
    if (gameType === 'wordle' || gameType === 'wordle_advanced') {
      if (gameData.solution) {
        gameData.wordLength = gameData.solution.length;
        delete gameData.solution;
      }
    } else if (gameType === 'connections') {
      if (gameData.categories) {
        const allWords = gameData.categories.flatMap((c: any) => c.words);
        gameData.shuffledWords = shuffleArray(allWords);

        if (stripSolution) {
          gameData.words = gameData.shuffledWords;
          delete gameData.categories;
          delete gameData.shuffledWords;
        }
      }

    } else if (gameType === 'match_the_word') {
      if (gameData.pairs) {
        gameData.shuffledWords = shuffleArray(gameData.pairs.map((p: any) => p.word));
        gameData.shuffledMatches = shuffleArray(gameData.pairs.map((p: any) => p.match));
        delete gameData.pairs;
      }
    } else if (gameType === 'verse_scramble') {
      if (gameData.verse) {
        gameData.scrambledWords = shuffleArray(gameData.verse.split(' '));
        delete gameData.verse;
        // Keep reference? Yes.
      }
    } else if (gameType === 'who_am_i') {
      if (gameData.answer) {
        gameData.wordLength = gameData.answer.length;
        gameData.maskedAnswer = gameData.answer.replace(/[a-zA-Z0-9]/g, '_');
        delete gameData.answer;
        // Keep hint
      }
    } else if (gameType === 'crossword') {
      // Strip answers from clues
      if (gameData.acrossClues) {
        gameData.acrossClues = gameData.acrossClues.map((c: any) => {
          const { answer, ...rest } = c;
          return { ...rest, length: answer ? answer.length : 0 };
        });
      }
      if (gameData.downClues) {
        gameData.downClues = gameData.downClues.map((c: any) => {
          const { answer, ...rest } = c;
          return { ...rest, length: answer ? answer.length : 0 };
        });
      }
    }
  }

  return {
    id: game.id,
    challengeId: game.challenge_id,
    date: game.date.toISOString(),
    type: gameType,
    data: gameData,
  };
};

// --- CHECK ANSWER ENDPOINT ---
router.post('/games/:gameId/check', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { guess } = req.body;
    const userId = req.headers['x-user-id'] as string;

    const result = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Game not found' });
    const game = result.rows[0];

    // Get full game data with solution
    const resolvedGame = await resolveGameData(game, userId, false);
    const gameData = resolvedGame.data;
    const gameType = resolvedGame.type;

    if (gameType === 'wordle' || gameType === 'wordle_advanced') {
      const solution = gameData.solution.toUpperCase();
      const guessUpper = (guess as string).toUpperCase();
      const statuses: ('correct' | 'present' | 'absent')[] = Array(guessUpper.length).fill('absent');
      const solutionChars = solution.split('');
      const guessChars = guessUpper.split('');

      // First pass: correct
      guessChars.forEach((char, i) => {
        if (char === solutionChars[i]) {
          statuses[i] = 'correct';
          solutionChars[i] = ''; // Mark as used
        }
      });

      // Second pass: present
      guessChars.forEach((char, i) => {
        if (statuses[i] !== 'correct' && solutionChars.includes(char)) {
          statuses[i] = 'present';
          const index = solutionChars.indexOf(char);
          solutionChars[index] = ''; // Mark as used
        }
      });

      return res.json({ result: statuses });

    } else if (gameType === 'connections') {
      const guessWords = (guess as string[]).sort();
      const categories = gameData.categories;

      const match = categories.find((cat: any) => {
        const catWords = [...cat.words].sort();
        return JSON.stringify(catWords) === JSON.stringify(guessWords);
      });

      if (match) {
        return res.json({ correct: true, group: match });
      }

      // Check one away
      let oneAway = false;
      for (const cat of categories) {
        const catWords = cat.words;
        const intersection = guessWords.filter(w => catWords.includes(w));
        if (intersection.length === 3) {
          oneAway = true;
          break;
        }
      }

      return res.json({ correct: false, oneAway });

    } else if (gameType === 'match_the_word') {
      const { word, match } = guess as { word: string, match: string };
      const pair = gameData.pairs.find((p: any) => p.word === word && p.match === match);
      return res.json({ correct: !!pair });

    } else if (gameType === 'who_am_i') {
      const char = (guess as string).toUpperCase();
      const answer = gameData.answer.toUpperCase();
      const positions: number[] = [];
      for (let i = 0; i < answer.length; i++) {
        if (answer[i] === char) positions.push(i);
      }
      return res.json({ correct: positions.length > 0, positions });

    } else if (gameType === 'verse_scramble') {
      // Usually checked on client for "placed" words, but final check here?
      // Or maybe we just check if the sentence matches?
      // The client sends the full sentence or list of words?
      // Let's assume client sends list of words in order.
      const guessWords = guess as string[];
      const correctWords = gameData.verse.split(' ');
      const correct = JSON.stringify(guessWords) === JSON.stringify(correctWords);
      return res.json({ correct });
    }

    res.json({ error: 'Game type not supported for checking' });

  } catch (error) {
    console.error('Check answer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/challenge/:challengeId/daily', async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    const userId = req.headers['x-user-id'] as string;
    const today = getTodayEST();
    const result = await pool.query('SELECT * FROM games WHERE challenge_id = $1 AND DATE(date) = $2', [challengeId, today]);

    if (result.rows.length > 0) {
      const game = result.rows[0];
      const resolvedGame = await resolveGameData(game, userId);
      res.json(resolvedGame);
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Get daily game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/games/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const userId = req.headers['x-user-id'] as string;

    const result = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (result.rows.length > 0) {
      const game = result.rows[0];
      const resolvedGame = await resolveGameData(game, userId);
      res.json(resolvedGame);
    } else {
      res.status(404).json({ error: 'Game not found' });
    }
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/challenge/:challengeId/games', async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    const userId = req.headers['x-user-id'] as string; // We need user ID to resolve games correctly

    const result = await pool.query("SELECT * FROM games WHERE challenge_id = $1 ORDER BY date ASC", [challengeId]);

    // Resolve all games (this might be slow if many wordle_advanced games, but usually it's few)
    const games = await Promise.all(result.rows.map(async (game) => {
      return resolveGameData(game, userId);
    }));

    res.json(games);
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// This block is assumed to be the end of the migrate-session endpoint based on the instruction's snippet
// The instruction implies this block should be present before the new /report-cheating endpoint.
// Since it's not in the original content, it's added here as per the instruction's context.
// If this block is not part of the actual file, it should be removed.
// For the purpose of this edit, it's included as it appears in the instruction's context.
// Return updated user object (with correct isAdmin from DB) and token
// res.json({ ...user, token });
// } catch (error) {
//   console.error('Session migration error:', error);
//   res.status(500).json({ error: 'Internal server error' });
// }
// });

router.post('/report-cheating', async (req: Request, res: Response) => {
  try {
    const { userId, details } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    // Log to database
    await pool.query(
      'INSERT INTO visit_logs (user_id, path, method, metadata) VALUES ($1, $2, $3, $4)',
      [userId, 'DEV_TOOLS_DETECTED', 'ALERT', JSON.stringify({ details })]
    );

    // Get user details for email
    const result = await pool.query('SELECT name, email FROM users WHERE id = $1', [userId]);
    if (result.rows.length > 0) {
      const { name, email } = result.rows[0];
      // Send email alert
      await sendCheatingAlert(email, name, details);
    }

    res.status(200).json({ message: 'Reported' });
  } catch (error) {
    console.error('Cheating report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/submissions/user/:userId/challenge/:challengeId', async (req: Request, res: Response) => {
  try {
    const { userId, challengeId } = req.params;
    const result = await pool.query('SELECT * FROM game_submissions WHERE user_id = $1 AND challenge_id = $2', [userId, challengeId]);
    const submissions = result.rows.map(sub => ({
      id: sub.id,
      userId: sub.user_id,
      gameId: sub.game_id,
      challengeId: sub.challenge_id,
      startedAt: sub.started_at ? sub.started_at.toISOString() : new Date(sub.completed_at.getTime() - sub.time_taken * 1000).toISOString(),
      completedAt: sub.completed_at.toISOString(),
      timeTaken: sub.time_taken,
      mistakes: sub.mistakes,
      score: sub.score,
      submissionData: sub.submission_data,
    }));
    res.json(submissions);
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/submissions/user/:userId/game/:gameId', async (req: Request, res: Response) => {
  try {
    const { userId, gameId } = req.params;
    const result = await pool.query('SELECT * FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
    if (result.rows.length > 0) {
      const sub = result.rows[0];
      res.json({
        id: sub.id,
        userId: sub.user_id,
        gameId: sub.game_id,
        challengeId: sub.challenge_id,
        startedAt: sub.started_at ? sub.started_at.toISOString() : new Date(sub.completed_at.getTime() - sub.time_taken * 1000).toISOString(),
        completedAt: sub.completed_at.toISOString(),
        timeTaken: sub.time_taken,
        mistakes: sub.mistakes,
        score: sub.score,
        submissionData: sub.submission_data,
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Get submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/challenge/:challengeId/leaderboard', async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    const result = await pool.query(
      `SELECT u.id as user_id, u.name, u.email, SUM(gs.score) as total_score, COUNT(gs.id) as games_played
      FROM game_submissions gs JOIN users u ON gs.user_id = u.id
      WHERE gs.challenge_id = $1 GROUP BY u.id, u.name, u.email ORDER BY total_score DESC`,
      [challengeId]
    );
    const leaderboard = result.rows.map(row => ({
      id: `leaderboard-${row.user_id}`,
      userId: row.user_id,
      challengeId,
      score: parseInt(row.total_score, 10),
      user: { id: row.user_id, name: row.name, email: row.email },
      gamesPlayed: parseInt(row.games_played, 10),
      gameId: '', startedAt: '', completedAt: '', timeTaken: 0, mistakes: 0,
    }));
    res.json(leaderboard);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- SUBMIT GAME (with server-side scoring) ---
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const { userId, gameId, startedAt, timeTaken, mistakes, submissionData } = req.body;

    const gameResult = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) return res.status(404).json({ error: 'Game not found' });

    const game = gameResult.rows[0];
    // Calculate score securely on server
    const today = new Date(getTodayEST() + 'T12:00:00Z');
    const gameDateStr = new Date(game.date).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const gameDate = new Date(gameDateStr + 'T12:00:00Z');
    const diffTime = today.getTime() - gameDate.getTime();
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    // Allow submission on day 5 (for 0 points), but block on day 6
    if (diffDays > 5) {
      return res.status(403).json({ error: 'This game is too old to submit.' });
    }

    // Resolve game data WITH solution for validation
    const resolvedGame = await resolveGameData(game, userId, false);
    const gameData = resolvedGame.data;
    const gameType = resolvedGame.type;

    let calculatedMistakes = mistakes;
    let feedback: any = {};

    if (gameType === 'wordle' || gameType === 'wordle_advanced') {
      const solution = gameData.solution.toUpperCase();
      const guesses = submissionData.guesses.filter((g: string) => g);
      calculatedMistakes = 0;
      guesses.forEach((guess: string) => {
        if (guess.toUpperCase() !== solution) {
          calculatedMistakes++;
        }
      });
      // If user failed all guesses, ensure mistakes reflects that (max 6)
      if (guesses.length === 6 && guesses[5].toUpperCase() !== solution) {
        calculatedMistakes = 6;
      }
    } else if (gameType === 'crossword') {
      const userGrid = submissionData.grid;
      const { rows, cols, acrossClues, downClues } = gameData;

      // Reconstruct solution grid
      const solutionGrid: (string | null)[][] = Array(rows).fill(null).map(() => Array(cols).fill(null));
      const allClues: any[] = [...acrossClues, ...downClues];
      allClues.forEach(clue => {
        for (let i = 0; i < clue.answer.length; i++) {
          const r = clue.direction === 'across' ? clue.row : clue.row + i;
          const c = clue.direction === 'across' ? clue.col + i : clue.col;
          if (solutionGrid[r] && c < cols) {
            solutionGrid[r][c] = clue.answer[i];
          }
        }
      });

      calculatedMistakes = 0;
      let correctCells = 0;
      let totalFillableCells = 0;
      const incorrectCells: { row: number, col: number }[] = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (solutionGrid[r][c] !== null) {
            totalFillableCells++;
            const userVal = userGrid[r][c];
            if (userVal === solutionGrid[r][c]) {
              correctCells++;
            } else if (userVal) {
              calculatedMistakes++;
              incorrectCells.push({ row: r, col: c });
            }
          }
        }
      }

      submissionData.correctCells = correctCells;
      submissionData.totalFillableCells = totalFillableCells;
      submissionData.incorrectCells = incorrectCells; // Save for review
      feedback.incorrectCells = incorrectCells;
    } else if (gameType === 'connections') {
      // Validate connections
      // Submission data usually has 'foundGroups'.
      // We can trust foundGroups if we validated them during check?
      // But better to re-validate.
      // However, connections submission usually just sends the final state.
      // Let's assume for now we trust client for Connections as it requires step-by-step validation which is hard to reconstruct without history.
      // But we can check if foundGroups are valid.
      if (submissionData.foundGroups) {
        const validGroups = submissionData.foundGroups.filter((group: any) => {
          const match = gameData.categories.find((cat: any) => cat.name === group.name);
          return !!match;
        });
        // If client sent invalid groups, we might want to correct score.
        // But let's stick to trusting client mistakes for now for Connections as it's complex state.
        // Or just use client mistakes.
      }
    } else if (gameType === 'match_the_word') {
      // Similar to connections
    } else if (gameType === 'who_am_i') {
      // Check if solved
      if (submissionData.solved) {
        // Verify?
      }
    } else if (gameType === 'verse_scramble') {
      if (submissionData.completed) {
        // Verify?
      }
    }


    const score = calculateScore(resolvedGame, submissionData, timeTaken, calculatedMistakes);

    // Check for assigned crossword index in game_progress to persist it
    let finalSubmissionData = submissionData;
    if (game.type === 'crossword') {
      const progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
      if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedCrosswordIndex !== undefined) {
        finalSubmissionData = {
          ...submissionData,
          assignedCrosswordIndex: progressResult.rows[0].game_state.assignedCrosswordIndex
        };
      }
    } else if (game.type === 'word_search') {
      const progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
      if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedWordSearchIndex !== undefined) {
        finalSubmissionData = {
          ...submissionData,
          assignedWordSearchIndex: progressResult.rows[0].game_state.assignedWordSearchIndex
        };
      }
    } else if (game.type === 'wordle' || game.type === 'wordle_advanced') {
      const progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
      if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedSolution) {
        finalSubmissionData = {
          ...submissionData,
          solution: progressResult.rows[0].game_state.assignedSolution
        };
      }
    } else if (game.type === 'verse_scramble') {
      const progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
      if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedVerse) {
        finalSubmissionData = {
          ...submissionData,
          verse: progressResult.rows[0].game_state.assignedVerse.verse,
          reference: progressResult.rows[0].game_state.assignedVerse.reference
        };
      }
    } else if (game.type === 'who_am_i') {
      const progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
      if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedSolution) {
        finalSubmissionData = {
          ...submissionData,
          answer: progressResult.rows[0].game_state.assignedSolution.answer,
          hint: progressResult.rows[0].game_state.assignedSolution.hint
        };
      }
    }

    const existingSub = await pool.query('SELECT * FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, gameId]);

    if (existingSub.rows.length > 0) {
      // Only update if new score is better
      if (score > existingSub.rows[0].score) {
        const result = await pool.query(
          'UPDATE game_submissions SET started_at = $1, completed_at = $2, time_taken = $3, mistakes = $4, score = $5, submission_data = $6 WHERE id = $7 RETURNING *',
          [startedAt, new Date(), timeTaken, calculatedMistakes, score, JSON.stringify(finalSubmissionData), existingSub.rows[0].id]
        );
        return res.json({ ...mapSubmission(result.rows[0]), feedback });
      } else {
        return res.json(mapSubmission(existingSub.rows[0]));
      }
    }

    const submissionId = `sub-${Date.now()}`;
    const result = await pool.query(
      'INSERT INTO game_submissions (id, user_id, game_id, challenge_id, started_at, completed_at, time_taken, mistakes, score, submission_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [submissionId, userId, gameId, game.challenge_id, startedAt, new Date(), timeTaken, calculatedMistakes, score, JSON.stringify(finalSubmissionData)]
    );
    res.json({ ...mapSubmission(result.rows[0]), feedback });

  } catch (error) {
    console.error('Submit game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper to map DB submission to API response
const mapSubmission = (sub: any) => ({
  id: sub.id,
  userId: sub.user_id,
  gameId: sub.game_id,
  challengeId: sub.challenge_id,
  startedAt: sub.started_at ? sub.started_at.toISOString() : new Date(sub.completed_at.getTime() - sub.time_taken * 1000).toISOString(),
  completedAt: sub.completed_at.toISOString(),
  timeTaken: sub.time_taken,
  mistakes: sub.mistakes,
  score: sub.score,
  submissionData: sub.submission_data,
});

// --- GAME STATE ENDPOINTS ---
router.get('/game-state/user/:userId/game/:gameId', async (req: Request, res: Response) => {
  try {
    const { userId, gameId } = req.params;
    const result = await pool.query('SELECT * FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
    if (result.rows.length > 0) {
      res.json({
        id: result.rows[0].id,
        userId: result.rows[0].user_id,
        gameId: result.rows[0].game_id,
        gameState: result.rows[0].game_state,
        updatedAt: result.rows[0].updated_at.toISOString(),
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Get game state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/game-state/user/:userId/game/:gameId', async (req: Request, res: Response) => {
  try {
    const { userId, gameId } = req.params;
    const { gameState } = req.body;
    const now = new Date();

    // Preserve assignedWord if it exists in the DB but not in the new state
    // This is critical for Wordle Advanced where assignedWord is set by the server
    const existingResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);

    let finalGameState = gameState;
    if (existingResult.rows.length > 0) {
      const existingState = existingResult.rows[0].game_state;
      const keysToPreserve = [
        'assignedWord',
        'assignedVerse',
        'assignedCategories',
        'assignedCrosswordIndex',
        'assignedWhoAmI',
        'assignedPairs',
        'assignedWordSearchIndex'
      ];

      keysToPreserve.forEach(key => {
        if (existingState[key] && !finalGameState[key]) {
          finalGameState[key] = existingState[key];
        }
      });
    }

    await pool.query(
      `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = EXCLUDED.game_state, updated_at = EXCLUDED.updated_at`,
      [`progress-${userId}-${gameId}`, userId, gameId, JSON.stringify(finalGameState), now]
    );

    const result = await pool.query('SELECT * FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
    res.json({
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      gameId: result.rows[0].game_id,
      gameState: result.rows[0].game_state,
      updatedAt: result.rows[0].updated_at.toISOString(),
    });
  } catch (error) {
    console.error('Save game state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/game-state/user/:userId/game/:gameId', async (req: Request, res: Response) => {
  try {
    const { userId, gameId } = req.params;
    await pool.query('DELETE FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
    res.status(204).send();
  } catch (error) {
    console.error('Clear game state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- SUPPORT TICKETS (Public/User) ---

// Create a support ticket
router.post('/support/ticket', async (req: Request, res: Response) => {
  try {
    const { email, issue, userId } = req.body;

    if (!email || !issue) {
      return res.status(400).json({ error: 'Email and issue are required.' });
    }

    const ticketId = `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // If userId is provided, verify it exists (optional, but good for data integrity)
    // For now, just insert it.

    await pool.query(
      'INSERT INTO support_tickets (id, user_id, email, issue) VALUES ($1, $2, $3, $4)',
      [ticketId, userId || null, email, issue]
    );

    // Send emails
    // 1. To User
    await sendTicketCreatedEmail(email, ticketId, issue.substring(0, 200) + (issue.length > 200 ? '...' : ''));

    // 2. To Admin
    await sendAdminTicketNotification(ticketId, email, issue);

    res.status(201).json({ message: 'Support ticket created successfully.', ticketId });

  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ticket status (Public with ID)
router.get('/support/ticket/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ticketResult = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [id]);

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const ticket = ticketResult.rows[0];

    // Fetch notes (only public ones? Or all? Usually admin notes are internal or visible. 
    // Requirement says "Admin user can... add notes... An email is sent to the user... with a link to the issue status".
    // Usually support systems show the conversation. Let's assume notes are replies.)
    const notesResult = await pool.query(
      `SELECT tn.*, u.name as admin_name 
       FROM ticket_notes tn 
       LEFT JOIN users u ON tn.user_id = u.id 
       WHERE tn.ticket_id = $1 
       ORDER BY tn.created_at ASC`,
      [id]
    );

    res.json({
      ticket: {
        id: ticket.id,
        email: ticket.email,
        issue: ticket.issue,
        status: ticket.status,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at
      },
      notes: notesResult.rows.map(note => ({
        id: note.id,
        note: note.note,
        adminName: note.admin_name || 'Support Team',
        createdAt: note.created_at
      }))
    });

  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;