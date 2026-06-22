<template>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
      <h3 style="color:var(--primary-dark);margin:0;">标签管理</h3>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input v-model="searchKeyword" placeholder="搜索标签..." style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:180px;" />
        <select v-model="statusFilter" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;" @change="loadTags">
          <option value="">全部状态</option>
          <option value="active">激活</option>
          <option value="inactive">停用</option>
        </select>
        <button class="btn sm secondary" @click="openBatchModal">批量创建</button>
        <button class="btn sm" @click="openTagModal()">+ 新建标签</button>
      </div>
    </div>

    <div v-if="loading" style="text-align:center;padding:40px;color:#999;">加载中...</div>

    <table v-else>
      <thead>
        <tr>
          <th style="width:60px;">ID</th>
          <th>标签名称</th>
          <th style="width:100px;">颜色</th>
          <th style="width:80px;">词条</th>
          <th style="width:80px;">版本</th>
          <th style="width:100px;">总使用</th>
          <th style="width:80px;">状态</th>
          <th style="width:100px;">创建人</th>
          <th style="width:160px;">更新时间</th>
          <th style="width:200px;">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tag in filteredTags" :key="tag.id">
          <td>{{ tag.id }}</td>
          <td>
            <strong>{{ tag.name }}</strong>
            <div v-if="tag.slug" class="meta" style="font-size:11px;">slug: {{ tag.slug }}</div>
            <div v-if="tag.description" class="meta" style="font-size:11px;margin-top:2px;">{{ tag.description }}</div>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="color-preview" :style="{ backgroundColor: tag.color }"></span>
              <span class="meta" style="font-size:11px;">{{ tag.color }}</span>
            </div>
          </td>
          <td>{{ tag.entry_count || 0 }}</td>
          <td>{{ tag.version_count || 0 }}</td>
          <td><strong>{{ tag.usage_count || 0 }}</strong></td>
          <td>
            <span :class="['status-tag', tag.status==='active'?'status-active':'status-disabled']">
              {{ tag.status==='active' ? '激活' : '停用' }}
            </span>
          </td>
          <td class="meta">{{ tag.creator_id || '-' }}</td>
          <td class="meta">{{ tag.updated_at || tag.created_at }}</td>
          <td>
            <div class="actions">
              <button class="btn sm secondary" @click="openTagModal(tag)">编辑</button>
              <button class="btn sm secondary" @click="openMergeModal(tag)">合并</button>
              <button class="btn sm danger" @click="delTag(tag)">删除</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="!loading && filteredTags.length === 0" style="padding:30px;text-align:center;color:#999;">
      暂无标签
    </div>

    <div v-if="showTagModal" class="modal-overlay" @click.self="showTagModal=false">
      <div class="modal sm-modal">
        <h3>{{ editingTag.id ? '编辑标签' : '新建标签' }}</h3>
        <div class="form-group">
          <label>标签名称 *</label>
          <input v-model="editingTag.name" placeholder="输入标签名称" />
        </div>
        <div class="form-group">
          <label>别名 (slug)</label>
          <input v-model="editingTag.slug" placeholder="自动生成或自定义" />
        </div>
        <div class="form-group">
          <label>标签颜色</label>
          <div class="color-picker">
            <input type="color" v-model="editingTag.color" />
            <input v-model="editingTag.color" placeholder="#6366f1" style="flex:1;" />
          </div>
        </div>
        <div class="form-group">
          <label>状态</label>
          <select v-model="editingTag.status">
            <option value="active">激活</option>
            <option value="inactive">停用</option>
          </select>
        </div>
        <div class="form-group">
          <label>说明（选填）</label>
          <textarea v-model="editingTag.description" rows="2"></textarea>
        </div>
        <p v-if="formError" style="color:#dc2626;font-size:13px;">{{ formError }}</p>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showTagModal=false">取消</button>
          <button class="btn" @click="saveTag" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showBatchModal" class="modal-overlay" @click.self="showBatchModal=false">
      <div class="modal sm-modal">
        <h3>批量创建标签</h3>
        <p class="meta" style="font-size:13px;margin-bottom:12px;">
          每行输入一个标签名称，或用英文逗号分隔多个标签。
        </p>
        <div class="form-group">
          <label>标签名称列表 *</label>
          <textarea v-model="batchNames" rows="6" placeholder="古典名著&#10;世情小说&#10;脂评本,刻本,钞本"></textarea>
        </div>
        <p v-if="formError" style="color:#dc2626;font-size:13px;">{{ formError }}</p>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showBatchModal=false">取消</button>
          <button class="btn" @click="submitBatch" :disabled="saving">
            {{ saving ? '创建中...' : '批量创建' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showMergeModal" class="modal-overlay" @click.self="showMergeModal=false">
      <div class="modal sm-modal">
        <h3>合并标签</h3>
        <div class="card" style="background:#fef2f2;margin-bottom:16px;">
          <p style="margin:0 0 4px 0;color:#991b1b;font-size:13px;">
            将「<strong>{{ sourceTag?.name }}</strong>」合并到目标标签后：
          </p>
          <ul style="margin:4px 0 0 18px;color:#991b1b;font-size:12px;">
            <li>原标签「{{ sourceTag?.name }}」会被删除</li>
            <li>所有关联的词条和版本会转到目标标签</li>
            <li>此操作不可逆，请谨慎操作</li>
          </ul>
        </div>
        <div class="form-group">
          <label>选择目标标签 *</label>
          <select v-model="mergeTargetId">
            <option :value="null">-- 请选择目标标签 --</option>
            <option v-for="t in tags.filter(t => t.id !== sourceTag?.id)" :key="t.id" :value="t.id">
              {{ t.name }} ({{ t.usage_count || 0 }} 条)
            </option>
          </select>
        </div>
        <p v-if="formError" style="color:#dc2626;font-size:13px;">{{ formError }}</p>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showMergeModal=false">取消</button>
          <button class="btn danger" @click="submitMerge" :disabled="saving">
            {{ saving ? '合并中...' : '确认合并' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { tagsAPI, handleApiError } from '../api';

const tags = ref([]);
const loading = ref(false);
const saving = ref(false);
const searchKeyword = ref('');
const statusFilter = ref('');

const showTagModal = ref(false);
const showBatchModal = ref(false);
const showMergeModal = ref(false);

const editingTag = ref({ id: null, name: '', slug: '', color: '#6366f1', description: '', status: 'active' });
const batchNames = ref('');
const sourceTag = ref(null);
const mergeTargetId = ref(null);
const formError = ref('');

const filteredTags = computed(() => {
  let result = tags.value;
  if (searchKeyword.value) {
    const q = searchKeyword.value.toLowerCase();
    result = result.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.slug && t.slug.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  }
  if (statusFilter.value) {
    result = result.filter(t => t.status === statusFilter.value);
  }
  return result;
});

async function loadTags() {
  loading.value = true;
  try {
    const { data } = await tagsAPI.adminList();
    tags.value = data;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function openTagModal(tag = null) {
  formError.value = '';
  if (tag) {
    editingTag.value = {
      id: tag.id,
      name: tag.name,
      slug: tag.slug || '',
      color: tag.color || '#6366f1',
      description: tag.description || '',
      status: tag.status || 'active'
    };
  } else {
    editingTag.value = { id: null, name: '', slug: '', color: '#6366f1', description: '', status: 'active' };
  }
  showTagModal.value = true;
}

async function saveTag() {
  if (!editingTag.value.name.trim()) {
    formError.value = '请输入标签名称';
    return;
  }
  saving.value = true;
  formError.value = '';
  try {
    if (editingTag.value.id) {
      await tagsAPI.update(editingTag.value.id, editingTag.value);
    } else {
      await tagsAPI.create(editingTag.value);
    }
    showTagModal.value = false;
    loadTags();
  } catch (e) {
    formError.value = handleApiError(e, '保存失败');
  } finally {
    saving.value = false;
  }
}

function openBatchModal() {
  formError.value = '';
  batchNames.value = '';
  showBatchModal.value = true;
}

async function submitBatch() {
  const names = batchNames.value
    .split(/[\n,，]/)
    .map(n => n.trim())
    .filter(n => n);
  if (names.length === 0) {
    formError.value = '请输入至少一个标签名称';
    return;
  }
  saving.value = true;
  formError.value = '';
  try {
    await tagsAPI.batchCreate(names);
    showBatchModal.value = false;
    loadTags();
  } catch (e) {
    formError.value = handleApiError(e, '批量创建失败');
  } finally {
    saving.value = false;
  }
}

function openMergeModal(tag) {
  formError.value = '';
  sourceTag.value = tag;
  mergeTargetId.value = null;
  showMergeModal.value = true;
}

async function submitMerge() {
  if (!mergeTargetId.value) {
    formError.value = '请选择目标标签';
    return;
  }
  if (!confirm(`确认将「${sourceTag.value.name}」合并到目标标签？此操作不可撤销！`)) return;
  saving.value = true;
  formError.value = '';
  try {
    await tagsAPI.merge(sourceTag.value.id, mergeTargetId.value);
    showMergeModal.value = false;
    loadTags();
  } catch (e) {
    formError.value = handleApiError(e, '合并失败');
  } finally {
    saving.value = false;
  }
}

async function delTag(tag) {
  if (!confirm(`确认删除标签「${tag.name}」？已关联的标签关系也会被清除。`)) return;
  try {
    await tagsAPI.remove(tag.id);
    loadTags();
  } catch (e) {
    alert(handleApiError(e, '删除失败'));
  }
}

onMounted(() => {
  loadTags();
});

defineExpose({ loadTags });
</script>

<style scoped>
.color-preview {
  display: inline-block;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.color-picker {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-picker input[type="color"] {
  width: 40px;
  height: 36px;
  padding: 2px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
}

.sm-modal {
  max-width: 420px;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #374151;
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--primary);
  color: #fff;
}

.btn:hover:not(:disabled) {
  opacity: 0.9;
}

.btn.secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn.secondary:hover {
  background: #e5e7eb;
}

.btn.danger {
  background: #dc2626;
  color: #fff;
}

.btn.sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

h3 {
  margin: 0 0 16px 0;
  color: #1f2937;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

thead {
  background: #f9fafb;
}

th {
  padding: 10px 12px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
}

td {
  padding: 10px 12px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
}

tr:last-child td {
  border-bottom: none;
}

tr:hover {
  background: #f9fafb;
}

.actions {
  display: flex;
  gap: 4px;
}

.status-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.status-active {
  background: #dcfce7;
  color: #166534;
}

.status-disabled {
  background: #fee2e2;
  color: #991b1b;
}

.meta {
  color: #6b7280;
}

.card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
}
</style>
