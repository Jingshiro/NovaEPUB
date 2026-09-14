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
  findBareNumberHeadings,
  decodeTextBytes,
  parseTextImportFile,
} from '../textImport'

/** UTF-8 编码（TextEncoder 是通用的，不依赖 Node Buffer 的编码表）。 */
const utf8 = (text) => new TextEncoder().encode(text)

/**
 * 真实 GBK 字节样本，取自《占山为王》[出書版+番外].txt 的文件头。
 * 这份文件没有 BOM、不是合法 UTF-8、用 GBK 解出来是正常中文——正是用户
 * 反馈「导入后乱码」的那类文件。
 */
const GBK_HEAD_BYTES = new Uint8Array([
  0xb1, 0xbe, 0xcd, 0xbc, 0xca, 0xe9, 0xd3, 0xc9, 0x77, 0x77, 0x77, 0x2e,
  0x63, 0x6e, 0x63, 0x6e, 0x7a, 0x2e, 0x63, 0x6e, 0xa3, 0xa8, 0xc4, 0xe3,
  0xb5, 0xc4, 0xc2, 0xdb, 0xcc, 0xb3, 0x49, 0x44, 0xa3, 0xa9, 0xce, 0xaa,
  0xc4, 0xfa, 0xd5, 0xfb, 0xc0, 0xed, 0xd6, 0xc6, 0xd7, 0xf7,
])
const GBK_HEAD_TEXT = '本图书由www.cncnz.cn（你的论坛ID）为您整理制作'

describe('TXT 编码探测（2026-09-14 回归：GBK 文件导入乱码）', () => {
  const SAMPLE = '第一章 山间来客\n这是第一章的正文，包含中文标点：你好，世界！\n第二章 夜雨\n正文内容。\n'

  it('UTF-8 正常解码', () => {
    expect(decodeTextBytes(utf8(SAMPLE))).toBe(SAMPLE)
  })

  it('UTF-8 带 BOM 解码后不残留 BOM 字符', () => {
    expect(decodeTextBytes(utf8(`\uFEFF${SAMPLE}`))).toBe(SAMPLE)
  })

  it('GB18030 的合法 UTF-8 不会被误判成 GBK', () => {
    const text = '第一章 你好世界，段落结束。'
    expect(decodeTextBytes(utf8(text))).toBe(text)
  })

  it('真实 GBK 文件字节解码出正确中文，而不是满屏 U+FFFD（核心回归）', () => {
    const decoded = decodeTextBytes(GBK_HEAD_BYTES)
    expect(decoded).toBe(GBK_HEAD_TEXT)
    expect(decoded).not.toContain('\uFFFD')
  })

  it('同一段文本按 UTF-8 硬解会乱码（证明探测确有必要）', () => {
    // 这正是修复前 file.text() 的行为：非法字节被静默替换成 U+FFFD
    const wrong = new TextDecoder('utf-8').decode(GBK_HEAD_BYTES)
    expect(wrong).toContain('\uFFFD')
    expect(wrong).not.toBe(GBK_HEAD_TEXT)
  })

  it('UTF-16LE 带 BOM 能正确解码', () => {
    const le = Buffer.from(SAMPLE, 'utf16le')
    const buf = Buffer.concat([Buffer.from([0xff, 0xfe]), le])
    expect(decodeTextBytes(new Uint8Array(buf))).toBe(SAMPLE)
  })

  it('UTF-16BE 带 BOM 能正确解码', () => {
    const le = Buffer.from(SAMPLE, 'utf16le')
    const be = Buffer.alloc(le.length)
    for (let i = 0; i < le.length; i += 2) {
      be[i] = le[i + 1]
      be[i + 1] = le[i]
    }
    const buf = Buffer.concat([Buffer.from([0xfe, 0xff]), be])
    expect(decodeTextBytes(new Uint8Array(buf))).toBe(SAMPLE)
  })

  it('空文件返回空字符串', () => {
    expect(decodeTextBytes(new Uint8Array([]))).toBe('')
  })

  it('parseTextImportFile 走 arrayBuffer 路径读取 GBK 文件：不乱码且切章正确', async () => {
    // GBK 的「第一章 山间来客」+ 正文，用真实字节拼出来
    const gbk = new Uint8Array([
      ...GBK_HEAD_BYTES,
      0x0d, 0x0a,
    ])
    const fakeFile = {
      name: '占山为王.txt',
      arrayBuffer: async () => gbk.buffer.slice(gbk.byteOffset, gbk.byteOffset + gbk.byteLength),
    }
    const book = await parseTextImportFile(fakeFile)
    expect(book.chapters[0].content).toContain(GBK_HEAD_TEXT)
    expect(book.chapters[0].content).not.toContain('\uFFFD')
  })

  it('parseTextImportFile 的 File 没有 arrayBuffer 时回退 FileReader（此处应明确报错而非静默乱码）', async () => {
    const fakeFile = { name: 'x.txt' }
    await expect(parseTextImportFile(fakeFile)).rejects.toBeTruthy()
  })
})

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

describe('纯数字行章节标记（《占山为王》格式）', () => {
  it('识别递增的纯数字行作为章节', () => {
    const lines = [
      '书名：占山为王',
      '作者有话要说：废话。',
      '　　1',
      '第一段正文。',
      '　　2',
      '第二段正文。',
      '　　3',
      '第三段正文。',
    ]
    const picked = findBareNumberHeadings(lines)
    expect([...picked].sort((a, b) => a - b)).toEqual([2, 4, 6])

    const chapters = splitTextChapters(lines.join('\n'))
    expect(chapters.map((c) => c.title)).toEqual(['前言', '1', '2', '3'])
    expect(chapters[1].content).toContain('第一段正文。')
  })

  it('全角数字与全角空格同样识别', () => {
    const lines = ['　１', '正文一', '　２', '正文二', '　３', '正文三']
    const chapters = splitTextChapters(lines.join('\n'))
    expect(chapters.map((c) => c.title)).toEqual(['１', '２', '３'])
  })

  it('正文里偶然独立成行的数字不会被当成章节（不能重蹈切太宽的覆辙）', () => {
    const lines = [
      '第一章 开端',
      '他数了数：',
      '2024',
      '那是很久以前的事了。',
      '　　7',
      '一个孤立的数字。',
    ]
    const chapters = splitTextChapters(lines.join('\n'))
    // 2024 太不像章节起点、7 只有一个 → 都不该切章
    expect(chapters.map((c) => c.title)).toEqual(['第一章 开端'])
    expect(chapters[0].content).toContain('那是很久以前的事了。')
    expect(chapters[0].content).toContain('一个孤立的数字。')
  })

  it('只有单个数字行时不切章', () => {
    const chapters = splitTextChapters('正文开始。\n\n5\n\n正文继续。')
    expect(chapters.map((c) => c.title)).toEqual(['前言'])
  })

  it('「第X章」与纯数字混用时不互相干扰', () => {
    const lines = ['第一章 开始', '正文一。', '　　1', '纯数字正文。', '　　2', '更多正文。', '　　3', '收尾。']
    const chapters = splitTextChapters(lines.join('\n'))
    // 「第一章 开始」是标题；随后 1、2、3 构成递增序列，各自成章
    expect(chapters.map((c) => c.title)).toEqual(['第一章 开始', '1', '2', '3'])
  })

  it('番外等文字标记仍按普通正文处理（当前不识别）', () => {
    const chapters = splitTextChapters('　　1\n正文一。\n　　2\n正文二。\n　　3\n正文三。\n番外\n番外正文。')
    expect(chapters.map((c) => c.title)).toEqual(['1', '2', '3'])
    expect(chapters[2].content).toContain('番外')
  })

  it('只有两行递增数字时也不切章（门槛为 3）', () => {
    const lines = ['第一章 正文', '正文。', '　　1', '正文一。', '　　2', '正文二。']
    const chapters = splitTextChapters(lines.join('\n'))
    expect(chapters.map((c) => c.title)).toEqual(['第一章 正文'])
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
