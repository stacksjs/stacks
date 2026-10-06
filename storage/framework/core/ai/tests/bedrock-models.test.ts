import { describe, expect, test } from 'bun:test'
import { ai } from '@stacksjs/config'
import { bedrockModels } from '@stacksjs/types'
import { defaults } from '../../config/src/defaults'
import { isBedrockModelId } from '../src/client'
import { DEFAULT_BEDROCK_MODEL } from '../src/drivers/bedrock'

/**
 * The Bedrock model ids Stacks names, held to what Bedrock serves.
 *
 * A retired model fails with a 404 only when it is called, and a model served
 * only through an inference profile fails only when it is invoked by its bare
 * id, so nothing at build time notices either. The list had drifted to seven
 * retired ids and one that never existed. The live check below re-verifies it
 * against an account: `STACKS_BEDROCK_LIVE=1 bun test bedrock-models`.
 */
describe('the Bedrock model list', () => {
  test('names every id once, each of which routes to the Bedrock driver', () => {
    expect(new Set(bedrockModels).size).toBe(bedrockModels.length)
    expect(bedrockModels.filter(id => !isBedrockModelId(id))).toEqual([])
  })

  test('is what the framework defaults, this app\'s config and the driver default draw from', () => {
    const listed = new Set<string>(bedrockModels)
    expect(defaults.ai?.models?.length).toBeGreaterThan(0)
    expect((defaults.ai?.models ?? []).filter(id => !listed.has(id))).toEqual([])
    expect(ai.models?.length).toBeGreaterThan(0)
    expect((ai.models ?? []).filter(id => !listed.has(id))).toEqual([])
    expect(listed.has(DEFAULT_BEDROCK_MODEL)).toBe(true)
  })

  test.if(process.env.STACKS_BEDROCK_LIVE === '1')('is served by Bedrock, each id in the form it is invoked by', async () => {
    const { BedrockClient } = await import('@stacksjs/ts-cloud/aws')
    const client = new BedrockClient(process.env.AWS_REGION || 'us-east-1')

    const onDemand = new Set<string>()
    for (const provider of ['amazon', 'anthropic', 'meta']) {
      for (const model of await client.listModelsByProvider(provider)) {
        if (model.modelLifecycle?.status === 'ACTIVE' && model.inferenceTypesSupported?.includes('ON_DEMAND'))
          onDemand.add(model.modelId)
      }
    }

    const profiles = new Set<string>()
    let nextToken: string | undefined
    do {
      const page: any = await client.listInferenceProfiles({ maxResults: 100, nextToken, typeEquals: 'SYSTEM_DEFINED' } as any)
      for (const profile of page.inferenceProfileSummaries ?? []) {
        if (profile.status === 'ACTIVE')
          profiles.add(profile.inferenceProfileId)
      }
      nextToken = page.nextToken
    } while (nextToken)

    expect(bedrockModels.filter(id => !onDemand.has(id) && !profiles.has(id))).toEqual([])
  }, 60_000)
})
