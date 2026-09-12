<template>
  <AppModal :open="uiStore.metadataModalOpen" title="书籍信息" @close="uiStore.closeMetadataModal()">
    <div class="space-y-4">
      <div class="flex items-center gap-3">
        <label class="label">书名</label>
        <input v-model="form.title" class="input" />
      </div>
      <div class="flex items-center gap-3">
        <label class="label">作者</label>
        <input v-model="form.author" class="input" />
      </div>
      <div class="flex items-center gap-3">
        <label class="label">封面</label>
        <div class="flex flex-1 items-center gap-3">
          <div class="h-20 w-14 shrink-0 overflow-hidden rounded-sm border border-line bg-bg-muted">
            <img v-if="form.cover" :src="form.cover" class="h-full w-full object-cover" alt="封面预览" />
            <div v-else class="flex h-full w-full items-center justify-center text-[10px] text-ink-placeholder">无封面</div>
          </div>
          <div class="flex flex-col gap-2">
            <button class="btn-secondary !px-3 !py-1.5 text-xs" @click="pickCover">选择图片</button>
            <button v-if="form.cover" class="text-xs text-danger hover:underline" @click="clearCover">移除封面</button>
          </div>
          <input ref="coverInput" type="file" accept="image/*" class="hidden" @change="onCoverChange" />
        </div>
      </div>
      <div class="flex items-center gap-3">
        <label class="label">出版日期</label>
        <input v-model="form.publishDate" type="date" class="input" />
      </div>
      <div class="flex items-center gap-3">
        <label class="label">语言</label>
        <input v-model="form.language" class="input" placeholder="zh-CN" />
      </div>
      <div class="flex items-center gap-3">
        <label class="label">唯一标识</label>
        <input v-model="form.identifier" class="input" />
      </div>
      <div class="flex items-start gap-3">
        <label class="label pt-1.5">简介</label>
        <textarea v-model="form.description" class="input min-h-20 resize-y" rows="3" placeholder="书籍简介（可选）"></textarea>
      </div>
      <div class="flex items-center gap-3">
        <label class="label">出版社</label>
        <input v-model="form.publisher" class="input" placeholder="可选" />
      </div>
      <div class="flex items-center gap-3">
        <label class="label">主题标签</label>
        <input v-model="form.subject" class="input" placeholder="多个用逗号分隔（可选）" />
      </div>
      <div class="flex items-center gap-3">
        <label class="label">版权信息</label>
        <input v-model="form.rights" class="input" placeholder="如 © 2026 XXX（可选）" />
      </div>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="uiStore.closeMetadataModal()">取消</button>
      <button class="btn-primary" @click="save">保存</button>
    </template>
  </AppModal>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import AppModal from '../common/AppModal.vue'
import { useBookStore } from '../../stores/book'
import { useUiStore } from '../../stores/ui'
import { useHistoryStore } from '../../stores/history'
import { fileToCompressedDataUrl } from '../../utils/image'

const bookStore = useBookStore()
const uiStore = useUiStore()
const historyStore = useHistoryStore()

const form = reactive({
  title: '', author: '', publishDate: '', language: '', identifier: '', cover: '',
  description: '', publisher: '', subject: '', rights: '',
})
const coverInput = ref(null)

watch(
  () => uiStore.metadataModalOpen,
  (open) => {
    if (!open) return
    const book = bookStore.activeBook
    if (!book) return
    form.title = book.title
    form.author = book.author
    form.publishDate = book.publishDate
    form.language = book.language
    form.identifier = book.identifier
    form.cover = book.cover || ''
    form.description = book.description || ''
    form.publisher = book.publisher || ''
    form.subject = book.subject || ''
    form.rights = book.rights || ''
  },
  { immediate: true },
)

function pickCover() {
  coverInput.value?.click()
}

async function onCoverChange(e) {
  const file = e.target.files?.[0]
  if (file) {
    form.cover = await fileToCompressedDataUrl(file)
  }
  e.target.value = ''
}

function clearCover() {
  form.cover = ''
}

function save() {
  historyStore.capture('修改书籍信息')
  bookStore.updateBook({ ...form })
  uiStore.closeMetadataModal()
}
</script>
