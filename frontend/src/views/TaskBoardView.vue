<template>
  <div>
    <div class="board-header">
      <h2 class="page-title">📋 研究任务看板</h2>
      <div class="board-actions">
        <select v-model="filterAssignee" class="filter-select">
          <option :value="null">全部任务</option>
          <option :value="userStore.userId">我负责的</option>
        </select>
        <button class="btn" @click="openCreateModal">+ 新建任务</button>
      </div>
    </div>

    <div class="board-container">
      <div v-for="column in columns" :key="column.status" class="board-column">
        <div class="column-header" :class="column.status">
          <span class="column-title">{{ column.label }}</span>
          <span class="column-count">{{ board[column.status]?.length || 0 }}</span>
        </div>
        <div class="column-content">
          <div
            v-for="task in board[column.status]"
            :key="task.id"
            class="task-card"
            :class="'priority-' + task.priority"
            draggable="true"
            @dragstart="onDragStart($event, task)"
            @dragover.prevent
            @drop="onDrop($event, column.status)"
            @click="openTaskDetail(task)"
          >
            <div class="task-priority-bar" :class="'priority-' + task.priority"></div>
            <div class="task-content">
              <h4 class="task-title">{{ task.title }}</h4>
              <p v-if="task.description" class="task-desc">{{ truncate(task.description, 60) }}</p>
              <div class="task-meta">
                <span v-if="task.entry" class="task-tag entry-tag">
                  📚 {{ task.entry.title }}
                </span>
                <span v-if="task.version" class="task-tag version-tag">
                  📖 {{ task.version.version_name }}
                </span>
              </div>
              <div class="task-footer">
                <div class="task-assignees">
                  <span
                    v-for="assignee in task.assignees"
                    :key="assignee.id"
                    class="assignee-avatar"
                    :title="assignee.display_name || assignee.username"
                  >
                    {{ (assignee.display_name || assignee.username).charAt(0).toUpperCase() }}
                  </span>
                </div>
                <div class="task-info">
                  <span v-if="task.due_date" class="due-date" :class="{ overdue: isOverdue(task) }">
                    📅 {{ formatDate(task.due_date) }}
                  </span>
                  <span class="comment-count">💬 {{ task.commentCount || 0 }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="!board[column.status]?.length" class="empty-column">
            暂无任务
          </div>
        </div>
      </div>
    </div>

    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal lg-modal">
        <h3>新建任务</h3>
        <TaskForm
          :entries="entries"
          :users="users"
          @submit="handleCreateTask"
          @cancel="showCreateModal = false"
        />
      </div>
    </div>

    <div v-if="showDetailModal && selectedTask" class="modal-overlay" @click.self="showDetailModal = false">
      <div class="modal lg-modal">
        <TaskDetail
          :task="selectedTask"
          :entries="entries"
          :users="users"
          :current-user-id="userStore.userId"
          @updated="handleTaskUpdated"
          @deleted="handleTaskDeleted"
          @close="showDetailModal = false"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { tasksAPI, entriesAPI, adminAPI, handleApiError, ROLES, hasRoleLevel } from '../api';
import { useUserStore } from '../stores/user';
import TaskForm from '../components/TaskForm.vue';
import TaskDetail from '../components/TaskDetail.vue';

const userStore = useUserStore();
const router = useRouter();

const board = ref({});
const entries = ref([]);
const users = ref([]);
const filterAssignee = ref(null);
const showCreateModal = ref(false);
const showDetailModal = ref(false);
const selectedTask = ref(null);
const draggedTask = ref(null);

const columns = [
  { status: 'todo', label: '待办' },
  { status: 'in_progress', label: '进行中' },
  { status: 'review', label: '审核中' },
  { status: 'done', label: '已完成' }
];

const canEdit = computed(() => hasRoleLevel(userStore.user, ROLES.EDITOR));

async function loadBoard() {
  try {
    const params = {};
    if (filterAssignee.value) {
      params.assigneeId = filterAssignee.value;
    }
    const res = await tasksAPI.board(params);
    board.value = res.data;
  } catch (e) {
    console.error('加载看板失败:', e);
  }
}

async function loadEntries() {
  try {
    const res = await entriesAPI.list();
    entries.value = res.data;
  } catch (e) {
    console.error('加载词条失败:', e);
  }
}

async function loadUsers() {
  try {
    const res = await adminAPI.users();
    users.value = res.data;
  } catch (e) {
    console.error('加载用户失败:', e);
  }
}

function openCreateModal() {
  if (!canEdit.value) {
    alert('您没有创建任务的权限');
    return;
  }
  showCreateModal.value = true;
}

function openTaskDetail(task) {
  selectedTask.value = task;
  showDetailModal.value = true;
}

async function handleCreateTask(taskData) {
  try {
    await tasksAPI.create(taskData);
    showCreateModal.value = false;
    loadBoard();
  } catch (e) {
    alert(handleApiError(e, '创建任务失败'));
  }
}

function handleTaskUpdated(updatedTask) {
  loadBoard();
  selectedTask.value = updatedTask;
}

function handleTaskDeleted() {
  showDetailModal.value = false;
  selectedTask.value = null;
  loadBoard();
}

function onDragStart(event, task) {
  if (!canEdit.value) {
    event.preventDefault();
    return;
  }
  draggedTask.value = task;
  event.dataTransfer.effectAllowed = 'move';
}

async function onDrop(event, targetStatus) {
  event.preventDefault();
  if (!draggedTask.value || !canEdit.value) return;

  const task = draggedTask.value;
  if (task.status === targetStatus) {
    draggedTask.value = null;
    return;
  }

  try {
    await tasksAPI.updateStatus(task.id, targetStatus);
    loadBoard();
  } catch (e) {
    alert(handleApiError(e, '更新任务状态失败'));
  } finally {
    draggedTask.value = null;
  }
}

function truncate(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function isOverdue(task) {
  if (!task.due_date || task.status === 'done') return false;
  return new Date(task.due_date) < new Date();
}

onMounted(() => {
  loadBoard();
  loadEntries();
  loadUsers();
});
</script>

<style scoped>
.board-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.board-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: #fff;
  font-size: 14px;
  font-family: inherit;
}

.board-container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  min-height: 500px;
}

@media (max-width: 1200px) {
  .board-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .board-container {
    grid-template-columns: 1fr;
  }
}

.board-column {
  background: rgba(139, 90, 43, 0.03);
  border-radius: 8px;
  padding: 12px;
  min-height: 400px;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-weight: 600;
}

.column-header.todo {
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  color: #1565c0;
}

.column-header.in_progress {
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
  color: #ef6c00;
}

.column-header.review {
  background: linear-gradient(135deg, #f3e5f5, #e1bee7);
  color: #7b1fa2;
}

.column-header.done {
  background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
  color: #388e3c;
}

.column-count {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.column-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: grab;
  transition: all 0.2s;
  overflow: hidden;
  position: relative;
}

.task-card:active {
  cursor: grabbing;
}

.task-card:hover {
  box-shadow: 0 4px 12px rgba(139, 90, 43, 0.15);
  transform: translateY(-2px);
}

.task-priority-bar {
  height: 4px;
  width: 100%;
}

.task-priority-bar.priority-low {
  background: #90caf9;
}

.task-priority-bar.priority-medium {
  background: #ffd54f;
}

.task-priority-bar.priority-high {
  background: #ff8a65;
}

.task-priority-bar.priority-urgent {
  background: #ef5350;
}

.task-content {
  padding: 12px;
}

.task-title {
  font-size: 15px;
  color: var(--primary-dark);
  margin-bottom: 6px;
  line-height: 1.4;
}

.task-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 8px;
  line-height: 1.5;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.task-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.entry-tag {
  background: rgba(139, 90, 43, 0.1);
  color: var(--primary-dark);
}

.version-tag {
  background: rgba(212, 165, 116, 0.2);
  color: var(--primary);
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.task-assignees {
  display: flex;
  gap: -4px;
}

.assignee-avatar {
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #d4a574, #8b5a2b);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  border: 2px solid #fff;
  margin-left: -6px;
}

.assignee-avatar:first-child {
  margin-left: 0;
}

.task-info {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--text-muted);
}

.due-date.overdue {
  color: #e53935;
  font-weight: 600;
}

.empty-column {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 14px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 6px;
  border: 2px dashed var(--border);
}

.lg-modal {
  max-width: 700px;
}
</style>
