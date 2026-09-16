// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { embedHtmlBlocks, expandHtmlBlocks, hasHtmlBlocks, PLACEHOLDER_ATTR } from '../htmlBlock'
import { StyleAttributes } from '../tiptapStyleAttrs'
import { HtmlBlock } from '../tiptapHtmlBlock'
import { createPinia, setActivePinia } from 'pinia'

describe('embedHtmlBlocks（结构封装）', () => {
  it('原生标签不动，div 系未知结构整体封装为占位', () => {
    const html = [
      '<p>普通段落</p>',
      '<div class="chapter-header"><span class="chapter-num">第一章</span><h1 class="chapter-title">标题</h1></div>',
      '<h2>原生标题</h2>',
      '<div class="discord-message"><span class="discord-username">镜</span></div>',
    ].join('')
    const out = embedHtmlBlocks(html)
    expect(out).toContain('<p>普通段落</p>')
    expect(out).toContain('<h2>原生标题</h2>')
    expect(new RegExp(`<div ${PLACEHOLDER_ATTR}="`).test(out)).toBe(true)
    const count = (out.match(new RegExp(`${PLACEHOLDER_ATTR}="`, 'g')) || []).length
    expect(count).toBe(2) // 两个 div 块被封装
  })

  it('占位解码还原完整结构（含 class/子元素/内联样式）', () => {
    const block = '<div class="box" style="background:#313338;padding:12px;"><p class="inner">内容</p></div>'
    const embedded = embedHtmlBlocks(`<p>x</p>${block}<p>y</p>`)
    const expanded = expandHtmlBlocks(embedded)
    expect(expanded).toContain(block)
    // 幂等：expand 后文本里已无占位
    expect(hasHtmlBlocks(expanded)).toBe(false)
  })

  it('对原生 HTML（无未知结构）不改动', () => {
    const html = '<p>a</p><h1>b</h1><ul><li>c</li></ul>'
    expect(embedHtmlBlocks(html)).toBe(html)
  })
})

describe('HtmlBlock TipTap 节点（往返）', () => {
  let editor

  afterEach(() => {
    editor?.destroy()
    editor = null
    setActivePinia(createPinia())
  })

  function makeEditor(content = '') {
    setActivePinia(createPinia())
    return new Editor({
      content,
      extensions: [StarterKit, StyleAttributes, HtmlBlock],
    })
  }

  it('占位 div 进编辑器 → htmlBlock 节点 → getHTML 往返一致', () => {
    const block = '<div class="special-panel"><span class="tag">X</span></div>'
    const embedded = embedHtmlBlocks(`<p>前段</p>${block}`)
    editor = makeEditor(embedded)
    const html = editor.getHTML()
    expect(html).toContain(`<div ${PLACEHOLDER_ATTR}="`)
    // 解封后应能还原出原始结构
    expect(expandHtmlBlocks(html)).toContain(block)
    expect(html).toContain('前段')
  })

  it('渲染层把真实 HTML 放进 DOM（contenteditable=false）', () => {
    const block = '<div class="hacker-panel"><span class="panel-header">SYSTEM</span></div>'
    editor = makeEditor(`<p>普通</p>${embedHtmlBlocks(block)}`)
    const view = editor.view.dom.querySelectorAll('.nova-html-block-view')
    expect(view.length).toBe(1)
    expect(view[0].getAttribute('contenteditable')).toBe('false')
    expect(view[0].innerHTML).toContain('hacker-panel')
  })
})
