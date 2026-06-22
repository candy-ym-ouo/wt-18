<template>
  <div class="category-tree-container">
    <div v-if="title" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h3 style="color:var(--primary-dark);margin:0;">{{ title }}</h3>
      <button v-if="selectedCategoryId" class="btn sm secondary" @click="clearSelection">清除筛选</button>
    </div>
    <div v-if="loading" style="text-align:center;padding:20px;color:#999;">
      加载中...
    </div>
    <div v-else-if="!categories.length" style="text-align:center;padding:20px;color:#999;">
      暂无分类
    </div>
    <div v-else class="category-tree">
      <div
        v-for="cat in categories"
        :key="cat.id"
        class="category-node"
        :style="{ paddingLeft: (cat.level - 1) * 16 + 'px' }"
      >
        <div
          :class="['category-item', { 'cat-selected': selectedCategoryId === cat.id }]"
          :style="{ borderLeftColor: cat.color }"
          @click="selectCategory(cat)"
        >
          <span v-if="cat.children && cat.children.length" class="expand-icon" @click.stop="toggleExpand(cat)">
            {{ expandedIds.includes(cat.id) ? '▼' : '▶' }}
          </span>
          <span v-else class="expand-placeholder"></span>
          <span class="cat-icon" v-if="cat.icon">{{ cat.icon }}</span>
          <span class="cat-name">{{ cat.name }}</span>
          <span v-if="showCount" class="cat-count">
            {{ (cat.entry_count || 0) + (cat.version_count || 0) }}
          </span>
        </div>
        <div v-if="cat.children && cat.children.length && expandedIds.includes(cat.id)" class="category-children">
          <div
            v-for="child in cat.children"
            :key="child.id"
            class="category-node"
            :style="{ paddingLeft: (child.level - 1) * 16 + 'px' }"
          >
            <div
              :class="['category-item', { 'cat-selected': selectedCategoryId === child.id }]"
              :style="{ borderLeftColor: child.color }"
              @click="selectCategory(child)"
            >
              <span v-if="child.children && child.children.length" class="expand-icon" @click.stop="toggleExpand(child)">
                {{ expandedIds.includes(child.id) ? '▼' : '▶' }}
              </span>
              <span v-else class="expand-placeholder"></span>
              <span class="cat-icon" v-if="child.icon">{{ child.icon }}</span>
              <span class="cat-name">{{ child.name }}</span>
              <span v-if="showCount" class="cat-count">
                {{ (child.entry_count || 0) + (child.version_count || 0) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, reactive } from 'vue';
import { categoriesAPI } from '../api';

const props = defineProps({
  title: { type: String, default: '分类导航' },
  showCount: { type: Boolean, default: true },
  autoLoad: { type: Boolean, default: true },
  selectedCategoryId: { type: [Number, String], default: null },
  tree: { type: Boolean, default: true }
});

const emit = defineEmits(['select', 'update:selectedCategoryId']);

const categories = ref([]);
const loading = ref(false);
const expandedIds = ref([]);

async function loadCategories() {
  loading.value = true;
  try {
    const { data } = await categoriesAPI.list({ tree: props.tree ? 'true' : 'false' });
    categories.value = data;
    expandAll(data);
  } catch (e) {
    console.error('加载分类树失败', e);
  } finally {
    loading.value = false;
  }
}

function expandAll(cats, parentExpanded = true) {
  if (!parentExpanded) return;
  for (const cat of cats) {
    if (cat.children && cat.children.length) {
      if (!expandedIds.value.includes(cat.id)) {
        expandedIds.value.push(cat.id);
      }
      expandAll(cat.children, true);
    }
  }
}

function toggleExpand(cat) {
  const idx = expandedIds.value.indexOf(cat.id);
  if (idx > -1) {
    expandedIds.value.splice(idx, 1);
  } else {
    expandedIds.value.push(cat.id);
  }
}

function selectCategory(cat) {
  emit('select', cat);
  emit('update:selectedCategoryId', cat.id);
}

function clearSelection() {
  emit('select', null);
  emit('update:selectedCategoryId', null);
}

watch(() => props.selectedCategoryId, (val) => {
  if (val === null || val === undefined) {
    // 外部清除时不需要做额外处理
  }
});

onMounted(() => {
  if (props.autoLoad) loadCategories();
});

defineExpose({ loadCategories });
</script>

<style scoped>
.category-tree-container {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}

.category-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.category-node {
  position: relative;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-left: 3px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.category-item:hover {
  background: #f3f4f6;
}

.cat-selected {
  background: #eff6ff;
  font-weight: 500;
}

.expand-icon {
  font-size: 10px;
  color: #6b7280;
  width: 16px;
  cursor: pointer;
  user-select: none;
  transition: transform 0.2s;
}

.expand-icon:hover {
  color: #374151;
}

.expand-placeholder {
  width: 16px;
  flex-shrink: 0;
}

.cat-icon {
  font-size: 16px;
}

.cat-name {
  flex: 1;
  color: #1f2937;
}

.cat-count {
  font-size: 11px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.cat-selected .cat-count {
  background: #dbeafe;
  color: #1d4ed8;
}
</style>
