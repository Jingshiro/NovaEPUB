// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BookMetadataModal from '../BookMetadataModal.vue'
import { useBookStore } from '../../../stores/book'
import { useUiStore } from '../../../stores/ui'

let wrapper

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

function setup({ cover = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const bookStore = useBookStore()
  bookStore.createBook()
  bookStore.updateBook({ title: '封面书', cover })
  const uiStore = useUiStore()
  uiStore.metadataModalOpen = true
  return { pinia, bookStore, uiStore }
}

describe('BookMetadataModal 封面更换', () => {
  it('打开弹窗时显示封面预览', () => {
    const { pinia } = setup()
    wrapper = mount(BookMetadataModal, {
      global: { plugins: [pinia] },
      attachTo: document.body,
    })
    expect(document.body.textContent).toContain('封面')
    expect(document.querySelector('img[alt="封面预览"]')).toBeTruthy()
  })

  it('点击移除封面后保存会清除 book.cover', async () => {
    const { pinia, bookStore, uiStore } = setup()
    wrapper = mount(BookMetadataModal, {
      global: { plugins: [pinia] },
      attachTo: document.body,
    })
    const remove = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('移除封面'))
    expect(remove).toBeTruthy()
    remove.click()
    await wrapper.vm.$nextTick()
    const save = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '保存')
    save.click()
    await wrapper.vm.$nextTick()
    expect(bookStore.activeBook.cover).toBe('')
    expect(uiStore.metadataModalOpen).toBe(false)
  })
})