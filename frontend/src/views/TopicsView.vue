<template>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h1 class="page-title" style="margin-bottom:0;border:none;padding:0;">专题考据专栏</h1>
    </div>

    <div class="card" style="text-align:center;background:linear-gradient(135deg,#fffaf2,#f5e6d3);">
      <h2 style="color:var(--primary-dark);margin-bottom:10px;">系统梳理 · 深度考据</h2>
      <p class="meta">以专题形式串联相关典籍，探寻版本流变与传承脉络</p>
    </div>

    <h3 style="margin:24px 0 16px;color:var(--primary-dark);">全部专题</h3>

    <div class="grid cols-2">
      <div v-for="t in topics" :key="t.id" class="card topic-card" @click="goTopic(t.id)">
        <div style="display:flex;gap:16px;">
          <div v-if="t.cover_url" class="topic-cover-wrap">
            <img :src="t.cover_url" class="topic-cover" :alt="t.title" />
          </div>
          <div v-else class="topic-cover-wrap topic-cover-placeholder">
            <span style="font-size:36px;">📚</span>
          </div>
          <div style="flex:1;min-width:0;">
            <h3 style="color:var(--primary-dark);margin-bottom:6px;">{{ t.title }}</h3>
            <p v-if="t.subtitle" class="meta" style="margin-bottom:8px;">{{ t.subtitle }}</p>
            <p v-if="t.author" class="meta" style="margin-bottom:8px;">考据者：{{ t.author }}</p>
            <p class="topic-summary">{{ t.summary }}</p>
            <div style="margin-top:10px;">
              <span class="tag">{{ t.chapter_count }} 章</span>
              <span class="tag">{{ t.entry_count }} 词条</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!topics.length" class="card" style="text-align:center;">
      <p class="meta">暂无专题，敬请期待</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { topicsAPI } from '../api';

const topics = ref([]);
const router = useRouter();

function goTopic(id) {
  router.push(`/topics/${id}`);
}

onMounted(async () => {
  try {
    const { data } = await topicsAPI.list();
    topics.value = data;
  } catch (e) { console.error(e); }
});
</script>

<style scoped>
.topic-card {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}
.topic-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(139, 90, 43, 0.12);
}
.topic-cover-wrap {
  width: 120px;
  height: 160px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: #eee;
  display: flex;
  align-items: center;
  justify-content: center;
}
.topic-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.topic-cover-placeholder {
  background: linear-gradient(135deg, #f5e6d3, #d4a574);
}
.topic-summary {
  font-size: 14px;
  color: #555;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 6px;
}
</style>
