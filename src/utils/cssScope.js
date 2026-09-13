/**
 * CSS 作用域改写：把书内导入的样式限定在指定选择器（编辑器内容容器）之下。
 *
 * 背景：导入 EPUB 时书内 CSS 会整体汇入 book.styles。这些样式里的
 * `body { ... }`、`p { ... }`、`.class { ... }` 都是全局选择器——如果原样
 * 注入主页面 <head>，会把整个 NovaEpub 应用的布局一起改掉（实测 EPUB
 * 里的 body margin 会直接顶开三栏编辑器）。
 *
 * 改写规则：
 * - `body` / `html` / `:root` 选择器 → 映射为 scope 容器本身
 * - 普通选择器前加 `${scope} ` 后代前缀
 * - @media 内部规则递归改写；@font-face / @keyframes / @namespace 原样保留
 *   （@font-face 的字体名是全局注册，无选择器可限定；@namespace 对 HTML 无效但无害）
 */

export function scopeCss(css = '', scope = '.novaepub-editor-scope') {
  const text = String(css || '')
  if (!text.trim()) return ''
  return transformBlock(text, scope)
}

/** 把一段 CSS 文本里的规则改写进 scope。 */
function transformBlock(css, scope) {
  let out = ''
  let i = 0
  const len = css.length
  while (i < len) {
    const ch = css[i]

    // 空白/其他散字符原样透传，保证后面的 '@' 能被精确识别
    if (ch !== '@' && ch !== '{' && ch !== '}' && /\s/.test(ch)) {
      out += ch
      i += 1
      continue
    }

    if (ch === '@') {
      const braceStart = css.indexOf('{', i)
      // 找语句型 at-rule（@namespace/@import/@charset 等，以 ; 结尾，没有块）
      const semi = css.indexOf(';', i)
      if (semi !== -1 && (braceStart === -1 || semi < braceStart)
        && !/\/\*[\s\S]*?\*\//.test(css.slice(i, semi))) {
        out += css.slice(i, semi + 1)
        i = semi + 1
        continue
      }
      if (braceStart === -1) {
        out += css.slice(i)
        break
      }
      const atRule = css.slice(i, braceStart).trim()
      const blockEnd = findBlockEnd(css, braceStart)
      const inner = css.slice(braceStart + 1, blockEnd)
      if (isMediaAtRule(atRule)) {
        out += `${atRule}{${transformBlock(inner, scope)}}`
      } else {
        // @font-face / @keyframes / @namespace 等原样保留
        out += `${atRule}{${inner}}`
      }
      i = blockEnd + 1
      continue
    }

    // 普通规则：selector { body }
    const braceStart = css.indexOf('{', i)
    if (braceStart === -1) {
      out += css.slice(i)
      break
    }
    const selectorRaw = css.slice(i, braceStart).trim()
    const blockEnd = findBlockEnd(css, braceStart)
    const body = css.slice(braceStart + 1, blockEnd)
    if (selectorRaw) {
      const scoped = scopeSelector(selectorRaw, scope)
      out += `${scoped}{${body}}`
    } else {
      out += `${css.slice(i, blockEnd + 1)}`
    }
    i = blockEnd + 1
  }
  return out
}

function scopeSelector(selectorText, scope) {
  return selectorText
    .split(',')
    .map((selOriginal) => {
      const sel = selOriginal.trim()
      if (!sel) return ''
      if (sel === 'body' || sel === 'html' || sel === ':root') return scope
      if (sel.startsWith('body ') || sel.startsWith('html ')) {
        return `${scope} ${sel.replace(/^(body|html)\s+/, '')}`
      }
      // 已经带 scope 意味着内部递归不再叠加
      return `${scope} ${sel}`
    })
    .filter(Boolean)
    .join(', ')
}

function isMediaAtRule(header) {
  return /@media(?![\w-])/.test(header)
}

/** 从 { 开始找匹配的 }（忽略注释里的花括号过于复杂，按嵌套计数即可）。 */
function findBlockEnd(css, braceStart) {
  let depth = 0
  for (let i = braceStart; i < css.length; i++) {
    const ch = css[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return css.length - 1
}
