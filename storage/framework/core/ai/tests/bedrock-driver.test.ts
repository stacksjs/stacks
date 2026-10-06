import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { bedrock, DEFAULT_BEDROCK_MODEL, toConverseMessages } from '../src/drivers/bedrock'
import { bedrockRegion } from '../src/utils/client-bedrock-runtime'

/**
 * The Bedrock driver end to end, down to the HTTP request ts-cloud sends.
 * Nothing in Stacks had ever reached Bedrock: the requests were signed for
 * the wrong service, and `ask()`/`summarize()` spoke Titan's retired format.
 */

const originalFetch = globalThis.fetch
const savedEnv = { ...process.env }

interface Sent { url: string, headers: Record<string, string>, body: any }

function converseReturns(output: Record<string, unknown>): Sent[] {
  const sent: Sent[] = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(input), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) })
    return Response.json({
      stopReason: 'end_turn',
      usage: { inputTokens: 12, outputTokens: 3, totalTokens: 15 },
      ...output,
    })
  }) as typeof fetch
  return sent
}

beforeEach(() => {
  process.env.AWS_ACCESS_KEY_ID = 'AKIDEXAMPLE'
  process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'
  delete process.env.AWS_SESSION_TOKEN
  delete process.env.AWS_REGION
  delete process.env.AWS_DEFAULT_REGION
  delete process.env.BEDROCK_MODEL_ID
  bedrock.configure({ model: undefined, region: undefined, maxTokens: undefined })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv))
      delete process.env[key]
  }
  Object.assign(process.env, savedEnv)
})

describe('the Bedrock driver', () => {
  test('sends a Converse request, signed for bedrock, to the configured model', async () => {
    const sent = converseReturns({ output: { message: { role: 'assistant', content: [{ text: 'Paris.' }] } } })

    const result = await bedrock.chat([{ role: 'user', content: 'Capital of France?' }], { maxTokens: 50, temperature: 0 })

    expect(sent[0]!.url).toBe(`https://bedrock-runtime.us-east-1.amazonaws.com/model/${encodeURIComponent(DEFAULT_BEDROCK_MODEL)}/converse`)
    expect(sent[0]!.headers.Authorization).toContain('/us-east-1/bedrock/aws4_request')
    expect(sent[0]!.body).toEqual({
      modelId: 'amazon.nova-lite-v1:0',
      messages: [{ role: 'user', content: [{ text: 'Capital of France?' }] }],
      inferenceConfig: { maxTokens: 50, temperature: 0 },
    })
    expect(result).toEqual({
      content: 'Paris.',
      model: 'amazon.nova-lite-v1:0',
      usage: { promptTokens: 12, completionTokens: 3, totalTokens: 15 },
      finishReason: 'end_turn',
    })
  })

  test('takes the model and region from configuration, then the environment', async () => {
    process.env.AWS_DEFAULT_REGION = 'eu-west-1'
    process.env.BEDROCK_MODEL_ID = 'eu.anthropic.claude-sonnet-5-5'
    let sent = converseReturns({ output: { message: { role: 'assistant', content: [{ text: 'ok' }] } } })
    await bedrock.chat([{ role: 'user', content: 'hi' }])
    expect(sent[0]!.url).toStartWith('https://bedrock-runtime.eu-west-1.amazonaws.com/model/eu.anthropic.claude-sonnet-5-5/')

    bedrock.configure({ model: 'global.anthropic.claude-sonnet-5-5', region: 'us-west-2' })
    sent = converseReturns({ output: { message: { role: 'assistant', content: [{ text: 'ok' }] } } })
    await bedrock.chat([{ role: 'user', content: 'hi' }])
    expect(sent[0]!.url).toStartWith('https://bedrock-runtime.us-west-2.amazonaws.com/model/global.anthropic.claude-sonnet-5-5/')
  })

  test('returns structured output from the forced tool call', async () => {
    const sent = converseReturns({
      stopReason: 'tool_use',
      output: { message: { role: 'assistant', content: [{ toolUse: { toolUseId: 't1', name: 'answer', input: { city: 'Paris' } } }] } },
    })
    const schema = { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] }

    const result = await bedrock.chat([{ role: 'user', content: 'Where is the Louvre?' }], {
      responseFormat: { type: 'json_schema', json_schema: { name: 'answer', schema } },
    })

    expect(JSON.parse(result.content)).toEqual({ city: 'Paris' })
    expect(sent[0]!.body.toolConfig).toEqual({
      tools: [{ toolSpec: { name: 'answer', description: 'Returns the result as JSON matching the \'answer\' schema.', inputSchema: { json: schema } } }],
      toolChoice: { tool: { name: 'answer' } },
    })
  })
})

describe('toConverseMessages', () => {
  test('moves system messages out of the turns and keys each block by its kind', () => {
    expect(toConverseMessages([
      { role: 'system', content: 'Be brief.' },
      { role: 'user', content: [
        { type: 'text', text: 'What is this?' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBOR' } },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j/4A' } },
      ] },
    ], 'You are helpful.')).toEqual({
      system: [{ text: 'You are helpful.' }, { text: 'Be brief.' }],
      messages: [{
        role: 'user',
        content: [
          { text: 'What is this?' },
          { image: { format: 'png', source: { bytes: 'iVBOR' } } },
          { image: { format: 'jpeg', source: { bytes: '/9j/4A' } } },
        ],
      }],
    })
  })

  test('refuses an image URL Converse cannot fetch, rather than dropping it', () => {
    expect(() => toConverseMessages([{
      role: 'user',
      content: [{ type: 'image_url', image_url: { url: 'https://example.com/cat.png' } }],
    }])).toThrow('Bedrock Converse takes image bytes, not a URL')
  })
})

describe('bedrockRegion', () => {
  test('prefers what is passed, then AWS_REGION, then AWS_DEFAULT_REGION', () => {
    expect(bedrockRegion()).toBe('us-east-1')
    process.env.AWS_DEFAULT_REGION = 'eu-central-1'
    expect(bedrockRegion()).toBe('eu-central-1')
    process.env.AWS_REGION = 'ap-southeast-2'
    expect(bedrockRegion()).toBe('ap-southeast-2')
    expect(bedrockRegion('us-west-2')).toBe('us-west-2')
  })
})

describe('ask() and summarize()', () => {
  test('go through Converse on the default model, not the retired Titan request format', async () => {
    const { ask, summarize } = await import('../src/text')
    const sent = converseReturns({ output: { message: { role: 'assistant', content: [{ text: 'A short summary.' }] } } })

    expect(await summarize('A long article.', { maxTokenCount: 64 })).toBe('A short summary.')
    expect(await ask('Why is the sky blue?')).toBe('A short summary.')

    expect(sent.map(request => request.body.modelId)).toEqual(['amazon.nova-lite-v1:0', 'amazon.nova-lite-v1:0'])
    expect(sent[0]!.body.messages).toEqual([{ role: 'user', content: [{ text: 'Summarize the following text: A long article.' }] }])
    expect(sent[0]!.body.inferenceConfig).toEqual({ maxTokens: 64, temperature: 0, topP: 0.9 })
    expect(sent[0]!.body.inputText).toBeUndefined()
  })

  test('report the provider\'s reason when the call fails', async () => {
    const { ask } = await import('../src/text')
    globalThis.fetch = (async () => Response.json(
      { message: 'This model version has reached the end of its life.' },
      { status: 404 },
    )) as unknown as typeof fetch

    await expect(ask('hi', { modelId: 'amazon.titan-text-express-v1' }))
      .rejects
      .toThrow('Error asking question: AWS API Error (404)')
  })
})
