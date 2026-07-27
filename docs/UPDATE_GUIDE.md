# v5.4 覆盖更新与验收指南

v5.4 同时修改了页面结构、文档存储、图片素材、页面预览、Word 导出、样式、测试和文档。请整体覆盖仓库，不要只替换 `index.html`、`app.js` 或某个 CSS 文件。

## 一、正确覆盖方式

发布包解压后包含：

```text
markdown-to-word-converter-fusion-v5.4/
```

将该目录中的全部内容复制到 GitHub 仓库根目录：

```bash
git add .
git commit -m "Release v5.4 page preview and image publishing"
git push origin main
```

GitHub Pages 工作流仍位于：

```text
.github/workflows/deploy.yml
```

所有本地 CSS 和 JavaScript 使用：

```text
?v=5.4
```

部署完成后仍看到旧界面时，请等待 Pages 构建结束，再强制刷新：

```text
Windows / Linux：Ctrl + F5
macOS：Command + Shift + R
```

## 二、升级前建议

v5.4 会尽力迁移 v5.3 文档，但重要内容仍建议先做一份外部备份：

1. 下载当前 Markdown；
2. 在 v5.3 中打开 `设置 → 数据与诊断`；
3. 导出工作区 JSON；
4. 记录自定义密码配置；
5. 保留上一版完整 ZIP，便于快速回退。

## 三、必须一起更新的文件

```text
index.html
css/app.css
css/toolbar.css
css/experience.css
css/hero.css
css/typography.css
css/workflow.css
css/publishing.css
js/access-config.js
js/math-engine.js
js/preflight.js
js/workspace-store.js
js/assets.js
js/publishing.js
js/app.js
package.json
tests/
docs/
```

## 四、v5.3 数据兼容

v5.4 使用：

```text
IndexedDB：md2word.workspace.v5.4
localStorage fallback：md2word.workspace.fallback.v5.4
```

首次运行会只读检查并迁移：

```text
旧 IndexedDB：md2word-workspace-v5.3
旧 localStorage：md2word.workflow.documents.v5.3
旧当前文档：md2word.workflow.current.v5.3
早期兼容键：md2word.workspace.fallback.v5.3
```

迁移内容包括：

- 文档 ID、名称和正文；
- 修改时间；
- 光标位置；
- 编辑器和预览滚动位置；
- 桌面视图；
- 文档内嵌的历史版本；
- 最后打开文档。

迁移规则：

- 旧数据不会被删除；
- 已存在的 v5.4 同 ID 文档优先，不会被旧数据覆盖；
- 迁移完成后在新数据库写入一次性标记；
- 关闭“启动时恢复草稿”时，迁移文档会出现在文档中心，但不会强制占据编辑器；
- 存储受限时会降级到 localStorage 或临时内存。

## 五、默认密码

```text
basic123  → 基础用户
517517    → 高级用户
lingling  → 超级管理员
```

统一修改：

```text
js/access-config.js
```

## 六、首轮验收清单

### 1. 登录与基础界面

- 错误密码出现明确提示；
- 正确密码进入工作区；
- 四套主题均可切换；
- 桌面和手机无横向滚动；
- Word 仍是唯一高亮主按钮；
- 命令面板、专注模式和设置窗口可以打开。

### 2. 文档与迁移

从 v5.3 覆盖升级时：

- 打开文档中心；
- 确认旧文档仍在；
- 查看旧文档历史版本；
- 打开旧文档并确认光标和正文；
- 创建副本，确认副本文档可正常编辑。

新安装时：

- 新建两份文档；
- 切换后内容不互相覆盖；
- 保存版本并恢复；
- 导出工作区备份。

### 3. A4 / Letter 页面预览

1. 打开实验报告模板；
2. 切换到 `A4`；
3. 确认显示页数；
4. 在 `设置 → Word 导出` 中切换 Letter；
5. 切换横向；
6. 分别修改四个页边距；
7. 确认页面尺寸与内容区同步变化。

页面预览用于发现布局风险，不要求与 Word 逐像素一致。

### 4. 分页符

- 在光标位置点击“分页”；
- 确认只插入一个分页标记；
- 在 A4 预览中出现下一页；
- 在文档末尾插入分页，确认保留空白下一页；
- 下载 Word，确认分页位置存在。

### 5. 本地图片

依次测试：

- 文件选择器导入 PNG/JPG；
- 从剪贴板粘贴截图；
- 拖入 WebP 或 SVG；
- 在素材库中重新插入；
- 切换小、中、适应页面和原始尺寸；
- 创建文档副本，确认副本中的图片仍显示；
- 删除素材，确认失效引用有明确提示；
- 清理未使用素材。

### 6. 网络图片

在图片工具中输入一个允许跨域访问的图片地址：

- “下载并保存”应进入素材库；
- “只插入外部地址”应保留 URL；
- 导出设置开启“尝试嵌入网络图片”后下载 Word；
- 若服务器禁止 CORS，应出现兼容性提醒，而不是静默丢图。

### 7. 文档模板

依次打开：

```text
通用报告
实验报告
论文初稿
会议纪要
标准操作规程
横向数据表
```

确认模板结构、推荐字号、行距、方向和页边距同步应用。

### 8. 长文模式

- 在设置中切换实时、长文优化和手动刷新；
- 手动模式下编辑内容，确认预览显示待刷新；
- 点击“刷新预览”，确认网页与 A4 同步更新；
- 切回自动模式。

### 9. 公式

测试：

```latex
\[
\text{玻片–O–Si–(CH}_2)_3\text{–S–S–(CH}_2)_2
\]
```

以及：

```latex
(C_\eta=1%C_{\text{curtail}})
```

确认预览正常、诊断可定位、裸公式可以写回标准边界、Word 中上下标可编辑。

### 10. Word 导出

- 使用包含标题、表格、图片、公式和分页符的文档；
- 确认导出前检查没有阻断错误；
- 下载 Word；
- 确认出现成功回执；
- 用实际 Microsoft Word 或 WPS 打开；
- 检查纸张、方向、页边距、图片、分页、中文、表格和上下标。

## 七、本地自动检查

```bash
npm run check
npm test
```

发布版预期：

```text
JavaScript 语法：7 / 7 通过
Node 自动测试：118 / 118 通过
```

完整浏览器和静态检查记录见 `docs/QA_REPORT.md`。

## 八、回退方法

遇到部署环境差异时：

1. 先使用 v5.4 导出工作区备份；
2. 用上一版完整 ZIP 覆盖仓库；
3. 推送到 `main`；
4. 等待 Pages 重新部署；
5. 强制刷新浏览器。

v5.4 新数据库不会因为代码回退而自动删除。上一版代码不会读取 v5.4 图片素材，因此回退前必须先导出备份和重要 Markdown。
