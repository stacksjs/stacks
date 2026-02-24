import { BedrockClient } from '@stacksjs/ts-cloud'
import { log } from '@stacksjs/cli'
import { ai } from '@stacksjs/config'

export async function requestModelAccess(): Promise<void> {
  const client = new BedrockClient('us-east-1')

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
