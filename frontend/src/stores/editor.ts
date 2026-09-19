import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getProgram, saveConfig } from '@/api/project'
import type { PageItem, LayerItem, ElementItem, Animation, Hotspot, ProgramConfig } from '@/types'
import { createLayerFromElement, genId } from '@/utils/elementFactory'
import { getDecorDef } from '@/utils/decorShapes'
import { applyButtonPreset, getButtonPreset } from '@/utils/buttonStyles'
import { fitTextSize } from '@/utils/textFit'

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
    if (type === 'text' && layer.element.autoFitText !== false) {
      layer.element.textWrapWidth = device.value.designWidth
      const size = fitTextSize(layer.element, device.value.designWidth, layer.element.textWrapWidth)
      layer.element.width = size.width
      layer.element.height = size.height
    }
    currentPage.value.layers.push(layer)
    selectedLayerIds.value = [layer.element.id]
    pushHistory()
  }

  /** 让文字元素尺寸贴合其内容（自动换行上限为画布宽度）。 */
  function fitTextElement(id: string) {
    if (!currentPage.value) return
    const layer = currentPage.value.layers.find(l => l.element.id === id)
    if (!layer || layer.element.type !== 'text') return
    const size = fitTextSize(layer.element, device.value.designWidth, layer.element.textWrapWidth)
    if (layer.element.width === size.width && layer.element.height === size.height) return
    pushHistory()
    layer.element.width = size.width
    layer.element.height = size.height
    pushHistory()
  }

  function addDecorLayerAt(decorId: string, x?: number, y?: number) {
    if (!currentPage.value) return
    pushHistory()
    const def = getDecorDef(decorId)
    const w = Math.min(def.defaultW, device.value.designWidth * 0.9)
    const h = Math.min(def.defaultH, device.value.designHeight * 0.9)
    const px = x ?? Math.round((device.value.designWidth - w) / 2)
    const py = y ?? Math.round((device.value.designHeight - h) / 2)
    const layer = createLayerFromElement('decor', px, py, w, h)
    const el = layer.element
    el.decorId = decorId
    el.name = def.name
    layer.name = def.name
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
    layer.element.autoplay = true
    layer.element.wholeLoop = false
    layer.element.seqSources = [{
      type: 'folder', frames, name: seqData.folderName || '序列帧', frameCount: frames.length,
      loopCount: 1, fps: undefined, direction: 'forward', flipX: false, contentX: 0,
      move: { enabled: false, to: { x, y }, duration: null },
    }]
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

  const CONTROL_KINDS: Record<string, { icon: string; label: string; action: string }> = {
    prev: { icon: 'prev', label: '上一页', action: 'prevPage' },
    next: { icon: 'next', label: '下一页', action: 'nextPage' },
    home: { icon: 'home', label: '首页', action: 'homePage' },
    last: { icon: 'last', label: '末页', action: 'lastPage' },
    play: { icon: 'play', label: '播放', action: 'play' },
    pause: { icon: 'pause', label: '暂停', action: 'pause' },
    stop: { icon: 'stop', label: '停止', action: 'stop' },
  }

  /** 一键生成带图标+文字+样式的功能按钮（自动写好热区动作）。 */
  function addControlButton(kind: string) {
    if (!currentPage.value) return
    const spec = CONTROL_KINDS[kind]
    if (!spec) return
    pushHistory()
    const w = 170
    const h = 60
    const x = Math.round((device.value.designWidth - w) / 2)
    const y = Math.round((device.value.designHeight - h) / 2 + 220)
    const layer = createLayerFromElement('button', x, y, w, h)
    const el = layer.element
    const preset = getButtonPreset('tech-gradient')
    if (preset) applyButtonPreset(el, preset)
    Object.assign(el, {
      name: spec.label,
      icon: spec.icon,
      label: spec.label,
      labelColor: '#ffffff',
      labelSize: 26,
      labelGap: 12,
      layout: 'row',
      iconSize: 30,
      preset: 'tech-gradient',
      backgroundShape: 'roundedRect',
      cornerRadius: 999,
    })
    layer.name = spec.label
    layer.hotspot = {
      enabled: true, trigger: 'click', action: spec.action,
      target: '', cursor: 'pointer', highlight: true,
      scope: 'local', targetDeviceCodes: [], commandParams: {},
    }
    currentPage.value.layers.push(layer)
    selectedLayerIds.value = [layer.element.id]
    pushHistory()
  }

  // 为图片/视频列表一键生成“上一张/下一张”纯文字控制按钮(热区自动绑定目标元素)
  function addMediaControlButton(mediaElementId: string, direction: 'prev' | 'next') {
    const page = currentPage.value
    if (!page) return
    const mediaLayer = page.layers.find(l => l.element.id === mediaElementId)
    if (!mediaLayer) return
    const me = mediaLayer.element
    if (me.type !== 'image' && me.type !== 'video') return

    pushHistory()
    const w = 110
    const h = 46
    const y = Math.round((me.y || 0) + (me.height || 200) / 2 - h / 2)
    const x = direction === 'prev'
      ? Math.round((me.x || 0) + 16)
      : Math.round((me.x || 0) + (me.width || 300) - w - 16)
    const layer = createLayerFromElement('button', x, y, w, h)
    const el = layer.element
    layer.name = direction === 'prev' ? '上一张' : '下一张'
    el.name = layer.name
    el.icon = ''
    el.label = direction === 'prev' ? '上一张' : '下一张'
    el.labelColor = '#ffffff'
    el.labelSize = 20
    el.backgroundShape = 'roundedRect'
    el.cornerRadius = 23
    el.fill = 'rgba(0,0,0,0.45)'
    layer.hotspot = {
      enabled: true, trigger: 'click',
      action: direction === 'prev' ? 'mediaPrev' : 'mediaNext',
      target: mediaElementId, cursor: 'pointer', highlight: true,
      scope: 'local', targetDeviceCodes: [], commandParams: {},
    }
    page.layers.push(layer)
    selectedLayerIds.value = [el.id]
    pushHistory()
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

  function addElementForAsset(asset: any, x: number = 100, y: number = 100, hitElementId?: string) {
    if (!currentPage.value) return
    pushHistory()

    if (asset.type === 'sequenceFrame' || asset.file_type === 'sequence_folder') {
      const seqData = asset.type === 'sequenceFrame' ? asset : {
        type: 'sequenceFrame',
        folderName: asset.original_name,
        frames: asset.frames || [],
        folderThumbnail: asset.folderThumbnail,
      }

      let targetSeq: ElementItem | null = null
      const hitSeq = hitElementId ? currentPage.value.layers.find(l => l.element.id === hitElementId) : null
      if (hitSeq?.element.type === 'sequenceFrame') targetSeq = hitSeq.element
      if (!targetSeq && selectedLayerIds.value.length === 1) {
        const selId = selectedLayerIds.value[0]
        const selLayer = currentPage.value.layers.find(l => l.element.id === selId)
        if (selLayer?.element.type === 'sequenceFrame' && isCloseToElement(selLayer.element, x, y)) targetSeq = selLayer.element
      }
      if (targetSeq) {
        const el = targetSeq
        if (!el.seqSources) el.seqSources = []
        const frames = (seqData.frames || []).map((f: any) => ({ src: f.src, index: f.index }))
        el.seqSources.push({ type: 'folder', frames, name: seqData.folderName || '序列帧', frameCount: frames.length, loopCount: 1, contentX: 0 })
        pushHistory()
        return
      }

      addSequenceFrameFromDrag(seqData, x, y)
      return
    }

    const isVideo = asset.file_type === 'video'
    const targetType = isVideo ? 'video' : 'image'

    // 优先按鼠标落点的实际元素判定(兼容放大/缩小/旋转后的真实可见区域),
    // 取不到落点元素时再回退到“选中单个同类元素且落点靠近”的旧逻辑。
    let targetEl: ElementItem | null = null
    const hitLayer = hitElementId ? currentPage.value.layers.find(l => l.element.id === hitElementId) : null
    if (hitLayer?.element.type === targetType) targetEl = hitLayer.element
    if (!targetEl && selectedLayerIds.value.length === 1) {
      const selId = selectedLayerIds.value[0]
      const selLayer = currentPage.value.layers.find(l => l.element.id === selId)
      if (selLayer?.element.type === targetType && isCloseToElement(selLayer.element, x, y)) targetEl = selLayer.element
    }

    if (targetEl) {
      const el = targetEl
      if (!el.srcs) el.srcs = []
      if (el.src && !el.srcs.includes(el.src)) el.srcs.unshift(el.src)
      if (!el.srcs.includes(asset.hash_key)) {
        el.srcs.push(asset.hash_key)
        if (!el.srcNames) el.srcNames = []
        el.srcNames.push(asset.original_name || '')
        if (!isVideo) {
          if (!el.captions) el.captions = []
          if (el.captions.length < el.srcs.length) {
            el.captions = [...el.captions, ...Array(el.srcs.length - el.captions.length).fill('')]
          }
          if (!el.captionPositions) el.captionPositions = []
          if (el.captionPositions.length < el.srcs.length) {
            el.captionPositions = [...el.captionPositions, ...Array(el.srcs.length - el.captionPositions.length).fill(null)]
          }
        }
      }
      el.src = asset.hash_key
      pushHistory()
      return
    }

    const layer = createLayerFromElement(targetType, x, y, 300, 200)
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

  function updateElementBatch(id: string, props: Record<string, any>) {
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

  function moveElementWithSeqTargets(id: string, dx: number, dy: number) {
    if (!currentPage.value) return
    pushHistory()
    const layer = currentPage.value.layers.find(l => l.element.id === id)
    if (layer) {
      layer.element.x = Math.round((layer.element.x || 0) + dx)
      layer.element.y = Math.round((layer.element.y || 0) + dy)
      const sources = layer.element.seqSources
      if (Array.isArray(sources)) {
        for (const s of sources) {
          const to = s?.move?.to
          if (to && typeof to.x === 'number') to.x = Math.round(to.x + dx)
          if (to && typeof to.y === 'number') to.y = Math.round(to.y + dy)
        }
      }
    }
    pushHistory()
  }

  const alignCapture = ref<{
    elementId: string
    segIdx: number
    baseX: number
    baseY: number
    dx: number
    dy: number
    active: boolean
    rev: number
  }>({ elementId: '', segIdx: 0, baseX: 0, baseY: 0, dx: 0, dy: 0, active: false, rev: 0 })

  function startAlignCapture(id: string, segIdx: number) {
    if (!currentPage.value) return
    const layer = currentPage.value.layers.find(l => l.element.id === id)
    if (!layer) return
    alignCapture.value = {
      elementId: id, segIdx, baseX: layer.element.x || 0, baseY: layer.element.y || 0,
      dx: 0, dy: 0, active: true, rev: alignCapture.value.rev,
    }
  }

  function setAlignDelta(dx: number, dy: number) {
    if (!alignCapture.value.active) return
    alignCapture.value = { ...alignCapture.value, dx, dy }
  }

  function stopAlignCapture() {
    if (!alignCapture.value.active) return
    alignCapture.value = { ...alignCapture.value, active: false, dx: 0, dy: 0, rev: alignCapture.value.rev + 1 }
  }

  function recordAlignCapture() {
    const cap = alignCapture.value
    if (!cap.active) return
    if (!currentPage.value) { stopAlignCapture(); return }
    const layer = currentPage.value.layers.find(l => l.element.id === cap.elementId)
    if (!layer) { stopAlignCapture(); return }
    pushHistory()
    const el = layer.element
    const seg = (el.seqSources || [])[cap.segIdx]
    if (seg) {
      const prev = typeof seg.contentX === 'number' ? seg.contentX : 0
      seg.contentX = Math.round((prev + cap.dx) * 10) / 10
    }
    el.x = cap.baseX
    el.y = cap.baseY
    alignCapture.value = {
      elementId: '', segIdx: 0, baseX: 0, baseY: 0, dx: 0, dy: 0,
      active: false, rev: alignCapture.value.rev + 1,
    }
    pushHistory()
  }

  function removeElement(id: string) {
    const page = currentPage.value
    if (!page) return
    const target = page.layers.find(l => l.element.id === id)
    if (!target) return
    pushHistory()
    if (target.element.type === 'container') {
      // 删除容器即解散分组,成员还原为普通图层
      ;(target.element.members || []).forEach((mid: string) => {
        const m = page.layers.find(l => l.element.id === mid)
        if (m) m.groupParentId = undefined
      })
    } else {
      // 从所有容器成员表里移除
      page.layers.forEach(l => {
        const mem = l.element.members
        if (Array.isArray(mem)) {
          const i = mem.indexOf(id)
          if (i >= 0) mem.splice(i, 1)
        }
      })
    }
    page.layers = page.layers.filter(l => l.element.id !== id)
    selectedLayerIds.value = selectedLayerIds.value.filter(sid => sid !== id)
    pushHistory()
  }

  function selectLayer(id: string, multi: boolean = false, additiveOnly: boolean = false) {
    if (multi) {
      const idx = selectedLayerIds.value.indexOf(id)
      if (idx >= 0) {
        if (!additiveOnly) selectedLayerIds.value.splice(idx, 1)
      } else {
        selectedLayerIds.value.push(id)
      }
    } else {
      selectedLayerIds.value = [id]
    }
  }

  function setSelection(ids: string[]) {
    selectedLayerIds.value = [...new Set(ids)]
  }

  function addToSelection(ids: string[]) {
    selectedLayerIds.value = [...new Set([...selectedLayerIds.value, ...ids])]
  }

  function selectAllLayers() {
    if (!currentPage.value) return
    selectedLayerIds.value = currentPage.value.layers
      .filter(l => l.visible !== false)
      .map(l => l.element.id)
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

  // ---- 容器(分组):把多个元素编组成容器,移动容器即整体移动;成员仍是普通图层,可单独编辑 ----
  function groupSelection() {
    const page = currentPage.value
    if (!page) return
    const sel = page.layers.filter(l =>
      selectedLayerIds.value.includes(l.element.id) &&
      !l.groupParentId && l.element.type !== 'container'
    )
    if (sel.length < 2) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    sel.forEach((l: any) => {
      const e = l.element
      const x = e.x || 0, y = e.y || 0
      const w = e.width || 0, h = e.height || 0
      minX = Math.min(minX, x); minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h)
    })
    const pad = 10
    pushHistory()
    const layer = createLayerFromElement(
      'container',
      Math.round(minX - pad), Math.round(minY - pad),
      Math.max(20, Math.round(maxX - minX + pad * 2)),
      Math.max(20, Math.round(maxY - minY + pad * 2))
    )
    const groupNo = page.layers.filter(l => l.element.type === 'container').length + 1
    layer.name = `分组${groupNo}`
    layer.element.name = layer.name
    layer.element.members = sel.map((l: any) => l.element.id)
    // 容器放在成员之后之前(靠后),虚线框不遮住内部元素,点击空白处仍可选中/拖动容器
    const indices = sel.map((l: any) => page.layers.indexOf(l)).filter(i => i >= 0)
    const at = Math.min(...indices)
    page.layers.splice(at, 0, layer)
    sel.forEach((l: any) => { l.groupParentId = layer.element.id })
    selectedLayerIds.value = [layer.element.id]
    pushHistory()
  }

  function ungroupContainer(containerId: string) {
    const page = currentPage.value
    if (!page) return
    const cl = page.layers.find(l => l.element.id === containerId)
    if (!cl || cl.element.type !== 'container') return
    const members: string[] = cl.element.members || []
    pushHistory()
    page.layers = page.layers.filter(l => l.element.id !== containerId)
    members.forEach(id => {
      const m = page.layers.find(l => l.element.id === id)
      if (m) m.groupParentId = undefined
    })
    selectedLayerIds.value = [...members]
    pushHistory()
  }

  /** 仅平移分组内的成员。分组框自身的位置由 ContainerElement 的 dragend 写回，
   *  这里不再累加，避免重复计算导致框与成员错位/跳动。 */
  function translateGroupMembers(containerId: string, dx: number, dy: number) {
    if (!currentPage.value) return
    const cl = currentPage.value.layers.find(l => l.element.id === containerId)
    if (!cl || cl.element.type !== 'container') return
    const members: string[] = cl.element.members || []
    if (!members.length || (!dx && !dy)) return
    pushHistory()
    currentPage.value.layers.forEach(l => {
      if (!members.includes(l.element.id)) return
      const e = l.element
      e.x = Math.round((e.x || 0) + dx)
      e.y = Math.round((e.y || 0) + dy)
      const sources = e.seqSources
      if (Array.isArray(sources)) {
        for (const s of sources) {
          const to = s?.move?.to
          if (to && typeof to.x === 'number') to.x = Math.round(to.x + dx)
          if (to && typeof to.y === 'number') to.y = Math.round(to.y + dy)
        }
      }
    })
    pushHistory()
  }

  /** 根据成员元素的包围盒重算容器矩形(带 10px 内边距)。 */
  function fitContainerBounds(containerId: string) {
    const page = currentPage.value
    if (!page) return
    const cl = page.layers.find(l => l.element.id === containerId)
    if (!cl || cl.element.type !== 'container') return
    const members: string[] = cl.element.members || []
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    members.forEach(id => {
      const m = page.layers.find(l => l.element.id === id)
      if (!m) return
      const e: any = m.element
      minX = Math.min(minX, e.x || 0)
      minY = Math.min(minY, e.y || 0)
      maxX = Math.max(maxX, (e.x || 0) + (e.width || 0))
      maxY = Math.max(maxY, (e.y || 0) + (e.height || 0))
    })
    if (!Number.isFinite(minX)) return
    const pad = 10
    cl.element.x = Math.round(minX - pad)
    cl.element.y = Math.round(minY - pad)
    cl.element.width = Math.max(20, Math.round(maxX - minX + pad * 2))
    cl.element.height = Math.max(20, Math.round(maxY - minY + pad * 2))
  }

  function addToContainer(containerId: string, ids: string[]) {
    const page = currentPage.value
    if (!page) return
    const cl = page.layers.find(l => l.element.id === containerId)
    if (!cl || cl.element.type !== 'container') return
    if (!Array.isArray(cl.element.members)) cl.element.members = []
    const members: string[] = cl.element.members
    const targets = ids.filter(id => {
      if (id === containerId) return false
      const l = page.layers.find(x => x.element.id === id)
      return !!l && l.element.type !== 'container'
    })
    if (!targets.length) return
    pushHistory()
    targets.forEach(id => {
      // 先从其它容器移出
      page.layers.forEach(o => {
        if (o.element.type === 'container' && Array.isArray(o.element.members)) {
          const i = o.element.members.indexOf(id)
          if (i >= 0) o.element.members.splice(i, 1)
        }
      })
      if (!members.includes(id)) members.push(id)
      const l = page.layers.find(x => x.element.id === id)
      if (l) l.groupParentId = containerId
    })
    fitContainerBounds(containerId)
    selectedLayerIds.value = [containerId]
    pushHistory()
  }

  function removeFromContainer(ids: string[]) {
    const page = currentPage.value
    if (!page) return
    const targetSet = new Set(ids)
    const isMember = (id: string) => page.layers.some(o =>
      o.element.type === 'container' && Array.isArray(o.element.members) && o.element.members.includes(id)
    )
    const needsChange = ids.some(id => {
      const l = page.layers.find(x => x.element.id === id)
      return !!l && (!!l.groupParentId || isMember(id))
    })
    if (!needsChange) return
    pushHistory()
    page.layers.forEach(o => {
      if (o.element.type === 'container' && Array.isArray(o.element.members)) {
        o.element.members = o.element.members.filter((m: string) => !targetSet.has(m))
      }
    })
    ids.forEach(id => {
      const l = page.layers.find(x => x.element.id === id)
      if (l) l.groupParentId = undefined
    })
    // 还原为普通多选,便于继续操作
    selectedLayerIds.value = ids.filter(id => page.layers.some(l => l.element.id === id))
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

  function pruneLayerFromPage(page: PageItem, layerId: string) {
    page.layers.forEach(l => {
      const mem = l.element.members
      if (Array.isArray(mem)) {
        const i = mem.indexOf(layerId)
        if (i >= 0) mem.splice(i, 1)
      }
    })
    page.layers = page.layers.filter(l => l.element.id !== layerId)
    selectedLayerIds.value = selectedLayerIds.value.filter(id => id !== layerId)
  }

  function setPageBackground(layerId: string) {
    const page = currentPage.value
    if (!page) return
    const layer = page.layers.find(l => l.element.id === layerId)
    if (!layer) return
    const el = layer.element
    if (el.type !== 'image' && el.type !== 'video') return
    pushHistory()
    page.background = {
      type: el.type, assetHash: el.src || '', objectFit: 'cover', backgroundColor: '#000000'
    }
    // 设为背景后该元素不再需要,自动从图层中移除
    pruneLayerFromPage(page, layerId)
    pushHistory()
  }

  // 把图片/视频元素中“某一张素材”设为背景:该素材从列表中移除;若列表已空则整个元素消失
  function setElementAssetAsBackground(layerId: string, hash: string) {
    const page = currentPage.value
    if (!page || !hash) return
    const layer = page.layers.find(l => l.element.id === layerId)
    if (!layer) return
    const el = layer.element
    if (el.type !== 'image' && el.type !== 'video') return
    pushHistory()
    page.background = {
      type: el.type, assetHash: hash, objectFit: 'cover', backgroundColor: '#000000'
    }

    const srcs: string[] = Array.isArray(el.srcs) ? [...el.srcs] : []
    const srcNames: string[] = Array.isArray(el.srcNames) ? [...el.srcNames] : []
    const captions: any[] = Array.isArray(el.captions) ? [...el.captions] : []
    const captionPositions: any[] = Array.isArray(el.captionPositions) ? [...el.captionPositions] : []
    const idx = srcs.indexOf(hash)

    if (idx < 0) {
      // 兼容只有 src、没有 srcs 的旧数据
      if (el.src === hash) pruneLayerFromPage(page, layerId)
      pushHistory()
      return
    }

    srcs.splice(idx, 1)
    srcNames.splice(idx, 1)
    if (captions.length > idx) captions.splice(idx, 1)
    if (captionPositions.length > idx) captionPositions.splice(idx, 1)

    if (srcs.length === 0) {
      pruneLayerFromPage(page, layerId)
    } else {
      el.srcs = srcs
      el.srcNames = srcNames
      if (el.type === 'image') {
        el.captions = captions
        el.captionPositions = captionPositions
      }
      el.src = srcs[0]
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
    addElement, addDecorLayerAt, addControlButton, addElementForAsset, addSequenceFrameFromDrag, updateElement, updateElementBatch, removeElement, fitTextElement,
    setCaptionPositions,
    moveElementWithSeqTargets,
    alignCapture, startAlignCapture, setAlignDelta, stopAlignCapture, recordAlignCapture,
    selectLayer, setSelection, addToSelection, selectAllLayers, clearSelection,
    moveLayerUp, moveLayerDown, moveLayerToTop, moveLayerToBottom,
    setLayerVisibility, setLayerLock, reorderLayer,
    groupSelection, ungroupContainer, translateGroupMembers,
    addToContainer, removeFromContainer, fitContainerBounds,
    addMediaControlButton,
    copyElement, pasteElement,
    addAnimation, removeAnimation, setHotspot,
    setZoom, setPan, fitToContainer,
    setPageBackground, clearPageBackground, setPageBackgroundByHash, setElementAssetAsBackground,
    pushHistory, undo, redo
  }
})
