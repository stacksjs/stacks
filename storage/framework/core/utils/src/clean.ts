import { path as p } from '@stacksjs/path'

export async function cleanProject(): Promise<void> {
  const $ = Bun.$
  await $`rm -rf ${p.projectPath('bun.lock')}`
  await $`rm -rf ${p.projectPath('yarn.lock')}` // just in case
  await $`rm -rf ${p.projectPath('node_modules/')}`
  await $`rm -rf ${p.frameworkPath('dist')}`
  await $`rm -rf ${p.frameworkPath('node_modules')}`
  await $`rm -rf ${p.frameworkPath('**/dist')}`
  await $`rm -rf ${p.frameworkPath('**/node_modules')}`
  await $`rm -rf ${p.frameworkCloudPath('cdk.out/')}`
  await $`rm -rf ${p.frameworkCloudPath('cdk.context.json')}`
  await $`rm -rf ${p.cloudPath('dist.zip')}`
}
