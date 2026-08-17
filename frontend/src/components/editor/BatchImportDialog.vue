<template>
  <el-dialog :model-value="visible" @update:model-value="$emit('update:visible', $event)" title="批量导入" width="700px">
    <div style="margin-bottom:12px">
      <el-upload :show-file-list="false" :before-upload="handleFile" multiple accept="image/*,video/*" action="#">
        <el-button type="primary">选择文件</el-button>
      </el-upload>
      <el-checkbox v-model="removeDatePrefix" style="margin-left:12px">去除日期前缀</el-checkbox>
    </div>
    <el-table :data="fileList" max-height="400" border size="small">
      <el-table-column type="index" width="50" label="#" />
      <el-table-column prop="file.name" label="文件名" min-width="200" />
      <el-table-column label="字幕预览" width="250">
        <template #default="{ row }"><el-input v-model="row.caption" size="small" /></template>
      </el-table-column>
    </el-table>
    <div style="margin-top:12px">
      <span style="margin-right:8px">字幕样式：</span>
      <span style="color:#999;font-size:12px">字体[微软雅黑] 字号[18] 颜色[#FFFFFF]</span>
    </div>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :disabled="!fileList.length" :loading="uploading" @click="doImport">确认导入</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { uploadBatch } from '@/api/asset'
import { useEditorStore } from '@/stores/editor'
import { ElMessage } from 'element-plus'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'done'): void
}>()

const editorStore = useEditorStore()
const fileList = ref<any[]>([])
const removeDatePrefix = ref(true)
const uploading = ref(false)

function handleFile(file: File) {
  const caption = extractCaption(file.name)
  fileList.value.push({ file, caption })
  return false
}

function extractCaption(filename: string): string {
  let name = filename.replace(/\.[^.]+$/, '')
  if (removeDatePrefix.value) {
    name = name.replace(/^\d{8}_/, '').replace(/^\d{4}-\d{2}-\d{2}_/, '')
    name = name.replace(/^\d{14}_/, '').replace(/_(IMG|DSC)_\d+_/, '_')
  }
  return name.replace(/[_-]/g, ' ').trim()
}

async function doImport() {
  uploading.value = true
  try {
    const formData = new FormData()
    fileList.value.forEach(f => formData.append('files', f.file))
    formData.append('remove_date_prefix', String(removeDatePrefix.value))
    if (editorStore.programInfo?.exhibit_id) {
      formData.append('exhibit_id', editorStore.programInfo.exhibit_id)
    }
    if (editorStore.programInfo?.scene_id) {
      formData.append('scene_id', editorStore.programInfo.scene_id)
    }
    const res = await uploadBatch(formData)
    const results = res.data || []
    const page = editorStore.currentPage
    if (page && results.length > 0) {
      const imageResults = results.filter((r: any) => r.file_type === 'image')
      const otherResults = results.filter((r: any) => r.file_type !== 'image')

      if (imageResults.length > 0) {
        const srcs = imageResults.map((r: any) => r.hash_key)
        const srcNames = imageResults.map((r: any) => r.original_name)
        const captions = imageResults.map((r: any) => r.caption || '')
        editorStore.addElement('image', 50, 50, 300, 200)
        const added = page.layers[page.layers.length - 1]
        if (added) {
          editorStore.updateElement(added.element.id, {
            srcs,
            srcNames,
            src: srcs[0],
            captions,
            captionPositions: captions.map(() => null),
          })
        }
      }

      const cols = 5
      const gap = 20
      const startX = 50
      const startY = imageResults.length > 0 ? 270 : 50
      otherResults.forEach((r: any, i: number) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = startX + col * (200 + gap)
        const y = startY + row * (220 + gap)
        editorStore.addElementForAsset({ hash_key: r.hash_key, original_name: r.original_name, file_type: r.file_type }, x, y)
      })
    }
    ElMessage.success(`导入 ${results.length} 个文件`)
    emit('update:visible', false)
    emit('done')
  } catch (e) {
    ElMessage.error('导入失败')
  } finally {
    uploading.value = false
  }
}
</script>
