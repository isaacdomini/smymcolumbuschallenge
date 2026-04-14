
import express from 'express';
import pool from '../db/pool.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const router = express.Router();

// --- Helper: Check if user is a group admin or site admin ---
async function isGroupAdmin(userId: string, groupId: string): Promise<boolean> {
  // Check site admin
  const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
  if (adminCheck.rows.length > 0 && adminCheck.rows[0].is_admin) return true;

  // Check group admin
  const groupCheck = await pool.query(
    'SELECT role FROM user_groups WHERE user_id = $1 AND group_id = $2',
    [userId, groupId]
  );
  return groupCheck.rows.length > 0 && groupCheck.rows[0].role === 'admin';
}

// Generate a short invite code
function generateInviteCode(): string {
  return crypto.randomBytes(5).toString('hex'); // 10 char hex code
}

// ==========================================
//  PUBLIC GROUP BROWSING
// ==========================================

// Get all public groups (for user browsing)
router.get('/public', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const search = (req.query.search as string || '').trim();

    let query = `
      SELECT g.*, 
        (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) as member_count,
        EXISTS(SELECT 1 FROM user_groups ug WHERE ug.user_id = $1 AND ug.group_id = g.id) as is_member
      FROM groups g
      WHERE g.is_public = true
    `;
    const params: any[] = [userId];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND g.name ILIKE $${params.length}`;
    }

    query += ' ORDER BY g.name ASC';

    const result = await pool.query(query, params);
    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      isPublic: row.is_public,
      createdAt: row.created_at,
      memberCount: parseInt(row.member_count),
      isMember: row.is_member
    })));
  } catch (error) {
    console.error('Error fetching public groups:', error);
    res.status(500).json({ error: 'Failed to fetch public groups' });
  }
});

// ==========================================
//  BASIC GROUP CRUD
// ==========================================

// Get all groups (admin only — for admin dashboard)
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query('SELECT * FROM groups ORDER BY name ASC');
    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      isPublic: row.is_public,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get user's groups
router.get('/my', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT g.*, ug.role 
       FROM groups g 
       JOIN user_groups ug ON g.id = ug.group_id 
       WHERE ug.user_id = $1 
       ORDER BY g.name ASC`,
      [userId]
    );
    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      isPublic: row.is_public,
      createdAt: row.created_at,
      role: row.role
    })));
  } catch (error) {
    console.error('Error fetching user groups:', error);
    res.status(500).json({ error: 'Failed to fetch user groups' });
  }
});

// Create a new group (Admin only)
router.post('/', requireAdmin, async (req: any, res) => {
  const { name, isPublic = false } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const groupId = uuidv4();

    // Create group
    const groupResult = await client.query(
      'INSERT INTO groups (id, name, is_public) VALUES ($1, $2, $3) RETURNING *',
      [groupId, name, isPublic]
    );

    // Add creator as admin of the group
    await client.query(
      'INSERT INTO user_groups (user_id, group_id, role) VALUES ($1, $2, $3)',
      [req.user.id, groupId, 'admin']
    );

    await client.query('COMMIT');
    const row = groupResult.rows[0];
    res.json({ id: row.id, name: row.name, isPublic: row.is_public, createdAt: row.created_at });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  } finally {
    client.release();
  }
});

// Update a group (admin only)
router.put('/:id', authenticateToken, async (req: any, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  if (!(await isGroupAdmin(userId, groupId))) {
    return res.status(403).json({ error: 'Forbidden: Group admin access required' });
  }

  const { name, isPublic } = req.body;
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(name);
  }
  if (isPublic !== undefined) {
    fields.push(`is_public = $${idx++}`);
    values.push(isPublic);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(groupId);
  try {
    await pool.query(`UPDATE groups SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    res.json({ message: 'Group updated successfully' });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// ==========================================
//  JOINING / LEAVING
// ==========================================

// Join a public group directly by ID
router.post('/:id/join', authenticateToken, async (req: any, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  try {
    // Check if group exists and is public
    const groupCheck = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!groupCheck.rows[0].is_public) {
      return res.status(403).json({ error: 'This group is private. You need an invite link to join.' });
    }

    // Check if already a member
    const membershipCheck = await pool.query(
      'SELECT * FROM user_groups WHERE user_id = $1 AND group_id = $2',
      [userId, groupId]
    );

    if (membershipCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    // Join group
    await pool.query(
      'INSERT INTO user_groups (user_id, group_id, role) VALUES ($1, $2, $3)',
      [userId, groupId, 'member']
    );

    res.json({ message: 'Joined group successfully', groupName: groupCheck.rows[0].name });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// Join a group by invite code
router.post('/join', authenticateToken, async (req: any, res) => {
  const { code } = req.body;
  const userId = req.user.id;

  if (!code) return res.status(400).json({ error: 'Invite code is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find the invite
    const inviteResult = await client.query(
      'SELECT gi.*, g.name as group_name FROM group_invites gi JOIN groups g ON gi.group_id = g.id WHERE gi.code = $1',
      [code.trim()]
    );

    if (inviteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    const invite = inviteResult.rows[0];

    // Check expiry
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'This invite link has expired' });
    }

    // Check max uses
    if (invite.max_uses !== null && invite.uses >= invite.max_uses) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'This invite link has reached its maximum uses' });
    }

    // Check if already a member
    const membershipCheck = await client.query(
      'SELECT * FROM user_groups WHERE user_id = $1 AND group_id = $2',
      [userId, invite.group_id]
    );

    if (membershipCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You are already a member of this group', groupName: invite.group_name });
    }

    // Join the group
    await client.query(
      'INSERT INTO user_groups (user_id, group_id, role) VALUES ($1, $2, $3)',
      [userId, invite.group_id, 'member']
    );

    // Increment uses
    await client.query('UPDATE group_invites SET uses = uses + 1 WHERE id = $1', [invite.id]);

    await client.query('COMMIT');
    res.json({ message: 'Joined group successfully', groupName: invite.group_name, groupId: invite.group_id });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error joining group by invite:', error);
    res.status(500).json({ error: 'Failed to join group' });
  } finally {
    client.release();
  }
});

// Leave a group
router.post('/:id/leave', authenticateToken, async (req: any, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  try {
    await pool.query(
      'DELETE FROM user_groups WHERE user_id = $1 AND group_id = $2',
      [userId, groupId]
    );

    res.json({ message: 'Left group successfully' });
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// ==========================================
//  MEMBER MANAGEMENT
// ==========================================

// Get members of a group
router.get('/:id/members', authenticateToken, async (req: any, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  if (!(await isGroupAdmin(userId, groupId))) {
    return res.status(403).json({ error: 'Forbidden: Group admin access required' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.is_verified, u.created_at, ug.role, ug.joined_at
       FROM users u
       JOIN user_groups ug ON u.id = ug.user_id
       WHERE ug.group_id = $1
       ORDER BY ug.role DESC, u.name ASC`,
      [groupId]
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      isVerified: row.is_verified,
      createdAt: row.created_at,
      role: row.role,
      joinedAt: row.joined_at
    })));
  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({ error: 'Failed to fetch group members' });
  }
});

// Add a member to a group
router.post('/:id/members', authenticateToken, async (req: any, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  if (!(await isGroupAdmin(userId, groupId))) {
    return res.status(403).json({ error: 'Forbidden: Group admin access required' });
  }

  const { userId: targetUserId } = req.body;
  if (!targetUserId) return res.status(400).json({ error: 'userId is required' });

  try {
    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already a member
    const memberCheck = await pool.query(
      'SELECT * FROM user_groups WHERE user_id = $1 AND group_id = $2',
      [targetUserId, groupId]
    );
    if (memberCheck.rows.length > 0) {
      return res.status(400).json({ error: 'User is already a member of this group' });
    }

    await pool.query(
      'INSERT INTO user_groups (user_id, group_id, role) VALUES ($1, $2, $3)',
      [targetUserId, groupId, 'member']
    );

    res.json({ message: 'User added to group successfully' });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Remove a member from a group
router.delete('/:id/members/:userId', authenticateToken, async (req: any, res) => {
  const groupId = req.params.id;
  const targetUserId = req.params.userId;
  const userId = req.user.id;

  if (!(await isGroupAdmin(userId, groupId))) {
    return res.status(403).json({ error: 'Forbidden: Group admin access required' });
  }

  try {
    await pool.query(
      'DELETE FROM user_groups WHERE user_id = $1 AND group_id = $2',
      [targetUserId, groupId]
    );

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Update a member's role
router.patch('/:id/members/:userId/role', authenticateToken, async (req: any, res) => {
  const groupId = req.params.id;
  const targetUserId = req.params.userId;
  const userId = req.user.id;

  if (!(await isGroupAdmin(userId, groupId))) {
    return res.status(403).json({ error: 'Forbidden: Group admin access required' });
  }

  const { role } = req.body;
  if (!role || !['member', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role must be "member" or "admin"' });
  }

  try {
    const result = await pool.query(
      'UPDATE user_groups SET role = $1 WHERE user_id = $2 AND group_id = $3',
      [role, targetUserId, groupId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found in this group' });
    }

    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// ==========================================
//  INVITE MANAGEMENT
// ==========================================

// Create an invite for a group
router.post('/:id/invites', authenticateToken, async (req: any, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  if (!(await isGroupAdmin(userId, groupId))) {
    return res.status(403).json({ error: 'Forbidden: Group admin access required' });
  }

  const { maxUses, expiresInHours } = req.body;

  try {
    const inviteId = uuidv4();
    const code = generateInviteCode();
    let expiresAt = null;

    if (expiresInHours && expiresInHours > 0) {
      expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    }

    await pool.query(
      'INSERT INTO group_invites (id, group_id, code, created_by, max_uses, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [inviteId, groupId, code, userId, maxUses || null, expiresAt]
    );

    res.json({
      id: inviteId,
      code,
      groupId,
      maxUses: maxUses || null,
      uses: 0,
      expiresAt,
      createdAt: new Date()
    });
  } catch (error) {
    console.error('Error creating invite:', error);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// Get invites for a group
router.get('/:id/invites', authenticateToken, async (req: any, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  if (!(await isGroupAdmin(userId, groupId))) {
    return res.status(403).json({ error: 'Forbidden: Group admin access required' });
  }

  try {
    const result = await pool.query(
      `SELECT gi.*, u.name as created_by_name 
       FROM group_invites gi 
       LEFT JOIN users u ON gi.created_by = u.id
       WHERE gi.group_id = $1 
       ORDER BY gi.created_at DESC`,
      [groupId]
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      code: row.code,
      groupId: row.group_id,
      createdBy: row.created_by_name,
      maxUses: row.max_uses,
      uses: row.uses,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error('Error fetching invites:', error);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// Revoke an invite
router.delete('/:id/invites/:inviteId', authenticateToken, async (req: any, res) => {
  const groupId = req.params.id;
  const inviteId = req.params.inviteId;
  const userId = req.user.id;

  if (!(await isGroupAdmin(userId, groupId))) {
    return res.status(403).json({ error: 'Forbidden: Group admin access required' });
  }

  try {
    await pool.query('DELETE FROM group_invites WHERE id = $1 AND group_id = $2', [inviteId, groupId]);
    res.json({ message: 'Invite revoked successfully' });
  } catch (error) {
    console.error('Error revoking invite:', error);
    res.status(500).json({ error: 'Failed to revoke invite' });
  }
});

export default router;
