<template>
  <div>
    <h1 class="page-title">版本文字对照</h1>

    <div class="card">
      <p class="meta" style="margin-bottom:12px;">选择需要对比的版本（可跨词条）：</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
        <label v-for="v in allVersions" :key="v.id" :class="{selected: selectedIds.includes(v.id)}"
          style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 12px;border:1px solid var(--border);border-radius:4px;background:#fff;">
          <input type="checkbox" :value="v.id" v-model="selectedIds" />
          <strong>{{ v.entry_title }}</strong> · {{ v.version_name }}
        </label>
      </div>
      <button class="btn" :disabled="selectedIds.length < 2" @click="doCompare">开始对照</button>
    </div>

    <div v-if="compared.length" style="margin-top:20px;">
      <div class="grid" :style="{gridTemplateColumns: `repeat(${compared.length}, 1fr)`}">
        <div v-for="v in compared" :key="v.id" class="compare-col">
          <div class="col-title">
            {{ v.entry?.title || '' }} · {{ v.version_name }}
            <span style="opacity:0.8;font-weight:normal;margin-left:6px;">{{ v.pub_year }}</span>
          </div>
          <div class="text-display">{{ v.full_text || '（该版本暂未录入全文）' }}</div>
          <div style="margin-top:10px;">
            <router-link :to="`/versions/${v.id}`" class="btn sm secondary">查看该版本详情</router-link>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:24px;">
        <h4 style="color:var(--primary-dark);margin-bottom:10px;">📝 差异说明</h4>
        <p style="font-size:14px;line-height:2;color:#555;">
          对比可见不同版本在用字、标点、分段等方面的差异。例如程甲本保留了"通灵"二字的引号，而程乙本删去；
          脂评本系统（如庚辰本、甲戌本）开篇多出【】括起的一段文字，为脂批本所独有。这类异文是版本学研究的重要依据。
        </p>
      </div>
    </div>
    <div v-else class="card">
      <p class="meta">请至少选择 2 个版本进行对照。推荐选择：红楼梦·程甲本 vs 程乙本，或 石头记·庚辰本 vs 甲戌本。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { versionsAPI, adminAPI } from '../api';

const allVersions = ref([]);
const selectedIds = ref([]);
const compared = ref([]);
const route = useRoute();

onMounted(async () => {
  try {
    const { data } = await adminAPI.versions();
    allVersions.value = data;
    if (route.query.ids) {
      selectedIds.value = route.query.ids.split(',').map(Number);
      if (selectedIds.value.length >= 2) doCompare();
    }
  } catch (e) { console.error(e); }
});

async function doCompare() {
  if (selectedIds.value.length < 2) return;
  try {
    const { data } = await versionsAPI.compare(selectedIds.value);
    compared.value = data;
  } catch (e) { console.error(e); }
}
</script>

<style scoped>
label.selected { border-color: var(--primary); background: #fffaf2; }
</style>
