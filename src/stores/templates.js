import { defineStore } from 'pinia'
import { uuid } from '../utils/id'
import { seedDefaultTemplates } from '../utils/template'

const TEMPLATES_KEY = 'novaepub:templates'
const TEMPLATES_VERSION_KEY = 'novaepub:templates-version'
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
