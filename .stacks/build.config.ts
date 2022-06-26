import { resolve } from 'path'
import { defineBuildConfig, stacksBuildConfig } from './src/builds'

const entries = [
    resolve(__dirname, '../functions/index'),
    // resolve(__dirname, './src/index'),
];
const outDir = resolve(__dirname, '../.stacks/functions/dist');

export default defineBuildConfig(stacksBuildConfig(entries, outDir))
