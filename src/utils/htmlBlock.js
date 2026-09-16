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
 * 无语义包装层：EpubPress / 网页转 EPUB 常见
 * `<div id="s1"></div><div><div id="postscript"><p>…</p></div></div>`
 * 这类 div 没有 class/style，若整块进 htmlBlock 会变成 contenteditable=false，
 * 正文光标点不进去。识别后在封装前拆开，让 p/h 等原生块直接可编辑。
 */
const TRANSPARENT_WRAPPERS = new Set(['div', 'section', 'article', 'main', 'header', 'footer', 'aside'])

function isTransparentWrapper(el) {
  if (!el || el.nodeType !== 1) return false
  const tag = el.tagName.toLowerCase()
  if (!TRANSPARENT_WRAPPERS.has(tag)) return false
  if (el.hasAttribute('class') || el.hasAttribute('style')) return false
  // 除 id 外还有其它属性（onclick、data-* 等）则保守整块保留
  for (const attr of Array.from(el.attributes || [])) {
    if (attr.name.toLowerCase() !== 'id') return false
  }
  return true
}

/** 递归拆掉透明包装层，把子节点提升到父级。返回是否发生过拆包。 */
function unwrapTransparentWrappers(root) {
  let changed = false
  let again = true
  while (again) {
    again = false
    const candidates = Array.from(root.querySelectorAll('*'))
    for (const el of candidates) {
      if (el === root || !el.isConnected) continue
      if (!isTransparentWrapper(el)) continue
      const parent = el.parentNode
      if (!parent) continue
      while (el.firstChild) parent.insertBefore(el.firstChild, el)
      parent.removeChild(el)
      changed = true
      again = true
      break
    }
  }
  return changed
}

/**
 * 把 HTML 顶层里 TipTap 不认识的块级结构封装为占位 div。
 * 先拆透明包装层（无 class/style 的 div 等），再封装真正复杂的结构。
 * 幂等：已封装的占位不会被二次处理；原生标签原样保留。
 * 深层嵌套结构整体保留原始 outerHTML（包括 class/内联样式/子元素）。
 */
export function embedHtmlBlocks(html = '') {
  if (!html || typeof document === 'undefined') return html
  const doc = new window.DOMParser().parseFromString(`<div id="nb-root">${html}</div>`, 'text/html')
  const root = doc.getElementById('nb-root')
  if (!root) return html
  let changed = unwrapTransparentWrappers(root)
  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType !== 1) return // 文本/注释不动
    const tag = node.tagName.toLowerCase()
    if (node.hasAttribute(PLACEHOLDER_ATTR)) return // 已是占位
    if (NATIVE_TOPLEVEL.has(tag)) return
    // 拆包后仍可能剩下带 class 的复杂容器 → 整块进 htmlBlock
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
