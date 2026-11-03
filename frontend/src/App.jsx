import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupDetails from './pages/GroupDetails';
import SplitExpense from './pages/SplitExpense';
import BalancesDashboard from './pages/BalancesDashboard';
import MemberHistory from './pages/MemberHistory';
import SettlementHistory from './pages/SettlementHistory';
import InvitePage from './pages/InvitePage';
import Profile from './pages/Profile';
import Navbar from './components/Navbar';

const ProtectedRoute = ({ children }) => {
  const { token, loading } = useContext(AuthContext);
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0b0f19]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium animate-pulse-slow">Loading Smart Splitter...</p>
        </div>
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen bg-transparent">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

const PublicOrProtectedLayout = ({ children }) => {
  const { token, loading } = useContext(AuthContext);
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0b0f19]">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-transparent">
      {token && <Navbar />}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/invitations/:id" element={<PublicOrProtectedLayout><InvitePage /></PublicOrProtectedLayout>} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetails /></ProtectedRoute>} />
      <Route path="/groups/:groupId/expenses/:expenseId/split" element={<ProtectedRoute><SplitExpense /></ProtectedRoute>} />
      <Route path="/groups/:groupId/balances" element={<ProtectedRoute><BalancesDashboard /></ProtectedRoute>} />
      <Route path="/groups/:groupId/settlements" element={<ProtectedRoute><SettlementHistory /></ProtectedRoute>} />
      <Route path="/groups/:groupId/members/:memberId/ledger" element={<ProtectedRoute><MemberHistory /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
