import { defineStore } from 'pinia'
import { uuid } from '../utils/id'
import { seedDefaultTemplates } from '../utils/template'

const TEMPLATES_KEY = 'novaepub:templates'

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

function persist(templates) {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
  } catch (err) {
    console.warn('[templates] 保存失败', err)
  }
}

export const useTemplateStore = defineStore('templates', {
  state: () => ({
    templates: [],
    loaded: false,
  }),
  getters: {
    byTarget(state) {
      return (target) => state.templates.filter((t) => t.target === target)
    },
  },
  actions: {
    ensureLoaded() {
      if (this.loaded) return
      const stored = loadStored()
      if (stored === null) {
        // 首次使用：写入默认模板
        this.templates = seedDefaultTemplates()
        persist(this.templates)
      } else {
        this.templates = stored
      }
      this.loaded = true
    },
    save(templates = this.templates) {
      persist(templates)
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
  },
})
