<template>
  <div>
    <h3 style="margin-bottom:16px">系统日志</h3>
    <el-card style="margin-bottom:16px">
      <el-row :gutter="16">
        <el-col :span="4">
          <el-select v-model="filters.log_type" placeholder="日志类型" clearable @change="fetchData" style="width:100%">
            <el-option label="信息" value="info" /><el-option label="警告" value="warning" />
            <el-option label="错误" value="error" /><el-option label="成功" value="success" />
            <el-option label="操作失败" value="operation_failed" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select v-model="filters.module" placeholder="模块" clearable @change="fetchData" style="width:100%">
            <el-option label="认证" value="auth" /><el-option label="展项" value="exhibit" />
            <el-option label="编辑器" value="editor" /><el-option label="分发" value="distribution" />
            <el-option label="素材" value="asset" /><el-option label="设备" value="device" />
            <el-option label="系统" value="system" />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-input v-model="filters.keyword" placeholder="搜索" clearable @change="fetchData" />
        </el-col>
      </el-row>
    </el-card>
    <el-table :data="logs" border>
      <el-table-column label="时间" width="180">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column prop="log_type" label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="typeColor(row.log_type)">{{ row.log_type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="module" label="模块" width="100" />
      <el-table-column prop="message" label="摘要" min-width="250" />
      <el-table-column prop="duration_ms" label="耗时" width="80">
        <template #default="{ row }">{{ row.duration_ms ? row.duration_ms + 'ms' : '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button size="small" @click="showDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-if="total > 0"
      style="margin-top:16px;justify-content:flex-end"
      :current-page="filters.page"
      :page-size="filters.page_size"
      :total="total"
      layout="total, prev, pager, next"
      @current-change="pageChange"
    />

    <el-dialog v-model="detailVisible" title="日志详情" width="600px">
      <el-descriptions v-if="currentDetail" :column="2" border>
        <el-descriptions-item label="类型">{{ currentDetail.log_type }}</el-descriptions-item>
        <el-descriptions-item label="模块">{{ currentDetail.module }}</el-descriptions-item>
        <el-descriptions-item label="消息" :span="2">{{ currentDetail.message }}</el-descriptions-item>
        <el-descriptions-item label="耗时">{{ currentDetail.duration_ms ? currentDetail.duration_ms + 'ms' : '-' }}</el-descriptions-item>
        <el-descriptions-item label="IP">{{ currentDetail.ip_address || '-' }}</el-descriptions-item>
      </el-descriptions>
      <div v-if="currentDetail?.solution" style="margin-top:16px;padding:12px;background:#fdf6ec;border:1px solid #e6a23c;border-radius:4px">
        <strong>解决方案：</strong>{{ currentDetail.solution }}
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { getLogs } from '@/api/asset'
import { formatDate } from '@/utils/validators'

const logs = ref<any[]>([])
const total = ref(0)
const detailVisible = ref(false)
const currentDetail = ref<any>(null)
const filters = reactive({ log_type: null as any, module: null as any, keyword: null as any, page: 1, page_size: 20 })

onMounted(() => fetchData())

async function fetchData() {
  const params: any = {}
  Object.keys(filters).forEach(k => { if (filters[k as keyof typeof filters]) params[k] = filters[k as keyof typeof filters] })
  const res = await getLogs(params)
  logs.value = res.data.items || []
  total.value = res.data.total || 0
}

function pageChange(p: number) { filters.page = p; fetchData() }

function typeColor(t: string) {
  const map: Record<string, string> = { info: '', warning: 'warning', error: 'danger', success: 'success', operation_failed: 'danger' }
  return map[t] || ''
}

function showDetail(row: any) { currentDetail.value = row; detailVisible.value = true }
</script>
