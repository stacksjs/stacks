/**
 * The following configuration references local aliases.
 *
 * TODO: the future "artisan setup"-command will set up these aliases.
 */

import { resolve } from 'path'

const r = (p: string) => resolve(__dirname, p)

const alias: Record<string, string> = {
  '~/': r('../../..'),
  'stacks': r('./index.ts'),
  'functions': r('./functions'),
  'components': r('./components'),
  'config': r('./config.ts'),
}

export default alias
