# v5 融合体验版质量检查记录

## 检查范围

- 静态 HTML、CSS、JavaScript 完整性
- 密码入口与原版视觉保留情况
- 用户提出的 11 项体验改进
- Markdown 公式提取、边界修复和失败回退
- DOCX 公式可编辑上下标转换
- 桌面端与 390 像素移动端布局

## 自动测试结果

执行：

```bash
npm test
npm run check
```

结果：

```text
21 tests passed
0 tests failed
JavaScript syntax checks passed
```

测试组成：

- `tests/fusion-static.test.js`：12 项界面、工作流和结构测试
- `tests/math-engine.test.js`：9 项公式引擎测试

## 11 项体验改进验证

### 常驻操作栏与唯一主按钮

- 顶部存在 `position: sticky` 的操作栏。
- 操作按文件、编辑、视图和输出分组。
- HTML 中只有一个 `.primary-button`，对应“下载 Word”。
- 浏览器滚动检查中工具栏顶部位置为 `0`，粘性定位正常。

### 空白启动

- 默认配置 `restoreDraftOnStart: false`。
- 初始化流程不会自动载入公式示例。
- 空预览提供打开文件、加载公式示例和条件式草稿恢复。

### 大纲与缩略导航

- 存在 `outlineSelect` 大纲下拉框。
- HTML、CSS 和 JavaScript 中均无旧 `previewMinimap`、位置记忆或找回按钮。

### 可调分栏与同步滚动

- 分隔条支持 Pointer Events 拖动。
- 桌面与移动分栏比例分别写入本地存储。
- 支持键盘调整和双击恢复均分。
- 同步滚动使用双方可滚动距离的比例，而不是直接复制像素位置。

### 公式状态与详情

- 状态格式为“公式 N · 错误 N · 修复 N”。
- 详情可显示渲染失败、源公式、错误信息和边界修复。
- KaTeX 失败时保留可见源码，不会静默丢失内容。

### 反馈与模态框精简

- 页面只有一个 `<dialog>`：统一设置。
- AI 和表格使用内联工具抽屉。
- 普通成功、保存和视图反馈进入紧凑状态栏。
- `toast()` 只有在错误类型时创建卡片。
- 页面无配额、“今日剩余”等状态。

### 移动端

390 × 844 浏览器级检查结果：

```text
可见顶部动作：打开、编辑、分栏、预览、下载 Word
工具栏横向溢出：0
页面横向溢出：0
桌面标题区账户按钮：隐藏
底部“设置与账户”：可见
```

### Word 公式导出

- 导出代码调用独立的 `decodeMathSource()` 与 `latexToWordSegments()`。
- 每个文本片段映射到 docx.js `TextRun`。
- 下标与上标分别使用 `subScript`、`superScript`。
- 代码中不存在“请手动添加公式”提示。

## 公式引擎验证

已通过：

- `\[...\]` 在 Markdown 解析前被保护。
- `\(...\)` 内普通括号不会提前截断。
- 多行 `$$...$$` 和行内 `$...$` 可共存。
- `$5`、`$10` 等货币写法不会被识别为公式。
- 围栏代码块与行内代码中的公式标记保持原样。
- 独立 `[ ... ]` TeX 块可修复，普通方括号说明不误转换。
- KaTeX 抛错时生成可诊断回退。
- 截图中的化学结构被转换成 Word 可编辑文字和下标运行。

## 静态一致性

- HTML 共 88 个 ID，全部唯一。
- `app.js` 中所有直接 `byId(...)` 引用均能在 HTML 中找到。
- 页面只有一个设置对话框和一个主按钮。
- 三个 JavaScript 核心文件均通过 `node --check`。
- CSS 大括号配对正常。
- 本地脚本、样式、测试和文档路径完整。

## 浏览器级烟雾检查

由于检查环境阻止浏览器直接访问本地 HTTP 地址及外部 CDN，本次将项目原始 HTML、CSS 和本地 JavaScript 不改动地注入无头 Chromium，并为 Marked、DOMPurify、KaTeX、docx.js、FileSaver 和浏览器存储提供确定性桩对象，用来验证实际界面控制逻辑与响应式布局。公式解析内核则由 Node 测试直接执行真实代码。

桌面端检查摘要：

```json
{
  "primaryCount": 1,
  "dialogCount": 1,
  "minimapCount": 0,
  "mathStatus": "公式 3 · 错误 1 · 修复 0",
  "formulaInspectorVisible": true,
  "dependencyVisible": false,
  "runtimeErrors": []
}
```

移动端检查摘要：

```json
{
  "visibleTopActions": ["打开", "编辑", "分栏", "预览", "下载 Word"],
  "toolbarOverflow": 0,
  "pageOverflow": 0,
  "heroUtilitiesVisible": false,
  "mobileSettingsVisible": true
}
```

## 仍需部署后人工确认

- 在实际 GitHub Pages 网络环境中确认所有 CDN 依赖成功加载。
- 下载真实 DOCX 后，用目标版本的 Microsoft Word 或 WPS 打开一次。
- 复杂分式、矩阵、积分和多行方程目前是线性可编辑文本，不是 Word 原生 OMML 公式。
- AI 请求是否成功取决于服务商接口、模型、API Key 和浏览器跨域策略。
