import { resolve } from 'path'
import { buildStacks, defineBuildConfig } from './src'

const entries = [
    resolve(__dirname, '../functions/index'),
    // resolve(__dirname, './src/index'),
];
const outDir = resolve(__dirname, '../.stacks/functions/dist');

export default defineBuildConfig(buildStacks(entries, outDir))
