import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getAdminStats } from '../../services/api';
import { AdminStats } from '../../types';
import GameBuilder from './GameBuilder';

const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<AdminStats | null>(null);

    useEffect(() => {
        if (user?.id && user.isAdmin) {
            getAdminStats(user.id).then(setStats).catch(console.error);
        }
    }, [user]);

    if (!user?.isAdmin) {
        return <div className="text-center p-10 text-red-500">Access Denied</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <h1 className="text-3xl font-bold text-white mb-8 border-b border-gray-700 pb-4">Admin Dashboard</h1>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard title="Total Users" value={stats?.totalUsers ?? '-'} />
                <StatCard title="Plays Today" value={stats?.playsToday ?? '-'} />
                <StatCard title="Total Plays" value={stats?.totalPlays ?? '-'} />
                <StatCard title="Upcoming Games" value={stats?.upcomingGames ?? '-'} color="text-blue-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <GameBuilder />
                </div>
                <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700 h-fit">
                    <h3 className="text-xl font-bold text-gray-300 mb-4">Quick Actions</h3>
                    <ul className="space-y-2 text-gray-400">
                        <li>• Manage Challenges (Coming Soon)</li>
                        <li>• Manage Users (Coming Soon)</li>
                        <li>• View Full Logs (Coming Soon)</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: string | number; color?: string }> = ({ title, value, color = 'text-yellow-400' }) => (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
        <h4 className="text-gray-400 text-sm uppercase font-semibold mb-1">{title}</h4>
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
);

export default AdminDashboard;