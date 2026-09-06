// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { applyTemplateToEditor, getSelectedHtml, splitTemplate, injectTemplateCss } from '../template'

function makeEditor(content = '<p>hello world</p>') {
  return new Editor({
    content,
    extensions: [StarterKit],
  })
}

let editor

afterEach(() => {
  editor?.destroy()
  editor = null
})

describe('applyTemplateToEditor', () => {
  it('把选中文本包裹进模板的 $1 位置', () => {
    editor = makeEditor()
    // 选中 "hello world"（段落文本从位置 1 到 12）
    editor.commands.setTextSelection({ from: 1, to: 12 })
    applyTemplateToEditor(editor, {
      id: 'q1',
      name: '引用',
      target: 'quote',
      html: '<blockquote style="border-left:3px solid #D4A373;">$1</blockquote>',
    })
    const html = editor.getHTML()
    expect(html).toContain('<blockquote')
    expect(html).toContain('hello world')
    // 无残留的空段落包裹在模板外
    expect(html.startsWith('<p></p>')).toBe(false)
    // 选中内容应位于 blockquote 内部
    expect(html.indexOf('<p>hello world</p>')).toBeGreaterThan(html.indexOf('<blockquote'))
    // 不应在 blockquote 外残留空段落
    expect(html).not.toContain('</blockquote><p></p>')
  })

  it('getSelectedHtml 返回选区序列化内容', () => {
    editor = makeEditor()
    editor.commands.setTextSelection({ from: 1, to: 6 })
    expect(getSelectedHtml(editor)).toBe('hello')
  })

  it('splitTemplate 支持 <style> + 类名并注入 head', () => {
    const { html, css } = splitTemplate('<style>.x{color:red}</style><blockquote class="x">$1</blockquote>')
    expect(html).toContain('class="x"')
    expect(css).toEqual(['.x{color:red}'])
    injectTemplateCss('tpl-x', css.join('\n'))
    const style = document.getElementById('tpl-style-tpl-x')
    expect(style).toBeTruthy()
    expect(style.textContent).toContain('.x{color:red}')
  })
})
