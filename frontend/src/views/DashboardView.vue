<template>
  <div>
    <h3 style="margin-bottom:20px">仪表盘</h3>
    <el-row :gutter="20">
      <el-col :span="6" v-for="card in statCards" :key="card.label">
        <el-card shadow="hover" style="text-align:center; margin-bottom:20px">
          <div style="font-size:14px;color:#909399">{{ card.label }}</div>
          <div style="font-size:32px;font-weight:bold;color:#303133;margin-top:8px">{{ card.value }}</div>
        </el-card>
      </el-col>
    </el-row>
    <el-card>
      <template #header>快捷操作</template>
      <el-space>
        <el-button type="primary" @click="$router.push('/exhibits')">展项管理</el-button>
        <el-button type="success" @click="$router.push('/content')">内容管理</el-button>
        <el-button type="warning" @click="$router.push('/logs')">系统日志</el-button>
      </el-space>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import { useProjectStore } from '@/stores/project'
import { getLogs } from '@/api/asset'
import { getExhibits } from '@/api/exhibit'

const projectStore = useProjectStore()
const statCards = reactive([
  { label: '展项数量', value: 0 },
  { label: '设备总数', value: 0 },
  { label: '节目总数', value: 0 },
  { label: '在线设备', value: 0 }
])

onMounted(async () => {
  await projectStore.fetchExhibits()
  statCards[0].value = projectStore.exhibits.length
  let totalDevices = 0
  for (const ex of projectStore.exhibits) {
    totalDevices += ex.device_count || 0
  }
  statCards[1].value = totalDevices
  try {
    const res = await getLogs({ page_size: 1 })
    statCards[2].value = res.data?.total || 0
  } catch { /* */ }
})
</script>
