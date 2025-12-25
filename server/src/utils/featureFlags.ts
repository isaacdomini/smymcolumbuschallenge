import pool from '../db/pool.js';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  updatedAt: Date;
}

export const getFeatureFlag = async (key: string): Promise<boolean> => {
  try {
    const result = await pool.query(
      'SELECT enabled FROM feature_flags WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      // Default to false if flag doesn't exist, or maybe logged warning depending on preference
      // For now, let's assume if it's not in DB, it's effectively disabled or we could insert a default.
      // But typically we should have seeded it. 
      return false;
    }

    return result.rows[0].enabled;
  } catch (error) {
    console.error(`Error fetching feature flag ${key}:`, error);
    // Fail safe to false (disabled) if DB error
    return false;
  }
};

export const getAllFeatureFlags = async (): Promise<FeatureFlag[]> => {
  try {
    const result = await pool.query('SELECT * FROM feature_flags ORDER BY key');
    return result.rows.map(row => ({
      key: row.key,
      enabled: row.enabled,
      description: row.description,
      updatedAt: row.updated_at
    }));
  } catch (error) {
    console.error('Error fetching all feature flags:', error);
    return [];
  }
};

export const updateFeatureFlag = async (key: string, enabled: boolean): Promise<FeatureFlag | null> => {
  try {
    const result = await pool.query(
      'UPDATE feature_flags SET enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2 RETURNING *',
      [enabled, key]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      key: row.key,
      enabled: row.enabled,
      description: row.description,
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error(`Error updating feature flag ${key}:`, error);
    throw error;
  }
}
