import process from 'node:process'
import { defaultsPath, projectPath } from '@stacksjs/path'

export type CraftBinaryResolver = (explicit?: string) => string
export type CraftPathLocator = (binary: string) => string | null

export interface DashboardCraftResolutionOptions {
  disabled?: boolean
  explicit?: string
  findOnPath?: CraftPathLocator
}

export function resolveDashboardCraftExecutable(
  resolveCraftBinary: CraftBinaryResolver,
  options: DashboardCraftResolutionOptions = {},
): string | undefined {
  const disabled = options.disabled ?? process.env.STACKS_NO_NATIVE === '1'
  if (disabled) return undefined

  const explicit = options.explicit ?? process.env.CRAFT_BIN
  const resolved = resolveCraftBinary(explicit)
  if (resolved !== 'craft') return resolved

  const findOnPath = options.findOnPath ?? (binary => Bun.which(binary))
  return findOnPath(resolved) ?? undefined
}

export function dashboardCraftCommand(options: {
  binary: string
  url: string
  icon?: string
  verbose?: boolean
}): string[] {
  // Both webviews need the same WebKit data store for the session cookie and
  // for appearance changes to reach the dashboard while Settings is open.
  return [
    options.binary,
    '--url', options.url,
    '--title', 'Stacks Dashboard',
    '--app-name', 'Stacks Dashboard',
    '--width', '1400',
    '--height', '900',
    '--titlebar-hidden',
    '--persistent-storage',
    ...(options.icon ? ['--icon', options.icon] : []),
    ...(options.verbose ? ['--dev-tools'] : ['--quiet']),
  ]
}

/** The supervisor owns the native window so its webviews survive worker swaps. */
export async function openDashboardNativeWindow(url: string, verbose: boolean) {
  if (process.env.STACKS_NO_NATIVE === '1') {
    console.log('  Native window disabled by STACKS_NO_NATIVE=1. Open the dashboard URL in a browser.')
    return undefined
  }

  let resolveCraftBinary: CraftBinaryResolver | undefined
  const explicitCraftSdk = process.env.CRAFT_SDK_SRC
  if (explicitCraftSdk) {
    try {
      ;({ resolveCraftBinary } = await import(explicitCraftSdk) as { resolveCraftBinary?: CraftBinaryResolver })
      if (!resolveCraftBinary)
        throw new Error('CRAFT_SDK_SRC must export resolveCraftBinary')
    }
    catch (error) {
      throw new Error(`Could not load CRAFT_SDK_SRC ${explicitCraftSdk}: ${error instanceof Error ? error.message : error}`)
    }
  }
  else {
    try {
      ;({ resolveCraftBinary } = await import('craft-native') as { resolveCraftBinary?: CraftBinaryResolver })
    }
    catch { /* fall back to the browser when Craft is unavailable */ }
  }
  const binary = resolveCraftBinary && resolveDashboardCraftExecutable(resolveCraftBinary)
  if (!binary) {
    console.log('  Native window unavailable. Run pantry install craft, set CRAFT_BIN, or open the dashboard URL in a browser.')
    return undefined
  }

  const userIcon = projectPath('resources/assets/images/app-icon.png')
  const defaultIcon = defaultsPath('resources/assets/images/app-icon.png')
  const icon = await Bun.file(userIcon).exists() ? userIcon : (await Bun.file(defaultIcon).exists() ? defaultIcon : undefined)
  return Bun.spawn(dashboardCraftCommand({ binary, url, icon, verbose }), {
    stdin: verbose ? 'inherit' : 'ignore',
    stdout: verbose ? 'inherit' : 'ignore',
    stderr: 'inherit',
  })
}
