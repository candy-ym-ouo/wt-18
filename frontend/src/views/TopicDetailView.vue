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

    <div v-if="topic.entries && topic.entries.length" style="margin-top:24px;">
      <h3 style="margin-bottom:16px;color:var(--primary-dark);">
        <span style="border-left:4px solid var(--primary);padding-left:10px;">专题关联词条</span>
      </h3>
      <div class="grid cols-2">
        <div v-for="te in topic.entries" :key="te.id" class="card entry-ref-card" @click="goEntry(te.entry_id)">
          <div style="display:flex;gap:12px;">
            <div v-if="te.entry_cover" style="width:60px;height:80px;flex-shrink:0;border-radius:3px;overflow:hidden;background:#eee;">
              <img :src="te.entry_cover" style="width:100%;height:100%;object-fit:cover;" />
            </div>
            <div v-else style="width:60px;height:80px;flex-shrink:0;border-radius:3px;background:linear-gradient(135deg,#f5e6d3,#d4a574);display:flex;align-items:center;justify-content:center;font-size:24px;">
              📖
            </div>
            <div style="flex:1;min-width:0;">
              <h4 style="color:var(--primary-dark);margin-bottom:4px;">{{ te.entry_title }}</h4>
              <p class="meta" style="font-size:13px;margin-bottom:6px;">
                {{ te.entry_author || '佚名' }}<span v-if="te.entry_dynasty"> · {{ te.entry_dynasty }}</span>
              </p>
              <p v-if="te.note" style="font-size:13px;color:#555;line-height:1.6;">{{ te.note }}</p>
            </div>
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

function goEntry(entryId) {
  router.push(`/entries/${entryId}`);
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
.entry-ref-card {
  cursor: pointer;
  transition: all 0.2s;
  padding: 14px 16px;
}
.entry-ref-card:hover {
  background: #fffaf2;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(139, 90, 43, 0.1);
}
</style>
