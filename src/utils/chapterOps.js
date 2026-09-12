import { DOMSerializer } from '@tiptap/pm/model'

/**
 * 在编辑器当前光标位置拆分章节内容。
 * 返回 { beforeHtml, afterHtml }；光标在文档起点/终点时返回 null。
 */
export function splitEditorContentAt(editor) {
  if (!editor) return null
  const { state } = editor
  const pos = state.selection.from
  const docSize = state.doc.content.size
  if (!Number.isInteger(pos) || pos <= 0 || pos >= docSize) return null

  const beforeNode = state.doc.cut(0, pos)
  const afterNode = state.doc.cut(pos)
  const serializer = DOMSerializer.fromSchema(state.schema)
  const beforeDiv = document.createElement('div')
  beforeDiv.appendChild(serializer.serializeFragment(beforeNode.content))
  const afterDiv = document.createElement('div')
  afterDiv.appendChild(serializer.serializeFragment(afterNode.content))
  return { beforeHtml: beforeDiv.innerHTML, afterHtml: afterDiv.innerHTML }
}

/** 合并多个 HTML 片段，去除首尾空白；空片段自动忽略。 */
export function mergeHtmlFragments(...parts) {
  const cleaned = parts.map((p) => String(p || '').trim()).filter(Boolean)
  return cleaned.join('\n')
}
