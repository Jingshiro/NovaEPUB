import { describe, it, expect } from 'vitest'
import {
  parseMarkdown,
  parseTxt,
  splitTextChapters,
  splitMarkdownChapters,
  markdownToHtml,
  textToHtml,
  inlineToHtml,
} from '../textImport'

describe('TXT / Markdown 导入', () => {
  it('TXT 按“第X章”切分章节', () => {
    const chapters = splitTextChapters('第一章\n你好\n\n第二章\n世界')
    expect(chapters).toHaveLength(2)
    expect(chapters[0].title).toBe('第一章')
    expect(chapters[1].title).toBe('第二章')
    expect(chapters[1].content).toContain('世界')
  })

  it('无章节标记的 TXT 生成可阅读的段落 HTML', () => {
    const book = parseTxt('第一段\n\n第二段', { title: '随笔' })
    expect(book.title).toBe('随笔')
    expect(book.chapters.length).toBeGreaterThan(0)
    expect(book.chapters[0].content).toContain('<p>第一段</p>')
    expect(book.chapters[0].content).toContain('<p>第二段</p>')
  })

  it('Markdown 一级标题切分成章节', () => {
    const chapters = splitMarkdownChapters('# 第一章\n正文一\n\n# 第二章\n正文二')
    expect(chapters.map((c) => c.title)).toEqual(['第一章', '第二章'])
    expect(chapters[0].content).toContain('正文一')
    expect(chapters[1].content).toContain('正文二')
  })

  it('Markdown 转换支持常用语法', () => {
    const html = markdownToHtml('# 标题\n\n**加粗** 和 *斜体* 和 `代码`\n\n- 列表项')
    expect(html).toContain('<h1>标题</h1>')
    expect(html).toContain('<strong>加粗</strong>')
    expect(html).toContain('<em>斜体</em>')
    expect(html).toContain('<code>代码</code>')
    expect(html).toContain('<ul><li>列表项</li></ul>')
  })

  it('行内转义避免注入 HTML', () => {
    expect(inlineToHtml('<script>alert(1)</script>')).not.toContain('<script>')
    expect(textToHtml('a < b')).toContain('a &lt; b')
  })

  it('parseMarkdown 返回可导入的书籍对象', () => {
    const book = parseMarkdown('# 第一章\n正文', { title: '测试书' })
    expect(book.title).toBe('测试书')
    expect(book.chapters[0].title).toBe('第一章')
    expect(book.chapters[0].wordCount).toBeGreaterThan(0)
  })
})
