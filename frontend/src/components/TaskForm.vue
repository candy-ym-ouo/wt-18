<template>
  <form @submit.prevent="handleSubmit">
    <div class="form-group">
      <label>任务标题 *</label>
      <input v-model="form.title" type="text" placeholder="请输入任务标题" required />
    </div>

    <div class="form-group">
      <label>任务描述</label>
      <textarea v-model="form.description" placeholder="请输入任务描述"></textarea>
    </div>

    <div class="grid cols-2">
      <div class="form-group">
        <label>优先级</label>
        <select v-model="form.priority">
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="urgent">紧急</option>
        </select>
      </div>

      <div class="form-group">
        <label>状态</label>
        <select v-model="form.status">
          <option value="todo">待办</option>
          <option value="in_progress">进行中</option>
          <option value="review">审核中</option>
          <option value="done">已完成</option>
        </select>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="form-group">
        <label>关联词条</label>
        <select v-model="form.entryId" @change="onEntryChange">
          <option :value="null">不关联</option>
          <option v-for="entry in entries" :key="entry.id" :value="entry.id">
            {{ entry.title }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label>关联版本</label>
        <select v-model="form.versionId" :disabled="!form.entryId">
          <option :value="null">不关联</option>
          <option v-for="version in availableVersions" :key="version.id" :value="version.id">
            {{ version.version_name }}
          </option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label>截止时间</label>
      <input v-model="form.dueDate" type="date" />
    </div>

    <div class="form-group">
      <label>指派给</label>
      <div class="assignee-checkboxes">
        <label v-for="user in users" :key="user.id" class="assignee-item">
          <input type="checkbox" :value="user.id" v-model="form.assigneeIds" />
          <span class="user-avatar">{{ (user.display_name || user.username).charAt(0).toUpperCase() }}</span>
          <span class="user-name">{{ user.display_name || user.username }}</span>
        </label>
      </div>
    </div>

    <div style="text-align: right; margin-top: 20px;">
      <button type="button" class="btn secondary" style="margin-right: 8px;" @click="$emit('cancel')">
        取消
      </button>
      <button type="submit" class="btn" :disabled="loading">
        {{ loading ? '提交中...' : (task ? '保存修改' : '创建任务') }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref, computed, watch, reactive } from 'vue';
import { versionsAPI } from '../api';

const props = defineProps({
  task: Object,
  entries: {
    type: Array,
    default: () => []
  },
  users: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['submit', 'cancel']);

const loading = ref(false);
const entryVersions = ref({});

const form = reactive({
  title: props.task?.title || '',
  description: props.task?.description || '',
  priority: props.task?.priority || 'medium',
  status: props.task?.status || 'todo',
  entryId: props.task?.entry_id || null,
  versionId: props.task?.version_id || null,
  dueDate: props.task?.due_date ? props.task.due_date.split('T')[0] : '',
  assigneeIds: props.task?.assignees?.map(a => a.id) || []
});

const availableVersions = computed(() => {
  if (!form.entryId) return [];
  return entryVersions.value[form.entryId] || [];
});

async function loadEntryVersions(entryId) {
  if (!entryId || entryVersions.value[entryId]) return;
  try {
    const res = await versionsAPI.listByEntry(entryId);
    entryVersions.value[entryId] = res.data;
  } catch (e) {
    console.error('加载版本列表失败:', e);
  }
}

function onEntryChange() {
  form.versionId = null;
  if (form.entryId) {
    loadEntryVersions(form.entryId);
  }
}

async function handleSubmit() {
  if (!form.title.trim()) {
    alert('请输入任务标题');
    return;
  }

  loading.value = true;
  try {
    const submitData = {
      title: form.title.trim(),
      description: form.description || '',
      priority: form.priority,
      status: form.status,
      entryId: form.entryId || null,
      versionId: form.versionId || null,
      dueDate: form.dueDate || null,
      assigneeIds: form.assigneeIds
    };
    emit('submit', submitData);
  } finally {
    loading.value = false;
  }
}

watch(() => props.task, (newTask) => {
  if (newTask) {
    form.title = newTask.title || '';
    form.description = newTask.description || '';
    form.priority = newTask.priority || 'medium';
    form.status = newTask.status || 'todo';
    form.entryId = newTask.entry_id || null;
    form.versionId = newTask.version_id || null;
    form.dueDate = newTask.due_date ? newTask.due_date.split('T')[0] : '';
    form.assigneeIds = newTask.assignees?.map(a => a.id) || [];
    if (form.entryId) {
      loadEntryVersions(form.entryId);
    }
  }
}, { immediate: true });
</script>

<style scoped>
.assignee-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  max-height: 150px;
  overflow-y: auto;
  padding: 8px;
  background: #fffaf2;
  border: 1px solid var(--border);
  border-radius: 4px;
}

.assignee-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 20px;
  cursor: pointer;
  transition: background 0.15s;
}

.assignee-item:hover {
  background: rgba(139, 90, 43, 0.08);
}

.assignee-item input[type="checkbox"] {
  cursor: pointer;
}

.user-avatar {
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
}

.user-name {
  font-size: 13px;
  color: var(--text);
}
</style>
