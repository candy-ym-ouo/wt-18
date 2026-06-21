<template>
  <div class="notification-dropdown">
    <button
      class="notif-btn"
      @click="toggleDropdown"
      :class="{ active: showDropdown }"
    >
      <span class="bell-icon">🔔</span>
      <span v-if="unreadCount > 0" class="badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <div v-if="showDropdown" class="dropdown-panel">
      <div class="panel-header">
        <h4>消息通知</h4>
        <button
          class="link-btn"
          @click="handleMarkAll"
          :disabled="unreadCount === 0"
        >
          全部已读
        </button>
      </div>

      <div class="panel-tabs">
        <button
          v-for="t in tabs"
          :key="t.value"
          class="panel-tab"
          :class="{ active: activeTab === t.value }"
          @click="setActiveTab(t.value)"
        >
          {{ t.label }}
          <span v-if="getTabCount(t.value) > 0" class="tab-count">
            {{ getTabCount(t.value) }}
          </span>
        </button>
      </div>

      <div class="panel-list">
        <div
          v-for="notif in filteredNotifications"
          :key="notif.id"
          class="panel-item"
          :class="{ unread: !notif.is_read }"
          @click="handleNotifClick(notif)"
        >
          <div class="p-icon" :class="getIconClass(notif.type)">
            {{ getTypeIcon(notif.type) }}
          </div>
          <div class="p-content">
            <div class="p-title-row">
              <span class="p-type">{{ notif.type_label }}</span>
              <span class="p-time">{{ formatTime(notif.created_at) }}</span>
            </div>
            <div class="p-title">{{ notif.title }}</div>
            <div class="p-body" v-if="notif.content">
              {{ truncate(notif.content, 60) }}
            </div>
          </div>
          <div v-if="!notif.is_read" class="unread-dot"></div>
        </div>

        <div v-if="filteredNotifications.length === 0 && !loading" class="panel-empty">
          <span class="empty-emoji">📭</span>
          <span>暂无{{ activeTab === 'all' ? '' : getTabLabel(activeTab) }}消息</span>
        </div>

        <div v-if="loading" class="panel-loading">
          <div class="mini-spinner"></div>
          <span>加载中...</span>
        </div>
      </div>

      <div class="panel-footer">
        <router-link to="/notifications" class="view-all" @click="showDropdown = false">
          查看全部消息 →
        </router-link>
      </div>
    </div>

    <div v-if="showDropdown" class="backdrop" @click="showDropdown = false"></div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationStore } from '../stores/notification';

const router = useRouter();
const notifStore = useNotificationStore();

const showDropdown = ref(false);
const activeTab = ref('all');
const loading = ref(false);

const tabs = [
  { value: 'all', label: '全部' },
  { value: 'annotation_reply', label: '批注' },
  { value: 'task_assigned', label: '任务' },
  { value: 'task_comment', label: '评论' },
  { value: 'review_result', label: '审核' },
  { value: 'system_announcement', label: '公告' }
];

const notifications = computed(() => notifStore.notifications.slice(0, 50));
const unreadCount = computed(() => notifStore.unreadCount);

const filteredNotifications = computed(() => {
  if (activeTab.value === 'all') return notifications.value;
  return notifications.value.filter(n => n.type === activeTab.value);
});

function getTabCount(tabValue) {
  if (tabValue === 'all') return unreadCount.value;
  return notifStore.unreadByType[tabValue] || 0;
}

function getTabLabel(value) {
  const tab = tabs.find(t => t.value === value);
  return tab ? tab.label : '';
}

function getTypeIcon(type) {
  const icons = {
    'annotation_reply': '💬',
    'task_assigned': '📌',
    'task_comment': '💭',
    'review_result': '✅',
    'system_announcement': '📢'
  };
  return icons[type] || '🔔';
}

function getIconClass(type) {
  const classes = {
    'annotation_reply': 'p-icon-annotation',
    'task_assigned': 'p-icon-task',
    'task_comment': 'p-icon-comment',
    'review_result': 'p-icon-review',
    'system_announcement': 'p-icon-system'
  };
  return classes[type] || '';
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}

function truncate(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

function toggleDropdown() {
  showDropdown.value = !showDropdown.value;
  if (showDropdown.value) {
    loadNotifications();
  }
}

async function loadNotifications() {
  loading.value = true;
  try {
    await notifStore.fetchNotifications({ page: 1, page_size: 50 });
  } finally {
    loading.value = false;
  }
}

function setActiveTab(tab) {
  activeTab.value = tab;
}

async function handleNotifClick(notif) {
  showDropdown.value = false;
  const route = await notifStore.goToNotification(notif);
  if (route) {
    router.push(route);
  }
}

async function handleMarkAll() {
  await notifStore.markAllAsRead();
}

onMounted(() => {
  notifStore.init();
});

onUnmounted(() => {
  notifStore.stopAutoRefresh();
});
</script>

<style scoped>
.notification-dropdown {
  position: relative;
}

.notif-btn {
  position: relative;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(255,255,255,0.2);
  background: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  transition: all 0.2s;
}

.notif-btn:hover,
.notif-btn.active {
  background: rgba(255,255,255,0.15);
}

.bell-icon {
  font-size: 18px;
}

.badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: #ef4444;
  color: #fff;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  border: 2px solid var(--primary-dark);
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}

.dropdown-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  width: 400px;
  max-height: 600px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  overflow: hidden;
  z-index: 100;
  display: flex;
  flex-direction: column;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  background: linear-gradient(135deg, #faf7f2, #fff);
}

.panel-header h4 {
  margin: 0;
  color: var(--primary-dark);
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.link-btn {
  background: none;
  border: none;
  color: var(--primary-color);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.link-btn:hover:not(:disabled) {
  background: #f0e8dc;
}

.link-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.panel-tabs {
  display: flex;
  gap: 2px;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  overflow-x: auto;
  scrollbar-width: none;
}

.panel-tabs::-webkit-scrollbar {
  display: none;
}

.panel-tab {
  padding: 6px 12px;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.panel-tab:hover {
  background: #f5f5f5;
  color: var(--primary-dark);
}

.panel-tab.active {
  background: var(--primary-color);
  color: #fff;
  font-weight: 500;
}

.tab-count {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: rgba(0,0,0,0.1);
  border-radius: 8px;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-tab.active .tab-count {
  background: rgba(255,255,255,0.25);
}

.panel-list {
  flex: 1;
  overflow-y: auto;
  max-height: 420px;
}

.panel-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid #f8f8f8;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.panel-item:last-child {
  border-bottom: none;
}

.panel-item:hover {
  background: #fafaf7;
}

.panel-item.unread {
  background: #fffbeb;
}

.panel-item.unread:hover {
  background: #fff8e0;
}

.p-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  background: #f5f5f5;
}

.p-icon-annotation { background: #dbeafe; }
.p-icon-task { background: #fee2e2; }
.p-icon-comment { background: #d1fae5; }
.p-icon-review { background: #ede9fe; }
.p-icon-system { background: #fef3c7; }

.p-content {
  flex: 1;
  min-width: 0;
}

.p-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.p-type {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 6px;
  background: #f0f0f0;
  color: #666;
  font-weight: 500;
}

.p-time {
  font-size: 11px;
  color: #bbb;
  margin-left: auto;
}

.p-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-dark);
  margin-bottom: 2px;
  line-height: 1.4;
}

.p-body {
  font-size: 12px;
  color: #888;
  line-height: 1.5;
}

.unread-dot {
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6px;
}

.panel-empty,
.panel-loading {
  padding: 40px 20px;
  text-align: center;
  color: #aaa;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-emoji {
  font-size: 36px;
  opacity: 0.5;
}

.mini-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #f0f0f0;
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: mini-spin 0.8s linear infinite;
}

@keyframes mini-spin {
  to { transform: rotate(360deg); }
}

.panel-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  text-align: center;
  background: #fafafa;
}

.view-all {
  color: var(--primary-color);
  font-size: 13px;
  text-decoration: none;
  font-weight: 500;
}

.view-all:hover {
  text-decoration: underline;
}
</style>
