<template>
  <div v-if="chapter">
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
      <router-link :to="`/topics/${route.params.id}`" class="btn sm secondary">← 返回目录</router-link>
      <span class="meta" style="margin-left:8px;">{{ chapter.topic_title }}</span>
    </div>

    <div class="card chapter-header">
      <h1 style="color:var(--primary-dark);text-align:center;margin-bottom:8px;">{{ chapter.title }}</h1>
      <p v-if="chapter.subtitle" style="text-align:center;color:var(--text-muted);font-size:15px;">{{ chapter.subtitle }}</p>
    </div>

    <div class="chapter-nav card">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <button v-if="chapter.prevChapter" class="btn secondary sm" @click="goChapter(chapter.prevChapter.id)">
          ← 上一章：{{ chapter.prevChapter.title }}
        </button>
        <div v-else></div>
        <button v-if="chapter.nextChapter" class="btn secondary sm" @click="goChapter(chapter.nextChapter.id)">
          下一章：{{ chapter.nextChapter.title }} →
        </button>
      </div>
    </div>

    <div v-if="chapter.content" class="card">
      <div class="text-display chapter-content" v-html="formatContent(chapter.content)"></div>
    </div>

    <div v-if="chapter.entries && chapter.entries.length" style="margin-top:24px;">
      <h3 style="margin-bottom:16px;color:var(--primary-dark);">
        <span style="border-left:4px solid var(--primary);padding-left:10px;">关联词条</span>
      </h3>
      <div class="grid cols-2">
        <div v-for="te in chapter.entries" :key="te.id" class="card entry-ref-card" @click="goEntry(te.entry_id)">
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

    <div style="margin-top:24px;">
      <div class="chapter-nav card">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <button v-if="chapter.prevChapter" class="btn secondary sm" @click="goChapter(chapter.prevChapter.id)">
            ← 上一章
          </button>
          <router-link :to="`/topics/${route.params.id}`" class="btn secondary sm">章节目录</router-link>
          <button v-if="chapter.nextChapter" class="btn sm" @click="goChapter(chapter.nextChapter.id)">
            下一章 →
          </button>
        </div>
      </div>
    </div>

    <div v-if="chapter.allChapters && chapter.allChapters.length" class="card" style="margin-top:24px;">
      <h4 style="color:var(--primary-dark);margin-bottom:12px;">全部章节</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;">
        <button
          v-for="(c, idx) in chapter.allChapters"
          :key="c.id"
          :class="['chapter-quick', c.id === Number(route.params.chapterId) ? 'active' : '']"
          @click="goChapter(c.id)"
        >
          <span class="num">{{ idx + 1 }}.</span>
          <span class="ttl">{{ c.title }}</span>
        </button>
      </div>
    </div>
  </div>

  <div v-else class="card" style="text-align:center;">
    <p class="meta">加载中...</p>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { topicsAPI } from '../api';

const chapter = ref(null);
const route = useRoute();
const router = useRouter();

function goChapter(chapterId) {
  router.push(`/topics/${route.params.id}/chapters/${chapterId}`);
}

function goEntry(entryId) {
  router.push(`/entries/${entryId}`);
}

function formatContent(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n\n+/g, '</p><p style="margin-bottom:1em;">')
    .replace(/\n/g, '<br/>');
}

async function loadChapter() {
  try {
    const { data } = await topicsAPI.getChapter(route.params.id, route.params.chapterId);
    chapter.value = data;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    console.error(e);
    alert('加载章节失败');
  }
}

watch(() => [route.params.id, route.params.chapterId], () => {
  loadChapter();
});

onMounted(loadChapter);
</script>

<style scoped>
.chapter-header {
  background: linear-gradient(135deg, #fffaf2, #f5e6d3);
  border-bottom: 2px solid var(--accent);
}
.chapter-content {
  font-family: "Noto Serif SC", "Songti SC", "Source Han Serif SC", serif;
  font-size: 17px;
  line-height: 2.2;
  letter-spacing: 0.5px;
  padding: 32px;
}
.chapter-content :deep(p) {
  margin-bottom: 1em;
  text-indent: 2em;
}
.chapter-nav {
  background: #fffdf8;
  padding: 12px 20px;
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
.chapter-quick {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  font-size: 13px;
  transition: all 0.2s;
}
.chapter-quick:hover {
  background: #fffaf2;
  border-color: var(--primary);
}
.chapter-quick.active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.chapter-quick .num {
  color: var(--text-muted);
  flex-shrink: 0;
}
.chapter-quick.active .num {
  color: rgba(255,255,255,0.8);
}
.chapter-quick .ttl {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
