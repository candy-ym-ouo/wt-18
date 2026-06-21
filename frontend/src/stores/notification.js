import { defineStore } from 'pinia';
import { notificationsAPI } from '../api';

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    notifications: [],
    unreadCount: 0,
    unreadByType: {},
    loading: false,
    initialized: false,
    total: 0,
    page: 1,
    pageSize: 20,
    currentType: 'all',
    currentReadFilter: 'all',
    refreshTimer: null
  }),

  getters: {
    unreadAnnotation: (state) => state.unreadByType['annotation_reply'] || 0,
    unreadTask: (state) => state.unreadByType['task_assigned'] || 0 + (state.unreadByType['task_comment'] || 0),
    unreadReview: (state) => state.unreadByType['review_result'] || 0,
    unreadSystem: (state) => state.unreadByType['system_announcement'] || 0
  },

  actions: {
    async init() {
      if (this.initialized) return;
      this.initialized = true;
      await this.refreshUnreadCount();
      this.startAutoRefresh();
    },

    startAutoRefresh() {
      if (this.refreshTimer) return;
      this.refreshTimer = setInterval(() => {
        this.refreshUnreadCount().catch(() => {});
      }, 30000);
    },

    stopAutoRefresh() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
    },

    async refreshUnreadCount() {
      try {
        const { data } = await notificationsAPI.unreadCount();
        this.unreadCount = data.total;
        this.unreadByType = data.by_type || {};
      } catch (e) {
        // ignore
      }
    },

    async fetchNotifications(params = {}) {
      this.loading = true;
      try {
        const fetchParams = {
          type: this.currentType,
          is_read: this.currentReadFilter,
          page: this.page,
          page_size: this.pageSize,
          ...params
        };
        const { data } = await notificationsAPI.list(fetchParams);
        this.notifications = data.list || [];
        this.total = data.total || 0;
        this.unreadCount = data.unread_count ?? this.unreadCount;
      } finally {
        this.loading = false;
      }
    },

    setFilters({ type, isRead }) {
      if (type !== undefined) this.currentType = type;
      if (isRead !== undefined) this.currentReadFilter = isRead;
      this.page = 1;
      this.fetchNotifications();
    },

    setPage(page) {
      this.page = page;
      this.fetchNotifications();
    },

    async markAsRead(id) {
      try {
        const { data } = await notificationsAPI.markAsRead(id);
        const notif = this.notifications.find(n => n.id === id);
        if (notif) {
          notif.is_read = 1;
          notif.read_at = new Date().toISOString();
        }
        if (data?.unread_count !== undefined) {
          this.unreadCount = data.unread_count;
        }
        await this.refreshUnreadCount();
      } catch (e) {
        // ignore
      }
    },

    async markAllAsRead(type) {
      try {
        const { data } = await notificationsAPI.markAllAsRead(type);
        for (const n of this.notifications) {
          if (!type || n.type === type) {
            n.is_read = 1;
          }
        }
        if (data?.unread_count !== undefined) {
          this.unreadCount = data.unread_count;
        }
        await this.refreshUnreadCount();
        return true;
      } catch (e) {
        return false;
      }
    },

    async removeNotification(id) {
      try {
        await notificationsAPI.remove(id);
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.total = Math.max(0, this.total - 1);
        return true;
      } catch (e) {
        return false;
      }
    },

    async clearRead() {
      try {
        const { data } = await notificationsAPI.clearRead();
        this.notifications = this.notifications.filter(n => !n.is_read);
        this.total = this.notifications.length;
        return true;
      } catch (e) {
        return false;
      }
    },

    async goToNotification(notif) {
      if (!notif.is_read) {
        await this.markAsRead(notif.id);
      }

      const extra = notif.extra_data || {};
      let route = null;

      switch (notif.type) {
        case 'annotation_reply':
        case 'annotation':
          if (extra.versionId) {
            route = { path: `/versions/${extra.versionId}` };
          }
          break;
        case 'task_assigned':
        case 'task_comment':
        case 'task':
          if (notif.ref_id || extra.taskId) {
            route = { path: `/tasks`, query: { highlight: notif.ref_id || extra.taskId } };
          }
          break;
        case 'review_result':
        case 'submission':
          if (notif.ref_id) {
            route = { path: `/submission/${notif.ref_id}` };
          }
          break;
        case 'system_announcement':
        case 'announcement':
          route = { path: `/notifications`, query: { tab: 'announcements', id: notif.ref_id } };
          break;
      }

      return route;
    }
  }
});
