# 融合体验版 v5.2 更新与验收指南

## 一、本次更新解决什么

v5.2 在 v5.1.2 Command Deck 和导出闭环基础上，重点优化“进入应用”和“熟练使用”两个阶段。

### 登录入口

- 将多卡片说明页重构为品牌介绍与登录操作双栏；
- 登录按钮成为唯一高亮主动作；
- 增加登录前主题切换；
- 增加本机自动进入；
- 分享码改为卡片内部展开；
- 增加 Caps Lock、错误状态、验证中、成功和转场反馈；
- 手机端压缩为首屏优先的单列布局。

### 熟练操作

- 增加 `Ctrl / Command + K` 全局命令面板；
- 增加 `Ctrl / Command + Shift + F` 专注模式；
- 命令搜索按相关性排序；
- 命令面板和登录页支持焦点循环；
- 保留原有 Command Deck、公式诊断、导出前检查和 Word 上下标导出。

## 二、更新前准备

1. 记录当前仓库提交：

   ```bash
   git rev-parse HEAD
   ```

2. 下载重要内容的 `.md` 备份。
3. 备份自己修改过的：

   ```text
   js/access-config.js
   ```

4. 解压 v5.2 完整包。

v5.2 是完整静态项目，可以直接覆盖，不要求先安装旧版本。

## 三、正确覆盖方式

压缩包包含顶层目录：

```text
markdown-to-word-converter-fusion-v5.2/
```

请把该目录中的**全部内容**复制到仓库根目录并覆盖同名文件。不要只替换 `index.html`、`app.js` 或某一个 CSS 文件。

核心运行文件：

```text
index.html
css/app.css
css/toolbar.css
css/experience.css
js/access-config.js
js/math-engine.js
js/preflight.js
js/app.js
```

建议一起提交：

```text
README.md
CHANGELOG.md
LICENSE
package.json
tests/
docs/
.github/workflows/deploy.yml
```

## 四、为什么必须整体覆盖

v5.2 新增：

```text
css/experience.css
```

样式加载顺序为：

```html
<link rel="stylesheet" href="css/app.css?v=5.2">
<link rel="stylesheet" href="css/toolbar.css?v=5.2">
<link rel="stylesheet" href="css/experience.css?v=5.2">
```

`experience.css` 专门负责品牌登录页、命令面板、专注模式和高级交互。HTML 结构、应用脚本和样式必须保持同一版本。

所有本地资源均使用 `?v=5.2`，用于降低 GitHub Pages 或浏览器继续读取旧文件的概率。

## 五、密码、会话与本机自动进入

密码配置仍位于：

```text
js/access-config.js
```

默认密码：

```text
basic123  → 基础用户
517517    → 高级用户
lingling  → 超级管理员
```

关键存储键：

```text
当前会话：md2word.fusion.auth.v5.1
自动进入：md2word.fusion.remembered.v5.2
```

v5.2 有意沿用 v5.1 会话键，以便整体覆盖后尽量保留现有会话、主题、草稿和视图偏好。自动进入使用独立新键。

### 自动进入行为

- 登录时勾选“在这台设备上自动进入”，下次打开会恢复对应本地身份；
- “设置 → 账户与会话”可以查看或清除；
- 点击“退出”只清除当前会话，不主动清除自动进入；
- 想完全回到每次输入密码的模式，请先在账户设置中清除自动进入；
- 如果密码已从 `access-config.js` 删除，残留的自动进入状态会自动失效并清理。

## 六、登录页专项验收

### 1. 桌面端 1440 像素

预期：

- 品牌介绍与登录表单左右分栏；
- 页面只有一个明显主按钮“进入工作台”；
- 左侧三项能力和版本说明不抢登录焦点；
- 访问密码、自动进入和分享码均直接可见；
- 页面没有横向滚动；
- Tab 键不会进入隐藏的后台工作区。

### 2. 手机端 390 像素

预期：

- 品牌标题、能力标签和登录表单纵向排列；
- 密码框与主按钮在首屏附近；
- 自动进入与分享码不重叠；
- 页面没有横向滚动；
- 分享码展开后仍无横向溢出。

### 3. 四套主题

依次点击右上主题按钮，确认：

```text
暖阳琥珀 → 经典浅林 → 现代黑金 → 极光幻彩
```

登录页和进入后的工作区应保持同一主题名称与配色。

### 4. 密码状态

确认：

- 显示和隐藏密码正常；
- Caps Lock 开启时显示提醒；
- 错误密码显示错误文案和输入框错误态；
- 正确密码依次显示“正在验证…”和“验证成功”；
- 登录成功后平滑进入工作区。

### 5. 分享码

点击“粘贴分享码”，分别验证：

```text
basic123
PWD:basic123|basic|2099-12-31
```

错误样例：

```text
PWD:basic123|basic|2020-01-01   # 已过期
PWD:basic123|basic|2025-02-31   # 日期无效
PWD:basic123|advanced|2099-12-31 # 身份不匹配
```

有效分享码应填入密码并自动收起；错误分享码应保留面板并显示具体原因。

### 6. 本机自动进入

1. 勾选自动进入并登录；
2. 刷新页面，预期直接进入；
3. 打开“设置 → 账户与会话”，确认显示已保存身份；
4. 点击清除，刷新页面，预期重新显示登录页。

## 七、命令面板验收

进入工作区后按：

```text
Ctrl / Command + K
```

预期：

- 命令面板居中打开；
- 搜索框立即获得焦点；
- 输入“预览”时，“切换到预览视图”应位于最相关位置；
- 方向键、Home、End、Enter 和 Esc 正常；
- Tab 与 Shift+Tab 始终在面板内循环；
- 执行命令后面板关闭；
- 关闭后焦点恢复到打开前控件。

建议检查以下命令：

```text
打开 Markdown
下载 Word
运行导出前检查
切换到预览视图
插入独立公式
打开统一设置
进入专注模式
```

## 八、专注模式验收

按：

```text
Ctrl / Command + Shift + F
```

预期：

- 品牌标题、编辑工具行和文档名隐藏；
- 保留视图切换、退出专注、下载 Word 和当前工作区；
- 当前为预览视图时，键盘焦点进入预览区域；
- 当前为编辑或分栏视图时，焦点进入编辑器；
- 再次按快捷键、按 Esc 或点击“退出专注”均可恢复；
- 打开设置或表格、AI 等工具时自动退出专注模式。

## 九、核心功能回归

登录和高级交互之外，请确认：

1. 默认空白启动，示例不会自动覆盖内容；
2. 打开、保存 Markdown、复制富文本和下载 Word 正常；
3. 文档名同时控制 `.md` 与 `.docx` 文件名；
4. 编辑、分栏和预览切换正常；
5. 分隔条可拖动、键盘调整和双击重置；
6. 同步滚动可以开关；
7. 大纲下拉框可以跳转标题；
8. 公式诊断可以定位原始 Markdown；
9. 导出前检查可以定位公式、标题、表格、图片和链接问题；
10. 松散 `[ ... ]` 公式可以标准化为 `\[ ... \]`；
11. Word 中化学式和变量上下标保持可编辑；
12. 统一设置中的界面、Word、AI、快捷键和账户分类正常。

## 十、响应式验收

### 1321 像素以上

- 完整双层 Command Deck；
- 文档名自动伸缩；
- Word 是唯一高亮主按钮；
- 编辑工具完整可见。

### 901～1320 像素

- 主流程保持直接可见；
- 低频操作进入“更多”；
- 菜单不超出视口且不会遮挡相邻控件。

### 681～900 像素

- 文档行使用平衡的两列网格；
- 不形成左侧长纵列；
- 右侧不会留下大面积无意义空白。

### 680 像素以下

顶部严格保留：

```text
打开 · 编辑 · 分栏 · 预览 · Word
```

编辑工具行隐藏，页面无横向溢出。

## 十一、本地运行与自动检查

在项目根目录运行：

```bash
python -m http.server 8000
```

浏览器访问：

```text
http://localhost:8000
```

然后执行：

```bash
npm run check
npm test
```

v5.2 当前预期：

```text
JavaScript syntax checks: 4 / 4 passed
Node tests: 60 / 60 passed
Browser regression checks: 299 / 299 passed
```

Node 测试使用内置运行器，不需要安装第三方 npm 包。

## 十二、提交到 GitHub

验收后执行：

```bash
git add .
git commit -m "Release v5.2 brand login and advanced interaction"
git push origin main
```

`.github/workflows/deploy.yml` 会在 `main` 更新后继续发布 GitHub Pages。

## 十三、部署后人工确认

1. GitHub Pages 中 `app.css?v=5.2`、`toolbar.css?v=5.2` 和 `experience.css?v=5.2` 均成功加载；
2. 页面能够加载 Marked、DOMPurify、KaTeX、docx.js 和 FileSaver CDN；
3. 浏览器缩放 90%、100%、110% 和 125% 时布局符合个人习惯；
4. 用实际 Microsoft Word 或 WPS 打开一次包含化学式的 DOCX；
5. 使用自己的 AI 接口、模型和 API Key 完成一次真实请求。

## 十四、回退

需要回退时恢复更新前提交：

```bash
git reset --hard <更新前提交>
```

建议整套回退，不要混用 v5.2 的 HTML、`experience.css` 与旧版脚本。
