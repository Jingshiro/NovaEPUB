// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../../App.vue'
import LibraryView from '../LibraryView.vue'
import EditorView from '../EditorView.vue'
import { useBookStore } from '../../stores/book'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/library', name: 'library', component: LibraryView },
      { path: '/editor/:bookId', name: 'editor', component: EditorView, props: true },
    ],
  })
}

describe('端到端：从书架点击进入编辑器', () => {
  let router
  let pinia

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)
    const store = useBookStore()
    const id = store.createBook()
    store.updateBook({ title: '端到端书' })
    store.activeBookId = null // 模拟从书架点击时尚未 loadBook
    router = makeRouter()
    router.push('/library')
    await router.isReady()
  })

  it('点击书目后编辑器正常渲染，不白屏', async () => {
    const wrapper = mount(App, { global: { plugins: [pinia, router] } })
    // 找到侧边栏中的书籍并点击
    const item = wrapper.findAll('aside .group').find((el) => el.text().includes('端到端书'))
    expect(item).toBeTruthy()
    await item.trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('editor')
    const text = wrapper.text()
    expect(text).toContain('端到端书')
    expect(text).toContain('导出 EPUB')
  })
})
