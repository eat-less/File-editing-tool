import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/api/project', () => ({
  getProgram: vi.fn(),
  saveConfig: vi.fn(),
}))

import { useEditorStore } from './editor'

function mkLayer(id: string, type = 'text', extra: Record<string, any> = {}) {
  return {
    id: `layer-${id}`, name: id, locked: false, visible: true,
    animations: [], hotspot: null, groupParentId: undefined,
    element: { id, type, name: id, x: 0, y: 0, width: 100, height: 100, ...extra },
  } as any
}

function setup() {
  const store = useEditorStore()
  store.pages = [{
    id: 'p1', name: '页面1', layers: [
      mkLayer('a'), mkLayer('b'), mkLayer('c'),
      mkLayer('box', 'container', { members: [] }),
    ],
  } as any]
  store.currentPageIndex = 0
  return store
}

beforeEach(() => { setActivePinia(createPinia()) })

describe('selectLayer 模式', () => {
  it('单选替换', () => {
    const s = setup()
    s.selectLayer('a')
    s.selectLayer('b')
    expect(s.selectedLayerIds).toEqual(['b'])
  })

  it('Ctrl toggle: 再次点击取消', () => {
    const s = setup()
    s.selectLayer('a')
    s.selectLayer('b', true)
    s.selectLayer('a', true)
    expect(s.selectedLayerIds).toEqual(['b'])
  })

  it('Shift additive: 再次点击不取消', () => {
    const s = setup()
    s.selectLayer('a')
    s.selectLayer('b', true, true)
    s.selectLayer('a', true, true)
    expect(s.selectedLayerIds).toEqual(['a', 'b'])
  })
})

describe('批量选择', () => {
  it('setSelection 去重', () => {
    const s = setup()
    s.setSelection(['a', 'a', 'b'])
    expect(s.selectedLayerIds).toEqual(['a', 'b'])
  })

  it('addToSelection 并集', () => {
    const s = setup()
    s.setSelection(['a'])
    s.addToSelection(['b', 'a'])
    expect(s.selectedLayerIds).toEqual(['a', 'b'])
  })

  it('selectAllLayers 只选可见图层', () => {
    const s = setup()
    s.currentPage!.layers[1].visible = false
    s.selectAllLayers()
    expect([...s.selectedLayerIds].sort()).toEqual(['a', 'box', 'c'])
  })
})

describe('容器成员', () => {
  it('addToContainer 写入 members 与 groupParentId 并扩展包围盒', () => {
    const s = setup()
    s.currentPage!.layers[0].element.x = 200
    s.currentPage!.layers[0].element.y = 100
    s.addToContainer('box', ['a', 'b'])
    const box = s.currentPage!.layers.find(l => l.element.id === 'box')!.element
    expect(box.members).toEqual(['a', 'b'])
    expect(s.currentPage!.layers.find(l => l.element.id === 'a')!.groupParentId).toBe('box')
    expect(box.x).toBe(-10)
    expect(box.y).toBe(-10)
    expect(box.width).toBe(320)
    expect(box.height).toBe(220)
  })

  it('从旧容器转移到新容器', () => {
    const s = setup()
    s.currentPage!.layers.push(mkLayer('box2', 'container', { members: [] }))
    s.addToContainer('box', ['a'])
    s.addToContainer('box2', ['a'])
    const box1 = s.currentPage!.layers.find(l => l.element.id === 'box')!.element
    const box2 = s.currentPage!.layers.find(l => l.element.id === 'box2')!.element
    expect(box1.members).toEqual([])
    expect(box2.members).toEqual(['a'])
    expect(s.currentPage!.layers.find(l => l.element.id === 'a')!.groupParentId).toBe('box2')
  })

  it('removeFromContainer 清理 members 与 groupParentId', () => {
    const s = setup()
    s.addToContainer('box', ['a', 'b'])
    s.removeFromContainer(['a'])
    const box = s.currentPage!.layers.find(l => l.element.id === 'box')!.element
    expect(box.members).toEqual(['b'])
    expect(s.currentPage!.layers.find(l => l.element.id === 'a')!.groupParentId).toBeUndefined()
  })

  it('translateGroupMembers 只移动成员，分组框位置不变', () => {
    const s = setup()
    s.addToContainer('box', ['a', 'b'])
    const box = s.currentPage!.layers.find(l => l.element.id === 'box')!.element
    const boxX = box.x
    const boxY = box.y
    s.translateGroupMembers('box', 10, 5)
    expect(s.currentPage!.layers.find(l => l.element.id === 'a')!.element.x).toBe(10)
    expect(s.currentPage!.layers.find(l => l.element.id === 'a')!.element.y).toBe(5)
    expect(s.currentPage!.layers.find(l => l.element.id === 'b')!.element.x).toBe(10)
    expect(s.currentPage!.layers.find(l => l.element.id === 'b')!.element.y).toBe(5)
    expect(box.x).toBe(boxX)
    expect(box.y).toBe(boxY)
  })
})
