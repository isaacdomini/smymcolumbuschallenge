import { Preferences } from '@capacitor/preferences';

const KEY_PREFIX = 'smym-';

export const storage = {
  get: async (key: string): Promise<string | null> => {
    const fullKey = `${KEY_PREFIX}${key}`;
    try {
      const { value } = await Preferences.get({ key: fullKey });
      if (value !== null) {
        return value;
      }
    } catch (error) {
      console.warn('Preferences.get failed, checking localStorage', error);
    }

    // Fallback to localStorage and sync if found
    const localValue = localStorage.getItem(fullKey);
    if (localValue !== null) {
      try {
        // Sync back to Preferences for next time
        await Preferences.set({ key: fullKey, value: localValue });
      } catch (e) {
        console.warn('Failed to sync localStorage value to Preferences', e);
      }
    }
    return localValue;
  },

  set: async (key: string, value: string): Promise<void> => {
    const fullKey = `${KEY_PREFIX}${key}`;
    try {
      await Preferences.set({ key: fullKey, value });
    } catch (error) {
      console.warn('Preferences.set failed', error);
    }
    // Always save to localStorage as backup/sync
    localStorage.setItem(fullKey, value);
  },

  remove: async (key: string): Promise<void> => {
    const fullKey = `${KEY_PREFIX}${key}`;
    try {
      await Preferences.remove({ key: fullKey });
    } catch (error) {
      console.warn('Preferences.remove failed', error);
    }
    // Always remove from localStorage as well
    localStorage.removeItem(fullKey);
  },

  // Helper to migrate from localStorage if needed (optional, but good practice)
  migrateFromLocalStorage: async (key: string): Promise<void> => {
    const localValue = localStorage.getItem(`${KEY_PREFIX}${key}`);
    if (localValue) {
      try {
        await Preferences.set({ key: `${KEY_PREFIX}${key}`, value: localValue });
        // Optional: Clear localStorage after successful migration? 
        // For safety, maybe keep it for now or clear it. 
        // Let's keep it simple and just set it in Preferences.
      } catch (e) {
        // Ignore
      }
    }
  }
};
