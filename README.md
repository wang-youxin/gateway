# Gateway — 万能入口 + 核心 Skill 捆绑包

**一个 Repo，全部核心 Skill 到位。**

克隆即得 Gateway 万能调度器 + 27 个核心 Skill，运行安装脚本一键部署。

## 包含的 Skill

### 🧭 Gateway — 统一调度器

维护持久化能力索引（`index.json`），深度分析需求 → 匹配 → 拆解分派。内置 task-quantify 任务量化引擎。

### 🔍 dbs — 商业诊断工具箱（24 个子技能）

| 类别 | Skill | 功能 |
|------|-------|------|
| 核心路由 | `dbs` | 意图识别 + 路由分发 + 任务后导航 |
| 商业诊断 | `dbs-diagnosis` | 五层消解漏斗 + 七项商业模式检验 |
| 商业诊断 | `dbs-action` | 阿德勒心理学 × 执行力诊断 |
| 商业诊断 | `dbs-goal` | 维特根斯坦语言哲学 × 目标清晰化 |
| 商业诊断 | `dbs-benchmark` | 五重过滤法 × 对标分析 |
| 商业诊断 | `dbs-slowisfast` | 摩擦 × 资产 × 复利三项审计 |
| 思维工具 | `dbs-deconstruct` | 概念拆解 + 奥派经济学校准 |
| 思维工具 | `dbs-good-question` | 好问题生成器 + Agent 可解性判定 |
| 思维工具 | `dbs-chatroom` | 多角色专家定向对话 |
| 思维工具 | `dbs-chatroom-austrian` | 哈耶克 × 米塞斯 × Claude 三人对谈 |
| 内容创作 | `dbs-content` | 五维内容诊断 |
| 内容创作 | `dbs-hook` | 短视频开头优化（6 维诊断 + 10-15 条方案） |
| 内容创作 | `dbs-xhs-title` | 小红书标题公式（75 个爆款公式） |
| 内容创作 | `dbs-ai-check` | AI 写作特征识别（22 个特征扫描） |
| 内容创作 | `dbs-wechat-html` | 公众号 HTML 生成（15 种风格） |
| 内容创作 | `dbs-spread` | 传播心理解码（5 个经典理论） |
| 内容创作 | `dbs-resonate` | 文稿共鸣诊断（五维度） |
| 基础设施 | `dbs-content-system` | 内容结构化工程搭建 |
| 基础设施 | `dbs-agent-migration` | Agent 工作台三端迁移 |
| 状态管理 | `dbs-save` | 诊断存档写入 + 列表查询 |
| 状态管理 | `dbs-restore` | 存档定位 + 状态呈现 + 路由 |
| 状态管理 | `dbs-report` | 多存档合并 + 报告生成 |
| 状态管理 | `dbs-decision` | 个人决策系统（四层结构） |
| 学习 | `dbs-learning` | 交互式自适应学习系统 |

### 🏭 skill-creator — Skill 创建与评估

意图访谈 → SKILL.md 起草 → Eval 测试 → 自动评分 → 基准报告 → 迭代优化。含 8 个 Python 脚本、3 个 Subagent 配置。

### 🧭 find-skills — Skill 发现与安装

从生态中搜索、评估、安装 Agent Skill。

### 📐 task-quantify — 任务量化引擎

从用户视角反推产品需求，7-Phase 量化流程，生成可执行任务地图。

## 快速开始

### 安装

```bash
git clone https://github.com/wang-youxin/gateway.git
cd gateway
```

**Windows:**
```powershell
.\install.ps1
```

**macOS / Linux:**
```bash
chmod +x install.sh
./install.sh
```

安装后在 Claude Code 中运行：
```
/gateway refresh
```

### 使用

直接对话即可自动路由：

- "帮我诊断商业模式" → `dbs-diagnosis`
- "帮我找一个视频剪辑的 skill" → `find-skills`
- "帮我创建一个新 skill" → `skill-creator`
- "帮我把这个需求拆成可执行任务" → `task-quantify`
- 不确定该用哪个？`/gateway` 统一入口

### 更新

```bash
git pull
./install.ps1   # 或 ./install.sh
# Claude Code 中：/gateway refresh
```

## 目录结构

```
gateway/
├── SKILL.md              # Gateway 调度器
├── index.json            # 能力索引（58 Skill / 221 能力模块）
├── install.ps1           # Windows 一键安装
├── install.sh            # macOS/Linux 一键安装
├── skills/               # 捆绑的核心 Skill（27 个）
│   ├── dbs/              # 主路由器 + 知识库
│   ├── dbs-diagnosis/
│   ├── dbs-action/
│   ├── ... (24 dbs)
│   ├── find-skills/
│   ├── skill-creator/
│   └── task-quantify/
└── README.md
```

## 依赖

- [Claude Code](https://claude.ai/code)
- `npx skills` CLI（find-skills 和 skill-creator 需要）
- Python 3（skill-creator 脚本需要）

## License

MIT
