import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to automatically add authentication token to headers
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiry / unauthorized requests
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register' && !currentPath.startsWith('/invitations/')) {
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
    }
    return Promise.reject(error);
  }
);

// --- Auth APIs ---
export const loginUser = (data) => API.post('/login/', data);
export const registerUser = (data) => API.post('/register/', data);
export const logoutUser = () => API.post('/logout/');
export const getMe = () => API.get('/me/');
export const updateMe = (data) => API.put('/me/', data);
export const changePassword = (data) => API.post('/change-password/', data);

// --- Group APIs ---
export const getGroups = () => API.get('/groups/');
export const createGroup = (data) => API.post('/groups/', data);
export const getGroupDetail = (id) => API.get(`/groups/${id}/`);
export const updateGroup = (id, data) => API.patch(`/groups/${id}/`, data);
export const deleteGroup = (id) => API.delete(`/groups/${id}/`);

// --- Member APIs ---
export const getMembers = (groupId) => API.get(`/groups/${groupId}/members/`);
export const addMember = (groupId, data) => API.post(`/groups/${groupId}/members/`, data);
export const updateMember = (groupId, id, data) => API.patch(`/groups/${groupId}/members/${id}/`, data);
export const deleteMember = (groupId, id) => API.delete(`/groups/${groupId}/members/${id}/`);

// --- Expense APIs ---
export const getExpenses = (groupId) => API.get(`/groups/${groupId}/expenses/`);
export const createExpense = (groupId, data) => API.post(`/groups/${groupId}/expenses/`, data);
export const getExpenseDetail = (groupId, id) => API.get(`/groups/${groupId}/expenses/${id}/`);
export const updateExpense = (groupId, id, data) => API.patch(`/groups/${groupId}/expenses/${id}/`, data);
export const deleteExpense = (groupId, id) => API.delete(`/groups/${groupId}/expenses/${id}/`);

// --- Split APIs ---
export const previewEqualSplit = (groupId, expenseId, data) => API.post(`/groups/${groupId}/expenses/${expenseId}/split/preview-equal/`, data);
export const saveExpenseSplits = (groupId, expenseId, data) => API.post(`/groups/${groupId}/expenses/${expenseId}/split/save/`, data);

// --- Balance & Ledger APIs ---
export const getGroupBalances = (groupId) => API.get(`/groups/${groupId}/balances/`);
export const getMemberLedger = (groupId, memberId) => API.get(`/groups/${groupId}/members/${memberId}/ledger/`);

// --- Settlement APIs ---
export const getSettlements = (groupId, params) => API.get(`/groups/${groupId}/settlements/`, { params });
export const createSettlement = (groupId, data) => API.post(`/groups/${groupId}/settlements/`, data);
export const completeSettlement = (groupId, id) => API.post(`/groups/${groupId}/settlements/${id}/complete/`);

// --- Budget APIs ---
export const getGroupBudget = (groupId) => API.get(`/groups/${groupId}/budget/`);
export const setGroupBudget = (groupId, data) => API.post(`/groups/${groupId}/budget/`, data);

// --- Invitation APIs ---
export const getInvitations = () => API.get('/invitations/');
export const getInvitationDetail = (id) => API.get(`/invitations/${id}/`);
export const acceptInvitation = (id) => API.post(`/invitations/${id}/accept/`);
export const declineInvitation = (id) => API.post(`/invitations/${id}/decline/`);
export const inviteMember = (groupId, data) => API.post(`/groups/${groupId}/invitations/`, data);
export const getGroupInvitations = (groupId) => API.get(`/groups/${groupId}/invitations/list/`);

export default API;
