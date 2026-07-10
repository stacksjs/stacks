/**
 * Build @stacksjs/defaults.
 *
 * The canonical scaffold defaults live at `storage/framework/defaults` — the
 * single source of truth. This package is a thin publish wrapper: it copies the
 * runtime-relevant trees here so the package can ship them to npm, without
 * duplicating the source in git (the copies are gitignored + regenerated).
 *
 * Trees shipped:
 * - `resources/` — stx components, layouts, the preloader, etc.
 * - `app/` — the default app scaffold. A node_modules-based app has no vendored
 *   `storage/framework/defaults`, so the framework resolves default middleware
 *   (e.g. `app/Middleware/Cors.ts`, mounted by the actions API server) from here.
 */
import { cp, rm } from 'node:fs/promises'
import { join } from 'node:path'

const here = import.meta.dir

for (const tree of ['resources', 'app']) {
  const source = join(here, `../../defaults/${tree}`)
  const dest = join(here, tree)
  await rm(dest, { recursive: true, force: true })
  await cp(source, dest, { recursive: true })
  // eslint-disable-next-line no-console
  console.log(`@stacksjs/defaults: copied ${tree} from ${source}`)
}
