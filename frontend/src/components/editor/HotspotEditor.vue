<template>
  <div class="hotspot-editor">
    <div style="padding:8px;color:#909399" v-if="!editorStore.selectedElement">选中元素以编辑热区</div>
    <div v-else style="padding:8px">
      <el-form size="small" label-position="top">
        <el-form-item label="启用热区"><el-switch v-model="enabled" @change="save" /></el-form-item>
        <template v-if="enabled">
          <el-form-item label="触发方式">
            <el-select v-model="form.trigger" style="width:100%" @change="save">
              <el-option label="点击" value="click" /><el-option label="悬停" value="hover" />
            </el-select>
          </el-form-item>
          <el-form-item label="动作">
            <el-select v-model="form.action" style="width:100%" @change="save">
              <el-option label="切换页面" value="switchPage" />
              <el-option label="下一页" value="nextPage" />
              <el-option label="上一页" value="prevPage" />
              <el-option label="切换场景" value="switchScene" />
              <el-option label="切换节目" value="switchProgram" />
              <el-option label="播放视频" value="playVideo" />
              <el-option label="暂停视频" value="pauseVideo" />
              <el-option label="拖拽帧" value="scrubFrames" />
              <el-option label="无" value="none" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="['switchPage', 'switchProgram', 'switchScene'].includes(form.action)" label="目标">
            <el-input v-model="form.target" placeholder="页面/节目/场景ID" @change="save" />
          </el-form-item>
          <el-form-item label="作用范围">
            <el-select v-model="form.scope" style="width:100%" @change="save">
              <el-option label="仅本设备" value="local" />
              <el-option label="整个场景" value="scene" />
              <el-option label="指定设备" value="devices" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="form.scope === 'devices'" label="目标设备">
            <el-select v-model="form.targetDeviceCodes" multiple style="width:100%" @change="save">
              <el-option v-for="d in devices" :key="d.unique_code" :label="`${d.name} (${d.unique_code})`" :value="d.unique_code" />
            </el-select>
          </el-form-item>
          <el-form-item label="光标">
            <el-select v-model="form.cursor" style="width:100%" @change="save">
              <el-option label="指针" value="pointer" /><el-option label="手型" value="hand" />
            </el-select>
          </el-form-item>
          <el-form-item label="高亮"><el-switch v-model="form.highlight" @change="save" /></el-form-item>
        </template>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { getDevices } from '@/api/exhibit'
import type { Hotspot } from '@/types'

const editorStore = useEditorStore()
const enabled = ref(false)
const devices = ref<any[]>([])
const form = ref<Hotspot>({
  enabled: false, trigger: 'click', action: 'switchPage',
  target: '', cursor: 'pointer', highlight: true,
  scope: 'local', targetDeviceCodes: [], commandParams: {}
})

function loadDevices() {
  const sceneId = editorStore.programInfo?.scene_id
  if (!sceneId) return
  getDevices(sceneId).then((res: any) => {
    devices.value = res.data || []
  }).catch(() => {})
}

const defaultHotspot = (): Hotspot => ({
  enabled: false, trigger: 'click', action: 'switchPage',
  target: '', cursor: 'pointer', highlight: true,
  scope: 'local', targetDeviceCodes: [], commandParams: {}
})

watch(() => editorStore.selectedElement, () => {
  const layer = editorStore.currentPage?.layers.find(l => l.element.id === editorStore.selectedElement?.id)
  if (layer?.hotspot) {
    enabled.value = layer.hotspot.enabled
    form.value = { ...defaultHotspot(), ...layer.hotspot }
  } else {
    enabled.value = false
    form.value = defaultHotspot()
  }
  loadDevices()
}, { immediate: true })

function save() {
  if (!editorStore.selectedElement) return
  form.value.enabled = enabled.value
  editorStore.setHotspot(editorStore.selectedElement.id, enabled.value ? { ...form.value } : null)
}
</script>
