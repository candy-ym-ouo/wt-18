import { defineStore } from 'pinia';
import {
  authAPI,
  setToken,
  ROLES,
  ROLE_LEVELS,
  hasRole as _hasRole,
  hasRoleLevel as _hasRoleLevel
} from '../api';

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null,
    loading: false,
    error: null,
    initialized: false
  }),

  getters: {
    isLoggedIn: (state) => !!state.user,
    username: (state) => state.user?.displayName || state.user?.username || '',
    role: (state) => state.user?.role || null,
    roleLevel: (state) => state.user?.roleLevel || 0,
    isAdmin: (state) => state.user?.role === ROLES.ADMIN,
    isEditor: (state) => state.user?.role === ROLES.EDITOR || state.user?.role === ROLES.ADMIN,
    canAccessAdmin: (state) =>
      state.user?.role === ROLES.ADMIN || state.user?.role === ROLES.EDITOR
  },

  actions: {
    hasRole(...roles) {
      return _hasRole(this.user, ...roles);
    },
    hasRoleLevel(minRole) {
      return _hasRoleLevel(this.user, minRole);
    },
    canEditUser(targetUser) {
      if (!this.user || !targetUser) return false;
      const curLevel = ROLE_LEVELS[this.user.role] || 0;
      const tgtLevel = ROLE_LEVELS[targetUser.role] || 0;
      return curLevel > tgtLevel;
    },

    async init() {
      if (this.initialized) return;
      const token = localStorage.getItem('oldbook_token');
      if (!token) {
        this.initialized = true;
        return;
      }
      try {
        this.loading = true;
        const { data } = await authAPI.me();
        this.user = data;
      } catch (e) {
        setToken(null);
        this.user = null;
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async login(username, password) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await authAPI.login(username.trim(), password);
        setToken(data.token);
        this.user = data.user;
        return { success: true };
      } catch (e) {
        const errData = e.response?.data;
        this.error = errData?.error || errData?.message || '登录失败';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async register(formData) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await authAPI.register(formData);
        setToken(data.token);
        this.user = data.user;
        return { success: true };
      } catch (e) {
        const errData = e.response?.data;
        this.error = errData?.error || errData?.message || '注册失败';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async refreshUser() {
      try {
        const { data } = await authAPI.me();
        this.user = data;
      } catch (e) {
        // ignore
      }
    },

    logout() {
      authAPI.logout();
      this.user = null;
    },

    async changePassword(oldPassword, newPassword) {
      try {
        await authAPI.changePassword(oldPassword, newPassword);
        return { success: true };
      } catch (e) {
        const errData = e.response?.data;
        return { success: false, error: errData?.error || errData?.message || '修改失败' };
      }
    }
  }
});
