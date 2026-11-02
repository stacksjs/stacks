#!/bin/bash
set -euo pipefail
exec bun "$(dirname "$0")/update-homebrew-formula.ts" "$@"
