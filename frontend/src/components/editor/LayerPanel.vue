<template>
  <div class="layer-panel">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px">
      <span style="color:#606266">图层 ({{ layers.length }})</span>
      <el-button size="small" v-if="editorStore.selectedLayers.length > 1" @click="editorStore.clearSelection()">取消多选</el-button>
    </div>
    <div v-if="!layers.length" class="empty-hint">暂无图层</div>
    <div
      v-for="(layer, vidx) in reversedLayers"
      :key="layer.element.id"
      class="layer-item"
      :class="{ selected: isSelected(layer.element.id), locked: layer.locked, 'drag-over': dragOverIdx === vidx }"
      @click="editorStore.selectLayer(layer.element.id, $event.ctrlKey)"
      @dragover.prevent="onDragOver(vidx)"
      @dragleave="onDragLeave"
      @drop="onDrop(vidx, layer)"
    >
      <span
        draggable="true"
        class="drag-handle"
        @dragstart="onDragStart(vidx, $event)"
        @dragend="onDragEnd"
      >⠿</span>
      <el-icon v-if="layer.locked" style="color:#e6a23c;margin-right:4px"><Lock /></el-icon>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ layer.name || layer.element.type }}</span>
      <el-button link size="small" @click.stop="editorStore.setLayerVisibility(layer.element.id, !layer.visible)">
        <el-icon><component :is="layer.visible ? 'View' : 'Hide'" /></el-icon>
      </el-button>
      <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, layer)">
        <el-button link size="small">···</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="up">上移</el-dropdown-item>
            <el-dropdown-item command="down">下移</el-dropdown-item>
            <el-dropdown-item command="top">置顶</el-dropdown-item>
            <el-dropdown-item command="bottom">置底</el-dropdown-item>
            <el-dropdown-item command="copy" divided>复制</el-dropdown-item>
            <el-dropdown-item command="delete">删除</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorStore } from '@/stores/editor'

const editorStore = useEditorStore()
const layers = computed(() => editorStore.currentLayers || [])
const reversedLayers = computed(() => [...layers.value].reverse())

const dragIdx = ref(-1)
const dragOverIdx = ref(-1)

function vizToActual(vidx: number): number {
  return layers.value.length - 1 - vidx
}

function isSelected(id: string) { return editorStore.selectedLayerIds.includes(id) }

function onDragStart(vidx: number, e: DragEvent) {
  dragIdx.value = vidx
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
  }
}

function onDragOver(vidx: number) {
  dragOverIdx.value = vidx
}

function onDragLeave() {
  dragOverIdx.value = -1
}

function onDrop(vidx: number, _layer: any) {
  dragOverIdx.value = -1
  if (dragIdx.value < 0 || dragIdx.value === vidx) return
  const actualFrom = vizToActual(dragIdx.value)
  const actualTo = vizToActual(vidx)
  editorStore.reorderLayer(actualFrom, actualTo)
}

function onDragEnd() {
  dragIdx.value = -1
  dragOverIdx.value = -1
}

function handleCommand(cmd: string, layer: any) {
  const id = layer.element.id
  if (cmd === 'up') editorStore.moveLayerUp(id)
  if (cmd === 'down') editorStore.moveLayerDown(id)
  if (cmd === 'top') editorStore.moveLayerToTop(id)
  if (cmd === 'bottom') editorStore.moveLayerToBottom(id)
  if (cmd === 'copy') { editorStore.selectLayer(id); editorStore.copyElement(); editorStore.pasteElement() }
  if (cmd === 'delete') editorStore.removeElement(id)
}
</script>

<style scoped>
.layer-panel { padding: 4px; }
.empty-hint { color: #909399; text-align: center; padding: 20px 0; }
.layer-item { display: flex; align-items: center; padding: 6px 8px; cursor: pointer; color: #303133; border-radius: 4px; font-size: 13px; transition: background 0.15s; }
.layer-item:hover { background: #f0f2f5; }
.layer-item.selected { background: #ecf5ff; border-left: 3px solid #409eff; }
.layer-item.locked { opacity: 0.6; }
.layer-item.drag-over { border-top: 2px solid #409eff; }
.drag-handle { cursor: grab; margin-right: 4px; opacity: 0.4; }
.drag-handle:active { cursor: grabbing; }
.drag-handle:hover { opacity: 1; }
</style>
