#!/usr/bin/env node
/**
 * gateway 索引重建器
 *
 * 用法：
 *   node refresh-index.js            # 重建索引
 *   node refresh-index.js --check    # 只检查是否过期，不改文件
 *
 * 触发时机（见 SKILL.md「索引维护铁律」）：
 *   1. 安装 / 卸载 / 重命名任何 skill 之后
 *   2. 用户执行 /gateway refresh
 *   3. 匹配时发现 skill 路径失效
 */

const fs = require('fs');
const path = require('path');

// 只扫 ~/.workbuddy/skills。用户明确指定：不扫 ~/.agents/skills。
// 原因：.agents 是双份部署的副本，两边同步不是原子的，扫两边会把只存在于
// 一侧的副本也计入（实测会让索引从 119 膨胀到 168），匹配时命中已失效的副本路径。
// 索引的唯一真源是 .workbuddy，.agents 只作为运行时副本接收同步。
const SKILLS_ROOT = path.join(process.env.HOME || process.env.USERPROFILE, '.workbuddy', 'skills');
const INDEX_PATH = path.join(__dirname, 'index.json');

/** 分类规则：按顺序匹配 name 前缀，命中即返回 */
const CATEGORY_RULES = [
  { match: (n) => n === 'gateway' || n === 'skill-creator' || n === 'find-skills' || n === 'release-skills' || n === 'ponytail' || n === 'task-quantify', category: 'meta' },
  { match: (n) => n === 'dbs' || n.startsWith('dbs-') || n.startsWith('douyin-') || n.startsWith('jfp-'), category: 'business' },
  { match: (n) => n.startsWith('shortvideo-') || n.startsWith('short-video-') || n.startsWith('course-') || n.startsWith('kb-') || n.startsWith('writing-'), category: 'content' },
  { match: (n) => n.startsWith('wechat-') || n.startsWith('gzh-') || n.startsWith('baoyu-post-') || n.startsWith('baoyu-markdown') || n.startsWith('baoyu-wechat'), category: 'publishing' },
  { match: (n) => ['video', 'hyperframes', 'caption', 'subtitle', 'ffmpeg', 'animate-text', 'embedded-captions', 'kinetic-text', 'smart-short-video', 'videodb', 'wjs-', 'remotion'].some((p) => n.startsWith(p)), category: 'video' },
  { match: (n) => n.startsWith('baoyu-image') || n.startsWith('baoyu-cover') || n.startsWith('baoyu-infographic') || n.startsWith('baoyu-xhs') || n.startsWith('baoyu-diagram') || n.startsWith('baoyu-comic') || n.startsWith('baoyu-slide') || n.startsWith('baoyu-article'), category: 'visual' },
  { match: (n) => n.startsWith('baoyu-url') || n.startsWith('baoyu-danger') || n.startsWith('baoyu-electron') || n.startsWith('baoyu-compress') || n.startsWith('baoyu-translate') || n.startsWith('audio-analysis'), category: 'utility' },
  { match: (n) => n.startsWith('frontend-design') || n.startsWith('agentflow') || n.startsWith('baoyu-format'), category: 'dev' },
];

function categorize(name) {
  for (const rule of CATEGORY_RULES) {
    if (rule.match(name)) return rule.category;
  }
  return 'dev';
}

/**
 * 大类元数据（O2 · Skill 扫描分层，2026-10-22 实施）
 * 第一层「大类」：每个大类解决什么问题（solves 是给人看的判据，导航第一步读它）
 *   hints：大类的检索提示词——solves 是散文，hints 是抓手，机械匹配和语义匹配都能用
 * 第二层「小问题」：每个 Skill 在大类内解决什么小问题（solves_small，从 description 首句派生，见 buildSolvesSmall）
 * 匹配纪律：大类只按 name + solves + hints 判，**不许堆成员关键词计分**——24 个成员的大类
 * 会靠关键词体量抢走一切 query（实测：「代码 review」被 content-growth 抢走）。
 */
const GROUP_META = {
  'meta': { name: 'Skill 生态与自我管理', solves: 'skill 本身的安装/创建/查找/发布，以及不绑定具体业务的通用工作法', hints: ['装 skill', '找 skill', '新建 skill', '技能管理', '发布 skill', 'install skill'] },
  'biz-diagnosis': { name: '商业诊断与决策', solves: '方向对不对、决策怎么拍：诊断生意/目标/概念、对标分析、复盘出报告', hints: ['诊断', '商业模式', '决策', '目标', '拆概念', '复盘', '报告', '问诊'] },
  'content-growth': { name: '短视频获客与内容增长', solves: '怎么靠内容拿到客户：账号诊断、选题、口播稿、跨平台改编、投放算账', hints: ['抖音', '短视频', '选题', '口播', '账号', '获客', '对标', '投放', '起号'] },
  'wechat-publishing': { name: '公众号生产与多平台发布', solves: '文章怎么生产出来并发出去：流水线、排版、封面、推草稿箱、发微博/X', hints: ['公众号', '排版', '草稿箱', '发布', '推送', '封面', '微信'] },
  'visual-gen': { name: '视觉素材生成', solves: '图从哪来：封面、插图、信息图、漫画、幻灯片、小红书图文', hints: ['封面', '配图', '插图', '信息图', '漫画', '幻灯片', '出图', '画图'] },
  'video-audio': { name: '音视频制作与转录', solves: '视频音频怎么剪、怎么转、怎么理解：字幕、剪辑、语音分析', hints: ['视频', '字幕', '剪辑', '音频', '转录', '配音'] },
  'writing-craft': { name: '写作技法与文章结构', solves: '文章怎么写、怎么组织：写作方法、结构、给 agent 看的文档写法', hints: ['写作', '文章', '结构', '文案', '文稿', '文档'] },
  'knowledge-learning': { name: '知识积累与学习教学', solves: '知识怎么攒、怎么学会、怎么教：知识库工程、课程拆解、交互式学习', hints: ['知识库', '学习', '教会', '教学', '课程', '笔记', '备课'] },
  'dev-workflow': { name: '软件开发工作流', solves: '代码怎么正确地写出来：需求澄清→规格→工单→实现→评审→调试→架构', hints: ['代码', '开发', '需求', '评审', '调试', '架构', '测试', 'bug', '重构', 'review'] },
  'devops-repo': { name: '仓库工程设施', solves: '仓库怎么不出事：git 护栏、提交前检查、版本迁移、脚手架', hints: ['git', '提交', '钩子', '仓库', '分支', 'pre-commit'] },
  'utility-fetch': { name: '素材抓取与格式转换', solves: '外面的东西怎么拿进来、怎么换格式：URL→md、转录、翻译、压缩、解包', hints: ['网页', '链接', 'url', '转录', '翻译', '压缩', '格式转换', 'markdown', '解包', '抓取'] },
  'misc': { name: '其他专项', solves: '一事一议的专项自动化，不属于以上任何大类', hints: [] },
  'other': { name: '未归类', solves: '新装入、GROUP_RULES 还没覆盖的 skill——见到请先在规则里补一条，不要把 other 当常态桶', hints: [] },
};

/**
 * 大类规则：按顺序匹配 name，命中即返回；都不中 → other（提醒补规则）
 * 注意顺序：先具体后宽泛——wechat/gzh/baoyu 系先归位，剩下的 dev 名再进 dev-workflow
 */
const GROUP_RULES = [
  { match: (n) => ['gateway', 'skill-creator', 'find-skills', 'ponytail', 'task-quantify', 'release-skills'].includes(n), group: 'meta' },
  { match: (n) => ['dbs', 'dbs-action', 'dbs-agent-migration', 'dbs-ai-check', 'dbs-chatroom', 'dbs-chatroom-austrian', 'dbs-decision', 'dbs-deconstruct', 'dbs-diagnosis', 'dbs-goal', 'dbs-good-question', 'dbs-report', 'dbs-restore', 'dbs-save', 'dbs-slowisfast'].includes(n), group: 'biz-diagnosis' },
  { match: (n) => n.startsWith('gzh-') || n.startsWith('wechat-') || n.startsWith('baoyu-post-') || n === 'baoyu-markdown-to-html' || n === 'baoyu-wechat-summary' || n === 'dbs-wechat-html', group: 'wechat-publishing' },
  { match: (n) => ['baoyu-image-gen', 'baoyu-cover-image', 'baoyu-infographic', 'baoyu-xhs-images', 'baoyu-diagram', 'baoyu-comic', 'baoyu-slide-deck', 'baoyu-article-illustrator'].includes(n), group: 'visual-gen' },
  { match: (n) => ['smart-short-video-editor', 'videodb', 'audio-analysis'].includes(n), group: 'video-audio' },
  { match: (n) => n.startsWith('writing-'), group: 'writing-craft' },
  { match: (n) => ['kb-question-layer', 'ai-lesson-3in1', 'dbs-learning', 'teach'].includes(n), group: 'knowledge-learning' },
  { match: (n) => ['git-guardrails-claude-code', 'setup-pre-commit', 'migrate-to-shoehorn', 'scaffold-exercises'].includes(n), group: 'devops-repo' },
  { match: (n) => n.startsWith('baoyu-url') || n.startsWith('baoyu-danger') || n.startsWith('baoyu-electron') || n.startsWith('baoyu-compress') || n.startsWith('baoyu-translate') || n === 'baoyu-youtube-transcript' || n === 'baoyu-format-markdown', group: 'utility-fetch' },
  { match: (n) => n.startsWith('jfp-') || n.startsWith('douyin-') || n === 'short-video-kb' || n.startsWith('shortvideo-') || ['content-factory', 'course-deconstruct', 'dbs-hook', 'dbs-spread', 'dbs-resonate', 'dbs-content', 'dbs-content-system', 'dbs-xhs-title', 'dbs-benchmark'].includes(n), group: 'content-growth' },
  { match: (n) => n === 'yys-auto-farm', group: 'misc' },
  { match: (n) => ['agentflow', 'ask-matt', 'claude-handoff', 'code-review', 'codebase-design', 'diagnosing-bugs', 'domain-modeling', 'frontend-design', 'grill-me', 'grill-with-docs', 'grilling', 'handoff', 'implement', 'implement-spec', 'improve-codebase-architecture', 'loop-me', 'prototype', 'research', 'resolving-merge-conflicts', 'retro', 'setup-matt-pocock-skills', 'setup-ts-deep-modules', 'tdd', 'to-questionnaire', 'to-spec', 'to-tickets', 'triage', 'typesafe-ai', 'wait-what', 'wayfinder', 'wizard'].includes(n), group: 'dev-workflow' },
];

function groupOf(name) {
  for (const rule of GROUP_RULES) {
    if (rule.match(name)) return rule.group;
  }
  return 'other';
}

/** 小问题短语：从 description 首句截取，让导航第二步「这个 skill 解决什么小问题」可扫读 */
function buildSolvesSmall(name, description, trigger) {
  const src = (description || trigger || '').trim();
  if (!src) return '';
  const first = src.split(/[。；;\n]/)[0].trim();
  const cut = first.length > 60 ? first.slice(0, 60) + '…' : first;
  return cut || name;
}

/** 解析 YAML frontmatter（只取 name / description，够用且不引第三方依赖） */
function parseFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0].trim() !== '---') return {};

  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end === -1) return {};

  const fm = {};
  let key = null;
  let buf = [];
  let scalar = null; // '>' '|' '>-' '|-' 或 null

  const flush = () => {
    if (key) fm[key] = buf.join(' ').replace(/\s+/g, ' ').trim();
    key = null;
    buf = [];
    scalar = null;
  };

  for (let i = 1; i < end; i++) {
    const raw = lines[i];
    const m = raw.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m) {
      flush();
      key = m[1];
      const val = m[2].trim();
      const blockMatch = val.match(/^[>|][-|]?$/);
      if (blockMatch) {
        scalar = val;
        buf = [];
      } else {
        // 去掉行内引号
        fm[key] = val.replace(/^["']|["']$/g, '');
        key = null;
      }
    } else if (key && scalar) {
      buf.push(raw.trim());
    } else if (key) {
      buf.push(raw.trim());
    }
  }
  flush();
  return fm;
}

/** 从正文提取 H2 标题作为 capability 标识 */
function extractCapabilities(body) {
  const heads = [];
  const re = /^##\s+(.+)$/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    const h = m[1].replace(/[*`#]/g, '').trim();
    if (h && h.length < 40 && !/^(可选|参考|附|铁律|依赖)/.test(h)) heads.push(h);
  }
  return heads.slice(0, 8);
}

/** 从正文里找出被引用的其他 skill（作为依赖关系线索） */
function extractDeps(body, allNames) {
  const deps = new Set();
  for (const n of allNames) {
    // 反引号包裹、或 `skill-name` 形式、或 /{name} 命令形式
    if (new RegExp('[`/\\[]"?' + n.replace(/[-]/g, '\\-') + '"?[`\\]]').test(body)) deps.add(n);
  }
  return [...deps];
}

/**
 * 中文同义词表：英文概念 → 中文检索词。
 * 作用：mattpocock 那批 skill 的 description 几乎全英文，中文 query 命中不了。
 * 这里按 token 片段注入中文词，提升中文召回。命中即注入，不覆盖英文 token。
 */
const ZH_SYNONYMS = [
  { re: /review/, zh: ['评审', '代码评审', '检查'] },
  { re: /test-driven|tdd|red[- ]?green|unit test|test first|做测试|写测试/, zh: ['测试', '测试驱动', '单元测试', '红绿重构'] },
  { re: /to-spec|prd|requirement|specifications?|specify/, zh: ['需求', '规约', '规格', '设计文档'] },
  { re: /grill|interview/, zh: ['拷问', '对齐', '访谈', '需求澄清', '计划'] },
  { re: /triage/, zh: ['分流', '工单分流', '问题分流'] },
  { re: /ticket/, zh: ['工单', '任务拆分', '拆任务'] },
  { re: /implement|implementation/, zh: ['实现', '落地', '编码', '开发'] },
  { re: /wayfinder|roadmap/, zh: ['规划', '路线图', '任务规划'] },
  { re: /diagnos|debug|defect/, zh: ['诊断', '排错', '调试', '缺陷', '找bug'] },
  { re: /conflict|merge|rebase/, zh: ['合并冲突', '解决冲突', '分支合并'] },
  { re: /domain|ontolog/, zh: ['领域建模', '术语', '概念模型'] },
  { re: /architect|module|deep[- ]?module/, zh: ['架构', '模块设计', '深模块', '系统设计'] },
  { re: /prototype/, zh: ['原型', '原型验证'] },
  { re: /research|investigat/, zh: ['调研', '调研报告', '查证'] },
  { re: /url|fetch|scrape|crawl/, zh: ['网页', '链接', '网址', '抓取'] },
  { re: /wizard|bash/, zh: ['向导', '脚手架', '交互式', '凭据', 'ci'] },
  { re: /handoff|hand-off/, zh: ['交接', '交棒', '上下文传递'] },
  { re: /teach|tutor|learn/, zh: ['教学', '教会', '学习', '带练'] },
  { re: /questionnair|survey/, zh: ['问卷', '决策问卷'] },
  { re: /clarif|rephrase|recap|wait-what/, zh: ['澄清', '重述', '没听懂'] },
  { re: /writing|write|draft|beat|fragment|prose|essay/, zh: ['写作', '起稿', '写作方法', '素材', '文章'] },
  { re: /retro|retrospect/, zh: ['复盘', '回顾', '回顾会'] },
  { re: /loop|iterat/, zh: ['循环', '迭代'] },
  { re: /commit|branch/, zh: ['提交', '分支'] },
  { re: /hook|pre-commit|husky|lint-staged|lint/, zh: ['钩子', '提交前', 'lint'] },
  { re: /depend|dependency/, zh: ['依赖', '依赖图'] },
  { re: /type|typescript|\bts\b/, zh: ['类型', '类型安全', 'ts'] },
  { re: /exercise|solution|explainer|problem/, zh: ['练习', '习题', '讲解'] },
];

/** 子类型：在 category 粗分类之上做二级细分，供 Phase 4 第 1 层细筛，避免 dev 桶被 42 个 skill 淹没 */
function subtypeOf(name, category) {
  if (category === 'content' || category === 'publishing') return 'writing';
  const wf = ['ask-matt','grill-me','grilling','grill-with-docs','triage','to-spec','to-tickets','implement','wayfinder','tdd','code-review','diagnosing-bugs','domain-modeling','codebase-design','improve-codebase-architecture','resolving-merge-conflicts','prototype','research','handoff','teach','to-questionnaire','wait-what','writing-for-agents','claude-handoff','implement-spec','loop-me','retro','setup-matt-pocock-skills','setup-ts-deep-modules'];
  if (wf.includes(name)) return 'eng-workflow';
  const devops = ['git-guardrails-claude-code','setup-pre-commit','migrate-to-shoehorn','scaffold-exercises'];
  if (devops.includes(name)) return 'devops';
  if (name.startsWith('baoyu-format') || ['agentflow','frontend-design','wizard'].includes(name)) return 'dev-tool';
  if (category === 'dev') return 'dev-generic';
  return category;
}

/** 生成检索关键词：英文 token + 中文短语 + 触发词 + 中文同义词注入 */
function buildKeywords(name, description, capabilities) {
  const text = [name, description, ...capabilities].join(' ');
  const kw = new Set();

  // 英文/数字 token
  for (const t of text.toLowerCase().match(/[a-z][a-z0-9+#.-]{1,}/g) || []) {
    if (t.length > 2) kw.add(t);
  }
  // 中文：按标点/空白切开成短语，保留 2-12 字片段
  const cnPhrases = text
    .split(/[\s,，。、/（）()「」“”『』：:；;！!？?—\-|#*+\n\r<>{}\[\]"'`]/)
    .map((s) => s.trim())
    .filter((s) => /^[一-龥]{2,12}$/.test(s));
  for (const p of cnPhrases) kw.add(p);
  // 触发词 /xxx、/中文
  for (const t of text.match(/\/([\w一-龥-]{2,12})/g) || []) {
    kw.add(t.slice(1));
  }
  // 中文同义词注入（针对英文 description 的 skill，提升中文召回）
  const lowerAll = text.toLowerCase();
  for (const { re, zh } of ZH_SYNONYMS) {
    if (re.test(lowerAll)) for (const w of zh) kw.add(w);
  }
  // 始终保留技能名本身（兜底检索）
  kw.add(name);
  return [...kw].slice(0, 120);
}

function main() {
  const checkOnly = process.argv.includes('--check');

  if (!fs.existsSync(SKILLS_ROOT)) {
    console.error('[gateway] skills 根目录不存在:', SKILLS_ROOT);
    process.exit(1);
  }

  const dirs = fs
    .readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((d) => d !== 'gateway' || true); // gateway 自己也入库，便于自省

  const entries = [];
  const allNames = dirs.slice();

  for (const dir of dirs) {
    const skillPath = path.join(SKILLS_ROOT, dir, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      console.warn(`[gateway] 跳过 ${dir}：无 SKILL.md`);
      continue;
    }
    const content = fs.readFileSync(skillPath, 'utf8');
    const fm = parseFrontmatter(content);
    const body = content.split(/\r?\n---\r?\n/).slice(1).join('\n---\n');

    const name = fm.name || dir;
    let description = (fm.description || '').trim();
    if (description.length > 300) description = description.slice(0, 300) + '…';

    const capabilities = extractCapabilities(body);
    const dependencies = extractDeps(body, allNames).filter((d) => d !== name);

    // 空 capability 兜底：从中文同义词表给一个中文能力标签，避免 grilling 类 skill 被当无能力
    const caps = capabilities.slice();
    if (caps.length === 0) {
      const lowerAll = (name + ' ' + description).toLowerCase();
      for (const { re, zh } of ZH_SYNONYMS) {
        if (re.test(lowerAll)) { caps.push(zh[0]); break; }
      }
    }

    const category = categorize(name);
    const group = groupOf(name);
    entries.push({
      name,
      type: path.join(SKILLS_ROOT, dir).includes('plugins') ? 'plugin' : 'agent',
      path: skillPath,
      description,
      trigger: (((fm.description || '').match(/触发方式[：:]\s*([^\n。；;]+)/)?.[1] || '').trim().slice(0, 60)),
      category,
      subtype: subtypeOf(name, category),
      capabilities: caps,
      dependencies,
      keywords: buildKeywords(name, description, caps),
      related: [],
      group,
      solves_small: buildSolvesSmall(name, description, fm.description || ''),
    });
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  // 计算摘要指纹，用于 --check 判断过期
  const fingerprint = entries.map((e) => `${e.name}@${e.path}`).join('|');

  const index = {
    version: '2.1',
    updated_at: new Date().toISOString(),
    skill_count: entries.length,
    capability_count: entries.reduce((s, e) => s + e.capabilities.length, 0),
    group_count: Object.keys(GROUP_META).length,
    generator: 'refresh-index.js',
    fingerprint,
    groups: Object.fromEntries(
      Object.entries(GROUP_META).map(([gid, meta]) => [
        gid,
        { ...meta, count: entries.filter((e) => e.group === gid).length },
      ])
    ),
    skills: Object.fromEntries(entries.map((e) => [e.name, e])),
  };

  if (checkOnly) {
    const old = fs.existsSync(INDEX_PATH)
      ? JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'))
      : null;
    const stale = !old || old.fingerprint !== fingerprint;
    console.log(
      stale
        ? `[gateway] 索引已过期（本地 ${old ? old.skill_count : 0} 条 / 实际 ${entries.length} 条），需重建`
        : `[gateway] 索引是最新的（${entries.length} 条）`
    );
    process.exit(stale ? 1 : 0);
  }

  // 备份旧索引
  if (fs.existsSync(INDEX_PATH)) {
    fs.copyFileSync(INDEX_PATH, path.join(__dirname, 'index.json.backup'));
  }
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf8');

  console.log(`[gateway] 索引重建完成：${entries.length} 个 skill / ${index.capability_count} 项 capability`);
  const byCat = entries.reduce((m, e) => ((m[e.category] = (m[e.category] || 0) + 1), m), {});
  console.log('[gateway] 分类分布:', JSON.stringify(byCat));
  console.log('[gateway] 输出:', INDEX_PATH);
}

main();
