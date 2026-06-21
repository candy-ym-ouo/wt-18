import axios from 'axios';

const TOKEN_KEY = 'oldbook_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

const api = axios.create({ baseURL: '' });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      setToken(null);
      if (window && window.location && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      }
    }
    return Promise.reject(error);
  }
);

export const ROLES = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer'
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: '管理员',
  [ROLES.EDITOR]: '编辑',
  [ROLES.VIEWER]: '访问学者'
};

export const ROLE_LEVELS = {
  [ROLES.ADMIN]: 3,
  [ROLES.EDITOR]: 2,
  [ROLES.VIEWER]: 1
};

export function hasRole(user, ...roles) {
  if (!user || !user.role) return false;
  return roles.includes(user.role);
}

export function hasRoleLevel(user, minRole) {
  if (!user || !user.role) return false;
  return (ROLE_LEVELS[user.role] || 0) >= (ROLE_LEVELS[minRole] || 999);
}

export function canEditUser(currentUser, targetUser) {
  if (!currentUser || !targetUser) return false;
  const curLevel = ROLE_LEVELS[currentUser.role] || 0;
  const tgtLevel = ROLE_LEVELS[targetUser.role] || 0;
  return curLevel > tgtLevel;
}

export function handleApiError(error, fallbackMsg = '操作失败') {
  const data = error?.response?.data;
  if (data && data.error) return data.error;
  if (data && data.message) return data.message;
  if (error.message) return error.message;
  return fallbackMsg;
}

export const authAPI = {
  login: (username, password) => api.post('/api/auth/login', { username, password }),
  register: (data) => api.post('/api/auth/register', data),
  me: () => api.get('/api/auth/me'),
  changePassword: (oldPassword, newPassword) =>
    api.put('/api/auth/change-password', { oldPassword, newPassword }),
  roles: () => api.get('/api/auth/roles'),
  logout: () => { setToken(null); }
};

export const entriesAPI = {
  list: () => api.get('/api/entries'),
  get: (id) => api.get(`/api/entries/${id}`),
  create: (data) => api.post('/api/entries', data),
  update: (id, data) => api.put(`/api/entries/${id}`, data),
  remove: (id) => api.delete(`/api/entries/${id}`)
};

export const versionsAPI = {
  get: (id) => api.get(`/api/versions/${id}`),
  listByEntry: (entryId) => api.get(`/api/entries/${entryId}/versions`),
  compare: (ids) => api.get('/api/compare', { params: { ids: ids.join(',') } }),
  create: (data) => api.post('/api/versions', data),
  update: (id, data) => api.put(`/api/versions/${id}`, data),
  remove: (id) => api.delete(`/api/versions/${id}`)
};

export const imagesAPI = {
  listByVersion: (versionId) => api.get(`/api/versions/${versionId}/images`),
  upload: (versionId, formData) => api.post(`/api/versions/${versionId}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  remove: (id) => api.delete(`/api/images/${id}`)
};

export const annotationsAPI = {
  listByVersion: (versionId) => api.get(`/api/versions/${versionId}/annotations`),
  create: (versionId, data) => api.post(`/api/versions/${versionId}/annotations`, data),
  remove: (id) => api.delete(`/api/annotations/${id}`)
};

export const referencesAPI = {
  listByEntry: (entryId) => api.get(`/api/entries/${entryId}/references`),
  create: (data) => api.post('/api/references', data),
  remove: (id) => api.delete(`/api/references/${id}`),
  graph: () => api.get('/api/references/graph')
};

export const adminAPI = {
  stats: () => api.get('/api/admin/stats'),
  entries: () => api.get('/api/admin/entries'),
  versions: () => api.get('/api/admin/versions'),
  users: () => api.get('/api/admin/users'),
  user: (id) => api.get(`/api/admin/users/${id}`),
  createUser: (data) => api.post('/api/admin/users', data),
  updateUser: (id, data) => api.put(`/api/admin/users/${id}`, data),
  resetPassword: (id, newPassword) =>
    api.put(`/api/admin/users/${id}/reset-password`, { newPassword }),
  toggleUserStatus: (id) => api.put(`/api/admin/users/${id}/toggle-status`),
  removeUser: (id) => api.delete(`/api/admin/users/${id}`),
  allEntries: () => api.get('/api/admin/all-entries')
};

export { getToken, setToken };
export default api;
