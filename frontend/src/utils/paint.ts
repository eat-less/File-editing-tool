// 共享填充解析：纯色 / 线性渐变。编辑器(Konva)与播放器(DOM/SVG)两端共用，保证观感一致。

export interface GradientStop {
  pos: number // 0..1
  color: string
}

export type FillLike =
  | string
  | { type?: 'solid' | 'linearGradient'; color?: string; angle?: number; stops?: Array<GradientStop | string> }
  | undefined
  | null

export function isGradient(f: FillLike): boolean {
  return !!f && typeof f === 'object' && (f.type === 'linearGradient' || Array.isArray(f.stops))
}

export function solidColor(f: FillLike, fallback: string): string {
  if (!f) return fallback
  if (typeof f === 'string') return f
  if (typeof f === 'object' && typeof f.color === 'string') return f.color
  return fallback
}

export function gradientAngle(f: FillLike): number {
  if (!f || typeof f === 'string') return 0
  return Number((f as any).angle) || 0
}

export function gradientStops(f: FillLike): Array<{ pos: number; color: string }> {
  if (!f || typeof f === 'string') return []
  const raw = (f as any).stops
  if (!Array.isArray(raw) || !raw.length) return []
  const list = raw.map((s: any, i: number) => {
    if (typeof s === 'string') return { pos: i / Math.max(1, raw.length - 1), color: s }
    return { pos: Number(s.pos) || 0, color: s.color || '#000000' }
  })
  return list.sort((a, b) => a.pos - b.pos)
}

export function gradientFlatStops(f: FillLike): Array<number | string> {
  const stops = gradientStops(f)
  const arr: Array<number | string> = []
  for (const s of stops) arr.push(Math.max(0, Math.min(1, s.pos)), s.color)
  return arr
}

function normalizeGradient(f: FillLike, fallback: string) {
  const stops = gradientStops(f)
  if (!stops.length) {
    return [{ pos: 0, color: solidColor(f, fallback) }, { pos: 1, color: solidColor(f, fallback) }]
  }
  const first = stops[0]
  const last = stops[stops.length - 1]
  if (first.pos > 0) stops.unshift({ pos: 0, color: first.color })
  if (last.pos < 1) stops.push({ pos: 1, color: last.color })
  return stops
}

/** 由角度得到一条穿过中心、能覆盖 w×h 盒子的线段两端(局部坐标)。 */
export function gradientLine(w: number, h: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const cx = w / 2
  const cy = h / 2
  const mag = (Math.abs(w * cos) + Math.abs(h * sin)) / 2 || Math.max(w, h)
  return {
    x0: cx - cos * mag,
    y0: cy - sin * mag,
    x1: cx + cos * mag,
    y1: cy + sin * mag,
  }
}

/** 生成 Konva 形状节点可直接使用的 fill 相关配置。 */
export function konvaFillConfig(f: FillLike, w: number, h: number, fallback: string): Record<string, any> {
  if (isGradient(f)) {
    const line = gradientLine(w, h, gradientAngle(f))
    return {
      fillLinearGradientStartPoint: { x: line.x0, y: line.y0 },
      fillLinearGradientEndPoint: { x: line.x1, y: line.y1 },
      fillLinearGradientColorStops: gradientFlatStops(f),
    }
  }
  return { fill: solidColor(f, fallback) }
}

/** 生成 CSS background。gradient stops 按比例写百分比。 */
export function cssBackground(f: FillLike, fallback: string): string {
  if (isGradient(f)) {
    const stops = normalizeGradient(f, fallback)
    const parts = stops.map(s => `${s.color} ${Math.round(s.pos * 100)}%`)
    return `linear-gradient(${gradientAngle(f)}deg, ${parts.join(', ')})`
  }
  return solidColor(f, fallback)
}

/** 归一化：老字段可能是字符串，或 shape 用的 {type:'solid',color}。 */
export function normalizeFillToStops(f: FillLike, fallback: string): { color1: string; color2: string; angle: number } {
  const stops = gradientStops(f)
  if (isGradient(f) && stops.length) {
    return { color1: stops[0].color, color2: stops[stops.length - 1].color, angle: gradientAngle(f) }
  }
  return { color1: solidColor(f, fallback), color2: solidColor(f, fallback), angle: 90 }
}
