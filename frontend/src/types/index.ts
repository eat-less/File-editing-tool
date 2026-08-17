export interface User {
  id: string
  username: string
  role: string
  created_at?: string
  last_login?: string
  is_active?: boolean
}

export interface Exhibit {
  id: string
  name: string
  description?: string
  scene_count: number
  device_count: number
  created_at?: string
  updated_at?: string
}

export interface Scene {
  id: string
  exhibit_id: string
  name: string
  description?: string
  sort_order: number
  device_count: number
  created_at?: string
}

export interface Device {
  id: string
  scene_id: string
  exhibit_id: string
  name: string
  device_type: string
  unique_code: string
  ip_address?: string
  config_file_path?: string
  design_width: number
  design_height: number
  status: string
  last_online?: string
  created_at?: string
}

export interface Program {
  id: string
  device_id: string
  scene_id: string
  exhibit_id: string
  name: string
  config?: ProgramConfig
  current_version: number
  published_version: number
  publish_status: string
  exhibit_name?: string
  scene_name?: string
  device_name?: string
  exhibit_path?: string
  created_at?: string
  updated_at?: string
}

export interface ProgramConfig {
  version: string
  device: { designWidth: number; designHeight: number; name: string }
  pages: PageItem[]
}

export interface PageItem {
  id: string
  name: string
  duration: number
  transition: string
  transitionDuration: number
  transitionDirection: string
  autoSwitch: boolean
  playMode: string
  background?: PageBackground
  layers: LayerItem[]
}

export interface PageBackground {
  type: string
  backgroundColor?: string
  assetHash?: string
  objectFit?: string
  opacity?: number
  brightness?: number
  blur?: number
}

export interface LayerItem {
  id: string
  name: string
  locked: boolean
  visible: boolean
  blendMode: string
  element: ElementItem
  animations: Animation[]
  hotspot: Hotspot | null
}

export interface ElementItem {
  id: string
  type: string
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  scaleX: number
  scaleY: number
  anchorX: number
  anchorY: number
  opacity: number
  borderRadius: number
  content?: any
  src?: string
  icon?: string
  iconColor?: string
  iconSize?: number
  backgroundShape?: string
  fill?: any
  stroke?: { width: number; color: string; style?: string }
  cornerRadius?: number
  [key: string]: any
}

export interface Animation {
  type: string
  duration: number
  delay: number
  easing: string
  direction: string
  repeat: number | string
  params?: Record<string, any>
}

export interface Hotspot {
  enabled: boolean
  trigger: string
  action: string
  target: string
  cursor: string
  highlight: boolean
  scope?: 'local' | 'scene' | 'devices'
  targetDeviceCodes?: string[]
  commandParams?: Record<string, any>
}

export interface Asset {
  id: string
  hash_key: string
  original_name: string
  file_size: number
  mime_type?: string
  file_type: string
  reference_count: number
  url?: string
  created_at?: string
}

export interface VersionSnapshot {
  id: string
  program_id: string
  version: number
  change_note?: string
  config_snapshot?: any
  manifest?: any
  created_at?: string
  operator_id?: string
}

export interface DistributionLog {
  id: string
  program_id: string
  device_id: string
  version: number
  change_note?: string
  action: string
  status: string
  started_at?: string
  completed_at?: string
  error_message?: string
}

export interface SystemLog {
  id: string
  log_type: string
  module?: string
  message: string
  detail?: any
  solution?: string
  duration_ms?: number
  ip_address?: string
  created_at?: string
}

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  solution?: string
}
