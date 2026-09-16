import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { splitTemplate } from './template'
import { expandHtmlBlocks } from './htmlBlock'

/** 转义 XML 特殊字符。 */
export function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 构建 META-INF/container.xml。 */
export function buildContainerXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
}

/** 计算资源在导出 EPUB 内的相对 OEBPS 路径。 */
export function resourceExportHref(resource) {
  const kind = resource?.kind || 'other'
  const dir = kind === 'font' ? 'fonts' : kind === 'css' ? 'styles' : kind === 'media' ? 'media' : 'resources'
  return `${dir}/${resource.filename || 'resource.bin'}`
}

/** 计算封面导出后的文件名与 MIME，根据 dataURL 实际类型决定扩展名。 */
function coverFileInfo(book) {
  if (!book.cover) return null
  const m = String(book.cover).match(/^data:([^;]+);/)
  const type = m ? m[1] : 'image/jpeg'
  const ext = mimeToExt(type)
  return { filename: `cover.${ext}`, type }
}

/** 构建 OPF 包清单。images: [{ filename, type }] */
export function buildOpfXml(book, images = [], resources = []) {
  const chapters = book.chapters || []
  const meta = [
    `<dc:title>${escapeXml(book.title)}</dc:title>`,
    `<dc:creator opf:role="aut">${escapeXml(book.author || '佚名')}</dc:creator>`,
    `<dc:language>${escapeXml(book.language || 'zh-CN')}</dc:language>`,
    `<dc:identifier id="book-id">urn:uuid:${escapeXml(book.identifier || book.id)}</dc:identifier>`,
    book.publishDate ? `<dc:date>${escapeXml(book.publishDate)}</dc:date>` : '',
    // 扩展元数据：有值才写入，保持 OPF 干净
    book.description ? `<dc:description>${escapeXml(book.description)}</dc:description>` : '',
    book.publisher ? `<dc:publisher>${escapeXml(book.publisher)}</dc:publisher>` : '',
    book.subject ? `<dc:subject>${escapeXml(book.subject)}</dc:subject>` : '',
    book.rights ? `<dc:rights>${escapeXml(book.rights)}</dc:rights>` : '',
  ].filter(Boolean).join('\n    ')

  const manifest = [
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `<item id="css" href="styles.css" media-type="text/css"/>`,
  ]
  const cover = coverFileInfo(book)
  if (cover) {
    // EPUB2 使用 <meta name="cover"> 标识封面；properties="cover-image" 是 EPUB3 属性，留在这里会让 EPUB2 校验不通过。
    manifest.push(`<item id="cover-image" href="${cover.filename}" media-type="${cover.type}"/>`)
  }
  images.forEach((img, i) => {
    manifest.push(`<item id="image-${i + 1}" href="images/${img.filename}" media-type="${img.type}"/>`)
  })
  resources.forEach((res, i) => {
    manifest.push(`<item id="resource-${i + 1}" href="${escapeXml(resourceExportHref(res))}" media-type="${escapeXml(res.type || 'application/octet-stream')}"/>`)
  })
  chapters.forEach((ch, i) => {
    manifest.push(`<item id="chapter-${i + 1}" href="chapter-${i + 1}.xhtml" media-type="application/xhtml+xml"/>`)
  })

  const spine = chapters.map((ch, i) => `    <itemref idref="chapter-${i + 1}"/>`).join('\n  ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    ${meta}
    ${book.cover ? '<meta name="cover" content="cover-image"/>' : ''}
  </metadata>
  <manifest>
    ${manifest.join('\n    ')}
  </manifest>
  <spine toc="ncx">
  ${spine}
  </spine>
</package>`
}

/** 构建 NCX 目录。 */
export function buildNcxXml(book) {
  const chapters = book.chapters || []
  const uid = book.identifier || book.id
  const navPoints = chapters
    .map((ch, i) => {
      const id = `navPoint-${i + 1}`
      const label = escapeXml(ch.title)
      const src = `chapter-${i + 1}.xhtml`
      return `    <navPoint id="${id}" playOrder="${i + 1}">
      <navLabel><text>${label}</text></navLabel>
      <content src="${src}"/>
    </navPoint>`
    })
    .join('\n  ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(uid)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(book.title)}</text></docTitle>
  <navMap>
  ${navPoints}
  </navMap>
</ncx>`
}

/** 构建单个章节的 XHTML。content 可传入处理后的正文。 */
export function buildChapterXhtml(chapter, book, index, contentOverride) {
  const content = contentOverride != null ? contentOverride : (chapter.content || '')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(book.language || 'zh-CN')}">
  <head>
    <title>${escapeXml(chapter.title)}</title>
    <link rel="stylesheet" type="text/css" href="styles.css"/>
  </head>
  <body>
    <div class="chapter-body">
${content}
    </div>
  </body>
</html>`
}

/** 构建默认阅读 CSS，可追加额外样式。（实现已拆到 utils/styles.js，此处转引保持兼容） */
import { buildStylesCss } from './styles'
export { buildStylesCss }

/** 把 dataURL 解码成 Uint8Array。 */
export function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1] || ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function mimeToExt(type) {
  const t = String(type || '').toLowerCase().replace(/^image\//, '')
  if (t === 'jpeg' || t === 'jpg') return 'jpg'
  if (t === 'gif') return 'gif'
  if (t === 'webp') return 'webp'
  if (t === 'svg+xml' || t === 'svg') return 'svg'
  return 'png'
}

/** 从章节正文提取 dataURL 图片，改写为 images/ 相对路径。 */
function rewriteImages(content, counter) {
  const images = []
  let count = counter
  const rewritten = (content || '').replace(
    /<img([^>]*?)src="(data:image\/([^;]+);base64,[^"]+)"([^>]*?)>/gi,
    (match, before, dataUrl, type, after) => {
      count += 1
      const filename = `image-${count}.${mimeToExt(type)}`
      images.push({ filename, dataUrl, type })
      return `<img${before}src="images/${filename}"${after}>`
    },
  )
  return { content: rewritten, images, count }
}

/** 把章节正文中的书内图库引用 book-image://{id} 改写为 images/ 相对路径。 */
function rewriteBookImageRefs(content, book, publishedImages, publishedMap) {
  const gallery = (book.images || []).reduce((map, img) => {
    map[img.id] = img
    return map
  }, {})
  return (content || '').replace(/(src|href|xlink:href)="book-image:\/\/([^"]+)"/gi, (match, attr, id) => {
    const img = gallery[id]
    if (!img) return match
    if (!publishedMap[id]) {
      publishedMap[id] = true
      publishedImages.push({ filename: img.filename, type: img.type, dataUrl: img.dataUrl })
    }
    return `${attr}="images/${img.filename}"`
  })
}

/** 把章节正文中的书内资源引用 book-resource://{id} 改写为导出后相对 OEBPS 的路径。 */
function rewriteBookResourceRefs(content, book) {
  const gallery = (book.resources || []).reduce((map, res) => {
    map[res.id] = res
    return map
  }, {})
  return (content || '').replace(/(src|href)="book-resource:\/\/([^"]+)"/gi, (match, attr, id) => {
    const res = gallery[id]
    if (!res) return match
    return `${attr}="${resourceExportHref(res)}"`
  })
}

/** 把 CSS 中的书内资源引用 url("book-resource://{id}") 改写为相对 styles.css 的路径。 */
function rewriteBookResourceUrlsInCss(css, book) {
  const gallery = (book.resources || []).reduce((map, res) => {
    map[res.id] = res
    return map
  }, {})
  return (css || '').replace(/url\(\s*["']?book-resource:\/\/([^"')]+)["']?\s*\)/gi, (match, id) => {
    const res = gallery[id]
    if (!res) return match
    return `url("${resourceExportHref(res)}")`
  })
}

/** 提取正文中的 <style> 块并移除，返回收集到的 CSS。 */
function extractInlineStyle(content, sink) {
  const rewritten = (content || '').replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (m, inner) => {
    if (inner && inner.trim()) sink.push(inner.trim())
    return ''
  })
  return rewritten
}

/** 根据 bookStore 的书籍对象打包生成合法的 EPUB 文件并触发下载。 */
export async function exportEpubFile(book, { download = true, templates = [] } = {}) {
  const zip = new JSZip()
  const publishedResources = book.resources || []
  const extraCss = [...(book.styles || [])]

  // 模板内定义的 <style> 样式，一并编译进 styles.css
  templates.forEach((tpl) => {
    const { css } = splitTemplate(tpl.html)
    extraCss.push(...css)
  })

  // 书内 CSS（含导入的 CSS 模板）里的 book-resource 引用改为导出路径
  for (let i = 0; i < extraCss.length; i++) {
    extraCss[i] = rewriteBookResourceUrlsInCss(extraCss[i], book)
  }

  // 预处理章节：提样式、改写书内图库/资源引用、再兜底改写旧 dataURL 图片
  const publishedImages = []
  const publishedMap = {}
  let imgCounter = 0
  const chapters = (book.chapters || []).map((ch) => {
    // 先把 htmlBlock 占位解封成真实结构（图片/资源改写要看到其中的引用）
    let content = expandHtmlBlocks(ch.content || '')
    content = extractInlineStyle(content, extraCss)
    content = rewriteBookImageRefs(content, book, publishedImages, publishedMap)
    content = rewriteBookResourceRefs(content, book)
    const res = rewriteImages(content, imgCounter)
    imgCounter = res.count
    res.images.forEach((img) => publishedImages.push(img))
    return { ch, content: res.content }
  })

  // 1. mimetype 必须是首项且不压缩
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', buildContainerXml())
  zip.file('OEBPS/content.opf', buildOpfXml(book, publishedImages, publishedResources))
  zip.file('OEBPS/toc.ncx', buildNcxXml(book))
  zip.file('OEBPS/styles.css', buildStylesCss(extraCss.join('\n')))

  chapters.forEach(({ ch, content }, i) => {
    zip.file(`OEBPS/chapter-${i + 1}.xhtml`, buildChapterXhtml(ch, book, i, content))
  })

  publishedImages.forEach((img) => {
    zip.file(`OEBPS/images/${img.filename}`, dataUrlToBytes(img.dataUrl))
  })

  publishedResources.forEach((res) => {
    const path = `OEBPS/${resourceExportHref(res)}`
    if (res.text != null) {
      zip.file(path, res.text)
    } else if (res.dataUrl) {
      zip.file(path, dataUrlToBytes(res.dataUrl))
    }
  })

  // 封面
  const cover = coverFileInfo(book)
  if (cover) {
    zip.file(`OEBPS/${cover.filename}`, dataUrlToBytes(book.cover))
  }

  const blob = await zip.generateAsync(
    { type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' },
  )

  if (download) {
    const safeName = (book.title || 'book').replace(/[^\w\u4e00-\u9fa5-]+/g, '_')
    saveAs(blob, `${safeName}.epub`)
  }
  return blob
}
