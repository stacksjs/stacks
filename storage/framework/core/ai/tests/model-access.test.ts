import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { foundationModelId, requestModelAccess } from '../src/utils/model-access'

const originalFetch = globalThis.fetch
const savedEnv = { ...process.env }

beforeEach(() => {
  process.env.AWS_ACCESS_KEY_ID = 'AKIDEXAMPLE'
  process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'
  delete process.env.AWS_REGION
  delete process.env.AWS_DEFAULT_REGION
})

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv))
      delete process.env[key]
  }
  Object.assign(process.env, savedEnv)
})

function availability(agreement: string, authorization = 'AUTHORIZED'): Response {
  return Response.json({
    modelId: 'm',
    agreementAvailability: { status: agreement, errorMessage: null },
    authorizationStatus: authorization,
    entitlementAvailability: 'AVAILABLE',
    regionAvailability: 'AVAILABLE',
  })
}

describe('requestModelAccess', () => {
  test('maps an inference profile to its foundation model', () => {
    // Bedrock's availability check refuses a `us.` profile id as invalid.
    expect(foundationModelId('us.anthropic.claude-sonnet-5-5')).toBe('anthropic.claude-sonnet-5-5')
    expect(foundationModelId('global.anthropic.claude-haiku-4-5-20251001-v1:0')).toBe('anthropic.claude-haiku-4-5-20251001-v1:0')
    expect(foundationModelId('amazon.nova-lite-v1:0')).toBe('amazon.nova-lite-v1:0')
  })

  test('reports every model on its own, so one refusal does not hide the rest', async () => {
    const paths: string[] = []
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input))
      paths.push(`${url.host}${url.pathname}`)
      if (url.pathname.endsWith('/amazon.nova-lite-v1%3A0'))
        return availability('AVAILABLE')
      return availability('NOT_AVAILABLE', 'NOT_AUTHORIZED')
    }) as typeof fetch

    const results = await requestModelAccess(['amazon.nova-lite-v1:0', 'us.anthropic.claude-sonnet-5-5'], { region: 'us-west-2' })

    expect(results[0]).toEqual({ modelId: 'amazon.nova-lite-v1:0', status: 'available' })
    expect(results[1]!.modelId).toBe('us.anthropic.claude-sonnet-5-5')
    expect(results[1]!.status).toBe('failed')
    expect(results[1]!.error).toContain('not authorized')
    expect(paths).toEqual([
      'bedrock.us-west-2.amazonaws.com/foundation-model-availability/amazon.nova-lite-v1%3A0',
      'bedrock.us-west-2.amazonaws.com/foundation-model-availability/anthropic.claude-sonnet-5-5',
    ])
  })

  test('refuses an empty list rather than reporting success for nothing', async () => {
    await expect(requestModelAccess([])).rejects.toThrow('No AI models to request access to')
  })
})
