<template>
  <div class="main-layout">
    <aside class="sidebar">
      <div class="logo">多媒体编辑器</div>
      <SideMenu />
      <div class="user-info">
        <el-dropdown @command="handleCommand">
          <span class="username">{{ authStore.user?.username || '用户' }}</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </aside>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import SideMenu from './SideMenu.vue'

const router = useRouter()
const authStore = useAuthStore()

function handleCommand(cmd: string) {
  if (cmd === 'logout') {
    authStore.logout()
    router.push('/login')
  }
}
</script>

<style scoped>
.main-layout { display: flex; height: 100vh; }
.sidebar {
  width: 220px; background: #1a1a2e; color: #fff;
  display: flex; flex-direction: column; flex-shrink: 0;
}
.logo { padding: 20px; font-size: 18px; font-weight: bold; text-align: center; border-bottom: 1px solid #16213e; }
.user-info { padding: 16px; margin-top: auto; border-top: 1px solid #16213e; }
.username { color: #a0aec0; cursor: pointer; }
.main-content { flex: 1; overflow: auto; background: #f5f7fa; padding: 20px; }
</style>
