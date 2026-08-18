<template>
  <div>
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <h3>内容管理</h3>
      <el-space>
        <el-button type="warning" @click="openPublishAll">一键发布场景</el-button>
        <el-button type="primary" @click="showCreate = true">新建节目</el-button>
      </el-space>
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
      <el-table-column label="操作" width="450" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="$router.push(`/editor/${row.id}`)">编辑</el-button>
          <el-button size="small" type="success" @click="showPublish(row)">发布</el-button>
          <el-button size="small" @click="showCopy(row)">复制到设备</el-button>
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

    <!-- Publish all scenes dialog -->
    <el-dialog v-model="showPublishAll" title="一键发布场景" width="520px">
      <el-form :model="publishAllForm" label-width="80px">
        <el-form-item label="展项">
          <el-select v-model="publishAllForm.exhibit_id" @change="onPublishAllExhibitChange" placeholder="选择展项" style="width:100%">
            <el-option v-for="e in projectStore.exhibits" :key="e.id" :label="e.name" :value="e.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="场景">
          <el-select v-model="publishAllForm.scene_id" placeholder="选择场景" style="width:100%">
            <el-option v-for="s in publishAllScenes" :key="s.id" :label="`${s.name} (${s.device_count} 台设备)`" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="变更说明" required>
          <el-input v-model="publishAllForm.change_note" type="textarea" :rows="3" placeholder="描述本次修改内容，将写入版本历史" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <div style="color:#999;font-size:12px">将发布该场景下所有设备的节目，在线设备会实时同步，离线设备下次联网时自动更新。</div>
      <template #footer>
        <el-button @click="showPublishAll = false">取消</el-button>
        <el-button type="primary" :disabled="!publishAllForm.scene_id || !publishAllForm.change_note.trim()" :loading="publishingAll" @click="doPublishAll">确认发布</el-button>
      </template>
    </el-dialog>

    <!-- Copy to devices dialog -->
    <el-dialog v-model="showCopyDialog" title="复制到其他设备" width="560px">
      <el-form label-width="80px">
        <el-form-item label="来源节目">{{ copySource?.name || '' }}</el-form-item>
        <el-form-item label="目标设备" required>
          <el-select v-model="copyTargetDeviceIds" multiple placeholder="选择目标设备（可多选）" style="width:100%">
            <el-option v-for="d in copyTargetDevices" :key="d.id" :label="`${d.name} (${d.unique_code})`" :value="d.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <div style="color:#999;font-size:12px">将当前节目的页面与排版复制为所选设备的节目。仅显示本场景下尚未创建节目的设备；复制后需到目标设备重新发布才会生效。</div>
      <template #footer>
        <el-button @click="showCopyDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!copyTargetDeviceIds.length" :loading="copying" @click="doCopy">确认复制</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useContentStore } from '@/stores/content'
import { useProjectStore } from '@/stores/project'
import { createProgram, copyProgram, publishAllScene, getPrograms, deleteProgram } from '@/api/project'
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

const showPublishAll = ref(false)
const publishingAll = ref(false)
const publishAllForm = reactive({ exhibit_id: '', scene_id: '', change_note: '' })
const publishAllScenes = ref<any[]>([])

const showCopyDialog = ref(false)
const copying = ref(false)
const copySource = ref<any>(null)
const copyTargetDeviceIds = ref<string[]>([])
const copyTargetDevices = ref<any[]>([])

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

async function openPublishAll() {
  await projectStore.fetchExhibits()
  publishAllForm.exhibit_id = ''
  publishAllForm.scene_id = ''
  publishAllForm.change_note = ''
  publishAllScenes.value = []
  showPublishAll.value = true
}

async function onPublishAllExhibitChange() {
  const res = await getScenes(publishAllForm.exhibit_id)
  publishAllScenes.value = res.data || []
  publishAllForm.scene_id = ''
}

async function doPublishAll() {
  if (!publishAllForm.scene_id || !publishAllForm.change_note.trim()) return
  publishingAll.value = true
  try {
    const res = await publishAllScene(publishAllForm.scene_id, publishAllForm.change_note.trim())
    const results = res.data?.results || []
    const ok = results.filter((r: any) => r.status === 'success').length
    const fail = results.length - ok
    ElMessage.success(`发布完成：成功 ${ok} 个，失败 ${fail} 个`)
    showPublishAll.value = false
    contentStore.fetchPrograms()
  } catch (e: any) {
    ElMessage.error(e?.message || '发布失败')
  } finally {
    publishingAll.value = false
  }
}

async function showCopy(row: any) {
  copySource.value = row
  copyTargetDeviceIds.value = []
  showCopyDialog.value = true
  const res = await getDevices(row.scene_id)
  const existing = await getPrograms({ scene_id: row.scene_id, page: 1, page_size: 100 })
  const takenDeviceIds = new Set((existing.data?.items || []).map((p: any) => p.device_id))
  copyTargetDevices.value = (res.data || []).filter((d: any) => d.id !== row.device_id && !takenDeviceIds.has(d.id))
}

async function doCopy() {
  if (!copyTargetDeviceIds.value.length) return
  copying.value = true
  try {
    const res = await copyProgram(copySource.value.id, { target_device_ids: copyTargetDeviceIds.value })
    const count = (res.data || []).length
    ElMessage.success(`已复制到 ${count} 个设备`)
    showCopyDialog.value = false
    contentStore.fetchPrograms()
  } catch (e: any) {
    ElMessage.error(e?.message || '复制失败')
  } finally {
    copying.value = false
  }
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
