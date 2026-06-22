<template>
  <div class="category-selector">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <label v-if="label" style="font-weight:500;color:#374151;font-size:14px;">{{ label }}</label>
      <button v-if="canCreate && showAddButton" type="button" class="btn sm secondary" @click="showCreateModal=true">
        + 新建分类
      </button>
    </div>
    <div class="selector-input">
      <input
        v-model="searchKeyword"
        :placeholder="placeholder"
        @focus="showDropdown=true"
        @input="onSearchInput"
      />
      <div v-if="showDropdown && filteredFlatList.length" class="dropdown-menu">
        <div
          v-for="opt in filteredFlatList"
          :key="opt.id"
          :class="['dropdown-item', { 'item-selected': selectedIds.includes(opt.id) }]"
          :style="{ paddingLeft: (opt.level - 1) * 16 + 12 + 'px' }"
          @click="toggleOption(opt)"
        >
          <span class="check-icon">{{ selectedIds.includes(opt.id) ? '✓' : '' }}</span>
          <span class="cat-color-dot" :style="{ backgroundColor: opt.color }"></span>
          <span class="item-name">{{ opt.name }}</span>
          <span v-if="primaryCategoryId === opt.id" class="primary-badge">主</span>
          <span class="item-count" v-if="opt.entry_count !== undefined">({{ opt.entry_count }})</span>
        </div>
      </div>
    </div>
    <div v-if="selectedCategories.length" class="selected-categories">
      <span
        v-for="cat in selectedCategories"
        :key="cat.id"
        :class="['selected-cat', { 'is-primary': primaryCategoryId === cat.id }]"
        :style="{ backgroundColor: cat.color + '15', borderColor: cat.color + '40', color: cat.color }"
      >
        {{ cat.name }}
        <button v-if="showPrimary" type="button" class="set-primary"
                @click="setPrimary(cat)"
                :title="primaryCategoryId === cat.id ? '主分类' : '设为主分类'">
          {{ primaryCategoryId === cat.id ? '★' : '☆' }}
        </button>
        <button type="button" class="remove-cat" @click="removeCategory(cat)">×</button>
      </span>
    </div>
    <p v-if="showPrimary && selectedCategories.length && !primaryCategoryId"
       style="font-size:12px;color:#6b7280;margin:8px 0 0;">
      ☆ 点击星标可设置主分类
    </p>

    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal=false">
      <div class="modal sm-modal">
        <h3>新建分类</h3>
        <div class="form-group">
          <label>分类名称 *</label>
          <input v-model="newCategory.name" placeholder="输入分类名称" />
        </div>
        <div class="form-group">
          <label>父级分类</label>
          <select v-model="newCategory.parent_id">
            <option :value="null">无（顶级分类）</option>
            <option v-for="c in flatList" :key="c.id" :value="c.id" :disabled="c.id === editingId">
              {{ '　'.repeat(c.level - 1) }}{{ c.name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>分类颜色</label>
          <div class="color-picker">
            <input type="color" v-model="newCategory.color" />
            <input v-model="newCategory.color" placeholder="#10b981" style="flex:1;" />
          </div>
        </div>
        <div class="form-group">
          <label>图标（emoji）</label>
          <input v-model="newCategory.icon" placeholder="📚" maxlength="3" />
        </div>
        <div class="form-group">
          <label>说明（选填）</label>
          <textarea v-model="newCategory.description" rows="2"></textarea>
        </div>
        <p v-if="createError" style="color:#dc2626;font-size:13px;">{{ createError }}</p>
        <div style="text-align:right;">
          <button type="button" class="btn secondary" style="margin-right:8px;" @click="showCreateModal=false">取消</button>
          <button type="button" class="btn" @click="submitCreateCategory" :disabled="creating">
            {{ creating ? '创建中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { categoriesAPI, handleApiError } from '../api';

const props = defineProps({
  label: { type: String, default: '' },
  modelValue: { type: Array, default: () => [] },
  primaryCategoryId: { type: [Number, String], default: null },
  placeholder: { type: String, default: '搜索或选择分类...' },
  canCreate: { type: Boolean, default: true },
  showAddButton: { type: Boolean, default: true },
  showPrimary: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue', 'change', 'update:primaryCategoryId', 'primaryChange']);

const searchKeyword = ref('');
const showDropdown = ref(false);
const categories = ref([]);
const loading = ref(false);
const showCreateModal = ref(false);
const creating = ref(false);
const createError = ref('');
const newCategory = ref({ name: '', parent_id: null, color: '#10b981', icon: '', description: '' });
const editingId = ref(null);

function flattenCats(cats, result = []) {
  for (const c of cats) {
    result.push(c);
    if (c.children && c.children.length) {
      flattenCats(c.children, result);
    }
  }
  return result;
}

const flatList = computed(() => flattenCats(categories.value));

const selectedIds = computed(() => {
  return Array.isArray(props.modelValue) ? props.modelValue.map(id => Number(id)).filter(Boolean) : [];
});

const selectedCategories = computed(() => {
  return flatList.value.filter(o => selectedIds.value.includes(o.id));
});

const filteredFlatList = computed(() => {
  if (!searchKeyword.value) return flatList.value;
  const q = searchKeyword.value.toLowerCase().trim();
  return flatList.value.filter(o =>
    o.name.toLowerCase().includes(q) ||
    (o.description && o.description.toLowerCase().includes(q))
  );
});

async function loadCategories() {
  loading.value = true;
  try {
    const { data } = await categoriesAPI.list({ tree: 'true' });
    categories.value = data;
  } catch (e) {
    console.error('加载分类失败', e);
  } finally {
    loading.value = false;
  }
}

function toggleOption(opt) {
  const ids = [...selectedIds.value];
  const idx = ids.indexOf(opt.id);
  if (idx > -1) {
    ids.splice(idx, 1);
    if (props.primaryCategoryId === opt.id) {
      emit('update:primaryCategoryId', null);
      emit('primaryChange', null);
    }
  } else {
    ids.push(opt.id);
    if (ids.length === 1 && !props.primaryCategoryId) {
      emit('update:primaryCategoryId', opt.id);
      emit('primaryChange', opt.id);
    }
  }
  emit('update:modelValue', ids);
  emit('change', ids);
}

function removeCategory(cat) {
  const ids = selectedIds.value.filter(id => id !== cat.id);
  emit('update:modelValue', ids);
  emit('change', ids);
  if (props.primaryCategoryId === cat.id) {
    emit('update:primaryCategoryId', ids[0] || null);
    emit('primaryChange', ids[0] || null);
  }
}

function setPrimary(cat) {
  const newPrimary = props.primaryCategoryId === cat.id ? null : cat.id;
  emit('update:primaryCategoryId', newPrimary);
  emit('primaryChange', newPrimary);
}

function onSearchInput() {
  if (!showDropdown.value) showDropdown.value = true;
}

async function submitCreateCategory() {
  if (!newCategory.value.name.trim()) {
    createError.value = '请输入分类名称';
    return;
  }
  creating.value = true;
  createError.value = '';
  try {
    const { data } = await categoriesAPI.create(newCategory.value);
    await loadCategories();
    const ids = [...selectedIds.value, data.id];
    emit('update:modelValue', ids);
    emit('change', ids);
    if (ids.length === 1) {
      emit('update:primaryCategoryId', data.id);
      emit('primaryChange', data.id);
    }
    showCreateModal.value = false;
    searchKeyword.value = '';
  } catch (e) {
    createError.value = handleApiError(e, '创建失败');
  } finally {
    creating.value = false;
  }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.category-selector')) {
    showDropdown.value = false;
  }
});

onMounted(() => {
  loadCategories();
});

defineExpose({ loadCategories });
</script>

<style scoped>
.category-selector {
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
  max-height: 320px;
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
  background: #f0fdf4;
}

.check-icon {
  width: 18px;
  text-align: center;
  color: #16a34a;
  font-weight: bold;
}

.cat-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.item-name {
  flex: 1;
  color: #1f2937;
}

.primary-badge {
  background: #fef3c7;
  color: #92400e;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}

.item-count {
  color: #9ca3af;
  font-size: 12px;
}

.selected-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.selected-cat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
}

.is-primary {
  font-weight: 600;
  border-width: 2px;
}

.set-primary {
  background: none;
  border: none;
  padding: 0 2px;
  font-size: 14px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.set-primary:hover {
  opacity: 1;
}

.remove-cat {
  background: none;
  border: none;
  padding: 0 2px;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.remove-cat:hover {
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
}

.btn.secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn.secondary:hover {
  background: #e5e7eb;
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
