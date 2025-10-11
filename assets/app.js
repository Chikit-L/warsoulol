(function () {
  const WEEKLY_TARGET_DESC = "每周日零点更新"; // 文案可改
  const MONTHLY_TARGET_DESC = "每月月初零点刷新"; // 文案可改
  const DATA_URL = "./data/warsoul.json?t=" + Date.now(); // 防缓存

  const $ = (sel) => document.querySelector(sel);
  const weeklyEl = $("#weekly-countdown");
  const monthlyEl = $("#monthly-countdown");
  const yearEl = $("#year");
  yearEl.textContent = new Date().getFullYear();

  /* ========== 倒计时逻辑（基于本地时区） ========== */
  function nextSundayMidnight(now = new Date()) {
    const d = new Date(now);
    const day = d.getDay(); // 0=周日
    // 目标：下一个周日 00:00。若当前已是周日且过了0点，取下周日。
    const daysUntilSunday = (7 - day) % 7 || 7;
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysUntilSunday, 0, 0, 0, 0);
    return target;
  }

  function nextMonthFirstMidnight(now = new Date()) {
    const d = new Date(now);
    const target = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
    return target;
  }

  function fmt(ms) {
    if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0 };
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / (3600 * 24));
    const h = Math.floor((s % (3600 * 24)) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return { d, h, m, s: sec };
  }

  function renderCountdown() {
    const now = new Date();
    const weeklyTarget = nextSundayMidnight(now);
    const monthlyTarget = nextMonthFirstMidnight(now);
    const w = fmt(weeklyTarget - now);
    const m = fmt(monthlyTarget - now);
    weeklyEl.textContent = `${w.d}天 ${w.h}小时 ${w.m}分钟 ${w.s}秒钟`;
    monthlyEl.textContent = `${m.d}天 ${m.h}小时 ${m.m}分钟 ${m.s}秒钟`;
  }

  setInterval(renderCountdown, 1000);
  renderCountdown();

  /* ========== 渲染油猴脚本表格 ========== */
  async function loadScriptInfo() {
    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error("无法读取 warsoul.json");
      const info = await res.json();

      const rowHtml = `
        <tr>
          <td><a href="https://greasyfork.org/zh-CN/scripts/549786-warsoul-battle-monitor" target="_blank" rel="noopener">WarSoul Battle Monitor</a></td>
          <td>${info.version || "-"}</td>
          <td>${info.updated_at || "-"}</td>
          <td><a href="https://www.tampermonkey.net/script_installation.php#url=https://update.greasyfork.org/scripts/549786/WarSoul%20Battle%20Monitor.user.js" target="_blank" rel="noopener">点击安装</a></td>
          <td><a href="https://www.tampermonkey.net/script_installation.php#url=https://update.gf.qytechs.cn/scripts/549786/WarSoul%20Battle%20Monitor.user.js" target="_blank" rel="noopener">点击安装</a></td>
          <td>根据怪物血量下降速度，预测是否能按时击败怪物</td>
        </tr>`;

      document.getElementById("script-rows").innerHTML = rowHtml;
    } catch (err) {
      console.error(err);
      document.getElementById("script-rows").innerHTML = `
        <tr>
          <td colspan="6">无法加载 GreasyFork 数据，请稍后刷新页面。</td>
        </tr>`;
    }
  }

  loadScriptInfo();
})();