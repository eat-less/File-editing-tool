export interface SeqFrameRef { src: string; index?: number }

export interface RawSegment {
  type?: string
  name?: string
  frames?: SeqFrameRef[]
  frameCount?: number
  loopCount?: number
  fps?: number
  direction?: string
  flipX?: boolean
  contentX?: number
  move?: { enabled?: boolean; to?: { x: number; y: number }; duration?: number | null }
}

export interface SeqElementLike {
  seqSources?: RawSegment[]
  source?: { type?: string; frames?: SeqFrameRef[] }
  frameRate?: number
  direction?: string
  loop?: boolean
  wholeLoop?: boolean
  autoplay?: boolean
}

export type Dir = 'forward' | 'reverse' | 'alternate'

export interface NormalizedSegment {
  name: string
  frames: SeqFrameRef[]
  fps: number
  loopCount: number      // 1..99 | -1=无限
  direction: Dir
  flipX: boolean
  contentX?: number       // 帧内水平偏移(px)，绘制帧时 translateX；normalize 后为数字，缺省 0
  moveTo: { x: number; y: number } | null
  moveDurationSec?: number | null   // 独立移动时长(秒)；null=与帧自然时长相同
}

export interface ChoreoState {
  segIndex: number
  frameIndex: number
  src: string | null
  x: number
  y: number
  finished: boolean
}

export interface EvalOptions {
  startX: number
  startY: number
  wholeLoop: boolean
}

const DIRS: Dir[] = ['forward', 'reverse', 'alternate']

export function toDir(v: unknown): Dir {
  return DIRS.includes(v as Dir) ? (v as Dir) : 'forward'
}

export function normalizeSegments(el: SeqElementLike): NormalizedSegment[] {
  const hasList = Array.isArray(el.seqSources) && el.seqSources.length > 0
  const legacy = !hasList
  const list: RawSegment[] = hasList
    ? (el.seqSources as RawSegment[])
    : (el.source?.frames?.length ? [el.source as RawSegment] : [])
  const defFps = typeof el.frameRate === 'number' && el.frameRate > 0 ? el.frameRate : 30
  const defDir = toDir(el.direction)
  return list.map((s: RawSegment, i: number) => {
    const frames = Array.isArray(s.frames) ? s.frames.slice() : []
    let loopCount: number
    if (legacy) loopCount = el.loop === false ? 1 : -1
    else if (typeof s.loopCount === 'number' && s.loopCount !== 0) loopCount = s.loopCount < 0 ? -1 : Math.max(1, Math.floor(s.loopCount))
    else loopCount = 1
    const fps = typeof s.fps === 'number' && s.fps > 0 ? s.fps : defFps
    const m = s.move
    const moveTo =
      m?.enabled && m.to && typeof m.to.x === 'number' && typeof m.to.y === 'number'
        ? { x: m.to.x, y: m.to.y }
        : null
    const moveDurationSec =
      m?.enabled && m.duration != null && typeof m.duration === 'number' && m.duration > 0 && Number.isFinite(m.duration)
        ? m.duration
        : null
    return { name: s.name || `段${i + 1}`, frames, fps, loopCount, direction: toDir(s.direction), flipX: !!s.flipX, contentX: typeof s.contentX === 'number' ? s.contentX : 0, moveTo, moveDurationSec }
  })
}

export function segmentDuration(seg: NormalizedSegment): number {
  const n = seg.frames.length
  if (n <= 0) return 0
  if (seg.loopCount === -1) return Infinity
  return (n / seg.fps) * seg.loopCount
}

// 段实际占用时长：默认=帧自然时长；若为移动段且给了更长的独立移动时长，则延长到移动结束
export function segmentSpan(seg: NormalizedSegment): number {
  const natural = segmentDuration(seg)
  if (seg.moveTo && seg.moveDurationSec != null) {
    return Math.max(natural, seg.moveDurationSec)
  }
  return natural
}

export function segmentsTotalDuration(segs: NormalizedSegment[]): number {
  let sum = 0
  for (const s of segs) {
    const d = segmentSpan(s)
    if (!Number.isFinite(d)) return Infinity
    sum += d
  }
  return sum
}

export function hasSegmentMove(segs: NormalizedSegment[]): boolean {
  return segs.some(s => s.moveTo)
}

export function resolveFrameIndex(seg: NormalizedSegment, localSec: number): number {
  const n = seg.frames.length
  if (n <= 0) return 0
  const passDur = n / seg.fps
  const frac = localSec % passDur
  const fi = Math.min(n - 1, Math.floor((frac / passDur) * n + 1e-6))
  if (seg.direction === 'reverse') return n - 1 - fi
  if (seg.direction === 'alternate') {
    // 往复 ping-pong（两端点只在转向时出现一次）: 0,1,...,n-1,n-2,...,0,1,...
    const d = n - 1
    if (d <= 0) return 0
    const tri = Math.floor(Math.max(localSec, 0) * seg.fps)
    const m = tri % (2 * d)
    return m <= d ? m : 2 * d - m
  }
  return fi
}

export function evaluate(segs: NormalizedSegment[], elapsedSec: number, opts: EvalOptions): ChoreoState {
  if (!segs.length) {
    return { segIndex: 0, frameIndex: 0, src: null, x: opts.startX, y: opts.startY, finished: true }
  }
  const total = segmentsTotalDuration(segs)
  const finished = total > 0 && Number.isFinite(total) && !opts.wholeLoop && elapsedSec >= total
  let t = elapsedSec
  if (total > 0 && Number.isFinite(total)) {
    if (opts.wholeLoop && t >= total) t = t % total
    else if (!opts.wholeLoop && t >= total) t = total - 1e-6
  }
  if (t < 0) t = 0

  // 找到 t 落在哪一段（段边界按 segmentSpan：移动时长长于帧时长时被延长）
  let cursor = 0
  let segIndex = 0
  let local = 0
  for (let i = 0; i < segs.length; i++) {
    const d = segmentSpan(segs[i])
    if (t < cursor + d) {
      segIndex = i
      local = t - cursor
      break
    }
    cursor += d
    segIndex = i
    local = t - cursor
  }

  // 折叠加总：先算到激活段起点的位置，再算激活段内部位置
  let curX = opts.startX
  let curY = opts.startY
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    if (i > segIndex) break
    if (i < segIndex) {
      if (s.moveTo) { curX = s.moveTo.x; curY = s.moveTo.y }
      continue
    }
    // 激活段
    const natural = segmentDuration(s)
    const local0 = Math.max(local, 0)
    let frameIndex: number
    if (Number.isFinite(natural) && local0 >= natural) {
      // 移动时长超过帧时长：帧播完后冻结在自然时长结束那一帧
      frameIndex = resolveFrameIndex(s, Math.max(natural - 1e-9, 0))
    } else {
      frameIndex = resolveFrameIndex(s, local0)
    }
    let x = curX
    let y = curY
    if (s.moveTo) {
      const n = s.frames.length
      // 独立移动时长(秒)：空=与帧自然时长相同；loop=-1 时无帧时长则用单趟时长
      let denom = natural
      if (s.moveDurationSec != null) denom = s.moveDurationSec
      else if (natural === Infinity) denom = n > 0 ? n / s.fps : 0
      const p = denom > 0 ? Math.min(local0 / denom, 1) : 1
      x = curX + (s.moveTo.x - curX) * p
      y = curY + (s.moveTo.y - curY) * p
    }
    const src = s.frames[frameIndex]?.src ?? null
    return { segIndex: i, frameIndex, src, x, y, finished }
  }
  return { segIndex, frameIndex: 0, src: null, x: curX, y: curY, finished }
}
