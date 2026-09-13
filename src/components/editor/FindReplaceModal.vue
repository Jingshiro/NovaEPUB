<template>
  <AppModal :open="open" title="全局查找替换" @close="emit('close')">
    <div class="space-y-4">
      <div class="flex items-center gap-3">
        <label class="label w-16 shrink-0">查找</label>
        <input
          v-model="form.find"
          class="input flex-1"
          placeholder="输入要查找的文字"
          @keydown.enter="find"
        />
      </div>
      <div class="flex items-center gap-3">
        <label class="label w-16 shrink-0">替换为</label>
        <input v-model="form.replace" class="input flex-1" placeholder="替换后的文字（可为空）" />
      </div>
      <div class="flex items-center gap-4 pl-[76px]">
        <label class="flex items-center gap-2 text-sm text-ink-secondary">
          <input v-model="form.caseSensitive" type="checkbox" class="accent-accent" />
          区分大小写
        </label>
        <label class="flex items-center gap-2 text-sm text-ink-secondary">
          <input v-model="form.includeTitles" type="checkbox" class="accent-accent" />
          包含章节标题
        </label>
      </div>

      <p v-if="message" class="rounded-card bg-bg-muted px-3 py-2 text-sm text-ink" data-test="find-message">{{ message }}</p>

      <div class="flex flex-wrap items-center gap-2">
        <button class="btn-secondary" :disabled="!form.find" @click="find">查找</button>
        <button class="btn-primary" :disabled="!form.find" @click="replaceAll">全部替换</button>
      </div>
      <p class="text-xs text-ink-placeholder">替换会作用于全书正文{{ form.includeTitles ? '与章节标题' : '' }}，且保留原有排版标签。</p>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="emit('close')">完成</button>
    </template>
  </AppModal>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import AppModal from '../common/AppModal.vue'
import { useBookStore } from '../../stores/book'
import { useEditorStore } from '../../stores/editor'
import { useHistoryStore } from '../../stores/history'
import { countInBook } from '../../utils/search'
import { resolveContentImages } from '../../utils/image'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const bookStore = useBookStore()
const editorStore = useEditorStore()
const historyStore = useHistoryStore()

const form = reactive({
  find: '',
  replace: '',
  caseSensitive: false,
  includeTitles: true,
})
const message = ref('')

watch(
  () => props.open,
  (open) => {
    if (open) message.value = ''
  },
)

function options() {
  return {
    caseSensitive: form.caseSensitive,
    includeTitles: form.includeTitles,
  }
}

function find() {
  if (!form.find) return
  const book = bookStore.activeBook
  const counts = countInBook(book || {}, form.find, options())
  message.value = `找到 ${counts.total} 处（正文 ${counts.content}，标题 ${counts.titles}）`
}

async function replaceAll() {
  if (!form.find) return
  const book = bookStore.activeBook
  if (!book) return
  const counts = countInBook(book, form.find, options())
  if (counts.total === 0) {
    message.value = '没有找到可替换的内容'
    return
  }
  historyStore.capture('全局查找替换')
  const result = bookStore.replaceAllInBook(form.find, form.replace, options())
  if (result.count === 0) {
    message.value = '没有找到可替换的内容'
    return
  }
  const activeId = editorStore.activeChapterId
  const modified = new Set(result.modifiedChapterIds || [])
  await bookStore.ensureHydrated()
  if (activeId && modified.has(activeId)) {
    const chapter = bookStore.getChapter(activeId)
    if (chapter && editorStore.editor) {
      editorStore.editor.commands.setContent(resolveContentImages(bookStore.activeBook, chapter.content || ''), false)
    }
  }
  message.value = `已替换 ${result.count} 处：正文 ${result.count - result.modifiedTitles}，标题 ${result.modifiedTitles}`
}
</script>
