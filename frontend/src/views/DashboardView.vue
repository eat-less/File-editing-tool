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
    <el-card style="margin-top:20px">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>设备列表</span>
          <el-button size="small" :loading="loading" @click="loadAll">刷新</el-button>
        </div>
      </template>
      <el-table :data="deviceRows" border stripe size="small" v-loading="loading" empty-text="暂无设备">
        <el-table-column prop="name" label="设备名称" min-width="160" />
        <el-table-column label="所属展项" min-width="160">
          <template #default="{ row }">{{ exhibitNameMap[row.exhibit_id] || '-' }}</template>
        </el-table-column>
        <el-table-column label="在线状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'online' ? 'success' : 'info'">{{ row.status === 'online' ? '在线' : '离线' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="ip_address" label="IP地址" width="180" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showEdit" title="编辑设备" width="500px">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="80px">
        <el-form-item label="名称" prop="name"><el-input v-model="editForm.name" /></el-form-item>
        <el-form-item label="IP地址" prop="ip_address">
          <el-input v-model="editForm.ip_address" placeholder="请输入设备实际IP，如 192.168.1.101" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEdit = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getExhibits, getExhibitDevices, updateDevice } from '@/api/exhibit'
import { getPrograms } from '@/api/project'

const statCards = reactive([
  { label: '展项数量', value: 0 },
  { label: '设备总数', value: 0 },
  { label: '节目总数', value: 0 },
  { label: '在线设备', value: 0 }
])

const loading = ref(false)
const saving = ref(false)
const exhibits = ref<any[]>([])
const deviceRows = ref<any[]>([])

const showEdit = ref(false)
const editFormRef = ref()
const editForm = reactive({ id: '', name: '', ip_address: '' })
const editRules = {
  name: [{ required: true, message: '请输入设备名称', trigger: 'blur' }],
  ip_address: [
    { required: true, message: '请输入设备IP地址', trigger: 'blur' },
    { pattern: /^(\d{1,3}\.){3}\d{1,3}$/, message: 'IP格式不正确', trigger: 'blur' },
  ],
}

const exhibitNameMap = computed(() => {
  const map: Record<string, string> = {}
  exhibits.value.forEach((e: any) => { map[e.id] = e.name })
  return map
})

async function loadProgramCount() {
  try {
    const res = await getPrograms({ page: 1, page_size: 1 })
    statCards[2].value = res.data?.total || 0
  } catch {
    statCards[2].value = 0
  }
}

async function loadAll() {
  loading.value = true
  try {
    let rows: any[] = []
    try {
      const exRes = await getExhibits()
      exhibits.value = exRes.data || []
      const settled = await Promise.allSettled(exhibits.value.map((ex: any) => getExhibitDevices(ex.id)))
      settled.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const list = r.value?.data || []
          list.forEach((d: any) => rows.push({ ...d, exhibit_id: exhibits.value[i].id }))
        }
      })
    } catch { /* exhibits 获取失败时保持空列表 */ }
    deviceRows.value = rows
    statCards[0].value = exhibits.value.length
    statCards[1].value = rows.length
    statCards[3].value = rows.filter((d: any) => d.status === 'online').length
  } finally {
    loading.value = false
  }
}

async function loadDashboard() {
  await Promise.all([loadAll(), loadProgramCount()])
}

function openEdit(row: any) {
  editForm.id = row.id
  editForm.name = row.name || ''
  editForm.ip_address = row.ip_address || ''
  showEdit.value = true
}

async function saveEdit() {
  if (!editFormRef.value) return
  const valid = await editFormRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    await updateDevice(editForm.id, { name: editForm.name, ip_address: editForm.ip_address })
    ElMessage.success('更新成功')
    showEdit.value = false
    await loadAll()
  } catch { /* 后端错误信息已由拦截器提示 */ } finally {
    saving.value = false
  }
}

onMounted(loadDashboard)
</script>
