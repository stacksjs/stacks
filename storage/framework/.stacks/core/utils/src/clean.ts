import { path as p } from 'stacks:path'
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
    p.cloudPath('cdk.out/'),
    p.cloudPath('cdk.context.json'),
    p.cloudPath('dist.zip'),
  ])
}
