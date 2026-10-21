# 拾日 · 私人 AI 日历

一个无需 Google 授权的中文个人日历。前端为原生 HTML/CSS/JavaScript，可部署到 GitHub Pages；后端运行于 Cloudflare Workers，日程保存在 D1。

## 已部署地址

- 网页：https://unsone.github.io/shiri-calendar/
- API 与备用网页：https://shiri-calendar-api.unsone-shiri.workers.dev
- 源码：https://github.com/Unsone/shiri-calendar

首次打开网页，在“设置与同步”中填写 `.local/连接口令.txt` 中的口令即可；服务地址已经预填。手机和电脑使用同一个口令。

## 功能

- 月、周、日程列表、今天和待办视图，所有安排统一管理，不再按生活、工作等分类。
- 创建、编辑、完成、删除与撤销删除。
- 右侧 DeepSeek Flash 连续对话，支持追问、补充条件、调整未应用的方案，确认后写入日历。
- 对话记录保存在当前浏览器，并与连接的日历空间隔离；刷新后可继续，清空对话不影响日程。当前不跨设备同步聊天记录。
- 本机缓存、离线编辑、联网同步、每 20 秒自动刷新。
- 同一条日程发生并发编辑时，手动选择本机或云端版本。
- JSON 备份与导入，PWA 离线页面。
- 点击顶部日期标题或按 `G`，用年份、月份和日期网格快速跨年跳转；日程编辑器也有同款日期选择器。
- 周视图具有固定左侧时间轴，标准时间标度支持 1 小时 / 2 小时网格；课程时间标度按北航节次显示，午休和课间压缩。
- 点击空白时间格直接新建，重叠日程并排显示；日程编辑器可用起止节次直接填入时间。
- 日历默认使用 55% 紧凑时间轴，可切换 75% / 100%；桌面日历与对话区并排，手机通过“AI 助手”按钮打开对话面板。
- 手动支持每天 / 每周重复，选择多个星期、间隔（含隔周）和截止日期。编辑或删除系列时可选择仅本次、本次及后续、整个系列。

## 一次录入整学期课程

新建日程 → 填写第一次课程的日期与时间（也可选择北航节次）→ 重复频率选“每周”→ 勾选上课星期 → 填写学期截止日期 → 保存。预览会显示次数和最后一次日期。

每个系列一次最多 300 次，最长两年。日程展开为独立记录并保留系列信息，单独调课不会改变其他课次；批量编辑会保留已经单独删除的例外和各次的完成状态。编辑“仅本次”时不修改系列规则，需选择其他作用范围才能更改频率或截止日期。

聊天也可安排重复课程：例如先说“每周一第3–5节上高数”，助手询问学期日期后继续回复，待方案完整再点击“应用到日历”。

## 北航课程节次

时间表集中在 `public/timetable.js`，界面与 DeepSeek 系统提示词共享它。支持“下周一第 3–5 节自习”等表达，转换为首节开始、末节结束，包含中间课间。

| 节次 | 时间 | 节次 | 时间 |
|---|---|---|---|
| 1 | 08:00–08:45 | 8 | 15:50–16:35 |
| 2 | 08:50–09:35 | 9 | 16:40–17:25 |
| 3 | 09:50–10:35 | 10 | 17:30–18:15 |
| 4 | 10:40–11:25 | 11 | 19:00–19:45 |
| 5 | 11:30–12:15 | 12 | 19:50–20:35 |
| 6 | 14:00–14:45 | 13 | 20:50–21:35 |
| 7 | 14:50–15:35 | 14 | 21:40–22:15 / 22:25 |

最后一节存在用户给定时段与 45 分钟规则的差异：设置中可以选择 22:15（默认，沿用用户给定结束时间，最后一节为 35 分钟），或 22:25（每节 45 分钟）。该设置保存在当前设备，时间轴、节次填入和 AI 请求使用同一设置。

界面采用深色侧栏、浅色日历和紫色重点色，参考 Motion 的日历信息层次；保留拾日自己的品牌和组件。

## 文件结构

```text
public/          GitHub Pages 静态网页，含 chat.js、recurrence.js、timetable.js
worker/          口令保护的同步与 AI 接口
migrations/      D1 数据库建表迁移
scripts/         本地运行与部署工具
tests/           鉴权、同步冲突、幂等、AI 预览测试
wrangler.jsonc   Cloudflare 配置及已有数据库 ID
.dev.vars        本地密钥，已忽略
.local/          部署凭据、私人连接口令等，已忽略
```

## 本地运行

需要 Node.js 22 或更高版本。

```powershell
npm install
npm run db:local
npm run dev
```

打开 http://127.0.0.1:8787 。设置中的服务地址也是该地址。

本地开发使用的测试口令：`local-preview-only-20261021-shiri-test`。
线上使用独立生成的强随机口令，保存于 `.local/连接口令.txt`。不要把本地测试口令用于线上。

`.dev.vars` 需要设置 `APP_TOKEN`（至少 32 字符）和 `DEEPSEEK_API_KEY`。生产密钥通过 Wrangler secrets 上传；不放在 `public` 中。客户端只保存日历连接口令，不保存 DeepSeek 密钥。

## 部署

```powershell
node scripts/cf.mjs login --device --scopes account:read user:read workers:write workers_scripts:write d1:write
npm run db:remote
node scripts/cf.mjs secret bulk .local/production-secrets.json
npm run deploy
```

`production-secrets.json` 是不提交的 JSON 对象，包含 `APP_TOKEN`、`DEEPSEEK_API_KEY`。
将 `public/config.js` 的 `apiBase` 设置为部署返回的 Worker HTTPS 地址，并在 `wrangler.jsonc` 的 `ALLOWED_ORIGINS` 添加 GitHub Pages 的来源，例如 `https://username.github.io`（不包含仓库路径），再部署。

GitHub Pages 发布 `public/` 内容。`node scripts/publish-github.mjs` 使用已授权的 GitHub CLI 创建并更新独立仓库，源码写入主分支，`public/` 写入 `gh-pages` 分支并开启 Pages。默认使用 `.local/gh/bin/gh.exe`，可通过 `GH_BIN` 指定其他路径。发布脚本只上传明确列出的源文件，不上传 `.local`、`.dev.vars`、旧 Git 历史或本机日程。

手机和电脑打开同一个网页，在设置中输入同一连接口令即可同步。连接口令等同此私人日历的访问权限，仅分享给你自己的设备。

## 验证

```powershell
npm run check
npm test
```

本地数据库和线上 D1 是独立的；本地验收日程不会随部署上传。

## 当前边界

- 本版本面向单人、多个可信设备，使用 256 位随机连接口令，不提供多用户账号系统。
- 自动同步间隔为 20 秒；恢复网络或切回页面会额外同步。
- AI 每小时最多 60 次请求，DeepSeek API 费用由你的账户承担。
- 日期时间以填写的本地钟表时间显示，AI 默认北京时间；跨时区旅行时请核对时间。
- 当前不支持关闭页面后的系统提醒；重复日程已支持每天 / 每周及自定义间隔。
- 导入备份会创建新记录，不会覆盖现有日程；切换同步账户会使用隔离的本机缓存。
- PWA 和离线能力依赖浏览器支持。清理浏览器数据会清除尚未同步的变更，请定期导出备份。
