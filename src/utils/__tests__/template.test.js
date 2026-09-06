import { describe, it, expect } from 'vitest'
import {
  splitTemplate,
  wrapWithTemplate,
  buildTemplateFromForm,
  parseHtmlToForm,
  defaultTag,
  seedDefaultTemplates,
  TARGET_TAGS,
} from '../template'

describe('模板工具', () => {
  it('splitTemplate 提取并移除 <style> 块', () => {
    const tpl = '<style>.q{border-left:2px solid red}</style><blockquote class="q">$1</blockquote>'
    const { html, css } = splitTemplate(tpl)
    expect(html).toBe('<blockquote class="q">$1</blockquote>')
    expect(css).toEqual(['.q{border-left:2px solid red}'])
  })

  it('wrapWithTemplate 用选中内容替换 $1', () => {
    expect(wrapWithTemplate('<h1>$1</h1>', '标题')).toBe('<h1>标题</h1>')
    expect(wrapWithTemplate('<p>$1$1</p>', 'X')).toBe('<p>XX</p>')
    expect(wrapWithTemplate('<p>$1</p>', '')).toBe('<p></p>')
  })

  it('buildTemplateFromForm 生成含 $1 的片段', () => {
    const html = buildTemplateFromForm({
      target: 'quote',
      fontSize: '1.2em',
      color: '#333',
      borderLeft: '3px solid #D4A373',
    })
    expect(html).toContain('<blockquote')
    expect(html).toContain('font-size:1.2em')
    expect(html).toContain('$1')
  })

  it('parseHtmlToForm 反解析简单模板', () => {
    const form = parseHtmlToForm('<blockquote style="border-left:3px solid #D4A373;color:#333">$1</blockquote>', 'quote')
    expect(form.tag).toBe('blockquote')
    expect(form.borderLeft).toBe('3px solid #D4A373')
    expect(form.color).toBe('#333')
  })

  it('defaultTag 按目标返回标签', () => {
    expect(defaultTag('heading')).toBe('h1')
    expect(defaultTag('image')).toBe('figure')
    expect(defaultTag('nope')).toBe('div')
    expect(TARGET_TAGS.quote).toBe('blockquote')
  })

  it('seedDefaultTemplates 生成默认模板', () => {
    const seeds = seedDefaultTemplates()
    expect(seeds.length).toBeGreaterThan(0)
    expect(seeds[0].id).toBeTruthy()
    expect(seeds.every((t) => t.html.includes('$1'))).toBe(true)
  })
})
