import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { countWords } from '../stores/book'

/** 转义 XML 特殊字符。 */
export function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'chapter'
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

/** 构建 OPF 包清单。 */
export function buildOpfXml(book) {
  const chapters = book.chapters || []
  const meta = [
    `<dc:title>${escapeXml(book.title)}</dc:title>`,
    `<dc:creator opf:role="aut">${escapeXml(book.author || '佚名')}</dc:creator>`,
    `<dc:language>${escapeXml(book.language || 'zh-CN')}</dc:language>`,
    `<dc:identifier id="book-id">urn:uuid:${escapeXml(book.identifier || book.id)}</dc:identifier>`,
    book.publishDate ? `<dc:date>${escapeXml(book.publishDate)}</dc:date>` : '',
  ].filter(Boolean).join('\n    ')

  const manifest = [
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `<item id="css" href="styles.css" media-type="text/css"/>`,
  ]
  if (book.cover) {
    manifest.push('<item id="cover-image" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>')
  }
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

/** 构建单个章节的 XHTML。 */
export function buildChapterXhtml(chapter, book, index) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(book.language || 'zh-CN')}">
  <head>
    <title>${escapeXml(chapter.title)}</title>
    <link rel="stylesheet" type="text/css" href="styles.css"/>
  </head>
  <body>
    <h1 class="chapter-title">${escapeXml(chapter.title)}</h1>
    <div class="chapter-body">
${chapter.content || ''}
    </div>
  </body>
</html>`
}

/** 构建默认阅读 CSS。 */
export function buildStylesCss() {
  return `/* 轻墨 LightInk 默认阅读样式 */
body {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'PingFang SC', sans-serif;
  line-height: 1.8;
  color: #1E1E1E;
  margin: 0;
  padding: 0 5% 6% 5%;
  font-size: 1em;
}
.chapter-title {
  font-size: 1.6em;
  font-weight: 700;
  margin: 0 0 1em 0;
}
.chapter-body p { margin: 0 0 1em 0; }
.chapter-body h1 { font-size: 1.8em; }
.chapter-body h2 { font-size: 1.5em; }
.chapter-body h3 { font-size: 1.25em; }
.chapter-body blockquote {
  border-left: 3px solid #D4A373;
  margin: 1em 0;
  padding: 0.5em 1em;
  color: #6B6B6B;
  background: #FBFBFB;
}
.chapter-body img { max-width: 100%; height: auto; display: block; margin: 1em auto; }
.chapter-body ul, .chapter-body ol { margin: 0 0 1em 0; padding-left: 1.5em; }
`
}

/** 把 dataURL 解码成 Uint8Array。 */
export function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1] || ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 根据 bookStore 的书籍对象打包生成合法的 EPUB 文件并触发下载。 */
export async function exportEpubFile(book, { download = true } = {}) {
  const zip = new JSZip()

  // 1. mimetype 必须是首项且不压缩
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', buildContainerXml())
  zip.file('OEBPS/content.opf', buildOpfXml(book))
  zip.file('OEBPS/toc.ncx', buildNcxXml(book))
  zip.file('OEBPS/styles.css', buildStylesCss())

  const chapters = book.chapters || []
  chapters.forEach((ch, i) => {
    zip.file(`OEBPS/chapter-${i + 1}.xhtml`, buildChapterXhtml(ch, book, i))
  })

  // 封面
  if (book.cover) {
    zip.file('OEBPS/cover.jpg', dataUrlToBytes(book.cover))
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

