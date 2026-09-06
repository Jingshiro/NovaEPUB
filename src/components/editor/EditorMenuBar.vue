<template>
  <div v-if="editor" class="flex flex-wrap items-center gap-1 rounded-card border border-line bg-bg-card px-2 py-1.5">
    <button class="tool" :class="{ active: editor.isActive('bold') }" title="加粗" @mousedown.prevent @click="editor.chain().focus().toggleBold().run()">
      <b>B</b>
    </button>
    <button class="tool" :class="{ active: editor.isActive('italic') }" title="斜体" @mousedown.prevent @click="editor.chain().focus().toggleItalic().run()">
      <i>I</i>
    </button>
    <button class="tool" :class="{ active: editor.isActive('strike') }" title="删除线" @mousedown.prevent @click="editor.chain().focus().toggleStrike().run()">
      <s>S</s>
    </button>
    <span class="mx-1 h-4 w-px bg-line"></span>
    <button class="tool" :class="{ active: editor.isActive('heading', { level: 1 }) }" title="标题1" @mousedown.prevent @click="editor.chain().focus().toggleHeading({ level: 1 }).run()">H1</button>
    <button class="tool" :class="{ active: editor.isActive('heading', { level: 2 }) }" title="标题2" @mousedown.prevent @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
    <button class="tool" :class="{ active: editor.isActive('heading', { level: 3 }) }" title="标题3" @mousedown.prevent @click="editor.chain().focus().toggleHeading({ level: 3 }).run()">H3</button>
    <button class="tool" :class="{ active: editor.isActive('blockquote') }" title="引用" @mousedown.prevent @click="editor.chain().focus().toggleBlockquote().run()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 7h10v10H7zM7 12h10" stroke-linecap="round"/></svg>
    </button>
    <button class="tool" :class="{ active: editor.isActive('bulletList') }" title="无序列表" @mousedown.prevent @click="editor.chain().focus().toggleBulletList().run()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke-linecap="round"/></svg>
    </button>
    <button class="tool" :class="{ active: editor.isActive('orderedList') }" title="有序列表" @mousedown.prevent @click="editor.chain().focus().toggleOrderedList().run()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 6h11M10 12h11M10 18h11M4 4v6M4 4l2 1M4 13h2v3H4M4 18h2v3H4" stroke-linecap="round"/></svg>
    </button>
    <button class="tool" :class="{ active: editor.isActive('codeBlock') }" title="代码块" @mousedown.prevent @click="editor.chain().focus().toggleCodeBlock().run()">
      &lt;/&gt;
    </button>
    <span class="mx-1 h-4 w-px bg-line"></span>
    <button class="tool" title="撤销" @mousedown.prevent @click="editor.chain().focus().undo().run()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <button class="tool" title="重做" @mousedown.prevent @click="editor.chain().focus().redo().run()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </div>
</template>

<script setup>
const props = defineProps({
  editor: { type: Object, default: null },
})
</script>

<style scoped>
.tool {
  @apply flex items-center justify-center rounded-btn px-2 py-1 text-xs text-ink-secondary hover:bg-bg-muted hover:text-ink transition-colors;
}
.tool.active {
  @apply bg-accent/10 text-accent;
}
</style>
