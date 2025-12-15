import type { AutoImportsOptions } from 'bun-plugin-auto-imports'
import { plugin } from 'bun'
import { path } from '@stacksjs/path'
import { autoImports } from 'bun-plugin-auto-imports'
import { globSync } from '@stacksjs/storage'

function scanExports(dir: string): string[] {
  const files = globSync(`${dir}/**/*.ts`, { ignore: ['**/*.d.ts', '**/index.ts'] })
  const exports: string[] = []

  for (const file of files) {
    const content = Bun.file(file).text()
    // Extract export names (simplified)
    const basename = file.split('/').pop()?.replace('.ts', '') || ''
    if (basename) {
      exports.push(basename) // default export name
      exports.push(`${basename}Model`) // ModelModel class
    }
  }

  return exports
}

export function initiateImports(): void {
  const modelsPath = path.storagePath('framework/orm/src/models')
  const requestsPath = path.storagePath('framework/requests')

  // Build explicit imports with absolute paths to avoid relative path resolution issues
  const modelExports = scanExports(modelsPath)
  const requestExports = scanExports(requestsPath)

  const modelImports = modelExports.map(name => ({
    from: modelsPath,
    name,
    as: name,
  }))

  const requestImports = requestExports.map(name => ({
    from: requestsPath,
    name,
    as: name,
  }))

  const options: AutoImportsOptions = {
    dts: path.storagePath('framework/types/server-auto-imports.d.ts'),
    imports: [...modelImports, ...requestImports],
    eslint: {
      enabled: true, // TODO: not needed in production envs
      filepath: path.storagePath('framework/server-auto-imports.json'),
    },
  }

  plugin(autoImports(options))
}
