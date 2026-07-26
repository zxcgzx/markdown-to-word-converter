# v5.2.1 质量检查报告

## 结论

v5.2.1 完成了主工作区标题、品牌徽记、能力轨道、身份卡和快捷操作坞的视觉重构，同时保留 v5.2 的密码入口、命令面板、专注模式、Command Deck、公式诊断、导出前检查和 Word 上下标导出。

在本次 **66 项 Node 自动测试、220 项 Chromium 布局与交互回归、JavaScript 语法检查、HTML/CSS/本地资源静态检查、ZIP 完整性检查与解压后复测** 的覆盖范围内，未发现已知阻断性问题。

有限自动化不能证明任何前端项目绝对不存在缺陷。真实 CDN、Word/WPS、外部图片服务器和 AI 接口仍需要在实际部署环境中完成一次人工验收。

## 本次专项检查范围

### 标题与排版

- `M→W` 品牌徽记存在且只出现一次；
- 工作区主标题不含 Emoji；
- `Markdown 转 Word` 为唯一高权重标题；
- `AI 智能工作台` 为低权重状态徽标；
- 中英文系统字体回退栈、字重、字距和行高规则存在；
- 主标题使用受控最大字号并保持单行；
- 能力轨道、作者和版本信息层级低于主标题。

### 身份与快捷入口

- 当前身份、用户名和版本标签继续由原有 JavaScript 更新；
- 会话解锁状态点可见；
- 命令、专注、主题、设置和退出位于统一操作坞；
- 按钮保留文字标签、图标、键盘焦点和实际点击区域；
- 退出按钮保持弱危险色，不与主操作混淆。

### 响应式

- 1920～1121 像素左右双区；
- 1120～821 像素上下布局；
- 820～681 像素身份卡与全宽操作坞；
- 680～320 像素紧凑品牌标题；
- 页面无横向溢出；
- 标题和操作坞无互相遮挡；
- 可见按钮中心点均由按钮自身接收。

## Node 自动测试

执行：

```bash
npm test
```

结果：

```text
66 tests passed
0 tests failed
```

组成：

| 测试文件 | 数量 | 主要覆盖 |
| --- | ---: | --- |
| `tests/fusion-static.test.js` | 21 | 页面版本、登录、主题、工作流、命令面板、专注模式、ID 与 DOM 引用 |
| `tests/hero-layout.test.js` | 6 | 品牌锁定区、标题层级、能力轨道、身份卡、操作坞和响应式规则 |
| `tests/math-engine.test.js` | 16 | 公式边界、松散公式、代码排除、错误回退、源码映射和 Word 上下标 |
| `tests/preflight.test.js` | 15 | 公式、围栏、标题、表格、图片、链接、位置计算和阻断状态 |
| `tests/toolbar-layout.test.js` | 8 | Command Deck、命名网格、更多菜单、平板和手机布局 |

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

## HTML、CSS 与资源检查

结果：

```text
HTML IDs: 134, all unique
Missing direct DOM references: 0
Local resources: 8, missing 0
CSS parse errors: 0
JavaScript syntax errors: 0
```

检查样式文件：

```text
css/app.css
css/toolbar.css
css/experience.css
css/hero.css
```

四个文件均未发现 CSS 解析错误。

## Chromium 布局与交互回归

浏览器：系统 Chromium。

项目 HTML、CSS、公式引擎、导出检查器和应用脚本使用实际文件。为保证离线环境中的确定性，Marked、DOMPurify、KaTeX、docx.js 与 FileSaver 使用行为桩。

结果：

```text
220 / 220 passed
0 failed
```

### 21 个视口宽度

```text
1920 · 1680 · 1500 · 1440 · 1366 · 1320 · 1280
1200 · 1121 · 1120 · 1024 · 900 · 821 · 820
681 · 680 · 560 · 430 · 390 · 360 · 320 px
```

每个宽度检查：

- 页面无横向溢出；
- 品牌内容与身份/操作区不重叠；
- 操作坞位于标题区边界内；
- 主标题无内部溢出；
- 可见操作按钮中心点可点击；
- 680 像素以下正确隐藏次要入口；
- 标题区高度保持在预期范围；
- 页面无 JavaScript 异常。

### 四主题双视口

每套主题分别在 1440 和 390 像素检查：

```text
暖阳琥珀
经典浅林
现代黑金
极光幻彩
```

检查内容：

- 无横向溢出；
- 标题颜色保持可见；
- 主题渐变存在；
- AI 状态点保持主题化可见。

### 真实本地脚本交互

检查：

- 登录页初始锁定；
- 错误密码提示；
- 高级用户正确登录；
- 身份名称和等级更新；
- 命令面板打开和关闭；
- 专注模式进入和退出；
- 主题切换；
- 设置对话框；
- 编辑、分栏和预览切换；
- 公式示例加载和状态更新；
- 退出后返回登录页；
- 页面错误和控制台错误均为 0。

## 修复过程中发现的问题

### 作者元数据继承旧版胶囊样式

首次截图发现旧 `.author-info span` 规则会让作者行中的内部标点也生成胶囊，造成细碎视觉噪声。

修复：

- 在 `hero.css` 中重置标题区作者行的所有内部 `span`；
- 只对版本信息重新应用胶囊样式；
- 将作者与 TJUT 维持为一条连续元数据。

修复后重新执行全部 Node、浏览器和静态检查，结果全部通过。

## ZIP 与解压复测

最终发布包已完成：

```text
ZIP compressed-data integrity: passed
Fresh extraction: passed
Extracted JavaScript syntax checks: 4 / 4 passed
Extracted Node tests: 66 / 66 passed
Extracted CSS parse errors: 0
Extracted HTML duplicate IDs: 0
Extracted missing local resources: 0
```

解压副本与工作目录的检查结果一致。

## 自动化边界

以下项目仍需部署后人工确认：

1. GitHub Pages 对全部 CDN 的真实访问；
2. Microsoft Word 与 WPS 对生成 DOCX 的真实打开效果；
3. 外部图片服务器的跨域和下载策略；
4. AI 服务商接口、模型、API Key、配额和 CORS；
5. 不同操作系统可用字体导致的细微字宽差异。
