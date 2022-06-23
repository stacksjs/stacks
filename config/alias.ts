/**
 * The following configuration references local aliases.
 *
 * TODO: the future "artisan setup"-command will set up these aliases.
 */

import { resolve } from 'path'

const r = (p: string) => resolve(__dirname, p)

export const alias: Record<string, string> = {
  '~': r('../'),
  '@ow3/hello-world-stacks': r('../components/index.ts'),
  '@ow3/hello-world-vue': r('../components/index.ts'),
  '@ow3/hello-world-elements': r('../.stacks/elements/index.ts'),
  '@ow3/hello-world-functions': r('../functions/index.ts'),
  '@ow3/stacks': r('./index.ts'),
}
