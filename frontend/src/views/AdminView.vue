<template>
  <div>
    <h1 class="page-title">后台编辑管理</h1>

    <div class="stats-grid">
      <div class="stat-card"><div class="num">{{ stats.entries }}</div><div class="label">词条数</div></div>
      <div class="stat-card"><div class="num">{{ stats.versions }}</div><div class="label">版本数</div></div>
      <div class="stat-card"><div class="num">{{ stats.images }}</div><div class="label">图片数</div></div>
      <div class="stat-card"><div class="num">{{ stats.annotations }}</div><div class="label">批注数</div></div>
      <div class="stat-card"><div class="num">{{ stats.references }}</div><div class="label">引用数</div></div>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:16px;">
      <button :class="['btn', tab==='entries'?'':'secondary']" @click="tab='entries'">词条管理</button>
      <button :class="['btn', tab==='versions'?'':'secondary']" @click="tab='versions'">版本管理</button>
      <button :class="['btn', tab==='refs'?'':'secondary']" @click="tab='refs'">引用关系</button>
    </div>

    <div v-if="tab==='entries'" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="color:var(--primary-dark);">词条列表</h3>
        <button class="btn sm" @click="openEntryModal()">+ 新建词条</button>
      </div>
      <table>
        <thead><tr><th>ID</th><th>书名</th><th>作者</th><th>朝代</th><th>版本数</th><th>引用数</th><th>更新时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="e in entries" :key="e.id">
            <td>{{ e.id }}</td>
            <td><strong>{{ e.title }}</strong></td>
            <td>{{ e.author || '-' }}</td>
            <td>{{ e.dynasty || '-' }}</td>
            <td>{{ e.version_count }}</td>
            <td>{{ e.ref_count }}</td>
            <td class="meta">{{ e.updated_at }}</td>
            <td>
              <div class="actions">
                <button class="btn sm secondary" @click="openEntryModal(e)">编辑</button>
                <button class="btn sm danger" @click="delEntry(e)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="tab==='versions'" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="color:var(--primary-dark);">版本列表</h3>
        <button class="btn sm" @click="openVersionModal()">+ 新建版本</button>
      </div>
      <table>
        <thead><tr><th>ID</th><th>所属词条</th><th>版本名</th><th>出版者</th><th>年代</th><th>页数</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="v in versions" :key="v.id">
            <td>{{ v.id }}</td>
            <td>{{ v.entry_title }}</td>
            <td><strong>{{ v.version_name }}</strong></td>
            <td>{{ v.publisher || '-' }}</td>
            <td>{{ v.pub_year || '-' }}</td>
            <td>{{ v.pages || '-' }}</td>
            <td>
              <div class="actions">
                <button class="btn sm secondary" @click="openVersionModal(v)">编辑</button>
                <button class="btn sm danger" @click="delVersion(v)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="tab==='refs'" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="color:var(--primary-dark);">引用关系</h3>
        <button class="btn sm" @click="openRefModal()">+ 新建关系</button>
      </div>
      <table>
        <thead><tr><th>源词条</th><th>关系</th><th>目标词条</th><th>说明</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="r in allRefs" :key="r.id">
            <td>{{ r.from_title || '(加载中)' }}</td>
            <td><span class="ref-type">{{ r.relation_type }}</span></td>
            <td>{{ r.to_title || '(加载中)' }}</td>
            <td class="meta">{{ r.note || '-' }}</td>
            <td><button class="btn sm danger" @click="delRef(r)">删除</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showEntryModal" class="modal-overlay" @click.self="showEntryModal=false">
      <div class="modal">
        <h3>{{ editingEntry.id ? '编辑词条' : '新建词条' }}</h3>
        <div class="form-group">
          <label>书名 *</label>
          <input v-model="editingEntry.title" />
        </div>
        <div class="form-group">
          <label>作者</label>
          <input v-model="editingEntry.author" />
        </div>
        <div class="form-group">
          <label>朝代/时代</label>
          <input v-model="editingEntry.dynasty" placeholder="如：清代、明代" />
        </div>
        <div class="form-group">
          <label>封面 URL</label>
          <input v-model="editingEntry.cover_url" placeholder="图片链接" />
        </div>
        <div class="form-group">
          <label>内容简介</label>
          <textarea v-model="editingEntry.summary"></textarea>
        </div>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showEntryModal=false">取消</button>
          <button class="btn" @click="saveEntry">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showVersionModal" class="modal-overlay" @click.self="showVersionModal=false">
      <div class="modal">
        <h3>{{ editingVersion.id ? '编辑版本' : '新建版本' }}</h3>
        <div class="form-group">
          <label>所属词条 *</label>
          <select v-model="editingVersion.entry_id">
            <option v-for="e in entriesMin" :key="e.id" :value="e.id">{{ e.title }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>版本名 *</label>
          <input v-model="editingVersion.version_name" placeholder="如：庚辰本、程甲本" />
        </div>
        <div class="form-group">
          <label>出版者</label>
          <input v-model="editingVersion.publisher" />
        </div>
        <div class="form-group">
          <label>刊刻/出版年代</label>
          <input v-model="editingVersion.pub_year" placeholder="如：1791、乾隆五十六年" />
        </div>
        <div class="form-group">
          <label>回数/页数</label>
          <input type="number" v-model.number="editingVersion.pages" />
        </div>
        <div class="form-group">
          <label>ISBN</label>
          <input v-model="editingVersion.isbn" />
        </div>
        <div class="form-group">
          <label>版本说明</label>
          <textarea v-model="editingVersion.description"></textarea>
        </div>
        <div class="form-group">
          <label>全文录入（选填）</label>
          <textarea v-model="editingVersion.full_text" style="min-height:120px;"></textarea>
        </div>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showVersionModal=false">取消</button>
          <button class="btn" @click="saveVersion">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showRefModal" class="modal-overlay" @click.self="showRefModal=false">
      <div class="modal">
        <h3>新建引用关系</h3>
        <div class="form-group">
          <label>源词条（引用者）*</label>
          <select v-model="newRef.from_entry_id">
            <option v-for="e in entriesMin" :key="e.id" :value="e.id">{{ e.title }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>关系类型 *</label>
          <select v-model="newRef.relation_type">
            <option value="异名">异名</option>
            <option value="承袭">承袭</option>
            <option value="相关">相关</option>
          </select>
        </div>
        <div class="form-group">
          <label>目标词条（被引用者）*</label>
          <select v-model="newRef.to_entry_id">
            <option v-for="e in entriesMin" :key="e.id" :value="e.id">{{ e.title }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>说明</label>
          <textarea v-model="newRef.note"></textarea>
        </div>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showRefModal=false">取消</button>
          <button class="btn" @click="saveRef">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { entriesAPI, versionsAPI, referencesAPI, adminAPI } from '../api';

const tab = ref('entries');
const stats = ref({ entries: 0, versions: 0, images: 0, annotations: 0, references: 0 });
const entries = ref([]);
const entriesMin = ref([]);
const versions = ref([]);
const allRefs = ref([]);

const showEntryModal = ref(false);
const editingEntry = reactive({ id: null, title: '', author: '', dynasty: '', summary: '', cover_url: '' });

const showVersionModal = ref(false);
const editingVersion = reactive({ id: null, entry_id: null, version_name: '', publisher: '', pub_year: '', pages: null, isbn: '', description: '', full_text: '' });

const showRefModal = ref(false);
const newRef = reactive({ from_entry_id: null, to_entry_id: null, relation_type: '相关', note: '' });

async function loadAll() {
  const [s, e, v, em] = await Promise.all([
    adminAPI.stats(),
    adminAPI.entries(),
    adminAPI.versions(),
    adminAPI.allEntries()
  ]);
  stats.value = s.data;
  entries.value = e.data;
  versions.value = v.data;
  entriesMin.value = em.data;

  const map = Object.fromEntries(em.data.map(x => [x.id, x.title]));
  const refsList = [];
  for (const e of em.data) {
    const { data } = await referencesAPI.listByEntry(e.id);
    for (const r of data.outgoing) {
      r.from_title = map[r.from_entry_id];
      r.to_title = map[r.to_entry_id];
      refsList.push(r);
    }
  }
  const seen = new Set();
  allRefs.value = refsList.filter(r => {
    const k = `${r.from_entry_id}-${r.to_entry_id}-${r.relation_type}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

function openEntryModal(e = null) {
  if (e) Object.assign(editingEntry, e);
  else Object.assign(editingEntry, { id: null, title: '', author: '', dynasty: '', summary: '', cover_url: '' });
  showEntryModal.value = true;
}

async function saveEntry() {
  if (!editingEntry.title) return alert('请填写书名');
  if (editingEntry.id) await entriesAPI.update(editingEntry.id, editingEntry);
  else await entriesAPI.create(editingEntry);
  showEntryModal.value = false;
  loadAll();
}

async function delEntry(e) {
  if (!confirm(`确认删除词条《${e.title}》及其所有版本？`)) return;
  await entriesAPI.remove(e.id);
  loadAll();
}

function openVersionModal(v = null) {
  if (v) Object.assign(editingVersion, v);
  else Object.assign(editingVersion, { id: null, entry_id: entriesMin.value[0]?.id, version_name: '', publisher: '', pub_year: '', pages: null, isbn: '', description: '', full_text: '' });
  showVersionModal.value = true;
}

async function saveVersion() {
  if (!editingVersion.entry_id || !editingVersion.version_name) return alert('请填写必填项');
  if (editingVersion.id) await versionsAPI.update(editingVersion.id, editingVersion);
  else await versionsAPI.create(editingVersion);
  showVersionModal.value = false;
  loadAll();
}

async function delVersion(v) {
  if (!confirm(`确认删除版本「${v.version_name}」？`)) return;
  await versionsAPI.remove(v.id);
  loadAll();
}

function openRefModal() {
  if (entriesMin.value.length >= 2) {
    newRef.from_entry_id = entriesMin.value[0].id;
    newRef.to_entry_id = entriesMin.value[1].id;
  }
  newRef.relation_type = '相关';
  newRef.note = '';
  showRefModal.value = true;
}

async function saveRef() {
  if (!newRef.from_entry_id || !newRef.to_entry_id) return alert('请选择词条');
  if (newRef.from_entry_id === newRef.to_entry_id) return alert('源和目标不能相同');
  await referencesAPI.create(newRef);
  showRefModal.value = false;
  loadAll();
}

async function delRef(r) {
  if (!confirm('确认删除该引用关系？')) return;
  await referencesAPI.remove(r.id);
  loadAll();
}

onMounted(loadAll);
</script>
