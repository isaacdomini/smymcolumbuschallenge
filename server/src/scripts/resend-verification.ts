import pool from '../db/pool.js';
import { sendVerificationEmail } from '../services/email.js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from the root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const resendVerification = async (email: string) => {
  try {
    console.log(`Looking up user with email: ${email}`);
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      console.error(`Error: User with email ${email} not found.`);
      process.exit(1);
    }

    const user = result.rows[0];

    if (user.is_verified) {
      console.log(`User ${email} is already verified.`);
      process.exit(0);
    }

    let token = user.verification_token;
    if (!token) {
      console.log('No existing token found. Generating new verification token...');
      token = crypto.randomBytes(32).toString('hex');
      await pool.query('UPDATE users SET verification_token = $1 WHERE id = $2', [token, user.id]);
    } else {
      console.log('Using existing verification token.');
    }

    console.log(`Sending verification email to ${email}...`);
    // We don't have a request object, so we rely on APP_URL env var or default
    await sendVerificationEmail(email, token);

    console.log('Verification email sent successfully.');
    process.exit(0);
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
};

const email = process.argv[2];
if (!email) {
  console.error('Please provide an email address.');
  console.error('Usage: npx tsx server/src/scripts/resend-verification.ts <email>');
  process.exit(1);
}

resendVerification(email);
