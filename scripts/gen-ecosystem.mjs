// Generates docs/ecosystem.md from the research file candidates.json.
// Usage: node scripts/gen-ecosystem.mjs data/research/candidates-2026-10-20.json docs/ecosystem.md
//
// Each candidate has evidence strings ("ev") written by the research sweeps.
// The script splits them into phrases, removes technical noise (hooks.json paths,
// star counts, install lines, post ids, dates) and keeps the first readable
// English phrase as the description. A few notes are in Russian: GLOSSARY
// translates the Russian phrases that would otherwise be the only description.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('usage: node gen-ecosystem.mjs <candidates.json> <out.md>');
  process.exit(2);
}
const candidates = JSON.parse(readFileSync(inPath, 'utf8'));

const GLOSSARY = [
  ['на statuslin.es отмечен как мод, рисующий только в Desktop', 'listed on statuslin.es as a mod that draws only in the desktop app'],
  ['(Deck, кокпит)', 'Deck: a cockpit view of the session'],
  ['(плагин flow-scenes)', 'flow-scenes plugin'],
  ['пиксель-арт полоса над промптом', 'pixel-art band above the prompt'],
  ['рестайлинг ответов, 15 тем', 'restyles replies, 15 themes'],
  ['скины строк инструментов, 15 тем', 'tool-row skins, 15 themes'],
  ['магазин модов внутри Claude Code (/mods), данные из mods.aidojo.si', 'mod store inside Claude Code (/mods), data from mods.aidojo.si'],
  ['свой маркетплейс + npm-установщик claude-code-mods', 'own marketplace plus the npm installer claude-code-mods'],
  ['karanbansal.in scoreboard и ccmodshub', 'listed on the karanbansal.in scoreboard and ccmodshub'],
  ['npm @cmodjs/cli и @cmodjs/core 3.1.0', 'npm @cmodjs/cli and @cmodjs/core 3.1.0'],
  ['в claudemods.chat как type:mod, panes:', 'claudemods.chat (panes):'],
  ['сайт betterclaude.dev', 'site betterclaude.dev'],
  ['Featured у karanb192', 'featured by karanb192'],
  ['описание репо:', 'repo description:'],
  ['описание:', 'description:'],
];

const CYR = /[Ѐ-ӿ]/;

// Rewrites applied to a phrase before noise removal.
const REWRITE = [
  [/\S*\{([^}]+)\}\/hooks\/hooks\.json\s*(?:=\s*\{[^}]*\})?/g, (_, list) => list.split(',').join(', ')],
  [/(\d+) hooks\/hooks\.json under (\S+)/gi, '$1 mods under $2'],
  [/^(?:this|it) is the only mod among/i, 'the only mod among'],
  [/^(?:the repo has )?(\d+) hooks\.json files?(?:, marketplace)?/i, 'collection with $1 hooks.json files'],
  [/\bin (?:the )?Anthropic directory as [\w.-]+(?:@anthropic-plugin-directory)?/gi, ''],
];

// Noise removed from inside a phrase.
const STRIP = [
  /\(install:?[^)]*\)/gi,
  /,?\s*install(?:ed)?(?: via| with)?:?\s*`[^`]+`(?:\s*(?:\+|&&|and|then)\s*`[^`]+`)*/gi,
  /,?\s*install(?:ed)?(?: via| with)?:?\s*(?:\/plugin|claude plugin|claude --plugin-dir|git clone)\b[^;]*/gi,
  /,?\s*(?:\/plugin|claude plugin) (?:install|marketplace add)\b[^;]*/gi,
  /,?\s*e\.g\.\s*[\w./{}*-]*hooks\/hooks\.json\s*(?:=\s*)?(?:\{[^}]*\}|modules\s*\[[^\]]*\]|"modules"\s*:\s*\[[^\]]*\])?/gi,
  /[\w./{}*-]*hooks\/hooks\.json\s*(?:=\s*|:\s*)?(?:\{[^}]*\}|modules\s*(?:=\s*)?\[[^\]]*\]|"modules"\s*:\s*\[[^\]]*\])?(?:\s*etc\.?)?/gi,
  /\bhooks\.json\s*(?:=\s*)?(?:modules\s*=?\s*\[[^\]]*\]|\{[^}]*\})(?:\s*etc\.?)?/gi,
  /,?\s*modules\s*\[[^\]]*\]/gi,
  /\s*\/\s*\['[^\]]*\]/g,
  /\(\s*\+\s*\d+\s*\)/g,
  /,?\s*validate=\w+/gi,
  /\((?:item\s*)?\d{8}\)/g,
  /\(1[a-z0-9]{6}\)/g,
  /\(score \d+\)/g,
  /\(thread \w+\)/g,
  /\s*\(featured[^)]*\)/gi,
  /\s*\(also on [^)]*\)/gi,
  /\s*\(highest-starred[^)]*\)/gi,
  /\s*\(?(?:issue )?comment \d{4}-\d{2}-\d{2}\)?/gi,
  /\bper karanb192 data\b/gi,
  /,?\s*(?:about\s*)?\d[\d,.]*k?\s*stars\b/gi,
  /★\d+/g,
  /,\s*(?:has a )?marketplace$/i,
];

// Phrases dropped as a whole.
const DROP = [
  /^\s*$/,
  /^(?:no |has a |has )?marketplace(?: name)?\s*[\w'.-]*\s*(?:\(\d+ entries\))?$/i,
  /^marketplace\b.*\b(?:\(\d+ entries\),|whose)\s/i,
  /^and\s/i,
  /^1 mod$/i,
  /^(?:\d+ )?marketplaces\b/i,
  /^not in the karanb192 dataset/i,
  /^featured\b/i,
  /not inspected|not individually checked/i,
  /^npm package\b/i,
  /^(?:\d+ )?test files?\b/i,
  /^links? hooks\/|register\.\w+|\.(?:tsx?|mjs)\b['\]]/i,
  /^modules\b/i,
  /^tests in\b/i,
  /^last commit\b/i,
  /^added (?:in commit|\d{4})/i,
  /^plugin\.json\b/i,
  /^each mod has screenshots/i,
  /^repo initial public release/i,
  /^demo\b/i,
  /^author says\b/i,
  /stories link/i,
  /^gh api listing/i,
  /^listed in (?:the same|claude-code\/mods)/i,
  /^source (?:packages|listings)/i,
  /^types at\b/i,
  /^first commit\b/i,
  /^official docs/i,
  /^readme:\s*'the mods need/i,
  /^karanb192 (?:shows|calls|lists it in)\b/i,
  /repackages it$/i,
  /^doom port pr/i,
  /^has (?:both )?(?:and )?classic/i,
  /^plus a classic/i,
  /^the same author/i,
  /^the repo description says 'available/i,
  /^community marketplace\.json has/i,
  /^mod at tree\//i,
  /^(?:this|it) is the only locally hosted/i,
  /^also\s*$/i,
];

// Phrases that only say where a mod is listed: used when nothing better exists.
const WEAK = [/\blisted (?:on|in)\b/i, /\bon statuslin\.es\b/i, /^draws [A-Z]/, /^gh search\b/i, /^site\b/i, /^collection with/i, /^the repo has/i, /scoreboard/i];

const COUNT = /^\d+ (?:own )?(?:mods?|plugins|records|mod records|original mods)\b/i;

function socialText(seg) {
  // Evidence from a post or comment: keep its title or the text after the date.
  if (/^cc issues?\b/i.test(seg)) return { text: null, issue: (seg.match(/#(\d+)/) || [])[1] };
  let rest = seg;
  const dates = [...rest.matchAll(/\d{4}-\d{2}-\d{2}(?:\/\d{2})?(?:\.\.\d{2})?/g)];
  if (dates.length) {
    const last = dates[dates.length - 1];
    rest = rest.slice(last.index + last[0].length);
  } else {
    rest = rest.replace(/^[^:']*:\s*/, '');
  }
  rest = rest
    .replace(/^\s*(?:\((?:score \d+|thread \w+|item \d+|\d+)\)\s*)*(?:@[\w-]+)?\s*:?\s*/, '')
    .replace(/^\+\s*r\/\w+\s*(?:\(score \d+\))?\s*/, '')
    .trim();
  const lead = rest.match(/^'(.+?)'(?=[\s,;:)(]|$)\s*(.*)$/);
  if (lead) {
    const after = lead[2]
      .replace(/\((?:item\s*)?\d{8}\)|\(1[a-z0-9]{6}\)|\(score \d+\)/g, '')
      .replace(/^[\s,;:]+|[\s,;:]+$/g, '')
      .replace(/^\((.*)\)$/, '$1')
      .trim();
    if (lead[1].length < 25 && after.length >= 12) return { text: after };
    return { text: lead[1] };
  }
  return { text: rest || null };
}

function claudemodsChat(seg) {
  const m = seg.match(/^claudemods\.chat(?:\s+type:mod)?\s*(.*)$/i);
  let rest = m[1].trim();
  if (rest.startsWith(':')) rest = rest.slice(1).trim();
  else if (rest.includes(': ')) rest = rest.slice(rest.indexOf(': ') + 2).trim();
  else return { text: rest ? `listed on claudemods.chat (${rest.replace(/[()]/g, '')})` : 'listed on claudemods.chat' };
  return { text: rest };
}

function analyze(raw) {
  const seg = raw.trim();
  let r;
  let social = false;
  if (/^claudemods\.chat\b/i.test(seg)) r = claudemodsChat(seg);
  else if (/^(?:Linked in Reddit|Reddit|Show HN|HN|cc#\d+|cc issues?|Issue #\d+ comment)\b/i.test(seg)) {
    r = socialText(seg);
    social = true;
  } else r = { text: seg.replace(/^issue comment \d{4}-\d{2}-\d{2}(?: describing)?:?\s*/i, '').replace(/^gh search (?:description )?/i, 'gh search ') };
  let { text } = r;
  const { issue } = r;
  if (!text) return { issue };
  if (CYR.test(text)) {
    const q = text.match(/'(.{12,}?)'(?=[\s,;:)(]|$)/);
    if (!q || CYR.test(q[1])) return { issue };
    text = q[1];
  }
  for (const [re, to] of REWRITE) text = text.replace(re, to);
  for (const re of STRIP) text = text.replace(re, '');
  text = text
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/^[\s,:;.\-–—+]+|[\s,:;.\-–—+]+$/g, '')
    .replace(/^(?:readme|repo description|description):\s*/i, '')
    .replace(/^also /i, '')
    .trim();
  if (/^['"].*['"]$/.test(text)) text = text.slice(1, -1).trim();
  if (/^\(.*\)$/.test(text)) text = text.slice(1, -1).trim();
  if (/^gh search\b/i.test(text)) {
    const q = text.match(/'([^']+)'/);
    if (q) text = `gh search: ${q[1]}`;
  }
  for (const re of DROP) if (re.test(text)) return { issue };
  const isCount = COUNT.test(text);
  if (!isCount && (text.length < 5 || !/[a-z]{3}/i.test(text))) return { issue };
  const short = (text.length < 10 || !/\s/.test(text)) && !isCount;
  return { text, issue, social, weak: short || WEAK.some((re) => re.test(text)), isCount };
}

const words = (t) => new Set(t.toLowerCase().split(/[\s,;()]+/).filter((w) => w.length > 3));
function overlaps(a, b) {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return false;
  let n = 0;
  for (const w of A) if (B.has(w)) n += 1;
  return n / Math.min(A.size, B.size) >= 0.5;
}

function phrasesOf(ev) {
  let s = ev.replace(/^sweep-\d+\.json:\s*/, '').replace(/\.\.\./g, '…');
  for (const [ru, en] of GLOSSARY) s = s.split(ru).join(en);
  s = s.replace(/^karanb192 data(?:\/mods\.json)?(?: \([^)]*\))?:\s*/i, '').replace(/\bkind=mod\b/g, '');
  return s
    .split(/;\s+|(?<!\be\.g|\bi\.e|\betc|\bvs|\.)\.\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function capitalize(t) {
  const first = t.split(/\s/)[0];
  if (/[.\d@_$]/.test(first) || /^[a-z]+[A-Z]/.test(first) || /^[/[]/.test(first)) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const LOWER_OK = new Set(['The', 'A', 'An', 'At', 'Own', 'Plus', 'Theme', 'Themes', 'Draws', 'Shows', 'Opens', 'Restyles', 'Adds', 'Keeps', 'Runs', 'Live', 'These', 'This', 'It', 'Its', 'Mod', 'Mods', 'Site']);
function lowerFirst(t) {
  const first = t.split(/\s/)[0];
  return LOWER_OK.has(first) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

function shorten(text, max = 150) {
  text = text.replace(/[\s.]+$/, '');
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf(' ('), cut.lastIndexOf(' '));
  return cut.slice(0, at > 60 ? at : max).replace(/[\s,(;:]+$/, '') + '…';
}

// Folder of the first hooks/hooks.json named in the evidence or in "paths".
function modPath(c) {
  for (const e of c.ev) {
    const m = e.match(/(?:^|[\s(:'"`])((?:[\w.-]+\/)*[\w.-]+)\/hooks\/hooks\.json/);
    if (m && !/^sweep-/.test(m[1])) return m[1];
  }
  const ok = (c.paths || []).filter((p) => p && !CYR.test(p) && !/[\s,{}*]/.test(p) && !/hooks\/|\.\w{2,4}$/.test(p));
  return ok.sort((a, b) => a.length - b.length)[0]?.replace(/\/$/, '');
}

const TRIVIAL = /^(?:mods|plugins|plugin|mod|src\/mod|\.)$/;
const squash = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

const SWEEP_ORDER = { 3: 0, 5: 1, 6: 2, 2: 3, 1: 4 };

function describe(c) {
  const evs = [...c.ev].sort((a, b) => {
    const n = (e) => SWEEP_ORDER[Number((e.match(/^sweep-(\d+)/) || [])[1])] ?? 9;
    return n(a) - n(b);
  });
  const strong = [];
  const weak = [];
  let issue = null;
  let directory = null;
  const seen = new Set();
  for (const ev of evs) {
    const dir = ev.match(/in (?:the )?Anthropic directory as ([\w.-]+)/i);
    if (dir && !directory) directory = dir[1].replace(/@.*$/, '');
    const evSocial = /^(?:Linked in Reddit|Reddit|Show HN|HN|cc#\d+|cc issues?|Issue #\d+)\b/i.test(ev.replace(/^sweep-\d+\.json:\s*/, ''));
    for (const phrase of phrasesOf(ev)) {
      const r = analyze(phrase);
      if (evSocial) r.social = true;
      if (r.issue && !issue) issue = r.issue;
      if (!r.text) continue;
      const key = r.text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      (r.weak ? weak : strong).push(r);
    }
  }
  let text;
  let fallback = false;
  const primary = strong[0] || weak[0];
  const path = modPath(c);
  if (primary) {
    text = primary.text;
    if (primary.isCount || text.length < 30) {
      const pool = (strong[0] === primary ? strong.slice(1) : primary.weak ? weak.slice(1) : strong).filter((r) => !r.social || primary.social);
      const sup = pool.find((r) => r.text.toLowerCase().includes(text.toLowerCase()));
      const next = pool.find(
        (r) =>
          !r.text.toLowerCase().includes(text.toLowerCase()) &&
          !text.toLowerCase().includes(r.text.toLowerCase()) &&
          !overlaps(text, r.text) &&
          text.length + r.text.length < 140,
      );
      if (sup && !primary.isCount) text = sup.text;
      else if (next) text = `${text}; ${lowerFirst(next.text)}`;
    }
  } else if (issue) {
    text = `linked from anthropics/claude-code issue #${issue}`;
  } else {
    fallback = true;
    if (c.conf === 'likely-mod') text = 'listed as a mod in the karanb192 scan data';
    else text = `no description in the research notes; hooks module in \`${path ? `${path}/` : ''}hooks/hooks.json\``;
  }
  text = capitalize(shorten(text));
  const notes = [];
  const vague = !primary || primary.weak || /only mod among/i.test(text);
  if (!fallback && vague && c.conf === 'confirmed-mod' && path && !TRIVIAL.test(path)) {
    const base = path.split('/').pop();
    if (!squash(text).includes(squash(base)) && !squash(c.repo.split('/')[1]).includes(squash(base))) notes.push(`mod in \`${path}\``);
  }
  if (directory && !/directory/i.test(text)) notes.push(`in Anthropic's directory as \`${directory}\``);
  if (notes.length) text += ` (${notes.join('; ')})`;
  return text.replace(/\|/g, '/');
}

const byRepo = (a, b) => a.repo.toLowerCase().localeCompare(b.repo.toLowerCase());
const confirmed = candidates.filter((c) => c.conf === 'confirmed-mod').sort(byRepo);
const likely = candidates.filter((c) => c.conf === 'likely-mod').sort(byRepo);
const possible = candidates.filter((c) => c.conf === 'possible');

const line = (c) => `- [${c.repo}](https://github.com/${c.repo}) — ${describe(c)}`;

const out = `# Mod ecosystem: raw index

> **Кратко по-русски.** Это сырой список репозиториев с модами, собранный скриптом из данных исследования 2026-10-20. Он не проверен и не входит в каталог. Описания взяты из заметок исследования и могут быть неточными. Как правильно добавить мод в каталог, написано ниже и в [CONTRIBUTING.md](../CONTRIBUTING.md).

This is a **raw index from the research of 2026-10-20**. A script generated it from the research file \`candidates.json\` (${candidates.length} repositories); nobody typed it by hand. It is **not verified** and it is **not the catalog**: a line here says nothing about whether a mod works, is safe or is still maintained.

- **Confirmed mods** (${confirmed.length}): during the research, a GitHub API check of the repository tree found at least one \`hooks/hooks.json\` with a \`"modules"\` key, which is what makes a plugin a mod. It was a one-time check; the code may have changed since.
- **Likely mods** (${likely.length}): named as mods by another catalog (mostly the karanb192 scan data) or by a post, and not re-checked by us.
- ${possible.length} entries marked "possible" are left out: repositories that returned 404, had no plugin layout, or turned out to be prototypes, npm packages or theme packs.
- A description is a short paraphrase of the research notes and can be wrong. Many repositories hold several mods; the line describes the repository.

The full report is in [research.md](research.md) (Russian) and [research.en.md](research.en.md) (English).

## How to add a mod to the catalog properly

Do not copy a line from this page into the catalog. A catalog entry is one file, \`mods/<name>/mod.json\`, sent as a pull request (see [CONTRIBUTING.en.md](../CONTRIBUTING.en.md)):

1. Check that the repository really holds a mod: a \`hooks/hooks.json\` with a \`modules\` key, a license, and a README that says what it does.
2. Run \`claude plugin validate <path>\` and read its \`hooks:\` and \`calls:\` lines; state them honestly in \`capabilities\`.
3. Point \`source\` at the author's marketplace or repository (pin a commit when you can) and describe in \`preview\` only what the code really draws.
4. Run \`npm ci && npm run check\`, then open the pull request. The author is the best maintainer of an entry: if you are not the author, say so in the pull request.

## Confirmed mods

${confirmed.map(line).join('\n')}

## Likely mods (unconfirmed)

${likely.map(line).join('\n')}
`;

writeFileSync(outPath, out);
console.log(`wrote ${outPath}: confirmed ${confirmed.length}, likely ${likely.length}, possible skipped ${possible.length}`);
