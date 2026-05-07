import { log } from '@stacksjs/cli'
import { ai } from '@stacksjs/config'

// Lazy-load ts-cloud/aws — see client-bedrock.ts for context.
async function getBedrockClient(): Promise<any> {
  const mod: any = await import('@stacksjs/ts-cloud/aws')
  if (!mod?.BedrockClient) {
    throw new Error(
      '@stacksjs/ts-cloud/aws does not export BedrockClient — rebuild ts-cloud or remove the AI dependency.',
    )
  }
  return new mod.BedrockClient('us-east-1')
}

export async function requestModelAccess(): Promise<void> {
  const client = await getBedrockClient()

  const models = ai.models
  if (!models)
    throw new Error('No AI models found. Please set ./config/ai.ts values.')

  for (const model of models) {
    try {
      log.info(`Requesting access to model ${model}`)
      const data = await client.requestModelAccess({ modelId: model })
      log.info(`Response for model ${model}:`, data)
    }
    catch (error) {
      log.error(`Error requesting access to model ${model}:`, error)
    }
  }
}
