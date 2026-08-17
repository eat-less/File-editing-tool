<template>
  <div>
    <el-button @click="$router.push('/content')" style="margin-bottom:16px">← 返回内容列表</el-button>
    <h3 style="margin-bottom:16px">分发详情</h3>
    <el-table :data="logs" border>
      <el-table-column prop="version" label="版本" width="80" />
      <el-table-column prop="action" label="操作" width="100">
        <template #default="{ row }"><el-tag :type="row.action === 'publish' ? 'success' : 'warning'">{{ row.action }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }"><el-tag>{{ row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="change_note" label="变更说明" />
      <el-table-column prop="started_at" label="开始时间" width="180" />
      <el-table-column prop="completed_at" label="完成时间" width="180" />
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getDistribution } from '@/api/project'

const route = useRoute()
const logs = ref<any[]>([])

onMounted(async () => {
  const res = await getDistribution(route.params.id as string)
  logs.value = res.data || []
})
</script>
