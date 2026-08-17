<template>
  <el-menu :default-active="activeMenu" router background-color="#1a1a2e" text-color="#a0aec0" active-text-color="#409EFF">
    <el-menu-item index="/dashboard">
      <el-icon><Monitor /></el-icon><span>仪表盘</span>
    </el-menu-item>
    <el-menu-item index="/exhibits">
      <el-icon><Collection /></el-icon><span>展项管理</span>
    </el-menu-item>
    <el-menu-item index="/content">
      <el-icon><Document /></el-icon><span>内容管理</span>
    </el-menu-item>
    <el-menu-item index="/users" v-if="authStore.user?.role === 'superadmin'">
      <el-icon><UserFilled /></el-icon><span>用户管理</span>
    </el-menu-item>
    <el-menu-item index="/logs">
      <el-icon><Tickets /></el-icon><span>系统日志</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const authStore = useAuthStore()
const activeMenu = computed(() => {
  if (route.path.startsWith('/editor')) return '/content'
  if (route.path.startsWith('/content')) return '/content'
  if (route.path.startsWith('/users')) return '/users'
  return route.path
})
</script>
