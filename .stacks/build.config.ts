// import { resolve } from 'path'
import { buildStacks, defineBuildConfig } from './src'

console.log('Building stacks...')

export default defineBuildConfig(buildStacks())
