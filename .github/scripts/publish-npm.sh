#!/usr/bin/env bash
# pantry publish, finishing a publish npm has accepted but not yet shown.
#
# npm can take several minutes to make an accepted upload readable. pantry waits
# about two, then reports "Upload accepted; publication is pending public
# metadata and verified tarball availability", holds back every package that
# depends on it, and exits 1. v0.75.227 to v0.75.230 each stopped there with a
# few dozen of the 85 packages out, and needed `gh run rerun --failed` by hand,
# once per layer of the dependency graph, while npm caught up.
#
# This waits for each pending package's tarball to be readable and runs the
# same publish again, which skips everything already published and publishes
# what was held back. It never re-uploads a pending version early: that is
# npm's `409 Cannot publish over previously staged version`.
#
# Usage: .github/scripts/publish-npm.sh <pantry publish arguments...>
set -uo pipefail

attempts=${PUBLISH_ATTEMPTS:-16}
wait_seconds=${PUBLISH_VISIBLE_WAIT_SECONDS:-1200}

for attempt in $(seq 1 "$attempts"); do
  log=$(mktemp)
  pantry publish "$@" 2>&1 | tee "$log"
  status=${PIPESTATUS[0]}
  if [ "$status" -eq 0 ]; then
    rm -f "$log"
    exit 0
  fi

  # The packages pantry reported as accepted but pending: the
  # "Publishing name@version..." line before each such error.
  pending=$(awk '
    /^Publishing .+@[0-9][^ ]*\.\.\.$/ { current = $2; sub(/\.\.\.$/, "", current) }
    /publication is pending public metadata/ { if (current != "") print current }
  ' "$log" | sort -u)
  held=$(grep -c 'held back: it installs' "$log" || true)
  rm -f "$log"

  if [ -z "$pending" ]; then
    echo "::error::pantry publish failed (attempt $attempt) for a reason other than npm propagation"
    exit "$status"
  fi
  if [ "$attempt" -eq "$attempts" ]; then
    break
  fi

  for spec in $pending; do
    name=${spec%@*}
    version=${spec##*@}
    base=${name##*/}
    url="https://registry.npmjs.org/${name}/-/${base}-${version}.tgz"
    echo "Waiting for ${spec} to be readable on npm (${url})..."
    waited=0
    until [ "$(curl -s -o /dev/null -w '%{http_code}' "$url")" = 200 ]; do
      if [ "$waited" -ge "$wait_seconds" ]; then
        echo "::error::${spec} was accepted but is still not readable after ${wait_seconds}s"
        exit 1
      fi
      sleep 15
      waited=$((waited + 15))
    done
    echo "${spec} is readable after ${waited}s"
  done
  echo "Publishing again (${held} held back): what is already out is skipped (attempt $((attempt + 1)) of ${attempts})"
done

echo "::error::pantry publish still failing after ${attempts} attempts"
exit 1
