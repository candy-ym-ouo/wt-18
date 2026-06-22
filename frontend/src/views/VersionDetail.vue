<template>
  <div v-if="version">
    <router-link :to="`/entries/${version.entry?.id}`" style="color:var(--text-muted);">← 返回《{{ version.entry?.title }}》</router-link>

    <div class="card" style="margin-top:16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <h1 class="page-title" style="margin-bottom:6px;">{{ version.entry?.title }} · {{ version.version_name }}</h1>
          <p class="meta">
            {{ version.publisher || '出版者未详' }} · {{ version.pub_year || '年代未详' }}
            <span v-if="version.pages"> · {{ version.pages }} 回/页</span>
            <span v-if="version.isbn"> · ISBN: {{ version.isbn }}</span>
          </p>
          <p style="margin-top:10px;color:#555;">{{ version.description }}</p>
          <div v-if="version.categories && version.categories.length" style="margin-top:12px;">
            <label style="font-size:13px;color:#6b7280;margin-right:8px;">分类：</label>
            <span
              v-for="c in version.categories"
              :key="c.id"
              class="tag cat-tag"
              :style="{ backgroundColor: c.color + '15', borderColor: c.color + '40', color: c.color }"
              :title="c.is_primary ? '主分类' : ''"
            >
              {{ c.is_primary ? '★ ' : '' }}{{ c.name }}
            </span>
          </div>
          <div v-if="version.tags && version.tags.length" style="margin-top:8px;">
            <label style="font-size:13px;color:#6b7280;margin-right:8px;">标签：</label>
            <span
              v-for="t in version.tags"
              :key="t.id"
              class="tag"
              :style="{ backgroundColor: t.color + '15', borderColor: t.color + '40', color: t.color }"
            >
              {{ t.name }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid cols-2">
      <div>
        <h3 class="page-title" style="font-size:18px;">📖 版本文本</h3>
        <div class="card">
          <div class="text-display">{{ version.full_text || '（暂无全文录入）' }}</div>
        </div>
      </div>

      <div>
        <h3 class="page-title" style="font-size:18px;">🖼️ 书影图片</h3>
        <div class="card">
          <div style="margin-bottom:14px;">
            <input type="file" ref="fileInput" style="display:none;" @change="onFileSelect" accept="image/*" />
            <input v-model="imageCaption" placeholder="图注说明（可选）" style="padding:6px 10px;border:1px solid var(--border);border-radius:4px;margin-right:8px;" />
            <input v-model.number="imagePage" type="number" placeholder="页码" style="width:80px;padding:6px 10px;border:1px solid var(--border);border-radius:4px;margin-right:8px;" />
            <button class="btn sm secondary" @click="$refs.fileInput.click()">上传图片</button>
          </div>
          <div v-if="images.length" class="grid cols-2">
            <div v-for="img in images" :key="img.id" style="position:relative;">
              <div style="aspect-ratio:1;background:#f5e6d3;border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                <img :src="img.filename.startsWith('sample') ? placeholder : `/uploads/${img.filename}`"
                  :alt="img.caption" style="width:100%;height:100%;object-fit:cover;" @error="onImgErr" />
              </div>
              <p style="font-size:12px;margin-top:4px;color:var(--text-muted);">
                {{ img.caption || '无图注' }}
                <span v-if="img.page_number"> · 第{{ img.page_number }}页</span>
              </p>
              <button class="btn sm danger" style="position:absolute;top:4px;right:4px;padding:2px 6px;font-size:11px;" @click="delImage(img.id)">×</button>
            </div>
          </div>
          <p v-else class="meta">暂无书影，可上传版本扉页、批校题跋、插图等图片。</p>
        </div>
      </div>
    </div>

    <h3 class="page-title" style="font-size:18px;margin-top:24px;">📝 批注讨论</h3>
    <div class="card">
      <div style="display:grid;grid-template-columns:1fr 1fr 2fr;gap:10px;margin-bottom:14px;">
        <input v-model="newAnn.user_name" placeholder="署名（默认匿名学者）" style="padding:8px 12px;border:1px solid var(--border);border-radius:4px;" />
        <input v-model="newAnn.anchor_text" placeholder="标注原文（可选）" style="padding:8px 12px;border:1px solid var(--border);border-radius:4px;" />
        <textarea v-model="newAnn.comment" placeholder="写下你的考据、校勘意见或讨论..." style="padding:8px 12px;border:1px solid var(--border);border-radius:4px;min-height:40px;resize:vertical;"></textarea>
      </div>
      <div style="text-align:right;margin-bottom:16px;">
        <button class="btn" @click="submitAnn">发表批注</button>
      </div>

      <div v-if="annotations.length">
        <div v-for="a in annotations" :key="a.id" class="annotation-item">
          <div style="display:flex;justify-content:space-between;">
            <span class="user">{{ a.user_name }}</span>
            <span class="meta">{{ a.created_at }}</span>
          </div>
          <div v-if="a.anchor_text" class="anchor">「{{ a.anchor_text }}」</div>
          <div style="margin-top:4px;">{{ a.comment }}</div>
          <div v-if="a.replies && a.replies.length" style="margin-left:20px;margin-top:8px;">
            <div v-for="r in a.replies" :key="r.id" class="annotation-item" style="background:#faf6f0;">
              <div style="display:flex;justify-content:space-between;">
                <span class="user">{{ r.user_name }}</span>
                <span class="meta">{{ r.created_at }}</span>
              </div>
              <div style="margin-top:4px;">{{ r.comment }}</div>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="meta">暂无批注，欢迎首发你的考据见解！</p>
    </div>

    <div style="margin-top:24px;">
      <RevisionHistory
        entity-type="version"
        :entity-id="versionId"
        :user="currentUser"
        @rollback="onRollback"
      />
    </div>

    <h3 class="page-title" style="font-size:18px;margin-top:24px;">🔬 校勘结果</h3>
    <div class="card">
      <div v-if="collationResults.length === 0" class="meta">
        <p>暂无校勘记录。</p>
        <router-link to="/collation" style="margin-top:8px;display:inline-block;">前往校勘工作台 →</router-link>
      </div>
      <div v-else>
        <div v-for="result in collationResults" :key="result.task.id" class="collation-result-card">
          <div class="collation-result-header">
            <div>
              <h4 style="color:var(--primary-dark);margin:0;">{{ result.task.title }}</h4>
              <p class="meta" style="margin-top:4px;">
                📚 {{ result.task.entry?.title }} ·
                📖 底本: {{ result.task.base_version?.version_name }} ·
                校本: {{ result.task.target_versions?.map(v => v.version_name).join('、') }}
              </p>
            </div>
            <div style="text-align:right;">
              <span class="status-badge" :class="'status-' + result.task.status">
                {{ getCollationStatusLabel(result.task.status) }}
              </span>
              <div style="margin-top:6px;">
                <router-link :to="`/collation`" class="btn sm secondary">打开校勘工作台</router-link>
              </div>
            </div>
          </div>

          <div v-if="result.diffs.length > 0" class="collation-section">
            <h5 style="color:var(--primary-dark);margin-bottom:8px;">🔍 差异标注 ({{ result.diffs.length }})</h5>
            <div v-for="d in result.diffs" :key="d.id" class="diff-mini">
              <span class="diff-type-mini" :class="'diff-' + d.diff_type">{{ getDiffTypeLabel(d.diff_type) }}</span>
              <span class="diff-text-mini">
                <span class="base">「{{ d.base_text || '—' }}」</span>
                <span class="arrow">→</span>
                <span class="target">「{{ d.target_text || '—' }}」</span>
              </span>
              <span v-if="d.note" class="meta" style="margin-left:8px;">{{ d.note }}</span>
            </div>
          </div>

          <div v-if="result.conclusions.length > 0" class="collation-section">
            <h5 style="color:var(--primary-dark);margin-bottom:8px;">📝 校勘结论 ({{ result.conclusions.length }})</h5>
            <div v-for="c in result.conclusions" :key="c.id" class="conclusion-mini">
              <span class="conclusion-type-mini" :class="'type-' + c.conclusion_type">{{ getConclusionTypeLabel(c.conclusion_type) }}</span>
              <span class="conclusion-status-mini" :class="'status-' + c.status">{{ getConclusionStatusLabel(c.status) }}</span>
              <span class="conclusion-text">{{ c.content }}</span>
              <span v-if="c.final_text" class="final-text-mini">定本:「{{ c.final_text }}」</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { versionsAPI, imagesAPI, annotationsAPI, collationAPI } from '../api';
import { useUserStore } from '../stores/user';
import RevisionHistory from '../components/RevisionHistory.vue';

const route = useRoute();
const userStore = useUserStore();
const version = ref(null);

const versionId = computed(() => route.params.id);
const currentUser = computed(() => userStore.user);
const images = ref([]);
const annotations = ref([]);
const collationResults = ref([]);
const collationStatuses = ref([]);
const diffTypes = ref([]);
const conclusionTypes = ref([]);
const conclusionStatuses = ref([]);
const imageCaption = ref('');
const imagePage = ref(null);
const newAnn = ref({ user_name: '', anchor_text: '', comment: '' });

const placeholder = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#f5e6d3"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#8b5a2b" font-size="24" font-family="serif">书影</text></svg>');

function onImgErr(e) { e.target.src = placeholder; }

function getCollationStatusLabel(status) {
  const s = collationStatuses.value.find(x => x.value === status);
  return s ? s.label : status;
}

function getDiffTypeLabel(type) {
  const t = diffTypes.value.find(x => x.value === type);
  return t ? t.label : type;
}

function getConclusionTypeLabel(type) {
  const t = conclusionTypes.value.find(x => x.value === type);
  return t ? t.label : type;
}

function getConclusionStatusLabel(status) {
  const s = conclusionStatuses.value.find(x => x.value === status);
  return s ? s.label : status;
}

async function load() {
  const id = route.params.id;
  try {
    const [vRes, iRes, aRes, cRes, csRes, dtRes, ctRes, cstRes] = await Promise.all([
      versionsAPI.get(id),
      imagesAPI.listByVersion(id),
      annotationsAPI.listByVersion(id),
      collationAPI.getVersionResults(id).catch(() => ({ data: [] })),
      collationAPI.statuses().catch(() => ({ data: [] })),
      collationAPI.diffTypes().catch(() => ({ data: [] })),
      collationAPI.conclusionTypes().catch(() => ({ data: [] })),
      collationAPI.conclusionStatuses().catch(() => ({ data: [] }))
    ]);
    version.value = vRes.data;
    images.value = iRes.data;
    annotations.value = aRes.data;
    collationResults.value = cRes.data || [];
    collationStatuses.value = csRes.data || [];
    diffTypes.value = dtRes.data || [];
    conclusionTypes.value = ctRes.data || [];
    conclusionStatuses.value = cstRes.data || [];
  } catch (e) { console.error(e); }
}

async function onFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  if (imageCaption.value) fd.append('caption', imageCaption.value);
  if (imagePage.value) fd.append('page_number', String(imagePage.value));
  try {
    await imagesAPI.upload(route.params.id, fd);
    imageCaption.value = '';
    imagePage.value = null;
    e.target.value = '';
    const { data } = await imagesAPI.listByVersion(route.params.id);
    images.value = data;
  } catch (err) { console.error(err); alert('上传失败'); }
}

async function delImage(id) {
  if (!confirm('确定删除该图片？')) return;
  await imagesAPI.remove(id);
  images.value = images.value.filter(i => i.id !== id);
}

async function submitAnn() {
  if (!newAnn.value.comment.trim()) return;
  await annotationsAPI.create(route.params.id, newAnn.value);
  newAnn.value = { user_name: '', anchor_text: '', comment: '' };
  const { data } = await annotationsAPI.listByVersion(route.params.id);
  annotations.value = data;
}

function onRollback() { load(); }

onMounted(() => {
  userStore.init();
  load();
});
</script>

<style scoped>
.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-draft { background: #e0e0e0; color: #616161; }
.status-in_progress { background: #ffe0b2; color: #ef6c00; }
.status-review { background: #e1bee7; color: #7b1fa2; }
.status-done { background: #c8e6c9; color: #388e3c; }
.status-archived { background: #b0bec5; color: #455a64; }

.collation-result-card {
  background: #fffdf8;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 14px;
}

.collation-result-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px dashed var(--border);
}

.collation-section {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #eee;
}

.diff-mini {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 6px 10px;
  background: #fff;
  border-radius: 4px;
  margin-bottom: 6px;
  gap: 8px;
  font-size: 13px;
}

.diff-type-mini {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 8px;
  font-size: 11px;
  color: #fff;
  flex-shrink: 0;
}

.diff-character { background: #ef6c00; }
.diff-punctuation { background: #7b1fa2; }
.diff-wording { background: #1976d2; }
.diff-paragraph { background: #00796b; }
.diff-missing { background: #c62828; }
.diff-extra { background: #2e7d32; }
.diff-other { background: #546e7a; }

.diff-text-mini {
  font-family: "Noto Serif SC", "Songti SC", serif;
}

.diff-text-mini .base {
  background: rgba(139, 90, 43, 0.1);
  padding: 1px 4px;
  border-radius: 2px;
}

.diff-text-mini .arrow {
  color: var(--text-muted);
  margin: 0 4px;
}

.diff-text-mini .target {
  background: rgba(255, 152, 0, 0.15);
  padding: 1px 4px;
  border-radius: 2px;
}

.conclusion-mini {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 8px 12px;
  background: linear-gradient(135deg, #fffaf2, #fffdf8);
  border-left: 3px solid var(--primary);
  border-radius: 0 4px 4px 0;
  margin-bottom: 6px;
  gap: 8px;
  font-size: 13px;
}

.conclusion-type-mini {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 8px;
  font-size: 11px;
  color: #fff;
  flex-shrink: 0;
}

.type-accept_base { background: #1565c0; }
.type-accept_target { background: #ef6c00; }
.type-custom { background: #6a1b9a; }
.type-needs_research { background: #c62828; }
.type-no_difference { background: #2e7d32; }

.conclusion-status-mini {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 8px;
  font-size: 11px;
  flex-shrink: 0;
}

.status-pending { background: #fff3e0; color: #ef6c00; }
.status-reviewed { background: #e3f2fd; color: #1565c0; }
.status-approved { background: #e8f5e9; color: #2e7d32; }
.status-rejected { background: #ffebee; color: #c62828; }

.conclusion-text {
  flex: 1;
}

.final-text-mini {
  font-family: "Noto Serif SC", "Songti SC", serif;
  background: linear-gradient(135deg, #fff8e1, #ffecb3);
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 13px;
}
</style>
