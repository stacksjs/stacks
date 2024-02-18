import process from 'node:process'
import { log } from '@stacksjs/logging'
import { Action, NpmScript } from '@stacksjs/enums'
import type { GeneratorOptions } from '@stacksjs/types'
import { runNpmScript } from '@stacksjs/utils'
import { frameworkPath, projectPath } from '@stacksjs/path'
import { runAction } from '../helpers'

// import { files } from '@stacksjs/storage'

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

  else if (options?.componentMeta)
    await generateComponentMeta(options)

  else if (options?.coreSymlink)
    await generateCoreSymlink()
}

export function generate(options: GeneratorOptions) {
  return invoke(options)
}

export async function generateLibEntries(options: GeneratorOptions) {
  const result = await runAction(Action.GenerateLibraryEntries, {
    ...options,
    cwd: projectPath(),
  })

  if (result.isErr()) {
    log.error('There was an error generating your library entry points', result.error)
    process.exit()
  }

  log.success('Library entry points generated successfully')
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
  const result = await runNpmScript(NpmScript.GenerateVsCodeCustomData, {
    cwd: frameworkPath(),
    ...options,
  })

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
  const result = await runNpmScript(NpmScript.GenerateTypes, {
    cwd: frameworkPath(),
    ...options,
  })

  if (result.isErr()) {
    log.error('There was an error generating your types.', result.error)
    process.exit()
  }

  log.success('Types were generated successfully')
}

export function generateMigrations() {
  // const path = frameworkPath('database/schema.prisma')

  // await migrate(path, { database: database.driver })

  // await runCommand(`bunx prisma migrate dev --schema=${path}`)

  log.success('Successfully updated migrations')
}

export function generatePkgxConfig() {
  // write the yaml string to a file in your project root
  // files.put(projectPath('./pkgx.yaml'), yamlStr)

  log.success('Successfully generated `./pkgx.yaml` based on your config')
}

export async function generateSeeder() {
  // await seed()
}

export async function generateCoreSymlink() {
  // symlink path.frameworkPath() to path.projectPath('.stacks')
  await runCommand(`ln -s ${path.frameworkPath()} ${path.projectPath('.stacks')}`)
}
