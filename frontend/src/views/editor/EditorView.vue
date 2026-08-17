<template>
  <div class="editor-layout">
    <div class="toolbar">
      <el-button-group>
        <el-button size="small" @click="addElement('text')">文字</el-button>
        <el-button size="small" @click="addElement('image')">图片</el-button>
        <el-button size="small" @click="addElement('video')">视频</el-button>
        <el-button size="small" @click="addElement('shape')">形状</el-button>
        <el-button size="small" @click="addElement('container')">容器</el-button>
      </el-button-group>
      <el-divider direction="vertical" />
      <el-button size="small" :disabled="!editorStore.selectedLayers.length" @click="groupLayers">分组</el-button>
      <el-button size="small" :disabled="!editorStore.canUndo" @click="editorStore.undo()">撤销</el-button>
      <el-button size="small" :disabled="!editorStore.canRedo" @click="editorStore.redo()">重做</el-button>
      <el-divider direction="vertical" />
      <el-button size="small" type="primary" @click="save">保存</el-button>
      <el-button size="small" type="success" @click="showPreview = true">预览</el-button>
      <el-button size="small" type="warning" @click="showExport = true">导出</el-button>
      <span style="margin-left:auto;color:#909399">{{ editorStore.programInfo?.name || '' }}</span>
    </div>
    <div class="editor-body">
      <div class="left-panel">
        <el-tabs>
          <el-tab-pane label="页面">
            <PageManager />
          </el-tab-pane>
          <el-tab-pane label="素材">
            <AssetLibrary />
          </el-tab-pane>
        </el-tabs>
      </div>
      <div class="canvas-area" ref="canvasContainer">
        <CanvasStage @dblclick="handleCanvasDblClick" />
      </div>
      <div class="right-panel">
        <el-tabs>
          <el-tab-pane label="属性"><PropertyPanel /></el-tab-pane>
          <el-tab-pane label="图层"><LayerPanel /></el-tab-pane>
          <el-tab-pane label="动画"><AnimationPanel /></el-tab-pane>
          <el-tab-pane label="热区"><HotspotEditor /></el-tab-pane>
        </el-tabs>
      </div>
    </div>
    <div class="status-bar">
      <el-slider v-model="zoomPercent" :min="10" :max="300" style="width:200px" @input="onZoomSlide" />
      <span style="margin:0 8px">{{ Math.round(editorStore.zoom * 100) }}%</span>
      <el-button size="small" @click="zoomFit">适应</el-button>
      <el-button size="small" @click="zoom100">100%</el-button>
      <span style="margin-left:auto;color:#999" v-if="editorStore.selectedElement">
        x:{{ Math.round(editorStore.selectedElement.x) }} y:{{ Math.round(editorStore.selectedElement.y) }}
      </span>
    </div>
    <PreviewModal v-model:visible="showPreview" />
    <ExportDialog ref="exportDialogRef" :program-id="editorStore.programId" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, onBeforeRouteLeave } from 'vue-router'
import { useEditorStore } from '@/stores/editor'
import { ElMessage, ElMessageBox } from 'element-plus'
import ToolBar from '@/components/editor/ToolBar.vue'
import CanvasStage from '@/components/editor/CanvasStage.vue'
import PropertyPanel from '@/components/editor/PropertyPanel.vue'
import LayerPanel from '@/components/editor/LayerPanel.vue'
import PageManager from '@/components/editor/PageManager.vue'
import AssetLibrary from '@/components/editor/AssetLibrary.vue'
import AnimationPanel from '@/components/editor/AnimationPanel.vue'
import HotspotEditor from '@/components/editor/HotspotEditor.vue'
import PreviewModal from '@/views/editor/PreviewModal.vue'
import ExportDialog from '@/views/editor/ExportDialog.vue'

const route = useRoute()
const editorStore = useEditorStore()
const showPreview = ref(false)
const showExport = ref(false)
const exportDialogRef = ref()
const canvasContainer = ref<HTMLElement>()

const zoomPercent = computed({
  get: () => Math.round(editorStore.zoom * 100),
  set: (v: number) => editorStore.setZoom(v / 100)
})

onMounted(async () => {
  const id = route.params.programId as string
  await editorStore.loadProgram(id)
  if (canvasContainer.value) {
    editorStore.fitToContainer(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  }
  document.addEventListener('keydown', handleKeyboard)
})

onUnmounted(() => document.removeEventListener('keydown', handleKeyboard))

onBeforeRouteLeave((_to, _from, next) => {
  if (editorStore.isDirty) {
    ElMessageBox.confirm('当前编辑内容尚未保存，是否保存后离开？', '提示', {
      confirmButtonText: '保存并离开',
      cancelButtonText: '不保存直接离开',
      distinguishCancelAndClose: true,
      type: 'warning',
    }).then(() => {
      editorStore.save().then(() => next())
    }).catch((action: string) => {
      if (action === 'cancel') {
        next()
      }
    })
    return
  }
  next()
})

function handleKeyboard(e: KeyboardEvent) {
  if (e.key === 'Delete' && editorStore.selectedElement) {
    editorStore.removeElement(editorStore.selectedElement.id)
  }
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); editorStore.undo() }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); editorStore.redo() }
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); save() }
  if (e.ctrlKey && e.key === 'c') { e.preventDefault(); editorStore.copyElement() }
  if (e.ctrlKey && e.key === 'v') { e.preventDefault(); editorStore.pasteElement() }
}

function addElement(type: string) { editorStore.addElement(type) }
function groupLayers() { /* grouped layers logic */ }

async function save() { await editorStore.save(); ElMessage.success('保存成功') }

function onZoomSlide(v: number) { editorStore.setZoom(v / 100) }
function zoomFit() {
  if (canvasContainer.value) editorStore.fitToContainer(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
}
function zoom100() { editorStore.setZoom(1); editorStore.setPan(0, 0) }

function handleCanvasDblClick() {
  // double click on empty area
}
</script>

<style scoped>
.editor-layout { display: flex; flex-direction: column; height: 100vh; background: #fff; color: #303133; margin: -20px; }
.toolbar { display: flex; align-items: center; padding: 6px 12px; background: #fff; border-bottom: 1px solid #e4e7ed; flex-shrink: 0; }
.editor-body { display: flex; flex: 1; overflow: hidden; }
.left-panel { width: 260px; background: #fafafa; border-right: 1px solid #e4e7ed; overflow-y: auto; flex-shrink: 0; }
.canvas-area { flex: 1; overflow: hidden; position: relative; }
.right-panel { width: 300px; background: #fafafa; border-left: 1px solid #e4e7ed; overflow-y: auto; flex-shrink: 0; }
.status-bar { display: flex; align-items: center; padding: 4px 12px; background: #409eff; color: #fff; font-size: 12px; flex-shrink: 0; }
</style>
