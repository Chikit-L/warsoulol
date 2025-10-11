// scripts/fetch-greasyfork.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT = path.resolve(__dirname, '../data/warsoul.json');
const PAGE = 'https://greasyfork.org/zh-CN/scripts/549786-warsoul-battle-monitor';
const API_PRIMARY = 'https://api.greasyfork.org/scripts/549786.json';
const API_MIRROR = 'https://api.greasyfork.org.cn/scripts/549786.json';

async function getFromApi(url) {
  const res = await fetch(url, { headers: { 'accept': 'application/json' } });
  if (!res.ok) throw new Error(`Bad status ${res.status}`);
  return res.json();
}

async function getFromHtml(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bad status ${res.status}`);
  const html = await res.text();
  // 极简解析：从“版本”和“更新日期”字段附近抽取（中文界面）
  const verMatch = html.match(/版本\s*([0-9A-Za-z_.-]+)/);
  const updMatch = html.match(/更新日期[^0-9]*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/);
  return {
    version: verMatch ? verMatch[1] : undefined,
    updated_at: updMatch ? updMatch[1] : undefined,
  };
}

async function main() {
  let version, updated_at;
  try {
    const data = await getFromApi(API_PRIMARY);
    version = data?.version || data?.code_version || data?.version_number;
    updated_at = data?.versions?.[0]?.created_at || data?.updated || data?.last_updated_at;
  } catch (e1) {
    try {
      const data = await getFromApi(API_MIRROR);
      version = data?.version || data?.code_version || data?.version_number;
      updated_at = data?.versions?.[0]?.created_at || data?.updated || data?.last_updated_at;
    } catch (e2) {
      const data = await getFromHtml(PAGE);
      version = data.version; updated_at = data.updated_at;
    }
  }

  const payload = {
    version: version || '-',
    updated_at: updated_at || '-',
    fetched_at: new Date().toISOString(),
    source: version ? 'api' : 'html'
  };

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('Saved:', payload);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});