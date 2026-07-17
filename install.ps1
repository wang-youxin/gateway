# Gateway — 一键安装脚本 (Windows PowerShell)
# 将 Gateway 及全部核心 Skill 安装到 ~/.agents/skills/

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Gateway — 万能入口 + 核心 Skill 安装" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$skills = "$env:USERPROFILE\.agents\skills"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 确保目标目录存在
New-Item -ItemType Directory -Force -Path $skills | Out-Null

# ========== 1. 安装 Gateway 本身 ==========
Write-Host "--- Gateway ---" -ForegroundColor Yellow
$gwDst = "$skills\gateway"

# 备份用户已有的 index.json（如果有）
if (Test-Path "$gwDst\index.json") {
    Copy-Item "$gwDst\index.json" "$env:TEMP\gateway-index-backup.json" -Force
    Write-Host "  📋 已备份现有 index.json" -ForegroundColor Gray
}

# 复制 Gateway 核心文件
New-Item -ItemType Directory -Force -Path $gwDst | Out-Null
Copy-Item -Path "$scriptDir\SKILL.md" -Destination "$gwDst\SKILL.md" -Force
Write-Host "  ✓ gateway/SKILL.md"

# 恢复用户索引（如果有备份）
if (Test-Path "$env:TEMP\gateway-index-backup.json") {
    Copy-Item "$env:TEMP\gateway-index-backup.json" "$gwDst\index.json" -Force
    Remove-Item "$env:TEMP\gateway-index-backup.json" -Force
    Write-Host "  📋 已恢复 index.json" -ForegroundColor Gray
} elseif (Test-Path "$scriptDir\index.json") {
    Copy-Item "$scriptDir\index.json" "$gwDst\index.json" -Force
    Write-Host "  ✓ gateway/index.json"
}

# ========== 2. 安装全部核心 Skill ==========
Write-Host ""
Write-Host "--- 核心 Skills ($(Get-ChildItem "$scriptDir\skills" -Directory | Measure-Object | Select-Object -ExpandProperty Count) 个) ---" -ForegroundColor Yellow

$skillSrc = "$scriptDir\skills"
$count = 0

Get-ChildItem "$skillSrc" -Directory | ForEach-Object {
    $name = $_.Name
    $src = "$skillSrc\$name"
    $dst = "$skills\$name"

    if (Test-Path $dst) {
        Remove-Item -Path $dst -Recurse -Force
        Write-Host "  🔄 $name (更新)" -ForegroundColor Yellow
    } else {
        Write-Host "  ✓ $name" -ForegroundColor Green
    }

    Copy-Item -Path $src -Destination $dst -Recurse -Force
    $count++
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ 安装完成！" -ForegroundColor Green
Write-Host "  Gateway + $count 个核心 Skill 已就绪" -ForegroundColor White
Write-Host ""
Write-Host "  ⚠️  运行 /gateway refresh 刷新索引" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
