import { uuid } from './id'

export const MAX_IMAGE_WIDTH = 1600
export const JPEG_QUALITY = 0.8

/** 从 dataURL 中取 MIME 类型，取不到时按 PNG 处理。 */
export function mimeFromDataUrl(dataUrl = '') {
  const m = String(dataUrl).match(/^data:([^;]+)[;,]/)
  return m ? m[1] : 'image/png'
}

/** 从 MIME 类型得到文件扩展名。 */
export function extFromMime(mime = '') {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/svg+xml') return 'svg'
  return 'png'
}

/** 新建一条书内图片记录。dataUrl 为基准，id 与文件名自动生成。 */
export function createBookImage(dataUrl = '', options = {}) {
  const id = options.id || uuid()
  const type = options.type || mimeFromDataUrl(dataUrl)
  const filename = options.filename || `img-${id.slice(0, 8)}.${extFromMime(type)}`
  return {
    id,
    filename,
    type,
    dataUrl,
    createdAt: new Date().toISOString(),
  }
}

/** File → dataURL。 */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * 对 dataURL 图片做 canvas 降采样/重编码。
 * 宽度超过 maxWidth，或小尺寸但体积超过 1MB 时重绘；不支持 canvas 的环境回退原图。
 */
export async function compressImageDataUrl(dataUrl, { maxWidth = MAX_IMAGE_WIDTH, quality = JPEG_QUALITY } = {}) {
  if (typeof Image === 'undefined' || typeof document === 'undefined') return dataUrl
  // jsdom / 无 canvas 的测试环境直接回退原图，避免图片加载与 canvas 告警
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return dataUrl
  if (typeof HTMLCanvasElement === 'undefined') return dataUrl
  const probeCanvas = document.createElement('canvas')
  if (typeof probeCanvas.getContext !== 'function' || !probeCanvas.getContext('2d')) return dataUrl
  try {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = dataUrl
    })
    const width = img.naturalWidth || img.width
    const height = img.naturalHeight || img.height
    if (!width) return dataUrl

    const shouldDownscale = width > maxWidth
    // 小尺寸但体积很大的图也重编码一次，帮助控制 localStorage 体积
    if (!shouldDownscale && dataUrl.length <= 1024 * 1024) return dataUrl

    const scale = shouldDownscale ? maxWidth / width : 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const sourceType = mimeFromDataUrl(dataUrl)
    // canvas 会压平动画，GIF 保留原文件
    if (sourceType === 'image/gif') return dataUrl
    const outputType = sourceType === 'image/png' ? 'image/png' : 'image/jpeg'
    return canvas.toDataURL(outputType, outputType === 'image/jpeg' ? quality : undefined)
  } catch (err) {
    console.warn('[image] 图片压缩失败，保留原图', err)
    return dataUrl
  }
}

/** File → 压缩后 dataURL（浏览器无 canvas 时直接读取原图）。 */
export async function fileToCompressedDataUrl(file) {
  const dataUrl = await fileToDataUrl(file)
  return compressImageDataUrl(dataUrl)
}

/**
 * 把章节内容里的书内图片引用 book-image://{id} 解析为可显示的 dataURL。
 * 找不到引用时保持原样。
 */
export function resolveContentImages(book, html = '') {
  if (!book || !Array.isArray(book.images)) return html
  const byId = new Map(book.images.map((img) => [img.id, img]))
  return html.replace(/(src|href|xlink:href)="book-image:\/\/([^"]+)"/gi, (match, attr, id) => {
    const img = byId.get(id)
    return img ? `${attr}="${img.dataUrl}"` : match
  })
}

/**
 * 把章节内容里的 dataURL 图片收编进 book.images，并把 src 改写为 book-image://{id}。
 * 已存在于图库中的 dataURL 会复用原 id，避免每次编辑都新增图片。
 * 会直接修改 book.images（若 book.images 不存在则初始化为数组）。
 */
export function normalizeContentImages(book, html = '') {
  if (!book) return html
  if (!Array.isArray(book.images)) book.images = []

  const byDataUrl = new Map(book.images.map((img) => [img.dataUrl, img]))
  const rewritten = html.replace(
    /(<img[^>]*?src=")(data:[^"]+)("[^>]*?>)/gi,
    (match, before, dataUrl, after) => {
      let img = byDataUrl.get(dataUrl)
      if (!img) {
        img = createBookImage(dataUrl)
        book.images.push(img)
        byDataUrl.set(dataUrl, img)
      }
      return `${before}book-image://${img.id}${after}`
    },
  )
  return rewritten
}
