# Gateway — 万能入口

**Skill 太多不知道该用哪个？把问题交给 Gateway，它帮你找到对的工具。**

[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

---

## 一句话解释

你对 AI 说需求，Gateway 自动分析意图、匹配最合适的 Skill、复杂任务拆成多步分别执行。就像一个不用记快捷键的万能工具箱。

---

## 痛点

装了一堆 Skill 之后，你会发现：

- "想做网页" → 该用 frontend-design 还是直接写代码？
- "分析商业模式并找对标" → 先跑哪个 Skill？结论怎么传下去？
- 新装了一个 Skill → 一周后完全忘了它的存在
- 每个 Skill 只用了它的某个功能 → 其他功能从来没用过

Gateway 解决的就是这个。

---

## 怎么工作

```
你说 "帮我分析商业模式，找对标，然后做内容"
              ↓
Phase 1  深度需求分析
          不看 Skill 列表，只看你说的
          → 领域：商业诊断
          → 类型：分析 + 搜索 + 创作
          → 复杂度：三步有依赖
              ↓
Phase 2  读索引，能力模块级匹配
          → 诊断商业模式 → dbs-diagnosis
          → 找对标 → dbs-benchmark
          → 做内容 → dbs-content
              ↓
Phase 3  拆解 + 分派 + 汇总
          1. 先跑诊断 → 拿到结论
          2. 结论给对标 → 找到对标
          3. 对标给内容 → 出内容方案
          4. 汇总：每一步用了什么、产出了什么
```

---

## 安装

### 方式 1：npx（推荐）

```bash
npx skills add wang-youxin/gateway -g -y
```

### 方式 2：手动

```bash
git clone https://github.com/wang-youxin/gateway.git
cp -r gateway/ ~/.agents/skills/
ln -s ~/.agents/skills/gateway ~/.claude/skills/gateway  # Claude Code
```

### 首次使用

```
/gateway refresh
```

这会扫描你已经安装的所有 Skill，建立能力索引。

---

## 日常使用

```
# 直接说需求
"帮我做个落地页"
"分析一下我的商业模式"
"我想学 Rust，帮我规划学习路径"

# 或者显式调用
/gateway 帮我找能做数据可视化的工具
```

---

## 命令

| 命令 | 作用 |
|------|------|
| `/gateway refresh` | 重建索引（新装/卸载 Skill 后） |
| `/万能入口` | 同 `/gateway` |

---

## 给开发者：能力组件目录

Gateway 的 `index.json` 是一个**可复用能力组件库**——每个 Skill 被拆成细粒度能力模块，标注输入/输出/是否可复用。

```bash
# 查所有可复用模块
cat ~/.agents/skills/gateway/index.json | jq '[.skills[] | .capabilities[] | select(.reusable == true)]'

# 按领域查
cat ~/.agents/skills/gateway/index.json | jq '.skills | to_entries | map(select(.value.category == "design"))'
```

用 `skill-creator` 造新 Skill 时，先查索引——避免重复造轮子。

---

## 兼容性

| 工具 | 支持 |
|------|------|
| Claude Code | ✅ |
| Codex | ✅ |
| Cursor | ✅ |
| Hermes | ✅ |
| 任何支持 SKILL.md 的框架 | ✅ |

---

## 配套推荐

- **[find-skills](https://skills.sh/vercel-labs/skills/find-skills)** — 本地没匹配时自动搜索生态
- **[skill-creator](https://skills.sh/anthropics/skills/skill-creator)** — 用索引作为组件目录造新 Skill

---

## 文件结构

```
gateway/
├── SKILL.md      ← 调度器完整逻辑
├── index.json    ← 能力索引（/gateway refresh 填充）
└── README.md     ← 本文件
```

---

## 许可

CC BY 4.0 — 自由使用、修改、分发，署名注明来源。
