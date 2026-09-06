// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { parseEpubFile } from '../epubParser'

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
