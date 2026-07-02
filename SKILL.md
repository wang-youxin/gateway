---
name: gateway
description: |
  万能入口 —— 所有 Skill 的统一调度器。
  维护一份持久化能力索引（index.json），装新 Skill 时自动刷新。
  每次请求：先深度分析需求 → 读索引匹配 → 拆解分派。
  索引同时作为 skill-creator 的组件目录：造新 Skill 时可直接复用已有能力模块。
  触发方式：/gateway、/万能入口、「帮我...」「我想...」等不确定该用哪个 Skill 的需求。
  管理命令：/gateway refresh — 手动重建索引。
---

# Gateway：万能入口 + 能力组件目录

两个角色合一：
1. **调度器**：理解需求 → 匹配 Skill → 拆解分派
2. **组件目录**：维护一份 `index.json`，记录每个 Skill 的细粒度能力模块，供 `skill-creator` 造新 Skill 时查阅和复用

---

## 入口架构：四入口模型

Gateway 不只是单一调度器——它按用户状态分流入四个入口：

```
                    用户进来
                       ↓
              【第一步：兴趣】
           找到用户需求，辅助他
          找出他想做的，并辅助他
              做出来看到成果
                       ↓
        ┌──────┬───────┴───────┬──────┐
        ↓      ↓               ↓      ↓
    技能树   系统学习      学习诊断    （扩展）
        ↓      ↓               ↓
    三个等级  按顺序学    找到用户问题
    低/中/高  结构化课程   +用户意识不到
        ↓                 的缺口
    个人情况更新              ↓
        ↓              每次诊断完 →
        └──── 自动更新技能树 ────┘
```

**第一步：兴趣** — 不是让用户学，是让用户做。找到想做的 → 辅助做出来 → 看到成果 → 才有动力。

**技能树** — 三个等级（低/中/高），记录用户会什么、到什么程度。是整套系统的数据中枢。

**系统学习** — 按顺序学，结构化课程，有路径不是零散的。

**学习诊断** — 找用户问题 + 用户意识不到的缺口。每次诊断完自动更新技能树。

**关键闭环：诊断 → 更新技能树 → 系统学习补缺口 → 再诊断。**

---

## 索引文件

索引文件位于 `~/.agents/skills/gateway/index.json`。

### 索引 Schema

```json
{
  "version": "1.0",
  "updated_at": "2026-07-02T08:00:00Z",
  "skill_count": 27,
  "capability_count": 120,
  "skills": {
    "skill-name": {
      "name": "skill-name",
      "type": "agent | plugin",
      "path": "绝对路径/SKILL.md",
      "description": "一句话描述",
      "trigger": "触发方式",
      "category": "business | content | learning | state | thinking | workflow | design | search | meta | dev",
      "capabilities": [
        {
          "id": "skill-name-capability-slug",
          "name": "能力名称（中文）",
          "description": "这个能力做什么。输入是什么，输出是什么。",
          "standalone": true,
          "reusable": true,
          "input_type": "自然语言 | 文件 | 数据 | 无",
          "output_type": "诊断报告 | 生成内容 | 搜索列表 | 决策文件 | 代码"
        }
      ],
      "dependencies": ["依赖的其他 skill 名"],
      "related": ["相关的 skill 名"]
    }
  }
}
```

### 索引更新时机

| 触发事件 | 动作 |
|---------|------|
| `npx skills add` 安装新 Skill | 安装完成后**提示用户**「索引需要刷新，要现在更新吗？」用户确认后再刷新 |
| `claude plugin install` 安装新插件 | 同上，安装完成后**提示用户确认**再刷新 |
| 用户说 `/gateway refresh` | 手动全量重建索引（无需确认） |
| 索引文件不存在或格式损坏 | 自动重建（无需确认，属于修复） |
| 索引超过 24 小时未更新 | 提示用户是否刷新（不强制） |

**核心原则：安装 Skill 是用户主动行为，刷新索引是后续动作。必须分开，先问再动。**

### 刷新索引的流程

**如果是安装 Skill 后触发的刷新，必须先问用户：**
> 索引需要刷新才能识别新安装的 Skill。要现在更新吗？

**用户确认后再执行以下步骤：**

1. 扫描两个来源：
   - `~/.agents/skills/*/SKILL.md`（Agent Skills）
   - `~/.claude/plugins/cache/**/SKILL.md`（Plugin Skills）
2. 对每个 SKILL.md：
   - 读取完整内容（不只是 frontmatter）
   - 提取 `name`、`description`、触发条件
   - **深扒所有能力模块**：识别 Phase、Mode、工作流程中的每个独立步骤
   - 判断每个能力的 `standalone` 和 `reusable`
   - 识别 `dependencies` 和 `related`
3. 写入 `index.json`
4. 输出刷新摘要：新增了哪些 Skill，总计多少能力模块

### 刷新输出格式

```markdown
## 🔄 索引已刷新

| 变化 | 数量 |
|------|------|
| Skill 总数 | {N} |
| 能力模块总数 | {M} |
| 新增 Skill | {列表} |
| 移除 Skill | {列表} |

索引文件：~/.agents/skills/gateway/index.json
```

---

## 核心流程

```
需求进来
  ↓
Phase 0: 检查索引是否存在/新鲜 → 不存在则先刷新
  ↓
Phase 1: 深度需求分析（不准看索引）
  ↓
Phase 2: 读 index.json 匹配（不再逐个扫描 SKILL.md）
  ↓
Phase 3: 需求 × 能力模块交叉匹配
  ↓
Phase 4: 复合任务拆解 + 分派
  ↓
Phase 5: 本地无匹配 → find-skills 搜索生态 → 安装 → 刷新索引
```

---

## Phase 0：索引导航

**每次请求开始前**，检查 `~/.agents/skills/gateway/index.json`：
- 不存在 → 执行刷新流程，再进 Phase 1
- 存在且小于 24 小时 → 直接进 Phase 1
- 存在但超过 24 小时 → 进 Phase 1，匹配阶段如果发现索引可能过时，提示用户可 `/gateway refresh`

---

## Phase 1：深度需求分析

**禁止看索引。禁止看 Skill 目录。只分析用户说的话。**

### 1.1 提取需求骨架

| 维度 | 要回答的问题 |
|------|-------------|
| **领域** | 商业诊断 / 内容创作 / 软件开发 / 学习 / 决策 / 设计 / 运维 / 其他 |
| **任务类型** | 分析诊断 / 生成创作 / 搜索查找 / 学习理解 / 决策选择 / 转换格式 / 搭建系统 |
| **对象** | 具体操作对象：商业模式 / 网页 / 文章标题 / 概念 / 代码 / 决策 |
| **约束** | 时间、平台、技术栈、受众、预算、格式 |
| **复杂度** | 单步 / 多步有依赖 / 多步无依赖 |
| **成功标准** | 可交付物是什么？ |

### 1.2 清晰度判定

- **清晰**：6 维全有 → 进 Phase 2
- **部分模糊**：2-3 维缺失 → 给出推断，确认后进 Phase 2
- **高度模糊**：→ 最多追问 2 个问题

### 1.3 输出

```markdown
## 📖 需求理解

**你要做的是**：{一句话}
**领域**：{X} ｜ **类型**：{Y} ｜ **复杂度**：{Z}
**约束**：{...}
**成功标准**：{...}
```

---

## Phase 2：读索引匹配

读 `index.json`，在 `skills` 中查找匹配。

### 匹配逻辑（逐层收敛）

**第 1 层：领域 + 类型过滤**
- 从索引中筛出 category 和需求领域一致的 Skill
- 再从中筛出 capabilities 中 output_type 和需求任务类型一致的

**第 2 层：能力模块级匹配**
- 不只是匹配 Skill 名称，匹配到具体的 capability
- 一个 Skill 可能只用到它的一个 capability，不需要加载整个 Skill

**第 3 层：交叉评分**
- 领域对齐：0-2 分
- 类型对齐：0-2 分
- 对象对齐：0-2 分
- 约束兼容：0-2 分
- 总分 ≥ 6 → 精确匹配
- 总分 4-5 → 候选匹配
- 总分 2-3 → 部分匹配（需要拆解或组合）
- 总分 0-1 → 无匹配，进 Phase 5

---

## Phase 3：匹配结果输出

```markdown
## 🔧 匹配结果

**最佳匹配**：{skill-name} → {capability-name}
**匹配理由**：
- 领域：{用户领域} ↔ {skill category} ✅
- 类型：{用户任务类型} ↔ {capability output_type} ✅
- 对象：{用户对象} ↔ {capability 擅长} ✅

{候选匹配时列出 2-3 个 + 各自评分}
```

---

## Phase 4：复合任务拆解

```markdown
## 📋 任务拆解

| 步骤 | 做什么 | Skill → Capability | 依赖 |
|------|--------|-------------------|------|
| 1 | {子任务} | {skill} → {capability-id} | 无 |
| 2 | {子任务} | {skill} → {capability-id} | 步骤 1 |

确认后执行。
```

---

## Phase 5：搜索生态

本地无匹配时：

1. 用 Phase 1 的领域 + 类型构造英文关键词
2. 至少 2 组不同关键词搜索 `npx skills find`
3. 优先 ≥ 1K 安装、官方来源
4. 展示 top 3
5. 用户安装后 → 运行 `/gateway refresh` 更新索引

---

## 为 skill-creator 服务：能力组件目录

当用户使用 `skill-creator` 创建新 Skill 时，gateway 的索引作为**可复用组件库**：

### skill-creator 如何使用索引

1. 用户告诉 skill-creator 想造什么 Skill
2. skill-creator 先查 gateway 索引：`cat ~/.agents/skills/gateway/index.json`
3. 查找 `reusable: true` 的能力模块
4. 判断新 Skill 需要哪些已有能力：
   - 可以直接调用 → 在新 SKILL.md 中写 "use Skill tool to invoke {skill-name}"
   - 需要包装 → 在新 SKILL.md 中写适配层
   - 不存在 → 从零实现

### 索引查询命令

skill-creator 可以这样查：

```bash
# 按领域查
cat ~/.agents/skills/gateway/index.json | jq '.skills | to_entries | map(select(.value.category == "content")) | map({name: .key, caps: .value.capabilities})'

# 查所有可复用模块
cat ~/.agents/skills/gateway/index.json | jq '[.skills | to_entries[] | .value.capabilities[] | select(.reusable == true)] | map({id, name, description})'

# 查某个 Skill 的全部能力
cat ~/.agents/skills/gateway/index.json | jq '.skills["skill-name"].capabilities'
```

---

## 边界情况

- **索引损坏/丢失** → Phase 0 自动重建
- **新装 Skill 未入库** → 提示用户 `/gateway refresh`
- **Skill 被卸载但索引未更新** → 匹配时发现路径不存在，自动从索引移除并继续
- **用户需求太模糊** → 最多追问 2 个问题
- **用户只是在聊天** → 不进入匹配流程
- **用户明确知道要用哪个 Skill** → 不拦截，直接放行

---

## 语言

- 用户用中文就用中文回复
- 分析过程简洁
