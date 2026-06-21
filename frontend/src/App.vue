<template>
  <div>
    <header class="navbar">
      <router-link to="/" class="brand">📜 旧书版本考据</router-link>
      <nav>
        <router-link to="/">词条浏览</router-link>
        <router-link to="/compare">版本对照</router-link>
        <router-link to="/graph">引用图谱</router-link>
        <router-link to="/admin">后台编辑</router-link>
      </nav>
    </header>
    <main class="container">
      <router-view />
    </main>
  </div>
</template>

<script setup>
</script>
