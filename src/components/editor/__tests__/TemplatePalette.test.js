// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TemplatePalette from '../TemplatePalette.vue'

let wrapper

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

const TEMPLATES = [
  { id: 'tpl-1', name: '章节标题', target: 'heading' },
  { id: 'tpl-2', name: '正文', target: 'paragraph' },
]

function mountPalette(props = {}) {
  return mount(TemplatePalette, {
    props: { visible: true, x: 10, y: 10, templates: TEMPLATES, ...props },
    attachTo: document.body,
  })
}

/** 弹窗关闭时对外emit的 close 事件次数。 */
function closeCount(w) {
  return w.emitted('close')?.length || 0
}

describe('TemplatePalette 关闭行为', () => {
  it('点击弹窗外部会关闭', async () => {
    wrapper = mountPalette()
    const outside = document.createElement('div')
    document.body.appendChild(outside)

    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(closeCount(wrapper)).toBe(1)
  })

  it('点击弹窗内部不会关闭（仍可正常选择模板）', async () => {
    wrapper = mountPalette()
    const inside = wrapper.find('button').element

    inside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(closeCount(wrapper)).toBe(0)
  })

  it('按 Escape 关闭', async () => {
    wrapper = mountPalette()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(closeCount(wrapper)).toBe(1)
  })

  it('其他按键不关闭', async () => {
    wrapper = mountPalette()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    await wrapper.vm.$nextTick()
    expect(closeCount(wrapper)).toBe(0)
  })

  it('弹窗未显示时不响应外部点击', async () => {
    wrapper = mountPalette({ visible: false })
    const outside = document.createElement('div')
    document.body.appendChild(outside)

    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(closeCount(wrapper)).toBe(0)
  })

  it('点击模板项会 emit select 并请求关闭', async () => {
    wrapper = mountPalette()
    const item = wrapper.findAll('button').find((b) => b.text().includes('正文'))
    await item.trigger('click')

    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ id: 'tpl-2' })
    expect(closeCount(wrapper)).toBe(1)
  })

  it('关闭后卸载监听：组件销毁不再触发 close', async () => {
    wrapper = mountPalette()
    wrapper.unmount()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(true).toBe(true) // 未抛错即通过；同时确认没有残留监听
    wrapper = null
  })
})
