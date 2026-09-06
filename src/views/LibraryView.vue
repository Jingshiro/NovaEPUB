<template>
  <div class="flex h-screen overflow-hidden bg-bg" @dragover.prevent @drop.prevent="onDrop" @dragenter="dragging = true" @dragleave="dragging = false">
    <!-- 左侧书目列表 -->
    <aside class="w-64 shrink-0 flex flex-col border-r border-line bg-bg-muted">
      <div class="px-4 py-4 flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white font-bold">N</span>
        <h1 class="text-sm font-semibold text-ink">NovaEpub</h1>
      </div>
      <div class="px-4 pb-2 text-xs text-ink-placeholder">我的书架</div>
      <nav class="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        <div
          v-for="book in books"
          :key="book.id"
          class="group flex items-center gap-3 rounded-card px-3 py-2 cursor-pointer hover:bg-bg-card hover:shadow-card transition-all"
          @click="openBook(book.id)"
        >
          <div class="relative h-8 w-6 shrink-0 overflow-hidden rounded-sm border border-line bg-bg-card">
            <img v-if="book.cover" :src="book.cover" class="h-full w-full object-cover" alt="" />
            <div v-else class="h-full w-full bg-accent-soft/30"></div>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-ink">{{ book.title }}</p>
            <p class="truncate text-xs text-ink-secondary">{{ book.author }}</p>
          </div>
          <button
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
    <main class="flex-1 overflow-y-auto" :class="dragging ? 'bg-accent/5' : ''">
      <div class="mx-auto max-w-3xl px-8 py-12">
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
            <p class="text-sm text-ink-secondary mt-1">点击创建一个空白电子书，或拖拽 .epub 文件导入</p>
          </div>
          <button class="btn-secondary mt-1" @click.stop="pickFile">导入 .epub 文件</button>
          <p v-if="loading" class="text-sm text-accent">正在解析 EPUB…</p>
          <p v-if="error" class="text-sm text-danger">{{ error }}</p>
        </div>

        <!-- 书籍卡片网格 -->
        <h2 class="mt-10 mb-3 text-sm font-medium text-ink-secondary">所有书籍</h2>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div
            v-for="book in books"
            :key="book.id"
            class="group card overflow-hidden cursor-pointer transition-shadow hover:shadow-card"
            @click="openBook(book.id)"
          >
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

    <input ref="fileInput" type="file" accept=".epub,application/epub+zip" class="hidden" @change="onFileChange" />
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBookStore } from '../stores/book'
import { useEpubParser } from '../hooks/useEpubParser'

const router = useRouter()
const bookStore = useBookStore()
const { parsing, error, parseFile } = useEpubParser()

const books = computed(() => bookStore.booksList)
const loading = computed(() => parsing.value)
const dragging = ref(false)
const fileInput = ref(null)

onMounted(() => {
  bookStore.ensureLoaded()
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
  const file = Array.from(e.dataTransfer.files || []).find((f) =>
    f.name.toLowerCase().endsWith('.epub') || f.type === 'application/epub+zip',
  )
  if (file) importFile(file)
}

async function importFile(file) {
  try {
    const book = await parseFile(file)
    const id = bookStore.importBook(book)
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
</script>
