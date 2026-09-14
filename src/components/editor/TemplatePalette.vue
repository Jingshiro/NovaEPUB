<template>
  <div
    v-if="visible"
    ref="paletteEl"
    class="absolute z-40 w-64 max-w-[calc(100vw-1rem)] overflow-hidden rounded-card bg-bg-card border border-line shadow-card"
    :style="{ top: `${top}px`, left: `${left}px` }"
  >
    <div class="flex items-center justify-between border-b border-line px-3 py-2">
      <span class="text-xs text-ink-placeholder">套用模板</span>
      <button class="text-xs text-accent hover:text-accent-hover" @click="emit('manage')">管理…</button>
    </div>
    <div class="max-h-64 overflow-y-auto py-1">
      <button
        v-for="tpl in templates"
        :key="tpl.id"
        class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-ink hover:bg-bg-muted transition-colors"
        @mousedown.prevent
        @click="select(tpl)"
      >
        <span class="rounded-md bg-bg-muted px-1.5 py-0.5 text-xs text-ink-secondary">{{ label(tpl.target) }}</span>
        <span class="min-w-0 flex-1 truncate">{{ tpl.name }}</span>
      </button>
      <div v-if="templates.length === 0" class="px-3 py-4 text-center text-xs text-ink-placeholder">
        还没有模板，点「管理…」新建
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { TARGET_LABELS } from '../../utils/template'

const props = defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  templates: { type: Array, default: () => [] },
})
const emit = defineEmits(['select', 'close', 'manage'])

const paletteEl = ref(null)

// 弹窗宽度（w-64 = 16rem）与视口留白，用于把浮层夹回屏幕内。
const PALETTE_WIDTH = 256
const VIEWPORT_MARGIN = 8

/**
 * 浮层的屏幕坐标：宽屏沿用原来的 x/y，窄屏（手机）夹回视口内。
 * 长按/右键弹出的位置靠近屏幕右缘时，原样渲染会有一半露在屏幕外，
 * 用户既看不全也点不到「管理…」。
 */
const left = computed(() => clamp(props.x, VIEWPORT_MARGIN, viewportWidth() - PALETTE_WIDTH - VIEWPORT_MARGIN))
const top = computed(() => clamp(props.y + 8, VIEWPORT_MARGIN, maxTop()))

function viewportWidth() {
  return typeof window === 'undefined' ? Number.MAX_SAFE_INTEGER : window.innerWidth
}

/** 竖直方向只保证顶部不越界，底部交给内部滚动，避免把标题栏顶出屏幕。 */
function maxTop() {
  if (typeof window === 'undefined') return Number.MAX_SAFE_INTEGER
  return Math.max(VIEWPORT_MARGIN, window.innerHeight - 96)
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

function label(target) {
  return TARGET_LABELS[target] || '模板'
}

function select(tpl) {
  emit('select', tpl)
  emit('close')
}

function isInsidePalette(target) {
  return !!paletteEl.value && !!target && paletteEl.value.contains(target)
}

/**
 * 点击浮层外部即关闭。
 * 用 pointerdown（而非 click）：触屏上 click 要等手指抬起且可能被滚动手势吞掉，
 * 而 pointerdown 在鼠标/触摸/触控笔下都能立刻响应。
 * 注意只判断「点击发生在浮层外」，内部点击保持原有 @click 行为。
 */
function onPointerDown(event) {
  if (!props.visible) return
  if (isInsidePalette(event.target)) return
  emit('close')
}

function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
}

/** 右键再次点击浮层外部时也要关：contextmenu 会先于 click 触发，单独兜住。 */
function onContextMenu(event) {
  if (!props.visible) return
  if (isInsidePalette(event.target)) return
  emit('close')
}

// 只在弹窗打开时挂监听，关闭后立刻摘掉，避免常驻全局监听。
watch(
  () => props.visible,
  (visible) => {
    if (typeof window === 'undefined') return
    if (visible) {
      window.addEventListener('pointerdown', onPointerDown, true)
      window.addEventListener('keydown', onKeydown)
      window.addEventListener('contextmenu', onContextMenu, true)
      window.addEventListener('resize', close)
      window.addEventListener('scroll', close, true)
    } else {
      detach()
    }
  },
  { immediate: true },
)

function close() {
  emit('close')
}

function detach() {
  if (typeof window === 'undefined') return
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('contextmenu', onContextMenu, true)
  window.removeEventListener('resize', close)
  window.removeEventListener('scroll', close, true)
}

onBeforeUnmount(detach)
</script>
