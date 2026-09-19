<template>
  <div class="page-manager">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px">
      <span style="color:#606266">页面 ({{ pages.length }})</span>
      <el-button size="small" @click="editorStore.addPage()">+ 添加</el-button>
    </div>
    <div v-for="(page, idx) in pages" :key="page.id"
         class="page-item" :class="{ active: idx === editorStore.currentPageIndex }"
         @click="editorStore.setCurrentPage(idx)">
      <div class="page-thumb">
        <span>{{ page.name }}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px">
        <span style="font-size:11px;color:#909399">{{ page.layers?.length || 0 }}层</span>
        <el-button link size="small" @click.stop="editorStore.removePage(idx)" v-if="pages.length > 1">
          <span style="color:#f56c6c">✕</span>
        </el-button>
      </div>
      <div style="padding:0 8px 8px">
        <el-form size="small" @click.stop>
          <el-form-item label="时长(秒)" style="margin-bottom:2px">
            <el-input-number :model-value="msToSec(page.duration, 10000)" :min="1" :step="1" size="small" style="width:100%" controls-position="right" @change="(v: number | undefined) => { page.duration = secToMs(v, 10000); editorStore.pushHistory() }" />
          </el-form-item>
          <el-form-item label="播放模式" style="margin-bottom:2px">
            <el-select v-model="page.playMode" size="small" style="width:100%" @change="editorStore.pushHistory()">
              <el-option label="顺序播放" value="sequential" />
              <el-option label="循环播放" value="loop" />
              <el-option label="手动切换" value="manual" />
            </el-select>
          </el-form-item>
          <el-form-item label="过渡效果" style="margin-bottom:2px">
            <el-select v-model="page.transition" size="small" style="width:100%" @change="editorStore.pushHistory()">
              <el-option label="淡入淡出" value="fade" />
              <el-option label="滑动" value="slide" />
              <el-option label="缩放" value="zoom" />
              <el-option label="无" value="none" />
            </el-select>
          </el-form-item>
          <el-divider style="margin:6px 0" />
          <div style="font-size:12px;color:#909399;margin-bottom:4px">背景设置</div>
          <el-form-item label="类型" style="margin-bottom:2px">
            <el-select :model-value="page.background?.type || 'none'" size="small" style="width:100%" @change="(v: string) => updateBg(page, 'type', v)">
              <el-option label="无" value="none" />
              <el-option label="纯色" value="color" />
              <el-option label="渐变" value="gradient" />
              <el-option label="图片" value="image" />
              <el-option label="视频" value="video" />
            </el-select>
          </el-form-item>
          <template v-if="page.background?.type === 'color'">
            <el-form-item label="颜色" style="margin-bottom:2px">
              <el-color-picker :model-value="page.background.backgroundColor || '#000'" size="small" @change="(v: string) => updateBg(page, 'backgroundColor', v)" />
            </el-form-item>
          </template>
          <template v-if="page.background?.type === 'gradient'">
            <el-form-item label="起色" style="margin-bottom:2px">
              <el-color-picker :model-value="bgGradColor(page, 0)" size="small" @change="(v: string) => setBgGrad(page, 0, v)" />
            </el-form-item>
            <el-form-item label="止色" style="margin-bottom:2px">
              <el-color-picker :model-value="bgGradColor(page, 1)" size="small" @change="(v: string) => setBgGrad(page, 1, v)" />
            </el-form-item>
            <el-form-item label="角度" style="margin-bottom:2px">
              <el-slider :model-value="page.background.gradient?.angle ?? 90" :min="0" :max="360" size="small"
                         @input="(v: number) => setBgGradAngle(page, v)" />
            </el-form-item>
          </template>
          <template v-if="page.background?.type === 'image' || page.background?.type === 'video'">
            <el-form-item label="素材Hash" style="margin-bottom:2px">
              <el-input :model-value="page.background.assetHash || ''" size="small" style="width:100%" placeholder="填入hash_key" @change="(v: string) => updateBg(page, 'assetHash', v)" />
            </el-form-item>
          </template>
          <template v-if="page.background?.type !== 'none' && page.background?.type">
            <el-form-item label="不透明度" style="margin-bottom:2px">
              <el-slider :model-value="page.background.opacity ?? 1" :min="0" :max="1" :step="0.05" size="small" @input="(v: number) => updateBg(page, 'opacity', v)" />
            </el-form-item>
            <el-form-item label="亮度" style="margin-bottom:2px">
              <el-slider :model-value="page.background.brightness ?? 100" :min="0" :max="200" size="small" @input="(v: number) => updateBg(page, 'brightness', v)" />
            </el-form-item>
            <el-form-item label="模糊" style="margin-bottom:2px">
              <el-slider :model-value="page.background.blur ?? 0" :min="0" :max="30" size="small" @input="(v: number) => updateBg(page, 'blur', v)" />
            </el-form-item>
          </template>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { msToSec, secToMs } from '@/utils/time'
import type { PageItem, PageBackground } from '@/types'

const editorStore = useEditorStore()
const pages = computed(() => editorStore.pages)

function updateBg(page: PageItem, key: string, value: any) {
  const bg: PageBackground = { ...page.background, type: page.background?.type || 'none', [key]: value }
  if (key === 'type' && value !== page.background?.type) {
    bg.assetHash = ''
    if (value !== 'gradient') bg.gradient = undefined
  }
  page.background = bg
}

function bgGradColor(page: PageItem, idx: number): string {
  const stops = page.background?.gradient?.stops
  if (Array.isArray(stops) && stops[idx]) return stops[idx].color
  return idx === 0 ? '#0a2b5e' : '#22d3ee'
}

function bgGradStops(page: PageItem): Array<{ pos: number; color: string }> {
  const cur = page.background?.gradient
  const stops = Array.isArray(cur?.stops) && cur!.stops.length
    ? cur!.stops.map(s => ({ pos: s.pos, color: s.color }))
    : [{ pos: 0, color: '#0a2b5e' }, { pos: 1, color: '#22d3ee' }]
  if (stops[0].pos > 0) stops.unshift({ pos: 0, color: stops[0].color })
  const last = stops[stops.length - 1]
  if (last.pos < 1) stops.push({ pos: 1, color: last.color })
  return stops
}

function setBgGrad(page: PageItem, idx: number, color: string) {
  const stops = bgGradStops(page)
  if (idx === 0) stops[0].color = color
  else stops[stops.length - 1].color = color
  const angle = page.background?.gradient?.angle ?? 90
  updateBg(page, 'gradient', { angle, stops })
}

function setBgGradAngle(page: PageItem, angle: number) {
  const stops = bgGradStops(page)
  updateBg(page, 'gradient', { angle, stops })
}
</script>

<style scoped>
.page-manager { padding: 4px; }
.page-item { margin-bottom: 8px; border: 1px solid #e4e7ed; border-radius: 4px; overflow: hidden; cursor: pointer; }
.page-item.active { border-color: #409EFF; }
.page-thumb { height: 60px; background: #f5f7fa; display: flex; align-items: center; justify-content: center; }
.page-thumb span { color: #303133; font-size: 13px; }
</style>
