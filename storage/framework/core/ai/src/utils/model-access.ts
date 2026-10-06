import { ai } from '@stacksjs/config'
import { bedrockRegion } from './client-bedrock-runtime'

// Lazy-load ts-cloud/aws — see client-bedrock.ts for context.
async function getBedrockClient(region: string): Promise<any> {
  const mod: any = await import('@stacksjs/ts-cloud/aws')
  if (!mod?.BedrockClient) {
    throw new Error(
      '@stacksjs/ts-cloud/aws does not export BedrockClient - rebuild ts-cloud or remove the AI dependency.',
    )
  }
  return new mod.BedrockClient(region)
}

/**
 * The foundation model an invocation id names: `us.anthropic.claude-sonnet-5-5`
 * and `global.anthropic.claude-sonnet-5-5` are inference profiles for
 * `anthropic.claude-sonnet-5-5`. Access is granted per foundation model, and
 * Bedrock's availability check refuses a `us.` profile id as invalid.
 */
export function foundationModelId(modelId: string): string {
  return modelId.replace(/^(?:global|us|us-gov|eu|apac|jp|au|ca)\./, '')
}

export interface ModelAccessResult {
  /** The id as configured. */
  modelId: string
  /**
   * `available` - invocable now. `requested` - an agreement was made from the
   * model's public offer and Bedrock is processing it. `failed` - see `error`.
   */
  status: 'available' | 'requested' | 'failed'
  error?: string
}

/**
 * Make each model invocable in this account: a no-op for one that already
 * is, an agreement from its public offer for a marketplace model that is not.
 *
 * Defaults to the models in `config/ai.ts`. Each model is reported on its own,
 * so one refused model does not hide the rest. This used to call a Bedrock
 * endpoint that does not exist and log the error for every model.
 */
export async function requestModelAccess(
  models: readonly string[] = ai.models ?? [],
  options: { region?: string } = {},
): Promise<ModelAccessResult[]> {
  if (models.length === 0)
    throw new Error('No AI models to request access to. List them under `models` in config/ai.ts.')

  const client = await getBedrockClient(bedrockRegion(options.region))
  const results: ModelAccessResult[] = []

  for (const modelId of models) {
    try {
      const { status } = await client.requestModelAccess({ modelId: foundationModelId(modelId) })
      results.push({ modelId, status })
    }
    catch (error) {
      results.push({ modelId, status: 'failed', error: (error as Error).message })
    }
  }

  return results
}
