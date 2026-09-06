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
        <button class="btn-secondary" @click="uiStore.toggleSidebar()">
          目录
        </button>
        <button class="btn-primary" @click="exportBook">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          导出 EPUB
        </button>
      </div>
    </header>

    <!-- 三栏主体 -->
    <div class="flex flex-1 overflow-hidden">
      <aside v-show="!uiStore.sidebarCollapsed" class="w-60 shrink-0 border-r border-line bg-bg-muted">
        <ChapterTree />
      </aside>

      <main class="min-w-0 flex-1 overflow-hidden">
        <div class="h-full overflow-auto px-8 py-6">
          <div v-show="!uiStore.previewMode" class="h-full">
            <EditorCanvas :chapter="activeChapter" @manage-templates="openTemplateEditor(null)" />
          </div>
          <div v-show="uiStore.previewMode" class="h-full">
            <MobilePreviewFrame :book="book" :chapter="activeChapter" :templates="templateStore.templates" />
          </div>
        </div>
      </main>

      <aside class="w-[280px] shrink-0 flex flex-col border-l border-line bg-bg-muted">
        <section class="min-h-0 flex-1 overflow-hidden">
          <StylePanel @add="openTemplateEditor(null)" @edit="openTemplateEditor" />
        </section>
        <section class="shrink-0 border-t border-line">
          <MetadataPanel @export="exportBook" />
        </section>
      </aside>
    </div>

    <BookMetadataModal />
    <TemplateEditorModal :open="templateModalOpen" :template="editingTemplate" @close="closeTemplateEditor" @save="handleTemplateSave" />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBookStore } from '../stores/book'
import { useEditorStore } from '../stores/editor'
import { useUiStore } from '../stores/ui'
import { useTemplateStore } from '../stores/templates'
import { useEpubExporter } from '../hooks/useEpubExporter'
import ChapterTree from '../components/sidebar/ChapterTree.vue'
import MetadataPanel from '../components/sidebar/MetadataPanel.vue'
import EditorCanvas from '../components/editor/EditorCanvas.vue'
import MobilePreviewFrame from '../components/preview/MobilePreviewFrame.vue'
import BookMetadataModal from '../components/editor/BookMetadataModal.vue'
import TemplateEditorModal from '../components/editor/TemplateEditorModal.vue'
import StylePanel from '../components/sidebar/StylePanel.vue'

const props = defineProps({ bookId: { type: String, required: true } })
const router = useRouter()
const bookStore = useBookStore()
const editorStore = useEditorStore()
const uiStore = useUiStore()
const templateStore = useTemplateStore()

const book = computed(() => bookStore.activeBook)
const activeChapter = computed(() => editorStore.activeChapter)
const { exportBook: doExport } = useEpubExporter()

const templateModalOpen = ref(false)
const editingTemplate = ref(null)

templateStore.ensureLoaded()

function openTemplateEditor(tpl) {
  editingTemplate.value = tpl || null
  templateModalOpen.value = true
}

function closeTemplateEditor() {
  templateModalOpen.value = false
}

function handleTemplateSave(payload) {
  if (payload.id) {
    templateStore.updateTemplate(payload.id, payload)
  } else {
    templateStore.addTemplate(payload)
  }
  closeTemplateEditor()
}

onMounted(() => {
  const loaded = bookStore.loadBook(props.bookId)
  if (!loaded) {
    router.replace({ name: 'library' })
    return
  }
  // 默认选中第一个章节
  if (!editorStore.activeChapterId || !loaded.chapters.some((c) => c.id === editorStore.activeChapterId)) {
    editorStore.setActiveChapter(loaded.chapters[0]?.id || null)
  }
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
  try {
    await doExport(book.value, { templates: templateStore.templates })
  } catch (err) {
    console.error(err)
    window.alert('导出失败：' + (err.message || err))
  }
}
</script>
