export type AppearSpeed = 'slow' | 'normal' | 'fast'

export const APPEAR_EFFECT_OPTIONS = [
  { label: '无', value: 'none' },
  { label: '打字机', value: 'typewriter' },
  { label: '淡入', value: 'fade' },
  { label: '滑入', value: 'slide' },
]

export const APPEAR_SPEED_OPTIONS = [
  { label: '慢', value: 'slow' },
  { label: '中', value: 'normal' },
  { label: '快', value: 'fast' },
]

export function resolveAppearSpeed(speed?: string): AppearSpeed {
  if (speed === 'slow' || speed === 'fast') return speed
  return 'normal'
}

export function getTypewriterInterval(speed?: string): number {
  switch (resolveAppearSpeed(speed)) {
    case 'slow': return 150
    case 'fast': return 40
    default: return 80
  }
}

export function getEnterDuration(speed?: string): number {
  switch (resolveAppearSpeed(speed)) {
    case 'slow': return 1500
    case 'fast': return 400
    default: return 800
  }
}
