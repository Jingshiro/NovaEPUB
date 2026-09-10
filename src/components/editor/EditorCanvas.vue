<template>
  <div ref="editorContainer" class="relative flex h-full flex-col" @contextmenu="onContextMenu">
    <div class="mb-3 shrink-0">
      <EditorMenuBar :editor="editorStore.editor" />
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="prose max-w-none">
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
      :templates="templateStore.templates"
      @select="applyTemplate"
      @manage="emit('manageTemplates')"
      @close="closeTemplateMenu"
    />
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { useEditorStore } from '../../stores/editor'
import { useBookStore } from '../../stores/book'
import { useTemplateStore } from '../../stores/templates'
import { applyTemplateToEditor, injectTemplateCss } from '../../utils/template'
import { fileToCompressedDataUrl, normalizeContentImages, resolveContentImages } from '../../utils/image'
import EditorMenuBar from './EditorMenuBar.vue'
import BlockPicker from './BlockPicker.vue'
import TemplatePalette from './TemplatePalette.vue'

const props = defineProps({
  chapter: { type: Object, default: null },
})
const emit = defineEmits(['manageTemplates'])

const editorStore = useEditorStore()
const bookStore = useBookStore()
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

useEditor({
  content: resolveContentImages(bookStore.activeBook || {}, props.chapter?.content || ''),
  extensions: [
    StarterKit,
    Placeholder.configure({ placeholder: '空章节 · 输入正文，或键入 “/” 查看块类型' }),
    Image.configure({ inline: false, allowBase64: true }),
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
  const coords = ed.view.coordsAtPos(from)
  const rect = ed.view.dom.getBoundingClientRect()
  templateMenuPos.value = {
    x: Math.max(0, coords.left - rect.left),
    y: Math.max(0, coords.bottom - rect.top + 2),
  }
  showTemplateMenu.value = true
}

function applyTemplate(tpl) {
  applyTemplateToEditor(editorStore.editor, tpl, {
    onStyleCss: (css) => bookStore.addTemplateStyles(css),
  })
  closeTemplateMenu()
}

function closeTemplateMenu() {
  showTemplateMenu.value = false
}

// 切换到新章节时更新编辑器内容（不触发更新写入）
watch(
  () => props.chapter?.id,
  (newId, oldId) => {
    if (!editorStore.editor) return
    if (newId !== oldId) {
      const html = resolveContentImages(bookStore.activeBook || {}, props.chapter?.content || '')
      editorStore.editor.commands.setContent(html, false)
    }
  },
)

function injectBookStyles(book) {
  const styles = book?.styles || []
  styles.forEach((css, i) => {
    if (css) injectTemplateCss(`book-style-${i}`, css)
  })
}

// 书内已固化的模板样式要注入编辑器 head，保证刷新/切章后 class 样式仍生效
watch(
  () => bookStore.activeBook?.styles,
  (styles) => {
    if (Array.isArray(styles)) injectBookStyles(bookStore.activeBook)
  },
  { immediate: true, deep: true },
)

onBeforeUnmount(() => {
  editorStore.setEditor(null)
})
</script>

<style>
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
.prose .ProseMirror {
  min-height: 60vh;
}
.prose .ProseMirror img {
  cursor: pointer;
}
</style>
