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

const library = candidates.find(dir => existsSync(dir)) ?? candidates[candidates.length - 1]

/**
 * Component directories contributed by installed packages.
 *
 * Wrapped on its own rather than left to the plugin loader's catch. stx wraps
 * plugin loading in `try { … } catch { console.warn(…) }`, so an exception
 * raised here would drop the WHOLE plugin - and this plugin is what supplies
 * the dashboard's sidebar. Degrading to "no package components" keeps the
 * library and the framework defaults working.
 *
 * `@stacksjs/config` is imported for the resolution rather than re-implemented,
 * because it carries the guard that refuses a path escaping the package.
 */
function packageDirs(): string[] {
  try {
    // eslint-disable-next-line ts/no-require-imports
    const { packageComponentRoots } = require('@stacksjs/config')
    return packageComponentRoots().map((root: { dir: string }) => root.dir)
  }
  catch {
    return []
  }
}

export default {
  name: '@stacksjs/components',
  /*
   * Order is the precedence, because stx searches this list and takes the
   * first match.
   *
   * The framework's own components are listed explicitly, ahead of any
   * package's. They already resolve today through stx's fallback directory, so
   * naming them here changes nothing on its own - what it does is put a floor
   * under the package roots, making an installed package purely ADDITIVE. A
   * package shipping its own `Button.stx` gets it used where nothing else
   * defines `<Button />`, and cannot quietly replace the framework's.
   */
  components: [
    library,
    // Relative to this file, which is what stx resolves plugin entries against.
    'resources/components',
    ...packageDirs(),
  ],
}
