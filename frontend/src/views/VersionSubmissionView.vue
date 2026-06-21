<template>
  <div class="submission-page">
    <h1 class="page-title">版本征集</h1>
    <p class="page-desc">
      欢迎向我们提交您发现的珍贵旧书版本线索。审核通过后，您的贡献将被正式收录，
      供更多研究学者参考。请尽可能详细地填写以下信息。
    </p>

    <div v-if="submissionSuccess" class="success-card">
      <div class="success-icon">✓</div>
      <h3>提交成功！</h3>
      <p>{{ successMessage }}</p>
      <p class="submission-id">提交编号：#{{ submissionId }}</p>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:16px;">
        <button class="btn" @click="viewSubmission">查看提交详情</button>
        <button class="btn secondary" @click="resetForm">继续提交</button>
      </div>
    </div>

    <div v-else class="card">
      <h3 class="section-title">关联词条</h3>
      <div class="form-group">
        <label>选择已有词条</label>
        <select v-model="form.entry_id" @change="onEntryChange">
          <option :value="null">-- 不关联（将创建新词条）--</option>
          <option v-for="e in entries" :key="e.id" :value="e.id">{{ e.title }}</option>
        </select>
      </div>
      <div v-if="!form.entry_id" class="grid cols-2">
        <div class="form-group">
          <label>书名 *</label>
          <input v-model="form.entry_title" placeholder="如：红楼梦" />
        </div>
        <div class="form-group">
          <label>作者</label>
          <input v-model="form.entry_author" placeholder="如：曹雪芹" />
        </div>
      </div>

      <h3 class="section-title">版本信息</h3>
      <div class="grid cols-2">
        <div class="form-group">
          <label>版本名 *</label>
          <input v-model="form.version_name" placeholder="如：庚辰本、程甲本、1953年版" />
        </div>
        <div class="form-group">
          <label>出版者/刊刻者</label>
          <input v-model="form.publisher" placeholder="如：人民文学出版社" />
        </div>
        <div class="form-group">
          <label>刊刻/出版年代</label>
          <input v-model="form.pub_year" placeholder="如：1791、乾隆五十六年" />
        </div>
        <div class="form-group">
          <label>回数/页数</label>
          <input type="number" v-model.number="form.pages" placeholder="如：120" />
        </div>
        <div class="form-group">
          <label>ISBN（如有）</label>
          <input v-model="form.isbn" placeholder="如：9787020002207" />
        </div>
      </div>
      <div class="form-group">
        <label>版本说明</label>
        <textarea v-model="form.description" rows="4" placeholder="请详细描述该版本的特点、价值、来源等信息..."></textarea>
      </div>

      <h3 class="section-title">书影图片</h3>
      <div class="form-group">
        <label>上传书影（可多张）</label>
        <div class="upload-area" @click="triggerFileInput" @drop.prevent="onDrop" @dragover.prevent>
          <input ref="fileInput" type="file" accept="image/*" multiple @change="onFileSelect" style="display:none;" />
          <div v-if="uploadedImages.length === 0" class="upload-placeholder">
            <div class="upload-icon">📷</div>
            <p>点击或拖拽图片到此处上传</p>
            <p class="hint">支持 JPG、PNG 格式，单张不超过 10MB</p>
          </div>
          <div v-else class="image-grid">
            <div v-for="(img, idx) in uploadedImages" :key="idx" class="image-item">
              <img :src="img.url" :alt="img.caption || '书影'" />
              <button class="remove-image" @click.stop="removeImage(idx)">×</button>
              <input v-model="img.caption" class="image-caption" placeholder="图片说明（选填）" />
            </div>
            <div class="add-more" @click.stop="triggerFileInput">
              <span>+ 添加更多</span>
            </div>
          </div>
        </div>
        <div v-if="uploading" class="uploading-hint">上传中...</div>
      </div>

      <h3 class="section-title">您的信息</h3>
      <div class="grid cols-2">
        <div class="form-group">
          <label>姓名 *</label>
          <input v-model="form.submitter_name" placeholder="请填写您的姓名" />
        </div>
        <div class="form-group">
          <label>联系方式（选填）</label>
          <input v-model="form.submitter_contact" placeholder="邮箱或电话，方便我们与您联系" />
        </div>
      </div>
      <div class="form-group">
        <label>备注说明（选填）</label>
        <textarea v-model="form.submitter_note" rows="2" placeholder="其他需要说明的信息..."></textarea>
      </div>

      <div class="form-actions">
        <button class="btn secondary" @click="resetForm">重置</button>
        <button class="btn" @click="submitForm" :disabled="submitting">
          {{ submitting ? '提交中...' : '提交版本线索' }}
        </button>
      </div>
    </div>

    <div v-if="showDetail" class="modal-overlay" @click.self="showDetail=false">
      <div class="modal detail-modal">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3>提交详情</h3>
          <button class="btn sm secondary" @click="showDetail=false">关闭</button>
        </div>
        <div v-if="submissionDetail">
          <div class="detail-row">
            <span class="label">提交编号：</span>
            <span>#{{ submissionDetail.id }}</span>
          </div>
          <div class="detail-row">
            <span class="label">提交时间：</span>
            <span>{{ submissionDetail.created_at }}</span>
          </div>
          <div class="detail-row">
            <span class="label">审核状态：</span>
            <span :class="['status-tag', statusClass(submissionDetail.status)]">{{ statusLabel(submissionDetail.status) }}</span>
          </div>
          <div v-if="submissionDetail.review_note" class="detail-row">
            <span class="label">审核说明：</span>
            <span>{{ submissionDetail.review_note }}</span>
          </div>
          <div class="detail-section">
            <h4>版本信息</h4>
            <div class="detail-row"><span class="label">词条：</span><span>{{ submissionDetail.entry_title || '（新建）' }}</span></div>
            <div class="detail-row"><span class="label">版本名：</span><span>{{ submissionDetail.version_name }}</span></div>
            <div class="detail-row"><span class="label">出版者：</span><span>{{ submissionDetail.publisher || '-' }}</span></div>
            <div class="detail-row"><span class="label">年代：</span><span>{{ submissionDetail.pub_year || '-' }}</span></div>
          </div>
          <div v-if="submissionDetail.images && submissionDetail.images.length > 0" class="detail-section">
            <h4>上传图片</h4>
            <div class="detail-images">
              <img v-for="img in submissionDetail.images" :key="img.id" :src="'/uploads/' + img.filename" :alt="img.caption" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { submissionsAPI, entriesAPI, handleApiError } from '../api';

const form = reactive({
  entry_id: null,
  entry_title: '',
  entry_author: '',
  version_name: '',
  publisher: '',
  pub_year: '',
  pages: null,
  isbn: '',
  description: '',
  submitter_name: '',
  submitter_contact: '',
  submitter_note: ''
});

const entries = ref([]);
const uploadedImages = ref([]);
const uploading = ref(false);
const submitting = ref(false);
const fileInput = ref(null);
const submissionSuccess = ref(false);
const successMessage = ref('');
const submissionId = ref(null);
const showDetail = ref(false);
const submissionDetail = ref(null);

onMounted(async () => {
  try {
    const { data } = await entriesAPI.list();
    entries.value = data;
  } catch (e) {
    console.error('加载词条列表失败', e);
  }
});

function onEntryChange() {
  if (form.entry_id) {
    form.entry_title = '';
    form.entry_author = '';
  }
}

function triggerFileInput() {
  fileInput.value?.click();
}

function onFileSelect(e) {
  const files = Array.from(e.target.files || []);
  uploadFiles(files);
  e.target.value = '';
}

function onDrop(e) {
  const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
  uploadFiles(files);
}

async function uploadFiles(files) {
  if (!submissionId.value) {
    alert('请先填写基本信息并提交，然后再上传图片');
    return;
  }
  for (const file of files) {
    uploading.value = true;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await submissionsAPI.uploadImage(submissionId.value, formData);
      uploadedImages.value.push({ id: data.id, url: data.url, filename: data.filename, caption: '' });
    } catch (e) {
      alert('上传失败: ' + handleApiError(e));
    } finally {
      uploading.value = false;
    }
  }
}

function removeImage(idx) {
  uploadedImages.value.splice(idx, 1);
}

async function submitForm() {
  if (!form.version_name.trim()) {
    alert('请填写版本名称');
    return;
  }
  if (!form.entry_id && !form.entry_title.trim()) {
    alert('请选择关联词条或填写新书书名');
    return;
  }
  if (!form.submitter_name.trim()) {
    alert('请填写您的姓名');
    return;
  }

  submitting.value = true;
  try {
    const { data } = await submissionsAPI.create(form);
    submissionId.value = data.id;
    successMessage.value = data.message;
    submissionSuccess.value = true;
  } catch (e) {
    alert('提交失败: ' + handleApiError(e));
  } finally {
    submitting.value = false;
  }
}

function resetForm() {
  Object.assign(form, {
    entry_id: null,
    entry_title: '',
    entry_author: '',
    version_name: '',
    publisher: '',
    pub_year: '',
    pages: null,
    isbn: '',
    description: '',
    submitter_name: '',
    submitter_contact: '',
    submitter_note: ''
  });
  uploadedImages.value = [];
  submissionSuccess.value = false;
  submissionId.value = null;
  submissionDetail.value = null;
}

async function viewSubmission() {
  if (!submissionId.value) return;
  try {
    const { data } = await submissionsAPI.get(submissionId.value);
    submissionDetail.value = data;
    showDetail.value = true;
  } catch (e) {
    alert('获取详情失败: ' + handleApiError(e));
  }
}

function statusLabel(status) {
  const labels = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };
  return labels[status] || status;
}

function statusClass(status) {
  return {
    pending: 'status-pending',
    approved: 'status-active',
    rejected: 'status-disabled'
  }[status] || '';
}
</script>

<style scoped>
.submission-page {
  max-width: 900px;
  margin: 0 auto;
}

.page-desc {
  color: #666;
  line-height: 1.8;
  margin-bottom: 24px;
  padding: 16px;
  background: #f8f5ee;
  border-radius: 8px;
  border-left: 4px solid var(--primary);
}

.section-title {
  color: var(--primary-dark);
  margin: 24px 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #e8e8e8;
  font-size: 16px;
}

.upload-area {
  border: 2px dashed #d4d4d4;
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #fafafa;
}

.upload-area:hover {
  border-color: var(--primary);
  background: #f8f5ee;
}

.upload-placeholder .upload-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.upload-placeholder p {
  margin: 4px 0;
  color: #666;
}

.upload-placeholder .hint {
  font-size: 12px;
  color: #999;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  align-items: start;
}

.image-item {
  position: relative;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.image-item img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}

.remove-image {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(220, 38, 38, 0.9);
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-caption {
  width: 100%;
  border: none;
  border-top: 1px solid #e8e8e8;
  padding: 6px 8px;
  font-size: 12px;
  box-sizing: border-box;
}

.add-more {
  border: 2px dashed #d4d4d4;
  border-radius: 6px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  cursor: pointer;
  transition: all 0.3s;
}

.add-more:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.uploading-hint {
  text-align: center;
  color: var(--primary);
  margin-top: 8px;
  font-size: 13px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e8e8e8;
}

.success-card {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  padding: 32px;
  text-align: center;
}

.success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #22c55e;
  color: #fff;
  font-size: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.success-card h3 {
  color: #15803d;
  margin-bottom: 8px;
}

.submission-id {
  color: #666;
  font-family: monospace;
  margin-top: 8px;
}

.detail-modal {
  max-width: 700px;
  max-height: 80vh;
  overflow-y: auto;
}

.detail-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.detail-row .label {
  width: 100px;
  color: #666;
  flex-shrink: 0;
}

.detail-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 2px solid #f0f0f0;
}

.detail-section h4 {
  color: var(--primary-dark);
  margin-bottom: 12px;
}

.detail-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.detail-images img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 4px;
}

.status-pending {
  background: rgba(245, 158, 11, 0.1);
  color: #a16207;
}
</style>
