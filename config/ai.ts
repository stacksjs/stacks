import type { AiConfig } from '@stacksjs/types'

/**
 * **AI Configuration**
 *
 * This configuration defines all of your AI options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  default: 'meta.llama2-70b-chat-v1',

  models: [
    // 'amazon.titan-embed-text-v1',
    // Supported use cases – Retrieval augmented generation, open-ended text generation, brainstorming, summarizations, code generation, table creation, data formatting, paraphrasing, chain of thought, rewrite, extraction, QnA, and chat
    'amazon.titan-text-express-v1',
    // Amazon Titan Text Lite is a light weight efficient model, ideal for fine-tuning of English-language tasks, including like summarizations and copy writing, where customers want a smaller, more cost-effective model that is also highly customizable
    'amazon.titan-text-lite-v1',
    // 'amazon.titan-embed-image-v1',
    // 'amazon.titan-image-generator-v1',
    // 'anthropic.claude-v1',
    // 'anthropic.claude-v2',
    // 'anthropic.claude-v2:1',
    // 'anthropic.claude-instant-v1',
    // 'meta.llama2-13b-chat-v1',
    'meta.llama2-70b-chat-v1',
  ],

  deploy: true, // deploys AI endpoints
} satisfies AiConfig
