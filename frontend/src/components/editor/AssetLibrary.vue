<template>
  <div class="asset-library">
    <div style="padding:8px;display:flex;gap:8px;flex-wrap:wrap">
      <el-upload :show-file-list="false" :before-upload="handleUpload" action="#" accept="image/*,video/*">
        <el-button size="small">上传素材</el-button>
      </el-upload>
      <el-button size="small" @click="showBatch = true">批量导入</el-button>
      <el-button size="small" @click="seqInput?.click()">序列帧</el-button>
      <input ref="seqInput" type="file" multiple webkitdirectory directory accept="image/*" style="display:none" @change="handleSeqUpload" />
    </div>
    <div style="padding:0 8px 8px">
      <el-input v-model="searchKeyword" size="small" placeholder="搜索素材" clearable />
    </div>
    <div style="padding:0 8px;margin-bottom:8px">
      <el-radio-group v-model="fileTypeFilter" size="small" @change="onFilterChange">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="image">图片</el-radio-button>
        <el-radio-button value="video">视频</el-radio-button>
        <el-radio-button value="sequence_folder">序列帧</el-radio-button>
      </el-radio-group>
    </div>
    <div class="asset-grid">
      <div v-for="asset in assets" :key="asset.hash_key" class="asset-item"
           :draggable="true" @dragstart="onDragStart($event, asset)">
        <div class="asset-thumb">
          <img v-if="asset.file_type === 'image'" :src="asset.url || `/api/v1/assets/${asset.hash_key}/thumb`" />
          <img v-else-if="asset.file_type === 'sequence_folder' && asset.folderThumbnail" :src="`/api/v1/assets/${asset.folderThumbnail}/thumb`" />
          <div v-else class="asset-thumb video-thumb">
            <span v-if="asset.file_type === 'sequence_folder'">🎞</span>
            <span v-else>▶</span>
          </div>
          <span v-if="asset.file_type === 'sequence_folder'" class="frame-badge">{{ asset.frameCount || 0 }}帧</span>
        </div>
        <div class="asset-name" :title="asset.original_name">{{ asset.original_name }}</div>
        <div class="asset-ref">
          <template v-if="asset.file_type === 'sequence_folder'">{{ asset.frameCount || 0 }}帧</template>
          <template v-else>引用:{{ asset.reference_count }}</template>
          <span class="asset-delete" @click.stop="handleDelete(asset)">✕</span>
        </div>
      </div>
    </div>
    <div v-if="!assets.length" class="empty-hint">暂无素材</div>

    <BatchImportDialog v-model:visible="showBatch" @done="loadAssets" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { getAssets, uploadAssets, uploadSequence, deleteAsset } from '@/api/asset'
import { useEditorStore } from '@/stores/editor'
import BatchImportDialog from './BatchImportDialog.vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const editorStore = useEditorStore()
const assets = ref<any[]>([])
const searchKeyword = ref('')
const fileTypeFilter = ref('')
const showBatch = ref(false)
const seqInput = ref<HTMLInputElement>()

watch(() => editorStore.programInfo?.scene_id, (newVal) => {
  if (newVal) loadAssets()
}, { immediate: true })

async function loadAssets() {
  const params: any = { page_size: 100 }
  if (fileTypeFilter.value) params.file_type = fileTypeFilter.value
  if (searchKeyword.value) params.keyword = searchKeyword.value
  if (editorStore.programInfo?.exhibit_id) {
    params.exhibit_id = editorStore.programInfo.exhibit_id
  }
  if (editorStore.programInfo?.scene_id) {
    params.scene_id = editorStore.programInfo.scene_id
  }
  const res = await getAssets(params)
  assets.value = res.data.items || []
}

function onFilterChange() {
  loadAssets()
}

async function handleUpload(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  if (editorStore.programInfo?.exhibit_id) {
    formData.append('exhibit_id', editorStore.programInfo.exhibit_id)
  }
  if (editorStore.programInfo?.scene_id) {
    formData.append('scene_id', editorStore.programInfo.scene_id)
  }
  try {
    await uploadAssets(formData)
    ElMessage.success('上传成功')
    loadAssets()
  } catch (e) {
    ElMessage.error('上传失败')
  }
  return false
}

function onDragStart(e: DragEvent, asset: any) {
  if (asset.file_type === 'sequence_folder') {
    e.dataTransfer?.setData('application/json', JSON.stringify({
      type: 'sequenceFrame',
      folderName: asset.original_name,
      frames: asset.frames || [],
      folderThumbnail: asset.folderThumbnail,
    }))
  } else {
    e.dataTransfer?.setData('application/json', JSON.stringify(asset))
  }
}

async function handleSeqUpload(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  const files = Array.from(input.files)
  const folderName = files[0]?.webkitRelativePath?.split('/')[0] || 'sequence'
  const formData = new FormData()
  formData.append('folder_name', folderName)
  files.forEach((f) => formData.append('files', f))
  if (editorStore.programInfo?.exhibit_id) formData.append('exhibit_id', editorStore.programInfo.exhibit_id)
  if (editorStore.programInfo?.scene_id) formData.append('scene_id', editorStore.programInfo.scene_id)
  try {
    const res = await uploadSequence(formData)
    const data = res.data as any
    ElMessage.success(`序列帧上传成功: ${data.frameCount || 0} 帧`)
    fileTypeFilter.value = 'sequence_folder'
    loadAssets()
  } catch { ElMessage.error('序列帧上传失败') }
  input.value = ''
}

async function handleDelete(asset: any) {
  try {
    const label = asset.file_type === 'sequence_folder' ? asset.original_name : asset.original_name
    await ElMessageBox.confirm(`确定删除素材 "${label}"？`, '提示', { type: 'warning', confirmButtonText: '删除' })
    await deleteAsset(asset.hash_key)
    ElMessage.success('删除成功')
    loadAssets()
  } catch (e) {
    // cancelled
  }
}
</script>

<style scoped>
.asset-library { padding: 4px; }
.asset-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 0 8px; }
.asset-item { cursor: pointer; border: 1px solid #e4e7ed; border-radius: 4px; overflow: hidden; position: relative; }
.asset-item:hover { border-color: #409EFF; }
.asset-thumb { width: 100%; height: 80px; position: relative; }
.asset-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; background: #f5f7fa; }
.video-thumb { display: flex; align-items: center; justify-content: center; font-size: 24px; color: #909399; }
.frame-badge { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.6); color: #fff; font-size: 10px; padding: 1px 5px; border-radius: 3px; }
.asset-name { font-size: 11px; padding: 2px 4px; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.asset-ref { font-size: 10px; padding: 0 4px 4px; color: #909399; display: flex; justify-content: space-between; align-items: center; }
.asset-delete { color: #f56c6c; cursor: pointer; font-size: 12px; padding: 0 2px; }
.asset-delete:hover { color: #f00; }
.empty-hint { color: #909399; text-align: center; padding: 20px 0; }
</style>
