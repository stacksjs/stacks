import { defineBuildConfig } from 'unbuild'
import { buildComposables as stacks } from './builds'

// eslint-disable-next-line no-console
console.log('Building Composables...', stacks)

export default defineBuildConfig(stacks(['../packages/composables/index']))
