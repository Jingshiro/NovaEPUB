/**
 * EPUB 导出前自检。
 * 不校验完整 epubcheck 规范，只保证 NovaEpub 导出的书不会因明显问题而打不开：
 * - 基础结构（章节、元数据）
 * - 书内图片/资源的 id 与文件名唯一性
 * - 正文/CSS 中的 book-image / book-resource 引用是否有对应资源
 * - 封面 dataURL 是否合法图片
 */

import { expandHtmlBlocks } from './htmlBlock'

export function createIssue(level, code, message) {
  return { level, code, message }
}

function uniqueCount(items) {
  return new Set(items).size
}

function collectContentImageIds(html = '') {
  const ids = []
  const re = /(?:src|href|xlink:href)="book-image:\/\/([^"]+)"/gi
  let m
  while ((m = re.exec(html)) !== null) ids.push(m[1])
  return ids
}

function collectContentResourceIds(html = '') {
  const ids = []
  const re = /(?:src|href|xlink:href)="book-resource:\/\/([^"]+)"/gi
  let m
  while ((m = re.exec(html)) !== null) ids.push(m[1])
  return ids
}

function collectCssResourceIds(css = '') {
  const ids = []
  const re = /url\(\s*["']?book-resource:\/\/([^"')]+)["']?\s*\)/gi
  let m
  while ((m = re.exec(css)) !== null) ids.push(m[1])
  return ids
}

/** 找出正文里无法由导出器处理的本地相对引用（主要是 <img src> 与媒体 src）。 */
function findUnresolvedLocalRefs(html = '', book) {
  const issues = []
  const imageIds = new Set((book.images || []).map((img) => img.id))
  const resourceIds = new Set((book.resources || []).map((res) => res.id))
  const imageFileNames = new Set((book.images || []).map((img) => img.filename))
  const resourceFileNames = new Set((book.resources || []).map((res) => res.filename))
  const coverMime = String(book.cover || '').match(/^data:([^;]+);/)?.[1] || ''
  const coverExt = coverMime.replace(/^image\//, '')
  const coverName = book.cover ? `cover.${coverExt === 'jpeg' ? 'jpg' : coverExt}` : ''

  const srcRe = /(src|data)="([^"]+)"/gi
  let m
  while ((m = srcRe.exec(html)) !== null) {
    const attr = m[1].toLowerCase()
    const value = m[2]
    if (!value || value.startsWith('data:') || value.startsWith('book-image://') || value.startsWith('book-resource://')) continue
    if (/^(https?:)?\/\//i.test(value) || value.startsWith('#')) continue
    // 导出后章节位于 OEBPS 根，OEBPS 内相对路径若确实在书内图库/资源库里则可解析，
    // 否则这份导出会缺文件。
    const name = value.split('/').pop()
    if (imageFileNames.has(name) || resourceFileNames.has(name) || (coverName && name === coverName)) continue
    // 不认识的相对引用按错误处理，防止用户无意间留下失效路径
    issues.push(createIssue('error', 'unresolved-local-ref', `正文存在无法打包的相对引用 ${attr}="${value}"`))
  }

  // 旧 dataURL 图片导出器能自动打包，但会新增未入库文件，提示用户尽量通过图库插入
  const dataImgRe = /<img[^>]+src="(data:image\/[^"]+)"/gi
  let dm
  while ((dm = dataImgRe.exec(html)) !== null) {
    issues.push(createIssue('warning', 'inline-data-image', '正文中存在未收编到书内图库的 dataURL 图片，导出时会自动打包但仍建议重新插入一次'))
  }

  return issues
}

function checkCover(book, issues) {
  if (!book.cover) return
  const m = String(book.cover).match(/^data:([^;]+);/)
  if (!m || !m[1].startsWith('image/')) {
    issues.push(createIssue('error', 'invalid-cover', '封面不是有效的图片 dataURL'))
  }
}

function checkTemplateCss(templates, book, issues) {
  const resourceIds = new Set((book.resources || []).map((res) => res.id))
  for (const tpl of (templates || [])) {
    const cssBlocks = String(tpl.html || '').match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi) || []
    const css = cssBlocks.map((b) => b.replace(/<\/?style[^>]*>/gi, '')).join('\n')
    const refs = collectCssResourceIds(css)
    for (const id of refs) {
      if (!resourceIds.has(id)) {
        issues.push(createIssue('error', 'missing-css-resource', `模板「${tpl.name || '未命名模板'}」引用了不存在的书内资源：${id}`))
      }
    }
  }
}

/**
 * 检查一本即将导出的书。
 * @returns {{ valid: boolean, errors: Array<{level,code,message}>, warnings: Array<{level,code,message}> }}
 */
export function checkEpubStructure(book, options = {}) {
  const { templates = [] } = options || {}
  const issues = []

  if (!book || typeof book !== 'object') {
    return { valid: false, errors: [createIssue('error', 'no-book', '没有可导出的书籍数据')], warnings: [] }
  }

  // 基础元数据
  if (!String(book.title || '').trim()) issues.push(createIssue('warning', 'empty-title', '书名称为空，阅读器可能显示为未知标题'))
  if (!String(book.author || '').trim()) issues.push(createIssue('warning', 'empty-author', '作者为空'))
  if (!String(book.identifier || '').trim()) issues.push(createIssue('warning', 'empty-identifier', '唯一标识为空，导出时会自动使用内部 ID 兜底'))
  if (!String(book.language || '').trim()) issues.push(createIssue('warning', 'empty-language', '语言为空，默认将使用 zh-CN'))

  // 章节结构
  const chapters = Array.isArray(book.chapters) ? book.chapters : []
  if (chapters.length === 0) {
    issues.push(createIssue('error', 'no-chapters', '没有可导出的章节'))
  } else {
    const chapterIds = chapters.map((c) => c.id).filter(Boolean)
    if (chapterIds.length !== uniqueCount(chapterIds)) {
      issues.push(createIssue('error', 'duplicate-chapter-id', '存在重复的章节 ID'))
    }
    chapters.forEach((ch, i) => {
      const label = `第 ${i + 1} 章`
      if (!ch || typeof ch.content !== 'string') {
        issues.push(createIssue('error', 'invalid-chapter', `${label}的数据无效`))
        return
      }
      if (!String(ch.title || '').trim()) issues.push(createIssue('warning', 'empty-chapter-title', `${label}标题为空`))
      if (!ch.content.trim()) issues.push(createIssue('warning', 'empty-chapter', `${label}内容为空`))
    })
  }

  // 图片/资源自身一致性
  const images = Array.isArray(book.images) ? book.images : []
  const resources = Array.isArray(book.resources) ? book.resources : []
  const imageIds = images.map((img) => img.id).filter(Boolean)
  const resourceIds = resources.map((res) => res.id).filter(Boolean)
  const imageFiles = images.map((img) => img.filename).filter(Boolean)
  const resourceFiles = resources.map((res) => res.filename).filter(Boolean)

  if (imageIds.length !== uniqueCount(imageIds)) issues.push(createIssue('error', 'duplicate-image-id', '书内图库存在重复的图片 ID'))
  if (imageFiles.length !== uniqueCount(imageFiles)) issues.push(createIssue('error', 'duplicate-image-filename', '书内图库存在重复文件名，导出时会相互覆盖'))
  if (resourceIds.length !== uniqueCount(resourceIds)) issues.push(createIssue('error', 'duplicate-resource-id', '书内资源库存在重复的资源 ID'))
  if (resourceFiles.length !== uniqueCount(resourceFiles)) issues.push(createIssue('error', 'duplicate-resource-filename', '书内资源库存在重复文件名，导出时会相互覆盖'))

  // 正文引用
  const imageIdSet = new Set(imageIds)
  const resourceIdSet = new Set(resourceIds)
  chapters.forEach((ch, i) => {
    if (!ch || typeof ch.content !== 'string') return
    // htmlBlock 占位里编码着真实的图片/资源引用，先解封再扫描，避免误报缺失
    const content = expandHtmlBlocks(ch.content)
    const label = `第 ${i + 1} 章「${ch.title || ''}」`
    for (const id of collectContentImageIds(content)) {
      if (!imageIdSet.has(id)) issues.push(createIssue('error', 'missing-image-ref', `${label}引用了不存在的图片：${id}`))
    }
    for (const id of collectContentResourceIds(content)) {
      if (!resourceIdSet.has(id)) issues.push(createIssue('error', 'missing-resource-ref', `${label}引用了不存在的资源：${id}`))
    }
    issues.push(...findUnresolvedLocalRefs(content, book))
  })

  // 书内样式（book.styles）与模板样式中的资源引用
  const allCss = [
    ...(Array.isArray(book.styles) ? book.styles : []),
  ]
  allCss.forEach((css, i) => {
    if (typeof css !== 'string') return
    for (const id of collectCssResourceIds(css)) {
      if (!resourceIdSet.has(id)) issues.push(createIssue('error', 'missing-css-resource', `书内样式 ${i + 1} 引用了不存在的资源：${id}`))
    }
  })
  checkTemplateCss(templates, book, issues)

  // 封面
  checkCover(book, issues)

  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warning')
  return { valid: errors.length === 0, errors, warnings, issues }
}