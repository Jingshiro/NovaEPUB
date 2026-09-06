// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import LibraryView from '../LibraryView.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/library', name: 'library', component: LibraryView },
      { path: '/editor/:bookId', name: 'editor', component: { template: '<div>editor</div>' } },
    ],
  })
}

describe('LibraryView', () => {
  let pinia
  let router

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)
    router = makeRouter()
    router.push('/library')
    await router.isReady()
  })

  it('渲染书架与新建卡片', async () => {
    const wrapper = mount(LibraryView, { global: { plugins: [pinia, router] } })
    expect(wrapper.text()).toContain('我的书架')
    expect(wrapper.text()).toContain('新建 EPUB')
    expect(wrapper.text()).toContain('NovaEpub')
  })

  it('点击书目可进入编辑器路由', async () => {
    const wrapper = mount(LibraryView, { global: { plugins: [pinia, router] } })
    const store = (await import('../../stores/book')).useBookStore()
    const id = store.createBook()
    await flushPromises()
    await wrapper.vm.$nextTick()
    const item = wrapper.findAll('aside .group').find((el) => el.text().includes('未命名书籍'))
    expect(item).toBeTruthy()
    await item.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('editor')
  })
})
