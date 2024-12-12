import process from 'node:process'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { log } from '@stacksjs/cli'
import { ai } from '@stacksjs/config'
import AWS4 from 'aws4'

export async function requestModelAccess(): Promise<void> {
  process.env.AWS_REGION = 'us-east-1'
  const credentials = await defaultProvider()()

  const models = ai.models
  if (!models)
    throw new Error('No AI models found. Please set ./config/ai.ts values.')

  for (const model of models) {
    try {
      log.info(`Requesting access to model ${model}`)
      const request = {
        host: 'bedrock.us-east-1.amazonaws.com',
        method: 'POST',
        path: '/foundation-model-entitlement',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelId: model }),
        service: 'bedrock',
        region: 'us-east-1',
      }

      const signedRequest = AWS4.sign(request, credentials)
      const headers = Object.fromEntries(
        Object.entries(signedRequest.headers || {}).map(([key, value]) => [key, String(value)]),
      )

      const response = await fetch(`https://${signedRequest.host}${signedRequest.path}`, {
        method: signedRequest.method,
        headers,
        body: signedRequest.body,
      })

      const data = await response.json()
      log.info(`Response for model ${model}:`, data)
    }
    catch (error) {
      log.error(`Error requesting access to model ${model}:`, error)
    }
  }
}
