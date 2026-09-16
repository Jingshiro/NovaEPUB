import { Node } from '@tiptap/core'
import { useBookStore } from '../stores/book'
import { resolveContentImages } from './image'
import { resolveContentResources } from './resource'
import { PLACEHOLDER_ATTR } from './htmlBlock'

/**
 * htmlBlock：schema 外任意 HTML 结构的「原子落块」。
 * - attrs.html 保存 encodeURIComponent 后的原始 HTML；
 * - nodeView 以 contenteditable=false 渲染原样结构（书内排版 CSS 可命中
 *   其中的 class，图片引用 book-image:// 在渲染时回填 dataURL）；
 * - 用户可整体选中 / 删除 / 拖动 / 分割时保留，无法键入破坏内部结构；
 * - getHTML 仍输出占位 div（renderHTML），存储层/导出层无需感知。
 */
export const HtmlBlock = Node.create({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      html: {
        default: '',
        parseHTML: (el) => el.getAttribute(PLACEHOLDER_ATTR) || '',
        renderHTML: (attrs) => (attrs.html ? { [PLACEHOLDER_ATTR]: attrs.html } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: `div[${PLACEHOLDER_ATTR}]` }]
  },

  renderHTML({ node }) {
    return ['div', { [PLACEHOLDER_ATTR]: node.attrs.html, class: 'nova-html-block' }]
  },

  addNodeView() {
    return ({ node }) => {
      const container = document.createElement('div')
      container.classList.add('nova-html-block-view')
      container.setAttribute('contenteditable', 'false')
      container.dataset.novaHtmlBlock = node.attrs.html || ''

      const render = () => {
        try {
          const raw = decodeURIComponent(node.attrs.html || '')
          const bookStore = useBookStore()
          const book = bookStore.activeBook || {}
          container.innerHTML = resolveContentResources(book, resolveContentImages(book, raw))
        } catch (err) {
          container.textContent = '[无法解析的 HTML 块]'
          console.warn('[htmlBlock] 渲染失败', err)
        }
      }
      render()

      return {
        dom: container,
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) return false
          if (updatedNode.attrs.html === node.attrs.html && container.dataset.novaHtmlBlock === node.attrs.html) {
            return true
          }
          node = updatedNode
          container.dataset.novaHtmlBlock = node.attrs.html || ''
          render()
          return true
        },
        ignoreMutation: () => true, // 内部内容是只读视图
      }
    }
  },

  addStorage() {
    return {
      /** 编辑入口：把占位还原，让用户在弹窗里编辑原始 HTML。 */
      decodeAttr(html = '') {
        try {
          return decodeURIComponent(html || '')
        } catch {
          return html
        }
      },
    }
  },
})

export default HtmlBlock
