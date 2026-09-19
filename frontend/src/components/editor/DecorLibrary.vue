<template>
  <div class="decor-library">
    <div class="cat-bar">
      <el-radio-group v-model="category" size="small" @change="scrollTop">
        <el-radio-button v-for="c in DECOR_CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</el-radio-button>
      </el-radio-group>
    </div>
    <div class="decor-grid" ref="gridRef">
      <div v-for="def in filtered" :key="def.id" class="decor-item"
           :draggable="true" :title="def.name"
           @click="addDecor(def.id)" @dragstart="onDragStart($event, def)">
        <svg class="decor-thumb" viewBox="0 0 100 100" preserveAspectRatio="none" v-html="decorPreviewSvg(def.id, fillColor, strokeColor, 2.5)" />
        <div class="decor-name">{{ def.name }}</div>
      </div>
    </div>
    <div v-if="!filtered.length" class="empty-hint">暂无装饰</div>
    <div class="tip">点击添加 / 拖到画布定位</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { DECOR_SHAPES, DECOR_CATEGORIES, decorPreviewSvg } from '@/utils/decorShapes'

const editorStore = useEditorStore()
const category = ref('frame')
const gridRef = ref<HTMLElement>()

const fillColor = '#5b9dff'
const strokeColor = '#7fb8ff'

const filtered = computed(() => DECOR_SHAPES.filter(d => d.category === category.value))

function scrollTop() { if (gridRef.value) gridRef.value.scrollTop = 0 }

function addDecor(id: string) {
  editorStore.addDecorLayerAt(id)
}

function onDragStart(e: DragEvent, def: any) {
  e.dataTransfer?.setData('application/json', JSON.stringify({ type: 'decor', decorId: def.id }))
}
</script>

<style scoped>
.decor-library { padding: 4px; }
.cat-bar { padding: 8px 4px; }
.cat-bar :deep(.el-radio-button__inner) { padding: 6px 8px; font-size: 12px; }
.decor-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 0 6px; max-height: calc(100vh - 200px); overflow-y: auto; }
.decor-item { border: 1px solid #e4e7ed; border-radius: 6px; overflow: hidden; cursor: pointer; background: #fbfdff; }
.decor-item:hover { border-color: #409EFF; box-shadow: 0 0 0 1px #409EFF; }
.decor-thumb { width: 100%; height: 56px; display: block; background: repeating-linear-gradient(45deg, #f5f7fa, #f5f7fa 6px, #fafcff 6px, #fafcff 12px); }
.decor-name { font-size: 11px; color: #606266; text-align: center; padding: 3px 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.empty-hint { color: #909399; text-align: center; padding: 20px 0; }
.tip { font-size: 10px; color: #a8abb2; text-align: center; padding: 6px 0; }
</style>
