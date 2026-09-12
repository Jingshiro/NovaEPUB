// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { StyleAttributes } from '../tiptapStyleAttrs'
import {
  applyTemplateToEditor,
  getSelectedHtml,
  getBlockHtml,
  collectWrapperAttrs,
  splitTemplate,
  injectTemplateCss,
} from '../template'

/** 与 EditorCanvas 真实扩展配置保持一致（StyleAttributes 决定 class/style 是否存活）。 */
function makeEditor(content = '<p>hello world</p>') {
  return new Editor({
    content,
    extensions: [StarterKit, Image.configure({ inline: false, allowBase64: true }), StyleAttributes],
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

  it('模板的内联 style 不被 schema 剥掉（2026-09-12 回归）', () => {
    editor = makeEditor()
    editor.commands.setTextSelection({ from: 1, to: 12 })
    applyTemplateToEditor(editor, {
      id: 'q2',
      name: '强调引用',
      target: 'quote',
      html: '<blockquote style="margin:1em 0;padding:0.6em 1em;border-left:4px solid #E9E8E4;background:#F7F6F3;color:#787774;">$1</blockquote>',
    })
    const html = editor.getHTML()
    expect(html).toContain('style=')
    expect(html).toContain('border-left:')
    expect(html).toContain('background:')
    expect(html).toContain('hello world')
  })

  it('模板的 class 不被 schema 剥掉（首字下沉钩子，2026-09-12 回归）', () => {
    editor = makeEditor()
    editor.commands.setTextSelection({ from: 1, to: 12 })
    applyTemplateToEditor(editor, {
      id: 'q3',
      name: '首字下沉',
      target: 'paragraph',
      html: '<style>.dropcap::first-letter{float:left;font-size:3.2em;}</style><p class="dropcap" style="line-height:1.8;margin:0 0 1em;">$1</p>',
    })
    const html = editor.getHTML()
    expect(html).toContain('class="dropcap"')
    expect(html).toContain('hello world')
  })

  it('空选区（光标停在段内）套块级模板：整块套用、文字不丢（2026-09-12 回归）', () => {
    editor = makeEditor()
    editor.commands.setTextSelection({ from: 3, to: 3 }) // 光标停放在段落中间
    applyTemplateToEditor(editor, {
      id: 'q4',
      name: '注释小字',
      target: 'paragraph',
      html: '<p style="font-size:0.85em;color:#787774;">$1</p>',
    })
    const html = editor.getHTML()
    expect(html).toContain('hello world')
    expect(html).toContain('style=')
    expect(html).toContain('font-size:')
    // 不应额外插入空的样式块
    expect(html).not.toContain('<p></p>')
  })

  it('图片模板：包裹层样式合并写到选中的图片节点（2026-09-12 回归）', () => {
    editor = makeEditor('<img src="https://example.com/a.png">')
    editor.commands.setNodeSelection(0)
    applyTemplateToEditor(editor, {
      id: 'img-round',
      name: '图片·圆角',
      target: 'image',
      html: '<figure style="margin:1em auto;text-align:center;max-width:100%;"><span style="display:inline-block;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.08);">$1</span></figure>',
    })
    const html = editor.getHTML()
    expect(html).toContain('border-radius:')
    expect(html).toContain('box-shadow')
    // display/text-align 对图片无意义，应被丢弃；figure 本身不是节点
    expect(html).not.toContain('display')
    expect(html).not.toContain('text-align')
    expect(html).not.toContain('<figure')
    expect(html).toContain('https://example.com/a.png')
  })

  it('套用含 <style> 的模板时通过 onStyleCss 回调持久化 CSS', () => {
    editor = makeEditor()
    editor.commands.setTextSelection({ from: 1, to: 12 })
    const cssCalls = []
    applyTemplateToEditor(
      editor,
      {
        id: 'tpl-x',
        name: '样式引用',
        target: 'quote',
        html: '<style>.tpl-x{color:red}</style><blockquote class="tpl-x">$1</blockquote>',
      },
      { onStyleCss: (css) => cssCalls.push(css) },
    )
    expect(cssCalls).toEqual(['.tpl-x{color:red}'])
    expect(editor.getHTML()).toContain('class="tpl-x"')
  })

  it('getSelectedHtml 返回选区序列化内容', () => {
    editor = makeEditor()
    editor.commands.setTextSelection({ from: 1, to: 6 })
    expect(getSelectedHtml(editor)).toBe('hello')
  })

  it('getBlockHtml 返回当前块内容', () => {
    editor = makeEditor()
    editor.commands.setTextSelection({ from: 3, to: 3 })
    expect(getBlockHtml(editor)).toBe('hello world')
  })

  it('collectWrapperAttrs 合并多层包裹样式并丢弃 display/text-align', () => {
    const attrs = collectWrapperAttrs(
      '<figure class="fig" style="margin:1em auto;text-align:center;"><span style="display:inline-block;border-radius:8px;">$1</span></figure>',
    )
    expect(attrs.class).toBe('fig')
    expect(attrs.style).toContain('margin:1em auto')
    expect(attrs.style).toContain('border-radius:8px')
    expect(attrs.style).not.toContain('text-align')
    expect(attrs.style).not.toContain('display')
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
