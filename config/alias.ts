import { resolve } from 'path'

const r = (p: string) => resolve(__dirname, p)

/**
 * The following configuration references the local aliases.
 */
export const alias: Record<string, string> = {
  '@ow3/hello-world-vue': r('../packages/vue/src'),
  '@ow3/hello-world-elements': r('../packages/elements/src'),
  '@ow3/hello-world-composable': r('../packages/composables/src'),
  '@ow3/stacks-core': r('../packages/core/src'),
}
