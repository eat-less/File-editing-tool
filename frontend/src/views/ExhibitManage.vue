<template>
  <div>
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <h3>展项管理</h3>
      <el-button type="primary" @click="showCreate = true">新建展项</el-button>
    </div>
    <el-table :data="projectStore.exhibits" border stripe>
      <el-table-column prop="name" label="展项名称" />
      <el-table-column prop="description" label="描述" />
      <el-table-column prop="scene_count" label="场景数" width="100" />
      <el-table-column prop="device_count" label="设备数" width="100" />
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="280">
        <template #default="{ row }">
          <el-button size="small" @click="$router.push(`/exhibits/${row.id}`)">场景管理</el-button>
          <el-button size="small" @click="editExhibit(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="deleteExhibit(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreate" title="新建展项" width="500px">
      <el-form :model="form">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" @click="createExhibit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showEdit" title="编辑展项" width="500px">
      <el-form :model="editForm">
        <el-form-item label="名称"><el-input v-model="editForm.name" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editForm.description" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEdit = false">取消</el-button>
        <el-button type="primary" @click="updateExhibit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useProjectStore } from '@/stores/project'
import { ElMessageBox, ElMessage } from 'element-plus'
import { formatDate } from '@/utils/validators'

const projectStore = useProjectStore()
const showCreate = ref(false)
const showEdit = ref(false)
const editingId = ref('')
const form = reactive({ name: '', description: '' })
const editForm = reactive({ name: '', description: '' })

onMounted(() => projectStore.fetchExhibits())

async function createExhibit() {
  await projectStore.createExhibitItem({ name: form.name, description: form.description })
  showCreate.value = false
  form.name = ''; form.description = ''
  ElMessage.success('创建成功')
}

function editExhibit(row: any) {
  editingId.value = row.id
  editForm.name = row.name
  editForm.description = row.description || ''
  showEdit.value = true
}

async function updateExhibit() {
  await projectStore.updateExhibitItem(editingId.value, { name: editForm.name, description: editForm.description })
  showEdit.value = false
  ElMessage.success('更新成功')
}

async function deleteExhibit(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除展项 "${row.name}"？`, '警告', { type: 'warning' })
    await projectStore.deleteExhibitItem(row.id)
    ElMessage.success('删除成功')
  } catch { /* cancelled */ }
}
</script>
