const DB_NAME = 'novaepub-drafts'
const DB_VERSION = 1
const STORE = 'drafts'
const SAVE_DELAY = 800

// 浏览器 IndexedDB 不可用时（隐私模式/旧环境/单元测试）安全降级为 no-op。
const supportsIndexedDB = () => typeof indexedDB !== 'undefined' && indexedDB != null

let dbPromise = null
let dbOpenFailed = false

function openDraftDb() {
  if (!supportsIndexedDB() || dbOpenFailed) return Promise.resolve(null)
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
          db.createObjectStore(STORE, { keyPath: 'bookId' })
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

function readAllFromStore(db) {
  return new Promise((resolve) => {
    let tx
    try {
      tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

function putRecord(db, record) {
  return new Promise((resolve) => {
    let tx
    try {
      tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(record)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

function deleteRecord(db, bookId) {
  return new Promise((resolve) => {
    let tx
    try {
      tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(bookId)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/** 将一个书籍对象保存为本地草稿（IndexedDB），返回是否写入。 */
export async function saveDraft(book) {
  if (!book || !book.id || !supportsIndexedDB()) return false
  const db = await openDraftDb()
  if (!db) return false
  const snapshot = JSON.parse(JSON.stringify(book))
  return putRecord(db, {
    bookId: snapshot.id,
    book: snapshot,
    savedAt: new Date().toISOString(),
  })
}

/** 读取全部本地草稿记录，格式 [{ bookId, book, savedAt }]。 */
export async function loadDraftRecords() {
  if (!supportsIndexedDB()) return []
  const db = await openDraftDb()
  if (!db) return []
  const records = await readAllFromStore(db)
  return records.filter((r) => r && r.bookId && r.book).sort((a, b) =>
    String(b.savedAt || '').localeCompare(String(a.savedAt || '')),
  )
}

/** 删除指定书籍的本地草稿。 */
export async function removeDraft(bookId) {
  if (!bookId || !supportsIndexedDB()) return false
  const db = await openDraftDb()
  if (!db) return false
  return deleteRecord(db, bookId)
}

/** 清理所有本地草稿。 */
export async function clearDrafts() {
  if (!supportsIndexedDB()) return false
  const db = await openDraftDb()
  if (!db) return false
  const records = await readAllFromStore(db)
  await Promise.all(records.map((r) => deleteRecord(db, r.bookId)))
  return true
}

/** 比较书籍与草稿是否一致；一致视为已安全落库，不需要恢复提示。 */
export function isDraftDifferentFromLibrary(libraryBook, draftBook) {
  if (!libraryBook) return true
  if (!draftBook) return false
  // 草稿比本地库更旧时绝不能恢复：localStorage 每次编辑都会先写，
  // IndexedDB 是防抖兜底，可能落后于本地库。只有本地缺书或草稿更新时才提示。
  const draftUpdated = new Date(draftBook.updatedAt || 0).getTime()
  const libraryUpdated = new Date(libraryBook.updatedAt || 0).getTime()
  if (draftUpdated < libraryUpdated) return false
  try {
    return JSON.stringify(libraryBook) !== JSON.stringify(draftBook)
  } catch {
    return true
  }
}

/** 从草稿记录中筛选出值得提示恢复的项。 */
export function findRecoverableDrafts(library, draftRecords) {
  return (draftRecords || [])
    .filter((d) => isDraftDifferentFromLibrary(library ? library[d.bookId] : null, d.book))
    .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')))
}

// ---- 防抖写入 ----
const pendingSaves = new Map()

/**
 * 防抖保存草稿：多次编辑只写最后一次。
 * 传入的 book 会被立即序列化为快照，避免延时期间引用对象继续变化。
 */
export function scheduleDraftSave(book) {
  if (!book || !book.id || !supportsIndexedDB()) return false
  const snapshot = JSON.parse(JSON.stringify(book))
  const bookId = snapshot.id
  const existing = pendingSaves.get(bookId)
  if (existing && existing.timer) clearTimeout(existing.timer)
  const timer = setTimeout(() => {
    pendingSaves.delete(bookId)
    saveDraft(snapshot).catch((err) => console.warn('[draft] 草稿保存失败', err))
  }, SAVE_DELAY)
  pendingSaves.set(bookId, { timer, snapshot })
  return true
}

/** 立刻把所有待写入的草稿落库（用于 beforeunload/离开编辑页）。 */
export function flushDraftSaves() {
  const entries = Array.from(pendingSaves.values())
  pendingSaves.clear()
  entries.forEach(({ timer, snapshot }) => {
    clearTimeout(timer)
    saveDraft(snapshot).catch((err) => console.warn('[draft] 草稿保存失败', err))
  })
}

/** 取消某本书未落库的待写入草稿（删除书籍时使用，避免又被写回来）。 */
export function cancelDraftSave(bookId) {
  const existing = pendingSaves.get(bookId)
  if (!existing) return false
  clearTimeout(existing.timer)
  pendingSaves.delete(bookId)
  return true
}

export { supportsIndexedDB }