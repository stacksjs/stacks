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
