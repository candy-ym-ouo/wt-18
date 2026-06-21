<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">📝 校勘工作台</h1>
        <p class="meta">段落级对读 · 差异标注 · 结论沉淀 · 任务流转</p>
      </div>
      <div class="header-actions">
        <select v-model="filterStatus" class="filter-select">
          <option value="">全部状态</option>
          <option v-for="s in statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
        <button v-if="canEdit" class="btn" @click="showCreateModal = true">+ 新建校勘</button>
      </div>
    </div>

    <div v-if="!selectedTaskId" class="task-list">
      <div v-if="collationTasks.length === 0" class="card empty-state">
        <p style="font-size:16px;color:var(--text-muted);">暂无校勘任务</p>
        <p v-if="canEdit" class="meta" style="margin-top:8px;">点击右上角「新建校勘」开始</p>
      </div>
      <div v-for="task in collationTasks" :key="task.id" class="task-card card" @click="selectTask(task.id)">
        <div class="task-card-header">
          <h3 class="task-title">{{ task.title }}</h3>
          <span class="status-badge" :class="'status-' + task.status">
            {{ getStatusLabel(task.status) }}
          </span>
        </div>
        <p v-if="task.description" class="task-desc">{{ task.description }}</p>
        <div class="task-meta-row">
          <span class="meta">📚 {{ task.entry?.title }}</span>
          <span class="meta">📖 底本: {{ task.base_version?.version_name }}</span>
          <span class="meta">校本: {{ task.target_versions?.map(v => v.version_name).join('、') }}</span>
        </div>
        <div class="task-stats">
          <span class="stat-item">📝 段落 {{ task.paragraph_count || 0 }}</span>
          <span class="stat-item">🔍 差异 {{ task.diff_count || 0 }}</span>
          <span class="stat-item">✅ 结论 {{ task.conclusion_count || 0 }}</span>
          <span class="stat-item">👤 {{ task.creator?.display_name || task.creator?.username }}</span>
          <span class="stat-item">{{ task.updated_at }}</span>
        </div>
      </div>
    </div>

    <div v-else class="workbench-container">
      <div class="workbench-sidebar">
        <button class="btn secondary sm back-btn" @click="selectedTaskId = null">← 返回列表</button>
        <div v-if="currentTask" class="task-info-card card">
          <h3>{{ currentTask.title }}</h3>
          <p v-if="currentTask.description" class="meta" style="margin-top:6px;">{{ currentTask.description }}</p>
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">状态</span>
              <span class="status-badge" :class="'status-' + currentTask.status">
                {{ getStatusLabel(currentTask.status) }}
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">词条</span>
              <span>{{ currentTask.entry?.title }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">底本</span>
              <span>{{ currentTask.base_version?.version_name }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">校本</span>
              <span>{{ currentTask.target_versions?.map(v => v.version_name).join('、') }}</span>
            </div>
          </div>
          <div v-if="canEdit" class="sidebar-actions">
            <select v-model="newStatus" class="filter-select sm" style="width:100%;margin-bottom:8px;">
              <option v-for="s in statuses" :key="s.value" :value="s.value">更改状态: {{ s.label }}</option>
            </select>
            <button class="btn sm secondary" style="width:100%;" @click="updateTaskStatus">更新状态</button>
          </div>
        </div>

        <div class="paragraph-nav card">
          <h4 style="color:var(--primary-dark);margin-bottom:10px;">📋 段落导航</h4>
          <div class="para-list">
            <div
              v-for="(p, idx) in paragraphs"
              :key="idx"
              class="para-nav-item"
              :class="{ active: currentParaIndex === idx, 'has-diff': hasDiffAt(idx) }"
              @click="currentParaIndex = idx"
            >
              <span class="para-num">第{{ idx + 1 }}段</span>
              <span v-if="hasDiffAt(idx)" class="diff-dot"></span>
            </div>
          </div>
        </div>
      </div>

      <div class="workbench-main">
        <ParagraphCompare
          v-if="paragraphs[currentParaIndex]"
          :paragraph-group="paragraphs[currentParaIndex]"
          :paragraph-index="currentParaIndex"
          :diffs="currentParagraphDiffs"
          :base-version-id="currentTask?.base_version_id"
          :target-versions="currentTask?.target_versions || []"
          :can-edit="canEdit"
          @create-diff="handleCreateDiff"
          @update-diff="handleUpdateDiff"
          @delete-diff="handleDeleteDiff"
        />

        <div v-if="paragraphs[currentParaIndex]" style="margin-top:16px;">
          <ConclusionPanel
            :collation-task-id="selectedTaskId"
            :paragraph-index="currentParaIndex"
            :diffs="currentParagraphDiffs"
            :conclusions="currentParagraphConclusions"
            :conclusion-types="conclusionTypes"
            :conclusion-statuses="conclusionStatuses"
            :can-edit="canEdit"
            :can-review="canReview"
            @create-conclusion="handleCreateConclusion"
            @update-conclusion="handleUpdateConclusion"
            @review-conclusion="handleReviewConclusion"
            @delete-conclusion="handleDeleteConclusion"
          />
        </div>
      </div>
    </div>

    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal">
        <h3>新建校勘任务</h3>
        <div class="form-group">
          <label>选择词条</label>
          <select v-model="createForm.entryId" @change="loadVersionsForEntry">
            <option :value="null">请选择词条</option>
            <option v-for="e in entries" :key="e.id" :value="e.id">{{ e.title }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>校勘标题</label>
          <input v-model="createForm.title" placeholder="如：红楼梦程甲本与程乙本对校" />
        </div>
        <div class="form-group">
          <label>说明（可选）</label>
          <textarea v-model="createForm.description" placeholder="校勘说明、范围等"></textarea>
        </div>
        <div class="form-group">
          <label>选择底本（基准版本）</label>
          <select v-model="createForm.baseVersionId">
            <option :value="null">请选择底本</option>
            <option v-for="v in entryVersions" :key="v.id" :value="v.id">{{ v.version_name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>选择校本（可多选）</label>
          <div class="version-checkboxes">
            <label v-for="v in entryVersions" :key="v.id" class="version-checkbox" :class="{ selected: createForm.targetVersionIds.includes(v.id) }">
              <input type="checkbox" :value="v.id" v-model="createForm.targetVersionIds" :disabled="v.id == createForm.baseVersionId" />
              <span>{{ v.version_name }}</span>
            </label>
          </div>
        </div>
        <div class="form-group" v-if="tasks.length > 0">
          <label>关联任务（可选）</label>
          <select v-model="createForm.taskId">
            <option :value="null">不关联</option>
            <option v-for="t in tasks" :key="t.id" :value="t.id">{{ t.title }}</option>
          </select>
        </div>
        <div style="text-align:right;margin-top:16px;">
          <button class="btn secondary" style="margin-right:8px;" @click="showCreateModal = false">取消</button>
          <button class="btn" @click="handleCreateTask" :disabled="createLoading">
            {{ createLoading ? '创建中...' : '创建校勘' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { collationAPI, entriesAPI, versionsAPI, tasksAPI, handleApiError, ROLES, hasRoleLevel } from '../api';
import { useUserStore } from '../stores/user';
import ParagraphCompare from '../components/ParagraphCompare.vue';
import ConclusionPanel from '../components/ConclusionPanel.vue';

const userStore = useUserStore();

const collationTasks = ref([]);
const selectedTaskId = ref(null);
const currentTask = ref(null);
const paragraphs = ref([]);
const diffs = ref([]);
const conclusions = ref([]);
const currentParaIndex = ref(0);
const showCreateModal = ref(false);
const createLoading = ref(false);
const statuses = ref([]);
const diffTypes = ref([]);
const conclusionTypes = ref([]);
const conclusionStatuses = ref([]);
const newStatus = ref('');

const entries = ref([]);
const entryVersions = ref([]);
const tasks = ref([]);
const createForm = ref({
  entryId: null,
  title: '',
  description: '',
  baseVersionId: null,
  targetVersionIds: [],
  taskId: null
});

const canEdit = computed(() => hasRoleLevel(userStore.user, ROLES.EDITOR));
const canReview = computed(() => hasRoleLevel(userStore.user, ROLES.EDITOR));
const filterStatus = ref('');

const currentParagraphDiffs = computed(() =>
  diffs.value.filter(d => d.paragraph_index === currentParaIndex.value)
);

const currentParagraphConclusions = computed(() =>
  conclusions.value.filter(c => c.paragraph_index === currentParaIndex.value || c.diff_id && diffs.value.find(d => d.id === c.diff_id)?.paragraph_index === currentParaIndex.value)
);

function getStatusLabel(status) {
  const s = statuses.value.find(x => x.value === status);
  return s ? s.label : status;
}

function hasDiffAt(idx) {
  return diffs.value.some(d => d.paragraph_index === idx);
}

async function loadTasks() {
  try {
    const params = {};
    if (filterStatus.value) params.status = filterStatus.value;
    const res = await collationAPI.list(params);
    collationTasks.value = res.data;
  } catch (e) {
    console.error('加载校勘任务失败:', e);
  }
}

async function loadEnums() {
  try {
    const [s, dt, ct, cs] = await Promise.all([
      collationAPI.statuses(),
      collationAPI.diffTypes(),
      collationAPI.conclusionTypes(),
      collationAPI.conclusionStatuses()
    ]);
    statuses.value = s.data;
    diffTypes.value = dt.data;
    conclusionTypes.value = ct.data;
    conclusionStatuses.value = cs.data;
  } catch (e) {
    console.error('加载枚举失败:', e);
  }
}

async function selectTask(id) {
  selectedTaskId.value = id;
  currentParaIndex.value = 0;
  try {
    const [task, paras, d, c] = await Promise.all([
      collationAPI.get(id),
      collationAPI.getParagraphs(id),
      collationAPI.getDiffs(id),
      collationAPI.getConclusions(id)
    ]);
    currentTask.value = task.data;
    paragraphs.value = paras.data;
    diffs.value = d.data;
    conclusions.value = c.data;
    newStatus.value = task.data.status;
  } catch (e) {
    console.error('加载校勘详情失败:', e);
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

async function loadVersionsForEntry() {
  createForm.value.baseVersionId = null;
  createForm.value.targetVersionIds = [];
  if (!createForm.value.entryId) {
    entryVersions.value = [];
    return;
  }
  try {
    const res = await versionsAPI.listByEntry(createForm.value.entryId);
    entryVersions.value = res.data;
  } catch (e) {
    console.error('加载版本失败:', e);
  }
}

async function loadAllTasks() {
  try {
    const res = await tasksAPI.list();
    tasks.value = res.data;
  } catch (e) {
    console.error('加载任务失败:', e);
  }
}

async function handleCreateTask() {
  if (!createForm.value.entryId || !createForm.value.title.trim() || !createForm.value.baseVersionId || createForm.value.targetVersionIds.length === 0) {
    alert('请填写完整信息：词条、标题、底本、至少一个校本');
    return;
  }
  createLoading.value = true;
  try {
    const res = await collationAPI.create(createForm.value);
    showCreateModal.value = false;
    createForm.value = { entryId: null, title: '', description: '', baseVersionId: null, targetVersionIds: [], taskId: null };
    await loadTasks();
    selectTask(res.data.id);
  } catch (e) {
    alert(handleApiError(e, '创建校勘任务失败'));
  } finally {
    createLoading.value = false;
  }
}

async function updateTaskStatus() {
  if (!newStatus.value || newStatus.value === currentTask.value.status) return;
  try {
    const res = await collationAPI.updateStatus(selectedTaskId.value, newStatus.value);
    currentTask.value = res.data;
  } catch (e) {
    alert(handleApiError(e, '更新状态失败'));
  }
}

async function handleCreateDiff(data) {
  try {
    const res = await collationAPI.createDiff(selectedTaskId.value, data);
    diffs.value.push(res.data);
  } catch (e) {
    alert(handleApiError(e, '创建差异标注失败'));
  }
}

async function handleUpdateDiff(diffId, data) {
  try {
    const res = await collationAPI.updateDiff(selectedTaskId.value, diffId, data);
    const idx = diffs.value.findIndex(d => d.id === diffId);
    if (idx !== -1) diffs.value[idx] = res.data;
  } catch (e) {
    alert(handleApiError(e, '更新差异标注失败'));
  }
}

async function handleDeleteDiff(diffId) {
  if (!confirm('确定删除此差异标注？')) return;
  try {
    await collationAPI.removeDiff(selectedTaskId.value, diffId);
    diffs.value = diffs.value.filter(d => d.id !== diffId);
  } catch (e) {
    alert(handleApiError(e, '删除差异标注失败'));
  }
}

async function handleCreateConclusion(data) {
  try {
    const res = await collationAPI.createConclusion(selectedTaskId.value, data);
    conclusions.value.push(res.data);
  } catch (e) {
    alert(handleApiError(e, '创建结论失败'));
  }
}

async function handleUpdateConclusion(conclusionId, data) {
  try {
    const res = await collationAPI.updateConclusion(selectedTaskId.value, conclusionId, data);
    const idx = conclusions.value.findIndex(c => c.id === conclusionId);
    if (idx !== -1) conclusions.value[idx] = res.data;
  } catch (e) {
    alert(handleApiError(e, '更新结论失败'));
  }
}

async function handleReviewConclusion(conclusionId, data) {
  try {
    const res = await collationAPI.reviewConclusion(selectedTaskId.value, conclusionId, data);
    const idx = conclusions.value.findIndex(c => c.id === conclusionId);
    if (idx !== -1) conclusions.value[idx] = res.data;
  } catch (e) {
    alert(handleApiError(e, '审核结论失败'));
  }
}

async function handleDeleteConclusion(conclusionId) {
  if (!confirm('确定删除此结论？')) return;
  try {
    await collationAPI.removeConclusion(selectedTaskId.value, conclusionId);
    conclusions.value = conclusions.value.filter(c => c.id !== conclusionId);
  } catch (e) {
    alert(handleApiError(e, '删除结论失败'));
  }
}

watch(filterStatus, () => loadTasks());

onMounted(() => {
  loadTasks();
  loadEnums();
  loadEntries();
  loadAllTasks();
});
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 20px;
}

.header-actions {
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

.filter-select.sm {
  padding: 4px 8px;
  font-size: 13px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.task-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.task-card {
  cursor: pointer;
  transition: all 0.2s;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(139, 90, 43, 0.15);
}

.task-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.task-title {
  font-size: 17px;
  color: var(--primary-dark);
  margin: 0;
}

.task-desc {
  color: var(--text-muted);
  font-size: 13px;
  margin-bottom: 10px;
  line-height: 1.6;
}

.task-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--border);
}

.task-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.stat-item {
  font-size: 12px;
  color: var(--text-muted);
}

.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-draft { background: #e0e0e0; color: #616161; }
.status-in_progress { background: #ffe0b2; color: #ef6c00; }
.status-review { background: #e1bee7; color: #7b1fa2; }
.status-done { background: #c8e6c9; color: #388e3c; }
.status-archived { background: #b0bec5; color: #455a64; }

.workbench-container {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
  align-items: flex-start;
}

@media (max-width: 900px) {
  .workbench-container {
    grid-template-columns: 1fr;
  }
}

.workbench-sidebar {
  position: sticky;
  top: 16px;
}

.back-btn {
  margin-bottom: 12px;
}

.task-info-card h3 {
  color: var(--primary-dark);
  margin-bottom: 4px;
}

.info-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  font-size: 13px;
}

.info-label {
  color: var(--text-muted);
}

.sidebar-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}

.paragraph-nav {
  margin-top: 12px;
}

.para-list {
  max-height: 300px;
  overflow-y: auto;
}

.para-nav-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  margin-bottom: 2px;
  transition: background 0.15s;
}

.para-nav-item:hover {
  background: rgba(139, 90, 43, 0.06);
}

.para-nav-item.active {
  background: var(--primary);
  color: #fff;
}

.para-nav-item.has-diff:not(.active) {
  background: rgba(255, 152, 0, 0.1);
}

.diff-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff9800;
}

.para-nav-item.active .diff-dot {
  background: #fff;
}

.version-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.version-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  background: #fff;
}

.version-checkbox.selected {
  border-color: var(--primary);
  background: var(--bg);
}
</style>
