<template>
  <div class="relative flex h-full flex-col">
    <div class="flex items-center justify-between px-4 py-3 lg:pr-4 max-lg:pr-12">
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
        :draggable="canHtmlDrag && editingId !== chapter.id"
        class="chapter-row group flex items-center gap-2 rounded-card px-2 py-1.5 cursor-pointer transition-colors"
        :class="[
          selecting
            ? (selectedSet.has(chapter.id) ? 'bg-accent/10' : 'hover:bg-bg-card')
            : (chapter.id === activeChapterId ? 'bg-accent/10 text-accent' : 'hover:bg-bg-card'),
          dragging && dragIndex === index ? 'opacity-50 ring-1 ring-accent' : '',
          dragging && overIndex === index && dragIndex !== index ? 'chapter-drop-target' : '',
        ]"
        @click="onRowClick(chapter, index, $event)"
        @dragstart="onDragStart(index, $event)"
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
        <div v-if="!selecting" class="chapter-actions flex shrink-0 items-center">
          <button class="tree-btn" title="上移" aria-label="上移章节" :disabled="index === 0" @click.stop="move(chapter.id, -1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5m0 0-6 6m6-6 6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="tree-btn" title="下移" aria-label="下移章节" :disabled="index === chapters.length - 1" @click.stop="move(chapter.id, 1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m0 0 6-6m-6 6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="tree-btn" title="重命名" aria-label="重命名章节" @click.stop="startRename(chapter)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="tree-btn tree-btn-danger" title="删除" aria-label="删除章节" @click.stop="remove(chapter)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 多选底部操作条 -->
    <div
      v-if="selecting"
      class="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-1.5 border-t border-line bg-bg-card px-3 py-2 shadow-card"
    >
      <span class="text-xs text-ink shrink-0">已选 {{ selectedIds.length }}</span>
      <span class="hidden md:inline text-[10px] text-ink-placeholder truncate">可拖动或按 ↑↓</span>
      <button
        class="text-xs text-ink-secondary hover:text-ink shrink-0"
        :disabled="!chapters.length"
        @click="selectAll"
      >{{ selectedIds.length >= chapters.length ? '全不选' : '全选' }}</button>
      <div class="flex-1"></div>
      <button
        class="btn-secondary !px-2 !py-1 text-xs shrink-0"
        title="整组上移"
        :disabled="!selectedIds.length"
        @click="moveSelectedBy(-1)"
      >↑</button>
      <button
        class="btn-secondary !px-2 !py-1 text-xs shrink-0"
        title="整组下移"
        :disabled="!selectedIds.length"
        @click="moveSelectedBy(1)"
      >↓</button>
      <button
        class="btn-secondary !px-2 !py-1 text-xs !text-danger shrink-0"
        :disabled="!selectedIds.length"
        @click="batchRemove"
      >删除</button>
      <button class="btn-secondary !px-2 !py-1 text-xs shrink-0" @click="toggleSelectMode">完成</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useBookStore } from '../../stores/book'
import { useEditorStore } from '../../stores/editor'
import { useHistoryStore } from '../../stores/history'
import { useDialogStore } from '../../stores/dialog'
import { useLongPressDrag } from '../../composables/useLongPressDrag'

const bookStore = useBookStore()
const editorStore = useEditorStore()
const historyStore = useHistoryStore()
const dialog = useDialogStore()
const emit = defineEmits(['navigate'])

const chapters = computed(() => bookStore.activeBook?.chapters || [])
const activeChapterId = computed(() => editorStore.activeChapterId)

const editingId = ref(null)
const editingTitle = ref('')
const editingInput = ref(null)

/** 触屏设备关掉 HTML5 draggable，避免系统原生长按拖拽抢走 touch 流（多选下尤其明显）。 */
const canHtmlDrag = !(
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches
)

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
  let dragGroup
  if (selecting.value) {
    // 拖未选行时并进选择集，避免「长按拖了却整组都不动」
    if (!selectedSet.value.has(draggedId)) {
      selectedIds.value = [...selectedIds.value, draggedId]
    }
    dragGroup = chapters.value.filter((c) => selectedSet.value.has(c.id)).map((c) => c.id)
  } else {
    dragGroup = [draggedId]
  }
  if (!dragGroup.length) return
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
  emit('navigate', chapter.id)
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

function onDragStart(index, event) {
  dragging.value = true
  dragIndex.value = index
  // 部分浏览器（Firefox 等）不 setData 就不进入拖拽态
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    try {
      event.dataTransfer.setData('text/plain', String(index))
    } catch {
      /* 某些环境禁止 setData，忽略 */
    }
  }
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

/** 多选时：↑/↓ 把选中章整组上移/下移一格（桌面无触屏长按时用键盘）。 */
function moveSelectedBy(dir) {
  if (!selecting.value || !selectedIds.value.length) return
  const list = chapters.value
  const ordered = list.filter((c) => selectedSet.value.has(c.id)).map((c) => c.id)
  if (!ordered.length) return
  const indices = []
  list.forEach((c, i) => {
    if (selectedSet.value.has(c.id)) indices.push(i)
  })
  const first = indices[0]
  const last = indices[indices.length - 1]
  if (dir < 0) {
    if (first <= 0) return
    historyStore.capture('批量调整章节顺序')
    bookStore.reorderChapters(ordered, first - 1)
  } else {
    if (last >= list.length - 1) return
    // insert-before 语义：下移一格 = 插到「组后第二章」之前（即 last+2）
    historyStore.capture('批量调整章节顺序')
    bookStore.reorderChapters(ordered, last + 2)
  }
}

function onKeydown(e) {
  if (!selecting.value) return
  // 焦点在输入框时不劫持
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    moveSelectedBy(-1)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    moveSelectedBy(1)
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

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
/*
 * 章节行必须禁用文本选择：多选模式下行内几乎全是标题文字，
 * iOS/Android 长按会先触发系统选词/选单，touch 流被掐断，
 * 我们的长按拖拽（useLongPressDrag）就再也收不到 move/end。
 */
.chapter-row {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  touch-action: pan-y;
}

.tree-btn {
  @apply flex h-7 w-7 items-center justify-center rounded text-ink-placeholder hover:bg-bg-muted hover:text-ink transition-colors;
}

/* 删除按钮给一点危险色提示，避免和重命名误触 */
.tree-btn-danger {
  @apply hover:text-danger;
}

.tree-add-btn {
  @apply flex items-center justify-center rounded text-ink-secondary hover:text-accent transition-colors;
}

/*
 * 触控：可点区域约 36×36（比标准 44 略紧，四键并排才不会把标题挤没）。
 * 桌面保持小图标，标题优先。
 */
@media (pointer: coarse) {
  .tree-btn {
    @apply h-9 w-9;
  }
  .tree-add-btn {
    @apply p-2;
  }
}

/* 拖拽落点提示线 */
.chapter-drop-target {
  box-shadow: inset 0 -2px 0 0 theme('colors.accent.DEFAULT');
}
</style>
