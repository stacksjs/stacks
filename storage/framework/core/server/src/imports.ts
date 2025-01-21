import type { AutoImportsOptions } from 'bun-plugin-auto-imports'
import { plugin } from 'bun'
import { path } from '@stacksjs/path'
import { autoImports } from 'bun-plugin-auto-imports'

export function initiateImports(): void {
  const options: AutoImportsOptions = {
    dts: path.storagePath('framework/types/server-auto-imports.d.ts'),
    dirs: [
      path.storagePath('framework/orm/src/models'),
      path.storagePath('framework/requests'),
    ],
    eslint: {
      enabled: true, // TODO: not needed in production envs
      filepath: path.storagePath('framework/server-auto-imports.json'),
    },
  }

  plugin(autoImports(options))
}
