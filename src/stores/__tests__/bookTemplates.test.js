// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTemplateStore } from '../templates'
import { useBookStore } from '../book'

describe('书内模板库（B2）', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('没有任何书内模板时，effectiveTemplates 回退全局模板池', () => {
    const store = useTemplateStore()
    store.ensureLoaded()
    expect(store.effectiveTemplates('book-1')).toEqual(store.templates)
  })

  it('addBookTemplate 后，本书用自己的书内模板；其他书仍用全局', () => {
    const store = useTemplateStore()
    store.ensureLoaded()
    const globalCount = store.templates.length
    store.addBookTemplate('b1', { name: '本书专属', html: '<p class="x">$1</p>' })
    expect(store.effectiveTemplates('b1')).toHaveLength(1)
    expect(store.effectiveTemplates('b1')[0].name).toBe('本书专属')
    expect(store.effectiveTemplates('b1')[0].scope).toBe('book')
    // 其他书不受影响，仍回退全局池
    expect(store.effectiveTemplates('b2')).toHaveLength(globalCount)
  })

  it('copyGlobalToBook 复制全局模板并分配新 id', () => {
    const store = useTemplateStore()
    store.ensureLoaded()
    const ids = store.templates.map((t) => t.id)
    const count = store.copyGlobalToBook('b1')
    expect(count).toBe(store.templates.length)
    const bookTpl = store.bookList('b1')
    expect(bookTpl.every((t) => !ids.includes(t.id))).toBe(true)
    expect(bookTpl.every((t) => t.scope === 'book')).toBe(true)
    // 同名不重复复制：第二次调用返回 0
    expect(store.copyGlobalToBook('b1')).toBe(0)
  })

  it('deleteBookTemplate 删空后回退全局池', () => {
    const store = useTemplateStore()
    store.ensureLoaded()
    const tpl = store.addBookTemplate('b1', { name: 'X' })
    store.deleteBookTemplate('b1', tpl.id)
    expect(store.bookList('b1')).toEqual([])
    expect(store.effectiveTemplates('b1')).toEqual(store.templates)
  })

  it('clearBookTemplates 一键回退全局池', () => {
    const store = useTemplateStore()
    store.ensureLoaded()
    store.addBookTemplate('b1', { name: 'A' })
    store.addBookTemplate('b1', { name: 'B' })
    store.clearBookTemplates('b1')
    expect(store.effectiveTemplates('b1')).toEqual(store.templates)
  })

  it('删除书会一并清理该书书内模板', () => {
    const tStore = useTemplateStore()
    tStore.ensureLoaded()
    const bStore = useBookStore()
    const id = bStore.createBook()
    tStore.addBookTemplate(id, { name: '书内' })
    expect(tStore.bookList(id)).toHaveLength(1)
    bStore.deleteBook(id)
    expect(tStore.bookList(id)).toEqual([])
  })

  it('书内模板持久化到 localStorage', () => {
    const store = useTemplateStore()
    store.ensureLoaded()
    store.addBookTemplate('b1', { name: '持久' })
    const raw = localStorage.getItem('novaepub:book-templates')
    expect(raw).toContain('持久')
  })
})
