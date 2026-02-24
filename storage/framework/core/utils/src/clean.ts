import { path as p } from '@stacksjs/path'

export async function cleanProject(): Promise<void> {
  await Bun.$`rm -rf ${p.projectPath('bun.lock')}`
  await Bun.$`rm -rf ${p.projectPath('yarn.lock')}` // just in case
  await Bun.$`rm -rf ${p.projectPath('node_modules/')}`
  await Bun.$`rm -rf ${p.frameworkPath('dist')}`
  await Bun.$`rm -rf ${p.frameworkPath('node_modules')}`
  await Bun.$`rm -rf ${p.frameworkPath('**/dist')}`
  await Bun.$`rm -rf ${p.frameworkPath('**/node_modules')}`
  await Bun.$`rm -rf ${p.frameworkCloudPath('cdk.out/')}`
  await Bun.$`rm -rf ${p.frameworkCloudPath('cdk.context.json')}`
  await Bun.$`rm -rf ${p.cloudPath('dist.zip')}`
}
