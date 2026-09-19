<template>
  <div class="animation-panel">
    <div style="padding:8px;color:#909399" v-if="!editorStore.selectedElement">选中元素以编辑动画</div>
    <div v-else>
      <div style="padding:8px">
        <span style="color:#606266">动画列表</span>
        <el-select v-model="selectedAnim" size="small" style="width:100%;margin-top:4px" placeholder="添加动画">
          <el-option label="淡入" value="fadeIn" /><el-option label="淡出" value="fadeOut" />
          <el-option label="滑入" value="slideIn" /><el-option label="向上滑入" value="slideUp" />
          <el-option label="向下滑出" value="slideDown" /><el-option label="放大" value="zoomIn" />
          <el-option label="缩小" value="zoomOut" /><el-option label="旋转" value="rotate" />
          <el-option label="移动" value="move" />
        </el-select>
        <el-button size="small" style="margin-top:4px" :disabled="!selectedAnim" @click="addAnim">添加</el-button>
      </div>
      <div v-for="(anim, idx) in currentAnimations" :key="idx" style="padding:8px;border-bottom:1px solid #e4e7ed">
        <div style="color:#409EFF;margin-bottom:4px">{{ anim.type }}</div>
        <el-form size="small" label-position="left" label-width="60px">
          <el-form-item label="时长(秒)"><el-input-number :model-value="msToSec(anim.duration, 1000)" :min="0.1" :step="0.1" size="small" style="width:100%" controls-position="right" @change="(v: number | undefined) => setAnimDuration(anim, v)" /></el-form-item>
          <el-form-item label="延迟(秒)"><el-input-number :model-value="msToSec(anim.delay, 0)" :min="0" :step="0.1" size="small" style="width:100%" controls-position="right" @change="(v: number | undefined) => setAnimDelay(anim, v)" /></el-form-item>
          <el-form-item label="方向">
            <el-select v-model="anim.direction" size="small" style="width:100%" @change="save">
              <el-option label="入场" value="in" /><el-option label="出场" value="out" />
              <el-option label="强调" value="emphasis" />
            </el-select>
          </el-form-item>
          <template v-if="anim.type === 'move'">
            <div style="font-size:11px;color:#909399;margin-top:4px">元素当前位置: {{ editorStore.selectedElement?.x ?? '-' }}, {{ editorStore.selectedElement?.y ?? '-' }}</div>
            <div style="font-size:11px;color:#909399;margin-top:4px">起始位置</div>
            <div style="display:flex;gap:4px;margin-top:2px">
              <el-input-number :model-value="anim.params?.from?.x ?? 0" :step="10" size="small" style="width:100%" controls-position="right" @change="(v: number | undefined) => { if (!anim.params) anim.params = {}; if (!anim.params.from) anim.params.from = {}; anim.params.from.x = v; save() }" placeholder="X" />
              <el-input-number :model-value="anim.params?.from?.y ?? 0" :step="10" size="small" style="width:100%" controls-position="right" @change="(v: number | undefined) => { if (!anim.params) anim.params = {}; if (!anim.params.from) anim.params.from = {}; anim.params.from.y = v; save() }" placeholder="Y" />
            </div>
            <div style="font-size:11px;color:#909399;margin-top:4px">目标位置</div>
            <div style="display:flex;gap:4px;margin-top:2px">
              <el-input-number :model-value="anim.params?.to?.x ?? 0" :step="10" size="small" style="width:100%" controls-position="right" @change="(v: number | undefined) => { if (!anim.params) anim.params = {}; if (!anim.params.to) anim.params.to = {}; anim.params.to.x = v; save() }" placeholder="X" />
              <el-input-number :model-value="anim.params?.to?.y ?? 0" :step="10" size="small" style="width:100%" controls-position="right" @change="(v: number | undefined) => { if (!anim.params) anim.params = {}; if (!anim.params.to) anim.params.to = {}; anim.params.to.y = v; save() }" placeholder="Y" />
            </div>
          </template>
          <el-button size="small" type="danger" @click="removeAnim(idx)">删除</el-button>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { msToSec, secToMs } from '@/utils/time'
import type { Animation } from '@/types'

const editorStore = useEditorStore()
const selectedAnim = ref('')

const selectedElementId = computed(() => editorStore.selectedElement?.id)

const currentAnimations = computed(() => {
  if (!editorStore.currentPage) return []
  const layer = editorStore.currentPage.layers.find(l => l.element.id === selectedElementId.value)
  return layer?.animations || []
})

function addAnim() {
  if (!selectedAnim.value || !selectedElementId.value) return
  const el = editorStore.selectedElement
  const baseX = el?.x ?? 0
  const baseY = el?.y ?? 0
  const anim: any = {
    type: selectedAnim.value, duration: selectedAnim.value === 'move' ? 3000 : 1000, delay: 0,
    easing: 'ease-out', direction: 'in', repeat: 1,
    params: {},
  }
  if (selectedAnim.value === 'move') {
    anim.params = { from: { x: baseX, y: baseY }, to: { x: baseX + 300, y: baseY } }
  }
  editorStore.addAnimation(selectedElementId.value, anim)
  selectedAnim.value = ''
}

function removeAnim(idx: number) {
  if (!selectedElementId.value) return
  editorStore.removeAnimation(selectedElementId.value, idx)
}

function save() { editorStore.pushHistory() }

function setAnimDuration(anim: Animation, sec: number | undefined) {
  anim.duration = secToMs(sec, 1000)
  save()
}

function setAnimDelay(anim: Animation, sec: number | undefined) {
  anim.delay = secToMs(sec, 0)
  save()
}
</script>
