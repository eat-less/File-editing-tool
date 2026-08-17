import type { Hotspot, PageItem } from '@/types'

export function isCrossDevice(hotspot: Hotspot | null): boolean {
  if (!hotspot || !hotspot.enabled) return false
  return !!hotspot.scope && hotspot.scope !== 'local'
}

export function buildDeviceAction(hotspot: Hotspot, sourceDeviceCode: string): Record<string, any> {
  const scope = hotspot.scope || 'local'
  const target: Record<string, any> = { type: scope }
  if (scope === 'devices') {
    target.deviceCodes = hotspot.targetDeviceCodes || []
  }
  const params: Record<string, any> = { ...(hotspot.commandParams || {}) }
  if (hotspot.target) {
    if (hotspot.action === 'switchPage') params.pageId = hotspot.target
    else if (hotspot.action === 'switchProgram') params.programId = hotspot.target
    else if (hotspot.action === 'switchScene') params.sceneId = hotspot.target
  }
  return {
    type: 'deviceAction',
    source: 'player',
    sourceDeviceCode,
    target,
    action: hotspot.action,
    params
  }
}

export function resolvePageIndex(hotspot: Hotspot, pages: PageItem[], currentIndex: number): number {
  if (!pages.length) return currentIndex
  switch (hotspot.action) {
    case 'switchPage': {
      const idx = pages.findIndex(p => p.id === hotspot.target)
      return idx >= 0 ? idx : currentIndex
    }
    case 'nextPage':
      return (currentIndex + 1) % pages.length
    case 'prevPage':
      return (currentIndex - 1 + pages.length) % pages.length
    default:
      return currentIndex
  }
}
