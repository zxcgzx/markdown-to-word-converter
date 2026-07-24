#!/usr/bin/env bash
set -euo pipefail

# 可在“更新包目录”或“仓库根目录”运行。
# 若当前目录不是 Git 仓库，脚本会临时克隆仓库、覆盖更新文件、建立远程备份分支，然后推送 main。
REPO_URL="https://github.com/zxcgzx/markdown-to-word-converter.git"
REPO_EXPECTED="zxcgzx/markdown-to-word-converter"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_BRANCH="backup/pre-v3-${STAMP}"
FILES=(
  index.html
  README.md
  package.json
  css/app.css
  js/app.js
  js/math-engine.js
  tests/math-engine.test.js
  docs/V3_UPDATE.md
  .github/workflows/deploy.yml
)

for path in "${FILES[@]}"; do
  if [[ ! -f "$SCRIPT_DIR/$path" ]]; then
    echo "错误：更新包缺少 $path。" >&2
    exit 1
  fi
done

TEMP_REPO=""
if [[ -d "$SCRIPT_DIR/.git" ]]; then
  WORKTREE="$SCRIPT_DIR"
  REMOTE_URL="$(git -C "$WORKTREE" remote get-url origin 2>/dev/null || true)"
  if [[ "$REMOTE_URL" != *"${REPO_EXPECTED}"* ]]; then
    echo "错误：当前 origin 不是 ${REPO_EXPECTED}：${REMOTE_URL}" >&2
    exit 1
  fi
  git -C "$WORKTREE" fetch origin main
  LOCAL_HEAD="$(git -C "$WORKTREE" rev-parse HEAD)"
  REMOTE_HEAD="$(git -C "$WORKTREE" rev-parse origin/main)"
  if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
    echo "错误：本地 HEAD 与 origin/main 不一致。请在单独的更新包目录运行本脚本，让脚本使用全新克隆。" >&2
    exit 1
  fi
else
  command -v git >/dev/null 2>&1 || { echo "错误：未找到 Git。" >&2; exit 1; }
  TEMP_REPO="$(mktemp -d "${TMPDIR:-/tmp}/md2word-v3-publish.XXXXXX")"
  WORKTREE="$TEMP_REPO/repo"
  echo "正在克隆仓库到临时目录：$WORKTREE"
  git clone "$REPO_URL" "$WORKTREE"
  for path in "${FILES[@]}"; do
    mkdir -p "$WORKTREE/$(dirname "$path")"
    cp "$SCRIPT_DIR/$path" "$WORKTREE/$path"
  done
fi

git -C "$WORKTREE" switch main
git -C "$WORKTREE" fetch origin main

git -C "$WORKTREE" branch "$BACKUP_BRANCH" origin/main
git -C "$WORKTREE" push origin "$BACKUP_BRANCH"
echo "已创建远程备份分支：${BACKUP_BRANCH}"

if command -v node >/dev/null 2>&1; then
  (cd "$WORKTREE" && npm test && npm run check)
else
  echo "提示：未找到 Node.js，跳过自动测试。"
fi

for path in "${FILES[@]}"; do
  git -C "$WORKTREE" add "$path"
done

if git -C "$WORKTREE" diff --cached --quiet; then
  echo "没有检测到待提交更新。"
  exit 0
fi

git -C "$WORKTREE" commit -m "Release personal v3 with robust math rendering"
git -C "$WORKTREE" push origin main

echo "更新已推送到 main。GitHub Pages 将按现有工作流自动部署。"
if [[ -n "$TEMP_REPO" ]]; then
  rm -rf "$TEMP_REPO"
fi
