import type { ElementItem, LayerItem, Hotspot } from '@/types'

let _idCounter = 0
export function genId(prefix: string = ''): string {
  return `${prefix}-${Date.now()}-${_idCounter++}-${Math.random().toString(36).substr(2, 6)}`
}

function createBaseElement(type: string, x: number, y: number, w: number, h: number): ElementItem {
  return {
    id: genId('elem'),
    type,
    name: type,
    x, y, width: w, height: h,
    rotation: 0, scaleX: 1, scaleY: 1,
    anchorX: 0, anchorY: 0,
    opacity: 1, borderRadius: 0
  } as any
}

export function createTextElement(x = 100, y = 200, w = 500, h = 100): ElementItem {
  return {
    ...createBaseElement('text', x, y, w, h),
    name: '文字',
    content: '双击编辑文字',
    fontFamily: 'Microsoft YaHei', fontSize: 32, fontWeight: 'normal',
    fontStyle: 'normal', textAlign: 'center', lineHeight: 1.5,
    letterSpacing: 0, color: '#ffffff',
    textOverflow: 'ellipsis', verticalAlign: 'middle', padding: 10
  }
}

export function createImageElement(x = 100, y = 100, w = 300, h = 200): ElementItem {
  return {
    ...createBaseElement('image', x, y, w, h),
    name: '图片', src: '', srcs: [], srcNames: [], captions: [], captionPositions: [],
    objectFit: 'cover', brightness: 100, contrast: 100, saturation: 100, alt: '',
    currentIndex: 0, imageInterval: 3000, imageTransition: 'fade',
    captionFontSize: 16, captionColor: '#ffffff', captionFontFamily: 'Microsoft YaHei',
    captionTextAlign: 'center', captionFontWeight: 'normal', captionPosition: 'bottom',
    captionOffsetY: 0, captionPadding: 8, captionWidth: 0,
    captionBgEnabled: false, captionBgColor: '#000000', captionBgOpacity: 0.5, captionBgPadding: 8,
    captionStrokeEnabled: false, captionStrokeColor: '#000000', captionStrokeWidth: 2,
    captionShadowBlur: 3,
    captionScrim: false, captionScrimPosition: 'auto', captionAbsolute: true
  }
}

export function createVideoElement(x = 100, y = 100, w = 400, h = 300): ElementItem {
  return {
    ...createBaseElement('video', x, y, w, h),
    name: '视频', src: '', srcs: [], srcNames: [],
    loop: true, autoplay: true, muted: false,
    startAt: 0, endAt: 60, poster: '', volume: 0.8
  }
}

export function createSequenceFrameElement(x = 100, y = 100, w = 300, h = 300): ElementItem {
  return {
    ...createBaseElement('sequenceFrame', x, y, w, h),
    name: '序列帧',
    source: { type: 'folder', frames: [] },
    seqSources: [],
    currentSeqIndex: 0,
    frameRate: 30, direction: 'forward', loop: true, autoplay: true,
    cycleMode: 'manual',
    preloadStrategy: 'all',
    scrub: { enabled: true, sensitivity: 10, dragDirection: 'any' }
  }
}

export function createShapeElement(x = 100, y = 100, w = 200, h = 200): ElementItem {
  return {
    ...createBaseElement('shape', x, y, w, h),
    name: '形状', shapeType: 'rectangle',
    fill: { type: 'solid', color: '#409EFF' },
    stroke: { width: 0, color: '#000000', style: 'solid' },
    points: []
  }
}

export function createContainerElement(x = 100, y = 100, w = 400, h = 300): ElementItem {
  return {
    ...createBaseElement('container', x, y, w, h),
    name: '容器', clipOverflow: true, children: []
  }
}

export function createButtonElement(x = 100, y = 100, w = 120, h = 120): ElementItem {
  return {
    ...createBaseElement('button', x, y, w, h),
    name: '按钮',
    icon: 'play',
    iconColor: '#ffffff',
    iconSize: 60,
    backgroundShape: 'circle',
    fill: '#409EFF',
    stroke: { width: 0, color: '#000000', style: 'solid' },
    cornerRadius: 8
  }
}

const elementCreators: Record<string, (x: number, y: number, w: number, h: number) => ElementItem> = {
  text: createTextElement,
  image: createImageElement,
  video: createVideoElement,
  sequenceFrame: createSequenceFrameElement,
  shape: createShapeElement,
  container: createContainerElement,
  button: createButtonElement
}

const buttonActionMap: Record<string, string> = {
  play: 'playVideo',
  pause: 'pauseVideo',
  stop: 'pauseVideo',
  prev: 'prevPage',
  next: 'nextPage',
  back: 'prevPage',
  home: 'switchPage',
  refresh: 'switchPage',
  fullscreen: 'none',
  close: 'none',
  menu: 'none',
  volume: 'none'
}

export function createLayerFromElement(type: string, x: number, y: number, w: number, h: number): LayerItem {
  const creator = elementCreators[type] || createTextElement
  const element = creator(x, y, w, h)
  let hotspot: Hotspot | null = null
  if (type === 'button') {
    const action = buttonActionMap[element.icon || 'none'] || 'none'
    hotspot = {
      enabled: true, trigger: 'click', action, target: '',
      cursor: 'pointer', highlight: true,
      scope: 'local', targetDeviceCodes: [], commandParams: {}
    }
  }
  return {
    id: genId('layer'),
    name: type,
    locked: false,
    visible: true,
    blendMode: 'normal',
    element,
    animations: [],
    hotspot
  }
}
