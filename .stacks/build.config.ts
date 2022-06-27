import { resolve } from 'path'
import { defineBuildConfig } from 'unbuild';
import stacksBuildConfig from './src/builds'

const entries = [
    resolve(__dirname, '../functions/index'),
    // resolve(__dirname, './src/index'),
];
const outDir = resolve(__dirname, '../functions/dist');

export default defineBuildConfig(stacksBuildConfig(entries, outDir))
