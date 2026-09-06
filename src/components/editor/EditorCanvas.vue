<template>
  <div ref="editorContainer" class="relative flex h-full flex-col">
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
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEditorStore } from '../../stores/editor'
import { useBookStore } from '../../stores/book'
import EditorMenuBar from './EditorMenuBar.vue'
import BlockPicker from './BlockPicker.vue'

const props = defineProps({
  chapter: { type: Object, default: null },
})

const editorStore = useEditorStore()
const bookStore = useBookStore()

const editorContainer = ref(null)
const showBlockMenu = ref(false)
const menuPos = ref({ x: 0, y: 0 })

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

// useEditor 返回 shallowRef，编辑器实例通过 onCreate 写入 store
useEditor({
  content: props.chapter?.content || '',
  extensions: [StarterKit, Placeholder.configure({ placeholder: '空章节 · 输入正文，或键入 “/” 查看块类型' })],
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
  },
  onUpdate: ({ editor }) => {
    handleEditorUpdate(editor)
    checkSlash(editor)
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
  const html = ed.getHTML()
  bookStore.saveChapterContent(props.chapter.id, html)
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
  // 删除当前文本块内的 '/' 占位内容
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

// 切换到新章节时更新编辑器内容（不触发更新写入）
watch(
  () => props.chapter?.id,
  (newId, oldId) => {
    if (!editorStore.editor) return
    if (newId !== oldId) {
      editorStore.editor.commands.setContent(props.chapter?.content || '', false)
    }
  },
)

onBeforeUnmount(() => {
  editorStore.setEditor(null)
})
</script>

<style>
.prose {
  font-size: 1rem;
  line-height: 1.8;
  color: #1e1e1e;
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
  border-left: 3px solid #d4a373;
  margin: 1em 0;
  padding: 0.5em 1em;
  color: #6b6b6b;
  background: #fbfbfb;
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
.prose .ProseMirror {
  min-height: 60vh;
}
</style>
