<template>
  <div class="conclusion-panel card">
    <div class="panel-header">
      <h3 style="color:var(--primary-dark);margin:0;">📝 校勘结论 ({{ conclusions.length }})</h3>
      <button v-if="canEdit" class="btn sm secondary" @click="showCreateModal = true">+ 新增结论</button>
    </div>

    <div v-if="conclusions.length === 0" class="empty-state">
      <p class="meta">暂无校勘结论，点击「新增结论」沉淀你的校勘意见。</p>
    </div>

    <div v-for="c in conclusions" :key="c.id" class="conclusion-card">
      <div class="conclusion-header">
        <span class="conclusion-type-tag" :class="'type-' + c.conclusion_type">{{ getConclusionTypeLabel(c.conclusion_type) }}</span>
        <span class="status-tag" :class="'status-' + c.status">{{ getConclusionStatusLabel(c.status) }}</span>
        <span class="meta">{{ c.creator_display_name || c.creator_username }} · {{ c.created_at }}</span>
        <div v-if="c.reviewer_username" class="meta" style="margin-left:auto;">
          审核人: {{ c.reviewer_display_name || c.reviewer_username }} · {{ c.reviewed_at }}
        </div>
        <div class="conclusion-actions">
          <button v-if="canEdit" class="btn sm secondary" @click="openEdit(c)">编辑</button>
          <button v-if="canReview" class="btn sm" @click="openReview(c)">审核</button>
          <button v-if="canEdit" class="btn sm danger" @click="$emit('delete-conclusion', c.id)">删除</button>
        </div>
      </div>

      <div v-if="c.diff_id" class="conclusion-diff-ref">
        <span class="meta">关联差异：</span>
        <span class="diff-ref-text">
          {{ getDiffText(c.diff_id) }}
        </span>
      </div>

      <div class="conclusion-content">
        <div class="content-row">
          <span class="content-label">校勘意见：</span>
          <span class="content-text">{{ c.content }}</span>
        </div>
        <div v-if="c.evidence" class="content-row">
          <span class="content-label">考证依据：</span>
          <span class="content-text">{{ c.evidence }}</span>
        </div>
        <div v-if="c.final_text" class="content-row">
          <span class="content-label">最终定本：</span>
          <span class="content-text final-text">{{ c.final_text }}</span>
        </div>
        <div v-if="c.reviewer_note" class="content-row">
          <span class="content-label">审核备注：</span>
          <span class="content-text">{{ c.reviewer_note }}</span>
        </div>
      </div>
    </div>

    <div v-if="showCreateModal || showEditModal" class="modal-overlay" @click.self="closeEditModal">
      <div class="modal">
        <h3>{{ showEditModal ? '编辑校勘结论' : '新增校勘结论' }}</h3>
        <div class="form-group">
          <label>关联差异标注（可选）</label>
          <select v-model="form.diffId">
            <option :value="null">不关联具体差异</option>
            <option v-for="d in diffs" :key="d.id" :value="d.id">
              [{{ getDiffTypeLabel(d.diff_type) }}] {{ d.base_text }} vs {{ d.target_text }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>结论类型</label>
          <select v-model="form.conclusionType">
            <option v-for="t in conclusionTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>校勘意见 *</label>
          <textarea v-model="form.content" placeholder="说明校勘处理意见，如：此处从底本，因庚辰本此处文字更佳..."></textarea>
        </div>
        <div class="form-group">
          <label>考证依据（可选）</label>
          <textarea v-model="form.evidence" placeholder="引用文献、版本依据或其他考证材料"></textarea>
        </div>
        <div class="form-group">
          <label>最终定本（可选）</label>
          <textarea v-model="form.finalText" placeholder="校勘后确定的最终文字"></textarea>
        </div>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="closeEditModal">取消</button>
          <button class="btn" @click="submitConclusion">{{ showEditModal ? '保存修改' : '提交结论' }}</button>
        </div>
      </div>
    </div>

    <div v-if="showReviewModal" class="modal-overlay" @click.self="showReviewModal = false">
      <div class="modal">
        <h3>审核校勘结论</h3>
        <div class="form-group">
          <label>审核状态</label>
          <select v-model="reviewForm.status">
            <option v-for="s in conclusionStatuses" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>审核备注</label>
          <textarea v-model="reviewForm.reviewerNote" placeholder="填写审核意见或说明"></textarea>
        </div>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showReviewModal = false">取消</button>
          <button class="btn" @click="submitReview">提交审核</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { collationAPI } from '../api';

const props = defineProps({
  collationTaskId: { type: [Number, String], required: true },
  paragraphIndex: { type: Number, required: true },
  diffs: { type: Array, default: () => [] },
  conclusions: { type: Array, default: () => [] },
  conclusionTypes: { type: Array, default: () => [] },
  conclusionStatuses: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false },
  canReview: { type: Boolean, default: false }
});

const emit = defineEmits(['create-conclusion', 'update-conclusion', 'review-conclusion', 'delete-conclusion']);

const showCreateModal = ref(false);
const showEditModal = ref(false);
const showReviewModal = ref(false);
const editingConclusion = ref(null);
const reviewingConclusion = ref(null);
const diffTypes = ref([]);

const form = reactive({
  diffId: null,
  conclusionType: 'custom',
  content: '',
  evidence: '',
  finalText: ''
});

const reviewForm = reactive({
  status: 'reviewed',
  reviewerNote: ''
});

function getConclusionTypeLabel(type) {
  const t = props.conclusionTypes.find(x => x.value === type);
  return t ? t.label : type;
}

function getConclusionStatusLabel(status) {
  const s = props.conclusionStatuses.find(x => x.value === status);
  return s ? s.label : status;
}

function getDiffTypeLabel(type) {
  const t = diffTypes.value.find(x => x.value === type);
  return t ? t.label : type;
}

function getDiffText(diffId) {
  const d = props.diffs.find(x => x.id === diffId);
  if (!d) return `差异#${diffId}`;
  return `[${getDiffTypeLabel(d.diff_type)}] ${d.base_text || '—'} vs ${d.target_text || '—'}`;
}

function openEdit(c) {
  editingConclusion.value = c;
  form.diffId = c.diff_id || null;
  form.conclusionType = c.conclusion_type;
  form.content = c.content;
  form.evidence = c.evidence || '';
  form.finalText = c.final_text || '';
  showEditModal.value = true;
}

function closeEditModal() {
  showCreateModal.value = false;
  showEditModal.value = false;
  editingConclusion.value = null;
  form.diffId = null;
  form.conclusionType = 'custom';
  form.content = '';
  form.evidence = '';
  form.finalText = '';
}

function submitConclusion() {
  if (!form.content.trim()) {
    alert('请填写校勘意见');
    return;
  }
  const data = {
    paragraphIndex: props.paragraphIndex,
    diffId: form.diffId,
    conclusionType: form.conclusionType,
    content: form.content,
    evidence: form.evidence,
    finalText: form.finalText
  };
  if (editingConclusion.value) {
    emit('update-conclusion', editingConclusion.value.id, data);
  } else {
    emit('create-conclusion', data);
  }
  closeEditModal();
}

function openReview(c) {
  reviewingConclusion.value = c;
  reviewForm.status = c.status || 'reviewed';
  reviewForm.reviewerNote = c.reviewer_note || '';
  showReviewModal.value = true;
}

function submitReview() {
  if (!reviewingConclusion.value) return;
  emit('review-conclusion', reviewingConclusion.value.id, {
    status: reviewForm.status,
    reviewerNote: reviewForm.reviewerNote
  });
  showReviewModal.value = false;
  reviewingConclusion.value = null;
}

(async () => {
  try {
    const res = await collationAPI.diffTypes();
    diffTypes.value = res.data;
  } catch (e) {
    console.error('加载差异类型失败:', e);
  }
})();
</script>

<style scoped>
.conclusion-panel {
  padding: 20px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--accent);
}

.empty-state {
  text-align: center;
  padding: 30px;
}

.conclusion-card {
  background: #fff;
  border: 1px solid var(--border);
  border-left: 4px solid var(--primary);
  border-radius: 4px;
  padding: 14px 18px;
  margin-bottom: 12px;
}

.conclusion-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--border);
}

.conclusion-type-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
}

.type-accept_base { background: #1565c0; }
.type-accept_target { background: #ef6c00; }
.type-custom { background: #6a1b9a; }
.type-needs_research { background: #c62828; }
.type-no_difference { background: #2e7d32; }

.status-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending { background: #fff3e0; color: #ef6c00; }
.status-reviewed { background: #e3f2fd; color: #1565c0; }
.status-approved { background: #e8f5e9; color: #2e7d32; }
.status-rejected { background: #ffebee; color: #c62828; }

.conclusion-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}

.conclusion-diff-ref {
  padding: 6px 0;
  margin-bottom: 8px;
}

.diff-ref-text {
  font-family: "Noto Serif SC", "Songti SC", serif;
  background: rgba(139, 90, 43, 0.08);
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 13px;
}

.conclusion-content {
  font-size: 14px;
}

.content-row {
  padding: 5px 0;
  display: flex;
  gap: 10px;
  line-height: 1.8;
}

.content-label {
  color: var(--text-muted);
  flex-shrink: 0;
  min-width: 80px;
}

.content-text {
  flex: 1;
}

.final-text {
  font-family: "Noto Serif SC", "Songti SC", serif;
  background: linear-gradient(135deg, #fff8e1, #ffecb3);
  padding: 6px 10px;
  border-radius: 4px;
  font-weight: 500;
}
</style>
