/**
 * Amazon Bedrock model ids Bedrock currently serves, each in the form it is
 * invoked by.
 *
 * Claude and the newer Nova and Llama generations are served only through an
 * inference profile, so they are listed by profile id (`global.` or `us.`);
 * invoking the bare `anthropic.*` model id is refused. The on-demand ids below
 * are invocable as they are.
 *
 * Checked against `ListFoundationModels` and `ListInferenceProfiles` in
 * us-east-1 on 2026-10-06. Every Claude 3 id, the Titan Text models and the
 * Titan Image Generators this list used to carry had been retired, and
 * `anthropic.claude-haiku-4-20250514-v1:0` never existed.
 * `STACKS_BEDROCK_LIVE=1 bun test` re-checks the list against a live account.
 */
export const bedrockModels = [
  // Anthropic Claude (inference profiles)
  'global.anthropic.claude-opus-5-5',
  'global.anthropic.claude-sonnet-5-5',
  'global.anthropic.claude-haiku-4-5-20251001-v1:0',
  'us.anthropic.claude-opus-5-5',
  'us.anthropic.claude-sonnet-5-5',
  'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  // Amazon Nova
  'amazon.nova-micro-v1:0',
  'amazon.nova-lite-v1:0',
  'amazon.nova-pro-v1:0',
  'us.amazon.nova-premier-v1:0',
  'global.amazon.nova-2-lite-v1:0',
  // Amazon embeddings
  'amazon.titan-embed-text-v2:0',
  'amazon.titan-embed-text-v1',
  'amazon.titan-embed-image-v1',
  'amazon.nova-2-multimodal-embeddings-v1:0',
  // Meta Llama
  'meta.llama3-8b-instruct-v1:0',
  'meta.llama3-70b-instruct-v1:0',
  'us.meta.llama3-3-70b-instruct-v1:0',
  'us.meta.llama4-maverick-17b-instruct-v1:0',
  'us.meta.llama4-scout-17b-instruct-v1:0',
] as const

export type BedrockModel = typeof bedrockModels[number]

type AiModel =
  | BedrockModel
  // Any other model id, for Bedrock or a first-party provider
  | (string & {})

/**
 * **AI Options**
 *
 * This configuration defines all of your AI options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface AiOptions {
  default: 'anthropic' | 'openai' | 'ollama' | 'bedrock' | AiModel
  models: AiModel[]
  deploy: boolean
  drivers?: {
    anthropic?: {
      apiKey?: string
      model?: string
      maxTokens?: number
      anthropicVersion?: string
    }
    openai?: {
      apiKey?: string
      model?: string
      maxTokens?: number
      baseUrl?: string
      embeddingModel?: string
    }
    ollama?: {
      host?: string
      model?: string
      embeddingModel?: string
    }
    /**
     * Amazon Bedrock, through the Converse API. Credentials come from the AWS
     * credential chain (environment, shared profile, instance role).
     */
    bedrock?: {
      /** Defaults to `BEDROCK_MODEL_ID`, then `amazon.nova-lite-v1:0`. */
      model?: string
      /** Defaults to `AWS_REGION`, then `AWS_DEFAULT_REGION`, then `us-east-1`. */
      region?: string
      maxTokens?: number
    }
  }
}

export type AiConfig = Partial<AiOptions>
