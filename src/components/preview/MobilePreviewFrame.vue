<template>
  <div class="flex h-full flex-col items-center justify-center bg-bg-muted p-6">
    <div class="flex h-full w-full max-w-sm flex-col overflow-hidden rounded-card border border-line bg-white shadow-card">
      <div class="flex items-center justify-between border-b border-line px-4 py-2">
        <span class="text-xs text-ink-placeholder">预览 · 手机阅读</span>
        <span class="text-xs text-ink-secondary">{{ book?.title || '' }}</span>
      </div>
      <iframe :srcdoc="srcdoc" class="h-full w-full flex-1 border-0 bg-white" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { buildStylesCss } from '../../utils/epubExporter'
import { splitTemplate } from '../../utils/template'

const props = defineProps({
  book: { type: Object, default: null },
  chapter: { type: Object, default: null },
  templates: { type: Array, default: () => [] },
})

const srcdoc = computed(() => {
  const extra = (props.templates || [])
    .map((t) => splitTemplate(t.html).css.join('\n'))
    .filter(Boolean)
    .join('\n')
  const css = buildStylesCss(extra)
  const content = props.chapter?.content || ''
  const title = props.chapter?.title || '空章节'
  const lang = props.book?.language || 'zh-CN'
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
${css}
body { padding: 0 22px; }
</style>
</head>
<body>
<h1 class="chapter-title">${escape(title)}</h1>
<div class="chapter-body">${content}</div>
</body>
</html>`
})

function escape(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
</script>
