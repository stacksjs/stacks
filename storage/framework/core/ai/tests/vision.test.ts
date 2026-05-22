import { describe, expect, test } from 'bun:test'
import { buildMessageWithImages, normalizeMessagesForProvider } from '../src/utils/vision'

// stacksjs/stacks#1878 A-3 — pins the cross-driver vision shape
// translation. Each provider has a different wire format; the
// normalizer converts between them so apps don't have to.

describe('normalizeMessagesForProvider (#1878 A-3)', () => {
  test('passes string-content messages through unchanged', () => {
    const msgs = [
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'hi' },
    ]
    expect(normalizeMessagesForProvider(msgs, 'openai')).toEqual(msgs)
    expect(normalizeMessagesForProvider(msgs, 'anthropic')).toEqual(msgs)
  })

  test('OpenAI: image_url passthrough', () => {
    const out = normalizeMessagesForProvider([{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'https://example.com/a.jpg' } },
        { type: 'text', text: 'describe' },
      ],
    }], 'openai')

    expect(out[0]!.content).toEqual([
      { type: 'image_url', image_url: { url: 'https://example.com/a.jpg' } },
      { type: 'text', text: 'describe' },
    ] as any)
  })

  test('OpenAI: Anthropic base64 → data URI', () => {
    const out = normalizeMessagesForProvider([{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KG' } },
        { type: 'text', text: 'what' },
      ],
    }], 'openai')

    expect(out[0]!.content).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KG' } },
      { type: 'text', text: 'what' },
    ] as any)
  })

  test('Anthropic: data URI → base64 source', () => {
    const out = normalizeMessagesForProvider([{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,XYZ==' } },
        { type: 'text', text: 'identify' },
      ],
    }], 'anthropic')

    expect(out[0]!.content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'XYZ==' } },
      { type: 'text', text: 'identify' },
    ] as any)
  })

  test('Anthropic: https URL → url source', () => {
    const out = normalizeMessagesForProvider([{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'https://example.com/a.jpg' } },
      ],
    }], 'anthropic')

    expect(out[0]!.content).toEqual([
      { type: 'image', source: { type: 'url', url: 'https://example.com/a.jpg' } },
    ] as any)
  })

  test('Anthropic: image with source passthrough', () => {
    const out = normalizeMessagesForProvider([{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'ABC' } },
      ],
    }], 'anthropic')

    expect(out[0]!.content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'ABC' } },
    ] as any)
  })
})

describe('buildMessageWithImages (#1878 A-3)', () => {
  test('combines URL images with command text', () => {
    const content = buildMessageWithImages('what is in this?', [
      { url: 'https://example.com/cat.jpg', detail: 'high' },
    ])
    expect(content).toEqual([
      { type: 'image_url', image_url: { url: 'https://example.com/cat.jpg', detail: 'high' } },
      { type: 'text', text: 'what is in this?' },
    ])
  })

  test('combines base64 images with command text', () => {
    const content = buildMessageWithImages('analyze', [
      { dataBase64: 'iVBORw', mediaType: 'image/png' },
    ])
    expect(content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw' } },
      { type: 'text', text: 'analyze' },
    ])
  })

  test('mixes URL + base64 images', () => {
    const content = buildMessageWithImages('compare', [
      { url: 'https://a.com/1.jpg' },
      { dataBase64: 'AAA', mediaType: 'image/png' },
    ])
    expect(content).toHaveLength(3)
    expect((content[0] as { type: string }).type).toBe('image_url')
    expect((content[1] as { type: string }).type).toBe('image')
    expect((content[2] as { type: string }).type).toBe('text')
  })

  test('text-only command with empty images returns just the text block', () => {
    const content = buildMessageWithImages('just text', [])
    expect(content).toEqual([{ type: 'text', text: 'just text' }])
  })
})
