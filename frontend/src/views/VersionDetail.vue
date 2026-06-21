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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { versionsAPI, imagesAPI, annotationsAPI } from '../api';

const route = useRoute();
const version = ref(null);
const images = ref([]);
const annotations = ref([]);
const imageCaption = ref('');
const imagePage = ref(null);
const newAnn = ref({ user_name: '', anchor_text: '', comment: '' });

const placeholder = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#f5e6d3"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#8b5a2b" font-size="24" font-family="serif">书影</text></svg>');

function onImgErr(e) { e.target.src = placeholder; }

async function load() {
  const id = route.params.id;
  try {
    const [vRes, iRes, aRes] = await Promise.all([
      versionsAPI.get(id),
      imagesAPI.listByVersion(id),
      annotationsAPI.listByVersion(id)
    ]);
    version.value = vRes.data;
    images.value = iRes.data;
    annotations.value = aRes.data;
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

onMounted(load);
</script>
