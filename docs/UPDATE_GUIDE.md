# 融合体验版 v5.2.1 更新与验收指南

## 一、本次更新解决什么

v5.2.1 不继续增加按钮，重点修复主工作区顶部“标题过长、换行突兀、身份和快捷按钮像多张独立卡片、中文与英文基线不统一”的视觉问题。

### 工作区品牌区

- 将原来的长标题精简为 `Markdown 转 Word`；
- 使用 `M→W` 独立品牌徽记；
- 以低权重胶囊显示 `AI 智能工作台`；
- 将公式解析、导出检查和源码定位整理成轻量能力轨道；
- 将身份信息与命令、专注、主题、设置、退出整理成统一快捷操作坞；
- 保留四套主题、原版渐变和玻璃态气质。

### 响应式行为

- 宽屏保持品牌区与快捷入口左右布局；
- 1120 像素及以下改为上下布局；
- 820 像素及以下操作坞占满可用宽度；
- 680 像素及以下隐藏次要身份和快捷入口，只保留紧凑产品标题与价值说明；
- 320～1920 像素均无页面横向溢出或按钮遮挡。

## 二、更新前准备

1. 记录当前仓库提交：

   ```bash
   git rev-parse HEAD
   ```

2. 下载重要文档的 `.md` 备份。
3. 备份自己修改过的密码配置：

   ```text
   js/access-config.js
   ```

4. 解压 v5.2.1 完整包。

v5.2.1 是完整静态项目，可以直接覆盖，不要求先安装旧版本。

## 三、正确覆盖方式

压缩包包含顶层目录：

```text
markdown-to-word-converter-fusion-v5.2.1/
```

请把该目录中的**全部内容**复制到仓库根目录并覆盖同名文件。不要只替换 `index.html` 或某一个 CSS 文件。

核心运行文件：

```text
index.html
css/app.css
css/toolbar.css
css/experience.css
css/hero.css
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

v5.2.1 新增：

```text
css/hero.css
```

样式加载顺序为：

```html
<link rel="stylesheet" href="css/app.css?v=5.2.1">
<link rel="stylesheet" href="css/toolbar.css?v=5.2.1">
<link rel="stylesheet" href="css/experience.css?v=5.2.1">
<link rel="stylesheet" href="css/hero.css?v=5.2.1">
```

`hero.css` 必须在最后加载，才能覆盖旧版标题区中多次累积的布局规则。所有本地脚本也使用 `?v=5.2.1`，用于降低 GitHub Pages 或浏览器继续读取旧缓存的概率。

## 五、密码与本地数据

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

v5.2.1 沿用原有存储键：

```text
当前会话：md2word.fusion.auth.v5.1
自动进入：md2word.fusion.remembered.v5.2
```

因此整体覆盖升级不会仅因为本次视觉更新而主动清除主题、草稿、桌面视图、手机视图或 AI 配置。

## 六、工作区标题专项验收

### 1. 桌面 1440 像素

预期：

- 主标题显示为单行 `Markdown 转 Word`；
- 标题中不再出现机器人 Emoji；
- `AI 智能工作台` 是小型状态徽标，不与主标题同权；
- 当前身份卡位于右侧上方；
- 命令、专注、主题、设置和退出位于同一操作坞；
- 两侧区域不重叠，页面无横向滚动。

### 2. 1120 像素附近

预期：

- 品牌内容位于上方；
- 身份卡和快捷操作坞位于下方同一行；
- 操作坞不遮挡能力说明或作者信息；
- 标题不拆成难看的孤立词。

### 3. 820 像素平板

预期：

- 身份卡单独一行；
- 快捷操作坞占满可用宽度；
- 每个按钮都可以直接点击；
- 页面没有横向滚动。

### 4. 390 像素手机

预期：

- 显示 `M→W`、`Markdown 转 Word` 与 `AI 智能工作台`；
- 隐藏身份卡、能力轨道与快捷操作坞；
- 顶部高度保持紧凑；
- 下方移动端工具栏仍保留打开、视图和 Word 下载。

### 5. 四套主题

依次检查：

```text
暖阳琥珀
经典浅林
现代黑金
极光幻彩
```

确认标题、状态点、身份卡和操作坞在每套主题中均保持足够对比度。

## 七、功能回归清单

覆盖更新后建议至少执行：

1. 错误密码能够显示错误状态；
2. `517517` 能进入高级用户工作区；
3. `Ctrl / Command + K` 能打开命令面板；
4. 专注模式可以进入和退出；
5. 主题按钮可以循环切换；
6. 统一设置可以打开；
7. 编辑、分栏和预览可以切换；
8. 加载公式示例后公式状态更新；
9. 下载 Word 主按钮仍然唯一高亮；
10. 退出后返回密码入口。

## 八、本地自动检查

```bash
npm run check
npm test
```

本次发布基线：

```text
JavaScript syntax checks: 4 / 4 passed
Node tests: 66 / 66 passed
Browser regression checks: 220 / 220 passed
```

更完整的检查范围见：

```text
docs/QA_REPORT.md
```

## 九、提交到 GitHub

```bash
git add .
git commit -m "Release v5.2.1 premium workspace hero"
git push origin main
```

项目已包含 GitHub Pages 工作流，推送到 `main` 后可继续自动部署。

## 十、真实环境仍需确认

自动化使用确定性依赖桩验证本地交互。部署后仍建议人工确认：

- GitHub Pages 能加载 Marked、DOMPurify、KaTeX、docx.js 和 FileSaver；
- Microsoft Word 或 WPS 能打开一份实际生成的 DOCX；
- 自己配置的 AI 接口在当前网络、配额和 CORS 条件下可用。
