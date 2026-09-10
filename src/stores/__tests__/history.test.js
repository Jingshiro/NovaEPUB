import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBookStore } from '../book'
import { useHistoryStore } from '../history'
import { useEditorStore } from '../editor'

describe('history store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('结构操作可撤销/重做', () => {
    const bookStore = useBookStore()
    const historyStore = useHistoryStore()
    useEditorStore()

    bookStore.createBook()
    expect(bookStore.activeBook.chapters).toHaveLength(1)

    historyStore.capture('新增章节')
    bookStore.addChapter()
    expect(bookStore.activeBook.chapters).toHaveLength(2)
    expect(historyStore.canUndo).toBe(true)

    historyStore.undo()
    expect(bookStore.activeBook.chapters).toHaveLength(1)
    expect(historyStore.canRedo).toBe(true)

    historyStore.redo()
    expect(bookStore.activeBook.chapters).toHaveLength(2)
  })

  it('元数据修改可撤销/重做', () => {
    const bookStore = useBookStore()
    const historyStore = useHistoryStore()

    bookStore.createBook()
    bookStore.updateBook({ title: '旧名' })

    historyStore.capture('改成新名')
    bookStore.updateBook({ title: '新名' })
    expect(bookStore.activeBook.title).toBe('新名')

    historyStore.undo()
    expect(bookStore.activeBook.title).toBe('旧名')

    historyStore.redo()
    expect(bookStore.activeBook.title).toBe('新名')
  })

  it('redo 栈在新操作后清空', () => {
    const bookStore = useBookStore()
    const historyStore = useHistoryStore()

    bookStore.createBook()
    historyStore.capture('第一步')
    bookStore.addChapter()
    historyStore.undo()
    expect(historyStore.canRedo).toBe(true)

    historyStore.capture('新分支')
    expect(historyStore.canRedo).toBe(false)
  })
})