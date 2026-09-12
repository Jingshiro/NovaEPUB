import { DOMSerializer, DOMParser } from '@tiptap/pm/model'

/** 模板的目标元素类型 → 默认包裹标签。 */
export const TARGET_TAGS = {
  heading: 'h1',
  paragraph: 'p',
  quote: 'blockquote',
  image: 'figure',
  list: 'ul',
  code: 'pre',
  custom: 'div',
}

/** 目标类型的可读名称。 */
export const TARGET_LABELS = {
  heading: '标题',
  paragraph: '正文',
  quote: '引用',
  image: '图片',
  list: '列表',
  code: '代码',
  custom: '自定义',
}

/**
 * 从模板 HTML 中提取 <style>...</style> 块，返回去 style 后的包裹结构 + 样式数组。
 * 兼容用户「一段 HTML + $1 占位符」的写法，也支持内嵌 style 定义类样式。
 */
export function splitTemplate(html) {
  const css = []
  let body = html || ''
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  body = body.replace(styleRe, (match, inner) => {
    if (inner && inner.trim()) css.push(inner.trim())
    return ''
  })
  return { html: body, css }
}

/**
 * 把 $1 占位符替换为选中内容。$1 可出现多次。
 */
export function wrapWithTemplate(html, selectedHtml) {
  const normalized = selectedHtml || ''
  return (html || '').split('$1').join(normalized)
}

/** 序列化当前选区为 HTML 字符串。空选区返回空字符串。 */
export function getSelectedHtml(editor) {
  if (!editor) return ''
  const { from, to, empty } = editor.state.selection
  if (empty) return ''
  const slice = editor.state.doc.slice(from, to)
  const serializer = DOMSerializer.fromSchema(editor.schema)
  const div = document.createElement('div')
  div.appendChild(serializer.serializeFragment(slice.content))
  return div.innerHTML
}

/** 根据目标类型给出默认包裹标签。 */
export function defaultTag(target) {
  return TARGET_TAGS[target] || 'div'
}

/**
 * 由可视化表单字段生成模板 HTML 片段（含 $1）。
 */
export function buildTemplateFromForm(form) {
  const styles = []
  if (form.fontSize) styles.push(`font-size:${form.fontSize}`)
  if (form.fontWeight) styles.push(`font-weight:${form.fontWeight}`)
  if (form.italic) styles.push('font-style:italic')
  if (form.color) styles.push(`color:${form.color}`)
  if (form.textAlign) styles.push(`text-align:${form.textAlign}`)
  if (form.background) styles.push(`background:${form.background}`)
  if (form.padding) styles.push(`padding:${form.padding}`)
  if (form.margin) styles.push(`margin:${form.margin}`)
  if (form.borderLeft) styles.push(`border-left:${form.borderLeft}`)
  if (form.lineHeight) styles.push(`line-height:${form.lineHeight}`)
  const style = styles.join(';')
  const tag = form.tag || defaultTag(form.target)
  const cls = form.className ? ` class="${form.className}"` : ''
  return `<${tag}${cls}${style ? ` style="${style}"` : ''}>$1</${tag}>`
}

/** 由模板 HTML 结构反推出可用于可视化表单的默认字段（供编辑回填）。 */
export function formFromTemplate(template) {
  return {
    id: template?.id || '',
    name: template?.name || '',
    target: template?.target || 'custom',
    tag: template?.tag || '',
    className: template?.className || '',
    fontSize: template?.fontSize || '',
    fontWeight: template?.fontWeight || '',
    italic: !!template?.italic,
    color: template?.color || '',
    textAlign: template?.textAlign || '',
    background: template?.background || '',
    padding: template?.padding || '',
    margin: template?.margin || '',
    borderLeft: template?.borderLeft || '',
    lineHeight: template?.lineHeight || '',
  }
}

/** 默认内置的若干模板（含 $1 占位符、内联样式）。 */
export const DEFAULT_TEMPLATES = [
  {
    name: '章节标题',
    target: 'heading',
    html: '<h1 style="font-size:2em;font-weight:700;margin:0 0 0.6em;line-height:1.4;color:#37352F;">$1</h1>',
  },
  {
    name: '正文',
    target: 'paragraph',
    html: '<p style="margin:0 0 1em;line-height:1.8;color:#37352F;">$1</p>',
  },
  {
    name: '强调引用',
    target: 'quote',
    html: '<blockquote style="margin:1em 0;padding:0.6em 1em;border-left:4px solid #E9E8E4;background:#F7F6F3;color:#787774;">$1</blockquote>',
  },
  {
    name: '图片·居中',
    target: 'image',
    html: '<figure style="margin:1em auto;text-align:center;max-width:100%;">$1</figure>',
  },
  {
    name: '图片·圆角',
    target: 'image',
    html: '<figure style="margin:1em auto;text-align:center;max-width:100%;"><span style="display:inline-block;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.08);">$1</span></figure>',
  },
  {
    name: '无序列表',
    target: 'list',
    html: '<ul style="padding-left:1.5em;margin:0 0 1em;color:#37352F;">$1</ul>',
  },
  {
    name: '代码块',
    target: 'code',
    html: '<pre style="background:#F7F6F3;padding:1em;border-radius:8px;overflow-x:auto;color:#37352F;"><code>$1</code></pre>',
  },
  {
    name: '首字下沉',
    target: 'paragraph',
    html: '<style>.dropcap::first-letter{float:left;font-size:3.2em;font-weight:700;line-height:1;padding-right:0.12em;color:#37352F;}</style><p class="dropcap" style="line-height:1.8;margin:0 0 1em;">$1</p>',
  },
  {
    name: '注释小字',
    target: 'paragraph',
    html: '<p style="font-size:0.85em;color:#787774;line-height:1.7;margin:0.5em 0;">$1</p>',
  },
  {
    name: '居中标题',
    target: 'heading',
    html: '<h2 style="font-size:1.4em;font-weight:700;text-align:center;margin:1em 0 0.6em;color:#37352F;">$1</h2>',
  },
]

/** 给默认模板补 id 与时间戳。 */
export function seedDefaultTemplates() {
  return DEFAULT_TEMPLATES.map((t, i) => ({
    id: `tpl-${i + 1}`,
    ...t,
    custom: false,
    updatedAt: new Date().toISOString(),
  }))
}

/** 将模板包样式注入到文档 head（供编辑器内 class 样式实时生效）。 */
export function injectTemplateCss(templateId, cssString) {
  if (!cssString || !document || !document.head) return
  const id = `tpl-style-${templateId}`
  let style = document.getElementById(id)
  if (!style) {
    style = document.createElement('style')
    style.id = id
    document.head.appendChild(style)
  }
  style.textContent = cssString
}

/** 计算套用模板时应替换的选区范围。 */
export function resolveApplyRange(editor, target) {
  const { from, to, $from, $to, empty } = editor.state.selection
  if (empty) return { from, to }
  const blockTargets = ['heading', 'paragraph', 'quote', 'list', 'code']
  if (blockTargets.includes(target) && $from.parent === $to.parent && $from.parent.isTextblock) {
    return { from: $from.start(), to: $from.end() }
  }
  return { from, to }
}

/**
 * 序列化当前光标所在文本块的内容（空选区套用时作为 $1）。
 */
export function getBlockHtml(editor) {
  if (!editor) return ''
  const { $from, $to } = editor.state.selection
  if (!$from.parent.isTextblock || $from.parent !== $to.parent) return ''
  const slice = editor.state.doc.slice($from.start(), $from.end())
  const serializer = DOMSerializer.fromSchema(editor.schema)
  const div = document.createElement('div')
  div.appendChild(serializer.serializeFragment(slice.content))
  return div.innerHTML
}

/**
 * 从模板 HTML 片段收集包裹层（figure/span 等非内容元素）的 class 与 style。
 * 图片模板的视觉样式通常写在 figure 外层或内层 span 上，套用到图片节点时
 * 需要把它们合并写到 img 本身（figure/span 不是 schema 节点，直接插入会被剥掉）。
 * 对图片无意义/有害的声明（display、text-align）会被丢弃。
 */
export function collectWrapperAttrs(htmlFragment) {
  const result = { class: '', style: '' }
  if (!htmlFragment || typeof document === 'undefined') return result
  const doc = new window.DOMParser().parseFromString(htmlFragment, 'text/html')
  const walk = (el) => {
    if (!el || el.nodeType !== 1) return
    const tag = el.tagName.toLowerCase()
    if (tag !== 'img' && tag !== 'br') {
      const cls = el.getAttribute('class')
      if (cls) result.class = (result.class ? result.class + ' ' : '') + cls
      const style = el.getAttribute('style')
      if (style) {
        style.split(';').forEach((decl) => {
          const idx = decl.indexOf(':')
          if (idx === -1) return
          const key = decl.slice(0, idx).trim().toLowerCase()
          const val = decl.slice(idx + 1).trim()
          if (!val || key === 'display' || key === 'text-align') return
          const full = `${key}:${val}`
          if (!result.style.includes(`${key}:`)) result.style = (result.style ? result.style + ';' : '') + full
        })
      }
    }
    Array.from(el.children || []).forEach(walk)
  }
  Array.from(doc.body.children || []).forEach(walk)
  return result
}

/**
 * 把模板套用到当前选区：提取 <style> 注入 head，替换 $1 为选中内容并插入。
 * - 块级模板 + 选区在单个文本块内（含空选区，即光标停在段内）：整块替换，
 *   $1 取选中内容或整块内容，文字不丢、样式落在块上。
 * - 图片模板 + 选中图片节点：把模板包裹层的 class/style 合并写到图片节点，
 *   规避 figure/span 被 schema 剥掉导致模板失效。
 * - 其余情况按选区插入。
 */
export function applyTemplateToEditor(editor, template, options = {}) {
  if (!editor) return false
  const { html, css } = splitTemplate(template.html)
  const selection = editor.state.selection
  const { empty } = selection
  const selectedHtml = getSelectedHtml(editor)
  const wrapped = wrapWithTemplate(html, selectedHtml)
  if (css.length) {
    const cssText = css.join('\n')
    injectTemplateCss(template.id, cssText)
    if (typeof options.onStyleCss === 'function') options.onStyleCss(cssText)
  }
  const blockTargets = ['heading', 'paragraph', 'quote', 'list', 'code']
  const inSingleTextblock =
    selection.$from.parent === selection.$to.parent && selection.$from.parent.isTextblock

  // 图片模板：选中图片节点时，样式直接写到图片上
  const selectedNode = selection.node
  if (selectedNode && selectedNode.type.name === 'image') {
    const attrs = collectWrapperAttrs(html)
    const patch = {}
    if (attrs.style) patch.style = attrs.style
    if (attrs.class) patch.class = attrs.class
    if (Object.keys(patch).length) {
      editor.chain().focus().updateAttributes('image', patch).run()
    }
    return true
  }

  if (inSingleTextblock && blockTargets.includes(template.target)) {
    // 空选区（光标停在段内）也按整块套用，$1 取整块内容，避免插入空样式块
    const contentHtml = empty ? getBlockHtml(editor) : selectedHtml
    const blockWrapped = wrapWithTemplate(html, contentHtml)
    const $from = selection.$from
    const nodePos = $from.before()
    const nodeSize = $from.parent.nodeSize
    editor
      .chain()
      .focus()
      .command(({ tr, dispatch, state }) => {
        const dom = new window.DOMParser().parseFromString(blockWrapped, 'text/html')
        const parsed = DOMParser.fromSchema(state.schema).parse(dom.body)
        tr.replaceWith(nodePos, nodePos + nodeSize, parsed.content)
        dispatch(tr)
        return true
      })
      .run()
  } else {
    const range = resolveApplyRange(editor, template.target)
    editor.chain().focus().insertContentAt(range, wrapped).run()
  }
  return true
}

/** 尝试从简单的「<tag style="...">$1</tag>」结构解析出可视化表单字段。 */
export function parseHtmlToForm(html, target) {
  const form = formFromTemplate({ id: '', name: '', target })
  if (!html) return form
  const match = html.match(/^<([a-zA-Z0-9]+)([^>]*)>([\s\S]*)<\/\1>\s*$/)
  if (!match) {
    form.html = html
    return form
  }
  const tag = match[1]
  const attrs = match[2]
  form.tag = tag
  const classMatch = attrs.match(/class="([^"]*)"/)
  if (classMatch) form.className = classMatch[1]
  const styleMatch = attrs.match(/style="([^"]*)"/)
  if (styleMatch) {
    const decls = {}
    styleMatch[1].split(';').forEach((pair) => {
      const idx = pair.indexOf(':')
      if (idx === -1) return
      const key = pair.slice(0, idx).trim()
      const val = pair.slice(idx + 1).trim()
      decls[key] = val
    })
    form.fontSize = decls['font-size'] || ''
    form.fontWeight = decls['font-weight'] || ''
    form.color = decls['color'] || ''
    form.textAlign = decls['text-align'] || ''
    form.background = decls['background'] || ''
    form.padding = decls['padding'] || ''
    form.margin = decls['margin'] || ''
    form.borderLeft = decls['border-left'] || ''
    form.lineHeight = decls['line-height'] || ''
    form.italic = (decls['font-style'] || '').includes('italic')
  }
  form.html = html
  return form
}
