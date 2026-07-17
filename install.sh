#!/bin/bash
# Gateway — 一键安装脚本 (macOS/Linux)
# 将 Gateway 及全部核心 Skill 安装到 ~/.agents/skills/

echo ""
echo "========================================"
echo "  Gateway — 万能入口 + 核心 Skill 安装"
echo "========================================"
echo ""

SKILLS="$HOME/.agents/skills"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$SKILLS"

# ========== 1. 安装 Gateway 本身 ==========
echo "--- Gateway ---"
GW_DST="$SKILLS/gateway"

# 备份已有 index.json
if [ -f "$GW_DST/index.json" ]; then
    cp "$GW_DST/index.json" /tmp/gateway-index-backup.json
    echo "  📋 已备份现有 index.json"
fi

mkdir -p "$GW_DST"
cp "$SCRIPT_DIR/SKILL.md" "$GW_DST/SKILL.md"
echo "  ✓ gateway/SKILL.md"

# 恢复或安装 index.json
if [ -f /tmp/gateway-index-backup.json ]; then
    cp /tmp/gateway-index-backup.json "$GW_DST/index.json"
    rm /tmp/gateway-index-backup.json
    echo "  📋 已恢复 index.json"
elif [ -f "$SCRIPT_DIR/index.json" ]; then
    cp "$SCRIPT_DIR/index.json" "$GW_DST/index.json"
    echo "  ✓ gateway/index.json"
fi

# ========== 2. 安装全部核心 Skill ==========
echo ""
echo "--- 核心 Skills ---"
COUNT=0

for dir in "$SCRIPT_DIR/skills"/*/; do
    name=$(basename "$dir")
    src="$SCRIPT_DIR/skills/$name"
    dst="$SKILLS/$name"

    if [ -d "$dst" ]; then
        rm -rf "$dst"
        echo "  🔄 $name (更新)"
    else
        echo "  ✓ $name"
    fi

    cp -rf "$src" "$dst"
    ((COUNT++))
done

echo ""
echo "========================================"
echo "  ✅ 安装完成！"
echo "  Gateway + $COUNT 个核心 Skill 已就绪"
echo ""
echo "  ⚠️  运行 /gateway refresh 刷新索引"
echo "========================================"
echo ""
