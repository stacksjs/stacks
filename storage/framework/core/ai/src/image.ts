/**
 * AI Image Module
 *
 * Unified image generation and vision/analysis across multiple providers.
 * Supports OpenAI DALL-E, Anthropic Claude Vision, and Ollama multimodal models.
 */

import type { AIMessage, AIResult } from './types'
import { anthropicApiVersion } from './drivers/anthropic'
import { realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { storagePath } from '@stacksjs/path'
import { fetchPublicUrl } from '@stacksjs/security'
import { DEFAULT_ANTHROPIC_MODEL } from './models'

// ============================================================================
// Types
// ============================================================================

export interface ImageGenerationOptions {
  provider?: 'openai' | 'ollama'
  model?: string
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
  n?: number
  responseFormat?: 'url' | 'b64_json'
  style?: 'vivid' | 'natural'
}

export interface ImageGenerationResult {
  images: Array<{
    url?: string
    b64_json?: string
    revisedPrompt?: string
  }>
  provider: string
  model: string
}

export interface VisionOptions {
  provider?: 'anthropic' | 'openai' | 'ollama'
  model?: string
  maxTokens?: number
  temperature?: number
  detail?: 'auto' | 'low' | 'high'
  /**
   * How `{ type: 'url' }` images are fetched. Image URLs often come from users, so they are
   * fetched through `fetchPublicUrl`: https only, no private or local addresses (re-checked on
   * every redirect), at most 3 redirects, and a size cap. Loosen only for trusted sources.
   */
  fetch?: { allowHttp?: boolean, allowPrivate?: boolean, maxBytes?: number }
  /**
   * Directories `{ type: 'file' }` images may be read from. A path that resolves outside all of
   * them (including through a symlink) is refused, so a caller-supplied path cannot read the
   * app's secrets and send them to a model provider. Defaults to the app's storage directory.
   */
  fileRoots?: string[]
}

/** Largest image fetched for vision input, matching the providers' own request limits. */
const DEFAULT_MAX_IMAGE_BYTES = 20 * 1024 * 1024

export interface VisionResult extends AIResult {
  provider: string
}

export type ImageInput =
  | { type: 'url'; url: string }
  | { type: 'base64'; data: string; mediaType: string }
  | { type: 'file'; path: string }

// ============================================================================
// Image Generation
// ============================================================================

/**
 * Generate images from a text prompt.
 * Currently supports OpenAI DALL-E models.
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions = {},
): Promise<ImageGenerationResult> {
  const {
    provider = 'openai',
    model = 'dall-e-3',
    size = '1024x1024',
    quality = 'standard',
    n = 1,
    responseFormat = 'url',
    style = 'vivid',
  } = options

  if (provider === 'openai') {
    return generateImageOpenAI(prompt, { model, size, quality, n, responseFormat, style })
  }

  throw new Error(`Image generation not supported for provider: ${provider}. Use 'openai'.`)
}

async function generateImageOpenAI(
  prompt: string,
  options: {
    model: string
    size: string
    quality: string
    n: number
    responseFormat: string
    style: string
  },
): Promise<ImageGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for image generation.')
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      prompt,
      size: options.size,
      quality: options.quality,
      n: options.n,
      response_format: options.responseFormat,
      style: options.style,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI Image API error: ${error}`)
  }

  const data = (await response.json()) as {
    data: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>
  }

  return {
    images: data.data.map(img => ({
      url: img.url,
      b64_json: img.b64_json,
      revisedPrompt: img.revised_prompt,
    })),
    provider: 'openai',
    model: options.model,
  }
}

// ============================================================================
// Image Editing
// ============================================================================

export interface ImageEditOptions {
  mask?: Blob | File
  model?: 'dall-e-2'
  n?: number
  size?: '256x256' | '512x512' | '1024x1024'
  responseFormat?: 'url' | 'b64_json'
}

/**
 * Edit an existing image with a text prompt (OpenAI DALL-E 2).
 */
export async function editImage(
  image: Blob | File,
  prompt: string,
  options: ImageEditOptions = {},
): Promise<ImageGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for image editing.')
  }

  const formData = new FormData()
  formData.append('image', image)
  formData.append('prompt', prompt)
  formData.append('model', options.model || 'dall-e-2')
  if (options.mask) formData.append('mask', options.mask)
  if (options.n) formData.append('n', String(options.n))
  if (options.size) formData.append('size', options.size)
  if (options.responseFormat) formData.append('response_format', options.responseFormat)

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI Image Edit API error: ${error}`)
  }

  const data = (await response.json()) as {
    data: Array<{ url?: string; b64_json?: string }>
  }

  return {
    images: data.data.map(img => ({
      url: img.url,
      b64_json: img.b64_json,
    })),
    provider: 'openai',
    model: options.model || 'dall-e-2',
  }
}

// ============================================================================
// Image Variations
// ============================================================================

/**
 * Create variations of an existing image (OpenAI DALL-E 2).
 */
export async function createImageVariation(
  image: Blob | File,
  options: {
    model?: 'dall-e-2'
    n?: number
    size?: '256x256' | '512x512' | '1024x1024'
    responseFormat?: 'url' | 'b64_json'
  } = {},
): Promise<ImageGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for image variations.')
  }

  const formData = new FormData()
  formData.append('image', image)
  formData.append('model', options.model || 'dall-e-2')
  if (options.n) formData.append('n', String(options.n))
  if (options.size) formData.append('size', options.size)
  if (options.responseFormat) formData.append('response_format', options.responseFormat)

  const response = await fetch('https://api.openai.com/v1/images/variations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI Image Variations API error: ${error}`)
  }

  const data = (await response.json()) as {
    data: Array<{ url?: string; b64_json?: string }>
  }

  return {
    images: data.data.map(img => ({
      url: img.url,
      b64_json: img.b64_json,
    })),
    provider: 'openai',
    model: options.model || 'dall-e-2',
  }
}

// ============================================================================
// Vision / Image Analysis
// ============================================================================

/**
 * Analyze an image using AI vision capabilities.
 * Supports Anthropic Claude, OpenAI GPT-4V, and Ollama multimodal models.
 */
export async function analyzeImage(
  imageInput: ImageInput,
  prompt: string,
  options: VisionOptions = {},
): Promise<VisionResult> {
  const { provider = 'anthropic' } = options

  switch (provider) {
    case 'anthropic':
      return analyzeImageAnthropic(imageInput, prompt, options)
    case 'openai':
      return analyzeImageOpenAI(imageInput, prompt, options)
    case 'ollama':
      return analyzeImageOllama(imageInput, prompt, options)
    default:
      throw new Error(`Vision not supported for provider: ${provider}`)
  }
}

async function resolveImageToBase64(input: ImageInput, options: VisionOptions = {}): Promise<{ data: string; mediaType: string }> {
  if (input.type === 'base64') {
    return { data: input.data, mediaType: input.mediaType }
  }

  if (input.type === 'url') {
    const maxBytes = options.fetch?.maxBytes ?? DEFAULT_MAX_IMAGE_BYTES
    const response = await fetchPublicUrl(input.url, {}, {
      allowHttp: options.fetch?.allowHttp,
      allowPrivate: options.fetch?.allowPrivate,
      maxBytes,
    })
    if (!response.ok) throw new Error(`Failed to fetch image from URL: ${input.url}`)
    const contentType = (response.headers.get('content-type') || '').split(';')[0]!.trim().toLowerCase()
    if (!contentType.startsWith('image/'))
      throw new Error(`Refusing image URL that returned ${contentType || 'no content type'}: ${input.url}`)
    const buffer = await response.arrayBuffer()
    return { data: Buffer.from(buffer).toString('base64'), mediaType: contentType }
  }

  if (input.type === 'file') {
    const { readFile } = await import('node:fs/promises')
    const path = await resolveAllowedImagePath(input.path, options.fileRoots ?? [storagePath()])
    const buffer = await readFile(path)
    const base64 = buffer.toString('base64')
    const ext = path.split('.').pop()?.toLowerCase() || 'png'
    const mediaTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
    }
    return { data: base64, mediaType: mediaTypes[ext] || 'image/png' }
  }

  throw new Error('Invalid image input type')
}

/**
 * Resolve an image file path and require its real location to sit inside one of `roots`.
 * Exported for tests.
 */
export async function resolveAllowedImagePath(path: string, roots: string[]): Promise<string> {
  const real = await realpath(resolve(path))
  for (const root of roots) {
    const realRoot = await realpath(resolve(root)).catch(() => null)
    if (!realRoot) continue
    const rel = relative(realRoot, real)
    if (rel !== '' && !rel.startsWith('..') && !isAbsolute(rel))
      return real
  }
  throw new Error(`Refusing image file outside the allowed directories: ${path}`)
}

async function analyzeImageAnthropic(
  imageInput: ImageInput,
  prompt: string,
  options: VisionOptions,
): Promise<VisionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required for Claude vision.')
  }

  const { data, mediaType } = await resolveImageToBase64(imageInput, options)
  const model = options.model || DEFAULT_ANTHROPIC_MODEL
  const maxTokens = options.maxTokens || 4096

  const messages: AIMessage[] = [{
    role: 'user',
    content: [
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data },
      },
      { type: 'text', text: prompt },
    ],
  }]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': anthropicApiVersion(),
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: options.temperature,
      messages,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude Vision API error: ${error}`)
  }

  const responseData = (await response.json())

  return {
    content: responseData.content[0].text,
    model: responseData.model,
    provider: 'anthropic',
    usage: {
      promptTokens: responseData.usage?.input_tokens || 0,
      completionTokens: responseData.usage?.output_tokens || 0,
      totalTokens: (responseData.usage?.input_tokens || 0) + (responseData.usage?.output_tokens || 0),
    },
    finishReason: responseData.stop_reason,
  }
}

async function analyzeImageOpenAI(
  imageInput: ImageInput,
  prompt: string,
  options: VisionOptions,
): Promise<VisionResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for GPT-4 vision.')
  }

  const model = options.model || 'gpt-4o'
  const maxTokens = options.maxTokens || 4096
  const detail = options.detail || 'auto'

  let imageContent: any
  if (imageInput.type === 'url') {
    imageContent = { type: 'image_url', image_url: { url: imageInput.url, detail } }
  }
  else {
    const { data, mediaType } = await resolveImageToBase64(imageInput, options)
    imageContent = {
      type: 'image_url',
      image_url: { url: `data:${mediaType};base64,${data}`, detail },
    }
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: options.temperature,
      messages: [{
        role: 'user',
        content: [
          imageContent,
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI Vision API error: ${error}`)
  }

  const responseData = (await response.json())

  return {
    content: responseData.choices[0].message.content,
    model: responseData.model,
    provider: 'openai',
    usage: {
      promptTokens: responseData.usage?.prompt_tokens || 0,
      completionTokens: responseData.usage?.completion_tokens || 0,
      totalTokens: responseData.usage?.total_tokens || 0,
    },
    finishReason: responseData.choices[0].finish_reason,
  }
}

async function analyzeImageOllama(
  imageInput: ImageInput,
  prompt: string,
  options: VisionOptions,
): Promise<VisionResult> {
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434'
  const model = options.model || 'llava'

  const { data } = await resolveImageToBase64(imageInput, options)

  const response = await fetch(`${host}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      images: [data],
      stream: false,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama Vision API error: ${error}`)
  }

  const responseData = (await response.json())

  return {
    content: responseData.response,
    model: responseData.model,
    provider: 'ollama',
    usage: {
      promptTokens: responseData.prompt_eval_count || 0,
      completionTokens: responseData.eval_count || 0,
      totalTokens: (responseData.prompt_eval_count || 0) + (responseData.eval_count || 0),
    },
  }
}

// ============================================================================
// Multi-image Analysis
// ============================================================================

/**
 * Analyze multiple images together with a prompt.
 * Useful for comparison, batch analysis, etc.
 */
export async function analyzeImages(
  images: ImageInput[],
  prompt: string,
  options: VisionOptions = {},
): Promise<VisionResult> {
  const { provider = 'anthropic' } = options

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY required for multi-image analysis.')

    const model = options.model || DEFAULT_ANTHROPIC_MODEL
    const contentBlocks: any[] = []

    for (const img of images) {
      const { data, mediaType } = await resolveImageToBase64(img, options)
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data },
      })
    }
    contentBlocks.push({ type: 'text', text: prompt })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': anthropicApiVersion(),
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature,
        messages: [{ role: 'user', content: contentBlocks }],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Claude Vision API error: ${error}`)
    }

    const responseData = (await response.json())
    return {
      content: responseData.content[0].text,
      model: responseData.model,
      provider: 'anthropic',
      usage: {
        promptTokens: responseData.usage?.input_tokens || 0,
        completionTokens: responseData.usage?.output_tokens || 0,
        totalTokens: (responseData.usage?.input_tokens || 0) + (responseData.usage?.output_tokens || 0),
      },
      finishReason: responseData.stop_reason,
    }
  }

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY required for multi-image analysis.')

    const model = options.model || 'gpt-4o'
    const detail = options.detail || 'auto'
    const contentBlocks: any[] = []

    for (const img of images) {
      if (img.type === 'url') {
        contentBlocks.push({ type: 'image_url', image_url: { url: img.url, detail } })
      }
      else {
        const { data, mediaType } = await resolveImageToBase64(img, options)
        contentBlocks.push({
          type: 'image_url',
          image_url: { url: `data:${mediaType};base64,${data}`, detail },
        })
      }
    }
    contentBlocks.push({ type: 'text', text: prompt })

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature,
        messages: [{ role: 'user', content: contentBlocks }],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI Vision API error: ${error}`)
    }

    const responseData = (await response.json())
    return {
      content: responseData.choices[0].message.content,
      model: responseData.model,
      provider: 'openai',
      usage: {
        promptTokens: responseData.usage?.prompt_tokens || 0,
        completionTokens: responseData.usage?.completion_tokens || 0,
        totalTokens: responseData.usage?.total_tokens || 0,
      },
      finishReason: responseData.choices[0].finish_reason,
    }
  }

  throw new Error(`Multi-image analysis not supported for provider: ${provider}`)
}

// ============================================================================
// Exports
// ============================================================================

export const image = {
  generate: generateImage,
  edit: editImage,
  variation: createImageVariation,
  analyze: analyzeImage,
  analyzeMultiple: analyzeImages,
}
