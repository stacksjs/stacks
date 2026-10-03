import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { runTool } from './run-tool'

interface DesktopProbeOptions {
  browser?: boolean | string
  open?: boolean
  record?: boolean
  out?: string
  craftBin?: string
  interactionWindow?: string | number
  idle?: string | number
  load?: string | number
  cpuLoad?: string | number
  instances?: string | number
  timeout?: string | number
}

/**
 * Translate the parsed options back into the flags the runner reads.
 *
 * The runner is also a plain script (`bun .../desktop/src/probe/runner.ts`),
 * so it owns its flag parsing; this keeps the two spellings identical rather
 * than maintaining a second parser.
 */
export function desktopProbeFlags(options: DesktopProbeOptions): string[] {
  const flags: string[] = []
  if (options.browser === true)
    flags.push('--browser')
  else if (typeof options.browser === 'string' && options.browser.length > 0)
    flags.push(`--browser=${options.browser}`)
  if (options.open === false)
    flags.push('--no-open')
  if (options.record)
    flags.push('--record')

  const valued: Array<[keyof DesktopProbeOptions, string]> = [
    ['out', 'out'],
    ['craftBin', 'craft-bin'],
    ['interactionWindow', 'interaction-window'],
    ['idle', 'idle'],
    ['load', 'load'],
    ['cpuLoad', 'cpu-load'],
    ['instances', 'instances'],
    ['timeout', 'timeout'],
  ]
  for (const [key, flag] of valued) {
    const value = options[key]
    if (value !== undefined && value !== '' && typeof value !== 'boolean')
      flags.push(`--${flag}=${value}`)
  }
  return flags
}

/**
 * `buddy desktop:probe` - measure whether a Craft window can host interactive
 * or game content (stacksjs/stacks#877). See the runner for what it measures.
 */
export function desktopProbe(buddy: CLI): void {
  buddy
    .command('desktop:probe', 'Measure WebGL2/WebGPU, frame pacing, input and audio latency, gamepad, fullscreen and pointer lock in a Craft window')
    .option('--browser [name]', 'Run the same page in a browser instead (default browser, or a named one on macOS)')
    .option('--no-open', 'With --browser, print the URL instead of opening it')
    .option('--record', 'Write the record into the framework repository\'s probe results (framework checkout only)')
    .option('--out <file>', 'Also write the record as JSON to this file')
    .option('--craft-bin <path>', 'Craft binary to use (defaults to CRAFT_BIN, then craft on PATH)')
    .option('--interaction-window <seconds>', 'How long to wait for real clicks and key presses; 0 skips them (default 20)')
    .option('--idle <seconds>', 'Idle frame-pacing sample length (default 3)')
    .option('--load <seconds>', 'Loaded frame-pacing sample length (default 6)')
    .option('--cpu-load <ms>', 'Busy-wait added to each loaded frame (default 6)')
    .option('--instances <count>', 'Instanced cubes drawn per loaded frame, 12 triangles each (default 40000)')
    .option('--timeout <seconds>', 'Give up after this long')
    .example('buddy desktop:probe --record')
    .example('buddy desktop:probe --browser=Safari --record')
    .action(async (options: DesktopProbeOptions) => {
      try {
        const { run } = await import('../../../desktop/src/probe/runner')
        await runTool(run, ...desktopProbeFlags(options))
      }
      catch (error) {
        // Synchronous: an awaited logger loses the message to process.exit.
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
        process.exit(1)
      }
    })
}
