<template>
  <div v-if="topic">
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;">
      <router-link to="/topics" class="btn sm secondary">← 返回专题列表</router-link>
    </div>

    <div class="card" style="background:linear-gradient(135deg,#fffaf2,#f5e6d3);">
      <div style="display:flex;gap:24px;flex-wrap:wrap;">
        <div v-if="topic.cover_url" style="width:160px;flex-shrink:0;">
          <img :src="topic.cover_url" style="width:100%;border-radius:4px;" :alt="topic.title" />
        </div>
        <div style="flex:1;min-width:240px;">
          <h1 style="color:var(--primary-dark);margin-bottom:8px;">{{ topic.title }}</h1>
          <p v-if="topic.subtitle" style="font-size:16px;color:var(--text-muted);margin-bottom:12px;">{{ topic.subtitle }}</p>
          <p v-if="topic.author" class="meta" style="margin-bottom:12px;">考据者：{{ topic.author }}</p>
          <p style="font-size:15px;line-height:1.8;color:#555;">{{ topic.summary }}</p>
          <div style="margin-top:12px;">
            <span class="tag">{{ topic.chapter_count }} 章</span>
            <span class="tag">{{ topic.entry_count || 0 }} 关联词条</span>
            <span class="meta" style="margin-left:12px;">更新于 {{ topic.updated_at }}</span>
          </div>
        </div>
      </div>
    </div>

    <h3 style="margin:24px 0 16px;color:var(--primary-dark);">章节目录</h3>

    <div v-if="topic.chapters && topic.chapters.length">
      <div v-for="(c, idx) in topic.chapters" :key="c.id" class="card chapter-item" @click="goChapter(c.id)">
        <div style="display:flex;align-items:center;gap:16px;">
          <div class="chapter-num">{{ idx + 1 }}</div>
          <div style="flex:1;min-width:0;">
            <h4 style="color:var(--primary-dark);margin-bottom:4px;">{{ c.title }}</h4>
            <p v-if="c.subtitle" class="meta">{{ c.subtitle }}</p>
          </div>
          <div class="meta">阅读 →</div>
        </div>
      </div>
    </div>

    <div v-else class="card" style="text-align:center;">
      <p class="meta">暂无章节</p>
    </div>
  </div>

  <div v-else class="card" style="text-align:center;">
    <p class="meta">加载中...</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { topicsAPI } from '../api';

const topic = ref(null);
const route = useRoute();
const router = useRouter();

function goChapter(chapterId) {
  router.push(`/topics/${route.params.id}/chapters/${chapterId}`);
}

onMounted(async () => {
  try {
    const { data } = await topicsAPI.get(route.params.id);
    topic.value = data;
  } catch (e) {
    console.error(e);
    alert('加载专题失败');
  }
});
</script>

<style scoped>
.chapter-item {
  cursor: pointer;
  transition: all 0.2s;
  padding: 16px 20px;
  margin-bottom: 12px;
}
.chapter-item:hover {
  background: #fffaf2;
  transform: translateX(4px);
}
.chapter-num {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--primary));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 16px;
  flex-shrink: 0;
}
</style>
