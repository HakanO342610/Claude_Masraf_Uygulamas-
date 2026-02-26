import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { name: string; email: string; password: string; department?: string }) =>
    api.post('/auth/register', data),
};

export const expenseApi = {
  getAll: (params?: { status?: string; fromDate?: string; toDate?: string }) =>
    api.get('/expenses', { params }),
  getById: (id: string) => api.get(`/expenses/${id}`),
  create: (data: any) => api.post('/expenses', data),
  update: (id: string, data: any) => api.patch(`/expenses/${id}`, data),
  delete: (id: string) => api.delete(`/expenses/${id}`),
  submit: (id: string) => api.patch(`/expenses/${id}/submit`),
  approve: (id: string, comment?: string) =>
    api.patch(`/expenses/${id}/approve`, { comment }),
  reject: (id: string, comment: string) =>
    api.patch(`/expenses/${id}/reject`, { comment }),
  getPendingApprovals: () => api.get('/expenses/pending-approvals'),
};

export default api;
