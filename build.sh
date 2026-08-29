#!/usr/bin/env bash
# 组装干净发布目录 dist/
#   /                    播客索引首页
#   /<key>/              该播客可视化站
#   /assets/             共享 JS/CSS/底图/vendor
#   /data/<key>/         该播客 JSON
#   /about/<key>.html    关于页片段
# 不发布 pipeline 代码、转录稿、view_urls token 文件。
#
# 部署（手动，push 不会自动部署，详见 wrangler.jsonc 注释）：
#   bash build.sh && npx wrangler deploy       # 需要 CLOUDFLARE_API_TOKEN
#
# 本地预览：
#   bash build.sh && cd dist && python3 -m http.server 8099
#   ⚠ 本地 http.server 与线上 Workers 有一处行为差异：线上对 /about/<key>.html
#     会 307 重定向到无后缀路径（html_handling 默认行为），本地不会。前端 fetch
#     默认跟随重定向，两边都正常，但"本地通过"不等于"线上通过"，改动 about 加载
#     逻辑后要在线上复验。
set -euo pipefail
cd "$(dirname "$0")"
exec node build.mjs
