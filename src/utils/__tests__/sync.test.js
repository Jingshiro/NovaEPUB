// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBookStore } from '../../stores/book'

// 同步工具测试（node 环境自带 fetch 会被每次 stub 替换）
import * as sync from '../../utils/sync'
import * as webdavUtils from '../../utils/webdav'
import { serializeLibrary, serializeBook, singleBookFileName, parseBackup, backupFileName } from '../../utils/backup'
import { loadSyncConfig, saveSyncConfig } from '../../utils/syncConfig'

function mockFetch(handler) {
  const mock = vi.fn(handler)
  return mock
}

describe('backup 序列化/解析', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  it('serialize → parse 往返保留所有书', () => {
    const store = useBookStore()
    const id = store.createBook()
    const lib = { [id]: JSON.parse(JSON.stringify(store.library[id])) }
    const text = JSON.stringify(serializeLibrary(lib))
    const books = parseBackup(text)
    expect(books).toHaveLength(1)
    expect(books[0].id).toBe(id)
    expect(books[0].title).toBe('未命名书籍')
  })

  it('拒绝非 NovaEpub 格式 / 坏 JSON', () => {
    expect(() => parseBackup('{"format":"other"}')).toThrow(/format 标识/)
    expect(() => parseBackup('not json')).toThrow(/JSON/)
  })

  it('备份文件名形如时间戳', () => {
    expect(backupFileName(new Date('2026-09-12T12:04:05Z'))).toBe('20260912-120405.novaepub.json')
  })

  it('单书导出：serializeBook 打包 1 本且可被 parseBackup 恢复', () => {
    const store = useBookStore()
    const id = store.createBook()
    store.updateBook({ title: '我的书', author: '镜' })
    const text = JSON.stringify(serializeBook(store.library[id]))
    const books = parseBackup(text)
    expect(books).toHaveLength(1)
    expect(books[0].id).toBe(id)
    expect(books[0].title).toBe('我的书')
  })

  it('单书文件名：书名 + 时间戳，并清理非法字符', () => {
    const name = singleBookFileName('我的 A/B:C*?"<>|书', new Date(2026, 8, 12, 12, 4, 5))
    expect(name).toMatch(/^我的 A-B-C------书-20260912-120405\.novaepub\.json$/)
  })
})

describe('syncConfig 存取', () => {
  it('默认配置是 WebDAV，服务器地址留空（不预设服务商）', () => {
    localStorage.clear()
    const cfg = loadSyncConfig()
    expect(cfg.provider).toBe('webdav')
    expect(cfg.webdav.serverUrl).toBe('')
  })

  it('save 后 load 读回相同内容', () => {
    const cfg = loadSyncConfig()
    cfg.webdav.username = 'a@b.c'
    saveSyncConfig(cfg)
    expect(loadSyncConfig().webdav.username).toBe('a@b.c')
  })
})

describe('WebDAV 客户端', () => {
  const cfg = { serverUrl: 'https://dav.example.com/dav/', username: 'u', password: 'p', folder: 'NovaEPUB' }

  beforeEach(() => {
    globalThis.btoa = globalThis.btoa || ((s) => Buffer.from(s, 'binary').toString('base64'))
  })

  it('Basic 认证头正确', () => {
    expect(webdavUtils.encodeBasicAuth('user', 'pass')).toBe('Basic dXNlcjpwYXNz')
  })

  it('normalizeServerUrl 去掉末尾斜杠', () => {
    expect(webdavUtils.normalizeServerUrl('https://a.com/')).toBe('https://a.com')
  })

  it('PROPFIND 成功时解析出备份文件名（剔目录）', async () => {
    const xml = `<?xml version="1.0"?>
<D:multistatus xmlns:D="DAV:">
  <D:response><D:href>/dav/NovaEPUB/20260912-120405.novaepub.json</D:href></D:response>
  <D:response><D:href>/dav/sub/other.novaepub.json</D:href></D:response>
</D:multistatus>`
    expect(webdavUtils.parseDavDirList(xml)).toEqual([
      '20260912-120405.novaepub.json',
      'other.novaepub.json',
    ])
  })

  it('PUT 会先 MKCOL 建目录并带上认证头', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(new Response('', { status: 201 })))
    await webdavUtils.davPutText(cfg, 'backups/a.novaepub.json', '{"x":1}', fetchMock)
    const methods = fetchMock.mock.calls.map(([, init]) => init.method)
    expect(methods).toContain('MKCOL')
    expect(methods[methods.length - 1]).toBe('PUT')
    const putHeaders = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1].headers
    expect(putHeaders.Authorization).toBe(webdavUtils.encodeBasicAuth('u', 'p'))
  })

  it('GET 404 返回 null 而不是抛错', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(new Response('', { status: 404 })))
    expect(await webdavUtils.davGetText(cfg, 'latest.novaepub.json', fetchMock)).toBeNull()
  })

  it('测试连接：401 给出友好报错', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(new Response('', { status: 401 })))
    await expect(webdavUtils.davTestConnection(cfg, fetchMock)).rejects.toThrow(/账号或密码/)
  })
})

describe('S3 SigV4', () => {
  it('sha256("") 是著名常量', async () => {
    const { sha256Hex } = await import('../../utils/s3')
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('HMAC 派生键符合独立计算（用 node:crypto 校验）', async () => {
    const { createHmac } = await import('node:crypto')
    const { signingKey } = await import('../../utils/s3')
    const secret = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
    const key = await signingKey(secret, '20260912', 'us-east-1')
    const kDate = createHmac('sha256', `AWS4${secret}`).update('20260912').digest()
    const kRegion = createHmac('sha256', kDate).update('us-east-1').digest()
    const kService = createHmac('sha256', kRegion).update('s3').digest()
    const expected = createHmac('sha256', kService).update('aws4_request').digest()
    expect(Buffer.from(new Uint8Array(key)).equals(expected)).toBe(true)
  })

  it('Authorization 头结构完整且确定性', async () => {
    const { signS3Request } = await import('../../utils/s3')
    const args = {
      method: 'PUT',
      endpoint: 'https://s3.us-east-1.amazonaws.com',
      bucket: 'bk',
      region: 'us-east-1',
      accessKeyId: 'AKIAEXAMPLE',
      secretAccessKey: 'SECRET',
      key: 'NovaEPUB/backups/a.json',
      body: '{"a":1}',
    }
    const a = await signS3Request(args, new Date('2026-09-12T12:00:00Z'))
    const b = await signS3Request(args, new Date('2026-09-12T12:00:00Z'))
    expect(a.url).toBe('https://s3.us-east-1.amazonaws.com/bk/NovaEPUB/backups/a.json')
    expect(a.headers['x-amz-date']).toBe('20260912T120000Z')
    expect(a).toEqual(b)
    expect(a.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\/20260912\/us-east-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/)
  })

  it('query 参数被排序编码', async () => {
    const { signS3Request } = await import('../../utils/s3')
    const signed = await signS3Request({
      method: 'GET', endpoint: 'https://s3.cn-north-1.amazonaws.com.cn', bucket: 'bk', region: 'cn-north-1',
      accessKeyId: 'K', secretAccessKey: 'S', key: '', query: { 'list-type': '2', prefix: 'NovaEPUB/', 'max-keys': '10' },
    }, new Date('2026-09-12T00:00:00Z'))
    const q = new URL(signed.url).search.slice(1)
    expect(q.startsWith('list-type=2&')).toBe(true)
    expect(q).toContain('max-keys=10&')
    expect(q).toContain('prefix=NovaEPUB%2F')
  })
})

describe('sync 门面（mock fetch）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  it('upload → list → download 全链路（webdav）', async () => {
    const store = useBookStore()
    store.createBook()
    const libSnapshot = JSON.parse(JSON.stringify(store.library))
    const payload = JSON.stringify(serializeLibrary(libSnapshot))
    // 内存盘
    const files = new Map()
    const fetchMock = mockFetch(async (url, init = {}) => {
      const path = decodeURIComponent(url.replace('https://dav.example.com', ''))
      if (init.method === 'PUT') {
        files.set(path, init.body || '')
        return new Response('', { status: 201 })
      }
      if (init.method === 'MKCOL') return new Response('', { status: 201 })
      if (init.method === 'GET') {
        if (!files.has(path)) return new Response('', { status: 404 })
        return new Response(files.get(path), { status: 200 })
      }
      if (init.method === 'PROPFIND') {
        const body = Array.from(files.keys())
          .filter((p) => p.includes('/NovaEPUB/') && !p.endsWith('/'))
          .map((p) => `<D:response><D:href>${p}</D:href></D:response>`).join('')
        return new Response(`<D:multistatus xmlns:D="DAV:">${body}</D:multistatus>`, { status: 207 })
      }
      if (init.method === 'DELETE') {
        files.delete(path)
        return new Response(null, { status: 204 })
      }
      return new Response('', { status: 400 })
    })

    const cfg = { serverUrl: 'https://dav.example.com/dav', username: 'u', password: 'p', folder: 'NovaEPUB' }
    const now = new Date('2026-09-12T12:04:05Z')
    const name = await sync.uploadBackup('webdav', cfg, payload, { now, fetchImpl: fetchMock })
    expect(name).toBe('20260912-120405.novaepub.json')

    const listed = await sync.listRemoteBackups('webdav', cfg, fetchMock)
    expect(listed.some((b) => b.name === 'latest.novaepub.json')).toBe(true)
    expect(listed.some((b) => b.name === '20260912-120405.novaepub.json')).toBe(true)
    expect(listed[0].name).toBe('latest.novaepub.json')

    const text = await sync.downloadBackup('webdav', cfg, '20260912-120405.novaepub.json', fetchMock)
    expect(parseBackup(text)).toHaveLength(1)
  })

  it('主动清理超过 10 份的旧快照', async () => {
    const files = new Map()
    // 预置 12 份旧快照
    for (let i = 1; i <= 12; i++) {
      const stamp = String(20260900 + i) + '-000000'
      files.set(`https://dav.example.com/dav/NovaEPUB/backups/${stamp}.novaepub.json`, '{}')
    }
    const fetchMock = mockFetch(async (url, init = {}) => {
      const path = decodeURIComponent(url)
      if (init.method === 'PUT') {
        files.set(path, init.body || '')
        return new Response('', { status: 201 })
      }
      if (init.method === 'MKCOL') return new Response('', { status: 201 })
      if (init.method === 'PROPFIND') {
        const body = Array.from(files.keys())
          .map((p) => `<D:response><D:href>${p}</D:href></D:response>`).join('')
        return new Response(`<D:multistatus xmlns:D="DAV:">${body}</D:multistatus>`, { status: 207 })
      }
      if (init.method === 'DELETE') {
        files.delete(path)
        return new Response(null, { status: 204 })
      }
      return new Response('', { status: 400 })
    })
    const cfg = { serverUrl: 'https://dav.example.com/dav', username: 'u', password: 'p', folder: 'NovaEPUB' }
    await sync.uploadBackup('webdav', cfg, '{}', { now: new Date('2026-09-12T13:00:00Z'), fetchImpl: fetchMock })
    const snaps = Array.from(files.keys()).filter((p) => p.includes('/backups/'))
    expect(snaps.length).toBe(sync.KEEP_BACKUPS) // 12 旧 + 1 新 = 13 → 清到 10
  })
})
