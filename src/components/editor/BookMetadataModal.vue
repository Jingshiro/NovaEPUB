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
    </div>
    <template #footer>
      <button class="btn-secondary" @click="uiStore.closeMetadataModal()">取消</button>
      <button class="btn-primary" @click="save">保存</button>
    </template>
  </AppModal>
</template>

<script setup>
import { reactive, watch } from 'vue'
import AppModal from '../common/AppModal.vue'
import { useBookStore } from '../../stores/book'
import { useUiStore } from '../../stores/ui'

const bookStore = useBookStore()
const uiStore = useUiStore()

const form = reactive({ title: '', author: '', publishDate: '', language: '', identifier: '' })

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
  },
)

function save() {
  bookStore.updateBook({ ...form })
  uiStore.closeMetadataModal()
}
</script>
