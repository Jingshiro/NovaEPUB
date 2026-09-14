import { describe, it, expect } from 'vitest'
import {
  parseMarkdown,
  parseTxt,
  splitTextChapters,
  splitMarkdownChapters,
  markdownToHtml,
  textToHtml,
  inlineToHtml,
  isChapterTitle,
} from '../textImport'

describe('章节标题识别（isChapterTitle）', () => {
  it('识别常见的章节标题写法', () => {
    const headings = [
      '第一章',
      '第一章 开端',
      '第二章 夜雨',
      '第一章 山间来客',
      '第十二章：归来',
      '第 3 章  开端',
      '第3节 小标题',
      '第一百章',
      '第一部 少年时',
      '第2卷 风起',
      'Chapter 1',
      'Chapter 1 Introduction',
      'chapter 12',
      'CHAPTER 3 The End',
      '  第一章   ',
    ]
    for (const line of headings) {
      expect(isChapterTitle(line), line).toBe(true)
    }
  })

  it('不把以「第X章」开头的正文句子当成标题（回归：正文被切碎像乱码）', () => {
    const bodyLines = [
      '第二章的正文开始。ABC mixed english 12345 numbers.',
      '第二章的内容很精彩，值得一看，请继续阅读下面段落文字',
      '第三章节内容说明这里有很多字的正文继续写着',
      '第一章内容',
      '这就是第一章的内容',
      '第二章 这一章讲了很多东西，包括人物关系、历史背景以及各种细节描写。',
      '第一章：这是标题吗。',
      '他读到第二章 夜雨 的时候',
      'Chapter 1 was very interesting to read today',
      '普通的一句话',
    ]
    for (const line of bodyLines) {
      expect(isChapterTitle(line), line).toBe(false)
    }
  })
})

describe('TXT / Markdown 导入', () => {
  it('TXT 按“第X章”切分章节', () => {
    const chapters = splitTextChapters('第一章\n你好\n\n第二章\n世界')
    expect(chapters).toHaveLength(2)
    expect(chapters[0].title).toBe('第一章')
    expect(chapters[1].title).toBe('第二章')
    expect(chapters[1].content).toContain('世界')
  })

  it('正文里出现「第X章…」句子时不被误切成新章节（2026-09-14 回归）', () => {
    const txt = [
      '第一章 山间来客',
      '这是第一章的第一段正文。',
      '',
      '第二章的正文开始。ABC mixed english 12345 numbers.',
      '结束。',
      '第二章 夜雨',
      '第二章的正文。',
    ].join('\n')
    const chapters = splitTextChapters(txt)
    expect(chapters).toHaveLength(2)
    expect(chapters.map((c) => c.title)).toEqual(['第一章 山间来客', '第二章 夜雨'])
    // 关键：以「第二章」开头的那句正文必须留在第一章正文里，而不是变成标题
    expect(chapters[0].content).toContain('第二章的正文开始。ABC mixed english 12345 numbers.')
    expect(chapters[1].content).toContain('第二章的正文。')
  })

  it('导入后的章节标题是真正的标题，正文完整保留', () => {
    const txt = [
      '第一章 山间来客',
      '正文一。',
      '第二章的正文开始。这句是正文。',
      '第二章 夜雨',
      '正文二。',
    ].join('\n')
    const book = parseTxt(txt, { title: '样本' })
    expect(book.chapters.map((c) => c.title)).toEqual(['第一章 山间来客', '第二章 夜雨'])
    expect(book.chapters[0].content).toContain('第二章的正文开始。这句是正文。')
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
    // 回归：content 必须是字符串，否则会被 String(array) 逗号拼接导致全文乱码
    expect(typeof chapters[0].content).toBe('string')
    expect(chapters[0].content).toContain('正文一')
    expect(chapters[1].content).toContain('正文二')
  })

  it('parseMarkdown 不把多行内容逗号拼成一坨（2026-09-12 回归）', () => {
    const md = `# 第一章
第一段第一行
第一段第二行

第二段带 **加粗**

## 二级标题

- 列表项一
- 列表项二

\`\`\`js
const a = 1
\`\`\`

> 引用
`
    const book = parseMarkdown(md, { title: '修复测试' })
    expect(book.chapters).toHaveLength(1)
    const html = book.chapters[0].content
    expect(html).toContain('<p>第一段第一行 第一段第二行</p>')
    expect(html).toContain('<p>第二段带 <strong>加粗</strong></p>')
    expect(html).toContain('<h2>二级标题</h2>')
    expect(html).toContain('<ul><li>列表项一</li><li>列表项二</li></ul>')
    expect(html).toContain('<pre><code>const a = 1</code></pre>')
    expect(html).toContain('<blockquote><p>引用</p></blockquote>')
    expect(html).not.toContain(',')
    // 段落/块之间应换行分隔，而不是全部挤进一个 <p>
    expect(html).toContain('\n')
  })

  it('Markdown 无一级标题时整篇仍按段落输出', () => {
    const book = parseMarkdown('第一段\n\n第二段', { title: '无标题' })
    expect(book.chapters).toHaveLength(1)
    expect(book.chapters[0].content).toContain('<p>第一段</p>')
    expect(book.chapters[0].content).toContain('<p>第二段</p>')
    expect(book.chapters[0].content).not.toContain(',')
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
