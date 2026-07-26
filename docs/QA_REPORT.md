# v5.2.2 质量检查报告

## 结论

v5.2.2 完成了全局字体系统、独立 Markdown 文档排版、三种界面密度，以及登录页、品牌区、Command Deck、编辑器、设置、诊断和状态反馈的字体统一。

在本次 **75 项 Node 自动测试、307 项 Chromium 布局与交互断言、JavaScript 语法检查、HTML/CSS/资源静态检查、ZIP 完整性检查和解压后复测** 的覆盖范围内，未发现已知阻断性问题。

任何自动化都不能证明前端项目绝对不存在缺陷。真实 CDN、Microsoft Word/WPS、外部图片服务器和 AI 接口仍需在部署环境中完成一次实际验收。

## 本次专项范围

### 全局字体系统

- 八级语义化 UI 字号；
- 独立的 Markdown 文档 H1～H6、正文、辅助文字和代码字号；
- 公共字重限定为 400、500、600、700；
- 统一行高、字距、等宽数字和快捷键字体；
- 系统与中文系统字体回退；
- 无新增字体 CDN。

### 覆盖区域

- 双栏密码入口；
- 工作区品牌标题、能力轨道、身份卡和操作坞；
- 双层 Command Deck；
- 编辑器与统计栏；
- Markdown 预览；
- 表格、AI 和导出检查抽屉；
- 公式诊断；
- 设置窗口；
- 命令面板；
- Toast、状态栏和错误提示；
- 桌面、平板与手机端。

### 三种界面密度

- 紧凑；
- 标准；
- 宽松。

专项检查密度只改变间距和点击区域，不改变语义字号。

## Node 自动测试

执行：

```bash
npm test
```

结果：

```text
75 passed
0 failed
```

| 测试文件 | 数量 | 主要覆盖 |
| --- | ---: | --- |
| `fusion-static.test.js` | 21 | 版本、登录、主题、工作流、命令面板、专注模式、DOM 引用 |
| `hero-layout.test.js` | 6 | 品牌标题、能力轨道、身份卡、操作坞和响应式 |
| `math-engine.test.js` | 16 | 公式边界、错误回退、源码映射和 Word 上下标 |
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

## HTML、CSS 与本地资源

```text
HTML IDs: 135, all unique
Direct DOM references: 111, missing 0
Local resource references: 9, missing 0
CSS parse errors: 0
```

CSS 解析结果：

| 文件 | 规则数 | 错误 |
| --- | ---: | ---: |
| `app.css` | 581 | 0 |
| `toolbar.css` | 48 | 0 |
| `experience.css` | 164 | 0 |
| `hero.css` | 52 | 0 |
| `typography.css` | 138 | 0 |

## Chromium 自动回归

浏览器：系统 Chromium。

项目 HTML、CSS、公式引擎、导出检查器和应用脚本使用实际文件。为了在离线环境中保证确定性，Marked、DOMPurify、KaTeX、docx.js 和 FileSaver 使用行为桩。

总结果：

```text
307 / 307 passed
0 failed
```

### 1. 多宽度字体与布局矩阵

```text
202 / 202 passed
```

检查宽度：

```text
1920 · 1680 · 1440 · 1366 · 1280 · 1180 · 1120 · 1024
900 · 820 · 680 · 560 · 430 · 390 · 360 · 320 px
```

每个宽度检查：

- 登录页无横向溢出；
- 登录容器位于视口内；
- 两条登录标题不越界；
- 登录主按钮保持可点击高度；
- 工作区无横向溢出；
- 品牌主标题无内部溢出；
- 可见工具栏控件中心点可点击；
- 工具栏控件不重叠；
- 大纲标签与下拉框不溢出；
- 预览区无横向溢出；
- 品牌标题 > 说明 > 状态文字；
- H1 > H2 > H3 > 正文 ≥ 代码；
- 手机端只保留打开、三种视图和 Word；
- 页面错误和控制台错误为 0。

### 2. 主题、密度、缩放与高级交互

```text
58 / 58 passed
```

覆盖：

- 暖阳琥珀、经典浅林、现代黑金、极光幻彩；
- 每套主题分别检查桌面和手机；
- 紧凑、标准、宽松三种密度；
- 密度目标尺寸单调递增；
- 密度不改变字体字号；
- 100%、125%、150%、200% 等效缩放重排；
- 超长中英文文档名；
- 命令面板；
- 设置窗口；
- 专注模式；
- 页面错误为 0。

### 3. 完整工作流交互

```text
47 / 47 passed
```

覆盖：

- 初始密码锁定；
- 登录前主题切换；
- 错误密码与 `aria-invalid`；
- 分享码展开、导入和收起；
- 本机自动进入选项交互；
- 高级用户身份更新；
- 文档名编辑；
- 粗体格式命令；
- 浏览器草稿状态；
- 编辑、分栏和预览切换；
- 同步滚动开关；
- TSV 表格转换和插入；
- KaTeX 错误计数；
- 公式诊断；
- 精确源码选择与定位脉冲；
- 导出前检查拦截；
- 清空与撤销；
- 三种密度设置；
- 命令面板搜索；
- 专注模式进入和退出；
- 退出返回密码页；
- 页面与控制台错误为 0。

测试页面以 `about:blank` 注入方式运行，浏览器会拒绝该特殊文档的持久化存储；应用的安全存储降级逻辑因此会显示本地保存提醒。持久化行为本身由静态测试与实际部署验收负责，交互回归不把该测试环境限制视为产品故障。

## 修复过程中发现的问题

### 1. 登录主标题存在内部文字溢出

最初两条标题行使用 `white-space: nowrap`，但父标题仍保留较窄的 `15ch` 限制，部分桌面宽度下 `scrollWidth` 大于 `clientWidth`。

修复：

- 1181 像素以上将标题测量扩展到 `18ch`；
- 821～1180 像素使用受控 `clamp()` 字号；
- 420 像素以下允许自然换行；
- 修复后 320～1920 像素全部通过内部溢出检查。

### 2. 中等宽度的大纲标签被压成竖排

在 901～1180 像素，预览标题、公式状态和大纲下拉框会压缩“大纲”标签。

修复：

- 大纲标签默认禁止换行；
- 901～1180 像素隐藏文字标签，但保留带无障碍名称的下拉框；
- 下拉框使用受控宽度；
- 修复后所有测试宽度均无竖排和遮挡。

### 3. 界面密度必须与字号解耦

初版密度规则存在未来误改字号的风险。

修复：

- 密度变量只控制目标高度、间距、面板留白和行高增量；
- 语义字号变量保持不变；
- 自动测试确认三种密度下工具按钮字号一致。

## ZIP 与解压复测

最终发布包已完成：

```text
ZIP compressed-data integrity: passed
Fresh extraction: passed
Extracted Node tests: 75 / 75 passed
Extracted JavaScript syntax checks: 4 / 4 passed
Extracted HTML duplicate IDs: 0
Extracted missing local resources: 0
Extracted CSS parse errors: 0
Extracted Chromium smoke widths: 1440 / 1120 / 820 / 390
Extracted browser page errors: 0
Extracted browser console errors: 0
```

解压副本能够在四个代表宽度完成密码页加载、正确密码登录、标准密度初始化和工作区显示。

## 自动化边界

部署后仍应人工确认：

1. GitHub Pages 能真实加载全部 CDN；
2. KaTeX 和 mhchem 对实际公式的渲染；
3. Microsoft Word 与 WPS 对 DOCX 的打开效果；
4. 外部图片服务器的跨域和下载策略；
5. AI 服务商、模型、API Key、配额和 CORS；
6. 不同操作系统字体可用性造成的细微字宽差异。
