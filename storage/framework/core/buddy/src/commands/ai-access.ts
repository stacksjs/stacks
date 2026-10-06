import type { ModelAccessResult } from '@stacksjs/ai'
import type { CLI, CliOptions } from '@stacksjs/types'
import process from 'node:process'
import { onUnknownSubcommand } from '@stacksjs/cli'

export interface AiAccessCommandOptions extends CliOptions {
  region?: string
  json?: boolean
}

/**
 * One line per model, and whether every model is now invocable.
 */
export function formatModelAccess(results: ModelAccessResult[]): { output: string, ok: boolean } {
  const label: Record<ModelAccessResult['status'], string> = {
    available: 'available',
    requested: 'requested (Bedrock is processing the agreement)',
    failed: 'failed',
  }
  const width = Math.max(...results.map(result => result.modelId.length))
  const lines = results.map(result =>
    `${result.modelId.padEnd(width)}  ${label[result.status]}${result.error ? `: ${result.error}` : ''}`,
  )
  return { output: `${lines.join('\n')}\n`, ok: results.every(result => result.status !== 'failed') }
}

export function aiAccess(buddy: CLI): void {
  buddy
    .command('ai:access [...models]', 'Make the Amazon Bedrock models in config/ai.ts invocable in this AWS account')
    .option('--region [region]', 'The AWS region (defaults to AWS_REGION, then AWS_DEFAULT_REGION, then us-east-1)')
    .option('-J, --json', 'Print the result per model as JSON', { default: false })
    .example('buddy ai:access')
    .example('buddy ai:access global.anthropic.claude-sonnet-5-5')
    .action(async (models: string[] | undefined, options: AiAccessCommandOptions) => {
      const { requestModelAccess } = await import('@stacksjs/ai')
      const results = await requestModelAccess(models && models.length > 0 ? models : undefined, { region: options.region })
      const { output, ok } = formatModelAccess(results)
      process.stdout.write(options.json ? `${JSON.stringify(results, null, 2)}\n` : output)
      if (!ok)
        process.exitCode = 1
    })

  onUnknownSubcommand(buddy, 'ai:access')
}
