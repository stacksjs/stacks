/**
 * Build @stacksjs/defaults.
 *
 * The canonical scaffold defaults live at `storage/framework/defaults` — the
 * single source of truth. This package is a thin publish wrapper: it copies the
 * complete managed scaffold here so the package can ship it to npm, without
 * duplicating the source in git (the copies are gitignored + regenerated).
 *
 * A package-based app still keeps `storage/framework/defaults` as its managed
 * application scaffold. `buddy update` refreshes that directory from this
 * package, including the AI skills and editor guidance. `project/` carries the
 * handful of root/support files that live outside the defaults tree.
 */
import { cp, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

const here = import.meta.dir
const defaults = join(here, '../../defaults')

for (const entry of await readdir(defaults)) {
  const source = join(defaults, entry)
  const dest = join(here, entry)
  await rm(dest, { recursive: true, force: true })
  await cp(source, dest, { recursive: true })
  // eslint-disable-next-line no-console
  console.log(`@stacksjs/defaults: copied ${entry} from ${source}`)
}

const projectFiles: Array<{ source: string, destination: string }> = [
  { source: join(here, '../../../../buddy'), destination: join(here, 'project/buddy') },
  { source: join(here, '../../../../bootstrap'), destination: join(here, 'project/bootstrap') },
  { source: join(here, '../../tsconfig.package-app.json'), destination: join(here, 'project/storage/framework/tsconfig.app.json') },
  { source: join(here, '../../tsconfig.base.json'), destination: join(here, 'project/storage/framework/tsconfig.base.json') },
  { source: join(here, '../../server/tsconfig.docker.json'), destination: join(here, 'project/storage/framework/server/tsconfig.docker.json') },
]

await rm(join(here, 'project'), { recursive: true, force: true })
for (const file of projectFiles) {
  await cp(file.source, file.destination, { recursive: true })
  // eslint-disable-next-line no-console
  console.log(`@stacksjs/defaults: copied project support file ${file.source}`)
}
