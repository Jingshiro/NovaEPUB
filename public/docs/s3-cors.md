# 给 S3 / R2 存储桶打开「跨域」（给小白的步骤）

NovaEpub 是**纯网页应用**，没有自己的服务器。  
备份时，是**你的浏览器**直接去连你的网盘 / S3。  

如果存储桶没说「允许这个网站访问」，浏览器会拦下来，界面上往往只显示「网络错误」或「Failed to fetch」——这不是书坏了，是**跨域（CORS）**没配好。

下面用 **Cloudflare R2** 举例（AWS S3 / Backblaze B2 / MinIO 步骤类似，控制台长得不一样而已）。

---

## 一分钟版

1. 打开你的 R2 / S3 控制台，选中用来备份的那个**桶（Bucket）**
2. 找到 **Settings → CORS policy**（有的叫「跨域资源共享」）
3. 粘贴下面这段，把域名改成你实际打开 NovaEpub 的网址
4. 保存 → 回到 NovaEpub 再点一次「测试连接」或「立即备份」

---

## 可以直接抄的 CORS 配置

把 `https://jingshiro.github.io` 换成你自己的站点地址（末尾不要多斜杠）。

```json
[
  {
    "AllowedOrigins": [
      "https://jingshiro.github.io"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

如果你还会在 **本机调试**（`http://localhost:5173`），可以多写一条 origin：

```json
[
  {
    "AllowedOrigins": [
      "https://jingshiro.github.io",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Cloudflare R2 在哪里贴？

1. Cloudflare 控制台 → **R2** → 点进你的桶  
2. 左侧或顶部找 **Settings**  
3. 找到 **CORS Policy** → **Edit**  
4. 粘贴上面的 JSON → **Save**

### AWS S3 在哪里贴？

1. S3 控制台 → 选桶 → **Permissions（权限）**  
2. 最下面 **Cross-origin resource sharing (CORS)** → **Edit**  
3. 粘贴 JSON → **Save changes**

---

## WebDAV 为什么也容易失败？

和 S3 一样：浏览器直连网盘，网盘**没返回允许跨域的响应头**就会失败。  
有的网盘（例如部分坚果云设置）支持网页端访问，有的死活不行。

若 WebDAV 一直报错、地址和密码又确认无误，可以：

- 换一个明确支持浏览器/WebDAV 跨域的网盘；或  
- **改用 S3 兼容存储**（R2 / B2 / MinIO），并按上面配好 CORS。

---

## 配完还是不行？

请依次检查：

1. **AllowedOrigins** 是否和你浏览器地址栏**完全一致**（协议 + 域名，一般不含路径）  
2. 是否改错了桶（备份配置里的 Bucket 名要和控制台里一致）  
3. 改完 CORS 后**刷新页面**再试（浏览器可能缓存了旧的预检结果）  
4. 企业网 / 公司代理也可能拦请求，可换手机热点试一下

---

## 隐私说明

- 访问密钥 / 密码只存在**你的浏览器本机**，NovaEpub 没有服务器，也不会把密钥发给项目作者。  
- 备份文件上传到的是**你自己的**桶 / 网盘。
