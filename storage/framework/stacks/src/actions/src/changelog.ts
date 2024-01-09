import { execSync, runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

const fromRevision = await execSync('git describe --abbrev=0 --tags HEAD^')
// console.log('fromRevision', fromRevision)
const toRevision = await execSync('git describe')
// console.log('toRevision', toRevision)

await runCommand(`bunx changelogen --output CHANGELOG.md --from ${fromRevision} --to ${toRevision}`, {
  cwd: projectPath(),
})
