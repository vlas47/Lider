"""Publish only the Motion static demo using the owner's existing SSH helper.

No credentials are accepted on the command line or written to the result file.
Previous static releases and backups are retained.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import posixpath
import stat
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


BASE = "/srv/liderscan-demos/motion"
CURRENT = f"{BASE}/current"
CONFIG = "/etc/nginx/sites-available/cloud-site"
SNIPPET = "/etc/nginx/snippets/liderscan-demo-motion.conf"
INCLUDE = b"    include /etc/nginx/snippets/liderscan-demo-motion.conf;"
ANCHOR = b"    include /etc/nginx/snippets/liderscan-demo-inzhenerik.conf;"
URL = "https://liderscan.ru/demo/motion/"


def read_file(sftp, path):
    with sftp.open(path, "rb") as stream:
        return stream.read()


def write_file(sftp, path, data, mode=0o644):
    with sftp.open(path, "wb") as stream:
        stream.write(data)
    sftp.chmod(path, mode)


def mkdir(sftp, path):
    try:
        info = sftp.stat(path)
        if not stat.S_ISDIR(info.st_mode):
            raise RuntimeError(f"Not a directory: {path}")
    except FileNotFoundError:
        parent = posixpath.dirname(path)
        if parent != path:
            mkdir(sftp, parent)
        sftp.mkdir(path, 0o755)


def run(client, command):
    _, stdout, stderr = client.exec_command(command, timeout=60)
    code = stdout.channel.recv_exit_status()
    text = stdout.read().decode("utf-8", "replace") + stderr.read().decode("utf-8", "replace")
    if code:
        raise RuntimeError(f"Command failed ({code}): {command}\n{text}")
    return text.strip()


def publish(source: Path, helper: Path, result_path: Path):
    source = source.resolve(strict=True)
    files = sorted(p for p in source.rglob("*") if p.is_file())
    if not (source / "index.html").is_file() or not files:
        raise RuntimeError("Static source is incomplete")
    if any(p.name.startswith(".") or p.suffix in {".py", ".env"} for p in files):
        raise RuntimeError("Unexpected non-public file in static source")
    digest = hashlib.sha256()
    for path in files:
        digest.update(path.relative_to(source).as_posix().encode())
        digest.update(path.read_bytes())
    checksum = digest.hexdigest()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    release_name = f"{stamp}-{checksum[:10]}"
    release = f"{BASE}/releases/{release_name}"
    backup = f"{BASE}/backups/{release_name}"
    spec = importlib.util.spec_from_file_location("owner_ssh_helper", helper.resolve(strict=True))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    snippet_data = (Path(__file__).parent / "nginx-motion-demo.conf").read_bytes()
    result = {"url": URL, "release": release, "backup": backup, "source_sha256": checksum}

    with module.connect() as client, client.open_sftp() as sftp:
        config_before = read_file(sftp, CONFIG)
        if INCLUDE not in config_before and config_before.count(ANCHOR) != 1:
            raise RuntimeError("Could not uniquely locate the demo include in the existing HTTPS server")
        try:
            current_stat = sftp.lstat(CURRENT)
            if not stat.S_ISLNK(current_stat.st_mode):
                raise RuntimeError("Existing demo current is not a symlink")
            previous_target = sftp.readlink(CURRENT)
        except FileNotFoundError:
            previous_target = None
        try:
            snippet_before = read_file(sftp, SNIPPET)
        except FileNotFoundError:
            snippet_before = None
        result["previous_target"] = previous_target
        result["previous_corporate_commit"] = run(client, "git -C /srv/cloud_site rev-parse HEAD")
        mkdir(sftp, backup)
        write_file(sftp, f"{backup}/cloud-site.nginx.conf", config_before, 0o600)
        if snippet_before is not None:
            write_file(sftp, f"{backup}/motion.nginx.conf", snippet_before, 0o600)
        # Only the existing public code touched by the portfolio deployment.
        for relative in ["frontend/src/main.jsx", "pages/views.py", "templates/pages/home.html", "static/react/home/main-add-nozbart-20260711.js"]:
            path = f"/srv/cloud_site/{relative}"
            try:
                write_file(sftp, f"{backup}/{relative.replace('/', '__')}", read_file(sftp, path), 0o600)
            except FileNotFoundError:
                pass
        mkdir(sftp, release)
        for path in files:
            remote = f"{release}/{path.relative_to(source).as_posix()}"
            mkdir(sftp, posixpath.dirname(remote))
            sftp.put(str(path), remote)
            sftp.chmod(remote, 0o644)
            if hashlib.sha256(read_file(sftp, remote)).digest() != hashlib.sha256(path.read_bytes()).digest():
                raise RuntimeError(f"Upload checksum mismatch: {path.name}")
        config_after = config_before if INCLUDE in config_before else config_before.replace(ANCHOR, ANCHOR + b"\n" + INCLUDE, 1)
        activated = False
        try:
            write_file(sftp, SNIPPET, snippet_data)
            write_file(sftp, CONFIG, config_after)
            result["nginx_test"] = run(client, "nginx -t")
            temporary = f"{BASE}/.current-{release_name}"
            sftp.symlink(release, temporary)
            sftp.posix_rename(temporary, CURRENT)
            activated = True
            run(client, "systemctl reload nginx")
        except Exception:
            write_file(sftp, CONFIG, config_before)
            if snippet_before is not None:
                write_file(sftp, SNIPPET, snippet_before)
            elif read_file(sftp, SNIPPET) == snippet_data:
                sftp.remove(SNIPPET)
            if activated:
                if previous_target:
                    rollback = f"{BASE}/.rollback-{release_name}"
                    sftp.symlink(previous_target, rollback)
                    sftp.posix_rename(rollback, CURRENT)
                elif sftp.readlink(CURRENT) == release:
                    sftp.remove(CURRENT)
            run(client, "nginx -t")
            run(client, "systemctl reload nginx")
            raise
    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    with urlopen(Request(URL, headers={"User-Agent": "Mozilla/5.0"}), timeout=20) as response:
        body = response.read().decode("utf-8")
        if response.status != 200 or "Форма впечатления" not in body:
            raise RuntimeError("Public HTML verification failed")
        result["public_status"] = response.status
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ssh-helper", required=True, type=Path)
    parser.add_argument("--source", default=Path(__file__).resolve().parents[1] / "demos/motion", type=Path)
    parser.add_argument("--result", required=True, type=Path)
    args = parser.parse_args()
    publish(args.source, args.ssh_helper, args.result)
