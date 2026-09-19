<template>
  <div ref="stageContainer" class="stage-container" @wheel="onWheel" @mousedown="onPanStart" @mousemove="onPanMove" @mouseup="onPanEnd" @dragover.prevent @drop="onDrop">
    <video v-if="bgVideoSrc" :src="bgVideoSrc" autoplay loop muted
           :style="bgVideoStyle" ref="bgVideoRef" />
    <div v-if="marquee.active" class="marquee-box" :style="marqueeStyle" />
    <div class="stage-layer">
      <v-stage ref="stageRef" :config="stageConfig" @click="onStageClick"
               @mousedown="onStageMouseDown" @mousemove="onStageMouseMove" @mouseup="onStageMouseUp">
        <v-layer>
          <v-rect :config="bgConfig" />
          <v-image v-if="bgImageConfig" :config="bgImageConfig" />
        </v-layer>
        <v-layer v-for="page in pages" :key="page.id" :visible="page.id === currentPage?.id">
          <template v-for="layer in page.layers" :key="layer.id">
            <component
              v-if="layer.visible"
              :key="layer.element.id"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import Konva from 'konva'
import { useEditorStore } from '@/stores/editor'
import TextElement from './elements/TextElement.vue'
import ImageElement from './elements/ImageElement.vue'
import VideoElement from './elements/VideoElement.vue'
import ShapeElement from './elements/ShapeElement.vue'
import ContainerElement from './elements/ContainerElement.vue'
import SequenceFrameElement from './elements/SequenceFrameElement.vue'
import ButtonElement from './elements/ButtonElement.vue'
import DecorElement from './elements/DecorElement.vue'
import { normalizeSegments, hasSegmentMove } from '@/render-engine/seqChoreography'
import { konvaFillConfig } from '@/utils/paint'

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
  zIndex: 0,
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
  const bg = currentPage.value?.background
  if (bg?.type === 'gradient' && bg.gradient) {
    Object.assign(base, konvaFillConfig(
      { type: 'linearGradient', angle: bg.gradient.angle, stops: bg.gradient.stops },
      editorStore.device.designWidth, editorStore.device.designHeight, '#000000'
    ))
  }
  if (bg?.blur) {
    base.filters = [Konva.Filters.Blur]
    base.blurRadius = bg.blur
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
    sequenceFrame: SequenceFrameElement, button: ButtonElement, decor: DecorElement
  }
  return map[type] || TextElement
}

function onSelectElement(id: string, e: Event) {
  // 框选结束后浏览器仍会补发一次 click(可能落在元素上)，此处忽略避免覆盖框选结果
  if (suppressNextStageClick) {
    suppressNextStageClick = false
    return
  }
  const me = e as MouseEvent
  const ctrl = me.ctrlKey || me.metaKey
  const shift = me.shiftKey
  const multi = ctrl || shift
  // Shift 只加选不反选；Ctrl/Cmd 保持 toggle
  editorStore.selectLayer(id, multi, shift && !ctrl)
}

function onStageClick(e: any) {
  if (suppressNextStageClick) {
    suppressNextStageClick = false
    return
  }
  // 编辑器点击只负责选中与清空，绝不触发元素的播放端功能动作（翻页/播放等）
  if (e.target === e.target.getStage()) {
    editorStore.clearSelection()
  }
}

// ---- 空白处拖拽框选(marquee) ----
const marquee = ref({ active: false, startX: 0, startY: 0, curX: 0, curY: 0 })
let marqueeCandidate = false
let marqueeAdditive = false
let suppressNextStageClick = false

const marqueeStyle = computed(() => {
  const x = Math.min(marquee.value.startX, marquee.value.curX)
  const y = Math.min(marquee.value.startY, marquee.value.curY)
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${Math.abs(marquee.value.curX - marquee.value.startX)}px`,
    height: `${Math.abs(marquee.value.curY - marquee.value.startY)}px`,
  }
})

function pointerToContainer(e: any) {
  const rect = stageContainer.value?.getBoundingClientRect()
  if (!rect || !e?.evt) return null
  return { x: e.evt.clientX - rect.left, y: e.evt.clientY - rect.top }
}

function onStageMouseDown(e: any) {
  const stage = e.target?.getStage?.()
  if (!stage) return
  if (e.evt?.button !== 0 || e.evt?.altKey) return
  if (e.target !== stage) return
  const pos = pointerToContainer(e)
  if (!pos) return
  marqueeCandidate = true
  marqueeAdditive = !!e.evt?.shiftKey
  marquee.value = { active: false, startX: pos.x, startY: pos.y, curX: pos.x, curY: pos.y }
}

function onStageMouseMove(e: any) {
  if (!marqueeCandidate) return
  const pos = pointerToContainer(e)
  if (!pos) return
  if (!marquee.value.active) {
    if (Math.abs(pos.x - marquee.value.startX) < 4 && Math.abs(pos.y - marquee.value.startY) < 4) return
    marquee.value.active = true
  }
  marquee.value.curX = pos.x
  marquee.value.curY = pos.y
}

function onStageMouseUp() {
  if (!marqueeCandidate) return
  marqueeCandidate = false
  if (!marquee.value.active) return
  const stage = stageRef.value?.getStage()
  marquee.value.active = false
  suppressNextStageClick = true
  if (!stage) return
  const rect = {
    x: Math.min(marquee.value.startX, marquee.value.curX),
    y: Math.min(marquee.value.startY, marquee.value.curY),
    w: Math.abs(marquee.value.curX - marquee.value.startX),
    h: Math.abs(marquee.value.curY - marquee.value.startY),
  }
  const pageIdx = editorStore.currentPageIndex + 1
  const layer = stage.children?.[pageIdx]
  if (!layer) return
  const ids: string[] = []
  layer.children?.forEach((node: any) => {
    const id = node.attrs?.elementId
    if (!id) return
    const l = editorStore.currentPage?.layers.find(x => x.element.id === id)
    if (!l || l.visible === false) return
    let box: any
    try { box = node.getClientRect() } catch { return }
    if (!box) return
    const intersects = box.x < rect.x + rect.w && box.x + box.width > rect.x &&
                       box.y < rect.y + rect.h && box.y + box.height > rect.y
    if (intersects) ids.push(id)
  })
  if (marqueeAdditive) editorStore.addToSelection(ids)
  else editorStore.setSelection(ids)
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
      const rect = stageContainer.value?.getBoundingClientRect()
      if (!rect) return
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const x = Math.round((px - editorStore.panX) / editorStore.zoom)
      const y = Math.round((py - editorStore.panY) / editorStore.zoom)
      if (asset.type === 'decor' && asset.decorId) {
        editorStore.addDecorLayerAt(asset.decorId, x, y)
        return
      }
      if (!asset.hash_key && !asset.type) return
      // 用 Konva 实际命中检测确定鼠标落在哪个元素上(能正确反映放大/缩小/旋转后的可见区域),
      // 供“拖素材到已有同类元素上追加到列表”使用
      let hitElementId = ''
      try {
        const stage = stageRef.value?.getStage()
        const hit = stage?.getIntersection({ x: px, y: py })
        let node: any = hit
        while (node && !node.attrs?.elementId) node = node.getParent?.()
        if (node?.attrs?.elementId) hitElementId = node.attrs.elementId
      } catch {}
      editorStore.addElementForAsset(asset, x, y, hitElementId)
    } catch {}
}

// ---- 容器分组拖动:拖容器时带动其成员一起移动(仅视觉实时,结束时一次性写回) ----
const groupDragState: Record<string, { baseX: number; baseY: number; starts: Array<{ id: string; x: number; y: number }> }> = {}

function findPageNode(stage: any, elementId: string) {
  const pageIdx = editorStore.currentPageIndex + 1
  const layer = stage?.children?.[pageIdx]
  return layer?.children?.find((c: any) => c.attrs?.elementId === elementId)
}

function onGroupDragStart(e: any) {
  const node = e.target
  const cId = node?.attrs?.elementId
  if (!cId) return
  const cl = editorStore.currentPage?.layers.find(l => l.element.id === cId)
  if (cl?.element.type !== 'container') return
  const members: string[] = cl.element.members || []
  if (!members.length) return
  // 拖动分组框即整体移动成员;顺带选中该分组,保证首次拖动(未预先选中)也生效
  editorStore.setSelection([cId])
  const stage = stageRef.value?.getStage()
  const starts: Array<{ id: string; x: number; y: number }> = []
  members.forEach(id => {
    const n = findPageNode(stage, id)
    if (n) starts.push({ id, x: n.x(), y: n.y() })
  })
  if (!starts.length) return
  groupDragState[cId] = { baseX: node.x(), baseY: node.y(), starts }
}

function onGroupDragMove(e: any) {
  const node = e.target
  const st = groupDragState[node?.attrs?.elementId]
  if (!st) return
  const dx = node.x() - st.baseX
  const dy = node.y() - st.baseY
  const stage = stageRef.value?.getStage()
  const pageIdx = editorStore.currentPageIndex + 1
  const layer = stage?.children?.[pageIdx]
  let dirty = false
  st.starts.forEach(s => {
    const n = layer?.children?.find((c: any) => c.attrs?.elementId === s.id)
    if (n && (n.x() !== s.x + dx || n.y() !== s.y + dy)) {
      n.position({ x: s.x + dx, y: s.y + dy })
      dirty = true
    }
  })
  if (dirty) layer?.batchDraw()
}

function onGroupDragEnd(e: any) {
  const node = e.target
  const cId = node?.attrs?.elementId
  const st = groupDragState[cId]
  if (!st) return
  delete groupDragState[cId]
  const dx = Math.round(node.x() - st.baseX)
  const dy = Math.round(node.y() - st.baseY)
  if (dx || dy) editorStore.translateGroupMembers(cId, dx, dy)
}

function attachGroupDragListeners() {
  const stage = stageRef.value?.getStage()
  if (!stage) return
  stage.on('dragstart', onGroupDragStart)
  stage.on('dragmove', onGroupDragMove)
  stage.on('dragend', onGroupDragEnd)
}

function detachGroupDragListeners() {
  const stage = stageRef.value?.getStage()
  if (!stage) return
  stage.off('dragstart', onGroupDragStart)
  stage.off('dragmove', onGroupDragMove)
  stage.off('dragend', onGroupDragEnd)
}

// 让 Konva 子节点顺序与图层数组顺序一致（预览/DOM 会自动按数组重排，Konva 不会）
function syncElementOrder() {
  const stage = stageRef.value?.getStage()
  const page = editorStore.currentPage
  if (!stage || !page) return
  const layer = stage.children?.[editorStore.currentPageIndex + 1]
  if (!layer) return
  const nodes: any[] = []
  for (const l of page.layers) {
    const node = layer.children?.find((c: any) => c.attrs?.elementId === l.element.id)
    if (node) nodes.push(node)
  }
  nodes.forEach((n, i) => { if (n.zIndex() !== i) n.zIndex(i) })
  const tr = layer.children?.find((c: any) => c.className === 'Transformer')
  if (tr) tr.moveToTop()
  layer.batchDraw()
}

onMounted(() => {
  nextTick(attachGroupDragListeners)
  nextTick(syncElementOrder)
  window.addEventListener('mouseup', onStageMouseUp)
})
onBeforeUnmount(() => {
  detachGroupDragListeners()
  window.removeEventListener('mouseup', onStageMouseUp)
})



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
          // 含段位移的序列帧由播放器段编排驱动，编辑器画布不预览位移
          if (hasSegmentMove(normalizeSegments(layer.element as any))) continue
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

// 图层增删/重排/切页后同步 Konva 层序
watch(
  () => editorStore.currentPage?.layers.map(l => l.id).join('|'),
  () => nextTick(syncElementOrder),
  { immediate: true }
)
watch(() => editorStore.currentPageIndex, () => nextTick(syncElementOrder))
</script>

<style scoped>
.stage-container { width: 100%; height: 100%; overflow: hidden; background: #e8e8e8; position: relative; }
.stage-layer { position: absolute; inset: 0; z-index: 1; }
.stage-container canvas { background: transparent !important; }
.marquee-box { position: absolute; z-index: 2; pointer-events: none; border: 1px dashed #409eff; background: rgba(64, 158, 255, 0.12); }
</style>
