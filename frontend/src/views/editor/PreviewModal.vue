<template>
  <Teleport to="body">
    <div v-if="visible" class="preview-overlay" :class="{ fullscreen: isFullscreen }">
      <div class="preview-toolbar">
        <span>{{ pageName }}</span>
        <span style="color:#999;font-size:12px">画布 {{ editorStore.device.designWidth }}×{{ editorStore.device.designHeight }}</span>
        <el-space>
          <el-button size="small" @click="toggleFullscreen">{{ isFullscreen ? '退出全屏' : '全屏' }}</el-button>
          <el-button size="small" @click="close">关闭</el-button>
        </el-space>
      </div>
      <div class="preview-canvas">
        <PlayerStage
          ref="stageRef"
          :config="config"
          :asset-url="assetUrl"
          :start-index="editorStore.currentPageIndex"
          :on-cross-device="onCrossDevice"
          :on-state="onState"
          :video-controls="true"
        />
        <div class="preview-nav">
          <button class="nav-btn nav-prev" @click.stop="stageRef?.prev()" :disabled="pageCount <= 1">&lt;</button>
          <span v-if="showIndicator" class="nav-indicator">{{ currentIndex + 1 }} / {{ pageCount }}</span>
          <button class="nav-btn nav-next" @click.stop="stageRef?.next()" :disabled="pageCount <= 1">&gt;</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '@/stores/editor'
import PlayerStage from '@/render-engine/PlayerStage.vue'
import { buildDeviceAction } from '@/utils/hotspotAction'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits(['update:visible'])

const editorStore = useEditorStore()
const stageRef = ref<InstanceType<typeof PlayerStage>>()
const isFullscreen = ref(false)
const showIndicator = ref(true)
const currentIndex = ref(0)
const pageCount = ref(1)
let indicatorTimer: ReturnType<typeof setTimeout> | null = null

const config = computed(() => ({
  version: '3.0',
  device: editorStore.device,
  pages: editorStore.pages,
}))

const pageName = computed(() => {
  const page = editorStore.pages[currentIndex.value]
  return page?.name || '预览'
})

function assetUrl(hash: string): string {
  return `/api/v1/assets/${hash}/file`
}

function onCrossDevice(hotspot: any) {
  const msg = buildDeviceAction(hotspot, '')
  console.log('[预览] 跨设备指令(播放器端执行):', msg)
}

function onState(state: { pageIndex: number; pageCount: number }) {
  currentIndex.value = state.pageIndex
  pageCount.value = state.pageCount
  resetIndicator()
}

function close() {
  emit('update:visible', false)
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      const el = document.querySelector('.preview-overlay') as HTMLElement
      if (el) await el.requestFullscreen()
    }
  } catch {}
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

function resetIndicator() {
  showIndicator.value = true
  if (indicatorTimer) clearTimeout(indicatorTimer)
  indicatorTimer = setTimeout(() => { showIndicator.value = false }, 3000)
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  resetIndicator()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (indicatorTimer) clearTimeout(indicatorTimer)
})
</script>

<style scoped>
.preview-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.95); display: flex; flex-direction: column; }
.preview-overlay.fullscreen { background: #000; }
.preview-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; color: #ccc; flex-shrink: 0; }
.preview-canvas { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; }
.preview-nav { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 20px; z-index: 20; }
.nav-btn { width: 44px; height: 44px; border: 1px solid rgba(255,255,255,0.25); background: rgba(0,0,0,0.4); color: #fff; border-radius: 50%; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.nav-btn:hover:not(:disabled) { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.5); }
.nav-btn:disabled { opacity: 0.2; cursor: default; }
.nav-indicator { color: rgba(255,255,255,0.7); font-size: 14px; min-width: 60px; text-align: center; }
</style>
