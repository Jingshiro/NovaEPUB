/**
 * HTML 消毒：导入不可信 EPUB / 备份时剥离脚本与危险引用。
 * 覆盖本产品主攻击面：script/style/iframe 等可执行标签、on* 事件、危险 URL 协议。
 */

const DROP_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base',
  'form', 'input', 'button', 'textarea', 'select', 'option',
])

const URL_ATTRS = new Set([
  'href', 'src', 'action', 'formaction', 'xlink:href', 'data', 'poster', 'background',
])

const SAFE_PREFIXES = [
  'https:', 'http:', 'mailto:', 'tel:',
  'book-image://', 'book-resource://',
  'data:image/', 'data:font/', 'data:audio/', 'data:video/',
]

function isDangerousUrl(value) {
  const raw = String(value || '')
  const v = raw.trim().split(/\s+/).join('')
  if (!v) return false
  // 相对路径 / 纯片段视为安全
  if (v.startsWith('#')) return false
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return false
  const lower = v.toLowerCase()
  for (const p of SAFE_PREFIXES) {
    if (lower.startsWith(p.toLowerCase())) return false
  }
  return true
}

function sanitizeElement(el) {
  const tag = el.tagName ? el.tagName.toLowerCase() : ''
  if (tag && DROP_TAGS.has(tag)) {
    el.remove()
    return
  }

  const attrs = Array.from(el.attributes || [])
  for (const attr of attrs) {
    const name = attr.name.toLowerCase()
    const value = attr.value
    if (name.startsWith('on')) {
      el.removeAttribute(attr.name)
      continue
    }
    if (name === 'style') {
      if (/expression\s*\(|javascript:/i.test(value)) {
        el.removeAttribute(attr.name)
      }
      continue
    }
    if (URL_ATTRS.has(name) && isDangerousUrl(value)) {
      el.removeAttribute(attr.name)
      continue
    }
    if (name === 'srcdoc' || name === 'formaction') {
      el.removeAttribute(attr.name)
    }
  }

  for (const child of Array.from(el.children || [])) {
    sanitizeElement(child)
  }
}

/**
 * 消毒一段 HTML 片段，返回安全化后的字符串。
 * 依赖 DOMParser（浏览器 / jsdom）；无 DOM 时原样返回，由调用方兜底。
 */
export function sanitizeHtml(html = '') {
  if (!html || typeof html !== 'string') return ''
  if (typeof DOMParser === 'undefined') return html

  const doc = new DOMParser().parseFromString(
    '<div id="nb-sanitize-root">' + html + '</div>',
    'text/html',
  )
  const root = doc.getElementById('nb-sanitize-root')
  if (!root) return ''

  for (const child of Array.from(root.children || [])) {
    sanitizeElement(child)
  }
  return root.innerHTML
}

/**
 * 消毒整份章节 HTML（含 body）。用于 EPUB 导入入口。
 */
export function sanitizeChapterHtml(html = '') {
  if (!html || typeof html !== 'string') return ''
  if (typeof DOMParser === 'undefined') return html

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const body = doc.body
  if (!body) return sanitizeHtml(html)

  for (const child of Array.from(body.children || [])) {
    sanitizeElement(child)
  }
  return body.innerHTML
}

/** 对备份导入的书籍对象就地消毒章节内容。返回同一对象。 */
export function sanitizeImportedBook(book) {
  if (!book || typeof book !== 'object') return book
  if (Array.isArray(book.chapters)) {
    for (const ch of book.chapters) {
      if (ch && typeof ch.content === 'string') {
        ch.content = sanitizeHtml(ch.content)
      }
    }
  }
  if (Array.isArray(book.styles)) {
    book.styles = book.styles.filter((s) => typeof s === 'string' && !/<\/?script/i.test(s))
  }
  return book
}
