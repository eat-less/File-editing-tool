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
        <el-col :span="6" style="text-align:right">
          <el-button type="danger" plain @click="openCleanup">清理日志</el-button>
        </el-col>
      </el-row>
    </el-card>
    <el-table :data="logs" border>
      <el-table-column label="时间" width="180">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column prop="log_type" label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="typeColor(row.log_type)">{{ typeText(row.log_type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="模块" width="100">
        <template #default="{ row }">{{ moduleText(row.module) }}</template>
      </el-table-column>
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
        <el-descriptions-item label="类型">{{ typeText(currentDetail.log_type) }}</el-descriptions-item>
        <el-descriptions-item label="模块">{{ moduleText(currentDetail.module) }}</el-descriptions-item>
        <el-descriptions-item label="消息" :span="2">{{ currentDetail.message }}</el-descriptions-item>
        <el-descriptions-item label="耗时">{{ currentDetail.duration_ms ? currentDetail.duration_ms + 'ms' : '-' }}</el-descriptions-item>
        <el-descriptions-item label="IP">{{ currentDetail.ip_address || '-' }}</el-descriptions-item>
      </el-descriptions>
      <div v-if="currentDetail?.solution" style="margin-top:16px;padding:12px;background:#fdf6ec;border:1px solid #e6a23c;border-radius:4px">
        <strong>解决方案：</strong>{{ currentDetail.solution }}
      </div>
    </el-dialog>

    <el-dialog v-model="cleanupVisible" title="清理日志" width="480px">
      <el-radio-group v-model="cleanupMode">
        <el-radio value="days" style="display:block;margin-bottom:8px">保留最近 7 天，删除更早的日志</el-radio>
        <el-radio value="filtered" style="display:block;margin-bottom:8px">按当前筛选条件删除</el-radio>
        <el-radio value="all" style="display:block">清空全部日志</el-radio>
      </el-radio-group>
      <div v-if="cleanupMode === 'filtered'" style="margin-top:12px;color:#909399;font-size:13px">
        将删除：类型 = {{ filters.log_type || '全部' }}，模块 = {{ filters.module || '全部' }}，关键词 = {{ filters.keyword || '无' }}
      </div>
      <template #footer>
        <el-button @click="cleanupVisible = false">取消</el-button>
        <el-button type="danger" :loading="cleanupLoading" @click="doCleanup">确认清理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getLogs, cleanupLogs } from '@/api/asset'
import { formatDate } from '@/utils/validators'

const logs = ref<any[]>([])
const total = ref(0)
const detailVisible = ref(false)
const currentDetail = ref<any>(null)
const filters = reactive({ log_type: null as any, module: null as any, keyword: null as any, page: 1, page_size: 20 })
const cleanupVisible = ref(false)
const cleanupLoading = ref(false)
const cleanupMode = ref<'days' | 'filtered' | 'all'>('days')

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

function typeText(t: string) {
  const map: Record<string, string> = { info: '信息', warning: '警告', error: '错误', success: '成功', operation_failed: '操作失败' }
  return map[t] || t
}

function moduleText(m: string) {
  const map: Record<string, string> = { auth: '认证', exhibit: '展项', editor: '编辑器', distribution: '分发', asset: '素材', device: '设备', system: '系统', player: '播放器' }
  return map[m] || m || '-'
}

function showDetail(row: any) { currentDetail.value = row; detailVisible.value = true }

function openCleanup() { cleanupMode.value = 'days'; cleanupVisible.value = true }

async function doCleanup() {
  const tip = cleanupMode.value === 'all' ? '确定清空全部日志？此操作不可恢复。' : '确定按所选范围清理日志？此操作不可恢复。'
  try {
    await ElMessageBox.confirm(tip, '警告', { type: 'warning' })
  } catch {
    return
  }
  const params: any = {}
  if (cleanupMode.value === 'days') {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    params.before = d.toISOString()
  } else if (cleanupMode.value === 'filtered') {
    if (filters.log_type) params.log_type = filters.log_type
    if (filters.module) params.module = filters.module
    if (filters.keyword) params.keyword = filters.keyword
  } else {
    params.all = true
  }
  cleanupLoading.value = true
  try {
    const res: any = await cleanupLogs(params)
    ElMessage.success(res.message || `已清理 ${res.data?.deleted || 0} 条日志`)
    cleanupVisible.value = false
    filters.page = 1
    await fetchData()
  } catch {
  } finally {
    cleanupLoading.value = false
  }
}
</script>
