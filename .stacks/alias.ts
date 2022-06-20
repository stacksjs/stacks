import { resolve } from 'path'

const r = (p: string) => resolve(__dirname, p)

/**
 * The following configuration references local aliases.
 *
 * TODO: the future "setup"-command needs to set these aliases.
 */
export const alias: Record<string, string> = {
  '~': r('../packages'),
  '@ow3/hello-world-vue': r('../packages/components/index.ts'),
  '@ow3/hello-world-elements': r('../packages/elements/index.ts'),
  '@ow3/hello-world-composable': r('../packages/composables/index.ts'),
  '@ow3/stacks': r('./index.ts'),
}
