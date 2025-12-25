import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getFeatureFlags, updateFeatureFlag } from '../../services/api';

interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  updatedAt: string;
}

const FeatureFlagManager: React.FC = () => {
  const { user } = useAuth();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFlags = async () => {
    if (!user?.isAdmin) return;
    setLoading(true);
    try {
      const data = await getFeatureFlags(user.id);
      setFlags(data);
      setError(null);
    } catch (err: any) {
      console.error('Error loading flags:', err);
      setError(err.message || 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, [user]);

  const handleToggle = async (key: string, currentStatus: boolean) => {
    if (!user?.id) return;
    try {
      await updateFeatureFlag(user.id, key, !currentStatus);
      // Optimistic update
      setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !currentStatus } : f));
    } catch (err: any) {
      alert('Failed to update flag: ' + err.message);
      // Revert on error by reloading
      loadFlags();
    }
  };

  if (loading) return <div className="text-white text-center py-10">Loading feature flags...</div>;

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <span className="bg-yellow-500 w-2 h-8 mr-3 rounded-full"></span>
        Feature Flags
      </h2>

      {error && (
        <div className="bg-red-900/50 border-l-4 border-red-500 text-white p-4 mb-6 rounded-r">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-700/50 text-gray-300 border-b border-gray-600">
              <th className="p-4 font-semibold">Key</th>
              <th className="p-4 font-semibold">Description</th>
              <th className="p-4 font-semibold text-center">Status</th>
              <th className="p-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {flags.map((flag) => (
              <tr key={flag.key} className="hover:bg-gray-700/30 transition-colors">
                <td className="p-4 text-yellow-400 font-mono text-sm">{flag.key}</td>
                <td className="p-4 text-gray-300">{flag.description}</td>
                <td className="p-4 text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${flag.enabled
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                    {flag.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => handleToggle(flag.key, flag.enabled)}
                    className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${flag.enabled
                        ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
                        : 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'
                      }`}
                  >
                    {flag.enabled ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
            {flags.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500 italic">
                  No feature flags found. run migrations to seed defaults.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeatureFlagManager;
