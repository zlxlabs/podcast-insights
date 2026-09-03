# 项目记忆

这是本仓专属的项目事实，不是跨仓通用规则。2026-09-03 从 Claude Code 自动记忆迁出（归档快照），写给以后在本仓工作的会话读。本仓条目少，不建独立 `memory/` 目录。

## Feihua 站部署

这条事实最近一次现场记录是 2026-07-02（归档 YAML 无 `modified` 字段，以正文最晚实测日为准；快照于 2026-09-03 迁出，此后未再核实，可能已过期）。

feihua.lexgogo.site 是 **Cloudflare Workers Static Assets** 站(不是 Pages):`wrangler.jsonc` name=`feihua`、assets=`./dist`、无 main。正常靠 **Workers Builds(连 GitHub master 分支)自动部署**:push master → 跑 `bash build.sh`(产 9 文件 dist) → `npx wrangler deploy`。account id `9acf20be95370198675830095b7fc4e0`。

**手动部署的坑**:用户 2026-06 给的临时 token（`<CF_API_TOKEN>`，Pages Read/Write + DNS 权限）**没有 Workers Scripts:Edit**,`wrangler deploy` 会报 Authentication error 10000(打到 /workers/services/feihua)。要手动部署 Worker,需要带 Workers Scripts:Edit 的 token。Pages 权限对这个 Worker 站无用。

**2026-06-17 遇到的事**:push 后自动部署 ~49min 未触发(deployed app.js/数据全是旧版)。**解法:再 push 一个空 commit(`git commit --allow-empty`)重新触发 webhook,立刻就构建并部署成功了。** 所以遇到自动部署卡住,先试空 commit 重推这一招,比等更有效。(手动 wrangler deploy 因 token 无 Workers 权限不可用。)

**2026-07-02 build token 失效**:push 数据 commit(235/236)后线上仍旧版(234/935),空提交 `522cbe2` 重推 + 等 15min 仍未部署——空提交这招失灵。查 Workers Builds 日志发现**根因**:构建有触发(环境初始化成功),但报 `Failed: The build token selected for this build has been deleted or rolled and cannot be used for this build. Please update your build token in the Worker Builds settings and retry the build.` 即 **Workers Builds 用的 build token 被删/轮换失效**。本地 `build.sh` 产的 dist 是对的(236/939),问题纯在 CF 侧。**修法(需面板)**:Cloudflare Dashboard → Workers & Pages → `feihua` → Settings → Builds → 更新/重建 build token → Retry build。**关键教训:自动部署卡住先去 Workers Builds 看构建日志的具体报错,别再盲目空提交重推(build token 失效时空提交无用)。** CLI 侧 wrangler 未装、env/.env 无 CF token,手动 deploy 需带 Workers Scripts:Edit 的 token。account id `9acf20be95370198675830095b7fc4e0`。

验证线上是否更新:`fetch https://feihua.lexgogo.site/web/app.js` 看是否含新标记(如 `tasteTimeline`),或 `/data/feihua/recommendations_all.json` 看 `episodes` 数组是否非空。
