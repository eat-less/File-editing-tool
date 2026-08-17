<template>
  <div class="toolbar-bar">
    <el-button-group>
      <el-button size="small" @click="$emit('add', 'text')">文字</el-button>
      <el-button size="small" @click="$emit('add', 'image')">图片</el-button>
      <el-button size="small" @click="$emit('add', 'video')">视频</el-button>
      <el-button size="small" @click="$emit('add', 'shape')">形状</el-button>
      <el-button size="small" @click="$emit('add', 'container')">容器</el-button>
      <el-button size="small" @click="$emit('add', 'button')">按钮</el-button>
    </el-button-group>
  </div>
</template>

<script setup lang="ts">
defineEmits(['add'])
</script>

<style scoped>
.toolbar-bar { display: flex; align-items: center; }
</style>
