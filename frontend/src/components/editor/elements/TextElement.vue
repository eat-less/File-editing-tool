<template>
  <v-group ref="groupRef" v-if="visible" :config="groupConfig" @click="onClick" @tap="onClick" @mousedown="onMouseDown" @dragstart="onDragStart"
           @dblclick.stop="$emit('dblclick', $event)" @dragend="onDragEnd" @transformend="onTransformEnd">
    <v-text :config="textConfig" />
  </v-group>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import Konva from 'konva'
import { useEditorStore } from '@/stores/editor'
import { getTypewriterInterval, getEnterDuration } from '@/utils/appearEffect'
import { konvaFontStyle, wrapTextToString, measureStyleFromElement, wrapWidthOf } from '@/utils/textWrap'
import type { ElementItem, LayerItem } from '@/types'

const props = defineProps<{ element: ElementItem; layer: LayerItem; isSelected: boolean }>()
const emit = defineEmits(['select', 'dblclick'])

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

const visible = computed(() => props.layer?.visible !== false)

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

const groupRef = ref<any>(null)
const typedText = ref('')
let typeTimer: ReturnType<typeof setInterval> | null = null
let enterTween: any = null

const effect = computed(() => props.element.appearEffect || 'none')
const speed = computed(() => props.element.appearSpeed || 'normal')
const fullText = computed(() => {
  const c = props.element.content
  return typeof c === 'string' ? c : (c || '文字')
})
const displayText = computed(() => effect.value === 'typewriter' ? typedText.value : fullText.value)

// 与播放器共用同一套换行算法，保留空格并保证两端一致
const wrappedText = computed(() => wrapTextToString(
  displayText.value,
  wrapWidthOf(props.element),
  measureStyleFromElement(props.element)
))

function stopType() {
  if (typeTimer) { clearInterval(typeTimer); typeTimer = null }
}

function runTypewriter() {
  stopType()
  typedText.value = ''
  const t = fullText.value
  if (!t.length) return
  let i = 0
  typeTimer = setInterval(() => {
    i++
    typedText.value = t.slice(0, i)
    if (i >= t.length) stopType()
  }, getTypewriterInterval(speed.value))
}

function playEnterTween() {
  const node = groupRef.value?.getNode?.()
  if (!node) return
  const opacity = props.element.opacity ?? 1
  if (effect.value === 'fade') {
    node.opacity(0)
    enterTween = new Konva.Tween({ node, opacity, duration: getEnterDuration(speed.value) / 1000, easing: Konva.Easings.EaseOut })
    enterTween.play()
  } else if (effect.value === 'slide') {
    node.y(props.element.y + 40)
    enterTween = new Konva.Tween({ node, y: props.element.y, duration: getEnterDuration(speed.value) / 1000, easing: Konva.Easings.EaseOut })
    enterTween.play()
  }
}

function resetEffect() {
  stopType()
  if (enterTween) { enterTween.destroy(); enterTween = null }
  if (effect.value === 'typewriter') {
    runTypewriter()
    return
  }
  typedText.value = fullText.value
  nextTick(() => playEnterTween())
}

watch([fullText, effect, speed, () => props.element.id], resetEffect, { immediate: true })

onBeforeUnmount(() => {
  stopType()
  if (enterTween) { enterTween.destroy(); enterTween = null }
})

const textConfig = computed(() => {
  const ts = props.element.textStroke
  const hasOutline = ts && Number(ts.width) > 0 && ts.color
  const td = props.element.textShadow
  const hasShadow = td && Number(td.blur) > 0
  const cfg: any = {
    text: wrappedText.value,
    fontSize: props.element.fontSize || 32,
    fontFamily: props.element.fontFamily || 'Microsoft YaHei',
    fontStyle: konvaFontStyle(props.element),
    fill: props.element.color || '#ffffff',
    width: props.element.width || 500,
    height: props.element.height || 100,
    align: props.element.textAlign || 'center',
    verticalAlign: props.element.verticalAlign || 'middle',
    lineHeight: Number(props.element.lineHeight) || 1.5,
    letterSpacing: Number(props.element.letterSpacing) || 0,
    padding: Number(props.element.padding) || 0,
    wrap: 'none',
    ellipsis: false,
    stroke: hasOutline ? ts.color : (props.isSelected ? '#409EFF' : undefined),
    strokeWidth: hasOutline ? Number(ts.width) : (props.isSelected ? 1 : 0),
    strokeScaleEnabled: false,
    fillAfterStrokeEnabled: true,
  }
  if (hasShadow) {
    cfg.shadowColor = td.color
    cfg.shadowBlur = Number(td.blur)
    cfg.shadowOffsetX = td.offsetX || 0
    cfg.shadowOffsetY = td.offsetY || 0
  }
  return cfg
})

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
  const newWidth = Math.round((props.element.width || 500) * Math.abs(sx))
  editorStore.updateElement(props.element.id, {
    x: Math.round(node.x()),
    y: Math.round(node.y()),
    rotation: Math.round(node.rotation()),
    width: newWidth,
    height: Math.round((props.element.height || 100) * Math.abs(sy)),
    fontSize: Math.round((props.element.fontSize || 32) * Math.abs(sy)),
    textWrapWidth: newWidth,
  })
}
</script>
