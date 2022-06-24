import { resolve } from 'path'
import { buildStacks as stacks, defineBuildConfig } from '@ow3/stacks'

console.log('Building stacks...')

export default defineBuildConfig(stacks([resolve(__dirname, '../index')]))
