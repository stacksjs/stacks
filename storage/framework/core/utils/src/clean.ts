import { path as p } from '@stacksjs/path'
import { $ } from 'bun'

export async function cleanProject() {
  await $`rm -rf ${p.projectPath('bun.lockb')}`
  await $`rm -rf ${p.projectPath('yarn.lock')}` // just in case
  await $`rm -rf ${p.projectPath('node_modules/')}`
  await $`rm -rf ${p.frameworkPath('dist')}`
  await $`rm -rf ${p.frameworkPath('node_modules')}`
  await $`rm -rf ${p.frameworkPath('**/dist')}`
  await $`rm -rf ${p.frameworkPath('**/node_modules')}`
  await $`rm -rf ${p.frameworkCloudPath('cdk.out/')}`
  await $`rm -rf ${p.frameworkCloudPath('cdk.context.json')}`
  await $`rm -rf ${p.frameworkCloudPath('dist.zip')}`
}
