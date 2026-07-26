# v5.2.3 质量检查报告

## 结论

v5.2.3 修复了截图中 `(C_\eta=1%C_{\text{curtail}})` 这类缺少标准边界的裸行内 TeX，并补齐数值百分号转义、源码定位、标准语法写回和 Word 可编辑下标链路。

发布前完成了 Node 自动测试、Chromium 集成回归、JavaScript 语法检查、HTML/CSS/资源静态检查、ZIP 完整性检查，以及从全新目录解压后的复测。在这些覆盖范围内，没有发现已知阻断性问题。

自动化不能证明前端项目绝对不存在缺陷。真实 CDN、Microsoft Word/WPS、外部图片服务器和真实 AI 接口仍需在部署环境完成一次实际验收。

## 本次专项修复

### 1. 缺少公式边界

原始内容：

```latex
(C_\eta=1%C_{\text{curtail}})
```

没有 `$...$` 或 `\(...\)`，旧版会当作普通文字。

修复后仅在括号内部具有高置信度 TeX 结构时自动识别，并在内部规范为：

```latex
\((C_\eta=1\%C_{\text{curtail}})\)
```

### 2. 百分号被 TeX 当作注释

仅在公式上下文中，对紧随数字或数字后空白的 `%` / `％` 进行转义。普通正文中的百分号不修改，已经写成 `\%` 的内容不会重复转义。

### 3. 精确源码映射

- 裸公式保留原始括号范围；
- 多条公式分别定位；
- 与独立 `[ ... ]` 公式修复同时存在时不发生偏移漂移；
- 公式诊断可定位原始 Markdown；
- 写回后使用标准 `\(...\)` 边界与 `\%`。

### 4. Word 可编辑结果

- `_\eta` 转为可编辑 `η` 下标；
- `_{\text{curtail}}` 转为可编辑 `curtail` 下标；
- `\%` 转为普通 `%` 字符；
- 不再插入手工添加公式的占位提示。

### 5. 误识别排除

专项覆盖：

- 普通中文或英文括号说明；
- Markdown 链接；
- 普通函数调用 `foo(bar)`；
- 行内代码；
- 围栏代码块；
- 原始 HTML 属性；
- `<code>`、`<pre>`、`<script>`、`<style>` 与 HTML 注释；
- 关闭自动修复后的裸 TeX。

## Node 自动测试

执行：

```bash
npm test
```

结果：

```text
94 passed
0 failed
```

| 测试文件 | 数量 | 主要覆盖 |
| --- | ---: | --- |
| `fusion-static.test.js` | 23 | 版本、登录、工具栏、命令面板、公式修复入口、DOM 引用、文件选择器可访问名称 |
| `hero-layout.test.js` | 6 | 品牌标题、能力轨道、身份卡、操作坞和响应式 |
| `math-engine.test.js` | 33 | 公式边界、裸 TeX、百分号、源码映射、KaTeX 回退与 Word 上下标 |
| `preflight.test.js` | 15 | 公式、围栏、标题、表格、图片、链接和阻断状态 |
| `toolbar-layout.test.js` | 8 | Command Deck、更多菜单、平板和手机布局 |
| `typography.test.js` | 9 | 字号等级、字体回退、字重、文档比例、密度和响应式 |

## JavaScript 语法检查

执行：

```bash
npm run check
```

结果：

```text
js/access-config.js  passed
js/math-engine.js    passed
js/preflight.js      passed
js/app.js            passed
```

合计：

```text
4 / 4 passed
```

## Chromium 集成回归

总结果：

```text
81 / 81 passed
0 failed
```

测试使用项目真实 HTML、五个 CSS 文件和四个本地 JavaScript 文件。公式链路使用实际 Marked 与 KaTeX 本地副本；DOMPurify、docx.js 和 FileSaver 使用确定性行为桩，以便在无外网环境中稳定验证应用集成。

### 响应式公式矩阵

测试宽度：

```text
1440 · 1180 · 900 · 680 · 390 · 320 px
```

每个宽度检查：

- 密码页无横向溢出；
- 高级用户登录成功；
- 围栏代码块仍被 Marked 正确解析；
- 截图中的裸公式只识别为一个公式；
- KaTeX 渲染错误为 0；
- `%` 与 `curtail` 均出现在 MathML 结果中；
- 公式状态显示自动修复 1；
- 工作区无横向溢出；
- 页面错误和控制台错误为 0。

### 深度工作流

覆盖：

- 公式诊断显示裸行内公式与百分号修复说明；
- “定位源码”准确选中原始括号公式；
- “写回标准公式边界”生成正确的 `\((...)\)` 与 `\%`；
- 写回后自动修复计数回到 0；
- 已有 `\(...\)` 边界但缺少 `\%` 时只修复百分号；
- 普通括号、链接、函数、行内代码和代码块不误转；
- 原始 HTML 属性保持原样，标签中的可见文本仍可识别公式；
- `<code>`、`<pre>` 与 HTML 注释中的公式样文本不会被转换；
- DOCX 集成路径生成正确文件名；
- Word 文本运行中 `η` 与 `curtail` 为下标，`%` 为普通字符；
- 中文全角括号、全角百分号与同段多公式正常；
- 页面错误和控制台错误为 0。

## HTML、CSS 与本地资源

```text
HTML IDs: 135, all unique
Direct DOM references: 111, missing 0
Local resource references: 9, missing 0
Unlabelled controls: 0
Unnamed buttons: 0
CSS parse errors: 0
CSS declaration errors: 0
Temporary release artifacts: 0
UTF-8 / LF checks: passed
```

CSS 检查结果：

| 文件 | 解析到的选择器规则 | 解析错误 | 声明错误 |
| --- | ---: | ---: | ---: |
| `app.css` | 793 | 0 | 0 |
| `toolbar.css` | 82 | 0 | 0 |
| `experience.css` | 213 | 0 | 0 |
| `hero.css` | 84 | 0 | 0 |
| `typography.css` | 153 | 0 | 0 |

## 最终复检中发现并修复的问题

### 隐藏文件选择器缺少可访问名称

静态检查发现隐藏的 `#fileInput` 没有标签或 `aria-label`。虽然该控件只由“打开”按钮触发，不影响鼠标使用，但会降低辅助技术语义完整性。

修复：

```html
aria-label="选择 Markdown 文件"
```

并增加 Node 回归测试防止再次遗漏。

## ZIP 与解压复测

最终发布包执行：

```text
ZIP compressed-data integrity: passed
Fresh extraction: passed
Extracted Node tests: 94 / 94 passed
Extracted JavaScript syntax checks: 4 / 4 passed
Extracted HTML duplicate IDs: 0
Extracted missing direct DOM references: 0
Extracted missing local resources: 0
Extracted CSS parse/declaration errors: 0
Extracted Chromium formula smoke: passed
```

## 自动化边界

部署后仍建议人工确认：

1. GitHub Pages 能真实加载全部 CDN；
2. KaTeX 与 mhchem 能渲染实际使用的复杂公式；
3. Microsoft Word 与 WPS 能打开实际生成的 DOCX；
4. 外部图片服务器的跨域和下载策略；
5. AI 服务商、模型、API Key、配额和 CORS；
6. 不同操作系统字体可用性造成的细微字宽差异。
