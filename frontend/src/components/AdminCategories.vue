<template>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
      <h3 style="color:var(--primary-dark);margin:0;">分类管理</h3>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input v-model="searchKeyword" placeholder="搜索分类..." style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:180px;" />
        <select v-model="viewMode" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
          <option value="tree">树形视图</option>
          <option value="flat">平铺视图</option>
        </select>
        <button class="btn sm" @click="openCategoryModal()">+ 新建分类</button>
      </div>
    </div>

    <div v-if="loading" style="text-align:center;padding:40px;color:#999;">加载中...</div>

    <div v-else-if="viewMode === 'tree'" class="category-tree-admin">
      <div v-for="cat in categories" :key="cat.id" class="tree-node">
        <div :class="['tree-item', getTreeItemClass(cat)]"
             :style="{ marginLeft: (cat.level - 1) * 24 + 'px' }">
          <span class="expand-icon" @click="toggleExpand(cat)">
            {{ hasChildren(cat) ? (expandedIds.includes(cat.id) ? '▼' : '▶') : '•' }}
          </span>
          <span class="cat-color" :style="{ backgroundColor: cat.color }"></span>
          <span class="cat-name">{{ cat.name }}</span>
          <span v-if="cat.icon" class="cat-icon">{{ cat.icon }}</span>
          <span class="cat-counts">
            <span class="mini-tag">词条 {{ cat.entry_count || 0 }}</span>
            <span class="mini-tag">版本 {{ cat.version_count || 0 }}</span>
          </span>
          <span :class="['status-tag', cat.status==='active'?'status-active':'status-disabled']">
            {{ cat.status==='active' ? '激活' : '停用' }}
          </span>
          <div class="tree-actions">
            <button class="btn xs secondary" @click.stop="openCategoryModal(cat)">编辑</button>
            <button class="btn xs danger" @click.stop="delCategory(cat)">删除</button>
          </div>
        </div>
        <div v-if="hasChildren(cat) && expandedIds.includes(cat.id)" class="tree-children">
          <div v-for="child in cat.children" :key="child.id" class="tree-node">
            <div :class="['tree-item', getTreeItemClass(child)]"
                 :style="{ marginLeft: (child.level - 1) * 24 + 'px' }">
              <span class="expand-icon" @click="toggleExpand(child)">
                {{ hasChildren(child) ? (expandedIds.includes(child.id) ? '▼' : '▶') : '•' }}
              </span>
              <span class="cat-color" :style="{ backgroundColor: child.color }"></span>
              <span class="cat-name">{{ child.name }}</span>
              <span v-if="child.icon" class="cat-icon">{{ child.icon }}</span>
              <span class="cat-counts">
                <span class="mini-tag">词条 {{ child.entry_count || 0 }}</span>
                <span class="mini-tag">版本 {{ child.version_count || 0 }}</span>
              </span>
              <span :class="['status-tag', child.status==='active'?'status-active':'status-disabled']">
                {{ child.status==='active' ? '激活' : '停用' }}
              </span>
              <div class="tree-actions">
                <button class="btn xs secondary" @click.stop="openCategoryModal(child)">编辑</button>
                <button class="btn xs danger" @click.stop="delCategory(child)">删除</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <table v-else>
      <thead>
        <tr>
          <th style="width:60px;">ID</th>
          <th>名称</th>
          <th style="width:80px;">层级</th>
          <th style="width:80px;">颜色</th>
          <th style="width:80px;">词条</th>
          <th style="width:80px;">版本</th>
          <th style="width:80px;">状态</th>
          <th style="width:100px;">排序</th>
          <th style="width:160px;">更新时间</th>
          <th style="width:160px;">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="cat in flatList" :key="cat.id">
          <td>{{ cat.id }}</td>
          <td>
            <div :style="{ paddingLeft: (cat.level - 1) * 16 + 'px' }">
            <strong>{{ cat.name }}</strong>
            <div v-if="cat.slug" class="meta" style="font-size:11px;">slug: {{ cat.slug }}</div>
          </div>
          </td>
          <td>Lv.{{ cat.level }}</td>
          <td>
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="color-preview" :style="{ backgroundColor: cat.color }"></span>
            </div>
          </td>
          <td>{{ cat.entry_count || 0 }}</td>
          <td>{{ cat.version_count || 0 }}</td>
          <td>
            <span :class="['status-tag', cat.status==='active'?'status-active':'status-disabled']">
              {{ cat.status==='active' ? '激活' : '停用' }}
            </span>
          </td>
          <td>{{ cat.sort_order }}</td>
          <td class="meta">{{ cat.updated_at || cat.created_at }}</td>
          <td>
            <div class="actions">
              <button class="btn sm secondary" @click="openCategoryModal(cat)">编辑</button>
              <button class="btn sm danger" @click="delCategory(cat)">删除</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="!loading && (!categories || categories.length === 0)" style="padding:30px;text-align:center;color:#999;">
      暂无分类，请先创建顶级分类
    </div>

    <div v-if="showCategoryModal" class="modal-overlay" @click.self="showCategoryModal=false">
      <div class="modal">
        <h3>{{ editingCategory.id ? '编辑分类' : '新建分类' }}</h3>
        <div class="form-group">
          <label>分类名称 *</label>
          <input v-model="editingCategory.name" placeholder="输入分类名称" />
        </div>
        <div class="form-group">
          <label>别名 (slug)</label>
          <input v-model="editingCategory.slug" placeholder="自动生成或自定义" />
        </div>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group">
            <label>父级分类</label>
            <select v-model="editingCategory.parent_id">
              <option :value="null">无（顶级分类）</option>
              <option v-for="c in flatListForSelect" :key="c.id" :value="c.id">
                {{ getIndent(c.level) + c.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="editingCategory.status">
              <option value="active">激活</option>
              <option value="inactive">停用</option>
            </select>
          </div>
        </div>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group">
            <label>分类颜色</label>
            <div class="color-picker">
              <input type="color" v-model="editingCategory.color" />
              <input v-model="editingCategory.color" placeholder="#10b981" style="flex:1;" />
            </div>
          </div>
          <div class="form-group">
            <label>图标 (emoji)</label>
            <input v-model="editingCategory.icon" placeholder="📚" maxlength="3" />
          </div>
          <div class="form-group">
            <label>排序</label>
            <input type="number" v-model.number="editingCategory.sort_order" />
          </div>
        </div>
        <div class="form-group">
          <label>说明（选填）</label>
          <textarea v-model="editingCategory.description" rows="2"></textarea>
        </div>
        <p v-if="formError" style="color:#dc2626;font-size:13px;">{{ formError }}</p>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showCategoryModal=false">取消</button>
          <button class="btn" @click="saveCategory" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { categoriesAPI, handleApiError } from '../api';

const categories = ref([]);
const loading = ref(false);
const saving = ref(false);
const searchKeyword = ref('');
const viewMode = ref('tree');
const expandedIds = ref([]);

const dragId = ref(null);
const dropTarget = ref(null);
const dropPosition = ref(null);

const showCategoryModal = ref(false);

const editingCategory = ref({
  id: null, name: '', slug: '', parent_id: null,
  color: '#10b981', icon: '',
  description: '', sort_order: 0, status: 'active'
});

const formError = ref('');

function hasChildren(cat) {
  return cat.children && cat.children.length > 0;
}

function getIndent(level) {
  let s = '';
  for (let i = 1; i < level; i++) {
    s += '　';
  }
  return s;
}

function getTreeItemClass(item) {
  const classes = {};
  if (dragId.value === item.id) {
    classes['dragging'] = true;
  }
  if (dropTarget.value && dropTarget.value.id === item.id && dropPosition.value === 'inside') {
    classes['drag-over'] = true;
  }
  return classes;
}

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

const flatListForSelect = computed(() => {
  const list = flattenCats(categories.value);
  if (editingCategory.value.id) {
    return list.filter(c => c.id !== editingCategory.value.id);
  }
  return list;
});

async function loadCategories() {
  loading.value = true;
  try {
    const { data } = await categoriesAPI.adminList({ tree: 'true' });
    categories.value = data;
    expandAll(data);
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function expandAll(cats) {
  for (const cat of cats) {
    if (cat.children && cat.children.length) {
      if (!expandedIds.value.includes(cat.id)) {
        expandedIds.value.push(cat.id);
      }
      expandAll(cat.children);
    }
  }
}

function toggleExpand(cat) {
  const idx = expandedIds.value.indexOf(cat.id);
  if (idx > -1) expandedIds.value.splice(idx, 1);
  else expandedIds.value.push(cat.id);
}

function openCategoryModal(cat = null) {
  formError.value = '';
  if (cat) {
    editingCategory.value = {
      id: cat.id,
      name: cat.name,
      slug: cat.slug || '',
      parent_id: cat.parent_id,
      color: cat.color || '#10b981',
      icon: cat.icon || '',
      description: cat.description || '',
      sort_order: cat.sort_order || 0,
      status: cat.status || 'active'
    };
  } else {
    editingCategory.value = {
      id: null, name: '', slug: '', parent_id: null,
      color: '#10b981', icon: '',
      description: '', sort_order: 0, status: 'active'
    };
  }
  showCategoryModal.value = true;
}

async function saveCategory() {
  if (!editingCategory.value.name.trim()) {
    formError.value = '请输入分类名称';
    return;
  }
  saving.value = true;
  formError.value = '';
  try {
    if (editingCategory.value.id) {
      await categoriesAPI.update(editingCategory.value.id, editingCategory.value);
    } else {
      await categoriesAPI.create(editingCategory.value);
    }
    showCategoryModal.value = false;
    loadCategories();
  } catch (e) {
    formError.value = handleApiError(e, '保存失败');
  } finally {
    saving.value = false;
  }
}

async function delCategory(cat) {
  if (cat.children && cat.children.length) {
    alert('该分类下存在子分类，请先删除或移动子分类');
    return;
  }
  const msg = '确认删除分类「' + cat.name + '」？';
  if (!confirm(msg)) return;
  try {
    await categoriesAPI.remove(cat.id);
    loadCategories();
  } catch (e) {
    alert(handleApiError(e, '删除失败'));
  }
}

onMounted(() => {
  loadCategories();
});

defineExpose({ loadCategories });
</script>

<style scoped>
.category-tree-admin {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px;
}

.tree-node {
  position: relative;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin: 2px 0;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: all 0.2s;
  cursor: default;
}

.tree-item:hover {
  background: #f9fafb;
}

.tree-item.dragging {
  opacity: 0.5;
}

.tree-item.drag-over {
  border-color: var(--primary);
  background: #eff6ff;
}

.expand-icon {
  width: 16px;
  text-align: center;
  font-size: 10px;
  color: #6b7280;
  cursor: pointer;
  flex-shrink: 0;
}

.cat-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.cat-name {
  flex: 1;
  font-weight: 500;
}

.cat-icon {
  font-size: 14px;
}

.cat-counts {
  display: flex;
  gap: 4px;
}

.mini-tag {
  font-size: 10px;
  padding: 1px 6px;
  background: #f3f4f6;
  border-radius: 8px;
  color: #6b7280;
}

.tree-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.tree-item:hover .tree-actions {
  opacity: 1;
}

.btn.xs {
  padding: 3px 8px;
  font-size: 11px;
}

.color-preview {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 3px;
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
  max-width: 520px;
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

.grid {
  display: grid;
}
</style>
