# AI 智能 Markdown 转 Word · 融合体验版 v5.2.2

一个完全运行在浏览器中的 Markdown 编辑、实时预览与 Word 导出工作台。项目保留密码入口、三种本地身份、四套主题和原版玻璃态视觉，同时提供公式预保护、导出前检查、源码定位、可编辑 Word 上下标、AI 修复、表格转换、命令面板和专注模式。

v5.2.2 的主题是 **Global Typography System（全局字体与视觉节奏）**。本版不再依靠各区域零散调整字号，而是让登录页、工作区、工具栏、编辑器、Markdown 预览、设置、诊断和状态提示共同遵循一套稳定的排版语言。

无需后端，也无需构建。打开静态页面即可使用；AI 修复为可选能力。

## 界面预览

### 桌面工作区与全局排版

![v5.2.2 桌面工作区](docs/screenshots/app-v5.2.2-1440.png)

### 独立的 Markdown 文档排版层级

![v5.2.2 文档预览](docs/screenshots/typography-preview-v5.2.2.png)

### 字体与界面密度设置

![v5.2.2 字体设置](docs/screenshots/settings-typography-v5.2.2.png)

### 高级双栏密码入口

![v5.2.2 桌面登录页](docs/screenshots/login-v5.2.2-1440.png)

### 现代黑金主题

![v5.2.2 黑金主题](docs/screenshots/app-v5.2.2-noir.png)

### 手机端

![v5.2.2 手机工作区](docs/screenshots/app-v5.2.2-390.png)

## v5.2.2 全局字体系统

### 1. 八级语义化界面字号

所有界面文本从统一变量取值：

| 等级 | 用途 |
| --- | --- |
| Display | 登录页品牌主标题 |
| Page Title | 工作区产品标题 |
| Section Title | 设置、抽屉与重要分区标题 |
| Card Title | 面板和卡片标题 |
| Body Large | 品牌介绍与重要说明 |
| Body | 普通界面正文 |
| Label | 按钮、字段名和操作标签 |
| Caption | 状态、版本、快捷键和辅助信息 |

公共字重收敛为 `400 / 500 / 600 / 700`，避免同一页面出现过多相近字重造成视觉噪声。

### 2. 界面、编辑器与文档预览相互独立

- 界面使用系统 UI 与中文系统字体回退栈；
- 编辑器使用独立等宽字体和可配置字号；
- Markdown 预览拥有自己的 H1～H6、正文、列表、引用、表格和代码字号；
- Word 导出继续使用 Word 设置中的字体、字号、行距和页边距；
- 工具栏字号变化不会再意外影响文档预览。

### 3. 三种界面密度

设置 → 界面与草稿中可选择：

```text
紧凑   更高信息密度
标准   默认平衡模式
宽松   更大点击区域与留白
```

密度只调整按钮高度、面板间距和内容留白，不改变字体等级，因此切换后不会破坏排版层级。

### 4. 更稳定的中英文混排

- 中文、English、数字和公式使用明确的字体回退；
- 标题使用受控字距与行高；
- 状态数字采用等宽数字，数值变化时不会左右跳动；
- 快捷键使用等宽字体；
- 登录主标题使用两条受控标题行，在桌面和平板宽度不会越界；
- 手机端允许自然重排，避免孤立单字换行。

### 5. 响应式与缩放适配

本版针对 320～1920 像素宽度，以及等效 100%、125%、150%、200% 浏览器缩放完成重排检查：

- 页面无横向溢出；
- 标题、工具栏和大纲不会互相遮挡；
- 手机端仅保留打开、视图切换和 Word 下载；
- 预览标题层级在不同宽度下仍保持明确比例；
- 三种密度不会造成按钮裁切或文字挤压。

### 6. 无新增字体 CDN

字体系统只使用操作系统可用字体：

```text
system-ui / Segoe UI Variable / PingFang SC /
Hiragino Sans GB / Microsoft YaHei UI / sans-serif
```

因此不会新增字体网络请求，也不会因为外部字体服务失败导致页面闪烁或空白。

## 核心操作体验

### 品牌密码入口

- 登录前可切换四套主题；
- 支持密码显示、Caps Lock 提示和精细错误反馈；
- 分享码在登录卡片内部展开；
- 可选择在本机保存自动进入状态；
- 登录成功后平滑进入工作区。

默认本地密码：

| 密码 | 身份 |
| --- | --- |
| `basic123` | 基础用户 |
| `517517` | 高级用户 |
| `lingling` | 超级管理员 |

修改位置：

```text
js/access-config.js
```

本地密码入口只是个人前端工作台的使用门槛，不是服务器级安全认证。

### Command Deck 顶部操作区

```text
文档行：文件 | 文档名 | 视图 | 输出
编辑行：格式 | 公式 | 表格 | AI 修复 | 更多 | 清空
```

- “下载 Word”是唯一高亮主按钮；
- 文档名统一控制 `.md` 和 `.docx` 文件名；
- 窄屏低频工具进入“更多”；
- 移动端只保留五个必要控件。

### 公式与导出闭环

- 在 Marked 解析前保护 `$...$`、`$$...$$`、`\(...\)`、`\[...\]`；
- 自动识别 AI 输出中退化成独立 `[ ... ]` 的 TeX 公式块；
- 排除围栏代码块和行内代码；
- 显示公式数、渲染错误数和边界修复数；
- 错误公式可一键定位到 Markdown 源码；
- 导出前检查公式、代码围栏、图片、表格、链接和标题层级；
- Word 中的常见上下标生成可编辑文字运行，不再插入“请手动添加公式”占位提示。

### 命令面板与专注模式

```text
Ctrl / Command + K           全局命令面板
Ctrl / Command + Shift + F   专注模式
```

命令面板可搜索打开文件、切换视图、插入公式、运行导出检查、打开设置和下载 Word。专注模式隐藏非必要品牌与编辑工具，只保留当前工作区、视图和 Word 主按钮。

## 使用方法

1. 输入密码进入工作区；
2. 粘贴、输入或打开 Markdown 文件；
3. 在预览区确认公式、标题、表格和结构；
4. 查看 Word 按钮的导出就绪状态；
5. 点击“下载 Word”。

常用快捷键：

```text
Ctrl / Command + O       打开 Markdown
Ctrl / Command + S       下载 Markdown
Ctrl / Command + D       下载 Word
Ctrl / Command + Enter   复制富文本
Ctrl / Command + K       命令面板
Ctrl / Command + Shift+F 专注模式
Alt + M                  插入独立公式
```

## 本地运行

```bash
git clone https://github.com/zxcgzx/markdown-to-word-converter.git
cd markdown-to-word-converter
python -m http.server 8000
```

浏览器打开 `http://localhost:8000`。

页面通过 CDN 加载 Marked、DOMPurify、KaTeX、docx.js 和 FileSaver，因此首次使用需要网络连接。

## 自动测试

```bash
npm test
npm run check
```

v5.2.2 当前自动检查包括：

- 75 项 Node 测试；
- 307 项 Chromium 布局、字体、主题、缩放与交互断言；
- 4 个 JavaScript 文件语法检查；
- HTML ID、本地资源和 CSS 解析检查；
- 最终 ZIP 解压后复测。

完整结果见 [`docs/QA_REPORT.md`](docs/QA_REPORT.md)。

## 项目结构

```text
.
├── index.html
├── css/
│   ├── app.css
│   ├── toolbar.css
│   ├── experience.css
│   ├── hero.css
│   └── typography.css
├── js/
│   ├── access-config.js
│   ├── math-engine.js
│   ├── preflight.js
│   └── app.js
├── tests/
├── docs/
├── package.json
└── .github/workflows/deploy.yml
```

## Word 公式说明

当前目标是“可读、可编辑、常见上下标正确”。化学式、变量下标和常见符号会生成 Word 文本运行；复杂分式、矩阵、积分和多行方程仍会转成可编辑线性文本，而不是 Word 原生 OMML 公式对象。

## 浏览器兼容性

建议使用当前版本的 Chrome、Edge 或 Firefox。较旧浏览器对 `<dialog>`、Clipboard API、CSS `color-mix()` 和文件下载能力的支持可能不完整。

## License

MIT
