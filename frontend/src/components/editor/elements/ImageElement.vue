<template>
  <v-group v-if="visible" :config="groupConfig" @click="onClick" @tap="onClick" @mousedown="onMouseDown" @dragstart="onDragStart" @dragend="onDragEnd" @transformend="onTransformEnd">
    <v-image v-if="currentImage" :config="currentImageConfig" />
    <v-image v-if="prevImage && transitioning" :config="prevImageConfig" />
    <v-rect v-if="!currentImage" :config="placeholderRectConfig" />
    <v-text v-if="!currentImage" :config="placeholderTextConfig" />
    <v-rect v-if="scrimTopConfig" :config="scrimTopConfig" />
    <v-rect v-if="scrimBottomConfig" :config="scrimBottomConfig" />
  </v-group>
  <v-label v-if="hasCaption" ref="captionNodeRef" :config="captionGroupConfig" @mouseenter="onCaptionEnter" @mouseleave="onCaptionLeave" @mousedown="onCaptionMouseDown">
    <v-tag v-if="bgEnabled" :config="captionTagConfig" />
    <v-text :config="captionTextConfig" />
  </v-label>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import Konva from 'konva'
import 'konva/lib/shapes/Label'
import { useEditorStore } from '@/stores/editor'
import { getTypewriterInterval, getEnterDuration } from '@/utils/appearEffect'
import type { ElementItem, LayerItem } from '@/types'

const props = defineProps<{ element: ElementItem; layer: LayerItem; isSelected: boolean }>()
const emit = defineEmits(['select'])

function onClick(e: any) {
  safeStopPropagation(e)
  emit('select', e.evt || e)
}

function safeStopPropagation(e: any) {
  try {
    if (e.evt?.stopPropagation) e.evt.stopPropagation()
    if (e.stopPropagation) e.stopPropagation()
    if (e.cancelBubble !== undefined) e.cancelBubble = true
  } catch {}
}

let pressTime = 0
function onMouseDown() { pressTime = Date.now() }
function onDragStart(e: any) {
  if (!props.isSelected && Date.now() - pressTime < 250) {
    e.target.stopDrag()
  }
}

const editorStore = useEditorStore()
const visible = computed(() => props.layer?.visible !== false)

const allImages = ref<Map<string, HTMLImageElement>>(new Map())
const currentImage = ref<HTMLImageElement | null>(null)
const prevImage = ref<HTMLImageElement | null>(null)
const transitioning = ref(false)
const imgIndex = ref(0)

const srcs = computed(() => {
  const s = props.element.srcs
  if (Array.isArray(s) && s.length > 0) return s
  return props.element.src ? [props.element.src] : []
})

async function loadAllImages() {
  const keys = srcs.value
  for (const key of keys) {
    if (allImages.value.has(key)) continue
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `/api/v1/assets/${key}/file`
    await new Promise<void>((resolve) => {
      img.onload = () => { allImages.value.set(key, img); resolve() }
      img.onerror = () => { allImages.value.set(key, img); resolve() }
    })
  }
  updateCurrentImage()
}

function updateCurrentImage() {
  const keys = srcs.value
  if (keys.length === 0) { currentImage.value = null; return }
  const idx = imgIndex.value % keys.length
  const key = keys[idx]
  const img = allImages.value.get(key)
  if (img && img.complete && img.naturalWidth > 0) {
    currentImage.value = img
  } else {
    currentImage.value = null
  }
}

onMounted(async () => { await loadAllImages(); ensureCaptionPosition() })
watch(() => props.element.srcs, () => { loadAllImages() }, { deep: true })
watch(() => props.element.src, () => {
  const keys = srcs.value
  const idx = keys.indexOf(props.element.src)
  if (idx >= 0) imgIndex.value = idx
  updateCurrentImage()
})
onBeforeUnmount(() => {
  stopCaptionType()
  if (captionTween) { captionTween.destroy(); captionTween = null }
})

function onDragEnd(e: any) {
  const node = e.target
  editorStore.updateElement(props.element.id, {
    x: Math.round(node.x()),
    y: Math.round(node.y())
  })
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
    width: Math.round((props.element.width || 400) * Math.abs(sx)),
    height: Math.round((props.element.height || 300) * Math.abs(sy))
  })
}

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

const currentImageConfig = computed(() => ({
  image: currentImage.value,
  width: props.element.width || 300,
  height: props.element.height || 200,
  cornerRadius: props.element.borderRadius || 0,
  opacity: transitioning.value ? 1 : 1,
  stroke: props.isSelected ? '#409EFF' : undefined,
  strokeWidth: props.isSelected ? 2 : 0
}))

const prevImageConfig = computed(() => ({
  image: prevImage.value,
  width: props.element.width || 300,
  height: props.element.height || 200,
  cornerRadius: props.element.borderRadius || 0,
  opacity: transitioning.value ? 0 : 1
}))

const placeholderRectConfig = computed(() => ({
  width: props.element.width || 300,
  height: props.element.height || 200,
  fill: '#f5f7fa',
  stroke: props.isSelected ? '#409EFF' : '#dcdfe6',
  strokeWidth: props.isSelected ? 2 : 1,
  cornerRadius: props.element.borderRadius || 0
}))

const placeholderTextConfig = computed(() => ({
  text: srcs.value.length > 1 ? `${srcs.value.length}张图片` : '拖入图片',
  x: (props.element.width || 300) / 2 - 30,
  y: (props.element.height || 200) / 2 - 8,
  fill: '#909399', fontSize: 14
}))

const currentCaption = computed(() => {
  const captions = props.element.captions
  if (!Array.isArray(captions) || captions.length === 0) return ''
  const idx = imgIndex.value
  if (idx >= captions.length) return ''
  return captions[idx] || ''
})

const hasCaption = computed(() => currentCaption.value !== '')

const captionEffect = computed(() => props.element.captionAppearEffect || 'none')
const captionSpeed = computed(() => props.element.captionAppearSpeed || 'normal')
const captionTyped = ref('')
let captionTypeTimer: ReturnType<typeof setInterval> | null = null
let captionTween: any = null

const captionDisplay = computed(() => captionEffect.value === 'typewriter' ? captionTyped.value : currentCaption.value)

function stopCaptionType() {
  if (captionTypeTimer) { clearInterval(captionTypeTimer); captionTypeTimer = null }
}

function runCaptionTypewriter() {
  stopCaptionType()
  captionTyped.value = ''
  const t = currentCaption.value
  if (!t.length) return
  let i = 0
  captionTypeTimer = setInterval(() => {
    i++
    captionTyped.value = t.slice(0, i)
    if (i >= t.length) stopCaptionType()
  }, getTypewriterInterval(captionSpeed.value))
}

function playCaptionTween() {
  const node = captionNodeRef.value?.getNode?.()
  if (!node) return
  const opacity = props.element.opacity ?? 1
  if (captionEffect.value === 'fade') {
    node.opacity(0)
    captionTween = new Konva.Tween({ node, opacity, duration: getEnterDuration(captionSpeed.value) / 1000, easing: Konva.Easings.EaseOut })
    captionTween.play()
  } else if (captionEffect.value === 'slide') {
    node.y(captionCY.value + 20)
    captionTween = new Konva.Tween({ node, y: captionCY.value, duration: getEnterDuration(captionSpeed.value) / 1000, easing: Konva.Easings.EaseOut })
    captionTween.play()
  }
}

function resetCaptionEffect() {
  stopCaptionType()
  if (captionTween) { captionTween.destroy(); captionTween = null }
  if (captionEffect.value === 'typewriter') {
    runCaptionTypewriter()
    return
  }
  captionTyped.value = currentCaption.value
  nextTick(() => playCaptionTween())
}

watch([currentCaption, captionEffect, captionSpeed], resetCaptionEffect, { immediate: true })

const captionNodeRef = ref<any>(null)
const draggingCaption = ref(false)
let dragStartX = 0, dragStartY = 0

const captionCX = ref(0)
const captionCY = ref(0)

const bgEnabled = computed(() => !!props.element.captionBgEnabled)
const scrimEnabled = computed(() => !!props.element.captionScrim)

function syncCaptionPos() {
  const el = props.element
  const positions = el.captionPositions
  const idx = imgIndex.value
  const pad = el.captionPadding ?? 8
  const h = el.height || 200
  const pos = el.captionPosition || 'bottom'
  const font = el.captionFontSize || 16
  const bgPad = bgEnabled.value ? (el.captionBgPadding ?? 8) : 0
  const barH = font * 1.4 + bgPad * 2
  if (Array.isArray(positions) && positions[idx]) {
    captionCX.value = positions[idx].x
    captionCY.value = positions[idx].y
  } else {
    captionCX.value = el.x + pad
    captionCY.value = el.y + (pos === 'top' ? pad : h - barH - bgPad)
  }
}

function ensureCaptionPosition() {
  if (!currentCaption.value) return
  const positions = props.element.captionPositions
  const idx = imgIndex.value
  if (Array.isArray(positions) && positions[idx]) return
  const newPos = [...(Array.isArray(positions) ? positions : [])]
  while (newPos.length <= idx) newPos.push(null)
  newPos[idx] = { x: Math.round(captionCX.value), y: Math.round(captionCY.value) }
  editorStore.setCaptionPositions(props.element.id, newPos)
}

watch([() => props.element.x, () => props.element.y, () => props.element.captionPositions, imgIndex, () => props.element.height, () => props.element.captionBgEnabled, () => props.element.captionBgPadding, () => props.element.captionFontSize], () => {
  syncCaptionPos()
}, { immediate: true })

watch([currentCaption, imgIndex], () => {
  ensureCaptionPosition()
})

const captionGroupConfig = computed(() => ({
  x: captionCX.value,
  y: captionCY.value,
  opacity: props.element.opacity,
  listening: true
}))

const captionTextConfig = computed(() => {
  const el = props.element
  const w = el.width || 300
  const font = el.captionFontSize || 16
  const capW = el.captionWidth || w
  const bgOn = bgEnabled.value
  const blur = el.captionShadowBlur ?? 3
  return {
    text: captionDisplay.value,
    width: capW,
    fill: el.captionColor || '#ffffff',
    fontSize: font,
    fontFamily: el.captionFontFamily || 'Microsoft YaHei',
    fontStyle: el.captionFontWeight === 'bold' ? 'bold' : 'normal',
    align: el.captionTextAlign || 'center',
    verticalAlign: 'top',
    wrap: 'word',
    ellipsis: true,
    lineHeight: 1.4,
    padding: bgOn ? (el.captionBgPadding ?? 8) : 0,
    stroke: el.captionStrokeEnabled ? (el.captionStrokeColor || '#000000') : undefined,
    strokeWidth: el.captionStrokeEnabled ? (el.captionStrokeWidth || 2) : 0,
    fillAfterStrokeEnabled: true,
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowBlur: blur,
    shadowOffsetX: 0,
    shadowOffsetY: blur >= 3 ? 1 : 0
  }
})

const captionTagConfig = computed(() => ({
  fill: props.element.captionBgColor || '#000000',
  opacity: Math.min(Math.max(props.element.captionBgOpacity ?? 0.5, 0), 1),
  cornerRadius: 4,
  pointerDirection: 'none'
}))

const scrimTopConfig = computed(() => {
  if (!scrimEnabled.value) return null
  const pos = props.element.captionScrimPosition || 'auto'
  const dir = pos === 'auto' ? (props.element.captionPosition || 'bottom') : pos
  if (dir === 'bottom') return null
  const h = (props.element.height || 200) * 0.3
  return {
    x: 0, y: 0, width: props.element.width || 300, height: h,
    listening: false,
    fillLinearGradientStartPoint: { x: 0, y: 0 },
    fillLinearGradientEndPoint: { x: 0, y: h },
    fillLinearGradientColorStops: [0, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0.45)']
  }
})

const scrimBottomConfig = computed(() => {
  if (!scrimEnabled.value) return null
  const pos = props.element.captionScrimPosition || 'auto'
  const dir = pos === 'auto' ? (props.element.captionPosition || 'bottom') : pos
  if (dir === 'top') return null
  const h = (props.element.height || 200) * 0.3
  return {
    x: 0, y: (props.element.height || 200) - h, width: props.element.width || 300, height: h,
    listening: false,
    fillLinearGradientStartPoint: { x: 0, y: 0 },
    fillLinearGradientEndPoint: { x: 0, y: h },
    fillLinearGradientColorStops: [0, 'rgba(0,0,0,0.45)', 1, 'rgba(0,0,0,0)']
  }
})

function onCaptionEnter() { document.body.style.cursor = 'move' }
function onCaptionLeave() { if (!draggingCaption.value) document.body.style.cursor = '' }

function onCaptionMouseDown(e: any) {
  const evt = e.evt
  evt.preventDefault()
  evt.stopPropagation()
  draggingCaption.value = true
  dragStartX = evt.clientX
  dragStartY = evt.clientY
  document.addEventListener('mousemove', onCaptionMouseMove)
  document.addEventListener('mouseup', onCaptionMouseUp)
}

function onCaptionMouseMove(e: MouseEvent) {
  if (!draggingCaption.value) return
  const zoom = editorStore.zoom || 1
  const dx = (e.clientX - dragStartX) / zoom
  const dy = (e.clientY - dragStartY) / zoom
  captionCX.value += dx
  captionCY.value += dy
  dragStartX = e.clientX
  dragStartY = e.clientY
}

function onCaptionMouseUp(e: MouseEvent) {
  draggingCaption.value = false
  document.body.style.cursor = ''
  document.removeEventListener('mousemove', onCaptionMouseMove)
  document.removeEventListener('mouseup', onCaptionMouseUp)

  const el = props.element
  const x = captionCX.value
  const y = captionCY.value
  const positions = [...(el.captionPositions || [])]
  const idx = imgIndex.value
  while (positions.length <= idx) positions.push(null)

  if (e.shiftKey) {
    for (let i = 0; i < srcs.value.length; i++) {
      while (positions.length <= i) positions.push(null)
      positions[i] = { x, y }
    }
  } else {
    positions[idx] = { x, y }
  }
  el.captionPositions = positions
  editorStore.updateElement(el.id, { captionPositions: positions })
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onCaptionMouseMove)
  document.removeEventListener('mouseup', onCaptionMouseUp)
})
</script>
