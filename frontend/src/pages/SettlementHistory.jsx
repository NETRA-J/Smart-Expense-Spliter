import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSettlements, getMembers, createSettlement, completeSettlement, getGroupDetail, getGroupBalances } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { 
  ArrowLeft, Calendar, DollarSign, CheckCircle2, AlertCircle, 
  Check, X, RefreshCw, Eye, Send, Filter, Scale
} from 'lucide-react';
import Dropdown from '../components/Dropdown';

export default function SettlementHistory() {
  const { groupId } = useParams();
  const { user } = useContext(AuthContext);

  // Data states
  const [group, setGroup] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [members, setMembers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');

  // Balance calculations states
  const [balances, setBalances] = useState([]);
  const [recommended, setRecommended] = useState([]);

  // Status states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Manual Form State
  const [payerId, setPayerId] = useState('');
  const [payeeId, setPayeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [settlementStatus, setSettlementStatus] = useState('completed');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal / Detail State
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [showConfirmId, setShowConfirmId] = useState(null);

  const loadData = async (filter = statusFilter) => {
    try {
      const groupRes = await getGroupDetail(groupId);
      setGroup(groupRes.data);

      const memRes = await getMembers(groupId);
      setMembers(memRes.data);
      if (memRes.data.length >= 2) {
        if (!payerId) setPayerId(memRes.data[0].id);
        if (!payeeId) setPayeeId(memRes.data[1].id);
      }

      const settleRes = await getSettlements(groupId, { status: filter });
      setSettlements(settleRes.data);

      const balRes = await getGroupBalances(groupId);
      setBalances(balRes.data.balances || []);
      setRecommended(balRes.data.recommended_settlements || []);
    } catch (err) {
      setError('Failed to fetch settlement data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [groupId]);

  const handleFilterChange = async (newFilter) => {
    setStatusFilter(newFilter);
    setLoading(true);
    await loadData(newFilter);
  };

  const handleCompleteSettlement = async (settlementId) => {
    setActionLoadingId(settlementId);
    try {
      await completeSettlement(groupId, settlementId);
      setShowConfirmId(null);
      setSelectedSettlement(null);
      await loadData();
    } catch (err) {
      setError('Failed to mark settlement as completed.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleManualSettlementSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    if (payerId === payeeId) {
      setFormError('Payer and payee cannot be the same member.');
      setSubmitting(false);
      return;
    }

    if (Number(amount) <= 0) {
      setFormError('Settlement amount must be greater than zero.');
      setSubmitting(false);
      return;
    }

    try {
      await createSettlement(groupId, {
        payer: Number(payerId),
        payee: Number(payeeId),
        amount: Number(amount),
        status: settlementStatus
      });
      setAmount('');
      await loadData();
    } catch (err) {
      setFormError(err.response?.data?.non_field_errors?.[0] || err.response?.data?.detail || 'Failed to record settlement.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate aggregated payees for automatic settlement visualization
  const payeesMap = {};
  recommended.forEach(rec => {
    const amt = Number(rec.amount);
    payeesMap[rec.payee_name] = (payeesMap[rec.payee_name] || 0) + amt;
  });

  if (loading && !group) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Header */}
      <div>
        <Link to={`/groups/${groupId}/balances`} className="text-indigo-400 hover:text-indigo-300 font-semibold mb-2 inline-flex items-center space-x-1 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Balances</span>
        </Link>
        <h1 className="text-3xl font-extrabold text-white tracking-tight font-sans mt-1">
          Settlement History
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          View, audit, and log settlement payments for <strong className="text-slate-200">{group?.name}</strong>.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start space-x-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Settlement List and Filters */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Filters Bar */}
          <div className="flex items-center justify-between bg-slate-900/30 border border-slate-800/40 p-3.5 rounded-2xl">
            <div className="flex items-center space-x-2 text-slate-400 text-xs">
              <Filter className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold uppercase tracking-wider">Status:</span>
            </div>
            <div className="flex space-x-2">
              {['all', 'completed', 'pending'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => handleFilterChange(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    statusFilter === filter
                      ? filter === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : filter === 'pending'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                      : 'border border-slate-800 text-slate-400 hover:bg-slate-800/30'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Settlements Table Container */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800/40">
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              </div>
            ) : settlements.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No settlements found matching the filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/60 bg-slate-900/10 text-slate-400 text-[11px] uppercase tracking-wider">
                      <th className="p-4 font-semibold">Payer</th>
                      <th className="p-4 font-semibold">Payee</th>
                      <th className="p-4 font-semibold">Amount</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold hidden md:table-cell">Date</th>
                      <th className="p-4 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-sm">
                    {settlements.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/5 transition-colors">
                        <td className="p-4 font-semibold text-rose-400">{s.payer_name}</td>
                        <td className="p-4 font-semibold text-emerald-400">{s.payee_name}</td>
                        <td className="p-4 font-bold text-white font-sans">₹{Number(s.amount).toFixed(2)}</td>
                        <td className="p-4">
                          <span className={`inline-block px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded border ${
                            s.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-500 hidden md:table-cell">
                          {new Date(s.date).toLocaleDateString()} {new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => setSelectedSettlement(s)}
                              className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-600 text-slate-300 transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {s.status === 'pending' && (
                              <button
                                onClick={() => setShowConfirmId(s.id)}
                                className="p-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 transition-colors cursor-pointer"
                                title="Mark Completed"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Automated Settlement Calculations & Group Ledgers */}
        <div className="lg:col-span-1 space-y-6">
          {/* 1. Automated Debt Resolutions Card */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white font-sans flex items-center space-x-2.5 border-b border-slate-800/40 pb-3">
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
              <span>Automated Settlement</span>
            </h3>

            {recommended.length === 0 ? (
              <div className="text-center py-6">
                <Check className="w-10 h-10 text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-full mx-auto mb-2" />
                <h4 className="font-semibold text-slate-300 text-sm">All Settled Up!</h4>
                <p className="text-slate-500 text-[11px] mt-1">No pending settlements in this group.</p>
              </div>
            ) : (
              <div className="font-sans text-xs space-y-2 text-slate-300">
                {/* Payers directions */}
                {recommended.map((rec) => (
                  <div key={rec.id} className="flex items-center space-x-1.5 py-1 border-b border-slate-800/20 last:border-0">
                    <span className="text-rose-400 font-semibold">{rec.payer_name}</span>
                    <span className="text-slate-500">→</span>
                    <span className="text-slate-400 font-medium">Pay</span>
                    <span className="text-white font-bold">₹{Number(rec.amount).toFixed(2)}</span>
                    <span className="text-slate-400">to</span>
                    <span className="text-emerald-400 font-semibold">{rec.payee_name}</span>
                  </div>
                ))}
                
                {/* Horizontal Divider */}
                <div className="border-t border-slate-800/40 my-3"></div>
                
                {/* Receivers summary */}
                {Object.entries(payeesMap).map(([payeeName, totalRec]) => (
                  <div key={payeeName} className="flex items-center space-x-1.5 py-1">
                    <span className="text-emerald-400 font-semibold">{payeeName}</span>
                    <span className="text-slate-500">→</span>
                    <span className="text-slate-400 font-medium">Receive</span>
                    <span className="text-white font-bold">₹{totalRec.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Group Ledgers Summary */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white font-sans flex items-center space-x-2.5 border-b border-slate-800/40 pb-3">
              <Scale className="w-5 h-5 text-indigo-400" />
              <span>Group Ledgers</span>
            </h3>

            {balances.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-4">No balances.</p>
            ) : (
              <div className="divide-y divide-slate-800/20 text-xs">
                {balances.map((b) => {
                  const net = Number(b.net_balance);
                  const isOwed = net < 0;
                  const isOwedTo = net > 0;
                  return (
                    <div key={b.member.id} className="py-2.5 flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-slate-300">{b.member.name}</span>
                        <div className="flex space-x-1 text-[9px] text-slate-500 mt-0.5">
                          <span>Paid: ₹{Number(b.paid).toFixed(2)}</span>
                          <span>•</span>
                          <span>Owes: ₹{Number(b.owes).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`font-semibold font-sans ${
                          isOwedTo ? 'text-emerald-400' : isOwed ? 'text-rose-400' : 'text-slate-400'
                        }`}>
                          {isOwedTo ? `+₹${net.toFixed(2)}` : isOwed ? `-₹${Math.abs(net).toFixed(2)}` : '₹0.00'}
                        </span>
                        <p className="text-[9px] text-slate-500">
                          {isOwedTo ? 'receives' : isOwed ? 'owes' : 'settled'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Record Manual Settlement (Collapsible / Secondary form) */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 font-sans flex items-center space-x-2 pb-2 border-b border-slate-800/30">
              <DollarSign className="w-4 h-4 text-indigo-400" />
              <span>Record Settlement Payment</span>
            </h3>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {members.length < 2 ? (
              <p className="text-slate-500 text-xs py-2 text-center">Need at least 2 members.</p>
            ) : (
              <form onSubmit={handleManualSettlementSubmit} className="space-y-3 text-xs">
                <Dropdown
                  id="payerSelect"
                  label="Payer"
                  required
                  size="sm"
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  options={members.map(m => ({ value: m.id, label: m.name, sublabel: m.email }))}
                  placeholder="Select payer"
                />

                <Dropdown
                  id="payeeSelect"
                  label="Payee"
                  required
                  size="sm"
                  value={payeeId}
                  onChange={(e) => setPayeeId(e.target.value)}
                  options={members.map(m => ({ value: m.id, label: m.name, sublabel: m.email }))}
                  placeholder="Select payee"
                />

                <div>
                  <label htmlFor="amountInput" className="block text-slate-400 text-[10px] uppercase font-semibold mb-1">
                    Amount (₹)
                  </label>
                  <input
                    id="amountInput"
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg glass-input text-xs font-sans text-left text-white"
                    placeholder="0.00"
                  />
                </div>

                <Dropdown
                  id="statusSelect"
                  label="Status"
                  required
                  size="sm"
                  value={settlementStatus}
                  onChange={(e) => setSettlementStatus(e.target.value)}
                  options={[
                    { value: 'completed', label: 'Completed' },
                    { value: 'pending', label: 'Pending' }
                  ]}
                  placeholder="Select status"
                />

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white rounded-lg font-semibold transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {submitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3 h-3" />
                      <span>Record Payment</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

      </div>

      {/* Confirmation Dialog Modal */}
      {showConfirmId && (() => {
        const target = settlements.find(s => s.id === showConfirmId);
        if (!target) return null;
        return (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white font-sans">Complete Settlement</h3>
                <p className="text-slate-400 text-sm mt-2">
                  Are you sure you want to mark the settlement of <strong className="text-indigo-400">₹{Number(target.amount).toFixed(2)}</strong> from <strong className="text-rose-400">{target.payer_name}</strong> to <strong className="text-emerald-400">{target.payee_name}</strong> as Completed?
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmId(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCompleteSettlement(target.id)}
                  disabled={actionLoadingId === target.id}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {actionLoadingId === target.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Confirm</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Detail Modal */}
      {selectedSettlement && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800/40 pb-3">
              <h3 className="text-xl font-bold text-white font-sans">Settlement Details</h3>
              <button 
                onClick={() => setSelectedSettlement(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="divide-y divide-slate-800/40 text-sm">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Group:</span>
                <span className="font-semibold text-slate-200">{group?.name}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Payer (Sent):</span>
                <span className="font-bold text-rose-400">{selectedSettlement.payer_name}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Payee (Received):</span>
                <span className="font-bold text-emerald-400">{selectedSettlement.payee_name}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="font-extrabold text-white">₹{Number(selectedSettlement.amount).toFixed(2)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className={`inline-block px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded border ${
                  selectedSettlement.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {selectedSettlement.status}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Recorded Date:</span>
                <span className="text-slate-300">
                  {new Date(selectedSettlement.date).toLocaleString()}
                </span>
              </div>
            </div>

            {selectedSettlement.status === 'completed' && (
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 rounded-xl text-xs text-center">
                This settlement is Completed and cannot be modified.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedSettlement(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
              >
                Close
              </button>
              {selectedSettlement.status === 'pending' && (
                <button
                  onClick={() => {
                    setShowConfirmId(selectedSettlement.id);
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Complete Settlement
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
