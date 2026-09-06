import { defineStore } from 'pinia'
import { computed, reactive } from 'vue'
import { uuid } from '../utils/id'
import { loadLibrary, saveLibrary } from '../utils/storage'

const DEFAULT_LANGUAGE = 'zh-CN'
const DEFAULT_PUBLISH_DATE = new Date().toISOString().slice(0, 10)

/** 新建一个空白章节。 */
export function createChapter(title = '空章节', content = '') {
  const now = new Date().toISOString()
  return {
    id: uuid(),
    title,
    content,
    wordCount: 0,
    createdAt: now,
    updatedAt: now,
  }
}

/** 新建一本电子书对象。 */
export function createBook(overrides = {}) {
  const now = new Date().toISOString()
  const first = createChapter('第一章', '')
  return {
    id: uuid(),
    title: '未命名书籍',
    author: '佚名',
    publishDate: DEFAULT_PUBLISH_DATE,
    language: DEFAULT_LANGUAGE,
    identifier: uuid(),
    cover: null,
    createdAt: now,
    updatedAt: now,
    chapters: [first],
    ...overrides,
  }
}

/** 统计章节正文字数（去除 HTML 标签后的可见字符）。 */
export function countWords(html = '') {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text ? text.length : 0
}

export const useBookStore = defineStore('book', {
  state: () => ({
    library: reactive({}),
    activeBookId: null,
    persisted: false,
  }),
  getters: {
    booksList(state) {
      return Object.values(state.library).sort((a, b) =>
        (b.updatedAt || '').localeCompare(a.updatedAt || ''),
      )
    },
    activeBook(state) {
      return state.library[state.activeBookId] || null
    },
  },
  actions: {
    /** 首次载入 localStorage。 */
    ensureLoaded() {
      if (!this.persisted) {
        const loaded = loadLibrary()
        Object.assign(this.library, loaded)
        this.persisted = true
      }
    },
    persist() {
      saveLibrary(this.library)
    },
    /** 新建书籍并设为当前书。返回 id。 */
    createBook() {
      const book = createBook()
      this.library[book.id] = book
      this.persist()
      this.activeBookId = book.id
      return book.id
    },
    /** 从本地库载入一本书。 */
    loadBook(id) {
      this.ensureLoaded()
      if (this.library[id]) {
        this.activeBookId = id
      }
      return this.library[id] || null
    },
    /** 完全替换一本书（用于导入。若 id 已存在则覆盖）。 */
    importBook(book) {
      this.ensureLoaded()
      this.library[book.id] = book
      this.persist()
      this.activeBookId = book.id
      return book.id
    },
    /** 更新当前书的可序列化字段，并自动更新时间戳。 */
    updateBook(patch = {}) {
      const book = this.activeBook
      if (!book) return
      Object.assign(book, patch)
      book.updatedAt = new Date().toISOString()
      this.persist()
    },
    /** 删除一本书并从本地库移除。 */
    deleteBook(id) {
      delete this.library[id]
      if (this.activeBookId === id) this.activeBookId = null
      this.persist()
    },
    // ---- 章节操作 ----
    getChapter(id) {
      const book = this.activeBook
      if (!book) return null
      return book.chapters.find((c) => c.id === id) || null
    },
    addChapter() {
      const book = this.activeBook
      if (!book) return null
      const chapter = createChapter()
      book.chapters.push(chapter)
      this.persist()
      return chapter
    },
    removeChapter(id) {
      const book = this.activeBook
      if (!book) return
      const idx = book.chapters.findIndex((c) => c.id === id)
      if (idx === -1) return
      book.chapters.splice(idx, 1)
      // 若删空则补一个空章节
      if (book.chapters.length === 0) {
        book.chapters.push(createChapter())
      }
      this.persist()
    },
    renameChapter(id, title) {
      const book = this.activeBook
      if (!book) return
      const chapter = book.chapters.find((c) => c.id === id)
      if (!chapter) return
      chapter.title = title
      chapter.updatedAt = new Date().toISOString()
      this.persist()
    },
    /** 用上下箭头交换章节顺序。 */
    moveChapter(id, direction) {
      const book = this.activeBook
      if (!book) return
      const idx = book.chapters.findIndex((c) => c.id === id)
      const target = idx + direction
      if (idx === -1 || target < 0 || target >= book.chapters.length) return
      const [chapter] = book.chapters.splice(idx, 1)
      book.chapters.splice(target, 0, chapter)
      this.persist()
    },
    /** 保存某章节内容，实时更新字数。 */
    saveChapterContent(id, content) {
      const book = this.activeBook
      if (!book) return
      const chapter = book.chapters.find((c) => c.id === id)
      if (!chapter) return
      chapter.content = content
      chapter.wordCount = countWords(content)
      chapter.updatedAt = new Date().toISOString()
      this.persist()
    },
  },
})
