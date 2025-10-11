// ESM
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIST = path.resolve(__dirname, './list.json');
const OUT  = path.resolve(__dirname, '../data/warsoul.json');

// ① 本地化 JSON（来自 <link rel="alternate" type="application/json" ...>）
const localizedApi = (id) =>
  `https://api.greasyfork.org/zh-CN/scripts/${id}-dummy.json`.replace('-dummy', `/${id}-warsoul-battle-monitor`);
// 注意：上面这个 URL 需要脚本的 slug，通用写法用下面 safer 版本：
const localizedApiSafe = (id) => `https://api.greasyfork.org/zh-CN/scripts/${id}.json`;

// ② 通用 API
const apiUrl = (id) => `https://api.greasyfork.org/scripts/${id}.json`;

// ③ HTML 页
// 在 list.json 里我们会放 page: "https://greasyfork.org/zh-CN/scripts/<id>-<slug>"
async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function fetchHtml(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// 从 JSON 里尽量“捞”出版本&时间（兼容不同字段）
function pickFromJson(j) {
  const version =
    j?.version ||
    j?.code_version ||
    j?.version_number ||
    j?.versions?.[0]?.version ||
    '-';

  const updated_at =
    j?.updated_at ||
    j?.updated_date ||
    j?.last_updated ||
    j?.last_updated_at ||
    j?.updated ||
    j?.versions?.[0]?.created_at ||
    null;

  return { version, updated_at };
}

// 从 HTML 精准提取（按你贴的结构）
function pickFromHtml(html) {
  // 版本：<dd class="script-show-version"><span>1.0</span>
  const ver = html.match(/<dd[^>]*class="script-show-version"[^>]*>\s*<span>([^<]+)<\/span>/i)?.[1];

  // 更新时间：<dd class="script-show-updated-date"><span><relative-time datetime="...">
  const upd = html.match(/<dd[^>]*class="script-show-updated-date"[^>]*>[\s\S]*?relative-time[^>]*datetime="([^"]+)"/i)?.[1];

  return { version: ver || '-', updated_at: upd || '-' };
}

async function fetchOne(item) {
  const id = item.gf_id;

  // ① 先打本地化 JSON（更贴近你现在打开的 zh-CN 页）
  try {
    const j = await fetchJson(localizedApiSafe(id));
    const { version, updated_at } = pickFromJson(j);
    return { ...item, version: version || '-', updated_at: updated_at || '-', source: 'api-localized' };
  } catch {}

  // ② 通用 API
  try {
    const j = await fetchJson(apiUrl(id));
    const { version, updated_at } = pickFromJson(j);
    return { ...item, version: version || '-', updated_at: updated_at || '-', source: 'api' };
  } catch {}

  // ③ 解析 HTML（按你贴的 DOM 结构）
  try {
    const html = await fetchHtml(item.page);
    const { version, updated_at } = pickFromHtml(html);
    return { ...item, version, updated_at, source: 'html' };
  } catch {}

  // 失败兜底
  return { ...item, version: '-', updated_at: '-', source: 'error' };
}

async function main() {
  const list = JSON.parse(await fs.readFile(LIST, 'utf-8'));
  const results = [];
  for (const it of list) results.push(await fetchOne(it));
  const payload = { fetched_at: new Date().toISOString(), items: results };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('Saved:', OUT, payload.items.length, 'items');
}
main().catch((e) => { console.error(e); process.exit(1); });
