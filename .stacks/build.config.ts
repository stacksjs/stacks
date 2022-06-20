import { defineBuildConfig } from 'unbuild'
import { buildStacks } from './builds'

export default defineBuildConfig(buildStacks())
