#!/usr/bin/env node
/**
 * 组装干净发布目录 dist/：
 *   /                    播客索引首页
 *   /<key>/              该播客可视化薄壳
 *   /assets/             共享 JS/CSS/底图/vendor（只复制一次）
 *   /data/<key>/         该播客 JSON
 *   /about/<key>.html    关于页片段（有则复制）
 *
 * 只用 Node 标准库。根目录即本脚本所在目录（build.sh 会先 cd）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const RESERVED = new Set(["assets", "data", "about"]);

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

const configDir = path.join(ROOT, "config");
if (!fs.existsSync(configDir)) die("missing config/");

const configs = [];
for (const name of fs.readdirSync(configDir).filter((n) => n.endsWith(".json")).sort()) {
  const key = name.slice(0, -".json".length);
  if (RESERVED.has(key)) die(`reserved podcast key: ${key}`);
  const cfgPath = path.join(configDir, name);
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  } catch (e) {
    die(`invalid json: ${cfgPath}: ${e.message}`);
  }
  if (cfg.key != null && cfg.key !== key) {
    die(`config key mismatch: file=${key} json.key=${cfg.key}`);
  }
  configs.push({ key, cfg });
}

const ready = [];
for (const { key, cfg } of configs) {
  const rec = path.join(ROOT, "data", key, "recommendations_all.json");
  const geo = path.join(ROOT, "data", key, "geo.json");
  if (!fs.existsSync(rec) || !fs.existsSync(geo)) {
    console.log(`skip ${key}: missing data/${key}/recommendations_all.json or geo.json`);
    continue;
  }
  ready.push({ key, cfg, rec, geo });
}

if (ready.length === 0) die("no podcasts with data; refusing to publish an empty site");

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, "assets"), { recursive: true });

copyFile(path.join(ROOT, "web", "app.js"), path.join(DIST, "assets", "app.js"));
copyFile(path.join(ROOT, "web", "styles.css"), path.join(DIST, "assets", "styles.css"));
copyFile(path.join(ROOT, "web", "china.geojson"), path.join(DIST, "assets", "china.geojson"));
fs.cpSync(path.join(ROOT, "web", "vendor"), path.join(DIST, "assets", "vendor"), { recursive: true });

const shellTpl = fs.readFileSync(path.join(ROOT, "web", "shell.html"), "utf8");
const homeTpl = fs.readFileSync(path.join(ROOT, "web", "home.html"), "utf8");

const cards = [];
for (const p of ready) {
  const data = JSON.parse(fs.readFileSync(p.rec, "utf8"));
  const name = (data.podcast && data.podcast.name) || p.key;
  const stats = data.stats || {};
  const items = stats.total_items ?? (Array.isArray(data.items) ? data.items.length : 0);
  const episodes = stats.episodes_with_data ?? 0;
  const tagline = (p.cfg.web && p.cfg.web.tagline) || "";

  const html = shellTpl.replaceAll("{{KEY}}", p.key).replaceAll("{{NAME}}", name);
  fs.mkdirSync(path.join(DIST, p.key), { recursive: true });
  fs.writeFileSync(path.join(DIST, p.key, "index.html"), html, "utf8");

  copyFile(p.rec, path.join(DIST, "data", p.key, "recommendations_all.json"));
  copyFile(p.geo, path.join(DIST, "data", p.key, "geo.json"));

  const aboutSrc = path.join(ROOT, "web", "about", `${p.key}.html`);
  if (fs.existsSync(aboutSrc)) {
    copyFile(aboutSrc, path.join(DIST, "about", `${p.key}.html`));
  }

  const taglineHtml = tagline
    ? `\n    <p class="tagline">${escapeHtml(tagline)}</p>`
    : "";
  cards.push(
    `<a class="podcast-card" href="/${encodeURI(p.key)}/">\n` +
      `    <h2>${escapeHtml(name)}</h2>${taglineHtml}\n` +
      `    <p class="meta">${episodes} 集 · ${items} 条推荐</p>\n` +
      `  </a>`
  );
  console.log(`built ${p.key}: ${items} items, ${episodes} episodes`);
}

fs.writeFileSync(path.join(DIST, "index.html"), homeTpl.replaceAll("{{CARDS}}", cards.join("\n  ")), "utf8");

function countFiles(dir) {
  let n = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) n += countFiles(p);
    else n += 1;
  }
  return n;
}

const nfiles = countFiles(DIST);
console.log(`podcasts: ${ready.map((p) => p.key).join(", ")}`);
console.log(`built dist: ${nfiles} files`);
