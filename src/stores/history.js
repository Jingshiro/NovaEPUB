import { defineStore } from 'pinia'
import { useBookStore } from './book'
import { useEditorStore } from './editor'
import { resolveContentImages } from '../utils/image'
import { hydrateBookAssets, leanBookClone } from '../utils/assetStore'

const MAX_HISTORY = 50

/** 把快照写回当前 activeBook，保持响应式对象引用不变。 */
function applyBookSnapshot(bookStore, snapshot) {
  const active = bookStore.activeBook
  if (!active || !snapshot) return
  for (const key of Object.keys(active)) delete active[key]
  Object.assign(active, snapshot)
  bookStore.persist()
}

/** 撤销/重做后刷新编辑器，避免显示旧章节或旧内容。 */
function refreshEditor(bookStore) {
  const editorStore = useEditorStore()
  const book = bookStore.activeBook
  if (!book) return
  if (!book.chapters.some((c) => c.id === editorStore.activeChapterId)) {
    const first = book.chapters[0]
    if (first) editorStore.setActiveChapter(first.id)
  }
  const chapter = book.chapters.find((c) => c.id === editorStore.activeChapterId)
  const editor = editorStore.editor
  if (editor && chapter) {
    editor.commands.setContent(resolveContentImages(book, chapter.content || ''), false)
  }
}

export const useHistoryStore = defineStore('history', {
  state: () => ({
    undoStack: [],
    redoStack: [],
  }),
  getters: {
    canUndo: (state) => state.undoStack.length > 0,
    canRedo: (state) => state.redoStack.length > 0,
  },
  actions: {
    /**
     * 记录一次快照；用于章节/元数据等结构操作，正文编辑由 TipTap history 负责。
     * 快照必须 lean 克隆：二进制资产只保留 id 引用（数据在 IndexedDB 资产层），
     * 否则大书每一步结构操作都会深拷贝十几 MB 的 dataURL。
     */
    capture(label = '修改') {
      const bookStore = useBookStore()
      if (!bookStore.activeBook) return
      this.undoStack.push({
        label,
        book: leanBookClone(bookStore.activeBook),
      })
      if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift()
      this.redoStack = []
    },
    async undo() {
      const bookStore = useBookStore()
      if (!this.canUndo || !bookStore.activeBook) return false
      const current = leanBookClone(bookStore.activeBook)
      const previous = this.undoStack.pop()
      this.redoStack.push({ label: previous.label, book: current })
      applyBookSnapshot(bookStore, previous.book)
      await hydrateBookAssets(bookStore.activeBook)
      refreshEditor(bookStore)
      return true
    },
    async redo() {
      const bookStore = useBookStore()
      if (!this.canRedo || !bookStore.activeBook) return false
      const current = leanBookClone(bookStore.activeBook)
      const next = this.redoStack.pop()
      this.undoStack.push({ label: next.label, book: current })
      applyBookSnapshot(bookStore, next.book)
      await hydrateBookAssets(bookStore.activeBook)
      refreshEditor(bookStore)
      return true
    },
    reset() {
      this.undoStack = []
      this.redoStack = []
    },
  },
})
