// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { sanitizeHtml, sanitizeChapterHtml, sanitizeImportedBook } from '../sanitizeHtml'

describe('sanitizeHtml', () => {
  it('剥离 script / style / iframe 标签', () => {
    const html = '<p>正文</p><script>alert(1)</script><style>body{}</style><iframe src="x"></iframe>'
    const out = sanitizeHtml(html)
    expect(out).toContain('<p>正文</p>')
    expect(out).not.toContain('script')
    expect(out).not.toContain('<style')
    expect(out).not.toContain('iframe')
  })

  it('剥离全部 on* 事件属性', () => {
    const out = sanitizeHtml('<p onclick="alert(1)" onmouseover="x()">hi</p>')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('onmouseover')
    expect(out).toContain('hi')
  })

  it('剥离 javascript: 协议链接', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">点我</a>')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('点我')
  })

  it('保留 book-image / book-resource / 相对路径 / data:image', () => {
    const html = [
      '<img src="book-image://abc">',
      '<a href="book-resource://xyz">x</a>',
      '<img src="images/a.png">',
      '<img src="data:image/png;base64,iVBORw0KGgo=">',
      '<a href="https://example.com">外链</a>',
    ].join('')
    const out = sanitizeHtml(html)
    expect(out).toContain('book-image://abc')
    expect(out).toContain('book-resource://xyz')
    expect(out).toContain('images/a.png')
    expect(out).toContain('data:image/png')
    expect(out).toContain('https://example.com')
  })

  it('sanitizeChapterHtml 从 body 抽取消毒结果', () => {
    const doc = `<?xml version="1.0"?><html><body><p>ok</p><script>bad()</script><img src="x" onerror="alert(1)"></body></html>`
    const out = sanitizeChapterHtml(doc)
    expect(out).toContain('ok')
    expect(out).not.toContain('script')
    expect(out).not.toContain('onerror')
  })

  it('sanitizeImportedBook 就地消毒章节与过滤含 script 的 styles', () => {
    const book = {
      id: 'b1',
      chapters: [
        { id: 'c1', content: '<p>好</p><script>x()</script>' },
        { id: 'c2', content: 'plain text' },
      ],
      styles: ['.a{color:red}', '<script>evil</script>', 'p{margin:0}'],
    }
    sanitizeImportedBook(book)
    expect(book.chapters[0].content).not.toContain('script')
    expect(book.chapters[0].content).toContain('好')
    expect(book.chapters[1].content).toBe('plain text')
    expect(book.styles).toEqual(['.a{color:red}', 'p{margin:0}'])
  })
})
