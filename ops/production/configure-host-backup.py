#!/usr/bin/env python3
"""Discover managed persistent app data; write a reviewable backup inventory."""

import argparse
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import time


def env_values(path):
    values = {}
    if not path.is_file():
        return values
    for line in path.read_text().splitlines():
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        key, value = line.split("=", 1)
        try:
            values[key.strip()] = shlex.split(value)[0] if shlex.split(value) else ""
        except ValueError:
            pass
    return values


def discover(web_root):
    projects = {}
    def project(name):
        return projects.setdefault(name, {"sqlite": set(), "postgres": set(), "files": set()})
    for site in sorted(web_root.iterdir()):
        owner = site / ".ts-cloud/owner"
        if site.is_symlink() or not owner.is_file() or not (site / "current").is_symlink():
            continue
        name = owner.read_text().strip()
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", name):
            continue
        specification = project(name)
        shared = site / "shared"
        values = env_values(shared / ".env")
        for config in (shared / ".env", shared / ".env.keys"):
            if config.is_file():
                specification["files"].add(str(config.resolve()))
        # Capture durable uploads and generated site assets; live SQLite files
        # below storage get their own online snapshot instead of raw file copies.
        for directory in (shared / "public", shared / "stx-images", shared / "uploads", shared / "storage"):
            if directory.is_dir():
                specification["files"].add(str(directory.resolve()))
                for entry in directory.rglob("*"):
                    if not entry.is_file():
                        continue
                    if entry.suffix in (".sqlite", ".db", ".sqlite3"):
                        specification["sqlite"].add(str(entry.resolve()))
        if values.get("DB_CONNECTION", "sqlite") == "sqlite":
            configured = values.get("DB_DATABASE_PATH", values.get("DB_DATABASE", ""))
            candidates = [web_root / f"{name}-shared/database", Path("/var/lib") / name]
            if configured and not configured.startswith("encrypted:"):
                candidate = Path(configured)
                if candidate.is_absolute():
                    candidates.append(candidate)
                else:
                    candidates += [site / "current" / candidate, shared / candidate]
            for candidate in candidates:
                if candidate.is_file() and candidate.suffix in (".sqlite", ".db", ".sqlite3"):
                    specification["sqlite"].add(str(candidate.resolve()))
                elif candidate.is_dir():
                    for database in candidate.iterdir():
                        if database.is_file() and database.suffix in (".sqlite", ".db", ".sqlite3"):
                            specification["sqlite"].add(str(database.resolve()))
        snapshots = web_root / f"{name}-shared/database/snapshots"
        if snapshots.is_dir():
            specification["files"].add(str(snapshots))
    return projects


def postgres_inventory():
    # Back up every local PostgreSQL database, independently of app deployments.
    result = subprocess.run(["runuser", "-u", "postgres", "--", "/usr/local/bin/psql", "-Atc",
                             """select json_build_object('name', d.datname, 'disposable',
                               coalesce(shobj_description(d.oid, 'pg_database') = 'stacks:disposable-verification'
                               and r.rolvaliduntil <= now() + interval '24 hours', false))
                             from pg_database d join pg_roles r on r.oid = d.datdba
                             where not d.datistemplate and d.datname <> 'postgres'"""],
                            capture_output=True, text=True, check=True)
    return [json.loads(line) for line in result.stdout.splitlines() if line.strip()]


def retire_missing_database(config, name, live_names):
    if name in live_names:
        raise ValueError('A live database cannot be retired from backup selection')
    specification = config['projects'].get(name)
    if not specification or specification.get('postgres') != [name] or any(specification.get(key) for key in ('sqlite', 'files', 'mysql')):
        raise ValueError('Only a missing database-only selection can be retired')
    config.setdefault('retired_databases', []).append({'name': name, 'specification': specification, 'retired_at': int(time.time())})
    del config['projects'][name]


def write_inventory(config, destination):
    temporary = destination.with_suffix(".tmp")
    with temporary.open("w") as output:
        temporary.chmod(0o600)
        output.write(json.dumps(config, indent=2) + "\n")
        output.flush()
        os.fsync(output.fileno())
    temporary.replace(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--retire-missing-database')
    parser.add_argument('--apply', action='store_true')
    options = parser.parse_args()
    base = Path("/var/lib/mail-storage/data/restic")
    destination = base / "host-backup.json"
    if options.retire_missing_database:
        config = json.loads(destination.read_text())
        retire_missing_database(config, options.retire_missing_database, {row['name'] for row in postgres_inventory()})
        if not options.apply:
            print('Reviewed retirement only; pass --apply to update selection. Backups remain intact.')
            return
        archive = Path('/var/lib/stacks-deployments/recovery/backup-inventories')
        archive.mkdir(parents=True, exist_ok=True, mode=0o700)
        shutil.copy2(destination, archive / f'inventory-before-retirement-{time.time_ns()}.json')
        write_inventory(config, destination)
        print('Retired missing database selection; prior inventory and every backup preserved')
        return
    projects = discover(Path("/var/www"))
    databases = postgres_inventory()
    for row in databases:
        if row['disposable']:
            continue
        name = row['name']
        projects.setdefault(name, {"sqlite": set(), "postgres": set(), "files": set()})["postgres"].add(name)
    projects["host-config"] = {"sqlite": set(), "postgres": set(), "files": {
        "/etc/mail", "/etc/systemd/system", str(base / "app-backup-receipts")}}
    config = {"repositories": {"aws": str(base / "restic.env"), "hetzner": str(base / "hetzner.env")},
              "created_at": int(time.time()), "staging": "/var/lib/stacks-deployments/host-backup-staging", "projects": {
                  name: {key: sorted(values) for key, values in specification.items()}
                  for name, specification in projects.items() if any(specification.values())}}
    # Vitess currently uses one local MySQL shard. Back up its physical logical
    # database directly over its private socket, avoiding unsupported vtgate
    # mysqldump metadata queries. The topology scripts are part of recovery.
    mysql_root = Path("/opt/pantry/pantry/mysql.com/v8.0.43/bin")
    shards = list(Path("/var/lib/vitess").glob("vt_*/mysql.sock"))
    for socket in shards:
        config["projects"].setdefault("predicthq", {"sqlite": [], "postgres": [], "files": []}).setdefault("mysql", []).append({
            "binary": str(mysql_root / "mysqldump"), "socket": str(socket), "database": "vt_predicthq", "user": "root"})
    if shards:
        config["projects"]["predicthq"]["files"].append("/usr/local/lib/vitess")
    # The external SingleStore app still has a deployed plaintext environment.
    # Store the protected env path, never a DB password in the inventory/argv.
    ghost_env = Path("/var/www/ghostanalytics-main/shared/.env")
    ghost = env_values(ghost_env)
    running = subprocess.run(["systemctl", "list-units", "--type=service", "--state=running", "--no-legend", "--plain"],
                             capture_output=True, text=True, check=True).stdout
    ghost_active = any(line.split()[0].startswith("ghostanalytics-") for line in running.splitlines() if line.split())
    if ghost_active and ghost.get("DB_CONNECTION") == "singlestore" and not ghost.get("DB_HOST", "").startswith("encrypted:"):
        config["projects"].setdefault("ghostanalytics", {"sqlite": [], "postgres": [], "files": []})["mysql"] = [{
            "binary": str(mysql_root / "mysqldump"), "env_file": str(ghost_env), "database": ghost["DB_DATABASE"]}]
    elif ghost.get("DB_CONNECTION") == "singlestore":
        config["legacy_external_databases"] = [{"project": "ghostanalytics", "env_file": str(ghost_env),
            "reason": "No running GhostAnalytics services; legacy configuration is preserved, external database is not asserted recoverable."}]
    destination = base / "host-backup.json"
    if destination.exists():
        # Keep explicit operator additions. Discovery only adds new data paths.
        old = json.loads(destination.read_text())
        config["created_at"] = old.get("created_at", config["created_at"])
        for name, specification in old["projects"].items():
            project = config["projects"].setdefault(name, {"sqlite": [], "postgres": [], "files": []})
            for key in project:
                if key == "mysql":
                    continue
                project[key] = sorted(set(project[key]) | set(specification.get(key, [])))
    if destination.exists():
        config['retired_databases'] = old.get('retired_databases', [])
    write_inventory(config, destination)
    print(f"Configured {len(config['projects'])} app groups")
    for name, specification in config["projects"].items():
        print(name, len(specification["sqlite"]), "SQLite", len(specification["postgres"]), "PostgreSQL", len(specification["files"]), "persistent paths")


if __name__ == "__main__":
    main()
