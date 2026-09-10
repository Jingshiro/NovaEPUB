import { describe, it, expect } from 'vitest'
import {
  createBookImage,
  mimeFromDataUrl,
  extFromMime,
  resolveContentImages,
  normalizeContentImages,
  compressImageDataUrl,
} from '../image'

const PNG_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('图片工具', () => {
  it('createBookImage 生成 id、文件名与类型', () => {
    const img = createBookImage(PNG_DATA)
    expect(img.id).toBeTruthy()
    expect(img.filename).toMatch(/^img-[a-f0-9-]+\.png$/)
    expect(img.type).toBe('image/png')
    expect(img.dataUrl).toBe(PNG_DATA)
  })

  it('mimeFromDataUrl / extFromMime 解析 MIME', () => {
    expect(mimeFromDataUrl('data:image/jpeg;base64,xxx')).toBe('image/jpeg')
    expect(extFromMime('image/jpeg')).toBe('jpg')
    expect(extFromMime('image/gif')).toBe('gif')
  })

  it('resolveContentImages 把书内引用还原为 dataURL', () => {
    const book = { images: [{ id: 'abc', dataUrl: PNG_DATA }] }
    const html = '<p><img src="book-image://abc"></p>'
    expect(resolveContentImages(book, html)).toBe(`<p><img src="${PNG_DATA}"></p>`)
  })

  it('resolveContentImages 兼容 SVG xlink:href 引用', () => {
    const book = { images: [{ id: 'abc', dataUrl: PNG_DATA }] }
    const html = '<svg><image xlink:href="book-image://abc"/></svg>'
    expect(resolveContentImages(book, html)).toBe(`<svg><image xlink:href="${PNG_DATA}"/></svg>`)
  })

  it('normalizeContentImages 把 dataURL 收编进图库并复用已有图片', () => {
    const book = { images: [] }
    const html = `<p><img src="${PNG_DATA}"><img src="${PNG_DATA}"></p>`
    const normalized = normalizeContentImages(book, html)
    expect(book.images).toHaveLength(1)
    expect(normalized).toContain(`src="book-image://${book.images[0].id}"`)
    expect((normalized.match(/book-image:\/\//g) || []).length).toBe(2)
  })

  it('compressImageDataUrl 在无 canvas 环境回退原图', async () => {
    const result = await compressImageDataUrl(PNG_DATA)
    expect(result).toBe(PNG_DATA)
  })
})
