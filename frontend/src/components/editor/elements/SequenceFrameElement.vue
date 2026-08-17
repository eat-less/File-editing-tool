<template>
  <v-group :config="groupConfig" @click="onClick" @mousedown="onMouseDown" @dragstart="onDragStart" @dragend="onDragEnd" @transformend="onTransformEnd">
    <v-image ref="konvaImageRef" v-if="hasImage" :config="imageConfig" />
    <v-rect v-else :config="rectConfig" />
    <v-text v-if="!hasImage" :config="labelConfig" />
    <v-text :config="infoConfig" />
  </v-group>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, nextTick } from 'vue'
import { useEditorStore } from '@/stores/editor'
import type { ElementItem, LayerItem } from '@/types'

const props = defineProps<{ element: ElementItem; layer: LayerItem; isSelected: boolean }>()
const emit = defineEmits(['select'])

const editorStore = useEditorStore()
const konvaImageRef = ref<any>(null)
const hasImage = ref(false)
const frameImages = ref<HTMLImageElement[]>([])
let animTimer: ReturnType<typeof setInterval> | null = null
let seqTimer: ReturnType<typeof setTimeout> | null = null
let currentIdx = 0
let direction = 1
let currentLoop = 0
const currentSeqIdx = ref(0)

const allSeqSources = computed(() => {
  const arr = props.element.seqSources
  if (Array.isArray(arr) && arr.length > 0) return arr
  const src = props.element.source
  if (src?.frames?.length) return [{ ...src, loopCount: props.element.loop !== false ? -1 : 1 }]
  return []
})

const totalDuration = computed(() => {
  const fps = props.element.frameRate || 30
  return allSeqSources.value.reduce((sum: number, s: any) => {
    const frames = s.frames?.length || s.frameCount || 0
    const loop = s.loopCount || 1
    return sum + (frames / fps) * (loop === -1 ? 1 : loop)
  }, 0)
})

const currentSource = computed(() => allSeqSources.value[currentSeqIdx.value])

function onClick(e: any) {
  try { if (e.evt?.stopPropagation) e.evt.stopPropagation(); if (e.cancelBubble !== undefined) e.cancelBubble = true } catch {}
  emit('select', e.evt || e)
}

let pressTime = 0
function onMouseDown() { pressTime = Date.now() }
function onDragStart(e: any) {
  if (!props.isSelected && Date.now() - pressTime < 250) {
    e.target.stopDrag()
  }
}

const groupConfig = computed(() => ({
  x: props.element.x, y: props.element.y,
  rotation: props.element.rotation, opacity: props.element.opacity,
  draggable: !props.layer?.locked,
  visible: props.layer?.visible !== false,
  elementId: props.element.id,
  globalCompositeOperation: props.layer.blendMode !== 'normal' ? props.layer.blendMode : undefined,
  shadowColor: props.element.shadow?.color,
  shadowBlur: props.element.shadow?.blur || 0,
  shadowOffsetX: props.element.shadow?.offsetX || 0,
  shadowOffsetY: props.element.shadow?.offsetY || 0,
}))

const imageConfig = computed(() => ({
  x: 0, y: 0,
  width: props.element.width || 300,
  height: props.element.height || 300,
  image: frameImages.value[0] || undefined,
}))

const rectConfig = computed(() => ({
  width: props.element.width || 300,
  height: props.element.height || 300,
  fill: '#f5f7fa',
  stroke: props.isSelected ? '#409EFF' : '#666',
  strokeWidth: props.isSelected ? 2 : 1,
  cornerRadius: 4
}))

const labelConfig = computed(() => ({
  text: '序列帧',
  x: (props.element.width || 300) / 2 - 30,
  y: (props.element.height || 300) / 2 - 10,
  fill: '#ccc', fontSize: 14
}))

const infoConfig = computed(() => {
  const sources = allSeqSources.value
  const total = sources.length
  const src = sources[currentSeqIdx.value]
  const frames = src?.frames?.length || src?.frameCount || 0
  const fps = props.element.frameRate || 30
  const segDur = frames / fps
  const loop = src?.loopCount || 1
  const segTotal = segDur * (loop === -1 ? 1 : loop)
  return {
    text: total > 1
      ? `Seq${currentSeqIdx.value + 1}/${total} · ${frames}帧 · ${segTotal.toFixed(1)}s`
      : `${frames}帧@${fps}fps · ${segDur.toFixed(1)}s`,
    x: 8, y: (props.element.height || 300) - 20,
    fill: '#888', fontSize: 11
  }
})

function updateKonvaImage(img: HTMLImageElement) {
  const node = konvaImageRef.value?.getNode()
  if (node && img) {
    node.image(img)
    node.getLayer()?.batchDraw()
  }
}

function loadFrames() {
  stopAll()
  const src = currentSource.value
  if (!src?.frames?.length) {
    frameImages.value = []
    hasImage.value = false
    return
  }

  const frames = src.frames
  const images: HTMLImageElement[] = []
  let firstLoaded = false
  for (const frame of frames) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `/api/v1/assets/${frame.src}/file`
    img.onload = () => {
      if (!firstLoaded) {
        firstLoaded = true
        hasImage.value = true
        nextTick(() => updateKonvaImage(img))
      }
    }
    images.push(img)
  }
  frameImages.value = images

  if (props.element.autoplay !== false) startAnimation()
}

function startAnimation() {
  stopAll()
  const frames = frameImages.value
  if (frames.length === 0) return

  const source = currentSource.value
  const fps = props.element.frameRate || 30
  const loopCount = source?.loopCount || 1
  const isInfinite = loopCount === -1
  const dirType = props.element.direction || 'forward'
  const totalFrames = frames.length
  currentIdx = 0
  currentLoop = 1
  direction = 1

  if (frames.length === 1) {
    const img = frames[0]
    if (img && img.complete) updateKonvaImage(img)
    switchToNextSource()
    return
  }

  animTimer = setInterval(() => {
    if (dirType === 'forward') {
      currentIdx++
      if (currentIdx >= totalFrames) {
        if (isInfinite || currentLoop < loopCount) {
          currentIdx = 0
          if (!isInfinite) currentLoop++
        } else {
          switchToNextSource()
          return
        }
      }
    } else if (dirType === 'reverse') {
      currentIdx--
      if (currentIdx < 0) {
        if (isInfinite || currentLoop < loopCount) {
          currentIdx = totalFrames - 1
          if (!isInfinite) currentLoop++
        } else {
          switchToNextSource()
          return
        }
      }
    } else if (dirType === 'alternate') {
      currentIdx += direction
      if (currentIdx >= totalFrames) { currentIdx = totalFrames - 2; direction = -1 }
      else if (currentIdx < 0) {
        currentIdx = 1
        direction = 1
        if (!isInfinite && currentLoop >= loopCount) { switchToNextSource(); return }
        if (!isInfinite) currentLoop++
      }
    }

    const img = frames[currentIdx]
    if (img && img.complete) updateKonvaImage(img)
  }, 1000 / fps)
}

function switchToNextSource() {
  const sources = allSeqSources.value
  const next = currentSeqIdx.value + 1
  if (next >= sources.length) {
    const mode = props.element.cycleMode || 'manual'
    if (mode === 'auto' || mode === 'both') {
      currentSeqIdx.value = 0
      loadFrames()
    }
    return
  }
  currentSeqIdx.value = next
  loadFrames()
}

function stopAnimation() {
  if (animTimer) { clearInterval(animTimer); animTimer = null }
}

function stopAll() {
  stopAnimation()
  if (seqTimer) { clearTimeout(seqTimer); seqTimer = null }
}

watch(() => [props.element.source?.frames, props.element.seqSources, props.element.autoplay], () => {
  currentSeqIdx.value = 0
  loadFrames()
}, { immediate: true, deep: true })

onBeforeUnmount(() => {
  stopAll()
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
    width: Math.round((props.element.width || 300) * Math.abs(sx)),
    height: Math.round((props.element.height || 300) * Math.abs(sy))
  })
}
</script>
