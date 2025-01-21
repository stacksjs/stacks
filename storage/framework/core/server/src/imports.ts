import type { AutoImportsOptions } from 'bun-plugin-auto-imports'
import { plugin } from 'bun'
import { autoImports } from 'bun-plugin-auto-imports'
import { path } from '@stacksjs/path'

const options: AutoImportsOptions = {
  presets: ['solid-js'], // any unimport presets are valid
  dirs: [
    path.storagePath('framework/orm/src/models'),
    path.storagePath('framework/requests')
  ]
}

export function initiateImports(): void {
  plugin(autoImports(options))
}
