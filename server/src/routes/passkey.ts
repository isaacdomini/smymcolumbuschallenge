import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import jwt from 'jsonwebtoken';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticatorTransportFuture,
  CredentialDeviceType,
} from '@simplewebauthn/server';

const router = Router();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable must be set');
}
const JWT_SECRET = process.env.JWT_SECRET;

// --- WebAuthn RP Configuration ---
// rpID must match the domain the app is served from.
// In production this will be smymgame.tesarsoft.com.
// In development we allow localhost.
const IS_DEV = process.env.NODE_ENV === 'development';
const RP_ID = IS_DEV ? 'localhost' : 'smymgame.tesarsoft.com';
const RP_NAME = 'SMYM Columbus Bible Games';
const EXPECTED_ORIGINS = IS_DEV
  ? ['http://localhost:5173', 'http://localhost:3000']
  : ['https://smymgame.tesarsoft.com'];

// Challenge TTL in milliseconds (5 minutes)
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

// --- Helpers ---

/** Clean up expired challenges */
async function purgeExpiredChallenges() {
  await pool.query('DELETE FROM passkey_challenges WHERE expires_at < NOW()');
}

/** Store a challenge for later verification */
async function storeChallenge(
  challenge: string,
  type: 'registration' | 'authentication',
  userId?: string
) {
  await purgeExpiredChallenges();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  await pool.query(
    `INSERT INTO passkey_challenges (user_id, challenge, type, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (challenge) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    [userId || null, challenge, type, expiresAt]
  );
}

/** Retrieve and delete a challenge (one-time use) */
async function consumeChallenge(
  challenge: string,
  type: 'registration' | 'authentication'
): Promise<{ userId: string | null } | null> {
  const result = await pool.query(
    `DELETE FROM passkey_challenges
     WHERE challenge = $1 AND type = $2 AND expires_at > NOW()
     RETURNING user_id`,
    [challenge, type]
  );
  if (result.rows.length === 0) return null;
  return { userId: result.rows[0].user_id };
}

// ============================================================
// REGISTRATION — Step 1: Generate challenge
// POST /api/passkey/register-challenge
// Body: { email: string }
// ============================================================
router.post('/register-challenge', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    // Find user by email
    const userResult = await pool.query(
      'SELECT id, name, email FROM users WHERE email = $1',
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with that email' });
    }
    const user = userResult.rows[0];

    // Fetch existing credential IDs to exclude (prevents duplicate registration)
    const credResult = await pool.query(
      'SELECT id, transports FROM passkey_credentials WHERE user_id = $1',
      [user.id]
    );
    const excludeCredentials = credResult.rows.map((c) => ({
      id: c.id,
      transports: (c.transports as AuthenticatorTransportFuture[]) ?? undefined,
    }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.email,
      userDisplayName: user.name,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    await storeChallenge(options.challenge, 'registration', user.id);

    res.json(options);
  } catch (error) {
    console.error('Passkey register-challenge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// REGISTRATION — Step 2: Verify and save credential
// POST /api/passkey/register-verify
// Body: { email: string, registrationResponse: PublicKeyCredential }
// ============================================================
router.post('/register-verify', async (req: Request, res: Response) => {
  try {
    const { email, registrationResponse } = req.body;
    if (!email || !registrationResponse) {
      return res.status(400).json({ error: 'email and registrationResponse are required' });
    }

    // Find user
    const userResult = await pool.query(
      'SELECT id, name, email, is_admin FROM users WHERE email = $1',
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    // Recover the challenge from the response
    const expectedChallenge = registrationResponse.response?.clientDataJSON
      ? Buffer.from(registrationResponse.response.clientDataJSON, 'base64url')
          .toString('utf-8')
          .match(/"challenge":"([^"]+)"/)?.[1] ?? ''
      : '';

    const challengeRecord = await consumeChallenge(expectedChallenge, 'registration');
    if (!challengeRecord) {
      return res.status(400).json({ error: 'Invalid or expired challenge' });
    }

    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Registration verification failed' });
    }

    const { credential, credentialDeviceType } = verification.registrationInfo;

    // Save credential
    await pool.query(
      `INSERT INTO passkey_credentials (id, user_id, public_key, counter, transports)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET counter = EXCLUDED.counter`,
      [
        credential.id,
        user.id,
        Buffer.from(credential.publicKey).toString('base64url'),
        credential.counter,
        JSON.stringify(credential.transports ?? []),
      ]
    );

    // Issue JWT token (same as password login)
    const token = jwt.sign({ id: user.id, isAdmin: user.is_admin }, JWT_SECRET, {
      expiresIn: '365d',
    });

    res.json({
      verified: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        is_admin: user.is_admin,
        token,
      },
    });
  } catch (error) {
    console.error('Passkey register-verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// AUTHENTICATION — Step 1: Generate challenge
// POST /api/passkey/authenticate-challenge
// Body: {} (no email needed — discoverable credentials / conditional UI)
// ============================================================
router.post('/authenticate-challenge', async (req: Request, res: Response) => {
  try {
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
      // Empty allowCredentials → discoverable / resident key flow
      // The browser/OS will show the passkey picker automatically
    });

    await storeChallenge(options.challenge, 'authentication');

    res.json(options);
  } catch (error) {
    console.error('Passkey authenticate-challenge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// AUTHENTICATION — Step 2: Verify assertion and return JWT
// POST /api/passkey/authenticate-verify
// Body: { authenticationResponse: PublicKeyCredential }
// ============================================================
router.post('/authenticate-verify', async (req: Request, res: Response) => {
  try {
    const { authenticationResponse } = req.body;
    if (!authenticationResponse) {
      return res.status(400).json({ error: 'authenticationResponse is required' });
    }

    const credentialId = authenticationResponse.id;

    // Look up the stored credential
    const credResult = await pool.query(
      `SELECT pc.*, u.id as user_id, u.name, u.email, u.is_admin
       FROM passkey_credentials pc
       JOIN users u ON u.id = pc.user_id
       WHERE pc.id = $1`,
      [credentialId]
    );
    if (credResult.rows.length === 0) {
      return res.status(400).json({ error: 'Passkey not found' });
    }
    const credRow = credResult.rows[0];

    // Recover expected challenge
    const expectedChallenge = authenticationResponse.response?.clientDataJSON
      ? Buffer.from(authenticationResponse.response.clientDataJSON, 'base64url')
          .toString('utf-8')
          .match(/"challenge":"([^"]+)"/)?.[1] ?? ''
      : '';

    const challengeRecord = await consumeChallenge(expectedChallenge, 'authentication');
    if (!challengeRecord) {
      return res.status(400).json({ error: 'Invalid or expired challenge' });
    }

    const authenticator = {
      id: credRow.id,
      publicKey: Buffer.from(credRow.public_key, 'base64url'),
      counter: Number(credRow.counter),
      transports: (credRow.transports as AuthenticatorTransportFuture[]) ?? undefined,
    };

    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGINS,
      expectedRPID: RP_ID,
      credential: authenticator,
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return res.status(400).json({ error: 'Authentication verification failed' });
    }

    // Update counter to prevent replay attacks
    await pool.query(
      'UPDATE passkey_credentials SET counter = $1 WHERE id = $2',
      [verification.authenticationInfo.newCounter, credentialId]
    );

    // Fetch full user data (groups etc)
    const userResult = await pool.query(
      'SELECT id, name, email, is_admin FROM users WHERE id = $1',
      [credRow.user_id]
    );
    const user = userResult.rows[0];

    const groupsResult = await pool.query(
      `SELECT g.*, ug.role
       FROM groups g
       JOIN user_groups ug ON g.id = ug.group_id
       WHERE ug.user_id = $1`,
      [user.id]
    );

    const token = jwt.sign({ id: user.id, isAdmin: user.is_admin }, JWT_SECRET, {
      expiresIn: '365d',
    });

    res.json({ ...user, token, groups: groupsResult.rows });
  } catch (error) {
    console.error('Passkey authenticate-verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// CHECK — Does user have passkeys?
// GET /api/passkey/has-passkey?email=...
// ============================================================
router.get('/has-passkey', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email is required' });
    }

    const result = await pool.query(
      `SELECT COUNT(*) as count FROM passkey_credentials pc
       JOIN users u ON u.id = pc.user_id
       WHERE u.email = $1`,
      [email]
    );

    res.json({ hasPasskey: parseInt(result.rows[0].count) > 0 });
  } catch (error) {
    console.error('Passkey has-passkey error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
