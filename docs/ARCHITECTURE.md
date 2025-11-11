# 📐 项目架构说明

## 概述

本项目是一个纯前端的 Markdown 转 Word 在线工具，集成了 AI 智能修复功能。

## 技术栈

### 核心库

- **Marked.js (9.0.0)** - Markdown 解析
- **docx (7.8.2)** - Word 文档生成
- **FileSaver.js (2.0.5)** - 文件下载
- **KaTeX (0.16.8)** - 数学公式渲染

### AI 服务商支持

- Kimi (Moonshot AI)
- 智谱 GLM
- 百川 AI
- DeepSeek
- OpenAI
- Gemini-2.5-Flash
- 自定义服务商（OpenAI 兼容 API）

## 项目结构

```
markdown-to-word-converter/
├── index.html              # 主页面（941 行，相比原来减少 90%）
├── css/
│   ├── themes.css          # 主题配置（4套主题）
│   ├── base.css            # 基础样式
│   ├── components.css      # 组件样式
│   └── responsive.css      # 响应式样式
├── js/
│   └── app.js              # 应用逻辑（5322 行）
├── docs/
│   ├── SECURITY_WARNING.md # 安全警告
│   ├── ARCHITECTURE.md     # 架构文档（本文件）
│   └── PERMISSION_TEST.md  # 权限系统测试文档
├── LICENSE                 # MIT 许可证
├── .gitignore              # Git 忽略文件配置
└── README.md               # 项目说明

原始结构（已优化）：
- index.html.backup         # 原始单文件（9423 行）
```

## 架构设计

### 1. 模块化改造

**优化前**：
- 单个 HTML 文件（387KB、9423 行）
- 所有代码混在一起
- 难以维护和扩展

**优化后**：
```
HTML (941 行)
  └─ head (34 行)
      ├─ meta 标签
      ├─ 外部库引用
      └─ CSS 文件引用 (4 个文件)
  └─ body (905 行)
      └─ 应用界面
  └─ JS 引用 (app.js)
```

### 2. 样式架构

**CSS 拆分策略**：

```
themes.css (240 行)
  └─ CSS 变量定义
      ├─ 暖阳琥珀主题 (:root)
      ├─ 经典浅林主题 ([data-theme="classic"])
      ├─ 现代黑金主题 ([data-theme="noir"])
      └─ 极光幻彩主题 ([data-theme="aurora"])

base.css (485 行)
  └─ 基础样式
      ├─ CSS Reset
      ├─ body 样式
      ├─ 通用布局
      └─ 主题切换器

components.css (2047 行)
  └─ 组件样式
      ├─ 按钮
      ├─ 输入框
      ├─ 模态框
      ├─ Toast 通知
      ├─ 预览区
      └─ AI 相关组件

responsive.css (395 行)
  └─ 响应式设计
      ├─ 平板适配 (@media max-width: 1024px)
      ├─ 移动端适配 (@media max-width: 768px)
      └─ 小屏优化 (@media max-width: 480px)
```

### 3. JavaScript 架构

**当前状态**：
- 单文件（app.js，5322 行）
- 包含所有功能逻辑
- 高度耦合

**主要功能模块**（未物理拆分）：

```javascript
// 权限系统（行 1-1000）
- 用户权限管理
- 密码验证
- Session 管理

// AI 服务（行 1000-3200）
- AI 服务商配置
- AI 修复逻辑
- 结果处理

// Markdown 处理（行 3200-4200）
- 解析
- 预览渲染
- KaTeX 公式支持

// Word 转换（行 4200-5000）
- docx 生成
- 格式处理
- 文件导出

// UI 交互（行 5000-5322）
- 事件处理
- 状态更新
- 主题切换
```

### 4. 数据流

```
用户输入
  ↓
Markdown 解析 (Marked.js)
  ↓
HTML 预览 (实时渲染)
  ├─ KaTeX 公式渲染
  └─ 代码高亮
  ↓
（可选）AI 修复
  ├─ 发送到 AI 服务商
  ├─ 获取修复结果
  └─ 差异对比
  ↓
Word 生成 (docx.js)
  ├─ 段落处理
  ├─ 表格处理
  ├─ 代码块处理
  └─ 样式应用
  ↓
文件下载 (FileSaver.js)
```

### 5. 存储策略

**localStorage**：
- AI 配置
- 用户权限状态
- 主题偏好
- 自定义密码

**sessionStorage**：
- 当前登录状态
- 临时配置

**风险**：⚠️ 所有数据明文存储，详见 [SECURITY_WARNING.md](./SECURITY_WARNING.md)

## 性能优化

### 已实现

- ✅ CSS 模块化（减少重复）
- ✅ 响应式图片加载
- ✅ 主题预加载

### 待实现

- ⏳ 输入防抖（300-500ms）
- ⏳ 虚拟滚动（大文档）
- ⏳ KaTeX 增量渲染
- ⏳ CDN 降级方案
- ⏳ 代码分割（如果引入构建工具）

## 浏览器兼容性

### 支持的浏览器

- Chrome/Edge (推荐)
- Firefox
- Safari
- Opera

### 最低版本要求

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### 兼容性说明

- 使用了 ES6+ 语法（不支持 IE）
- 依赖 localStorage API
- 依赖 Fetch API
- 依赖 CSS 变量

## 部署

### GitHub Pages（当前）

```bash
# 自动部署
git push origin main
# GitHub Pages 会自动构建并部署到:
# https://zxcgzx.github.io/markdown-to-word-converter/
```

### 本地运行

```bash
# 方法 1：使用 Python
python -m http.server 8000

# 方法 2：使用 Node.js
npx serve

# 然后访问：
# http://localhost:8000
```

### 自托管

1. 下载所有文件
2. 上传到 Web 服务器
3. 配置 MIME 类型
4. 访问 index.html

## 未来改进方向

### 短期（1-2 周）

1. **性能优化**
   - 添加防抖/节流
   - 优化大文档处理
   - CDN 降级方案

2. **用户体验**
   - 错误提示优化
   - 加载状态改进
   - 新手引导

3. **文档完善**
   - API 文档
   - 贡献指南
   - 常见问题

### 中期（1-2 月）

1. **架构重构**
   - JavaScript 模块化
   - 引入构建工具 (Vite)
   - 添加单元测试

2. **功能增强**
   - 撤销/重做
   - 模板系统
   - 批量处理

3. **安全加固**
   - 移除假权限系统
   - XSS 防护
   - CSP 策略

### 长期（3+ 月）

1. **后端服务**
   - Node.js/Python API
   - 数据库集成
   - 真实权限系统

2. **功能扩展**
   - 协作编辑
   - 版本控制
   - 云端同步

3. **企业级特性**
   - SSO 集成
   - 审计日志
   - 性能监控

## 贡献指南

### 代码规范

- 使用 4 空格缩进
- 中文注释
- 遵循 DRY 原则

### 提交规范

```
类型: 简短描述

详细描述（可选）

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

### 分支策略

- `main` - 稳定版本
- `develop` - 开发分支
- `feature/*` - 功能分支
- `hotfix/*` - 紧急修复

---

**最后更新时间**：2025-11-10
**版本**：v2.1
