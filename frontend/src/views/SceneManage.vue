<template>
  <div>
    <el-button @click="$router.push('/exhibits')" style="margin-bottom:16px">← 返回展项列表</el-button>
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <h3>场景管理</h3>
      <el-button type="primary" @click="showCreateScene = true">新建场景</el-button>
    </div>

    <el-collapse v-model="activeScenes">
      <el-collapse-item v-for="scene in projectStore.scenes" :key="scene.id" :name="scene.id">
        <template #title>
          <span style="font-size:16px;font-weight:bold">{{ scene.name }}</span>
          <el-tag style="margin-left:12px">{{ scene.device_count }} 个设备</el-tag>
        </template>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px">
          <span>{{ scene.description }}</span>
          <el-space>
            <el-button size="small" @click="editScene(scene)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteScene(scene)">删除</el-button>
          </el-space>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <h4>设备列表</h4>
          <el-button size="small" type="primary" @click="openDeviceDialog(scene.id)">添加设备</el-button>
        </div>
        <el-table :data="devicesMap[scene.id] || []" border size="small">
          <el-table-column prop="name" label="名称" />
          <el-table-column prop="device_type" label="类型" width="120" />
          <el-table-column prop="unique_code" label="唯一编号" width="150" />
          <el-table-column prop="ip_address" label="IP地址" width="150" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }"><el-tag :type="row.status === 'online' ? 'success' : 'info'">{{ row.status }}</el-tag></template>
          </el-table-column>
          <el-table-column label="操作" width="180">
            <template #default="{ row }">
              <el-button size="small" @click="editDevice(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="deleteDevice(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-collapse-item>
    </el-collapse>

    <!-- Scene dialogs -->
    <el-dialog v-model="showCreateScene" title="新建场景" width="500px">
      <el-form :model="sceneForm">
        <el-form-item label="名称"><el-input v-model="sceneForm.name" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="sceneForm.description" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateScene = false">取消</el-button>
        <el-button type="primary" @click="createScene">确定</el-button>
      </template>
    </el-dialog>

    <!-- Device dialogs -->
    <el-dialog v-model="showDeviceDialog" title="添加设备" width="500px">
      <el-form :model="deviceForm">
        <el-form-item label="名称"><el-input v-model="deviceForm.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="deviceForm.device_type" style="width:100%">
            <el-option label="PC" value="pc" /><el-option label="触摸屏" value="touch_screen" />
            <el-option label="安卓盒子" value="android_box" />
          </el-select>
        </el-form-item>
        <el-form-item label="IP地址"><el-input v-model="deviceForm.ip_address" /></el-form-item>
        <el-form-item label="分辨率">
          <el-input v-model.number="deviceForm.design_width" placeholder="宽" style="width:120px" />
          <span style="margin:0 8px">×</span>
          <el-input v-model.number="deviceForm.design_height" placeholder="高" style="width:120px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDeviceDialog = false">取消</el-button>
        <el-button type="primary" @click="createDevice">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import { ElMessageBox, ElMessage } from 'element-plus'

const route = useRoute()
const projectStore = useProjectStore()
const exhibitId = route.params.id as string
const activeScenes = ref<string[]>([])
const showCreateScene = ref(false)
const showDeviceDialog = ref(false)
const currentSceneId = ref('')
const devicesMap = ref<Record<string, any[]>>({})

const sceneForm = reactive({ name: '', description: '' })
const deviceForm = reactive({ name: '', device_type: 'pc', ip_address: '', design_width: 1920, design_height: 1080 })

onMounted(async () => {
  await projectStore.fetchScenes(exhibitId)
  for (const scene of projectStore.scenes) {
    const res = await import('@/api/exhibit').then(m => m.getDevices(scene.id))
    devicesMap.value[scene.id] = res.data || []
  }
})

async function createScene() {
  await projectStore.createSceneItem(exhibitId, { name: sceneForm.name, description: sceneForm.description, sort_order: 0 })
  showCreateScene.value = false
  sceneForm.name = ''; sceneForm.description = ''
  ElMessage.success('创建成功')
}

async function editScene(row: any) {
  sceneForm.name = row.name; sceneForm.description = row.description || ''
  showCreateScene.value = true
}

async function deleteScene(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除场景 "${row.name}"？`, '警告', { type: 'warning' })
    await projectStore.deleteSceneItem(row.id)
    ElMessage.success('删除成功')
  } catch { /* */ }
}

function openDeviceDialog(sceneId: string) {
  currentSceneId.value = sceneId
  showDeviceDialog.value = true
}

async function createDevice() {
  await projectStore.createDeviceItem(currentSceneId.value, {
    name: deviceForm.name, device_type: deviceForm.device_type,
    ip_address: deviceForm.ip_address, design_width: deviceForm.design_width,
    design_height: deviceForm.design_height
  })
  showDeviceDialog.value = false
  deviceForm.name = ''; deviceForm.ip_address = ''
  const res = await import('@/api/exhibit').then(m => m.getDevices(currentSceneId.value))
  devicesMap.value[currentSceneId.value] = res.data || []
  ElMessage.success('添加成功')
}

async function editDevice(row: any) {
  deviceForm.name = row.name; deviceForm.device_type = row.device_type
  deviceForm.ip_address = row.ip_address || ''; deviceForm.design_width = row.design_width
  deviceForm.design_height = row.design_height
  currentSceneId.value = row.scene_id
  showDeviceDialog.value = true
}

async function deleteDevice(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除设备 "${row.name}"？`, '警告', { type: 'warning' })
    await projectStore.deleteDeviceItem(row.id)
    const res = await import('@/api/exhibit').then(m => m.getDevices(row.scene_id))
    devicesMap.value[row.scene_id] = res.data || []
    ElMessage.success('删除成功')
  } catch { /* */ }
}
</script>
