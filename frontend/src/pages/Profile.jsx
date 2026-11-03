import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { getMe, updateMe, changePassword } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { User, Mail, ShieldAlert, KeyRound, Calendar, Users, FolderPlus, Save, Lock, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

export default function Profile() {
  const { user: authUser, updateUser } = useContext(AuthContext);
  
  // Profile state
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    full_name: ''
  });
  const [statistics, setStatistics] = useState({
    date_joined: '',
    total_groups_joined: 0,
    groups_created_count: 0
  });

  // Password state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  
  // Status messages
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileFieldErrors, setProfileFieldErrors] = useState({});
  
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordFieldErrors, setPasswordFieldErrors] = useState({});

  const fetchProfileDetails = async () => {
    try {
      const response = await getMe();
      const data = response.data;
      setProfileForm({
        username: data.username || '',
        email: data.email || '',
        full_name: data.full_name || ''
      });
      setStatistics({
        date_joined: data.date_joined || '',
        total_groups_joined: data.total_groups_joined || 0,
        groups_created_count: data.groups_created_count || 0
      });
    } catch (err) {
      setProfileError('Failed to fetch profile details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileDetails();
  }, []);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');
    setProfileFieldErrors({});
    setUpdatingProfile(true);

    try {
      const response = await updateMe(profileForm);
      updateUser(response.data);
      setProfileSuccess('Profile details updated successfully!');
      setProfileForm({
        username: response.data.username || '',
        email: response.data.email || '',
        full_name: response.data.full_name || ''
      });
    } catch (err) {
      if (err.response && err.response.data) {
        setProfileFieldErrors(err.response.data);
        setProfileError(err.response.data.detail || 'Please fix the errors below.');
      } else {
        setProfileError('An unexpected error occurred while updating profile.');
      }
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');
    setPasswordFieldErrors({});
    setUpdatingPassword(true);

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordFieldErrors({ confirm_password: ['New passwords do not match.'] });
      setUpdatingPassword(false);
      return;
    }

    try {
      await changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        confirm_password: passwordForm.confirm_password
      });
      setPasswordSuccess('Password changed successfully!');
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (err) {
      if (err.response && err.response.data) {
        setPasswordFieldErrors(err.response.data);
        setPasswordError(err.response.data.detail || 'Please check your inputs.');
      } else {
        setPasswordError('An unexpected error occurred while changing password.');
      }
    } finally {
      setUpdatingPassword(false);
    }
  };

  const formatJoinedDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
      <div className="border-b border-slate-800/20 pb-4">
        <Link to="/" className="text-indigo-400 hover:text-indigo-300 font-semibold mb-2 inline-flex items-center space-x-1 text-sm transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="text-4xl font-extrabold tracking-tight font-sans text-white mt-2">
          My Profile
        </h1>
        <p className="text-slate-400 mt-1">
          Manage your personal details, account security, and track your participation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-white font-sans flex items-center space-x-2.5 mb-6">
              <User className="w-5 h-5 text-indigo-400" />
              <span>Profile Details</span>
            </h2>

            {profileSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start space-x-2.5">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && !Object.keys(profileFieldErrors).length && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start space-x-2.5">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label htmlFor="username" className="block text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="username"
                      type="text"
                      className="glass-input w-full pl-12 pr-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2"
                      value={profileForm.username}
                      onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                      required
                    />
                  </div>
                  {profileFieldErrors.username && (
                    <p className="text-rose-400 text-xs mt-1">{profileFieldErrors.username[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="full_name" className="block text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="full_name"
                      type="text"
                      placeholder="e.g. John Doe"
                      className="glass-input w-full pl-12 pr-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2"
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    />
                  </div>
                  {profileFieldErrors.full_name && (
                    <p className="text-rose-400 text-xs mt-1">{profileFieldErrors.full_name[0]}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="block text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="email"
                    type="email"
                    className="glass-input w-full pl-12 pr-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    required
                  />
                </div>
                {profileFieldErrors.email && (
                  <p className="text-rose-400 text-xs mt-1">{profileFieldErrors.email[0]}</p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={updatingProfile}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 disabled:opacity-75 text-white text-sm font-semibold rounded-xl transition-all flex items-center space-x-2 shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{updatingProfile ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel rounded-2xl p-5 flex items-center space-x-4 border-slate-700/20 bg-slate-800/10">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/15">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-slate-400 text-2xs uppercase tracking-wider font-semibold">Date Joined</p>
                <p className="text-slate-200 text-sm font-bold mt-0.5">{formatJoinedDate(statistics.date_joined)}</p>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5 flex items-center space-x-4 border-slate-700/20 bg-slate-800/10">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/15">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-slate-400 text-2xs uppercase tracking-wider font-semibold">Groups Joined</p>
                <p className="text-slate-200 text-base font-bold mt-0.5">{statistics.total_groups_joined}</p>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5 flex items-center space-x-4 border-slate-700/20 bg-slate-800/10">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/15">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <p className="text-slate-400 text-2xs uppercase tracking-wider font-semibold">Groups Created</p>
                <p className="text-slate-200 text-base font-bold mt-0.5">{statistics.groups_created_count}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white font-sans flex items-center space-x-2.5 mb-6">
              <KeyRound className="w-5 h-5 text-rose-400" />
              <span>Change Password</span>
            </h2>

            {passwordSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start space-x-2.5">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && !Object.keys(passwordFieldErrors).length && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start space-x-2.5">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="current_password" className="block text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="current_password"
                    type="password"
                    className="glass-input w-full pl-12 pr-3 py-2 rounded-xl text-sm font-medium focus:ring-2"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    required
                  />
                </div>
                {passwordFieldErrors.current_password && (
                  <p className="text-rose-400 text-xs mt-1">{passwordFieldErrors.current_password[0]}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="new_password" className="block text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="new_password"
                    type="password"
                    className="glass-input w-full pl-12 pr-3 py-2 rounded-xl text-sm font-medium focus:ring-2"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    required
                  />
                </div>
                {passwordFieldErrors.new_password && (
                  <p className="text-rose-400 text-xs mt-1">{passwordFieldErrors.new_password[0]}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirm_password" className="block text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="confirm_password"
                    type="password"
                    className="glass-input w-full pl-12 pr-3 py-2 rounded-xl text-sm font-medium focus:ring-2"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    required
                  />
                </div>
                {passwordFieldErrors.confirm_password && (
                  <p className="text-rose-400 text-xs mt-1">{passwordFieldErrors.confirm_password[0]}</p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-700 disabled:opacity-75 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg shadow-rose-600/10 hover:shadow-rose-500/20 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{updatingPassword ? 'Changing...' : 'Change Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
