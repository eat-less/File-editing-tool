<template>
  <v-group ref="groupRef" :config="groupConfig" @click="onClick" @mousedown="onMouseDown" @dragstart="onDragStart" @dragend="onDragEnd" @transformend="onTransformEnd">
    <v-image ref="konvaImageRef" v-if="hasImage" :config="imageConfig" />
    <v-rect v-else :config="rectConfig" />
    <v-text v-if="!hasImage" :config="labelConfig" />
    <v-text :config="infoConfig" />
  </v-group>
  <v-image v-if="capForMe && ghostImg" :config="ghostImageConfig" />
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { normalizeSegments, hasSegmentMove, segmentsTotalDuration, evaluate } from '@/render-engine/seqChoreography'
import type { NormalizedSegment } from '@/render-engine/seqChoreography'
import type { ElementItem, LayerItem } from '@/types'

const props = defineProps<{ element: ElementItem; layer: LayerItem; isSelected: boolean }>()
const emit = defineEmits(['select'])

const editorStore = useEditorStore()
const groupRef = ref<any>(null)
const konvaImageRef = ref<any>(null)
const hasImage = ref(false)
const frameImages = ref<HTMLImageElement[]>([])
let animTimer: ReturnType<typeof setInterval> | null = null
let seqTimer: ReturnType<typeof setTimeout> | null = null
let currentIdx = 0
let direction = 1
let currentLoop = 0
const currentSeqIdx = ref(0)

// ---- 段位移预览:编辑画布上跟随播放器一致的段编排移动 ----
let segsCache: NormalizedSegment[] = []
let movePreviewOn = false
let choreoRAF: number | null = null
let choreoStart = 0
let choreoTotal = 0
let lastAppliedSrc = ''
let lastAppliedContentX: number | null = null
let pendingFrameSrc = ''
let winUpHandler: ((e: MouseEvent) => void) | null = null
const seqFrameCache = new Map<string, HTMLImageElement>()
const seqLoading = new Set<string>()

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

const currentContentX = computed(() => {
  const src = allSeqSources.value[currentSeqIdx.value] as any
  return typeof src?.contentX === 'number' ? src.contentX : 0
})

const capForMe = computed(() =>
  editorStore.alignCapture.active && editorStore.alignCapture.elementId === props.element.id)

const capGhost = computed(() => {
  const cap = editorStore.alignCapture
  if (!cap.active || cap.elementId !== props.element.id) return null
  const arr = allSeqSources.value
  if (cap.segIdx <= 0 || cap.segIdx >= arr.length) return null
  const prev = arr[cap.segIdx - 1] as any
  const pf = Array.isArray(prev?.frames) ? prev.frames : []
  const last = pf[pf.length - 1]
  if (!last?.src) return null
  return { src: last.src, contentX: typeof prev.contentX === 'number' ? prev.contentX : 0 }
})

const ghostImg = ref<HTMLImageElement | null>(null)

const ghostImageConfig = computed(() => {
  const g = capGhost.value
  return {
    x: (props.element.x || 0) + (g?.contentX || 0),
    y: props.element.y || 0,
    width: props.element.width || 300,
    height: props.element.height || 300,
    rotation: props.element.rotation || 0,
    opacity: 0.5,
    listening: false,
    image: ghostImg.value || undefined,
  }
})

function loadGhost() {
  ghostImg.value = null
  const g = capGhost.value
  if (!g) return
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => { ghostImg.value = img }
  img.src = `/api/v1/assets/${g.src}/file`
}

function syncCaptureSeg() {
  if (!capForMe.value) return
  const idx = editorStore.alignCapture.segIdx
  if (idx >= 0 && idx < allSeqSources.value.length) currentSeqIdx.value = idx
  loadGhost()
  loadFrames()
}

watch(() => [
  editorStore.alignCapture.active,
  editorStore.alignCapture.elementId,
  editorStore.alignCapture.segIdx,
], () => {
  if (capForMe.value) {
    syncCaptureSeg()
    return
  }
  if (editorStore.alignCapture.elementId === props.element.id) {
    currentSeqIdx.value = 0
    loadFrames()
  }
})

function onClick(e: any) {
  try { if (e.evt?.stopPropagation) e.evt.stopPropagation(); if (e.cancelBubble !== undefined) e.cancelBubble = true } catch {}
  emit('select', e.evt || e)
}

let pressTime = 0
function onMouseDown() {
  pressTime = Date.now()
  // 位移预览中的序列帧:按下时先固定回基准点,避免拖拽/选中的坐标与动画互相干扰
  if (movePreviewOn && !capForMe.value) {
    snapNodeToBase()
    pauseChoreo()
  }
}
function onDragStart(e: any) {
  // 单击(短按)仅用于选中元素,不应触发拖动;只有按住足够久后才允许移动
  if (Date.now() - pressTime < 250) {
    e.target.stopDrag()
  }
}

const groupConfig = computed(() => ({
  x: props.element.x, y: props.element.y,
  rotation: props.element.rotation, opacity: props.element.opacity,
  draggable: !props.layer?.locked && !capForMe.value,
  visible: props.layer?.visible !== false,
  elementId: props.element.id,
  globalCompositeOperation: props.layer.blendMode !== 'normal' ? props.layer.blendMode : undefined,
  shadowColor: props.element.shadow?.color,
  shadowBlur: props.element.shadow?.blur || 0,
  shadowOffsetX: props.element.shadow?.offsetX || 0,
  shadowOffsetY: props.element.shadow?.offsetY || 0,
}))

const imageConfig = computed(() => ({
  x: currentContentX.value, y: 0,
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

// ---- 段位移预览的实现 ----
function snapNodeToBase() {
  const node = groupRef.value?.getNode()
  if (!node) return
  const bx = props.element.x || 0
  const by = props.element.y || 0
  if (node.x() !== bx || node.y() !== by) {
    node.position({ x: bx, y: by })
    node.getLayer()?.batchDraw()
  }
}

function removeWinUp() {
  if (winUpHandler) {
    window.removeEventListener('mouseup', winUpHandler)
    winUpHandler = null
  }
}

function stopChoreo() {
  if (choreoRAF !== null) {
    cancelAnimationFrame(choreoRAF)
    choreoRAF = null
  }
  removeWinUp()
}

function ensureSeqFrame(src: string) {
  if (!src || src === lastAppliedSrc) return
  const cached = seqFrameCache.get(src)
  if (!cached) {
    if (seqLoading.has(src)) return
    seqLoading.add(src)
    pendingFrameSrc = src
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `/api/v1/assets/${src}/file`
    img.onload = () => {
      seqLoading.delete(src)
      seqFrameCache.set(src, img)
      if (src === pendingFrameSrc) ensureSeqFrame(src)
    }
    img.onerror = () => {
      seqLoading.delete(src)
      seqFrameCache.set(src, img)
      if (src === pendingFrameSrc) ensureSeqFrame(src)
    }
    return
  }
  if (!cached.complete) return
  if (!hasImage.value) hasImage.value = true
  const node = konvaImageRef.value?.getNode()
  if (!node) {
    // image 节点尚未挂载(hasImage 刚置 true),下一帧再补一次
    if (src !== lastAppliedSrc) requestAnimationFrame(() => { if (src !== lastAppliedSrc) ensureSeqFrame(src) })
    return
  }
  node.image(cached)
  lastAppliedSrc = src
  node.getLayer()?.batchDraw()
}

function displayHomeFrame() {
  stopChoreo()
  snapNodeToBase()
  lastAppliedSrc = ''
  lastAppliedContentX = null
  pendingFrameSrc = ''
  const st0 = evaluate(segsCache, 0, { startX: props.element.x || 0, startY: props.element.y || 0, wholeLoop: true })
  currentSeqIdx.value = st0.segIndex
  if (st0.src) ensureSeqFrame(st0.src)
  const seg = segsCache[st0.segIndex]
  if (seg) {
    const cx = seg.contentX ?? 0
    const imgNode = konvaImageRef.value?.getNode()
    if (imgNode) {
      imgNode.x(cx)
      lastAppliedContentX = cx
    }
  }
}

function startMoveChoreo() {
  stopChoreo()
  if (!movePreviewOn) return
  snapNodeToBase()
  lastAppliedSrc = ''
  lastAppliedContentX = null
  pendingFrameSrc = ''
  choreoTotal = segmentsTotalDuration(segsCache)
  choreoStart = performance.now()
  const st0 = evaluate(segsCache, 0, { startX: props.element.x || 0, startY: props.element.y || 0, wholeLoop: true })
  if (st0.src) ensureSeqFrame(st0.src)

  const loop = () => {
    const node = groupRef.value?.getNode()
    if (!node) {
      choreoRAF = requestAnimationFrame(loop)
      return
    }
    const elapsed = (performance.now() - choreoStart) / 1000
    const t = Number.isFinite(choreoTotal) && choreoTotal > 0 ? elapsed % choreoTotal : elapsed
    const st = evaluate(segsCache, t, { startX: props.element.x || 0, startY: props.element.y || 0, wholeLoop: true })
    if (st.src) {
      pendingFrameSrc = st.src
      ensureSeqFrame(st.src)
    }
    if (!props.isSelected && !node.isDragging()) {
      const changed = st.x !== node.x() || st.y !== node.y()
      const segChanged = st.segIndex !== currentSeqIdx.value
      if (segChanged) currentSeqIdx.value = st.segIndex
      if (changed) node.position({ x: st.x, y: st.y })
      const seg = segsCache[st.segIndex]
      if (seg) {
        const cx = seg.contentX ?? 0
        const imgNode = konvaImageRef.value?.getNode()
        if (imgNode && (lastAppliedContentX === null || Math.abs(imgNode.x() - cx) > 0.05)) {
          imgNode.x(cx)
          lastAppliedContentX = cx
        }
      }
      if (changed || segChanged) node.getLayer()?.batchDraw()
    }
    choreoRAF = requestAnimationFrame(loop)
  }
  choreoRAF = requestAnimationFrame(loop)
}

function pauseChoreo() {
  if (choreoRAF !== null) {
    cancelAnimationFrame(choreoRAF)
    choreoRAF = null
  }
  if (!winUpHandler) {
    winUpHandler = () => {
      removeWinUp()
      // 若此次按下并未选中该元素(点击空白/拖动后),松开后从基准点重新开始位移预览
      setTimeout(() => {
        if (movePreviewOn && !capForMe.value && !props.isSelected) startMoveChoreo()
      }, 0)
    }
    window.addEventListener('mouseup', winUpHandler)
  }
}

function loadFrames() {
  stopAll()
  segsCache = normalizeSegments(props.element as any)
  movePreviewOn = hasSegmentMove(segsCache) && props.element.autoplay !== false
  if (movePreviewOn && !capForMe.value) {
    if (props.isSelected) {
      displayHomeFrame()
      return
    }
    startMoveChoreo()
    return
  }
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

  if (capForMe.value) {
    const img0 = frames[0]
    if (img0 && img0.complete) updateKonvaImage(img0)
    return
  }

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
  stopChoreo()
}

watch(() => [props.element.source?.frames, props.element.seqSources, props.element.autoplay], () => {
  currentSeqIdx.value = capForMe.value
    ? Math.min(editorStore.alignCapture.segIdx, Math.max(0, allSeqSources.value.length - 1))
    : 0
  loadFrames()
}, { immediate: true, deep: true })

// 选中时冻结在基准点便于编辑,取消选中后恢复位移预览
watch(() => props.isSelected, (sel) => {
  if (sel) {
    stopChoreo()
    snapNodeToBase()
  } else if (movePreviewOn && !capForMe.value) {
    startMoveChoreo()
  }
})

onBeforeUnmount(() => {
  stopAll()
})

function onDragEnd(e: any) {
  const node = e.target
  const cap = editorStore.alignCapture
  if (cap.active && cap.elementId === props.element.id) {
    editorStore.setAlignDelta(
      Math.round((node.x() - (cap.baseX || 0)) * 10) / 10,
      Math.round((node.y() - (cap.baseY || 0)) * 10) / 10,
    )
    return
  }
  const dx = Math.round(node.x() - (props.element.x || 0))
  const dy = Math.round(node.y() - (props.element.y || 0))
  if (dx === 0 && dy === 0) return
  editorStore.moveElementWithSeqTargets(props.element.id, dx, dy)
}

watch(() => editorStore.alignCapture.rev, () => {
  const node = groupRef.value?.getNode()
  if (!node) return
  node.position({ x: props.element.x || 0, y: props.element.y || 0 })
  node.rotation(props.element.rotation || 0)
  node.getLayer()?.batchDraw()
})

function applyClip() {
  const node = groupRef.value?.getNode()
  if (!node) return
  const w = props.element.width || 300
  const h = props.element.height || 300
  node.clipFunc((ctx: any) => {
    ctx.beginPath()
    ctx.rect(0, 0, w, h)
  })
  node.getLayer()?.batchDraw()
}

watch(() => [props.element.width, props.element.height], applyClip)
onMounted(() => applyClip())

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
