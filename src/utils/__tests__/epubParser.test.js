// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { parseEpubFile } from '../epubParser'
import { exportEpubFile } from '../epubExporter'

async function buildMinimalEpub() {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`)
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>解析测试书</dc:title>
    <dc:creator>作者甲</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="book-id">urn:uuid:123</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="ch1" href="chapter-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter-2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`)
  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:123"/></head>
  <docTitle><text>解析测试书</text></docTitle>
  <navMap>
    <navPoint id="n1" playOrder="1"><navLabel><text>第一章</text></navLabel><content src="chapter-1.xhtml"/></navPoint>
    <navPoint id="n2" playOrder="2"><navLabel><text>第二章</text></navLabel><content src="chapter-2.xhtml"/></navPoint>
  </navMap>
</ncx>`)
  zip.file('OEBPS/chapter-1.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body><p>hello 你好</p></body></html>`)
  zip.file('OEBPS/chapter-2.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>标题</h1><p>world</p></body></html>`)
  return await zip.generateAsync({ type: 'arraybuffer' })
}

describe('EPUB 解析', () => {
  it('解析元数据、NCX 目录与章节内容', async () => {
    const buf = await buildMinimalEpub()
    const book = await parseEpubFile(buf)
    expect(book.title).toBe('解析测试书')
    expect(book.author).toBe('作者甲')
    expect(book.chapters).toHaveLength(2)
    expect(book.chapters[0].title).toBe('第一章')
    expect(book.chapters[1].title).toBe('第二章')
    expect(book.chapters[0].content).toContain('hello 你好')
    expect(book.chapters[0].wordCount).toBeGreaterThan(0)
  })
})


async function buildEpubWithResources() {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`)
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>资源书</dc:title>
    <dc:creator>作者丙</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="book-id">urn:uuid:789</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="ch1" href="chapter-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="styles/main.css" media-type="text/css"/>
    <item id="font" href="fonts/test.woff" media-type="application/font-woff"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
  </spine>
</package>`)
  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:789"/></head>
  <docTitle><text>资源书</text></docTitle>
  <navMap>
    <navPoint id="n1" playOrder="1"><navLabel><text>第一章</text></navLabel><content src="chapter-1.xhtml"/></navPoint>
  </navMap>
</ncx>`)
  zip.file('OEBPS/chapter-1.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><link rel="stylesheet" href="styles/main.css"/></head><body><p>字体测试</p></body></html>`)
  zip.file('OEBPS/styles/main.css', `@font-face {
  font-family: "TestFont";
  src: url("../fonts/test.woff") format("woff");
}
body { font-family: "TestFont", sans-serif; }`)
  const fontBase64 = 'dGVzdC1mb250LWJpbmFyeQ=='
  zip.file('OEBPS/fonts/test.woff', Buffer.from(fontBase64, 'base64'), { binary: true })
  return await zip.generateAsync({ type: 'arraybuffer' })
}

async function buildEpubWithSvgCover() {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`)
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>SVG封面书</dc:title>
    <dc:creator>作者丁</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="book-id">urn:uuid:abc</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="ch1" href="chapter-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="img1" href="images/cover.png" media-type="image/png"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
  </spine>
</package>`)
  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:abc"/></head>
  <docTitle><text>SVG封面书</text></docTitle>
  <navMap>
    <navPoint id="n1" playOrder="1"><navLabel><text>封面</text></navLabel><content src="chapter-1.xhtml"/></navPoint>
  </navMap>
</ncx>`)
  zip.file('OEBPS/chapter-1.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body><div><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="images/cover.png"/></svg></div></body></html>`)
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  zip.file('OEBPS/images/cover.png', Buffer.from(pngBase64, 'base64'), { binary: true })
  return await zip.generateAsync({ type: 'arraybuffer' })
}

async function buildEpubWithCover() {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`)
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>带封面书</dc:title>
    <dc:creator>作者戊</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="book-id">urn:uuid:cover1</dc:identifier>
    <meta name="cover" content="cover"/>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="ch1" href="chapter-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover" href="cover.jpeg" media-type="image/jpeg"/>
  </manifest>
  <spine toc="ncx"><itemref idref="ch1"/></spine>
</package>`)
  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:cover1"/></head>
  <docTitle><text>带封面书</text></docTitle>
  <navMap><navPoint id="n1" playOrder="1"><navLabel><text>第一章</text></navLabel><content src="chapter-1.xhtml"/></navPoint></navMap>
</ncx>`)
  zip.file('OEBPS/chapter-1.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body><p>正文</p></body></html>`)
  const jpegBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='
  zip.file('OEBPS/cover.jpeg', Buffer.from(jpegBase64, 'base64'), { binary: true })
  return await zip.generateAsync({ type: 'arraybuffer' })
}

async function buildEpubWithImage() {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`)
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>带图书</dc:title>
    <dc:creator>作者乙</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="book-id">urn:uuid:456</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="ch1" href="chapter-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="img1" href="images/pic.png" media-type="image/png"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
  </spine>
</package>`)
  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:456"/></head>
  <docTitle><text>带图书</text></docTitle>
  <navMap>
    <navPoint id="n1" playOrder="1"><navLabel><text>一章</text></navLabel><content src="chapter-1.xhtml"/></navPoint>
  </navMap>
</ncx>`)
  zip.file('OEBPS/chapter-1.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body><p>配图</p><img src="images/pic.png"/></body></html>`)
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  zip.file('OEBPS/images/pic.png', Buffer.from(pngBase64, 'base64'), { binary: true })
  return await zip.generateAsync({ type: 'arraybuffer' })
}

describe('EPUB 图片导入', () => {
  it('把正文相对路径图片提取到书内图库并改写为 book-image 引用', async () => {
    const buf = await buildEpubWithImage()
    const book = await parseEpubFile(buf)
    expect(book.images).toHaveLength(1)
    const img = book.images[0]
    expect(img.type).toBe('image/png')
    expect(img.dataUrl).toContain('data:image/png;base64,')
    expect(book.chapters[0].content).toContain(`src="book-image://${img.id}"`)
  })
})

describe('EPUB 字体与 CSS 资源导入', () => {
  it('导入 CSS 并把字体文件收进书内资源库，CSS url 改写为资源引用', async () => {
    const buf = await buildEpubWithResources()
    const book = await parseEpubFile(buf)

    expect(book.resources).toHaveLength(1)
    const font = book.resources[0]
    expect(font.kind).toBe('font')
    expect(font.type).toBe('application/font-woff')
    expect(font.dataUrl).toContain('data:')
    expect(font.originalPath).toContain('fonts/test.woff')

    const css = book.styles.join('\n')
    expect(css).toContain('@font-face')
    expect(css).toContain(`book-resource://${font.id}`)
    expect(css).not.toContain('../fonts/test.woff')
  })

  it('导入的字体资源可完整导出，再导入仍保留', async () => {
    const book = await parseEpubFile(await buildEpubWithResources())
    const blob = await exportEpubFile(book, { download: false })
    const zip = await JSZip.loadAsync(blob)

    expect(zip.file('OEBPS/fonts/test.woff')).toBeTruthy()
    const css = await zip.file('OEBPS/styles.css').async('string')
    expect(css).toContain('url("fonts/test.woff")')

    const again = await parseEpubFile(blob)
    expect(again.resources).toHaveLength(1)
    expect(again.styles.join('\n')).toContain('book-resource://')
  })
})

describe('EPUB SVG 封面导入导出', () => {
  it('把 SVG <image xlink:href> 的封面收进图库并正确导出', async () => {
    const book = await parseEpubFile(await buildEpubWithSvgCover())

    expect(book.images).toHaveLength(1)
    const img = book.images[0]
    expect(book.chapters[0].content).toContain(`src="book-image://${img.id}"`)
    expect(book.chapters[0].content).not.toContain('<svg')

    const blob = await exportEpubFile(book, { download: false })
    const zip = await JSZip.loadAsync(blob)
    const ch = await zip.file('OEBPS/chapter-1.xhtml').async('string')
    expect(ch).toContain(`src="images/${img.filename}"`)
    expect(ch).not.toContain('book-image://')
    expect(ch).not.toContain('<svg')
    expect(zip.file(`OEBPS/images/${img.filename}`)).toBeTruthy()
  })
})

describe('EPUB 封面 MIME 归一化', () => {
  it('封面读取后以 image/jpeg 的 dataURL 存入 book.cover', async () => {
    const book = await parseEpubFile(await buildEpubWithCover())
    expect(book.cover).toMatch(/^data:image\/jpeg;base64,/)
  })
})

async function buildEpubWithoutContainer() {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>无 container</dc:title><dc:creator>作者</dc:creator><dc:language>zh-CN</dc:language><dc:identifier id="book-id">urn:uuid:no-container</dc:identifier></metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="ch1" href="chapter-1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx"><itemref idref="ch1"/></spine>
</package>`)
  zip.file('toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:no-container"/></head><docTitle><text>无 container</text></docTitle><navMap><navPoint id="n1" playOrder="1"><navLabel><text>第一章</text></navLabel><content src="chapter-1.xhtml"/></navPoint></navMap></ncx>`)
  zip.file('chapter-1.xhtml', `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><p>正文</p></body></html>`)
  return await zip.generateAsync({ type: 'arraybuffer' })
}

async function buildEpub3NavOnly() {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`)
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>EPUB3 nav</dc:title><dc:creator>作者</dc:creator><dc:language>zh-CN</dc:language><dc:identifier id="book-id">urn:uuid:nav3</dc:identifier></metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ch1" href="chapter-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter-2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="ch1"/><itemref idref="ch2"/></spine>
</package>`)
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="chapter-1.xhtml">第一章</a></li><li><a href="chapter-2.xhtml">第二章</a></li></ol></nav></body></html>`)
  zip.file('OEBPS/chapter-1.xhtml', `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><p>一</p></body></html>`)
  zip.file('OEBPS/chapter-2.xhtml', `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><p>二</p></body></html>`)
  return await zip.generateAsync({ type: 'arraybuffer' })
}

async function buildEpubWithMissingFiles() {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`)
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>缺文件书</dc:title><dc:creator>作者</dc:creator><dc:language>zh-CN</dc:language><dc:identifier id="book-id">urn:uuid:missing</dc:identifier></metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="ch1" href="chapter-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter-2.xhtml" media-type="application/xhtml+xml"/>
    <item id="img1" href="images/missing.png" media-type="image/png"/>
  </manifest>
  <spine toc="ncx"><itemref idref="ch1"/><itemref idref="ch2"/></spine>
</package>`)
  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:missing"/></head><docTitle><text>缺文件书</text></docTitle><navMap><navPoint id="n1" playOrder="1"><navLabel><text>第一章</text></navLabel><content src="chapter-1.xhtml"/></navPoint><navPoint id="n2" playOrder="2"><navLabel><text>第二章</text></navLabel><content src="chapter-2.xhtml"/></navPoint></navMap></ncx>`)
  zip.file('OEBPS/chapter-1.xhtml', `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><p>缺图</p><img src="images/missing.png"/></body></html>`)
  return await zip.generateAsync({ type: 'arraybuffer' })
}

describe('EPUB 容错导入', () => {
  it('没有 container.xml 时自动扫描 OPF 并导入', async () => {
    const book = await parseEpubFile(await buildEpubWithoutContainer())
    expect(book.title).toBe('无 container')
    expect(book.chapters).toHaveLength(1)
    expect(book.importWarnings.some((w) => /container/i.test(w))).toBe(true)
  })

  it('没有 NCX 时用 EPUB3 nav.xhtml 解析章节名', async () => {
    const book = await parseEpubFile(await buildEpub3NavOnly())
    expect(book.chapters.map((c) => c.title)).toEqual(['第一章', '第二章'])
    expect(book.importWarnings.some((w) => /NCX|nav/i.test(w))).toBe(true)
  })

  it('缺失章节文件和图片时不中断，并记录 warnings', async () => {
    const book = await parseEpubFile(await buildEpubWithMissingFiles())
    expect(book.chapters).toHaveLength(2)
    expect(book.chapters[1].content).toBe('')
    expect(book.importWarnings.some((w) => /缺少章节文件/.test(w))).toBe(true)
    expect(book.importWarnings.some((w) => /缺少图片/.test(w))).toBe(true)
  })
})
