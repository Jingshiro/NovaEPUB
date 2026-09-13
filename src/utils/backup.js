/**
 * .novaepub 备份格式：整库（所有书）或单书的 JSON 快照，统一用 .novaepub 后缀。
 * 书对象与 localStorage 里存的完全一致（含 images/resources/styles/chapters），
 * 恢复时逐本走 bookStore.importBook（同 id 覆盖）。
 *
 * v2（2026-09-13）起额外携带模板池与书内模板库：
 * 模板原本只存在 localStorage，换浏览器/换 origin（localhost ↔ Pages）就会
 * 整批看不到；随备份走之后「导出 → 导入」即可把模板一起搬过去。
 * 解析旧版 v1 备份时模板字段缺省为空，向后兼容。
 */

import { buildFullBook } from './assetStore'

const BACKUP_FORMAT = 'novaepub-library-backup'
const BACKUP_VERSION = 2

/** 把当前书库序列化为备份载荷（extra 可带 templates / bookTemplates）。 */
export function serializeLibrary(library = {}, extra = {}) {
  const books = Object.values(library)
  const payload = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    bookCount: books.length,
    books,
  }
  const templates = Array.isArray(extra.templates) ? extra.templates : null
  const bookTemplates = extra.bookTemplates && typeof extra.bookTemplates === 'object' ? extra.bookTemplates : null
  if (templates && templates.length) payload.templates = templates
  if (bookTemplates && Object.keys(bookTemplates).length) payload.bookTemplates = bookTemplates
  return payload
}

/**
 * 备份/云同步导出专用：先从资产层把二进制回嵌成 dataURL，再序列化。
 * （store 内存里的 library 在水合后本身是完整的；未水合条目按 id 从 IDB 捞。）
 */
export async function buildFullLibrary(library = {}, extra = {}) {
  const books = []
  for (const book of Object.values(library)) {
    books.push(await buildFullBook(book))
  }
  return serializeLibrary(Object.fromEntries(books.map((b) => [b.id, b])), extra)
}

/** 备份/云同步导出专用：完整载荷文本（JSON 字符串）。 */
export async function buildFullBackupText(library = {}, pretty = false, extra = {}) {
  return JSON.stringify(await buildFullLibrary(library, extra), null, pretty ? 2 : 0)
}

function validatePayload(payload) {
  if (!payload || payload.format !== BACKUP_FORMAT || typeof payload.version !== 'number') {
    throw new Error('这不是 NovaEpub 的备份文件（缺少 format 标识）')
  }
  if (payload.version > BACKUP_VERSION) {
    throw new Error(`备份版本（v${payload.version}）高于当前应用支持的版本（v${BACKUP_VERSION}）`)
  }
  if (!Array.isArray(payload.books)) {
    throw new Error('备份文件缺少 books 数组')
  }
}

/** 解析备份文本，返回书数组；格式不对时抛错。（向后兼容的旧入口） */
export function parseBackup(text = '') {
  return parseBackupBundle(text).books
}

/**
 * 解析完整备份包：{ books, templates, bookTemplates }。
 * v1 备份没有模板字段，返回空数组/空对象，行为等同旧版。
 */
export function parseBackupBundle(text = '') {
  let payload
  try {
    payload = JSON.parse(text)
  } catch (err) {
    throw new Error('备份文件不是合法的 JSON')
  }
  validatePayload(payload)
  return {
    books: payload.books,
    templates: Array.isArray(payload.templates) ? payload.templates : [],
    bookTemplates: payload.bookTemplates && typeof payload.bookTemplates === 'object' ? payload.bookTemplates : {},
  }
}

/** 生成备份文件名（不带目录前缀），形如 20260912-120405.novaepub。 */
export function backupFileName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
  return `${stamp}.novaepub`
}

/** 生成单书工程文件名：书名（清理非法字符），形如 我的书.novaepub。 */
export function singleBookFileName(title = '') {
  return `${String(title || '未命名书籍')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || '未命名书籍'}.novaepub`
}

/** 把单本书序列化为 .novaepub 工程文件载荷（复用整库备份格式，bookCount=1）。 */
export function serializeBook(book = {}) {
  return serializeLibrary({ [book.id]: book })
}

/** 单书导出专用：带资产回嵌的完整载荷。 */
export async function buildFullBookBackupText(book = {}) {
  const payload = serializeLibrary({ [book.id]: await buildFullBook(book) })
  return JSON.stringify(payload, null, 2)
}
