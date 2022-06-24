import { resolve } from 'path'
import { buildStacks, defineBuildConfig } from './src'

const entries = [
    resolve(__dirname, '../functions/index.ts'),
    resolve(__dirname, '../components/index.ts'),
];
const outDir = resolve(__dirname, '../functions/dist');

export default defineBuildConfig(buildStacks(entries, outDir))
