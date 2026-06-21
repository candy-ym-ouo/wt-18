<template>
  <div>
    <h1 class="page-title">引用关系图谱</h1>
    <div class="card" style="margin-bottom:16px;">
      <p class="meta">展示词条之间的引用、承袭、异名等关系。节点大小反映关联数量，拖拽可移动节点。</p>
    </div>

    <div class="graph-container" ref="svgContainer">
      <svg ref="svg" style="width:100%;height:100%;">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#8b5a2b" />
          </marker>
        </defs>
        <g>
          <line v-for="e in graph.edges" :key="'e'+e.source+e.target"
            :x1="nodePos[e.source]?.x" :y1="nodePos[e.source]?.y"
            :x2="nodePos[e.target]?.x" :y2="nodePos[e.target]?.y"
            stroke="#d4a574" stroke-width="1.5" marker-end="url(#arrow)" />
          <text v-for="e in graph.edges" :key="'l'+e.source+e.target"
            :x="(nodePos[e.source]?.x + nodePos[e.target]?.x)/2"
            :y="(nodePos[e.source]?.y + nodePos[e.target]?.y)/2 - 6"
            text-anchor="middle" fill="#8b5a2b" font-size="12">{{ e.label }}</text>
        </g>
        <g>
          <g v-for="n in graph.nodes" :key="'n'+n.id" :transform="`translate(${nodePos[n.id]?.x},${nodePos[n.id]?.y})`"
            style="cursor:move;" @mousedown="onDragStart($event, n.id)">
            <circle :r="30 + getRefCount(n.id) * 4" fill="#fffaf2" stroke="#8b5a2b" stroke-width="2" />
            <text y="5" text-anchor="middle" fill="#6b4423" font-size="13" font-weight="bold">{{ n.label }}</text>
          </g>
        </g>
      </svg>
    </div>

    <div class="card" style="margin-top:16px;">
      <h4 style="color:var(--primary-dark);margin-bottom:10px;">关系类型说明</h4>
      <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:14px;">
        <span class="tag" style="padding:4px 12px;">异名：同一部书的不同题名</span>
        <span class="tag" style="padding:4px 12px;">承袭：文本或叙事上的承继关系</span>
        <span class="tag" style="padding:4px 12px;">相关：其他值得注意的关联</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { referencesAPI } from '../api';

const svgContainer = ref(null);
const graph = ref({ nodes: [], edges: [] });
const nodePos = reactive({});

let draggingId = null, dragOffset = { x: 0, y: 0 };

function getRefCount(id) {
  return graph.value.edges.filter(e => e.source === id || e.target === id).length;
}

function layout() {
  const w = svgContainer.value?.clientWidth || 800;
  const h = svgContainer.value?.clientHeight || 600;
  const n = graph.value.nodes.length;
  graph.value.nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const r = Math.min(w, h) * 0.35;
    nodePos[node.id] = {
      x: w / 2 + r * Math.cos(angle),
      y: h / 2 + r * Math.sin(angle)
    };
  });
}

function onDragStart(e, id) {
  draggingId = id;
  dragOffset.x = e.clientX - nodePos[id].x;
  dragOffset.y = e.clientY - nodePos[id].y;
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', onDragEnd);
  e.preventDefault();
}
function onDrag(e) {
  if (draggingId == null) return;
  nodePos[draggingId].x = e.clientX - dragOffset.x;
  nodePos[draggingId].y = e.clientY - dragOffset.y;
}
function onDragEnd() {
  draggingId = null;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', onDragEnd);
}

onMounted(async () => {
  try {
    const { data } = await referencesAPI.graph();
    graph.value = data;
    setTimeout(layout, 50);
    window.addEventListener('resize', layout);
  } catch (e) { console.error(e); }
});
</script>
