# Markdown 转 Word · 个人前端版

一个无需后端的 Markdown 编辑、预览与 Word 导出工具。当前版本把核心流程收敛为“输入 → 预览 → 导出”，重点修复了 `\[...\]`、`\(...\)` 等公式边界在 Markdown 解析阶段被反斜杠转义吞掉的问题。

在线页面由 GitHub Pages 发布：

- `https://zxcgzx.github.io/markdown-to-word-converter/`

## v3 核心变化

- 移除登录、密码、用户等级、权限和配额流程，打开页面即可使用。
- 使用独立公式预处理引擎：先保护公式，再解析 Markdown，最后恢复并交给 KaTeX 渲染。
- 支持 `$...$`、`$$...$$`、`\(...\)`、`\[...\]`。
- 自动兼容 AI 输出中退化成独立 `[ ... ]` 的 TeX 公式块，并可写回标准 `\[ ... \]`。
- 跳过围栏代码块和行内代码中的公式标记，避免误转换示例代码。
- 增加公式诊断、错误回退、公式数量和边界修复提示。
- 重做为常驻操作栏、可拖动分栏、大纲导航、同步滚动和本地自动保存。
- Word 导出不再插入“请手动添加公式”的占位提示；公式会转换成可编辑文字及上下标。
- AI 修复保留为可选能力，配置只存当前浏览器；有选区时优先处理选区。
- 增加 TSV / CSV 到 Markdown 表格的转换与插入。

## 公式问题为什么会发生

旧流程是：

```text
Markdown 原文 → marked.parse() → KaTeX 自动查找公式
```

Marked 会先处理反斜杠转义，因此：

```latex
\[
\text{玻片–O–Si–(CH}_2)_3
\]
```

可能先退化为普通的：

```text
[
\text{玻片–O–Si–(CH}_2)_3
]
```

KaTeX 后续已经找不到 `\[` 与 `\]`。v3 改为：

```text
提取并保护公式 → Markdown 解析与净化 → 恢复占位符 → KaTeX 渲染
```

## 使用方法

1. 直接粘贴或输入 Markdown。
2. 在右侧确认预览和公式状态。
3. 点击“下载 Word”生成 `.docx`。

常用操作：

- `Ctrl / Command + O`：打开 Markdown 文件
- `Ctrl / Command + S`：下载 `.md`
- `Ctrl / Command + D`：下载 Word
- `Ctrl / Command + Enter`：复制富文本
- `Alt + M`：插入独立公式

## 本地运行

```bash
git clone https://github.com/zxcgzx/markdown-to-word-converter.git
cd markdown-to-word-converter
python -m http.server 8000
```

浏览器打开 `http://localhost:8000`。

页面依赖 CDN 加载 Marked、DOMPurify、KaTeX、docx.js 和 FileSaver，因此首次打开需要网络连接。

## 自动测试

本项目的公式引擎不依赖构建工具，可直接运行：

```bash
npm test
```

测试覆盖：

- `\[...\]` 在 Markdown 解析前被正确保护
- 松散 `[ ... ]` 公式块自动修复
- 普通方括号文本不被误识别
- 代码块与行内代码排除
- `\(...\)` 中普通括号不导致提前截断
- KaTeX 失败时显示可诊断的源码
- 截图中的化学结构转换为 Word 可编辑上下标
- 货币美元符号不被误当作公式

## 项目结构

```text
.
├── index.html
├── css/
│   └── app.css
├── js/
│   ├── app.js
│   └── math-engine.js
├── tests/
│   └── math-engine.test.js
├── package.json
└── .github/workflows/deploy.yml
```

仓库中旧版 CSS 和文档文件暂时保留，页面已不再引用它们，便于需要时对照或回退。

## Word 公式说明

当前导出目标是“可读、可编辑、上下标正确”。化学式、变量上下标和常见符号会转成 Word 文本运行；复杂分式、矩阵、多行方程会转为可读的线性文本，而不是 Word 原生 OMML 公式对象。

## 浏览器兼容性

建议使用当前版本的 Chrome、Edge 或 Firefox。`<dialog>`、Clipboard API 和文件下载能力在较旧浏览器中可能有限。

## License

MIT
