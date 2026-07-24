# v3 更新说明

本压缩包可直接覆盖仓库同名路径。

## 覆盖/新增文件

- `index.html`
- `css/app.css`
- `js/app.js`
- `js/math-engine.js`
- `tests/math-engine.test.js`
- `README.md`
- `package.json`
- `.github/workflows/deploy.yml`

旧版 `css/themes.css`、`css/base.css`、`css/components.css`、`css/responsive.css` 及旧文档可保留；新版页面不再引用这些文件。

## 本地验证结果

- `npm test`：9/9 通过
- `npm run check`：JavaScript 语法检查通过
- `css/app.css`：CSS 解析通过
- 无依赖 UI 冒烟测试：松散 `[ ... ]` 化学公式被识别为 1 个公式并完成边界修复

## 手动提交命令

将压缩包解压到仓库根目录并覆盖同名文件后执行：

```bash
npm test
npm run check
git add index.html css/app.css js/app.js js/math-engine.js tests/math-engine.test.js README.md package.json .github/workflows/deploy.yml
git commit -m "feat: release personal v3 with reliable math rendering"
git push origin main
```

推送后 GitHub Pages 工作流会先运行公式回归测试，再发布页面。
