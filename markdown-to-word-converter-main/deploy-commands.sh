#!/bin/bash

# GitHub部署脚本
# 请将YOUR_GITHUB_USERNAME替换为您的实际GitHub用户名

echo "🚀 准备推送到GitHub..."

# 添加GitHub远程仓库
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/markdown-to-word-converter.git

# 推送代码到GitHub
git push -u origin main

echo "✅ 代码已推送到GitHub!"
echo ""
echo "🌐 下一步：启用GitHub Pages"
echo "1. 访问您的GitHub仓库"
echo "2. 点击 Settings"
echo "3. 滚动到 Pages 部分"
echo "4. Source 选择 'Deploy from a branch'"
echo "5. Branch 选择 'main' 和 '/ (root)'"
echo "6. 点击 Save"
echo ""
echo "🎉 几分钟后您的网站将在以下地址可用："
echo "https://YOUR_GITHUB_USERNAME.github.io/markdown-to-word-converter"