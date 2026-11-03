import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getInvitationDetail, acceptInvitation, declineInvitation } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { Users, Mail, CheckCircle2, AlertCircle, ArrowRight, UserPlus, LogIn, X, RefreshCw, Sparkles } from 'lucide-react';

export default function InvitePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchInvitation = async () => {
    try {
      const res = await getInvitationDetail(id);
      setInvitation(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invitation not found or expired.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitation();
  }, [id, token]);

  const handleAccept = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await acceptInvitation(id);
      setSuccessMsg(res.data.detail || 'Joined group successfully!');
      setTimeout(() => {
        navigate(`/groups/${res.data.group_id}`);
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to accept invitation.');
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setSubmitting(true);
    setError('');
    try {
      await declineInvitation(id);
      setSuccessMsg('Invitation declined.');
      setTimeout(() => {
        navigate('/');
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to decline invitation.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm animate-pulse">Loading invitation details...</p>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 glass-panel rounded-3xl text-center space-y-4">
        <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-white">Invalid or Expired Invite</h2>
        <p className="text-slate-400 text-sm">{error || 'This invitation link is invalid or no longer available.'}</p>
        <Link
          to="/"
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20"
        >
          <span>Go to Home</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const isAlreadyMember = invitation.is_already_member || invitation.status === 'accepted';

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg glass-panel rounded-3xl p-8 sm:p-10 border border-slate-700/60 shadow-2xl relative overflow-hidden animate-fade-in">
        {/* Glow Ambient Effect */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Header Icon */}
        <div className="flex flex-col items-center text-center space-y-3 mb-8">
          <div className="p-4 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl text-white shadow-xl shadow-indigo-500/20 relative">
            <Sparkles className="w-8 h-8" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
            Group Invitation
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight font-sans">
            {invitation.group_name}
          </h1>
          {invitation.group_description && (
            <p className="text-slate-300 text-sm max-w-md">
              {invitation.group_description}
            </p>
          )}
        </div>

        {/* Details Card */}
        <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800/80 space-y-3 mb-8 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Invited By</span>
            <span className="text-slate-200 font-semibold flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-400" />
              {invitation.invited_by_username}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800/60 pt-2.5">
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Group Size</span>
            <span className="text-slate-200 font-semibold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              {invitation.member_count} {invitation.member_count === 1 ? 'member' : 'members'}
            </span>
          </div>

          {invitation.email && (
            <div className="flex items-center justify-between border-t border-slate-800/60 pt-2.5">
              <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Target Email</span>
              <span className="text-indigo-300 font-mono text-xs truncate max-w-[200px]">
                {invitation.email}
              </span>
            </div>
          )}
        </div>

        {/* Success Feedback Alert */}
        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Action Controls */}
        {isAlreadyMember ? (
          <div className="space-y-4 text-center">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center justify-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>You are already a member of this expense group!</span>
            </div>
            <Link
              to={`/groups/${invitation.group_id}`}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20"
            >
              <span>Go to Expense Group</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : token ? (
          /* Authenticated User: Accept or Decline */
          <div className="space-y-3">
            <button
              onClick={handleAccept}
              disabled={submitting}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-xl shadow-indigo-600/25 flex items-center justify-center space-x-2 cursor-pointer"
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Accept Invitation & Join Group</span>
                </>
              )}
            </button>

            <button
              onClick={handleDecline}
              disabled={submitting}
              className="w-full py-3 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Decline</span>
            </button>
          </div>
        ) : (
          /* Unauthenticated User: Create Account or Login */
          <div className="space-y-3">
            <p className="text-slate-400 text-xs text-center mb-1">
              Sign up or log in to accept this invitation and view group expenses.
            </p>

            <Link
              to={`/register?redirect=/invitations/${id}&email=${encodeURIComponent(invitation.email || '')}`}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-bold transition-all shadow-xl shadow-indigo-600/25 flex items-center justify-center space-x-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Account to Join</span>
            </Link>

            <Link
              to={`/login?redirect=/invitations/${id}`}
              className="w-full py-3 px-4 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2"
            >
              <LogIn className="w-3.5 h-3.5 text-indigo-400" />
              <span>Already have an account? Log In</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
