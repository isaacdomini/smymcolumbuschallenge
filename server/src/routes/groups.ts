
import express from 'express';
import pool from '../db/pool';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all groups (public groups or my groups)
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    // For now, return all groups. In future, maybe filter by what user is in vs public
    const result = await pool.query('SELECT * FROM groups ORDER BY name ASC');
    res.json(result.rows);
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
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user groups:', error);
    res.status(500).json({ error: 'Failed to fetch user groups' });
  }
});

// Create a new group (Admin only for now)
router.post('/', authenticateToken, requireAdmin, async (req: any, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const groupId = uuidv4();

    // Create group
    const groupResult = await client.query(
      'INSERT INTO groups (id, name) VALUES ($1, $2) RETURNING *',
      [groupId, name]
    );

    // Add creator as admin of the group
    await client.query(
      'INSERT INTO user_groups (user_id, group_id, role) VALUES ($1, $2, $3)',
      [req.user.id, groupId, 'admin']
    );

    await client.query('COMMIT');
    res.json(groupResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  } finally {
    client.release();
  }
});

// Join a group
router.post('/:id/join', authenticateToken, async (req: any, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  try {
    // Check if group exists
    const groupCheck = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
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

    res.json({ message: 'Joined group successfully' });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ error: 'Failed to join group' });
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

export default router;
