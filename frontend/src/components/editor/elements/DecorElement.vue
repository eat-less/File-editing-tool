<template>
  <v-group v-if="visible" :config="groupConfig" @click="onClick" @tap="onClick" @mousedown="onMouseDown" @dragstart="onDragStart" @dragend="onDragEnd" @transformend="onTransformEnd">
    <component v-for="(p, i) in parts" :key="i" :is="nodeName(p.kind)" :config="p.config" />
    <v-rect :config="hitAreaConfig" />
  </v-group>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { decorToKonvaParts } from '@/utils/decorShapes'
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
  if (Date.now() - pressTime < 250) e.target.stopDrag()
}

const visible = computed(() => props.layer?.visible !== false)
const editorStore = useEditorStore()

const parts = computed(() => decorToKonvaParts(props.element as any))

// 装饰多为描边/镂空图形，需要一块透明命中区支撑选中与拖动
const hitAreaConfig = computed(() => ({
  x: 0, y: 0,
  width: props.element.width || 200,
  height: props.element.height || 100,
  fill: 'rgba(0,0,0,0.02)',
  listening: true,
}))

function nodeName(kind: string): string {
  return `v-${kind}`
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

function onDragEnd(e: any) {
  const node = e.target
  const x = Math.round(node.x())
  const y = Math.round(node.y())
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
    width: Math.round((props.element.width || 200) * Math.abs(sx)),
    height: Math.round((props.element.height || 100) * Math.abs(sy))
  })
}
</script>
