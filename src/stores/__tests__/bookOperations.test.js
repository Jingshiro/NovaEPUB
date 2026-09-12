// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBookStore } from '../book'

describe('书本章节操作（P1）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('拆分章节：前半保留原 id，后半生成新章节', () => {
    const store = useBookStore()
    store.createBook()
    const old = store.activeBook.chapters[0]
    const next = store.splitChapter(old.id, '<p>上半</p>', '<p>下半</p>')
    expect(store.activeBook.chapters).toHaveLength(2)
    expect(store.activeBook.chapters[0].id).toBe(old.id)
    expect(store.activeBook.chapters[0].content).toBe('<p>上半</p>')
    expect(store.activeBook.chapters[1].id).toBe(next.id)
    expect(store.activeBook.chapters[1].title).toBe('第一章（续）')
    expect(store.activeBook.chapters[1].content).toBe('<p>下半</p>')
  })

  it('合并下一章：内容合并并删除下一章', () => {
    const store = useBookStore()
    store.createBook()
    const first = store.activeBook.chapters[0]
    const second = store.addChapter()
    store.saveChapterContent(first.id, '<p>第一段</p>')
    store.saveChapterContent(second.id, '<p>第二段</p>')
    store.mergeNextChapter(first.id)
    expect(store.activeBook.chapters).toHaveLength(1)
    expect(store.activeBook.chapters[0].content).toContain('<p>第一段</p>')
    expect(store.activeBook.chapters[0].content).toContain('<p>第二段</p>')
  })

  it('最后一章不能向后合并', () => {
    const store = useBookStore()
    store.createBook()
    const first = store.activeBook.chapters[0]
    store.addChapter()
    const last = store.activeBook.chapters[1]
    expect(store.mergeNextChapter(last.id)).toBeNull()
    expect(store.activeBook.chapters).toHaveLength(2)
  })

  it('拖拽排序：移动到指定下标', () => {
    const store = useBookStore()
    store.createBook()
    const a = store.activeBook.chapters[0]
    const b = store.addChapter()
    const c = store.addChapter()
    store.reorderChapter(c.id, 0)
    expect(store.activeBook.chapters[0].id).toBe(c.id)
    expect(store.activeBook.chapters[1].id).toBe(a.id)
    expect(store.activeBook.chapters[2].id).toBe(b.id)
  })

  it('全局替换会更新字数和时间戳', () => {
    const store = useBookStore()
    store.createBook()
    const ch = store.activeBook.chapters[0]
    store.saveChapterContent(ch.id, '<p>小猫小猫</p>')
    const result = store.replaceAllInBook('小猫', '小狗')
    expect(result.count).toBe(2)
    expect(store.getChapter(ch.id).content).toContain('小狗小狗')
    expect(store.getChapter(ch.id).wordCount).toBe(4)
  })
})
