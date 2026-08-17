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
  if (!props.isSelected && Date.now() - pressTime < 250) {
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

const textConfig = computed(() => ({
  text: displayText.value,
  fontSize: props.element.fontSize || 32,
  fontFamily: props.element.fontFamily || 'Microsoft YaHei',
  fontStyle: props.element.fontStyle || 'normal',
  fill: props.element.color || '#ffffff',
  width: props.element.width || 500,
  height: props.element.height || 100,
  align: props.element.textAlign || 'center',
  verticalAlign: props.element.verticalAlign || 'middle',
  wrap: 'none',
  ellipsis: true,
  stroke: props.isSelected ? '#409EFF' : undefined,
  strokeWidth: props.isSelected ? 1 : 0
}))

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
    width: Math.round((props.element.width || 500) * Math.abs(sx)),
    height: Math.round((props.element.height || 100) * Math.abs(sy)),
    fontSize: Math.round((props.element.fontSize || 32) * Math.abs(sy)),
  })
}
</script>
