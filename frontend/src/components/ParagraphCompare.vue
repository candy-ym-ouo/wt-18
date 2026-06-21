<template>
  <div class="paragraph-compare">
    <div class="para-header">
      <h3 style="color:var(--primary-dark);margin:0;">第{{ paragraphIndex + 1 }}段 对读</h3>
      <button v-if="canEdit" class="btn sm secondary" @click="showDiffModal = true">+ 标注差异</button>
    </div>

    <div class="compare-grid" :style="{ gridTemplateColumns: `repeat(${versionIds.length}, 1fr)` }">
      <div v-for="vid in versionIds" :key="vid" class="compare-col">
        <div class="col-title" :class="{ 'is-base': vid === baseVersionId }">
          {{ getVersionName(vid) }}
          <span v-if="vid === baseVersionId" class="base-tag">底本</span>
        </div>
        <div class="col-content">
          <div class="text-display para-text">{{ paragraphGroup.versions[vid]?.content || '（该版本无此段落）' }}</div>
        </div>
      </div>
    </div>

    <div v-if="diffs.length > 0" class="diff-list">
      <h4 style="color:var(--primary-dark);margin-bottom:12px;">🔍 本段落差异标注 ({{ diffs.length }})</h4>
      <div v-for="diff in diffs" :key="diff.id" class="diff-card">
        <div class="diff-header">
          <span class="diff-type-tag" :class="'diff-' + diff.diff_type">{{ getDiffTypeLabel(diff.diff_type) }}</span>
          <span class="meta">{{ diff.target_version_name }} · {{ diff.creator_display_name || diff.creator_username }}</span>
          <div class="diff-actions" v-if="canEdit">
            <button class="btn sm secondary" @click="openEditDiff(diff)">编辑</button>
            <button class="btn sm danger" @click="$emit('delete-diff', diff.id)">删除</button>
          </div>
        </div>
        <div class="diff-content">
          <div class="diff-row">
            <span class="diff-label">底本原文：</span>
            <span class="diff-text base-text">{{ diff.base_text || '—' }}</span>
          </div>
          <div class="diff-row">
            <span class="diff-label">校本异文：</span>
            <span class="diff-text target-text">{{ diff.target_text || '—' }}</span>
          </div>
          <div v-if="diff.note" class="diff-row">
            <span class="diff-label">备注说明：</span>
            <span class="diff-note">{{ diff.note }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showDiffModal" class="modal-overlay" @click.self="closeDiffModal">
      <div class="modal">
        <h3>{{ editingDiff ? '编辑差异标注' : '新建差异标注' }}</h3>
        <div class="form-group">
          <label>差异类型</label>
          <select v-model="diffForm.diffType">
            <option v-for="t in diffTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>选择校本</label>
          <select v-model="diffForm.targetVersionId">
            <option v-for="v in targetVersions" :key="v.id" :value="v.id">{{ v.version_name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>底本原文</label>
          <textarea v-model="diffForm.baseText" placeholder="底本中的对应文字"></textarea>
        </div>
        <div class="form-group">
          <label>校本异文</label>
          <textarea v-model="diffForm.targetText" placeholder="校本中的差异文字"></textarea>
        </div>
        <div class="form-group">
          <label>备注说明（可选）</label>
          <textarea v-model="diffForm.note" placeholder="对差异的说明或初步分析"></textarea>
        </div>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="closeDiffModal">取消</button>
          <button class="btn" @click="submitDiff">{{ editingDiff ? '保存修改' : '创建标注' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { collationAPI } from '../api';

const props = defineProps({
  paragraphGroup: { type: Object, required: true },
  paragraphIndex: { type: Number, required: true },
  diffs: { type: Array, default: () => [] },
  baseVersionId: { type: Number, required: true },
  targetVersions: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false }
});

const emit = defineEmits(['create-diff', 'update-diff', 'delete-diff']);

const showDiffModal = ref(false);
const editingDiff = ref(null);
const diffTypes = ref([]);
const diffForm = ref({
  diffType: 'character',
  targetVersionId: null,
  baseText: '',
  targetText: '',
  note: ''
});

const versionIds = computed(() => {
  const ids = [props.baseVersionId];
  for (const v of props.targetVersions) {
    if (!ids.includes(v.id)) ids.push(v.id);
  }
  for (const vid of Object.keys(props.paragraphGroup.versions || {})) {
    const numId = Number(vid);
    if (!ids.includes(numId)) ids.push(numId);
  }
  return ids;
});

function getVersionName(vid) {
  if (vid === props.baseVersionId) {
    const base = props.paragraphGroup.versions[vid];
    return base?.version_name || '底本';
  }
  const v = props.targetVersions.find(x => x.id === vid);
  if (v) return v.version_name;
  const pv = props.paragraphGroup.versions[vid];
  return pv?.version_name || `版本${vid}`;
}

function getDiffTypeLabel(type) {
  const t = diffTypes.value.find(x => x.value === type);
  return t ? t.label : type;
}

function openEditDiff(diff) {
  editingDiff.value = diff;
  diffForm.value = {
    diffType: diff.diff_type,
    targetVersionId: diff.target_version_id,
    baseText: diff.base_text,
    targetText: diff.target_text,
    note: diff.note || ''
  };
  showDiffModal.value = true;
}

function closeDiffModal() {
  showDiffModal.value = false;
  editingDiff.value = null;
  diffForm.value = {
    diffType: 'character',
    targetVersionId: props.targetVersions[0]?.id || null,
    baseText: '',
    targetText: '',
    note: ''
  };
}

function submitDiff() {
  if (!diffForm.value.diffType || !diffForm.value.targetVersionId) {
    alert('请选择差异类型和校本');
    return;
  }
  const data = {
    paragraphIndex: props.paragraphIndex,
    diffType: diffForm.value.diffType,
    targetVersionId: diffForm.value.targetVersionId,
    baseText: diffForm.value.baseText,
    targetText: diffForm.value.targetText,
    note: diffForm.value.note
  };
  if (editingDiff.value) {
    emit('update-diff', editingDiff.value.id, data);
  } else {
    emit('create-diff', data);
  }
  closeDiffModal();
}

onMounted(async () => {
  try {
    const res = await collationAPI.diffTypes();
    diffTypes.value = res.data;
    if (props.targetVersions.length > 0) {
      diffForm.value.targetVersionId = props.targetVersions[0].id;
    }
  } catch (e) {
    console.error('加载差异类型失败:', e);
  }
});
</script>

<style scoped>
.paragraph-compare {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 20px;
}

.para-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--accent);
}

.compare-grid {
  display: grid;
  gap: 16px;
  margin-bottom: 20px;
}

.compare-col {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.col-title {
  text-align: center;
  padding: 10px;
  background: var(--primary);
  color: #fff;
  border-radius: 4px 4px 0 0;
  font-weight: bold;
  font-size: 14px;
}

.col-title.is-base {
  background: var(--primary-dark);
}

.base-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 6px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 3px;
  font-size: 11px;
  font-weight: normal;
}

.col-content {
  flex: 1;
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 4px 4px;
  background: #fffdf8;
}

.para-text {
  border: none;
  background: none;
  min-height: 120px;
}

.diff-list {
  border-top: 1px dashed var(--border);
  padding-top: 16px;
}

.diff-card {
  background: #fff;
  border: 1px solid var(--border);
  border-left: 4px solid var(--accent);
  border-radius: 4px;
  padding: 12px 16px;
  margin-bottom: 10px;
}

.diff-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.diff-type-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
}

.diff-character { background: #ef6c00; }
.diff-punctuation { background: #7b1fa2; }
.diff-wording { background: #1976d2; }
.diff-paragraph { background: #00796b; }
.diff-missing { background: #c62828; }
.diff-extra { background: #2e7d32; }
.diff-other { background: #546e7a; }

.diff-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}

.diff-content {
  font-size: 14px;
}

.diff-row {
  padding: 4px 0;
  display: flex;
  gap: 8px;
  line-height: 1.7;
}

.diff-label {
  color: var(--text-muted);
  flex-shrink: 0;
  min-width: 80px;
}

.diff-text {
  font-family: "Noto Serif SC", "Songti SC", serif;
}

.base-text {
  background: rgba(139, 90, 43, 0.1);
  padding: 1px 6px;
  border-radius: 3px;
}

.target-text {
  background: rgba(255, 152, 0, 0.15);
  padding: 1px 6px;
  border-radius: 3px;
}

.diff-note {
  color: var(--text);
}
</style>
