import process from 'node:process'

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
