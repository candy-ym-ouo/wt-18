<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <div class="brand-icon">📜</div>
        <h1>旧书版本考据社区</h1>
        <p class="subtitle">{{ isLogin ? '学者登录' : '学者注册' }}</p>
      </div>

      <div class="auth-tabs">
        <button :class="['tab', isLogin ? 'active' : '']" @click="isLogin = true; clearError()">登录</button>
        <button :class="['tab', !isLogin ? 'active' : '']" @click="isLogin = false; clearError()">注册</button>
      </div>

      <div v-if="errorMsg" class="alert error">{{ errorMsg }}</div>
      <div v-if="successMsg" class="alert success">{{ successMsg }}</div>

      <form v-if="isLogin" @submit.prevent="handleLogin" class="auth-form">
        <div class="form-group">
          <label>用户名</label>
          <input v-model="loginForm.username" type="text" placeholder="请输入用户名" autocomplete="username" required />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="loginForm.password" type="password" placeholder="请输入密码" autocomplete="current-password" required />
        </div>
        <button type="submit" class="btn full" :disabled="userStore.loading">
          {{ userStore.loading ? '登录中...' : '登 录' }}
        </button>
      </form>

      <form v-else @submit.prevent="handleRegister" class="auth-form">
        <div class="form-group">
          <label>用户名 *</label>
          <input v-model="regForm.username" type="text" placeholder="至少3位" autocomplete="username" minlength="3" required />
        </div>
        <div class="form-group">
          <label>显示名称</label>
          <input v-model="regForm.displayName" type="text" placeholder="显示名称（可选）" autocomplete="nickname" />
        </div>
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="regForm.email" type="email" placeholder="邮箱（可选）" autocomplete="email" />
        </div>
        <div class="form-group">
          <label>密码 *</label>
          <input v-model="regForm.password" type="password" placeholder="至少6位" autocomplete="new-password" minlength="6" required />
        </div>
        <div class="form-group">
          <label>确认密码 *</label>
          <input v-model="regForm.confirmPassword" type="password" placeholder="再次输入密码" autocomplete="new-password" required />
        </div>
        <button type="submit" class="btn full" :disabled="userStore.loading">
          {{ userStore.loading ? '注册中...' : '注 册' }}
        </button>
      </form>

      <div class="auth-tips">
        <p><strong>演示账号：</strong></p>
        <p>管理员 <code>admin / admin123</code></p>
        <p>编辑 <code>editor01 / editor123</code></p>
        <p>学者 <code>viewer01 / viewer123</code></p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '../stores/user';

const userStore = useUserStore();
const route = useRoute();
const router = useRouter();

const isLogin = ref(true);
const errorMsg = ref('');
const successMsg = ref('');

const loginForm = reactive({ username: '', password: '' });
const regForm = reactive({
  username: '',
  displayName: '',
  email: '',
  password: '',
  confirmPassword: ''
});

function clearError() {
  errorMsg.value = '';
  successMsg.value = '';
}

async function handleLogin() {
  clearError();
  if (!loginForm.username || !loginForm.password) {
    errorMsg.value = '请输入用户名和密码';
    return;
  }
  const result = await userStore.login(loginForm.username, loginForm.password);
  if (result.success) {
    successMsg.value = '登录成功！正在跳转...';
    const redirect = route.query.redirect || '/';
    setTimeout(() => router.push(redirect), 500);
  } else {
    errorMsg.value = result.error;
  }
}

async function handleRegister() {
  clearError();
  if (regForm.password !== regForm.confirmPassword) {
    errorMsg.value = '两次输入的密码不一致';
    return;
  }
  if (regForm.password.length < 6) {
    errorMsg.value = '密码至少需要6位';
    return;
  }
  if (regForm.username.length < 3) {
    errorMsg.value = '用户名至少需要3位';
    return;
  }
  const result = await userStore.register({
    username: regForm.username,
    password: regForm.password,
    email: regForm.email,
    displayName: regForm.displayName
  });
  if (result.success) {
    successMsg.value = '注册成功！正在跳转...';
    const redirect = route.query.redirect || '/';
    setTimeout(() => router.push(redirect), 800);
  } else {
    errorMsg.value = result.error;
  }
}

onMounted(() => {
  if (route.query.tab === 'register') {
    isLogin.value = false;
  }
  if (userStore.isLoggedIn) {
    router.push('/');
  }
});
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5efe6 0%, #e8dcc8 100%);
  padding: 20px;
}
.auth-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(90, 60, 30, 0.15);
  padding: 40px 36px;
  width: 100%;
  max-width: 440px;
}
.auth-header {
  text-align: center;
  margin-bottom: 24px;
}
.brand-icon {
  font-size: 56px;
  line-height: 1;
  margin-bottom: 8px;
}
.auth-header h1 {
  font-size: 22px;
  color: var(--primary-dark);
  margin: 0 0 4px 0;
}
.auth-header .subtitle {
  color: #888;
  margin: 0;
  font-size: 14px;
}
.auth-tabs {
  display: flex;
  border-bottom: 2px solid #eee;
  margin-bottom: 20px;
}
.auth-tabs .tab {
  flex: 1;
  background: none;
  border: none;
  padding: 12px;
  font-size: 15px;
  color: #888;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}
.auth-tabs .tab.active {
  color: var(--primary-dark);
  border-bottom-color: var(--primary);
  font-weight: 600;
}
.alert {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 16px;
}
.alert.error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}
.alert.success {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.auth-form .form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #555;
  font-weight: 500;
}
.auth-form input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.auth-form input:focus {
  outline: none;
  border-color: var(--primary);
}
.btn.full {
  width: 100%;
  padding: 12px;
  font-size: 15px;
  margin-top: 6px;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.auth-tips {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px dashed #e5e5e5;
  color: #888;
  font-size: 12px;
  line-height: 1.8;
}
.auth-tips p {
  margin: 0;
}
.auth-tips code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--primary-dark);
}
</style>
