<template>
  <AppModal :open="open" title="批量设置元数据" @close="emit('close')">
    <p class="mb-3 text-xs text-ink-secondary">
      将应用到已选的 {{ count }} 本书；留空的字段不会被修改。
    </p>
    <div class="space-y-4">
      <div class="flex items-center gap-3">
        <label class="label">作者</label>
        <input v-model="form.author" class="input" placeholder="留空则不修改" />
      </div>
      <div class="flex items-center gap-3">
        <label class="label">语言</label>
        <input v-model="form.language" class="input" placeholder="如 zh-CN，留空则不修改" />
      </div>
      <div class="flex items-center gap-3">
        <label class="label">出版日期</label>
        <input v-model="form.publishDate" type="date" class="input" />
      </div>
      <div class="flex items-center gap-3">
        <label class="label">出版社</label>
        <input v-model="form.publisher" class="input" placeholder="留空则不修改" />
      </div>
      <div class="flex items-center gap-3">
        <label class="label">主题标签</label>
        <input v-model="form.subject" class="input" placeholder="多个用逗号分隔，留空则不修改" />
      </div>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="emit('close')">取消</button>
      <button class="btn-primary" :disabled="count === 0" @click="apply">应用到 {{ count }} 本</button>
    </template>
  </AppModal>
</template>

<script setup>
import { reactive } from 'vue'
import AppModal from '../common/AppModal.vue'

defineProps({
  open: { type: Boolean, default: false },
  count: { type: Number, default: 0 },
})
const emit = defineEmits(['close', 'apply'])

const form = reactive({ author: '', language: '', publishDate: '', publisher: '', subject: '' })

/** 只返回用户填了的字段；未填写的为 null（不修改）。 */
function buildPatch() {
  const patch = {}
  if (form.author.trim()) patch.author = form.author.trim()
  if (form.language.trim()) patch.language = form.language.trim()
  if (form.publishDate) patch.publishDate = form.publishDate
  if (form.publisher.trim()) patch.publisher = form.publisher.trim()
  if (form.subject.trim()) {
    patch.subject = form.subject
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ')
  }
  return patch
}

function apply() {
  emit('apply', buildPatch())
  form.author = ''
  form.language = ''
  form.publishDate = ''
  form.publisher = ''
  form.subject = ''
}
</script>
