import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { getUsers, updateUserAsAdmin } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const UserManager: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(0);
    const limit = 20;

    const fetchUsers = () => {
        if (currentUser?.id) {
            setIsLoading(true);
            getUsers(currentUser.id, limit, page * limit)
                .then(setUsers)
                .catch(err => console.error("Failed to load users", err))
                .finally(() => setIsLoading(false));
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [currentUser, page]);

    const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
        if (!currentUser?.id || userId === currentUser.id) return; // Prevent self-demotion
        if (!window.confirm(`Are you sure you want to ${currentStatus ? 'remove' : 'grant'} admin rights for this user?`)) return;

        try {
            await updateUserAsAdmin(currentUser.id, userId, { isAdmin: !currentStatus });
            fetchUsers();
        } catch (error) {
            alert("Failed to update user");
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-yellow-400">Manage Users</h2>
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
                        disabled={users.length < limit || isLoading}
                        className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-gray-300">
                    <thead className="text-xs uppercase bg-gray-700/50 text-gray-400">
                        <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Joined</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-gray-700/30">
                                <td className="px-4 py-3 font-medium text-white">{user.name}</td>
                                <td className="px-4 py-3">{user.email}</td>
                                <td className="px-4 py-3 text-sm">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
                                <td className="px-4 py-3">
                                    {user.isAdmin ? (
                                        <span className="px-2 py-1 text-xs font-semibold text-yellow-900 bg-yellow-400 rounded-full">Admin</span>
                                    ) : (
                                        <span className="px-2 py-1 text-xs font-semibold text-gray-900 bg-gray-400 rounded-full">User</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {user.id !== currentUser?.id && (
                                        <button 
                                            onClick={() => handleToggleAdmin(user.id, user.isAdmin || false)}
                                            className={`text-sm ${user.isAdmin ? 'text-red-400 hover:text-red-300' : 'text-blue-400 hover:text-blue-300'}`}
                                        >
                                            {user.isAdmin ? 'Demote' : 'Promote'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                         {isLoading && (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading users...</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UserManager;