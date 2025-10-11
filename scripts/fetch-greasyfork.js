// ESM
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 输入与输出
const LIST = path.resolve(__dirname, './list.json');
const OUT  = path.resolve(__dirname, '../data/warsoul.json');

// API 主站 & 镜像
const apiUrl = (id) => `https://api.greasyfork.org/scripts/${id}.json`;
const apiUrlMirror = (id) => `https://api.greasyfork.org.cn/scripts/${id}.json`;

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

// 简单 HTML 兜底解析（中文页）
function parseFromHtml(html) {
  const ver = html.match(/版本\s*([0-9A-Za-z_.-]+)/)?.[1];
  const upd = html.match(/更新日期[^0-9]*([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2})/)?.[1];
  return { version: ver, updated_at: upd };
}

// 统一取字段，尽量容错
function pickVersionAndDate(j) {
  const version =
    j?.version ||
    j?.code_version ||
    j?.version_number ||
    j?.versions?.[0]?.version ||
    '-';

  const updated_at =
    j?.versions?.[0]?.created_at ||
    j?.updated ||
    j?.last_updated_at ||
    j?.last_updated ||
    null;

  return { version, updated_at };
}

async function fetchOne(item) {
  const id = item.gf_id;
  // 1) API 主站
  try {
    const j = await fetchJson(apiUrl(id));
    const { version, updated_at } = pickVersionAndDate(j);
    return { ...item, version, updated_at, source: 'api' };
  } catch {}

  // 2) API 镜像
  try {
    const j = await fetchJson(apiUrlMirror(id));
    const { version, updated_at } = pickVersionAndDate(j);
    return { ...item, version, updated_at, source: 'api-mirror' };
  } catch {}

  // 3) 兜底：解析脚本页面 HTML
  try {
    const html = await fetchHtml(item.page);
    const { version, updated_at } = parseFromHtml(html);
    return { ...item, version: version || '-', updated_at: updated_at || '-', source: 'html' };
  } catch (e) {
    return { ...item, version: '-', updated_at: '-', source: 'error' };
  }
}

async function main() {
  const list = JSON.parse(await fs.readFile(LIST, 'utf-8'));
  const results = [];
  for (const it of list) results.push(await fetchOne(it));

  const payload = {
    fetched_at: new Date().toISOString(),
    items: results
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('Saved:', OUT, payload.items.length, 'items');
}
main().catch((e) => { console.error(e); process.exit(1); });
