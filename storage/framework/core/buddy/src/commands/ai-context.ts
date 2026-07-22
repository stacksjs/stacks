import type { CLI, CliOptions } from '@stacksjs/types'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { buildProjectContext } from '@stacksjs/ai'
import { onUnknownSubcommand } from '@stacksjs/cli'

export interface AiContextCommandOptions extends CliOptions {
  json?: boolean
  output?: string
  maxChars?: string | number
  model?: string
}

export interface AiContextCommandResult {
  output: string
  outputPath: string | null
}

export function generateAiContextOutput(
  options: AiContextCommandOptions = {},
  projectRoot: string = process.cwd(),
): AiContextCommandResult {
  const maxChars = options.maxChars === undefined ? undefined : Number(options.maxChars)
  const result = buildProjectContext(projectRoot, { maxChars, model: options.model })
  const output = options.json
    ? `${JSON.stringify(result, null, 2)}\n`
    : `${result.text}\n\nContext metrics:\n${JSON.stringify(result.metrics, null, 2)}\n`

  if (!options.output) return { output, outputPath: null }
  const outputPath = resolve(projectRoot, String(options.output))
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, output)
  return { output, outputPath }
}

export function aiContext(buddy: CLI): void {
  buddy
    .command('ai:context', 'Generate compact deterministic project context for coding models')
    .option('-J, --json', 'Emit the versioned machine-readable context contract', { default: false })
    .option('-o, --output [path]', 'Write output to a file instead of stdout')
    .option('--max-chars [characters]', 'Maximum characters in the prompt context payload', { default: 4000 })
    .option('--model [model]', 'Model family used for the heuristic token estimate', { default: 'gpt-4o' })
    .example('buddy ai:context')
    .example('buddy ai:context --json')
    .example('buddy ai:context --json --output .stacks/ai-context.json')
    .action((options: AiContextCommandOptions) => {
      const generated = generateAiContextOutput(options)
      if (generated.outputPath) console.log(`Wrote AI project context to ${generated.outputPath}`)
      else process.stdout.write(generated.output)
    })

  onUnknownSubcommand(buddy, 'ai:context')
}
