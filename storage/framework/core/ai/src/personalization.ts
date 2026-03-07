/**
 * AI Personalization Module
 *
 * Provides AI-powered personalization features including content recommendations,
 * user profiling, sentiment analysis, content classification, and summarization.
 */

import type { AIResult } from './types'

// ============================================================================
// Types
// ============================================================================

export interface UserProfile {
  id: string
  preferences: Record<string, number>
  interactions: Interaction[]
  segments: string[]
  metadata?: Record<string, unknown>
}

export interface Interaction {
  type: 'view' | 'click' | 'purchase' | 'like' | 'dislike' | 'share' | 'bookmark' | 'custom'
  itemId: string
  timestamp: number
  weight?: number
  metadata?: Record<string, unknown>
}

export interface ContentItem {
  id: string
  content: string
  category?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface RecommendationOptions {
  provider?: 'anthropic' | 'openai' | 'ollama'
  model?: string
  maxTokens?: number
  temperature?: number
  limit?: number
}

export interface RecommendationResult {
  recommendations: Array<{
    itemId: string
    score: number
    reason: string
  }>
  model: string
  provider: string
}

export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  score: number
  confidence: number
  aspects?: Array<{
    aspect: string
    sentiment: 'positive' | 'negative' | 'neutral'
    score: number
  }>
}

export interface ClassificationResult {
  label: string
  confidence: number
  allLabels: Array<{
    label: string
    confidence: number
  }>
}

export interface SummaryOptions {
  provider?: 'anthropic' | 'openai' | 'ollama'
  model?: string
  maxLength?: number
  style?: 'concise' | 'detailed' | 'bullet-points'
  language?: string
}

// ============================================================================
// Sentiment Analysis
// ============================================================================

/**
 * Analyze the sentiment of text using AI.
 */
export async function analyzeSentiment(
  text: string,
  options: {
    provider?: 'anthropic' | 'openai' | 'ollama'
    model?: string
    aspects?: string[]
  } = {},
): Promise<SentimentResult> {
  const { provider = 'anthropic', aspects } = options

  const aspectInstruction = aspects
    ? `\nAlso analyze sentiment for these specific aspects: ${aspects.join(', ')}`
    : ''

  const systemPrompt = `You are a sentiment analysis expert. Analyze the sentiment of the given text and respond with ONLY valid JSON in this exact format:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "score": <number from -1.0 to 1.0>,
  "confidence": <number from 0.0 to 1.0>${aspects ? `,
  "aspects": [{"aspect": "<name>", "sentiment": "positive" | "negative" | "neutral", "score": <number>}]` : ''}
}${aspectInstruction}`

  const result = await callProvider(provider, systemPrompt, text, options.model)

  try {
    return JSON.parse(result.content) as SentimentResult
  }
  catch {
    // Fallback: extract sentiment from text response
    const lower = result.content.toLowerCase()
    const isPositive = lower.includes('positive')
    const isNegative = lower.includes('negative')
    return {
      sentiment: isPositive && isNegative ? 'mixed' : isPositive ? 'positive' : isNegative ? 'negative' : 'neutral',
      score: isPositive ? 0.5 : isNegative ? -0.5 : 0,
      confidence: 0.5,
    }
  }
}

// ============================================================================
// Text Classification
// ============================================================================

/**
 * Classify text into one of the provided labels.
 */
export async function classifyText(
  text: string,
  labels: string[],
  options: {
    provider?: 'anthropic' | 'openai' | 'ollama'
    model?: string
    multiLabel?: boolean
  } = {},
): Promise<ClassificationResult> {
  const { provider = 'anthropic', multiLabel = false } = options

  const systemPrompt = `You are a text classification expert. Classify the given text into ${multiLabel ? 'one or more of' : 'exactly one of'} these categories: ${labels.join(', ')}.

Respond with ONLY valid JSON in this exact format:
{
  "label": "<primary label>",
  "confidence": <number from 0.0 to 1.0>,
  "allLabels": [{"label": "<label>", "confidence": <number>}]
}

Include ALL provided labels in allLabels with their confidence scores, sorted by confidence descending.`

  const result = await callProvider(provider, systemPrompt, text, options.model)

  try {
    return JSON.parse(result.content) as ClassificationResult
  }
  catch {
    return {
      label: labels[0],
      confidence: 0.5,
      allLabels: labels.map(l => ({ label: l, confidence: 1 / labels.length })),
    }
  }
}

// ============================================================================
// Smart Summarization
// ============================================================================

/**
 * Generate an intelligent summary of text.
 */
export async function summarize(
  text: string,
  options: SummaryOptions = {},
): Promise<AIResult> {
  const {
    provider = 'anthropic',
    style = 'concise',
    maxLength,
    language,
  } = options

  let styleInstruction: string
  switch (style) {
    case 'bullet-points':
      styleInstruction = 'Use bullet points to organize the key points.'
      break
    case 'detailed':
      styleInstruction = 'Provide a detailed summary covering all major points.'
      break
    default:
      styleInstruction = 'Be concise and focus on the most important points.'
  }

  const lengthInstruction = maxLength ? ` Keep the summary under ${maxLength} words.` : ''
  const languageInstruction = language ? ` Write the summary in ${language}.` : ''

  const systemPrompt = `You are an expert summarizer. ${styleInstruction}${lengthInstruction}${languageInstruction}`

  return callProvider(provider, systemPrompt, `Summarize the following text:\n\n${text}`, options.model)
}

// ============================================================================
// Content Recommendations
// ============================================================================

/**
 * Generate personalized content recommendations based on user profile and available items.
 */
export async function recommend(
  profile: UserProfile,
  items: ContentItem[],
  options: RecommendationOptions = {},
): Promise<RecommendationResult> {
  const { provider = 'anthropic', limit = 5 } = options

  const profileSummary = buildProfileSummary(profile)
  const itemsList = items.map(item =>
    `ID: ${item.id} | Category: ${item.category || 'none'} | Tags: ${item.tags?.join(', ') || 'none'} | Content: ${item.content.slice(0, 200)}`,
  ).join('\n')

  const systemPrompt = `You are a recommendation engine. Based on the user profile, recommend the most relevant items. Respond with ONLY valid JSON:
{
  "recommendations": [
    {"itemId": "<id>", "score": <0.0-1.0>, "reason": "<brief reason>"}
  ]
}

Return at most ${limit} recommendations, sorted by relevance score descending.`

  const prompt = `User Profile:\n${profileSummary}\n\nAvailable Items:\n${itemsList}`
  const result = await callProvider(provider, systemPrompt, prompt, options.model)

  try {
    const parsed = JSON.parse(result.content) as { recommendations: Array<{ itemId: string; score: number; reason: string }> }
    return {
      recommendations: parsed.recommendations.slice(0, limit),
      model: result.model,
      provider: provider,
    }
  }
  catch {
    return {
      recommendations: [],
      model: result.model,
      provider: provider,
    }
  }
}

function buildProfileSummary(profile: UserProfile): string {
  const topPreferences = Object.entries(profile.preferences)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([key, value]) => `${key}: ${value.toFixed(2)}`)
    .join(', ')

  const recentInteractions = profile.interactions
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
    .map(i => `${i.type} on ${i.itemId}`)
    .join(', ')

  return `Segments: ${profile.segments.join(', ')}
Top Preferences: ${topPreferences || 'none'}
Recent Interactions: ${recentInteractions || 'none'}`
}

// ============================================================================
// User Profile Building
// ============================================================================

/**
 * Create a new empty user profile.
 */
export function createProfile(id: string, segments: string[] = []): UserProfile {
  return {
    id,
    preferences: {},
    interactions: [],
    segments,
  }
}

/**
 * Record a user interaction and update preferences.
 */
export function recordInteraction(profile: UserProfile, interaction: Interaction): UserProfile {
  profile.interactions.push(interaction)

  // Update preference weights based on interaction type
  const weights: Record<string, number> = {
    view: 0.1,
    click: 0.3,
    like: 0.5,
    share: 0.6,
    bookmark: 0.7,
    purchase: 1.0,
    dislike: -0.5,
    custom: interaction.weight || 0.3,
  }

  const weight = weights[interaction.type] || 0.1
  const key = interaction.itemId
  profile.preferences[key] = (profile.preferences[key] || 0) + weight

  return profile
}

/**
 * Extract keywords/topics from user interactions using AI.
 */
export async function extractUserInterests(
  profile: UserProfile,
  items: ContentItem[],
  options: { provider?: 'anthropic' | 'openai' | 'ollama'; model?: string } = {},
): Promise<string[]> {
  const { provider = 'anthropic' } = options

  const interactedItemIds = new Set(profile.interactions.map(i => i.itemId))
  const interactedItems = items.filter(item => interactedItemIds.has(item.id))

  if (interactedItems.length === 0) return profile.segments

  const contentSample = interactedItems
    .slice(0, 20)
    .map(item => item.content.slice(0, 200))
    .join('\n---\n')

  const systemPrompt = `Extract the main interests/topics from the user's interaction history. Return ONLY a JSON array of strings, e.g. ["technology", "cooking", "travel"]. Maximum 10 interests.`

  const result = await callProvider(provider, systemPrompt, contentSample, options.model)

  try {
    return JSON.parse(result.content) as string[]
  }
  catch {
    return profile.segments
  }
}

// ============================================================================
// Provider Helper
// ============================================================================

async function callProvider(
  provider: string,
  systemPrompt: string,
  userMessage: string,
  model?: string,
): Promise<AIResult> {
  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY required.')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Claude API error: ${error}`)
    }

    const data = (await response.json()) as any
    return {
      content: data.content[0].text,
      model: data.model,
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      finishReason: data.stop_reason,
    }
  }

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY required.')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        max_tokens: 4096,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    const data = (await response.json()) as any
    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      finishReason: data.choices[0].finish_reason,
    }
  }

  if (provider === 'ollama') {
    const host = process.env.OLLAMA_HOST || 'http://localhost:11434'

    const response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3.2',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ollama API error: ${error}`)
    }

    const data = (await response.json()) as any
    return {
      content: data.message.content,
      model: data.model,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      finishReason: data.done_reason || 'stop',
    }
  }

  throw new Error(`Provider not supported: ${provider}`)
}

// ============================================================================
// Exports
// ============================================================================

export const personalization = {
  analyzeSentiment,
  classifyText,
  summarize,
  recommend,
  createProfile,
  recordInteraction,
  extractUserInterests,
}
