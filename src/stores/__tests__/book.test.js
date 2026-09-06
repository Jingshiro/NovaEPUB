import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBookStore, createChapter, createBook, countWords } from '../book'

describe('book store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('createChapter 生成带 id 的空章节', () => {
    const ch = createChapter()
    expect(ch.id).toBeTruthy()
    expect(ch.title).toBe('空章节')
    expect(ch.content).toBe('')
  })

  it('createBook 生成默认书籍与一个章节', () => {
    const book = createBook()
    expect(book.title).toBe('未命名书籍')
    expect(book.chapters).toHaveLength(1)
    expect(book.identifier).toBeTruthy()
  })

  it('createBook 支持覆盖字段', () => {
    const book = createBook({ title: 'X', author: 'Y' })
    expect(book.title).toBe('X')
    expect(book.author).toBe('Y')
  })

  it('新建书籍并选为当前书', () => {
    const store = useBookStore()
    const id = store.createBook()
    expect(store.activeBookId).toBe(id)
    expect(store.activeBook.id).toBe(id)
  })

  it('章节增删改与排序', () => {
    const store = useBookStore()
    store.createBook()
    const ch1 = store.addChapter()
    const ch2 = store.addChapter()
    expect(store.activeBook.chapters).toHaveLength(3)

    store.renameChapter(ch1.id, '改名')
    expect(store.getChapter(ch1.id).title).toBe('改名')

    store.moveChapter(ch2.id, -1)
    expect(store.activeBook.chapters[1].id).toBe(ch2.id)

    store.removeChapter(ch2.id)
    expect(store.activeBook.chapters.find((c) => c.id === ch2.id)).toBeUndefined()
  })

  it('保存章节内容会更新字数', () => {
    const store = useBookStore()
    store.createBook()
    const ch = store.addChapter()
    store.saveChapterContent(ch.id, '<p>你好世界</p>')
    expect(store.getChapter(ch.id).wordCount).toBe(4)
  })

  it('countWords 处理空字符串', () => {
    expect(countWords('')).toBe(0)
  })
})
