import { createBook, createChapter, countWords } from '../stores/book'

/**
 * 轻量 TXT / Markdown 导入工具。
 * 不引入额外依赖：内置一个小型 Markdown 转换器，覆盖书籍常见语法。
 */

// 章节标题行的判定。
//
// 曾经写成 `(第X章|Chapter N)[^\n]{0,40}`，尾部允许跟 40 个任意字符：
// 正文里任何以「第二章」开头的句子（如「第二章的正文开始。ABC…」）都会被
// 当成标题，正文被切碎错位，导入后看起来就是乱码。
//
// 现在只认真正的标题形态：标记之后只能是空、或一个「短标题」。
//   第一章                      → 标题
//   第一章 山间来客              → 标题
//   第十二章：归来                → 标题
//   第 3 章  开端                → 标题
//   Chapter 1                   → 标题
//   Chapter 1 Introduction      → 标题
//   第二章的正文开始。ABC…        → 正文（无分隔符 / 句末标点 / 过长）
//
// 组成：
//   NUM        编号：阿拉伯或中文数字
//   CN_MARKER  「第 X 章/节/回/部/卷/集」
//   EN_MARKER  「Chapter N」（必须带空格和数字，避免命中 Chapter one 之外的正文）
//   TITLE_TAIL 可选后缀：一个分隔符后跟不含句末标点的短标题
const CHAPTER_NUM = '[0-9０-９一二三四五六七八九十百千万零两]+'
const CHAPTER_PATTERN = new RegExp(
  '^[ \\t]*' +
    '(?:' +
      `第\\s*${CHAPTER_NUM}\\s*[章节回部卷集]` + // 中文标记
      '|' +
      '(?:[Cc]hapter|CHAPTER)\\s+\\d+' +          // 英文标记
    ')' +
    '(?:[\\s:：、.．·—\\-]+[^。！？!?；;\\n]{1,20})?' + // 可选的短标题
    '[ \\t]*$',
)

/** 是否为可导入的纯文本文件。 */
export function isTextImportFile(file = {}) {
  const name = String(file.name || '').toLowerCase()
  return name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown') ||
    /^(text\/plain|text\/markdown|text\/x-markdown)$/.test(file.type || '')
}

/**
 * 读取并解析 TXT / Markdown 文件，返回可直接存入 bookStore 的书籍对象。
 *
 * 注意：这里必须自己读字节再解码，不能用 file.text() / FileReader.readAsText()。
 * 那两个 API 固定按 UTF-8 解码，遇到 GBK/GB18030 的中文 TXT（中文 Windows 上
 * 记事本「ANSI」另存就是）会把每个汉字拆成非法字节序列，产生满屏 U+FFFD
 * 替换字符，用户看到的就是「乱码」。
 */
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

/** 取出文件字节（优先 arrayBuffer，回退 FileReader）。 */
async function readFileBytes(file) {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer())
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result || new ArrayBuffer(0)))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 按 BOM 探测编码。返回 { encoding, offset }，无 BOM 时返回 null。
 * UTF-16/UTF-32 的 BOM 必须优先处理，否则会被当成乱码。
 */
function detectBom(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { encoding: 'utf-8', offset: 3 }
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    // FF FE 也可能是 UTF-32LE 的前两字节，用第三四字节区分
    if (bytes.length >= 4 && bytes[2] === 0x00 && bytes[3] === 0x00) {
      return { encoding: 'utf-32le', offset: 4 }
    }
    return { encoding: 'utf-16le', offset: 2 }
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { encoding: 'utf-16be', offset: 2 }
  }
  return null
}

/**
 * 解码文本字节：BOM → UTF-8 严格校验 → GB18030 → 宽松 UTF-8 兜底。
 *
 * 关键点：
 * - UTF-8 必须用 { fatal: true } 校验。不带 fatal 时非法字节会被静默替换成
 *   U+FFFD 而不抛错，GBK 文件会被「成功」解出一堆乱码，探测就失去意义了。
 * - GB18030 覆盖 GBK/GB2312，是中文非 UTF-8 文本的通用回退。
 * - 若 GB18030 也失败（环境不支持），退回宽松 UTF-8，保证总有结果。
 */
export function decodeTextBytes(bytes) {
  const bytesArr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || [])
  if (bytesArr.length === 0) return ''

  const bom = detectBom(bytesArr)
  if (typeof TextDecoder === 'undefined') {
    // 极端环境没有 TextDecoder：只能逐字节按 latin1 拼，至少不抛错
    let out = ''
    for (let i = bom ? bom.offset : 0; i < bytesArr.length; i += 1) out += String.fromCharCode(bytesArr[i])
    return out
  }

  if (bom) {
    try {
      return new TextDecoder(bom.encoding, { fatal: true }).decode(bytesArr.subarray(bom.offset))
    } catch {
      /* BOM 声称的编码不可用时继续往下探测 */
    }
  }

  const body = bom ? bytesArr.subarray(bom.offset) : bytesArr

  // 1) 优先 UTF-8 严格校验：能通过就说明确实是 UTF-8
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body)
  } catch {
    /* 不是合法 UTF-8，继续 */
  }

  // 2) 回退 GB18030（覆盖 GBK / GB2312），中文 TXT 的主要来源
  try {
    return new TextDecoder('gb18030', { fatal: true }).decode(body)
  } catch {
    /* 环境不支持或内容不属于该编码 */
  }

  // 3) 最后兜底：宽松 UTF-8，绝不抛错
  return new TextDecoder('utf-8').decode(body)
}

/** 读取文件正文文本，自动处理 UTF-8 / GBK / UTF-16 等常见编码。 */
async function readFileText(file) {
  const bytes = await readFileBytes(file)
  return decodeTextBytes(bytes)
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

/**
 * 判断一行文本是否为章节标题（供 splitTextChapters 与测试使用）。
 * 前后空白会被忽略。
 */
export function isChapterTitle(line = '') {
  return CHAPTER_PATTERN.test(String(line).trim())
}

/** 整行只有 1~4 位数字（允许全角数字与前后全角/半角空白）。 */
const BARE_NUMBER_PATTERN = /^[\s\u3000]*[0-9０-９]{1,4}[\s\u3000]*$/

/**
 * 认定「这本书用纯数字做章节」所需的最少命中行数。
 * 门槛设高一些，避免正文里偶然出现的递增数字被当成章节标记。
 */
const MIN_BARE_HEADINGS = 3

/** 把整行数字转成 Number（全角数字先归一化）。返回 null 表示不是纯数字行。 */
function parseBareNumber(line = '') {
  const s = String(line).trim()
  if (!BARE_NUMBER_PATTERN.test(s)) return null
  const normalized = s
    .replace(/[\u3000\s]/g, '')
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/**
 * 找出「纯数字成行」的章节标记下标。
 *
 * 为什么不能只看「是不是数字」：正文里也会出现独立成行的数字（日期、页码、
 * 电话、金额…）。只按数字判定会重蹈之前正则过宽的覆辙——把正文切碎。
 *
 * 真正的章节编号总是从 1 附近开始、逐个递增、并且数量不少。因此要求同时满足：
 * 1. 整行只有 1~4 位数字（全角也可以）；
 * 2. 命中行能组成一条递增序列：起点 ≤ 3，之后每步递增 1~3（容忍漏章）；
 * 3. 命中的行数 ≥ MIN_BARE_HEADINGS。真书章节通常很多，这个门槛能把
 *    「正文里碰巧有两行递增数字」的情况挡掉。
 *
 * 任何一条不满足就整本不启用纯数字切章，宁可切成前言也不要切碎正文。
 *
 * @returns {Set<number>} 命中行的下标集合
 */
export function findBareNumberHeadings(lines = []) {
  const candidates = []
  lines.forEach((line, index) => {
    const n = parseBareNumber(line)
    if (n !== null) candidates.push({ index, n })
  })
  if (candidates.length < MIN_BARE_HEADINGS) return new Set()

  // 在当前候选序列里找最长的一条递增链（起点 ≤ 3，每步递增 1~3）
  let best = []
  let current = []
  for (const item of candidates) {
    if (!current.length) {
      if (item.n <= 3) current = [item]
      continue
    }
    const prev = current[current.length - 1]
    if (item.n > prev.n && item.n - prev.n <= 3) {
      current.push(item)
    } else {
      if (current.length > best.length) best = current
      current = item.n <= 3 ? [item] : []
    }
  }
  if (current.length > best.length) best = current

  if (best.length < MIN_BARE_HEADINGS) return new Set()
  return new Set(best.map((item) => item.index))
}

/**
 * 按「第X章 / Chapter N / 纯数字行」切分 TXT。
 *
 * 纯数字行必须在同一本书里构成递增序列才会被认作章节（见
 * findBareNumberHeadings），避免把正文里偶然独立成行的数字当成标题。
 */
export function splitTextChapters(text = '') {
  const lines = String(text).split(/\r?\n/)
  const bareHeadings = findBareNumberHeadings(lines)
  const result = []
  let current = null
  const flush = () => {
    if (current) {
      result.push({ title: current.title, content: current.body.join('\n') })
      current = null
    }
  }
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    const isBare = bareHeadings.has(index)
    if (isChapterTitle(trimmed) || isBare) {
      flush()
      current = { title: trimmed, body: [] }
    } else if (current) {
      current.body.push(line)
    } else {
      if (!result.length) current = { title: '前言', body: [line] }
      else result[result.length - 1].content = `${result[result.length - 1].content}\n${line}`
    }
  })
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
