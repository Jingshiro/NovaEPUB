// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  putAssetDataUrl, getAssetDataUrl, deleteBookAssets,
  flushBookAssets, hydrateBookAssets, assetLayerSupported, leanBookClone,
  purgeEntryBlobUrls, getEntryBlobUrl,
} from '../assetStore'

describe('assetStore（node 无 IndexedDB 环境）', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('无 IndexedDB：put/get/delete/assetLayerSupported 全部安全降级', async () => {
    expect(assetLayerSupported()).toBe(false)
    expect(await putAssetDataUrl('b1', 'a1', 'data:image/png;base64,xx')).toBe(false)
    expect(await getAssetDataUrl('b1', 'a1')).toBeNull()
    await expect(deleteBookAssets('b1')).resolves.toBeUndefined()
  })

  it('无 IndexedDB：flush/hydrate no-op，资产保持内联（旧行为兜底）', async () => {
    const book = {
      id: 'b1',
      cover: 'data:image/png;base64,COVER',
      images: [{ id: 'i1', dataUrl: 'data:image/png;base64,I1' }],
      resources: [{ id: 'r1', dataUrl: 'data:font/ttf;base64,FONT' }],
    }
    expect(await flushBookAssets(book)).toBe(0)
    expect(book.images[0].dataUrl).toBe('data:image/png;base64,I1')
    expect(book.coverIdb).toBeUndefined()
    expect(await hydrateBookAssets({ id: 'b1', images: [{ id: 'i1', dataUrl: '' }] })).toBe(0)
  })

  it('leanBookClone：idb 标记条目剥离 dataUrl，未标记条目保留（兜底）', () => {
    const book = {
      id: 'b1',
      title: '测试',
      cover: 'data:image/png;base64,COVER',
      coverIdb: 1,
      images: [
        { id: 'i1', dataUrl: '', idb: 1, type: 'image/png', filename: 'a.png' },
        { id: 'i2', dataUrl: 'data:image/png;base64,SMALL', type: 'image/png', filename: 'b.png' },
      ],
      resources: [{ id: 'r1', dataUrl: '', idb: 1, type: 'font/ttf', filename: 'x.ttf' }],
      chapters: [{ id: 'c1', content: '<p>hi</p>' }],
    }
    const lean = leanBookClone(book)
    expect(lean.cover).toBe('')
    expect(lean.images[0].dataUrl).toBe('')
    // 未标记（IDB 不可用兜底内联）的条目 dataUrl 保留
    expect(lean.images[1].dataUrl).toBe('data:image/png;base64,SMALL')
    expect(lean.resources[0].dataUrl).toBe('')
    // 其他字段原样
    expect(lean.chapters[0].content).toBe('<p>hi</p>')
    expect(lean.images[0].type).toBe('image/png')
    expect(lean.images[0].filename).toBe('a.png')
  })

  it('leanBookClone：处理空对象', () => {
    expect(leanBookClone()).toEqual({})
  })

  it('purgeEntryBlobUrls：无缓存时安全 no-op，不抛错', () => {
    expect(() => purgeEntryBlobUrls('b1')).not.toThrow()
  })

  it('getEntryBlobUrl：无 dataUrl 且无 IndexedDB 时返回 null', async () => {
    const book = { id: 'b1' }
    const entry = { id: 'i1', dataUrl: '' }
    expect(await getEntryBlobUrl(book, entry)).toBeNull()
  })
})
