/**
 * The following configuration references local aliases.
 *
 * TODO: the future "artisan setup"-command will set up these aliases.
 */

import { resolve } from 'path'

const r = (p: string) => resolve(__dirname, p)

const alias: Record<string, string> = {
  '~/stacks': r('../.stacks/src/index.ts'),
  '~/functions': r('../functions/index.ts'),
  '~/config': r('../config/index.ts'),
  '@ow3/hello-world-stack': r('../components/index.ts'),
  '@ow3/hello-world-vue': r('../components/index.ts'),
  '@ow3/hello-world-elements': r('../.stacks/elements/index.ts'),
  '@ow3/hello-world-functions': r('../functions/index.ts'),
}

export default alias
