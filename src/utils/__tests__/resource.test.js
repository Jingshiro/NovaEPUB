import { describe, it, expect } from 'vitest'
import {
  resourceKindFromMime,
  extFromMime,
  createBookResource,
  resolveContentResources,
  resolveCssResources,
} from '../resource'

describe('资源工具', () => {
  it('根据 MIME 推断字体/媒体/其他分类', () => {
    expect(resourceKindFromMime('application/font-woff')).toBe('font')
    expect(resourceKindFromMime('font/woff2')).toBe('font')
    expect(resourceKindFromMime('video/mp4')).toBe('media')
    expect(resourceKindFromMime('text/css')).toBe('css')
    expect(resourceKindFromMime('application/pdf')).toBe('other')
  })

  it('从 MIME 推导扩展名', () => {
    expect(extFromMime('application/font-woff2')).toBe('woff2')
    expect(extFromMime('video/mp4')).toBe('mp4')
    expect(extFromMime('text/css')).toBe('css')
    expect(extFromMime('application/x-unknown', 'a.bin')).toBe('bin')
  })

  it('创建二进制资源记录', () => {
    const res = createBookResource('data:font/woff;base64,dGVzdA==', {
      type: 'application/font-woff',
      originalPath: 'OEBPS/fonts/a.woff',
    })
    expect(res.kind).toBe('font')
    expect(res.dataUrl).toContain('data:font/woff')
    expect(res.originalPath).toContain('a.woff')
  })

  it('把正文和 CSS 里的资源引用解析为 dataURL', () => {
    const book = {
      resources: [
        { id: 'r1', dataUrl: 'data:font/woff;base64,dGVzdA==' },
      ],
    }
    expect(resolveContentResources(book, '<video src="book-resource://r1"></video>'))
      .toContain('src="data:font/woff;base64,dGVzdA=="')
    expect(resolveCssResources(book, '@font-face{src:url("book-resource://r1")}'))
      .toContain('url("data:font/woff;base64,dGVzdA==")')
  })
})