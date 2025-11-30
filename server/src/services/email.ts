import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import pool from '../db/pool.js';

dotenv.config();

// Get the application base URL from environment or default to localhost for dev
const getAppUrl = (host?: string) => {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (host) return `${process.env.NODE_ENV === 'development' ? 'http' : 'https'}://${host}`;
  return 'http://localhost:5173';
};

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: (process.env.EMAIL_PORT === '465'),
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const logNotification = async (userId: string | null, type: string, recipient: string, content: any, status: string, error?: string) => {
  try {
    await pool.query(
      'INSERT INTO notification_logs (user_id, type, recipient, content, status, error) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, type, recipient, JSON.stringify(content), status, error]
    );
  } catch (err) {
    console.error('Failed to log notification:', err);
  }
};

export const sendVerificationEmail = async (email: string, token: string, host?: string) => {
  const baseUrl = getAppUrl(host);
  // If development mode and using separate frontend/backend ports, ensure we point to frontend
  // Note: The actual verification endpoint is on the API, but we want to redirect to frontend ultimately.
  // Let's stick to the API endpoint for the actual click, which then redirects.
  const apiVerificationUrl = `https://smymverify.columbuschurch.org/api/verify-email?token=${token}`;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Verify Your Email for SMYM Bible Games',
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Welcome to the SMYM Bible Games!</h2>
          <p>Please click the link below to verify your email address and start playing:</p>
          <p>
            <a href="${apiVerificationUrl}" style="background-color: #EAB308; color: #1F2937; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Verify Email
            </a>
          </p>
          <p style="font-size: 12px; color: #666;">If the button doesn't work, copy and paste this link: ${apiVerificationUrl}</p>
          <p>If you did not sign up for this account, you can ignore this email.</p>
        </div>
      `,
    });
    console.log(`Verification email sent to ${email}`);
    await logNotification(null, 'email_verification', email, { subject: 'Verify Your Email for SMYM Bible Games', body: 'HTML content omitted' }, 'sent');
  } catch (error: any) {
    console.error(`Failed to send verification email to ${email}:`, error);
    await logNotification(null, 'email_verification', email, { subject: 'Verify Your Email for SMYM Bible Games' }, 'failed', error.message);
  }
};

export const sendDailyReminder = async (email: string, name: string, gameType: string) => {
  const baseUrl = getAppUrl();
  const gameUrl = `${baseUrl}`; // Just direct them to the home page to play today's game

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Daily Challenge Reminder: Time for ${gameType}!`,
      html: `
                <div style="font-family: sans-serif; color: #333;">
                    <h2>Hi ${name},</h2>
                    <p>Don't forget to play today's <strong>${gameType}</strong> challenge!</p>
                    <p>Keep your streak alive and climb the leaderboard.</p>
                    <p>
                        <a href="${gameUrl}" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                            Play Now
                        </a>
                    </p>
                    <p style="font-size: 12px; color: #666;">Good luck!<br/>SMYM Columbus Team</p>
                </div>
            `,
    });
    console.log(`Reminder email sent to ${email} for ${gameType}`);
    await logNotification(null, 'email_reminder', email, { subject: `Daily Challenge Reminder: Time for ${gameType}!`, gameType }, 'sent');
  } catch (error: any) {
    console.error(`Failed to send reminder email to ${email}:`, error);
    await logNotification(null, 'email_reminder', email, { subject: `Daily Challenge Reminder: Time for ${gameType}!`, gameType }, 'failed', error.message);
  }
};

// ADDED: Password reset email
export const sendPasswordResetEmail = async (email: string, token: string, host?: string) => {
  const baseUrl = getAppUrl(host);
  const resetUrl = `https://smymverify.columbuschurch.org/api/reset-password?token=${token}`;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Password Reset Request for SMYM Bible Games',
      html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your SMYM Bible Games account.</p>
            <p>Please click the button below to reset your password. This link will expire in 1 hour.</p>
            <p>
              <a href="${resetUrl}" style="background-color: #DC2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </p>
            <p style="font-size: 12px; color: #666;">If the button doesn't work, copy and paste this link: ${resetUrl}</p>
            <p>If you did not request a password reset, please ignore this email.</p>
          </div>
        `,
    });
    console.log(`Password reset email sent to ${email}`);
    await logNotification(null, 'email_password_reset', email, { subject: 'Password Reset Request for SMYM Bible Games' }, 'sent');
  } catch (error: any) {
    console.error(`Failed to send password reset email to ${email}:`, error);
    await logNotification(null, 'email_password_reset', email, { subject: 'Password Reset Request for SMYM Bible Games' }, 'failed', error.message);
  }
};

// NEW: Account deletion request email to admin
export const sendAccountDeletionRequestEmail = async (userEmail: string, userId: string, userName: string) => {
  const adminEmail = 'me@isaacdomini.com'; // Admin's email address

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: adminEmail,
      subject: '[ACTION REQUIRED] Account Deletion Request for SMYM Bible Games',
      html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2>Account Deletion Request</h2>
            <p>A user has requested their account to be deleted. Please process this request within 48 hours.</p>
            <hr>
            <p><strong>User Details:</strong></p>
            <ul>
              <li><strong>Name:</strong> ${userName}</li>
              <li><strong>Email:</strong> ${userEmail}</li>
              <li><strong>User ID:</strong> ${userId}</li>
            </ul>
            <hr>
            <p><strong>Action:</strong> Please log in to the admin dashboard or database to delete this user's data (User ID: ${userId}).</p>
          </div>
        `,
    });
    console.log(`Account deletion request sent to admin for user ${userEmail}`);
    await logNotification(userId, 'email_account_deletion_request', adminEmail, { subject: '[ACTION REQUIRED] Account Deletion Request', userEmail, userName }, 'sent');
  } catch (error: any) {
    console.error(`Failed to send account deletion email to admin for user ${userEmail}:`, error);
    await logNotification(userId, 'email_account_deletion_request', adminEmail, { subject: '[ACTION REQUIRED] Account Deletion Request', userEmail, userName }, 'failed', error.message);
  }
};