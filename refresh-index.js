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

const HOME = process.env.HOME || process.env.USERPROFILE;
// 两个 skill 根目录。~/.agents/skills 是公共入口/主目录（CLAUDE.md 声明），
// ~/.workbuddy/skills 是历史目录。name 冲突时 ~/.agents/skills 优先（先遍历到即保留）。
const SKILLS_ROOTS = [
  path.join(HOME, '.agents', 'skills'),
  path.join(HOME, '.workbuddy', 'skills'),
];
const INDEX_PATH = path.join(__dirname, 'index.json');

/** 分类规则：按顺序匹配 name 前缀，命中即返回 */
const CATEGORY_RULES = [
  { match: (n) => n === 'gateway' || n === 'skill-creator' || n === 'find-skills' || n === 'release-skills' || n === 'ponytail' || n === 'task-quantify', category: 'meta' },
  { match: (n) => n === 'dbs' || n.startsWith('dbs-') || n.startsWith('douyin-') || n.startsWith('jfp-'), category: 'business' },
  { match: (n) => n.startsWith('shortvideo-') || n.startsWith('short-video-') || n.startsWith('course-') || n.startsWith('kb-'), category: 'content' },
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

/** 生成检索关键词：英文 token + 中文按标点切短语 + 触发词 */
function buildKeywords(name, description, capabilities) {
  const text = [name, description, ...capabilities].join(' ');
  const kw = new Set();

  // 英文/数字 token
  for (const t of text.toLowerCase().match(/[a-z][a-z0-9+#.-]{1,}/g) || []) {
    if (t.length > 2) kw.add(t);
  }
  // 中文：按标点/空白切开成短语，保留 2-12 字片段（不做固定长度滑窗，避免垃圾 token）
  const cnPhrases = text
    .split(/[\s,，。、/（）()「」“”『』：:；;！!？?—\-|#*+\n\r<>{}\[\]"'`]/)
    .map((s) => s.trim())
    .filter((s) => /^[一-龥]{2,12}$/.test(s));
  for (const p of cnPhrases) kw.add(p);
  // 触发词 /xxx、/中文
  for (const t of text.match(/\/([\w一-龥-]{2,12})/g) || []) {
    kw.add(t.slice(1));
  }
  // 始终保留技能名本身（兜底检索）
  kw.add(name);
  return [...kw].slice(0, 80);
}

function main() {
  const checkOnly = process.argv.includes('--check');

  const roots = SKILLS_ROOTS.filter((r) => fs.existsSync(r));
  if (roots.length === 0) {
    console.error('[gateway] 没有任何 skill 根目录存在:', SKILLS_ROOTS.join(', '));
    process.exit(1);
  }

  // 收集所有根下的 skill 目录。name 冲突时保留先遍历到的（~/.agents/skills 优先）。
  const dirByName = new Map(); // name -> { dir, root }
  for (const root of roots) {
    let subdirs;
    try {
      subdirs = fs.readdirSync(root, { withFileTypes: true });
    } catch (e) {
      console.warn(`[gateway] 读取 ${root} 失败:`, e.message);
      continue;
    }
    for (const d of subdirs) {
      if (!d.isDirectory()) continue;
      if (!fs.existsSync(path.join(root, d.name, 'SKILL.md'))) {
        console.warn(`[gateway] 跳过 ${root}/${d.name}：无 SKILL.md`);
        continue;
      }
      if (!dirByName.has(d.name)) {
        dirByName.set(d.name, { dir: d.name, root });
      }
    }
  }

  const entries = [];
  const allNames = [...dirByName.keys()];

  for (const { dir, root } of dirByName.values()) {
    const skillPath = path.join(root, dir, 'SKILL.md');
    const content = fs.readFileSync(skillPath, 'utf8');
    const fm = parseFrontmatter(content);
    const body = content.split(/\r?\n---\r?\n/).slice(1).join('\n---\n');

    const name = fm.name || dir;
    let description = (fm.description || '').trim();
    if (description.length > 300) description = description.slice(0, 300) + '…';

    const capabilities = extractCapabilities(body);
    const dependencies = extractDeps(body, allNames).filter((d) => d !== name);

    entries.push({
      name,
      type: path.join(root, dir).includes('plugins') ? 'plugin' : 'agent',
      path: skillPath,
      description,
      modelInvocation: fm['disable-model-invocation'] !== 'true',
      trigger: (((fm.description || '').match(/触发方式[：:]\s*([^\n。；;]+)/)?.[1] || '').trim().slice(0, 60)),
      category: categorize(name),
      capabilities,
      dependencies,
      keywords: buildKeywords(name, description, capabilities),
      related: [],
    });
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  // 计算摘要指纹，用于 --check 判断过期
  const fingerprint = entries.map((e) => `${e.name}@${e.path}`).join('|');

  const index = {
    version: '2.0',
    updated_at: new Date().toISOString(),
    skill_count: entries.length,
    capability_count: entries.reduce((s, e) => s + e.capabilities.length, 0),
    generator: 'refresh-index.js',
    fingerprint,
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
