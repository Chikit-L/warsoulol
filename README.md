# ⚔️ 战魂觉醒OL · Awakening of War Soul OL

这是一个为 **战魂觉醒OL**（WarSoul OL）系列游戏制作的静态展示页，包含：
- 副本与大荒野刷新倒计时  
- 油猴脚本管理与自动更新表格  
- 商户价格监控入口  
- 自动化数据更新（GitHub Actions）

在线访问地址：  
👉 [https://chikit-l.github.io/warsoulol/](https://chikit-l.github.io/warsoulol/)

---

## 🌟 页面功能

### 🕒 倒计时系统
- **副本刷新倒计时**：每周日零点自动重置  
- **大荒野刷新倒计时**：每月月初零点自动重置  
- 以本地时间计算，实时更新显示

### 🧩 油猴脚本自动更新
- 自动从 [GreasyFork](https://greasyfork.org/) 抓取脚本信息  
- 每日运行 GitHub Actions 获取最新：
  - 脚本名称  
  - 版本号  
  - 更新时间  
  - 安装链接（官方 / 镜像）  
- 数据保存在 [`/data/warsoul.json`](./data/warsoul.json)

### 💹 商户价格监控
- 页面入口：  
  🔗 [商户价格监控](https://chikit-l.github.io/WarSoul_Monitor/)  
- 价格与物品数据仅供参考  
- 由于 GitHub Actions 更新存在一定延迟，请留意页面更新时间  

---

## ⚙️ 自动化更新说明

项目使用 GitHub Actions 实现自动数据更新。  

- **每日任务：**
  1. 执行 `scripts/fetch-greasyfork.js`  
  2. 抓取 GreasyFork 页面 HTML  
  3. 提取最新版本号与更新时间  
  4. 写入 `/data/warsoul.json`  
  5. 自动部署到 GitHub Pages

---

---

## 🧰 本地调试

如需在本地查看网页，可执行：

```bash
# 克隆项目
git clone https://github.com/你的用户名/warsoulol.git
cd warsoulol

# 启动本地静态服务器（任选其一）
npx serve .
# 或
python3 -m http.server
打开浏览器访问 http://localhost:8000 即可。

```