/**
 * The following configuration references local aliases.
 */

import { resolve } from 'pathe'
import { _dirname } from './utils'

const r = (p: string) => resolve(_dirname, p)

const alias: Record<string, string> = {
  '~/': r('../../..'),
  'stacks': r('../index.ts'),
  'stacks/*': r('../../*'),
  'functions/*': r('../../../functions/*'),
  'components/*': r('../../../components/*'),
  'config': r('./config.ts'),
}

export default alias
