<template>
  <div class="task-detail">
    <div class="detail-header">
      <div class="header-left">
        <span class="priority-badge" :class="'priority-' + task.priority">
          {{ priorityLabel }}
        </span>
        <span class="status-badge" :class="'status-' + task.status">
          {{ statusLabel }}
        </span>
      </div>
      <div class="header-right">
        <button v-if="canEdit" class="btn sm secondary" @click="showEditForm = !showEditForm">
          {{ showEditForm ? '取消编辑' : '编辑' }}
        </button>
        <button v-if="canEdit" class="btn sm danger" @click="handleDelete">
          删除
        </button>
        <button class="btn sm secondary" @click="$emit('close')">
          关闭
        </button>
      </div>
    </div>

    <div v-if="showEditForm" class="edit-form-section">
      <TaskForm
        :task="task"
        :entries="entries"
        :users="users"
        @submit="handleUpdate"
        @cancel="showEditForm = false"
      />
    </div>

    <div v-else class="detail-content">
      <h3 class="task-title">{{ task.title }}</h3>
      <p v-if="task.description" class="task-description">{{ task.description }}</p>

      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">创建者</span>
          <span class="info-value">
            <span class="mini-avatar">{{ (task.creator?.display_name || task.creator?.username || '?').charAt(0).toUpperCase() }}</span>
            {{ task.creator?.display_name || task.creator?.username || '未知' }}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">截止时间</span>
          <span class="info-value" :class="{ overdue: isOverdue }">
            {{ task.due_date ? formatFullDate(task.due_date) : '未设置' }}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">关联词条</span>
          <span class="info-value">
            <router-link v-if="task.entry" :to="`/entries/${task.entry.id}`" class="entry-link">
              📚 {{ task.entry.title }}
            </router-link>
            <span v-else class="text-muted">无</span>
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">关联版本</span>
          <span class="info-value">
            <router-link v-if="task.version" :to="`/versions/${task.version.id}`" class="entry-link">
              📖 {{ task.version.version_name }}
            </router-link>
            <span v-else class="text-muted">无</span>
          </span>
        </div>
        <div class="info-item full-width">
          <span class="info-label">负责人</span>
          <div class="assignees-list">
            <span v-if="task.assignees?.length === 0" class="text-muted">暂未指派</span>
            <span
              v-for="assignee in task.assignees"
              :key="assignee.id"
              class="assignee-tag"
            >
              <span class="mini-avatar">{{ (assignee.display_name || assignee.username).charAt(0).toUpperCase() }}</span>
              {{ assignee.display_name || assignee.username }}
            </span>
          </div>
        </div>
      </div>

      <div class="time-info">
        <span>创建于 {{ formatFullDate(task.created_at) }}</span>
        <span v-if="task.updated_at !== task.created_at">
          · 更新于 {{ formatFullDate(task.updated_at) }}
        </span>
      </div>
    </div>

    <div class="comments-section">
      <h4 class="section-title">💬 讨论记录 ({{ comments.length }})</h4>

      <div class="comment-input">
        <textarea
          v-model="newComment"
          placeholder="发表评论..."
          rows="3"
          @keydown.ctrl.enter="handleAddComment"
        ></textarea>
        <div class="comment-actions">
          <span class="hint">按 Ctrl+Enter 发送</span>
          <button class="btn sm" @click="handleAddComment" :disabled="!newComment.trim() || loading">
            {{ loading ? '发送中...' : '发送' }}
          </button>
        </div>
      </div>

      <div class="comments-list">
        <div v-if="comments.length === 0" class="empty-comments">
          暂无讨论，快来发表第一条评论吧！
        </div>
        <div v-for="comment in comments" :key="comment.id" class="comment-item">
          <div class="comment-avatar">
            {{ (comment.display_name || comment.username || '?').charAt(0).toUpperCase() }}
          </div>
          <div class="comment-body">
            <div class="comment-header">
              <span class="comment-author">{{ comment.display_name || comment.username }}</span>
              <span class="comment-time">{{ formatFullDate(comment.created_at) }}</span>
            </div>
            <div class="comment-content">{{ comment.content }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { tasksAPI, handleApiError, ROLES, hasRoleLevel } from '../api';
import { useUserStore } from '../stores/user';
import TaskForm from './TaskForm.vue';

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  entries: {
    type: Array,
    default: () => []
  },
  users: {
    type: Array,
    default: () => []
  },
  currentUserId: Number
});

const emit = defineEmits(['updated', 'deleted', 'close']);

const userStore = useUserStore();

const comments = ref([]);
const newComment = ref('');
const loading = ref(false);
const showEditForm = ref(false);

const canEdit = computed(() => hasRoleLevel(userStore.user, ROLES.EDITOR));

const priorityLabel = computed(() => ({
  low: '低优先级',
  medium: '中优先级',
  high: '高优先级',
  urgent: '紧急'
}[props.task.priority] || props.task.priority));

const statusLabel = computed(() => ({
  todo: '待办',
  in_progress: '进行中',
  review: '审核中',
  done: '已完成'
}[props.task.status] || props.task.status));

const isOverdue = computed(() => {
  if (!props.task.due_date || props.task.status === 'done') return false;
  return new Date(props.task.due_date) < new Date();
});

async function loadComments() {
  try {
    const res = await tasksAPI.getComments(props.task.id);
    comments.value = res.data;
  } catch (e) {
    console.error('加载评论失败:', e);
  }
}

async function handleAddComment() {
  if (!newComment.value.trim()) return;

  loading.value = true;
  try {
    const res = await tasksAPI.addComment(props.task.id, newComment.value.trim());
    comments.value.push(res.data);
    newComment.value = '';
    emit('updated', { ...props.task, commentCount: (props.task.commentCount || 0) + 1 });
  } catch (e) {
    alert(handleApiError(e, '发表评论失败'));
  } finally {
    loading.value = false;
  }
}

async function handleUpdate(taskData) {
  try {
    const res = await tasksAPI.update(props.task.id, taskData);
    showEditForm.value = false;
    emit('updated', res.data);
  } catch (e) {
    alert(handleApiError(e, '更新任务失败'));
  }
}

async function handleDelete() {
  if (!confirm('确定要删除这个任务吗？此操作不可撤销。')) return;

  try {
    await tasksAPI.remove(props.task.id);
    emit('deleted');
  } catch (e) {
    alert(handleApiError(e, '删除任务失败'));
  }
}

function formatFullDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

watch(() => props.task.id, () => {
  loadComments();
}, { immediate: true });
</script>

<style scoped>
.task-detail {
  max-height: 75vh;
  overflow-y: auto;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  gap: 8px;
}

.header-right {
  display: flex;
  gap: 8px;
}

.priority-badge,
.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.priority-badge.priority-low {
  background: rgba(144, 202, 249, 0.2);
  color: #1565c0;
}

.priority-badge.priority-medium {
  background: rgba(255, 213, 79, 0.2);
  color: #f57f17;
}

.priority-badge.priority-high {
  background: rgba(255, 138, 101, 0.2);
  color: #e64a19;
}

.priority-badge.priority-urgent {
  background: rgba(239, 83, 80, 0.2);
  color: #c62828;
}

.status-badge.status-todo {
  background: rgba(187, 222, 251, 0.3);
  color: #1565c0;
}

.status-badge.status-in_progress {
  background: rgba(255, 224, 178, 0.3);
  color: #ef6c00;
}

.status-badge.status-review {
  background: rgba(225, 190, 231, 0.3);
  color: #7b1fa2;
}

.status-badge.status-done {
  background: rgba(200, 230, 201, 0.3);
  color: #388e3c;
}

.detail-content {
  margin-bottom: 24px;
}

.task-title {
  font-size: 22px;
  color: var(--primary-dark);
  margin-bottom: 12px;
}

.task-description {
  color: var(--text);
  line-height: 1.8;
  margin-bottom: 20px;
  padding: 16px;
  background: #fffaf2;
  border-radius: 6px;
  border-left: 4px solid var(--accent);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item.full-width {
  grid-column: span 2;
}

.info-label {
  font-size: 12px;
  color: var(--text-muted);
}

.info-value {
  font-size: 14px;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-value.overdue {
  color: #e53935;
  font-weight: 600;
}

.mini-avatar {
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, #d4a574, #8b5a2b);
  color: #fff;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
}

.entry-link {
  color: var(--primary);
  text-decoration: none;
}

.entry-link:hover {
  text-decoration: underline;
}

.assignees-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.assignee-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: rgba(139, 90, 43, 0.08);
  border-radius: 16px;
  font-size: 13px;
}

.text-muted {
  color: var(--text-muted);
}

.time-info {
  font-size: 12px;
  color: var(--text-muted);
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.time-info span + span {
  margin-left: 8px;
}

.edit-form-section {
  margin-bottom: 24px;
}

.comments-section {
  border-top: 1px solid var(--border);
  padding-top: 20px;
}

.section-title {
  font-size: 16px;
  color: var(--primary-dark);
  margin-bottom: 16px;
}

.comment-input {
  margin-bottom: 20px;
}

.comment-input textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  margin-bottom: 8px;
}

.comment-input textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.comment-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-comments {
  text-align: center;
  padding: 30px;
  color: var(--text-muted);
  background: rgba(139, 90, 43, 0.03);
  border-radius: 6px;
}

.comment-item {
  display: flex;
  gap: 12px;
}

.comment-avatar {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #d4a574, #8b5a2b);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.comment-body {
  flex: 1;
  background: #fffaf2;
  padding: 12px 16px;
  border-radius: 6px;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.comment-author {
  font-weight: 600;
  color: var(--primary-dark);
  font-size: 14px;
}

.comment-time {
  font-size: 12px;
  color: var(--text-muted);
}

.comment-content {
  color: var(--text);
  line-height: 1.6;
  font-size: 14px;
  white-space: pre-wrap;
}
</style>
