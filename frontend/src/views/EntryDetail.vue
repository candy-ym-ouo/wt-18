<template>
  <div v-if="entry">
    <router-link to="/" style="color:var(--text-muted);">← 返回词条列表</router-link>

    <div class="card" style="margin-top:16px;">
      <div style="display:flex;gap:24px;align-items:flex-start;">
        <img v-if="entry.cover_url" :src="entry.cover_url" style="width:160px;border-radius:4px;" />
        <div style="flex:1;">
          <h1 class="page-title" style="margin-bottom:8px;">{{ entry.title }}</h1>
          <p style="font-size:16px;color:#555;">
            <strong>{{ entry.author || '佚名' }}</strong>
            <span v-if="entry.dynasty" class="tag" style="margin-left:10px;">{{ entry.dynasty }}</span>
          </p>
          <p style="margin-top:12px;font-size:15px;line-height:1.9;">{{ entry.summary }}</p>
          <p class="meta" style="margin-top:8px;">
            收录版本 {{ entry.versions?.length || 0 }} 个 ·
            更新于 {{ entry.updated_at }}
          </p>
          <div v-if="entry.categories && entry.categories.length" style="margin-top:12px;">
            <label style="font-size:13px;color:#6b7280;margin-right:8px;">分类：</label>
            <span
              v-for="c in entry.categories"
              :key="c.id"
              class="tag cat-tag"
              :style="{ backgroundColor: c.color + '15', borderColor: c.color + '40', color: c.color }"
              :title="c.is_primary ? '主分类' : ''"
            >
              {{ c.is_primary ? '★ ' : '' }}{{ c.name }}
            </span>
          </div>
          <div v-if="entry.tags && entry.tags.length" style="margin-top:8px;">
            <label style="font-size:13px;color:#6b7280;margin-right:8px;">标签：</label>
            <span
              v-for="t in entry.tags"
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

    <h3 class="page-title" style="font-size:20px;">版本一览</h3>
    <div class="grid cols-2">
      <div v-for="v in entry.versions" :key="v.id" class="card" style="cursor:pointer;" @click="goVersion(v.id)">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h4 style="color:var(--primary-dark);">{{ v.version_name }}</h4>
          <span class="tag">{{ v.pub_year || '年代未详' }}</span>
        </div>
        <p class="meta" style="margin-top:6px;">
          {{ v.publisher || '出版者未详' }}
          <span v-if="v.pages"> · {{ v.pages }} 回/页</span>
          <span v-if="v.isbn"> · ISBN: {{ v.isbn }}</span>
        </p>
        <p style="margin-top:8px;font-size:14px;color:#555;">{{ v.description }}</p>
        <div v-if="v.tags && v.tags.length" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">
          <span
            v-for="t in v.tags.slice(0, 4)"
            :key="t.id"
            class="tag"
            :style="{ backgroundColor: t.color + '15', borderColor: t.color + '40', color: t.color, fontSize: '11px', padding: '2px 8px' }"
          >
            {{ t.name }}
          </span>
        </div>
        <div style="margin-top:10px;">
          <router-link :to="`/versions/${v.id}`" class="btn sm secondary">查看详情</router-link>
        </div>
      </div>
    </div>

    <h3 class="page-title" style="font-size:20px;margin-top:24px;">版本对照</h3>
    <div class="card">
      <p class="meta" style="margin-bottom:12px;">选择 2 个以上版本进行文字对照分析：</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
        <label v-for="v in entry.versions" :key="v.id" style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 12px;border:1px solid var(--border);border-radius:4px;background:#fff;">
          <input type="checkbox" :value="v.id" v-model="compareIds" />
          {{ v.version_name }}
        </label>
      </div>
      <button class="btn" :disabled="compareIds.length < 2" @click="goCompare">开始对照 ({{ compareIds.length }})</button>
    </div>

    <div style="margin-top:24px;">
      <RevisionHistory
        entity-type="entry"
        :entity-id="entryId"
        :user="currentUser"
        @rollback="onRollback"
      />
    </div>

    <h3 class="page-title" style="font-size:20px;margin-top:24px;">引用关系</h3>
    <div class="grid cols-2">
      <div class="card">
        <h4 style="color:var(--primary-dark);margin-bottom:10px;">→ 引用他书</h4>
        <div v-if="refs.outgoing.length">
          <div v-for="r in refs.outgoing" :key="r.id" class="ref-item">
            <div>
              <span class="ref-type">{{ r.relation_type }}</span>
              <router-link :to="`/entries/${r.to_entry_id}`" style="margin-left:8px;">{{ r.to_title }}</router-link>
            </div>
            <span class="meta">{{ r.note }}</span>
          </div>
        </div>
        <p v-else class="meta">暂无记录</p>
      </div>
      <div class="card">
        <h4 style="color:var(--primary-dark);margin-bottom:10px;">← 被他书引用</h4>
        <div v-if="refs.incoming.length">
          <div v-for="r in refs.incoming" :key="r.id" class="ref-item">
            <div>
              <router-link :to="`/entries/${r.from_entry_id}`">{{ r.from_title }}</router-link>
              <span class="ref-type" style="margin-left:8px;">{{ r.relation_type }}</span>
            </div>
            <span class="meta">{{ r.note }}</span>
          </div>
        </div>
        <p v-else class="meta">暂无记录</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { entriesAPI, referencesAPI } from '../api';
import { useUserStore } from '../stores/user';
import RevisionHistory from '../components/RevisionHistory.vue';

const props = defineProps(['id']);
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const entry = ref(null);
const refs = ref({ outgoing: [], incoming: [] });
const compareIds = ref([]);

const entryId = computed(() => props.id || route.params.id);
const currentUser = computed(() => userStore.user);

async function load() {
  try {
    const [eRes, rRes] = await Promise.all([
      entriesAPI.get(entryId.value),
      referencesAPI.listByEntry(entryId.value)
    ]);
    entry.value = eRes.data;
    refs.value = rRes.data;
  } catch (e) { console.error(e); }
}

function goVersion(id) { router.push(`/versions/${id}`); }
function goCompare() {
  if (compareIds.value.length >= 2) {
    router.push({ path: '/compare', query: { ids: compareIds.value.join(',') } });
  }
}
function onRollback() { load(); }

onMounted(() => {
  userStore.init();
  load();
});
</script>
