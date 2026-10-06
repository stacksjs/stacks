import { describe, expect, test } from 'bun:test'
import { formatModelAccess } from '../src/commands/ai-access'

describe('buddy ai:access', () => {
  test('prints one aligned line per model and fails when any model failed', () => {
    const { output, ok } = formatModelAccess([
      { modelId: 'amazon.nova-lite-v1:0', status: 'available' },
      { modelId: 'global.anthropic.claude-sonnet-5-5', status: 'requested' },
      { modelId: 'meta.llama3-70b-instruct-v1:0', status: 'failed', error: 'This account is not entitled to it' },
    ])

    expect(output).toBe([
      'amazon.nova-lite-v1:0               available',
      'global.anthropic.claude-sonnet-5-5  requested (Bedrock is processing the agreement)',
      'meta.llama3-70b-instruct-v1:0       failed: This account is not entitled to it',
      '',
    ].join('\n'))
    expect(ok).toBe(false)
  })

  test('succeeds when every model is available or requested', () => {
    expect(formatModelAccess([{ modelId: 'amazon.nova-lite-v1:0', status: 'available' }]).ok).toBe(true)
  })
})
