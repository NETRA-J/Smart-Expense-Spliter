import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getGroupDetail, updateGroup } from '../services/api';
import { ArrowLeft, Settings, AlertCircle } from 'lucide-react';

export default function GroupForm() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchGroupDetails = async () => {
      try {
        const res = await getGroupDetail(groupId);
        setName(res.data.name);
        setDescription(res.data.description || '');
      } catch (err) {
        setError('Failed to fetch group details.');
      } finally {
        setLoading(false);
      }
    };
    fetchGroupDetails();
  }, [groupId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrors({});
    setSubmitting(true);

    if (name.trim().length < 3) {
      setErrors({ name: ['Group name must be at least 3 characters long.'] });
      setSubmitting(false);
      return;
    }

    const payload = { 
      name: name.trim(), 
      description: description.trim() 
    };

    try {
      await updateGroup(groupId, payload);
      navigate(`/groups/${groupId}`);
    } catch (err) {
      if (err.response && err.response.data) {
        if (err.response.data.name) {
          setErrors({ name: err.response.data.name });
        } else if (err.response.data.non_field_errors || err.response.data.detail) {
          setError(err.response.data.non_field_errors?.[0] || err.response.data.detail);
        } else {
          setErrors(err.response.data);
        }
      } else {
        setError('An unexpected error occurred.');
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
          <Settings className="w-6 h-6 text-indigo-400" />
          <h2 className="text-2xl font-bold text-white font-sans">
            Update Group Details
          </h2>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start space-x-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="groupName" className="block text-slate-300 text-sm font-medium mb-1.5">
              Group Name
            </label>
            <input
              id="groupName"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl glass-input text-sm font-sans ${errors.name ? 'border-rose-500/50 focus:border-rose-500' : ''}`}
              placeholder="e.g. Goa Trip 2026"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-rose-400">{errors.name[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="groupDescription" className="block text-slate-300 text-sm font-medium mb-1.5">
              Description (Optional)
            </label>
            <textarea
              id="groupDescription"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl glass-input text-sm font-sans"
              placeholder="Provide a brief description of the expense group..."
            />
          </div>

          <div className="flex gap-3">
            <Link
              to={`/groups/${groupId}`}
              className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-center rounded-xl text-sm font-semibold transition-all border border-slate-700/50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center space-x-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
