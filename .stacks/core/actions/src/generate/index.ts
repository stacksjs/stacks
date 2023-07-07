import { log } from '@stacksjs/logging'
import { Action, NpmScript } from '@stacksjs/types'
import type { GeneratorOptions } from '@stacksjs/types'
import { dumpYaml, runNpmScript } from '@stacksjs/utils'
import { files } from '@stacksjs/storage'
import { runCommand } from '@stacksjs/cli'
import { frameworkPath, projectPath } from '@stacksjs/path'
import { dependencies } from '@stacksjs/config'
import { runAction } from '../helpers'

export async function invoke(options?: GeneratorOptions) {
  if (options?.types)
    await generateTypes(options)

  else if (options?.entries)
    await generateLibEntries(options)

  else if (options?.webTypes)
    await generateWebTypes(options)

  else if (options?.customData)
    await generateVsCodeCustomData(options)

  else if (options?.ideHelpers)
    await generateIdeHelpers(options)

  else if (options?.vueCompatibility)
    await generateVueCompat(options)

  else if (options?.componentMeta)
    await generateComponentMeta(options)
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function generate(options: GeneratorOptions) {
  return invoke(options)
}

export async function generateLibEntries(options: GeneratorOptions) {
  const result = await runAction(Action.GenerateLibraryEntries, { ...options, verbose: true, cwd: projectPath() })

  if (result.isErr()) {
    log.error('There was an error generating your library entry points', result.error)
    process.exit()
  }

  log.success('Library entry points generated successfully')
}

export async function generateVueCompat(options?: GeneratorOptions) {
  const result = await runNpmScript(NpmScript.GenerateVueCompat, options)

  if (result.isErr()) {
    log.error('There was an error generating Vue 2 compatibility.', result.error)
    process.exit()
  }

  log.success('Libraries are now Vue 2 & 3 compatible')
}

export async function generateWebTypes(options?: GeneratorOptions) {
  const result = await runNpmScript(NpmScript.GenerateWebTypes, options)

  if (result.isErr()) {
    log.error('There was an error generating the web-types.json file.', result.error)
    process.exit()
  }

  log.success('Successfully generated the web-types.json file')
}

export async function generateVsCodeCustomData(options?: GeneratorOptions) {
  const result = await runNpmScript(NpmScript.GenerateVsCodeCustomData, options)

  if (result.isErr()) {
    log.error('There was an error generating the custom-elements.json file.', result.error)
    process.exit()
  }

  await runAction(Action.LintFix, { verbose: true }) // the generated json file needs to be linted
  log.success('Successfully generated the custom-elements.json file')
}

export async function generateIdeHelpers(options?: GeneratorOptions) {
  const result = await runNpmScript(NpmScript.GenerateIdeHelpers, options)

  if (result.isErr()) {
    log.error('There was an error generating IDE helpers.', result.error)
    process.exit()
  }

  await runAction(Action.LintFix, { verbose: true }) // the generated json file needs to be linted
  log.success('Successfully generated IDE helpers')
}

export async function generateComponentMeta(options?: GeneratorOptions) {
  const result = await runNpmScript(NpmScript.GenerateComponentMeta, options)

  if (result.isErr()) {
    log.error('There was an error generating your component meta information.', result.error)
    process.exit()
  }

  await runAction(Action.LintFix, { verbose: true }) // the generated json file needs to be linted
  log.success('Successfully generated component meta information')
}

export async function generateTypes(options?: GeneratorOptions) {
  const result = await runNpmScript(NpmScript.GenerateTypes, options)

  if (result.isErr()) {
    log.error('There was an error generating your types.', result.error)
    process.exit()
  }

  log.success('Types were generated successfully')
}

export async function generateMigrations() {
  const path = frameworkPath('database/schema.prisma')

  // await migrate(path, { database: database.driver })

  await runCommand(`npx prisma migrate dev --schema=${path}`)

  log.success('Successfully updated migrations')
}

export async function generateTeaConfig() {
  // define your dependencies
  const deps = dependencies

  // convert the object to yaml
  const yamlStr = dumpYaml({ deps })

  // write the yaml string to a file in your project root
  files.put(projectPath('./tea.yaml'), yamlStr)

  log.success('Successfully generated `./tea.yaml` based on your `./config/deps` file')
}

export async function generateSeeder() {
  // await seed()
}
