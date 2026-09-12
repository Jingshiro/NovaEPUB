import { Extension } from '@tiptap/core'

/**
 * 全局 class/style 属性扩展（2026-09-12 修复）。
 *
 * 背景：TipTap 默认 schema 会剥掉节点上未声明的属性。格式模板套用时插入的
 * `<p style="..." class="...">` / `<blockquote style="...">` 一进编辑器就被
 * 剥成裸标签——模板的「可视化」部分（内联样式、类名）在编辑器、存储、预览、
 * 导出全链路失效（例如「首字下沉」固化进 book.styles 的 CSS 因正文没有
 * class="dropcap" 钩子而永不命中）。
 *
 * 通过 GlobalAttributes 为常用块级节点与图片声明 class/style 属性：
 * - parseHTML：从 DOM 读取属性；
 * - renderHTML：有值时输出，无值不输出（不影响既有内容序列化）。
 */
const STYLEABLE_TYPES = [
  'paragraph',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'codeBlock',
  'listItem',
  'tableCell',
  'tableHeader',
  'image',
]

export const StyleAttributes = Extension.create({
  name: 'styleAttributes',

  addGlobalAttributes() {
    return [
      {
        types: STYLEABLE_TYPES,
        attributes: {
          class: {
            default: null,
            parseHTML: (element) => element.getAttribute('class'),
            renderHTML: (attributes) => (attributes.class ? { class: attributes.class } : {}),
          },
          style: {
            default: null,
            parseHTML: (element) => element.getAttribute('style'),
            renderHTML: (attributes) => (attributes.style ? { style: attributes.style } : {}),
          },
        },
      },
    ]
  },
})

export default StyleAttributes
