# v3 更新说明

日期：2026-07-23

## 根因修复

旧版先执行 `marked.parse()`，再调用 KaTeX 自动渲染。Marked 会把 `\[`、`\]`、`\(`、`\)` 当作反斜杠转义，从而使公式边界在 KaTeX 运行前退化为普通方括号或圆括号。

v3 的处理顺序调整为：

```text
扫描代码块与行内代码
→ 提取并保护公式
→ Marked 解析
→ DOMPurify 净化
→ 恢复并直接渲染 KaTeX
```

## 替换/新增文件

- 替换 `index.html`
- 新增 `css/app.css`
- 替换 `js/app.js`
- 新增 `js/math-engine.js`
- 新增 `tests/math-engine.test.js`
- 替换 `README.md`
- 新增 `package.json`
- 替换 `.github/workflows/deploy.yml`

旧版 CSS 与权限文档没有被删除，但 v3 不再引用。

## 已执行检查

```text
npm test                            9/9 通过
npm run check                       通过
CSS 解析                            通过
无外部依赖 UI 冒烟测试              通过
```

UI 冒烟测试确认：截图中的松散 `[ ... ]` 化学公式块被识别为一个公式，并显示“一处边界修复”。真实 KaTeX、docx.js 与 FileSaver 仍由页面在浏览器中通过 CDN 加载。

## 已知边界

- Word 公式目前导出为可编辑文本与上下标，并非原生 OMML。
- 远程图片不会自动嵌入 DOCX；数据 URI 图片可嵌入，普通远程图片会导出为文字说明。
- 页面仍依赖 CDN，离线使用需要自行下载并改成本地依赖。
- AI 接口能否从浏览器调用取决于服务商的 CORS 设置。
