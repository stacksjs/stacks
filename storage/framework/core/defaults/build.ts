/**
 * Build @stacksjs/defaults.
 *
 * The canonical scaffold defaults live at `storage/framework/defaults` — the
 * single source of truth. This package is a thin publish wrapper: it copies the
 * runtime-relevant `resources/` tree here so the package can ship it to npm,
 * without duplicating the source in git (the copy is gitignored + regenerated).
 */
import { cp, rm } from 'node:fs/promises'
import { join } from 'node:path'

const here = import.meta.dir
const source = join(here, '../../defaults/resources')
const dest = join(here, 'resources')

await rm(dest, { recursive: true, force: true })
await cp(source, dest, { recursive: true })

// eslint-disable-next-line no-console
console.log(`@stacksjs/defaults: copied resources from ${source}`)
