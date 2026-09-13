/**
 * HTML 结构块（htmlBlock）：导入 EPUB 时常伴随 TipTap schema 不认识的结构
 * （div 系容器、span 编排、figure 包裹等）。ProseMirror 解析这些未知结构时
 * 会把标签和 class 全部剥掉，只留纯文本——书内「内置排版 CSS」因此看起来
 * 像被去掉了。本模块在进入编辑器前，把这些未知顶层块整体封装为
 * `<div data-nova-html-block="<encoded html>"></div>` 占位；
 * TipTap 侧（tiptapHtmlBlock.js）由 htmlBlock 原子节点接管渲染，
 * contenteditable=false 保证结构不可被键入破坏，但可整体选中/删除/移动。
 *
 * 存储/导出/预览层语义：
 * - 存储层正文保留占位（renderHTML 自动输出）→ 体积小、自检易断
 * - 导出 / 预览 / 自检时用 expandHtmlBlocks 把占位还原为原始 HTML
 */

export const PLACEHOLDER_ATTR = 'data-nova-html-block'

/** TipTap 原生可表达的块级标签/结构，出现在顶层时不去封装。 */
const NATIVE_TOPLEVEL = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'blockquote', 'pre', 'hr',
  'table', 'img', 'br',
])

/**
 * 把 HTML 顶层里 TipTap 不认识的块级结构封装为占位 div。
 * 幂等：已封装的占位不会被二次处理；原生标签原样保留。
 * 深层嵌套结构整体保留原始 outerHTML（包括 class/内联样式/子元素）。
 */
export function embedHtmlBlocks(html = '') {
  if (!html || typeof document === 'undefined') return html
  const doc = new window.DOMParser().parseFromString(`<div id="nb-root">${html}</div>`, 'text/html')
  const root = doc.getElementById('nb-root')
  if (!root) return html
  let changed = false
  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType !== 1) return // 文本/注释不动
    const tag = node.tagName.toLowerCase()
    if (node.hasAttribute(PLACEHOLDER_ATTR)) return // 已是占位
    if (NATIVE_TOPLEVEL.has(tag)) return
    const outer = node.outerHTML
    const holder = doc.createElement('div')
    holder.setAttribute(PLACEHOLDER_ATTR, encodeURIComponent(outer))
    node.parentNode?.replaceChild(holder, node)
    changed = true
  })
  if (!changed) return html
  return root.innerHTML
}

/**
 * 把占位 div 还原为原始 HTML（导出 / 预览 / 自检前调用）。
 * 幂等：文本里没有占位时原样返回。
 */
export function expandHtmlBlocks(html = '') {
  if (!html || html.indexOf(PLACEHOLDER_ATTR) === -1) return html
  const re = new RegExp(`<div ${PLACEHOLDER_ATTR}="([\\s\\S]*?)"[\\s\\S]*?<\\/div>`, 'g')
  return String(html).replace(re, (match, encoded) => {
    try {
      return decodeURIComponent(encoded)
    } catch {
      return match
    }
  })
}

/** 是否包含占位（快速判断）。 */
export function hasHtmlBlocks(html = '') {
  return !!html && String(html).indexOf(PLACEHOLDER_ATTR) !== -1
}
