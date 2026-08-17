<template>
  <v-group v-if="visible" :config="groupConfig" @click="onClick" @mousedown="onMouseDown" @dragstart="onDragStart" @dragend="onDragEnd" @transformend="onTransformEnd">
    <v-rect :config="borderConfig" />
    <v-text :config="labelConfig" />
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
  elementId: props.element.id
}))

const borderConfig = computed(() => ({
  width: props.element.width || 400,
  height: props.element.height || 300,
  fill: 'transparent',
  stroke: props.isSelected ? '#409EFF' : '#4a9',
  strokeWidth: 2,
  dash: [8, 4],
  cornerRadius: 4
}))

const labelConfig = computed(() => ({
  text: `${props.element.name || '容器'} (${(props.element.children || []).length}子元素)`,
  x: 8, y: (props.element.height || 300) - 24,
  fill: '#aaa', fontSize: 12
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
    width: Math.round((props.element.width || 400) * Math.abs(sx)),
    height: Math.round((props.element.height || 300) * Math.abs(sy))
  })
}
</script>
