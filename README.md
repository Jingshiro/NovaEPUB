# NovaEpub

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Tests](https://img.shields.io/badge/tests-136%20%2B%2033%20E2E%20passing-brightgreen)]()
[![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vuedotjs)]() [![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite)]()

> 一款轻量、纯前端、离线优先的 EPUB 可视化编辑器 —— 简化版的 Sigil。

把手头的 EPUB 拖进来就能改：改正文、换封面、调排版、插图片、批量改元数据，改完导出还是标准的 EPUB。**没有账号、没有云端、没有安装**——所有数据只存在你自己的浏览器里。

在线使用：部署后直接访问（见下方「快速开始」），也可以自己 `npm run build` 托管到任意静态空间（GitHub Pages / Cloudflare Pages / Vercel 均可）。

## 功能一览

**编辑**
- 📖 富文本编辑器（TipTap / ProseMirror）：加粗、斜体、下划线、上下标、链接、表格、列表、代码块
- ↩️ 撤销 / 重做：正文编辑与章节、元数据等结构操作均支持
- 🧩 **格式模板**：把常用排版（标题、引用、首字下沉、图片圆角…）存成一键套用的模板；支持每本书独立的模板库，内置 10 个模板
- 🖼️ 图片插入：本地上传 / 粘贴截图，自动压缩（降采样，控制体积），存入书内图库
- ✂️ 章节拆分（光标处）与合并、目录拖拽/箭头重排
- 🔍 全局查找替换：贯穿全书正文与章节标题，保留排版标签
- 👀 预览：整书连续阅读 + 封面 + 目录跳转 + 章节切换，模板样式实时生效

**书籍管理**
- 📚 书架：新建空白书 / 导入 EPUB（容错解析：无 container、无 NCX、缺章节、非 UTF-8 都能读）
- 📝 元数据：书名、作者、语言、出版日期、简介、出版社、主题、版权（贯穿导出 OPF）
- 🖼️ 封面更换 / 移除，导出按实际 MIME 打包
- 🧹 批量操作：多选书籍，批量设置作者 / 语言 / 日期 / 出版社 / 主题，批量删除
- 📥 TXT / Markdown 导入：按章节标记自动切分

**数据安全**
- 💾 崩溃恢复：编辑过程防抖写入 IndexedDB，中断重开后提示恢复草稿
- 📤 一键导出本地备份（`.novaepub` 整库 JSON），换浏览器/换电脑随时导入
- ☁️ **云同步（可选）**：WebDAV（默认坚果云地址）或 S3 兼容（AWS / B2 / R2 / MinIO），整库备份到时间戳快照 + latest，云端保留最近 10 份；同步配置（含密码）只存本机
- ✅ 导出前自检：章节结构、图片/资源引用、样式、封面完整性检查，阻断损坏的导出

**导出**
- 标准 **EPUB 2**（OPF + NCX + XHTML + CSS），符合 OCF 规范（mimetype 首项 STORE 不压缩）
- 图片 / 字体 / CSS / 媒体资源完整打包，兼容性实测严苛场景

**移动端**
- 响应式三栏布局窄屏浮层化，书架抽屉化，支持触屏长按套用模板

## 快速开始

### 直接使用（推荐）

```bash
git clone https://github.com/<你的用户名>/NovaEPUB.git
cd NovaEPUB
npm install
npm run dev        # http://localhost:5173
```

或者直接构建后把 `dist/` 部署到任意静态托管：

```bash
npm run build      # → dist/
```

Windows 用户可以直接双击根目录的 **`启动开发服务器.bat`**。

### 生产部署

没有任何后端依赖，`dist/` 是纯静态文件，推到 GitHub Pages / Cloudflare Pages 就能用。

## 技术栈

- **Vue 3**（Composition API）+ **Vite**
- **Pinia** 状态管理 + **Vue Router**
- **TipTap**（ProseMirror）富文本内核
- **JSZip** EPUB 解析 / 打包、**FileSaver** 下载
- **Tailwind CSS** 自定义设计系统（Notion 式素净配色，全局禁蓝紫）

## 数据与隐私

- 所有书籍数据保存在浏览器 `localStorage`（`novaepub:library`）+ `IndexedDB`（草稿）
- 云同步配置只存本机 `localStorage`，不上传任何服务器（SMTP 密码、应用密码仅本机）
- 不收集任何用户数据，无埋点、无追踪

## 质量保障

- **136 项单元 / 组件测试**（Vitest）覆盖解析、导出、模板、同步、批量等模块
- **33 项端到端测试**（Playwright + 生产构建）覆盖核心链路：新建 → 编辑 → 预览 → 导出；导入带图 EPUB → 图库回环；模板套用/删除样式保持；EPUB 结构规范校验（mimetype STORE 等）；草稿崩溃恢复；移动端布局

```bash
npm test           # 单元 + 组件测试
npm run build      # 构建
```

## 目录结构

```
/src
  /views         # LibraryView（书架）、EditorView（编辑器）
  /components
    /common      # AppModal 等基础组件
    /editor      # 画布 / 菜单栏 / 模板面板 / 元数据弹窗
    /sidebar     # 章节树、样式模板、元数据侧栏
    /preview     # 整书连续阅读预览
    /library     # 批量元数据、云同步弹窗
  /stores        # book / editor / history / templates / ui
  /hooks         # 导入 / 导出封装
  /utils         # epubParser / epubExporter / epubCheck / sync / webdav / s3 / ...
  /router        # 路由（懒加载分包）
  /styles        # 设计 token
```

## 路线图

- [ ] EPUB 3 支持（`nav.xhtml`）
- [ ] IndexedDB 大规模存储迁移（大书超出 localStorage 配额时）
- [ ] 更多键盘快捷键
- [ ] 更多内置模板（题记 / 分隔线 / 脚注…）
- [ ] ESLint + Prettier + CI

白名单内不做的：导出 mobi/azw3（无需求）、插件系统（克制）、小程序端云同步（wx.request 域名白名单死路）。

## License

**AGPL-3.0**。使用 / 修改 / 分发需遵守 [GNU Affero 通用公共许可证 v3.0](https://www.gnu.org/licenses/agpl-3.0)；如果您基于本项目架设在线服务（或修改后分发），必须按同一许可开源您的修改版本（含服务端源码）。

本项目作者保留在其它许可下提供商业授权的权利（另议）。
