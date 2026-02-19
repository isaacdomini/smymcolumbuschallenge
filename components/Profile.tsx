import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { updateUserProfile, deleteUser } from '../services/api';
import Modal from './ui/Modal';

const Profile: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { user, updateUser, logout } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [confirmText, setConfirmText] = useState('');

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        if (!user) return;

        try {
            const updatedUser = await updateUserProfile(user.id, { name });
            await updateUser(updatedUser);
            setSuccess('Profile updated successfully!');
        } catch (err) {
            setError('Failed to update profile. Please try again.');
            console.error(err);
        }
    };

    const handleDelete = async () => {
        if (!user || confirmText !== `delete ${user.email}`) {
            setError('Confirmation text does not match.');
            return;
        }
        setError(null);
        try {
            await deleteUser(user.id);
            logout();
            onBack();
        } catch (err) {
            setError('Failed to delete account. Please try again.');
            console.error(err);
        }
    };

    if (!user) {
        return (
            <div className="text-center p-10">
                <p>You must be logged in to view your profile.</p>
                <button onClick={onBack} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-6">
            <button onClick={onBack} className="text-gray-400 hover:text-yellow-400 mb-4">&larr; Back</button>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h1 className="text-2xl font-bold text-yellow-400 mb-6">Your Profile</h1>

                {error && <p className="text-red-400 mb-4">{error}</p>}
                {success && <p className="text-green-400 mb-4">{success}</p>}

                <form onSubmit={handleUpdate}>
                    <div className="mb-4">
                        <label htmlFor="name" className="block text-gray-300 mb-2">Name</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="email" className="block text-gray-300 mb-2">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={user.email}
                            disabled
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400 cursor-not-allowed"
                        />
                    </div>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
                        Update Profile
                    </button>
                </form>

                <div className="mt-10 pt-6 border-t border-gray-700">
                    <h2 className="text-xl font-bold text-red-500 mb-4">Delete Account</h2>
                    <p className="text-gray-400 mb-4">
                        This action is irreversible. All your data, including game history and scores, will be permanently deleted.
                    </p>
                    <button onClick={() => setIsDeleting(true)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">
                        Request Account Deletion
                    </button>
                </div>
            </div>

            {isDeleting && (
                <Modal onClose={() => setIsDeleting(false)} title="Confirm Account Deletion">
                    <div className="p-4">
                        <p className="text-gray-300 mb-4">
                            To confirm, please type the following text exactly as it appears:
                        </p>
                        <p className="bg-gray-900 text-yellow-400 rounded-md p-2 my-2 text-center font-mono">
                            delete {user.email}
                        </p>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            placeholder="delete your@email.com"
                        />
                        <div className="mt-6 flex justify-end space-x-4">
                            <button onClick={() => setIsDeleting(false)} className="text-gray-400 hover:text-white">
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={confirmText !== `delete ${user.email}`}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                Permanently Delete
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Profile;
