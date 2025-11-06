
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import AuthModal from './auth/AuthModal';
import { ICONS } from '../constants';

interface HeaderProps {
    challengeName?: string;
}

const Header: React.FC<HeaderProps> = ({ challengeName }) => {
    const { user, logout } = useAuth();
    const [isAuthModalOpen, setAuthModalOpen] = useState(false);

    return (
        <>
            <header className="bg-gray-800 shadow-md">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        {ICONS.smymLogo}
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-yellow-400">SMYM Bible Games</h1>
                            {challengeName && <p className="text-xs text-gray-400 hidden sm:block">{challengeName}</p>}
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        {user ? (
                            <>
                                <div className="flex items-center space-x-2">
                                    <span className="hidden sm:inline text-gray-300">{user.name}</span>
                                    <div className="p-2 bg-gray-700 rounded-full">{ICONS.user}</div>
                                </div>
                                <button onClick={logout} className="p-2 text-gray-400 hover:text-white" title="Logout">
                                    {ICONS.logout}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setAuthModalOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                                Login / Sign Up
                            </button>
                        )}
                    </div>
                </div>
            </header>
            {isAuthModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
        </>
    );
};

export default Header;
