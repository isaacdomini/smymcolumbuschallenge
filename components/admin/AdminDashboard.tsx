import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getAdminStats } from '../../services/api';
import { AdminStats } from '../../types';
import GameBuilder from './GameBuilder';
import { ChallengeManager } from './ChallengeManager';
import UserManager from './UserManager';
import LogViewer from './LogViewer';
import DailyMessageManager from './DailyMessageManager';
import SupportManager from './SupportManager';
import BannerManager from './BannerManager';

type Tab = 'challenges' | 'games' | 'users' | 'logs' | 'messages' | 'support' | 'banners';

const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('challenges');

    useEffect(() => {
        if (user?.id && user.isAdmin) {
            getAdminStats(user.id).then(setStats).catch(console.error);
        }
    }, [user]);

    if (!user?.isAdmin) {
        return <div className="text-center p-10 text-red-500">Access Denied</div>;
    }

    const tabs: { id: Tab; label: string }[] = [
        { id: 'challenges', label: 'Challenges' },
        { id: 'games', label: 'Game Builder' },
        { id: 'messages', label: 'Daily Messages' },
        { id: 'banners', label: 'Banner Messages' },
        { id: 'users', label: 'Users' },
        { id: 'logs', label: 'Logs' },
        { id: 'support', label: 'Support' },
    ];

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

            {/* Navigation Tabs */}
            <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg mb-6 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-md font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-yellow-500 text-gray-900'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in">
                {activeTab === 'challenges' && <ChallengeManager user={user} />}
                {activeTab === 'games' && <GameBuilder />}
                {activeTab === 'messages' && <DailyMessageManager />}
                {activeTab === 'banners' && <BannerManager />}
                {activeTab === 'users' && <UserManager />}
                {activeTab === 'logs' && <LogViewer />}
                {activeTab === 'support' && <SupportManager />}
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