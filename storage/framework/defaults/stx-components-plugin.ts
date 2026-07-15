import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * stx plugin exposing `@stacksjs/components`' ui library (<Sidebar>,
 * <Button>, …) to tag resolution in every Stacks stx server — the
 * dashboard uses it for the macOS-style web sidebar.
 *
 * The library ships its .stx sources in the package, so the installed
 * copy is used when present. A local stx checkout wins during framework
 * development (same convention as the Craft SDK resolution in
 * `core/actions/src/dev/dashboard.ts`), and `STX_COMPONENTS_DIR` can
 * point anywhere explicitly.
 */
const candidates = [
  process.env.STX_COMPONENTS_DIR,
  join(homedir(), 'Code/Tools/stx/packages/components/src/ui'),
  join(process.cwd(), 'node_modules/@stacksjs/components/src/ui'),
].filter((dir): dir is string => Boolean(dir))

export default {
  name: '@stacksjs/components',
  components: candidates.find(dir => existsSync(dir)) ?? candidates[candidates.length - 1],
}
