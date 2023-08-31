import { projectPath } from '@stacksjs/path'
import { rimraf as del } from './delete'

export async function cleanProject() {
  return await del([
    projectPath('bun.lockb'),
    projectPath('yarn.lock'),
    projectPath('node_modules/'),
    projectPath('.stacks/dist'),
    projectPath('.stacks/**/dist'),
  ])
}
