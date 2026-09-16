<template>
  <div class="relative flex h-full flex-col">
    <div class="flex items-center justify-between px-4 py-3">
      <h2 class="text-sm font-medium text-ink">目录</h2>
      <div class="flex items-center gap-2">
        <button
          v-if="chapters.length > 1"
          class="text-xs text-ink-secondary hover:text-ink transition-colors"
          @click="toggleSelectMode"
        >
          {{ selecting ? '取消选择' : '多选' }}
        </button>
        <button class="tree-add-btn" title="新增章节" aria-label="新增章节" @click="addChapter">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5" :class="selecting ? 'pb-16' : ''">
      <div
        v-for="(chapter, index) in chapters"
        :key="chapter.id"
        :draggable="!editingId || editingId !== chapter.id"
        class="group flex items-center gap-2 rounded-card px-2 py-1.5 cursor-pointer transition-colors"
        :class="[
          selecting
            ? (selectedSet.has(chapter.id) ? 'bg-accent/10' : 'hover:bg-bg-card')
            : (chapter.id === activeChapterId ? 'bg-accent/10 text-accent' : 'hover:bg-bg-card'),
          dragIndex === index ? 'opacity-50' : '',
          dragging && overIndex === index && dragIndex !== index ? 'chapter-drop-target' : '',
        ]"
        @click="onRowClick(chapter, index, $event)"
        @dragstart="onDragStart(index)"
        @dragover.prevent
        @drop.prevent="onDrop(index)"
        @dragend="onDragEnd"
        @touchstart="onTouchStart(index, $event, $event.currentTarget)"
        @touchmove="onTouchMove($event)"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      >
        <!-- 多选：复选框；普通：序号 -->
        <span
          v-if="selecting"
          class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px] text-white"
          :class="selectedSet.has(chapter.id) ? 'border-accent bg-accent' : 'border-line bg-bg-card'"
          @click.stop="toggleSelect(chapter.id, index, $event)"
        >✓</span>
        <span v-else class="w-5 shrink-0 text-xs text-ink-placeholder">{{ index + 1 }}</span>

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
        <span
          v-else
          class="min-w-0 flex-1 truncate text-sm"
          :class="!selecting && chapter.id === activeChapterId ? 'text-accent' : 'text-ink'"
        >
          {{ chapter.title }}
        </span>

        <!--
          操作按钮常驻显示：原先用 opacity-0 + group-hover，只在鼠标悬浮时才出现。
          移动端没有 hover，等于这些按钮在手机上根本不可见、无法使用。
          多选模式下隐藏，改走底部批量条。
        -->
        <div v-if="!selecting" class="chapter-actions flex shrink-0 items-center gap-0.5">
          <button class="tree-btn" title="上移" aria-label="上移章节" :disabled="index === 0" @click.stop="move(chapter.id, -1)">↑</button>
          <button class="tree-btn" title="下移" aria-label="下移章节" :disabled="index === chapters.length - 1" @click.stop="move(chapter.id, 1)">↓</button>
          <button class="tree-btn" title="重命名" aria-label="重命名章节" @click.stop="startRename(chapter)">✎</button>
          <button class="tree-btn tree-btn-danger" title="删除" aria-label="删除章节" @click.stop="remove(chapter)">✕</button>
        </div>
      </div>
    </div>

    <!-- 多选底部操作条 -->
    <div
      v-if="selecting"
      class="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-2 border-t border-line bg-bg-card px-3 py-2 shadow-card"
    >
      <span class="text-xs text-ink">已选 {{ selectedIds.length }}</span>
      <button
        class="text-xs text-ink-secondary hover:text-ink"
        :disabled="!chapters.length"
        @click="selectAll"
      >{{ selectedIds.length >= chapters.length ? '全不选' : '全选' }}</button>
      <div class="flex-1"></div>
      <button
        class="btn-secondary !px-2.5 !py-1 text-xs !text-danger"
        :disabled="!selectedIds.length"
        @click="batchRemove"
      >删除</button>
      <button class="btn-secondary !px-2.5 !py-1 text-xs" @click="toggleSelectMode">完成</button>
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

// ---- 多选 ----
const selecting = ref(false)
const selectedIds = ref([])
const selectedSet = computed(() => new Set(selectedIds.value))
let lastClickedIndex = null

function toggleSelectMode() {
  selecting.value = !selecting.value
  selectedIds.value = []
  lastClickedIndex = null
}

function toggleSelect(id, index, event) {
  const shift = event?.shiftKey
  if (shift && lastClickedIndex != null && chapters.value[lastClickedIndex]) {
    const [a, b] = [lastClickedIndex, index].sort((x, y) => x - y)
    for (let i = a; i <= b; i++) {
      const cid = chapters.value[i]?.id
      if (cid && !selectedSet.value.has(cid)) selectedIds.value.push(cid)
    }
  } else if (selectedSet.value.has(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
  } else {
    selectedIds.value.push(id)
  }
  lastClickedIndex = index
}

function selectAll() {
  if (selectedIds.value.length >= chapters.value.length) {
    selectedIds.value = []
  } else {
    selectedIds.value = chapters.value.map((c) => c.id)
  }
}

async function batchRemove() {
  if (!selectedIds.value.length) return
  const n = selectedIds.value.length
  if (!(await dialog.confirm(`确定删除选中的 ${n} 个章节？此操作不可撤销。`))) return
  historyStore.capture(`批量删除 ${n} 个章节`)
  const removed = bookStore.removeChapters(selectedIds.value)
  selectedIds.value = []
  selecting.value = false
  const book = bookStore.activeBook
  if (!book?.chapters?.some((c) => c.id === editorStore.activeChapterId)) {
    const first = book?.chapters?.[0]
    if (first) editorStore.setActiveChapter(first.id)
  }
  void removed
}

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

/**
 * 排序提交：多选模式下拖「已选行」→ 整组移动；否则单章。
 * target 为悬停行在原数组中的下标。
 */
function applyReorder(from, to) {
  if (from === to) return
  const draggedId = chapters.value[from]?.id
  if (!draggedId) return
  const dragGroup =
    selecting.value && selectedSet.value.has(draggedId)
      ? chapters.value.filter((c) => selectedSet.value.has(c.id)).map((c) => c.id)
      : [draggedId]
  historyStore.capture(dragGroup.length > 1 ? '批量调整章节顺序' : '拖拽排序章节')
  if (dragGroup.length === 1) {
    bookStore.reorderChapter(dragGroup[0], to)
  } else {
    bookStore.reorderChapters(dragGroup, to)
  }
}

function onRowClick(chapter, index, event) {
  if (suppressClick()) return
  if (selecting.value) {
    toggleSelect(chapter.id, index, event)
    return
  }
  editorStore.setActiveChapter(chapter.id)
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
