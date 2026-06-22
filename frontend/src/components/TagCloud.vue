<template>
  <div class="tag-cloud-container">
    <div v-if="title" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h3 style="color:var(--primary-dark);margin:0;">{{ title }}</h3>
      <button v-if="selectedTagId" class="btn sm secondary" @click="clearSelection">清除筛选</button>
    </div>
    <div v-if="loading" style="text-align:center;padding:20px;color:#999;">
      加载中...
    </div>
    <div v-else-if="!tags.length" style="text-align:center;padding:20px;color:#999;">
      暂无标签
    </div>
    <div v-else class="tag-cloud">
      <span
        v-for="tag in tags"
        :key="tag.id"
        :class="['cloud-tag', { 'tag-selected': selectedTagId === tag.id }]"
        :style="{
          fontSize: getFontSize(tag.usage_count) + 'px',
          color: tag.color,
          borderColor: tag.color + '40',
          backgroundColor: selectedTagId === tag.id ? (tag.color + '15') : 'transparent'
        }"
        @click="selectTag(tag)"
        :title="`${tag.name} - ${tag.usage_count}条记录`"
      >
        {{ tag.name }}
        <span v-if="showCount" class="tag-count">{{ tag.usage_count }}</span>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { tagsAPI } from '../api';

const props = defineProps({
  title: { type: String, default: '标签云' },
  showCount: { type: Boolean, default: true },
  limit: { type: Number, default: 50 },
  autoLoad: { type: Boolean, default: true },
  selectedTagId: { type: [Number, String], default: null }
});

const emit = defineEmits(['select', 'update:selectedTagId']);

const tags = ref([]);
const loading = ref(false);
const maxUsage = ref(0);

const fontMin = 12;
const fontMax = 28;

function getFontSize(usage) {
  if (!maxUsage.value) return fontMin;
  const ratio = Math.min(usage / maxUsage.value, 1);
  return Math.round(fontMin + (fontMax - fontMin) * Math.sqrt(ratio));
}

async function loadTags() {
  loading.value = true;
  try {
    const { data } = await tagsAPI.cloud({ limit: props.limit });
    tags.value = data.tags || [];
    maxUsage.value = data.maxUsage || 0;
  } catch (e) {
    console.error('加载标签云失败', e);
  } finally {
    loading.value = false;
  }
}

function selectTag(tag) {
  emit('select', tag);
  emit('update:selectedTagId', tag.id);
}

function clearSelection() {
  emit('select', null);
  emit('update:selectedTagId', null);
}

watch(() => props.selectedTagId, (val) => {
  if (val === null || val === undefined) {
    // 外部清除时不需要做额外处理
  }
});

onMounted(() => {
  if (props.autoLoad) loadTags();
});

defineExpose({ loadTags });
</script>

<style scoped>
.tag-cloud-container {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  justify-content: center;
  align-items: center;
  min-height: 60px;
}

.cloud-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border: 1px solid;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  line-height: 1.5;
  user-select: none;
}

.cloud-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.tag-selected {
  font-weight: 600;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}

.tag-count {
  font-size: 10px;
  opacity: 0.7;
  background: rgba(255,255,255,0.5);
  padding: 1px 6px;
  border-radius: 10px;
}
</style>
