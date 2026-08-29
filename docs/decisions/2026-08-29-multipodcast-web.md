# 2026-08-29 · web 层多播客化的决策记录

起因：`feihua.lexgogo.site` 的域名过期失效，需要换域名；借机把只服务一档播客的静态站
改成「一个域名、按路径切播客」，以便后续接入更多播客。

任务卡 `podcast-insights-20260829-01`，执行器 cursor（cursor-grok-4.6-high），一轮通过。
实现见 commit `2deea68`，部署方式更正见 `f46b25a`。

---

## 锁定决策

### 1. URL 形态：根下一级 `/<key>/`

`picks.zlxlabs.com/feihua/`，不是 `/p/feihua/`，也不是 `feihua.picks.zlxlabs.com`。

- 子域名方案被否：用户要的是「同一域名下切 URL」，且每加一档播客都要配一次 DNS + Workers
  路由，运维更重。
- 前缀 `/p/` 被否：多两个字符换来的命名空间隔离，用一个保留字列表就能达到。

**代价**：播客 key 不能取站点级路径名。保留字 `assets` / `data` / `about` 在 `build.mjs`
里硬校验，命中即构建失败（`tests/test_build.py::test_reserved_key_fails` 锁死）。
将来新增站点级路径时，必须同步加进保留字列表。

### 2. 构建脚本用 Node（`build.mjs`），不用 Python

`build.sh` 退化为 `exec node build.mjs` 的 wrapper。

当时的理由是「Cloudflare Workers Builds 构建容器保证有 Node，不保证有 python3」。
后来发现 Workers Builds 根本没接（见下），这条理由失效，但结论仍然成立 —— 部署要跑
`wrangler`，本身就依赖 Node，用 Node 写构建脚本不引入任何新前提。

### 3. 播客名 / 条数 / 集数一律从数据读，不从 config 重复注入

`data/<key>/recommendations_all.json` 里已有 `podcast:{key,name}` 和 `stats`，
薄壳只注入 `key` 一个值（`window.__PODCAST__`）。

这条直接修掉了一个存量 bug：旧「关于」页把 **234 期 / 935 条**写死在 HTML 里，
而实际数据早已是 236 / 939。现在数字全部来自 `stats`，不会再漂移。

同理，`config.web.tagline` 里**不写数字** —— 首次实现写成了「…236 集里的美食…」，
验收时改掉。索引页卡片本来就从数据渲染「236 集 · 939 条」，tagline 再写一遍必然过期。

### 4. 本地预览必须先构建

`bash build.sh && cd dist && python3 -m http.server 8099`，不再支持在仓库根直开 `/web/`。

理由是消除「本地能跑、线上路径断」的漂移：前端用的是绝对路径（`/assets/`、`/data/<key>/`），
只有在 `dist/` 里起服务才和线上一致。

**但要知道本地与线上仍有一处差异**：线上 Workers 对 `/about/<key>.html` 会 307 重定向到
无后缀路径（`html_handling` 默认行为），本地 `http.server` 不会。前端 `fetch` 默认跟随
重定向，两边都正常，但改动 about 加载逻辑后必须在线上复验 —— 本地绿不等于线上绿。

---

## 验收时撤回的决定：Worker 不改名

任务卡原本要求把 `wrangler.jsonc` 的 `name` 从 `feihua` 改成 `podcast-insights`
（理由：叫 feihua 对多播客站是误导）。验收时撤回，改回 `feihua`。

改名会创建一个**新的** Worker，而自定义域名绑定挂在旧 Worker 上，结果是新 Worker 部署成功
但没有域名、旧 Worker 有域名但不再更新。收益只是名字好看，代价是打断部署链，不值。

`name` 只是 Worker 的内部标识，站点访问者看不到。

---

## 顺带查清的事：部署从来不是自动的

改造 push 到 master 后 5 分钟线上无变化，查 CF 才发现：

- Worker `feihua` 的历次部署 `source` **全部是 `wrangler`**，没有一次由 Git 触发
- Workers Builds（Git 连接）**没有接**

此前 README 与 `wrangler.jsonc` / `build.sh` 注释都写着「push 自动部署」，是不成立的说法。
反证在仓库历史里：`522cbe2`「触发 Cloudflare 重新构建部署(235/236 数据未上线)」提交于
09:27 UTC，而 CF 上那次部署发生在 10:03 UTC 且 `source=wrangler` —— 当时就是等不到自动
构建、手动 deploy 才上线的，commit message 里的「数据未上线」正是这个问题。

已在 `f46b25a` 更正全部三处文档。**要改成真自动部署，需要在 CF 控制台把该 Worker 连上
GitHub 仓库**（OAuth 授权，只能人工操作）。在那之前，每次更新数据后都要手动：

```bash
bash build.sh && npx wrangler deploy
```

---

## 域名

- 新：`picks.zlxlabs.com`（Workers 自定义域名，绑到 Worker `feihua`）
- 旧：`feihua.lexgogo.site` —— 域名已过期，NS 被注册商收回指向停放商
  （`ns1/ns2.lander.d.parity.domains`），流量不再经过 Cloudflare。老链接已死，不做 301 过渡。

前缀选 `picks` 而非 `podcast`：这个站是「从别人的播客里挑出来的推荐」，
`podcast.` 会被读成「我自己的播客」。

---

## 接入第二档播客

结构上零前端改动，步骤见 README「接入第二档播客」。这条不是声称 ——
`tests/test_build.py` 用两份假 config + 假数据跑真实构建，锁死了四条不变式：
各壳只注入自己的 key、assets 不按播客重复、缺数据的 config 跳过而不失败、保留字构建失败。
验收时对 `build.mjs` 做过三处变异，测试均精确变红。
