<template>
  <v-group v-if="visible" :config="groupConfig" @click="onClick" @tap="onClick" @mousedown="onMouseDown" @dragstart="onDragStart" @dragend="onDragEnd" @transformend="onTransformEnd">
    <v-circle v-if="backgroundShape === 'circle'" :config="circleConfig" />
    <v-rect v-else-if="backgroundShape !== 'none'" :config="rectConfig" />
    <template v-if="hasIcon && contentLayout.hasLabel">
      <v-path :config="iconConfig" />
      <v-text :config="labelConfig" />
    </template>
    <v-path v-else-if="hasIcon" :config="iconConfig" />
    <v-text v-else :config="labelConfig" />
  </v-group>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { getIconPath } from '@/utils/icons'
import { konvaFillConfig, isGradient } from '@/utils/paint'
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

const groupConfig = computed(() => ({
  x: props.element.x, y: props.element.y,
  rotation: props.element.rotation, opacity: props.element.opacity,
  draggable: !props.layer?.locked,
  elementId: props.element.id,
  globalCompositeOperation: props.layer.blendMode !== 'normal' ? props.layer.blendMode : undefined,
}))

const W = computed(() => props.element.width || 120)
const H = computed(() => props.element.height || 120)
const backgroundShape = computed(() => props.element.backgroundShape || 'circle')

const fillColor = computed(() => {
  const f = props.element.fill
  if (!f) return '#409EFF'
  if (typeof f === 'string') return f === 'none' ? 'transparent' : f
  return (f as any).color || '#409EFF'
})

const selBorder = computed(() => {
  const st: any = props.element.stroke
  if (st && Number(st.width) > 0) return { color: st.color || '#409EFF', width: Number(st.width), custom: true }
  return { color: '#409EFF', width: 1.5, custom: false }
})

const shadowConfig = computed(() => {
  const s: any = props.element.shadow
  if (!s) return {}
  return {
    shadowColor: s.color || '#000',
    shadowBlur: Number(s.blur) || 0,
    shadowOffsetX: s.offsetX || 0,
    shadowOffsetY: s.offsetY || 0,
  }
})

function baseShapeProps() {
  const isSelected = props.isSelected
  const sel = selBorder.value
  const st: any = props.element.stroke
  const useDash = st && !isSelected && st.style === 'dash' && sel.custom
  return {
    ...shadowConfig.value,
    strokeScaleEnabled: false,
    dash: useDash ? [6, 4] : undefined,
    stroke: sel.custom ? sel.color : (isSelected ? sel.color : undefined),
    strokeWidth: sel.custom ? sel.width : (isSelected ? sel.width : 0),
  }
}

const circleConfig = computed(() => ({
  x: W.value / 2,
  y: H.value / 2,
  radius: Math.min(W.value, H.value) / 2,
  ...konvaFillConfig(props.element.fill, W.value, H.value, '#409EFF'),
  ...baseShapeProps(),
}))

const rectConfig = computed(() => {
  const shape = backgroundShape.value
  const half = Math.min(W.value, H.value) / 2
  let radius = shape === 'pill' ? H.value / 2 : shape === 'roundedRect' ? (props.element.cornerRadius ?? 8) : 0
  // Konva 圆角半径不能超过短边一半，否则路径非法会整块画不出来
  radius = Math.max(0, Math.min(radius, half))
  return {
    x: 0, y: 0,
    width: W.value, height: H.value,
    cornerRadius: radius,
    ...konvaFillConfig(props.element.fill, W.value, H.value, '#409EFF'),
    ...baseShapeProps(),
  }
})

const gap = computed(() => Number(props.element.labelGap) || 10)
const hasIcon = computed(() => !!props.element.icon && props.element.icon !== 'none')
const labelText = computed(() => (typeof props.element.label === 'string' ? props.element.label : ''))
const labelColor = computed(() => props.element.labelColor || '#ffffff')
const layout = computed<'row' | 'column'>(() => props.element.layout === 'column' ? 'column' : 'row')

function approxTextWidth(text: string, size: number): number {
  let w = 0
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    w += code > 0x2e7f ? size : size * 0.58
  }
  return w
}

const contentLayout = computed(() => {
  const w = W.value
  const h = H.value
  const hasLabel = labelText.value.length > 0
  const iconSize = Math.min(Number(props.element.iconSize) || 60, Math.min(w, h) - 4)
  const labelSize = Math.min(Number(props.element.labelSize) || (h * 0.4), h * 0.6)
  const labelW = approxTextWidth(labelText.value, labelSize)
  const lay = layout.value

  // 无图标:文字居中
  if (!hasIcon.value) {
    const effLS = Math.max(8, Math.min(Number(props.element.labelSize) || h * 0.4, h * 0.8))
    const effLabelW = approxTextWidth(labelText.value, effLS)
    return {
      hasLabel, layout: lay, hasIcon: false, effS: 0, effLS,
      iconX: 0, iconY: 0,
      textX: (w - effLabelW) / 2,
      textY: (h - effLS * 1.2) / 2,
      effLabelW,
    }
  }

  let scaleF = 1
  if (lay === 'row') {
    const need = iconSize + (hasLabel ? gap.value + labelW : 0)
    if (hasLabel && need > w) scaleF = Math.max(0.4, (w - 2) / need)
  } else if (hasLabel) {
    const need = iconSize + gap.value * 2 + labelSize * 1.3
    if (need > h) scaleF = Math.max(0.4, (h - 2) / need)
  }
  const effS = Math.max(8, iconSize * scaleF)
  const effLS = Math.max(8, labelSize * scaleF)
  const effGap = gap.value * scaleF
  const effLabelW = approxTextWidth(labelText.value, effLS)

  let iconX = 0
  let iconY = 0
  let textX = 0
  let textY = 0

  if (!hasLabel) {
    iconX = (w - effS) / 2
    iconY = (h - effS) / 2
  } else if (lay === 'row') {
    const blockW = effS + effGap + effLabelW
    let startX = (w - blockW) / 2
    if (startX < 2) startX = 2
    iconX = startX
    iconY = (h - effS) / 2
    textX = startX + effS + effGap
    const th = effLS * 1.2
    textY = (h - th) / 2
  } else {
    const blockH = effS + effGap + effLS * 1.3
    let startY = (h - blockH) / 2
    if (startY < 2) startY = 2
    iconX = (w - effS) / 2
    iconY = startY
    textX = (w - effLabelW) / 2
    textY = startY + effS + effGap
  }

  return {
    hasLabel, layout: lay, hasIcon: true, effS, effLS, iconX, iconY, textX, textY, effLabelW,
  }
})

const iconConfig = computed(() => {
  const c = contentLayout.value
  return {
    data: getIconPath(props.element.icon || 'play'),
    x: c.iconX,
    y: c.iconY,
    scaleX: c.effS / 24,
    scaleY: c.effS / 24,
    fill: props.element.iconColor || '#ffffff',
    listening: false,
  }
})

const labelConfig = computed(() => {
  const c = contentLayout.value
  const fontFamily = props.element.fontFamily || 'Microsoft YaHei'
  return {
    text: labelText.value,
    x: c.textX,
    y: c.textY,
    fontSize: c.effLS,
    fontFamily,
    fill: labelColor.value,
    listening: false,
  }
})

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
    width: Math.round((props.element.width || 120) * Math.abs(sx)),
    height: Math.round((props.element.height || 120) * Math.abs(sy))
  })
}
</script>
