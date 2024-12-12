import { $ } from 'bun'
import process from 'node:process'
import { italic, runCommand } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { writeFile } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

const homePath = (await $`echo $HOME`.text()).trim()
const zshrcPath = p.join(homePath, '.zshrc')
const pluginPath = p.shellPath('src/buddy.plugin.zsh')
const customPath = p.join(homePath, '.oh-my-zsh/custom/plugins/buddy/')

log.info(`Setting up Oh My Zsh via ${zshrcPath}...`)
$.cwd(p.dirname(zshrcPath))
let data = await $`cat ${p.basename(zshrcPath)}`.text()

// Manipulate the data
const pluginLineRegex = /^(?!#).*plugins=\(([^)]+)\)/m // ensure it’s not a comment
const match = data.match(pluginLineRegex)

if (match) {
  // Split the captured group by any whitespace and filter out empty strings
  const plugins = match[1]?.split(/\s+/).filter(Boolean)
  if (!plugins) {
    log.error(
      'Maybe the plugins line in your .zshrc file could not be found? If this continues being an issue, please reach out to us on Discord.',
    )
    process.exit(ExitCode.FatalError)
  }

  // 2. Add buddy to the list of plugins if it’s not already there
  if (!plugins.includes('buddy')) {
    plugins.push('buddy')
    // Trim each plugin name and ensure it’s formatted correctly
    const formattedPlugins = plugins.map(plugin => plugin.trim()).join('\n    ')
    const newPluginLine = `plugins=(\n    ${formattedPlugins}\n)`
    // Replace the old plugin line with the new one
    data = data.replace(pluginLineRegex, newPluginLine)
    // Write the data back to the file
    await writeFile(zshrcPath, data)

    // need to copy plugin to ~/.oh-my-zsh/custom/plugins
    log.info(`Copying buddy zsh plugin ${pluginPath} to ${customPath}...`)

    // create customPath if it doesn't exist
    await runCommand(`mkdir -p ${customPath}`)
    await runCommand(`cp -rf ${pluginPath} ${customPath}`)
    // await runCommand(`source ${customPath}/src/buddy.plugin.zsh`)

    log.success('Copied buddy zsh plugin')
  }
  else {
    log.info('Buddy is already set up') // in other words, it is integrated in their shell
    log.info('Ensuring `buddy` is updated...')
    await runCommand(`cp -rf ${pluginPath} ${customPath}`)
    log.success('Updated buddy zsh plugin to latest version')
  }
}

log.success('Oh My Zsh Setup Complete')
log.info(italic('To see changes reflect, you may need to open a new terminal window'))

// if using the vscode terminal, show the message
if (process.env.TERM_PROGRAM === 'vscode')
  log.info('⌘⇧P terminal.create.new.terminal')
