/**
 * The following configuration references local aliases.
 *
 * TODO: the future "artisan setup"-command will set up these aliases.
 */

import { resolve } from 'path'

const r = (p: string) => resolve(__dirname, p)

const alias: Record<string, string> = {
  stacks: r('./index.ts'),
  functions: r('../../functions/index.ts'),
  components: r('../../components/index.ts'),
  config: r('../config/index.ts'),
}

export default alias
