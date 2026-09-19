<template>
  <div class="editor-layout">
    <div class="toolbar">
      <el-button-group>
        <el-button size="small" @click="addElement('text')">文字</el-button>
        <el-button size="small" @click="addElement('button')">按钮</el-button>
        <el-dropdown trigger="click" @command="addControlButton">
          <el-button size="small">
            功能控件<el-icon style="margin-left:4px"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="c in CONTROL_QUICK" :key="c.kind" :command="c.kind">{{ c.label }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-button-group>
      <el-divider direction="vertical" />
      <el-button size="small" :disabled="!canGroup" @click="groupLayers">分组</el-button>
      <el-button v-if="isContainerGroup" size="small" type="danger" plain @click="ungroupLayers">解散分组</el-button>
      <el-dropdown trigger="click" :disabled="!canAddToGroup" @command="addToGroup">
        <el-button size="small" :disabled="!canAddToGroup">
          加入分组<el-icon style="margin-left:4px"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="g in groupList" :key="g.id" :command="g.id">{{ g.label }}</el-dropdown-item>
            <el-dropdown-item v-if="!groupList.length" disabled>暂无分组</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button size="small" :disabled="!canRemoveFromGroup" @click="removeSelectionFromGroup">移出分组</el-button>
      <el-button size="small" :disabled="!editorStore.canUndo" @click="editorStore.undo()">撤销</el-button>
      <el-button size="small" :disabled="!editorStore.canRedo" @click="editorStore.redo()">重做</el-button>
      <el-divider direction="vertical" />
      <el-button size="small" type="primary" @click="save">保存</el-button>
      <el-button size="small" type="success" @click="showPreview = true">预览</el-button>
      <el-button size="small" type="warning" @click="openExport">导出</el-button>
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
          <el-tab-pane label="装饰">
            <DecorLibrary />
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
      <span v-if="editorStore.selectedLayers.length > 1" style="margin-left:auto;color:#eaf3ff">
        已选 {{ editorStore.selectedLayers.length }} 个 · Shift+点击 加选 · 空白拖拽框选 · Ctrl+G 分组
      </span>
      <span style="margin-left:auto;color:#999" v-else-if="editorStore.selectedElement">
        x:{{ Math.round(editorStore.selectedElement.x) }} y:{{ Math.round(editorStore.selectedElement.y) }}
      </span>
      <span style="color:#fff;background:rgba(255,255,255,0.15);padding:1px 8px;border-radius:4px;margin-left:8px">
        画布 {{ editorStore.device.designWidth }}×{{ editorStore.device.designHeight }}
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
import { ArrowDown } from '@element-plus/icons-vue'
import CanvasStage from '@/components/editor/CanvasStage.vue'
import PropertyPanel from '@/components/editor/PropertyPanel.vue'
import LayerPanel from '@/components/editor/LayerPanel.vue'
import PageManager from '@/components/editor/PageManager.vue'
import AssetLibrary from '@/components/editor/AssetLibrary.vue'
import DecorLibrary from '@/components/editor/DecorLibrary.vue'
import AnimationPanel from '@/components/editor/AnimationPanel.vue'
import HotspotEditor from '@/components/editor/HotspotEditor.vue'
import PreviewModal from '@/views/editor/PreviewModal.vue'
import ExportDialog from '@/views/editor/ExportDialog.vue'

const route = useRoute()
const editorStore = useEditorStore()
const showPreview = ref(false)
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

function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return !!el.isContentEditable
}

function handleKeyboard(e: KeyboardEvent) {
  // 正在输入框/文本域里编辑时，复制、粘贴、删除、撤销交给浏览器原生处理，
  // 避免 Ctrl+V 被当成“粘贴画布元素”而无法从外部粘贴文字。
  if (isEditableTarget(e.target)) {
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); save() }
    return
  }
  if (e.key === 'Delete' && editorStore.selectedElement) {
    editorStore.removeElement(editorStore.selectedElement.id)
  }
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); editorStore.undo() }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); editorStore.redo() }
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); save() }
  if (e.ctrlKey && e.key === 'c') { e.preventDefault(); editorStore.copyElement() }
  if (e.ctrlKey && e.key === 'v') { e.preventDefault(); editorStore.pasteElement() }
  if (e.ctrlKey && e.key.toLowerCase() === 'a') { e.preventDefault(); editorStore.selectAllLayers() }
  if (e.ctrlKey && e.key.toLowerCase() === 'g') {
    e.preventDefault()
    if (e.shiftKey) ungroupLayers()
    else groupLayers()
  }
  if (e.key === 'Escape') { editorStore.clearSelection() }
}

function addElement(type: string) { editorStore.addElement(type) }

const canGroup = computed(() => {
  const sels = editorStore.selectedLayers as any[]
  return sels.length >= 2 && sels.every((l: any) => !l.groupParentId && l.element?.type !== 'container')
})
const isContainerGroup = computed(() => {
  const sels = editorStore.selectedLayers as any[]
  return sels.length === 1 && sels[0]?.element?.type === 'container' && (sels[0]?.element?.members || []).length > 0
})

function groupLayers() {
  if (!canGroup.value) {
    ElMessage.info('请先在画布上选中两个及以上的普通元素进行分组')
    return
  }
  editorStore.groupSelection()
}

function ungroupLayers() {
  const l = (editorStore.selectedLayers as any[])[0]
  if (l) editorStore.ungroupContainer(l.element.id)
}

const groupList = computed(() =>
  (editorStore.currentLayers as any[])
    .filter((l: any) => l.element?.type === 'container')
    .map((l: any, i: number) => ({
      id: l.element.id,
      label: `#${i + 1} ${l.name || l.element.name || '分组'}（${(l.element.members || []).length} 项）`,
    }))
)
const selectedNonGroupIds = computed(() =>
  (editorStore.selectedLayers as any[]).filter((l: any) => l.element?.type !== 'container').map((l: any) => l.element.id)
)
const canAddToGroup = computed(() => selectedNonGroupIds.value.length >= 1 && groupList.value.length >= 1)
const canRemoveFromGroup = computed(() =>
  (editorStore.selectedLayers as any[]).some((l: any) => !!l.groupParentId)
)

function addToGroup(groupId: string) {
  if (!groupId || !selectedNonGroupIds.value.length) return
  editorStore.addToContainer(groupId, selectedNonGroupIds.value)
}

function removeSelectionFromGroup() {
  const ids = (editorStore.selectedLayers as any[]).filter((l: any) => l.groupParentId).map((l: any) => l.element.id)
  editorStore.removeFromContainer(ids)
}

const CONTROL_QUICK = [
  { kind: 'prev', label: '上一页' },
  { kind: 'next', label: '下一页' },
  { kind: 'home', label: '首页' },
  { kind: 'last', label: '末页' },
  { kind: 'play', label: '播放' },
  { kind: 'pause', label: '暂停' },
  { kind: 'stop', label: '停止' },
]
function addControlButton(kind: string) { editorStore.addControlButton(kind) }

async function save() { await editorStore.save(); ElMessage.success('保存成功') }

async function openExport() {
  if (editorStore.isDirty) {
    await editorStore.save()
  }
  await exportDialogRef.value?.open()
}

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
