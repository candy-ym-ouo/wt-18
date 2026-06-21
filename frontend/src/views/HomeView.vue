<template>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h1 class="page-title" style="margin-bottom:0;border:none;padding:0;">古籍版本考据社区</h1>
      <router-link to="/admin" class="btn secondary">进入后台</router-link>
    </div>

    <div class="card" style="text-align:center;background:linear-gradient(135deg,#fffaf2,#f5e6d3);">
      <h2 style="color:var(--primary-dark);margin-bottom:10px;">探索古籍版本的流变与传承</h2>
      <p class="meta">收录不同时期的刻本、钞本、校本，对比文字差异，梳理版本源流，共探典籍真相</p>
    </div>

    <h3 style="margin:24px 0 16px;color:var(--primary-dark);">全部词条</h3>
    <div class="grid cols-3">
      <div v-for="e in entries" :key="e.id" class="card entry-card" @click="goDetail(e.id)">
        <img v-if="e.cover_url" :src="e.cover_url" class="entry-cover" :alt="e.title" />
        <div v-else class="entry-cover" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);">📖 暂无封面</div>
        <h3>{{ e.title }}</h3>
        <p class="meta">{{ e.author || '佚名' }} · {{ e.dynasty || '时代不详' }}</p>
        <p style="font-size:14px;margin-top:8px;color:#555;" class="summary">{{ e.summary }}</p>
        <div style="margin-top:10px;">
          <span class="tag">{{ e.version_count }} 个版本</span>
        </div>
      </div>
    </div>

    <div v-if="!entries.length" class="card" style="text-align:center;">
      <p class="meta">暂无词条，请前往后台添加</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { entriesAPI } from '../api';

const entries = ref([]);
const router = useRouter();

function goDetail(id) {
  router.push(`/entries/${id}`);
}

onMounted(async () => {
  try {
    const { data } = await entriesAPI.list();
    entries.value = data;
  } catch (e) { console.error(e); }
});
</script>

<style scoped>
.summary {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
