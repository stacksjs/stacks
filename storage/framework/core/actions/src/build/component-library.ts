import type { ComponentLibraryBuildResult } from '@stacksjs/stx'
import { log } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'
import { hasComponents } from '@stacksjs/storage'
import { buildComponentLibrary } from '@stacksjs/stx'

interface ProjectManifest {
  name?: string
}

export function componentPrefix(packageName: string | undefined): string {
  const unscopedName = packageName?.split('/').at(-1) || 'stx'
  const prefix = unscopedName
    .replace(/(?:-stx|-components?)$/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return prefix || 'stx'
}

async function projectPackageName(): Promise<string | undefined> {
  try {
    const manifest = await Bun.file(projectPath('package.json')).json() as ProjectManifest
    return manifest.name
  }
  catch {
    return undefined
  }
}

export async function buildStxComponentLibrary(): Promise<ComponentLibraryBuildResult | undefined> {
  if (!hasComponents()) {
    log.warn('No components found in resources/components.')
    return undefined
  }

  const inputDir = projectPath('resources/components')
  const outputDir = projectPath('storage/framework/libs/components/stx/dist')
  const prefix = componentPrefix(await projectPackageName())

  log.info('Building your STX component library...')
  const result = await buildComponentLibrary({
    inputDir,
    outputDir,
    prefix,
    progressive: true,
    manifest: true,
    declarations: true,
    css: true,
    bundle: true,
    minify: true,
    sourcemap: 'external',
  })

  log.success(`Built ${result.components.length} components to ${outputDir}`)
  return result
}
