import React, { useState, useEffect } from 'react';
import { Challenge } from '../../types';
import { getChallenges, createChallenge, updateChallenge, deleteChallenge } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const ChallengeManager: React.FC = () => {
    const { user } = useAuth();
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [isEditing, setIsEditing] = useState(false);

    // Form State
    const [formId, setFormId] = useState('');
    const [formName, setFormName] = useState('');
    const [formStartDate, setFormStartDate] = useState('');
    const [formEndDate, setFormEndDate] = useState('');

    const fetchChallenges = () => {
        if (user?.id) {
            getChallenges(user.id).then(setChallenges).catch(err => console.error("Failed to load challenges", err));
        }
    };

    useEffect(() => {
        fetchChallenges();
    }, [user]);

    const resetForm = () => {
        setFormId('');
        setFormName('');
        setFormStartDate('');
        setFormEndDate('');
        setIsEditing(false);
        setMessage({ text: '', type: '' });
    };

    const handleEdit = (challenge: Challenge) => {
        setFormId(challenge.id);
        setFormName(challenge.name);
        setFormStartDate(new Date(challenge.startDate).toISOString().split('T')[0]);
        setFormEndDate(new Date(challenge.endDate).toISOString().split('T')[0]);
        setIsEditing(true);
        setMessage({ text: '', type: '' });
        // Scroll to top of form
        document.getElementById('challenge-form')?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (!user?.id || !window.confirm("Are you sure? You can't delete a challenge if it has games associated with it.")) return;
        
        setIsLoading(true);
        try {
            await deleteChallenge(user.id, id);
            setMessage({ text: 'Challenge deleted successfully', type: 'success' });
            fetchChallenges();
        } catch (error: any) {
            setMessage({ text: error.message || 'Failed to delete challenge', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id) return;
        setIsLoading(true);
        setMessage({ text: '', type: '' });

        try {
            // Ensure dates are full ISO strings for consistency with DB expectation if needed, 
            // though standard 'YYYY-MM-DD' usually works fine with Postgres TIMESTAMP.
            // Let's append T00:00:00Z and T23:59:59Z for start/end to be precise.
            const startISO = new Date(formStartDate).toISOString(); 
            // For end date, we want the end of that day
            const endDateObj = new Date(formEndDate);
            endDateObj.setUTCHours(23, 59, 59, 999);
            const endISO = endDateObj.toISOString();

            const challengeData = {
                name: formName,
                startDate: startISO,
                endDate: endISO
            };

            if (isEditing) {
                await updateChallenge(user.id, formId, challengeData);
                setMessage({ text: 'Challenge updated successfully', type: 'success' });
            } else {
                // Auto-generate ID if creating new
                const id = formId || `challenge-${formName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().getFullYear()}`;
                await createChallenge(user.id, { ...challengeData, id });
                setMessage({ text: 'Challenge created successfully', type: 'success' });
            }
            resetForm();
            fetchChallenges();
        } catch (error: any) {
             setMessage({ text: error.message || 'Operation failed', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700" id="challenge-form">
            <h2 className="text-2xl font-bold text-yellow-400 mb-6">Manage Challenges</h2>

            {message.text && (
                <div className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="mb-8 space-y-4 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-gray-300 mb-4">{isEditing ? 'Edit Challenge' : 'Create New Challenge'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {!isEditing && (
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Challenge ID (Optional - Auto-generated if blank)</label>
                            <input
                                type="text"
                                value={formId}
                                onChange={e => setFormId(e.target.value)}
                                placeholder="e.g., lent-2025"
                                className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
                            />
                        </div>
                    )}
                    <div className="md:col-span-2">
                         <label className="block text-sm font-medium text-gray-400 mb-1">Challenge Name</label>
                         <input
                            type="text"
                            value={formName}
                            onChange={e => setFormName(e.target.value)}
                            required
                            placeholder="e.g., November 2025 Challenge"
                            className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={formStartDate}
                            onChange={e => setFormStartDate(e.target.value)}
                            required
                            className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">End Date</label>
                        <input
                            type="date"
                            value={formEndDate}
                            onChange={e => setFormEndDate(e.target.value)}
                            required
                            className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
                        />
                    </div>
                </div>
                <div className="flex space-x-3">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-gray-600"
                    >
                        {isLoading ? 'Saving...' : (isEditing ? 'Update Challenge' : 'Create Challenge')}
                    </button>
                    {isEditing && (
                        <button
                            type="button"
                            onClick={resetForm}
                            className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded transition-colors"
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>
            </form>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-gray-300">
                    <thead className="text-xs uppercase bg-gray-700/50 text-gray-400">
                        <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Start Date</th>
                            <th className="px-4 py-3">End Date</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {challenges.map(challenge => (
                            <tr key={challenge.id} className="hover:bg-gray-700/30">
                                <td className="px-4 py-3 font-medium text-white">{challenge.name}</td>
                                <td className="px-4 py-3">{new Date(challenge.startDate).toLocaleDateString()}</td>
                                <td className="px-4 py-3">{new Date(challenge.endDate).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-right space-x-2">
                                    <button 
                                        onClick={() => handleEdit(challenge)}
                                        className="text-blue-400 hover:text-blue-300 text-sm"
                                    >
                                        Edit
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(challenge.id)}
                                        className="text-red-400 hover:text-red-300 text-sm"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {challenges.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                    No challenges found. Create one above.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ChallengeManager;