<template>
  <div v-if="editor" class="flex flex-wrap items-center gap-1 rounded-card border border-line bg-bg-card px-2 py-1.5">
    <button class="tool" :class="{ active: editor.isActive('bold') }" title="加粗" @mousedown.prevent @click="editor.chain().focus().toggleBold().run()">
      <b>B</b>
    </button>
    <button class="tool" :class="{ active: editor.isActive('italic') }" title="斜体" @mousedown.prevent @click="editor.chain().focus().toggleItalic().run()">
      <i>I</i>
    </button>
    <button class="tool" :class="{ active: editor.isActive('strike') }" title="删除线" @mousedown.prevent @click="editor.chain().focus().toggleStrike().run()">
      <s>S</s>
    </button>
    <button class="tool" :class="{ active: editor.isActive('underline') }" title="下划线" @mousedown.prevent @click="editor.chain().focus().toggleUnderline().run()">
      <u>U</u>
    </button>
    <button class="tool" :class="{ active: editor.isActive('subscript') }" title="下标" @mousedown.prevent @click="editor.chain().focus().toggleSubscript().run()">
      <sub>₂</sub>
    </button>
    <button class="tool" :class="{ active: editor.isActive('superscript') }" title="上标" @mousedown.prevent @click="editor.chain().focus().toggleSuperscript().run()">
      <sup>²</sup>
    </button>
    <button class="tool" :class="{ active: editor.isActive('link') }" title="插入/编辑链接" @mousedown.prevent @click="setOrEditLink">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 0 0 7.07 0l3.18-3.18a5 5 0 0 0-7.07-7.07L11.3 4.6" stroke-linecap="round"/><path d="M14 11a5 5 0 0 0-7.07 0l-3.19 3.18a5 5 0 0 0 7.08 7.08l1.87-1.88" stroke-linecap="round"/></svg>
    </button>
    <button v-if="editor.isActive('link')" class="tool" title="移除链接" @mousedown.prevent @click="editor.chain().focus().unsetLink().run()">
      ✗
    </button>
    <span class="mx-1 h-4 w-px bg-line"></span>
    <button class="tool" :class="{ active: editor.isActive('heading', { level: 1 }) }" title="标题1" @mousedown.prevent @click="editor.chain().focus().toggleHeading({ level: 1 }).run()">H1</button>
    <button class="tool" :class="{ active: editor.isActive('heading', { level: 2 }) }" title="标题2" @mousedown.prevent @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
    <button class="tool" :class="{ active: editor.isActive('heading', { level: 3 }) }" title="标题3" @mousedown.prevent @click="editor.chain().focus().toggleHeading({ level: 3 }).run()">H3</button>
    <button class="tool" :class="{ active: editor.isActive('blockquote') }" title="引用" @mousedown.prevent @click="editor.chain().focus().toggleBlockquote().run()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 7h10v10H7zM7 12h10" stroke-linecap="round"/></svg>
    </button>
    <button class="tool" :class="{ active: editor.isActive('bulletList') }" title="无序列表" @mousedown.prevent @click="editor.chain().focus().toggleBulletList().run()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke-linecap="round"/></svg>
    </button>
    <button class="tool" :class="{ active: editor.isActive('orderedList') }" title="有序列表" @mousedown.prevent @click="editor.chain().focus().toggleOrderedList().run()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 6h11M10 12h11M10 18h11M4 4v6M4 4l2 1M4 13h2v3H4M4 18h2v3H4" stroke-linecap="round"/></svg>
    </button>
    <button class="tool" :class="{ active: editor.isActive('codeBlock') }" title="代码块" @mousedown.prevent @click="editor.chain().focus().toggleCodeBlock().run()">
      &lt;/&gt;
    </button>
    <span class="mx-1 h-4 w-px bg-line"></span>
    <button class="tool" title="插入图片" @mousedown.prevent @click="pickImage">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="M21 15l-5-5L5 20" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <button
      class="tool"
      :class="{ active: editor.isActive('table') }"
      title="插入 3×3 表格"
      @mousedown.prevent
      @click="editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 4v16" /></svg>
    </button>
    <template v-if="editor.isActive('table')">
      <button class="tool" title="上方插入一行" @mousedown.prevent @click="editor.chain().focus().addRowBefore().run()">+行↑</button>
      <button class="tool" title="下方插入一行" @mousedown.prevent @click="editor.chain().focus().addRowAfter().run()">+行↓</button>
      <button class="tool" title="左侧插入一列" @mousedown.prevent @click="editor.chain().focus().addColumnBefore().run()">+列←</button>
      <button class="tool" title="右侧插入一列" @mousedown.prevent @click="editor.chain().focus().addColumnAfter().run()">+列→</button>
      <button class="tool" title="删除当前行" @mousedown.prevent @click="editor.chain().focus().deleteRow().run()">-行</button>
      <button class="tool" title="删除当前列" @mousedown.prevent @click="editor.chain().focus().deleteColumn().run()">-列</button>
      <button class="tool" title="切换表头行" :class="{ active: editor.isActive('tableHeader') }" @mousedown.prevent @click="editor.chain().focus().toggleHeaderRow().run()">表头</button>
      <button class="tool" title="删除整个表格" @mousedown.prevent @click="editor.chain().focus().deleteTable().run()">删表</button>
    </template>
    <span class="mx-1 h-4 w-px bg-line"></span>
    <button class="tool" title="在当前光标处拆分章节" @mousedown.prevent @click="emit('split-chapter')">拆分</button>
    <button class="tool" title="与下一章合并" @mousedown.prevent @click="emit('merge-chapter')">合并↓</button>
    <span class="mx-1 h-4 w-px bg-line"></span>
    <button class="tool" :disabled="!canUndo" title="撤销 (Ctrl+Z)" @mousedown.prevent @click="undo">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <button class="tool" :disabled="!canRedo" title="重做 (Ctrl+Y / Ctrl+Shift+Z)" @mousedown.prevent @click="redo">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { fileToCompressedDataUrl } from '../../utils/image'
import { useHistoryStore } from '../../stores/history'

const props = defineProps({
  editor: { type: Object, default: null },
})
const emit = defineEmits(['split-chapter', 'merge-chapter'])
const fileInput = ref(null)
const historyStore = useHistoryStore()
const editorCanUndo = ref(false)
const editorCanRedo = ref(false)

const canUndo = computed(() => historyStore.canUndo || editorCanUndo.value)
const canRedo = computed(() => historyStore.canRedo || editorCanRedo.value)

function syncEditorHistory() {
  if (!props.editor) {
    editorCanUndo.value = false
    editorCanRedo.value = false
    return
  }
  editorCanUndo.value = props.editor.can().undo()
  editorCanRedo.value = props.editor.can().redo()
}

function undo() {
  // 优先撤销最近的正文编辑；没有正文历史时再撤销章节/元数据等结构操作
  if (editorCanUndo.value && props.editor) {
    props.editor.chain().focus().undo().run()
    return
  }
  if (historyStore.canUndo) {
    historyStore.undo()
  }
}

function redo() {
  if (editorCanRedo.value && props.editor) {
    props.editor.chain().focus().redo().run()
    return
  }
  if (historyStore.canRedo) {
    historyStore.redo()
  }
}

function onKeydown(e) {
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.classList?.contains('ProseMirror')) return
  const key = e.key.toLowerCase()
  if (key === 'z') {
    e.preventDefault()
    if (e.shiftKey) redo()
    else undo()
  } else if (key === 'y') {
    e.preventDefault()
    redo()
  }
}

watch(
  () => props.editor,
  (editor, oldEditor) => {
    if (oldEditor) oldEditor.off('transaction', syncEditorHistory)
    if (editor) {
      syncEditorHistory()
      editor.on('transaction', syncEditorHistory)
    }
  },
  { immediate: true },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  props.editor?.off('transaction', syncEditorHistory)
})

function pickImage() {
  fileInput.value?.click()
}

async function onFileChange(e) {
  const file = e.target.files?.[0]
  if (file && props.editor) {
    const src = await fileToCompressedDataUrl(file)
    props.editor.chain().focus().setImage({ src }).run()
  }
  e.target.value = ''
}

/** 插入/编辑链接：当前有链接时预填原地址。 */
function setOrEditLink() {
  const editor = props.editor
  if (!editor) return
  const previous = editor.getAttributes('link').href || ''
  const url = window.prompt('输入链接地址（留空移除链接）：', previous)
  if (url === null) return // 取消
  const trimmed = url.trim()
  if (!trimmed) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  const normalized = /^(https?:\/\/|mailto:|#)/i.test(trimmed) ? trimmed : `https://${trimmed}`
  // 编辑既有链接时选区可能塌缩，先扩展 mark 范围再设置
  editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run()
}
</script>

<style scoped>
.tool {
  @apply flex items-center justify-center rounded-btn px-2 py-1 text-xs text-ink-secondary hover:bg-bg-muted hover:text-ink transition-colors;
}
.tool.active {
  @apply bg-accent/10 text-accent;
}
.tool:disabled {
  @apply cursor-not-allowed opacity-40 hover:bg-transparent hover:text-ink-secondary;
}
</style>
