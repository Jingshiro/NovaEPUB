import { onBeforeUnmount, ref } from 'vue'

/**
 * 长按拖拽排序（触摸端）。
 *
 * 为什么不能用 HTML5 拖放：`draggable="true"` + dragstart/dragover/drop 这套
 * API 在 iOS Safari（以及多数移动浏览器的触摸场景）上根本不触发，章节排序在
 * iPhone 上等于没有。所以触摸端必须自己用 touch 事件实现，桌面端保留 HTML5
 * 拖拽（两者并存，互不干扰）。
 *
 * 交互约定：
 * - 长按 HOLD_MS 毫秒后进入拖拽态（提前松手/移动都算普通点击/滚动）
 * - 拖拽中手指移动超过 MOVE_CANCEL_PX 不算取消（那是拖拽本身），
 *   但在「还没进入拖拽态」之前移动超过该阈值则取消长按（视为滚动）
 * - 拖拽中实时回报目标索引，松手时提交
 *
 * @param {object} options
 * @param {(from:number, to:number)=>void} options.onDrop 松手时提交排序
 * @param {()=>number} options.getItemCount 列表长度（用于夹取目标索引）
 * @param {number} [options.holdMs] 长按阈值
 * @returns {{
 *   dragging: import('vue').Ref<boolean>,
 *   dragIndex: import('vue').Ref<number|null>,
 *   overIndex: import('vue').Ref<number|null>,
 *   suppressClick: () => boolean,
 *   start: (index:number, event:TouchEvent, el?:HTMLElement)=>void,
 *   move: (event:TouchEvent)=>void,
 *   end: (event:TouchEvent)=>void,
 * }}
 */
export function useLongPressDrag({ onDrop, getItemCount, holdMs = 350 } = {}) {
  const dragging = ref(false)
  const dragIndex = ref(null)
  const overIndex = ref(null)

  const HOLD_MS = holdMs
  /** 进入拖拽态之前，手指移动超过这个距离就当作滚动，取消长按 */
  const MOVE_CANCEL_PX = 10
  let holdTimer = null
  let startPoint = null
  /** 行高与列表顶部，用于把手指 Y 坐标换算成索引（拖拽开始时测量一次） */
  let itemHeight = 0
  let listTop = 0
  /** 长按触发过拖拽后，抑制随后的 click（否则会顺带选中章节） */
  let clickSuppressed = false

  function clearHoldTimer() {
    if (holdTimer) {
      clearTimeout(holdTimer)
      holdTimer = null
    }
  }

  /**
   * 测量列表容器与行高，用于把手指 Y 坐标换算成索引。
   * 优先用显式传入的元素（测试/特殊场景），否则从事件里取。
   * currentTarget 只在浏览器派发事件时才存在，直接调用时会是 null，
   * 所以这里回退到 target / 元素自身。
   */
  function measure(event, explicitEl) {
    const el = explicitEl || event?.currentTarget || event?.target
    if (!el || typeof el.getBoundingClientRect !== 'function') return
    const listEl = el.parentElement
    if (!listEl) return
    const rect = listEl.getBoundingClientRect()
    listTop = rect.top
    const rowRect = el.getBoundingClientRect()
    const count = Math.max(1, getItemCount?.() || 1)
    itemHeight = rowRect.height > 0 ? rowRect.height : rect.height / count
  }

  /** 手指 Y 坐标 → 目标索引（相对列表顶部，按行高换算，夹在合法范围内）。 */
  function indexFromY(clientY) {
    const count = getItemCount?.() || 0
    if (count <= 0) return null
    if (!itemHeight) return dragIndex.value
    const raw = Math.floor((clientY - listTop) / itemHeight)
    return Math.min(Math.max(raw, 0), count - 1)
  }

  /** 长按生效：进入拖拽态。 */
  function beginDrag() {
    dragging.value = true
    clickSuppressed = true
    overIndex.value = dragIndex.value
    // 拖拽期间禁止页面滚动，否则列表会跟着手指乱动
    if (typeof document !== 'undefined') {
      document.body.style.overscrollBehavior = 'none'
      document.body.style.touchAction = 'none'
    }
  }

  function reset() {
    clearHoldTimer()
    dragging.value = false
    dragIndex.value = null
    overIndex.value = null
    startPoint = null
    itemHeight = 0
    if (typeof document !== 'undefined') {
      document.body.style.overscrollBehavior = ''
      document.body.style.touchAction = ''
    }
  }

  function start(index, event, explicitEl) {
    if (event?.touches?.length !== 1) {
      reset()
      return
    }
    const touch = event.touches[0]
    dragIndex.value = index
    overIndex.value = index
    startPoint = { x: touch.clientX, y: touch.clientY }
    clickSuppressed = false
    measure(event, explicitEl)
    clearHoldTimer()
    holdTimer = setTimeout(() => {
      holdTimer = null
      beginDrag()
    }, HOLD_MS)
  }

  function move(event) {
    if (event?.touches?.length !== 1) return
    const touch = event.touches[0]

    // 还没进入拖拽态：移动过多 = 用户在滚动，取消长按
    if (!dragging.value) {
      if (!startPoint) return
      const dx = touch.clientX - startPoint.x
      const dy = touch.clientY - startPoint.y
      if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
        clearHoldTimer()
        dragIndex.value = null
      }
      return
    }

    // 拖拽态：阻止页面滚动，实时更新落点
    if (event.cancelable) event.preventDefault()
    const next = indexFromY(touch.clientY)
    if (next !== null) overIndex.value = next
  }

  function end() {
    const from = dragIndex.value
    const to = overIndex.value
    const wasDragging = dragging.value
    reset()
    if (!wasDragging) return
    if (from !== null && to !== null && from !== to) onDrop?.(from, to)
  }

  /**
   * 是否应当抑制这次 click。
   * 长按拖拽结束后浏览器仍会补一个 click，直接当成「选中章节」会让用户
   * 拖完排序后莫名跳章，因此拖拽过就吞掉一次 click。
   */
  function suppressClick() {
    if (!clickSuppressed) return false
    clickSuppressed = false
    return true
  }

  onBeforeUnmount(reset)

  return { dragging, dragIndex, overIndex, start, move, end, suppressClick }
}

export default useLongPressDrag
