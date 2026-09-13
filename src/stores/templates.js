import { defineStore } from 'pinia'
import { uuid } from '../utils/id'
import { seedDefaultTemplates } from '../utils/template'

const TEMPLATES_KEY = 'novaepub:templates'
const TEMPLATES_VERSION_KEY = 'novaepub:templates-version'
const BOOK_TEMPLATES_KEY = 'novaepub:book-templates'
const SEED_VERSION = 2

function loadStored() {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY)
    if (raw === null) return null
    return JSON.parse(raw)
  } catch (err) {
    console.warn('[templates] 读取失败', err)
    return null
  }
}

function loadVersion() {
  try {
    return parseInt(localStorage.getItem(TEMPLATES_VERSION_KEY) || '0', 10) || 0
  } catch {
    return 0
  }
}

function loadBookTemplates() {
  try {
    const raw = localStorage.getItem(BOOK_TEMPLATES_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (err) {
    console.warn('[templates] 读取书内模板失败', err)
    return {}
  }
}

function persist(templates) {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
  } catch (err) {
    console.warn('[templates] 保存失败', err)
  }
}

function persistBookTemplates(bookTemplates) {
  try {
    localStorage.setItem(BOOK_TEMPLATES_KEY, JSON.stringify(bookTemplates))
  } catch (err) {
    console.warn('[templates] 保存书内模板失败', err)
  }
}

export const useTemplateStore = defineStore('templates', {
  state: () => ({
    templates: [],
    /** 书内模板：{ [bookId]: Template[] }。该书存在书内模板时优先于全局模板。 */
    bookTemplates: {},
    loaded: false,
  }),
  getters: {
    byTarget(state) {
      return (target) => state.templates.filter((t) => t.target === target)
    },
    /** 某本书的书内模板列表（可能为空数组）。 */
    bookList(state) {
      return (bookId) => state.bookTemplates[bookId] || []
    },
    /**
     * 实际生效的模板：本书有书内模板则整组生效（Sigil 式每本书独立 stylesheet），
     * 否则回退全局模板池。
     */
    effectiveTemplates(state) {
      return (bookId) => (state.bookTemplates[bookId]?.length ? state.bookTemplates[bookId] : state.templates)
    },
  },
  actions: {
    ensureLoaded() {
      if (this.loaded) return
      const stored = loadStored()
      const version = loadVersion()
      const defaults = seedDefaultTemplates()

      if (stored === null || stored.length === 0) {
        // 首次使用：写入默认模板
        this.templates = defaults
        persist(this.templates)
        localStorage.setItem(TEMPLATES_VERSION_KEY, String(SEED_VERSION))
      } else {
        this.templates = stored
        // 版本升级：追加缺失的内置模板，保留用户的自定义/编辑
        if (version < SEED_VERSION) {
          defaults.forEach((d) => {
            if (!this.templates.some((t) => t.id === d.id)) {
              this.templates.push(d)
            }
          })
          persist(this.templates)
          localStorage.setItem(TEMPLATES_VERSION_KEY, String(SEED_VERSION))
        }
      }
      this.bookTemplates = loadBookTemplates()
      this.loaded = true
    },
    save(templates = this.templates) {
      persist(templates)
    },
    saveBookTemplates() {
      persistBookTemplates(this.bookTemplates)
    },
    /**
     * 从备份导入模板池：按 id 合并，已存在的跳过（不覆盖本地改动）。
     * 返回新增条数。
     */
    importTemplates(list = []) {
      this.ensureLoaded()
      if (!Array.isArray(list) || !list.length) return 0
      const existing = new Set(this.templates.map((t) => t.id))
      let added = 0
      for (const tpl of list) {
        if (!tpl || !tpl.id || existing.has(tpl.id)) continue
        this.templates.push({ custom: true, ...tpl })
        existing.add(tpl.id)
        added += 1
      }
      if (added) this.save()
      return added
    },
    /**
     * 从备份导入书内模板库：按 bookId + 模板 id 合并，已存在的跳过。
     * 返回新增条数。
     */
    importBookTemplates(map = {}) {
      this.ensureLoaded()
      if (!map || typeof map !== 'object') return 0
      let added = 0
      for (const [bookId, list] of Object.entries(map)) {
        if (!bookId || !Array.isArray(list) || !list.length) continue
        const bucket = this.bookTemplates[bookId] || []
        const existing = new Set(bucket.map((t) => t.id))
        for (const tpl of list) {
          if (!tpl || !tpl.id || existing.has(tpl.id)) continue
          bucket.push({ custom: true, ...tpl })
          existing.add(tpl.id)
          added += 1
        }
        if (bucket.length) this.bookTemplates[bookId] = bucket
      }
      if (added) this.saveBookTemplates()
      return added
    },
    addTemplate(partial = {}) {
      this.ensureLoaded()
      const tpl = {
        id: partial.id || uuid(),
        name: partial.name || '未命名模板',
        target: partial.target || 'custom',
        html: partial.html || '<div style="">$1</div>',
        custom: true,
        updatedAt: new Date().toISOString(),
        ...partial,
      }
      this.templates.push(tpl)
      this.save()
      return tpl
    },
    updateTemplate(id, patch = {}) {
      const tpl = this.templates.find((t) => t.id === id)
      if (!tpl) return
      Object.assign(tpl, patch, { updatedAt: new Date().toISOString() })
      this.save()
    },
    deleteTemplate(id) {
      this.templates = this.templates.filter((t) => t.id !== id)
      this.save()
    },

    // ---- B2：书内模板库 ----
    addBookTemplate(bookId, partial = {}) {
      this.ensureLoaded()
      if (!bookId || !this.bookTemplates[bookId]) this.bookTemplates[bookId] = []
      const tpl = {
        id: partial.id || uuid(),
        name: partial.name || '未命名模板',
        target: partial.target || 'custom',
        html: partial.html || '<div style="">$1</div>',
        custom: true,
        scope: 'book',
        updatedAt: new Date().toISOString(),
        ...partial,
      }
      this.bookTemplates[bookId].push(tpl)
      this.saveBookTemplates()
      return tpl
    },
    updateBookTemplate(bookId, id, patch = {}) {
      const list = this.bookTemplates[bookId] || []
      const tpl = list.find((t) => t.id === id)
      if (!tpl) return
      Object.assign(tpl, patch, { updatedAt: new Date().toISOString() })
      this.saveBookTemplates()
    },
    deleteBookTemplate(bookId, id) {
      const list = this.bookTemplates[bookId]
      if (!list) return
      this.bookTemplates[bookId] = list.filter((t) => t.id !== id)
      if (this.bookTemplates[bookId].length === 0) delete this.bookTemplates[bookId]
      this.saveBookTemplates()
    },
    /** 把全局模板池整批复制进某本书（新 id，同名模板不重复复制）。返回复制份数。 */
    copyGlobalToBook(bookId) {
      this.ensureLoaded()
      if (!bookId || !this.bookTemplates[bookId]) this.bookTemplates[bookId] = []
      const existingNames = new Set(this.bookTemplates[bookId].map((t) => t.name))
      let count = 0
      for (const tpl of this.templates) {
        if (existingNames.has(tpl.name)) continue
        this.bookTemplates[bookId].push({
          ...JSON.parse(JSON.stringify(tpl)),
          id: uuid(),
          scope: 'book',
          copiedFrom: tpl.id,
          updatedAt: new Date().toISOString(),
        })
        count += 1
      }
      if (count) this.saveBookTemplates()
      return count
    },
    /** 删除某本书的全部书内模板（回退到全局模板池）。 */
    clearBookTemplates(bookId) {
      if (this.bookTemplates[bookId]?.length) {
        delete this.bookTemplates[bookId]
        this.saveBookTemplates()
      }
    },
  },
})
