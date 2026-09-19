// 按钮成套样式模板。纯数据，供属性面板预览与应用；编辑器/播放器用同一字段渲染。
import type { ElementItem } from '@/types'
import { cssBackground } from './paint'
import type { FillLike } from './paint'

export interface ButtonShadow {
  color: string
  blur: number
  offsetX?: number
  offsetY?: number
}

export interface ButtonPreset {
  id: string
  name: string
  desc: string
  fields: {
    backgroundShape?: string
    fill?: FillLike
    cornerRadius?: number
    stroke?: { width: number; color: string }
    shadow?: ButtonShadow
    iconColor?: string
    labelColor?: string
    labelSize?: number
    iconSize?: number
  }
}

export const BUTTON_PRESETS: ButtonPreset[] = [
  { id: 'flat-blue', name: '经典蓝', desc: '纯色圆钮', fields: { backgroundShape: 'circle', fill: '#409EFF', iconColor: '#ffffff', labelColor: '#ffffff' } },
  { id: 'tech-gradient', name: '科技渐变', desc: '蓝青渐变', fields: { backgroundShape: 'roundedRect', cornerRadius: 12, fill: { type: 'linearGradient', angle: 135, stops: [{ pos: 0, color: '#0ea5e9' }, { pos: 1, color: '#22d3ee' }] }, iconColor: '#ffffff', labelColor: '#ffffff' } },
  { id: 'neon', name: '霓虹发光', desc: '描边+光晕', fields: { backgroundShape: 'roundedRect', cornerRadius: 999, fill: 'none', stroke: { width: 2, color: '#00e5ff' }, shadow: { color: 'rgba(0,229,255,0.8)', blur: 18 }, iconColor: '#00e5ff', labelColor: '#00e5ff' } },
  { id: 'gold-line', name: '金色描边', desc: '古典雅致', fields: { backgroundShape: 'roundedRect', cornerRadius: 6, fill: 'none', stroke: { width: 2, color: '#d8b25a' }, iconColor: '#d8b25a', labelColor: '#d8b25a' } },
  { id: 'glass', name: '玻璃拟态', desc: '半透明磨砂', fields: { backgroundShape: 'roundedRect', cornerRadius: 14, fill: 'rgba(255,255,255,0.16)', stroke: { width: 1, color: 'rgba(255,255,255,0.5)' }, shadow: { color: 'rgba(0,0,0,0.35)', blur: 10 }, iconColor: '#ffffff', labelColor: '#ffffff' } },
  { id: 'gradient-purple', name: '霓虹紫', desc: '紫粉渐变', fields: { backgroundShape: 'roundedRect', cornerRadius: 999, fill: { type: 'linearGradient', angle: 120, stops: [{ pos: 0, color: '#7c3aed' }, { pos: 1, color: '#ec4899' }] }, shadow: { color: 'rgba(168,85,247,0.6)', blur: 16 }, iconColor: '#ffffff', labelColor: '#ffffff' } },
  { id: 'dark-flat', name: '深空扁平', desc: '低饱和暗底', fields: { backgroundShape: 'roundedRect', cornerRadius: 10, fill: 'rgba(9,24,46,0.85)', stroke: { width: 1, color: 'rgba(255,255,255,0.18)' }, iconColor: '#cfd8ff', labelColor: '#cfd8ff' } },
  { id: 'white-ghost', name: '白底描影', desc: '浅色场景', fields: { backgroundShape: 'circle', fill: '#ffffff', shadow: { color: 'rgba(0,0,0,0.25)', blur: 8 }, iconColor: '#1f3a5f', labelColor: '#1f3a5f' } },
  { id: 'pill-amber', name: '金色胶囊', desc: '渐变胶囊', fields: { backgroundShape: 'pill', fill: { type: 'linearGradient', angle: 90, stops: [{ pos: 0, color: '#f6c453' }, { pos: 1, color: '#e08a00' }] }, shadow: { color: 'rgba(240,170,30,0.55)', blur: 14 }, iconColor: '#ffffff', labelColor: '#ffffff' } },
  { id: 'round-halo', name: '光环悬浮', desc: '圆钮+外光', fields: { backgroundShape: 'circle', fill: { type: 'linearGradient', angle: 145, stops: [{ pos: 0, color: '#38bdf8' }, { pos: 1, color: '#2563eb' }] }, shadow: { color: 'rgba(56,189,248,0.75)', blur: 20 }, iconColor: '#ffffff', labelColor: '#ffffff' } },
]

const presetMap: Record<string, ButtonPreset> = Object.fromEntries(BUTTON_PRESETS.map(p => [p.id, p]))

export function getButtonPreset(id: string | undefined): ButtonPreset | null {
  return presetMap[id || ''] || null
}

/** 将一套模板的字段合并回元素。 */
export function applyButtonPreset(el: ElementItem, preset: ButtonPreset): void {
  for (const [k, v] of Object.entries(preset.fields)) {
    ;(el as any)[k] = JSON.parse(JSON.stringify(v))
  }
}

/** 属性面板缩略图 / 播放器共用的圆形度计算。 */
export function buttonRadiusCss(el: { backgroundShape?: string; cornerRadius?: number }, w: number, h: number): string {
  const shape = el.backgroundShape || 'circle'
  if (shape === 'circle') return `${Math.min(w, h) / 2}px`
  if (shape === 'pill') return `${h / 2}px`
  if (shape === 'roundedRect') return `${el.cornerRadius ?? 8}px`
  return '0px'
}

/** 属性面板缩略图样式。 */
export function buttonPreviewCss(preset: ButtonPreset): Record<string, string> {
  const f = preset.fields
  const style: Record<string, string> = {
    background: cssBackground((f.fill as any) ?? '#409EFF', '#409EFF'),
    borderRadius: buttonRadiusCss(f as any, 100, 100),
  }
  if ((f.stroke as any)?.width) {
    style.border = `${(f.stroke as any).width}px solid ${(f.stroke as any).color}`
  }
  if ((f.shadow as any)?.color) {
    const s = f.shadow as ButtonShadow
    style.boxShadow = `0 ${s.offsetY || 0}px ${s.blur}px ${s.color}`
  }
  if ((f.fill as any) === 'none') {
    style.background = 'transparent'
    style.border = `2px solid ${(f.iconColor as any) || '#00e5ff'}`
  }
  return style
}
