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
})
