/**
 * .novaepub 备份格式：整库（所有书）或单书的 JSON 快照，统一用 .novaepub 后缀。
 * 书对象与 localStorage 里存的完全一致（含 images/resources/styles/chapters），
 * 恢复时逐本走 bookStore.importBook（同 id 覆盖）。
 */

const BACKUP_FORMAT = 'novaepub-library-backup'
const BACKUP_VERSION = 1

/** 把当前书库序列化为备份载荷。 */
export function serializeLibrary(library = {}) {
  const books = Object.values(library)
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    bookCount: books.length,
    books,
  }
}

/** 解析备份文本，返回书数组；格式不对时抛错。 */
export function parseBackup(text = '') {
  let payload
  try {
    payload = JSON.parse(text)
  } catch (err) {
    throw new Error('备份文件不是合法的 JSON')
  }
  if (!payload || payload.format !== BACKUP_FORMAT || typeof payload.version !== 'number') {
    throw new Error('这不是 NovaEpub 的备份文件（缺少 format 标识）')
  }
  if (payload.version > BACKUP_VERSION) {
    throw new Error(`备份版本（v${payload.version}）高于当前应用支持的版本（v${BACKUP_VERSION}）`)
  }
  if (!Array.isArray(payload.books)) {
    throw new Error('备份文件缺少 books 数组')
  }
  return payload.books
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
