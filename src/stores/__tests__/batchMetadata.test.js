// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBookStore } from '../book'

describe('批量元数据（P2）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function seedTwoBooks() {
    const store = useBookStore()
    const id1 = store.createBook()
    const id2 = store.createBook()
    return { store, id1, id2 }
  }

  it('批量更新：非 null 字段覆盖所有目标书', () => {
    const { store, id1, id2 } = seedTwoBooks()
    const changed = store.batchUpdateBooks([id1, id2], { author: '张三', language: 'en' })
    expect(changed).toHaveLength(2)
    expect(store.library[id1].author).toBe('张三')
    expect(store.library[id2].author).toBe('张三')
    expect(store.library[id1].language).toBe('en')
    expect(store.library[id2].language).toBe('en')
  })

  it('批量更新：null 字段保持原值', () => {
    const { store, id1, id2 } = seedTwoBooks()
    store.library[id1].author = '李四'
    store.batchUpdateBooks([id1, id2], { author: null, subject: '奇幻, 冒险' })
    expect(store.library[id1].author).toBe('李四')
    expect(store.library[id2].author).toBe('佚名')
    expect(store.library[id1].subject).toBe('奇幻, 冒险')
    expect(store.library[id2].subject).toBe('奇幻, 冒险')
  })

  it('空 patch 或空列表不修改任何书', () => {
    const { store, id1 } = seedTwoBooks()
    expect(store.batchUpdateBooks([id1], {})).toEqual([])
    expect(store.batchUpdateBooks([], { author: 'X' })).toEqual([])
    expect(store.library[id1].author).toBe('佚名')
  })

  it('不存在的 id 会被跳过', () => {
    const { store, id1 } = seedTwoBooks()
    const changed = store.batchUpdateBooks([id1, 'no-such-id'], { publisher: '某出版社' })
    expect(changed).toEqual([id1])
    expect(store.library[id1].publisher).toBe('某出版社')
  })
})
