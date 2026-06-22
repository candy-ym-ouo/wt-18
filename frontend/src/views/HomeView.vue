<template>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
      <h1 class="page-title" style="margin-bottom:0;border:none;padding:0;">古籍版本考据社区</h1>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <input
          v-model="searchKeyword"
          placeholder="搜索书名、作者、朝代..."
          style="padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:14px;width:240px;"
        />
        <router-link to="/admin" class="btn secondary">进入后台</router-link>
      </div>
    </div>

    <div class="card" style="text-align:center;background:linear-gradient(135deg,#fffaf2,#f5e6d3);">
      <h2 style="color:var(--primary-dark);margin-bottom:10px;">探索古籍版本的流变与传承</h2>
      <p class="meta">收录不同时期的刻本、钞本、校本，对比文字差异，梳理版本源流，共探典籍真相</p>
    </div>

    <div style="display:grid;grid-template-columns:280px 1fr;gap:20px;margin-top:24px;align-items:start;">
      <div style="position:sticky;top:20px;display:flex;flex-direction:column;gap:16px;">
        <CategoryTree
          title="分类导航"
          v-model:selectedCategoryId="selectedCategoryId"
          @select="onCategorySelect"
        />
        <TagCloud
          title="标签云"
          v-model:selectedTagId="selectedTagId"
          @select="onTagSelect"
        />
        <div class="card" style="padding:16px;">
          <h4 style="margin:0 0 12px 0;color:var(--primary-dark);">当前筛选</h4>
          <div v-if="!selectedTagId && !selectedCategoryId && !searchKeyword" class="meta">
            未设置筛选条件
          </div>
          <div v-else style="display:flex;flex-direction:column;gap:6px;">
            <div v-if="selectedCategoryInfo" class="filter-tag cat-filter">
              <span>{{ selectedCategoryInfo.name }}</span>
              <button class="clear-filter" @click="clearCategory">×</button>
            </div>
            <div v-if="selectedTagInfo" class="filter-tag tag-filter" :style="{ borderColor: selectedTagInfo.color + '60', color: selectedTagInfo.color }">
              <span>{{ selectedTagInfo.name }}</span>
              <button class="clear-filter" @click="clearTag">×</button>
            </div>
            <div v-if="searchKeyword" class="filter-tag search-filter">
              <span>搜索: {{ searchKeyword }}</span>
              <button class="clear-filter" @click="clearSearch">×</button>
            </div>
            <button v-if="selectedTagId || selectedCategoryId || searchKeyword"
                    class="btn sm secondary" style="margin-top:8px;"
                    @click="clearAllFilters">
              清除全部筛选
            </button>
          </div>
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid #eee;">
            <p class="meta" style="margin:0;">共 <strong>{{ total }}</strong> 个词条</p>
          </div>
        </div>
      </div>

      <div>
        <h3 style="margin:0 0 16px;color:var(--primary-dark);">
          全部词条
          <span v-if="loading" class="meta" style="font-size:13px;margin-left:8px;">加载中...</span>
        </h3>
        <div v-if="entries.length" class="grid cols-2">
          <div v-for="e in entries" :key="e.id" class="card entry-card" @click="goDetail(e.id)">
            <img v-if="e.cover_url" :src="e.cover_url" class="entry-cover" :alt="e.title" />
            <div v-else class="entry-cover" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);">📖 暂无封面</div>
            <h3>{{ e.title }}</h3>
            <p class="meta">{{ e.author || '佚名' }} · {{ e.dynasty || '时代不详' }}</p>
            <p style="font-size:14px;margin-top:8px;color:#555;" class="summary">{{ e.summary }}</p>
            <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px;">
              <span class="tag">{{ e.version_count }} 个版本</span>
              <span
                v-for="t in (e.tags || []).slice(0, 3)"
                :key="t.id"
                class="tag"
                :style="{ backgroundColor: t.color + '15', borderColor: t.color + '40', color: t.color }"
              >
                {{ t.name }}
              </span>
            </div>
          </div>
        </div>
        <div v-else-if="!loading" class="card" style="text-align:center;">
          <p class="meta">
            {{ (selectedTagId || selectedCategoryId || searchKeyword) ? '没有符合筛选条件的词条' : '暂无词条，请前往后台添加' }}
          </p>
          <button v-if="selectedTagId || selectedCategoryId || searchKeyword"
                  class="btn secondary" style="margin-top:12px;"
                  @click="clearAllFilters">
            清除筛选查看全部
          </button>
        </div>
        <div v-if="entries.length && hasMore" style="text-align:center;margin-top:20px;">
          <button class="btn secondary" @click="loadMore" :disabled="loadingMore">
            {{ loadingMore ? '加载中...' : '加载更多' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { entriesAPI, tagsAPI, categoriesAPI } from '../api';
import TagCloud from '../components/TagCloud.vue';
import CategoryTree from '../components/CategoryTree.vue';

const router = useRouter();

const entries = ref([]);
const total = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(false);
const pageSize = 12;
const offset = ref(0);

const searchKeyword = ref('');
const selectedTagId = ref(null);
const selectedCategoryId = ref(null);
const selectedTagInfo = ref(null);
const selectedCategoryInfo = ref(null);

const hasFilters = computed(() => selectedTagId.value || selectedCategoryId.value || searchKeyword.value);

function goDetail(id) {
  router.push(`/entries/${id}`);
}

async function loadEntries(reset = true) {
  if (reset) {
    offset.value = 0;
    entries.value = [];
    hasMore.value = false;
  }
  const isLoadingMore = !reset;
  if (isLoadingMore) loadingMore.value = true;
  else loading.value = true;

  try {
    const params = { limit: pageSize, offset: offset.value };
    if (selectedTagId.value) params.tag_ids = selectedTagId.value;
    if (selectedCategoryId.value) params.category_id = selectedCategoryId.value;
    if (searchKeyword.value) params.keyword = searchKeyword.value;

    const { data } = await entriesAPI.list(params);
    const list = data.list || data;
    total.value = data.total || list.length;
    hasMore.value = data.hasMore || (offset.value + list.length < total.value);

    if (reset) {
      entries.value = list;
    } else {
      entries.value = [...entries.value, ...list];
    }
    offset.value += list.length;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function onTagSelect(tag) {
  selectedTagInfo.value = tag;
  loadEntries(true);
}

async function onCategorySelect(cat) {
  selectedCategoryInfo.value = cat;
  loadEntries(true);
}

function clearTag() {
  selectedTagId.value = null;
  selectedTagInfo.value = null;
  loadEntries(true);
}

function clearCategory() {
  selectedCategoryId.value = null;
  selectedCategoryInfo.value = null;
  loadEntries(true);
}

function clearSearch() {
  searchKeyword.value = '';
  loadEntries(true);
}

function clearAllFilters() {
  selectedTagId.value = null;
  selectedCategoryId.value = null;
  searchKeyword.value = '';
  selectedTagInfo.value = null;
  selectedCategoryInfo.value = null;
  loadEntries(true);
}

function loadMore() {
  if (!hasMore.value || loadingMore.value) return;
  loadEntries(false);
}

let searchTimeout = null;
watch(searchKeyword, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadEntries(true);
  }, 400);
});

onMounted(() => {
  loadEntries(true);
});
</script>

<style scoped>
.summary {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.filter-tag {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
}

.cat-filter {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #166534;
}

.tag-filter {
  background: #fff;
  border: 1px solid;
}

.search-filter {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1e40af;
}

.clear-filter {
  background: none;
  border: none;
  padding: 0 4px;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.clear-filter:hover {
  opacity: 1;
}

@media (max-width: 900px) {
  div[style*="grid-template-columns"] {
    grid-template-columns: 1fr !important;
  }
  div[style*="sticky"] {
    position: static !important;
  }
}
</style>
