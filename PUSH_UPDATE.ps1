$ErrorActionPreference = 'Stop'

# 可在“更新包目录”或“仓库根目录”运行。
# 若当前目录不是 Git 仓库，脚本会临时克隆仓库、覆盖更新文件、建立远程备份分支，然后推送 main。
$RepoUrl = 'https://github.com/zxcgzx/markdown-to-word-converter.git'
$ExpectedRepo = 'zxcgzx/markdown-to-word-converter'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupBranch = "backup/pre-v3-$Stamp"
$Files = @(
    'index.html',
    'README.md',
    'package.json',
    'css/app.css',
    'js/app.js',
    'js/math-engine.js',
    'tests/math-engine.test.js',
    'docs/V3_UPDATE.md',
    '.github/workflows/deploy.yml'
)

foreach ($Path in $Files) {
    if (-not (Test-Path (Join-Path $ScriptDir $Path))) {
        throw "更新包缺少 $Path。"
    }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw '未找到 Git。'
}

$TempRoot = $null
if (Test-Path (Join-Path $ScriptDir '.git')) {
    $Worktree = $ScriptDir
    $RemoteUrl = (git -C $Worktree remote get-url origin 2>$null)
    if ($LASTEXITCODE -ne 0 -or $RemoteUrl -notlike "*$ExpectedRepo*") {
        throw "当前 origin 不是 $ExpectedRepo：$RemoteUrl"
    }
    git -C $Worktree fetch origin main
    if ($LASTEXITCODE -ne 0) { throw 'git fetch 失败。' }
    $LocalHead = (git -C $Worktree rev-parse HEAD).Trim()
    $RemoteHead = (git -C $Worktree rev-parse origin/main).Trim()
    if ($LocalHead -ne $RemoteHead) {
        throw '本地 HEAD 与 origin/main 不一致。请在单独的更新包目录运行本脚本，让脚本使用全新克隆。'
    }
} else {
    $TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("md2word-v3-publish-" + [guid]::NewGuid().ToString('N'))
    $Worktree = Join-Path $TempRoot 'repo'
    New-Item -ItemType Directory -Path $TempRoot | Out-Null
    Write-Host "正在克隆仓库到临时目录：$Worktree"
    git clone $RepoUrl $Worktree
    if ($LASTEXITCODE -ne 0) { throw 'git clone 失败。' }
    foreach ($Path in $Files) {
        $Source = Join-Path $ScriptDir $Path
        $Target = Join-Path $Worktree $Path
        $TargetDir = Split-Path -Parent $Target
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
        Copy-Item $Source $Target -Force
    }
}

git -C $Worktree switch main
if ($LASTEXITCODE -ne 0) { throw '无法切换到 main。' }
git -C $Worktree fetch origin main
if ($LASTEXITCODE -ne 0) { throw 'git fetch 失败。' }

git -C $Worktree branch $BackupBranch origin/main
if ($LASTEXITCODE -ne 0) { throw '创建备份分支失败。' }
git -C $Worktree push origin $BackupBranch
if ($LASTEXITCODE -ne 0) { throw '推送备份分支失败。' }
Write-Host "已创建远程备份分支：$BackupBranch"

if (Get-Command node -ErrorAction SilentlyContinue) {
    Push-Location $Worktree
    try {
        npm test
        if ($LASTEXITCODE -ne 0) { throw '公式回归测试失败。' }
        npm run check
        if ($LASTEXITCODE -ne 0) { throw 'JavaScript 语法检查失败。' }
    } finally {
        Pop-Location
    }
} else {
    Write-Host '提示：未找到 Node.js，跳过自动测试。'
}

foreach ($Path in $Files) {
    git -C $Worktree add $Path
    if ($LASTEXITCODE -ne 0) { throw "git add 失败：$Path" }
}

git -C $Worktree diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host '没有检测到待提交更新。'
    exit 0
}

git -C $Worktree commit -m 'Release personal v3 with robust math rendering'
if ($LASTEXITCODE -ne 0) { throw 'git commit 失败。' }
git -C $Worktree push origin main
if ($LASTEXITCODE -ne 0) { throw 'git push 失败。' }

Write-Host '更新已推送到 main。GitHub Pages 将按现有工作流自动部署。'
if ($TempRoot -and (Test-Path $TempRoot)) {
    Remove-Item $TempRoot -Recurse -Force
}
