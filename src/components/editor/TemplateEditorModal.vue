<template>
  <AppModal :open="open" :title="isNew ? '新建模板' : '编辑模板'" @close="emit('close')">
    <div class="space-y-4">
      <!-- 名称与目标 -->
      <div class="flex items-center gap-3">
        <label class="label">模板名</label>
        <input v-model="form.name" class="input" placeholder="如：强调引用" />
      </div>
      <div class="flex items-center gap-3">
        <label class="label">目标类型</label>
        <select v-model="form.target" class="input">
          <option v-for="(label, key) in targetLabels" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>

      <!-- 模式切换 -->
      <div class="flex items-center gap-2 rounded-btn border border-line bg-bg-muted p-0.5">
        <button
          class="flex-1 rounded-btn px-3 py-1.5 text-sm transition-colors"
          :class="mode === 'visual' ? 'bg-bg-card text-ink shadow-card' : 'text-ink-secondary'"
          @click="switchMode('visual')"
        >可视化</button>
        <button
          class="flex-1 rounded-btn px-3 py-1.5 text-sm transition-colors"
          :class="mode === 'html' ? 'bg-bg-card text-ink shadow-card' : 'text-ink-secondary'"
          @click="switchMode('html')"
        >HTML / CSS</button>
      </div>

      <!-- 可视化表单 -->
      <div v-if="mode === 'visual'" class="grid grid-cols-2 gap-3">
        <div class="col-span-2 flex items-center gap-3">
          <label class="label">标签</label>
          <input v-model="form.tag" class="input" :placeholder="defaultTagHint" />
        </div>
        <div>
          <p class="text-xs text-ink-placeholder mb-1">字号</p>
          <input v-model="form.fontSize" class="input" placeholder="1.2em / 18px" />
        </div>
        <div>
          <p class="text-xs text-ink-placeholder mb-1">字重</p>
          <select v-model="form.fontWeight" class="input">
            <option value="">默认</option>
            <option value="400">400 常规</option>
            <option value="600">600 半粗</option>
            <option value="700">700 粗体</option>
          </select>
        </div>
        <div>
          <p class="text-xs text-ink-placeholder mb-1">颜色</p>
          <input v-model="form.color" class="input" placeholder="#37352F" />
        </div>
        <div>
          <p class="text-xs text-ink-placeholder mb-1">对齐</p>
          <select v-model="form.textAlign" class="input">
            <option value="">默认</option>
            <option value="left">左</option>
            <option value="center">居中</option>
            <option value="right">右</option>
          </select>
        </div>
        <div>
          <p class="text-xs text-ink-placeholder mb-1">背景</p>
          <input v-model="form.background" class="input" placeholder="#F7F6F3" />
        </div>
        <div>
          <p class="text-xs text-ink-placeholder mb-1">内边距</p>
          <input v-model="form.padding" class="input" placeholder="0.5em 1em" />
        </div>
        <div>
          <p class="text-xs text-ink-placeholder mb-1">外边距</p>
          <input v-model="form.margin" class="input" placeholder="1em 0" />
        </div>
        <div>
          <p class="text-xs text-ink-placeholder mb-1">左边框</p>
          <input v-model="form.borderLeft" class="input" placeholder="3px solid #E9E8E4" />
        </div>
        <div>
          <p class="text-xs text-ink-placeholder mb-1">行高</p>
          <input v-model="form.lineHeight" class="input" placeholder="1.8" />
        </div>
        <div class="col-span-2 flex items-center gap-3">
          <label class="label">CSS 类名</label>
          <input v-model="form.className" class="input" placeholder="可选，如 tpl-note" />
        </div>
        <label class="col-span-2 flex items-center gap-2 text-sm text-ink">
          <input v-model="form.italic" type="checkbox" class="accent-accent" /> 斜体
        </label>
      </div>

      <!-- HTML / CSS 模式 -->
      <div v-else>
        <p class="text-xs text-ink-placeholder mb-1">用 <code class="rounded bg-bg-muted px-1">$1</code> 占位符标记选中内容插入位置</p>
        <textarea v-model="form.html" rows="8" class="input font-mono"
          placeholder='<blockquote style="border-left:4px solid #E9E8E4;padding:0.6em 1em;">$1</blockquote>'></textarea>
      </div>

      <!-- 实时预览：sandbox iframe 隔离，模板里的脚本不会在宿主页面执行 -->
      <div>
        <p class="text-xs text-ink-placeholder mb-1">预览（选中内容将替换 $1）</p>
        <iframe
          class="h-24 w-full rounded-card border border-line bg-bg-card"
          sandbox=""
          :srcdoc="previewDoc"
          title="模板预览"
        ></iframe>
      </div>
    </div>

    <template #footer>
      <button class="btn-secondary" @click="emit('close')">取消</button>
      <button class="btn-primary" @click="save">保存</button>
    </template>
  </AppModal>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import AppModal from '../common/AppModal.vue'
import {
  buildTemplateFromForm,
  parseHtmlToForm,
  wrapWithTemplate,
  defaultTag,
  TARGET_LABELS,
} from '../../utils/template'

const props = defineProps({
  open: { type: Boolean, default: false },
  template: { type: Object, default: null },
})
const emit = defineEmits(['close', 'save'])

const targetLabels = TARGET_LABELS
const isNew = computed(() => !props.template)
const mode = ref('visual')

const form = reactive({
  id: '',
  name: '',
  target: 'paragraph',
  tag: '',
  className: '',
  fontSize: '',
  fontWeight: '',
  italic: false,
  color: '',
  textAlign: '',
  background: '',
  padding: '',
  margin: '',
  borderLeft: '',
  lineHeight: '',
  html: '',
})

const defaultTagHint = computed(() => defaultTag(form.target))

const currentHtml = computed(() => {
  if (mode.value === 'html') return form.html
  return buildTemplateFromForm(form)
})

const previewHtml = computed(() => {
  const sample = form.target === 'image' ? '示例图片文字' : '这是一段用于预览的示例文本'
  return wrapWithTemplate(currentHtml.value, `<span>${sample}</span>`)
})

/** 给 sandbox iframe 用的完整文档（无脚本权限）。 */
const previewDoc = computed(() => {
  const body = previewHtml.value
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:12px;font:14px/1.6 -apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#37352f;background:#fff}
    *{box-sizing:border-box}
  </style></head><body>${body}</body></html>`
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    mode.value = 'visual'
    if (props.template) {
      Object.assign(form, parseHtmlToForm(props.template.html, props.template.target))
      form.id = props.template.id
      form.name = props.template.name
      form.target = props.template.target
    } else {
      Object.assign(form, {
        id: '', name: '', target: 'paragraph', tag: '', className: '',
        fontSize: '', fontWeight: '', italic: false, color: '', textAlign: '',
        background: '', padding: '', margin: '', borderLeft: '', lineHeight: '', html: '',
      })
    }
  },
  { immediate: true },
)

function switchMode(m) {
  if (m === 'visual') {
    // 从 HTML 反解析回可视化字段（尽力而为）
    Object.assign(form, parseHtmlToForm(form.html, form.target))
    form.name = form.name || '未命名模板'
  }
  mode.value = m
}

function save() {
  const html = currentHtml.value.replace(/\s+/g, ' ').trim()
  const payload = {
    id: form.id || undefined,
    name: (form.name || '未命名模板').trim(),
    target: form.target || 'custom',
    html,
    ...(form.id ? {} : {}),
  }
  emit('save', payload)
}
</script>
