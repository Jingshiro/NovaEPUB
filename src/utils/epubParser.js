import JSZip from 'jszip'
import { createBook, createChapter, countWords } from '../stores/book'
import { compressImageDataUrl, createBookImage, mimeFromDataUrl } from './image'
import { createBookResource } from './resource'

const NS = {
  container: 'urn:oasis:names:tc:opendocument:xmlns:container',
  opf: 'http://www.idpf.org/2007/opf',
  dc: 'http://purl.org/dc/elements/1.1/',
  ncx: 'http://www.daisy.org/z3986/2005/ncx/',
}

/** 用 DOMParser 解析 XML 文本，找不到命名空间时回退到本地名匹配。 */
function parseXml(text) {
  if (typeof DOMParser === 'undefined') {
    throw new Error('当前环境不支持 DOMParser，无法解析 EPUB 结构。')
  }
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('XML 解析失败')
  }
  return doc
}

/** 读取 ZIP 文本文件；优先 UTF-8，失败时回退 GB18030，避免非 UTF-8 章节乱码。 */
async function readZipText(file) {
  if (typeof TextDecoder === 'undefined') {
    return file.async('text')
  }
  try {
    const bytes = await file.async('uint8array')
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      try {
        return new TextDecoder('gb18030').decode(bytes)
      } catch {
        return new TextDecoder().decode(bytes)
      }
    }
  } catch {
    return file.async('text')
  }
}

/** 按 (命名空间, 本地名) 找元素，兼容命名空间缺省情况。 */
function findByNs(docOrEl, ns, localName) {
  const list = docOrEl.getElementsByTagNameNS(ns, localName)
  if (list.length > 0) return list
  return docOrEl.getElementsByTagName(localName)
}

/** 归一化 ZIP 内路径，去掉开头的 / 与 ./。 */
function normalizeZipPath(path = '') {
  return String(path).replace(/^\/+/, '').replace(/^\.\//, '')
}

/** 从 ZIP 中扫描第一个 .opf 作为兜底。 */
async function findOpfByScan(zip) {
  const files = Object.keys(zip.files).filter((f) => !zip.files[f].dir && /\.opf$/i.test(f))
  if (files.length === 0) throw new Error('未找到 META-INF/container.xml，也没有可用的 OPF 文件')
  return files[0]
}

/** 读取 container.xml，返回 OPF 相对路径；缺失/损坏时自动扫描 .opf 兜底。 */
async function getOpfPath(zip, warnings = []) {
  const containerFile = zip.file('META-INF/container.xml')
  if (containerFile) {
    try {
      const text = await readZipText(containerFile)
      const doc = parseXml(text)
      const rootfile = doc.getElementsByTagName('rootfile')[0]
      if (rootfile?.getAttribute('full-path')) {
        return normalizeZipPath(rootfile.getAttribute('full-path'))
      }
    } catch (err) {
      warnings.push(`container.xml 解析失败，已尝试自动扫描：${err.message || err}`)
    }
  } else {
    warnings.push('未找到 META-INF/container.xml，已自动扫描 OPF 文件')
  }
  return findOpfByScan(zip)
}

/** 读取 OPF，返回元数据、manifest、spine。 */
async function parseOpf(zip, opfPath) {
  let opfFile = zip.file(opfPath)
  if (!opfFile) {
    try {
      opfFile = zip.file(decodeURIComponent(opfPath))
    } catch {
      // 忽略解码失败
    }
  }
  if (!opfFile) throw new Error(`未找到 OPF 文件: ${opfPath}`)
  const text = await readZipText(opfFile)
  const doc = parseXml(text)

  const title = textOf(doc, NS.dc, 'title') || '未命名书籍'
  const author = textOf(doc, NS.dc, 'creator') || '佚名'
  const publishDate = textOf(doc, NS.dc, 'date') || ''
  const language = textOf(doc, NS.dc, 'language') || 'zh-CN'
  const identifier = textOf(doc, NS.dc, 'identifier') || ''
  // 扩展元数据：简介 / 出版社 / 主题 / 版权（缺失时为空串，导出侧按需写入）
  const description = textOf(doc, NS.dc, 'description') || ''
  const publisher = textOf(doc, NS.dc, 'publisher') || ''
  const subject = textOf(doc, NS.dc, 'subject') || ''
  const rights = textOf(doc, NS.dc, 'rights') || ''

  const manifest = {}
  for (const item of doc.getElementsByTagName('item')) {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (id && href) manifest[id] = { href, type: item.getAttribute('media-type') || '' }
  }

  const spineIds = []
  for (const item of doc.getElementsByTagName('itemref')) {
    const idref = item.getAttribute('idref')
    if (idref) spineIds.push(idref)
  }
  // 某些非标 EPUB 缺少 spine：从 manifest 里按 XHTML/HTML 自动推导正文顺序
  if (spineIds.length === 0) {
    for (const id of Object.keys(manifest)) {
      const item = manifest[id]
      if (/^application\/xhtml\+xml$/i.test(item.type) || /\.(xhtml|html?)$/i.test(item.href)) {
        spineIds.push(id)
      }
    }
  }

  let cover = null
  let coverType = ''
  const coverMeta = doc.getElementsByTagName('meta')
  for (const meta of coverMeta) {
    if (meta.getAttribute('name') === 'cover') {
      const coverId = meta.getAttribute('content')
      if (coverId && manifest[coverId]) {
        cover = manifest[coverId].href
        coverType = manifest[coverId].type || ''
        break
      }
    }
  }
  if (!cover) {
    for (const id of Object.keys(manifest)) {
      if (manifest[id].type.startsWith('image/') && manifest[id].href.match(/cover/i)) {
        cover = manifest[id].href
        coverType = manifest[id].type || ''
        break
      }
    }
  }

  return { title, author, publishDate, language, identifier, description, publisher, subject, rights, manifest, spineIds, cover, coverType, opfPath }
}

/** 解析 EPUB3 nav.xhtml 目录，返回 { [spineId]: title }。 */
async function parseEpub3Nav(zip, opfPath, manifest) {
  const dir = opfDir(opfPath)
  let navPath = null
  for (const id of Object.keys(manifest)) {
    const item = manifest[id]
    const props = item.properties || ''
    if (/nav/i.test(item.href) || /(^|\s)nav(\s|$)/i.test(props)) {
      navPath = joinPath(dir, item.href)
      break
    }
  }
  if (!navPath) {
    const candidates = Object.keys(zip.files).filter((f) => !zip.files[f].dir && /(^|\/)(nav|toc)\.x?html?$/i.test(f))
    if (candidates.length) navPath = candidates[0]
  }
  if (!navPath) return {}

  let file = zip.file(navPath)
  if (!file) {
    try {
      file = zip.file(decodeURIComponent(navPath))
    } catch {
      // 忽略解码失败
    }
  }
  if (!file) return {}
  const text = await readZipText(file)
  const doc = new DOMParser().parseFromString(text, 'text/html')

  const map = {}
  const resolveHref = (href) => {
    const clean = href.split('#')[0].replace(/^\.\//, '')
    for (const id of Object.keys(manifest)) {
      const m = manifest[id].href.replace(/^\.\//, '')
      const full = dir ? `${dir}/${m}`.replace(/^\.\//, '') : m
      if (m === clean || full === clean || m.endsWith(clean)) return id
    }
    return null
  }

  for (const link of Array.from(doc.querySelectorAll('nav a[href]'))) {
    const href = link.getAttribute('href')
    if (!href) continue
    const spineId = resolveHref(href)
    const label = link.textContent.trim()
    if (spineId && label && !map[spineId]) map[spineId] = label
  }
  return map
}

/** 读取 NCX 目录，返回 { [spineId]: title }；缺失时回退 EPUB3 nav。 */
async function parseNcx(zip, opfPath, manifest, spineIds, warnings = []) {
  const dir = opfPath.split('/').slice(0, -1).join('/')
  let ncxPath = null
  for (const id of Object.keys(manifest)) {
    if (manifest[id].type === 'application/x-dtbncx+xml' || /toc\.ncx$/i.test(manifest[id].href)) {
      ncxPath = dir ? `${dir}/${manifest[id].href}` : manifest[id].href
      break
    }
  }
  if (!ncxPath) {
    const candidate = dir ? `${dir}/toc.ncx` : 'toc.ncx'
    if (zip.file(candidate)) ncxPath = candidate
  }
  if (!ncxPath) {
    const navMap = await parseEpub3Nav(zip, opfPath, manifest)
    if (Object.keys(navMap).length > 0) {
      warnings.push('未找到 NCX，已使用 EPUB3 nav 目录解析章节名')
      return navMap
    }
    return {}
  }

  const ncxFile = zip.file(ncxPath)
  if (!ncxFile) return {}
  const text = await readZipText(ncxFile)
  const doc = parseXml(text)

  const map = {}
  const resolveHref = (href) => {
    const clean = href.split('#')[0].replace(/^\.\//, '')
    for (const id of Object.keys(manifest)) {
      const m = manifest[id].href.replace(/^\.\//, '')
      const full = dir ? `${dir}/${m}`.replace(/^\.\//, '') : m
      if (m === clean || full === clean || m.endsWith(clean)) return id
    }
    return null
  }

  for (const nav of doc.getElementsByTagName('navPoint')) {
    const labelEl = nav.getElementsByTagName('text')[0]
    const contentEl = nav.getElementsByTagName('content')[0]
    const label = labelEl ? labelEl.textContent.trim() : ''
    const src = contentEl ? contentEl.getAttribute('src') : null
    if (!src) continue
    const spineId = resolveHref(src)
    if (spineId) map[spineId] = label
  }
  return map
}

/** 取 OPF 目录前缀。 */
function opfDir(opfPath) {
  return opfPath.split('/').slice(0, -1).join('/')
}

/** 取章节文件在 ZIP 内的完整路径（相对根）。 */
function chapterFullPath(manifest, spineId, opfPath) {
  const item = manifest[spineId]
  if (!item) return ''
  return joinPath(opfDir(opfPath), item.href)
}

/** 取路径所在目录，空串表示根目录。 */
function dirPath(path) {
  const idx = (path || '').lastIndexOf('/')
  return idx === -1 ? '' : path.slice(0, idx)
}

/** 相对路径与基础目录拼接为 ZIP 路径，支持 . 与 ..。 */
function joinPath(baseDir, rel) {
  const base = (baseDir || '').split('/').filter(Boolean)
  const clean = String(rel).split('#')[0].replace(/^\/+/, '')
  for (const seg of clean.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') base.pop()
    else base.push(seg)
  }
  return base.join('/')
}

/** 读取 ZIP 内一张图片，存入书内图库；重复路径复用同一张图片。 */
async function loadBookImage(zip, zipPath, bookImages, imageIndex, imageTypeByPath = {}) {
  if (imageIndex[zipPath]) return imageIndex[zipPath]
  let file = zip.file(zipPath)
  if (!file) {
    try {
      file = zip.file(decodeURIComponent(zipPath))
    } catch {
      // 忽略解码失败，保持原路径尝试
    }
  }
  if (!file) return null
  const blob = await file.async('blob')
  const dataUrl = await blobToDataUrl(blob)
  const rawType = mimeFromDataUrl(dataUrl)
  const type = rawType && rawType !== 'application/octet-stream'
    ? rawType
    : (imageTypeByPath[zipPath] || 'image/png')
  const compressed = await compressImageDataUrl(dataUrl)
  // 统一 dataURL 的 MIME，避免 JSZip 解出的 octet-stream 无法在浏览器/预览中显示
  const normalizedDataUrl = `data:${type};base64,${compressed.split(',')[1] || ''}`
  const img = createBookImage(normalizedDataUrl, { type })
  bookImages.push(img)
  imageIndex[zipPath] = img
  return img
}

/** 取 ZIP 路径的最后一段作为文件名。 */
function basenamePath(path = '') {
  const parts = String(path).split('/')
  return parts[parts.length - 1] || 'resource'
}

/** 读取 ZIP 内一个二进制资源（字体/媒体/其他），存入书内资源库并返回记录。 */
async function loadBookResource(zip, zipPath, resources, resourceIndex, typeByPath = {}) {
  if (resourceIndex[zipPath]) return resourceIndex[zipPath]
  let file = zip.file(zipPath)
  if (!file) {
    try {
      file = zip.file(decodeURIComponent(zipPath))
    } catch {
      // 忽略解码失败，保持原路径尝试
    }
  }
  if (!file) return null
  const blob = await file.async('blob')
  const dataUrl = await blobToDataUrl(blob)
  const rawType = mimeFromDataUrl(dataUrl)
  const type = rawType && rawType !== 'application/octet-stream'
    ? rawType
    : (typeByPath[zipPath] || 'application/octet-stream')
  const res = createBookResource(dataUrl, {
    type,
    originalPath: zipPath,
    filename: basenamePath(zipPath),
  })
  // 同名资源做去重，避免导出时写到同一路径互相覆盖
  if (resources.some((r) => r.filename === res.filename)) {
    const dot = res.filename.lastIndexOf('.')
    const ext = dot >= 0 ? res.filename.slice(dot) : ''
    const base = dot >= 0 ? res.filename.slice(0, dot) : res.filename
    res.filename = `${base}-${res.id.slice(0, 8)}${ext}`
  }
  resources.push(res)
  resourceIndex[zipPath] = res
  return res
}

/** 把 CSS 内 url(...) 引用的字体/图片/媒体改为书内资源引用 book-resource://{id}。 */
async function rewriteCssResourceUrls(css, cssPath, zip, resources, resourceIndex, typeByPath = {}) {
  if (!css) return css
  const cssDir = dirPath(cssPath)
  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]+))\s*\)/gi
  let output = css
  let match
  const queue = []
  while ((match = urlPattern.exec(css)) !== null) {
    const raw = match[1] || match[2] || match[3] || ''
    const href = raw.trim()
    if (!href || href.startsWith('data:') || href.startsWith('book-image://') || href.startsWith('book-resource://') || /^(https?:)?\/\//i.test(href) || href.startsWith('#')) {
      continue
    }
    const zipPath = joinPath(cssDir, href)
    const existing = resourceIndex[zipPath]
    if (existing) {
      queue.push({ raw, replacement: `book-resource://${existing.id}`, range: { start: match.index, end: match.index + match[0].length } })
      continue
    }
    queue.push({ raw, zipPath, range: { start: match.index, end: match.index + match[0].length } })
  }
  // 逐个加载后再统一替换，避免 regex 与异步交错
  for (const item of queue) {
    if (item.replacement) continue
    const res = await loadBookResource(zip, item.zipPath, resources, resourceIndex, typeByPath)
    if (res) item.replacement = `book-resource://${res.id}`
  }
  // 从后往前替换，保持 index 有效
  for (let i = queue.length - 1; i >= 0; i--) {
    const item = queue[i]
    if (!item.replacement) continue
    output = output.slice(0, item.range.start) + `url("${item.replacement}")` + output.slice(item.range.end)
  }
  return output
}

/** 把章节 HTML 中相对路径的 <img> 提取为书内图库引用 book-image://{id}。 */
async function importChapterImages(zip, chapterPath, html, bookImages, imageIndex, imageTypeByPath = {}, resources = [], resourceIndex = {}, resourceTypeByPath = {}, warnings = []) {
  if (!html) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const baseDir = dirPath(chapterPath)
  const imgs = Array.from(doc.querySelectorAll('img[src]'))
  for (const img of imgs) {
    const src = img.getAttribute('src')
    if (!src || src.startsWith('data:') || /^(https?:)?\/\//i.test(src) || src.startsWith('book-image://') || src.startsWith('book-resource://')) {
      continue
    }
    const zipPath = joinPath(baseDir, src)
    const record = await loadBookImage(zip, zipPath, bookImages, imageIndex, imageTypeByPath)
    if (record) img.setAttribute('src', `book-image://${record.id}`)
    else warnings.push(`章节 ${chapterPath} 缺少图片：${src}`)
  }

  // SVG 封面/插图：兼容 <image xlink:href="..."> 或 <image href="...">
  const svgImages = Array.from(doc.querySelectorAll('image'))
  for (const img of svgImages) {
    const attr = img.getAttribute('xlink:href') || img.getAttribute('href')
    if (!attr || attr.startsWith('data:') || /^(https?:)?\/\//i.test(attr) || attr.startsWith('book-image://') || attr.startsWith('book-resource://')) {
      continue
    }
    const zipPath = joinPath(baseDir, attr)
    const record = await loadBookImage(zip, zipPath, bookImages, imageIndex, imageTypeByPath)
    if (!record) {
      warnings.push(`章节 ${chapterPath} 缺少 SVG 图片：${attr}`)
      continue
    }
    const svg = img.closest('svg')
    if (svg) {
      // 把 SVG 封面转成普通 <img>，保证 TipTap 编辑器里也能直接显示
      const newImg = doc.createElement('img')
      newImg.setAttribute('src', `book-image://${record.id}`)
      const width = img.getAttribute('width') || svg.getAttribute('width')
      const height = img.getAttribute('height') || svg.getAttribute('height')
      if (width && width !== '100%') newImg.setAttribute('width', width)
      if (height && height !== '100%') newImg.setAttribute('height', height)
      svg.parentNode?.replaceChild(newImg, svg)
    } else {
      img.setAttribute('xlink:href', `book-image://${record.id}`)
    }
  }

  // 媒体/附件等书内资源引用（不处理章节间跳转的 .xhtml 链接）
  const resourceSelectors = [
    ['audio', 'src'],
    ['video', 'src'],
    ['source', 'src'],
    ['track', 'src'],
    ['object', 'data'],
  ]
  for (const [selector, attr] of resourceSelectors) {
    const nodes = Array.from(doc.querySelectorAll(`${selector}[${attr}]`))
    for (const node of nodes) {
      const value = node.getAttribute(attr)
      if (!value || value.startsWith('data:') || /^(https?:)?\/\//i.test(value) || value.startsWith('book-resource://') || value.startsWith('book-image://') || value.startsWith('#')) {
        continue
      }
      const zipPath = joinPath(baseDir, value)
      const resource = await loadBookResource(zip, zipPath, resources, resourceIndex, resourceTypeByPath)
      if (resource) node.setAttribute(attr, `book-resource://${resource.id}`)
      else warnings.push(`章节 ${chapterPath} 缺少资源：${value}`)
    }
  }
  return doc.body ? doc.body.innerHTML : html
}

/** 读取并清洗单个章节的 XHTML 正文。 */
async function readChapterHtml(zip, manifest, spineId, opfPath, warnings = []) {
  const item = manifest[spineId]
  if (!item) {
    warnings.push(`spine 引用了不存在的 manifest 条目：${spineId}`)
    return ''
  }
  const href = chapterFullPath(manifest, spineId, opfPath)
  let file = zip.file(href)
  if (!file) {
    try {
      file = zip.file(decodeURIComponent(href))
    } catch {
      // 忽略解码失败
    }
  }
  if (!file) {
    warnings.push(`缺少章节文件：${href}`)
    return ''
  }
  const text = await readZipText(file)
  return sanitizeXhtml(text)
}

/** 从 XHTML 中抽取 body 内容并去除脚本/样式，返回干净的 HTML 片段。
 *  使用 text/html 解析模式，兼容真实 EPUB 中不严格的 XHTML 与 HTML 实体。 */
function sanitizeXhtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const body = doc.body
  let content = body ? body.innerHTML : html
  // 去除脚本、样式、内联事件
  const container = document.createElement('div')
  container.innerHTML = content
  container.querySelectorAll('script, style, [onclick], [onload], [onerror]').forEach((el) => el.remove())
  return container.innerHTML
}

function textOf(doc, ns, localName) {
  const els = findByNs(doc, ns, localName)
  return els && els.length ? els[0].textContent.trim() : null
}

/**
 * 解析一个 .epub 文件，返回可直接存入 bookStore 的书籍对象。
 */
export async function parseEpubFile(file) {
  const zip = await JSZip.loadAsync(file)
  const warnings = []
  const opfPath = await getOpfPath(zip, warnings)
  const { title, author, publishDate, language, identifier, description, publisher, subject, rights, manifest, spineIds, cover, coverType } =
    await parseOpf(zip, opfPath)

  const titles = await parseNcx(zip, opfPath, manifest, spineIds, warnings)

  const chapters = []
  const bookImages = []
  const bookResources = []
  const imageIndex = {}
  const resourceIndex = {}
  const imageTypeByPath = {}
  const resourceTypeByPath = {}
  const importedCss = []
  const opfDirPath = opfDir(opfPath)
  for (const id of Object.keys(manifest)) {
    const item = manifest[id]
    const zipPath = joinPath(opfDirPath, item.href)
    resourceTypeByPath[zipPath] = item.type
    if (item.type.startsWith('image/')) {
      imageTypeByPath[zipPath] = item.type
    }
  }

  // 导入 CSS：文本读取并重写 url() 中的字体/媒体为书内资源引用，CSS 整体汇入 styles
  for (const id of Object.keys(manifest)) {
    const item = manifest[id]
    if (item.type !== 'text/css' && !/\.css$/i.test(item.href)) continue
    const cssPath = joinPath(opfDirPath, item.href)
    let cssFile = zip.file(cssPath)
    if (!cssFile) {
      try {
        cssFile = zip.file(decodeURIComponent(cssPath))
      } catch {
        // 忽略解码失败
      }
    }
    if (!cssFile) {
      warnings.push(`manifest 中声明的 CSS 文件缺失：${cssPath}`)
      continue
    }
    const cssText = await readZipText(cssFile)
    const rewritten = await rewriteCssResourceUrls(cssText, cssPath, zip, bookResources, resourceIndex, resourceTypeByPath)
    if (rewritten.trim()) importedCss.push(rewritten.trim())
  }

  for (const spineId of spineIds) {
    const chapterPath = chapterFullPath(manifest, spineId, opfPath)
    const rawHtml = await readChapterHtml(zip, manifest, spineId, opfPath, warnings)
    const html = await importChapterImages(
      zip,
      chapterPath,
      rawHtml,
      bookImages,
      imageIndex,
      imageTypeByPath,
      bookResources,
      resourceIndex,
      resourceTypeByPath,
      warnings,
    )
    const title = titles[spineId] || manifest[spineId]?.href || `章节 ${chapters.length + 1}`
    const chapter = createChapter(title, html)
    chapter.wordCount = countWords(html)
    chapters.push(chapter)
  }

  let coverData = null
  if (cover && manifest) {
    try {
      coverData = await readCover(zip, opfPath, cover, coverType)
    } catch (err) {
      console.warn('[epubParser] 封面读取失败', err)
    }
  }

  const book = createBook({
    title: title || '未命名书籍',
    author: author || '佚名',
    publishDate: publishDate || '',
    language: language || 'zh-CN',
    identifier: identifier || '',
    description,
    publisher,
    subject,
    rights,
    cover: coverData,
    chapters: chapters.length ? chapters : [createChapter('第一章', '')],
    images: bookImages,
    resources: bookResources,
    styles: importedCss,
    importWarnings: warnings,
  })
  return book
}

/** 根据文件名猜测图片 MIME，用于 JSZip 读取 Blob 丢失类型时的兜底。 */
function mimeFromCoverPath(coverHref = '') {
  const lower = coverHref.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  return 'image/jpeg'
}

async function readCover(zip, opfPath, coverHref, coverType = '') {
  const dir = opfDir(opfPath)
  const href = dir ? `${dir}/${coverHref}`.replace(/\/+/g, '/') : coverHref
  const file = zip.file(href)
  if (!file) return null
  const blob = await file.async('blob')
  const dataUrl = await blobToDataUrl(blob)
  const rawType = mimeFromDataUrl(dataUrl)
  const type = rawType && rawType !== 'application/octet-stream'
    ? rawType
    : (coverType || mimeFromCoverPath(coverHref))
  const normalizedDataUrl = `data:${type};base64,${dataUrl.split(',')[1] || ''}`
  return await compressImageDataUrl(normalizedDataUrl)
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export { parseOpf, sanitizeXhtml }
