/**
 * 全局查找替换工具。
 * 基于 DOM 文本节点替换，保留原有 HTML 标签/样式；不触碰属性与脚本。
 */

export function escapeRegExp(text = '') {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function regexFor(findText, caseSensitive = false) {
  return new RegExp(escapeRegExp(findText), caseSensitive ? 'g' : 'gi')
}

/** 在纯文本中替换所有匹配项，返回 { text, count }。若 findText 为空则原样返回。 */
export function replaceInText(text = '', findText = '', replaceText = '', options = {}) {
  if (!findText) return { text, count: 0 }
  const re = regexFor(findText, !!options.caseSensitive)
  const matches = String(text).match(re)
  return {
    text: String(text).replace(re, () => replaceText),
    count: matches ? matches.length : 0,
  }
}

/** 统计纯文本中的匹配次数。 */
export function countMatchesInText(text = '', findText = '', options = {}) {
  if (!findText) return 0
  const matches = String(text).match(regexFor(findText, !!options.caseSensitive))
  return matches ? matches.length : 0
}

function getTextNodes(root) {
  if (typeof document === 'undefined' || !root) return []
  const nodes = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) nodes.push(node)
  return nodes
}

/** 在 HTML 片段的所有文本节点中替换，返回 { html, count }。 */
export function replaceAllInHtml(html = '', findText = '', replaceText = '', options = {}) {
  if (!findText || typeof document === 'undefined') return { html, count: 0 }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const nodes = getTextNodes(doc.body)
  let count = 0
  for (const node of nodes) {
    const result = replaceInText(node.nodeValue, findText, replaceText, options)
    if (result.count > 0) {
      node.nodeValue = result.text
      count += result.count
    }
  }
  return { html: doc.body.innerHTML, count }
}

/** 统计 HTML 文本节点中的匹配次数。 */
export function countMatchesInHtml(html = '', findText = '', options = {}) {
  if (!findText || typeof document === 'undefined') return 0
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return getTextNodes(doc.body).reduce(
    (sum, node) => sum + countMatchesInText(node.nodeValue, findText, options),
    0,
  )
}

/**
 * 在整本书中查找匹配数。
 * @returns {{ total: number, content: number, titles: number }}
 */
export function countInBook(book = {}, findText = '', options = {}) {
  if (!findText) return { total: 0, content: 0, titles: 0 }
  const chapters = Array.isArray(book.chapters) ? book.chapters : []
  let content = 0
  let titles = 0
  for (const ch of chapters) {
    content += countMatchesInHtml(ch.content || '', findText, options)
    if (options.includeTitles !== false) titles += countMatchesInText(ch.title || '', findText, options)
  }
  return { total: content + titles, content, titles }
}

/**
 * 在整本书中替换，直接修改传入的 book（章节 content 与标题）。
 * @returns {{ count: number, modifiedChapterIds: string[], modifiedTitles: number }}
 */
export function replaceAllInBook(book = {}, findText = '', replaceText = '', options = {}) {
  if (!findText || !Array.isArray(book.chapters)) return { count: 0, modifiedChapterIds: [], modifiedTitles: 0 }
  let count = 0
  const modifiedChapterIds = []
  let modifiedTitles = 0
  for (const ch of book.chapters) {
    const contentResult = replaceAllInHtml(ch.content || '', findText, replaceText, options)
    if (contentResult.count > 0) {
      ch.content = contentResult.html
      count += contentResult.count
      modifiedChapterIds.push(ch.id)
    }
    if (options.includeTitles !== false && ch.title) {
      const titleResult = replaceInText(ch.title, findText, replaceText, options)
      if (titleResult.count > 0) {
        ch.title = titleResult.text
        modifiedTitles += titleResult.count
        count += titleResult.count
      }
    }
  }
  return { count, modifiedChapterIds, modifiedTitles }
}