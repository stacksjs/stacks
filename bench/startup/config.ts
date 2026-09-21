export type StartupVariant = 'root' | 'runtime'

export interface StartupOptions {
  output: string
  pairs: number
}

export interface ScheduledSample {
  order: number
  pair: number
  variant: StartupVariant
}

export const MIN_STARTUP_PAIRS = 15

export function parseStartupOptions(args: readonly string[], defaultOutput = 'bench/startup/results/latest.json'): StartupOptions {
  let output = defaultOutput
  let pairs = MIN_STARTUP_PAIRS

  for (const argument of args) {
    if (argument === '--') continue
    if (argument.startsWith('--pairs=')) {
      pairs = Number(argument.slice('--pairs='.length))
      continue
    }
    if (argument.startsWith('--output=')) {
      output = argument.slice('--output='.length)
      continue
    }
    throw new Error(`Unknown startup benchmark option: ${argument}`)
  }

  if (!Number.isSafeInteger(pairs) || pairs < MIN_STARTUP_PAIRS)
    throw new Error(`--pairs must be an integer of at least ${MIN_STARTUP_PAIRS}, received ${pairs}`)
  if (!output.trim())
    throw new Error('--output must not be empty')

  return { output, pairs }
}

export function startupSchedule(pairs: number): ScheduledSample[] {
  if (!Number.isSafeInteger(pairs) || pairs < MIN_STARTUP_PAIRS)
    throw new Error(`pairs must be an integer of at least ${MIN_STARTUP_PAIRS}, received ${pairs}`)

  return Array.from({ length: pairs }, (_, pair) => {
    const variants: StartupVariant[] = pair % 2 === 0 ? ['root', 'runtime'] : ['runtime', 'root']
    return variants.map((variant, order) => ({ order, pair, variant }))
  }).flat()
}

export function startupSampleCommand(executable: string, config: string, sample: string, entry: string): string[] {
  return [executable, '--no-env-file', `--config=${config}`, sample, entry]
}
