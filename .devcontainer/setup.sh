#!/usr/bin/env bash
#
# Codespaces / devcontainer bootstrap (stacksjs/stacks#236).
#
# Runs once, as the container user, after the repository is mounted. A script
# rather than a JSON one-liner so each step can explain itself and fail with a
# message rather than a bare exit code.

set -euo pipefail

echo "==> Installing Pantry"
# Pantry provisions and PINS the toolchain this workspace declares - Bun, git,
# SQLite, and whatever the framework's manifest adds. Installing Bun directly
# would pin nothing and drift from what CI resolves.
if ! command -v pantry >/dev/null 2>&1; then
  curl -fsSL https://pantry.dev | bash
fi

# The installer puts pantry in ~/.local/bin, which a non-login shell has not
# picked up yet.
export PATH="$HOME/.local/bin:$PATH"

echo "==> Bootstrapping Pantry"
# Writes shell configuration for future terminals. Idempotent.
pantry bootstrap

echo "==> Installing dependencies"
bun install

echo "==> Running project setup"
# `buddy setup` is the project's own first-run path: it creates `.env` from the
# example, generates the APP_KEY that nearly every config- or database-touching
# command refuses to run without, and installs the IDE settings. Reproducing
# those steps here would be a second setup path to keep in sync.
#
# `--skip-aws` because a Codespace has no AWS credentials and should not stop
# to ask; `--no-interaction` because nobody is watching this run.
./buddy setup --skip-aws --no-interaction

cat <<'BANNER'

  Stacks is ready.

    ./buddy dev          start the dev servers
    ./buddy test         run the suite
    ./buddy list         every command

BANNER
