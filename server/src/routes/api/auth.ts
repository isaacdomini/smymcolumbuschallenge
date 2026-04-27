import { Router, Request, Response } from 'express';
import pool from '../../db/pool.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { sendVerificationEmail, sendPasswordResetEmail, sendAccountDeletionRequestEmail, sendTicketCreatedEmail, sendAdminTicketNotification, sendCheatingAlert, sendAppDeprecationEmail } from '../../services/email.js';
import { getVapidPublicKey, saveSubscription } from '../../services/push.js';
import { manualLog, getClientIp } from '../../middleware/logger.js';
import { getFeatureFlag } from '../../utils/featureFlags.js';
import { authenticateToken, authenticateOptional } from '../../middleware/auth.js';
import { getTodayEST, calculateScore, resolveGameData, shuffleArray } from '../../utils/gameUtils.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback';
const router = Router();

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

    // Fetch user groups
    const groupsResult = await pool.query(
      `SELECT g.*, ug.role 
       FROM groups g 
       JOIN user_groups ug ON g.id = ug.group_id 
       WHERE ug.user_id = $1`,
      [user.id]
    );
    const groups = groupsResult.rows;

    const token = jwt.sign({ id: user.id, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ...user, token, groups });
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

export default router;
