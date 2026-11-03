import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogOut, User, Wallet } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="glass-panel border-x-0 border-t-0 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 text-indigo-400 hover:text-indigo-300 transition-colors">
              <Wallet className="w-8 h-8" />
              <span className="font-sans font-bold text-xl tracking-tight text-white">
                Smart<span className="text-indigo-400">Splitter</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              to="/profile"
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/40 border border-slate-700/30 hover:bg-slate-750/50 hover:border-slate-600/50 transition-all cursor-pointer"
              title="My Profile"
            >
              <User className="w-4 h-4 text-indigo-400" />
              <span className="text-slate-200 text-sm font-medium">{user?.username}</span>
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-all border border-rose-500/10 hover:border-rose-500/30"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
