import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTemplateStore } from '../templates'
import { seedDefaultTemplates } from '../../utils/template'

describe('template store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('首次加载会写入默认模板（含首字下沉）', () => {
    const store = useTemplateStore()
    store.ensureLoaded()
    const names = store.templates.map((t) => t.name)
    expect(names).toContain('章节标题')
    expect(names).toContain('正文')
    expect(names).toContain('首字下沉')
    expect(names).toContain('居中标题')
    expect(store.templates.length).toBeGreaterThanOrEqual(10)
  })

  it('可新增/更新/删除自定义模板', () => {
    const store = useTemplateStore()
    store.ensureLoaded()
    const tpl = store.addTemplate({ name: '我的模板', target: 'custom', html: '<div>$1</div>' })
    expect(store.templates.some((t) => t.id === tpl.id)).toBe(true)
    store.updateTemplate(tpl.id, { name: '改名后' })
    expect(store.templates.find((t) => t.id === tpl.id).name).toBe('改名后')
    store.deleteTemplate(tpl.id)
    expect(store.templates.some((t) => t.id === tpl.id)).toBe(false)
  })

  it('版本升级时追加缺失的内置模板', () => {
    // 模拟旧版本库：只有 7 个默认模板，版本为 1
    const old = seedDefaultTemplates().slice(0, 7)
    localStorage.setItem('novaepub:templates', JSON.stringify(old))
    localStorage.setItem('novaepub:templates-version', '1')
    const store = useTemplateStore()
    store.ensureLoaded()
    expect(store.templates.some((t) => t.name === '首字下沉')).toBe(true)
    expect(store.templates.some((t) => t.name === '注释小字')).toBe(true)
  })
})
