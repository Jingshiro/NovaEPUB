<template>
  <div class="flex h-screen overflow-hidden bg-bg" @dragover.prevent @drop.prevent="onDrop" @dragenter="dragging = true" @dragleave="dragging = false">
    <!-- 左侧书目列表：窄屏浮层化，可收起 -->
    <aside
      class="w-64 shrink-0 flex flex-col border-r border-line bg-bg-muted max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-card max-md:transition-transform"
      :class="libraryNavOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'"
    >
      <div class="px-4 py-4 flex items-center gap-2">
        <img src="/icon.jpg" alt="NovaEpub" class="h-7 w-7 rounded-md object-cover" />
        <h1 class="text-sm font-semibold text-ink">NovaEpub</h1>
        <button class="ml-auto md:hidden text-ink-placeholder hover:text-ink" @click="libraryNavOpen = false">✕</button>
      </div>
      <div class="px-4 pb-2 flex items-center justify-between text-xs text-ink-placeholder">
        <span>我的书架</span>
        <button
          v-if="books.length"
          class="text-xs hover:text-ink transition-colors"
          @click="toggleSelectMode"
        >
          {{ selecting ? '取消选择' : '批量选择' }}
        </button>
      </div>
      <nav class="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        <button
          class="ml-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-card px-3 py-2 text-xs text-ink-secondary hover:bg-bg-card hover:text-ink transition-colors"
          @click="syncModalOpen = true"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M7 17a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.7 1.5A3.5 3.5 0 0 1 17 17H7z" stroke-linejoin="round"/>
          </svg>
          云同步（WebDAV / S3）
        </button>
        <button
          class="ml-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-card px-3 py-2 text-xs text-ink-secondary hover:bg-bg-card hover:text-ink transition-colors"
          @click="exportBackupFile"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 15V3m0 0 4 4m-4-4L8 7M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          导出备份（.novaepub）
        </button>
        <button
          class="ml-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-card px-3 py-2 text-xs text-ink-secondary hover:bg-bg-card hover:text-ink transition-colors"
          @click="pickBackup"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          导入备份（.novaepub）
        </button>
        <div
          v-for="book in books"
          :key="book.id"
          class="group flex items-center gap-3 rounded-card px-3 py-2 cursor-pointer hover:bg-bg-card hover:shadow-card transition-all"
          :class="selecting && selected.includes(book.id) ? 'bg-bg-card ring-1 ring-accent' : ''"
          @click="selecting ? toggleSelected(book.id) : openBook(book.id)"
        >
          <span
            v-if="selecting"
            class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px] text-white"
            :class="selected.includes(book.id) ? 'border-accent bg-accent' : 'border-line bg-bg-card'"
          >✓</span>
          <div class="relative h-8 w-6 shrink-0 overflow-hidden rounded-sm border border-line bg-bg-card">
            <img v-if="book.cover" :src="book.cover" class="h-full w-full object-cover" alt="" />
            <div v-else class="h-full w-full bg-accent-soft/30"></div>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-ink">{{ book.title }}</p>
            <p class="truncate text-xs text-ink-secondary">{{ book.author }}</p>
          </div>
          <button
            v-if="!selecting"
            class="opacity-0 group-hover:opacity-100 text-ink-placeholder hover:text-danger transition-opacity"
            title="删除"
            @click.stop="confirmDelete(book)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div v-if="books.length === 0" class="px-3 py-6 text-center text-xs text-ink-placeholder">
          还没有书，从中间新建或导入
        </div>
      </nav>
    </aside>

    <!-- 中央区域 -->
    <main class="flex-1 overflow-y-auto max-md:w-full" :class="dragging ? 'bg-accent/5' : ''">
      <button
        class="fixed left-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-card border border-line bg-bg-card shadow-card md:hidden"
        title="书架"
        @click="libraryNavOpen = true"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <!-- 新建 / 导入大卡片 -->
        <div
          class="card flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4 border-2 border-dashed !border-line py-12 text-center transition-colors hover:!border-accent hover:bg-bg-muted"
          @click="createNewBook"
        >
          <div class="flex h-14 w-14 items-center justify-center rounded-card bg-accent text-white">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <p class="text-base font-medium text-ink">新建 EPUB</p>
            <p class="text-sm text-ink-secondary mt-1">点击创建一个空白电子书，或拖拽 .epub / .txt / .md 文件导入</p>
          </div>
          <button class="btn-secondary mt-1" @click.stop="pickFile">导入 .epub / .txt / .md</button>
          <p v-if="loading" class="text-sm text-accent">正在导入文件…</p>
          <p v-if="error" class="text-sm text-danger">{{ error }}</p>
        </div>

        <!-- 书籍卡片网格 -->
        <h2 class="mt-10 mb-3 text-sm font-medium text-ink-secondary">所有书籍</h2>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div
            v-for="book in books"
            :key="book.id"
            class="group card relative overflow-hidden cursor-pointer transition-shadow hover:shadow-card"
            :class="selecting && selected.includes(book.id) ? 'ring-1 ring-accent' : ''"
            @click="selecting ? toggleSelected(book.id) : openBook(book.id)"
          >
            <span
              v-if="selecting"
              class="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-sm border text-[11px] text-white"
              :class="selected.includes(book.id) ? 'border-accent bg-accent' : 'border-line bg-bg-card/80'"
            >✓</span>
            <div class="relative aspect-[3/4] bg-bg-muted">
              <img v-if="book.cover" :src="book.cover" class="h-full w-full object-cover" alt="" />
              <div v-else class="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-placeholder">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 4.5z" stroke-linejoin="round"/>
                  <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <div class="p-3">
              <p class="truncate text-sm text-ink">{{ book.title }}</p>
              <p class="truncate text-xs text-ink-secondary mt-0.5">{{ book.author }} · {{ book.chapters.length }} 章</p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 批量操作条 -->
    <div
      v-if="selecting"
      class="fixed bottom-0 left-64 right-0 z-20 flex items-center gap-3 border-t border-line bg-bg-card px-6 py-3 shadow-card max-md:left-0 max-md:px-4"
    >
      <span class="text-sm text-ink">已选 {{ selected.length }} 本</span>
      <button class="btn-secondary !px-3 !py-1.5 text-xs" :disabled="!selected.length" @click="selectAll">全选</button>
      <button class="btn-secondary !px-3 !py-1.5 text-xs" :disabled="!selected.length" @click="batchModalOpen = true">批量设置元数据</button>
      <button class="btn-secondary !px-3 !py-1.5 text-xs !text-danger" :disabled="!selected.length" @click="batchDelete">批量删除</button>
      <div class="flex-1"></div>
      <button class="text-xs text-ink-secondary hover:text-ink" @click="toggleSelectMode">完成</button>
    </div>

    <BatchMetadataModal
      :open="batchModalOpen"
      :count="selected.length"
      @close="batchModalOpen = false"
      @apply="applyBatchMetadata"
    />

    <SyncModal :open="syncModalOpen" @close="syncModalOpen = false" />

    <input
      ref="backupInput"
      type="file"
      accept=".novaepub,application/json,.json,application/json"
      class="hidden"
      @change="onBackupChange"
    />
    <input ref="fileInput" type="file" accept=".epub,application/epub+zip,.txt,.md,.markdown,text/plain,text/markdown" class="hidden" @change="onFileChange" />
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBookStore } from '../stores/book'
import { useEpubParser } from '../hooks/useEpubParser'
import { serializeLibrary, parseBackup } from '../utils/backup'
import BatchMetadataModal from '../components/library/BatchMetadataModal.vue'
import SyncModal from '../components/library/SyncModal.vue'

const router = useRouter()
const bookStore = useBookStore()
const { parsing, error, parseFile } = useEpubParser()

const books = computed(() => bookStore.booksList)
const loading = computed(() => parsing.value)
const dragging = ref(false)
const fileInput = ref(null)
/** 窄屏下左侧书架浮层开关（md 以上不受影响） */
const libraryNavOpen = ref(false)

// ---- 批量选择 ----
const selecting = ref(false)
const selected = ref([])
const batchModalOpen = ref(false)
const syncModalOpen = ref(false)

function toggleSelectMode() {
  selecting.value = !selecting.value
  if (!selecting.value) selected.value = []
}

function toggleSelected(id) {
  const idx = selected.value.indexOf(id)
  if (idx === -1) selected.value.push(id)
  else selected.value.splice(idx, 1)
}

function selectAll() {
  selected.value = books.value.map((b) => b.id)
}

function applyBatchMetadata(patch) {
  if (!Object.keys(patch).length) {
    window.alert('没有填写任何要修改的字段')
    return
  }
  const changed = bookStore.batchUpdateBooks([...selected.value], patch)
  batchModalOpen.value = false
  window.alert(`已批量更新 ${changed.length} 本书的元数据。`)
}

function batchDelete() {
  if (!selected.value.length) return
  if (window.confirm(`确定删除选中的 ${selected.value.length} 本书？此操作不可撤销。`)) {
    for (const id of selected.value) bookStore.deleteBook(id)
    selected.value = []
    selecting.value = false
  }
}

onMounted(() => {
  bookStore.ensureLoaded()
  bookStore.migrateLibrary()
})

function openBook(id) {
  router.push({ name: 'editor', params: { bookId: id } })
}

function pickFile() {
  fileInput.value?.click()
}

function createNewBook() {
  const id = bookStore.createBook()
  router.push({ name: 'editor', params: { bookId: id } })
}

function onFileChange(e) {
  const file = e.target.files?.[0]
  if (file) importFile(file)
  e.target.value = ''
}

function onDrop(e) {
  dragging.value = false
  const name = (f) => f.name.toLowerCase()
  const file = Array.from(e.dataTransfer.files || []).find((f) =>
    name(f).endsWith('.epub') || name(f).endsWith('.txt') || name(f).endsWith('.md') || name(f).endsWith('.markdown') ||
    f.type === 'application/epub+zip' || f.type === 'text/plain' || f.type === 'text/markdown',
  )
  if (file) importFile(file)
}

async function importFile(file) {
  try {
    const book = await parseFile(file)
    const id = bookStore.importBook(book)
    if (Array.isArray(book.importWarnings) && book.importWarnings.length) {
      const warnings = book.importWarnings.slice(0, 8)
      const more = book.importWarnings.length - warnings.length
      const suffix = more > 0 ? `\n… 以及另外 ${more} 条` : ''
      window.alert(`导入完成，但遇到一些兼容性问题：\n\n- ${warnings.join('\n- ')}${suffix}`)
    }
    router.push({ name: 'editor', params: { bookId: id } })
  } catch (err) {
    console.error(err)
  }
}

function confirmDelete(book) {
  if (window.confirm(`确定删除《${book.title}》？`)) {
    bookStore.deleteBook(book.id)
  }
}

// ---- D4：.novaepub 本地备份导出 / 导入 ----
const backupInput = ref(null)

function pickBackup() {
  backupInput.value?.click()
}

async function exportBackupFile() {
  const { saveAs } = await import('file-saver')
  const payload = JSON.stringify(serializeLibrary(bookStore.library), null, 2)
  const date = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
  saveAs(new Blob([payload], { type: 'application/json' }), `novaepub-${stamp}.novaepub.json`)
}

async function onBackupChange(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const books = parseBackup(text)
    if (!books.length) {
      window.alert('备份里没有任何书籍。')
      return
    }
    if (!window.confirm(`备份包含 ${books.length} 本书。同 id 的书会被备份内容覆盖，确定导入？`)) return
    for (const book of books) bookStore.importBook(book)
    window.alert(`已导入 ${books.length} 本书籍。`)
  } catch (err) {
    window.alert('导入备份失败：' + (err.message || err))
  }
}
</script>
