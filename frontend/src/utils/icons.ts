export interface IconDef {
  name: string
  label: string
  path: string
}

export const BUTTON_ICONS: IconDef[] = [
  { name: 'play', label: '播放', path: 'M8 5v14l11-7z' },
  { name: 'pause', label: '暂停', path: 'M6 5h4v14H6zM14 5h4v14h-4z' },
  { name: 'stop', label: '停止', path: 'M6 6h12v12H6z' },
  { name: 'prev', label: '上一页', path: 'M6 6h2v12H6zm3.5 6l8.5 6V6z' },
  { name: 'next', label: '下一页', path: 'M16 6h2v12h-2zM6 18l8.5-6L6 6z' },
  { name: 'refresh', label: '刷新', path: 'M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-1.76-4.24L13 11h7V4z' },
  { name: 'home', label: '主页', path: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z' },
  { name: 'fullscreen', label: '全屏', path: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z' },
  { name: 'close', label: '关闭', path: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' },
  { name: 'back', label: '返回', path: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z' },
  { name: 'menu', label: '菜单', path: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z' },
  { name: 'volume', label: '音量', path: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z' },
]

const iconMap: Record<string, string> = Object.fromEntries(
  BUTTON_ICONS.map(i => [i.name, i.path])
)

export function getIconPath(name: string): string {
  return iconMap[name] || BUTTON_ICONS[0].path
}

export function getIconLabel(name: string): string {
  return BUTTON_ICONS.find(i => i.name === name)?.label || name
}
