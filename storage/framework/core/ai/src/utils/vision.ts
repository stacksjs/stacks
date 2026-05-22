/**
 * Vision message normalization (stacksjs/stacks#1878 A-3).
 *
 * Background: `AIMessage.content` already accepts a content-array
 * with `{ type: 'image_url' }` or `{ type: 'image', source: {...} }`
 * blocks. Both OpenAI and Anthropic accept image inputs but via
 * different wire shapes:
 *
 *   - **OpenAI** — content array with `{ type: 'image_url', image_url: { url, detail } }`
 *     where `url` is either an https URL or a base64 data URI.
 *   - **Anthropic** — content array with `{ type: 'image', source: { type: 'base64', media_type, data } }`
 *     for base64 OR `{ type: 'image', source: { type: 'url', url } }` for URL form (Claude 3.5+).
 *
 * Driver users shouldn't have to know which wire format each
 * provider wants. These helpers translate between the two so an
 * app that switches between OpenAI and Anthropic doesn't have to
 * rewrite its message construction.
 */

import type { AIMessage, AIMessageContent } from '../types'

/**
 * Normalize a message-content block for the OpenAI wire format.
 * Pass-through for `image_url` blocks; converts Anthropic-style
 * `{ type: 'image', source: {...} }` to OpenAI's `image_url` shape.
 */
function toOpenAIContent(block: AIMessageContent): unknown {
  if (block.type === 'text') return { type: 'text', text: block.text ?? '' }
  if (block.type === 'image_url') return { type: 'image_url', image_url: block.image_url }
  if (block.type === 'image' && block.source) {
    if (block.source.type === 'base64') {
      const dataUri = `data:${block.source.media_type};base64,${block.source.data}`
      return { type: 'image_url', image_url: { url: dataUri } }
    }
  }
  // Unknown block type — pass through and let the API surface the error.
  return block
}

/**
 * Normalize a message-content block for the Anthropic wire format.
 * Pass-through for `image` blocks; converts OpenAI-style `image_url`
 * (either https URL or data URI) into Anthropic's `image` source shape.
 */
function toAnthropicContent(block: AIMessageContent): unknown {
  if (block.type === 'text') return { type: 'text', text: block.text ?? '' }
  if (block.type === 'image' && block.source)
    return { type: 'image', source: block.source }
  if (block.type === 'image_url' && block.image_url) {
    const url = block.image_url.url
    // data: URIs unwrap to Anthropic's base64 source shape.
    const dataMatch = url.match(/^data:([^;]+);base64,(.+)$/)
    if (dataMatch) {
      return {
        type: 'image',
        source: { type: 'base64', media_type: dataMatch[1]!, data: dataMatch[2]! },
      }
    }
    // Non-data URL — pass through as the url source variant (Claude 3.5+).
    return { type: 'image', source: { type: 'url', url } }
  }
  return block
}

/**
 * Normalize an entire `messages` array for the requested provider.
 * Messages whose `content` is a plain string pass through unchanged.
 * Messages with a content array get each block translated.
 */
export function normalizeMessagesForProvider(
  messages: AIMessage[],
  provider: 'openai' | 'anthropic',
): AIMessage[] {
  return messages.map((msg) => {
    if (typeof msg.content === 'string') return msg
    const mapper = provider === 'openai' ? toOpenAIContent : toAnthropicContent
    return {
      role: msg.role,
      content: msg.content.map(mapper) as AIMessageContent[],
    }
  })
}

/**
 * Convenience: convert a single command + optional image inputs into
 * an `AIMessage` content array suitable for `chat()` calls. Used by
 * the higher-level `text()` / `chat()` helpers when a user passes
 * `{ command, images }` together.
 *
 * @example
 * ```ts
 * const content = buildMessageWithImages('What is in this image?', [
 *   { url: 'https://example.com/cat.jpg' },
 * ])
 * await chat([{ role: 'user', content }])
 * ```
 */
export function buildMessageWithImages(
  command: string,
  images: Array<{ url?: string, dataBase64?: string, mediaType?: string, detail?: 'auto' | 'low' | 'high' }>,
): AIMessageContent[] {
  const blocks: AIMessageContent[] = []
  for (const img of images) {
    if (img.dataBase64 && img.mediaType) {
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType, data: img.dataBase64 },
      })
    }
    else if (img.url) {
      blocks.push({
        type: 'image_url',
        image_url: { url: img.url, detail: img.detail },
      })
    }
  }
  blocks.push({ type: 'text', text: command })
  return blocks
}
