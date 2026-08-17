<template>
  <div class="property-panel">
    <div v-if="!editorStore.selectedElement" class="empty-hint">选中画布元素以编辑属性</div>
    <div v-else>
      <div style="margin-bottom:8px">
        <el-button size="small" type="danger" @click="deleteElement">删除元素</el-button>
        <el-button size="small" type="warning" @click="setAsBackground">设为背景画面</el-button>
        <el-button v-if="editorStore.currentPage?.background?.type === 'image' || editorStore.currentPage?.background?.type === 'video'" size="small" type="info" @click="clearBackground">清除背景</el-button>
      </div>
      <el-collapse v-model="activeNames">
        <el-collapse-item title="位置与尺寸" name="position">
          <el-form label-position="top" size="small">
            <el-row :gutter="8">
              <el-col :span="12"><el-form-item label="X"><el-input-number v-model="el.x" :step="1" controls-position="right" style="width:100%" @change="update('x', el.x)" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="Y"><el-input-number v-model="el.y" :step="1" controls-position="right" style="width:100%" @change="update('y', el.y)" /></el-form-item></el-col>
            </el-row>
            <el-row :gutter="8">
              <el-col :span="12"><el-form-item label="宽"><el-input-number v-model="el.width" :step="1" :min="5" controls-position="right" style="width:100%" @change="update('width', el.width)" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="高"><el-input-number v-model="el.height" :step="1" :min="5" controls-position="right" style="width:100%" @change="update('height', el.height)" /></el-form-item></el-col>
            </el-row>
          </el-form>
        </el-collapse-item>
        <el-collapse-item title="变换" name="transform">
          <el-form label-position="top" size="small">
            <el-form-item label="旋转"><el-slider v-model="el.rotation" :min="0" :max="360" @input="update('rotation', el.rotation)" /></el-form-item>
            <el-form-item label="不透明度"><el-slider v-model="el.opacity" :min="0" :max="1" :step="0.01" @input="update('opacity', el.opacity)" /></el-form-item>
            <el-form-item label="圆角"><el-input-number v-model="el.borderRadius" :min="0" :step="1" controls-position="right" style="width:100%" @change="update('borderRadius', el.borderRadius)" /></el-form-item>
          </el-form>
        </el-collapse-item>

        <!-- Text properties -->
        <el-collapse-item title="文字" name="text" v-if="el.type === 'text'">
          <el-form label-position="top" size="small">
            <el-form-item label="字体">
              <el-select v-model="el.fontFamily" style="width:100%" @change="update('fontFamily', el.fontFamily)">
                <el-option label="微软雅黑" value="Microsoft YaHei" /><el-option label="宋体" value="SimSun" />
                <el-option label="黑体" value="SimHei" /><el-option label="Arial" value="Arial" />
              </el-select>
            </el-form-item>
            <el-form-item label="字号"><el-input-number v-model="el.fontSize" :min="8" :max="200" controls-position="right" style="width:100%" @change="update('fontSize', el.fontSize)" /></el-form-item>
            <el-form-item label="颜色"><el-color-picker v-model="el.color" @change="update('color', el.color)" /></el-form-item>
            <el-form-item label="对齐">
              <el-radio-group v-model="el.textAlign" size="small" @change="update('textAlign', el.textAlign)">
                <el-radio-button value="left">左</el-radio-button>
                <el-radio-button value="center">中</el-radio-button>
                <el-radio-button value="right">右</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="粗体">
              <el-switch v-model="isBold" @change="onBoldChange" />
            </el-form-item>
            <el-form-item label="出现效果">
              <el-select :model-value="el.appearEffect || 'none'" style="width:100%" @change="(v: string) => update('appearEffect', v)">
                <el-option v-for="opt in appearEffectOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="(el.appearEffect || 'none') !== 'none'" label="速度">
              <el-select :model-value="el.appearSpeed || 'normal'" style="width:100%" @change="(v: string) => update('appearSpeed', v)">
                <el-option v-for="opt in appearSpeedOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="内容">
              <el-input v-model="textContent" type="textarea" :rows="3" @change="update('content', textContent)" />
            </el-form-item>
          </el-form>
        </el-collapse-item>

        <!-- Image properties -->
        <el-collapse-item title="图片" name="image" v-if="el.type === 'image'">
          <el-form label-position="top" size="small">
            <el-form-item label="图片列表">
              <div style="width:100%">
                <div v-for="(src, idx) in imageSrcs" :key="idx" style="display:flex;flex-direction:column;gap:2px;margin-bottom:6px;padding:6px;border:1px solid #ebeef5;border-radius:4px;cursor:pointer" :style="{ borderColor: el.src === src ? '#409EFF' : '#ebeef5' }" @click="selectImage(src)">
                  <div style="display:flex;align-items:center;gap:4px">
                    <span style="flex:1;font-size:12px;color:#606266;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" :title="getSrcName(src, idx)">{{ idx + 1 }}. {{ getSrcName(src, idx) }}</span>
                    <el-button link size="small" type="success" @click.stop="setImageAsBg(src)">背景</el-button>
                    <el-button link size="small" type="danger" @click.stop="removeImage(idx)">✕</el-button>
                  </div>
                  <el-input :model-value="imageCaptions[idx] || ''" size="small" type="textarea" :rows="2" placeholder="字幕" @update:model-value="(v: string) => updateCaption(idx, v)" />
                  <div v-if="imageCaptions[idx]" style="display:flex;gap:4px;align-items:center;margin-top:2px">
                    <span style="font-size:10px;color:#909399">X:</span>
                    <el-input-number :model-value="getCaptionPos(idx).x" size="small" :min="0" controls-position="right" style="width:70px" @change="(v: number) => updateCaptionPos(idx, 'x', v)" />
                    <span style="font-size:10px;color:#909399">Y:</span>
                    <el-input-number :model-value="getCaptionPos(idx).y" size="small" :min="0" controls-position="right" style="width:70px" @change="(v: number) => updateCaptionPos(idx, 'y', v)" />
                  </div>
                </div>
                <div v-if="!imageSrcs.length" style="font-size:12px;color:#909399">从素材库拖入图片添加</div>
              </div>
            </el-form-item>
            <el-form-item v-if="imageSrcs.length > 1" label="循环模式">
              <el-select :model-value="el.cycleMode || 'both'" style="width:100%" @change="(v: string) => update('cycleMode', v)">
                <el-option label="自动+手动" value="both" />
                <el-option label="仅自动" value="auto" />
                <el-option label="仅手动" value="manual" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="imageSrcs.length > 1" label="切换间隔(ms)">
              <el-input-number v-model="el.imageInterval" :min="1000" :step="500" style="width:100%" controls-position="right" @change="update('imageInterval', el.imageInterval)" />
            </el-form-item>
            <el-form-item v-if="imageSrcs.length > 1" label="切换动画">
              <el-select v-model="el.imageTransition" style="width:100%" @change="update('imageTransition', el.imageTransition)">
                <el-option label="渐入渐出" value="fade" />
                <el-option label="直接切换" value="none" />
              </el-select>
            </el-form-item>
            <el-form-item label="填充方式">
              <el-select v-model="el.objectFit" style="width:100%" @change="update('objectFit', el.objectFit)">
                <el-option label="覆盖" value="cover" /><el-option label="包含" value="contain" />
                <el-option label="填充" value="fill" /><el-option label="无" value="none" />
              </el-select>
            </el-form-item>
            <el-form-item label="亮度"><el-slider v-model="el.brightness" :min="0" :max="200" @input="update('brightness', el.brightness)" /></el-form-item>
            <el-form-item label="对比度"><el-slider v-model="el.contrast" :min="0" :max="200" @input="update('contrast', el.contrast)" /></el-form-item>
          </el-form>
        </el-collapse-item>

        <!-- Caption properties -->
        <el-collapse-item title="字幕" name="caption" v-if="el.type === 'image'">
          <el-form label-position="top" size="small">
            <el-form-item label="字体">
              <el-select v-model="el.captionFontFamily" style="width:100%" @change="update('captionFontFamily', el.captionFontFamily)">
                <el-option label="微软雅黑" value="Microsoft YaHei" /><el-option label="宋体" value="SimSun" />
                <el-option label="黑体" value="SimHei" /><el-option label="Arial" value="Arial" />
              </el-select>
            </el-form-item>
            <el-form-item label="字号">
              <el-input-number v-model="el.captionFontSize" :min="8" :max="120" controls-position="right" style="width:100%" @change="update('captionFontSize', el.captionFontSize)" />
            </el-form-item>
            <el-form-item label="颜色">
              <el-color-picker v-model="el.captionColor" @change="update('captionColor', el.captionColor)" />
            </el-form-item>
            <el-form-item label="对齐">
              <el-radio-group v-model="el.captionTextAlign" size="small" @change="update('captionTextAlign', el.captionTextAlign)">
                <el-radio-button value="left">左</el-radio-button>
                <el-radio-button value="center">中</el-radio-button>
                <el-radio-button value="right">右</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="粗体">
              <el-switch :model-value="el.captionFontWeight === 'bold'" @change="(v: boolean) => update('captionFontWeight', v ? 'bold' : 'normal')" />
            </el-form-item>
            <el-form-item label="位置">
              <el-radio-group v-model="el.captionPosition" size="small" @change="update('captionPosition', el.captionPosition)">
                <el-radio-button value="top">顶部</el-radio-button>
                <el-radio-button value="bottom">底部</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="字宽">
              <el-input-number v-model="el.captionWidth" :min="0" :max="2000" controls-position="right" style="width:100%" @change="update('captionWidth', el.captionWidth)" />
              <span style="font-size:10px;color:#909399">0=使用图片宽度</span>
            </el-form-item>
            <el-form-item label="边距">
              <el-input-number v-model="el.captionPadding" :min="0" :max="60" controls-position="right" style="width:100%" @change="update('captionPadding', el.captionPadding)" />
            </el-form-item>
            <el-form-item label="阴影强度">
              <el-slider v-model="el.captionShadowBlur" :min="0" :max="30" @input="update('captionShadowBlur', el.captionShadowBlur)" />
            </el-form-item>
            <el-form-item label="出现效果">
              <el-select :model-value="el.captionAppearEffect || 'none'" style="width:100%" @change="(v: string) => update('captionAppearEffect', v)">
                <el-option v-for="opt in appearEffectOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="(el.captionAppearEffect || 'none') !== 'none'" label="速度">
              <el-select :model-value="el.captionAppearSpeed || 'normal'" style="width:100%" @change="(v: string) => update('captionAppearSpeed', v)">
                <el-option v-for="opt in appearSpeedOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-divider content-position="left" style="margin:6px 0">半透明背景条</el-divider>
            <el-form-item>
              <el-switch v-model="el.captionBgEnabled" @change="update('captionBgEnabled', el.captionBgEnabled)" active-text="启用" />
            </el-form-item>
            <el-form-item v-if="el.captionBgEnabled" label="背景颜色">
              <el-color-picker v-model="el.captionBgColor" @change="update('captionBgColor', el.captionBgColor)" />
            </el-form-item>
            <el-form-item v-if="el.captionBgEnabled" label="背景透明度">
              <el-slider v-model="el.captionBgOpacity" :min="0" :max="1" :step="0.05" @input="update('captionBgOpacity', el.captionBgOpacity)" />
            </el-form-item>
            <el-form-item v-if="el.captionBgEnabled" label="背景内边距">
              <el-input-number v-model="el.captionBgPadding" :min="0" :max="40" controls-position="right" style="width:100%" @change="update('captionBgPadding', el.captionBgPadding)" />
            </el-form-item>
            <el-divider content-position="left" style="margin:6px 0">文字描边</el-divider>
            <el-form-item>
              <el-switch v-model="el.captionStrokeEnabled" @change="update('captionStrokeEnabled', el.captionStrokeEnabled)" active-text="启用" />
            </el-form-item>
            <el-form-item v-if="el.captionStrokeEnabled" label="描边颜色">
              <el-color-picker v-model="el.captionStrokeColor" @change="update('captionStrokeColor', el.captionStrokeColor)" />
            </el-form-item>
            <el-form-item v-if="el.captionStrokeEnabled" label="描边粗细">
              <el-input-number v-model="el.captionStrokeWidth" :min="1" :max="12" controls-position="right" style="width:100%" @change="update('captionStrokeWidth', el.captionStrokeWidth)" />
            </el-form-item>
            <el-divider content-position="left" style="margin:6px 0">渐变遮罩</el-divider>
            <el-form-item>
              <el-switch v-model="el.captionScrim" @change="update('captionScrim', el.captionScrim)" active-text="启用" />
            </el-form-item>
            <el-form-item v-if="el.captionScrim" label="位置">
              <el-radio-group v-model="el.captionScrimPosition" size="small" @change="update('captionScrimPosition', el.captionScrimPosition)">
                <el-radio-button value="auto">自动</el-radio-button>
                <el-radio-button value="top">顶部</el-radio-button>
                <el-radio-button value="bottom">底部</el-radio-button>
                <el-radio-button value="both">上下</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-form>
        </el-collapse-item>

        <!-- Video properties -->
        <el-collapse-item title="视频" name="video" v-if="el.type === 'video'">
          <el-form label-position="top" size="small">
            <el-form-item label="视频列表" v-if="videoSrcs.length">
              <div style="width:100%">
                <div v-for="(src, idx) in videoSrcs" :key="idx" style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
                  <span style="flex:1;font-size:12px;color:#606266;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" :title="getSrcName(src, idx)">{{ idx + 1 }}. {{ getSrcName(src, idx) }}</span>
                  <el-button link size="small" type="success" @click="setVideoAsBg(src)">背景</el-button>
                  <el-button link size="small" type="danger" @click="removeVideo(idx)">✕</el-button>
                </div>
              </div>
            </el-form-item>
            <el-form-item v-if="videoSrcs.length > 1" label="循环模式">
              <el-select :model-value="el.cycleMode || 'manual'" style="width:100%" @change="(v: string) => update('cycleMode', v)">
                <el-option label="自动+手动" value="both" />
                <el-option label="仅自动" value="auto" />
                <el-option label="仅手动" value="manual" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="videoSrcs.length > 1" label="切换间隔(ms)">
              <el-input-number :model-value="el.imageInterval || 0" :min="0" :step="500" style="width:100%" controls-position="right" @change="(v: number | undefined) => update('imageInterval', v && v > 0 ? v : undefined)" />
              <span style="font-size:10px;color:#909399">设为0=播完自动切下一段</span>
            </el-form-item>
            <el-form-item label="循环"><el-switch v-model="el.loop" @change="update('loop', el.loop)" /></el-form-item>
            <el-form-item label="自动播放"><el-switch v-model="el.autoplay" @change="update('autoplay', el.autoplay)" /></el-form-item>
            <el-form-item label="静音"><el-switch v-model="el.muted" @change="update('muted', el.muted)" /></el-form-item>
            <el-form-item label="音量"><el-slider v-model="el.volume" :min="0" :max="1" :step="0.1" @input="update('volume', el.volume)" /></el-form-item>
          </el-form>
        </el-collapse-item>

        <!-- Shape properties -->
        <el-collapse-item title="形状" name="shape" v-if="el.type === 'shape'">
          <el-form label-position="top" size="small">
            <el-form-item label="类型">
              <el-select v-model="el.shapeType" style="width:100%" @change="update('shapeType', el.shapeType)">
                <el-option label="矩形" value="rectangle" /><el-option label="圆形" value="circle" />
                <el-option label="线条" value="line" /><el-option label="箭头" value="arrow" />
              </el-select>
            </el-form-item>
            <el-form-item label="填充色"><el-color-picker v-model="fillColor" @change="onFillChange" /></el-form-item>
          </el-form>
        </el-collapse-item>

        <!-- Button properties -->
        <el-collapse-item title="按钮" name="button" v-if="el.type === 'button'">
          <el-form label-position="top" size="small">
            <el-form-item label="图标">
              <el-select v-model="el.icon" style="width:100%" @change="update('icon', el.icon)">
                <el-option v-for="ic in BUTTON_ICONS" :key="ic.name" :label="ic.label" :value="ic.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="图标颜色"><el-color-picker v-model="el.iconColor" @change="update('iconColor', el.iconColor)" /></el-form-item>
            <el-form-item label="图标尺寸"><el-input-number v-model="el.iconSize" :min="8" :max="500" controls-position="right" style="width:100%" @change="update('iconSize', el.iconSize)" /></el-form-item>
            <el-form-item label="背景形状">
              <el-select v-model="el.backgroundShape" style="width:100%" @change="update('backgroundShape', el.backgroundShape)">
                <el-option label="圆形" value="circle" /><el-option label="圆角矩形" value="roundedRect" />
                <el-option label="无" value="none" />
              </el-select>
            </el-form-item>
            <el-form-item label="背景色"><el-color-picker v-model="buttonFill" @change="onButtonFillChange" /></el-form-item>
            <el-form-item label="圆角"><el-input-number v-model="el.cornerRadius" :min="0" :max="500" controls-position="right" style="width:100%" @change="update('cornerRadius', el.cornerRadius)" /></el-form-item>
          </el-form>
        </el-collapse-item>

        <!-- Sequence frame properties -->
        <el-collapse-item title="序列帧" name="seq" v-if="el.type === 'sequenceFrame'">
          <el-form label-position="top" size="small">
            <div v-if="!seqSources.length" style="font-size:12px;color:#909399;margin-bottom:8px">从素材库拖入序列帧添加</div>
            <el-form-item label="序列列表" v-if="seqSources.length">
              <div style="width:100%">
                <div v-for="(s, idx) in seqSources" :key="idx" style="display:flex;flex-direction:column;gap:2px;margin-bottom:6px;padding:6px;border:1px solid #ebeef5;border-radius:4px">
                  <div style="display:flex;align-items:center;gap:4px">
                    <span style="flex:1;font-size:12px;color:#303133" :title="s.name">{{ idx + 1 }}. {{ s.name }}</span>
                    <el-button link size="small" type="danger" @click="removeSeqSource(idx)">✕</el-button>
                  </div>
                  <div style="display:flex;align-items:center;gap:4px">
                    <span style="font-size:10px;color:#909399">{{ s.frames?.length || s.frameCount || 0 }}帧</span>
                    <span style="font-size:10px;color:#909399">|</span>
                    <span style="font-size:10px;color:#909399">循环</span>
                    <el-input-number :model-value="s.loopCount ?? 1" size="small" :min="1" :max="99" controls-position="right" style="width:56px" @change="(v: number) => updateSeqProp(idx, 'loopCount', v || 1)" />
                    <span style="font-size:10px;color:#409eff">{{ calcSegDuration(s).toFixed(1) }}s</span>
                  </div>
                </div>
                <div v-if="seqSources.length > 1" style="font-size:10px;color:#409eff;margin-top:2px">
                  总时长: {{ totalSeqDuration.toFixed(1) }}s
                </div>
              </div>
            </el-form-item>
            <el-form-item v-if="seqSources.length > 1" label="循环模式">
              <el-select :model-value="el.cycleMode || 'manual'" style="width:100%" @change="(v: string) => update('cycleMode', v)">
                <el-option label="仅手动" value="manual" />
                <el-option label="仅自动" value="auto" />
                <el-option label="自动+手动" value="both" />
              </el-select>
            </el-form-item>
            <el-form-item label="帧率"><el-input-number v-model="el.frameRate" :min="1" :max="60" controls-position="right" style="width:100%" @change="update('frameRate', el.frameRate)" /></el-form-item>
            <el-form-item label="方向">
              <el-select v-model="el.direction" style="width:100%" @change="update('direction', el.direction)">
                <el-option label="正向" value="forward" /><el-option label="反向" value="reverse" />
                <el-option label="交替" value="alternate" />
              </el-select>
            </el-form-item>
            <el-form-item label="自动播放"><el-switch v-model="el.autoplay" @change="update('autoplay', el.autoplay)" /></el-form-item>
            <el-form-item label="拖拽控制"><el-switch v-model="el.scrubEnabled" @change="update('scrubEnabled', el.scrubEnabled)" /></el-form-item>
            <el-form-item v-if="el.scrubEnabled" label="灵敏度"><el-input-number v-model="el.scrubSensitivity" :min="1" :max="100" controls-position="right" style="width:100%" @change="update('scrubSensitivity', el.scrubSensitivity)" /></el-form-item>
          </el-form>
        </el-collapse-item>
      </el-collapse>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { ElMessageBox } from 'element-plus'
import { BUTTON_ICONS } from '@/utils/icons'
import { APPEAR_EFFECT_OPTIONS as appearEffectOptions, APPEAR_SPEED_OPTIONS as appearSpeedOptions } from '@/utils/appearEffect'

const editorStore = useEditorStore()
const activeNames = ref(['position', 'transform'])
const el = ref<any>({})

const typeSectionMap: Record<string, string> = {
  text: 'text', image: 'image', video: 'video',
  shape: 'shape', sequenceFrame: 'seq', button: 'button',
}

let ignoreStoreUpdate = false

function findSelectedElement() {
  const ids = editorStore.selectedLayerIds
  if (!ids.length) return null
  const page = editorStore.currentPage
  if (!page) return null
  const layer = page.layers.find(l => l.element.id === ids[0])
  return layer?.element || null
}

watch(() => {
  const elem = findSelectedElement()
  if (!elem) return 'none'
  return `${editorStore.selectedLayerIds.join(',')}|${elem.x},${elem.y},${elem.width},${elem.height},${elem.rotation},${elem.opacity}|${JSON.stringify(elem.srcs)}|${JSON.stringify(elem.srcNames)}|${JSON.stringify(elem.captions)}|${JSON.stringify(elem.seqSources)}|${JSON.stringify(elem.captionPositions)}`
}, () => {
  if (ignoreStoreUpdate) return
  const elem = findSelectedElement()
  if (!elem) {
    el.value = {}
    return
  }
  el.value = { ...elem }
  const section = typeSectionMap[elem.type]
  if (section && !activeNames.value.includes(section)) {
    activeNames.value = [...activeNames.value, section]
  }
}, { immediate: true })

const textContent = computed({
  get: () => typeof el.value.content === 'string' ? el.value.content : '',
  set: (v: string) => el.value.content = v
})

const isBold = computed({
  get: () => el.value.fontWeight === 'bold',
  set: (v: boolean) => el.value.fontWeight = v ? 'bold' : 'normal'
})

const fillColor = computed({
  get: () => el.value.fill?.color || el.value.fill || '#409EFF',
  set: (v: string) => { el.value.fill = { type: 'solid', color: v } }
})

const buttonFill = computed({
  get: () => (typeof el.value.fill === 'string' ? el.value.fill : el.value.fill?.color) || '#409EFF',
  set: (v: string) => { el.value.fill = v }
})

function update(key: string, value: any) {
  ignoreStoreUpdate = true
  el.value[key] = value
  editorStore.updateElement(el.value.id, { [key]: value })
  nextTick(() => { ignoreStoreUpdate = false })
}

function onBoldChange(v: boolean) { update('fontWeight', v ? 'bold' : 'normal') }
function onFillChange(v: string) { update('fill', { type: 'solid', color: v }) }
function onButtonFillChange(v: string) { update('fill', v) }

const imageSrcs = computed(() => {
  const s = el.value.srcs
  if (Array.isArray(s)) return s
  return el.value.src ? [el.value.src] : []
})

const imageCaptions = computed({
  get: () => {
    const c = el.value.captions
    if (Array.isArray(c)) return c
    return []
  },
  set: (v: string[]) => { el.value.captions = v }
})

const videoSrcs = computed(() => {
  const s = el.value.srcs
  if (Array.isArray(s)) return s
  return el.value.src ? [el.value.src] : []
})

function getSrcName(src: string, idx: number): string {
  const elem = findSelectedElement()
  const names = elem?.srcNames
  if (Array.isArray(names) && names[idx]) return names[idx]
  return src
}

const seqSources = computed(() => {
  const s = el.value.seqSources
  if (Array.isArray(s)) return s
  return el.value.source?.frames?.length ? [el.value.source] : []
})

function moveSeqSource(idx: number, dir: number) {
  const sources = [...seqSources.value]
  const target = idx + dir
  if (target < 0 || target >= sources.length) return
  const tmp = sources[idx]
  sources[idx] = sources[target]
  sources[target] = tmp
  el.value.seqSources = sources
  update('seqSources', sources)
}

function removeSeqSource(idx: number) {
  const sources = [...seqSources.value]
  sources.splice(idx, 1)
  el.value.seqSources = sources
  if (sources.length === 0) {
    el.value.seqSources = []
    el.value.source = { type: 'folder', frames: [] }
  } else {
    el.value.source = sources[0]
  }
  update('seqSources', sources)
  update('source', el.value.source)
}

function updateSeqProp(idx: number, prop: string, value: any) {
  const sources = [...seqSources.value]
  if (!sources[idx]) return
  sources[idx] = { ...sources[idx], [prop]: value }
  el.value.seqSources = sources
  update('seqSources', sources)
}

function calcSegDuration(s: any): number {
  const frames = s.frames?.length || s.frameCount || 0
  const fps = el.value.frameRate || 30
  const loop = s.loopCount ?? 1
  return (frames / fps) * loop
}

const totalSeqDuration = computed(() => {
  return seqSources.value.reduce((sum, s) => sum + calcSegDuration(s), 0)
})

function removeImage(idx: number) {
  const srcs = [...(el.value.srcs || [])]
  const srcNames = [...(el.value.srcNames || [])]
  const captions = [...(el.value.captions || [])]
  const captionPositions = [...(el.value.captionPositions || [])]
  srcs.splice(idx, 1)
  srcNames.splice(idx, 1)
  captions.splice(idx, 1)
  captionPositions.splice(idx, 1)
  el.value.srcs = srcs
  el.value.srcNames = srcNames
  el.value.captions = captions
  el.value.captionPositions = captionPositions
  if (el.value.src && !srcs.includes(el.value.src)) {
    el.value.src = srcs[0] || ''
  }
  update('srcs', srcs)
  update('srcNames', srcNames)
  update('captions', captions)
  update('captionPositions', captionPositions)
  if (el.value.src !== srcs[0] || srcs.length === 0) {
    update('src', el.value.src)
  }
}

function updateCaption(idx: number, value: string) {
  const captions = [...(el.value.captions || [])]
  captions[idx] = value
  el.value.captions = captions
  update('captions', captions)
}

function getCaptionPos(idx: number): { x: number; y: number } {
  const positions = el.value.captionPositions
  if (Array.isArray(positions) && positions[idx]) return positions[idx]
  const pad = el.value.captionPadding ?? 8
  const h = el.value.height || 200
  const pos = el.value.captionPosition || 'bottom'
  const fontPx = el.value.captionFontSize || 16
  const bgPad = el.value.captionBgEnabled ? (el.value.captionBgPadding ?? 8) : 0
  const barH = fontPx * 1.4 + bgPad * 2
  const x = (el.value.x || 0) + pad
  const y = (el.value.y || 0) + (pos === 'top' ? pad : h - barH - bgPad)
  return { x, y }
}

function updateCaptionPos(idx: number, key: string, value: number) {
  const positions = [...(el.value.captionPositions || [])]
  while (positions.length <= idx) positions.push(null)
  positions[idx] = { ...(positions[idx] || getCaptionPos(idx)), [key]: value }
  el.value.captionPositions = positions
  update('captionPositions', positions)
}

function removeVideo(idx: number) {
  const srcs = [...(el.value.srcs || [])]
  const srcNames = [...(el.value.srcNames || [])]
  srcs.splice(idx, 1)
  srcNames.splice(idx, 1)
  el.value.srcs = srcs
  el.value.srcNames = srcNames
  if (el.value.src && !srcs.includes(el.value.src)) {
    el.value.src = srcs[0] || ''
  }
  update('srcs', srcs)
  update('srcNames', srcNames)
  if (el.value.src !== srcs[0] || srcs.length === 0) {
    update('src', el.value.src)
  }
}

function setImageAsBg(hash: string) {
  editorStore.setPageBackgroundByHash('image', hash)
}

function setVideoAsBg(hash: string) {
  editorStore.setPageBackgroundByHash('video', hash)
}

function selectImage(hash: string) {
  if (el.value.src === hash) return
  el.value.src = hash
  update('src', hash)
}

function setAsBackground() {
  if (el.value.id) {
    editorStore.setPageBackground(el.value.id)
  }
}

function clearBackground() {
  editorStore.clearPageBackground()
}

function deleteElement() {
  if (!el.value.id) return
  ElMessageBox.confirm('确定要删除选中元素吗？', '提示', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    .then(() => { editorStore.removeElement(el.value.id) })
    .catch(() => {})
}
</script>

<style scoped>
.property-panel { padding: 8px; }
.empty-hint { color: #909399; text-align: center; padding: 40px 0; }
</style>
