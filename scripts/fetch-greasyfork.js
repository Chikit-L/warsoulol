// ESM —— 仅解析 HTML，不走任何 API
// 功能：
// 1) 从 scripts/list.json 读取脚本清单（最少只需 name / gf_id / page / desc）
// 2) 请求脚本信息页 HTML，提取：版本 + 更新时间（<relative-time datetime>）
// 3) 若更新时间没取到，兜底请求 /versions 页的第一条 <time datetime>
// 4) 根据 page 自动生成 Tampermonkey 官方/镜像安装链接
// 5) 将 updated_at 规范化为 YYYY-MM-DD，写入 data/warsoul.json

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIST = path.resolve(__dirname, './list.json');
const OUT  = path.resolve(__dirname, '../data/warsoul.json');

const REQ_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

async function fetchHtml(url) {
  const res = await fetch(url, { headers: REQ_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// —— HTML 提取 —— //
function pickFromInfoHtml(html) {
  // 版本：<dd class="script-show-version"><span>1.0</span>
  const version =
    html.match(/<dd[^>]*class="script-show-version"[^>]*>\s*<span>([^<]+)<\/span>/i)?.[1] ||
    html.match(/<dt[^>]*>\s*版本\s*<\/dt>\s*<dd[^>]*>\s*<span>([^<]+)<\/span>/i)?.[1] ||
    null;

  // 更新时间：<dd class="script-show-updated-date">...<relative-time datetime="...">
  const updated_at =
    html.match(/<dd[^>]*class="script-show-updated-date"[^>]*>[\s\S]*?relative-time[^>]*datetime="([^"]+)"/i)?.[1] ||
    html.match(/<dt[^>]*>\s*更新于?\s*<\/dt>[\s\S]*?datetime="([^"]+)"/i)?.[1] ||
    null;

  return { version, updated_at };
}

function pickFromVersionsHtml(html) {
  // 找第一处 <time datetime="...">
  const updated_at = html.match(/<time[^>]*datetime="([^"]+)"/i)?.[1] || null;
  return { updated_at };
}

// —— URL 工具 —— //
function toVersionsUrl(infoUrl) {
  try {
    const u = new URL(infoUrl);
    if (!u.pathname.endsWith('/versions')) {
      u.pathname = u.pathname.replace(/\/+$/, '') + '/versions';
    }
    return u.toString();
  } catch {
    return infoUrl;
  }
}

function buildInstallUrlsFromPage(page) {
  // page: https://greasyfork.org/zh-CN/scripts/549786-warsoul-battle-monitor
  try {
    const url = new URL(page);
    const m = url.pathname.match(/\/scripts\/(\d+)-([^/]+)/);
    if (!m) return { official: '-', mirror: '-' };
    const id = m[1];
    const slug = m[2]; // warsoul-battle-monitor
    const fileName = encodeURIComponent(slug.replace(/-/g, ' ')) + '.user.js';
    const officialRaw = `https://update.greasyfork.org/scripts/${id}/${fileName}`;
    const mirrorRaw   = `https://update.gf.qytechs.cn/scripts/${id}/${fileName}`;
    return {
      official: `https://www.tampermonkey.net/script_installation.php#url=${officialRaw}`,
      mirror:   `https://www.tampermonkey.net/script_installation.php#url=${mirrorRaw}`,
    };
  } catch {
    return { official: '-', mirror: '-' };
  }
}

// —— 日期规整 —— //
function dateOnly(s) {
  if (!s) return '-';
  const str = String(s).trim();
  if (str.includes('T') && str.length >= 10) return str.slice(0, 10); // ISO 直接裁前10位
  const d = new Date(str);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return '-';
}

function normalizeItem(item) {
  return {
    ...item,
    version: item.version || '-',
    updated_at: item.updated_at ? dateOnly(item.updated_at) : '-', // 统一为 YYYY-MM-DD
    source: item.source || 'html',
  };
}

// —— 主流程 —— //
async function fetchOne(item) {
  let version = null;
  let updated_at = null;

  // ① 信息页
  try {
    const html = await fetchHtml(item.page);
    const p = pickFromInfoHtml(html);
    version = p.version ?? version;
    updated_at = p.updated_at ?? updated_at;
  } catch {}

  // ② 兜底：历史版本页
  if (!updated_at) {
    try {
      const versionsHtml = await fetchHtml(toVersionsUrl(item.page));
      const p2 = pickFromVersionsHtml(versionsHtml);
      updated_at = p2.updated_at ?? updated_at;
    } catch {}
  }

  const urls = buildInstallUrlsFromPage(item.page);

  return normalizeItem({
    name: item.name,
    gf_id: item.gf_id,
    page: item.page,
    desc: item.desc || '-',
    version,
    updated_at,
    install_official: urls.official,
    install_mirror: urls.mirror,
  });
}

async function main() {
  const list = JSON.parse(await fs.readFile(LIST, 'utf-8'));
  const results = [];
  for (const it of list) {
    results.push(await fetchOne(it));
  }
  const payload = { fetched_at: new Date().toISOString(), items: results };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('Saved:', OUT, results.length, 'items');
}

main().catch((e) => { console.error(e); process.exit(1); });
