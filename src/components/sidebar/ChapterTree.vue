<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between px-4 py-3">
      <h2 class="text-sm font-medium text-ink">目录</h2>
      <button class="tree-add-btn" title="新增章节" aria-label="新增章节" @click="addChapter">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
      <div
        v-for="(chapter, index) in chapters"
        :key="chapter.id"
        draggable="true"
        class="group flex items-center gap-2 rounded-card px-2 py-1.5 cursor-pointer transition-colors"
        :class="[
          chapter.id === activeChapterId ? 'bg-accent/10 text-accent' : 'hover:bg-bg-card',
          dragIndex === index ? 'opacity-50' : '',
          dragging && overIndex === index && dragIndex !== index ? 'chapter-drop-target' : '',
        ]"
        @click="select(chapter.id)"
        @dragstart="onDragStart(index)"
        @dragover.prevent
        @drop.prevent="onDrop(index)"
        @dragend="onDragEnd"
        @touchstart="onTouchStart(index, $event, $event.currentTarget)"
        @touchmove="onTouchMove($event)"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
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

        <!--
          操作按钮常驻显示：原先用 opacity-0 + group-hover，只在鼠标悬浮时才出现。
          移动端没有 hover，等于这些按钮在手机上根本不可见、无法使用。
        -->
        <div class="chapter-actions flex shrink-0 items-center gap-0.5">
          <button class="tree-btn" title="上移" aria-label="上移章节" :disabled="index === 0" @click.stop="move(chapter.id, -1)">↑</button>
          <button class="tree-btn" title="下移" aria-label="下移章节" :disabled="index === chapters.length - 1" @click.stop="move(chapter.id, 1)">↓</button>
          <button class="tree-btn" title="重命名" aria-label="重命名章节" @click.stop="startRename(chapter)">✎</button>
          <button class="tree-btn tree-btn-danger" title="删除" aria-label="删除章节" @click.stop="remove(chapter)">✕</button>
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
import { useDialogStore } from '../../stores/dialog'
import { useLongPressDrag } from '../../composables/useLongPressDrag'

const bookStore = useBookStore()
const editorStore = useEditorStore()
const historyStore = useHistoryStore()
const dialog = useDialogStore()

const chapters = computed(() => bookStore.activeBook?.chapters || [])
const activeChapterId = computed(() => editorStore.activeChapterId)

const editingId = ref(null)
const editingTitle = ref('')
const editingInput = ref(null)

// 触摸端长按拖拽（iOS Safari 不支持 HTML5 拖放，必须自己实现）。
// 桌面端仍走原生 draggable 那一套，两者共用 applyReorder。
const {
  dragging,
  dragIndex,
  overIndex,
  start: onTouchStart,
  move: onTouchMove,
  end: onTouchEnd,
  suppressClick,
} = useLongPressDrag({
  getItemCount: () => chapters.value.length,
  onDrop: (from, to) => applyReorder(from, to),
})

/** 触摸拖拽与 HTML5 拖拽共用的排序提交。 */
function applyReorder(from, to) {
  if (from === to) return
  const id = chapters.value[from]?.id
  if (!id) return
  historyStore.capture('拖拽排序章节')
  bookStore.reorderChapter(id, to)
}

function select(id) {
  // 长按拖拽结束后浏览器会补一个 click，吞掉它，避免拖完排序后误跳章节
  if (suppressClick()) return
  editorStore.setActiveChapter(id)
}

function addChapter() {
  historyStore.capture('新增章节')
  const chapter = bookStore.addChapter()
  if (chapter) editorStore.setActiveChapter(chapter.id)
}

async function remove(chapter) {
  if (await dialog.confirm(`删除章节「${chapter.title}」？`)) {
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

function onDragStart(index) {
  dragging.value = true
  dragIndex.value = index
}

function onDragEnd() {
  dragIndex.value = null
  dragging.value = false
}

function onDrop(index) {
  const from = dragIndex.value
  onDragEnd()
  if (from === null || from === index) return
  applyReorder(from, index)
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

/* 删除按钮给一点危险色提示，避免和重命名误触 */
.tree-btn-danger {
  @apply hover:text-danger;
}

.tree-add-btn {
  @apply flex items-center justify-center rounded text-ink-secondary hover:text-accent transition-colors;
}

/* 触控设备上把操作按钮放大到约 44×44 的可点区域（图标视觉尺寸基本不变） */
@media (pointer: coarse) {
  .tree-btn {
    @apply h-11 w-11 text-base;
  }
  .tree-add-btn {
    @apply p-2;
  }
  .chapter-actions {
    @apply gap-1;
  }
}

/* 拖拽落点提示线 */
.chapter-drop-target {
  box-shadow: inset 0 -2px 0 0 theme('colors.accent.DEFAULT');
}
</style>
