// 文字尺寸测量与自适应：让文本框贴合内容；内容超过换行宽度时自动换行、高度增长。
import {
  extractText, measureStyleFromElement, measureTextWidth, wrapText,
} from './textWrap'

export { extractText, konvaFontStyle } from './textWrap'

/**
 * 计算贴合文字的元素宽高。
 * - 以“当前框宽/指定换行宽”为换行上限：文字更窄时收缩贴合，文字更宽时在该宽度内换行、高度增长
 * - 不会把用户已经排好的窄框重新拉成一行
 */
export function fitTextSize(el: any, maxWidth = 1920, wrapWidth?: number): { width: number; height: number } {
  const padding = Number(el.padding) || 0
  const text = extractText(el.content) || '文字'
  const style = measureStyleFromElement(el)
  const lineHeightPx = (Number(el.lineHeight) || 1.5) * style.fontSize

  const paragraphs = text.split('\n')
  const naturalW = Math.ceil(Math.max(0, ...paragraphs.map(p => measureTextWidth(p, style))))
  const naturalH = Math.ceil(paragraphs.length * lineHeightPx)

  const maxContent = Math.max(20, (Number(maxWidth) || 1920) - padding * 2)
  const curW = Number(wrapWidth ?? el.width)
  const curContent = Number.isFinite(curW) && curW > 0 ? Math.max(20, curW - padding * 2) : maxContent
  const limit = Math.max(20, Math.min(maxContent, curContent))

  let contentW = Math.min(naturalW, limit)
  let contentH = naturalH
  if (naturalW > limit) {
    contentW = limit
    const wrapAt = Math.max(1, limit - 1)
    contentH = Math.ceil(wrapText(text, wrapAt, style).length * lineHeightPx)
  }

  return {
    width: Math.max(10, Math.ceil(contentW + padding * 2)),
    height: Math.max(10, Math.ceil(contentH + padding * 2)),
  }
}
