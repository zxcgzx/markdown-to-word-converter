# v5.2.3 覆盖更新与验收指南

## 一、更新方式

v5.2.3 修改了公式引擎、应用诊断、页面版本、自动测试和文档。请整体覆盖仓库，不要只替换 `js/math-engine.js`。

解压发布包后，将顶层目录中的全部内容复制到 GitHub 仓库根目录：

```text
markdown-to-word-converter-fusion-v5.2.3/
```

提交：

```bash
git add .
git commit -m "Release v5.2.3 bare inline TeX compatibility"
git push origin main
```

GitHub Pages 工作流仍位于：

```text
.github/workflows/deploy.yml
```

## 二、缓存刷新

全部本地 CSS 与 JavaScript 资源均使用：

```text
?v=5.2.3
```

部署后仍看到旧结果时，执行强制刷新：

```text
Windows / Linux: Ctrl + F5
macOS: Command + Shift + R
```

## 三、本版主要修改

```text
index.html
js/math-engine.js
js/app.js
tests/fusion-static.test.js
tests/math-engine.test.js
README.md
CHANGELOG.md
docs/UPDATE_GUIDE.md
docs/QA_REPORT.md
docs/screenshots/formula-*.png
package.json
```

本版没有增加新的运行时第三方依赖，也没有新增字体 CDN。

## 四、保留的数据

v5.2.3 沿用现有存储键，不会主动清除：

- 浏览器草稿；
- 主题；
- 桌面与手机视图；
- 分栏比例；
- Word 设置；
- AI 配置；
- 界面密度；
- 本机自动进入状态。

覆盖更新后，当前会话通常仍可沿用；浏览器策略或域名变化时可能需要重新输入一次密码。

## 五、密码配置

默认密码：

| 密码 | 身份 |
| --- | --- |
| `basic123` | 基础用户 |
| `517517` | 高级用户 |
| `lingling` | 超级管理员 |

统一修改：

```text
js/access-config.js
```

## 六、公式专项验收

### 1. 截图中的原始写法

粘贴：

```markdown
并报告 6 次外层迭代、57.58 秒，且明确采用 (C_\eta=1%C_{\text{curtail}})。
```

期望：

- 预览显示排版后的行内公式；
- 不再直接显示 `C_\eta` 和 `\text{curtail}` 源码；
- 公式状态显示 `公式 1 · 渲染错误 0 · 自动修复 1`；
- 公式诊断显示“自动识别裸行内公式”；
- 诊断说明同时修正 1 个未转义百分号；
- “定位源码”准确选中原始括号公式；
- “写回标准公式边界”后源码变为：

```latex
\((C_\eta=1\%C_{\text{curtail}})\)
```

### 2. 误识别排除

粘贴：

````markdown
这是普通说明（无需转换），还有 foo(bar)。

[链接](https://example.com)

`(C_\eta=1%C_{\text{curtail}})`

```text
(C_\eta=1%C_{\text{curtail}})
```
````

期望：

- 普通括号不转换；
- Markdown 链接仍是链接；
- 函数调用不转换；
- 行内代码和围栏代码保持源码；
- 原始 HTML 属性、`<code>`、`<pre>`、`<script>`、`<style>` 与注释中的公式样文本保持原样；
- 公式状态显示自动修复 0。

### 3. 中文全角形式

```markdown
采用（C_\eta=1％C_{\text{curtail}}）。
```

期望同样渲染，并可写回标准半角 TeX 语法。

### 4. Word 结果

下载 Word 后确认：

- `η` 是可编辑下标；
- `curtail` 是可编辑下标；
- `%` 正常显示；
- 不出现“请手动添加公式”的占位提示。

## 七、自动修复开关

位置：

```text
设置 → 界面与草稿 → 智能修复缺失的公式边界
```

开启时兼容：

- 独立 `[ ... ]` 公式块；
- 括号中的高置信度裸行内 TeX；
- 公式上下文中可确认的数值百分号。

关闭时，缺失标准边界的内容保持普通文字。标准 `$...$`、`$$...$$`、`\(...\)` 和 `\[...\]` 仍会正常识别。

## 八、自动测试

```bash
npm test
npm run check
```

期望：

```text
94 tests passed
0 tests failed
```

完整质量结果见：

```text
docs/QA_REPORT.md
```

## 九、真实环境建议

自动测试无法代替以下实际验收：

1. GitHub Pages 能加载 Marked、DOMPurify、KaTeX、mhchem、docx.js 和 FileSaver；
2. Microsoft Word 或 WPS 能打开实际生成的 DOCX；
3. 使用自己的模型、API Key 和接口完成一次真实 AI 请求；
4. 外部图片地址符合目标网站的跨域与下载策略。
