# Gateway — 一键安装 (Windows PowerShell)
#
# 只装 gateway 本体（SKILL.md + references/ + refresh-index.js），
# 不捆绑其他 Skill —— 它们各自演进，塞进这个仓库必然腐化。
#
# 用法：powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Targets = @(
    (Join-Path $HOME ".workbuddy\skills"),
    (Join-Path $HOME ".agents\skills")
)

Write-Host ""
Write-Host "========================================"
Write-Host "  Gateway - 万能入口 安装"
Write-Host "========================================"

$BackupDone = $false

foreach ($Target in $Targets) {
    Write-Host ""
    Write-Host "--- $Target\gateway ---"
    $Dst = Join-Path $Target "gateway"

    $ExistingIndex = Join-Path $Dst "index.json"
    if ((Test-Path $ExistingIndex) -and (-not $BackupDone)) {
        Copy-Item $ExistingIndex (Join-Path $Dst "index.json.backup") -Force
        Write-Host "  已备份现有 index.json -> index.json.backup"
        $BackupDone = $true
    }

    New-Item -ItemType Directory -Force -Path (Join-Path $Dst "references") | Out-Null

    Copy-Item (Join-Path $ScriptDir "SKILL.md") (Join-Path $Dst "SKILL.md") -Force
    Copy-Item (Join-Path $ScriptDir "refresh-index.js") (Join-Path $Dst "refresh-index.js") -Force
    Copy-Item (Join-Path $ScriptDir "references\*.md") (Join-Path $Dst "references") -Force

    $RefCount = (Get-ChildItem (Join-Path $ScriptDir "references\*.md")).Count
    Write-Host "  SKILL.md"
    Write-Host "  refresh-index.js"
    Write-Host "  references/ ($RefCount 个细则)"
}

Write-Host ""
Write-Host "========================================"
Write-Host "  安装完成"
Write-Host ""
Write-Host "  下一步：重建能力索引"
Write-Host "    node ~/.workbuddy/skills/gateway/refresh-index.js"
Write-Host ""
Write-Host "  然后把生成的 index.json 同步到 ~/.agents/skills/gateway/index.json"
Write-Host "========================================"
Write-Host ""
