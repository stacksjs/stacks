import { runCommand } from '@stacksjs/cli'

// Run stx dev server for resources/views
// This serves .stx templates from the project's resources/views directory
const viewsPath = 'resources/views'

await runCommand(`serve ${viewsPath} --port 3456`, {
  cwd: process.cwd(),
  // verbose: true,
})
