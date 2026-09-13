<p align="center">
  <img src="./icon.jpg" width="112" alt="NovaEpub 图标" />
</p>

<h1 align="center">NovaEpub</h1>

<p align="center">
  <a href="https://jingshiro.github.io/NovaEPUB/"><b>🔗 在线使用</b></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/Jingshiro/NovaEPUB">GitHub 仓库</a>
</p>

<p align="center">
  <a href="https://www.gnu.org/licenses/agpl-3.0"><img src="https://img.shields.io/badge/License-AGPL_v3-blue.svg" alt="License: AGPL v3"></a>
  <a href="https://github.com/Jingshiro/NovaEPUB/actions"><img src="https://img.shields.io/badge/tests-141%20%2B%2033%20E2E%20passing-brightgreen" alt="Tests"></a>
  <img src="https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vuedotjs" alt="Vue 3">
  <img src="https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite" alt="Vite">
</p>

> 一个能改 EPUB 的小网页（不是小破站，真没那么破）。
> 纯前端、离线、不收集数据。你的书你自己存着，爱咋咋。

## 这玩意是干嘛的

字面意思：**改 EPUB**。

把文件拖进浏览器 → 改文字 / 换封面 / 套模板 / 批量改元数据 → 导出一个依然标准的 EPUB。

简单来说就是一个对手机端使用更友好的简化版sigil。

## 能干啥（正经版，怕你绕晕）

### 编辑

- 📖 富文本：加粗、斜体、下划线、上下标、链接、表格、列表、代码块。别人有的咱也有，就没必要罗嗦。
- ↩️ 撤销 / 重做：正文和章节、元数据都算上。手滑有救。
- 🧩 格式模板：标题、引用、首字下沉、图片圆角……做成模板一键套用。每本书还能有自己的私房模板库，内置 10 个先用着。
- 🖼️ 图片插入：本地上传或者粘贴截图，自动压缩。真的别一次塞 20MB 的图，求你了。
- ✂️ 章节：光标处拆分、合并下一章、拖拽 / 箭头排序。
- 🔍 全局查找替换：全书正文 + 章节标题，排版标签不拆。
- 👀 预览：整本连续阅读 + 封面 + 目录跳转 + 章节切换，模板样式实时生效。预览着预览着就导出也行。

### 书籍管理

- 📚 书架 / 导入：没 container、没 NCX、缺章节、非 UTF-8 的奇葩 EPUB，都能啃下来。见得多了。
- 📝 元数据：书名、作者、语言、日期、简介、出版社、主题、版权，导出到 OPF 里一个不缺。
- 🖼️ 封面：换 / 删都行，导出按实际 MIME 打包。
- 🧹 批量操作：多选一堆书 → 批量设置作者 / 语言 / 日期 / 出版社 / 主题，或者一键批量删除。
- 📥 TXT / Markdown 导入：按章节标记自动切分，不用自己一章章建。

### 数据安全

- 💾 崩溃恢复：编辑时防抖写进 IndexedDB，页面炸了重开会提示你恢复草稿。比你想的靠谱。
- 📤 本地备份：整库 `.novaepub` 一键带走；也能单本导出 `.novaepub` 工程文件（含模板/图库/元数据），换电脑 / 换浏览器随手导入。
- ☁️ **云同步（可选）**：WebDAV（自己填地址，不绑定任何服务商）或 S3 兼容（AWS / B2 / R2 / MinIO 都行）。整库快照 + latest，云端留最近 10 份。密码 / 密钥只存本机，不传给我（我也没服务器收）。
- ✅ 导出前自检：章节结构、图片资源引用、样式、封面，有问题就拦你，免得导出一个别人打不开的东西。

### 导出

- 标准 **EPUB 2**（OPF + NCX + XHTML + CSS），mimetype 首项 STORE 不压缩，懂的都懂。
- 图片 / 字体 / CSS / 媒体完整打包，不会出现「图哪去了?」的鬼故事。

### 移动端

- 窄屏也能用。三栏变浮层 / 抽屉，触屏长按套模板。坐地铁顺手改一章绰绰有余。

## 怎么用

### 开发

```bash
git clone https://github.com/Jingshiro/NovaEPUB.git
cd NovaEPUB
npm install
npm run dev       # http://localhost:5173
```

Windows 懒人可以直接双击根目录的 **`启动开发服务器.bat`**，它会自己把该干的干了。

### 发布

没有后端，`dist/` 是纯静态文件：

```bash
npm run build
```

然后把 `dist/` 扔到 GitHub Pages / Cloudflare Pages / Vercel 任意一个静态托管，就上线了。真没后端，别找了，找不到的。

## 技术栈

- **Vue 3** + **Vite**
- **Pinia** + **Vue Router**
- **TipTap**（ProseMirror）
- **JSZip** + **FileSaver**
- **Tailwind CSS**（Notion 式素净配色，全球禁蓝紫的那种）

## 数据与隐私

- 书库存浏览器 `localStorage`（`novaepub:library`），草稿走 `IndexedDB`
- 云同步配置只存本机，不会上传到任何不属于你的地方

## 目录结构

```
/src
  /views         # LibraryView（书架）、EditorView（编辑器）
  /components
    /common      # 基础组件
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

## 之后可能搞（也可能不搞）

- EPUB 3（`nav.xhtml`）——看心情
- IndexedDB 大规模存储迁移——书太多超出 localStorage 时再说
- 更多快捷键——现在够用，少了再补
- 更多内置模板——题记 / 分隔线 / 脚注那些，攒够人催再说
- ESLint + Prettier + CI——等哪天想不开

## License

**AGPL-3.0**。要用要改要分发，请看 [GNU Affero 通用公共许可证 v3.0](https://www.gnu.org/licenses/agpl-3.0)。你要是基于它架了个在线服务或改了再发，那你的版本也得按同样许可开源（含服务端）。
