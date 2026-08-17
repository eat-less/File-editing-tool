<template>
  <v-group v-if="visible" :config="groupConfig" @click="onClick" @tap="onClick" @mousedown="onMouseDown" @dragstart="onDragStart" @dragend="onDragEnd" @transformend="onTransformEnd">
    <v-rect :config="bgRectConfig" />
    <v-image v-if="posterImage" :config="posterConfig" />
    <v-circle :config="playBtnConfig" />
    <v-text :config="playIconConfig" />
    <v-text :config="labelConfig" />
    <v-rect :config="borderConfig" />
  </v-group>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  if (!props.isSelected && Date.now() - pressTime < 250) {
    e.target.stopDrag()
  }
}

const editorStore = useEditorStore()
const posterImage = ref<HTMLImageElement | null>(null)

watch(() => props.element.poster, (hash) => {
  if (!hash) { posterImage.value = null; return }
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = `/api/v1/assets/${hash}/file`
  img.onload = () => { posterImage.value = img }
  img.onerror = () => { posterImage.value = null }
}, { immediate: true })

const visible = computed(() => props.layer?.visible !== false)
const w = computed(() => props.element.width || 400)
const h = computed(() => props.element.height || 300)

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
  fill: props.element.src ? '#111' : '#1a1a2e',
  cornerRadius: 4
}))

const posterConfig = computed(() => ({
  x: 0, y: 0,
  width: w.value, height: h.value,
  image: posterImage.value,
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
  cornerRadius: 4,
  listening: false,
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
    width: Math.round((w.value) * Math.abs(sx)),
    height: Math.round((h.value) * Math.abs(sy))
  })
}
</script>
