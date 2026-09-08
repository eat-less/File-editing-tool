<template>
  <v-group v-if="visible" :config="groupConfig" @click="onClick" @tap="onClick" @mousedown="onMouseDown" @dragstart="onDragStart" @dragend="onDragEnd" @transformend="onTransformEnd">
    <v-circle v-if="backgroundShape === 'circle'" :config="circleConfig" />
    <v-rect v-else-if="backgroundShape === 'roundedRect'" :config="rectConfig" />
    <v-path :config="iconConfig" />
  </v-group>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { getIconPath } from '@/utils/icons'
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
const visible = computed(() => props.layer?.visible !== false)

const editorStore = useEditorStore()

const groupConfig = computed(() => ({
  x: props.element.x, y: props.element.y,
  rotation: props.element.rotation, opacity: props.element.opacity,
  draggable: !props.layer?.locked,
  elementId: props.element.id,
  globalCompositeOperation: props.layer.blendMode !== 'normal' ? props.layer.blendMode : undefined,
}))

const backgroundShape = computed(() => props.element.backgroundShape || 'circle')

const fillColor = computed(() => {
  const f = props.element.fill
  if (!f) return '#409EFF'
  if (typeof f === 'string') return f
  return f.color || '#409EFF'
})

const circleConfig = computed(() => ({
  x: (props.element.width || 120) / 2,
  y: (props.element.height || 120) / 2,
  radius: Math.min(props.element.width || 120, props.element.height || 120) / 2,
  fill: fillColor.value,
  stroke: (props.element.stroke as any)?.color || (props.isSelected ? '#409EFF' : '#000'),
  strokeWidth: (props.element.stroke as any)?.width || (props.isSelected ? 2 : 0),
}))

const rectConfig = computed(() => ({
  width: props.element.width || 120,
  height: props.element.height || 120,
  fill: fillColor.value,
  cornerRadius: props.element.cornerRadius ?? 8,
  stroke: (props.element.stroke as any)?.color || (props.isSelected ? '#409EFF' : '#000'),
  strokeWidth: (props.element.stroke as any)?.width || (props.isSelected ? 2 : 0),
}))

const iconConfig = computed(() => {
  const size = props.element.iconSize ?? 60
  const w = props.element.width || 120
  const h = props.element.height || 120
  const scale = size / 24
  return {
    data: getIconPath(props.element.icon || 'play'),
    x: (w - size) / 2,
    y: (h - size) / 2,
    scaleX: scale,
    scaleY: scale,
    fill: props.element.iconColor || '#ffffff',
    listening: false,
  }
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
  editorStore.updateElement(props.element.id, {
    x: Math.round(node.x()),
    y: Math.round(node.y()),
    rotation: Math.round(node.rotation()),
    width: Math.round((props.element.width || 120) * Math.abs(sx)),
    height: Math.round((props.element.height || 120) * Math.abs(sy))
  })
}
</script>
