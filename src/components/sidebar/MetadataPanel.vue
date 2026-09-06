<template>
  <div class="flex h-full flex-col">
    <div class="px-4 py-3">
      <h2 class="text-sm font-medium text-ink">属性</h2>
    </div>
    <div class="flex-1 overflow-y-auto px-4 space-y-4">
      <div>
        <p class="text-xs text-ink-placeholder mb-1">章节字数</p>
        <p class="text-sm text-ink">{{ activeChapter?.wordCount ?? 0 }} 字</p>
      </div>
      <div>
        <p class="text-xs text-ink-placeholder mb-1">作者</p>
        <p class="text-sm text-ink">{{ book.author || '佚名' }}</p>
      </div>
      <div>
        <p class="text-xs text-ink-placeholder mb-1">修改时间</p>
        <p class="text-sm text-ink">{{ formatTime(activeChapter?.updatedAt) }}</p>
      </div>
      <div>
        <p class="text-xs text-ink-placeholder mb-1">书籍标识</p>
        <p class="truncate text-sm text-ink-secondary" :title="book.identifier">{{ book.identifier }}</p>
      </div>
    </div>
    <div class="border-t border-line p-4">
      <button class="btn-primary w-full" @click="emit('export')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        导出 EPUB
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useBookStore } from '../../stores/book'
import { useEditorStore } from '../../stores/editor'

const emit = defineEmits(['export'])
const bookStore = useBookStore()
const editorStore = useEditorStore()

const book = computed(() => bookStore.activeBook || {})
const activeChapter = computed(() => editorStore.activeChapter)

function formatTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>
