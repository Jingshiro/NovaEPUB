import { createBook, createChapter, countWords } from '../stores/book'

/**
 * 轻量 TXT / Markdown 导入工具。
 * 不引入额外依赖：内置一个小型 Markdown 转换器，覆盖书籍常见语法。
 */

const CHAPTER_PATTERN = /^[ \t]*(第[一二三四五六七八九十百千万零0-9]+[章节回部卷集]|(?:chapter|CHAPTER|Chapter)\s+\d+)[^\n]{0,40}$/

/** 是否为可导入的纯文本文件。 */
export function isTextImportFile(file = {}) {
  const name = String(file.name || '').toLowerCase()
  return name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown') ||
    /^(text\/plain|text\/markdown|text\/x-markdown)$/.test(file.type || '')
}

/** 读取并解析 TXT / Markdown 文件，返回可直接存入 bookStore 的书籍对象。 */
export async function parseTextImportFile(file = {}) {
  const text = await readFileText(file)
  const baseName = String(file.name || '未命名')
    .replace(/\.[^.]+$/, '')
    .trim() || '未命名书籍'
  const lowerName = String(file.name || '').toLowerCase()
  return lowerName.endsWith('.md') || lowerName.endsWith('.markdown')
    ? parseMarkdown(text, { title: baseName })
    : parseTxt(text, { title: baseName })
}

function readFileText(file) {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result || '')
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

/** 解析 Markdown 文本。 */
export function parseMarkdown(md = '', options = {}) {
  const text = String(md || '').replace(/^\uFEFF/, '')
  const chapters = splitMarkdownChapters(text)
  const book = createBook({ title: options.title || '未命名书籍' })
  book.chapters = chapters.map(({ title, content }) => {
    const chapter = createChapter(title, markdownToHtml(content))
    chapter.wordCount = countWords(chapter.content)
    return chapter
  })
  if (!book.chapters.length) book.chapters.push(createChapter('第一章', markdownToHtml(text)))
  return book
}

/** 解析 TXT 文本。 */
export function parseTxt(text = '', options = {}) {
  const raw = String(text || '').replace(/^\uFEFF/, '')
  const chapters = splitTextChapters(raw)
  const book = createBook({ title: options.title || '未命名书籍' })
  book.chapters = chapters.map(({ title, content }) => {
    const chapter = createChapter(title, textToHtml(content))
    chapter.wordCount = countWords(chapter.content)
    return chapter
  })
  if (!book.chapters.length) book.chapters.push(createChapter('第一章', textToHtml(raw)))
  return book
}

/** 按「第X章 / Chapter N」切分 TXT。 */
export function splitTextChapters(text = '') {
  const lines = String(text).split(/\r?\n/)
  const result = []
  let current = null
  const flush = () => {
    if (current) {
      result.push({ title: current.title, content: current.body.join('\n') })
      current = null
    }
  }
  for (const line of lines) {
    const trimmed = line.trim()
    if (CHAPTER_PATTERN.test(trimmed)) {
      flush()
      current = { title: trimmed, body: [] }
    } else if (current) {
      current.body.push(line)
    } else {
      if (!result.length) current = { title: '前言', body: [line] }
      else result[result.length - 1].content = `${result[result.length - 1].content}\n${line}`
    }
  }
  flush()
  return result
}

/** 按 Markdown 一级标题切分章节；没有一级标题时整篇作为一章。 */
export function splitMarkdownChapters(md = '') {
  const lines = String(md).split(/\r?\n/)
  const result = []
  let current = null
  const prefix = []
  for (const line of lines) {
    const heading = line.match(/^#\s+(.+?)\s*#*\s*$/)
    if (heading) {
      if (current) {
        result.push({ title: current.title, content: current.content.join('\n') })
      } else if (prefix.some((l) => l.trim())) {
        result.push({ title: '前言', content: prefix.join('\n') })
      }
      current = { title: heading[1].trim(), content: [] }
    } else if (current) {
      current.content.push(line)
    } else {
      prefix.push(line)
    }
  }
  if (current) {
    result.push({ title: current.title, content: current.content.join('\n') })
  } else if (prefix.some((l) => l.trim())) {
    result.push({ title: '全文', content: prefix.join('\n') })
  }
  return result
}

/** 极简 Markdown → HTML（覆盖标题/段落/列表/引用/代码/粗斜体/链接/图片）。 */
export function markdownToHtml(md = '') {
  const text = String(md || '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  const html = []
  let i = 0
  let para = []
  let listType = null
  let listItems = []
  const flushPara = () => {
    if (!para.length) return
    html.push(`<p>${inlineToHtml(para.join(' '))}</p>`)
    para = []
  }
  const flushList = () => {
    if (!listItems.length) return
    const tag = listType === 'ol' ? 'ol' : 'ul'
    html.push(`<${tag}>${listItems.map((item) => `<li>${inlineToHtml(item)}</li>`).join('')}</${tag}>`)
    listItems = []
    listType = null
  }
  while (i < lines.length) {
    const line = lines[i]

    // 围栏代码块
    if (/^```/.test(line.trim())) {
      flushPara(); flushList()
      const block = []
      i += 1
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        block.push(lines[i])
        i += 1
      }
      html.push(`<pre><code>${escapeHtml(block.join('\n'))}</code></pre>`)
      i += 1
      continue
    }

    const trimmed = line.trim()
    if (!trimmed) {
      flushPara(); flushList()
      i += 1
      continue
    }

    // 标题
    const hm = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (hm) {
      flushPara(); flushList()
      const level = Math.min(6, Math.max(1, hm[1].length))
      html.push(`<h${level}>${inlineToHtml(hm[2])}</h${level}>`)
      i += 1
      continue
    }

    // 分割线
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushPara(); flushList()
      html.push('<hr/>')
      i += 1
      continue
    }

    // 引用
    if (/^>\s?/.test(trimmed)) {
      flushPara(); flushList()
      const quote = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''))
        i += 1
      }
      html.push(`<blockquote><p>${inlineToHtml(quote.join(' '))}</p></blockquote>`)
      continue
    }

    // 无序列表
    const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/)
    if (ulMatch) {
      flushPara()
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      listItems.push(ulMatch[1])
      i += 1
      continue
    }

    // 有序列表
    const olMatch = trimmed.match(/^\d+[.、)]\s+(.*)$/)
    if (olMatch) {
      flushPara()
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      listItems.push(olMatch[1])
      i += 1
      continue
    }

    flushList()
    para.push(trimmed)
    i += 1
  }
  flushPara(); flushList()
  return html.join('\n')
}

/** TXT 纯文本 → 段落 HTML。 */
export function textToHtml(text = '') {
  const raw = String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/^\uFEFF/, '')
  const blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  if (!blocks.length) return ''
  return blocks
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`)
    .join('\n')
}

/** 行内 Markdown 语法 → HTML。 */
export function inlineToHtml(text = '') {
  let out = escapeHtml(text)
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1"/>')
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  out = out.replace(/~~([^~]+)~~/g, '<s>$1</s>')
  out = out.replace(/(^|[\s(])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>')
  out = out.replace(/(^|[\s(])_([^_\s][^_]*?)_/g, '$1<em>$2</em>')
  return out
}

/** HTML 转义（用于把普通文本安全放进 HTML）。 */
export function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
