import type { AiConfig } from '@stacksjs/types'

/**
 * **AI Configuration**
 *
 * This configuration defines all of your AI options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  default: 'openai',

  // Amazon Bedrock models this app uses. `buddy` requests access to each of
  // them; see `bedrockModels` in @stacksjs/types for the ids Bedrock serves.
  models: [
    // Amazon Nova Lite: the default for `ai.ask()`, `ai.summarize()` and the
    // `bedrock` driver, invocable on demand
    'amazon.nova-lite-v1:0',
    // Text embeddings for retrieval
    'amazon.titan-embed-text-v2:0',
    // Claude through its global inference profile
    // 'global.anthropic.claude-sonnet-5-5',
  ],

  deploy: true, // deploys AI endpoints
} satisfies AiConfig
