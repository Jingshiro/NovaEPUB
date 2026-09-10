/** 旧书数据自动修复：让已经存在 localStorage 里的书也享受新的解析修复。 */

/** 把 application/octet-stream 的图片 dataURL 按文件头纠正为具体图片 MIME。 */
export function normalizeDataUrlMime(dataUrl = '') {
  if (!dataUrl.startsWith('data:application/octet-stream;base64,')) return dataUrl
  const base64 = dataUrl.split(',')[1] || ''
  let type = 'image/jpeg'
  if (/^iVBOR/i.test(base64)) type = 'image/png'
  else if (/^R0lGOD/i.test(base64)) type = 'image/gif'
  else if (/^UklGR/i.test(base64)) type = 'image/webp'
  else if (/^PHN2Zy/i.test(base64)) type = 'image/svg+xml'
  return `data:${type};base64,${base64}`
}

/** 把章节 HTML 中旧式 SVG <image> 封面转为普通 <img>。 */
export function upgradeSvgImagesToImg(html = '', imagesById = new Map(), coverDataUrl = '') {
  if (!html || !html.includes('<svg')) return html
  if (typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const images = Array.from(doc.querySelectorAll('image'))
  if (images.length === 0) return html
  let changed = false

  for (const el of images) {
    const href = el.getAttribute('xlink:href') || el.getAttribute('href')
    if (!href) continue
    const svg = el.closest('svg')
    if (!svg) continue

    let src = ''
    const id = href.startsWith('book-image://') ? href.slice('book-image://'.length) : ''
    if (id && imagesById.has(id)) {
      src = `book-image://${id}`
    } else if (coverDataUrl && (/cover/i.test(href) || images.length === 1)) {
      // 旧数据常见的 SVG 封面：直接用已解析的 book.cover
      src = coverDataUrl
    }

    if (!src) continue
    const newImg = doc.createElement('img')
    newImg.setAttribute('src', src)
    const width = el.getAttribute('width') || svg.getAttribute('width')
    const height = el.getAttribute('height') || svg.getAttribute('height')
    if (width && width !== '100%') newImg.setAttribute('width', width)
    if (height && height !== '100%') newImg.setAttribute('height', height)
    svg.parentNode?.replaceChild(newImg, svg)
    changed = true
  }

  return changed ? doc.body.innerHTML : html
}

/** 升级一本书的旧数据；返回是否有改动。 */
export function upgradeBook(book) {
  if (!book || typeof book !== 'object') return false
  let changed = false

  if (book.cover && book.cover.startsWith('data:application/octet-stream;base64,')) {
    const normalized = normalizeDataUrlMime(book.cover)
    if (normalized !== book.cover) {
      book.cover = normalized
      changed = true
    }
  }

  if (Array.isArray(book.chapters)) {
    const imagesById = new Map((book.images || []).map((img) => [img.id, img]))
    for (const chapter of book.chapters) {
      if (!chapter || typeof chapter.content !== 'string') continue
      const content = upgradeSvgImagesToImg(chapter.content, imagesById, book.cover)
      if (content !== chapter.content) {
        chapter.content = content
        changed = true
      }
      // 旧版本曾把封面页误清空成 <p></p>，这里用 book.cover 恢复
      const isEmpty = !chapter.content.trim() || /^<p>\s*<\/p>$/.test(chapter.content.trim())
      if (isEmpty && book.cover && /cover|titlepage/i.test(chapter.title || '')) {
        chapter.content = `<img src="${book.cover}" style="max-width:100%">`
        changed = true
      }
    }
  }

  return changed
}