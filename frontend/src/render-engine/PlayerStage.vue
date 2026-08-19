<template>
  <div ref="stageContainer" class="player-stage" :style="{ background: '#000' }">
    <div v-if="currentPageData" class="player-page" :style="pageStyle" :class="transitionClass">
      <div class="player-bg" :style="bgStyle">
        <img v-if="currentPageData.background?.type === 'image' && currentPageData.background.assetHash"
             :src="assetUrl(currentPageData.background.assetHash)" :style="bgMediaStyle" />
        <video v-else-if="currentPageData.background?.type === 'video' && currentPageData.background.assetHash"
               :src="assetUrl(currentPageData.background.assetHash)" :style="bgMediaStyle"
               autoplay loop muted />
      </div>

      <div v-for="layer in currentPageData.layers" :key="layer.id"
           v-show="layer.visible !== false"
           class="player-element"
           :style="getElementStyle(layer.element)"
           @click="onElementClick(layer)"
           :class="{ 'seq-scrub': isSeqScrub(layer.element) }"
           @pointerdown="onSeqPointerDown($event, layer.element)"
           @pointermove="onSeqPointerMove($event, layer.element)"
           @pointerup="onSeqPointerUp(layer.element)"
           @pointerleave="onSeqPointerUp(layer.element)">

        <template v-if="layer.element.type === 'image'">
          <img v-for="(src, idx) in getImageSrcs(layer.element)" :key="idx"
               :src="assetUrl(src)"
               :style="{ width: '100%', height: '100%', objectFit: layer.element.objectFit || 'cover', position: 'absolute', inset: 0, transition: 'opacity 0.5s', opacity: getImageOpacity(layer.element, idx) }" />
          <div v-if="getScrimStyle(layer.element)" class="player-scrim" :style="getScrimStyle(layer.element)"></div>
          <div v-if="showMediaControls(layer.element)" class="player-media-controls">
            <button class="mini-btn" @click.stop="cycleMedia(layer.element, -1)">◀</button>
            <span class="mini-label">{{ (mediaIndex[layer.element.id] || 0) + 1 }} / {{ getImageSrcs(layer.element).length }}</span>
            <button class="mini-btn" @click.stop="cycleMedia(layer.element, 1)">▶</button>
          </div>
        </template>

        <div v-else-if="layer.element.type === 'text'" class="player-text" :style="getTextStyle(layer.element)">{{ getTextDisplay(layer.element) }}</div>

        <div v-else-if="layer.element.type === 'video'" class="player-video">
          <video v-if="videoCurrentSrc[layer.element.id]"
                 :ref="(el: any) => registerVideo(el, layer.element.id)"
                 :src="assetUrl(videoCurrentSrc[layer.element.id])"
                 style="width:100%;height:100%;object-fit:cover"
                 :loop="layer.element.loop" autoplay :muted="layer.element.muted"
                 :controls="videoControls"
                 :volume="layer.element.volume ?? 0.8"
                 @dblclick.stop="toggleVideoPlay(layer.element.id)" />
          <div v-else-if="hasMultipleVideos(layer.element)" class="player-video-placeholder">▶ 视频</div>
          <div v-else class="player-video-placeholder">▶ 视频</div>
          <div v-if="showMediaControls(layer.element)" class="player-media-controls">
            <button class="mini-btn" @click.stop="cycleMedia(layer.element, -1)">◀</button>
            <span class="mini-label">{{ (mediaIndex[layer.element.id] || 0) + 1 }} / {{ getVideoSrcs(layer.element).length }}</span>
            <button class="mini-btn" @click.stop="cycleMedia(layer.element, 1)">▶</button>
          </div>
        </div>

        <div v-else-if="layer.element.type === 'sequenceFrame'" class="player-seq">
          <img v-if="seqCurrentImg[layer.element.id]" :src="assetUrl(seqCurrentImg[layer.element.id])"
               style="width:100%;height:100%;display:block;user-select:none" draggable="false" />
          <div v-else class="player-seq-placeholder">序列帧</div>
        </div>

        <div v-else-if="layer.element.type === 'button'" class="player-button" :style="getButtonStyle(layer.element)">
          <svg :width="layer.element.iconSize || 60" :height="layer.element.iconSize || 60" viewBox="0 0 24 24"
               :fill="layer.element.iconColor || '#ffffff'" style="pointer-events:none">
            <path :d="getIconPath(layer.element.icon || 'play')" />
          </svg>
        </div>

        <div v-else-if="layer.element.type === 'shape'" class="player-shape">
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="overflow:visible">
            <rect v-if="getShapeTag(layer.element) === 'rectangle'" x="0" y="0" width="100" height="100" rx="6"
                  :fill="getShapeFill(layer.element)" :stroke="getShapeStroke(layer.element)"
                  :stroke-width="getShapeStrokeWidth(layer.element)" />
            <circle v-else-if="getShapeTag(layer.element) === 'circle'" cx="50" cy="50" r="50"
                    :fill="getShapeFill(layer.element)" :stroke="getShapeStroke(layer.element)"
                    :stroke-width="getShapeStrokeWidth(layer.element)" />
            <polygon v-else-if="getShapeTag(layer.element) === 'triangle'" :points="'50,5 95,90 5,90'"
                     :fill="getShapeFill(layer.element)" :stroke="getShapeStroke(layer.element)"
                     :stroke-width="getShapeStrokeWidth(layer.element)" />
            <line v-else-if="getShapeTag(layer.element) === 'line'" x1="5" y1="95" x2="95" y2="5"
                  :stroke="getShapeStroke(layer.element)" :stroke-width="getShapeStrokeWidth(layer.element) || 3" />
            <polygon v-else :points="getPolygonPoints(layer.element)"
                     :fill="getShapeFill(layer.element)" :stroke="getShapeStroke(layer.element)"
                     :stroke-width="getShapeStrokeWidth(layer.element)" />
          </svg>
        </div>

        <div v-else-if="layer.element.type === 'container'" class="player-container" :style="containerStyle(layer.element)">
          <template v-for="child in (layer.element.children || [])" :key="child.id">
            <div v-if="child.type === 'text'" class="player-text" :style="getChildStyle(child)">{{ childText(child) }}</div>
            <img v-else-if="child.type === 'image' && child.src" :src="assetUrl(child.src)"
                 :style="getChildStyle(child, child.objectFit || 'cover')" />
          </template>
        </div>

        <div v-else class="player-placeholder">{{ layer.element.type }}</div>
      </div>

      <div v-for="layer in imageCaptionLayers" :key="'caption-' + layer.element.id">
        <div v-if="getImageCaption(layer.element)" class="player-caption"
             :style="getImageCaptionStyle(layer.element)">{{ getImageCaptionDisplay(layer.element) }}</div>
      </div>
    </div>

    <div v-else class="player-empty">无内容</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, reactive } from 'vue'
import { getIconPath } from '@/utils/icons'
import { getTypewriterInterval, getEnterDuration } from '@/utils/appearEffect'
import type { ProgramConfig, PageItem, LayerItem, Hotspot } from '@/types'

const props = defineProps<{
  config: ProgramConfig | null
  assetUrl: (hash: string) => string
  onCrossDevice?: (hotspot: Hotspot) => void
  onState?: (state: { pageIndex: number; pageCount: number; playing: boolean }) => void
  startIndex?: number
  autoPlay?: boolean
  videoControls?: boolean
  fill?: boolean
}>()

const stageContainer = ref<HTMLElement>()
const containerSize = reactive({ width: 0, height: 0 })
let resizeObserver: ResizeObserver | null = null

const pages = computed<PageItem[]>(() => props.config?.pages || [])
const device = computed(() => props.config?.device || { designWidth: 1920, designHeight: 1080, name: '' })

const currentPage = ref(props.startIndex ?? 0)
const playing = ref(props.autoPlay !== false)
const isTransitioning = ref(false)
const transitionDir = ref('')

const currentPageData = computed(() => pages.value[currentPage.value] || null)
const imageCaptionLayers = computed(() =>
  (currentPageData.value?.layers || []).filter(l => l.element.type === 'image')
)

const pageStyle = computed(() => {
  const dw = device.value.designWidth || 1920
  const dh = device.value.designHeight || 1080
  const cw = Math.max(containerSize.width, window.innerWidth || 800)
  const ch = Math.max(containerSize.height, window.innerHeight || 600)
  const fitScale = Math.min(cw / dw, ch / dh)
  const scale = props.fill ? fitScale : Math.min(fitScale, 1)
  return {
    width: `${dw}px`,
    height: `${dh}px`,
    position: 'relative' as const,
    overflow: 'hidden',
    transform: `scale(${scale})`,
    transformOrigin: 'center center',
    backgroundColor: '#000',
  }
})

const transitionClass = computed(() => {
  if (!isTransitioning.value) return ''
  const page = pages.value[currentPage.value]
  const t = page?.transition || 'fade'
  if (t === 'none') return ''
  return `tr-${t} tr-${transitionDir.value || 'in'}`
})

const bgStyle = computed(() => {
  const bg = currentPageData.value?.background
  return {
    position: 'absolute' as const, inset: 0,
    backgroundColor: bg?.backgroundColor || '#000000'
  }
})

const bgMediaStyle = computed(() => {
  const bg = currentPageData.value?.background
  const filters: string[] = []
  if (bg?.opacity !== undefined && bg.opacity < 1) filters.push(`opacity(${bg.opacity})`)
  if (bg?.brightness !== undefined && bg.brightness !== 100) filters.push(`brightness(${bg.brightness}%)`)
  if (bg?.blur && bg.blur > 0) filters.push(`blur(${bg.blur}px)`)
  return {
    width: '100%', height: '100%',
    objectFit: (bg?.type === 'image' ? 'fill' : (bg?.objectFit || 'cover')) as any,
    position: 'absolute' as const, inset: 0,
    filter: filters.length ? filters.join(' ') : 'none',
  }
})

function getElementStyle(el: any) {
  const animOffset = elementMoveOffset.value[el.id]
  const hasMove = animOffset !== undefined
  const dur = elementMoveDuration.value[el.id] || 3000
  const left = hasMove ? (animOffset?.x ?? el.x) : el.x
  const top = hasMove ? (animOffset?.y ?? el.y) : el.y
  const transition = hasMove ? `left ${dur}ms linear, top ${dur}ms linear` : 'none'
  return {
    position: 'absolute' as const,
    left: `${left}px`,
    top: `${top}px`,
    width: `${el.width}px`, height: `${el.height}px`,
    transform: `rotate(${el.rotation || 0}deg)`,
    opacity: el.opacity ?? 1,
    borderRadius: `${el.borderRadius || 0}px`,
    transition,
    zIndex: el.zIndex || 1,
  }
}

function getChildStyle(child: any, objectFit?: string): Record<string, any> {
  return {
    position: 'absolute',
    left: `${child.x || 0}px`,
    top: `${child.y || 0}px`,
    width: `${child.width || 100}px`,
    height: `${child.height || 100}px`,
    objectFit: objectFit || 'cover',
    color: child.color || '#fff',
    fontSize: `${child.fontSize || 16}px`,
    textAlign: (child.textAlign || 'left') as any,
    lineHeight: child.lineHeight || 1.4,
  }
}

function childText(child: any): string {
  return typeof child.content === 'string' ? child.content : (extractRichText(child.content) || '')
}

// ---------- text ----------
const typedTexts = ref<Record<string, string>>({})
const textAppear = ref<Record<string, { opacity: number; y: number }>>({})
const appearDuration = ref<Record<string, number>>({})
const typeTimers = new Map<string, ReturnType<typeof setInterval>>()

function extractRichText(content: any): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (content.text) return content.text
  const parts: string[] = []
  const walk = (node: any) => {
    if (!node) return
    if (node.type === 'text') {
      parts.push(node.text || '')
    }
    if (Array.isArray(node.content)) node.content.forEach(walk)
  }
  walk(content)
  return parts.join('')
}

function getTextDisplay(el: any): string {
  if ((el.appearEffect || 'none') === 'typewriter') return typedTexts.value[el.id] ?? ''
  return typeof el.content === 'string' ? el.content : (extractRichText(el.content) || '文字')
}

function getTextStyle(el: any) {
  const style: Record<string, any> = {
    fontSize: `${el.fontSize || 32}px`,
    fontFamily: el.fontFamily || 'Microsoft YaHei',
    fontWeight: el.fontWeight || 'normal',
    fontStyle: el.fontStyle || 'normal',
    color: el.color || '#fff',
    textAlign: el.textAlign || 'center',
    lineHeight: el.lineHeight || 1.5,
    letterSpacing: `${el.letterSpacing || 0}px`,
    width: '100%',
    height: '100%',
    padding: `${el.padding || 0}px`,
    boxSizing: 'border-box',
    overflow: 'hidden',
    wordBreak: 'break-word',
    display: 'flex',
    alignItems: el.verticalAlign === 'top' ? 'flex-start' : el.verticalAlign === 'bottom' ? 'flex-end' : 'center',
    justifyContent: el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center',
  }
  const appear = textAppear.value[el.id]
  if (appear) {
    const dur = appearDuration.value[el.id] || 800
    style.opacity = appear.opacity
    style.transform = `translateY(${appear.y}px)`
    style.transition = `opacity ${dur}ms ease, transform ${dur}ms ease`
  }
  return style
}

function stopTypewriter(key: string) {
  const t = typeTimers.get(key)
  if (t) { clearInterval(t); typeTimers.delete(key) }
}

function startTypewriter(key: string, text: string, speed?: string) {
  stopTypewriter(key)
  typedTexts.value = { ...typedTexts.value, [key]: '' }
  if (!text) return
  let i = 0
  const timer = setInterval(() => {
    i++
    typedTexts.value = { ...typedTexts.value, [key]: text.slice(0, i) }
    if (i >= text.length) { clearInterval(timer); typeTimers.delete(key) }
  }, getTypewriterInterval(speed))
  typeTimers.set(key, timer)
}

function setAppear(key: string, effect: string, speed?: string) {
  if (effect === 'none' || effect === 'typewriter') return
  const from = effect === 'fade' ? { opacity: 0, y: 0 } : { opacity: 0, y: 30 }
  appearDuration.value = { ...appearDuration.value, [key]: getEnterDuration(speed) }
  textAppear.value = { ...textAppear.value, [key]: from }
  setTimeout(() => {
    textAppear.value = { ...textAppear.value, [key]: { opacity: 1, y: 0 } }
  }, 20)
}

function applyTextAppearEffects() {
  typeTimers.forEach(t => clearInterval(t))
  typeTimers.clear()
  typedTexts.value = {}
  textAppear.value = {}
  appearDuration.value = {}
  const page = currentPageData.value
  if (!page) return
  for (const layer of page.layers) {
    const el = layer.element
    if (el.type === 'text') {
      const eff = el.appearEffect || 'none'
      if (eff === 'typewriter') startTypewriter(el.id, getTextDisplay(el), el.appearSpeed)
      else setAppear(el.id, eff, el.appearSpeed)
    } else if (el.type === 'image') {
      const eff = el.captionAppearEffect || 'none'
      const key = `cap-${el.id}`
      if (eff === 'typewriter') startTypewriter(key, getImageCaption(el), el.captionAppearSpeed)
      else setAppear(key, eff, el.captionAppearSpeed)
    }
  }
}

// ---------- image / video ----------
const videoRefs = new Map<string, HTMLVideoElement>()
const videoRegistered = new Set<string>()
const videoCurrentSrc = ref<Record<string, string>>({})
const mediaIndex = ref<Record<string, number>>({})
const mediaTimers = new Map<string, ReturnType<typeof setInterval>>()
const imageCycleIndex = ref<Record<string, number>>({})
const imageCycleTimers = new Map<string, ReturnType<typeof setInterval>>()

function registerVideo(el: any, elementId: string) {
  if (el && !videoRegistered.has(elementId)) {
    videoRefs.set(elementId, el)
    videoRegistered.add(elementId)
    el.play().catch(() => {})
  }
}

function toggleVideoPlay(elementId: string) {
  const video = videoRefs.get(elementId)
  if (!video) return
  if (video.paused) {
    video.play().catch(() => {})
  } else {
    video.pause()
  }
}

function getImageSrcs(el: any): string[] {
  if (Array.isArray(el.srcs) && el.srcs.length > 0) return el.srcs
  return el.src ? [el.src] : []
}

function getVideoSrcs(el: any): string[] {
  if (Array.isArray(el.srcs) && el.srcs.length > 0) return el.srcs
  return el.src ? [el.src] : []
}

function hasMultipleVideos(el: any): boolean {
  return getVideoSrcs(el).length > 1
}

function getCycleMode(el: any): string {
  return el.cycleMode || (el.type === 'video' ? 'manual' : 'both')
}

function showMediaControls(el: any): boolean {
  const srcs = el.type === 'video' ? getVideoSrcs(el) : getImageSrcs(el)
  if (srcs.length <= 1) return false
  const mode = getCycleMode(el)
  return mode === 'manual' || mode === 'both'
}

function shouldAutoCycle(el: any): boolean {
  const srcs = el.type === 'video' ? getVideoSrcs(el) : getImageSrcs(el)
  if (srcs.length <= 1) return false
  const mode = getCycleMode(el)
  return mode === 'auto' || mode === 'both'
}

function cycleMedia(el: any, direction: number) {
  const srcs = el.type === 'video' ? getVideoSrcs(el) : getImageSrcs(el)
  if (srcs.length <= 1) return
  const current = mediaIndex.value[el.id] || 0
  const next = (current + direction + srcs.length) % srcs.length
  mediaIndex.value = { ...mediaIndex.value, [el.id]: next }
  if (el.type === 'video') {
    videoCurrentSrc.value = { ...videoCurrentSrc.value, [el.id]: srcs[next] }
    stopVideoCycle(el.id)
  } else {
    imageCycleIndex.value = { ...imageCycleIndex.value, [el.id]: next }
    reapplyCaptionEffect(el)
  }
}

function getImageOpacity(el: any, idx: number): number {
  const srcs = getImageSrcs(el)
  if (srcs.length <= 1) return 1
  const current = imageCycleIndex.value[el.id] || 0
  return idx === current ? 1 : 0
}

function reapplyCaptionEffect(el: any) {
  const eff = el.captionAppearEffect || 'none'
  if (eff === 'none') return
  const key = `cap-${el.id}`
  if (eff === 'typewriter') startTypewriter(key, getImageCaption(el), el.captionAppearSpeed)
  else setAppear(key, eff, el.captionAppearSpeed)
}

function startImageCycling() {
  stopImageCycling()
  pages.value.forEach(page => {
    page.layers.forEach(layer => {
      if (layer.element.type !== 'image') return
      if (!shouldAutoCycle(layer.element)) return
      const srcs = getImageSrcs(layer.element)
      if (srcs.length <= 1) return
      const el = layer.element
      const interval = el.imageInterval || 3000
      if (imageCycleIndex.value[el.id] === undefined) {
        imageCycleIndex.value = { ...imageCycleIndex.value, [el.id]: 0 }
      }
      const timer = setInterval(() => {
        const current = imageCycleIndex.value[el.id] || 0
        imageCycleIndex.value = { ...imageCycleIndex.value, [el.id]: (current + 1) % srcs.length }
        reapplyCaptionEffect(el)
      }, interval)
      imageCycleTimers.set(el.id, timer)
    })
  })
}

function stopImageCycling() {
  imageCycleTimers.forEach(t => clearInterval(t))
  imageCycleTimers.clear()
  imageCycleIndex.value = {}
}

function startVideoCycling() {
  stopVideoCycling()
  pages.value.forEach(page => {
    page.layers.forEach(layer => {
      if (layer.element.type !== 'video') return
      const el = layer.element
      const srcs = getVideoSrcs(el)
      const src = srcs[0]
      if (src) {
        videoCurrentSrc.value = { ...videoCurrentSrc.value, [el.id]: src }
        mediaIndex.value = { ...mediaIndex.value, [el.id]: 0 }
      }
      if (!shouldAutoCycle(el) || srcs.length <= 1) return
      const interval = el.imageInterval || el.videoInterval
      if (interval) {
        const timer = setInterval(() => {
          const cur = mediaIndex.value[el.id] || 0
          const next = (cur + 1) % srcs.length
          mediaIndex.value = { ...mediaIndex.value, [el.id]: next }
          videoCurrentSrc.value = { ...videoCurrentSrc.value, [el.id]: srcs[next] }
        }, interval)
        mediaTimers.set(el.id, timer)
      } else {
        const advanceTimer = setInterval(() => {
          const video = videoRefs.get(el.id)
          if (video && video.ended) {
            const cur = mediaIndex.value[el.id] || 0
            const next = (cur + 1) % srcs.length
            mediaIndex.value = { ...mediaIndex.value, [el.id]: next }
            videoCurrentSrc.value = { ...videoCurrentSrc.value, [el.id]: srcs[next] }
          }
        }, 500)
        mediaTimers.set(el.id, advanceTimer)
      }
    })
  })
}

function stopVideoCycle(elId?: string) {
  if (elId) {
    const t = mediaTimers.get(elId)
    if (t) { clearInterval(t); mediaTimers.delete(elId) }
    return
  }
  videoRefs.forEach(v => { try { v.pause() } catch {} })
}

function stopVideoCycling() {
  mediaTimers.forEach(t => clearInterval(t))
  mediaTimers.clear()
}

function playAllVideos() {
  videoRefs.forEach(v => { try { v.play().catch(() => {}) } catch {} })
}

function pauseAllVideos() {
  videoRefs.forEach(v => { try { v.pause() } catch {} })
}

// ---------- captions ----------
function getImageCaption(el: any): string {
  const captions = el.captions
  if (!Array.isArray(captions) || captions.length === 0) return ''
  const idx = imageCycleIndex.value[el.id] || 0
  if (idx >= captions.length) return ''
  return captions[idx] || ''
}

function getImageCaptionDisplay(el: any): string {
  if ((el.captionAppearEffect || 'none') === 'typewriter') return typedTexts.value[`cap-${el.id}`] ?? ''
  return getImageCaption(el)
}

function hexToRgba(hex: string, opacity: number): string {
  const h = (hex || '').replace('#', '')
  let r = 0, g = 0, b = 0
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16); g = parseInt(h[1] + h[1], 16); b = parseInt(h[2] + h[2], 16)
  } else if (h.length === 6) {
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16)
  }
  const o = Math.min(Math.max(opacity, 0), 1)
  return `rgba(${r},${g},${b},${o})`
}

function getImageCaptionStyle(el: any): Record<string, string> {
  const pos = el.captionPosition || 'bottom'
  const font = (el.captionFontSize || 16) + 'px'
  const color = el.captionColor || '#ffffff'
  const family = el.captionFontFamily || 'Microsoft YaHei'
  const align = el.captionTextAlign || 'center'
  const weight = el.captionFontWeight || 'normal'
  const blur = el.captionShadowBlur ?? 3
  const bgEnabled = !!el.captionBgEnabled
  const idx = imageCycleIndex.value[el.id] || 0
  const positions = el.captionPositions
  const capW = (el.captionWidth || el.width || 300) + 'px'
  let left = '0', topVal: string
  if (Array.isArray(positions) && positions[idx]) {
    left = positions[idx].x + 'px'
    topVal = positions[idx].y + 'px'
  } else {
    const pad = el.captionPadding ?? 8
    const h = el.height || 200
    const fontPx = el.captionFontSize || 16
    const bgPad = bgEnabled ? (el.captionBgPadding ?? 8) : 0
    const barH = fontPx * 1.4 + bgPad * 2
    left = ((el.x || 0) + pad) + 'px'
    topVal = ((el.y || 0) + (pos === 'top' ? pad : h - barH - bgPad)) + 'px'
  }
  const style: Record<string, string> = {
    fontSize: font, color, fontFamily: family,
    textAlign: align, fontWeight: weight, width: capW,
    left, top: topVal,
    lineHeight: '1.4', whiteSpace: 'pre-line',
    boxSizing: 'border-box',
    backgroundColor: bgEnabled ? hexToRgba(el.captionBgColor || '#000000', el.captionBgOpacity ?? 0.5) : 'transparent',
    padding: bgEnabled ? `${el.captionBgPadding ?? 8}px` : '0',
    borderRadius: bgEnabled ? '4px' : '0',
    WebkitTextStroke: el.captionStrokeEnabled ? `${el.captionStrokeWidth || 2}px ${el.captionStrokeColor || '#000000'}` : '0',
    textShadow: `0 1px ${blur}px rgba(0,0,0,0.5)`,
  }
  const appear = textAppear.value[`cap-${el.id}`]
  if (appear) {
    const dur = appearDuration.value[`cap-${el.id}`] || 800
    style.opacity = String(appear.opacity)
    style.transform = `translateY(${appear.y}px)`
    style.transition = `opacity ${dur}ms ease, transform ${dur}ms ease`
  }
  return style
}

function getScrimStyle(el: any): Record<string, string> | null {
  if (!el.captionScrim) return null
  const pos = el.captionScrimPosition || 'auto'
  const dir = pos === 'auto' ? (el.captionPosition || 'bottom') : pos
  if (dir === 'top') {
    return {
      top: '0', left: '0', width: '100%', height: '30%',
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0))'
    }
  }
  if (dir === 'bottom') {
    return {
      bottom: '0', left: '0', width: '100%', height: '30%',
      background: 'linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0))'
    }
  }
  return {
    top: '0', left: '0', width: '100%', height: '100%',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.45) 100%)'
  }
}

// ---------- sequence frames ----------
const seqCurrentImg = ref<Record<string, string>>({})
const seqTimers = new Map<string, { clear: () => void }>()
const seqFrameIndices = new Map<string, number>()

function calcSeqFirstSourceDuration(el: any): number {
  const sources = el.seqSources || (el.source?.frames?.length ? [el.source] : [])
  if (!sources.length) return 0
  const fps = el.frameRate || 30
  const first = sources[0]
  const frames = first.frames?.length || first.frameCount || 0
  const loop = first.loopCount || 1
  return (frames / fps) * (loop === -1 ? 1 : loop)
}

function getSeqSources(el: any): any[] {
  if (Array.isArray(el.seqSources) && el.seqSources.length > 0) return el.seqSources
  if (el.source?.frames?.length) return [{ frames: el.source.frames, loopCount: el.loop !== false ? -1 : 1 }]
  return []
}

function startSequenceAnimations() {
  stopSequenceAnimations()
  const img: Record<string, string> = {}

  pages.value.forEach(page => {
    page.layers.forEach(layer => {
      if (layer.element.type !== 'sequenceFrame') return
      const el = layer.element
      const sources = getSeqSources(el)
      if (sources.length === 0) return

      const firstFrames = sources[0]?.frames || []
      if (firstFrames[0]) img[el.id] = firstFrames[0].src

      if (el.autoplay === false) return

      const direction = el.direction || 'forward'
      const fps = el.frameRate || 30
      const cycleMode = el.cycleMode || 'manual'

      let seqIdx = 0
      let frameIdx = 0
      let dir = 1
      let currentLoop = 1
      let timerId: ReturnType<typeof setInterval> | null = null

      function advanceToNext() {
        if (timerId) { clearInterval(timerId); timerId = null }
        seqIdx++
        if (seqIdx >= sources.length) {
          if (cycleMode === 'auto' || cycleMode === 'both') {
            seqIdx = 0
            startSource()
          }
        } else {
          startSource()
        }
      }

      function startSource() {
        if (timerId) { clearInterval(timerId); timerId = null }
        const source = sources[seqIdx]
        if (!source) return
        const frames = source?.frames || []
        if (frames.length === 0) { advanceToNext(); return }

        const loopCount = source.loopCount || 1
        const isInfinite = loopCount === -1
        frameIdx = 0
        currentLoop = 1
        dir = 1
        seqFrameIndices.set(el.id, 0)

        if (frames.length === 1) {
          img[el.id] = frames[0].src
          seqCurrentImg.value = { ...img }
          advanceToNext()
          return
        }

        timerId = setInterval(() => {
          const total = frames.length
          if (direction === 'forward') {
            frameIdx++
            if (frameIdx >= total) {
              if (isInfinite || currentLoop < loopCount) {
                frameIdx = 0
                if (!isInfinite) currentLoop++
              } else {
                advanceToNext()
                return
              }
            }
          } else if (direction === 'reverse') {
            frameIdx--
            if (frameIdx < 0) {
              if (isInfinite || currentLoop < loopCount) {
                frameIdx = total - 1
                if (!isInfinite) currentLoop++
              } else {
                advanceToNext()
                return
              }
            }
          } else if (direction === 'alternate') {
            frameIdx += dir
            if (frameIdx >= total) { frameIdx = total - 2; dir = -1 }
            else if (frameIdx < 0) {
              frameIdx = 1
              dir = 1
              if (!isInfinite && currentLoop >= loopCount) { advanceToNext(); return }
              if (!isInfinite) currentLoop++
            }
          }
          frameIdx = Math.max(0, Math.min(total - 1, frameIdx))
          img[el.id] = frames[frameIdx]?.src
          seqFrameIndices.set(el.id, frameIdx)
          seqCurrentImg.value = { ...img }
        }, 1000 / fps)
      }

      startSource()
      seqTimers.set(el.id, { clear: () => { if (timerId) clearInterval(timerId) } })
    })
  })
  seqCurrentImg.value = img
}

function stopSequenceAnimations() {
  seqTimers.forEach(t => t.clear())
  seqTimers.clear()
  seqCurrentImg.value = {}
}

// ---------- sequence scrub ----------
const scrubState = new Map<string, { active: boolean; lastX: number; lastY: number; startFrame: number }>()

function isSeqScrub(el: any): boolean {
  return el.type === 'sequenceFrame' && !!el.scrub?.enabled
}

function onSeqPointerDown(e: PointerEvent, el: any) {
  if (!isSeqScrub(el)) return
  e.stopPropagation()
  const sources = getSeqSources(el)
  const frames = sources[0]?.frames || []
  if (!frames.length) return
  scrubState.set(el.id, {
    active: true,
    lastX: e.clientX,
    lastY: e.clientY,
    startFrame: seqFrameIndices.get(el.id) || 0,
  })
}

function onSeqPointerMove(e: PointerEvent, el: any) {
  const st = scrubState.get(el.id)
  if (!st || !st.active) return
  e.stopPropagation()
  const sources = getSeqSources(el)
  const frames = sources[0]?.frames || []
  if (!frames.length) return
  const dx = e.clientX - st.lastX
  const dy = e.clientY - st.lastY
  st.lastX = e.clientX
  st.lastY = e.clientY
  const sensitivity = el.scrub?.sensitivity || 10
  const direction = el.dragDirection || el.scrub?.dragDirection || 'any'
  let dist = 0
  if (direction === 'horizontal') dist = dx
  else if (direction === 'vertical') dist = dy
  else dist = Math.sqrt(dx * dx + dy * dy) * (dx + dy < 0 ? -1 : 1)
  const frameOffset = Math.round(dist / sensitivity)
  if (frameOffset === 0) return
  const total = frames.length
  let idx = ((st.startFrame + frameOffset) % total + total) % total
  st.startFrame = idx
  seqFrameIndices.set(el.id, idx)
  const img: Record<string, string> = { ...seqCurrentImg.value }
  img[el.id] = frames[idx]?.src
  seqCurrentImg.value = img
}

function onSeqPointerUp(el: any) {
  scrubState.delete(el.id)
}

// ---------- move animations ----------
const elementMoveOffset = ref<Record<string, { x: number; y: number }>>({})
const elementMoveDuration = ref<Record<string, number>>({})
const moveTimers = new Set<ReturnType<typeof setTimeout>>()

function applyMoveAnimations() {
  const page = currentPageData.value
  if (!page) return
  const offsets: Record<string, { x: number; y: number }> = {}
  const durations: Record<string, number> = {}

  for (const layer of page.layers) {
    const animations = layer.animations || []
    for (const anim of animations) {
      if (anim.type !== 'move' || !anim.params) continue
      const el = layer.element
      const from = anim.params.from || {}
      const to = anim.params.to || {}

      let moveDuration = anim.duration || 3000
      if (el.type === 'sequenceFrame') {
        const seqDur = calcSeqFirstSourceDuration(el)
        if (seqDur > 0) moveDuration = seqDur * 1000
      }

      offsets[el.id] = { x: from.x ?? el.x, y: from.y ?? el.y }
      durations[el.id] = moveDuration

      const timer = setTimeout(() => {
        elementMoveOffset.value = { ...elementMoveOffset.value, [el.id]: { x: to.x ?? el.x, y: to.y ?? el.y } }
      }, anim.delay || 50)
      moveTimers.add(timer)

      break
    }
  }
  elementMoveOffset.value = { ...elementMoveOffset.value, ...offsets }
  elementMoveDuration.value = { ...elementMoveDuration.value, ...durations }
}

function stopMoveAnimations() {
  moveTimers.forEach(t => clearTimeout(t))
  moveTimers.clear()
  elementMoveOffset.value = {}
  elementMoveDuration.value = {}
}

// ---------- buttons / shapes ----------
function getButtonFill(el: any): string {
  const f = el.fill
  if (!f) return '#409EFF'
  if (typeof f === 'string') return f
  return f.color || '#409EFF'
}

function getButtonStyle(el: any) {
  const shape = el.backgroundShape || 'circle'
  const fill = getButtonFill(el)
  const showBg = shape !== 'none'
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', height: '100%',
    background: showBg ? fill : 'transparent',
    borderRadius: shape === 'circle' ? '50%' : `${el.cornerRadius ?? 8}px`,
  }
}

function getShapeFill(el: any): string {
  const f = el.fill
  if (!f) return '#409EFF'
  if (typeof f === 'string') return f
  if (f.type === 'linearGradient' && Array.isArray(f.stops) && f.stops.length) {
    return f.stops.map((s: any) => (typeof s === 'string' ? s : s.color)).join(',')
  }
  return f.color || '#409EFF'
}

function getShapeStroke(el: any): string {
  const s = el.stroke
  if (!s || !s.width) return 'none'
  return typeof s.color === 'string' ? s.color : '#000'
}

function getShapeStrokeWidth(el: any): number {
  const s = el.stroke
  if (!s || !s.width) return 0
  return s.width
}

function getShapeTag(el: any): string {
  return el.shapeType || 'rectangle'
}

function getPolygonPoints(el: any): string {
  const pts = Array.isArray(el.points) && el.points.length ? el.points : []
  if (!pts.length) return '50,5 95,90 5,90'
  const mx = Math.max(...pts.filter((_: any, i: number) => i % 2 === 0), 100)
  const my = Math.max(...pts.filter((_: any, i: number) => i % 2 === 1), 100)
  const scaled = pts.map((v: number, i: number) => Math.round((v / (i % 2 === 0 ? mx : my)) * 100))
  return scaled.join(',')
}

function containerStyle(el: any) {
  return {
    position: 'absolute' as const,
    inset: '0' as const,
    overflow: el.clipOverflow !== false ? 'hidden' as const : 'visible' as const,
    borderRadius: `${el.borderRadius || 0}px`,
  }
}

// ---------- hotspot ----------
function resolvePageIndex(hotspot: Hotspot, currentIndex: number): number {
  if (!pages.value.length) return currentIndex
  switch (hotspot.action) {
    case 'switchPage': {
      const idx = pages.value.findIndex(p => p.id === hotspot.target)
      return idx >= 0 ? idx : currentIndex
    }
    case 'nextPage':
      return (currentIndex + 1) % pages.value.length
    case 'prevPage':
      return (currentIndex - 1 + pages.value.length) % pages.value.length
    default:
      return currentIndex
  }
}

function onElementClick(layer: LayerItem) {
  const h = layer.hotspot
  if (!h?.enabled || h.trigger !== 'click') return
  if ((h.scope && h.scope !== 'local') || h.action === 'switchScene' || h.action === 'switchProgram') {
    props.onCrossDevice?.(h)
    return
  }
  switch (h.action) {
    case 'switchPage':
    case 'nextPage':
    case 'prevPage': {
      const idx = resolvePageIndex(h, currentPage.value)
      goToPage(idx)
      break
    }
    case 'playVideo':
      playAllVideos()
      break
    case 'pause':
      pauseAllVideos()
      break
  }
}

// ---------- playback control ----------
let autoTimer: ReturnType<typeof setInterval> | null = null
let appearLoopTimer: ReturnType<typeof setTimeout> | null = null

function startAutoPlay() {
  stopAutoPlay()
  const page = currentPageData.value
  if (!page || !page.duration || !playing.value) return
  const mode = page.playMode || 'sequential'
  const autoSwitch = page.autoSwitch !== false

  if (mode === 'sequential' && autoSwitch) {
    autoTimer = setInterval(() => {
      switchToPage(currentPage.value, 1)
    }, page.duration)
  } else if (mode === 'loop') {
    appearLoopTimer = setTimeout(() => {
      applyTextAppearEffects()
      applyMoveAnimations()
      startAutoPlay()
    }, page.duration)
  }
}

function stopAutoPlay() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null }
  if (appearLoopTimer) { clearTimeout(appearLoopTimer); appearLoopTimer = null }
}

function reportState() {
  props.onState?.({
    pageIndex: currentPage.value,
    pageCount: pages.value.length,
    playing: playing.value,
  })
}

function switchToPage(fromIdx: number, direction: number) {
  let target: number
  if (fromIdx + direction < 0) target = pages.value.length - 1
  else if (fromIdx + direction >= pages.value.length) target = 0
  else target = fromIdx + direction
  currentPage.value = target
  applyPageTransition(target, direction)
  onPageEnter()
}

function goToPage(targetIdx: number) {
  if (targetIdx < 0 || targetIdx >= pages.value.length || targetIdx === currentPage.value) return
  const direction = targetIdx > currentPage.value ? 1 : -1
  currentPage.value = targetIdx
  applyPageTransition(targetIdx, direction)
  onPageEnter()
}

function applyPageTransition(targetIdx: number, direction: number) {
  const page = pages.value[targetIdx]
  const t = page?.transition || 'fade'
  if (t !== 'none') {
    transitionDir.value = direction > 0 ? 'in' : 'out'
    isTransitioning.value = true
    setTimeout(() => { isTransitioning.value = false }, page?.transitionDuration || 500)
  }
}

function onPageEnter() {
  videoRefs.clear()
  videoRegistered.clear()
  startAutoPlay()
  startImageCycling()
  startVideoCycling()
  startSequenceAnimations()
  applyMoveAnimations()
  applyTextAppearEffects()
  reportState()
}

function setPlaying(v: boolean) {
  playing.value = v
  if (v) {
    startAutoPlay()
    startImageCycling()
    startVideoCycling()
    startSequenceAnimations()
    playAllVideos()
  } else {
    stopAutoPlay()
    pauseAllVideos()
  }
  reportState()
}

function executeAction(action: string, params: Record<string, any> = {}) {
  switch (action) {
    case 'nextPage':
      switchToPage(currentPage.value, 1)
      break
    case 'prevPage':
      switchToPage(currentPage.value, -1)
      break
    case 'switchPage': {
      const target = params.pageId || params.target
      const idx = pages.value.findIndex(p => p.id === target || p.name === target)
      goToPage(idx >= 0 ? idx : currentPage.value)
      break
    }
    case 'switchScene':
    case 'switchProgram':
      // 由播放器上层处理（需加载新节目配置）
      props.onState?.({ pageIndex: currentPage.value, pageCount: pages.value.length, playing: playing.value })
      break
    case 'playVideo':
      playAllVideos()
      break
    case 'pause':
    case 'pauseVideo':
      pauseAllVideos()
      break
    case 'takeControl':
      break
  }
}

function startAll() {
  startAutoPlay()
  startImageCycling()
  startVideoCycling()
  startSequenceAnimations()
  applyMoveAnimations()
  applyTextAppearEffects()
}

function stopAll() {
  stopAutoPlay()
  stopImageCycling()
  stopVideoCycling()
  stopSequenceAnimations()
  stopMoveAnimations()
  typeTimers.forEach(t => clearInterval(t))
  typeTimers.clear()
  videoRefs.clear()
  videoRegistered.clear()
}

watch(() => props.config, () => {
  stopAll()
  currentPage.value = Math.min(props.startIndex ?? 0, Math.max(0, pages.value.length - 1))
  if (pages.value.length) startAll()
  reportState()
}, { immediate: true })

function setupResizeObserver() {
  resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      containerSize.width = entry.contentRect.width
      containerSize.height = entry.contentRect.height
    }
  })
  if (stageContainer.value) resizeObserver.observe(stageContainer.value)
}

onMounted(() => {
  setupResizeObserver()
  if (pages.value.length) startAll()
  reportState()
})

onUnmounted(() => {
  stopAll()
  if (resizeObserver) resizeObserver.disconnect()
})

defineExpose({
  goToPage,
  next: () => switchToPage(currentPage.value, 1),
  prev: () => switchToPage(currentPage.value, -1),
  setPlaying,
  getCurrentIndex: () => currentPage.value,
  getPageCount: () => pages.value.length,
  executeAction,
})
</script>

<style scoped>
.player-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #000;
}
.player-page {
  flex-shrink: 0;
  transform-origin: center center;
  background: #000;
}
.player-page.tr-fade { transition: opacity 0.5s ease; }
.player-page.tr-fade.tr-in { animation: pfadeIn 0.5s ease; }
.player-page.tr-fade.tr-out { animation: pfadeIn 0.5s ease reverse; }
.player-page.tr-slide { transition: transform 0.5s ease; }
.player-page.tr-slide.tr-in { animation: pslideIn 0.5s ease; }
.player-page.tr-slide.tr-out { animation: pslideOut 0.5s ease; }
.player-page.tr-zoom { transition: transform 0.5s ease, opacity 0.5s ease; }
.player-page.tr-zoom.tr-in { animation: pzoomIn 0.5s ease; }
.player-page.tr-zoom.tr-out { animation: pzoomIn 0.5s ease reverse; }
@keyframes pfadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
@keyframes pslideIn { 0% { transform: translateX(60px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
@keyframes pslideOut { 0% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(-60px); opacity: 0; } }
@keyframes pzoomIn { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
.player-bg { z-index: 0; }
.player-element { z-index: 1; cursor: pointer; }
.player-text { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.player-video, .player-placeholder, .player-seq-placeholder, .player-video-placeholder {
  color: #999; display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; background: #333; font-size: 24px;
}
.player-seq { width: 100%; height: 100%; overflow: hidden; }
.seq-scrub { cursor: grab; touch-action: none; }
.player-button { cursor: pointer; }
.player-shape { width: 100%; height: 100%; }
.player-container { position: relative; }
.player-caption {
  position: absolute; z-index: 9; pointer-events: none;
  word-break: break-word; overflow-wrap: break-word;
}
.player-scrim { position: absolute; z-index: 8; pointer-events: none; }
.player-media-controls {
  position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px; z-index: 10;
  background: rgba(0,0,0,0.35); border-radius: 16px; padding: 2px 8px;
}
.player-video .player-media-controls { bottom: 40px; }
.mini-btn {
  width: 26px; height: 26px; border: 1px solid rgba(255,255,255,0.3);
  background: rgba(0,0,0,0.4); color: #fff; border-radius: 50%;
  font-size: 11px; cursor: pointer; line-height: 1;
}
.mini-label { color: #fff; font-size: 11px; }
.player-empty {
  color: #888; display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; font-size: 24px;
}
</style>
