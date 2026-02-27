import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach access token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor — auto-refresh on 401
let isRefreshing = false;
let failedQueue: {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}[] = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      typeof window !== 'undefined' &&
      !originalRequest.url?.includes('/auth/')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const storedRefreshToken = localStorage.getItem('refreshToken');
      if (!storedRefreshToken) {
        isRefreshing = false;
        forceLogout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken: storedRefreshToken,
        });

        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        processQueue(null, data.accessToken);

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        forceLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

function forceLogout() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { name: string; email: string; password: string; department?: string }) =>
    api.post('/auth/register', data),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
  logout: () => api.post('/auth/logout'),
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

export const reportsApi = {
  getSummary: (params?: { from?: string; to?: string }) =>
    api.get('/reports/summary', { params }),
  getByDepartment: (params?: { from?: string; to?: string }) =>
    api.get('/reports/by-department', { params }),
  getByCategory: (params?: { from?: string; to?: string }) =>
    api.get('/reports/by-category', { params }),
  getMonthly: (year?: number) =>
    api.get('/reports/monthly', { params: year ? { year } : undefined }),
  exportCsv: (params?: { from?: string; to?: string }) =>
    api.get('/reports/export/csv', { params, responseType: 'blob' }),
};

export const receiptsApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/receipts/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  attachToExpense: (receiptId: string, expenseId: string) =>
    api.patch(`/receipts/${receiptId}/attach-to-expense/${expenseId}`),
  getMyReceipts: () => api.get('/receipts/my'),
  getByExpense: (expenseId: string) => api.get(`/receipts/expense/${expenseId}`),
};

export const usersApi = {
  getAll: () => api.get('/users'),
  getById: (id: string) => api.get(`/users/${id}`),
  updateRole: (id: string, role: string) => api.patch(`/users/${id}/role`, { role }),
  assignManager: (id: string, managerId: string) =>
    api.patch(`/users/${id}/manager`, { managerId }),
};

export const sapApi = {
  postExpense: (id: string) => api.post(`/integration/sap/post-expense/${id}`),
  enqueue: (id: string) => api.post(`/integration/sap/enqueue/${id}`),
  getQueueStatus: () => api.get('/integration/sap/queue'),
  retryQueueItem: (id: string) => api.post(`/integration/sap/queue/${id}/retry`),
  getMasterData: (type: string) => api.get('/integration/sap/master-data', { params: { type } }),
  syncMasterData: () => api.post('/integration/sap/sync'),
};

export default api;
