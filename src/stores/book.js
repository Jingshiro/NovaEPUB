import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { uuid } from '../utils/id'
import { loadLibrary, saveLibrary } from '../utils/storage'
import { upgradeBook } from '../utils/migrate'
import { scheduleDraftSave, flushDraftSaves, removeDraft, cancelDraftSave } from '../utils/draft'
import { replaceAllInBook } from '../utils/search'
import { mergeHtmlFragments } from '../utils/chapterOps'
import { useTemplateStore } from './templates'
import { hydrateBookAssets, flushBookAssets, leanBookClone, deleteBookAssets, purgeEntryBlobUrls } from '../utils/assetStore'
import { useUiStore } from './ui'

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
    description: '',
    publisher: '',
    subject: '',
    rights: '',
    cover: null,
    createdAt: now,
    updatedAt: now,
    chapters: [first],
    // 书内图片图库：正文中通过 book-image://{id} 引用
    images: [],
    // 书内资源库：字体/音频/视频/其他附件，正文或样式中通过 book-resource://{id} 引用
    resources: [],
    // 书内已套用模板的样式快照：删除模板后正文样式仍可导出/预览
    styles: [],
    ...overrides,
  }
}

/**
 * 统计章节正文字数。
 * 中日韩等表意文字按「字」计；拉丁字母/数字连续串按「词」计（空格/标点分隔）；
 * 其余可见字符（标点、空白折叠后）不计入。
 */
export function countWords(html = '') {
  const text = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .trim()
  if (!text) return 0
  // 连续拉丁词/数字
  const latinWords = text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []
  // CJK：假名 / 统一表意扩展 / 基本区 / 兼容 / 谚文
  const cjkChars = text.match(/[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/g) || []
  return latinWords.length + cjkChars.length
}

export const useBookStore = defineStore('book', {
  state: () => ({
    library: reactive({}),
    activeBookId: null,
    persisted: false,
    /** 资产水合：IndexedDB 里的图片/字体 dataURL 是否已回填到内存 */
    assetsLoaded: false,
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
    /** 首次载入 localStorage，并自动修复旧版数据（SVG 封面/MIME）＋ 资产水合。 */
    ensureLoaded() {
      if (!this.persisted) {
        const loaded = loadLibrary()
        Object.assign(this.library, loaded)
        this.persisted = true
        this.migrateLibrary()
        this.startHydration()
      }
    },
    /**
     * 异步把 IndexedDB 里的二进制资产回填到内存（images/resources/cover）。
     * 启动即触发；读完 assetsLoaded = true（用作重渲染信号）。
     * store 级只跑一次；promise 复用给编辑器/预览/导出等待。
     */
    startHydration() {
      if (this._hydratePromise) return this._hydratePromise
      this._hydratePromise = (async () => {
        try {
          for (const book of Object.values(this.library)) {
            await hydrateBookAssets(book)
          }
        } catch (err) {
          console.warn('[book] 资产水合失败', err)
        } finally {
          this.assetsLoaded = true
        }
      })()
      return this._hydratePromise
    },
    /** 等资产水合完成（编辑器渲染/预览/导出前调用）。 */
    ensureHydrated() {
      this.ensureLoaded()
      return this._hydratePromise || Promise.resolve()
    },
    /** 针对某一本已导入的书做资产水合（草稿恢复 / 备份导入的 lean 书用）。 */
    async hydrateBook(id) {
      const book = this.library[id]
      if (!book) return
      await hydrateBookAssets(book)
    },
    /** 扫描并修复当前内存中已有的旧数据，修复后写回 localStorage。 */
    migrateLibrary() {
      let changed = false
      for (const book of Object.values(this.library)) {
        if (upgradeBook(book)) changed = true
      }
      if (changed) this.persist()
      return changed
    },
    /**
     * 落库：lean 克隆（已下沉到 IDB 的 dataURL 剥离）→ localStorage；
     * 同时调度一次资产 flush（新图片/字体写入 IDB，成功后再 re-persist 变瘦）。
     */
    persist() {
      const lean = {}
      for (const [id, book] of Object.entries(this.library)) {
        lean[id] = leanBookClone(book)
      }
      const ok = saveLibrary(lean)
      if (!ok && !this._storageErrorNotified) {
        this._storageErrorNotified = true
        try {
          useUiStore().setStorageError('本地存储空间不足或写入失败，书库修改可能不会被保存。请尽快「导出备份」，并删除不需要的书。')
        } catch (err) {
          console.warn('[book] 无法通知存储失败', err)
        }
      }
      // 同步写 localStorage 后，再防抖写一份到 IndexedDB，作为崩溃恢复兜底
      if (this.activeBook) scheduleDraftSave(leanBookClone(this.activeBook))
      this.scheduleAssetFlush()
    },
    /** 资产 flush：防抖合批；flush 成功后 re-persist（第 2 次克隆即变 lean）。 */
    scheduleAssetFlush() {
      clearTimeout(this._flushTimer)
      this._flushTimer = setTimeout(async () => {
        try {
          let moved = 0
          for (const book of Object.values(this.library)) {
            moved += await flushBookAssets(book)
          }
          if (moved > 0) this.persist()
        } catch (err) {
          console.warn('[book] 资产下沉 IndexedDB 失败，保持内联存储', err)
        }
      }, 300)
    },
    /** 立刻落库未决的草稿（用于离开编辑页/关闭页面前的兜底保存）。 */
    flushDrafts() {
      return flushDraftSaves()
    },
    /** 新建书籍并设为当前书。返回 id。 */
    createBook() {
      const book = createBook()
      this.library[book.id] = book
      this.activeBookId = book.id
      this.persist()
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
      this.activeBookId = book.id
      this.persist()
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
      // 同步清理该书的书内模板与 IndexedDB 草稿与未决写入，避免删除后又被“恢复”回来
      try {
        useTemplateStore().clearBookTemplates(id)
      } catch (err) {
        console.warn('[book] 清理书内模板失败', err)
      }
      cancelDraftSave(id)
      removeDraft(id).catch((err) => console.warn('[draft] 删除草稿失败', err))
      // 清掉资产层的二进制（图片/字体/封面）与预览用 blob URL 缓存
      deleteBookAssets(id).catch((err) => console.warn('[assets] 删除资产失败', err))
      purgeEntryBlobUrls(id)
    },
    /**
     * 批量更新多本书的元数据（书架批量操作用）。
     * patch 里值为 null 的字段表示「不修改」，跳过；非 null 才覆盖。
     * 返回实际修改的书 id 数组。
     */
    batchUpdateBooks(ids, patch = {}) {
      const fields = Object.keys(patch).filter((k) => patch[k] !== null && patch[k] !== undefined)
      if (!Array.isArray(ids) || ids.length === 0 || fields.length === 0) return []
      const now = new Date().toISOString()
      const changed = []
      for (const id of ids) {
        const book = this.library[id]
        if (!book) continue
        for (const key of fields) {
          if (key === 'id') continue
          book[key] = patch[key]
        }
        book.updatedAt = now
        changed.push(id)
      }
      if (changed.length) this.persist()
      return changed
    },
    /** 把模板样式快照存入当前书，保证删除模板后正文章节样式不丢失。 */
    addTemplateStyles(cssText) {
      const book = this.activeBook
      if (!book || !cssText) return
      if (!Array.isArray(book.styles)) book.styles = []
      const css = cssText.trim()
      if (css && !book.styles.includes(css)) {
        book.styles.push(css)
        this.persist()
      }
    },
    /** 向当前书图库追加一张图片。 */
    addImage(image) {
      const book = this.activeBook
      if (!book || !image) return null
      if (!Array.isArray(book.images)) book.images = []
      book.images.push(image)
      this.persist()
      return image.id
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
      const no = book.chapters.length + 1
      const chapter = createChapter(`第${no}章`)
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
    /** 把章节移动到指定下标（拖拽排序用）。 */
    reorderChapter(id, targetIndex) {
      const book = this.activeBook
      if (!book) return
      const idx = book.chapters.findIndex((c) => c.id === id)
      const len = book.chapters.length
      const target = Math.min(Math.max(0, targetIndex), len - 1)
      if (idx === -1 || target === idx) return
      const [chapter] = book.chapters.splice(idx, 1)
      book.chapters.splice(target, 0, chapter)
      this.persist()
    },
    /**
     * 批量删除章节。ids 全删后若书空了则补一个空章节。
     * 返回实际删除数量。
     */
    removeChapters(ids = []) {
      const book = this.activeBook
      if (!book || !Array.isArray(ids) || ids.length === 0) return 0
      const idSet = new Set(ids)
      const before = book.chapters.length
      book.chapters = book.chapters.filter((c) => !idSet.has(c.id))
      const removed = before - book.chapters.length
      if (book.chapters.length === 0) {
        book.chapters.push(createChapter())
      }
      if (removed > 0) this.persist()
      return removed
    },
    /**
     * 把一组章节整组移动到 targetIndex（原数组坐标），组内相对顺序不变。
     * 语义：插入到「target 及其后第一个非选中章」之前；落点在组内时夹到组外。
     */
    reorderChapters(ids = [], targetIndex = 0) {
      const book = this.activeBook
      if (!book || !Array.isArray(ids) || ids.length === 0) return false
      const chapters = book.chapters
      const idSet = new Set(ids)
      const moving = chapters.filter((c) => idSet.has(c.id))
      if (moving.length === 0) return false

      const rest = chapters.filter((c) => !idSet.has(c.id))
      const target = Math.min(Math.max(0, targetIndex), Math.max(0, chapters.length - 1))
      // target 及其后第一个「不动」的章 → 插在它前面；全是 moving 则插到末尾
      let insertAt = rest.length
      for (let i = target; i < chapters.length; i++) {
        if (!idSet.has(chapters[i].id)) {
          insertAt = rest.findIndex((c) => c.id === chapters[i].id)
          break
        }
      }

      const next = [
        ...rest.slice(0, insertAt),
        ...moving,
        ...rest.slice(insertAt),
      ]
      const same = next.length === chapters.length && next.every((c, i) => c.id === chapters[i].id)
      if (same) return false
      book.chapters = next
      this.persist()
      return true
    },
    /**
     * 在当前章节光标位置拆分章节：原章节保留为前半段，后半段生成新章节。
     * 返回新章节；无法拆时返回 null。
     */
    splitChapter(id, beforeContent, afterContent) {
      const book = this.activeBook
      if (!book) return null
      const idx = book.chapters.findIndex((c) => c.id === id)
      if (idx === -1) return null
      const chapter = book.chapters[idx]
      const now = new Date().toISOString()
      chapter.content = String(beforeContent ?? chapter.content ?? '')
      chapter.wordCount = countWords(chapter.content)
      chapter.updatedAt = now
      const newChapter = createChapter(chapter.title ? `${chapter.title}（续）` : '续章', String(afterContent ?? ''))
      newChapter.wordCount = countWords(newChapter.content)
      book.chapters.splice(idx + 1, 0, newChapter)
      this.persist()
      return newChapter
    },
    /** 把当前章节与下一章合并，删除下一章；返回当前章节。 */
    mergeNextChapter(id) {
      const book = this.activeBook
      if (!book) return null
      const idx = book.chapters.findIndex((c) => c.id === id)
      if (idx === -1 || idx >= book.chapters.length - 1) return null
      const current = book.chapters[idx]
      const next = book.chapters[idx + 1]
      current.content = mergeHtmlFragments(current.content, next.content)
      current.wordCount = countWords(current.content)
      current.updatedAt = new Date().toISOString()
      book.chapters.splice(idx + 1, 1)
      this.persist()
      return current
    },
    /** 全书查找替换。返回 { count, modifiedChapterIds, modifiedTitles }。 */
    replaceAllInBook(findText, replaceText, options = {}) {
      const book = this.activeBook
      if (!book || !findText) return { count: 0, modifiedChapterIds: [], modifiedTitles: 0 }
      const result = replaceAllInBook(book, findText, replaceText, options)
      if (result.count > 0) {
        book.chapters.forEach((ch) => {
          ch.wordCount = countWords(ch.content)
        })
        book.updatedAt = new Date().toISOString()
        this.persist()
      }
      return result
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
