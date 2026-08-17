import { useEditorStore } from '@/stores/editor'

export function useZoom() {
  const store = useEditorStore()

  function handleWheel(e: WheelEvent, containerEl: HTMLElement) {
    if (!e.ctrlKey) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    const rect = containerEl.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const oldZoom = store.zoom
    const newZoom = Math.max(0.1, Math.min(3, oldZoom + delta))
    const scale = newZoom / oldZoom
    store.setZoom(newZoom)
    store.setPan(
      mouseX - (mouseX - store.panX) * scale,
      mouseY - (mouseY - store.panY) * scale
    )
  }

  function zoomIn() { store.setZoom(store.zoom + 0.1) }
  function zoomOut() { store.setZoom(store.zoom - 0.1) }
  function zoomToFit(w: number, h: number) { store.fitToContainer(w, h) }
  function zoomTo100() { store.setZoom(1); store.setPan(0, 0) }

  return { handleWheel, zoomIn, zoomOut, zoomToFit, zoomTo100 }
}
