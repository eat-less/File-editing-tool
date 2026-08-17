<template>
  <div ref="stageContainer" class="stage-container" @wheel="onWheel" @mousedown="onPanStart" @mousemove="onPanMove" @mouseup="onPanEnd" @dragover.prevent @drop="onDrop">
    <video v-if="bgVideoSrc" :src="bgVideoSrc" autoplay loop muted
           :style="bgVideoStyle" ref="bgVideoRef" />
    <video v-for="vel in videoElements" :key="vel.id"
           :ref="(el: any) => registerVideoEl(vel.id, el)"
           :src="`/api/v1/assets/${vel.src}/file`"
           :style="getVideoOverlayStyle(vel)"
           autoplay :loop="vel.loop !== false" muted />
    <v-stage ref="stageRef" :config="stageConfig" @click="onStageClick">
      <v-layer>
        <v-rect :config="bgConfig" />
        <v-image v-if="bgImageConfig" :config="bgImageConfig" />
      </v-layer>
      <v-layer v-for="page in pages" :key="page.id" :visible="page.id === currentPage?.id">
        <template v-for="layer in page.layers" :key="layer.id">
          <component
            v-if="layer.visible"
            :is="getElementComponent(layer.element.type)"
            :element="layer.element"
            :layer="layer"
            :is-selected="selectedIds.has(layer.element.id)"
            @select="onSelectElement(layer.element.id, $event)"
          />
        </template>
        <v-transformer ref="transformerRef" :config="transformerConfig" />
      </v-layer>
    </v-stage>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import Konva from 'konva'
import { useEditorStore } from '@/stores/editor'
import TextElement from './elements/TextElement.vue'
import ImageElement from './elements/ImageElement.vue'
import VideoElement from './elements/VideoElement.vue'
import ShapeElement from './elements/ShapeElement.vue'
import ContainerElement from './elements/ContainerElement.vue'
import SequenceFrameElement from './elements/SequenceFrameElement.vue'
import ButtonElement from './elements/ButtonElement.vue'
import { isCrossDevice, resolvePageIndex } from '@/utils/hotspotAction'

const editorStore = useEditorStore()
const stageContainer = ref<HTMLElement>()
const stageRef = ref()
const transformerRef = ref()
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })

const pages = computed(() => editorStore.pages)
const currentPage = computed(() => editorStore.currentPage)
const selectedIds = computed(() => new Set(editorStore.selectedLayerIds))

const stageConfig = computed(() => ({
  width: stageContainer.value?.clientWidth || 800,
  height: stageContainer.value?.clientHeight || 600,
  scaleX: editorStore.zoom,
  scaleY: editorStore.zoom,
  x: editorStore.panX,
  y: editorStore.panY,
  draggable: false
}))

const bgImageLoaded = ref<HTMLImageElement | null>(null)
const bgVideoRef = ref<HTMLVideoElement>()

const videoElements = computed(() => {
  const page = editorStore.currentPage
  if (!page) return []
  return page.layers
    .filter(l => l.visible && l.element.type === 'video' && l.element.src)
    .map(l => l.element)
})

const videoElRefs = new Map<string, HTMLVideoElement>()

function registerVideoEl(id: string, el: any) {
  if (el) {
    videoElRefs.set(id, el)
    el.play().catch(() => {})
  }
}

function getVideoOverlayStyle(el: any) {
  const zoom = editorStore.zoom
  const panX = editorStore.panX
  const panY = editorStore.panY
  return {
    position: 'absolute' as const,
    left: `${el.x * zoom + panX}px`,
    top: `${el.y * zoom + panY}px`,
    width: `${el.width * zoom}px`,
    height: `${el.height * zoom}px`,
    objectFit: (el.objectFit || 'cover') as any,
    pointerEvents: 'none' as any,
    opacity: el.opacity ?? 1,
    borderRadius: `${el.borderRadius || 0}px`,
    transform: `rotate(${el.rotation || 0}deg)`,
    transformOrigin: 'top left',
  }
}

const bgVideoSrc = computed(() => {
  const bg = currentPage.value?.background
  if (bg?.type === 'video' && bg.assetHash) return `/api/v1/assets/${bg.assetHash}/file`
  return null
})

const bgFilterStyle = computed(() => {
  const bg = currentPage.value?.background
  if (!bg || bg.type === 'none') return {}
  const filters: string[] = []
  if (bg.opacity !== undefined && bg.opacity < 1) filters.push(`opacity(${bg.opacity})`)
  if (bg.brightness !== undefined && bg.brightness !== 100) filters.push(`brightness(${bg.brightness}%)`)
  if (bg.blur && bg.blur > 0) filters.push(`blur(${bg.blur}px)`)
  return filters.length ? { filter: filters.join(' ') } : {}
})

const bgVideoStyle = computed(() => ({
  position: 'absolute' as const,
  left: `${editorStore.panX}px`,
  top: `${editorStore.panY}px`,
  width: `${editorStore.device.designWidth * editorStore.zoom}px`,
  height: `${editorStore.device.designHeight * editorStore.zoom}px`,
  objectFit: (currentPage.value?.background?.objectFit || 'cover') as any,
  pointerEvents: 'none' as any,
  ...bgFilterStyle.value,
}))

watch(() => currentPage.value?.background?.assetHash, (hash) => {
  if (!hash) {
    bgImageLoaded.value = null
    return
  }
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = `/api/v1/assets/${hash}/file`
  img.onload = () => { bgImageLoaded.value = img }
  img.onerror = () => { bgImageLoaded.value = null }
}, { immediate: true })

const bgConfig = computed(() => {
  const base: any = {
    x: 0, y: 0,
    width: editorStore.device.designWidth,
    height: editorStore.device.designHeight,
    fill: currentPage.value?.background?.backgroundColor || '#000000',
    listening: false,
    opacity: currentPage.value?.background?.opacity ?? 1,
  }
  if (currentPage.value?.background?.blur) {
    base.filters = [Konva.Filters.Blur]
    base.blurRadius = currentPage.value.background.blur
  }
  return base
})

const bgImageConfig = computed(() => {
  if (!bgImageLoaded.value) return null
  const bg = currentPage.value?.background
  if (bg?.type !== 'image') return null
  const config: any = {
    x: 0, y: 0,
    width: editorStore.device.designWidth,
    height: editorStore.device.designHeight,
    image: bgImageLoaded.value,
    listening: false,
    opacity: bg.opacity ?? 1,
  }
  if (bg.blur && bg.blur > 0) {
    config.filters = [Konva.Filters.Blur]
    config.blurRadius = bg.blur
  }
  return config
})

const transformerConfig = ref({
  centeredScaling: true,
  enabledAnchors: ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'],
  rotateEnabled: true,
  boundBoxFunc: (oldBox: any, newBox: any) => {
    if (newBox.width < 5 || newBox.height < 5) return oldBox
    return newBox
  },
})

watch(() => editorStore.selectedLayerIds, () => {
  const stage = stageRef.value?.getStage()
  if (!stage) return
  const pageIdx = editorStore.currentPageIndex + 1
  const layer = stage.children?.[pageIdx]
  const tr = layer?.children?.find((c: any) => c.className === 'Transformer')
  const nodes: any[] = []
  editorStore.selectedLayerIds.forEach(id => {
    const node = layer?.children?.find((c: any) => c.attrs?.elementId === id)
    if (node) nodes.push(node)
  })
  if (tr && nodes.length > 0) {
    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }
})

function getElementComponent(type: string) {
  const map: Record<string, any> = {
    text: TextElement, image: ImageElement, video: VideoElement,
    shape: ShapeElement, container: ContainerElement,
    sequenceFrame: SequenceFrameElement, button: ButtonElement
  }
  return map[type] || TextElement
}

function onSelectElement(id: string, e: Event) {
  const multi = (e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey
  editorStore.selectLayer(id, multi)
}

function onStageClick(e: any) {
  if (e.target === e.target.getStage()) {
    editorStore.clearSelection()
    return
  }
  const node = e.target
  const elId = node.attrs?.elementId || node.parent?.attrs?.elementId
  if (elId) {
    const page = editorStore.currentPage
    if (page) {
      const layer = page.layers.find(l => l.element.id === elId)
      if (layer?.hotspot?.enabled && layer.hotspot.trigger === 'click') {
        if (isCrossDevice(layer.hotspot)) return
        const idx = resolvePageIndex(layer.hotspot, editorStore.pages, editorStore.currentPageIndex)
        if (idx !== editorStore.currentPageIndex) editorStore.setCurrentPage(idx)
      }
    }
  }
}

function onWheel(e: WheelEvent) {
  if (e.ctrlKey) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const rect = stageContainer.value!.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const oldZoom = editorStore.zoom
    const newZoom = Math.max(0.1, Math.min(3, oldZoom * delta))
    const scale = newZoom / oldZoom
    editorStore.setZoom(newZoom)
    editorStore.setPan(
      mouseX - (mouseX - editorStore.panX) * scale,
      mouseY - (mouseY - editorStore.panY) * scale
    )
  }
}

function onPanStart(e: MouseEvent) {
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    isPanning.value = true
    panStart.value = { x: e.clientX - editorStore.panX, y: e.clientY - editorStore.panY }
  }
}

function onPanMove(e: MouseEvent) {
  if (isPanning.value) {
    editorStore.setPan(e.clientX - panStart.value.x, e.clientY - panStart.value.y)
  }
}

function onPanEnd() { isPanning.value = false }

function onDrop(e: DragEvent) {
  e.preventDefault()
  const data = e.dataTransfer?.getData('application/json')
  if (!data) return
  try {
    const asset = JSON.parse(data)
    if (!asset.hash_key && !asset.type) return
    const rect = stageContainer.value?.getBoundingClientRect()
    if (!rect) return
    const x = Math.round((e.clientX - rect.left - editorStore.panX) / editorStore.zoom)
    const y = Math.round((e.clientY - rect.top - editorStore.panY) / editorStore.zoom)
    editorStore.addElementForAsset(asset, x, y)
  } catch {}
}

function playEntryAnimations() {
  nextTick(() => {
    const stage = stageRef.value?.getStage()
    if (!stage) return
    const page = editorStore.currentPage
    if (!page) return

    for (const layer of page.layers) {
      if (!layer.animations?.length) continue
      const node = stage.findOne((n: any) => n.attrs?.elementId === layer.element.id)
      if (!node) continue

      for (const anim of layer.animations) {
        if (anim.direction !== 'in') continue
        const animationDefaults: Record<string, any> = {
          fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
          fadeOut: { from: { opacity: 1 }, to: { opacity: 0 } },
          slideIn: { from: { x: -200 }, to: { x: 0 } },
          slideUp: { from: { y: 50, opacity: 0 }, to: { y: 0, opacity: 1 } },
          zoomIn: { from: { scaleX: 0.3, scaleY: 0.3, opacity: 0 }, to: { scaleX: 1, scaleY: 1, opacity: 1 } },
          rotate: { from: { rotation: -10, opacity: 0 }, to: { rotation: 0, opacity: 1 } },
        }

        if (anim.type === 'move' && layer.element.type === 'sequenceFrame') {
          const seqDur = calcSeqFirstSourceDuration(layer.element)
          if (seqDur > 0) {
            const node2 = node
            const p = anim.params || {}
            if (p.from?.x !== undefined && p.from?.y !== undefined) {
              node2.x(p.from.x)
              node2.y(p.from.y)
            }
            const tc: any = { node: node2, duration: seqDur, easing: Konva.Easings.Linear }
            if (p.to?.x !== undefined) tc.x = p.to.x
            if (p.to?.y !== undefined) tc.y = p.to.y
            setTimeout(() => new Konva.Tween(tc).play(), anim.delay || 0)
          }
          continue
        }

        let tweenDuration = (anim.duration || 1000) / 1000
        const tweenConfig: any = { node, duration: tweenDuration }
        const easingMap: Record<string, any> = {
          'linear': Konva.Easings.Linear, 'easeIn': Konva.Easings.EaseIn,
          'easeOut': Konva.Easings.EaseOut, 'easeInOut': Konva.Easings.EaseInOut,
        }
        tweenConfig.easing = easingMap[anim.easing] || Konva.Easings.EaseOut

        if (anim.type === 'move' && anim.params) {
          const p = anim.params
          if (p.from?.x !== undefined && p.from?.y !== undefined) {
            node.x(p.from.x)
            node.y(p.from.y)
          }
          if (p.to?.x !== undefined) tweenConfig.x = p.to.x
          if (p.to?.y !== undefined) tweenConfig.y = p.to.y
        } else {
          const def = animationDefaults[anim.type]
          if (!def && !anim.params) continue

          if (def) {
            if (def.from.opacity !== undefined) node.opacity(def.from.opacity)
            if (def.from.x !== undefined) node.x(node.x() + def.from.x)
            if (def.from.y !== undefined) node.y(node.y() + def.from.y)
            if (def.from.scaleX !== undefined) { node.scaleX(def.from.scaleX); node.scaleY(def.from.scaleY || def.from.scaleX) }
            Object.assign(tweenConfig, { x: node.x() - (def.from.x || 0), y: node.y() - (def.from.y || 0), scaleX: 1, scaleY: 1, opacity: 1 })
          }

          if (anim.params) {
            const p = anim.params
            if (p.from?.opacity !== undefined) node.opacity(p.from.opacity)
            Object.assign(tweenConfig, p.to || {})
          }
        }

        setTimeout(() => new Konva.Tween(tweenConfig).play(), anim.delay || 0)
      }
    }
  })
}

function calcSeqFirstSourceDuration(el: any): number {
  const sources = el.seqSources || (el.source?.frames?.length ? [el.source] : [])
  if (!sources.length) return 0
  const fps = el.frameRate || 30
  const first = sources[0]
  const frames = first.frames?.length || first.frameCount || 0
  const loop = first.loopCount || 1
  return (frames / fps) * (loop === -1 ? 1 : loop)
}

watch(() => editorStore.currentPageIndex, () => {
  playEntryAnimations()
})

watch(() => editorStore.pages, () => {
  nextTick(() => playEntryAnimations())
})
</script>

<style scoped>
.stage-container { width: 100%; height: 100%; overflow: hidden; background: #e8e8e8; position: relative; }
.stage-container canvas { background: transparent !important; }
</style>
