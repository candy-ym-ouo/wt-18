import axios from 'axios';

const api = axios.create({ baseURL: '' });

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
  allEntries: () => api.get('/api/admin/all-entries')
};

export default api;
