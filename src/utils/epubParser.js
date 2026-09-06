import JSZip from 'jszip'
import { createBook, createChapter, countWords } from '../stores/book'

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

/** 按 (命名空间, 本地名) 找元素，兼容命名空间缺省情况。 */
function findByNs(docOrEl, ns, localName) {
  const list = docOrEl.getElementsByTagNameNS(ns, localName)
  if (list.length > 0) return list
  return docOrEl.getElementsByTagName(localName)
}

/** 读取 container.xml，返回 OPF 相对路径。 */
async function getOpfPath(zip) {
  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('未找到 META-INF/container.xml，不是合法的 EPUB')
  const text = await containerFile.async('text')
  const doc = parseXml(text)
  const rootfile = doc.getElementsByTagName('rootfile')[0]
  if (!rootfile) throw new Error('container.xml 缺少 rootfile 元素')
  return rootfile.getAttribute('full-path')
}

/** 读取 OPF，返回元数据、manifest、spine。 */
async function parseOpf(zip, opfPath) {
  const opfFile = zip.file(opfPath)
  if (!opfFile) throw new Error(`未找到 OPF 文件: ${opfPath}`)
  const text = await opfFile.async('text')
  const doc = parseXml(text)

  const title = textOf(doc, NS.dc, 'title') || '未命名书籍'
  const author = textOf(doc, NS.dc, 'creator') || '佚名'
  const publishDate = textOf(doc, NS.dc, 'date') || ''
  const language = textOf(doc, NS.dc, 'language') || 'zh-CN'
  const identifier = textOf(doc, NS.dc, 'identifier') || ''

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

  let cover = null
  const coverMeta = doc.getElementsByTagName('meta')
  for (const meta of coverMeta) {
    if (meta.getAttribute('name') === 'cover') {
      const coverId = meta.getAttribute('content')
      if (coverId && manifest[coverId]) {
        cover = manifest[coverId].href
        break
      }
    }
  }
  if (!cover) {
    for (const id of Object.keys(manifest)) {
      if (manifest[id].type.startsWith('image/') && manifest[id].href.match(/cover/i)) {
        cover = manifest[id].href
        break
      }
    }
  }

  return { title, author, publishDate, language, identifier, manifest, spineIds, cover, opfPath }
}

/** 读取 NCX 目录，返回 { [spineId]: title }。 */
async function parseNcx(zip, opfPath, manifest, spineIds) {
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
  if (!ncxPath) return {}

  const ncxFile = zip.file(ncxPath)
  if (!ncxFile) return {}
  const text = await ncxFile.async('text')
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

/** 读取并清洗单个章节的 XHTML 正文。 */
async function readChapterHtml(zip, manifest, spineId, opfPath) {
  const item = manifest[spineId]
  if (!item) return ''
  const dir = opfDir(opfPath)
  const href = dir ? `${dir}/${item.href}`.replace(/\/+/g, '/') : item.href
  const file = zip.file(href)
  if (!file) return ''
  const text = await file.async('text')
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
  const opfPath = await getOpfPath(zip)
  const { title, author, publishDate, language, identifier, manifest, spineIds, cover } =
    await parseOpf(zip, opfPath)

  const titles = await parseNcx(zip, opfPath, manifest, spineIds)

  const chapters = []
  for (const spineId of spineIds) {
    const rawHtml = await readChapterHtml(zip, manifest, spineId, opfPath)
    const title = titles[spineId] || manifest[spineId]?.href || `章节 ${chapters.length + 1}`
    const chapter = createChapter(title, rawHtml)
    chapter.wordCount = countWords(rawHtml)
    chapters.push(chapter)
  }

  let coverData = null
  if (cover && manifest) {
    try {
      coverData = await readCover(zip, opfPath, cover)
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
    cover: coverData,
    chapters: chapters.length ? chapters : [createChapter('第一章', '')],
  })
  return book
}

async function readCover(zip, opfPath, coverHref) {
  const dir = opfDir(opfPath)
  const href = dir ? `${dir}/${coverHref}`.replace(/\/+/g, '/') : coverHref
  const file = zip.file(href)
  if (!file) return null
  const blob = await file.async('blob')
  return await blobToDataUrl(blob)
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
