<template>
  <div class="tag-selector">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <label v-if="label" style="font-weight:500;color:#374151;font-size:14px;">{{ label }}</label>
      <button v-if="canCreate && showAddButton" type="button" class="btn sm secondary" @click="showCreateModal=true">
        + 新建标签
      </button>
    </div>
    <div class="selector-input">
      <input
        v-model="searchKeyword"
        :placeholder="placeholder"
        @focus="showDropdown=true"
        @input="onSearchInput"
      />
      <div v-if="showDropdown && filteredOptions.length" class="dropdown-menu">
        <div
          v-for="opt in filteredOptions"
          :key="opt.id"
          :class="['dropdown-item', { 'item-selected': selectedIds.includes(opt.id) }]"
          @click="toggleOption(opt)"
        >
          <span class="check-icon">{{ selectedIds.includes(opt.id) ? '✓' : '' }}</span>
          <span class="tag-color-dot" :style="{ backgroundColor: opt.color }"></span>
          <span class="item-name">{{ opt.name }}</span>
          <span class="item-count" v-if="opt.usage_count !== undefined">({{ opt.usage_count }})</span>
        </div>
        <div v-if="canCreate && searchKeyword && !filteredOptions.some(o => o.name === searchKeyword.trim())"
             class="dropdown-item create-item"
             @click="createNewTag">
          <span class="check-icon">+</span>
          <span>创建「{{ searchKeyword.trim() }}」</span>
        </div>
      </div>
    </div>
    <div v-if="selectedTags.length" class="selected-tags">
      <span
        v-for="tag in selectedTags"
        :key="tag.id"
        class="selected-tag"
        :style="{ backgroundColor: tag.color + '15', borderColor: tag.color + '40', color: tag.color }"
      >
        {{ tag.name }}
        <button type="button" class="remove-tag" @click="removeTag(tag)">×</button>
      </span>
    </div>

    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal=false">
      <div class="modal sm-modal">
        <h3>新建标签</h3>
        <div class="form-group">
          <label>标签名称 *</label>
          <input v-model="newTag.name" placeholder="输入标签名称" />
        </div>
        <div class="form-group">
          <label>标签颜色</label>
          <div class="color-picker">
            <input type="color" v-model="newTag.color" />
            <input v-model="newTag.color" placeholder="#6366f1" style="flex:1;" />
          </div>
        </div>
        <div class="form-group">
          <label>说明（选填）</label>
          <textarea v-model="newTag.description" rows="2"></textarea>
        </div>
        <p v-if="createError" style="color:#dc2626;font-size:13px;">{{ createError }}</p>
        <div style="text-align:right;">
          <button type="button" class="btn secondary" style="margin-right:8px;" @click="showCreateModal=false">取消</button>
          <button type="button" class="btn" @click="submitCreateTag" :disabled="creating">
            {{ creating ? '创建中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { tagsAPI, handleApiError } from '../api';

const props = defineProps({
  label: { type: String, default: '' },
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: '搜索或选择标签...' },
  canCreate: { type: Boolean, default: true },
  showAddButton: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue', 'change']);

const searchKeyword = ref('');
const showDropdown = ref(false);
const options = ref([]);
const loading = ref(false);
const showCreateModal = ref(false);
const creating = ref(false);
const createError = ref('');
const newTag = ref({ name: '', color: '#6366f1', description: '' });

const selectedIds = computed(() => {
  return Array.isArray(props.modelValue) ? props.modelValue.map(id => Number(id)).filter(Boolean) : [];
});

const selectedTags = computed(() => {
  return options.value.filter(o => selectedIds.value.includes(o.id));
});

const filteredOptions = computed(() => {
  if (!searchKeyword.value) return options.value;
  const q = searchKeyword.value.toLowerCase().trim();
  return options.value.filter(o =>
    o.name.toLowerCase().includes(q) ||
    (o.description && o.description.toLowerCase().includes(q))
  );
});

async function loadOptions() {
  loading.value = true;
  try {
    const { data } = await tagsAPI.list({ sort: 'usage', limit: 200 });
    options.value = data;
  } catch (e) {
    console.error('加载标签失败', e);
  } finally {
    loading.value = false;
  }
}

function toggleOption(opt) {
  const ids = [...selectedIds.value];
  const idx = ids.indexOf(opt.id);
  if (idx > -1) {
    ids.splice(idx, 1);
  } else {
    ids.push(opt.id);
  }
  emit('update:modelValue', ids);
  emit('change', ids);
}

function removeTag(tag) {
  const ids = selectedIds.value.filter(id => id !== tag.id);
  emit('update:modelValue', ids);
  emit('change', ids);
}

function onSearchInput() {
  if (!showDropdown.value) showDropdown.value = true;
}

async function createNewTag() {
  const name = searchKeyword.value.trim();
  if (!name) return;
  showCreateModal.value = true;
  newTag.value = { name, color: '#6366f1', description: '' };
}

async function submitCreateTag() {
  if (!newTag.value.name.trim()) {
    createError.value = '请输入标签名称';
    return;
  }
  creating.value = true;
  createError.value = '';
  try {
    const { data } = await tagsAPI.create(newTag.value);
    options.value.unshift({ ...data, usage_count: 0 });
    const ids = [...selectedIds.value, data.id];
    emit('update:modelValue', ids);
    emit('change', ids);
    showCreateModal.value = false;
    searchKeyword.value = '';
  } catch (e) {
    createError.value = handleApiError(e, '创建失败');
  } finally {
    creating.value = false;
  }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.tag-selector')) {
    showDropdown.value = false;
  }
});

watch(() => props.modelValue, (val) => {
  // 监听外部值变化
}, { deep: true });

onMounted(() => {
  loadOptions();
});

defineExpose({ loadOptions });
</script>

<style scoped>
.tag-selector {
  position: relative;
}

.selector-input {
  position: relative;
}

.selector-input input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.selector-input input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  max-height: 280px;
  overflow-y: auto;
  z-index: 100;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: #f9fafb;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.item-selected {
  background: #eff6ff;
}

.check-icon {
  width: 18px;
  text-align: center;
  color: var(--primary);
  font-weight: bold;
}

.tag-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.item-name {
  flex: 1;
  color: #1f2937;
}

.item-count {
  color: #9ca3af;
  font-size: 12px;
}

.create-item {
  color: var(--primary);
  font-weight: 500;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.selected-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
}

.remove-tag {
  background: none;
  border: none;
  padding: 0 2px;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.remove-tag:hover {
  opacity: 1;
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

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

h3 {
  margin: 0 0 16px 0;
  color: #1f2937;
}
</style>
