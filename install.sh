#!/bin/bash
# Gateway — 一键安装 (macOS / Linux)
#
# 只装 gateway 本体（SKILL.md + references/ + refresh-index.js），
# 不捆绑其他 Skill —— 它们各自演进，塞进这个仓库必然腐化。
#
# 用法：chmod +x install.sh && ./install.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGETS=("$HOME/.workbuddy/skills" "$HOME/.agents/skills")

echo ""
echo "========================================"
echo "  Gateway — 万能入口 安装"
echo "========================================"

# 备份开关：只在第一次遇到已有 index.json 时备份
BACKUP_DONE=0

for TARGET in "${TARGETS[@]}"; do
  echo ""
  echo "--- $TARGET/gateway ---"
  DST="$TARGET/gateway"

  if [ -f "$DST/index.json" ] && [ "$BACKUP_DONE" -eq 0 ]; then
    cp "$DST/index.json" "$DST/index.json.backup"
    echo "  已备份现有 index.json -> index.json.backup"
    BACKUP_DONE=1
  fi

  mkdir -p "$DST/references"

  cp "$SCRIPT_DIR/SKILL.md" "$DST/SKILL.md"
  cp "$SCRIPT_DIR/refresh-index.js" "$DST/refresh-index.js"
  cp "$SCRIPT_DIR/references/"*.md "$DST/references/"

  echo "  SKILL.md"
  echo "  refresh-index.js"
  echo "  references/ ($(ls -1 "$SCRIPT_DIR/references/"*.md | wc -l | tr -d ' ') 个细则)"
done

echo ""
echo "========================================"
echo "  安装完成"
echo ""
echo "  下一步：重建能力索引"
echo "    node ~/.workbuddy/skills/gateway/refresh-index.js"
echo ""
echo "  然后把生成的 index.json 同步到 ~/.agents/skills/gateway/index.json"
echo "========================================"
echo ""
