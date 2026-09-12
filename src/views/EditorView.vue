<template>
  <div class="flex h-screen flex-col bg-bg">
    <!-- 顶部工具栏 -->
    <header class="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-bg-card px-6">
      <div class="flex min-w-0 items-center gap-3">
        <button class="btn-ghost !px-2" title="返回书架" @click="goLibrary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M15 18 9 12l6-6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="min-w-0 truncate text-base font-medium text-ink hover:text-accent transition-colors" @click="uiStore.openMetadataModal()">
          {{ book.title || '未命名书籍' }}
        </button>
        <button class="btn-ghost !px-2" title="书籍信息" @click="uiStore.openMetadataModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- 编辑/预览切换 -->
      <div class="flex items-center rounded-btn border border-line bg-bg-muted p-0.5">
        <button
          class="rounded-btn px-4 py-1.5 text-sm transition-colors"
          :class="!uiStore.previewMode ? 'bg-bg-card text-ink shadow-card' : 'text-ink-secondary hover:text-ink'"
          @click="setPreview(false)"
        >编辑</button>
        <button
          class="rounded-btn px-4 py-1.5 text-sm transition-colors"
          :class="uiStore.previewMode ? 'bg-bg-card text-ink shadow-card' : 'text-ink-secondary hover:text-ink'"
          @click="setPreview(true)"
        >预览</button>
      </div>

      <div class="flex items-center gap-2">
        <button class="btn-secondary hidden sm:block" @click="findReplaceOpen = true">
          查找替换
        </button>
        <button class="btn-secondary" @click="uiStore.toggleSidebar()">
          目录
        </button>
        <button class="btn-secondary hidden md:block lg:hidden" @click="uiStore.togglePanel()">
          样式
        </button>
        <button class="btn-primary" @click="exportBook">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="hidden sm:inline">导出 EPUB</span><span class="sm:hidden">导出</span>
        </button>
      </div>
    </header>

    <!-- 三栏主体：窄屏时左右面板浮层化 -->
    <div class="flex flex-1 overflow-hidden">
      <aside
        v-show="!uiStore.sidebarCollapsed"
        class="w-60 shrink-0 border-r border-line bg-bg-muted max-lg:absolute max-lg:inset-y-14 max-lg:left-0 max-lg:z-30 max-lg:w-64 max-lg:shadow-card"
      >
        <ChapterTree />
      </aside>

      <main class="min-w-0 flex-1 overflow-hidden">
        <div class="h-full overflow-auto px-3 py-4 lg:px-8 lg:py-6">
          <div v-show="!uiStore.previewMode" class="h-full">
            <EditorCanvas :chapter="activeChapter" @manage-templates="openTemplateEditor(null)" />
          </div>
          <div v-show="uiStore.previewMode" class="h-full">
            <MobilePreviewFrame :book="book" :chapter="activeChapter" :templates="effectiveTemplates" />
          </div>
        </div>
      </main>

      <aside
        v-show="uiStore.stylePanelOpen"
        class="w-[280px] shrink-0 flex flex-col border-l border-line bg-bg-muted max-lg:absolute max-lg:inset-y-14 max-lg:right-0 max-lg:z-30 max-lg:w-72 max-lg:shadow-card"
      >
        <section class="min-h-0 flex-1 overflow-hidden">
          <StylePanel @add="(scope) => openTemplateEditor(null, scope)" @edit="(tpl, scope) => openTemplateEditor(tpl, scope)" />
        </section>
        <section class="shrink-0 border-t border-line">
          <MetadataPanel @export="exportBook" />
        </section>
      </aside>
    </div>

    <BookMetadataModal />
    <FindReplaceModal :open="findReplaceOpen" @close="findReplaceOpen = false" />
    <TemplateEditorModal :open="templateModalOpen" :template="editingTemplate" @close="closeTemplateEditor" @save="handleTemplateSave" />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useBookStore } from '../stores/book'
import { useEditorStore } from '../stores/editor'
import { useUiStore } from '../stores/ui'
import { useTemplateStore } from '../stores/templates'
import { useHistoryStore } from '../stores/history'
import { useEpubExporter } from '../hooks/useEpubExporter'
import { flushDraftSaves } from '../utils/draft'
import { checkEpubStructure } from '../utils/epubCheck'
import ChapterTree from '../components/sidebar/ChapterTree.vue'
import MetadataPanel from '../components/sidebar/MetadataPanel.vue'
import EditorCanvas from '../components/editor/EditorCanvas.vue'
import MobilePreviewFrame from '../components/preview/MobilePreviewFrame.vue'
import BookMetadataModal from '../components/editor/BookMetadataModal.vue'
import TemplateEditorModal from '../components/editor/TemplateEditorModal.vue'
import FindReplaceModal from '../components/editor/FindReplaceModal.vue'
import StylePanel from '../components/sidebar/StylePanel.vue'

const props = defineProps({ bookId: { type: String, required: true } })
const router = useRouter()
const bookStore = useBookStore()
const editorStore = useEditorStore()
const uiStore = useUiStore()
const templateStore = useTemplateStore()
const historyStore = useHistoryStore()

const book = computed(() => bookStore.activeBook || {})
const activeChapter = computed(() => editorStore.activeChapter)
/** 实际生效的模板：本书书内模板优先，否则全局模板池（B2）。 */
const effectiveTemplates = computed(() => templateStore.effectiveTemplates(bookStore.activeBook?.id))
const { exportBook: doExport } = useEpubExporter()

const templateModalOpen = ref(false)
const editingTemplate = ref(null)
const editingScope = ref('global')
const findReplaceOpen = ref(false)

templateStore.ensureLoaded()

function openTemplateEditor(tpl, scope = 'global') {
  editingTemplate.value = tpl || null
  editingScope.value = scope === 'book' ? 'book' : 'global'
  templateModalOpen.value = true
}

function closeTemplateEditor() {
  templateModalOpen.value = false
}

function handleTemplateSave(payload) {
  if (editingScope.value === 'book' && bookStore.activeBook) {
    const bookId = bookStore.activeBook.id
    if (payload.id) {
      templateStore.updateBookTemplate(bookId, payload.id, payload)
    } else {
      templateStore.addBookTemplate(bookId, payload)
    }
  } else if (payload.id) {
    templateStore.updateTemplate(payload.id, payload)
  } else {
    templateStore.addTemplate(payload)
  }
  closeTemplateEditor()
}

onMounted(() => {
  bookStore.migrateLibrary()
  const loaded = bookStore.loadBook(props.bookId)
  if (!loaded) {
    router.replace({ name: 'library' })
    return
  }
  historyStore.reset()
  // 默认选中第一个章节
  if (!editorStore.activeChapterId || !loaded.chapters.some((c) => c.id === editorStore.activeChapterId)) {
    editorStore.setActiveChapter(loaded.chapters[0]?.id || null)
  }
  window.addEventListener('beforeunload', flushDraftSaves)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', flushDraftSaves)
  flushDraftSaves()
})

// 预览模式锁定画布
watch(
  () => uiStore.previewMode,
  (mode) => {
    editorStore.editor?.setEditable(!mode)
  },
)

function setPreview(mode) {
  uiStore.setPreviewMode(mode)
}

function goLibrary() {
  uiStore.setPreviewMode(false)
  router.push({ name: 'library' })
}

async function exportBook() {
  if (!book.value) return
  const report = checkEpubStructure(book.value, { templates: effectiveTemplates.value })
  if (report.errors.length) {
    const lines = report.errors.slice(0, 10).map((e) => `- ${e.message}`)
    const more = report.errors.length > 10 ? `\n… 以及另外 ${report.errors.length - 10} 个问题` : ''
    window.alert(`导出前自检未通过，请先修复以下 ${report.errors.length} 个问题：\n\n${lines.join('\n')}${more}`)
    return
  }
  if (report.warnings.length) {
    const lines = report.warnings.slice(0, 8).map((e) => `- ${e.message}`)
    const more = report.warnings.length > 8 ? `\n… 以及另外 ${report.warnings.length - 8} 条` : ''
    if (!window.confirm(`导出前发现 ${report.warnings.length} 条提示，仍要导出吗？\n\n${lines.join('\n')}${more}`)) {
      return
    }
  }
  try {
    await doExport(book.value, { templates: effectiveTemplates.value })
  } catch (err) {
    console.error(err)
    window.alert('导出失败：' + (err.message || err))
  }
}
</script>
