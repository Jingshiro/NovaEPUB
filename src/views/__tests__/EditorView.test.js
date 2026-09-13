// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import EditorView from '../EditorView.vue'
import { useBookStore } from '../../stores/book'

function makeRouter(bookId) {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/library', name: 'library', component: { template: '<div>library</div>' } },
      { path: '/editor/:bookId', name: 'editor', component: EditorView, props: true },
    ],
  })
}

describe('EditorView', () => {
  let router
  let pinia
  let bookId

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)
    const store = useBookStore()
    bookId = store.createBook()
    store.updateBook({ title: '测试书', author: '镜' })
    router = makeRouter(bookId)
    router.push(`/editor/${bookId}`)
    await router.isReady()
  })

  it('渲染三栏编辑器与工具栏', async () => {
    const wrapper = mount(EditorView, {
      global: { plugins: [pinia, router] },
      props: { bookId },
    })
    expect(wrapper.text()).toContain('测试书')
    expect(wrapper.text()).toContain('目录')
    expect(wrapper.text()).toContain('导出 EPUB')
    expect(wrapper.text()).toContain('属性')
  })

  it('打开已有内容的书时编辑器能加载章节内容（2026-09-12 回归：导入书首次进入空白）', async () => {
    const store = useBookStore()
    const chapter = store.activeBook.chapters[0]
    store.saveChapterContent(chapter.id, '<p>已导入内容哈哈</p>')
    const wrapper = mount(EditorView, {
      global: { plugins: [pinia, router] },
      props: { bookId },
    })
    await new Promise((r) => setTimeout(r, 100))
    const pm = wrapper.find('.ProseMirror')
    expect(pm.exists()).toBe(true)
    expect(pm.text()).toContain('已导入内容哈哈')
  })

  it('从书架点击进入时 activeBookId 尚未加载也有兜底，不白屏', async () => {
    const pinia2 = createPinia()
    setActivePinia(pinia2)
    const store = useBookStore()
    const id = store.createBook()
    store.updateBook({ title: '新书A' })
    // 模拟「点击书跳转、但尚未 loadBook」的状态
    store.activeBookId = null
    const router2 = makeRouter(id)
    router2.push(`/editor/${id}`)
    await router2.isReady()
    const wrapper = mount(EditorView, {
      global: { plugins: [pinia2, router2] },
      props: { bookId: id },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('新书A')
    expect(wrapper.text()).toContain('导出 EPUB')
  })
})
