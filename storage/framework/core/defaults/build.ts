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

/**
 * The VS Code extension's development tree, which apps never need.
 *
 * `ide/vscode` is where the Stacks extension is built and tested; it ships to
 * the Marketplace on its own. An app only uses its `.vscode` settings and
 * manifest. The sources and tests import `core/*` and `@stacksjs/stx-vscode`,
 * which exist only in this repository, so once `buddy upgrade` copied them
 * into an app its root `bun test` failed nine tests and every deploy gated on
 * it stopped (wildloop, stacks 0.75.62). The sync removes what the package no
 * longer ships, so leaving them out here also cleans up apps that have them.
 */
const EXTENSION_DEVELOPMENT_PATHS = ['src', 'tests', 'scripts', 'dist', 'node_modules', 'build.ts', 'tsconfig.json']
  .map(path => join(defaults, 'ide/vscode', path))

function shipsToApps(source: string): boolean {
  return !EXTENSION_DEVELOPMENT_PATHS.some(path => source === path || source.startsWith(`${path}/`))
}

for (const entry of await readdir(defaults)) {
  const source = join(defaults, entry)
  const dest = join(here, entry)
  await rm(dest, { recursive: true, force: true })
  await cp(source, dest, { recursive: true, filter: shipsToApps })
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

// The framework's type declarations, which `buddy upgrade` keeps current in a
// package app (see FRAMEWORK_TYPES_SUPPORT_DIRECTORY in
// actions/src/upgrade/package-project.ts). The two the runtime generates per
// app stay out of the package.
const generatedTypes = new Set(['server-auto-imports.d.ts', 'browser-auto-imports.d.ts'])
await cp(join(here, '../../types'), join(here, 'project/storage/framework/types'), {
  recursive: true,
  filter: source => !generatedTypes.has(source.split('/').pop() ?? ''),
})
// eslint-disable-next-line no-console
console.log('@stacksjs/defaults: copied the framework type declarations')
