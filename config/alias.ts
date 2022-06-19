import { resolve } from 'path'

const r = (p: string) => resolve(__dirname, p)

/**
 * The following configuration references local aliases.
 */
export const alias: Record<string, string> = {
  '~': r('../packages'),
  '@ow3/hello-world-vue': r('../packages/components'),
  '@ow3/hello-world-elements': r('../packages/elements'),
  '@ow3/hello-world-composable': r('../packages/composables'),
  '@ow3/stacks': r('../.stacks'),
}
