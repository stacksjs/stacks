/**
 * The following configuration references local aliases.
 *
 * TODO: the future "artisan setup"-command will set up these aliases.
 */

import { resolve } from 'path'

const r = (p: string) => resolve(__dirname, p)

const alias: Record<string, string> = {
  'stacks': r('../.stacks/index.ts'),
  '~/functions': r('../functions/index.ts'),
  'functions': r('../functions/index.ts'),
  'components': r('../components/index.ts'),
  'config': r('../config/index.ts'),
  // '@ow3/hello-world-stack': r('../components/src/index.ts'),
  // '@ow3/hello-world-vue': r('../components/src/index.ts'),
  // '@ow3/hello-world-elements': r('../.stacks/elements/index.ts'),
  // '@ow3/hello-world-functions': r('../functions/src/index.ts'),
}

export default alias
