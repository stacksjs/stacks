import type { AutoImportsOptions } from 'bun-plugin-auto-imports'
import { plugin } from 'bun'
import { path } from '@stacksjs/path'
import { autoImports } from 'bun-plugin-auto-imports'

const options: AutoImportsOptions = {
  dirs: [
    path.storagePath('framework/orm/src/models'),
    path.storagePath('framework/requests'),
  ],
}

export function initiateImports(): void {
  plugin(autoImports(options))
}
