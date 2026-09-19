// 文字排版换行：编辑器(Konva)与播放器(DOM)共用，保证两端换行一致，并完整保留空格（如首行缩进）。

export interface MeasureStyle {
  fontSize: number
  fontFamily: string
  fontStyle: string
  letterSpacing: number
}

let measureCtx: CanvasRenderingContext2D | null = null

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx
  try {
    const canvas = document.createElement('canvas')
    measureCtx = canvas.getContext('2d')
  } catch {
    measureCtx = null
  }
  return measureCtx
}

export function extractText(content: any): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (content.text) return content.text
  const parts: string[] = []
  const walk = (node: any) => {
    if (!node) return
    if (node.type === 'text') parts.push(node.text || '')
    if (Array.isArray(node.content)) node.content.forEach(walk)
  }
  walk(content)
  return parts.join('')
}

/** 组合 Konva / canvas 可识别的 fontStyle（canvas 顺序：italic bold）。 */
export function konvaFontStyle(el: any): string {
  const parts: string[] = []
  if (el.fontStyle === 'italic') parts.push('italic')
  if (el.fontWeight === 'bold') parts.push('bold')
  return parts.length ? parts.join(' ') : 'normal'
}

export function measureStyleFromElement(el: any): MeasureStyle {
  return {
    fontSize: Number(el.fontSize) || 32,
    fontFamily: el.fontFamily || 'Microsoft YaHei',
    fontStyle: konvaFontStyle(el),
    letterSpacing: Number(el.letterSpacing) || 0,
  }
}

export function measureTextWidth(text: string, style: MeasureStyle): number {
  const ctx = getMeasureCtx()
  const letterSpacing = Number(style.letterSpacing) || 0
  if (!ctx) {
    // 无 canvas 环境（如极少数纯 Node）退化估算
    return [...text].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e7f ? style.fontSize : style.fontSize * 0.58), 0) + letterSpacing * text.length
  }
  ctx.font = `${style.fontStyle || 'normal'} ${style.fontSize}px ${style.fontFamily}`
  return ctx.measureText(text).width + letterSpacing * text.length
}

/** 单个段落（不含换行）按宽度拆行，保留所有空格。 */
export function wrapParagraph(text: string, maxWidth: number, style: MeasureStyle): string[] {
  if (text === '') return ['']
  if (measureTextWidth(text, style) <= maxWidth) return [text]

  const chars = [...text]
  const lines: string[] = []
  let line = ''
  for (const ch of chars) {
    const test = line + ch
    if (line !== '' && measureTextWidth(test, style) > maxWidth) {
      const isWordChar = /[A-Za-z0-9\u00C0-\u024F]/.test(ch)
      const lastSpace = line.lastIndexOf(' ')
      if (isWordChar && lastSpace > 0 && lastSpace < line.length - 1) {
        lines.push(line.slice(0, lastSpace + 1))
        line = line.slice(lastSpace + 1) + ch
      } else {
        lines.push(line)
        line = ch
      }
    } else {
      line = test
    }
  }
  lines.push(line)
  return lines
}

export function wrapText(text: any, maxWidth: number, style: MeasureStyle): string[] {
  const raw = String(text ?? '')
  return raw.split('\n').flatMap(p => wrapParagraph(p, maxWidth, style))
}

export function wrapTextToString(text: any, maxWidth: number, style: MeasureStyle): string {
  return wrapText(text, maxWidth, style).join('\n')
}

/** 由元素计算可用于换行的内容宽度（扣除内边距）。 */
export function contentWidthOf(el: any): number {
  const padding = Number(el.padding) || 0
  return Math.max(1, (Number(el.width) || 500) - padding * 2)
}

/** 实际换行宽度：留 1px 余量，避免边界处 Konva 二次回绕导致空格被裁。 */
export function wrapWidthOf(el: any): number {
  return Math.max(1, contentWidthOf(el) - 1)
}
