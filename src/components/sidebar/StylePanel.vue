<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between px-4 py-3">
      <h2 class="text-sm font-medium text-ink">样式模板</h2>
      <button class="flex items-center gap-1 text-xs text-accent hover:text-accent-hover" @click="emitAdd">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        新建
      </button>
    </div>

    <!-- 作用域切换：本书模板（优先）/ 全局模板池 -->
    <div class="mx-4 mb-2 flex items-center rounded-btn border border-line bg-bg-muted p-0.5">
      <button
        class="flex-1 rounded-btn px-2 py-1 text-xs transition-colors"
        :class="scope === 'book' ? 'bg-bg-card text-ink shadow-card' : 'text-ink-secondary hover:text-ink'"
        @click="scope = 'book'"
      >本书 ({{ bookList.length }})</button>
      <button
        class="flex-1 rounded-btn px-2 py-1 text-xs transition-colors"
        :class="scope === 'global' ? 'bg-bg-card text-ink shadow-card' : 'text-ink-secondary hover:text-ink'"
        @click="scope = 'global'"
      >全局 ({{ templateStore.templates.length }})</button>
    </div>

    <div class="px-4 pb-2 space-y-1">
      <p class="text-xs text-ink-placeholder">
        {{ scope === 'book'
          ? '仅本书可见的模板；不随全局模板池变动'
          : '全局模板池 · 所有书共用' }}
      </p>
      <button
        v-if="scope === 'book' && bookList.length === 0"
        class="btn-secondary w-full !px-2 !py-1.5 text-xs"
        @click="copyFromGlobal"
      >从全局模板复制一套进来</button>
      <button
        v-if="scope === 'book' && bookList.length > 0"
        class="text-xs text-ink-secondary hover:text-danger transition-colors"
        @click="resetBook"
      >清空本书模板（回退全局池）</button>
    </div>

    <div class="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
      <div
        v-for="tpl in visibleTemplates"
        :key="tpl.id"
        class="group flex items-center gap-2 rounded-card px-2 py-2 cursor-pointer hover:bg-bg-card transition-colors"
        @click="apply(tpl)"
      >
        <span class="rounded-md bg-bg-muted px-1.5 py-0.5 text-xs text-ink-secondary shrink-0">{{ label(tpl.target) }}</span>
        <span class="min-w-0 flex-1 truncate text-sm text-ink">{{ tpl.name }}</span>
        <div class="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button class="tree-btn" title="编辑" @click.stop="edit(tpl)">✎</button>
          <button class="tree-btn hover:!text-danger" title="删除" @click.stop="remove(tpl)">✕</button>
        </div>
      </div>
      <div v-if="visibleTemplates.length === 0 && scope === 'global'" class="px-3 py-6 text-center text-xs text-ink-placeholder">
        还没有模板，点「新建」开始
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useEditorStore } from '../../stores/editor'
import { useBookStore } from '../../stores/book'
import { useTemplateStore } from '../../stores/templates'
import { applyTemplateToEditor } from '../../utils/template'
import { TARGET_LABELS } from '../../utils/template'

const emit = defineEmits(['add', 'edit'])
const editorStore = useEditorStore()
const bookStore = useBookStore()
const templateStore = useTemplateStore()
templateStore.ensureLoaded()

const scope = ref('book')
const bookId = computed(() => bookStore.activeBook?.id || '')
const bookList = computed(() => templateStore.bookList(bookId.value))
const visibleTemplates = computed(() =>
  scope.value === 'book' && bookList.value.length ? bookList.value : templateStore.templates,
)

function label(target) {
  return TARGET_LABELS[target] || '模板'
}

function emitAdd() {
  emit('add', scope.value)
}

function edit(tpl) {
  emit('edit', tpl, scope.value)
}

function apply(tpl) {
  if (!editorStore.editor) return
  editorStore.editor.commands.focus()
  applyTemplateToEditor(editorStore.editor, tpl, {
    onStyleCss: (css) => bookStore.addTemplateStyles(css),
  })
}

function remove(tpl) {
  if (!window.confirm(`删除模板「${tpl.name}」？`)) return
  if (scope.value === 'book' && bookList.value.some((t) => t.id === tpl.id)) {
    templateStore.deleteBookTemplate(bookId.value, tpl.id)
  } else {
    templateStore.deleteTemplate(tpl.id)
  }
}

function copyFromGlobal() {
  const count = templateStore.copyGlobalToBook(bookId.value)
  if (count === 0) window.alert('全局模板已全部在本书模板里了。')
}

function resetBook() {
  if (!bookList.value.length) return
  if (window.confirm('清空本书的全部书内模板？之后本书将回退使用全局模板池。')) {
    templateStore.clearBookTemplates(bookId.value)
  }
}
</script>

<style scoped>
.tree-btn {
  @apply flex h-5 w-5 items-center justify-center rounded text-xs text-ink-placeholder hover:bg-bg-muted hover:text-ink transition-colors;
}
</style>
