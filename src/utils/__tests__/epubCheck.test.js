import { describe, it, expect } from 'vitest'
import { createBook } from '../../stores/book'
import { checkEpubStructure } from '../epubCheck'

describe('EPUB 导出前自检', () => {
  it('默认书籍可通过自检（允许空章节等警告）', () => {
    const book = createBook({ title: '正常书', author: '作者' })
    const report = checkEpubStructure(book)
    expect(report.valid).toBe(true)
    expect(report.errors).toEqual([])
  })

  it('空章节列表是阻断性错误', () => {
    const book = createBook({ chapters: [] })
    const report = checkEpubStructure(book)
    expect(report.valid).toBe(false)
    expect(report.errors.some((e) => e.code === 'no-chapters')).toBe(true)
  })

  it('正文引用不存在的图片会阻断导出', () => {
    const book = createBook({
      title: '缺图',
      chapters: [{ id: 'c1', title: '一章', content: '<img src="book-image://missing">' }],
    })
    const report = checkEpubStructure(book)
    expect(report.valid).toBe(false)
    expect(report.errors.some((e) => e.code === 'missing-image-ref')).toBe(true)
  })

  it('CSS 引用不存在的资源会阻断导出', () => {
    const book = createBook({
      title: '缺字体',
      chapters: [{ id: 'c1', title: '一章', content: '<p>正文</p>' }],
      styles: ['@font-face{src:url("book-resource://missing-font")}'],
    })
    const report = checkEpubStructure(book)
    expect(report.valid).toBe(false)
    expect(report.errors.some((e) => e.code === 'missing-css-resource')).toBe(true)
  })

  it('模板样式引用不存在的资源也会被检查出来', () => {
    const book = createBook({ title: '有模板', chapters: [{ id: 'c1', title: '一章', content: '<p>正文</p>' }] })
    const templates = [
      { id: 'tpl', name: '带字体模板', html: '<style>@font-face{src:url("book-resource://bad")}</style><div>$1</div>' },
    ]
    const report = checkEpubStructure(book, { templates })
    expect(report.valid).toBe(false)
    expect(report.errors.some((e) => e.code === 'missing-css-resource')).toBe(true)
  })

  it('图片/资源文件名重复会阻断导出', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo='
    const book = createBook({
      title: '重复文件',
      chapters: [{ id: 'c1', title: '一章', content: '<p>正文</p>' }],
      images: [
        { id: 'i1', filename: 'a.png', type: 'image/png', dataUrl: png },
        { id: 'i2', filename: 'a.png', type: 'image/png', dataUrl: png },
      ],
    })
    const report = checkEpubStructure(book)
    expect(report.valid).toBe(false)
    expect(report.errors.some((e) => e.code === 'duplicate-image-filename')).toBe(true)
  })

  it('空章节/空标题等给出警告但不阻断', () => {
    const book = createBook({ title: '', author: '', chapters: [{ id: 'c1', title: '', content: '' }] })
    const report = checkEpubStructure(book)
    expect(report.valid).toBe(true)
    expect(report.warnings.length).toBeGreaterThan(0)
  })

  it('非法封面会阻断导出', () => {
    const book = createBook({ cover: 'not-a-data-url' })
    const report = checkEpubStructure(book)
    expect(report.valid).toBe(false)
    expect(report.errors.some((e) => e.code === 'invalid-cover')).toBe(true)
  })
})