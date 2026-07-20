import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getGroupBalances, getMembers, createSettlement, completeSettlement } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import {
  ArrowLeft, Scale, ArrowRight, CheckCircle2, AlertCircle,
  DollarSign, RefreshCw, Send, Check
} from 'lucide-react';
import Dropdown from '../components/Dropdown';

export default function BalancesDashboard() {
  const { groupId } = useParams();
  const { user } = useContext(AuthContext);

  // Data states
  const [balances, setBalances] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [members, setMembers] = useState([]);

  // Status states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settlingId, setSettlingId] = useState(null);

  // Manual Settlement Form State
  const [payerId, setPayerId] = useState('');
  const [payeeId, setPayeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadBalancesData = async () => {
    try {
      const balRes = await getGroupBalances(groupId);
      setBalances(balRes.data.balances);
      setRecommended(balRes.data.recommended_settlements);

      const memRes = await getMembers(groupId);
      setMembers(memRes.data);
      if (memRes.data.length >= 2) {
        setPayerId(memRes.data[0].id);
        setPayeeId(memRes.data[1].id);
      }
    } catch (err) {
      setError('Failed to fetch group balances and recommended settlements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBalancesData();
  }, [groupId]);

  const handleCompleteSettlement = async (settlementId) => {
    setSettlingId(settlementId);
    try {
      await completeSettlement(groupId, settlementId);
      loadBalancesData();
    } catch (err) {
      setError('Failed to complete settlement.');
    } finally {
      setSettlingId(null);
    }
  };

  const handleManualSettlement = async (e) => {
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
        status: 'completed' // Mark custom logging as completed immediately
      });
      setAmount('');
      loadBalancesData();
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <Link to={`/groups/${groupId}`} className="text-indigo-400 hover:text-indigo-300 font-semibold mb-2 inline-flex items-center space-x-1 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Group</span>
          </Link>
          <h1 className="text-3xl font-extrabold text-white tracking-tight font-sans mt-1">
            Balances & Settlements
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Review net balances and resolve pending settlements within the group.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/groups/${groupId}/settlements`}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition-all border border-slate-700/60 shadow-lg"
          >
            Settlement History
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start space-x-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Member Net Balances list */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-lg font-bold text-white font-sans flex items-center space-x-2">
            <Scale className="w-5 h-5 text-indigo-400" />
            <span>Group Ledgers</span>
          </h2>

          <div className="glass-panel rounded-2xl p-6 space-y-4">
            {balances.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No balances calculated.</p>
            ) : (
              <div className="divide-y divide-slate-800/40">
                {balances.map((b) => {
                  const net = Number(b.net_balance);
                  const isOwed = net < 0;
                  const isOwedTo = net > 0;
                  return (
                    <div key={b.member.id} className="py-3.5 flex justify-between items-center">
                      <div>
                        <Link
                          to={`/groups/${groupId}/members/${b.member.id}/ledger`}
                          className="font-semibold text-sm text-slate-200 hover:text-indigo-400 transition-colors"
                        >
                          {b.member.name}
                        </Link>
                        <div className="flex space-x-2 text-[10px] text-slate-500 mt-0.5">
                          <span>Paid: ₹{Number(b.paid).toFixed(2)}</span>
                          <span>•</span>
                          <span>Owes: ₹{Number(b.owes).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`font-bold font-sans text-sm ${isOwedTo ? 'text-emerald-400' : isOwed ? 'text-rose-400' : 'text-slate-400'
                          }`}>
                          {isOwedTo ? `+₹${net.toFixed(2)}` : isOwed ? `-₹${Math.abs(net).toFixed(2)}` : '₹0.00'}
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {isOwedTo ? 'receives' : isOwed ? 'owes' : 'settled'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Columns: Smart Settlements & Manual Entry */}
        <div className="lg:col-span-2 space-y-8">

          {/* Smart Settlements Panel */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white font-sans flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
              <span>Recommended Smart Settlements</span>
            </h2>

            {recommended.length === 0 ? (
              <div className="glass-panel rounded-2xl p-8 text-center border-dashed border-slate-800">
                <Check className="w-12 h-12 text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-full mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-300">All Settled Up!</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                  No debts are active. Every group member's balances are fully balanced!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Visual Arrow Representation Card */}
                <div className="glass-panel rounded-2xl p-6 bg-indigo-950/15 border-indigo-500/10 space-y-4">
                  <h3 className="text-xs uppercase font-bold tracking-wider text-indigo-400">Automated Debt Resolution</h3>
                  <div className="font-sans text-sm space-y-2 text-slate-300">
                    {/* Payers directions */}
                    {recommended.map((rec) => (
                      <div key={rec.id} className="flex items-center space-x-2 py-1 border-b border-slate-800/20 last:border-0">
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
                      <div key={payeeName} className="flex items-center space-x-2 py-1">
                        <span className="text-emerald-400 font-semibold">{payeeName}</span>
                        <span className="text-slate-500">→</span>
                        <span className="text-slate-400 font-medium">Receive</span>
                        <span className="text-white font-bold">₹{totalRec.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Individual Actionable Cards */}
                <div className="space-y-3">
                  {recommended.map((rec) => (
                    <div key={rec.id} className="glass-panel rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center space-x-3.5">
                        <div className="text-sm font-medium text-slate-200">
                          <strong className="text-rose-400 font-semibold">{rec.payer_name}</strong>
                          <span className="text-slate-400 px-2 font-normal">pays</span>
                          <strong className="text-emerald-400 font-semibold">{rec.payee_name}</strong>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500 hidden sm:inline" />
                      </div>

                      <div className="flex items-center justify-between w-full sm:w-auto space-x-4">
                        <span className="text-lg font-bold text-white font-sans">
                          ₹{Number(rec.amount).toFixed(2)}
                        </span>

                        <button
                          onClick={() => handleCompleteSettlement(rec.id)}
                          disabled={settlingId === rec.id}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-600/15"
                        >
                          {settlingId === rec.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Mark Settled</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Record Manual Settlement Form */}
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white font-sans flex items-center space-x-2.5 mb-4">
              <DollarSign className="w-5 h-5 text-indigo-400" />
              <span>Record a Manual Settlement Payment</span>
            </h3>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {members.length < 2 ? (
              <p className="text-slate-500 text-xs">Need at least 2 members to record a transaction.</p>
            ) : (
              <form onSubmit={handleManualSettlement} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <Dropdown
                  id="manPayer"
                  label="Payer (who paid)"
                  required
                  size="sm"
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  options={members.map(m => ({ value: m.id, label: m.name, sublabel: m.email }))}
                  placeholder="Select payer"
                />

                <Dropdown
                  id="manPayee"
                  label="Payee (who received)"
                  required
                  size="sm"
                  value={payeeId}
                  onChange={(e) => setPayeeId(e.target.value)}
                  options={members.map(m => ({ value: m.id, label: m.name, sublabel: m.email }))}
                  placeholder="Select payee"
                />

                <div>
                  <label htmlFor="manAmount" className="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                    Amount (₹)
                  </label>
                  <input
                    id="manAmount"
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg glass-input text-xs font-sans text-left"
                    placeholder="0.00"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center space-x-1"
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
    </div>
  );
}
