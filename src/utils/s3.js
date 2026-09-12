/**
 * S3 兼容存储（AWS SigV4 签名，纯前端实现，无 SDK 依赖）。
 * 适用于 AWS S3 / Backblaze B2 / Cloudflare R2 / MinIO 等 S3 兼容服务。
 * 使用 path-style URL：{endpoint}/{bucket}/{key}。
 *
 * cfg: {
 *   endpoint:    'https://s3.us-east-1.amazonaws.com'（含协议，不带末尾斜杠，可带端口）
 *   region:      'us-east-1'
 *   bucket:      'my-backups'
 *   accessKeyId, secretAccessKey
 *   folder:      'NovaEPUB'（key 前缀目录）
 * }
 */

const encoder = new TextEncoder()

function toBytes(data) {
  if (typeof data === 'string') return encoder.encode(data)
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  throw new TypeError('不支持的输入类型')
}

/** SHA-256 hex（签名规范要求小写 hex）。 */
export async function sha256Hex(data = '') {
  const hash = await crypto.subtle.digest('SHA-256', toBytes(data))
  return hex(hash)
}

export function hex(buffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function hmacRaw(keyData, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    toBytes(keyData),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', key, toBytes(data))
}

/** HMAC-SHA256 小写 hex（对外可测）。 */
export async function hmacHex(keyData, data) {
  return hex(await hmacRaw(keyData, data))
}

/** SigV4 派生签名密钥（返回 raw bytes）。 */
export async function signingKey(secretAccessKey, dateStamp, region, service = 's3') {
  const kDate = await hmacRaw(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = await hmacRaw(kDate, region)
  const kService = await hmacRaw(kRegion, service)
  return hmacRaw(kService, 'aws4_request')
}

/** URI 编码（AWS 要求：不编码的字符仅 A-Za-z0-9-._~）。 */
export function amzUriEncode(str, encodeSlash = true) {
  let out = ''
  for (const ch of String(str)) {
    if (/[A-Za-z0-9_.~-]/.test(ch)) {
      out += ch
    } else if (ch === '/') {
      out += encodeSlash ? '%2F' : '/'
    } else {
      const bytes = encoder.encode(ch)
      for (const b of bytes) out += `%${b.toString(16).toUpperCase().padStart(2, '0')}`
    }
  }
  return out
}

/** UTC 时钟串：ISO基本格式 yyyymmddThhmmssZ 与 yyyymmdd。 */
export function amzDates(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  const iso = date.toISOString()
  const amzDate = iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return { amzDate, dateStamp: amzDate.slice(0, 8) }
}

/** 规范查询串（按参数名排序，逐个 uriEncode）。 */
export function canonicalQuery(params = {}) {
  return Object.keys(params)
    .sort()
    .map((k) => `${amzUriEncode(k)}=${amzUriEncode(String(params[k]))}`)
    .join('&')
}

/** 规范 key 路径（逐段编码，保留 '/'）。 */
function canonicalPath(key = '') {
  const segments = String(key).split('/').filter((s) => s !== '')
  const path = segments.map((s) => amzUriEncode(s, false)).join('/')
  return path ? `/${path}` : '/'
}

/**
 * 构造签名后的请求。
 * 返回 { url, headers }，headers 里含 Authorization / x-amz-date / x-amz-content-sha256。
 */
export async function signS3Request({ method, endpoint, bucket, region, accessKeyId, secretAccessKey, key = '', query = {}, body = '' }, now = new Date()) {
  const base = String(endpoint || '').replace(/\/+$/, '')
  if (!base) throw new Error('请填写 Endpoint URL')
  if (!bucket) throw new Error('请填写 Bucket')
  if (!region) throw new Error('请填写 Region')
  if (!accessKeyId || !secretAccessKey) throw new Error('请填写 AccessKeyId 与 SecretAccessKey')

  const { amzDate, dateStamp } = amzDates(now)
  const payloadHash = await sha256Hex(body)
  const canonicalUri = canonicalPath([bucket, key])
  const canonicalQueryStr = canonicalQuery(query)
  const host = base.replace(/^https?:\/\//, '')
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryStr,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const scope = `${dateStamp}/${region}/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  const kSigning = await signingKey(secretAccessKey, dateStamp, region)
  const signature = hex(await hmacRaw(kSigning, stringToSign))

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const url = query && Object.keys(query).length
    ? `${base}/${[bucket, ...String(key).split('/').filter(Boolean)].map((s) => encodeURIComponent(s)).join('/')}?${canonicalQueryStr}`
    : `${base}/${[bucket, ...String(key).split('/').filter(Boolean)].map((s) => encodeURIComponent(s)).join('/')}`

  return {
    url,
    headers: {
      Authorization: authorization,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
    },
  }
}

async function s3Request(cfg, method, key, query, body = '', extraHeaders = {}, fetchImpl = fetch) {
  const signed = await signS3Request(
    { method, endpoint: cfg.endpoint, bucket: cfg.bucket, region: cfg.region, accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, key, query, body },
    new Date(),
  )
  const res = await fetchImpl(signed.url, { method, headers: { ...signed.headers, ...extraHeaders }, body: body || undefined })
  return res
}

function s3Folder(cfg) {
  return String(cfg.folder || 'NovaEPUB').replace(/^\/+|\/+$/g, '')
}

/** 测试连接：ListObjectsV2 拿 1 个 key。 */
export async function s3TestConnection(cfg, fetchImpl = fetch) {
  const res = await s3Request(cfg, 'GET', '', { 'list-type': '2', 'max-keys': '1' }, '', {}, fetchImpl)
  if (res.status === 401 || res.status === 403) throw new Error('密钥无效或没有权限（401/403）')
  if (res.status === 404) throw new Error('Bucket 不存在（404），请检查 Endpoint 与 Bucket 名')
  if (!res.ok) throw new Error(`服务器响应 ${res.status}，请检查 Endpoint/Region`)
  return true
}

/** 上传文本到 {folder}/{relPath}。 */
export async function s3PutText(cfg, relPath = '', text = '', fetchImpl = fetch) {
  const key = [s3Folder(cfg), ...String(relPath).split('/').filter(Boolean)].join('/')
  const res = await s3Request(cfg, 'PUT', key, {}, text, {}, fetchImpl)
  if (!res.ok) throw new Error(`上传失败（${res.status}）`)
  return key
}

/** 读取远端文本。404 返回 null。 */
export async function s3GetText(cfg, relPath = '', fetchImpl = fetch) {
  const key = [s3Folder(cfg), ...String(relPath).split('/').filter(Boolean)].join('/')
  const res = await s3Request(cfg, 'GET', key, {}, '', {}, fetchImpl)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`拉取失败（${res.status}）`)
  return res.text()
}

/** 列出 {folder}/ 下的备份文件名（ListObjectsV2）。 */
export async function s3ListBackups(cfg, fetchImpl = fetch) {
  const prefix = `${s3Folder(cfg)}/`
  const res = await s3Request(cfg, 'GET', '', { 'list-type': '2', prefix, 'max-keys': '1000', delimiter: '/' }, '', {}, fetchImpl)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`读取目录失败（${res.status}）`)
  const xml = await res.text()
  return parseS3KeyList(xml, prefix)
}

/** 解析 ListObjectsV2 响应中的 <Key>，返回文件名（去掉前缀，剔除目录占位）。 */
export function parseS3KeyList(xml = '', prefix = '') {
  const names = []
  const re = /<(?:\w+:)?Key>([^<]+)<\/(?:\w+:)?Key>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const key = m[1]
    if (!key.startsWith(prefix)) continue
    const rest = key.slice(prefix.length)
    if (!rest || rest.includes('/')) continue // 剔除 sub-dir 占位与子目录
    names.push(rest)
  }
  return names
}

/** 删除远端对象（清理旧备份）。 */
export async function s3DeleteObject(cfg, relPath = '', fetchImpl = fetch) {
  const key = [s3Folder(cfg), ...String(relPath).split('/').filter(Boolean)].join('/')
  const res = await s3Request(cfg, 'DELETE', key, {}, '', {}, fetchImpl)
  if (res.ok || res.status === 404) return true
  throw new Error(`删除失败（${res.status}）`)
}
