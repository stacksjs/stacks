#!/usr/bin/env python3
"""Daily consistent app backups, independently restored from AWS and Hetzner."""

import argparse
import contextlib
import fcntl
import json
import os
from pathlib import Path
import pwd
import resource
import shutil
import sqlite3
import subprocess
import tempfile
import time

from app_backup_retention import ResticArchive, digest, STAGING_MARKER
from importlib.machinery import SourceFileLoader

inventory = SourceFileLoader("backup_inventory", str(Path(__file__).with_name("configure-host-backup.py"))).load_module()

CONFIG = Path("/var/lib/mail-storage/data/restic/host-backup.json")
STATE = CONFIG.with_name("host-backup-status.json")


def save(path, data):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    with temporary.open("w") as output:
        os.chmod(temporary, 0o600)
        json.dump(data, output)
        output.flush()
        os.fsync(output.fileno())
    temporary.replace(path)


def all_projects_recovered(config, state, now):
    for project in config["projects"]:
        status = state.get("projects", {}).get(project, {})
        if status.get("error"):
            return False
        for name in config["repositories"]:
            recovered = status.get(name, {})
            if not recovered.get("restore_verified") or not 0 <= now - recovered.get("timestamp", 0) <= 36 * 3600:
                return False
    return True


def sqlite_snapshot(source, target):
    # Read-only URI refuses to create a missing database. SQLite's online backup
    # API includes committed WAL contents without copying a live database file.
    partial = target.with_suffix(target.suffix + ".partial")
    try:
        with contextlib.closing(sqlite3.connect(source.resolve().as_uri() + "?mode=ro", uri=True, timeout=30)) as live:
            with contextlib.closing(sqlite3.connect(partial)) as snapshot:
                def progress(status, remaining, total):
                    if time.monotonic() > deadline:
                        raise RuntimeError("SQLite online backup timed out")
                deadline = time.monotonic() + 600
                live.backup(snapshot, pages=256, progress=progress, sleep=0.1)
        validate_sqlite(partial)
        partial.replace(target)
    finally:
        for suffix in ("", "-wal", "-shm", "-journal"):
            Path(str(partial) + suffix).unlink(missing_ok=True)


def validate_sqlite(path):
    with contextlib.closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as db:
        if db.execute("PRAGMA quick_check").fetchall() != [("ok",)]:
            raise RuntimeError("SQLite recovery integrity check failed")
        # Exercise the schema in the recovered DB, not just the archive checksum.
        db.execute("SELECT count(*) FROM sqlite_schema").fetchone()


def command(args, output=None):
    limit = None
    if output:
        stats = os.fstatvfs(output.fileno())
        limit = stats.f_bavail * stats.f_frsize - 2 * 1024 ** 3
        if limit <= 0:
            raise RuntimeError("insufficient free space; dump not started")
    def bound_output():
        # Only the dump child gets this limit. Leave root disk headroom even if
        # a compressed remote DB expands far beyond its reported on-disk size.
        _, hard = resource.getrlimit(resource.RLIMIT_FSIZE)
        resource.setrlimit(resource.RLIMIT_FSIZE, (limit if hard == resource.RLIM_INFINITY else min(limit, hard), hard))
    use_preexec = bool(output)
    if output and args[0] == "runuser":
        # runuser resets FSIZE during login. Apply the bound after switching
        # users, immediately before exec of the actual dump/role-export tool.
        position = args.index("--") + 1
        args = [*args[:position], "prlimit", f"--fsize={limit}:{limit}", *args[position:]]
        use_preexec = False
    result = subprocess.run(args, stdout=output or subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=1200, preexec_fn=bound_output if use_preexec else None)
    if result.returncode:
        raise RuntimeError(f"{Path(args[0]).name} failed (exit {result.returncode})")
    return result.stdout


def atomic_dump(target, args, validate=None):
    partial = target.with_suffix(target.suffix + ".partial")
    try:
        with partial.open("wb") as output:
            command(args, output)
        if not partial.stat().st_size:
            raise RuntimeError("empty database dump")
        if validate:
            validate(partial)
        partial.replace(target)
    finally:
        # A failed new dump is disposable. Preserve any previous complete dump
        # that could not yet be uploaded, without filling the disk with partials.
        partial.unlink(missing_ok=True)


def project_backup(project, specification, archives, state_dir):
    root = state_dir / project
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    databases = root / "databases"
    databases.mkdir(mode=0o700, exist_ok=True)
    sources = []
    mapping = {}
    if project == "host-config":
        target = root / "postgres-roles.sql"
        with target.open("wb") as output:
            # This host bundles pg_dump but not pg_dumpall. Export the roles
            # required by app recovery, including hashed passwords, encrypted
            # inside Restic. Operators review role creation before a live restore.
            query = """SELECT 'CREATE ROLE ' || quote_ident(rolname) || ' WITH ' ||
              CASE WHEN rolcanlogin THEN 'LOGIN ' ELSE 'NOLOGIN ' END ||
              CASE WHEN rolsuper THEN 'SUPERUSER ' ELSE 'NOSUPERUSER ' END ||
              CASE WHEN rolcreatedb THEN 'CREATEDB ' ELSE 'NOCREATEDB ' END ||
              CASE WHEN rolcreaterole THEN 'CREATEROLE ' ELSE 'NOCREATEROLE ' END ||
              CASE WHEN rolreplication THEN 'REPLICATION ' ELSE 'NOREPLICATION ' END ||
              CASE WHEN rolbypassrls THEN 'BYPASSRLS ' ELSE 'NOBYPASSRLS ' END ||
              CASE WHEN rolinherit THEN 'INHERIT ' ELSE 'NOINHERIT ' END ||
              'CONNECTION LIMIT ' || rolconnlimit ||
              CASE WHEN rolpassword IS NULL THEN '' ELSE ' PASSWORD ' || quote_literal(rolpassword) END || ';'
              FROM pg_authid WHERE rolname !~ '^pg_';
              SELECT 'GRANT ' || quote_ident(r.rolname) || ' TO ' || quote_ident(m.rolname) ||
              CASE WHEN a.admin_option THEN ' WITH ADMIN OPTION' ELSE '' END || ';'
              FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member;"""
            command(["runuser", "-u", "postgres", "--", "/usr/local/bin/psql", "-Atc", query], output)
        sources.append(target)
    for index, source_name in enumerate(specification.get("sqlite", [])):
        source = Path(source_name)
        if not source.is_file():
            raise RuntimeError(f"configured database missing: {source}")
        target = databases / f"{index}-{source.name}"
        if shutil.disk_usage(root).free < source.stat().st_size * 2 + 1024 ** 3:
            raise RuntimeError("insufficient space for snapshot and disposable recovery")
        sqlite_snapshot(source, target)
        sources.append(target)
        mapping[str(target)] = {"source": str(source), "engine": "sqlite", "sha256": digest(target)}
    for database in specification.get("postgres", []):
        if not database.replace("_", "").isalnum():
            raise RuntimeError("invalid configured PostgreSQL database name")
        target = databases / f"{database}.dump"
        size = int(command(["runuser", "-u", "postgres", "--", "/usr/local/bin/psql", "-Atc",
                            f"SELECT pg_database_size('{database}')"]).strip())
        if shutil.disk_usage(root).free < size * 2 + 2 * 1024 ** 3:
            raise RuntimeError("insufficient PostgreSQL snapshot/recovery space")
        atomic_dump(target, ["runuser", "-u", "postgres", "--", "/usr/local/bin/pg_dump",
                             "--format=custom", "--no-owner", "--dbname", database],
                    lambda path: command(["/usr/local/bin/pg_restore", "--list", str(path)]))
        sources.append(target)
        mapping[str(target)] = {"source": database, "engine": "postgres", "sha256": digest(target)}
    for index, database in enumerate(specification.get("mysql", [])):
        target = databases / f"mysql-{index}-{database['database']}.sql"
        options = [database["binary"], "--single-transaction", "--quick", "--skip-lock-tables", "--no-tablespaces",
                   "--set-gtid-purged=OFF", "--hex-blob", "--column-statistics=0"]
        # A private option file avoids passwords in argv or child output.
        with tempfile.TemporaryDirectory(prefix="mysql-options-", dir=root) as scratch:
            client = Path(scratch) / "client.cnf"
            values = inventory.env_values(Path(database["env_file"])) if database.get("env_file") else {}
            fields = {"user": database.get("user", values.get("DB_USERNAME", "root"))}
            if database.get("socket"):
                fields["socket"] = database["socket"]
                options += ["--routines", "--events", "--triggers"]
            else:
                fields.update(host=values["DB_HOST"], port=values.get("DB_PORT", "3306"), password=values.get("DB_PASSWORD", ""), **{"ssl-mode": "REQUIRED"})
            client.write_text("[client]\n" + "\n".join(f"{key}={json.dumps(value, ensure_ascii=False)}" for key, value in fields.items()) + "\n")
            client.chmod(0o600)
            if not database["database"].replace("_", "").isalnum():
                raise RuntimeError("invalid configured MySQL database name")
            size = command([str(Path(options[0]).with_name("mysql")), f"--defaults-extra-file={client}", "--batch", "--skip-column-names",
                            "--execute", "SELECT COALESCE(SUM(data_length+index_length),0) FROM information_schema.tables "
                            f"WHERE table_schema='{database['database']}'"])
            if shutil.disk_usage(root).free < int(float(size.strip())) * 4 + 2 * 1024 ** 3:
                raise RuntimeError("insufficient MySQL snapshot/recovery space")
            atomic_dump(target, [options[0], f"--defaults-extra-file={client}", *options[1:], database["database"]])
        sources.append(target)
        mapping[str(target)] = {"source": database["database"], "engine": "mysql", "sha256": digest(target)}
    for source_name in specification.get("files", []):
        source = Path(source_name)
        if not source.exists():
            raise RuntimeError(f"configured persistent files missing: {source}")
        sources.append(source.resolve())
    manifest = root / "recovery.json"
    save(manifest, {"project": project, "created": int(time.time()), "databases": mapping,
                    "files": specification.get("files", [])})
    sources.append(manifest)
    exclusions = []
    # Never copy a live DB/WAL as a raw upload. Its verified online snapshot is
    # above in staging; new durable files in these directories are still covered.
    for source_name in specification.get("files", []):
        source = Path(source_name).resolve()
        if source.is_dir() and source.name != "snapshots":
            for pattern in ("**/*.sqlite", "**/*.db", "**/*.sqlite3", "**/*-wal", "**/*-shm", "**/*-journal",
                            "**/logs/**", "**/cache/**", "**/framework/**"):
                exclusions.extend(["--exclude", str(source / pattern)])
    results, errors = {}, []
    for name, archive in archives.items():
        try:
            # Stable tags and paths allow deduplication and correct retention.
            print(f"{project}: {name} uploading persistent files and consistent databases", flush=True)
            output = archive.run("backup", "--json", "--tag", "app-daily", "--tag", "production",
                                 "--tag", f"project:{project}", *exclusions, "--", *sources)
            snapshot = next(json.loads(line)["snapshot_id"] for line in output.splitlines()
                            if line.startswith("{") and json.loads(line).get("message_type") == "summary")
            for original, record in mapping.items():
                with tempfile.TemporaryDirectory(prefix="restore-", dir=root) as scratch:
                    restored = archive.restore(snapshot, Path(original), Path(scratch))
                    if digest(restored) != record["sha256"]:
                        raise RuntimeError("database recovery checksum mismatch")
                    if record["engine"] == "sqlite":
                        validate_sqlite(restored)
                    elif record["engine"] == "postgres":
                        command(["/usr/local/bin/pg_restore", "--list", str(restored)])
            # Also verify recovery of the manifest and original configuration.
            with tempfile.TemporaryDirectory(prefix="restore-", dir=root) as scratch:
                restored = archive.restore(snapshot, manifest, Path(scratch))
                if digest(restored) != digest(manifest):
                    raise RuntimeError("recovery manifest checksum mismatch")
            results[name] = {"timestamp": int(time.time()), "snapshot": snapshot,
                             "databases": len(mapping), "restore_verified": True}
            print(f"{project}: {name} uploaded and restored ({len(mapping)} databases)", flush=True)
        except Exception as error:
            errors.append(f"{name}: {error}")
    if errors:
        # Keep staging databases available until both repositories recover.
        return results, "; ".join(errors)
    for source in map(Path, mapping):
        if source.is_file() and not source.is_symlink():
            source.unlink()
    return results, None


def postgres_recovery(dump):
    """Load recovered SQL into a disposable cluster with no network listener."""
    user = pwd.getpwnam("postgres")
    with tempfile.TemporaryDirectory(prefix="host-backup-drill-", dir="/var/tmp") as scratch_name:
        scratch = Path(scratch_name)
        scratch.chmod(0o700)
        os.chown(scratch, user.pw_uid, user.pw_gid)
        restored = scratch / "database.dump"
        shutil.copyfile(dump, restored)
        restored.chmod(0o600)
        os.chown(restored, user.pw_uid, user.pw_gid)
        prefix = ["runuser", "-u", "postgres", "--"]
        data = scratch / "data"
        command([*prefix, "/usr/local/bin/initdb", "-D", str(data), "-U", "backupcheck", "--auth=trust", "--no-locale"])
        started = False
        try:
            command([*prefix, "/usr/local/bin/pg_ctl", "-D", str(data), "-l", str(scratch / "postgres.log"),
                     "-o", f"-F -c listen_addresses='' -c unix_socket_directories='{scratch}' -p 55432", "-w", "start"])
            started = True
            command([*prefix, "/usr/local/bin/pg_restore", "--no-owner", "--no-privileges", "--exit-on-error",
                     "--host", str(scratch), "--port", "55432", "--username", "backupcheck", "--dbname", "postgres", str(restored)])
            command([*prefix, "/usr/local/bin/psql", "--host", str(scratch), "--port", "55432", "--username", "backupcheck",
                     "--dbname", "postgres", "-v", "ON_ERROR_STOP=1", "-Atc", "SELECT count(*) FROM pg_class WHERE relkind='r'"])
        finally:
            if started:
                command([*prefix, "/usr/local/bin/pg_ctl", "-D", str(data), "-m", "immediate", "-w", "stop"])


def mysql_recovery(dump, database, binary):
    """Recover the local Vitess shard in disposable MySQL, without TCP."""
    mysql = Path(binary).with_name("mysql")
    server = Path(binary).with_name("mysqld")
    with tempfile.TemporaryDirectory(prefix="host-mysql-drill-", dir="/var/tmp") as scratch_name:
        scratch = Path(scratch_name)
        data, socket = scratch / "data", scratch / "mysql.sock"
        command([str(server), "--no-defaults", "--initialize-insecure", "--user=root", f"--datadir={data}"])
        with (scratch / "mysql.log").open("wb") as output:
            process = subprocess.Popen([str(server), "--no-defaults", "--user=root", f"--datadir={data}",
                                        f"--socket={socket}", f"--pid-file={scratch / 'mysql.pid'}", "--skip-networking",
                                        "--mysqlx=0", "--skip-log-bin", "--innodb-flush-log-at-trx-commit=2",
                                        "--innodb-buffer-pool-size=64M"], stdout=output, stderr=output)
            try:
                deadline = time.monotonic() + 60
                while not socket.exists():
                    if process.poll() is not None or time.monotonic() > deadline:
                        raise RuntimeError("disposable MySQL did not start")
                    time.sleep(0.1)
                args = [str(mysql), "--no-defaults", f"--socket={socket}", "--user=root", "--binary-mode"]
                if not database.replace("_", "").isalnum():
                    raise RuntimeError("invalid MySQL recovery database name")
                command([*args, "--execute", f"CREATE DATABASE `{database}`"])
                with dump.open("rb") as source:
                    result = subprocess.run([*args, database], stdin=source, capture_output=True, timeout=3600)
                    if result.returncode:
                        raise RuntimeError("disposable MySQL SQL recovery failed")
                command([*args, "--execute", f"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='{database}'"])
            finally:
                process.terminate()
                try:
                    process.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=CONFIG)
    parser.add_argument("--check", action="store_true", help="rotate through a seventh of all repository data")
    parser.add_argument("--drill", action="store_true", help="load recovered PostgreSQL/Vitess dumps in disposable instances")
    parser.add_argument("--retry-failed", action="store_true", help="retry failed app groups without repeating successful backups")
    parser.add_argument("--preserve-backups", action="store_true", help="verify fresh backups without expiring any existing snapshots")
    args = parser.parse_args()
    os.umask(0o077)
    with open("/run/lock/host-backup.lock", "a") as lock:
        # Timer/manual checks share state and must serialize with backups.
        fcntl.flock(lock, fcntl.LOCK_EX)
        config = json.loads(args.config.read_text())
        archives = {name: ResticArchive(Path(env_file)) for name, env_file in config["repositories"].items()}
        state = json.loads(STATE.read_text()) if STATE.exists() else {}
        if args.drill:
            for project, specification in config["projects"].items():
                mysql_databases = [(index, item) for index, item in enumerate(specification.get("mysql", [])) if item.get("socket")]
                if not specification.get("postgres") and not mysql_databases:
                    continue
                for name, archive in archives.items():
                    snapshots = json.loads(archive.run("snapshots", "--json", "--latest", "1", "--tag", f"app-daily,project:{project}"))
                    if not snapshots:
                        raise RuntimeError(f"{project}: no {name} recovery snapshot")
                    snapshot = max(snapshots, key=lambda item: item["time"])["id"]
                    for database in specification["postgres"]:
                        path = Path(config.get("staging", "/var/cache/host-backup")) / project / "databases" / f"{database}.dump"
                        with tempfile.TemporaryDirectory(prefix="host-drill-", dir="/var/tmp") as scratch:
                            restored = archive.restore(snapshot, path, Path(scratch))
                            postgres_recovery(restored)
                    for index, database in mysql_databases:
                        path = Path(config.get("staging", "/var/cache/host-backup")) / project / "databases" / f"mysql-{index}-{database['database']}.sql"
                        with tempfile.TemporaryDirectory(prefix="host-drill-", dir="/var/tmp") as scratch:
                            restored = archive.restore(snapshot, path, Path(scratch))
                            mysql_recovery(restored, database["database"], database["binary"])
                    state.setdefault("drills", {})[f"{project}:{name}"] = int(time.time())
                    save(STATE, state)
                    print(f"{project}: {name} recovered into isolated database instances", flush=True)
            return
        if args.check:
            for name, archive in archives.items():
                previous = state.setdefault("checks", {}).get(name, {})
                partition = previous.get("partition", 0) % 7 + 1
                archive.run("check", f"--read-data-subset={partition}/7")
                state["checks"][name] = {"partition": partition, "timestamp": int(time.time())}
                save(STATE, state)
                print(f"{name}: repository check {partition}/7 passed", flush=True)
            return
        if args.retry_failed and not any(item.get("error") for item in state.get("projects", {}).values()):
            print("No failed app backups to retry", flush=True)
            return
        stage = Path(config.get("staging", "/var/cache/host-backup"))
        stage.mkdir(mode=0o700, parents=True, exist_ok=True)
        if stage.is_symlink() or stage.stat().st_uid != 0 or stage.stat().st_mode & 0o077:
            raise RuntimeError("staging must be a dedicated private root-owned directory")
        (stage / STAGING_MARKER).write_text("managed disposable database dump staging\n")
        failures = []
        for project, specification in config["projects"].items():
            previous = state.setdefault("projects", {}).get(project, {})
            if args.retry_failed and not previous.get("error"):
                continue
            try:
                results, error = project_backup(project, specification, archives, stage)
                previous.update(results)
                if error:
                    raise RuntimeError(error)
                previous.pop("error", None)
            except Exception as error:
                previous["error"] = str(error)
                failures.append(project)
                print(f"{project}: backup failed: {error}", flush=True)
            state["projects"][project] = previous
            save(STATE, state)
        if failures:
            raise SystemExit("backup failures: " + ", ".join(failures))
        # Stable project tags create separate retention groups in a single pass.
        # Prune once per provider, only after every fresh backup has recovered.
        for archive in ([] if args.preserve_backups else archives.values()):
            archive.run("forget", "--tag", "app-daily", "--group-by", "tags",
                        "--keep-daily", "7", "--keep-weekly", "5", "--keep-monthly", "12", "--prune")
        if args.retry_failed and all_projects_recovered(config, state, time.time()):
            # Clear only a failed daily run fully repaired by verified fresh
            # retries. Other backup/check/drill failures keep their own alerts.
            command(["systemctl", "reset-failed", "host-app-backup.service"])


if __name__ == "__main__":
    main()
