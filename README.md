# NovaEpub

> 一款轻量、可视化的 EPUB 编辑器。

一款**纯前端、零安装**的 EPUB 可视化编辑器，替代 Sigil 的复杂代码视图，提供自定义格式模板 + 点选套用 + 极致的排版预览。

## 功能特性

- **书架 / 导入**：左侧书目列表 + 中央「新建 EPUB」卡片（点击创建空白书）；支持拖拽或点击「导入 .epub」上传并自动解析（JSZip 解压 → 解析 OPF / NCX）。书籍主数据存 `localStorage`，编辑过程会额外防抖备份到 IndexedDB 草稿。
- **轻量可视化 Sigil 式编辑**：三栏布局（左目录 / 中画布 / 右样式模板 + 属性面板）。
  - **自定义格式模板**：模板是一段带 `$1` 占位符的 HTML 片段，可内嵌 `<style>` 定义 CSS；支持可视化表单 + 原始 HTML/CSS 两种编辑方式。
  - **点选套用**：选中文本或图片后**右键 / 长按**弹出模板菜单，选择即可把选中内容嵌入模板的 `$1` 位置。
  - **图片插入**：工具栏「插入图片」上传本地文件，或直接 Ctrl+V 粘贴剪贴板截图；图片以 dataURL 存入内容，导出时打包进 `OEBPS/images/`。
  - 目录支持新增 / 删除 / 重命名（双击）/ 上移下移排序；粘贴纯文本自动清理格式。
- **元数据管理**：书名、作者、出版日期、语言、唯一标识（UUID）。
- **封面更换**：书籍信息弹窗内可选择/预览/移除封面；导出时按封面实际 MIME 输出对应文件。
- **崩溃恢复**：编辑内容防抖写入 IndexedDB 草稿，重开页面自动检测并提示恢复，避免编辑中断丢稿。
- **导出前自检**：导出 EPUB 前检查章节、图片/资源引用、样式与封面问题，阻断明显损坏的导出。
- **预览模式**：手机尺寸（375px 居中）iframe 模拟阅读器（含模板样式）。
- **导出 EPUB**：自动生成 OPF + NCX + XHTML + CSS，JSZip 打包并下载；自动提取并改写 dataURL 图片到 `OEBPS/images/`、把模板 `<style>` 编译进 `styles.css`，符合 W3C EPUB 规范（mimetype 首项且不压缩）。

## 技术栈

- Vue 3 (Composition API) + Vite
- Pinia（状态管理）、Vue Router（`/library` 与 `/editor/:bookId`）
- TipTap (ProseMirror) 富文本内核
- JSZip（EPUB 打包 / 解析）、FileSaver（下载）
- Tailwind CSS（自定义设计系统）

## 设计系统

柔和、留白、功能性；**全局禁用蓝紫色系**。

| 用途 | 颜色 |
| --- | --- |
| 主背景 | `#FFFFFF` |
| 卡片背景 | `#FFFFFF` |
| 分割背景 | `#F7F6F3` |
| 主文字 | `#37352F` |
| 次级文字 | `#787774` |
| 占位文字 | `#9F9F9B` |
| **主色调（炭黑）** | `#37352F` |
| 辅助色（浅暖灰） | `#E9E8E4` |
| 边框 | `#E9E8E4` |
| 危险色 | `#D44C47` |

## 快速开始

Windows 下最简单：双击项目根目录的 **`启动开发服务器.bat`**，会自动安装依赖并启动。

```bash
npm install
npm run dev      # 开发：http://localhost:5173
npm run build    # 生产构建 → dist/
npm test         # 单元测试（Vitest）
```

## 目录结构

```
/src
  /assets
  /components
    /common      # AppButton, AppInput, AppModal
    /editor      # EditorCanvas, EditorMenuBar, BlockPicker, BookMetadataModal
    /sidebar     # ChapterTree, MetadataPanel
    /preview     # MobilePreviewFrame
  /stores        # book, editor, ui
  /hooks
  /utils         # id, storage, epubParser, epubExporter
  /styles        # tailwind.css（设计 token）
  /router
  /views         # LibraryView, EditorView
  App.vue
  main.js
```

## 数据流

- 完全基于 `localStorage`（键 `novaepub:library` 存储 `{ bookId: book }`），并辅以 IndexedDB 草稿（DB `novaepub-drafts`）做崩溃恢复兜底。
- `bookStore` 管理书籍对象与章节数组；`editorStore` 记录当前章节与 TipTap 实例；`uiStore` 管理侧边栏、预览模式、元数据弹窗。
- 导出流程：`bookStore` → 生成 OPF / NCX / XHTML / CSS → JSZip 打包 `mimetype`、`META-INF`、`OEBPS` → 生成 Blob 并下载。

## 未来移植

- **APK**：纯静态，可用 PWA Builder / Nitron 直接指向 `index.html` 打包。
- **小程序**：仅规划；TipTap 在 webview 中运行，未来用 `web-view` 组件内嵌本网页。广告位预留在底部（开发阶段忽略）。
