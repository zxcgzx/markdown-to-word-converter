# v5.2.2 覆盖更新与验收指南

## 一、更新方式

v5.2.2 新增 `css/typography.css`，并同时修改了 HTML、应用脚本、设置项、测试和文档。请整体覆盖仓库，不要只替换某一个 CSS 文件。

解压发布包后，将顶层目录中的全部内容复制到 GitHub 仓库根目录：

```text
markdown-to-word-converter-fusion-v5.2.2/
```

然后提交：

```bash
git add .
git commit -m "Release v5.2.2 global typography system"
git push origin main
```

现有 GitHub Pages 工作流仍位于：

```text
.github/workflows/deploy.yml
```

## 二、缓存刷新

全部本地 CSS 与 JavaScript 资源已经使用：

```text
?v=5.2.2
```

部署后仍看到旧界面时，先执行一次强制刷新：

```text
Windows / Linux: Ctrl + F5
macOS: Command + Shift + R
```

## 三、本版新增文件

```text
css/typography.css
```

该文件必须在以下样式之后加载：

```text
app.css
components/toolbar.css（当前为 toolbar.css）
experience.css
hero.css
typography.css
```

实际 `index.html` 已按正确顺序配置。

## 四、保留的数据

v5.2.2 沿用现有存储键，不会主动清除：

- 浏览器草稿；
- 主题；
- 桌面与手机视图；
- 分栏比例；
- Word 设置；
- AI 配置；
- 本机自动进入状态。

设置对象新增 `uiDensity`。旧数据没有该字段时会自动使用：

```text
standard
```

可选值：

```text
compact
standard
spacious
```

## 五、密码配置

默认密码仍为：

| 密码 | 身份 |
| --- | --- |
| `basic123` | 基础用户 |
| `517517` | 高级用户 |
| `lingling` | 超级管理员 |

统一修改：

```text
js/access-config.js
```

密码入口是纯前端个人使用门槛，不是服务器安全认证。

## 六、发布后建议验收

### 1. 登录页

- 1440、1024、820、390 像素下主标题不越界；
- 标题保持两条受控语义行，手机端可自然重排；
- 密码、分享码、主题切换和自动进入选项可用；
- 错误密码显示清晰错误态；
- 登录成功可进入工作区。

### 2. 字体等级

确认以下层级清楚：

```text
登录主标题 > 工作区产品标题 > 分区标题 > 面板标题
> 普通正文 > 按钮标签 > 状态与辅助信息
```

不要出现多个区域同时使用接近主标题的视觉重量。

### 3. Markdown 预览

粘贴：

````markdown
# 一级标题

正文包含中文、English 和数字 2026。

## 二级标题

### 三级标题

> 引用内容

- 列表项目

```js
const typography = "stable";
```
````

确认：

- H1 > H2 > H3 > 正文 > 代码辅助文字；
- 正文行距适合长文阅读；
- 代码使用等宽字体；
- 工具栏字号不会影响预览字号。

### 4. 界面密度

打开：

```text
设置 → 界面与草稿 → 界面密度
```

依次选择紧凑、标准、宽松，确认：

- 按钮和面板间距逐级增加；
- 字号本身不改变；
- Word 主按钮、工具栏与设置窗口无裁切；
- 手机端仍能正常点击。

### 5. 浏览器缩放

在桌面浏览器分别检查：

```text
100%
125%
150%
200%
```

确认没有横向页面滚动条、标题裁切或按钮重叠。

### 6. 公式与 Word

使用：

```latex
\[
\text{玻片–O–Si–(CH}_2)_3\text{–S–S–(CH}_2)_2
\]
```

确认：

- 网页预览中公式正常；
- 公式状态显示数量和错误；
- 错误公式可定位源码；
- Word/WPS 中常见上下标为可编辑文字；
- 不再出现“请手动添加公式”的占位提示。

### 7. 真实外部依赖

自动测试使用确定性行为桩。部署后应实际确认：

- Marked；
- DOMPurify；
- KaTeX 与 mhchem；
- docx.js；
- FileSaver；
- 真实 AI 接口（使用时）。

## 七、本地自动测试

```bash
npm test
npm run check
```

期望：

```text
75 tests passed
0 tests failed
```

完整质量结果见：

```text
docs/QA_REPORT.md
```
