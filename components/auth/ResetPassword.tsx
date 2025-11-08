import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

const ResetPassword: React.FC = () => {
    const { resetPassword } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tokenParam = params.get('token');
        if (tokenParam) {
            setToken(tokenParam);
        } else {
            setError('Invalid password reset link.');
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (!token) {
            setError('Missing reset token.');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsLoading(true);
        try {
            const response = await resetPassword(token, password);
            setMessage(response.message);
        } catch (err: any) {
            setError(err.message || 'Failed to reset password.');
        } finally {
            setIsLoading(false);
        }
    };

    if (message) {
        return (
            <div className="w-full max-w-md mx-auto mt-10 p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 text-center">
                 <div className="text-green-400 mb-6 bg-green-900/30 p-4 rounded-lg border border-green-800">
                    {message}
                </div>
                <a href="/" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                    Go to Login
                </a>
            </div>
        )
    }

    return (
        <div className="w-full max-w-md mx-auto mt-10 p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
            <h2 className="text-2xl font-bold text-yellow-400 mb-6 text-center">Reset Your Password</h2>
            
            {error && (
                <div className="mb-4 p-4 bg-red-950/50 border border-red-900/50 rounded-lg text-red-400 text-sm animate-shake break-words">
                    {error}
                </div>
            )}

            {!token ? (
                 <p className="text-gray-400 text-center">Please use the link from your email to reset your password.</p>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-300 block ml-1">New Password</label>
                        <input
                            type="password"
                            placeholder="Min 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-300 block ml-1">Confirm New Password</label>
                        <input
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-3.5 px-4 rounded-lg transition-all transform active:scale-[0.98] disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/10 mt-6"
                    >
                        {isLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
            )}
        </div>
    );
};

export default ResetPassword;