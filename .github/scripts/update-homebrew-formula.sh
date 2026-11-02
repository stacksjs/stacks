#!/bin/bash
set -euo pipefail
homebrew_project_root="$PWD"
# Publication runs before application dependencies exist. Match the other
# bootstrap scripts by invoking Bun from this dependency-free directory.
cd "$(dirname "$0")"
exec bun update-homebrew-formula.ts "${1:-}" "$homebrew_project_root"
