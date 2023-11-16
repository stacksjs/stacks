import unocss from '@unocss/eslint-plugin'
import { antfu as stacks } from './factory'

export * from './configs'
export * from './factory'
export * from './globs'
export * from './plugins'
export * from './types'
export * from './utils'

// export default {
//   stacks
// }
export default stacks(
  {},
  unocss.configs.flat,
)
