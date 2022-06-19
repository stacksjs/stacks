import { defineBuildConfig } from 'unbuild'
import { buildComposables as buildConfig } from './builds'

// eslint-disable-next-line no-console
console.log('Building Composables...', buildConfig)

export default defineBuildConfig(buildConfig(['../packages/composables/index']))
