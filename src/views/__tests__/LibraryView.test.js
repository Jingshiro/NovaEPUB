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
    localStorage.clear()
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
    store.createBook()
    await flushPromises()
    await wrapper.vm.$nextTick()
    const item = wrapper.findAll('aside .group').find((el) => el.text().includes('未命名书籍'))
    expect(item).toBeTruthy()
    await item.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('editor')
  })

  it('未选中任何书时全选按钮可用；全选后禁用', async () => {
    const wrapper = mount(LibraryView, { global: { plugins: [pinia, router] } })
    const store = (await import('../../stores/book')).useBookStore()
    store.createBook()
    store.createBook()
    await flushPromises()
    await wrapper.vm.$nextTick()

    // 进入批量选择模式
    const selectModeBtn = wrapper.findAll('button').find((b) => b.text() === '批量选择')
    expect(selectModeBtn).toBeTruthy()
    await selectModeBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const selectAllBtn = wrapper.findAll('button').find((b) => b.text() === '全选')
    expect(selectAllBtn).toBeTruthy()
    expect(selectAllBtn.attributes('disabled')).toBeUndefined()

    await selectAllBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('已选 2 本')
    // 已全选后按钮应禁用
    const selectAllAfter = wrapper.findAll('button').find((b) => b.text() === '全选')
    expect(selectAllAfter.attributes('disabled')).toBeDefined()
  })
})
