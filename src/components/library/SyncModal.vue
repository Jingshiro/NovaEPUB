<template>
  <AppModal :open="open" title="云同步（仅网页端）" @close="emit('close')">
    <div class="space-y-5">
      <p class="text-xs text-ink-secondary">
        把整个书库备份到你的个人网盘/S3。配置只保存在本机。
      </p>

      <!-- 提供方选择 -->
      <div class="flex items-center gap-3">
        <label class="label">同步到</label>
        <div class="flex items-center rounded-btn border border-line bg-bg-muted p-0.5">
          <button
            class="rounded-btn px-3 py-1 text-xs transition-colors"
            :class="form.provider === 'webdav' ? 'bg-bg-card text-ink shadow-card' : 'text-ink-secondary'"
            @click="form.provider = 'webdav'"
          >WebDAV</button>
          <button
            class="rounded-btn px-3 py-1 text-xs transition-colors"
            :class="form.provider === 's3' ? 'bg-bg-card text-ink shadow-card' : 'text-ink-secondary'"
            @click="form.provider = 's3'"
          >S3 兼容</button>
        </div>
      </div>

      <!-- WebDAV 配置 -->
      <div v-if="form.provider === 'webdav'" class="space-y-3">
        <div class="flex items-center gap-3">
          <label class="label">服务器</label>
          <input v-model="form.webdav.serverUrl" class="input" placeholder="https://dav.example.com/dav/" />
        </div>
        <div class="flex items-center gap-3">
          <label class="label">账号</label>
          <input v-model="form.webdav.username" class="input" autocomplete="off" />
        </div>
        <div class="flex items-center gap-3">
          <label class="label">密码</label>
          <input v-model="form.webdav.password" type="password" class="input" autocomplete="new-password" />
        </div>
        <div class="flex items-center gap-3">
          <label class="label">目录</label>
          <input v-model="form.webdav.folder" class="input" placeholder="NovaEPUB" />
        </div>
        <p class="text-xs text-ink-placeholder">账号一般是注册邮箱；多数服务需要「应用密码」而不是登录密码（如坚果云在「安全选项」里生成）。</p>
      </div>

      <!-- S3 配置 -->
      <div v-else class="space-y-3">
        <div class="flex items-center gap-3">
          <label class="label">Endpoint</label>
          <input v-model="form.s3.endpoint" class="input" placeholder="https://s3.us-east-1.amazonaws.com" />
        </div>
        <div class="flex items-center gap-3">
          <label class="label">Region</label>
          <input v-model="form.s3.region" class="input" placeholder="us-east-1" />
        </div>
        <div class="flex items-center gap-3">
          <label class="label">Bucket</label>
          <input v-model="form.s3.bucket" class="input" />
        </div>
        <div class="flex items-center gap-3">
          <label class="label">AccessKeyId</label>
          <input v-model="form.s3.accessKeyId" class="input" autocomplete="off" />
        </div>
        <div class="flex items-center gap-3">
          <label class="label">SecretKey</label>
          <input v-model="form.s3.secretAccessKey" type="password" class="input" autocomplete="new-password" />
        </div>
        <div class="flex items-center gap-3">
          <label class="label">目录</label>
          <input v-model="form.s3.folder" class="input" placeholder="NovaEPUB" />
        </div>
      </div>

      <!-- 状态行 -->
      <p v-if="status" class="text-xs" :class="statusOk ? 'text-ink-secondary' : 'text-danger'">{{ status }}</p>

      <div class="flex flex-wrap gap-2 border-t border-line pt-4">
        <button class="btn-secondary !px-3 !py-1.5 text-xs" :disabled="busy" @click="doTest">测试连接</button>
        <button class="btn-secondary !px-3 !py-1.5 text-xs" :disabled="busy" @click="doSave">保存配置</button>
        <button class="btn-primary !px-3 !py-1.5 text-xs" :disabled="busy" @click="doUpload">
          {{ busy && mode === 'upload' ? '备份中…' : '立即备份' }}
        </button>
        <button class="btn-secondary !px-3 !py-1.5 text-xs" :disabled="busy" @click="doRefreshList">查看云端备份</button>
      </div>

      <!-- 云端备份列表 -->
      <div v-if="remoteBackups.length" class="border border-line rounded-card divide-y divide-line overflow-hidden max-h-56 overflow-y-auto">
        <div
          v-for="bk in remoteBackups"
          :key="bk.name"
          class="flex items-center gap-3 px-3 py-2 text-xs"
        >
          <span class="flex-1 text-ink">{{ bk.label }}</span>
          <button class="text-accent hover:underline" :disabled="busy" @click="doRestore(bk)">恢复到此书库</button>
        </div>
      </div>
      <p v-else-if="listLoaded" class="text-xs text-ink-placeholder">云端还没有备份。</p>
    </div>

    <template #footer>
      <button class="btn-secondary" @click="emit('close')">关闭</button>
    </template>
  </AppModal>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import AppModal from '../common/AppModal.vue'
import { useBookStore } from '../../stores/book'
import { useTemplateStore } from '../../stores/templates'
import { testConnection, uploadBackup, listRemoteBackups, downloadBackup } from '../../utils/sync'
import { loadSyncConfig, saveSyncConfig } from '../../utils/syncConfig'
import { buildFullBackupText, parseBackupBundle } from '../../utils/backup'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close'])

const bookStore = useBookStore()
const templateStore = useTemplateStore()
const busy = ref(false)
const mode = ref('')
const status = ref('')
const statusOk = ref(false)
const remoteBackups = ref([])
const listLoaded = ref(false)

const form = reactive(loadSyncConfig())

// 每次打开弹窗时重新载入磁盘配置（保持与磁盘一致）
watch(
  () => props.open,
  (open) => {
    if (!open) return
    Object.assign(form, loadSyncConfig())
  },
  { immediate: true },
)

function currentCfg() {
  return form.provider === 'webdav' ? form.webdav : form.s3
}

async function run(modeName, fn) {
  busy.value = true
  mode.value = modeName
  status.value = ''
  try {
    const msg = await fn()
    if (msg) {
      status.value = msg
      statusOk.value = true
    }
    return msg
  } catch (err) {
    status.value = err.message || String(err)
    statusOk.value = false
    console.warn('[sync]', err)
    return null
  } finally {
    busy.value = false
    mode.value = ''
  }
}

function doTest() {
  return run('test', async () => {
    await testConnection(form.provider, currentCfg())
    return '连接成功 ✓'
  })
}

function doSave() {
  return run('save', async () => {
    saveSyncConfig(loadForSave())
    return '配置已保存到本机'
  })
}

/** 保存前过滤空配置：空字段不覆盖磁盘里的已存值。 */
function loadForSave() {
  const snapshot = loadSyncConfig()
  snapshot.provider = form.provider
  for (const key of ['webdav', 's3']) {
    for (const field of Object.keys(form[key])) {
      const value = form[key][field]
      if (value !== '' && value != null) snapshot[key][field] = value
    }
  }
  return snapshot
}

function doUpload() {
  return run('upload', async () => {
    saveSyncConfig(loadForSave())
    templateStore.ensureLoaded()
    const payload = await buildFullBackupText(bookStore.library, false, {
      templates: templateStore.templates,
      bookTemplates: templateStore.bookTemplates,
    })
    const name = await uploadBackup(form.provider, currentCfg(), payload)
    listLoaded.value = false
    return `备份完成（${name}）。云端自动保留最近 10 份快照。`
  })
}

function doRefreshList() {
  return run('list', async () => {
    saveSyncConfig(loadForSave())
    remoteBackups.value = await listRemoteBackups(form.provider, currentCfg())
    listLoaded.value = true
    return ''
  })
}

async function doRestore(bk) {
  const c = currentCfg()
  const ok = window.confirm(`确定用「${bk.label}」覆盖当前书库？当前书库里不在备份中的书会被删除。建议先「立即备份」一次。`)
  if (!ok) return
  await run('restore', async () => {
    const text = await downloadBackup(form.provider, c, bk.name)
    const { books, templates, bookTemplates } = parseBackupBundle(text)
    // 覆盖式恢复：清掉本地现有书，再逐本导入
    const ids = bookStore.booksList.map((b) => b.id)
    for (const id of ids) bookStore.deleteBook(id)
    for (const book of books) {
      bookStore.importBook(book)
    }
    const addedTpl = templateStore.importTemplates(templates)
    templateStore.importBookTemplates(bookTemplates)
    const tplMsg = addedTpl ? `，新增模板 ${addedTpl} 个` : ''
    return `已恢复 ${books.length} 本书籍${tplMsg}。`
  })
}
</script>
