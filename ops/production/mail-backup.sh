#!/usr/bin/env bash
set -euo pipefail

MAIL_DIR="${MAIL_DIR:-/opt/mail}"
BACKUP_DIR="${BACKUP_DIR:-${MAIL_DIR}/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-7}"
MAIL_ENV_FILE="${MAIL_ENV_FILE:-/etc/mail/mail.env}"
[[ "${RETAIN_DAYS}" =~ ^[1-9][0-9]*$ ]] || { echo "mail-backup: RETAIN_DAYS must be positive" >&2; exit 1; }

[[ "${MAIL_DIR}" == /* && "${MAIL_DIR}" != "/" ]] || {
  echo "mail-backup: MAIL_DIR must be an absolute non-root path" >&2
  exit 1
}
[[ "${BACKUP_DIR}" == /* && "${BACKUP_DIR}" != "/" ]] || {
  echo "mail-backup: BACKUP_DIR must be an absolute non-root path" >&2
  exit 1
}

install -d -m 0700 -o root -g root "${BACKUP_DIR}"
exec 9>"${BACKUP_DIR}/.mail-backup.lock"
flock -w 600 9 || { echo "mail-backup: another backup is running" >&2; exit 1; }

timestamp="$(date -u +%Y%m%d-%H%M%S)"
output="${BACKUP_DIR}/mail-backup-${timestamp}.tgz"
partial="${output}.partial"
env_partial="${output%.tgz}.env.tar.partial"
work_dir="$(mktemp -d "${BACKUP_DIR}/.mail-backup-${timestamp}.XXXXXX")"

cleanup() {
  rm -f "${partial}" "${env_partial}"
  find "${work_dir}" -depth -delete 2>/dev/null || true
}
trap cleanup EXIT

declare -a snapshots=()
for database in smtp.db caldav.db; do
  if [[ -f "${MAIL_DIR}/${database}" ]]; then
    sqlite3 "${MAIL_DIR}/${database}" ".backup '${work_dir}/${database}'"
    sqlite3 -readonly "${work_dir}/${database}" "PRAGMA quick_check;" \
    | grep -qx ok
    snapshots+=("${database}")
  fi
done

declare -a persistent=()
for path in mail dkim forwards.json forwards.sieve cert-backups; do
  [[ -e "${MAIL_DIR}/${path}" ]] && persistent+=("${path}")
done

tar --dereference -czf "${partial}" \
-C "${MAIL_DIR}" "${persistent[@]}" \
-C "${work_dir}" "${snapshots[@]}"
tar tzf "${partial}" >/dev/null
chmod 0600 "${partial}"
mv "${partial}" "${output}"

if [[ -f "${MAIL_ENV_FILE}" ]]; then
  env_output="${output%.tgz}.env.tar"
  tar cf "${env_output}.partial" -C "$(dirname "${MAIL_ENV_FILE}")" "$(basename "${MAIL_ENV_FILE}")"
  tar tf "${env_output}.partial" >/dev/null
  chmod 0600 "${env_output}.partial"
  mv "${env_output}.partial" "${env_output}"
fi

if [[ "${MAIL_BACKUP_PRESERVE:-0}" != 1 ]]; then
  find -H "${BACKUP_DIR}" -maxdepth 1 -type f \
  \( -name 'mail-backup-*.tgz' -o -name 'mail-backup-*.env.tar' \) \
  -mtime "+${RETAIN_DAYS}" -delete

fi

echo "backup written: ${output} ($(du -h "${output}" | cut -f1))"
