<template>
  <div class="flex h-full flex-col items-center justify-center bg-bg-muted p-6">
    <div class="flex h-full w-full max-w-sm flex-col overflow-hidden rounded-card border border-line bg-white shadow-card">
      <div class="flex items-center justify-between border-b border-line px-4 py-2">
        <span class="text-xs text-ink-placeholder">预览 · 阅读器</span>
        <span class="truncate text-xs text-ink-secondary">{{ book?.title || '' }}</span>
      </div>
      <div class="flex items-center gap-2 border-b border-line px-3 py-2">
        <button class="btn-ghost shrink-0 !px-2 text-xs" :disabled="currentIndex <= 0" @click="goIndex(currentIndex - 1)">
          上一章
        </button>
        <select class="input h-8 min-w-0 flex-1 text-xs" :value="currentIndex" @change="goIndex(Number($event.target.value))">
          <option v-for="(ch, i) in chapters" :key="ch.id" :value="i">{{ ch.title }}</option>
        </select>
        <button class="btn-ghost shrink-0 !px-2 text-xs" :disabled="currentIndex >= chapters.length - 1" @click="goIndex(currentIndex + 1)">
          下一章
        </button>
      </div>
      <iframe ref="frameRef" :srcdoc="srcdoc" class="h-full w-full flex-1 border-0 bg-white" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useBookStore } from '../../stores/book'
import { buildStylesCss } from '../../utils/styles'
import { splitTemplate } from '../../utils/template'
import { resolveContentImagesToBlobUrls } from '../../utils/image'
import { resolveContentResourcesToBlobUrls, resolveCssResourcesToBlobUrls } from '../../utils/resource'
import { expandHtmlBlocks } from '../../utils/htmlBlock'
import { getEntryBlobUrl } from '../../utils/assetStore'

const props = defineProps({
  book: { type: Object, default: null },
  chapter: { type: Object, default: null },
  templates: { type: Array, default: () => [] },
})

const bookStore = useBookStore()
const chapters = computed(() => props.book?.chapters || [])
const frameRef = ref(null)
const currentIndex = ref(0)
const srcdoc = ref('')

watch(
  () => props.chapter?.id,
  (id) => {
    const idx = chapters.value.findIndex((c) => c.id === id)
    if (idx >= 0) currentIndex.value = idx
  },
  { immediate: true },
)

function goIndex(index) {
  const target = Math.min(Math.max(0, index), chapters.value.length - 1)
  currentIndex.value = target
  const frame = frameRef.value
  if (frame?.contentWindow) {
    try {
      frame.contentWindow.location.hash = `#chapter-${target + 1}`
    } catch {
      // srcdoc 同源通常可直接跳转；个别环境不允许时静默忽略，用户仍可用书内目录链接
    }
  }
}

let buildId = 0

/** 预览整书 HTML：使用 blob: 资产引用 + 占位解封，避免十多 MB 的内嵌载荷卡死 iframe。 */
async function rebuildSrcdoc() {
  const book = props.book
  if (!book) {
    srcdoc.value = ''
    return
  }
  const myId = ++buildId
  await bookStore.ensureHydrated()
  if (myId !== buildId) return // 期间又有变更，让位给最新一次

  const bookStyles = (book.styles || []).filter(Boolean).join('\n')
  const templateStyles = (props.templates || [])
    .map((t) => splitTemplate(t.html).css.join('\n'))
    .filter(Boolean)
    .join('\n')
  const extra = [bookStyles, templateStyles].filter(Boolean).join('\n')
  const css = buildStylesCss(await resolveCssResourcesToBlobUrls(book, extra))
  const lang = book.language || 'zh-CN'
  const title = book.title || 'NovaEpub'

  const sections = []
  if (book.cover) {
    const coverUrl = await getEntryBlobUrl(book, { id: 'cover' }, { dataUrl: book.cover })
    sections.push(`<div class="cover-page"><img src="${coverUrl || book.cover}" alt="封面"/></div>`)
  }
  const tocLinks = chapters.value
    .map((ch, i) => `<a href="#chapter-${i + 1}">${i + 1}. ${escape(ch.title || '')}</a>`)
    .join('')
  sections.push(`<nav class="reader-toc"><h2>目录</h2>${tocLinks}</nav>`)
  for (const [i, ch] of chapters.value.entries()) {
    let content = expandHtmlBlocks(ch?.content || '')
    content = await resolveContentImagesToBlobUrls(book, content)
    content = await resolveContentResourcesToBlobUrls(book, content)
    sections.push(
      `<section class="chapter" id="chapter-${i + 1}">` +
        `<h1 class="chapter-title">${escape(ch.title || '')}</h1>` +
        `<div class="chapter-body">${content}</div>` +
        `</section>`,
    )
    if (myId !== buildId) return // 期间有新版预览请求，放弃旧结果
  }

  srcdoc.value = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escape(title)}</title>
<style>
${css}
body { padding: 0 22px 3em; }
.reader-toc {
  margin: 1.5em 0;
  padding: 1em 1.2em;
  background: #F7F6F3;
  border-radius: 8px;
}
.reader-toc h2 {
  font-size: 1em;
  margin: 0 0 0.5em;
  color: #787774;
}
.reader-toc a {
  display: block;
  padding: 0.3em 0;
  color: #37352F;
  text-decoration: none;
  border-bottom: 1px solid #E9E8E4;
}
.reader-toc a:last-child { border-bottom: none; }
.cover-page { text-align: center; padding: 2em 0 1em; }
.cover-page img { max-width: 100%; height: auto; max-height: 65vh; }
.chapter { page-break-before: always; margin-top: 1.5em; }
</style>
</head>
<body>
${sections.join('\n')}
</body>
</html>`
}

// 触发源：书对象 / 当前章 / 模板 / 资产水合 / 章节内容变化（读 content 变化追踪）
watch(
  [() => props.book, () => props.chapter?.id, () => props.templates.map((t) => t.updatedAt).join(','),
   () => chapters.value.map((c) => `${c.updatedAt}:${(c.content || '').length}`).join('|'),
   () => bookStore.assetsLoaded],
  rebuildSrcdoc,
  { immediate: true },
)

function escape(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
</script>
