/**
 * WebDAV 客户端（fetch 实现），适用于任意标准 WebDAV 服务。
 * 仅网页端使用：需要浏览器允许跨域（多数个人网盘服务允许直接网页访问）。
 *
 * cfg: { serverUrl, username, password, folder }
 */

/** Basic 认证头（支持非 ASCII 用户名，如手机号/邮箱中文） */
export function encodeBasicAuth(user = '', pass = '') {
  const bytes = new TextEncoder().encode(`${user}:${pass}`)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return `Basic ${btoa(bin)}`
}

/** 去掉 serverUrl 结尾的斜杠。 */
export function normalizeServerUrl(url = '') {
  return String(url || '').trim().replace(/\/+$/, '')
}

/** 把相对路径（段数组）拼到服务器地址后面，逐段 encodeURIComponent。 */
export function davUrl(cfg, segments = []) {
  const base = normalizeServerUrl(cfg.serverUrl)
  const path = segments
    .filter((s) => s !== '' && s != null)
    .map((s) => encodeURIComponent(String(s)))
    .join('/')
  return path ? `${base}/${path}` : base
}

/** 主函数级错误包装：给用户友好一点的报错。 */
async function davRequest(cfg, method, url, { body = '', headers = {} } = {}, fetchImpl = fetch) {
  const res = await fetchImpl(url, {
    method,
    headers: {
      Authorization: encodeBasicAuth(cfg.username || '', cfg.password || ''),
      ...headers,
      ...(body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
    },
    body: body || undefined,
  })
  return res
}

/** 测试连接：PROPFIND Depth 0。207/200 都算成功。 */
export async function davTestConnection(cfg, fetchImpl = fetch) {
  if (!normalizeServerUrl(cfg.serverUrl)) throw new Error('请填写服务器地址')
  const res = await davRequest(cfg, 'PROPFIND', davUrl(cfg), {
    headers: { Depth: '0' },
    body:
      '<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:resourcetype/></D:prop></D:propfind>',
  }, fetchImpl)
  if (res.status === 401) throw new Error('账号或密码错误（401）')
  if (res.status === 403) throw new Error('没有访问权限（403），使用「应用密码」而不是登录密码')
  if (res.status >= 400) throw new Error(`服务器响应 ${res.status}，请检查地址是否为 WebDAV 服务`)
  return true
}

/** 逐级创建目录（部分服务器要求父目录先存在；已存在时忽略 405/301）。 */
async function davMkdirp(cfg, segments, fetchImpl) {
  for (let i = 1; i <= segments.length; i++) {
    try {
      await davRequest(cfg, 'MKCOL', davUrl(cfg, segments.slice(0, i)), {}, fetchImpl)
    } catch {
      // 网络层已失败的话后续 PUT 也会失败，这里忽略
    }
  }
}

/** 上传文本到 {folder}/{relPath}，自动补建目录。返回远端完整路径段数组。 */
export async function davPutText(cfg, relPath = '', text = '', fetchImpl = fetch) {
  const folder = (cfg.folder || 'NovaEPUB').replace(/^\/+|\/+$/g, '')
  const segments = [folder, ...String(relPath).split('/').filter(Boolean)]
  await davMkdirp(cfg, segments.slice(0, -1), fetchImpl)
  const res = await davRequest(cfg, 'PUT', davUrl(cfg, segments), { body: text }, fetchImpl)
  if (!res.ok) throw new Error(`上传失败（${res.status}）`)
  return segments
}

/** 读取远端文本。404 返回 null。 */
export async function davGetText(cfg, relPath = '', fetchImpl = fetch) {
  const folder = (cfg.folder || 'NovaEPUB').replace(/^\/+|\/+$/g, '')
  const segments = [folder, ...String(relPath).split('/').filter(Boolean)]
  const res = await davRequest(cfg, 'GET', davUrl(cfg, segments), {}, fetchImpl)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`拉取失败（${res.status}）`)
  return res.text()
}

/** 列出 {folder}/ 下的文件名（来自 PROPFIND Depth 1）。 */
export async function davListBackups(cfg = {}, fetchImpl = fetch) {
  const folder = (cfg.folder || 'NovaEPUB').replace(/^\/+|\/+$/g, '')
  const res = await davRequest(cfg, 'PROPFIND', davUrl(cfg, [folder]), {
    headers: { Depth: '1' },
    body:
      '<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:getlastmodified/></D:prop></D:propfind>',
  }, fetchImpl)
  if (res.status === 404) return []
  if (res.status === 401) throw new Error('账号或密码错误（401）')
  if (!res.ok && res.status !== 207) throw new Error(`读取目录失败（${res.status}）`)
  const text = await res.text()
  return parseDavDirList(text)
}

/** 从 PROPFIND 响应里解析出当前目录的文件名（不含子目录的）。 */
export function parseDavDirList(xml = '') {
  const files = []
  const re = /<(?:\w+:)?href>([^<]+)<\/(?:\w+:)?href>/gi
  const hrefs = []
  let m
  while ((m = re.exec(xml)) !== null) hrefs.push(m[1])
  for (const raw of hrefs) {
    let href = raw
    try {
      href = decodeURIComponent(raw)
    } catch {
      // 保留原样
    }
    // 去掉末尾集合的斜杠后，仍以斜杠结尾的是目录（原样以 / 结尾）
    if (/\/$/.test(href)) continue
    const name = href.split('/').filter(Boolean).pop()
    if (name && !files.includes(name)) files.push(name)
  }
  return files
}

/** 删除远端单个文件（清理旧备份用）。404 视为已删。 */
export async function davDelete(cfg, relPath = '', fetchImpl = fetch) {
  const folder = (cfg.folder || 'NovaEPUB').replace(/^\/+|\/+$/g, '')
  const segments = [folder, ...String(relPath).split('/').filter(Boolean)]
  const res = await davRequest(cfg, 'DELETE', davUrl(cfg, segments), {}, fetchImpl)
  if (res.ok || res.status === 404) return true
  throw new Error(`删除失败（${res.status}）`)
}
