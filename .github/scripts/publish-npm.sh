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
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

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

  held=$(grep -c 'held back: it installs' "$log" || true)
  if [ "$attempt" -eq "$attempts" ]; then
    rm -f "$log"
    break
  fi

  # A readable tarball alone does not make versionExists true. Read the exact
  # metadata and compare the full archive to the original accepted SRI before
  # any invocation that could otherwise send another PUT. The verifier imports
  # only Node builtins; its own cwd avoids application bunfig preloads.
  if ! (cd "$script_dir" && bun npm-publication.ts "$log" "$wait_seconds"); then
    rm -f "$log"
    echo "::error::Original accepted publication is not verified; no publish resumed"
    exit "$status"
  fi
  rm -f "$log"
  echo "Publishing again (${held} held back): what is already out is skipped (attempt $((attempt + 1)) of ${attempts})"
done

echo "::error::pantry publish still failing after ${attempts} attempts"
exit 1
