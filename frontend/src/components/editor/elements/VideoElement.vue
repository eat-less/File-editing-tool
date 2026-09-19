<template>
  <v-group ref="groupRef" v-if="visible" :config="groupConfig" @click="onClick" @tap="onClick" @mousedown="onMouseDown" @dragstart="onDragStart" @dragend="onDragEnd" @transformend="onTransformEnd">
    <v-rect :config="bgRectConfig" />
    <v-image v-if="videoReady" :config="videoImageConfig" />
    <v-image v-else-if="posterImage" :config="posterConfig" />
    <template v-if="!videoReady">
      <v-circle :config="playBtnConfig" />
      <v-text :config="playIconConfig" />
    </template>
    <v-text :config="labelConfig" />
    <v-rect :config="borderConfig" />
  </v-group>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useEditorStore } from '@/stores/editor'
import type { ElementItem, LayerItem } from '@/types'

const props = defineProps<{ element: ElementItem; layer: LayerItem; isSelected: boolean }>()
const emit = defineEmits(['select'])

function onClick(e: any) {
  try { if (e.evt?.stopPropagation) e.evt.stopPropagation(); if (e.cancelBubble !== undefined) e.cancelBubble = true } catch {}
  emit('select', e.evt || e)
}

let pressTime = 0
function onMouseDown() { pressTime = Date.now() }
function onDragStart(e: any) {
  // 单击(短按)仅用于选中元素,不应触发拖动;只有按住足够久后才允许移动
  if (Date.now() - pressTime < 250) {
    e.target.stopDrag()
  }
}

const editorStore = useEditorStore()
const groupRef = ref<any>(null)
const posterImage = ref<HTMLImageElement | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)
const videoReady = ref(false)
let rafId: number | null = null

const visible = computed(() => props.layer?.visible !== false)
const w = computed(() => props.element.width || 400)
const h = computed(() => props.element.height || 300)

const srcHash = computed(() => {
  const s = props.element.srcs
  if (Array.isArray(s) && s.length) return s[0]
  return props.element.src || ''
})

watch(() => props.element.poster, (hash) => {
  if (!hash) { posterImage.value = null; return }
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = `/api/v1/assets/${hash}/file`
  img.onload = () => { posterImage.value = img }
  img.onerror = () => { posterImage.value = null }
}, { immediate: true })

function stopRaf() {
  if (rafId != null) { cancelAnimationFrame(rafId); rafId = null }
}

function startRaf() {
  stopRaf()
  const tick = () => {
    const layer = groupRef.value?.getNode?.()?.getLayer?.()
    if (layer) layer.batchDraw()
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

function destroyVideo() {
  stopRaf()
  const v = videoEl.value
  if (v) {
    try { v.pause() } catch {}
    v.removeAttribute('src')
    try { v.load() } catch {}
  }
  videoEl.value = null
  videoReady.value = false
}

function setupVideo() {
  destroyVideo()
  const hash = srcHash.value
  if (!hash) return
  const v = document.createElement('video')
  v.crossOrigin = 'anonymous'
  v.src = `/api/v1/assets/${hash}/file`
  v.loop = props.element.loop !== false
  v.muted = props.element.muted !== false
  v.volume = Number(props.element.volume ?? 0.8)
  v.playsInline = true
  v.autoplay = true
  v.preload = 'auto'
  v.addEventListener('loadeddata', () => {
    videoReady.value = true
    v.play().catch(() => {})
    startRaf()
  })
  v.addEventListener('play', startRaf)
  v.addEventListener('pause', () => { if (!v.ended) stopRaf() })
  v.addEventListener('ended', stopRaf)
  v.load()
  v.play().catch(() => {})
  videoEl.value = v
}

watch(srcHash, () => setupVideo(), { immediate: true })
watch(() => props.element.muted, (m) => { if (videoEl.value) videoEl.value.muted = m !== false })
watch(() => props.element.loop, (l) => { if (videoEl.value) videoEl.value.loop = l !== false })
watch(() => props.element.volume, (val) => { if (videoEl.value) videoEl.value.volume = Number(val ?? 0.8) })

onBeforeUnmount(destroyVideo)

const groupConfig = computed(() => ({
  x: props.element.x, y: props.element.y,
  rotation: props.element.rotation, opacity: props.element.opacity,
  draggable: !props.layer?.locked,
  elementId: props.element.id,
  globalCompositeOperation: props.layer.blendMode !== 'normal' ? props.layer.blendMode : undefined,
  shadowColor: props.element.shadow?.color,
  shadowBlur: props.element.shadow?.blur || 0,
  shadowOffsetX: props.element.shadow?.offsetX || 0,
  shadowOffsetY: props.element.shadow?.offsetY || 0,
}))

const bgRectConfig = computed(() => ({
  width: w.value, height: h.value,
  fill: props.element.src || srcHash.value ? '#111' : '#1a1a2e',
  cornerRadius: props.element.borderRadius || 0
}))

const videoImageConfig = computed(() => {
  const v = videoEl.value as any
  void videoReady.value
  const cfg: Record<string, any> = {
    x: 0, y: 0,
    width: w.value, height: h.value,
    image: v,
    listening: false,
    cornerRadius: props.element.borderRadius || 0,
  }
  // 与预览一致：默认按 cover 裁剪
  const fit = props.element.objectFit || 'cover'
  if (fit === 'cover' && v && v.videoWidth && v.videoHeight) {
    const scale = Math.max(w.value / v.videoWidth, h.value / v.videoHeight)
    const cropW = w.value / scale
    const cropH = h.value / scale
    cfg.crop = {
      x: (v.videoWidth - cropW) / 2,
      y: (v.videoHeight - cropH) / 2,
      width: cropW,
      height: cropH,
    }
  }
  return cfg
})

const posterConfig = computed(() => ({
  x: 0, y: 0,
  width: w.value, height: h.value,
  image: posterImage.value,
  listening: false,
}))

const playBtnConfig = computed(() => ({
  x: w.value / 2, y: h.value / 2,
  radius: Math.min(w.value, h.value) / 6,
  fill: 'rgba(255,255,255,0.15)',
  stroke: 'rgba(255,255,255,0.5)',
  strokeWidth: 2,
  listening: false,
}))

const playIconConfig = computed(() => ({
  text: '▶',
  x: w.value / 2 - 10, y: h.value / 2 - 16,
  fontSize: Math.min(w.value, h.value) / 5,
  fill: 'rgba(255,255,255,0.6)',
  listening: false,
}))

const labelConfig = computed(() => ({
  text: props.element.name || '视频',
  x: 8, y: h.value - 22,
  fontSize: 12,
  fill: '#999',
  listening: false,
}))

const borderConfig = computed(() => ({
  x: 0, y: 0,
  width: w.value, height: h.value,
  stroke: props.isSelected ? '#409EFF' : 'rgba(255,255,255,0.08)',
  strokeWidth: props.isSelected ? 2 : 1,
  cornerRadius: props.element.borderRadius || 0,
  listening: false,
}))

function onDragEnd(e: any) {
  const node = e.target
  const x = Math.round(node.x())
  const y = Math.round(node.y())
  // 未发生实际位移时不写回数据,避免点击选中被误判为拖动而产生无效记录
  if (x === Math.round(props.element.x || 0) && y === Math.round(props.element.y || 0)) return
  editorStore.updateElement(props.element.id, { x, y })
}

function onTransformEnd(e: any) {
  const node = e.target
  const sx = node.scaleX()
  const sy = node.scaleY()
  node.scaleX(1)
  node.scaleY(1)
  editorStore.updateElement(props.element.id, {
    x: Math.round(node.x()),
    y: Math.round(node.y()),
    rotation: Math.round(node.rotation()),
    width: Math.round((w.value) * Math.abs(sx)),
    height: Math.round((h.value) * Math.abs(sy))
  })
}
</script>
