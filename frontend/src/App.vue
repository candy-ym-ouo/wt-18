<template>
  <div>
    <header class="navbar">
      <router-link to="/" class="brand">📜 旧书版本考据</router-link>
      <nav>
        <router-link to="/">词条浏览</router-link>
        <router-link to="/topics">专题专栏</router-link>
        <router-link to="/tasks">任务协作</router-link>
        <router-link to="/collation">校勘工作台</router-link>
        <router-link to="/compare">版本对照</router-link>
        <router-link to="/graph">引用图谱</router-link>
        <router-link to="/submission" class="nav-submission">版本征集</router-link>
        <router-link v-if="userStore.canAccessAdmin" to="/admin">后台编辑</router-link>
      </nav>
      <div class="user-area">
        <div v-if="userStore.isLoggedIn" class="user-menu">
          <button class="user-btn" @click="showMenu = !showMenu">
            <span class="avatar">{{ avatarChar }}</span>
            <span class="user-name">{{ userStore.username }}</span>
            <span class="role-tag" :class="roleTagClass">{{ roleLabel }}</span>
            <span class="arrow">▾</span>
          </button>
          <div v-if="showMenu" class="dropdown" @click.self="showMenu = false">
            <div class="dropdown-header">
              <div class="big-avatar">{{ avatarChar }}</div>
              <div>
                <div class="dd-name">{{ userStore.username }}</div>
                <div class="dd-role">{{ roleLabel }}</div>
                <div v-if="userStore.user?.email" class="dd-email">{{ userStore.user.email }}</div>
              </div>
            </div>
            <div class="dropdown-divider"></div>
            <button class="dd-item" @click="openPwdModal">
              <span>🔑</span> 修改密码
            </button>
            <div class="dropdown-divider"></div>
            <button class="dd-item danger" @click="doLogout">
              <span>🚪</span> 退出登录
            </button>
          </div>
          <div v-if="showMenu" class="backdrop" @click="showMenu = false"></div>
        </div>
        <div v-else class="auth-btns">
          <router-link class="btn sm secondary" to="/login">登录</router-link>
          <router-link class="btn sm" to="/login?tab=register">注册</router-link>
        </div>
      </div>
    </header>
    <main class="container">
      <router-view />
    </main>

    <div v-if="showPwdModal" class="modal-overlay" @click.self="showPwdModal = false">
      <div class="modal sm-modal">
        <h3>修改密码</h3>
        <div class="form-group">
          <label>原密码</label>
          <input v-model="pwdForm.old" type="password" />
        </div>
        <div class="form-group">
          <label>新密码</label>
          <input v-model="pwdForm.new" type="password" placeholder="至少6位" />
        </div>
        <div class="form-group">
          <label>确认新密码</label>
          <input v-model="pwdForm.confirm" type="password" />
        </div>
        <p v-if="pwdError" class="form-error">{{ pwdError }}</p>
        <p v-if="pwdSuccess" class="form-success">{{ pwdSuccess }}</p>
        <div style="text-align:right;">
          <button class="btn secondary" style="margin-right:8px;" @click="showPwdModal = false">取消</button>
          <button class="btn" @click="submitPwd" :disabled="pwdLoading">
            {{ pwdLoading ? '提交中...' : '确定修改' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from './stores/user';
import { ROLE_LABELS, ROLES } from './api';

const userStore = useUserStore();
const router = useRouter();

const showMenu = ref(false);
const showPwdModal = ref(false);
const pwdLoading = ref(false);
const pwdError = ref('');
const pwdSuccess = ref('');
const pwdForm = reactive({ old: '', new: '', confirm: '' });

const avatarChar = computed(() => {
  const name = userStore.username || '学';
  return name.charAt(0).toUpperCase();
});

const roleLabel = computed(() => {
  const role = userStore.role;
  return ROLE_LABELS[role] || role || '';
});

const roleTagClass = computed(() => ({
  'role-admin': userStore.role === ROLES.ADMIN,
  'role-editor': userStore.role === ROLES.EDITOR,
  'role-viewer': userStore.role === ROLES.VIEWER
}));

function openPwdModal() {
  showMenu.value = false;
  showPwdModal.value = true;
  pwdError.value = '';
  pwdSuccess.value = '';
  pwdForm.old = '';
  pwdForm.new = '';
  pwdForm.confirm = '';
}

async function submitPwd() {
  pwdError.value = '';
  pwdSuccess.value = '';
  if (!pwdForm.old || !pwdForm.new || !pwdForm.confirm) {
    pwdError.value = '请填写所有字段';
    return;
  }
  if (pwdForm.new.length < 6) {
    pwdError.value = '新密码至少需要6位';
    return;
  }
  if (pwdForm.new !== pwdForm.confirm) {
    pwdError.value = '两次输入的新密码不一致';
    return;
  }
  pwdLoading.value = true;
  const result = await userStore.changePassword(pwdForm.old, pwdForm.new);
  pwdLoading.value = false;
  if (result.success) {
    pwdSuccess.value = '密码修改成功！';
    setTimeout(() => (showPwdModal.value = false), 1200);
  } else {
    pwdError.value = result.error;
  }
}

function doLogout() {
  showMenu.value = false;
  userStore.logout();
  router.push('/login');
}

onMounted(() => {
  userStore.init();
});
</script>

<style>
.nav-submission {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff !important;
  padding: 6px 14px !important;
  border-radius: 999px;
  font-weight: 600;
  margin-left: 4px;
}
.nav-submission:hover {
  background: linear-gradient(135deg, #d97706, #b45309);
  transform: translateY(-1px);
}
.nav-submission.router-link-active {
  background: linear-gradient(135deg, #b45309, #92400e);
}

.user-area {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}
.auth-btns {
  display: flex;
  gap: 8px;
}
.user-menu {
  position: relative;
}
.user-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}
.user-btn:hover {
  background: rgba(255,255,255,0.1);
}
.avatar {
  width: 26px;
  height: 26px;
  background: linear-gradient(135deg, #f4a261, #e76f51);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}
.user-name {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.role-tag {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 1.4;
}
.role-admin { background: rgba(239,68,68,0.2); color: #fecaca; }
.role-editor { background: rgba(245,158,11,0.2); color: #fde68a; }
.role-viewer { background: rgba(34,197,94,0.2); color: #bbf7d0; }
.arrow { opacity: 0.6; font-size: 11px; }
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 9;
}
.dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  background: #fff;
  color: #333;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  min-width: 260px;
  z-index: 10;
  overflow: hidden;
}
.dropdown-header {
  padding: 16px;
  display: flex;
  gap: 12px;
  background: linear-gradient(135deg, #faf7f2, #f5efe6);
}
.big-avatar {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #f4a261, #e76f51);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 600;
  flex-shrink: 0;
}
.dd-name { font-weight: 600; color: var(--primary-dark); margin-bottom: 2px; }
.dd-role { font-size: 12px; color: #888; margin-bottom: 2px; }
.dd-email { font-size: 12px; color: #aaa; }
.dropdown-divider { height: 1px; background: #f0f0f0; }
.dd-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: none;
  border: none;
  color: #444;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}
.dd-item:hover { background: #faf7f2; }
.dd-item.danger { color: #dc2626; }
.dd-item.danger:hover { background: #fef2f2; }
.sm-modal { max-width: 420px; }
.form-error { color: #dc2626; font-size: 13px; margin: 4px 0; }
.form-success { color: #15803d; font-size: 13px; margin: 4px 0; }
</style>
