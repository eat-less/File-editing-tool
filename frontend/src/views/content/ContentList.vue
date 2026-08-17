<template>
  <div>
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <h3>内容管理</h3>
      <el-button type="primary" @click="showCreate = true">新建节目</el-button>
    </div>
    <el-card style="margin-bottom:16px">
      <el-row :gutter="16">
        <el-col :span="6"><el-input v-model="contentStore.filters.keyword" placeholder="搜索节目名称" clearable @change="search" /></el-col>
        <el-col :span="4">
          <el-select v-model="contentStore.filters.status" placeholder="发布状态" clearable @change="search" style="width:100%">
            <el-option label="未发布" value="unpublished" />
            <el-option label="有更新" value="modified" />
            <el-option label="已发布" value="published" />
          </el-select>
        </el-col>
      </el-row>
    </el-card>
    <el-table :data="contentStore.programs" border stripe v-loading="contentStore.loading">
      <el-table-column prop="exhibit_path" label="层级路径" min-width="250" />
      <el-table-column prop="name" label="节目名称" width="150" />
      <el-table-column prop="current_version" label="版本" width="80" />
      <el-table-column prop="publish_status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.publish_status)">{{ statusText(row.publish_status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="180">
        <template #default="{ row }">{{ formatDate(row.updated_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="350" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="$router.push(`/editor/${row.id}`)">编辑</el-button>
          <el-button size="small" type="success" @click="showPublish(row)">发布</el-button>
          <el-button size="small" @click="$router.push(`/content/${row.id}/versions`)">版本</el-button>
          <el-button size="small" @click="$router.push(`/content/${row.id}/distribution`)">分发</el-button>
          <el-button size="small" type="danger" @click="deleteProg(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-if="contentStore.total > 0"
      style="margin-top:16px;justify-content:flex-end"
      :current-page="contentStore.filters.page"
      :page-size="contentStore.filters.page_size"
      :total="contentStore.total"
      layout="total, prev, pager, next"
      @current-change="contentStore.setPage"
    />

    <!-- Create dialog -->
    <el-dialog v-model="showCreate" title="新建节目" width="500px">
      <el-form :model="createForm">
        <el-form-item label="展项">
          <el-select v-model="createForm.exhibit_id" @change="onExhibitChange" placeholder="选择展项" style="width:100%">
            <el-option v-for="e in projectStore.exhibits" :key="e.id" :label="e.name" :value="e.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="场景">
          <el-select v-model="createForm.scene_id" @change="onSceneChange" placeholder="选择场景" style="width:100%">
            <el-option v-for="s in createScenes" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备">
          <el-select v-model="createForm.device_id" placeholder="选择设备" style="width:100%">
            <el-option v-for="d in createDevices" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="createForm.name" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" @click="doCreate">确定</el-button>
      </template>
    </el-dialog>

    <!-- Publish dialog -->
    <ExportDialog ref="exportDialogRef" :program-id="publishProgramId" @done="contentStore.fetchPrograms" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useContentStore } from '@/stores/content'
import { useProjectStore } from '@/stores/project'
import { createProgram, publishProgram } from '@/api/project'
import { deleteProgram } from '@/api/project'
import { getScenes, getDevices } from '@/api/exhibit'
import { ElMessageBox, ElMessage } from 'element-plus'
import { formatDate } from '@/utils/validators'
import ExportDialog from '@/views/editor/ExportDialog.vue'

const contentStore = useContentStore()
const projectStore = useProjectStore()
const showCreate = ref(false)
const publishProgramId = ref('')
const exportDialogRef = ref()
const createForm = reactive({ exhibit_id: '', scene_id: '', device_id: '', name: '默认节目' })
const createScenes = ref<any[]>([])
const createDevices = ref<any[]>([])

onMounted(async () => {
  await projectStore.fetchExhibits()
  await contentStore.fetchPrograms()
})

function statusType(s: string) { return s === 'published' ? 'success' : s === 'modified' ? 'warning' : 'info' }
function statusText(s: string) { return s === 'published' ? '已发布' : s === 'modified' ? '有更新' : '未发布' }

function search() { contentStore.setFilters({}) }

async function onExhibitChange() {
  const res = await getScenes(createForm.exhibit_id)
  createScenes.value = res.data || []
  createForm.scene_id = ''; createForm.device_id = ''
}

async function onSceneChange() {
  const res = await getDevices(createForm.scene_id)
  createDevices.value = res.data || []
  createForm.device_id = ''
}

async function doCreate() {
  await createProgram({
    exhibit_id: createForm.exhibit_id, scene_id: createForm.scene_id,
    device_id: createForm.device_id, name: createForm.name
  })
  showCreate.value = false
  ElMessage.success('创建成功')
  contentStore.fetchPrograms()
}

function showPublish(row: any) {
  publishProgramId.value = row.id
  setTimeout(() => exportDialogRef.value?.open(), 100)
}

async function deleteProg(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除节目 "${row.name}"？`, '警告', { type: 'warning' })
    await deleteProgram(row.id)
    ElMessage.success('删除成功')
    contentStore.fetchPrograms()
  } catch { /* */ }
}
</script>
