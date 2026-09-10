// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { upgradeBook, upgradeSvgImagesToImg, normalizeDataUrlMime } from '../migrate'

describe('旧数据自动修复', () => {
  it('normalizeDataUrlMime 把 octet-stream 纠正为图片 MIME', () => {
    expect(normalizeDataUrlMime('data:application/octet-stream;base64,/9j/AAA')).toBe('data:image/jpeg;base64,/9j/AAA')
    expect(normalizeDataUrlMime('data:application/octet-stream;base64,iVBORw==')).toBe('data:image/png;base64,iVBORw==')
    expect(normalizeDataUrlMime('data:image/jpeg;base64,/9j/AAA')).toBe('data:image/jpeg;base64,/9j/AAA')
  })

  it('把旧 SVG book-image 封面转为普通 <img>', () => {
    const html = '<div><svg><image xlink:href="book-image://img1"/></svg></div>'
    const out = upgradeSvgImagesToImg(html, new Map([['img1', { id: 'img1' }]]), '')
    expect(out).toContain('<img src="book-image://img1"')
    expect(out).not.toContain('<svg')
  })

  it('旧数据没有 book-image 时，用 book.cover 修复 SVG 封面', () => {
    const html = '<div><svg><image xlink:href="cover.jpeg"/></svg></div>'
    const out = upgradeSvgImagesToImg(html, new Map(), 'data:image/jpeg;base64,/9j/AAA')
    expect(out).toContain('src="data:image/jpeg;base64,/9j/AAA"')
    expect(out).not.toContain('<svg')
  })

  it('upgradeBook 恢复被误清空的封面页', () => {
    const book = {
      cover: 'data:image/jpeg;base64,/9j/AAA',
      chapters: [{ title: 'titlepage.xhtml', content: '<p></p>' }],
      images: [],
    }
    const changed = upgradeBook(book)
    expect(changed).toBe(true)
    expect(book.chapters[0].content).toContain('<img src="data:image/jpeg;base64,/9j/AAA"')
  })

  it('upgradeBook 同时修复封面 MIME 与章节 SVG', () => {
    const book = {
      cover: 'data:application/octet-stream;base64,/9j/AAA',
      chapters: [{ content: '<p>x</p><svg><image xlink:href="cover.jpeg"/></svg>' }],
      images: [],
    }
    const changed = upgradeBook(book)
    expect(changed).toBe(true)
    expect(book.cover).toBe('data:image/jpeg;base64,/9j/AAA')
    expect(book.chapters[0].content).not.toContain('<svg')
    expect(book.chapters[0].content).toContain('src="data:image/jpeg;base64,/9j/AAA"')
  })
})