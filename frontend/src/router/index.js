import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '../stores/user';
import { ROLES } from '../api';

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  { path: '/', name: 'Home', component: () => import('../views/HomeView.vue') },
  { path: '/topics', name: 'Topics', component: () => import('../views/TopicsView.vue') },
  { path: '/topics/:id', name: 'TopicDetail', component: () => import('../views/TopicDetailView.vue'), props: true },
  { path: '/topics/:id/chapters/:chapterId', name: 'ChapterRead', component: () => import('../views/ChapterReadView.vue'), props: true },
  { path: '/tasks', name: 'TaskBoard', component: () => import('../views/TaskBoardView.vue') },
  { path: '/entries/:id', name: 'EntryDetail', component: () => import('../views/EntryDetail.vue'), props: true },
  { path: '/compare', name: 'Compare', component: () => import('../views/CompareView.vue') },
  { path: '/versions/:id', name: 'VersionDetail', component: () => import('../views/VersionDetail.vue'), props: true },
  { path: '/graph', name: 'Graph', component: () => import('../views/GraphView.vue') },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/AdminView.vue'),
    meta: { minRole: ROLES.EDITOR }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore();
  if (!userStore.initialized) {
    await userStore.init();
  }

  if (to.meta.public) {
    return next();
  }

  if (to.meta.minRole && !userStore.hasRoleLevel(to.meta.minRole)) {
    if (!userStore.isLoggedIn) {
      return next({ path: '/login', query: { redirect: to.fullPath } });
    }
    return next({ path: '/' });
  }

  next();
});

export default router;
