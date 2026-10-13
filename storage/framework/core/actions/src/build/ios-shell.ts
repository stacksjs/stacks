import type { IosMobileConfig } from '@stacksjs/types'
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Keep native source package-owned while retaining Xcode metadata for cloud project discovery. */
export function writeIosShellSupport(output: string, config: IosMobileConfig, bunVersion = Bun.version): void {
  const version = config.shell?.bunVersion ?? bunVersion
  if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version)) throw new Error('ios.shell.bunVersion must be a Bun version such as 1.3.14')
  writeFileSync(join(output, '.gitignore'), '# Native sources are restored from the locked Craft package.\n*.swift\n')
  const scripts = join(output, 'ci_scripts')
  mkdirSync(scripts, { recursive: true })
  // Restoring build output does not boot the app or load its runtime preloader.
  writeFileSync(join(scripts, 'bunfig.toml'), 'preload = []\n')
  const path = join(scripts, 'ci_post_clone.sh')
  writeFileSync(path, `#!/bin/sh
set -eu
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="\${CI_PRIMARY_REPOSITORY_PATH:-$(git -C "$PROJECT_DIR" rev-parse --show-toplevel)}"
if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.com/install -o /tmp/stacks-install-bun.sh
  bash /tmp/stacks-install-bun.sh "bun-v${version}"
  export PATH="$HOME/.bun/bin:$PATH"
fi
cd "$ROOT"
bun install --frozen-lockfile
bun --config="$PROJECT_DIR/ci_scripts/bunfig.toml" -e 'import { restoreIosShell } from "@stacksjs/mobile/testing"; restoreIosShell(process.argv[1])' "$PROJECT_DIR"
`)
  chmodSync(path, 0o755)
}
