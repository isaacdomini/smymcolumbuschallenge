import React, { useState, useEffect } from 'react';
import { LogEntry } from '../../types';
import { getLogs } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const LogViewer: React.FC = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(0);
    const limit = 50;

    useEffect(() => {
        if (user?.id) {
            setIsLoading(true);
            getLogs(user.id, limit, page * limit)
                .then(setLogs)
                .catch(err => console.error("Failed to load logs", err))
                .finally(() => setIsLoading(false));
        }
    }, [user, page]);

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-yellow-400">System Logs</h2>
                <div className="space-x-2">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0 || isLoading}
                        className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50"
                    >
                        Prev
                    </button>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={logs.length < limit || isLoading}
                        className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto font-mono text-sm">
                <table className="w-full text-left text-gray-300">
                    <thead className="text-xs uppercase bg-gray-700/50 text-gray-400">
                        <tr>
                            <th className="px-4 py-2">Time</th>
                            <th className="px-4 py-2">Method</th>
                            <th className="px-4 py-2">Path</th>
                            <th className="px-4 py-2">IP</th>
                            <th className="px-4 py-2">User ID</th>
                            <th className="px-4 py-2">User Agent</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {logs.map(log => (
                            <tr key={log.id} className="hover:bg-gray-700/30">
                                <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                                    {new Date(log.created_at).toLocaleString()}
                                </td>
                                <td className="px-4 py-2 font-bold">
                                    <span className={log.method === 'POST' ? 'text-green-400' : log.method === 'DELETE' ? 'text-red-400' : log.method === 'PUT' ? 'text-yellow-400' : 'text-blue-400'}>
                                        {log.method}
                                    </span>
                                </td>
                                <td className="px-4 py-2 truncate max-w-xs" title={log.path}>{log.path}</td>
                                <td className="px-4 py-2 text-gray-500">{log.ip_address}</td>
                                <td className="px-4 py-2 text-gray-500 truncate max-w-[120px]" title={log.user_id || 'N/A'}>
                                    {log.user_id || 'N/A'}
                                </td>
                                <td className="px-4 py-2 text-gray-500 truncate max-w-xs" title={log.user_agent || 'N/A'}>
                                    {log.user_agent || 'N/A'}
                                </td>
                            </tr>
                        ))}
                        {isLoading && (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading logs...</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LogViewer;