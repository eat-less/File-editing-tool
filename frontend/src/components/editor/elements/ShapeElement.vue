<template>
  <v-group v-if="visible" :config="groupConfig" @click="onClick" @tap="onClick" @mousedown="onMouseDown" @dragstart="onDragStart" @dragend="onDragEnd" @transformend="onTransformEnd">
    <component :is="shapeComponent" :config="shapeConfig" />
  </v-group>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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
const visible = computed(() => props.layer?.visible !== false)

const editorStore = useEditorStore()

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

const shapeComponent = computed(() => {
  const type = props.element.shapeType || 'rectangle'
  const map: Record<string, string> = { rectangle: 'v-rect', circle: 'v-circle', line: 'v-line', arrow: 'v-line' }
  return map[type] || 'v-rect'
})

const fillObj = computed(() => {
  const f = props.element.fill || { type: 'solid', color: '#409EFF' }
  return f.type === 'linearGradient' ? f : f.color
})

const shapeConfig = computed(() => ({
  width: props.element.width || 200,
  height: props.element.height || 200,
  fill: fillObj.value,
  stroke: (props.element.stroke as any)?.color || props.isSelected ? '#409EFF' : '#000',
  strokeWidth: (props.element.stroke as any)?.width || (props.isSelected ? 2 : 0),
  cornerRadius: props.element.shapeType === 'rectangle' ? (props.element.borderRadius || 0) : undefined,
  radius: props.element.shapeType === 'circle' ? (props.element.width || 200) / 2 : undefined,
  points: props.element.points || [0, 0, 100, 100]
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
    width: Math.round((props.element.width || 200) * Math.abs(sx)),
    height: Math.round((props.element.height || 200) * Math.abs(sy))
  })
}
</script>
