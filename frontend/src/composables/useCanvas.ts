import { ref, computed } from 'vue'
import { useEditorStore } from '@/stores/editor'

export function useCanvas() {
  const editorStore = useEditorStore()
  const containerWidth = ref(800)
  const containerHeight = ref(600)

  const canvasStyle = computed(() => ({
    width: `${editorStore.device.designWidth * editorStore.zoom}px`,
    height: `${editorStore.device.designHeight * editorStore.zoom}px`,
    transform: `translate(${editorStore.panX}px, ${editorStore.panY}px)`,
    transformOrigin: '0 0'
  }))

  function screenToCanvas(sx: number, sy: number) {
    return {
      x: (sx - editorStore.panX) / editorStore.zoom,
      y: (sy - editorStore.panY) / editorStore.zoom
    }
  }

  function canvasToScreen(cx: number, cy: number) {
    return {
      x: cx * editorStore.zoom + editorStore.panX,
      y: cy * editorStore.zoom + editorStore.panY
    }
  }

  return { containerWidth, containerHeight, canvasStyle, screenToCanvas, canvasToScreen }
}
