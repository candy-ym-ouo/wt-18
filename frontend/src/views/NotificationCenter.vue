<template>
  <div class="notification-center">
    <div class="page-header">
      <h2>
        <span class="header-icon">🔔</span>
        消息通知中心
      </h2>
      <div class="header-actions">
        <button class="btn sm secondary" @click="refreshList" :disabled="loading">
          {{ loading ? '刷新中...' : '刷新' }}
        </button>
        <button class="btn sm" @click="handleMarkAllRead" :disabled="unreadCount === 0">
          全部标记已读
        </button>
        <button class="btn sm secondary" @click="handleClearRead">
          清除已读
        </button>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card" :class="{ active: currentType === 'all' }" @click="setType('all')">
        <div class="stat-icon">📋</div>
        <div class="stat-info">
          <div class="stat-label">全部消息</div>
          <div class="stat-value">{{ total }}</div>
        </div>
        <div v-if="unreadCount > 0" class="stat-badge">{{ unreadCount }}</div>
      </div>
      <div class="stat-card" :class="{ active: currentType === 'annotation_reply' }" @click="setType('annotation_reply')">
        <div class="stat-icon">💬</div>
        <div class="stat-info">
          <div class="stat-label">批注回复</div>
          <div class="stat-value">{{ getTypeCount('annotation_reply') }}</div>
        </div>
        <div v-if="getUnreadByType('annotation_reply') > 0" class="stat-badge">{{ getUnreadByType('annotation_reply') }}</div>
      </div>
      <div class="stat-card" :class="{ active: currentType === 'task_assigned' }" @click="setType('task_assigned')">
        <div class="stat-icon">📌</div>
        <div class="stat-info">
          <div class="stat-label">任务指派</div>
          <div class="stat-value">{{ getTypeCount('task_assigned') }}</div>
        </div>
        <div v-if="getUnreadByType('task_assigned') > 0" class="stat-badge">{{ getUnreadByType('task_assigned') }}</div>
      </div>
      <div class="stat-card" :class="{ active: currentType === 'task_comment' }" @click="setType('task_comment')">
        <div class="stat-icon">💭</div>
        <div class="stat-info">
          <div class="stat-label">任务评论</div>
          <div class="stat-value">{{ getTypeCount('task_comment') }}</div>
        </div>
        <div v-if="getUnreadByType('task_comment') > 0" class="stat-badge">{{ getUnreadByType('task_comment') }}</div>
      </div>
      <div class="stat-card" :class="{ active: currentType === 'review_result' }" @click="setType('review_result')">
        <div class="stat-icon">✅</div>
        <div class="stat-info">
          <div class="stat-label">审核结果</div>
          <div class="stat-value">{{ getTypeCount('review_result') }}</div>
        </div>
        <div v-if="getUnreadByType('review_result') > 0" class="stat-badge">{{ getUnreadByType('review_result') }}</div>
      </div>
      <div class="stat-card" :class="{ active: currentType === 'system_announcement' }" @click="setType('system_announcement')">
        <div class="stat-icon">📢</div>
        <div class="stat-info">
          <div class="stat-label">系统公告</div>
          <div class="stat-value">{{ getTypeCount('system_announcement') }}</div>
        </div>
        <div v-if="getUnreadByType('system_announcement') > 0" class="stat-badge">{{ getUnreadByType('system_announcement') }}</div>
      </div>
    </div>

    <div class="filter-row">
      <div class="filter-tabs">
        <button
          v-for="f in readFilters"
          :key="f.value"
          class="filter-tab"
          :class="{ active: currentReadFilter === f.value }"
          @click="setReadFilter(f.value)"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <div class="notification-list" v-if="notifications.length > 0">
      <div
        v-for="notif in notifications"
        :key="notif.id"
        class="notification-item"
        :class="{ unread: !notif.is_read }"
        @click="handleNotificationClick(notif)"
      >
        <div class="notif-icon" :class="getIconClass(notif.type)">
          {{ getTypeIcon(notif.type) }}
        </div>
        <div class="notif-content">
          <div class="notif-header">
            <span class="notif-type-tag" :class="getTagClass(notif.type)">
              {{ notif.type_label }}
            </span>
            <span class="notif-time">{{ formatTime(notif.created_at) }}</span>
          </div>
          <div class="notif-title">{{ notif.title }}</div>
          <div class="notif-body" v-if="notif.content">{{ notif.content }}</div>
          <div class="notif-sender" v-if="notif.sender_name">
            来自：{{ notif.sender_name }}
          </div>
        </div>
        <div class="notif-actions">
          <button
            v-if="!notif.is_read"
            class="icon-btn"
            title="标记已读"
            @click.stop="handleMarkAsRead(notif.id)"
          >
            ✓
          </button>
          <button
            class="icon-btn danger"
            title="删除"
            @click.stop="handleDelete(notif.id)"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <div class="empty-state" v-else-if="!loading">
      <div class="empty-icon">📭</div>
      <div class="empty-text">暂无消息</div>
      <div class="empty-hint">当有新的批注回复、任务指派、审核结果或系统公告时，会显示在这里</div>
    </div>

    <div class="loading-state" v-else>
      <div class="loading-spinner"></div>
      <div>加载中...</div>
    </div>

    <div class="pagination" v-if="total > pageSize">
      <button
        class="page-btn"
        :disabled="page <= 1"
        @click="setPage(page - 1)"
      >
        上一页
      </button>
      <span class="page-info">
        第 {{ page }} / {{ totalPages }} 页，共 {{ total }} 条
      </span>
      <button
        class="page-btn"
        :disabled="page >= totalPages"
        @click="setPage(page + 1)"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationStore } from '../stores/notification';

const router = useRouter();
const notifStore = useNotificationStore();

const notifications = computed(() => notifStore.notifications);
const loading = computed(() => notifStore.loading);
const total = computed(() => notifStore.total);
const page = computed(() => notifStore.page);
const pageSize = computed(() => notifStore.pageSize);
const unreadCount = computed(() => notifStore.unreadCount);
const currentType = computed(() => notifStore.currentType);
const currentReadFilter = computed(() => notifStore.currentReadFilter);

const readFilters = [
  { value: 'all', label: '全部' },
  { value: 'false', label: '未读' },
  { value: 'true', label: '已读' }
];

const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1);

function getTypeCount(type) {
  return notifications.value.filter(n => n.type === type).length;
}

function getUnreadByType(type) {
  return notifStore.unreadByType[type] || 0;
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
    'annotation_reply': 'icon-annotation',
    'task_assigned': 'icon-task',
    'task_comment': 'icon-comment',
    'review_result': 'icon-review',
    'system_announcement': 'icon-system'
  };
  return classes[type] || '';
}

function getTagClass(type) {
  const classes = {
    'annotation_reply': 'tag-annotation',
    'task_assigned': 'tag-task',
    'task_comment': 'tag-comment',
    'review_result': 'tag-review',
    'system_announcement': 'tag-system'
  };
  return classes[type] || '';
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

function setType(type) {
  notifStore.setFilters({ type });
}

function setReadFilter(isRead) {
  notifStore.setFilters({ isRead });
}

function setPage(p) {
  notifStore.setPage(p);
}

function refreshList() {
  notifStore.fetchNotifications();
  notifStore.refreshUnreadCount();
}

async function handleMarkAsRead(id) {
  await notifStore.markAsRead(id);
}

async function handleMarkAllRead() {
  if (confirm('确定要将所有消息标记为已读吗？')) {
    await notifStore.markAllAsRead(currentType.value === 'all' ? null : currentType.value);
  }
}

async function handleDelete(id) {
  if (confirm('确定要删除这条消息吗？')) {
    await notifStore.removeNotification(id);
  }
}

async function handleClearRead() {
  if (confirm('确定要清除所有已读消息吗？此操作不可恢复。')) {
    await notifStore.clearRead();
  }
}

async function handleNotificationClick(notif) {
  const route = await notifStore.goToNotification(notif);
  if (route) {
    router.push(route);
  }
}

onMounted(() => {
  notifStore.init();
  notifStore.fetchNotifications();
});

onUnmounted(() => {
  notifStore.stopAutoRefresh();
});
</script>

<style scoped>
.notification-center {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.page-header h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--primary-dark);
}

.header-icon {
  font-size: 28px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border: 2px solid #f0f0f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.stat-card:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.stat-card.active {
  border-color: var(--primary-color);
  background: linear-gradient(135deg, #faf7f2, #fff);
}

.stat-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--primary-dark);
}

.stat-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background: #ef4444;
  color: #fff;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.filter-row {
  margin-bottom: 16px;
}

.filter-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #f5f5f5;
  border-radius: 10px;
  width: fit-content;
}

.filter-tab {
  padding: 6px 16px;
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  transition: all 0.2s;
}

.filter-tab:hover {
  color: var(--primary-dark);
}

.filter-tab.active {
  background: #fff;
  color: var(--primary-dark);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.notification-item:hover {
  border-color: var(--primary-color);
  background: #fafaf7;
}

.notification-item.unread {
  background: linear-gradient(135deg, #fffbeb, #fff);
  border-color: #fde68a;
}

.notification-item.unread:hover {
  background: #fffbeb;
}

.notif-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
  background: #f5f5f5;
}

.icon-annotation { background: #dbeafe; }
.icon-task { background: #fee2e2; }
.icon-comment { background: #d1fae5; }
.icon-review { background: #ede9fe; }
.icon-system { background: #fef3c7; }

.notif-content {
  flex: 1;
  min-width: 0;
}

.notif-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.notif-type-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.tag-annotation { background: #dbeafe; color: #1e40af; }
.tag-task { background: #fee2e2; color: #991b1b; }
.tag-comment { background: #d1fae5; color: #065f46; }
.tag-review { background: #ede9fe; color: #5b21b6; }
.tag-system { background: #fef3c7; color: #92400e; }

.notif-time {
  font-size: 12px;
  color: #999;
  margin-left: auto;
}

.notif-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--primary-dark);
  margin-bottom: 4px;
}

.notif-body {
  font-size: 13px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 4px;
}

.notif-sender {
  font-size: 12px;
  color: #aaa;
}

.notif-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.notification-item:hover .notif-actions {
  opacity: 1;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #e5e5e5;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: var(--primary-color);
  color: #fff;
  border-color: var(--primary-color);
}

.icon-btn.danger:hover {
  background: #ef4444;
  border-color: #ef4444;
}

.empty-state,
.loading-state {
  padding: 60px 20px;
  text-align: center;
  background: #fff;
  border-radius: 12px;
  border: 1px dashed #e5e5e5;
}

.empty-icon {
  font-size: 56px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-text {
  font-size: 18px;
  color: #666;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
  color: #aaa;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f0f0f0;
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
  padding: 16px;
}

.page-btn {
  padding: 8px 16px;
  border: 1px solid #e5e5e5;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--primary-color);
  color: var(--primary-dark);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: #888;
}
</style>
