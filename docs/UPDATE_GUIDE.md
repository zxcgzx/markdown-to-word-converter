# v5.3 覆盖更新与验收指南

v5.3 同时修改了页面结构、工作流引擎、应用逻辑、样式、测试和文档。请整体覆盖仓库，不要只替换 `index.html`、`app.js` 或公式引擎。

## 一、正确的覆盖方式

发布包解压后包含：

```text
markdown-to-word-converter-fusion-v5.3/
```

把这个目录中的全部内容复制到 GitHub 仓库根目录：

```bash
git add .
git commit -m "Release v5.3 reliable workflow"
git push origin main
```

GitHub Pages 工作流仍位于：

```text
.github/workflows/deploy.yml
```

推送到 `main` 后即可继续部署。

## 二、必须一起更新的文件

```text
index.html
css/app.css
css/toolbar.css
css/experience.css
css/hero.css
css/typography.css
css/workflow.css
js/access-config.js
js/math-engine.js
js/preflight.js
js/workflow.js
js/app.js
package.json
tests/
docs/
```

所有本地 CSS 与 JavaScript 资源均使用：

```text
?v=5.3
```

若部署后仍看到旧界面，请先等待 Pages 构建结束，再执行强制刷新：

```text
Windows / Linux：Ctrl + F5
macOS：Command + Shift + R
```

## 三、升级前建议

v5.3 会兼容旧版草稿、主题、视图和 AI 设置，但覆盖代码前仍建议：

1. 下载当前 Markdown；
2. 记录自定义密码配置；
3. 备份自己的 AI 接口参数；
4. 保留上一版 ZIP，便于快速回退。

## 四、本地数据兼容性

v5.3 沿用已有：

```text
md2word.fusion.auth.v5.1
md2word.fusion.remembered.v5.2
md2word.personal.autosave.v3
```

并新增：

```text
IndexedDB：md2word-workspace-v5.3
localStorage fallback：md2word.workflow.documents.v5.3
当前文档：md2word.workflow.current.v5.3
旧草稿迁移标记：md2word.workflow.legacy-migrated.v5.3
```

首次进入时，旧单草稿会在合适条件下迁移为文档中心中的独立文档。v5.3 不会主动删除主题、桌面/手机视图、分栏比例、AI 配置或本机自动进入状态。

若浏览器同时禁用 IndexedDB 和 localStorage，工作区会降级到当前页面的临时内存，并显示“关闭页面后失效”。此时应及时下载 Markdown 或导出工作区备份。

## 五、密码配置

默认密码位于：

```text
js/access-config.js
```

默认值：

```text
basic123  → 基础用户
517517    → 高级用户
lingling  → 超级管理员
```

按需修改此文件即可。三个身份均可使用核心编辑、公式和 Word 导出能力。

## 六、更新后的首轮验收

### 1. 登录与界面

- 错误密码显示明确提示；
- 正确密码可以进入；
- 四套主题都能切换；
- 桌面端和手机端没有横向滚动；
- 开始输入后品牌区自动收起；
- 设置中可以切换为始终展开或始终紧凑。

### 2. 文档中心

- 新建一份文档并输入内容；
- 等待约一秒，打开“文档”查看；
- 新建第二份文档；
- 切回第一份，确认正文、文档名和光标状态仍在；
- 创建副本并删除副本；
- 搜索文档名和正文。

### 3. 版本历史

- 点击“保存当前版本”；
- 修改正文；
- 打开版本历史并恢复旧版本；
- 确认恢复前自动出现保护点；
- 尝试“另存为新文档”。

### 4. 智能粘贴

依次测试：

````text
```markdown
# 标题

正文
```
````

以及从 Excel 复制两行两列表格。应分别去除外层围栏、转换 Markdown 表格，并显示可撤销提示。

### 5. 公式

```latex
\[
\text{玻片–O–Si–(CH}_2)_3\text{–S–S–(CH}_2)_2
\]
```

以及：

```latex
(C_\eta=1%C_{\text{curtail}})
```

确认预览正常、公式状态有统计、错误可定位、裸公式可写回标准边界。

### 6. 备份与诊断

- 打开 `设置 → 数据与诊断`；
- 确认存储模式、文档数量和依赖状态；
- 导出备份；
- 验证 JSON 中默认不包含 API Key；
- 选择“合并导入”恢复；
- 复制诊断报告。

### 7. Word 导出

- 使用不含错误的文档下载 Word；
- 确认出现导出成功回执；
- 回执应显示文件名、公式/表格/图片数量、提醒和耗时；
- 用实际 Microsoft Word 或 WPS 打开文件；
- 检查中文、表格、化学式及上下标。

## 七、本地自动检查

```bash
npm run check
npm test
```

`npm run check` 检查五个 JavaScript 文件语法；`npm test` 运行公式、导出检查、排版、工具栏和可靠工作流测试。

## 八、回退方法

出现部署环境问题时：

1. 用上一版完整 ZIP 覆盖仓库；
2. 推送到 `main`；
3. 等待 Pages 重新部署；
4. 强制刷新浏览器。

v5.3 的 IndexedDB 文档数据不会因为回退代码而自动删除。回退前仍建议先使用 v5.3 的“导出备份”。
