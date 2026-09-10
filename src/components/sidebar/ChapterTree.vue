<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between px-4 py-3">
      <h2 class="text-sm font-medium text-ink">目录</h2>
      <button class="text-ink-secondary hover:text-accent transition-colors" title="新增章节" @click="addChapter">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
      <div
        v-for="(chapter, index) in chapters"
        :key="chapter.id"
        class="group flex items-center gap-2 rounded-card px-2 py-1.5 cursor-pointer transition-colors"
        :class="chapter.id === activeChapterId ? 'bg-accent/10 text-accent' : 'hover:bg-bg-card'"
        @click="select(chapter.id)"
      >
        <span class="w-5 shrink-0 text-xs text-ink-placeholder">{{ index + 1 }}</span>
        <template v-if="editingId === chapter.id">
          <input
            ref="editingInput"
            v-model="editingTitle"
            class="w-full min-w-0 rounded border border-accent bg-bg-card px-2 py-0.5 text-sm text-ink focus:outline-none"
            @keydown.enter="commitRename"
            @keydown.esc="cancelRename"
            @blur="commitRename"
          />
        </template>
        <span v-else class="min-w-0 flex-1 truncate text-sm" :class="chapter.id === activeChapterId ? 'text-accent' : 'text-ink'">
          {{ chapter.title }}
        </span>

        <div class="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button class="tree-btn" title="上移" :disabled="index === 0" @click.stop="move(chapter.id, -1)">↑</button>
          <button class="tree-btn" title="下移" :disabled="index === chapters.length - 1" @click.stop="move(chapter.id, 1)">↓</button>
          <button class="tree-btn hover:!text-danger" title="重命名" @click.stop="startRename(chapter)">✎</button>
          <button class="tree-btn hover:!text-danger" title="删除" @click.stop="remove(chapter)">✕</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useBookStore } from '../../stores/book'
import { useEditorStore } from '../../stores/editor'
import { useHistoryStore } from '../../stores/history'

const bookStore = useBookStore()
const editorStore = useEditorStore()
const historyStore = useHistoryStore()

const chapters = computed(() => bookStore.activeBook?.chapters || [])
const activeChapterId = computed(() => editorStore.activeChapterId)

const editingId = ref(null)
const editingTitle = ref('')
const editingInput = ref(null)

function select(id) {
  editorStore.setActiveChapter(id)
}

function addChapter() {
  historyStore.capture('新增章节')
  const chapter = bookStore.addChapter()
  if (chapter) editorStore.setActiveChapter(chapter.id)
}

function remove(chapter) {
  if (window.confirm(`删除章节「${chapter.title}」？`)) {
    historyStore.capture('删除章节')
    bookStore.removeChapter(chapter.id)
    const next = bookStore.activeBook?.chapters?.[0]
    if (next) editorStore.setActiveChapter(next.id)
  }
}

function move(id, dir) {
  historyStore.capture('移动章节')
  bookStore.moveChapter(id, dir)
}

function startRename(chapter) {
  editingId.value = chapter.id
  editingTitle.value = chapter.title
  nextTick(() => editingInput.value?.focus())
}

function commitRename() {
  if (editingId.value) {
    historyStore.capture('重命名章节')
    bookStore.renameChapter(editingId.value, editingTitle.value.trim() || '未命名章节')
  }
  editingId.value = null
}

function cancelRename() {
  editingId.value = null
}
</script>

<style scoped>
.tree-btn {
  @apply flex h-5 w-5 items-center justify-center rounded text-xs text-ink-placeholder hover:bg-bg-muted hover:text-ink transition-colors;
}
</style>
