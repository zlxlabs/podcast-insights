# -*- coding: utf-8 -*-
"""多播客静态站构建：同一域名按 /<key>/ 切换，共享 assets。

在 tmp_path 造最小仓库副本（copy web/ + build.mjs + 假 config/data），跑 node build.mjs。
node 不可用时 skip，避免缺运行时假红。
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

NODE = shutil.which("node")
if not NODE:
    pytest.skip("node 不可用，跳过构建测试", allow_module_level=True)

REPO = Path(__file__).resolve().parents[1]


def _payload(key: str, name: str) -> dict:
    return {
        "podcast": {"key": key, "name": name},
        "stats": {"episodes_with_data": 2, "total_items": 3},
        "episodes": [{"vol": 1, "title": "ep1"}],
        "items": [{"id": "1-place-0", "name": "店A", "category": "place"}],
    }


def _write_podcast(root: Path, key: str, name: str, *, with_data: bool = True) -> None:
    (root / "config").mkdir(parents=True, exist_ok=True)
    (root / "config" / f"{key}.json").write_text(
        json.dumps({"key": key, "name": name, "hosts": []}, ensure_ascii=False),
        encoding="utf-8",
    )
    if with_data:
        ddir = root / "data" / key
        ddir.mkdir(parents=True, exist_ok=True)
        (ddir / "recommendations_all.json").write_text(
            json.dumps(_payload(key, name), ensure_ascii=False),
            encoding="utf-8",
        )
        (ddir / "geo.json").write_text("{}", encoding="utf-8")


def _prep(tmp: Path, with_data, config_only=()) -> Path:
    shutil.copytree(REPO / "web", tmp / "web")
    shutil.copy2(REPO / "build.mjs", tmp / "build.mjs")
    for key, name in with_data:
        _write_podcast(tmp, key, name, with_data=True)
    for key, name in config_only:
        _write_podcast(tmp, key, name, with_data=False)
    return tmp


def _build(cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [NODE, str(cwd / "build.mjs")],
        cwd=cwd,
        capture_output=True,
        text=True,
    )


@pytest.fixture
def two_podcasts(tmp_path: Path) -> Path:
    _prep(
        tmp_path,
        with_data=[("alpha", "Alpha 播客"), ("beta", "Beta 播客")],
        config_only=[("gamma", "Gamma 播客")],
    )
    result = _build(tmp_path)
    assert result.returncode == 0, result.stderr + result.stdout
    return tmp_path


def test_shells_exist_for_each_podcast(two_podcasts: Path):
    dist = two_podcasts / "dist"
    assert (dist / "alpha" / "index.html").is_file()
    assert (dist / "beta" / "index.html").is_file()


def test_each_shell_injects_only_its_own_key(two_podcasts: Path):
    dist = two_podcasts / "dist"
    alpha = (dist / "alpha" / "index.html").read_text(encoding="utf-8")
    beta = (dist / "beta" / "index.html").read_text(encoding="utf-8")
    assert 'window.__PODCAST__ = { key: "alpha" }' in alpha
    assert '"beta"' not in alpha
    assert 'window.__PODCAST__ = { key: "beta" }' in beta
    assert '"alpha"' not in beta


def test_home_lists_both_podcasts_with_links(two_podcasts: Path):
    home = (two_podcasts / "dist" / "index.html").read_text(encoding="utf-8")
    assert "Alpha 播客" in home
    assert "Beta 播客" in home
    assert 'href="/alpha/"' in home
    assert 'href="/beta/"' in home


def test_assets_shared_not_copied_per_podcast(two_podcasts: Path):
    dist = two_podcasts / "dist"
    assert (dist / "assets" / "app.js").is_file()
    assert not (dist / "alpha" / "app.js").exists()
    assert not (dist / "beta" / "app.js").exists()
    assert list((dist / "alpha").rglob("app.js")) == []
    assert list((dist / "beta").rglob("app.js")) == []


def test_data_copied_per_podcast(two_podcasts: Path):
    dist = two_podcasts / "dist"
    assert (dist / "data" / "alpha" / "recommendations_all.json").is_file()
    assert (dist / "data" / "beta" / "recommendations_all.json").is_file()


def test_config_without_data_is_skipped(two_podcasts: Path):
    dist = two_podcasts / "dist"
    assert not (dist / "gamma").exists()


def test_reserved_key_fails(tmp_path: Path):
    _prep(tmp_path, with_data=[("data", "Reserved")])
    result = _build(tmp_path)
    assert result.returncode != 0
    assert "reserved" in (result.stderr + result.stdout).lower()
