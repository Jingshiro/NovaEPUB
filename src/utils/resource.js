import { uuid } from './id'

export const RESOURCE_PREFIX = 'book-resource://'

/** 根据 MIME/文件名推断资源大类，用于导出目录规划。 */
export function resourceKindFromMime(mime = '', filename = '') {
  const type = String(mime || '').toLowerCase()
  const name = String(filename || '').toLowerCase()
  if (type.startsWith('font/') || type.includes('font-woff') || type.includes('x-font') || type.includes('opentype') || /\.(woff2?|ttf|otf)$/i.test(name)) return 'font'
  if (type === 'text/css' || name.endsWith('.css')) return 'css'
  if (type.startsWith('audio/') || type.startsWith('video/')) return 'media'
  return 'other'
}

/** 由 MIME 猜测扩展名；无法识别时保留原文件名扩展名或使用 bin。 */
export function extFromMime(mime = '', originalFilename = '') {
  const type = String(mime || '').toLowerCase()
  const map = {
    'application/vnd.ms-opentype': 'otf',
    'application/x-font-ttf': 'ttf',
    'application/x-font-opentype': 'otf',
    'application/font-woff': 'woff',
    'application/font-woff2': 'woff2',
    'font/ttf': 'ttf',
    'font/otf': 'otf',
    'font/woff': 'woff',
    'font/woff2': 'woff2',
    'text/css': 'css',
    'image/svg+xml': 'svg',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'video/mp4': 'mp4',
    'application/pdf': 'pdf',
  }
  if (map[type]) return map[type]
  const originalExt = String(originalFilename || '').split('.').pop()
  return originalExt && originalExt.length <= 8 ? originalExt.toLowerCase() : 'bin'
}

/** 安全的文件名：去路径分隔符和非法字符，保留扩展名。 */
export function safeResourceFilename(filename = '') {
  const base = String(filename || '')
    .split(/[\\/]/)
    .pop()
    .replace(/[^\w.\-\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return base || `resource-${uuid().slice(0, 8)}`
}

/** 新建二进制资源记录（字体/音频/视频/其他）。 */
export function createBookResource(dataUrl = '', options = {}) {
  const id = options.id || uuid()
  const type = options.type || 'application/octet-stream'
  const originalPath = options.originalPath || ''
  const filename = options.filename || `${safeResourceFilename(originalPath) || 'resource'}-${id.slice(0, 8)}.${extFromMime(type, originalPath)}`
  return {
    id,
    filename,
    type,
    kind: options.kind || resourceKindFromMime(type, filename),
    dataUrl,
    originalPath,
    createdAt: new Date().toISOString(),
  }
}

/** 新建文本资源记录（目前主要为 CSS）。 */
export function createTextResource(text = '', options = {}) {
  const id = options.id || uuid()
  const type = options.type || 'text/css'
  const originalPath = options.originalPath || ''
  const filename = options.filename || `${safeResourceFilename(originalPath) || 'style'}-${id.slice(0, 8)}.css`
  return {
    id,
    filename,
    type,
    kind: 'css',
    text,
    originalPath,
    createdAt: new Date().toISOString(),
  }
}

/** 把章节/HTML 中的 book-resource://{id} 解析为可显示的 dataURL（找不到保持原样）。 */
export function resolveContentResources(book, html = '') {
  if (!book || !Array.isArray(book.resources)) return html
  const byId = new Map(book.resources.map((r) => [r.id, r]))
  return html.replace(/src="book-resource:\/\/([^"]+)"/gi, (match, id) => {
    const res = byId.get(id)
    return res?.dataUrl ? `src="${res.dataUrl}"` : match
  })
}

/** 把 CSS 中的 book-resource://{id} 解析为可内嵌预览的 dataURL（找不到保持原样）。 */
export function resolveCssResources(book, css = '') {
  if (!book || !Array.isArray(book.resources)) return css
  const byId = new Map(book.resources.map((r) => [r.id, r]))
  return css.replace(/url\(\s*["']?book-resource:\/\/([^"')]+)["']?\s*\)/gi, (match, id) => {
    const res = byId.get(id)
    return res?.dataUrl ? `url("${res.dataUrl}")` : match
  })
}

// ---- Blob URL 版（预览专用：字体/媒体不再内嵌 dataURL，避免 19MB head 卡死 iframe） ----

/** 按 id 取 blob URL（内存 dataUrl 优先，否则资产层按 id 取）。 */
async function blobUrlFor(book, entry) {
  const { getEntryBlobUrl } = await import('./assetStore')
  return getEntryBlobUrl(book, entry)
}

/** 章节正文里的 book-resource:// 引用 → blob: URL。 */
export async function resolveContentResourcesToBlobUrls(book, html = '') {
  if (!book || !Array.isArray(book.resources) || !html) return html
  const byId = new Map(book.resources.map((r) => [r.id, r]))
  const ids = []
  const re = /src="book-resource:\/\/([^"]+)"/gi
  let m
  while ((m = re.exec(html))) {
    if (!ids.includes(m[1])) ids.push(m[1])
  }
  const urlById = new Map()
  await Promise.all(ids.map(async (id) => {
    const entry = byId.get(id)
    const url = entry ? await blobUrlFor(book, entry) : null
    if (url) urlById.set(id, url)
  }))
  return html.replace(/src="book-resource:\/\/([^"]+)"/gi, (match, id) => {
    const url = urlById.get(id)
    return url ? `src="${url}"` : match
  })
}

/** CSS 里的 book-resource:// url() → blob: URL（@font-face 的大 ttf 不再内联）。 */
export async function resolveCssResourcesToBlobUrls(book, css = '') {
  if (!book || !Array.isArray(book.resources) || !css) return css
  const byId = new Map(book.resources.map((r) => [r.id, r]))
  const ids = []
  const re = /url\(\s*["']?book-resource:\/\/([^"')]+)["']?\s*\)/gi
  let m
  while ((m = re.exec(css))) {
    if (!ids.includes(m[1])) ids.push(m[1])
  }
  const urlById = new Map()
  await Promise.all(ids.map(async (id) => {
    const entry = byId.get(id)
    const url = entry ? await blobUrlFor(book, entry) : null
    if (url) urlById.set(id, url)
  }))
  return css.replace(/url\(\s*["']?book-resource:\/\/([^"')]+)["']?\s*\)/gi, (match, id) => {
    const url = urlById.get(id)
    return url ? `url("${url}")` : match
  })
}