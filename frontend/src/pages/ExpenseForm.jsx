import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { createExpense, updateExpense, getExpenseDetail, getMembers } from '../services/api';
import { ArrowLeft, CreditCard, AlertCircle } from 'lucide-react';

export default function ExpenseForm() {
  const { groupId, expenseId } = useParams();
  const navigate = useNavigate();
  const isEdit = !!expenseId;

  // Form Fields
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  // Dropdown list
  const [members, setMembers] = useState([]);
  
  // Status states
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadFormInfo = async () => {
      try {
        const membersRes = await getMembers(groupId);
        setMembers(membersRes.data);

        if (isEdit) {
          const expenseRes = await getExpenseDetail(groupId, expenseId);
          const exp = expenseRes.data;
          setTitle(exp.title);
          setAmount(exp.amount);
          setDate(exp.date);
          setCategory(exp.category);
          setDescription(exp.description || '');
          setNotes(exp.notes || '');
        }
      } catch (err) {
        setError('Failed to load required form data.');
      } finally {
        setLoading(false);
      }
    };
    loadFormInfo();
  }, [groupId, expenseId, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrors({});
    setSubmitting(true);

    if (Number(amount) <= 0) {
      setErrors({ amount: ['Expense amount must be greater than zero.'] });
      setSubmitting(false);
      return;
    }

    const payload = {
      title: title.trim(),
      amount: Number(amount),
      date,
      category: category.trim() || 'General',
      description: description.trim() || null,
      notes: notes.trim() || null
    };

    try {
      if (isEdit) {
        await updateExpense(groupId, expenseId, payload);
      } else {
        await createExpense(groupId, payload);
      }
      navigate(`/groups/${groupId}`);
    } catch (err) {
      if (err.response && err.response.data) {
        setErrors(err.response.data);
      } else {
        setError('An error occurred while saving the expense.');
      }
    } finally {
      setSubmitting(false);
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
    <div className="max-w-xl mx-auto animate-fade-in">
      <Link to={`/groups/${groupId}`} className="text-indigo-400 hover:text-indigo-300 font-semibold mb-6 inline-flex items-center space-x-1 text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Group</span>
      </Link>

      <div className="glass-panel rounded-2xl p-8">
        <div className="flex items-center space-x-3 mb-6">
          <CreditCard className="w-6 h-6 text-indigo-400" />
          <h2 className="text-2xl font-bold text-white font-sans">
            {isEdit ? 'Edit Expense Record' : 'Record New Expense'}
          </h2>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start space-x-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {members.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-slate-400 text-sm mb-4">Please add members to this group before recording expenses.</p>
            <Link to={`/groups/${groupId}/members/add`} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors">
              Add Member Now
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="expTitle" className="block text-slate-300 text-sm font-medium mb-1.5">
                Title / Bill Name
              </label>
              <input
                id="expTitle"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl glass-input text-sm font-sans ${errors.title ? 'border-rose-500/50 focus:border-rose-500' : ''}`}
                placeholder="e.g. Dinner Bill or Cab Fare"
              />
              {errors.title && (
                <p className="mt-1 text-xs text-rose-400">{errors.title[0]}</p>
              )}
            </div>

            <div>
              <label htmlFor="expAmount" className="block text-slate-300 text-sm font-medium mb-1.5">
                Amount (₹)
              </label>
              <input
                id="expAmount"
                type="number"
                required
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl glass-input text-sm font-sans ${errors.amount ? 'border-rose-500/50 focus:border-rose-500' : ''}`}
                placeholder="0.00"
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-rose-400">{errors.amount[0]}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="expDate" className="block text-slate-300 text-sm font-medium mb-1.5">
                  Date
                </label>
                <input
                  id="expDate"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm font-sans"
                />
                {errors.date && (
                  <p className="mt-1 text-xs text-rose-400">{errors.date[0]}</p>
                )}
              </div>

              <div>
                <label htmlFor="expCategory" className="block text-slate-300 text-sm font-medium mb-1.5">
                  Category
                </label>
                <input
                  id="expCategory"
                  type="text"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm font-sans"
                  placeholder="e.g. Food, Transport, Rent"
                />
                {errors.category && (
                  <p className="mt-1 text-xs text-rose-400">{errors.category[0]}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="expDesc" className="block text-slate-300 text-sm font-medium mb-1.5">
                Description (Optional)
              </label>
              <textarea
                id="expDesc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl glass-input text-sm font-sans"
                placeholder="Briefly describe what this bill was about"
              />
            </div>

            <div>
              <label htmlFor="expNotes" className="block text-slate-300 text-sm font-medium mb-1.5">
                Notes (Optional)
              </label>
              <textarea
                id="expNotes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl glass-input text-sm font-sans"
                placeholder="Any special remarks"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center space-x-2 mt-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span>{isEdit ? 'Save Changes' : 'Record Expense'}</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
