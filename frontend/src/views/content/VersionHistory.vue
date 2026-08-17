<template>
  <div>
    <el-button @click="$router.push('/content')" style="margin-bottom:16px">← 返回内容列表</el-button>
    <h3 style="margin-bottom:16px">版本历史</h3>
    <el-table :data="versions" border>
      <el-table-column prop="version" label="版本号" width="80" />
      <el-table-column prop="change_note" label="变更说明" min-width="250" />
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button size="small" @click="showDetail(row)">查看</el-button>
          <el-button size="small" type="warning" @click="showRollback(row)">回滚</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showDetailDialog" title="版本详情" width="600px">
      <pre style="max-height:400px;overflow:auto;background:#f5f5f5;padding:12px">{{ JSON.stringify(detailContent, null, 2) }}</pre>
    </el-dialog>

    <el-dialog v-model="showRollbackDialog" title="版本回滚" width="500px">
      <el-form-item label="回滚原因"><el-input v-model="rollbackReason" type="textarea" /></el-form-item>
      <template #footer>
        <el-button @click="showRollbackDialog = false">取消</el-button>
        <el-button type="primary" @click="doRollback" :disabled="!rollbackReason">确认回滚</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getVersions, rollback } from '@/api/project'
import { ElMessage } from 'element-plus'
import { formatDate } from '@/utils/validators'

const route = useRoute()
const programId = route.params.id as string
const versions = ref<any[]>([])
const showDetailDialog = ref(false)
const detailContent = ref(null)
const showRollbackDialog = ref(false)
const rollbackVersion = ref(0)
const rollbackReason = ref('')

onMounted(async () => {
  const res = await getVersions(programId)
  versions.value = res.data || []
})

function showDetail(row: any) {
  detailContent.value = row
  showDetailDialog.value = true
}

function showRollback(row: any) {
  rollbackVersion.value = row.version
  rollbackReason.value = ''
  showRollbackDialog.value = true
}

async function doRollback() {
  await rollback(programId, rollbackVersion.value, rollbackReason.value)
  ElMessage.success('回滚成功')
  showRollbackDialog.value = false
  const res = await getVersions(programId)
  versions.value = res.data || []
}
</script>
