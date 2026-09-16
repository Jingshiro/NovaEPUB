<template>
  <div
    ref="editorContainer"
    class="novaepub-canvas relative flex h-full flex-col"
    @contextmenu="onContextMenu"
    @touchstart="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchEnd"
  >
    <div class="mb-3 shrink-0 select-none">
      <EditorMenuBar :editor="editorStore.editor" @split-chapter="splitCurrentChapter" @merge-chapter="mergeCurrentChapter" />
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="prose max-w-none novaepub-editor-scope">
        <EditorContent :editor="editorStore.editor" class="min-h-[50vh] outline-none" />
      </div>
    </div>

    <BlockPicker
      :visible="showBlockMenu"
      :x="menuPos.x"
      :y="menuPos.y"
      :options="blockOptions"
      @select="applyBlock"
    />

    <TemplatePalette
      :visible="showTemplateMenu"
      :x="templateMenuPos.x"
      :y="templateMenuPos.y"
      :templates="paletteTemplates"
      @select="applyTemplate"
      @manage="emit('manageTemplates')"
      @close="closeTemplateMenu"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { useEditorStore } from '../../stores/editor'
import { useBookStore } from '../../stores/book'
import { useHistoryStore } from '../../stores/history'
import { useTemplateStore } from '../../stores/templates'
import { applyTemplateToEditor, injectTemplateCss } from '../../utils/template'
import { scopeCss } from '../../utils/cssScope'
import { embedHtmlBlocks } from '../../utils/htmlBlock'
import { HtmlBlock } from '../../utils/tiptapHtmlBlock'
import { StyleAttributes } from '../../utils/tiptapStyleAttrs'
import { fileToCompressedDataUrl, normalizeContentImages, resolveContentImages } from '../../utils/image'
import { splitEditorContentAt } from '../../utils/chapterOps'
import EditorMenuBar from './EditorMenuBar.vue'
import BlockPicker from './BlockPicker.vue'
import TemplatePalette from './TemplatePalette.vue'

const props = defineProps({
  chapter: { type: Object, default: null },
})
const emit = defineEmits(['manageTemplates'])

const editorStore = useEditorStore()
const bookStore = useBookStore()
const historyStore = useHistoryStore()
const templateStore = useTemplateStore()
templateStore.ensureLoaded()

const editorContainer = ref(null)
const showBlockMenu = ref(false)
const menuPos = ref({ x: 0, y: 0 })
const showTemplateMenu = ref(false)
const templateMenuPos = ref({ x: 0, y: 0 })

const blockOptions = [
  { type: 'paragraph', label: '正文', icon: '¶' },
  { type: 'h1', label: '标题 1', icon: 'H1' },
  { type: 'h2', label: '标题 2', icon: 'H2' },
  { type: 'h3', label: '标题 3', icon: 'H3' },
  { type: 'quote', label: '引用', icon: '❝' },
  { type: 'bulletList', label: '无序列表', icon: '•' },
  { type: 'orderedList', label: '有序列表', icon: '1.' },
  { type: 'codeBlock', label: '代码块', icon: '</>' },
]

/** 右键套用菜单用：本书书内模板优先，否则全局模板池（B2）。 */
const paletteTemplates = computed(() =>
  templateStore.effectiveTemplates(bookStore.activeBook?.id),
)

useEditor({
  content: loadEditorHtml(props.chapter?.content || ''),
  extensions: [
    StarterKit,
    Placeholder.configure({ placeholder: '空章节 · 输入正文，或键入 “/” 查看块类型' }),
    Image.configure({ inline: false, allowBase64: true }),
    // 格式模板的 class/style 属性存活（否则套用即被 schema 剥掉）
    StyleAttributes,
    // schema 外 HTML 结构的原子落块（导入书内置排版不被剥光）
    HtmlBlock,
    // C3：链接 / 表格 / 行内格式扩展
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: null, target: null, class: null } }),
    Underline,
    Subscript,
    Superscript,
    Table.configure({ resizable: false }),
    TableRow,
    TableCell,
    TableHeader,
  ],
  editorProps: {
    attributes: {
      class: 'focus:outline-none',
    },
    // 粘贴纯文本自动清理格式（清除 MS Word 带来的垃圾标记）
    transformPastedText: (text) => text,
    transformPastedHTML: (html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      return doc.body.textContent || ''
    },
    // 粘贴剪贴板图片（截图）直接插入
    handlePaste: (view, event) => {
      const items = event.clipboardData?.items
      if (!items) return false
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            event.preventDefault()
            fileToCompressedDataUrl(file).then((src) => {
              editorStore.editor?.chain().focus().setImage({ src }).run()
            })
            return true
          }
        }
      }
      return false
    },
  },
  onUpdate: ({ editor }) => {
    handleEditorUpdate(editor)
    checkSlash(editor)
    closeTemplateMenu()
  },
  onSelectionUpdate: ({ editor }) => {
    checkSlash(editor)
  },
  onCreate: ({ editor }) => {
    editorStore.setEditor(editor)
  },
})

/**
 * 编辑器显示 HTML 的统一入口：
 * 1) schema 外的整块 HTML 结构封装为 htmlBlock 原子节点（幂等，兼容老数据）；
 * 2) 章节里的书内图片/资源引用回填为可显示的 dataURL。
 */
function loadEditorHtml(content = '') {
  const book = bookStore.activeBook || {}
  return resolveContentImages(book, embedHtmlBlocks(content))
}

function handleEditorUpdate(ed) {
  if (!props.chapter) return
  const book = bookStore.activeBook
  const html = ed.getHTML()
  const original = props.chapter.content || ''
  const looksEmpty = !html || !html.trim() || /^<p>\s*<\/p>$/.test(html.trim())
  // 保护图片封面页：如果原内容里有图片/书内图片引用，而编辑器突然给出空段落，
  // 很可能是初始化/切换章节时的误清空，不能覆盖原内容。
  if (looksEmpty && original && original !== '<p></p>' && /<img|book-image:\/\//i.test(original)) {
    return
  }
  const normalized = normalizeContentImages(book, html)
  bookStore.saveChapterContent(props.chapter.id, normalized)
}

function checkSlash(ed) {
  if (!ed) return
  const { state } = ed
  const { selection } = state
  if (!selection.empty) {
    showBlockMenu.value = false
    return
  }
  const $pos = selection.$from
  const parent = $pos.parent
  if (parent.type.name === 'paragraph' && parent.textContent === '/') {
    const coords = ed.view.coordsAtPos(selection.from)
    const rect = ed.view.dom.getBoundingClientRect()
    menuPos.value = {
      x: Math.max(0, coords.left - rect.left),
      y: Math.max(0, coords.bottom - rect.top + 2),
    }
    showBlockMenu.value = true
  } else {
    showBlockMenu.value = false
  }
}

function applyBlock(type) {
  const ed = editorStore.editor
  if (!ed) return
  const { $from } = ed.state.selection
  const start = $from.start()
  const end = $from.end()
  ed.chain().focus().deleteRange({ from: start, to: end }).run()
  const commands = {
    paragraph: () => ed.chain().focus().setParagraph().run(),
    h1: () => ed.chain().focus().setHeading({ level: 1 }).run(),
    h2: () => ed.chain().focus().setHeading({ level: 2 }).run(),
    h3: () => ed.chain().focus().setHeading({ level: 3 }).run(),
    quote: () => ed.chain().focus().toggleBlockquote().run(),
    bulletList: () => ed.chain().focus().toggleBulletList().run(),
    orderedList: () => ed.chain().focus().toggleOrderedList().run(),
    codeBlock: () => ed.chain().focus().toggleCodeBlock().run(),
  }
  commands[type]?.()
  showBlockMenu.value = false
}

function onContextMenu(e) {
  const ed = editorStore.editor
  if (!ed) return
  const { from, empty } = ed.state.selection
  const hasSelection = !empty || !!ed.state.selection.node
  if (!hasSelection) return
  e.preventDefault()
  showTemplateMenuAt(from)
}

/** 在指定正文位置弹出模板菜单。 */
function showTemplateMenuAt(pos) {
  const ed = editorStore.editor
  if (!ed) return
  const coords = ed.view.coordsAtPos(pos)
  const rect = ed.view.dom.getBoundingClientRect()
  templateMenuPos.value = {
    x: Math.max(0, coords.left - rect.left),
    y: Math.max(0, coords.bottom - rect.top + 2),
  }
  showTemplateMenu.value = true
}

// ---- 移动端长按套用模板 ----
// 移动浏览器 contextmenu 触发不稳定，用 touchstart 计时显式识别长按。
// 长按期间浏览器原生会拉起文本选择，长按结束时若已有选区则直接弹模板菜单。
const LONG_PRESS_MS = 500
let longPressTimer = null
let longPressFired = false
let longPressStartPos = null

function onTouchStart(e) {
  if (e.touches.length !== 1) return
  const touch = e.touches[0]
  longPressFired = false
  longPressStartPos = { x: touch.clientX, y: touch.clientY }
  clearTimeout(longPressTimer)
  longPressTimer = setTimeout(() => {
    longPressFired = true
    onLongPress(e)
  }, LONG_PRESS_MS)
}

function onTouchMove(e) {
  if (!longPressStartPos || !e.touches.length) return
  const touch = e.touches[0]
  const dx = touch.clientX - longPressStartPos.x
  const dy = touch.clientY - longPressStartPos.y
  // 手指移动超过阈值视为滚动，取消长按
  if (dx * dx + dy * dy > 100) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function onTouchEnd() {
  clearTimeout(longPressTimer)
  longPressTimer = null
}

function onLongPress() {
  const ed = editorStore.editor
  if (!ed) return
  // 长按会让浏览器进入原生选择模式，稍等一拍让选区稳定后再检查
  setTimeout(() => {
    const edNow = editorStore.editor
    if (!edNow) return
    const { from, to, empty } = edNow.state.selection
    const hasSelection = !empty || !!edNow.state.selection.node
    if (!hasSelection || from === to) {
      // 没有形成选区时，尝试选中长按位置所在的词，方便直接套用
      const pos = edNow.state.selection.from
      try {
        const $pos = edNow.state.doc.resolve(pos)
        const start = $pos.start()
        const end = $pos.end()
        if (end > start) {
          edNow.chain().setTextSelection({ from: start, to: end }).run()
          showTemplateMenuAt(start)
        }
      } catch {
        /* 位置无效时忽略 */
      }
      return
    }
    showTemplateMenuAt(from)
  }, 80)
}

function applyTemplate(tpl) {
  applyTemplateToEditor(editorStore.editor, tpl, {
    onStyleCss: (css) => bookStore.addTemplateStyles(css),
  })
  closeTemplateMenu()
}

function splitCurrentChapter() {
  const ed = editorStore.editor
  const chapter = props.chapter
  if (!ed || !chapter) return
  const parts = splitEditorContentAt(ed)
  if (!parts) {
    window.alert('请把光标移到需要拆分的正文中间位置')
    return
  }
  historyStore.capture('拆分章节')
  const newChapter = bookStore.splitChapter(chapter.id, parts.beforeHtml, parts.afterHtml)
  if (newChapter) editorStore.setActiveChapter(newChapter.id)
}

function mergeCurrentChapter() {
  const chapter = props.chapter
  if (!chapter) return
  const chapters = bookStore.activeBook?.chapters || []
  const idx = chapters.findIndex((c) => c.id === chapter.id)
  if (idx === -1 || idx >= chapters.length - 1) {
    window.alert('当前已经是最后一章，无法向后合并')
    return
  }
  historyStore.capture('合并章节')
  bookStore.mergeNextChapter(chapter.id)
  const updated = bookStore.getChapter(chapter.id)
  if (editorStore.editor && updated) {
    editorStore.editor.commands.setContent(loadEditorHtml(updated.content || ''), false)
  }
}

function closeTemplateMenu() {
  showTemplateMenu.value = false
}

// 章节变化或编辑器就绪时，把当前章节内容加载进编辑器（不触发更新写入）。
// 必须同时等章节 id、editor、资产水合三者就绪：首次进入编辑器时父组件
// onMounted 才设置 activeChapterId，资产 dataURL 在 IndexedDB 水合完成前
// 还是空的——watch 需要在水合完成后重跑一次，图片才显示了。
watch(
  [() => props.chapter?.id, () => !!editorStore.editor, () => bookStore.assetsLoaded],
  () => {
    const chapter = props.chapter
    if (!chapter || !editorStore.editor) return
    const html = loadEditorHtml(chapter.content || '')
    editorStore.editor.commands.setContent(html, false)
  },
  { immediate: true },
)

function injectBookStyles(book) {
  const styles = book?.styles || []
  // 书内 CSS 的选择器（body/p/.class 等）是全局的，原样注入会改掉整个应用布局。
  // 必须先限定到编辑器内容容器（.novaepub-editor-scope）之下；
  // 预览走 iframe 天然隔离、导出组装时使用原始样式，都不受影响。
  styles.forEach((css, i) => {
    const scoped = scopeCss(css, '.novaepub-editor-scope')
    if (scoped) injectTemplateCss(`book-style-${i}`, scoped)
  })
}

// 书内已固化的模板样式要注入编辑器 head，保证刷新/切章后 class 样式仍生效
watch(
  () => bookStore.activeBook?.styles,
  () => {
    if (bookStore.activeBook) injectBookStyles(bookStore.activeBook)
  },
  { immediate: true, deep: true },
)

onBeforeUnmount(() => {
  clearTimeout(longPressTimer)
  editorStore.setEditor(null)
})
</script>

<style>
/*
 * 编辑区必须显式声明「可选中」。
 *
 * 背景：外层容器曾经用 select-none（user-select: none）。该属性会被继承，
 * 一路盖到 contenteditable="true" 的 .ProseMirror 上。iOS Safari 对可编辑区
 * 被标记为不可选中极其敏感——点上去落不下光标、拖选失灵；桌面端与 Android
 * 容忍度高，因此表现为「只有 iPhone 用户反馈编辑区点不进去」。
 *
 * 现在改为：容器不再 select-none（工具栏单独 select-none），并在编辑区显式
 * 打开 user-select:text，避免任何祖先样式再次把它关掉。
 */
.novaepub-editor-scope,
.novaepub-editor-scope .ProseMirror {
  -webkit-user-select: text;
  user-select: text;
}

/* iOS 点击时的灰色高亮块会干扰落光标的观感，编辑区去掉 */
.novaepub-editor-scope .ProseMirror {
  -webkit-tap-highlight-color: transparent;
}

.prose {
  font-size: 1rem;
  line-height: 1.8;
  color: #37352f;
}
.prose p {
  margin: 0 0 1em 0;
}
.prose h1 {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 1.2em 0 0.6em;
}
.prose h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 1.1em 0 0.5em;
}
.prose h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1em 0 0.5em;
}
.prose blockquote {
  border-left: 3px solid #e9e8e4;
  margin: 1em 0;
  padding: 0.5em 1em;
  color: #787774;
  background: #f7f6f3;
}
.prose ul,
.prose ol {
  padding-left: 1.5em;
  margin: 0 0 1em;
}
.prose code {
  background: #f4f4f4;
  border-radius: 4px;
  padding: 0.1em 0.4em;
  font-size: 0.9em;
}
.prose pre {
  background: #f4f4f4;
  border-radius: 8px;
  padding: 1em;
  overflow-x: auto;
}
.prose figure {
  margin: 1em 0;
  text-align: center;
}
.prose img {
  max-width: 100%;
  height: auto;
}
.prose a {
  color: #37352f;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.prose table {
  border-collapse: collapse;
  margin: 1em 0;
  max-width: 100%;
  font-size: 0.95em;
}
.prose th,
.prose td {
  border: 1px solid #e9e8e4;
  padding: 0.4em 0.7em;
  text-align: left;
  vertical-align: top;
}
.prose th {
  background: #f7f6f3;
  font-weight: 600;
}
.prose .selectedCell:after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(55, 53, 47, 0.08);
  pointer-events: none;
}
.prose th,
.prose td {
  position: relative;
}
.prose .ProseMirror {
  min-height: 60vh;
}
.prose .ProseMirror img {
  cursor: pointer;
}
</style>
