<template>
  <el-dialog v-model="dialogVisible" title="导出发布" width="560px">
    <el-descriptions :column="2" border v-if="programInfo">
      <el-descriptions-item label="节目名称">{{ programInfo.name }}</el-descriptions-item>
      <el-descriptions-item label="当前版本">v{{ programInfo.current_version }}</el-descriptions-item>
      <el-descriptions-item label="上次导出">v{{ programInfo.published_version || 0 }}</el-descriptions-item>
      <el-descriptions-item label="发布状态">
        <el-tag :type="programInfo.publish_status === 'published' ? 'success' : 'warning'">{{ programInfo.publish_status }}</el-tag>
      </el-descriptions-item>
    </el-descriptions>
    <el-form-item label="变更说明" required style="margin-top:16px">
      <el-input v-model="changeNote" type="textarea" :rows="4" placeholder="请描述本次修改了什么内容" maxlength="500" show-word-limit />
    </el-form-item>
    <div style="color:#999;font-size:12px">变更说明将显示在版本历史中，方便后续回滚时快速定位目标版本。</div>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :disabled="!changeNote.trim()" :loading="exporting" @click="doExport">确认导出</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { getProgram, publishProgram } from '@/api/project'
import { ElMessage } from 'element-plus'

const props = defineProps<{ programId: string }>()
const emit = defineEmits(['done'])

const dialogVisible = ref(false)
const changeNote = ref('')
const exporting = ref(false)
const programInfo = ref<any>(null)

watch(() => props.programId, async (id) => {
  if (id) {
    const res = await getProgram(id)
    programInfo.value = res.data
  }
}, { immediate: true })

function open() { dialogVisible.value = true }
defineExpose({ open })

async function doExport() {
  if (!changeNote.value.trim()) return
  exporting.value = true
  try {
    await publishProgram(props.programId, changeNote.value.trim())
    ElMessage.success('导出成功')
    dialogVisible.value = false
    changeNote.value = ''
    emit('done')
  } catch (e: any) {
    ElMessage.error(e?.message || '导出失败')
  } finally {
    exporting.value = false
  }
}
</script>
