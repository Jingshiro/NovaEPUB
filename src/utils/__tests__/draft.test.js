import { describe, it, expect } from 'vitest'
import { isDraftDifferentFromLibrary, findRecoverableDrafts } from '../draft'

describe('draft 草稿恢复判断', () => {
  it('本地库没有这本书时视为需要恢复', () => {
    expect(isDraftDifferentFromLibrary(null, { id: 'a', title: '草稿' })).toBe(true)
  })

  it('草稿与本地库一致时不需要恢复', () => {
    const book = { id: 'a', title: '书', chapters: [] }
    expect(isDraftDifferentFromLibrary(book, JSON.parse(JSON.stringify(book)))).toBe(false)
  })

  it('草稿比本地库新时提示恢复', () => {
    const libraryBook = { id: 'a', title: '旧', chapters: [], updatedAt: '2026-01-01' }
    const draftBook = { id: 'a', title: '新', chapters: [], updatedAt: '2026-01-02' }
    expect(isDraftDifferentFromLibrary(libraryBook, draftBook)).toBe(true)
  })

  it('草稿比本地库旧时不提示恢复，避免把已保存的新内容回退', () => {
    const libraryBook = { id: 'a', title: '新', chapters: [], updatedAt: '2026-01-02' }
    const draftBook = { id: 'a', title: '旧', chapters: [], updatedAt: '2026-01-01' }
    expect(isDraftDifferentFromLibrary(libraryBook, draftBook)).toBe(false)
  })

  it('findRecoverableDrafts 只返回有差异的草稿并按时间倒序', () => {
    const library = {
      a: { id: 'a', title: '一致' },
      b: { id: 'b', title: '旧' },
    }
    const records = [
      { bookId: 'b', book: { id: 'b', title: '新' }, savedAt: '2026-01-01T00:00:00.000Z' },
      { bookId: 'a', book: { id: 'a', title: '一致' }, savedAt: '2026-01-01T00:00:00.000Z' },
      { bookId: 'c', book: { id: 'c', title: '丢失' }, savedAt: '2026-01-03T00:00:00.000Z' },
    ]
    const result = findRecoverableDrafts(library, records)
    expect(result.map((r) => r.bookId)).toEqual(['c', 'b'])
  })
})