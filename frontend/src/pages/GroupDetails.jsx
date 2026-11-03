import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getGroupDetail, deleteGroup, getMembers, deleteMember,
  getExpenses, deleteExpense, getGroupBudget, setGroupBudget, inviteMember, getGroupInvitations,
  updateGroup, addMember, updateMember, createExpense, updateExpense
} from '../services/api';
import { AuthContext } from '../context/AuthContext';
import {
  Users, DollarSign, Settings, Trash2, Edit3, Plus,
  ChevronRight, Calendar, AlertTriangle, ArrowLeft,
  ChevronDown, ChevronUp, Bell, DollarSign as MoneyIcon,
  X, RefreshCw, AlertCircle, Copy, Link2, Send, CheckCircle2
} from 'lucide-react';
import Dropdown from '../components/Dropdown';

export default function GroupDetails() {
  const { groupId } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  // Group Details state 
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Sub-data states
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [expandedExpenseId, setExpandedExpenseId] = useState(null);

  // Budget states
  const [budget, setBudget] = useState(null);
  const [isBudgetExceeded, setIsBudgetExceeded] = useState(false);
  const [newBudgetLimit, setNewBudgetLimit] = useState('');
  const [settingBudget, setSettingBudget] = useState(false);

  // Active view states
  const [isCreator, setIsCreator] = useState(false);
  const isOwner = isCreator;

  // Invitation states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [groupInvitations, setGroupInvitations] = useState([]);
  const [copiedInviteId, setCopiedInviteId] = useState(null);

  // Modals States
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false);

  // Member modal state (null = closed, {} = add, member = edit)
  const [memberModalData, setMemberModalData] = useState(null);
  const [deletingMember, setDeletingMember] = useState(null);
  const isEditingOwner = memberModalData && (memberModalData.user?.id === group?.created_by?.id || memberModalData.name === group?.created_by?.username);

  // Expense modal state (null = closed, {} = add, expense = edit)
  const [expenseModalData, setExpenseModalData] = useState(null);
  const [deletingExpense, setDeletingExpense] = useState(null);

  // Group Edit form state
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupSubmitting, setEditGroupSubmitting] = useState(false);
  const [editGroupError, setEditGroupError] = useState('');

  // Member form state
  const [memberFormName, setMemberFormName] = useState('');
  const [memberFormEmail, setMemberFormEmail] = useState('');
  const [memberFormPhone, setMemberFormPhone] = useState('');
  const [memberFormSubmitting, setMemberFormSubmitting] = useState(false);
  const [memberFormErrors, setMemberFormErrors] = useState({});
  const [memberFormError, setMemberFormError] = useState('');
  const [memberFormCanAddExpense, setMemberFormCanAddExpense] = useState(true);
  const [memberFormCanEditExpense, setMemberFormCanEditExpense] = useState(false);
  const [memberFormCanDeleteExpense, setMemberFormCanDeleteExpense] = useState(false);

  // Expense form state
  const [expenseFormTitle, setExpenseFormTitle] = useState('');
  const [expenseFormAmount, setExpenseFormAmount] = useState('');
  const [expenseFormDate, setExpenseFormDate] = useState('');
  const [expenseFormCategory, setExpenseFormCategory] = useState('');
  const [expenseFormDesc, setExpenseFormDesc] = useState('');
  const [expenseFormNotes, setExpenseFormNotes] = useState('');
  const [expenseFormSubmitting, setExpenseFormSubmitting] = useState(false);
  const [expenseFormErrors, setExpenseFormErrors] = useState({});
  const [expenseFormError, setExpenseFormError] = useState('');

  // Pre-fill Edit Group form when opening
  const openEditGroup = () => {
    if (group) {
      setEditGroupName(group.name);
      setEditGroupDesc(group.description || '');
      setEditGroupError('');
      setShowEditGroup(true);
    }
  };

  // Pre-fill Member Form when opening (Add or Edit)
  const openMemberModal = (member = null) => {
    setMemberFormError('');
    setMemberFormErrors({});
    if (member) {
      setMemberModalData(member);
      setMemberFormName(member.name);
      setMemberFormEmail(member.email || '');
      setMemberFormPhone(member.phone || '');
      setMemberFormCanAddExpense(member.can_add_expense !== undefined ? member.can_add_expense : true);
      setMemberFormCanEditExpense(member.can_edit_expense !== undefined ? member.can_edit_expense : false);
      setMemberFormCanDeleteExpense(member.can_delete_expense !== undefined ? member.can_delete_expense : false);
    } else {
      setMemberModalData({});
      setMemberFormName('');
      setMemberFormEmail('');
      setMemberFormPhone('');
      setMemberFormCanAddExpense(true);
      setMemberFormCanEditExpense(false);
      setMemberFormCanDeleteExpense(false);
    }
  };

  // Pre-fill Expense Form when opening (Add or Edit)
  const openExpenseModal = (expense = null) => {
    setExpenseFormError('');
    setExpenseFormErrors({});
    if (expense) {
      setExpenseModalData(expense);
      setExpenseFormTitle(expense.title);
      setExpenseFormAmount(expense.amount);
      setExpenseFormDate(expense.date);
      setExpenseFormCategory(expense.category);
      setExpenseFormDesc(expense.description || '');
      setExpenseFormNotes(expense.notes || '');
    } else {
      setExpenseModalData({});
      setExpenseFormTitle('');
      setExpenseFormAmount('');
      setExpenseFormDate(new Date().toISOString().split('T')[0]);
      setExpenseFormCategory('');
      setExpenseFormDesc('');
      setExpenseFormNotes('');
    }
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await inviteMember(groupId, { email: inviteEmail.trim() });
      setInviteSuccess(`Invitation email dispatched to ${inviteEmail.trim()}! You can also copy the link below.`);
      setInviteEmail('');
      const invRes = await getGroupInvitations(groupId);
      setGroupInvitations(invRes.data);
    } catch (err) {
      setInviteError(err.response?.data?.email?.[0] || err.response?.data?.detail || 'Failed to send invitation.');
    } finally {
      setInviting(false);
    }
  };

  const handleCopyLink = (invitationId) => {
    const inviteUrl = `${window.location.origin}/invitations/${invitationId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedInviteId(invitationId);
    setTimeout(() => setCopiedInviteId(null), 2000);
  };

  const loadAllData = async () => {
    try {
      const groupRes = await getGroupDetail(groupId);
      setGroup(groupRes.data);
      setIsCreator(groupRes.data.created_by.id === user?.id);

      const membersRes = await getMembers(groupId);
      setMembers(membersRes.data);

      const expensesRes = await getExpenses(groupId);
      setExpenses(expensesRes.data.expenses);
      setTotalSpent(Number(expensesRes.data.total_amount));

      const budgetRes = await getGroupBudget(groupId);
      setBudget(budgetRes.data.budget);
      setIsBudgetExceeded(budgetRes.data.is_exceeded);
      if (budgetRes.data.budget) {
        setNewBudgetLimit(budgetRes.data.budget.amount_limit);
      }

      try {
        const invRes = await getGroupInvitations(groupId);
        setGroupInvitations(invRes.data);
      } catch (err) {
        console.error('Failed to load group invitations:', err);
      }
    } catch (err) {
      setError('Failed to fetch group details.');
      setGroup(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setGroup(null);
    setLoading(true);
    setError('');
    loadAllData();
  }, [groupId]);

  const handleEditGroupSubmit = async (e) => {
    e.preventDefault();
    setEditGroupError('');
    setEditGroupSubmitting(true);

    if (editGroupName.trim().length < 3) {
      setEditGroupError('Group name must be at least 3 characters long.');
      setEditGroupSubmitting(false);
      return;
    }

    try {
      await updateGroup(groupId, { name: editGroupName.trim(), description: editGroupDesc.trim() });
      setShowEditGroup(false);
      loadAllData();
    } catch (err) {
      setEditGroupError(err.response?.data?.name?.[0] || err.response?.data?.detail || 'Failed to update group.');
    } finally {
      setEditGroupSubmitting(false);
    }
  };

  const handleMemberSubmit = async (e) => {
    e.preventDefault();
    setMemberFormError('');
    setMemberFormErrors({});
    setMemberFormSubmitting(true);

    if (memberFormName.trim().length < 2) {
      setMemberFormErrors({ name: ['Member name must be at least 2 characters long.'] });
      setMemberFormSubmitting(false);
      return;
    }

    const payload = {
      name: memberFormName.trim(),
      email: memberFormEmail.trim(),
      phone: memberFormPhone.trim(),
      can_add_expense: memberFormCanAddExpense,
      can_edit_expense: memberFormCanEditExpense,
      can_delete_expense: memberFormCanDeleteExpense
    };

    const isEdit = !!memberModalData.id;

    try {
      if (isEdit) {
        await updateMember(groupId, memberModalData.id, payload);
      } else {
        await addMember(groupId, payload);
      }
      setMemberModalData(null);
      loadAllData();
    } catch (err) {
      if (err.response && err.response.data) {
        if (err.response.data.name) {
          setMemberFormErrors({ name: err.response.data.name });
        } else {
          setMemberFormError(err.response.data.non_field_errors?.[0] || err.response.data.detail || 'A user with this email already exists');
        }
      } else {
        setMemberFormError('An unexpected error occurred.');
      }
    } finally {
      setMemberFormSubmitting(false);
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setExpenseFormError('');
    setExpenseFormErrors({});
    setExpenseFormSubmitting(true);

    if (Number(expenseFormAmount) <= 0) {
      setExpenseFormErrors({ amount: ['Expense amount must be greater than zero.'] });
      setExpenseFormSubmitting(false);
      return;
    }

    const payload = {
      title: expenseFormTitle.trim(),
      amount: Number(expenseFormAmount),
      date: expenseFormDate,
      category: expenseFormCategory.trim() || 'General',
      description: expenseFormDesc.trim() || null,
      notes: expenseFormNotes.trim() || null
    };

    const isEdit = !!expenseModalData.id;

    try {
      if (isEdit) {
        await updateExpense(groupId, expenseModalData.id, payload);
        setExpenseModalData(null);
        loadAllData();
      } else {
        const response = await createExpense(groupId, payload);
        setExpenseModalData(null);
        loadAllData();
        navigate(`/groups/${groupId}/expenses/${response.data.id}/split`);
      }
    } catch (err) {
      if (err.response && err.response.data) {
        setExpenseFormErrors(err.response.data);
      } else {
        setExpenseFormError('An error occurred while saving the expense.');
      }
    } finally {
      setExpenseFormSubmitting(false);
    }
  };

  const handleConfirmDeleteGroup = async () => {
    try {
      await deleteGroup(groupId);
      navigate('/');
    } catch (err) {
      setError('Failed to delete group.');
    } finally {
      setShowDeleteGroupConfirm(false);
    }
  };

  const handleConfirmDeleteMember = async () => {
    try {
      await deleteMember(groupId, deletingMember.id);
      setDeletingMember(null);
      loadAllData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete member.');
      setDeletingMember(null);
    }
  };

  const handleConfirmDeleteExpense = async () => {
    try {
      await deleteExpense(groupId, deletingExpense.id);
      setDeletingExpense(null);
      loadAllData();
    } catch (err) {
      setError('Failed to delete expense.');
      setDeletingExpense(null);
    }
  };

  const handleSetBudget = async (e) => {
    e.preventDefault();
    if (!newBudgetLimit || Number(newBudgetLimit) <= 0) return;
    setSettingBudget(true);
    try {
      await setGroupBudget(groupId, { amount_limit: newBudgetLimit });
      loadAllData();
    } catch (err) {
      setError('Failed to update budget limit.');
    } finally {
      setSettingBudget(false);
    }
  };

  const toggleExpenseExpansion = async (expenseId) => {
    if (expandedExpenseId === expenseId) {
      setExpandedExpenseId(null);
    } else {
      setExpandedExpenseId(expenseId);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white">Group Not Found</h2>
        <Link to="/" className="text-indigo-400 hover:text-indigo-300 font-medium mt-4 inline-flex items-center space-x-1">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    );
  }

  const budgetProgress = budget ? Math.min((totalSpent / Number(budget.amount_limit)) * 100, 100) : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <Link to="/" className="text-indigo-400 hover:text-indigo-300 font-semibold mb-2 inline-flex items-center space-x-1 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <div className="flex items-center space-x-3 mt-1">
            <h1 className="text-3xl font-extrabold text-white tracking-tight font-sans">
              {group.name}
            </h1>
            {isCreator ? (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Owner
              </span>
            ) : (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/30">
                Member
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-1">{group.description || 'No description provided.'}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/groups/${groupId}/balances`}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
          >
            Balances & Settlements
          </Link>

          {isCreator && (
            <>
              <button
                onClick={openEditGroup}
                className="p-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800/30 transition-colors flex items-center justify-center cursor-pointer"
                title="Edit Group"
              >
                <Edit3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowDeleteGroupConfirm(true)}
                className="p-2.5 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Delete Group"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start space-x-2.5">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Budget Limit Exceeded Alert Banner */}
      {budget && isBudgetExceeded && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-center justify-between animate-pulse-slow">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-5 h-5" />
            <span>
              <strong>Budget Warning:</strong> Total expenses (₹{totalSpent.toFixed(2)}) exceed group budget (₹{Number(budget.amount_limit).toFixed(2)}).
            </span>
          </div>
        </div>
      )}

      {/* Primary Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Members & Budget */}
        <div className="space-y-8 lg:col-span-1">
          {/* Members Panel */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2.5">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white font-sans">Members</h3>
              </div>
            </div>

            {members.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No members added yet.</p>
            ) : (
              <div className="divide-y divide-slate-800/40">
                {members.map((member) => {
                  const isSelf = member.user?.id === user?.id || (member.email && user?.email && member.email.toLowerCase() === user.email.toLowerCase());
                  const isOwnerMember = member.user?.id === group?.created_by?.id || member.name === group?.created_by?.username;
                  return (
                    <div key={member.id} className="py-3 flex justify-between items-center group">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/groups/${groupId}/members/${member.id}/ledger`}
                            className="font-medium text-slate-200 hover:text-indigo-400 transition-colors text-sm"
                          >
                            {member.name}
                          </Link>
                          {isOwnerMember && (
                            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              Owner
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">{member.email || 'No email'}</p>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <Link
                          to={`/groups/${groupId}/members/${member.id}/ledger`}
                          className="text-[11px] font-semibold text-indigo-400 hover:underline px-2 py-1 rounded"
                        >
                          Ledger
                        </Link>

                        {(isCreator || isSelf) && (
                          <button
                            onClick={() => openMemberModal(member)}
                            className="p-1 text-slate-500 hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Edit Member"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isCreator && !isOwnerMember && (
                          <button
                            onClick={() => setDeletingMember(member)}
                            className="p-1 text-rose-500/70 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Remove Member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isCreator && (
              <div className="mt-4 pt-4 border-t border-slate-800/40 space-y-3">
                <form onSubmit={handleInviteUser} className="space-y-2">
                  <label htmlFor="inviteEmail" className="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                    Invite Member by Email
                  </label>
                  {inviteSuccess && <p className="text-emerald-400 text-xs font-medium">{inviteSuccess}</p>}
                  {inviteError && <p className="text-rose-400 text-xs">{inviteError}</p>}
                  <div className="flex items-center space-x-2">
                    <input
                      id="inviteEmail"
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg glass-input text-xs"
                      placeholder="friend@example.com"
                    />
                    <button
                      type="submit"
                      disabled={inviting}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                    >
                      <Send className="w-3 h-3" />
                      <span>{inviting ? '...' : 'Invite'}</span>
                    </button>
                  </div>
                </form>

                {/* Sent Invitations & Copy Link List */}
                {groupInvitations.length > 0 && (
                  <div className="mt-3 space-y-1.5 pt-3 border-t border-slate-800/30">
                    <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-2">
                      Sent Invitations ({groupInvitations.length})
                    </p>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                      {groupInvitations.map((inv) => (
                        <div key={inv.id} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/50 flex items-center justify-between text-xs">
                          <div className="min-w-0 pr-2">
                            <p className="text-slate-200 font-medium truncate text-[11px]">{inv.email}</p>
                            <span className={`inline-block text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${inv.status === 'accepted'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : (inv.status === 'declined' || inv.is_expired)
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                              {inv.is_expired ? 'expired' : inv.status}
                            </span>
                          </div>

                          {inv.status === 'pending' && !inv.is_expired && (
                            <button
                              type="button"
                              onClick={() => handleCopyLink(inv.id)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded text-[10px] font-semibold flex items-center space-x-1 cursor-pointer transition-colors border border-slate-700/50 flex-shrink-0"
                              title="Copy Shareable Invite Link"
                            >
                              {copiedInviteId === inv.id ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Budget Limit Configurations */}
          {isOwner && (
            <div className="glass-panel rounded-2xl p-6">
              <div className="flex items-center space-x-2.5 mb-4">
                <Bell className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white font-sans">Group Budget</h3>
              </div>

              {budget ? (
                <div className="space-y-4">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Spend Progress</span>
                    <span>{budgetProgress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${isBudgetExceeded ? 'bg-rose-500' : 'bg-indigo-500'}`}
                      style={{ width: `${budgetProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Total Spent: <span className="text-white font-semibold">₹{totalSpent.toFixed(2)}</span> of <span className="text-indigo-400 font-semibold">₹{Number(budget.amount_limit).toFixed(2)}</span>
                  </p>
                </div>
              ) : (
                <p className="text-slate-500 text-xs py-2">No budget limit set for this group.</p>
              )}

              {isCreator && (
                <form onSubmit={handleSetBudget} className="mt-4 pt-4 border-t border-slate-800/40 flex items-end space-x-2">
                  <div className="flex-1">
                    <label htmlFor="budgetLimit" className="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1">
                      {budget ? 'Update' : 'Set'} Limit (₹)
                    </label>
                    <input
                      id="budgetLimit"
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      value={newBudgetLimit}
                      onChange={(e) => setNewBudgetLimit(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg glass-input text-xs"
                      placeholder="Enter budget limit"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={settingBudget}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                  >
                    {settingBudget ? '...' : 'Save'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Expense History & Split Details */}
        <div className="space-y-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold text-white font-sans">Expenses History</h2>
            {group?.user_permissions?.can_add_expense && (
              <button
                onClick={() => openExpenseModal(null)}
                className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Expense</span>
              </button>
            )}
          </div>

          {expenses.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center">
              <MoneyIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-300">No Expenses Recorded</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                No bills have been posted in this group. Click 'Add Expense' above to create one.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {expenses.map((expense) => {
                const isExpanded = expandedExpenseId === expense.id;
                return (
                  <div key={expense.id} className="glass-panel rounded-2xl overflow-hidden transition-all duration-300">
                    <div
                      onClick={() => toggleExpenseExpansion(expense.id)}
                      className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-800/10 transition-colors"
                    >
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-slate-200 text-base font-sans line-clamp-1">{expense.title}</h4>
                          <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/30">
                            {expense.category}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-[11px]">
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{new Date(expense.date).toLocaleDateString()}</span>
                          </span>
                          <span>•</span>
                          <span>Paid by: <strong className="text-slate-300">{expense.paid_by_name}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <span className="font-bold text-white text-lg font-sans">
                          ₹{Number(expense.amount).toFixed(2)}
                        </span>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-5 pb-5 pt-3 border-t border-slate-800/40 bg-slate-950/20 space-y-4 animate-slide-down">
                        {expense.description && (
                          <div className="text-slate-400 text-xs">
                            <h5 className="font-semibold text-slate-300 uppercase tracking-wider text-[9px] mb-1">Description</h5>
                            <p>{expense.description}</p>
                          </div>
                        )}

                        {expense.notes && (
                          <div className="text-slate-400 text-xs">
                            <h5 className="font-semibold text-slate-300 uppercase tracking-wider text-[9px] mb-1">Notes</h5>
                            <p>{expense.notes}</p>
                          </div>
                        )}

                        {/* Splitting Details */}
                        <div className="pt-2">
                          <div className="flex justify-between items-center mb-2">
                            <h5 className="font-semibold text-slate-300 uppercase tracking-wider text-[9px]">Splits Shares</h5>
                            {expense.created_by === user?.id && (
                              <Link
                                to={`/groups/${groupId}/expenses/${expense.id}/split`}
                                className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                              >
                                {expense.splits && expense.splits.length > 0 ? 'Edit Split' : 'Setup Split'}
                              </Link>
                            )}
                          </div>

                          {!expense.splits || expense.splits.length === 0 ? (
                            <div className="text-center py-4 bg-slate-900/30 rounded-xl border border-dashed border-slate-800/50">
                              <p className="text-slate-500 text-xs">This expense hasn't been split yet.</p>
                              {expense.created_by === user?.id && (
                                <Link
                                  to={`/groups/${groupId}/expenses/${expense.id}/split`}
                                  className="mt-2 inline-block px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-lg text-xs font-semibold"
                                >
                                  Setup Splits Now
                                </Link>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-900/30 border border-slate-800/40 rounded-xl p-3.5">
                              {expense.splits.map((split) => (
                                <div key={split.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-800/20 last:border-0">
                                  <span className="text-slate-300">{split.member_name}</span>
                                  <span className="font-semibold text-slate-200">₹{Number(split.amount).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Creator / Member options */}
                        {(group?.user_permissions?.can_edit_expense || group?.user_permissions?.can_delete_expense) && (
                          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800/40 text-xs">
                            {group?.user_permissions?.can_edit_expense && (
                              <button
                                onClick={() => openExpenseModal(expense)}
                                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-300 hover:bg-slate-800/30 transition-all cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                            )}
                            {group?.user_permissions?.can_delete_expense && (
                              <button
                                onClick={() => setDeletingExpense(expense)}
                                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= MODALS ================= */}

      {/* 1. Group Edit Modal */}
      {showEditGroup && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800/40 pb-3">
              <div className="flex items-center space-x-2.5">
                <Settings className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white font-sans">Edit Group Details</h3>
              </div>
              <button
                onClick={() => setShowEditGroup(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editGroupError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{editGroupError}</span>
              </div>
            )}

            <form onSubmit={handleEditGroupSubmit} className="space-y-4">
              <div>
                <label htmlFor="modalGroupName" className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                  Group Name
                </label>
                <input
                  id="modalGroupName"
                  type="text"
                  required
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm font-sans text-white animate-all"
                  placeholder="Group Name"
                />
              </div>

              <div>
                <label htmlFor="modalGroupDesc" className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  id="modalGroupDesc"
                  rows={3}
                  value={editGroupDesc}
                  onChange={(e) => setEditGroupDesc(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm font-sans text-white animate-all"
                  placeholder="Optional description"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditGroup(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editGroupSubmitting}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {editGroupSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Group Delete Confirm Modal */}
      {showDeleteGroupConfirm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white font-sans flex items-center space-x-2">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
                <span>Delete Group</span>
              </h3>
              <p className="text-slate-400 text-sm mt-3">
                Are you sure you want to delete the group <strong className="text-white">"{group.name}"</strong>? This action is permanent and will delete all expenses, members, and split records.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteGroupConfirm(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteGroup}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center"
              >
                Delete Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Member Modal (Add / Edit) */}
      {memberModalData && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800/40 pb-3">
              <div className="flex items-center space-x-2.5">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white font-sans">
                  {memberModalData.id ? 'Edit Member Details' : 'Add Group Member'}
                </h3>
              </div>
              <button
                onClick={() => setMemberModalData(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {memberFormError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{memberFormError}</span>
              </div>
            )}

            <form onSubmit={handleMemberSubmit} className="space-y-4">
              <div>
                <label htmlFor="modalMemberName" className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                  Member Name
                </label>
                <input
                  id="modalMemberName"
                  type="text"
                  required
                  value={memberFormName}
                  onChange={(e) => setMemberFormName(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl glass-input text-xs font-sans text-white ${memberFormErrors.name ? 'border-rose-500/50' : ''}`}
                  placeholder="e.g. John Doe"
                />
                {memberFormErrors.name && (
                  <p className="mt-1 text-[10px] text-rose-400">{memberFormErrors.name[0]}</p>
                )}
              </div>

              <div>
                <label htmlFor="modalMemberEmail" className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                  Email Address (Optional)
                </label>
                <input
                  id="modalMemberEmail"
                  type="email"
                  value={memberFormEmail}
                  onChange={(e) => setMemberFormEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-sans text-white"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label htmlFor="modalMemberPhone" className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                  Phone Number (Optional)
                </label>
                <input
                  id="modalMemberPhone"
                  type="text"
                  value={memberFormPhone}
                  onChange={(e) => setMemberFormPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-sans text-white"
                  placeholder="e.g. +91 98765 43210"
                />
              </div>

              {isCreator && !isEditingOwner && (
                <div className="space-y-3 pt-3 border-t border-slate-800/40">
                  <span className="block text-slate-300 text-xs font-semibold uppercase tracking-wider">
                    Member Permissions
                  </span>

                  <div className="space-y-2">
                    <label className="flex items-center space-x-3 text-slate-300 text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={memberFormCanAddExpense}
                        onChange={(e) => setMemberFormCanAddExpense(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 w-4 h-4 cursor-pointer"
                      />
                      <span>Can Add Expenses (default: Yes)</span>
                    </label>

                    <label className="flex items-center space-x-3 text-slate-300 text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={memberFormCanEditExpense}
                        onChange={(e) => setMemberFormCanEditExpense(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950/40 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 w-4 h-4 cursor-pointer"
                      />
                      <span>Can Edit Expenses</span>
                    </label>

                    <label className="flex items-center space-x-3 text-slate-300 text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={memberFormCanDeleteExpense}
                        onChange={(e) => setMemberFormCanDeleteExpense(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950/40 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 w-4 h-4 cursor-pointer"
                      />
                      <span>Can Delete Expenses</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMemberModalData(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={memberFormSubmitting}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {memberFormSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>{memberModalData.id ? 'Save Changes' : 'Add Member'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Member Delete Confirm Modal */}
      {deletingMember && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white font-sans flex items-center space-x-2">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
                <span>Remove Member</span>
              </h3>
              <p className="text-slate-400 text-sm mt-3">
                Are you sure you want to remove member <strong className="text-white">"{deletingMember.name}"</strong>? All balances and splits associated with this member will remain, but they will be detached from the group members list.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeletingMember(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteMember}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Expense Modal (Add / Edit) */}
      {expenseModalData && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 my-8 mx-auto space-y-6 relative">
            <div className="flex justify-between items-center border-b border-slate-800/40 pb-3">
              <div className="flex items-center space-x-2.5">
                <MoneyIcon className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white font-sans">
                  {expenseModalData.id ? 'Edit Expense Record' : 'Record New Expense'}
                </h3>
              </div>
              <button
                onClick={() => setExpenseModalData(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {expenseFormError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{expenseFormError}</span>
              </div>
            )}

            {members.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                Please add members to this group before recording expenses.
              </div>
            ) : (
              <form onSubmit={handleExpenseSubmit} className="space-y-4">
                <div>
                  <label htmlFor="modalExpTitle" className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                    Title / Bill Name
                  </label>
                  <input
                    id="modalExpTitle"
                    type="text"
                    required
                    value={expenseFormTitle}
                    onChange={(e) => setExpenseFormTitle(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl glass-input text-xs font-sans text-white ${expenseFormErrors.title ? 'border-rose-500/50' : ''}`}
                    placeholder="e.g. Dinner or Cab Fare"
                  />
                  {expenseFormErrors.title && (
                    <p className="mt-1 text-[10px] text-rose-400">{expenseFormErrors.title[0]}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="modalExpAmount" className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                    Amount (₹)
                  </label>
                  <input
                    id="modalExpAmount"
                    type="number"
                    required
                    step="0.01"
                    min="0.01"
                    value={expenseFormAmount}
                    onChange={(e) => setExpenseFormAmount(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl glass-input text-xs font-sans text-white ${expenseFormErrors.amount ? 'border-rose-500/50' : ''}`}
                    placeholder="0.00"
                  />
                  {expenseFormErrors.amount && (
                    <p className="mt-1 text-[10px] text-rose-400">{expenseFormErrors.amount[0]}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="modalExpDate" className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                      Date
                    </label>
                    <input
                      id="modalExpDate"
                      type="date"
                      required
                      value={expenseFormDate}
                      onChange={(e) => setExpenseFormDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-sans text-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="modalExpCategory" className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                      Category
                    </label>
                    <input
                      id="modalExpCategory"
                      type="text"
                      required
                      value={expenseFormCategory}
                      onChange={(e) => setExpenseFormCategory(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-sans text-white"
                      placeholder="e.g. Food, Cab, Rent"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="modalExpDesc" className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    id="modalExpDesc"
                    rows={2}
                    value={expenseFormDesc}
                    onChange={(e) => setExpenseFormDesc(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl glass-input text-xs font-sans text-white"
                    placeholder="Brief description (Optional)"
                  />
                </div>

                <div>
                  <label htmlFor="modalExpNotes" className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                    Notes
                  </label>
                  <textarea
                    id="modalExpNotes"
                    rows={2}
                    value={expenseFormNotes}
                    onChange={(e) => setExpenseFormNotes(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl glass-input text-xs font-sans text-white"
                    placeholder="Special remarks (Optional)"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setExpenseModalData(null)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={expenseFormSubmitting}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    {expenseFormSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>{expenseModalData.id ? 'Save Changes' : 'Record Expense'}</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 6. Expense Delete Confirm Modal */}
      {deletingExpense && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white font-sans flex items-center space-x-2">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
                <span>Delete Expense</span>
              </h3>
              <p className="text-slate-400 text-sm mt-3">
                Are you sure you want to delete the expense <strong className="text-white">"{deletingExpense.title}"</strong>? This will remove all split allocations associated with this bill.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeletingExpense(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteExpense}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
