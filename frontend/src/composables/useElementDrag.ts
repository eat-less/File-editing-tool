import { useEditorStore } from '@/stores/editor'

export function useElementDrag() {
  const store = useEditorStore()

  function handleDragStart(e: any) {
    const node = e.target
    store.selectLayer(node.attrs.elementId)
  }

  function handleDragMove(e: any) {
    const node = e.target
    store.updateElement(node.attrs.elementId, {
      x: node.x(),
      y: node.y()
    })
  }

  function handleDragEnd(e: any) { }

  function handleTransformEnd(e: any) {
    const node = e.target
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    store.updateElement(node.attrs.elementId, {
      x: node.x(),
      y: node.y(),
      width: Math.max(5, node.width() * scaleX),
      height: Math.max(5, node.height() * scaleY),
      rotation: node.rotation(),
      scaleX: 1,
      scaleY: 1
    })
    node.scaleX(1)
    node.scaleY(1)
  }

  return { handleDragStart, handleDragMove, handleDragEnd, handleTransformEnd }
}
