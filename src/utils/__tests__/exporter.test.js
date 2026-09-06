import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import {
  escapeXml,
  buildContainerXml,
  buildOpfXml,
  buildNcxXml,
  buildChapterXhtml,
  buildStylesCss,
  dataUrlToBytes,
  exportEpubFile,
} from '../epubExporter'
import { createBook, countWords } from '../../stores/book'

describe('XML 工具', () => {
  it('escapeXml 转义特殊字符', () => {
    expect(escapeXml('<a> & "b"')).toBe('&lt;a&gt; &amp; &quot;b&quot;')
    expect(escapeXml('')).toBe('')
  })

  it('buildContainerXml 生成合法 container', () => {
    const xml = buildContainerXml()
    expect(xml).toContain('urn:oasis:names:tc:opendocument:xmlns:container')
    expect(xml).toContain('OEBPS/content.opf')
  })
})

describe('OPF / NCX 生成', () => {
  const book = createBook({ title: '测试书', author: '作者', chapters: [{}] })
  book.chapters = [
    { id: 'a', title: '第一章', content: '<p>你好</p>' },
    { id: 'b', title: '第二章', content: '<p>世界</p>' },
  ]

  it('OPF 包含元数据与章节清单', () => {
    const xml = buildOpfXml(book)
    expect(xml).toContain('<dc:title>测试书</dc:title>')
    expect(xml).toContain('<dc:creator opf:role="aut">作者</dc:creator>')
    expect(xml).toContain('id="chapter-1"')
    expect(xml).toContain('href="chapter-2.xhtml"')
    expect(xml).toContain('<itemref idref="chapter-1"/>')
  })

  it('NCX 生成目录导航点', () => {
    const xml = buildNcxXml(book)
    expect(xml).toContain('<navPoint id="navPoint-1" playOrder="1">')
    expect(xml).toContain('<text>第一章</text>')
    expect(xml).toContain('src="chapter-2.xhtml"')
  })

  it('章节 XHTML 内嵌标题与内容', () => {
    const xml = buildChapterXhtml(book.chapters[0], book, 0)
    expect(xml).toContain('<h1 class="chapter-title">第一章</h1>')
    expect(xml).toContain('<p>你好</p>')
  })
})

describe('样式与内容', () => {
  it('默认阅读 CSS 包含章节标题样式', () => {
    const css = buildStylesCss()
    expect(css).toContain('.chapter-title')
    expect(css).toContain('font-family')
  })

  it('countWords 去除 HTML 标签统计字数', () => {
    expect(countWords('<p>你好 世界</p>')).toBe(5)
    expect(countWords('<h1>标题</h1><p>正文</p>')).toBe(5)
    expect(countWords('')).toBe(0)
  })

  it('dataUrlToBytes 解码 base64 dataURL', () => {
    const bytes = dataUrlToBytes('data:image/jpeg;base64,SGVsbG8=')
    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111])
  })

  it('导出生成合法的 EPUB zip 结构', async () => {
    const testBook = createBook({ title: '冒烟', author: '镜', chapters: [] })
    testBook.chapters = createBook({ title: '导' }).chapters.concat([
      { id: 'x', title: '第一章', content: '<p>你好</p>' },
    ])
    const blob = await exportEpubFile(testBook, { download: false })
    const buf = Buffer.from(await blob.arrayBuffer())
    const zip = await JSZip.loadAsync(buf)
    expect(Object.keys(zip.files)[0]).toBe('mimetype')
    expect(await zip.file('mimetype').async('string')).toBe('application/epub+zip')
    expect(await zip.file('OEBPS/content.opf').async('string')).toContain('<spine')
    expect(await zip.file('OEBPS/toc.ncx').async('string')).toContain('<navMap')
  })

  it('导出时打包图片并改写 src、编译模板样式', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const testBook = createBook({
      title: '图册',
      author: '镜',
      chapters: [{ id: 'x', title: '第一章', content: `<p>hi</p><img src="${png}">` }],
    })
    const templates = [
      { id: 't1', name: '引用', html: '<style>.q{border-left:2px solid #000}</style><blockquote class="q">$1</blockquote>' },
    ]
    const blob = await exportEpubFile(testBook, { download: false, templates })
    const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()))
    expect(zip.file('OEBPS/images/image-1.png')).toBeTruthy()
    const ch = await zip.file('OEBPS/chapter-1.xhtml').async('string')
    expect(ch).toContain('src="images/image-1.png"')
    expect(ch).not.toContain(png)
    const css = await zip.file('OEBPS/styles.css').async('string')
    expect(css).toContain('.q')
  })
})
