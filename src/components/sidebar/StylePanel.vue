<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between px-4 py-3">
      <h2 class="text-sm font-medium text-ink">样式模板</h2>
      <button class="flex items-center gap-1 text-xs text-accent hover:text-accent-hover" @click="emit('add')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        新建
      </button>
    </div>
    <p class="px-4 pb-2 text-xs text-ink-placeholder">选中文本后点击模板即可套用</p>
    <div class="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
      <div
        v-for="tpl in templateStore.templates"
        :key="tpl.id"
        class="group flex items-center gap-2 rounded-card px-2 py-2 cursor-pointer hover:bg-bg-card transition-colors"
        @click="apply(tpl)"
      >
        <span class="rounded-md bg-bg-muted px-1.5 py-0.5 text-xs text-ink-secondary shrink-0">{{ label(tpl.target) }}</span>
        <span class="min-w-0 flex-1 truncate text-sm text-ink">{{ tpl.name }}</span>
        <div class="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button class="tree-btn" title="编辑" @click.stop="emit('edit', tpl)">✎</button>
          <button class="tree-btn hover:!text-danger" title="删除" @click.stop="remove(tpl)">✕</button>
        </div>
      </div>
      <div v-if="templateStore.templates.length === 0" class="px-3 py-6 text-center text-xs text-ink-placeholder">
        还没有模板，点「新建」开始
      </div>
    </div>
  </div>
</template>

<script setup>
import { useEditorStore } from '../../stores/editor'
import { useTemplateStore } from '../../stores/templates'
import { applyTemplateToEditor } from '../../utils/template'
import { TARGET_LABELS } from '../../utils/template'

const emit = defineEmits(['add', 'edit'])
const editorStore = useEditorStore()
const templateStore = useTemplateStore()
templateStore.ensureLoaded()

function label(target) {
  return TARGET_LABELS[target] || '模板'
}

function apply(tpl) {
  if (!editorStore.editor) return
  editorStore.editor.commands.focus()
  applyTemplateToEditor(editorStore.editor, tpl)
}

function remove(tpl) {
  if (window.confirm(`删除模板「${tpl.name}」？`)) {
    templateStore.deleteTemplate(tpl.id)
  }
}
</script>

<style scoped>
.tree-btn {
  @apply flex h-5 w-5 items-center justify-center rounded text-xs text-ink-placeholder hover:bg-bg-muted hover:text-ink transition-colors;
}
</style>
