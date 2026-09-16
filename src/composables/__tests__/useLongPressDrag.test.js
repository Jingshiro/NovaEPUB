// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useLongPressDrag } from '../useLongPressDrag'

/**
 * 造一个带真实尺寸的宿主组件，让 composable 能测量行高。
 * jsdom 不做布局，getBoundingClientRect 默认全 0，这里手动打桩。
 */
function mountHarness({ count = 4, holdMs = 350, onDrop = () => {} } = {}) {
  let api
  const Host = defineComponent({
    setup() {
      api = useLongPressDrag({ holdMs, getItemCount: () => count, onDrop })
      return () => h('div', { class: 'list' }, [
        h('div', {
          class: 'row',
          onTouchstart: (e) => api.start(0, e, e.currentTarget),
          onTouchmove: (e) => api.move(e),
          onTouchend: () => api.end(),
        }),
      ])
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  return { wrapper, get api() { return api } }
}

/** 造一个带坐标的 touch 事件。 */
function touchEvent(type, x, y) {
  const ev = new Event(type, { bubbles: true, cancelable: true })
  ev.touches = [{ clientX: x, clientY: y }]
  return ev
}

const rowEl = () => document.querySelector('.row')
const ROW_H = 40
const LIST_TOP = 100

beforeEach(() => {
  vi.useFakeTimers()
  // 让列表与行的几何信息可预测：列表顶 100，每行 40px
  Element.prototype.getBoundingClientRect = function () {
    if (this.classList?.contains('list')) {
      return { top: LIST_TOP, bottom: LIST_TOP + ROW_H * 4, left: 0, right: 200, width: 200, height: ROW_H * 4, x: 0, y: LIST_TOP }
    }
    if (this.classList?.contains('row')) {
      return { top: LIST_TOP, bottom: LIST_TOP + ROW_H, left: 0, right: 200, width: 200, height: ROW_H, x: 0, y: LIST_TOP }
    }
    return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 }
  }
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('useLongPressDrag（触摸端长按拖拽）', () => {
  it('长按超过阈值后进入拖拽态', async () => {
    const { api } = mountHarness()
    api.start(0, touchEvent('touchstart', 10, LIST_TOP + 5), rowEl())
    expect(api.dragging.value).toBe(false)

    vi.advanceTimersByTime(400)
    expect(api.dragging.value).toBe(true)
  })

  it('没到阈值就松手不算拖拽，也不触发排序', () => {
    const onDrop = vi.fn()
    const { api } = mountHarness({ onDrop })
    api.start(0, touchEvent('touchstart', 10, LIST_TOP + 5), rowEl())
    vi.advanceTimersByTime(100)
    api.end()

    expect(api.dragging.value).toBe(false)
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('长按之前移动超过阈值（滚动）会取消长按', () => {
    const { api } = mountHarness()
    api.start(0, touchEvent('touchstart', 10, LIST_TOP + 5), rowEl())
    api.move(touchEvent('touchmove', 10, LIST_TOP + 60)) // 移动 55px
    vi.advanceTimersByTime(400)

    expect(api.dragging.value).toBe(false)
  })

  it('拖到别的行松手会触发排序（from → to）', () => {
    const onDrop = vi.fn()
    const { api } = mountHarness({ onDrop })
    api.start(0, touchEvent('touchstart', 10, LIST_TOP + 5), rowEl())
    vi.advanceTimersByTime(400)
    expect(api.dragging.value).toBe(true)

    // 拖到第 3 行（索引 2）：y = top + 2*rowH + 半行
    api.move(touchEvent('touchmove', 10, LIST_TOP + ROW_H * 2 + 10))
    expect(api.overIndex.value).toBe(2)

    api.end()
    expect(onDrop).toHaveBeenCalledWith(0, 2)
  })

  it('拖回原位松手不触发排序', () => {
    const onDrop = vi.fn()
    const { api } = mountHarness({ onDrop })
    api.start(0, touchEvent('touchstart', 10, LIST_TOP + 5), rowEl())
    vi.advanceTimersByTime(400)
    api.move(touchEvent('touchmove', 10, LIST_TOP + 5))
    api.end()

    expect(onDrop).not.toHaveBeenCalled()
  })

  it('目标索引会被夹在列表范围内（拖到列表上方/下方不越界）', () => {
    const { api } = mountHarness({ count: 4 })
    api.start(0, touchEvent('touchstart', 10, LIST_TOP + 5), rowEl())
    vi.advanceTimersByTime(400)

    api.move(touchEvent('touchmove', 10, LIST_TOP - 500))
    expect(api.overIndex.value).toBe(0)

    api.move(touchEvent('touchmove', 10, LIST_TOP + 5000))
    expect(api.overIndex.value).toBe(3)
  })

  it('拖拽结束后抑制一次 click（避免拖完误跳章节）', () => {
    const { api } = mountHarness()
    api.start(0, touchEvent('touchstart', 10, LIST_TOP + 5), rowEl())
    vi.advanceTimersByTime(400)
    api.end()

    expect(api.suppressClick()).toBe(true)
    // 只吞掉一次
    expect(api.suppressClick()).toBe(false)
  })

  it('普通点击（没有拖拽）不抑制 click', () => {
    const { api } = mountHarness()
    api.start(0, touchEvent('touchstart', 10, LIST_TOP + 5), rowEl())
    vi.advanceTimersByTime(100)
    api.end()

    expect(api.suppressClick()).toBe(false)
  })

  it('多指触摸直接重置，避免误触发拖拽', () => {
    const { api } = mountHarness()
    const ev = new Event('touchstart', { bubbles: true })
    ev.touches = [{ clientX: 1, clientY: 1 }, { clientX: 2, clientY: 2 }]
    api.start(0, ev, rowEl())
    vi.advanceTimersByTime(400)

    expect(api.dragging.value).toBe(false)
    expect(api.dragIndex.value).toBe(null)
  })
})
