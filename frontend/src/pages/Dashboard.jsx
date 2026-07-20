import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { getGroups, createGroup, getInvitations, acceptInvitation, declineInvitation } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import { Users, Layers, PlusCircle, AlertCircle, Calendar, ArrowRight, FolderPlus, Bell, Check, X } from 'lucide-react';

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [groups, setGroups] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Create Group Form State
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchGroups = async () => {
    try {
      const response = await getGroups();
      setGroups(response.data);
    } catch (err) {
      setError('Failed to fetch groups. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const response = await getInvitations();
      setInvitations(response.data);
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    }
  };

  const handleAcceptInvite = async (id) => {
    try {
      await acceptInvitation(id);
      fetchInvitations();
      fetchGroups();
    } catch (err) {
      setError('Failed to accept invitation.');
    }
  };

  const handleDeclineInvite = async (id) => {
    try {
      await declineInvitation(id);
      fetchInvitations();
    } catch (err) {
      setError('Failed to decline invitation.');
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchInvitations();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);

    if (groupName.trim().length < 3) {
      setCreateError('Group name must be at least 3 characters long.');
      setCreating(false);
      return;
    }

    try {
      await createGroup({ name: groupName, description: groupDesc });
      setGroupName('');
      setGroupDesc('');
      setIsCreateModalOpen(false);
      fetchGroups();
    } catch (err) {
      setCreateError(err.response?.data?.name?.[0] || 'Error creating group.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 border-b border-slate-800/20 pb-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight font-sans text-white">
            Dashboard
          </h1>
          <p className="text-slate-400 mt-1">
            Welcome back, <span className="text-indigo-400 font-semibold">{user?.username}</span>! Here are your active groups.
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 cursor-pointer"
        >
          <PlusCircle className="w-4.5 h-4.5" />
          <span>New Group</span>
        </button>
      </div>

      {/* Pending Invitations Panel */}
      {invitations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white font-sans flex items-center space-x-2">
            <Bell className="w-5 h-5 text-indigo-400 animate-bounce" />
            <span>Pending Group Invitations ({invitations.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invitations.map((invite) => (
              <div key={invite.id} className="glass-panel rounded-2xl p-5 flex justify-between items-center border-indigo-500/20 bg-indigo-500/5">
                <div>
                  <h4 className="font-bold text-slate-200 text-sm">{invite.group_name}</h4>
                  <p className="text-xs text-slate-400 mt-1">Invited by: <strong>{invite.invited_by_username}</strong></p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleAcceptInvite(invite.id)}
                    className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
                    title="Accept"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeclineInvite(invite.id)}
                    className="p-2 bg-rose-600 hover:bg-rose-500/80 text-white rounded-lg transition-colors cursor-pointer"
                    title="Decline"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start space-x-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Groups Joined"
          value={groups.length}
          icon={Users}
          description="Groups you split costs with"
          trend={`${groups.filter(g => g.created_by.id === user.id).length} Created`}
          trendColor="text-indigo-400"
        />
        <StatCard
          title="Recent Activity"
          value={groups.length > 0 ? "Active" : "None"}
          icon={Layers}
          description="Tracking split entries"
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white font-sans mb-4">Your Expense Groups</h2>
        
        {groups.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-300">No Groups Found</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
              You are not part of any expense splitting groups yet. Click the 'New Group' button above to start!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <div key={group.id} className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col justify-between h-48">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg font-sans text-white hover:text-indigo-400 transition-colors line-clamp-1">
                      <Link to={`/groups/${group.id}`}>{group.name}</Link>
                    </h3>
                    {group.created_by.id === user.id ? (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        Creator
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/30">
                        Member
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs mt-2 line-clamp-2">{group.description || 'No description provided.'}</p>
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800/40 text-slate-500 text-[11px]">
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(group.created_at).toLocaleDateString()}</span>
                  </div>
                  <Link
                    to={`/groups/${group.id}`}
                    className="flex items-center space-x-1 font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <span>Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Popup Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800/40 pb-3">
              <div className="flex items-center space-x-2.5">
                <FolderPlus className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white font-sans">Create New Group</h3>
              </div>
              <button 
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setGroupName('');
                  setGroupDesc('');
                  setCreateError('');
                }}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label htmlFor="groupName" className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                  Group Name
                </label>
                <input
                  id="groupName"
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm font-sans"
                  placeholder="e.g. Goa Trip 2026"
                />
              </div>

              <div>
                <label htmlFor="groupDesc" className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  id="groupDesc"
                  rows={3}
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm font-sans"
                  placeholder="Optional description"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setGroupName('');
                    setGroupDesc('');
                    setCreateError('');
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer animate-all"
                >
                  {creating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span>Create Group</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
