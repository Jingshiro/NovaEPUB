/**
 * 资产数据层：图片 / 字体 / 媒体等二进制统一存 IndexedDB。
 *
 * 设计（2026-09-13 大书存储攻坚）：
 * - localStorage 只存「索引」：书的元数据、章节 HTML（引用 book-image://）、
 *   图库/资源库的 id/filename/type 等小字段。dataURL 一律剥离。
 * - IndexedDB（novaepub-assets）按 `${bookId}:${assetId}` 直接存 dataURL 字符串，
 *   零格式转换成本；配额远高于 localStorage（几百 MB 起）。
 * - 内存中的 store 对象保持「已水合」完整形态：启动后异步把 dataURL 回填到
 *   reactive 对象上，读路径（编辑器/预览/导出）逻辑无需感知。
 * - IndexedDB 不可用（旧浏览器/隐私模式/测试环境）时整体降级：
 *   资产继续内联在 localStorage（保持旧行为），所有函数安全 no-op。
 */

const DB_NAME = 'novaepub-assets'
const DB_VERSION = 1
const STORE = 'assets'

const assetsSupported = () => typeof indexedDB !== 'undefined' && indexedDB != null

let dbPromise = null
let dbOpenFailed = false

function openDb() {
  if (!assetsSupported() || dbOpenFailed) return Promise.resolve(null)
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      let request
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION)
      } catch (err) {
        dbOpenFailed = true
        resolve(null)
        return
      }
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        dbOpenFailed = true
        resolve(null)
      }
    })
    dbPromise.catch(() => {
      dbOpenFailed = true
      dbPromise = null
    })
  }
  return dbPromise
}

/** dataURL 保底判断：非空字符串才算有值。 */
function hasData(value) {
  return typeof value === 'string' && value.length > 0
}

/** 写入一条资产（dataURL 字符串原样存储）。失败返回 false。 */
export async function putAssetDataUrl(bookId, assetId, dataUrl = '') {
  if (!hasData(dataUrl)) return false
  const db = await openDb()
  if (!db) return false
  return new Promise((resolve) => {
    let tx
    try {
      tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ id: `${bookId}:${assetId}`, bookId, dataUrl })
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/** 读取一条资产的 dataURL；不存在返回 null。失败返回 null。 */
export async function getAssetDataUrl(bookId, assetId) {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    let tx
    try {
      tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(`${bookId}:${assetId}`)
      req.onsuccess = () => resolve(hasData(req.result?.dataUrl) ? req.result.dataUrl : null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** 删除一本书的全部资产记录。 */
export async function deleteBookAssets(bookId) {
  const db = await openDb()
  if (!db) return
  return new Promise((resolve) => {
    let tx
    try {
      tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const range = IDBKeyRange.bound(`${bookId}:`, `${bookId}:\uffff`)
      store.delete(range)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * 把书内的 dataURL 资产（images/resources/cover）全部写入 IndexedDB。
 * 成功写入的条目会打上 idb: 1 标记（persist 克隆时据此剥离 dataUrl）。
 * 任一条写入失败则不打标记，保持内联，走旧 localStorage 行为。
 * 返回 number：成功转移的资产条数。
 */
export async function flushBookAssets(book = {}) {
  if (!assetsSupported()) return 0
  const bookId = book?.id
  if (!bookId) return 0
  let moved = 0

  const handle = async (entry) => {
    if (!entry || !hasData(entry.dataUrl) || entry.idb === 1) return
    const ok = await putAssetDataUrl(bookId, entry.id, entry.dataUrl)
    if (ok) {
      entry.idb = 1
      entry.dataUrl = ''
      moved += 1
    }
  }

  for (const img of book.images || []) await handle(img)
  for (const res of book.resources || []) await handle(res)

  if (hasData(book.cover) && book.coverIdb !== 1) {
    const ok = await putAssetDataUrl(bookId, 'cover', book.cover)
    if (ok) {
      book.coverIdb = 1
      book.cover = ''
      moved += 1
    }
  }
  return moved
}

/**
 * 从 IndexedDB 把资产回填到书对象（内存 hydrate）。
 * - idb: 1 且 dataUrl 为空的条目按 id 拉回
 * - 未标记条目（纯内联/新写入）不动
 * 返回：本册回填的条数。
 */
export async function hydrateBookAssets(book = {}) {
  if (!assetsSupported()) return 0
  const bookId = book?.id
  if (!bookId) return 0
  let restored = 0

  const handle = async (entry) => {
    if (!entry || entry.idb !== 1 || hasData(entry.dataUrl)) return
    const dataUrl = await getAssetDataUrl(bookId, entry.id)
    if (hasData(dataUrl)) {
      entry.dataUrl = dataUrl
      restored += 1
    }
  }

  for (const img of book.images || []) await handle(img)
  for (const res of book.resources || []) await handle(res)

  if (book.coverIdb === 1 && !hasData(book.cover)) {
    const dataUrl = await getAssetDataUrl(bookId, 'cover')
    if (hasData(dataUrl)) {
      book.cover = dataUrl
      restored += 1
    }
  }
  return restored
}

/** 是否支持 IndexedDB 资产层。 */
export function assetLayerSupported() {
  return assetsSupported() && !dbOpenFailed
}

/**
 * 深拷贝并剥离 dataURL：仅剥离「已下沉到 IDB（idb===1）」的条目；
 * 未下沉条目的 dataUrl 原样拷贝（IDB 不可用时的 localStorage 兜底行为）。
 * 用于：persist 写 localStorage、历史快照、草稿快照。
 */
export function leanBookClone(book = {}) {
  const clone = JSON.parse(JSON.stringify(book || {}))
  for (const list of ['images', 'resources']) {
    for (const entry of clone[list] || []) {
      if (entry && entry.idb === 1) entry.dataUrl = ''
    }
  }
  if (clone.coverIdb === 1) clone.cover = ''
  return clone
}

/**
 * 备份/云同步用的完整载荷：把 IDB 里的资产重新嵌回 dataURL。
 * 内存里已水合的条目直接用；未水合的按 id 从 IDB 捞。
 */
export async function buildFullBook(book = {}) {
  const clone = JSON.parse(JSON.stringify(book || {}))
  const bookId = book?.id
  if (!bookId || !assetsSupported()) return clone

  const handle = async (entry) => {
    if (!entry || hasData(entry.dataUrl) || entry.idb !== 1) return
    const dataUrl = await getAssetDataUrl(bookId, entry.id)
    if (hasData(dataUrl)) entry.dataUrl = dataUrl
  }

  for (const img of clone.images || []) await handle(img)
  for (const res of clone.resources || []) await handle(res)
  if (clone.coverIdb === 1 && !hasData(clone.cover)) {
    const dataUrl = await getAssetDataUrl(bookId, 'cover')
    if (hasData(dataUrl)) clone.cover = dataUrl
  }
  return clone
}

// ---- Blob URL 视图层（预览用：同资产共享一条 blob: 链，不再把几十 MB 碾进 HTML） ----

/** dataURL → Blob（零依赖转换）。 */
export function dataUrlToBlob(dataUrl = '') {
  const match = String(dataUrl).match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/)
  if (!match) return null
  const mime = match[1] || 'application/octet-stream'
  if (!match[2]) return new Blob([decodeURIComponent(match[3])], { type: mime })
  const binary = atob(match[3])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

const blobUrlCache = new Map()

/**
 * 生成/复用资产的 blob: 链接。
 * 优先用传入的 dataUrl（水合后的内存数据），否则按 id 从资产层取。
 * 同一 asset id 在同一本书里共享同一条 URL，重复引用不再放大文档体积。
 */
export async function getEntryBlobUrl(book, entry, { dataUrl } = {}) {
  const bookId = book?.id
  if (!bookId) return null
  const id = entry?.id
  if (!id) return null
  const key = `${bookId}:${id}`
  if (blobUrlCache.has(key)) return blobUrlCache.get(key)

  const source = hasData(dataUrl) ? dataUrl : (hasData(entry?.dataUrl) ? entry.dataUrl : null)
  const resolved = hasData(source) ? source : ((assetsSupported() && !dbOpenFailed) ? await getAssetDataUrl(bookId, id) : null)
  if (!hasData(resolved)) return null
  const blob = dataUrlToBlob(resolved)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  blobUrlCache.set(key, url)
  return url
}

/** 删书时清掉对应 blob 缓存并 revoke，避免内存泄漏。 */
export function purgeEntryBlobUrls(bookId) {
  const prefix = `${bookId}:`
  for (const [key, url] of blobUrlCache.entries()) {
    if (key.startsWith(prefix)) {
      URL.revokeObjectURL(url)
      blobUrlCache.delete(key)
    }
  }
}
