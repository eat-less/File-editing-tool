import { describe, it, expect } from 'vitest'
import {
  normalizeSegments, segmentDuration, segmentsTotalDuration, hasSegmentMove,
  resolveFrameIndex, evaluate,
} from './seqChoreography'
import type { SeqElementLike } from './seqChoreography'

const f = (n: number) => Array.from({ length: n }, (_, i) => ({ src: `f${i}`, index: i }))

describe('normalizeSegments', () => {
  it('legacy single source -> 一段无限循环，无位移，用元素默认 fps/方向', () => {
    const el: SeqElementLike = {
      frameRate: 30, direction: 'forward', loop: undefined,
      source: { type: 'folder', frames: f(4) },
    }
    const segs = normalizeSegments(el)
    expect(segs).toHaveLength(1)
    expect(segs[0].loopCount).toBe(-1)
    expect(segs[0].moveTo).toBeNull()
    expect(segs[0].frames.map(x => x.src)).toEqual(['f0', 'f1', 'f2', 'f3'])
  })

  it('legacy 且 loop=false -> 循环一次', () => {
    const el: SeqElementLike = { loop: false, source: { frames: f(2) } }
    expect(normalizeSegments(el)[0].loopCount).toBe(1)
  })

  it('seqSources 多段：段级 fps/direction/loopCount/flipX/move 生效，缺省回退元素值', () => {
    const el: SeqElementLike = {
      frameRate: 30, direction: 'forward',
      seqSources: [
        { name: 'walk', frames: f(8), loopCount: 3, fps: 24 },
        { name: 'turn', frames: f(4), loopCount: 1, direction: 'reverse', flipX: true,
          move: { enabled: true, to: { x: 400, y: 100 } } },
        { name: 'static', frames: f(2) },
      ],
    }
    const segs = normalizeSegments(el)
    expect(segs[0]).toMatchObject({ name: 'walk', fps: 24, loopCount: 3, direction: 'forward', flipX: false, moveTo: null })
    expect(segs[1]).toMatchObject({ fps: 30, loopCount: 1, direction: 'reverse', flipX: true, moveTo: { x: 400, y: 100 } })
    expect(segs[2]).toMatchObject({ fps: 30, loopCount: 1, direction: 'forward', moveTo: null })
  })

  it('move.enabled=false 或坐标缺失 -> moveTo=null', () => {
    const el: SeqElementLike = {
      seqSources: [
        { frames: f(2), move: { enabled: true } },
        { frames: f(2), move: { enabled: false, to: { x: 5, y: 5 } } },
      ],
    }
    const segs = normalizeSegments(el)
    expect(segs[0].moveTo).toBeNull()
    expect(segs[1].moveTo).toBeNull()
  })
})

describe('normalizeSegments contentX', () => {
  it('缺省 contentX = 0', () => {
    const segs = normalizeSegments({ seqSources: [{ frames: f(2) }] })
    expect(segs[0].contentX).toBe(0)
  })
  it('段级 contentX 透传（允许负数）', () => {
    const segs = normalizeSegments({
      seqSources: [
        { frames: f(2), contentX: 120 },
        { frames: f(2), contentX: -30 },
      ],
    })
    expect(segs[0].contentX).toBe(120)
    expect(segs[1].contentX).toBe(-30)
  })
  it('legacy source 段 contentX = 0', () => {
    const segs = normalizeSegments({ source: { frames: f(2) } })
    expect(segs[0].contentX).toBe(0)
  })
})

describe('normalizeSegments moveDurationSec', () => {
  it('move.duration>0 有限数透传，否则 null', () => {
    const segs = normalizeSegments({
      seqSources: [
        { frames: f(4), move: { enabled: true, to: { x: 10, y: 0 }, duration: 1.5 } },
        { frames: f(4), move: { enabled: true, to: { x: 10, y: 0 }, duration: null } },
        { frames: f(4), move: { enabled: true, to: { x: 10, y: 0 } } },
        { frames: f(4) },
      ],
    })
    expect(segs[0].moveDurationSec).toBe(1.5)
    expect(segs[1].moveDurationSec).toBeNull()
    expect(segs[2].moveDurationSec).toBeNull()
    expect(segs[3].moveDurationSec).toBeNull()
  })
  it('move.enabled=false 时即使给了 duration 也不生效', () => {
    const segs = normalizeSegments({
      seqSources: [{ frames: f(4), move: { enabled: false, to: { x: 10, y: 0 }, duration: 2 } }],
    })
    expect(segs[0].moveDurationSec).toBeNull()
  })
})

describe('duration', () => {
  it('segmentDuration = 帧数/fps × loopCount；loopCount=-1 为 Infinity', () => {
    const s = { name: '', frames: f(24), fps: 24, loopCount: 3, direction: 'forward' as const, flipX: false, moveTo: null }
    expect(segmentDuration(s)).toBeCloseTo(3)
    expect(segmentDuration({ ...s, loopCount: -1 })).toBe(Infinity)
  })
  it('segmentsTotalDuration 累计；含无限段为 Infinity', () => {
    const mk = (frames: number, loopCount: number, fps = 24) =>
      ({ name: '', frames: f(frames), fps, loopCount, direction: 'forward' as const, flipX: false, moveTo: null })
    expect(segmentsTotalDuration([mk(24, 1), mk(12, 2)])).toBeCloseTo(2)
    expect(segmentsTotalDuration([mk(24, 1), mk(12, -1)])).toBe(Infinity)
  })
  it('hasSegmentMove 识别是否有位移段', () => {
    const mk = (moveTo: any) =>
      ({ name: '', frames: f(2), fps: 24, loopCount: 1, direction: 'forward' as const, flipX: false, moveTo })
    expect(hasSegmentMove([mk(null), mk(null)])).toBe(false)
    expect(hasSegmentMove([mk(null), mk({ x: 1, y: 2 })])).toBe(true)
  })
})

describe('resolveFrameIndex', () => {
  const seg = (dir: 'forward' | 'reverse' | 'alternate') =>
    ({ name: '', frames: f(4), fps: 10, loopCount: 1, direction: dir, flipX: false, moveTo: null })
  it('forward 按节拍推进 0..3', () => {
    expect(resolveFrameIndex(seg('forward'), 0.0)).toBe(0)
    expect(resolveFrameIndex(seg('forward'), 0.1)).toBe(1)
    expect(resolveFrameIndex(seg('forward'), 0.399)).toBe(3)
  })
  it('reverse 是倒序', () => {
    expect(resolveFrameIndex(seg('reverse'), 0.0)).toBe(3)
    expect(resolveFrameIndex(seg('reverse'), 0.1)).toBe(2)
  })
  it('alternate 往复 ping-pong（两端点只在转向时出现一次）', () => {
    const s = seg('alternate')
    expect(resolveFrameIndex(s, 0.05)).toBe(0)
    expect(resolveFrameIndex(s, 0.15)).toBe(1)
    expect(resolveFrameIndex(s, 0.35)).toBe(3)   // 正向到顶
    expect(resolveFrameIndex(s, 0.55)).toBe(1)   // 返回途中
    expect(resolveFrameIndex(s, 0.65)).toBe(0)   // 回到起点
    expect(resolveFrameIndex(s, 0.75)).toBe(1)   // 再次上行
  })
})

describe('evaluate', () => {
  const mk = (frames: number, loopCount: number, moveTo: { x: number; y: number } | null, fps = 10, dir: 'forward' | 'reverse' | 'alternate' = 'forward') =>
    ({ name: '', frames: f(frames), fps, loopCount, direction: dir, flipX: false, moveTo })

  it('单段 forward loop1 + 位移(0,0)->(100,0)，位置随段进度线性', () => {
    const segs = [mk(4, 1, { x: 100, y: 0 })]
    const s0 = evaluate(segs, 0, { startX: 0, startY: 0, wholeLoop: false })
    expect(s0.x).toBeCloseTo(0); expect(s0.segIndex).toBe(0)
    const sMid = evaluate(segs, 0.2, { startX: 0, startY: 0, wholeLoop: false })
    expect(sMid.x).toBeCloseTo(50)
    const sEnd = evaluate(segs, 0.4, { startX: 0, startY: 0, wholeLoop: false })
    expect(sEnd.x).toBeCloseTo(100); expect(sEnd.frameIndex).toBe(3); expect(sEnd.src).toBe('f3')
  })

  it('静止段 x/y 保持在段起点', () => {
    const segs = [mk(4, 1, null), mk(4, 1, { x: 200, y: 0 })]
    const s = evaluate(segs, 0.2, { startX: 10, startY: 20, wholeLoop: false })
    expect(s.segIndex).toBe(0)
    expect(s.x).toBeCloseTo(10); expect(s.y).toBeCloseTo(20)
  })

  it('多段顺序衔接：段2起点=段1终点', () => {
    const segs = [mk(4, 1, { x: 100, y: 0 }), mk(4, 1, { x: 300, y: 0 })]
    const mid = evaluate(segs, 0.39, { startX: 0, startY: 0, wholeLoop: false })
    expect(mid.segIndex).toBe(0)
    const start2 = evaluate(segs, 0.4, { startX: 0, startY: 0, wholeLoop: false })
    expect(start2.segIndex).toBe(1)
    expect(start2.x).toBeCloseTo(100)
    const end2 = evaluate(segs, 0.8, { startX: 0, startY: 0, wholeLoop: false })
    expect(end2.x).toBeCloseTo(300); expect(end2.finished).toBe(true)
  })

  it('播完(非循环)停在末段最后一帧与终点', () => {
    const segs = [mk(4, 1, { x: 100, y: 0 })]
    const s = evaluate(segs, 5, { startX: 0, startY: 0, wholeLoop: false })
    expect(s.finished).toBe(true)
    expect(s.frameIndex).toBe(3); expect(s.src).toBe('f3'); expect(s.x).toBeCloseTo(100)
  })

  it('wholeLoop=true：超过总时长回绕到段0起点', () => {
    const segs = [mk(4, 1, { x: 100, y: 0 }), mk(4, 1, { x: 200, y: 0 })]
    const s = evaluate(segs, 0.8, { startX: 0, startY: 0, wholeLoop: true })
    expect(s.segIndex).toBe(0)
    expect(s.x).toBeCloseTo(0); expect(s.src).toBe('f0')
    expect(s.finished).toBe(false)
  })

  it('多段循环帧（loopCount=3）内推进', () => {
    const segs = [mk(4, 3, { x: 120, y: 0 })]
    const s = evaluate(segs, 0.4, { startX: 0, startY: 0, wholeLoop: false })
    expect(s.segIndex).toBe(0)
    expect(s.src).toBe('f0')          // 第2趟起点
    expect(s.x).toBeCloseTo(40)       // 1/3 总时长
    const tail = evaluate(segs, 1.2 - 1e-6, { startX: 0, startY: 0, wholeLoop: false })
    expect(tail.x).toBeCloseTo(120)
  })

  it('移动时长短于帧时长：提前到位后原地播帧到段尾', () => {
    const mkD = (dur: number) =>
      ({ name: '', frames: f(4), fps: 10, loopCount: 1, direction: 'forward' as const, flipX: false, moveTo: { x: 100, y: 0 }, moveDurationSec: dur })
    const segs = [mkD(0.2)]           // 帧自然时长 0.4s
    const mid = evaluate(segs, 0.3, { startX: 0, startY: 0, wholeLoop: false })
    expect(mid.segIndex).toBe(0)      // 段还没结束
    expect(mid.x).toBeCloseTo(100)    // 已到位
    expect(mid.src).not.toBeNull()    // 帧继续播
    const end = evaluate(segs, 0.4, { startX: 0, startY: 0, wholeLoop: false })
    expect(end.finished).toBe(true)
    expect(end.x).toBeCloseTo(100)
  })

  it('移动时长超过帧时长：帧播完冻结末帧，继续移动到移动结束才进下一段', () => {
    const mkD = (dur: number) =>
      ({ name: '', frames: f(4), fps: 10, loopCount: 1, direction: 'forward' as const, flipX: false, moveTo: { x: 100, y: 0 }, moveDurationSec: dur })
    const segs = [mkD(1.0)]           // 帧自然时长只有 0.4s
    const atDot5 = evaluate(segs, 0.5, { startX: 0, startY: 0, wholeLoop: false })
    expect(atDot5.segIndex).toBe(0)   // 段未结束(被延长)
    expect(atDot5.src).toBe('f3')     // 冻结在末帧
    expect(atDot5.x).toBeCloseTo(50)  // 仍在移动(0.5/1.0)
    const end = evaluate(segs, 1.0, { startX: 0, startY: 0, wholeLoop: false })
    expect(end.finished).toBe(true)
    expect(end.x).toBeCloseTo(100)
  })

  it('移动时长长的段，其总时长=max(帧时长,移动时长) 且后续段从其结束后开始', () => {
    const mkD = (dur: number) =>
      ({ name: '', frames: f(4), fps: 10, loopCount: 1, direction: 'forward' as const, flipX: false, moveTo: { x: 100, y: 0 }, moveDurationSec: dur })
    const second = { name: '', frames: f(4), fps: 10, loopCount: 1, direction: 'forward' as const, flipX: false, moveTo: { x: 200, y: 0 }, moveDurationSec: null }
    const segs = [mkD(1.0), second]   // spans: 1.0 + 0.4 = 1.4
    const atStart2 = evaluate(segs, 1.0, { startX: 0, startY: 0, wholeLoop: false })
    expect(atStart2.segIndex).toBe(1)
    expect(atStart2.x).toBeCloseTo(100)
    const fin = evaluate(segs, 1.4, { startX: 0, startY: 0, wholeLoop: false })
    expect(fin.finished).toBe(true)
    expect(fin.x).toBeCloseTo(200)
  })
})
