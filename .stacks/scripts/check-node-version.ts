/**
 * Thanks: https://github.com/vitebook/vitebook/tree/main/scripts
 */

import { exec } from 'child_process'
import { promisify } from 'util'

async function main() {
  const nodeV = await promisify(exec)('node -v')
  const nodeVersion = parseInt(nodeV.stdout.slice(1).split('.')[0])

  if (nodeVersion < 16) {
    console.warn(
      '\n',
      '⚠️ \u001B[33mThis package requires your Node.js version to be `>=16`'
      + ' to work properly.\u001B[39m',
      '\n\n1. Install nvm to automatically manage it by running: \x1B[1mcurl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash\x1B[0m',
      '\n2. When you change your directory to your Stacks project, it will automatically install the proper Node.js version\x1B[0m',
      '\n3. Enable corepack: \x1B[1mcorepack enable\x1B[0m',
      '\n4. Done! Run any `pnpm` commands as usual and it\'ll just work :)',
      '\n\nSee \x1B[1mhttps://github.com/nvm-sh/nvm\x1B[0m for more information.',
      '\n',
    )

    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
