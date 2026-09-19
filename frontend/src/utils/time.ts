// 时长单位换算：编辑器 UI 以“秒”呈现与录入，底层数据仍以毫秒存储，保证旧节目兼容。

export function msToSec(ms: any, fallbackMs = 0): number {
  const v = Number(ms)
  const base = Number.isFinite(v) ? v : fallbackMs
  return Math.round((base / 1000) * 1000) / 1000
}

export function secToMs(sec: any, fallbackMs = 0): number {
  const v = Number(sec)
  if (!Number.isFinite(v)) return fallbackMs
  return Math.round(v * 1000)
}
