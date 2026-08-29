#!/usr/bin/env bash
# Cloudflare Workers Builds：组装干净发布目录 dist/
#   /                    播客索引首页
#   /<key>/              该播客可视化站
#   /assets/             共享 JS/CSS/底图/vendor
#   /data/<key>/         该播客 JSON
#   /about/<key>.html    关于页片段
# 不发布 pipeline 代码、转录稿、view_urls token 文件。
#
# CF Workers Builds 设置（无需因本卡改控制台）：
#   Build command            = bash build.sh
#   Deploy command           = npx wrangler deploy
#   Production branch        = master
#
# 本地预览： bash build.sh && cd dist && python3 -m http.server 8099
# 本地手动部署也可复用： bash build.sh && wrangler deploy
set -euo pipefail
cd "$(dirname "$0")"
exec node build.mjs
