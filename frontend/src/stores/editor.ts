import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getProgram, saveConfig } from '@/api/project'
import type { PageItem, LayerItem, ElementItem, Animation, Hotspot, ProgramConfig } from '@/types'
import { createLayerFromElement, genId } from '@/utils/elementFactory'

export const useEditorStore = defineStore('editor', () => {
  const programId = ref('')
  const device = ref({ designWidth: 1920, designHeight: 1080, name: '' })
  const pages = ref<PageItem[]>([])
  const currentPageIndex = ref(0)
  const selectedLayerIds = ref<string[]>([])
  const zoom = ref(1)
  const panX = ref(0)
  const panY = ref(0)
  const isDirty = ref(false)
  const clipboard = ref<LayerItem | null>(null)
  const historyStack = ref<PageItem[][]>([])
  const historyPointer = ref(-1)
  const programInfo = ref<any>(null)
  const unsavedHistoryPointer = ref(-1)

  const currentPage = computed(() => pages.value[currentPageIndex.value] || null)
  const currentLayers = computed(() => currentPage.value?.layers || [])
  const selectedLayers = computed(() => {
    const ids = new Set(selectedLayerIds.value)
    return currentLayers.value.filter(l => ids.has(l.element.id))
  })
  const selectedElement = computed(() => selectedLayers.value[0]?.element || null)
  const canUndo = computed(() => unsavedHistoryPointer.value > 0)
  const canRedo = computed(() => unsavedHistoryPointer.value < historyStack.value.length - 1)

  function pushHistory() {
    const snapshot = JSON.parse(JSON.stringify(pages.value))
    historyStack.value = historyStack.value.slice(0, unsavedHistoryPointer.value + 1)
    historyStack.value.push(snapshot)
    unsavedHistoryPointer.value = historyStack.value.length - 1
    isDirty.value = true
  }

  function undo() {
    if (!canUndo.value) return
    unsavedHistoryPointer.value--
    pages.value = JSON.parse(JSON.stringify(historyStack.value[unsavedHistoryPointer.value]))
    isDirty.value = true
  }

  function redo() {
    if (!canRedo.value) return
    unsavedHistoryPointer.value++
    pages.value = JSON.parse(JSON.stringify(historyStack.value[unsavedHistoryPointer.value]))
    isDirty.value = true
  }

  async function loadProgram(id: string) {
    const res = await getProgram(id)
    programId.value = id
    programInfo.value = res.data
    const config = res.data.config
    if (config) {
      device.value = config.device || { designWidth: 1920, designHeight: 1080, name: '' }
      pages.value = config.pages || []
      migrateCaptionPositions(pages.value)
    } else {
      pages.value = []
    }
    if (pages.value.length === 0) {
      addPage()
    }
    currentPageIndex.value = 0
    selectedLayerIds.value = []
    historyStack.value = [JSON.parse(JSON.stringify(pages.value))]
    unsavedHistoryPointer.value = 0
    historyPointer.value = res.data.current_version || 0
    isDirty.value = false
  }

  function getConfig(): ProgramConfig {
    return { version: '3.0', device: device.value, pages: pages.value }
  }

  async function save() {
    const config = getConfig()
    await saveConfig(programId.value, config)
    isDirty.value = false
    historyPointer.value++
  }

  function addPage(name?: string) {
    pushHistory()
    const page: PageItem = {
      id: genId('page'),
      name: name || `页面${pages.value.length + 1}`,
      duration: 10000,
      transition: 'fade',
      transitionDuration: 500,
      transitionDirection: 'left',
      autoSwitch: true,
      playMode: 'sequential',
      background: { type: 'none', backgroundColor: '#000000' },
      layers: []
    }
    pages.value.push(page)
    currentPageIndex.value = pages.value.length - 1
    pushHistory()
  }

  function removePage(index: number) {
    if (pages.value.length <= 1) return
    pushHistory()
    pages.value.splice(index, 1)
    if (currentPageIndex.value >= pages.value.length) currentPageIndex.value = pages.value.length - 1
    pushHistory()
  }

  function setCurrentPage(index: number) {
    currentPageIndex.value = index
    selectedLayerIds.value = []
  }

  function addElement(type: string, x: number = 100, y: number = 100, w: number = 200, h: number = 100) {
    if (!currentPage.value) return
    pushHistory()
    const layer = createLayerFromElement(type, x, y, w, h)
    currentPage.value.layers.push(layer)
    selectedLayerIds.value = [layer.element.id]
    pushHistory()
  }

  function addSequenceFrameFromDrag(seqData: any, x: number = 100, y: number = 100) {
    if (!currentPage.value) return
    pushHistory()
    const layer = createLayerFromElement('sequenceFrame', x, y, 200, 200)
    layer.element.name = seqData.folderName || '序列帧'
    layer.name = seqData.folderName || '序列帧'
    const frames = (seqData.frames || []).map((f: any) => ({ src: f.src, index: f.index }))
    layer.element.source = { type: 'folder', frames }
    layer.element.seqSources = [{ type: 'folder', frames, name: seqData.folderName || '序列帧', frameCount: frames.length, loopCount: 1 }]
    currentPage.value.layers.push(layer)
    selectedLayerIds.value = [layer.element.id]
    pushHistory()

    const firstSrc = frames[0]?.src || seqData.folderThumbnail
    if (firstSrc) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = `/api/v1/assets/${firstSrc}/file`
      img.onload = () => {
        const maxW = device.value.designWidth * 0.5
        const maxH = device.value.designHeight * 0.5
        const nw = img.naturalWidth || 200
        const nh = img.naturalHeight || 200
        const scale = Math.min(maxW / nw, maxH / nh, 1)
        layer.element.width = Math.round(nw * scale)
        layer.element.height = Math.round(nh * scale)
      }
    }
  }

  function isCloseToElement(el: ElementItem, dropX: number, dropY: number): boolean {
    const left = el.x
    const top = el.y
    const right = el.x + el.width
    const bottom = el.y + el.height
    const margin = Math.min(el.width, el.height) * 0.5
    return dropX >= left - margin && dropX <= right + margin &&
           dropY >= top - margin && dropY <= bottom + margin
  }

  function addElementForAsset(asset: any, x: number = 100, y: number = 100) {
    if (!currentPage.value) return
    pushHistory()

    if (asset.type === 'sequenceFrame' || asset.file_type === 'sequence_folder') {
      const seqData = asset.type === 'sequenceFrame' ? asset : {
        type: 'sequenceFrame',
        folderName: asset.original_name,
        frames: asset.frames || [],
        folderThumbnail: asset.folderThumbnail,
      }

      if (selectedLayerIds.value.length === 1) {
        const selId = selectedLayerIds.value[0]
        const selLayer = currentPage.value.layers.find(l => l.element.id === selId)
        if (selLayer && selLayer.element.type === 'sequenceFrame' && isCloseToElement(selLayer.element, x, y)) {
          const el = selLayer.element
          if (!el.seqSources) el.seqSources = []
          const frames = (seqData.frames || []).map((f: any) => ({ src: f.src, index: f.index }))
          el.seqSources.push({ type: 'folder', frames, name: seqData.folderName || '序列帧', frameCount: frames.length, loopCount: 1 })
          pushHistory()
          return
        }
      }

      addSequenceFrameFromDrag(seqData, x, y)
      return
    }

    if (asset.file_type !== 'video' && selectedLayerIds.value.length === 1) {
      const selId = selectedLayerIds.value[0]
      const selLayer = currentPage.value.layers.find(l => l.element.id === selId)
      if (selLayer && selLayer.element.type === 'image' && isCloseToElement(selLayer.element, x, y)) {
        const el = selLayer.element
        if (!el.srcs) el.srcs = []
        if (el.src && !el.srcs.includes(el.src)) el.srcs.unshift(el.src)
        if (!el.srcs.includes(asset.hash_key)) {
          el.srcs.push(asset.hash_key)
          if (!el.srcNames) el.srcNames = []
          el.srcNames.push(asset.original_name || '')
          if (!el.captions) el.captions = []
          if (el.captions.length < el.srcs.length) {
            el.captions = [...el.captions, ...Array(el.srcs.length - el.captions.length).fill('')]
          }
          if (!el.captionPositions) el.captionPositions = []
          if (el.captionPositions.length < el.srcs.length) {
            el.captionPositions = [...el.captionPositions, ...Array(el.srcs.length - el.captionPositions.length).fill(null)]
          }
        }
        el.src = asset.hash_key
        pushHistory()
        return
      }
    }

    if (asset.file_type === 'video' && selectedLayerIds.value.length === 1) {
      const selId = selectedLayerIds.value[0]
      const selLayer = currentPage.value.layers.find(l => l.element.id === selId)
      if (selLayer && selLayer.element.type === 'video' && isCloseToElement(selLayer.element, x, y)) {
        const el = selLayer.element
        if (!el.srcs) el.srcs = []
        if (el.src && !el.srcs.includes(el.src)) el.srcs.unshift(el.src)
        if (!el.srcs.includes(asset.hash_key)) {
          el.srcs.push(asset.hash_key)
          if (!el.srcNames) el.srcNames = []
          el.srcNames.push(asset.original_name || '')
        }
        el.src = asset.hash_key
        pushHistory()
        return
      }
    }

    const layer = createLayerFromElement(asset.file_type === 'video' ? 'video' : 'image', x, y, 300, 200)
    if (layer.element.type === 'image') {
      layer.element.src = asset.hash_key
      layer.element.srcs = [asset.hash_key]
      layer.element.srcNames = [asset.original_name || '']
      layer.element.captions = [asset.caption || '']
      layer.element.captionPositions = [null]
      layer.element.objectFit = 'cover'
    } else if (layer.element.type === 'video') {
      layer.element.src = asset.hash_key
      layer.element.srcs = [asset.hash_key]
      layer.element.srcNames = [asset.original_name || '']
    }
    layer.name = asset.original_name
    layer.element.name = asset.original_name
    currentPage.value.layers.push(layer)
    selectedLayerIds.value = [layer.element.id]
    pushHistory()
  }

  function updateElement(id: string, props: Record<string, any>) {
    if (!currentPage.value) return
    pushHistory()
    for (const layer of currentPage.value.layers) {
      if (layer.element.id === id) {
        Object.assign(layer.element, props)
        break
      }
    }
    pushHistory()
  }

  function setCaptionPositions(id: string, positions: any[]) {
    if (!currentPage.value) return
    for (const layer of currentPage.value.layers) {
      if (layer.element.id === id) {
        layer.element.captionPositions = positions
        break
      }
    }
  }

  function removeElement(id: string) {
    if (!currentPage.value) return
    pushHistory()
    currentPage.value.layers = currentPage.value.layers.filter(l => l.element.id !== id)
    selectedLayerIds.value = selectedLayerIds.value.filter(sid => sid !== id)
    pushHistory()
  }

  function selectLayer(id: string, multi: boolean = false) {
    if (multi) {
      const idx = selectedLayerIds.value.indexOf(id)
      if (idx >= 0) selectedLayerIds.value.splice(idx, 1)
      else selectedLayerIds.value.push(id)
    } else {
      selectedLayerIds.value = [id]
    }
  }

  function clearSelection() {
    selectedLayerIds.value = []
  }

  function moveLayerUp(id: string) {
    if (!currentPage.value) return
    pushHistory()
    const idx = currentPage.value.layers.findIndex(l => l.element.id === id)
    if (idx < currentPage.value.layers.length - 1) {
      [currentPage.value.layers[idx], currentPage.value.layers[idx + 1]] =
        [currentPage.value.layers[idx + 1], currentPage.value.layers[idx]]
    }
    pushHistory()
  }

  function moveLayerDown(id: string) {
    if (!currentPage.value) return
    pushHistory()
    const idx = currentPage.value.layers.findIndex(l => l.element.id === id)
    if (idx > 0) {
      [currentPage.value.layers[idx], currentPage.value.layers[idx - 1]] =
        [currentPage.value.layers[idx - 1], currentPage.value.layers[idx]]
    }
    pushHistory()
  }

  function moveLayerToTop(id: string) {
    if (!currentPage.value) return
    pushHistory()
    const idx = currentPage.value.layers.findIndex(l => l.element.id === id)
    if (idx >= 0 && idx < currentPage.value.layers.length - 1) {
      const layer = currentPage.value.layers.splice(idx, 1)[0]
      currentPage.value.layers.push(layer)
    }
    pushHistory()
  }

  function moveLayerToBottom(id: string) {
    if (!currentPage.value) return
    pushHistory()
    const idx = currentPage.value.layers.findIndex(l => l.element.id === id)
    if (idx > 0) {
      const layer = currentPage.value.layers.splice(idx, 1)[0]
      currentPage.value.layers.unshift(layer)
    }
    pushHistory()
  }

  function setLayerVisibility(id: string, visible: boolean) {
    if (!currentPage.value) return
    pushHistory()
    const layer = currentPage.value.layers.find(l => l.element.id === id)
    if (layer) layer.visible = visible
    pushHistory()
  }

  function setLayerLock(id: string, locked: boolean) {
    if (!currentPage.value) return
    pushHistory()
    const layer = currentPage.value.layers.find(l => l.element.id === id)
    if (layer) layer.locked = locked
    pushHistory()
  }

  function reorderLayer(fromIdx: number, toIdx: number) {
    if (!currentPage.value) return
    pushHistory()
    const layer = currentPage.value.layers.splice(fromIdx, 1)[0]
    currentPage.value.layers.splice(toIdx, 0, layer)
    pushHistory()
  }

  function reorderPages(fromIdx: number, toIdx: number) {
    pushHistory()
    const page = pages.value.splice(fromIdx, 1)[0]
    pages.value.splice(toIdx, 0, page)
    pushHistory()
  }

  function copyElement() {
    if (selectedLayers.value.length === 0) return
    clipboard.value = JSON.parse(JSON.stringify(selectedLayers.value[0]))
  }

  function pasteElement() {
    if (!clipboard.value || !currentPage.value) return
    pushHistory()
    const newLayer = JSON.parse(JSON.stringify(clipboard.value))
    newLayer.id = genId('layer')
    newLayer.element.id = genId('elem')
    newLayer.element.x += 30
    newLayer.element.y += 30
    currentPage.value.layers.push(newLayer)
    selectedLayerIds.value = [newLayer.element.id]
    pushHistory()
  }

  function addAnimation(layerId: string, anim: Animation) {
    if (!currentPage.value) return
    pushHistory()
    const layer = currentPage.value.layers.find(l => l.element.id === layerId)
    if (layer) layer.animations.push(anim)
    pushHistory()
  }

  function removeAnimation(layerId: string, index: number) {
    if (!currentPage.value) return
    pushHistory()
    const layer = currentPage.value.layers.find(l => l.element.id === layerId)
    if (layer) layer.animations.splice(index, 1)
    pushHistory()
  }

  function setHotspot(layerId: string, hotspot: Hotspot | null) {
    if (!currentPage.value) return
    pushHistory()
    const layer = currentPage.value.layers.find(l => l.element.id === layerId)
    if (layer) layer.hotspot = hotspot
    pushHistory()
  }

  function setPageBackground(layerId: string) {
    if (!currentPage.value) return
    pushHistory()
    const layer = currentPage.value.layers.find(l => l.element.id === layerId)
    if (!layer) return
    const el = layer.element
    if (el.type === 'image') {
      currentPage.value.background = { type: 'image', assetHash: el.src || '', objectFit: 'cover', backgroundColor: '#000000' }
    } else if (el.type === 'video') {
      currentPage.value.background = { type: 'video', assetHash: el.src || '', objectFit: 'cover', backgroundColor: '#000000' }
    }
    pushHistory()
  }

  function setPageBackgroundByHash(type: string, hash: string) {
    if (!currentPage.value) return
    pushHistory()
    currentPage.value.background = { type, assetHash: hash, objectFit: 'cover', backgroundColor: '#000000' }
    pushHistory()
  }

  function clearPageBackground() {
    if (!currentPage.value) return
    pushHistory()
    currentPage.value.background = { type: 'none', backgroundColor: '#000000' }
    pushHistory()
  }
  function setZoom(val: number) {
    zoom.value = Math.max(0.1, Math.min(3, val))
  }

  function setPan(x: number, y: number) {
    panX.value = x
    panY.value = y
  }

  function migrateCaptionPositions(pageList: PageItem[]) {
    for (const page of pageList) {
      for (const layer of page.layers || []) {
        const el = layer.element
        if (!el || el.type !== 'image') continue
        if (el.captionAbsolute) continue
        if (Array.isArray(el.captionPositions)) {
          el.captionPositions = el.captionPositions.map((p: any) => {
            if (p && typeof p.x === 'number' && typeof p.y === 'number') {
              return { x: p.x + (el.x || 0), y: p.y + (el.y || 0) }
            }
            return p
          })
        }
        el.captionAbsolute = true
      }
    }
  }

  function fitToContainer(w: number, h: number) {
    const scaleX = (w - 40) / device.value.designWidth
    const scaleY = (h - 40) / device.value.designHeight
    zoom.value = Math.min(scaleX, scaleY)
    panX.value = (w - device.value.designWidth * zoom.value) / 2
    panY.value = (h - device.value.designHeight * zoom.value) / 2
  }

  return {
    programId, device, pages, currentPageIndex, selectedLayerIds,
    zoom, panX, panY, isDirty, clipboard, historyStack, historyPointer,
    programInfo, unsavedHistoryPointer,
    currentPage, currentLayers, selectedLayers, selectedElement, canUndo, canRedo,
    loadProgram, getConfig, save,
    addPage, removePage, reorderPages, setCurrentPage,
    addElement, addElementForAsset, addSequenceFrameFromDrag, updateElement, removeElement,
    setCaptionPositions,
    selectLayer, clearSelection,
    moveLayerUp, moveLayerDown, moveLayerToTop, moveLayerToBottom,
    setLayerVisibility, setLayerLock, reorderLayer,
    copyElement, pasteElement,
    addAnimation, removeAnimation, setHotspot,
    setZoom, setPan, fitToContainer,
    setPageBackground, clearPageBackground, setPageBackgroundByHash,
    pushHistory, undo, redo
  }
})
