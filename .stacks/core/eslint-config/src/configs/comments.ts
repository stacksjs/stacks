import type { ConfigItem } from '../types'
import { pluginComments } from '../plugins'

export function comments(): ConfigItem[] {
  return [
    {
      name: 'antfu:eslint-comments',
      plugins: {
        'eslint-comments': pluginComments,
      },
      rules: {
        'eslint-comments/no-aggregating-enable': 'error',
        'eslint-comments/no-duplicate-disable': 'error',
        // TODO: enable this rule once Stacks errors are resolved
        // 'eslint-comments/no-unlimited-disable': 'error',
        'eslint-comments/no-unused-enable': 'error',
      },
    },
  ]
}
