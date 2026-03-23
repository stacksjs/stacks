type AiModel =
  // Amazon Titan
  | 'amazon.titan-embed-text-v1'
  | 'amazon.titan-embed-text-v2:0'
  | 'amazon.titan-text-lite-v1'
  | 'amazon.titan-text-express-v1'
  | 'amazon.titan-text-premier-v1:0'
  | 'amazon.titan-embed-image-v1'
  | 'amazon.titan-image-generator-v1'
  | 'amazon.titan-image-generator-v2:0'
  // Anthropic Claude (current models via Bedrock)
  | 'anthropic.claude-sonnet-4-20250514-v1:0'
  | 'anthropic.claude-haiku-4-20250514-v1:0'
  | 'anthropic.claude-3-5-sonnet-20241022-v2:0'
  | 'anthropic.claude-3-5-haiku-20241022-v1:0'
  | 'anthropic.claude-3-opus-20240229-v1:0'
  | 'anthropic.claude-3-sonnet-20240229-v1:0'
  | 'anthropic.claude-3-haiku-20240307-v1:0'
  // Meta Llama 3
  | 'meta.llama3-8b-instruct-v1:0'
  | 'meta.llama3-70b-instruct-v1:0'
  | 'meta.llama3-1-8b-instruct-v1:0'
  | 'meta.llama3-1-70b-instruct-v1:0'
  | 'meta.llama3-1-405b-instruct-v1:0'
  // Allow custom model strings
  | (string & {})

/**
 * **AI Options**
 *
 * This configuration defines all of your AI options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface AiOptions {
  default: AiModel
  models: AiModel[]
  deploy: boolean
}

export type AiConfig = Partial<AiOptions>
