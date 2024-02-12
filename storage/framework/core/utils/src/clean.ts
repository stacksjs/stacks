import { path as p } from '@stacksjs/path'
import { rimraf } from './delete'

export async function cleanProject() {
  return await rimraf([
    p.projectPath('bun.lockb'),
    p.projectPath('yarn.lock'),
    p.projectPath('node_modules/'),
    p.frameworkPath('dist'),
    p.frameworkPath('node_modules'),
    p.frameworkPath('**/dist'),
    p.frameworkPath('**/node_modules'),
    p.frameworkCloudPath('cdk.out/'),
    p.frameworkCloudPath('cdk.context.json'),
    p.frameworkCloudPath('dist.zip'),
  ])
}
