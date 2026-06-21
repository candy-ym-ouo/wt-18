<template>
  <div class="revision-history">
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 class="page-title" style="font-size:18px;margin:0;">📜 修订历史</h3>
        <button class="btn sm secondary" @click="load">刷新</button>
      </div>

      <div v-if="loading" class="meta" style="text-align:center;padding:20px;">加载中...</div>

      <div v-else-if="!revisions.length" class="meta" style="text-align:center;padding:20px;">
        暂无修订记录
      </div>

      <div v-else class="revision-list">
        <div
          v-for="rev in revisions"
          :key="rev.id"
          class="revision-item"
          :class="{ expanded: expandedId === rev.id }"
        >
          <div class="revision-header" @click="toggleExpand(rev.id)">
            <div class="revision-meta">
              <span class="field-tag">{{ getFieldLabel(rev.field_name) }}</span>
              <span class="revision-user">{{ rev.user_display_name || '匿名用户' }}</span>
              <span class="revision-time">{{ rev.created_at }}</span>
            </div>
            <div class="revision-summary">
              {{ rev.change_summary || '字段变更' }}
            </div>
            <span class="expand-icon">{{ expandedId === rev.id ? '▲' : '▼' }}</span>
          </div>

          <div v-if="expandedId === rev.id" class="revision-detail">
            <div class="diff-container">
              <div class="diff-col">
                <div class="diff-label">修改前</div>
                <div class="diff-content old">
                  <pre v-if="rev.old_value">{{ rev.old_value }}</pre>
                  <span v-else class="meta">（空）</span>
                </div>
              </div>
              <div class="diff-arrow">→</div>
              <div class="diff-col">
                <div class="diff-label">修改后</div>
                <div class="diff-content new">
                  <pre v-if="rev.new_value">{{ rev.new_value }}</pre>
                  <span v-else class="meta">（空）</span>
                </div>
              </div>
            </div>
            <div style="text-align:right;margin-top:10px;">
              <button
                v-if="canRollback"
                class="btn sm danger"
                :disabled="rollingBack === rev.id"
                @click.stop="onRollback(rev)"
              >
                {{ rollingBack === rev.id ? '回滚中...' : '回滚到此版本' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { revisionsAPI, getFieldLabel, handleApiError, hasRoleLevel } from '../api';

const props = defineProps({
  entityType: { type: String, required: true },
  entityId: { type: [Number, String], required: true },
  user: { type: Object, default: null }
});

const emit = defineEmits(['rollback']);

const revisions = ref([]);
const loading = ref(false);
const expandedId = ref(null);
const rollingBack = ref(null);

const canRollback = hasRoleLevel(props.user, 'editor');

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id;
}

async function load() {
  loading.value = true;
  try {
    const { data } = await revisionsAPI.list(props.entityType, props.entityId);
    revisions.value = data;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

async function onRollback(rev) {
  if (!confirm(`确定要回滚「${getFieldLabel(rev.field_name)}」字段吗？\n将恢复为修改前的值。`)) return;
  rollingBack.value = rev.id;
  try {
    await revisionsAPI.rollback(rev.id);
    alert('回滚成功');
    emit('rollback', rev);
    expandedId.value = null;
    load();
  } catch (e) {
    alert('回滚失败: ' + handleApiError(e));
  } finally {
    rollingBack.value = null;
  }
}

watch(() => [props.entityType, props.entityId], () => {
  load();
});

onMounted(load);
</script>

<style scoped>
.revision-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.revision-item {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.revision-item.expanded {
  box-shadow: 0 2px 8px rgba(139, 90, 43, 0.1);
}

.revision-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  background: linear-gradient(135deg, #fffdf8, #fffaf2);
  transition: background 0.2s;
}

.revision-header:hover {
  background: linear-gradient(135deg, #fff8e6, #fff2d9);
}

.revision-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.field-tag {
  display: inline-block;
  padding: 2px 10px;
  background: var(--primary);
  color: #fff;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.revision-user {
  font-size: 13px;
  color: var(--primary-dark);
  font-weight: 500;
}

.revision-time {
  font-size: 12px;
  color: var(--text-muted);
}

.revision-summary {
  flex: 1;
  font-size: 13px;
  color: #444;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: "Noto Serif SC", "Songti SC", serif;
}

.expand-icon {
  color: var(--text-muted);
  font-size: 11px;
  flex-shrink: 0;
}

.revision-detail {
  padding: 14px;
  border-top: 1px dashed var(--border);
  background: #fafafa;
}

.diff-container {
  display: grid;
  grid-template-columns: 1fr 30px 1fr;
  gap: 10px;
  align-items: stretch;
}

.diff-col {
  display: flex;
  flex-direction: column;
}

.diff-label {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
  padding: 2px 8px;
  border-radius: 3px;
  display: inline-block;
  align-self: flex-start;
}

.diff-col:first-child .diff-label {
  background: #ffebee;
  color: #c62828;
}

.diff-col:last-child .diff-label {
  background: #e8f5e9;
  color: #2e7d32;
}

.diff-content {
  flex: 1;
  padding: 10px 12px;
  border-radius: 4px;
  font-family: "Noto Serif SC", "Songti SC", serif;
  font-size: 13px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
}

.diff-content.old {
  background: #fff5f5;
  border: 1px solid #ffcdd2;
  color: #b71c1c;
}

.diff-content.new {
  background: #f1f8e9;
  border: 1px solid #c5e1a5;
  color: #1b5e20;
}

.diff-content pre {
  margin: 0;
  font-family: inherit;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: inherit;
  line-height: inherit;
}

.diff-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--text-muted);
  font-weight: bold;
}

.btn.sm.danger {
  background: #c62828;
  border-color: #c62828;
}

.btn.sm.danger:hover {
  background: #b71c1c;
  border-color: #b71c1c;
}

.btn.sm.danger:disabled {
  background: #e0e0e0;
  border-color: #e0e0e0;
  cursor: not-allowed;
}
</style>
