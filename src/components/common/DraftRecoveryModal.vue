<template>
  <AppModal :open="open" title="恢复本地草稿" @close="ignoreAll">
    <p class="text-sm text-ink-secondary mb-4">
      检测到以下书籍有未同步的本地草稿（可能是上次编辑中断留下的）。
      恢复到书架后，可在书架继续编辑。
    </p>
    <div class="space-y-3">
      <div
        v-for="draft in drafts"
        :key="draft.bookId"
        class="flex items-center gap-3 rounded-card border border-line bg-bg-muted p-3"
      >
        <div class="h-14 w-10 shrink-0 overflow-hidden rounded-sm border border-line bg-bg-card">
          <img v-if="draft.book.cover" :src="draft.book.cover" class="h-full w-full object-cover" alt="" />
          <div v-else class="h-full w-full bg-accent-soft/30"></div>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-ink">{{ draft.book.title || '未命名书籍' }}</p>
          <p class="truncate text-xs text-ink-secondary">
            {{ draft.book.author || '佚名' }} · {{ draft.book.chapters?.length || 0 }} 章
          </p>
          <p class="text-xs text-ink-placeholder">草稿时间 {{ formatTime(draft.savedAt) }}</p>
        </div>
        <div class="flex shrink-0 gap-2">
          <button class="btn-primary !px-3 !py-1.5 text-xs" :disabled="busy" @click="restore(draft)">
            恢复
          </button>
          <button class="btn-secondary !px-3 !py-1.5 text-xs" :disabled="busy" @click="discard(draft)">
            忽略
          </button>
        </div>
      </div>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="ignoreAll">全部忽略</button>
    </template>
  </AppModal>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppModal from './AppModal.vue'
import { useBookStore } from '../../stores/book'
import { useEditorStore } from '../../stores/editor'
import { loadDraftRecords, removeDraft, findRecoverableDrafts } from '../../utils/draft'
import { resolveContentImages } from '../../utils/image'

const bookStore = useBookStore()
const editorStore = useEditorStore()
const router = useRouter()
const open = ref(false)
const drafts = ref([])
const busy = ref(false)

onMounted(async () => {
  bookStore.ensureLoaded()
  bookStore.migrateLibrary()
  const records = await loadDraftRecords()
  const recoverable = findRecoverableDrafts(bookStore.library, records)
  // 清理已经同步/过期的草稿，避免 IndexedDB 越积越多
  const recoverableIds = new Set(recoverable.map((r) => r.bookId))
  records
    .filter((r) => !recoverableIds.has(r.bookId))
    .forEach((r) => removeDraft(r.bookId).catch(() => {}))
  if (recoverable.length) {
    drafts.value = recoverable
    open.value = true
  }
})

function formatTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function restore(draft) {
  if (busy.value) return
  busy.value = true
  try {
    const currentRoute = router.currentRoute.value
    bookStore.importBook(draft.book)
    await removeDraft(draft.bookId)
    if (currentRoute.name === 'editor' && currentRoute.params.bookId === draft.bookId) {
      // 正在编辑同一本书时，直接刷新编辑器内容到草稿版本
      const editor = editorStore.editor
      const chapter = bookStore.activeBook?.chapters?.find((c) => c.id === editorStore.activeChapterId)
      if (editor && chapter) {
        editor.commands.setContent(resolveContentImages(bookStore.activeBook, chapter.content || ''), false)
      }
    } else if (currentRoute.name === 'editor' && currentRoute.params.bookId !== draft.bookId) {
      // 当前正停留在另一本书的编辑页，恢复到书架，避免地址栏与当前书不一致
      await router.push({ name: 'library' })
    }
    drafts.value = drafts.value.filter((d) => d.bookId !== draft.bookId)
    if (drafts.value.length === 0) open.value = false
  } finally {
    busy.value = false
  }
}

async function discard(draft) {
  if (busy.value) return
  busy.value = true
  try {
    await removeDraft(draft.bookId)
    drafts.value = drafts.value.filter((d) => d.bookId !== draft.bookId)
    if (drafts.value.length === 0) open.value = false
  } finally {
    busy.value = false
  }
}

async function ignoreAll() {
  if (busy.value) return
  open.value = false
}
</script>