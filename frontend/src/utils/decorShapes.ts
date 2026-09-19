// 内置矢量装饰库。所有坐标在 0..100 的规范化盒内，
// 编辑器用 Konva 画，播放器用 <svg viewBox="0 0 100 100"> 画，保证两端一致。

import type { ElementItem } from '@/types'
import { isGradient, konvaFillConfig, solidColor } from './paint'

export type DecorCategory = 'frame' | 'divider' | 'accent'

export interface DecorPartDef {
  kind: 'rect' | 'circle' | 'line' | 'path' | 'ellipse'
  geom: Record<string, any>
  paint: 'stroke' | 'fill'
}

export interface DecorDef {
  id: string
  name: string
  category: DecorCategory
  parts: DecorPartDef[]
  defaultW: number
  defaultH: number
}

export const DECOR_CATEGORIES: Array<{ value: DecorCategory; label: string }> = [
  { value: 'frame', label: '画框角花' },
  { value: 'divider', label: '分割线导航' },
  { value: 'accent', label: '几何点缀光效' },
]

export const DECOR_SHAPES: DecorDef[] = [
  // ---------------- 画框 / 角花 / 底板 ----------------
  {
    id: 'frame-plain', name: '直角边框', category: 'frame',
    parts: [{ kind: 'rect', geom: { x: 3, y: 3, width: 94, height: 94, rx: 0 }, paint: 'stroke' }],
    defaultW: 1600, defaultH: 800,
  },
  {
    id: 'frame-rounded', name: '圆角边框', category: 'frame',
    parts: [{ kind: 'rect', geom: { x: 4, y: 4, width: 92, height: 92, rx: 16 }, paint: 'stroke' }],
    defaultW: 1600, defaultH: 800,
  },
  {
    id: 'frame-double', name: '双线边框', category: 'frame',
    parts: [
      { kind: 'rect', geom: { x: 4, y: 4, width: 92, height: 92, rx: 8 }, paint: 'stroke' },
      { kind: 'rect', geom: { x: 11, y: 11, width: 78, height: 78, rx: 6 }, paint: 'stroke' },
    ],
    defaultW: 1600, defaultH: 800,
  },
  {
    id: 'frame-corner', name: '四角角花', category: 'frame',
    parts: [{
      kind: 'path', paint: 'stroke',
      geom: { d: 'M8 40 L8 8 L40 8 M60 8 L92 8 L92 40 M92 60 L92 92 L60 92 M40 92 L8 92 L8 60' },
    }],
    defaultW: 900, defaultH: 600,
  },
  {
    id: 'frame-corner-round', name: '圆角角花', category: 'frame',
    parts: [{
      kind: 'path', paint: 'stroke',
      geom: { d: 'M8 46 L8 20 Q8 8 20 8 L46 8 M54 8 L80 8 Q92 8 92 20 L92 46 M92 54 L92 80 Q92 92 80 92 L54 92 M46 92 L20 92 Q8 92 8 80 L8 54' },
    }],
    defaultW: 900, defaultH: 600,
  },
  {
    id: 'frame-title', name: '顶部标题条', category: 'frame',
    parts: [
      { kind: 'rect', geom: { x: 0, y: 4, width: 100, height: 26, rx: 4 }, paint: 'fill' },
      { kind: 'line', geom: { x1: 0, y1: 40, x2: 100, y2: 40 }, paint: 'stroke' },
      { kind: 'rect', geom: { x: 4, y: 37.5, width: 40, height: 5 }, paint: 'fill' },
    ],
    defaultW: 1400, defaultH: 80,
  },
  {
    id: 'panel-bottom', name: '底部提示条', category: 'frame',
    parts: [{ kind: 'rect', geom: { x: 12, y: 72, width: 76, height: 22, rx: 11 }, paint: 'fill' }],
    defaultW: 1400, defaultH: 90,
  },
  {
    id: 'panel-round', name: '圆角底板', category: 'frame',
    parts: [{ kind: 'rect', geom: { x: 8, y: 8, width: 84, height: 84, rx: 18 }, paint: 'fill' }],
    defaultW: 600, defaultH: 400,
  },

  // ---------------- 分割线 / 箭头导航 ----------------
  {
    id: 'divider-line', name: '分割线', category: 'divider',
    parts: [{ kind: 'line', geom: { x1: 6, y1: 50, x2: 94, y2: 50 }, paint: 'stroke' }],
    defaultW: 800, defaultH: 40,
  },
  {
    id: 'divider-dots', name: '圆点端点线', category: 'divider',
    parts: [
      { kind: 'line', geom: { x1: 8, y1: 50, x2: 72, y2: 50 }, paint: 'stroke' },
      { kind: 'circle', geom: { cx: 82, cy: 50, r: 4.5 }, paint: 'fill' },
      { kind: 'circle', geom: { cx: 94, cy: 50, r: 3 }, paint: 'fill' },
    ],
    defaultW: 800, defaultH: 40,
  },
  {
    id: 'divider-rhombus', name: '菱形夹线', category: 'divider',
    parts: [
      { kind: 'line', geom: { x1: 6, y1: 50, x2: 36, y2: 50 }, paint: 'stroke' },
      { kind: 'line', geom: { x1: 64, y1: 50, x2: 94, y2: 50 }, paint: 'stroke' },
      { kind: 'path', geom: { d: 'M50 38 L62 50 L50 62 L38 50 Z' }, paint: 'fill' },
    ],
    defaultW: 700, defaultH: 40,
  },
  {
    id: 'arrow-next', name: '右箭头', category: 'divider',
    parts: [
      { kind: 'line', geom: { x1: 8, y1: 50, x2: 78, y2: 50 }, paint: 'stroke' },
      { kind: 'path', geom: { d: 'M68 42 L80 50 L68 58' }, paint: 'stroke' },
    ],
    defaultW: 220, defaultH: 120,
  },
  {
    id: 'arrow-prev', name: '左箭头', category: 'divider',
    parts: [
      { kind: 'line', geom: { x1: 22, y1: 50, x2: 92, y2: 50 }, paint: 'stroke' },
      { kind: 'path', geom: { d: 'M32 42 L20 50 L32 58' }, paint: 'stroke' },
    ],
    defaultW: 220, defaultH: 120,
  },
  {
    id: 'slab-chevron', name: '科技斜条', category: 'divider',
    parts: [
      { kind: 'path', geom: { d: 'M0 20 L100 20 L100 26 L0 26 Z M0 44 L100 44 L100 48 L0 48 Z M0 68 L100 68 L100 72 L0 72 Z' }, paint: 'fill' },
      { kind: 'path', geom: { d: 'M60 88 L92 8' }, paint: 'stroke' },
    ],
    defaultW: 500, defaultH: 90,
  },

  // ---------------- 几何点缀 / 光效 ----------------
  {
    id: 'accent-star', name: '五角星', category: 'accent',
    parts: [{
      kind: 'path', paint: 'fill',
      geom: { d: 'M50 6 L60.6 35.4 L91.8 36.4 L67.1 55.6 L75.9 85.6 L50 68 L24.1 85.6 L32.9 55.6 L8.2 36.4 L39.4 35.4 Z' },
    }],
    defaultW: 120, defaultH: 120,
  },
  {
    id: 'accent-spark', name: '星光', category: 'accent',
    parts: [{
      kind: 'path', paint: 'stroke',
      geom: { d: 'M50 2 L54 46 L98 50 L54 54 L50 98 L46 54 L2 50 L46 46 Z' },
    }],
    defaultW: 100, defaultH: 100,
  },
  {
    id: 'accent-ring', name: '圆环', category: 'accent',
    parts: [{ kind: 'circle', geom: { cx: 50, cy: 50, r: 36 }, paint: 'stroke' }],
    defaultW: 120, defaultH: 120,
  },
  {
    id: 'accent-ring-dot', name: '光环圆点', category: 'accent',
    parts: [
      { kind: 'circle', geom: { cx: 50, cy: 50, r: 42 }, paint: 'stroke' },
      { kind: 'circle', geom: { cx: 50, cy: 50, r: 10 }, paint: 'fill' },
    ],
    defaultW: 130, defaultH: 130,
  },
  {
    id: 'accent-diamond', name: '菱形', category: 'accent',
    parts: [{ kind: 'path', geom: { d: 'M50 4 L96 50 L50 96 L4 50 Z' }, paint: 'fill' }],
    defaultW: 100, defaultH: 100,
  },
  {
    id: 'accent-half-ring', name: '顶部光环', category: 'accent',
    parts: [
      { kind: 'path', geom: { d: 'M14 50 A36 36 0 0 1 86 50' }, paint: 'stroke' },
      { kind: 'circle', geom: { cx: 50, cy: 12, r: 4 }, paint: 'fill' },
    ],
    defaultW: 200, defaultH: 90,
  },
  {
    id: 'accent-beam', name: '流光斜条', category: 'accent',
    parts: [{ kind: 'path', geom: { d: 'M34 78 L74 22 L80 28 L40 84 Z' }, paint: 'fill' }],
    defaultW: 160, defaultH: 100,
  },
  {
    id: 'accent-corner-bracket', name: 'L型导引', category: 'accent',
    parts: [{ kind: 'path', geom: { d: 'M6 30 L6 6 L30 6 M70 6 L94 6 L94 30 M94 70 L94 94 L70 94 M30 94 L6 94 L6 70' }, paint: 'stroke' }],
    defaultW: 120, defaultH: 120,
  },
]

const decorMap: Record<string, DecorDef> = Object.fromEntries(DECOR_SHAPES.map(d => [d.id, d]))

export function getDecorDef(id: string | undefined): DecorDef {
  return decorMap[id || ''] || DECOR_SHAPES[0]
}

export function getDecorCategoriesWithItems(): DecorCategory[] {
  return ['frame', 'divider', 'accent']
}

export interface ResolvedDecorPart {
  kind: 'rect' | 'circle' | 'line' | 'path' | 'ellipse'
  geom: Record<string, any>
  fill: string
  stroke: string | null
  strokeWidth: number
}

function strokeProps(el: ElementItem) {
  const st = (el.stroke as any) || {}
  return {
    color: st.color || '#7fb8ff',
    width: Number(st.width) || 3,
  }
}

/**
 * 把装饰元素解析为最终绘制部件(几何坐标已按元素 w/h 从 0..100 换算为像素)。
 * 两套引擎都消费该函数 → 外观天然一致。
 */
export function resolveDecorParts(el: ElementItem): ResolvedDecorPart[] {
  const def = getDecorDef(el.decorId)
  const w = el.width || def.defaultW
  const h = el.height || def.defaultH
  const sx = w / 100
  const sy = h / 100
  const s = (v: number, axis: 'x' | 'y') => (axis === 'x' ? v * sx : v * sy)
  const stroke = strokeProps(el)
  const fillColor = solidColor(el.fill as any, '#4C9AFF')

  const out: ResolvedDecorPart[] = []
  for (const part of def.parts) {
    const g = part.geom
    let geom: Record<string, any> = {}
    if (part.kind === 'rect') {
      geom = { x: s(g.x, 'x'), y: s(g.y, 'y'), width: s(g.width, 'x'), height: s(g.height, 'y'), rx: s(g.rx || 0, 'x') }
    } else if (part.kind === 'circle') {
      // 非等比缩放时圆形拉伸为椭圆，与 SVG 一致
      const r = g.r || 0
      const cx = s(g.cx, 'x')
      const cy = s(g.cy, 'y')
      if (Math.abs(sx - sy) > 0.001) {
        out.push({
          kind: 'ellipse', geom: { x: cx - r * sx, y: cy - r * sy, radiusX: r * sx, radiusY: r * sy },
          fill: part.paint === 'fill' ? fillColor : 'transparent',
          stroke: part.paint === 'stroke' ? stroke.color : null,
          strokeWidth: part.paint === 'stroke' ? stroke.width : 0,
        })
        continue
      }
      geom = { x: cx - r * sx, y: cy - r * sy, width: r * 2 * sx, height: r * 2 * sy, radius: r * sx }
    } else if (part.kind === 'line') {
      geom = { x1: s(g.x1, 'x'), y1: s(g.y1, 'y'), x2: s(g.x2, 'x'), y2: s(g.y2, 'y') }
    } else if (part.kind === 'path') {
      // 路径内坐标按 y 方向缩放不可直接文本替换；统一按 x 轴等比处理，
      // 非等比元素可整体拉伸(与 SVG preserveAspectRatio=none 观感接近)。
      geom = { data: g.d }
    }
    out.push({
      kind: part.kind,
      geom,
      fill: part.paint === 'fill' ? fillColor : 'transparent',
      stroke: part.paint === 'stroke' ? stroke.color : null,
      strokeWidth: part.paint === 'stroke' ? stroke.width : 0,
    })
  }
  return out
}

/** Konva 专用：把解析结果转成 v-rect/v-ellipse/v-line/v-path 配置。 */
export function decorToKonvaParts(el: ElementItem): Array<{ kind: string; config: Record<string, any> }> {
  const parts = resolveDecorParts(el)
  return parts.map(p => {
    const config: Record<string, any> = {
      fill: p.fill,
      stroke: p.stroke || undefined,
      strokeWidth: p.strokeWidth,
      strokeScaleEnabled: false,
      listening: false,
    }
    if (p.stroke === null) delete config.stroke
    if (!p.strokeWidth) { config.strokeWidth = undefined; delete config.stroke }
    if (p.kind === 'circle') {
      return { kind: 'circle', config: { ...p.geom, ...config } }
    }
    if (p.kind === 'ellipse') {
      return { kind: 'ellipse', config: { ...p.geom, ...config } }
    }
    if (p.kind === 'line') {
      return { kind: 'line', config: { points: [p.geom.x1, p.geom.y1, p.geom.x2, p.geom.y2], ...config } }
    }
    if (p.kind === 'path') {
      return { kind: 'path', config: { data: p.geom.data, ...config } }
    }
    return { kind: 'rect', config: { ...p.geom, cornerRadius: p.geom.rx || 0, ...config } }
  })
}

export function getGradientKonvaFill(el: ElementItem): Record<string, any> | null {
  if (!isGradient((el as any).fill)) return null
  return konvaFillConfig((el as any).fill, el.width || 100, el.height || 100, '#000')
}

function fillAttr(v: string): string {
  return v && v !== 'transparent' && v !== 'none' ? v : 'none'
}

function partToSvg(p: ResolvedDecorPart): string {
  const fill = fillAttr(p.fill)
  const stroke = p.stroke ? `stroke="${p.stroke}" stroke-width="${p.strokeWidth}"` : ''
  const geom = p.geom
  switch (p.kind) {
    case 'rect':
      return `<rect x="${geom.x}" y="${geom.y}" width="${geom.width}" height="${geom.height}" rx="${geom.rx || 0}" fill="${fill}" ${stroke} />`
    case 'ellipse':
      return `<ellipse cx="${geom.x + geom.radiusX}" cy="${geom.y + geom.radiusY}" rx="${geom.radiusX}" ry="${geom.radiusY}" fill="${fill}" ${stroke} />`
    case 'circle':
      return `<ellipse cx="${geom.x + geom.radius}" cy="${geom.y + geom.radius}" rx="${geom.radius}" ry="${geom.radius}" fill="${fill}" ${stroke} />`
    case 'line':
      return `<line x1="${geom.x1}" y1="${geom.y1}" x2="${geom.x2}" y2="${geom.y2}" fill="none" ${stroke} />`
    case 'path':
      return `<path d="${geom.data}" fill="${fill}" ${stroke} />`
    default:
      return ''
  }
}

/** 播放器/预览用：以元素像素尺寸为 viewBox 的 SVG 内部标记。 */
export function decorSvgInnerHTML(el: any): string {
  return resolveDecorParts(el as ElementItem).map(partToSvg).join('')
}

/** 素材库/属性面板缩略图用：100×100 规格小图。 */
export function decorPreviewSvg(decorId: string, fill: string, stroke: string, sw: number): string {
  const def = getDecorDef(decorId)
  const fake = { decorId: def.id, width: 100, height: 100, fill, stroke: { width: sw, color: stroke } } as any
  return resolveDecorParts(fake).map(partToSvg).join('')
}
