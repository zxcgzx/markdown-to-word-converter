# 🤖 AI智能Markdown转Word转换器

一个功能强大的在线 Markdown 到 Word 文档转换工具，集成 AI 智能修复、多主题配色、实时预览和高质量 Word 文档导出。

## ⚠️ 重要声明

**本项目是学习性质的演示项目，存在已知的安全问题，不适合用于生产环境。**

详细安全说明请阅读：[安全警告文档](./docs/SECURITY_WARNING.md)

## 🔐 访问说明

**个人内测版本** - 此版本需要密码验证才能使用：
- 本工具为内部测试版本，仅供授权用户使用
- 访问时需要输入正确的密码才能进入应用
- 验证状态在当前浏览器会话中保持有效
- ⚠️ **注意**：前端权限系统可被轻易绕过，仅作演示用途

## ✨ 主要功能

### 核心功能
- 🔄 **实时预览** - 输入 Markdown 内容时即时预览效果
- 📄 **Word 文档导出** - 生成高质量的 Word 文档(.docx 格式)
- 📋 **富文本复制** - 复制格式化内容到剪贴板
- 📊 **表格格式转换** - HTML/纯文本/Markdown 表格一键转换并复制到 Excel/Word
- 📁 **文件上传** - 支持 .md/.txt 文件上传和拖拽
- 💾 **草稿管理** - 本地保存和自动保存功能
- ⌨️ **快捷键支持** - Ctrl+S 保存、Ctrl+O 打开、Ctrl+D 下载
- 📊 **实时统计** - 字符数、单词数、行数、阅读时间统计
- 📐 **数学公式** - KaTeX 支持 LaTeX 语法渲染

### AI 智能修复（高级功能）
- 🤖 **整体修复** - 自动修复 Markdown 格式问题
- ✂️ **局部修复** - 选中部分内容进行 AI 修复
- 🧠 **深度优化** - AI 重新组织和优化文档结构
- 🔄 **差异对比** - 修复结果支持原文/修复对比视图
- 🎛️ **自定义模式** - 可选择格式修复、文案润色、结构强化等

### 主题与 UI
- 🎨 **4 套精美主题** - 暖阳琥珀、经典浅林、现代黑金、极光幻彩
- 📱 **响应式设计** - 完美支持移动端和平板
- 🌓 **主题切换** - 一键切换配色，偏好自动保存
- 🎭 **现代化界面** - 玻璃态效果、渐变背景、平滑过渡

## 🎯 支持的 Markdown 语法

- ✅ 标题 (H1-H6)
- ✅ 粗体和斜体文本
- ✅ 有序和无序列表
- ✅ 代码块和行内代码
- ✅ 表格
- ✅ 引用块
- ✅ 链接
- ✅ 水平分割线
- ✅ 数学公式 (LaTeX 语法，支持 KaTeX)

## 🚀 在线体验

访问：[https://zxcgzx.github.io/markdown-to-word-converter](https://zxcgzx.github.io/markdown-to-word-converter)

## 📖 使用说明

### 基础使用

1. 在左侧输入框中输入或粘贴 Markdown 内容
2. 右侧会实时预览渲染效果
3. 点击"下载 Word"生成 .docx 文件
4. 使用"复制富文本"可直接粘贴到 Word 等应用

### AI 修复功能

1. 配置 AI 服务商和 API 密钥（支持 Kimi、GLM、DeepSeek、OpenAI、Gemini 等）
2. 点击"整体修复"或"深度优化"按钮
3. 选择修复侧重点（格式修复、文案润色、结构强化等）
4. 查看差异对比，决定是否应用修复结果

### 主题切换

点击右上角主题按钮，循环切换 4 套主题配色。

## ⌨️ 快捷键

- `Ctrl+S` - 保存草稿
- `Ctrl+O` - 打开文件
- `Ctrl+D` - 下载 Word 文档
- `Enter` - 在密码输入框中提交验证

## 🛠️ 技术栈

### 核心库
- HTML5 + CSS3 + JavaScript（纯前端，无需后端）
- [Marked.js 9.0.0](https://marked.js.org/) - Markdown 解析
- [docx 7.8.2](https://github.com/dolanmiu/docx) - Word 文档生成
- [FileSaver.js 2.0.5](https://github.com/eligrey/FileSaver.js) - 文件下载
- [KaTeX 0.16.8](https://katex.org/) - 数学公式渲染

### AI 服务商支持
- Kimi (Moonshot AI)
- 智谱 GLM
- 百川 AI
- DeepSeek
- OpenAI
- Gemini-2.5-Flash
- 自定义服务商（支持 OpenAI 兼容 API）
- 默认预置 Kimi `moonshot-v1-32k` 与 GLM `glm-4-flash`，所有用户可直接配置自己的 API Key 和代理地址

## 📁 项目结构

```
markdown-to-word-converter/
├── index.html                 # 主页面（941 行，相比原来减少 90%）
├── css/
│   ├── themes.css             # 主题配置（240 行）
│   ├── base.css               # 基础样式（485 行）
│   ├── components.css         # 组件样式（2047 行）
│   └── responsive.css         # 响应式样式（395 行）
├── js/
│   └── app.js                 # 应用逻辑（5322 行）
├── docs/
│   ├── SECURITY_WARNING.md    # ⚠️ 安全警告（必读！）
│   ├── ARCHITECTURE.md        # 架构文档
│   └── PERMISSION_TEST.md     # 权限系统测试文档
├── LICENSE                    # MIT 许可证
├── .gitignore                 # Git 忽略文件配置
└── README.md                  # 项目说明（本文件）
```

详细架构说明请查看：[架构文档](./docs/ARCHITECTURE.md)

## 🚧 开发指南

### 本地运行

```bash
# 克隆仓库
git clone https://github.com/zxcgzx/markdown-to-word-converter.git
cd markdown-to-word-converter

# 方法 1：使用 Python
python -m http.server 8000

# 方法 2：使用 Node.js
npx serve

# 访问 http://localhost:8000
```

### 代码规范

- 使用 4 空格缩进
- 中文注释
- 遵循 DRY 原则（Don't Repeat Yourself）
- 遵循高内聚、低耦合原则

### 贡献指南

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m "Add your feature"`
4. 推送到分支：`git push origin feature/your-feature`
5. 创建 Pull Request

## 🎨 特色

- 📱 完整的响应式设计，支持移动端和平板
- 🎭 4 套精心设计的主题配色
- 🔄 流畅的拖拽文件上传体验
- 💾 智能的本地草稿保存
- 📊 实时的文档统计和状态提示
- 🤖 强大的 AI 智能修复功能
- 🎯 详细的错误提示和用户反馈
- ⚡ 高性能的实时预览渲染

## 📝 更新日志

### v2.1.0 (2025-11-10) - 架构重构
- 🏗️ **代码模块化** - 将 387KB 单文件拆分为模块化结构
- 📉 **大幅瘦身** - index.html 从 9423 行减少到 941 行（减少 90%）
- 📦 **CSS 拆分** - 分离为 themes、base、components、responsive 四个文件
- 📚 **文档完善** - 新增安全警告、架构文档
- 🔒 **安全标注** - 明确标注前端权限系统的安全问题
- 🧹 **代码清理** - 添加 .gitignore、LICENSE 等配置文件

### v2.0.0 (2025-09-24) - AI 智能修复
- 🤖 **AI 修复系统** - 集成多个 AI 服务商的智能修复功能
- 🎨 **多主题支持** - 新增 4 套精美主题配色
- ✂️ **局部修复** - 支持选中内容进行局部 AI 修复
- 🔄 **差异视图** - AI 修复结果支持原文/修复/差异对比
- 🎛️ **自定义配置** - 支持自定义 AI 服务商和参数
- 📱 **密码分享** - 简化的密码分享机制
- 🔐 **权限系统** - 3 级用户分级（演示性质）
- 📄 **KaTeX 支持** - 数学公式渲染
- 📁 **文件上传** - 拖拽上传和文件管理
- 💾 **草稿保存** - 本地草稿自动保存
- ⌨️ **快捷键** - 添加键盘快捷键支持
- 📊 **实时统计** - 字符数、单词数、行数统计

### v1.0.0 (2025-05-21) - 初始版本
- 📝 基础 Markdown 转 Word 功能
- 👀 实时预览
- 📋 富文本复制

## 🔮 未来计划

### 短期（1-2 周）
- [ ] 添加输入防抖优化
- [ ] 优化 KaTeX 公式渲染性能
- [ ] 添加 CDN 降级方案
- [ ] 完善错误处理机制

### 中期（1-2 月）
- [ ] JavaScript 深度模块化拆分
- [ ] 引入构建工具（Vite）
- [ ] 添加单元测试
- [ ] 撤销/重做功能

### 长期（3+ 月）
- [ ] 移除前端权限系统或添加后端服务
- [ ] 修复 API 密钥安全问题
- [ ] XSS 防护和 CSP 策略
- [ ] 协作编辑功能

## 👨‍💻 作者

**Boning** - TJUT

## 🙏 致谢

感谢以下开源项目：
- [Marked.js](https://marked.js.org/)
- [docx.js](https://github.com/dolanmiu/docx)
- [FileSaver.js](https://github.com/eligrey/FileSaver.js)
- [KaTeX](https://katex.org/)

感谢所有在内测阶段提供反馈的朋友！

## 📄 许可证

[MIT License](./LICENSE)

Copyright (c) 2025 Boning - TJUT

---

⚠️ **再次提醒**：本项目仅供学习交流使用，存在安全问题，不适合生产环境。详情请阅读 [安全警告](./docs/SECURITY_WARNING.md)。

如果这个工具对您有帮助，请给个 ⭐ Star 支持一下！
