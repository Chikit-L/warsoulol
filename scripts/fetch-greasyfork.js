// ESM —— 仅解析 HTML，不走任何 API
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIST = path.resolve(__dirname, './list.json');
const OUT  = path.resolve(__dirname, '../data/warsoul.json');

// 统一请求头，尽量拿到与你浏览器一致的 DOM（含 zh-CN）
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

// 从“脚本信息页”提取版本与更新时间（按你贴的结构）
function pickFromInfoHtml(html) {
  // 版本：<dd class="script-show-version"><span>1.0</span>
  const version =
    html.match(/<dd[^>]*class="script-show-version"[^>]*>\s*<span>([^<]+)<\/span>/i)?.[1] ||
    html.match(/<dt[^>]*>\s*版本\s*<\/dt>\s*<dd[^>]*>\s*<span>([^<]+)<\/span>/i)?.[1] ||
    null;

  // 更新时间：<dd class="script-show-updated-date"><span><relative-time datetime="...">
  const updated_at =
    html.match(/<dd[^>]*class="script-show-updated-date"[^>]*>[\s\S]*?relative-time[^>]*datetime="([^"]+)"/i)?.[1] ||
    html.match(/<dt[^>]*>\s*更新于?\s*<\/dt>[\s\S]*?datetime="([^"]+)"/i)?.[1] ||
    null;

  return { version, updated_at };
}

// 从“历史版本页”兜底抓最近一次更新时间：取第一处 <time datetime>
function pickFromVersionsHtml(html) {
  const updated_at = html.match(/<time[^>]*datetime="([^"]+)"/i)?.[1] || null;
  return { updated_at };
}

function normalizeItem(item) {
  return {
    ...item,
    version: item.version || '-',
    updated_at: item.updated_at || '-',
    source: item.source || 'html',
  };
}

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

async function fetchOne(item) {
  let version = null;
  let updated_at = null;

  // ① 信息页
  try {
    const html = await fetchHtml(item.page);
    const p = pickFromInfoHtml(html);
    version = p.version ?? version;
    updated_at = p.updated_at ?? updated_at;
  } catch (e) {
    // 忽略，继续尝试兜底
  }

  // ② 若更新时间还没拿到，去“历史版本页”兜底
  if (!updated_at) {
    try {
      const versionsHtml = await fetchHtml(toVersionsUrl(item.page));
      const p2 = pickFromVersionsHtml(versionsHtml);
      updated_at = p2.updated_at ?? updated_at;
    } catch (e) {
      // 忽略
    }
  }

  return normalizeItem({ ...item, version, updated_at });
}

async function main() {
  const listRaw = await fs.readFile(LIST, 'utf-8');
  const list = JSON.parse(listRaw);
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
