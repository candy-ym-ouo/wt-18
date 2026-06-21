import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', name: 'Home', component: () => import('../views/HomeView.vue') },
  { path: '/entries/:id', name: 'EntryDetail', component: () => import('../views/EntryDetail.vue'), props: true },
  { path: '/compare', name: 'Compare', component: () => import('../views/CompareView.vue') },
  { path: '/versions/:id', name: 'VersionDetail', component: () => import('../views/VersionDetail.vue'), props: true },
  { path: '/graph', name: 'Graph', component: () => import('../views/GraphView.vue') },
  { path: '/admin', name: 'Admin', component: () => import('../views/AdminView.vue') }
];

export default createRouter({
  history: createWebHistory(),
  routes
});
