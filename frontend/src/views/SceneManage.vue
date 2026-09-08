<template>
  <div>
    <el-button @click="$router.push('/exhibits')" style="margin-bottom:16px">← 返回展项列表</el-button>
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <h3>展项：{{ exhibitName }}</h3>
      <el-button type="primary" @click="showCreateScene = true">新建场景</el-button>
    </div>

    <el-card style="margin-bottom:16px">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>设备管理（展项级，可被多个场景共享）</span>
          <el-button size="small" type="primary" @click="openDeviceDialog()">添加设备</el-button>
        </div>
      </template>
      <el-table :data="exhibitDevices" border size="small" v-loading="loadingDevices">
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="device_type" label="类型" width="120" />
        <el-table-column prop="ip_address" label="IP地址" width="150" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }"><el-tag :type="row.status === 'online' ? 'success' : 'info'">{{ row.status === 'online' ? '在线' : '离线' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button size="small" @click="editDevice(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteDevice(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-collapse v-model="activeScenes">
      <el-collapse-item v-for="scene in projectStore.scenes" :key="scene.id" :name="scene.id">
        <template #title>
          <span style="font-size:16px;font-weight:bold">{{ scene.name }}</span>
          <el-tag style="margin-left:12px">{{ scene.device_count }} 个设备</el-tag>
          <el-button size="small" type="success" style="margin-left:12px" @click.stop="doSwitchScene(scene)">切换到此场景</el-button>
        </template>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px">
          <span>{{ scene.description }}</span>
          <el-space>
            <el-button size="small" @click="editScene(scene)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteScene(scene)">删除</el-button>
          </el-space>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <h4>已绑定设备</h4>
          <el-button size="small" type="primary" @click="openBindDialog(scene.id)">添加设备</el-button>
        </div>
        <el-table :data="devicesMap[scene.id] || []" border size="small">
          <el-table-column prop="name" label="名称" />
          <el-table-column prop="device_type" label="类型" width="120" />
          <el-table-column prop="ip_address" label="IP地址" width="150" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }"><el-tag :type="row.status === 'online' ? 'success' : 'info'">{{ row.status === 'online' ? '在线' : '离线' }}</el-tag></template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button size="small" type="danger" @click="unbindDevice(scene.id, row)">解绑</el-button>
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
      <div style="color:#999;font-size:12px">创建后默认绑定展项当前全部设备，之后可在场景中调整。</div>
      <template #footer>
        <el-button @click="showCreateScene = false">取消</el-button>
        <el-button type="primary" @click="createScene">确定</el-button>
      </template>
    </el-dialog>

    <!-- Device dialogs -->
    <el-dialog v-model="showDeviceDialog" :title="editingDeviceId ? '编辑设备' : '添加设备'" width="500px">
      <el-form :model="deviceForm" ref="deviceFormRef" :rules="deviceRules">
        <el-form-item label="名称" prop="name"><el-input v-model="deviceForm.name" /></el-form-item>
        <el-form-item label="类型" prop="device_type">
          <el-select v-model="deviceForm.device_type" style="width:100%">
            <el-option label="PC" value="pc" /><el-option label="触摸屏" value="touch_screen" />
            <el-option label="安卓盒子" value="android_box" />
          </el-select>
        </el-form-item>
        <el-form-item label="IP地址" prop="ip_address">
          <el-input v-model="deviceForm.ip_address" placeholder="请输入设备实际IP，如 192.168.1.101" />
          <div style="color:#999;font-size:12px;line-height:1.6;margin-top:4px">设备按 IP 自动绑定，请确保与播放器设备实际 IP 一致。</div>
        </el-form-item>
        <el-form-item label="分辨率">
          <el-input v-model.number="deviceForm.design_width" placeholder="宽" style="width:120px" />
          <span style="margin:0 8px">×</span>
          <el-input v-model.number="deviceForm.design_height" placeholder="高" style="width:120px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDeviceDialog = false">取消</el-button>
        <el-button type="primary" @click="saveDevice">确定</el-button>
      </template>
    </el-dialog>

    <!-- Bind device to scene dialog -->
    <el-dialog v-model="showBindDialog" title="绑定设备到场景" width="500px">
      <el-form label-width="80px">
        <el-form-item label="设备">
          <el-select v-model="bindDeviceIds" multiple placeholder="选择展项下尚未绑定的设备" style="width:100%">
            <el-option v-for="d in bindableDevices" :key="d.id" :label="`${d.name} (${d.ip_address})`" :value="d.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBindDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!bindDeviceIds.length" @click="doBind">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import { getDevices, getExhibitDevices, bindDeviceToScene, unbindDeviceFromScene, switchScene } from '@/api/exhibit'
import { ElMessageBox, ElMessage } from 'element-plus'

const route = useRoute()
const projectStore = useProjectStore()
const exhibitId = route.params.id as string
const activeScenes = ref<string[]>([])
const showCreateScene = ref(false)
const showDeviceDialog = ref(false)
const showBindDialog = ref(false)
const devicesMap = ref<Record<string, any[]>>({})
const exhibitDevices = ref<any[]>([])
const loadingDevices = ref(false)
const currentBindSceneId = ref('')
const bindDeviceIds = ref<string[]>([])

const sceneForm = reactive({ name: '', description: '' })
const deviceForm = reactive({ name: '', device_type: 'pc', ip_address: '', design_width: 1920, design_height: 1080 })
const deviceFormRef = ref()
const deviceRules = {
  name: [{ required: true, message: '请输入设备名称', trigger: 'blur' }],
  ip_address: [
    { required: true, message: '请输入设备IP地址', trigger: 'blur' },
    { pattern: /^(\d{1,3}\.){3}\d{1,3}$/, message: 'IP格式不正确', trigger: 'blur' },
  ],
}
const editingDeviceId = ref('')

const exhibitName = computed(() => {
  const ex = projectStore.exhibits.find(e => e.id === exhibitId)
  return ex?.name || exhibitId
})

const bindableDevices = computed(() => {
  const bound = devicesMap.value[currentBindSceneId.value] || []
  const boundIds = new Set(bound.map((d: any) => d.id))
  return exhibitDevices.value.filter((d: any) => !boundIds.has(d.id))
})

async function loadExhibitDevices() {
  loadingDevices.value = true
  try {
    const res = await getExhibitDevices(exhibitId)
    exhibitDevices.value = res.data || []
  } finally {
    loadingDevices.value = false
  }
}

async function loadSceneDevices(sceneId: string) {
  const res = await getDevices(sceneId)
  devicesMap.value[sceneId] = res.data || []
}

async function loadAll() {
  await Promise.all([
    projectStore.fetchExhibits(),
    projectStore.fetchScenes(exhibitId),
    loadExhibitDevices(),
  ])
  await Promise.all(projectStore.scenes.map(s => loadSceneDevices(s.id)))
}

onMounted(loadAll)

async function createScene() {
  await projectStore.createSceneItem(exhibitId, { name: sceneForm.name, description: sceneForm.description, sort_order: 0 })
  showCreateScene.value = false
  sceneForm.name = ''; sceneForm.description = ''
  await Promise.all(projectStore.scenes.map(s => loadSceneDevices(s.id)))
  ElMessage.success('创建成功（已默认绑定展项全部设备）')
}

async function editScene(row: any) {
  sceneForm.name = row.name; sceneForm.description = row.description || ''
  showCreateScene.value = true
}

async function deleteScene(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除场景 "${row.name}"？`, '警告', { type: 'warning' })
    await projectStore.deleteSceneItem(row.id)
    delete devicesMap.value[row.id]
    ElMessage.success('删除成功')
  } catch { /* */ }
}

function openDeviceDialog() {
  editingDeviceId.value = ''
  deviceForm.name = ''; deviceForm.device_type = 'pc'
  deviceForm.ip_address = ''; deviceForm.design_width = 1920; deviceForm.design_height = 1080
  showDeviceDialog.value = true
}

async function saveDevice() {
  if (deviceFormRef.value) {
    const valid = await deviceFormRef.value.validate().catch(() => false)
    if (!valid) return
  }
  const payload = {
    name: deviceForm.name, device_type: deviceForm.device_type,
    ip_address: deviceForm.ip_address, design_width: deviceForm.design_width,
    design_height: deviceForm.design_height
  }
  if (editingDeviceId.value) {
    await projectStore.updateDeviceItem(editingDeviceId.value, payload)
  } else {
    await projectStore.createExhibitDeviceItem(exhibitId, payload)
  }
  showDeviceDialog.value = false
  await loadExhibitDevices()
  ElMessage.success(editingDeviceId.value ? '更新成功' : '添加成功')
}

async function editDevice(row: any) {
  deviceForm.name = row.name; deviceForm.device_type = row.device_type
  deviceForm.ip_address = row.ip_address || ''; deviceForm.design_width = row.design_width
  deviceForm.design_height = row.design_height
  editingDeviceId.value = row.id
  showDeviceDialog.value = true
}

async function deleteDevice(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除设备 "${row.name}"？删除后将从所有场景中移除。`, '警告', { type: 'warning' })
    await projectStore.deleteDeviceItem(row.id)
    await loadAll()
    ElMessage.success('删除成功')
  } catch { /* */ }
}

function openBindDialog(sceneId: string) {
  currentBindSceneId.value = sceneId
  bindDeviceIds.value = []
  showBindDialog.value = true
}

async function doBind() {
  for (const deviceId of bindDeviceIds.value) {
    await bindDeviceToScene(currentBindSceneId.value, deviceId)
  }
  showBindDialog.value = false
  await Promise.all([loadSceneDevices(currentBindSceneId.value), projectStore.fetchScenes(exhibitId)])
  ElMessage.success('绑定成功')
}

async function unbindDevice(sceneId: string, row: any) {
  try {
    await ElMessageBox.confirm(`确定将设备 "${row.name}" 从该场景解绑？`, '警告', { type: 'warning' })
    await unbindDeviceFromScene(sceneId, row.id)
    await Promise.all([loadSceneDevices(sceneId), projectStore.fetchScenes(exhibitId)])
    ElMessage.success('已解绑')
  } catch { /* */ }
}

async function doSwitchScene(scene: any) {
  try {
    await ElMessageBox.confirm(`确定将全部在线设备切换为场景 "${scene.name}"？`, '确认', { type: 'warning' })
    const res = await switchScene(scene.id)
    ElMessage.success(`已切换场景，${res.data?.delivered || 0} 台在线设备已收到指令`)
  } catch { /* */ }
}
</script>
